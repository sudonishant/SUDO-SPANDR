"""Security Regression Test Suite for CyberSquad SentinelMail.
Verifies fixes for:
1. Zero hardcoded secrets in backend source files.
2. Cypher query injection hardening and parameterization.
3. Server-Side Request Forgery (SSRF) defense on all internal/cloud metadata targets.
4. Safe degraded mode for unconfigured external services (Neo4j, Supabase).
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.core.neo4j_engine import generate_cypher_statements, sync_to_neo4j_instance, CYPHER_INGEST_QUERY
from app.core.supabase_engine import sync_to_supabase, get_supabase_config
from app.core.web_sandbox_engine import is_safe_public_destination, inspect_url_dom_and_headers


def test_no_hardcoded_secrets():
    """Verify that sensitive passwords and service role keys are NOT hardcoded in code."""
    import re
    jwt_pattern = re.compile(r"eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")
    
    py_files = list(backend_dir.glob("**/*.py"))
    for file_path in py_files:
        if file_path.name == "security_test.py":
            continue
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        assert not jwt_pattern.search(content), f"Hardcoded JWT/Supabase secret detected in {file_path.name}!"
        assert "yVTQio3YhFR" not in content, f"Hardcoded password detected in {file_path.name}!"
    print("✓ Passed: Zero hardcoded secrets in backend source files.")


def test_cypher_injection_prevention():
    """Verify that malicious inputs cannot break out of Cypher string literals."""
    injection_sender = "attacker' OR 1=1 WITH n MATCH (m) DETACH DELETE m //"
    injection_target = "victim' OR '1'='1"
    injection_url = "http://phish.example.test/payload' OR 'a'='a"

    case_data = {
        "parsed": {
            "meta": {
                "from": injection_sender,
                "to": injection_target,
            }
        },
        "relay_info": {
            "origin_node": {
                "ip": "203.0.113.5",
                "geo": {"country": "India", "city": "Delhi", "asn": "AS133618"}
            }
        },
        "category_analysis": {"category_label": "Phishing / BEC"},
        "graph_topology": {"campaign_id": "CAMP' UNION ALL MATCH (x) RETURN x //"},
        "evidence": {"sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
        "threat": {"risk_score": 95},
        "aitm_analysis": [{"url": injection_url, "display_domain": "phish.example.test"}]
    }

    bundle = generate_cypher_statements(case_data)
    
    # 1. Parameterized template verification
    assert "$sender" in bundle["query_template"]
    assert "$recipient" in bundle["query_template"]
    assert "$campaign_id" in bundle["query_template"]
    assert bundle["parameters"]["sender"] == injection_sender
    assert bundle["parameters"]["recipient"] == injection_target

    # 2. Escaped query display verification: raw unescaped single quote followed by OR must not exist
    display_query = bundle["cypher_query"]
    assert "attacker' OR" not in display_query
    assert "attacker\\' OR" in display_query

    # 3. Graceful execution without credentials
    sync_result = sync_to_neo4j_instance(case_data)
    assert sync_result["neo4j_status"] in ("CONFIG_PENDING", "LIVE_SYNCED_TO_NEO4J_AURA")
    print("✓ Passed: Cypher query is properly parameterized and immune to string breakout.")


def test_ssrf_protection():
    """Verify that private, loopback, link-local, and cloud metadata targets are strictly blocked."""
    prohibited_urls = [
        "http://127.0.0.1:8000/internal-api",
        "http://127.0.0.2:80/",
        "http://localhost:3000/",
        "http://169.254.169.254/latest/meta-data/",
        "http://instance-data/latest/meta-data/",
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://10.0.0.1/admin",
        "http://172.16.0.1/dashboard",
        "http://172.31.255.255/secret",
        "http://192.168.1.1/router",
        "http://192.168.0.254/config",
        "file:///etc/passwd",
        "gopher://127.0.0.1:6379/_INFO",
    ]

    for url in prohibited_urls:
        is_safe, reason, resolved_ip = is_safe_public_destination(url)
        assert not is_safe, f"SSRF test failed! URL should have been blocked: {url}"
        
        # Test full inspect detonation flow
        detonation = inspect_url_dom_and_headers(url)
        assert detonation["status"] == "BLOCKED_SSRF_PROHIBITED", f"Status should be BLOCKED_SSRF_PROHIBITED for {url}"
        assert detonation["http_status"] == 403, f"HTTP status should be 403 for {url}"
        assert detonation["risk_score"] == 100.0, f"Risk score should be 100.0 for {url}"
        assert "SSRF Blocked" in detonation["threat_verdict"]

    # Verify a legitimate public destination passes IP validation (using literal public IP for offline sandbox)
    is_safe_pub, reason_pub, ip_pub = is_safe_public_destination("https://93.184.216.34")
    assert is_safe_pub, f"Legitimate public URL should pass validation: {reason_pub}"
    assert ip_pub == "93.184.216.34"
    print(f"✓ Passed: SSRF protection blocked {len(prohibited_urls)} prohibited targets, validated public target.")


def test_supabase_graceful_handling():
    """Verify Supabase engine handles missing environment credentials gracefully without crashing."""
    config = get_supabase_config()
    assert "has_credentials" in config
    assert "url" in config

    dummy_case = {
        "case_id": "TEST-CASE-01",
        "evidence": {"sha256": "abcdef1234567890"},
        "threat": {"risk_score": 10, "status": "LOW"},
    }
    result = sync_to_supabase(dummy_case)
    assert result["status"] in ("LOCAL_VAULT_ACTIVE", "CONFIG_PENDING", "LIVE_SYNCED_TO_SUPABASE", "TABLE_CREATION_REQUIRED")
    print("✓ Passed: Supabase engine safely handles configuration state.")


if __name__ == "__main__":
    test_no_hardcoded_secrets()
    test_cypher_injection_prevention()
    test_ssrf_protection()
    test_supabase_graceful_handling()
    print("\n🎉 ALL CRITICAL SECURITY & VULNERABILITY TESTS PASSED SUCCESSFULLY!")
