import os
import sys
from pathlib import Path

from app.core.attachment_carver import disassemble_attachment
from app.core.parser_engine import parse_eml_stream
from app.main import _build_result

fixture_path = Path(os.getenv("EML_FIXTURE_PATH", "/home/ubuntu/upload/Yourcode_872859.eml"))
if not fixture_path.is_file():
    print(f"SKIP: optional EML fixture not found at {fixture_path}")
    sys.exit(0)

raw = fixture_path.read_bytes()
filename = fixture_path.name
parsed = parse_eml_stream(raw, filename)
attachments = [disassemble_attachment(item["filename"], item["content"]) for item in parsed["attachments"]]
result = _build_result(
    parsed["meta"]["subject"],
    parsed["meta"]["from"],
    parsed["meta"]["to"],
    parsed["body"],
    parsed["headers"],
    filename,
    raw,
    parsed,
    attachments,
)

print("category=", result["category_analysis"]["category_id"])
print("risk_score=", result["threat"]["risk_score"])
print("baseline_score=", result["threat"]["baseline_score"])
print("score_breakdown=", result["threat"]["score_breakdown"])
print("adjustments=", result["threat"]["adjustments"])
print("auth=", result["threat"]["authentication_context"])

# These assertions apply only to the known local sample, never to arbitrary user mail.
if filename == "Yourcode_872859.eml":
    assert result["category_analysis"]["category_id"] == "otp_security"
    assert result["threat"]["risk_score"] < 35
    assert result["threat"]["authentication_context"]["dmarc_pass"] is True
    assert result["threat"]["authentication_context"]["pass_count"] >= 3

assert "score_breakdown" in result["threat"]
assert result["threat"]["score_breakdown"]["final_score"] == result["threat"]["risk_score"]
print("PASS: score ledger is present and reconciles with final score")
