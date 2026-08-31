import os
from pathlib import Path

from app.core.attachment_carver import disassemble_attachment
from app.core.category_engine import classify_mail
from app.core.openrouter_client import _extract_message_content, _parse_structured_content, _validate_model_result
from app.core.parser_engine import parse_eml_stream
from app.main import _auth_snapshot, _build_result, app

routes = {route.path for route in app.routes}
assert "/api/v1/ai-review" in routes
assert "/api/v1/analyze-raw" in routes
assert "/api/v1/upload" in routes

auth_snapshot = _auth_snapshot({
    "arc-authentication-results": "mx.example; dkim=pass; dmarc=pass",
    "received-spf": "pass (receiver: permitted sender)",
    "dkim-signature": "v=1; d=example.test;",
})
assert auth_snapshot["spf"].startswith("REPORTED PASS")
assert auth_snapshot["dkim"].startswith("REPORTED PASS")
assert auth_snapshot["dmarc"] == "REPORTED PASS"
assert "ARC-Authentication-Results" in auth_snapshot["evidence_sources"]
assert "Received-SPF" in auth_snapshot["evidence_sources"]

parsed = parse_eml_stream(b"not a complete but harmless message", "bad.eml")
assert parsed["meta"]["from"] == ""
assert parsed["meta"]["to"] == ""
assert "parse_error" in parsed

result = classify_mail("Your password expires immediately", "Verify your account at https://login-verify.example.test", "security@example.test")
assert result["category_id"] == "phishing_bec"
assert result["alert_level"] in {"critical", "review"}
assert result["confidence"] <= 98
assert "probability" in result["confidence_label"]

high = _build_result(
    "URGENT: verify your account immediately",
    "security@example.test",
    "analyst@example.test",
    "Your password expires now. Verify your account at http://login-verify.example.test and pay the invoice.",
    {"date": "Wed, 27 Aug 2026 10:00:00 +0000", "message-id": "<smoke@example.test>", "authentication-results": "mx.example.test; spf=pass dkim=pass dmarc=pass arc=pass", "return-path": "<security@example.test>"},
    "smoke.eml",
    b"synthetic smoke input",
    {},
    [],
)
breakdown = high["threat"]["score_breakdown"]
assert breakdown["positive_total"] == high["threat"]["baseline_score"]
assert breakdown["final_score"] == high["threat"]["risk_score"]
assert breakdown["positive_contributors"]
assert any(item["points"] > 0 for item in breakdown["positive_contributors"])
assert any(item["points"] < 0 for item in breakdown["deductions"])

pdf = disassemble_attachment("receipt.pdf", b"%PDF-1.7\nplain test bytes")
assert pdf["detected_type"] == "PDF"
assert pdf["magic_bytes"].startswith("25 50 44 46")
assert pdf["size_bytes"] == len(b"%PDF-1.7\nplain test bytes")
assert pdf["risk_score"] == 0
assert "clean" in pdf["findings"][0].lower()

concat_bytes = b"\xff\xd8\xff\xe0synthetic-jpeg\xff\xd9\n%PDF-1.7\n1 0 obj\n%%EOF\n"
concat = disassemble_attachment("output.jpg", concat_bytes)
assert concat["detected_type"] == "JPEG image"
assert concat["trailing_non_whitespace_bytes"] > 0
assert concat["embedded_signatures"] == [{"type": "PDF", "offset": concat["primary_end_offset"] + 3}]
assert concat["risk_score"] == 60
assert any("format-boundary anomaly" in item for item in concat["findings"])
assert all("steganography detected" not in item.lower() for item in concat["findings"])
actual_path = Path(os.getenv("CONCATENATED_FIXTURE_PATH", "/home/ubuntu/upload/output.jpg"))
if actual_path.exists():
    actual = disassemble_attachment(actual_path.name, actual_path.read_bytes())
    assert actual["detected_type"] == "JPEG image"
    assert any(item["type"] == "PDF" for item in actual["embedded_signatures"])
    assert actual["risk_score"] >= 60

safe_ai = {
    "answer": "Hinglish mein: score ke listed contributors urgency, login request aur non-HTTPS URL hain. Link par click na karke official channel se verify karein.",
    "response_language": "Hinglish",
    "category_observation": "Heuristic classification from supplied evidence.",
    "risk_summary": "The deterministic score is 71/100; this is not proof.",
    "confidence": 68,
    "recommended_action": "Do not click the link; verify independently and ask a human reviewer.",
    "needs_human_review": True,
    "limitations": ["No DNS, malware, or identity verification was performed."],
}
unsafe_ai = {**safe_ai, "answer": "This is definitely phishing, the sender is at the exact address, and it is safe to click."}
assert _validate_model_result(safe_ai) is None
assert _validate_model_result(unsafe_ai) is not None
assert _extract_message_content({"content": [{"type": "text", "text": "part one"}, {"type": "text", "text": "part two"}]}) == "part one\npart two"
assert _parse_structured_content("```json\n" + __import__("json").dumps(safe_ai) + "\n```")["response_language"] == "Hinglish"

empty = disassemble_attachment("empty.bin", b"")
assert empty["size_bytes"] == 0
assert empty["shannon_entropy"] == 0.0
assert empty["magic_bytes"].startswith("Not available")

print("backend API/category/parser/score-ledger/attachment smoke test passed")
