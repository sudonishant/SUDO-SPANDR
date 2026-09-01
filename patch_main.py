import re

with open('backend/app/main.py', 'r') as f:
    code = f.read()

# Add Sample Definitions and Exporters before the websocket routes
sample_routes = '''
# ==============================================================================
# SIH 2026 #26106 — Preloaded Forensic Test Cases & STIX 2.1 Exporters
# ==============================================================================

SAMPLE_CASES = {
    "apt_russia": {
        "id": "apt_russia",
        "title": "🚨 Case 1: Russian Bulletproof Wire Fraud APT",
        "category": "BEC / Urgent Financial Diversion",
        "sender": "State Bank Alert <security-update@sbi-online-banking.ru>",
        "recipient": "cfo-finance@enterprise-corp.in",
        "subject": "URGENT: Executive Wire Transfer Authorization Notice #TX-88219",
        "body": "Dear CFO,\\n\\nPlease authorize the international wire transfer of $250,000 to vendor account #8891024 immediately. Failure to comply will result in account suspension.\\n\\nVerify wire instructions here: https://sbi-verification-portal.ru/auth/login.php",
        "headers": {
            "from": "State Bank Alert <security-update@sbi-online-banking.ru>",
            "to": "cfo-finance@enterprise-corp.in",
            "subject": "URGENT: Executive Wire Transfer Authorization Notice #TX-88219",
            "date": "Mon, 31 Aug 2026 12:00:00 +0000",
            "reply-to": "attacker-c2@darkmail.ru",
            "return-path": "<bounce@bulletproof-servers.ru>",
            "received": "from mail.bulletproof-servers.ru ([185.220.101.5]) by relay.transit.net with ESMTP; Mon, 31 Aug 2026 12:00:02 +0000\\nby mx.google.com with ESMTPS for <cfo-finance@enterprise-corp.in>; Mon, 31 Aug 2026 12:00:05 +0000"
        }
    },
    "nigeria_bec": {
        "id": "nigeria_bec",
        "title": "⚠️ Case 2: Nigerian Executive BEC Invoice Diversion",
        "category": "CEO Impersonation & Invoice Scam",
        "sender": "CEO Office <ceo.management@spectranet-nigeria.ng>",
        "recipient": "accounts-payable@techcompany.com",
        "subject": "CONFIDENTIAL: Revised Vendor Bank Account & Payment Invoice #INV-9921",
        "body": "Greetings Finance Team,\\n\\nAttached is the revised payment invoice #INV-9921 for the quarterly security audit. Please update banking records and route payment to the new account listed in the invoice immediately.\\n\\nRegards,\\nExecutive Office",
        "headers": {
            "from": "CEO Office <ceo.management@spectranet-nigeria.ng>",
            "to": "accounts-payable@techcompany.com",
            "subject": "CONFIDENTIAL: Revised Vendor Bank Account & Payment Invoice #INV-9921",
            "date": "Mon, 31 Aug 2026 09:30:00 +0000",
            "reply-to": "finance-drop@gmail.com",
            "return-path": "<ceo.management@spectranet-nigeria.ng>",
            "received": "from mail.mtn-lagos.ng ([102.89.23.41]) by smtp.corporate-relay.com with ESMTP; Mon, 31 Aug 2026 09:30:02 +0000\\nby mx.corporate-gateway.com with ESMTPS; Mon, 31 Aug 2026 09:30:05 +0000"
        }
    },
    "office365_phish": {
        "id": "office365_phish",
        "title": "🛑 Case 3: Microsoft 365 Credential Harvester (Hetzner VPN)",
        "category": "Credential Harvesting / Fake Portal",
        "sender": "Microsoft 365 Security <admin@microsoft-security-verify.de>",
        "recipient": "employee@organization.org",
        "subject": "CRITICAL: Your Microsoft Account Password Expires in 2 Hours",
        "body": "Your Office 365 password is set to expire today. Click here to retain your current password: http://login-microsoft365-verify.de/auth/signin",
        "headers": {
            "from": "Microsoft 365 Security <admin@microsoft-security-verify.de>",
            "to": "employee@organization.org",
            "subject": "CRITICAL: Your Microsoft Account Password Expires in 2 Hours",
            "date": "Mon, 31 Aug 2026 14:15:00 +0000",
            "received": "from node.hetzner-vpn.de ([5.9.12.88]) by gateway.inbound-mx.net with ESMTP; Mon, 31 Aug 2026 14:15:02 +0000"
        }
    },
    "legitimate_pass": {
        "id": "legitimate_pass",
        "title": "✅ Case 4: Legitimate Corporate Invoice (Clean Control)",
        "category": "Clean Control Email",
        "sender": "Google Cloud Billing <no-reply@cloud.google.com>",
        "recipient": "devops-lead@company.in",
        "subject": "Your monthly Google Cloud billing statement is ready",
        "body": "Hello,\\n\\nYour Google Cloud Platform billing report for the current billing cycle is now available in your Google Cloud Console dashboard.\\n\\nThank you for choosing Google Cloud.",
        "headers": {
            "from": "Google Cloud Billing <no-reply@cloud.google.com>",
            "to": "devops-lead@company.in",
            "subject": "Your monthly Google Cloud billing statement is ready",
            "date": "Mon, 31 Aug 2026 08:00:00 +0000",
            "authentication-results": "spf=pass (google.com: domain designates 209.85.220.65 as permitted sender) dkim=pass dmarc=pass",
            "received": "from mail-sor-f65.google.com ([209.85.220.65]) by mx.google.com with ESMTPS; Mon, 31 Aug 2026 08:00:02 +0000"
        }
    }
}


@app.get(f"{settings.API_V1_STR}/samples")
def get_sample_cases() -> Dict[str, Any]:
    return {"samples": list(SAMPLE_CASES.values())}


@app.post(f"{settings.API_V1_STR}/samples/load/{{sample_id}}")
def load_sample_case(sample_id: str) -> Dict[str, Any]:
    sample = SAMPLE_CASES.get(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample case not found")
    
    headers = {str(k).lower(): str(v) for k, v in sample["headers"].items()}
    raw_received = [h.strip() for h in headers.get("received", "").split("\\n") if h.strip()]
    
    from app.core.parser_engine import parse_received_hops
    hops = parse_received_hops(raw_received)
    
    parsed = {
        "meta": {"from": sample["sender"], "to": sample["recipient"], "subject": sample["subject"], "date": headers.get("date", "")},
        "body": sample["body"],
        "headers": headers,
        "hops": hops,
        "defects": []
    }
    
    return _build_result(sample["subject"], sample["sender"], sample["recipient"], sample["body"], headers, f"{sample_id}.eml", b"", parsed, [])


@app.get(f"{settings.API_V1_STR}/export/stix/{{case_id}}")
def export_stix_bundle(case_id: str) -> Dict[str, Any]:
    """Export standardized STIX 2.1 Threat Intel Bundle for SIEM / MISP ingestion."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return {
        "type": "bundle",
        "id": f"bundle--{hashlib.md5(case_id.encode()).hexdigest()}",
        "spec_version": "2.1",
        "objects": [
            {
                "type": "report",
                "spec_version": "2.1",
                "id": f"report--{hashlib.md5((case_id + '_rep').encode()).hexdigest()}",
                "created": timestamp,
                "modified": timestamp,
                "name": f"Cyber Squad SentinelMail Threat Intelligence Report: {case_id}",
                "description": f"Deterministic email forensic attribution and relay analysis for Case {case_id}",
                "published": timestamp,
                "report_types": ["threat-actor", "indicator", "malicious-activity"],
                "object_refs": [
                    f"indicator--{hashlib.md5((case_id + '_ind').encode()).hexdigest()}"
                ]
            },
            {
                "type": "indicator",
                "spec_version": "2.1",
                "id": f"indicator--{hashlib.md5((case_id + '_ind').encode()).hexdigest()}",
                "created": timestamp,
                "modified": timestamp,
                "name": f"Email Threat Indicator - {case_id}",
                "indicator_types": ["malicious-activity", "anomalous-activity"],
                "pattern": f"[email-message:body_multipart[*].body_raw_ref.payload_bin MATCHES '.*']",
                "pattern_type": "stix",
                "valid_from": timestamp
            }
        ]
    }
'''

if 'SAMPLE_CASES' not in code:
    code = code.replace('@app.post(f"{settings.API_V1_STR}/sandbox/clipboard")', sample_routes + '\n\n@app.post(f"{settings.API_V1_STR}/sandbox/clipboard")')
    with open('backend/app/main.py', 'w') as f:
        f.write(code)
    print('Patched main.py with sample cases & STIX exporter')
else:
    print('main.py already contains SAMPLE_CASES')
