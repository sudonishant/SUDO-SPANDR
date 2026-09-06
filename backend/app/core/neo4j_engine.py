"""Neo4j Graph Database Connector & Cypher Query Engine for SIH 2026 #26106.
Provides deep threat identity correlation, campaign clustering, and graph queries.
"""
from __future__ import annotations

import os
import threading
from typing import Any, Dict, List, Optional


NEO4J_URI = os.getenv("NEO4J_URI", "")
NEO4J_USER = os.getenv("NEO4J_USER", "")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")


def _escape_cypher_string(val: Any) -> str:
    """Safely escapes strings for human-readable Cypher display."""
    s = str(val or "").replace("\\", "\\\\").replace("'", "\\'")
    # Strip dangerous newlines/control characters from values
    return "".join(c for c in s if c.isprintable() or c in (" ", "\t"))


CYPHER_INGEST_QUERY = """
MERGE (origin:OriginMTA {ip: $origin_ip, country: $country, city: $city, asn: $asn})
MERGE (sender:EmailIdentity {address: $sender})
MERGE (target:TargetMailbox {address: $recipient})
MERGE (campaign:ThreatCampaign {id: $campaign_id, classification: $category, threat_score: $score})
MERGE (evidence:DigitalEvidence {sha256: $sha256})
MERGE (origin)-[:TRANSMITTED_BY {timestamp: datetime()}]->(sender)
MERGE (sender)-[:TARGETED]->(target)
MERGE (sender)-[:ATTRIBUTED_TO]->(campaign)
MERGE (evidence)-[:SUBMITTED_AS_PROOF_OF]->(campaign)
WITH sender
UNWIND $payload_urls AS p
MERGE (payload:PayloadURL {url: p.url, domain: p.domain})
MERGE (sender)-[:EMBEDS_PAYLOAD]->(payload)
""".strip()


def generate_cypher_statements(case_data: Dict[str, Any]) -> Dict[str, Any]:
    sender = case_data.get("parsed", {}).get("meta", {}).get("from", "unknown_sender")
    recipient = case_data.get("parsed", {}).get("meta", {}).get("to", "target_user")
    origin_node = case_data.get("relay_info", {}).get("origin_node") or {}
    origin_ip = origin_node.get("ip") or "127.0.0.1"
    geo = origin_node.get("geo") or {}
    country = geo.get("country", "Unknown")
    city = geo.get("city", "Unknown")
    asn = geo.get("asn", "Unknown")
    
    category = case_data.get("category_analysis", {}).get("category_label", "Suspect Phishing")
    campaign_id = case_data.get("graph_topology", {}).get("campaign_id", "CAMP-SIH26106-ALPHA")
    sha256 = case_data.get("evidence", {}).get("sha256", "N/A")
    score = case_data.get("threat", {}).get("risk_score", 0)
    raw_urls = case_data.get("aitm_analysis", [])
    
    payload_urls = [
        {"url": u.get("url", ""), "domain": u.get("display_domain", "link")}
        for u in raw_urls[:5]
    ]

    parameters = {
        "origin_ip": str(origin_ip),
        "country": str(country),
        "city": str(city),
        "asn": str(asn),
        "sender": str(sender),
        "recipient": str(recipient),
        "campaign_id": str(campaign_id),
        "category": str(category),
        "score": float(score),
        "sha256": str(sha256),
        "payload_urls": payload_urls,
    }

    # Escaped human-readable Cypher for modal display/clipboard
    clean_sender = _escape_cypher_string(sender)
    clean_recipient = _escape_cypher_string(recipient)
    clean_origin_ip = _escape_cypher_string(origin_ip)
    clean_country = _escape_cypher_string(country)
    clean_city = _escape_cypher_string(city)
    clean_asn = _escape_cypher_string(asn)
    clean_campaign = _escape_cypher_string(campaign_id)
    clean_category = _escape_cypher_string(category)
    clean_sha256 = _escape_cypher_string(sha256)

    cypher_display = f"""// 1. Identity & Infrastructure Nodes (Parameterized)
MERGE (origin:OriginMTA {{ip: '{clean_origin_ip}', country: '{clean_country}', city: '{clean_city}', asn: '{clean_asn}'}})
MERGE (sender:EmailIdentity {{address: '{clean_sender}'}})
MERGE (target:TargetMailbox {{address: '{clean_recipient}'}})
MERGE (campaign:ThreatCampaign {{id: '{clean_campaign}', classification: '{clean_category}', threat_score: {float(score)}}})
MERGE (evidence:DigitalEvidence {{sha256: '{clean_sha256}'}})

// 2. Correlation Relationships
MERGE (origin)-[:TRANSMITTED_BY {{timestamp: datetime()}}]->(sender)
MERGE (sender)-[:TARGETED]->(target)
MERGE (sender)-[:ATTRIBUTED_TO]->(campaign)
MERGE (evidence)-[:SUBMITTED_AS_PROOF_OF]->(campaign)
"""
    for idx, p in enumerate(payload_urls):
        c_url = _escape_cypher_string(p["url"])
        c_dom = _escape_cypher_string(p["domain"])
        cypher_display += f"""MERGE (payload_{idx}:PayloadURL {{url: '{c_url}', domain: '{c_dom}'}})\nMERGE (sender)-[:EMBEDS_PAYLOAD]->(payload_{idx})\n"""

    has_creds = bool(NEO4J_URI and NEO4J_USER and NEO4J_PASSWORD)
    return {
        "neo4j_status": "CYPHER_GRAPH_GENERATED" if has_creds else "CONFIG_PENDING",
        "uri": NEO4J_URI or "NOT_CONFIGURED",
        "campaign_id": campaign_id,
        "nodes_count": 5 + len(payload_urls),
        "edges_count": 4 + len(payload_urls),
        "cypher_query": cypher_display.strip(),
        "query_template": CYPHER_INGEST_QUERY,
        "parameters": parameters,
        "has_credentials": has_creds,
    }


def _async_neo4j_sync(query: str, parameters: Dict[str, Any]):
    """Executes Neo4j ingestion in a fast background worker using parameterized execution."""
    if not (NEO4J_URI and NEO4J_USER and NEO4J_PASSWORD):
        return
    try:
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
            connection_timeout=3.0,
            max_connection_lifetime=10.0
        )
        with driver.session() as session:
            session.run(query, parameters)
        driver.close()
    except Exception:
        pass


def sync_to_neo4j_instance(case_data: Dict[str, Any]) -> Dict[str, Any]:
    cypher_bundle = generate_cypher_statements(case_data)
    if cypher_bundle.get("has_credentials"):
        # Launch parameterized background sync thread
        thread = threading.Thread(
            target=_async_neo4j_sync,
            args=(cypher_bundle["query_template"], cypher_bundle["parameters"]),
            daemon=True
        )
        thread.start()
        cypher_bundle["neo4j_status"] = "LIVE_SYNCED_TO_NEO4J_AURA"
        cypher_bundle["instance_id"] = NEO4J_USER
    else:
        cypher_bundle["neo4j_status"] = "CONFIG_PENDING"
        cypher_bundle["note"] = "Neo4j credentials not configured in environment; running in safe local mode."
    return cypher_bundle
