"""Supabase Cloud Database & Real-Time Incident Vault Connector for SIH 2026 #26106.
Stores digital evidence, threat cases, and blockchain notary records with Row-Level Security.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Optional


SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")


SUPABASE_SCHEMA_SQL = """-- =============================================================================
-- SUDO SPANDR SENTINELMAIL: SUPABASE POSTGRESQL SCHEMA (SIH 2026 #26106)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/jpoppmxygbtxsmxgpacz/sql/new
-- =============================================================================

CREATE TABLE IF NOT EXISTS forensic_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id VARCHAR(64) UNIQUE NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    threat_score NUMERIC(5, 2) NOT NULL,
    threat_status VARCHAR(32) NOT NULL,
    category_label VARCHAR(128) NOT NULL,
    sender VARCHAR(255),
    recipient VARCHAR(255),
    subject TEXT,
    origin_ip VARCHAR(64),
    origin_country VARCHAR(64),
    origin_asn VARCHAR(64),
    blockchain_tx_hash VARCHAR(128),
    blockchain_block_number BIGINT,
    blockchain_merkle_root VARCHAR(128),
    evidence_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE forensic_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated investigators to read cases"
    ON forensic_cases FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role full access"
    ON forensic_cases FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
"""


def get_supabase_config() -> Dict[str, Any]:
    return {
        "url": SUPABASE_URL or "NOT_CONFIGURED",
        "has_credentials": bool(SUPABASE_URL and SUPABASE_KEY),
        "table_name": "forensic_cases",
        "sql_editor_url": f"{SUPABASE_URL}/project/sql/new" if SUPABASE_URL else "https://supabase.com/dashboard"
    }


def sync_to_supabase(case_data: Dict[str, Any]) -> Dict[str, Any]:
    meta = case_data.get("parsed", {}).get("meta", {})
    threat = case_data.get("threat", {})
    origin_node = case_data.get("relay_info", {}).get("origin_node") or {}
    geo = origin_node.get("geo") or {}
    bc = case_data.get("blockchain_notary", {})
    sha256 = case_data.get("evidence", {}).get("sha256", "")
    case_id = case_data.get("case_id", f"CS-{sha256[:12].upper()}")

    payload = {
        "case_id": case_id,
        "sha256_hash": sha256,
        "threat_score": threat.get("risk_score", 0),
        "threat_status": threat.get("status", "ANALYZED"),
        "category_label": case_data.get("category_analysis", {}).get("category_label", "Suspect Phishing"),
        "sender": meta.get("from", ""),
        "recipient": meta.get("to", ""),
        "subject": meta.get("subject", ""),
        "origin_ip": origin_node.get("ip") or "127.0.0.1",
        "origin_country": geo.get("country", "Unknown"),
        "origin_asn": geo.get("asn", "Unknown"),
        "blockchain_tx_hash": bc.get("transaction_hash", ""),
        "blockchain_block_number": bc.get("block_number", 0),
        "blockchain_merkle_root": bc.get("merkle_root", "")
    }

    if not SUPABASE_URL or not SUPABASE_KEY:
        return {
            "status": "CONFIG_PENDING",
            "url": SUPABASE_URL,
            "table": "forensic_cases",
            "payload_prepared": payload
        }

    try:
        endpoint = f"{SUPABASE_URL}/rest/v1/forensic_cases"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        req = urllib.request.Request(endpoint, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            return {
                "status": "LIVE_SYNCED_TO_SUPABASE",
                "record_id": res_body[0].get("id") if res_body else "inserted",
                "table": "forensic_cases",
                "supabase_url": SUPABASE_URL
            }
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {
                "status": "TABLE_CREATION_REQUIRED",
                "note": "Supabase connected! Table 'forensic_cases' needs to be created via SQL Editor.",
                "sql_editor_url": "https://supabase.com/dashboard/project/jpoppmxygbtxsmxgpacz/sql/new",
                "payload_prepared": payload
            }
        return {
            "status": "SYNC_FAILED",
            "error": f"HTTP {e.code}: {e.reason}",
            "payload_prepared": payload
        }
    except Exception as err:
        return {
            "status": "SYNC_FAILED",
            "error": str(err),
            "payload_prepared": payload
        }
