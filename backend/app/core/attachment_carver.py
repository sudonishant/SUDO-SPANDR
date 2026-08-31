"""Truthful, non-executing attachment inspection for the FastAPI draft.

This module reports byte/name markers and recognized format-boundary anomalies only. It does not execute, unpack, scan, detect steganography, detonate, query reputation, or declare a file clean or malicious.
"""
from __future__ import annotations

import hashlib
import math
import re
from typing import Any, Dict


def calculate_shannon_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    entropy = 0.0
    for value in range(256):
        probability = data.count(value) / len(data)
        if probability:
            entropy -= probability * math.log(probability, 2)
    return round(entropy, 2)


def _magic_type(data: bytes) -> str:
    if data.startswith(b"MZ"):
        return "Windows executable (MZ)"
    if data.startswith(b"\x7fELF"):
        return "Linux executable (ELF)"
    if data.startswith(b"%PDF"):
        return "PDF"
    if data.startswith(b"PK\x03\x04"):
        return "ZIP / Office Open XML container"
    if data.startswith(b"Rar!"):
        return "RAR archive"
    if data.startswith(b"\x89PNG"):
        return "PNG image"
    if data.startswith(b"\xff\xd8\xff"):
        return "JPEG image"
    if data.startswith(b"GIF"):
        return "GIF image"
    return "Unknown / not identified by signature"


SECONDARY_SIGNATURES = (
    ("PDF", b"%PDF-"),
    ("JPEG image", b"\xff\xd8\xff"),
    ("PNG image", b"\x89PNG"),
    ("GIF image", b"GIF"),
    ("ZIP / Office Open XML container", b"PK\x03\x04"),
    ("RAR archive", b"Rar!"),
    ("Windows executable (MZ)", b"MZ"),
    ("Linux executable (ELF)", b"\x7fELF"),
)
END_MARKERS = {
    "JPEG image": b"\xff\xd9",
    "PNG image": b"IEND\xaeB`\x82",
    "PDF": b"%%EOF",
}


def _format_boundary_inspection(data: bytes, detected_type: str) -> Dict[str, Any]:
    marker = END_MARKERS.get(detected_type)
    if not marker:
        return {"primary_end_offset": None, "trailing_bytes": 0, "trailing_non_whitespace_bytes": 0, "embedded_signatures": []}
    if detected_type == "PDF":
        primary_end = data.rfind(marker)
    else:
        primary_end = data.find(marker)
    if primary_end < 0:
        return {"primary_end_offset": None, "trailing_bytes": 0, "trailing_non_whitespace_bytes": 0, "embedded_signatures": []}
    trailing_start = primary_end + len(marker)
    trailing = data[trailing_start:]
    first_content_offset = next((offset for offset in range(trailing_start, len(data)) if data[offset] not in b"\t\n\r "), -1)
    embedded_signatures = []
    if first_content_offset >= 0:
        embedded_signatures = [{"type": label, "offset": first_content_offset} for label, signature in SECONDARY_SIGNATURES if data.startswith(signature, first_content_offset)]
    return {
        "primary_end_offset": primary_end,
        "trailing_bytes": len(trailing),
        "trailing_non_whitespace_bytes": sum(byte not in b"\t\n\r " for byte in trailing),
        "embedded_signatures": embedded_signatures,
    }


def disassemble_attachment(filename: str, file_bytes: bytes = b"") -> Dict[str, Any]:
    data = bytes(file_bytes or b"")
    name = filename or "unnamed-file"
    lower_name = name.lower()
    extension = lower_name.rsplit(".", 1)[-1] if "." in lower_name else ""
    first_bytes = data[:16].hex(" ").upper()
    detected_type = _magic_type(data)
    boundary = _format_boundary_inspection(data, detected_type)
    is_double_ext = bool(re.search(r"\.(pdf|docx?|xlsx?|pptx?|txt|jpg|png|zip)\.(exe|vbs|bat|scr|js|ps1|hta|jar|apk)$", name, re.IGNORECASE))
    executable_name = extension in {"exe", "scr", "bat", "cmd", "js", "vbs", "ps1", "hta", "jar", "apk"}
    document_like = extension in {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "jpg", "png", "zip", "rar"} or detected_type in {"PDF", "ZIP / Office Open XML container", "RAR archive", "PNG image", "JPEG image", "GIF image"}
    sample_text = data[:2_000_000].decode("utf-8", errors="replace")
    findings = []
    risk_score = 0
    if detected_type in {"Windows executable (MZ)", "Linux executable (ELF)"} and document_like:
        findings.append("Executable magic bytes were detected for a document/media-looking filename; inspect in a controlled environment.")
        risk_score += 80
    if is_double_ext:
        findings.append("Double-extension filename requires review; filename alone does not prove maliciousness.")
        risk_score += 45
    if re.search(r"[\u202a-\u202e\u2066-\u2069]", name):
        findings.append("Bidirectional Unicode control character appears in the filename.")
        risk_score += 45
    if extension == "pdf" and re.search(r"/javascript|/js|/launch|openaction", sample_text, re.IGNORECASE):
        findings.append("PDF text contains active-content markers; static inspection cannot prove exploitability.")
        risk_score += 35
    if extension in {"doc", "docx", "xls", "xlsx", "ppt", "pptx"} and re.search(r"autoopen|document_open|vbaproject|powershell|wscript\.shell", sample_text, re.IGNORECASE):
        findings.append("Office-like content contains macro/script markers; macro execution was not performed.")
        risk_score += 35
    if extension in {"zip", "rar", "7z"} and re.search(r"\.(exe|scr|bat|cmd|js|vbs|ps1)\b", sample_text, re.IGNORECASE):
        findings.append("Archive text contains an executable/script filename marker; archive members were not fully unpacked.")
        risk_score += 30
    if boundary["trailing_non_whitespace_bytes"] > 0:
        findings.append(f"Bytes were found after the detected {detected_type} end marker at offset {boundary['primary_end_offset']}; this is a format-boundary anomaly, not steganography detection or proof of malware.")
        risk_score += 25
    for signature in boundary["embedded_signatures"]:
        findings.append(f"A {signature['type']} signature was found at byte offset {signature['offset']} immediately after the primary {detected_type} boundary; the file may be concatenated or multi-format. This static observation does not prove maliciousness.")
        risk_score += 60 if re.search(r"executable|ELF", signature["type"], re.IGNORECASE) else 35
    if not findings:
        findings.append("No high-risk byte/name marker was observed by this static check; this is not a malware-clean verdict.")
    bounded = min(100, risk_score)
    return {
        "filename": name,
        "extension": extension.upper(),
        "size_bytes": len(data),
        "magic_bytes": first_bytes or "Not available: empty input",
        "detected_type": detected_type,
        "is_double_extension": is_double_ext,
        "shannon_entropy": calculate_shannon_entropy(data),
        "entropy": calculate_shannon_entropy(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "risk_score": bounded,
        "risk_level": "HIGH" if bounded >= 70 else "MEDIUM" if bounded >= 30 else "LOW",
        "primary_end_offset": boundary["primary_end_offset"],
        "trailing_bytes": boundary["trailing_bytes"],
        "trailing_non_whitespace_bytes": boundary["trailing_non_whitespace_bytes"],
        "embedded_signatures": boundary["embedded_signatures"],
        "findings": findings,
        "verdict": "REVIEW" if bounded >= 30 else "NO HIGH-RISK MARKER OBSERVED",
        "scanner": "Backend static byte/name inspection; no execution, unpacking, sandbox, AV, YARA, steganography, or reputation lookup performed.",
        "executable_name_marker": executable_name,
    }
