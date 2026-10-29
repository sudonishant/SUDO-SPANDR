"""Real Neo4j integration gate; requires NEO4J_URI and server-side auth env.

For a disposable loopback Neo4j with authentication disabled, additionally set
NEO4J_AUTH_DISABLED=true. No credential or database endpoint is hardcoded here.
"""
import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.neo4j_engine import EvidenceGraphProjection, project_evidence_graph, read_evidence_graph


def projection_for(raw: bytes, complete: bool = True) -> EvidenceGraphProjection:
    digest = hashlib.sha256(raw).hexdigest()
    payload = {
        "case_id": f"CS-{digest[:12].upper()}",
        "evidence_sha256": digest,
        "source_mode": "eml",
        "triage_score": 16,
        "category_id": "unknown",
        "category_label": "Unknown / insufficient evidence",
        "sender": "sender@example.test" if complete else None,
        "recipient": "recipient@example.org" if complete else None,
        "ips": [
            {"ip": "192.0.2.10", "field": "Received"},
            {"ip": "192.0.2.10", "field": "X-Sender-IP"},
        ] if complete else [],
        "urls": [{"url": "https://login.example.test/path", "risk": "REVIEW", "kind": "actionable link"}] if complete else [],
        "attachments": [{
            "filename": "invoice.pdf", "sha256": "a" * 64, "size_bytes": 123,
            "detected_type": "PDF", "risk_level": "LOW",
        }] if complete else [],
        "reported_auth": [{
            "method": "spf", "result": "softfail", "identity_domain": "example.test",
            "aligned": True, "authserv_id": "mx.example.test",
            "header_name": "Authentication-Results", "header_index": 0,
        }] if complete else [],
    }
    return EvidenceGraphProjection.model_validate(payload)


def main() -> None:
    if not os.getenv("NEO4J_URI"):
        raise SystemExit("Set NEO4J_URI and server-side authentication before running this real integration gate.")
    projection = projection_for(b"synthetic graph integration evidence; not an email")
    result = project_evidence_graph(projection)
    assert result["status"] == "available", result
    assert result["persisted"] and result["write_committed"] and result["readback"]
    assert result["source"] == "neo4j_readback"
    kinds = {node["kind"] for node in result["graph"]["nodes"]}
    assert {"case", "sender", "recipient", "domain", "ip", "url", "attachment", "reported_auth"} <= kinds
    relationship_kinds = {edge["kind"] for edge in result["graph"]["edges"]}
    assert "HAS_REPORTED_AUTH_RESULT" in relationship_kinds
    assert not any("ATTRIBUT" in kind or "CAMPAIGN" in kind or "ORIGIN" in kind for kind in relationship_kinds)
    serialized = json.dumps(result)
    assert "body" not in projection.model_dump() and "headers" not in projection.model_dump() and "raw_eml" not in projection.model_dump()
    assert "NEO4J_PASSWORD" not in serialized and "bolt://" not in serialized

    repeated = project_evidence_graph(projection)
    assert repeated["status"] == "available", repeated
    assert repeated["counts"] == result["counts"], (result["counts"], repeated["counts"])

    first_counts = result["counts"]
    other = projection_for(b"separate case isolation evidence", complete=False)
    other_result = project_evidence_graph(other)
    assert other_result["status"] == "available", other_result
    reread = read_evidence_graph(projection.case_id)
    assert reread["status"] == "available" and reread["counts"] == first_counts
    assert read_evidence_graph(other.case_id)["status"] == "available"
    print(f"REAL NEO4J PASS: {projection.case_id} · {first_counts['nodes']} nodes · {first_counts['relationships']} relationships · write/readback/idempotency/case-isolation")


if __name__ == "__main__":
    main()
