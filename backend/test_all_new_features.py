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
        self.assertIn(spf["result"], ["pass", "fail", "softfail", "neutral", "none"])

        # DKIM offline fixture
        sample_eml = b"From: user@test.com\r\nSubject: Test\r\n\r\nHello"
        dkim_none = verify_dkim_signature(sample_eml, offline_fixture=True)
        self.assertEqual(dkim_none["result"], "none")

        # DMARC alignment
        dmarc = verify_dmarc_alignment("paypal.com", {"result": "pass", "domain": "paypal.com"}, {"result": "pass", "domain": "paypal.com"})
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
        self.assertIn("T1036.005", tech_ids) # Masquerading
        self.assertIn("T1071.001", tech_ids) # Web protocol / AitM
        self.assertIn("T1090.003", tech_ids) # Tor/Proxy

        layer = generate_mitre_navigator_layer("TEST-001", techs)
        self.assertEqual(layer["versions"]["navigator"], "5.1.0")
        self.assertEqual(layer["domain"], "enterprise-attack")
        self.assertTrue(len(layer["techniques"]) >= 5)

    def test_04_indic_multilingual_and_dpdp_pii(self):
        # Multilingual Hindi + Bengali
        text = "तत्काल बिजली बिल भुगतान करें अन्यथा खाता बंद कर दिया जाएगा। জরুরি নোটিশ: আপনার অ্যাকাউন্ট ব্লক।"
        scan = scan_indic_threats(text)
        self.assertTrue(scan["detected"])
        self.assertIn("Hindi (हिन्दी)", scan["languages_found"])
        self.assertIn("Bengali (বাংলা)", scan["languages_found"])

        # PII Redaction
        pii_text = "Applicant PAN: ABCDE1234F, Phone: 9876543210, UPI: rahul@okhdfcbank"
        redacted = redact_dpdp_pii(pii_text, redact=True)
        self.assertEqual(redacted["pii_counts"]["pan"], 1)
        self.assertEqual(redacted["pii_counts"]["phone"], 1)
        self.assertEqual(redacted["pii_counts"]["upi"], 1)
        self.assertIn("[REDACTED_PAN:", redacted["redacted_text"])
        self.assertIn("[REDACTED_PHONE:", redacted["redacted_text"])
        self.assertIn("[REDACTED_UPI:", redacted["redacted_text"])

    def test_05_blockchain_polygon_amoy(self):
        rec = notarize_evidence_on_chain("CASE-SIH26106-001", "a"*64, "185.220.101.5", 88)
        self.assertEqual(rec["chain_id"], 80002)
        self.assertIn("amoy.polygonscan.com", rec["polygonscan_tx_url"])
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


if __name__ == "__main__":
    unittest.main()
