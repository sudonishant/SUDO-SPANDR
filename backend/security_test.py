"""Security Regression Test Suite for CyberSquad SentinelMail.
Verifies fixes for:
1. Zero hardcoded secrets in backend source files.
2. Strict metadata-only Neo4j projection and parameterized case-scoped queries.
3. Server-Side Request Forgery (SSRF) defense on all internal/cloud metadata targets.
4. Safe degraded mode for unconfigured external services (Neo4j, Supabase).
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from pydantic import ValidationError

from app.core.neo4j_engine import EvidenceGraphProjection, project_evidence_graph
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


def test_graph_metadata_validation():
    """Strict graph inputs reject raw content and unsafe URL credential material."""
    sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    case_data = {
        "case_id": f"CS-{sha256[:12].upper()}",
        "evidence_sha256": sha256,
        "source_mode": "eml",
        "triage_score": 16,
        "category_id": "unknown",
        "category_label": "Unknown / insufficient evidence",
        "sender": "sender@example.test",
        "recipient": "recipient@example.org",
        "ips": [{"ip": "192.0.2.10", "field": "Received"}],
        "urls": [{"url": "https://example.test/review", "risk": "REVIEW", "kind": "actionable link"}],
        "attachments": [],
        "reported_auth": [],
    }
    projection = EvidenceGraphProjection.model_validate(case_data)
    assert projection.case_id == case_data["case_id"]

    for prohibited_field, value in (("body", "raw body"), ("raw_eml", "From: raw"), ("headers", {"received": "raw"})):
        invalid = {**case_data, prohibited_field: value}
        try:
            EvidenceGraphProjection.model_validate(invalid)
            raise AssertionError(f"Graph model accepted prohibited field {prohibited_field}")
        except ValidationError:
            pass

    for unsafe_url in ("https://user:secret@example.test/path", "https://example.test/path?token=secret", "https://example.test/path#secret"):
        try:
            EvidenceGraphProjection.model_validate({**case_data, "urls": [{"url": unsafe_url}]})
            raise AssertionError(f"Graph model accepted unsanitized URL {unsafe_url}")
        except ValidationError:
            pass

    saved = {key: os.environ.get(key) for key in ("NEO4J_URI", "NEO4J_USER", "NEO4J_PASSWORD", "NEO4J_AUTH_DISABLED")}
    try:
        os.environ["NEO4J_URI"] = ""
        os.environ["NEO4J_AUTH_DISABLED"] = "false"
        result = project_evidence_graph(projection)
        assert result["status"] == "not_configured"
        assert result["persisted"] is False and result["readback"] is False
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
    print("✓ Passed: graph metadata is allowlisted and unconfigured Neo4j degrades honestly.")


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
    test_graph_metadata_validation()
    test_ssrf_protection()
    test_supabase_graceful_handling()
    print("\n🎉 ALL CRITICAL SECURITY & VULNERABILITY TESTS PASSED SUCCESSFULLY!")
