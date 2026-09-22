# Comprehensive Test Suite for SIH #26106 Features
import os
import sys
import unittest

# Ensure both workspace root and backend directory are in sys.path
sys.path.insert(0, "/home/nee/Documents/sih email/cybersquad-web-master/backend")
sys.path.insert(0, "/home/nee/Documents/sih email/cybersquad-web-master")

from fastapi.testclient import TestClient

from app.main import app
from app.core.geo_engine import classify_ip
from app.core.auth_verifier import verify_spf, verify_dkim_signature, verify_dmarc_alignment
from app.core.mitre_engine import analyze_mitre_techniques, generate_mitre_navigator_layer
from app.core.indic_nlp_engine import scan_indic_threats, redact_dpdp_pii, validate_verhoeff, validate_luhn
from app.core.blockchain_ledger import notarize_evidence_on_chain, verify_chain_record


class TestNewForensicFeatures(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_01_geo_engine_rfc_and_zero_bias(self):
        # Loopback
        res = classify_ip("127.0.0.1")
        self.assertEqual(res["status"], "NON_ROUTABLE")
        self.assertFalse(res["is_public"])
        # Private RFC1918
        res = classify_ip("192.168.1.50")
        self.assertEqual(res["status"], "NON_ROUTABLE")
        self.assertFalse(res["is_public"])
        # Public IP
        res = classify_ip("8.8.8.8")
        self.assertTrue(res["is_public"])
        # Geo resolution returns structured data without scoring bias
        geo = classify_ip("185.220.101.5")
        self.assertIn("country", geo)
        self.assertIn("is_vpn_tor", geo)

    def test_02_auth_verifier_rfc(self):
        # SPF offline fixture
        spf = verify_spf("example.com", "192.0.2.1", offline_fixture=True)
        self.assertIn("result", spf)
        self.assertIn(spf["result"], ["pass", "fail", "softfail", "neutral", "none", "temperror"])
        self.assertFalse(spf["verified"])

        # DKIM offline fixture
        sample_eml = b"From: user@test.com\r\nSubject: Test\r\n\r\nHello"
        dkim_none = verify_dkim_signature(sample_eml, offline_fixture=True)
        self.assertEqual(dkim_none["result"], "none")

        # DMARC alignment
        dmarc = verify_dmarc_alignment("paypal.com", {"result": "pass", "domain": "paypal.com", "verified": True}, {"result": "pass", "domain": "paypal.com", "verified": True})
        self.assertEqual(dmarc["status"], "PASS")
        self.assertEqual(dmarc["spf_alignment"], "ALIGNED")
        self.assertEqual(dmarc["dkim_alignment"], "ALIGNED")

    def test_03_mitre_matrix_and_navigator(self):
        techs = analyze_mitre_techniques(
            headers={"from": "spoofed@bank.com", "reply-to": "evil@hacker.com"},
            body="Click here immediately to verify account",
            urls=[{"url": "https://evil-phish.ru/login", "risk": "CRITICAL", "risk_score": 85}],
            attachments=[{"filename": "invoice.xlsm", "entropy": 7.4, "findings": ["VBA macro detected"]}],
            hops=[{"ip": "185.220.101.5", "is_tor": True}],
            threat_signals=[{"label": "Adversary-in-the-Middle credential token harvest"}],
            risk_score=90
        )
        tech_ids = [t["id"] for t in techs]
        self.assertIn("T1566.001", tech_ids) # Attachment
        self.assertIn("T1566.002", tech_ids) # Link
        self.assertIn("T1071.001", tech_ids) # Web protocol (AiTM)

        nav_layer = generate_mitre_navigator_layer("SIH26106-CASE", techs)
        self.assertEqual(nav_layer["name"], "SUDO SPANDR Forensic Layer - SIH26106-CASE")
        self.assertEqual(nav_layer["domain"], "enterprise-attack")
        self.assertGreater(len(nav_layer["techniques"]), 0)

    def test_04_indic_nlp_and_dpdp_pii(self):
        sample_hindi = "अति आवश्यक सूचना: आपका SBI बैंक खाता तत्काल निलंबित किया जा रहा है। तुरंत आधार 234567890126 और पैन ABCDE1234F अपडेट करें या 9876543210 पर संपर्क करें।"
        report = scan_indic_threats(sample_hindi)
        self.assertTrue(report["detected"])
        self.assertIn("Hindi (हिन्दी)", report["languages_found"])
        self.assertGreater(report["threat_points"], 0)

        redacted = redact_dpdp_pii(sample_hindi, redact=True)
        self.assertTrue(redacted["redaction_applied"])
        self.assertIn("[REDACTED_AADHAAR:", redacted["redacted_text"])
        self.assertIn("[REDACTED_PAN:", redacted["redacted_text"])
        self.assertIn("[REDACTED_PHONE:", redacted["redacted_text"])

    def test_05_blockchain_polygon_amoy_adapter(self):
        rec = notarize_evidence_on_chain("CASE-SIH26106-001", "a"*64, "185.220.101.5", 88)
        self.assertEqual(rec["chain_id"], 80002)
        self.assertEqual(rec["mode"], "PROTOTYPE_NOTARY_ADAPTER")
        self.assertFalse(rec["contract_verified"])
        self.assertTrue(rec["transaction_hash"].startswith("0x"))
        self.assertTrue(rec["merkle_root"].startswith("0x"))

    def test_06_fastapi_endpoints(self):
        # Health
        resp = self.client.get("/api/v1/health")
        self.assertEqual(resp.status_code, 200)

        # MITRE Navigator Layer
        resp = self.client.get("/api/v1/mitre/navigator-layer?case_id=SIH-TEST")
        self.assertEqual(resp.status_code, 200)
        layer = resp.json()
        self.assertEqual(layer["domain"], "enterprise-attack")

        # Postfix Milter Check (Interactive Gateway Simulator)
        resp = self.client.post("/api/gateway-milter-check", json={
            "subject": "URGENT: Verify Bank Credentials Immediately",
            "sender": "alert@fake-sbi.com",
            "body": "Dear customer, your account is suspended. Click http://phish.xyz",
            "headers": {"from": "alert@fake-sbi.com"}
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("policy_action", data)
        self.assertIn("smtp_reply", data)
        self.assertIn("postfix_code", data)

        # Analyze Batch Clustering
        resp = self.client.post("/api/v1/analyze-batch", json={
            "emails": [
                {"subject": "Phish 1", "sender": "bad@evil.com"},
                {"subject": "Phish 2", "sender": "bad2@evil.com"},
                {"subject": "Notice", "sender": "hr@corp.com"}
            ]
        })
        self.assertEqual(resp.status_code, 200)
        batch = resp.json()
        self.assertEqual(batch["total_analyzed"], 3)
        self.assertIn("campaigns", batch)

        # DPDP PII Redact Endpoint
        resp = self.client.post("/api/v1/redact-pii", json={
            "text": "Call me at 9876543210 with PAN ABCDE1234F",
            "redact": True
        })
        self.assertEqual(resp.status_code, 200)
        pii = resp.json()
        self.assertTrue(pii["redaction_applied"])
        self.assertEqual(pii["total_redacted"], 2)

    def test_07_degraded_honesty_without_deps(self):
        """Simulates missing dependencies and asserts that verification NEVER fabricates pass."""
        import subprocess
        code = '''
import sys
from importlib.abc import MetaPathFinder

class Blocker(MetaPathFinder):
    def find_spec(self, name, path, target=None):
        if name.split(".")[0] in ("dns", "cryptography", "maxminddb"):
            raise ImportError(f"Simulated missing: {name}")
        return None

sys.meta_path.insert(0, Blocker())
for m in list(sys.modules.keys()):
    if m.split(".")[0] in ("dns", "cryptography", "maxminddb", "app", "backend"):
        del sys.modules[m]

from backend.app.core import auth_verifier as av
spf = av.verify_spf("victim-bank.co.in", "198.51.100.23")
assert spf.get("verified") is False, "verified MUST be False"
assert spf.get("result") != "pass", "result must not be pass"
assert spf.get("spf_record") is None, "spf_record must not be fabricated"
assert spf.get("degraded_reason"), "must provide degraded_reason"

dkim = av.verify_dkim_signature(b"DKIM-Signature: v=1; a=rsa-sha256; d=innocent.example; s=s1; b=ABC; bh=XYZ;\\r\\n\\r\\nBody")
assert dkim.get("verified") is False
assert dkim.get("result") != "pass"
assert dkim.get("domain") == "innocent.example"
assert dkim.get("degraded_reason")

from backend.app.core import geo_engine as ge
geo = ge.classify_ip("8.8.8.8")
assert geo.get("country") is None, "country must be None when mmdb is missing"
assert geo.get("city") is None, "city must be None when mmdb is missing"
'''
        res = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Degraded honesty test failed:\n{res.stderr}")


if __name__ == "__main__":
    unittest.main()
