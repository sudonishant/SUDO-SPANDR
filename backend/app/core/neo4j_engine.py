"""Case-scoped Neo4j evidence projection and database readback.

Only the strict metadata model in this module is accepted. Message bodies, raw
EML/MSG bytes, arbitrary headers and attachment content are not graph inputs.
A successful response is based on a post-commit Neo4j query, never on the
client-supplied projection alone.
"""
from __future__ import annotations

import hashlib
import ipaddress
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


logger = logging.getLogger("sudo_spandr.neo4j")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+$")
DOMAIN_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
AUTH_METHODS = {"spf", "dkim", "dmarc", "arc"}
AUTH_RESULTS = {"pass", "fail", "softfail", "neutral", "none", "temperror", "permerror", "policy", "hardfail"}


def _plain_text(value: str, field_name: str, maximum: int) -> str:
    text = str(value or "").strip()
    if len(text) > maximum:
        raise ValueError(f"{field_name} exceeds {maximum} characters")
    if any(ord(character) < 32 or ord(character) == 127 for character in text):
        raise ValueError(f"{field_name} contains control characters")
    return text


def _domain(value: str) -> str:
    text = _plain_text(value, "domain", 253).lower().rstrip(".")
    try:
        text = text.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ValueError("domain is not valid IDNA") from exc
    labels = text.split(".")
    if not text or any(not DOMAIN_LABEL.fullmatch(label) for label in labels):
        raise ValueError("domain is not a valid DNS hostname")
    return text


class StrictGraphModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class GraphIp(StrictGraphModel):
    ip: str = Field(max_length=128)
    field: str = Field(default="Submitted header", max_length=80)

    @field_validator("ip")
    @classmethod
    def valid_ip(cls, value: str) -> str:
        return str(ipaddress.ip_address(value))

    @field_validator("field")
    @classmethod
    def valid_field(cls, value: str) -> str:
        return _plain_text(value, "IP evidence field", 80) or "Submitted header"


class GraphUrl(StrictGraphModel):
    url: str = Field(max_length=2048)
    risk: str = Field(default="UNASSESSED", max_length=32)
    kind: str = Field(default="actionable link", max_length=80)

    @field_validator("url")
    @classmethod
    def sanitized_url(cls, value: str) -> str:
        text = _plain_text(value, "URL", 2048)
        parsed = urlsplit(text)
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
            raise ValueError("only absolute HTTP(S) URLs are accepted")
        if parsed.username or parsed.password:
            raise ValueError("URL userinfo is not accepted")
        if parsed.query or parsed.fragment:
            raise ValueError("URL query and fragment must be removed before graph projection")
        try:
            port = parsed.port
        except ValueError as exc:
            raise ValueError("URL port is invalid") from exc
        hostname = parsed.hostname.lower()
        netloc = f"[{hostname}]" if ":" in hostname else hostname
        if port is not None:
            netloc = f"{netloc}:{port}"
        return urlunsplit((parsed.scheme.lower(), netloc, parsed.path or "/", "", ""))

    @field_validator("risk", "kind")
    @classmethod
    def valid_url_metadata(cls, value: str, info: Any) -> str:
        maximum = 32 if info.field_name == "risk" else 80
        return _plain_text(value, info.field_name, maximum)


class GraphAttachment(StrictGraphModel):
    filename: str = Field(max_length=255)
    sha256: Optional[str] = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")
    size_bytes: int = Field(default=0, ge=0, le=100_000_000_000)
    detected_type: str = Field(default="Unknown", max_length=120)
    risk_level: str = Field(default="UNASSESSED", max_length=32)

    @field_validator("filename")
    @classmethod
    def valid_filename(cls, value: str) -> str:
        return _plain_text(value, "attachment filename", 255) or "unnamed"

    @field_validator("sha256")
    @classmethod
    def normalize_hash(cls, value: Optional[str]) -> Optional[str]:
        return value.lower() if value else None

    @field_validator("detected_type", "risk_level")
    @classmethod
    def valid_attachment_metadata(cls, value: str, info: Any) -> str:
        return _plain_text(value, info.field_name, 120 if info.field_name == "detected_type" else 32)


class GraphReportedAuth(StrictGraphModel):
    method: str = Field(max_length=16)
    result: str = Field(max_length=24)
    identity_domain: Optional[str] = Field(default=None, max_length=253)
    aligned: Optional[bool] = None
    authserv_id: str = Field(default="Not reported", max_length=255)
    header_name: str = Field(default="Submitted authentication header", max_length=80)
    header_index: int = Field(default=0, ge=0, le=10_000)

    @field_validator("method")
    @classmethod
    def valid_method(cls, value: str) -> str:
        method = value.lower()
        if method not in AUTH_METHODS:
            raise ValueError("unsupported authentication method")
        return method

    @field_validator("result")
    @classmethod
    def valid_result(cls, value: str) -> str:
        result = value.lower()
        if result not in AUTH_RESULTS:
            raise ValueError("unsupported reported authentication result")
        return result

    @field_validator("identity_domain")
    @classmethod
    def valid_identity_domain(cls, value: Optional[str]) -> Optional[str]:
        return _domain(value) if value else None

    @field_validator("authserv_id", "header_name")
    @classmethod
    def valid_auth_metadata(cls, value: str, info: Any) -> str:
        return _plain_text(value, info.field_name, 255 if info.field_name == "authserv_id" else 80)


class EvidenceGraphProjection(StrictGraphModel):
    case_id: str = Field(pattern=r"^(?:CS|FILE)-[A-F0-9]{12}$")
    evidence_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    source_mode: str = Field(max_length=32)
    triage_score: int = Field(ge=0, le=100, strict=True)
    category_id: str = Field(default="unknown", max_length=80)
    category_label: str = Field(default="Unknown / insufficient evidence", max_length=160)
    sender: Optional[str] = Field(default=None, max_length=320)
    recipient: Optional[str] = Field(default=None, max_length=320)
    ips: List[GraphIp] = Field(default_factory=list, max_length=20)
    urls: List[GraphUrl] = Field(default_factory=list, max_length=20)
    attachments: List[GraphAttachment] = Field(default_factory=list, max_length=20)
    reported_auth: List[GraphReportedAuth] = Field(default_factory=list, max_length=40)

    @field_validator("evidence_sha256")
    @classmethod
    def normalize_evidence_hash(cls, value: str) -> str:
        return value.lower()

    @field_validator("source_mode")
    @classmethod
    def valid_source_mode(cls, value: str) -> str:
        mode = value.lower()
        if mode not in {"eml", "msg", "text", "text-headers", "attachment"}:
            raise ValueError("unsupported evidence source mode")
        return mode

    @field_validator("category_id", "category_label")
    @classmethod
    def valid_category(cls, value: str, info: Any) -> str:
        return _plain_text(value, info.field_name, 80 if info.field_name == "category_id" else 160)

    @field_validator("sender", "recipient")
    @classmethod
    def valid_address(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        address = _plain_text(value, "email address", 320).lower()
        if not EMAIL_PATTERN.fullmatch(address):
            raise ValueError("expected an email address without a display name")
        _domain(address.rsplit("@", 1)[1])
        return address

    @model_validator(mode="after")
    def case_is_bound_to_evidence_hash(self) -> "EvidenceGraphProjection":
        prefix = "FILE" if self.source_mode == "attachment" else "CS"
        expected = f"{prefix}-{self.evidence_sha256[:12].upper()}"
        if self.case_id != expected:
            raise ValueError("case_id must be derived from the supplied evidence SHA-256")
        return self


def _config() -> Tuple[Optional[str], Any, str, Optional[str]]:
    uri = os.getenv("NEO4J_URI", "").strip()
    database = os.getenv("NEO4J_DATABASE", "neo4j").strip() or "neo4j"
    auth_disabled = os.getenv("NEO4J_AUTH_DISABLED", "").lower() == "true"
    if not uri:
        return None, None, database, "NEO4J_URI is not configured on the backend."
    if auth_disabled:
        # This flag exists for a disposable loopback test database only.
        if not re.match(r"^(?:bolt|neo4j)(?:\+s(?:sc)?)?://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?/?$", uri):
            return None, None, database, "NEO4J_AUTH_DISABLED is allowed only for a loopback test instance."
        return uri, None, database, None
    user = os.getenv("NEO4J_USER", "").strip()
    password = os.getenv("NEO4J_PASSWORD", "")
    if not user or not password:
        return None, None, database, "NEO4J_USER and NEO4J_PASSWORD must be configured server-side."
    return uri, (user, password), database, None


def _unconfigured(case_id: str, message: str) -> Dict[str, Any]:
    return {
        "status": "not_configured",
        "case_id": case_id,
        "database": "Neo4j",
        "persisted": False,
        "readback": False,
        "source": "none",
        "message": message,
        "graph": {"nodes": [], "edges": []},
    }


def _key(case_id: str, kind: str, value: str) -> str:
    digest = hashlib.sha256(f"{case_id}\0{kind}\0{value}".encode("utf-8")).hexdigest()[:20]
    return f"{case_id}:{kind}:{digest}"


def _build_elements(projection: EvidenceGraphProjection) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], str]:
    case_id = projection.case_id
    projected_at = datetime.now(timezone.utc).isoformat()
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    def add_node(kind: str, label: str, value: str, properties: Optional[Dict[str, Any]] = None) -> str:
        key = case_id if kind == "case" else _key(case_id, kind, value)
        if any(node["key"] == key for node in nodes):
            return key
        nodes.append({
            "key": key,
            "kind": kind,
            "label": label,
            "value": value,
            "properties": {k: v for k, v in (properties or {}).items() if v is not None},
        })
        return key

    def add_edge(source: str, target: str, kind: str, properties: Optional[Dict[str, Any]] = None) -> None:
        value = f"{source}\0{target}\0{kind}"
        key = _key(case_id, "relationship", value)
        if any(edge["key"] == key for edge in edges):
            return
        edges.append({
            "key": key,
            "source": source,
            "target": target,
            "kind": kind,
            "properties": {k: v for k, v in (properties or {}).items() if v is not None},
        })

    case_key = add_node("case", case_id, case_id, {
        "evidence_sha256": projection.evidence_sha256,
        "source_mode": projection.source_mode,
        "triage_score": projection.triage_score,
        "category_id": projection.category_id,
        "category_label": projection.category_label,
        "projected_at": projected_at,
        "evidence_scope": "Sanitized case metadata; no raw message body, EML/MSG bytes, arbitrary headers, or attachment content.",
    })
    domain_sources: Dict[str, set] = {}
    domain_nodes: Dict[str, str] = {}

    def register_domain(value: Optional[str], source: str) -> Optional[str]:
        if not value:
            return None
        normalized = _domain(value)
        domain_sources.setdefault(normalized, set()).add(source)
        if normalized not in domain_nodes:
            domain_nodes[normalized] = add_node("domain", normalized, normalized, {"evidence_scope": "Domain parsed from submitted metadata; not proof of control or ownership."})
        return domain_nodes[normalized]

    if projection.sender:
        sender_key = add_node("sender", projection.sender, projection.sender, {"evidence_scope": "Visible From identity; claimed sender, not independently verified control."})
        add_edge(case_key, sender_key, "HAS_CLAIMED_SENDER", {"evidence_scope": "Submitted Visible From header"})
        sender_domain = projection.sender.rsplit("@", 1)[1]
        domain_key = register_domain(sender_domain, "sender")
        add_edge(sender_key, domain_key, "HAS_SENDER_DOMAIN")

    if projection.recipient:
        recipient_key = add_node("recipient", projection.recipient, projection.recipient, {"evidence_scope": "Submitted recipient identity; no mailbox access or delivery assertion."})
        add_edge(case_key, recipient_key, "HAS_RECIPIENT", {"evidence_scope": "Submitted To header"})
        recipient_domain = projection.recipient.rsplit("@", 1)[1]
        domain_key = register_domain(recipient_domain, "recipient")
        add_edge(recipient_key, domain_key, "HAS_RECIPIENT_DOMAIN")

    grouped_ips: Dict[str, set] = {}
    for item in projection.ips:
        grouped_ips.setdefault(item.ip, set()).add(item.field)
    for ip, fields in sorted(grouped_ips.items()):
        ip_key = add_node("ip", ip, ip, {"fields": sorted(fields), "evidence_scope": "Submitted header IP observation; not an origin determination or person/device attribution."})
        add_edge(case_key, ip_key, "OBSERVED_HEADER_IP", {"fields": sorted(fields), "evidence_scope": "Header evidence only; no geographic relay route inferred"})

    for item in projection.urls:
        url_key = add_node("url", item.url, item.url, {"risk": item.risk, "url_kind": item.kind, "evidence_scope": "Statically extracted URL; no visit, execution, reputation verdict, query, fragment, or userinfo."})
        add_edge(case_key, url_key, "CONTAINS_URL", {"risk": item.risk, "url_kind": item.kind, "sanitization": "Query and fragment removed; userinfo rejected"})
        hostname = urlsplit(item.url).hostname
        try:
            ipaddress.ip_address(hostname)
            is_ip_literal = True
        except ValueError:
            is_ip_literal = False
        if not is_ip_literal:
            domain_key = register_domain(hostname, "url")
            add_edge(url_key, domain_key, "HAS_URL_HOSTNAME")

    for item in projection.attachments:
        value = item.sha256 or f"{item.filename}\0{item.size_bytes}"
        attachment_key = add_node("attachment", item.filename, value, {
            "filename": item.filename,
            "sha256": item.sha256,
            "size_bytes": item.size_bytes,
            "detected_type": item.detected_type,
            "risk_level": item.risk_level,
            "evidence_scope": "Attachment metadata only; file bytes are not projected.",
        })
        add_edge(case_key, attachment_key, "HAS_ATTACHMENT", {"evidence_scope": "Static attachment metadata"})

    for item in projection.reported_auth:
        auth_value = "\0".join([
            item.method, item.result, item.header_name, str(item.header_index),
            item.identity_domain or "", item.authserv_id,
        ])
        auth_label = f"{item.method.upper()} {item.result}"
        auth_key = add_node("reported_auth", auth_label, auth_value, {
            "method": item.method,
            "result": item.result,
            "identity_domain": item.identity_domain,
            "aligned": item.aligned,
            "authserv_id": item.authserv_id,
            "header_name": item.header_name,
            "header_index": item.header_index,
            "evidence_scope": "REPORTED result from a submitted receiver header; not independent DNS or cryptographic verification.",
        })
        add_edge(case_key, auth_key, "HAS_REPORTED_AUTH_RESULT", {"evidence_scope": "Submitted receiver report only"})
        if item.identity_domain:
            domain_key = register_domain(item.identity_domain, "reported-auth")
            add_edge(auth_key, domain_key, "REPORTED_AUTH_IDENTITY_DOMAIN", {"aligned": item.aligned})

    for domain, sources in sorted(domain_sources.items()):
        add_edge(case_key, domain_nodes[domain], "OBSERVED_DOMAIN", {"sources": sorted(sources), "evidence_scope": "Metadata parsing only; no ownership or maliciousness assertion"})

    return nodes, edges, projected_at


def _write_projection(tx: Any, case_id: str, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> None:
    # Re-projection is idempotent and cannot touch another case's subgraph.
    tx.run("MATCH (n:EvidenceNode {case_id: $case_id}) DETACH DELETE n", case_id=case_id).consume()
    tx.run(
        """
        UNWIND $nodes AS row
        MERGE (n:EvidenceNode {key: row.key})
        SET n.case_id = $case_id, n.kind = row.kind, n.label = row.label, n.value = row.value
        SET n += row.properties
        """,
        case_id=case_id,
        nodes=nodes,
    ).consume()
    if edges:
        tx.run(
            """
            UNWIND $edges AS row
            MATCH (source:EvidenceNode {key: row.source, case_id: $case_id})
            MATCH (target:EvidenceNode {key: row.target, case_id: $case_id})
            MERGE (source)-[relationship:EVIDENCE {key: row.key}]->(target)
            SET relationship.kind = row.kind
            SET relationship += row.properties
            """,
            case_id=case_id,
            edges=edges,
        ).consume()


def _read_projection(tx: Any, case_id: str) -> Dict[str, Any]:
    node_records = list(tx.run(
        "MATCH (n:EvidenceNode {case_id: $case_id}) RETURN n ORDER BY n.kind, n.label, n.key",
        case_id=case_id,
    ))
    nodes = []
    for record in node_records:
        raw = dict(record["n"])
        nodes.append({
            "id": raw.pop("key"),
            "kind": raw.pop("kind", "unknown"),
            "label": raw.pop("label", "Evidence"),
            "value": raw.pop("value", ""),
            "case_id": raw.pop("case_id", case_id),
            "properties": raw,
        })
    edge_records = list(tx.run(
        """
        MATCH (source:EvidenceNode {case_id: $case_id})-[relationship:EVIDENCE]->(target:EvidenceNode {case_id: $case_id})
        RETURN source.key AS source, target.key AS target, relationship
        ORDER BY relationship.kind, relationship.key
        """,
        case_id=case_id,
    ))
    edges = []
    for record in edge_records:
        raw = dict(record["relationship"])
        edges.append({
            "id": raw.pop("key"),
            "source": record["source"],
            "target": record["target"],
            "kind": raw.pop("kind", "EVIDENCE"),
            "properties": raw,
        })
    return {"nodes": nodes, "edges": edges}


def _open_driver(uri: str, auth: Any) -> Any:
    from neo4j import GraphDatabase

    return GraphDatabase.driver(
        uri,
        auth=auth,
        connection_timeout=4.0,
        connection_acquisition_timeout=5.0,
        max_connection_lifetime=60.0,
    )


def project_evidence_graph(projection: EvidenceGraphProjection) -> Dict[str, Any]:
    """Write one sanitized case graph and return only Neo4j query readback."""
    case_id = projection.case_id
    uri, auth, database, config_error = _config()
    if config_error:
        return _unconfigured(case_id, config_error)
    nodes, edges, projected_at = _build_elements(projection)
    driver = None
    try:
        driver = _open_driver(uri, auth)
        driver.verify_connectivity()
        with driver.session(database=database) as session:
            session.run("CREATE CONSTRAINT evidence_node_key IF NOT EXISTS FOR (n:EvidenceNode) REQUIRE n.key IS UNIQUE").consume()
            session.run("CREATE INDEX evidence_node_case IF NOT EXISTS FOR (n:EvidenceNode) ON (n.case_id)").consume()
            session.execute_write(_write_projection, case_id, nodes, edges)
            graph = session.execute_read(_read_projection, case_id)

        expected_nodes = {node["key"] for node in nodes}
        expected_edges = {edge["key"] for edge in edges}
        actual_nodes = {node["id"] for node in graph["nodes"]}
        actual_edges = {edge["id"] for edge in graph["edges"]}
        if actual_nodes != expected_nodes or actual_edges != expected_edges:
            raise RuntimeError("Neo4j readback did not match the committed case projection")
        return {
            "status": "available",
            "case_id": case_id,
            "database": "Neo4j",
            "database_name": database,
            "persisted": True,
            "write_committed": True,
            "readback": True,
            "source": "neo4j_readback",
            "projected_at": projected_at,
            "counts": {"nodes": len(graph["nodes"]), "relationships": len(graph["edges"])},
            "graph": graph,
            "privacy": "Only strict sanitized metadata was projected. Raw EML/MSG bytes, message body, subject, arbitrary headers, attachment content, URL query/fragment and Neo4j credentials were not sent to the browser graph response or stored as graph content.",
            "limitations": [
                "Relationships describe submitted evidence, not sender identity, origin, campaign attribution, ownership, maliciousness, or a geographic relay route.",
                "Reported authentication nodes are receiver-header claims, not independent DNS or cryptographic verification.",
                "Availability applies to the configured backend Neo4j instance; it does not establish public deployment or cross-device browser persistence.",
            ],
        }
    except Exception as exc:
        # Credentials, connection URIs and driver exception text stay server-side.
        logger.exception("Neo4j projection/readback failed for case %s", case_id)
        return {
            "status": "unavailable",
            "case_id": case_id,
            "database": "Neo4j",
            "persisted": False,
            "readback": False,
            "source": "none",
            "error_type": type(exc).__name__,
            "message": "The configured Neo4j service could not complete the required write and readback. No graph success is claimed; inspect backend logs and database configuration.",
            "graph": {"nodes": [], "edges": []},
        }
    finally:
        if driver is not None:
            driver.close()


def read_evidence_graph(case_id: str) -> Dict[str, Any]:
    """Internal case-scoped read helper used by verification and diagnostics."""
    if not re.fullmatch(r"(?:CS|FILE)-[A-F0-9]{12}", case_id):
        return {"status": "invalid_request", "case_id": case_id, "graph": {"nodes": [], "edges": []}}
    uri, auth, database, config_error = _config()
    if config_error:
        return _unconfigured(case_id, config_error)
    driver = None
    try:
        driver = _open_driver(uri, auth)
        with driver.session(database=database) as session:
            graph = session.execute_read(_read_projection, case_id)
        if not graph["nodes"]:
            return {"status": "not_found", "case_id": case_id, "persisted": False, "readback": True, "source": "neo4j_readback", "graph": graph}
        return {
            "status": "available",
            "case_id": case_id,
            "persisted": True,
            "readback": True,
            "source": "neo4j_readback",
            "counts": {"nodes": len(graph["nodes"]), "relationships": len(graph["edges"])},
            "graph": graph,
        }
    except Exception as exc:
        logger.exception("Neo4j readback failed for case %s", case_id)
        return {"status": "unavailable", "case_id": case_id, "persisted": False, "readback": False, "source": "none", "error_type": type(exc).__name__, "graph": {"nodes": [], "edges": []}}
    finally:
        if driver is not None:
            driver.close()
