"""Neo4j Graph Database Connector & Cypher Query Engine for SIH 2026 #26106.
Provides deep threat identity correlation, campaign clustering, and graph queries.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional


NEO4J_URI = os.getenv("NEO4J_URI", "neo4j+s://afeb4bee.databases.neo4j.io")
NEO4J_USER = os.getenv("NEO4J_USER", "afeb4bee")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "***REMOVED_SECRET***")


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
    urls = case_data.get("aitm_analysis", [])

    cypher_nodes = f"""
// 1. Create Identity & Origin Infrastructure Nodes
MERGE (origin:OriginMTA {{ip: '{origin_ip}', country: '{country}', city: '{city}', asn: '{asn}'}})
MERGE (sender:EmailIdentity {{address: '{sender}'}})
MERGE (target:TargetMailbox {{address: '{recipient}'}})
MERGE (campaign:ThreatCampaign {{id: '{campaign_id}', classification: '{category}', threat_score: {score}}})
MERGE (evidence:DigitalEvidence {{sha256: '{sha256}'}})
"""

    cypher_edges = f"""
// 2. Create Threat Correlation Relationships
MERGE (origin)-[:TRANSMITTED_BY {{timestamp: datetime()}}]->(sender)
MERGE (sender)-[:TARGETED]->(target)
MERGE (sender)-[:ATTRIBUTED_TO]->(campaign)
MERGE (evidence)-[:SUBMITTED_AS_PROOF_OF]->(campaign)
"""

    url_statements = []
    for idx, u in enumerate(urls[:5]):
        u_url = u.get("url", "")
        u_dom = u.get("display_domain", "link")
        url_statements.append(f"""
MERGE (payload_{idx}:PayloadURL {{url: '{u_url}', domain: '{u_dom}'}})
MERGE (sender)-[:EMBEDS_PAYLOAD]->(payload_{idx})
""")

    full_cypher = cypher_nodes + cypher_edges + "".join(url_statements)
    
    return {
        "neo4j_status": "CYPHER_GRAPH_GENERATED",
        "uri": NEO4J_URI,
        "campaign_id": campaign_id,
        "nodes_count": 5 + len(urls[:5]),
        "edges_count": 4 + len(urls[:5]),
        "cypher_query": full_cypher.strip()
    }


def sync_to_neo4j_instance(case_data: Dict[str, Any]) -> Dict[str, Any]:
    cypher_bundle = generate_cypher_statements(case_data)
    try:
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            # Execute Cypher transaction in Neo4j Aura
            session.run(cypher_bundle["cypher_query"])
        driver.close()
        cypher_bundle["neo4j_status"] = "LIVE_SYNCED_TO_NEO4J_AURA"
        cypher_bundle["instance_id"] = NEO4J_USER
    except Exception as err:
        cypher_bundle["neo4j_status"] = "CYPHER_READY"
        cypher_bundle["note"] = f"Generated Cypher graph statements ready: {str(err)}"
    return cypher_bundle
