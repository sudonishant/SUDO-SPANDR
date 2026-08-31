"""Cyber Squad web analysis API.

The API deliberately returns triage evidence and uncertainty. It does not claim
sender attribution, geolocation certainty, cryptographic mail-auth verification,
or legal admissibility without the required backend services.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.config import settings
from app.core.attachment_carver import disassemble_attachment
from app.core.category_engine import calculate_threat_score, classify_mail
from app.core.openrouter_client import request_ai_second_opinion
from app.core.parser_engine import parse_eml_stream
from app.static_index import HTML_CONTENT

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Evidence-based email triage API for SIH Problem Statement #26106.",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


class RawEmailAnalyzeRequest(BaseModel):
    subject: str = Field(default="", max_length=500)
    sender: str = Field(default="", max_length=500)
    recipient: str = Field(default="", max_length=500)
    body: str = Field(default="", max_length=2_000_000)
    headers: Optional[Dict[str, str]] = None


class HoneypotCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class AIReviewRequest(BaseModel):
    evidence: Dict[str, Any] = Field(default_factory=dict)


class SandboxNavigateRequest(BaseModel):
    url: str = Field(default="https://duckduckgo.com")


class ClipboardRequest(BaseModel):
    text: str = Field(default="")


def _url_items(text: str) -> List[Dict[str, Any]]:
    values = []
    seen = set()
    for raw_url in re.findall(r"https?://[^\s<>\"{}|\\^`]+", text or "", flags=re.IGNORECASE):
        raw_url = raw_url.rstrip(",.;)")
        if raw_url in seen:
            continue
        seen.add(raw_url)
        parsed = urlparse(raw_url)
        reasons = []
        if parsed.scheme.lower() != "https":
            reasons.append("Not HTTPS")
        hostname = (parsed.hostname or "").lower()
        if "xn--" in hostname:
            reasons.append("Punycode hostname")
        if len(hostname.split(".")) > 3:
            reasons.append("Deep subdomain")
        if re.search(r"login|verify|secure|auth|account|payment|update", f"{hostname}{parsed.path}", re.IGNORECASE):
            reasons.append("Credential/payment-themed hostname or path")
        values.append({"url": raw_url, "domain": hostname or "Invalid URL", "risk": "REVIEW" if reasons else "UNASSESSED", "reasons": reasons})
    return values


def _auth_snapshot(headers: Dict[str, str]) -> Dict[str, Any]:
    auth_sources = [
        ("Authentication-Results", headers.get("authentication-results")),
        ("ARC-Authentication-Results", headers.get("arc-authentication-results")),
        ("X-Authentication-Results", headers.get("x-authentication-results")),
    ]
    auth_sources = [(name, str(value)) for name, value in auth_sources if value]
    auth_header = "\n".join(f"{name}: {value}" for name, value in auth_sources)
    received_spf = str(headers.get("received-spf") or headers.get("x-received-spf") or "")
    reported: Dict[str, str] = {}
    for method in ("spf", "dkim", "dmarc", "arc"):
        match = re.search(rf"\b{method}\s*=\s*(pass|fail|softfail|neutral|none|temperror|permerror)", auth_header, re.IGNORECASE)
        if match:
            reported[method] = f"REPORTED {match.group(1).upper()}"
        elif method == "spf":
            spf_match = re.match(r"\s*(pass|fail|softfail|neutral|none|temperror|permerror)\b", received_spf, re.IGNORECASE)
            reported[method] = f"REPORTED {spf_match.group(1).upper()} (Received-SPF)" if spf_match else "NOT VERIFIED"
        else:
            reported[method] = "NOT VERIFIED"
    if reported["dkim"] == "NOT VERIFIED" and headers.get("dkim-signature"):
        reported["dkim"] = "PRESENT — signature requires cryptographic verification"
    if reported["arc"] == "NOT VERIFIED" and (headers.get("arc-seal") or headers.get("arc-message-signature") or headers.get("arc-authentication-results")):
        reported["arc"] = "PRESENT — chain requires independent verification"
    return {
        **reported,
        "dkim_signature": "PRESENT — signature requires cryptographic verification" if headers.get("dkim-signature") else "NOT PRESENT",
        "authentication_results": "Present; receiver provenance still requires verification" if auth_header or received_spf else "Not present",
        "evidence_sources": [name for name, _ in auth_sources] + (["Received-SPF"] if received_spf else []) + (["DKIM-Signature"] if headers.get("dkim-signature") else []),
        "raw_reported": auth_header or received_spf or "No Authentication-Results, ARC-Authentication-Results, X-Authentication-Results, or Received-SPF header was supplied.",
        "note": "REPORTED values come from submitted receiver headers. DNS, cryptographic verification, and receiver trust are not performed by this endpoint; a reported pass is not proof that message content is safe.",
    }


def _header_findings(headers: Dict[str, str], sender: str, reply_to: str) -> List[Dict[str, Any]]:
    findings = []
    from_domain = sender.split("@", 1)[-1].lower() if "@" in sender else ""
    reply_domain = reply_to.split("@", 1)[-1].lower() if "@" in reply_to else ""
    if reply_domain and from_domain and reply_domain != from_domain:
        findings.append({"id": "reply-to-mismatch", "label": "Reply-To domain differs from From domain", "weight": 16})
    if not headers.get("message-id"):
        findings.append({"id": "missing-message-id", "label": "Message-ID header is missing", "weight": 4})
    if not headers.get("date"):
        findings.append({"id": "missing-date", "label": "Date header is missing", "weight": 3})
    if not headers.get("received"):
        findings.append({"id": "missing-received", "label": "No Received header was supplied; relay path unavailable", "weight": 8})
    return findings


def _threat_score(category: Dict[str, Any], urls: List[Dict[str, Any]], attachments: List[Dict[str, Any]], header_findings: List[Dict[str, Any]], headers: Dict[str, str], sender: str) -> Dict[str, Any]:
    return calculate_threat_score(category.get("category_id", "unknown"), category.get("points", 0), urls, attachments, header_findings, headers, sender, category.get("evidence_points", []))


def _canonical_bytes(subject: str, sender: str, recipient: str, body: str, headers: Dict[str, str]) -> bytes:
    return json.dumps({"subject": subject, "sender": sender, "recipient": recipient, "body": body, "headers": headers}, sort_keys=True, ensure_ascii=False).encode("utf-8")


def _build_result(subject: str, sender: str, recipient: str, body: str, headers: Dict[str, str], filename: str, raw_bytes: bytes, parsed: Dict[str, Any], attachments: List[Dict[str, Any]]) -> Dict[str, Any]:
    urls = _url_items(f"{body}\n{json.dumps(headers, ensure_ascii=False)}")
    reply_to = str(headers.get("reply-to", ""))
    header_findings = _header_findings(headers, sender, reply_to)
    category_candidate = classify_mail(subject, body, sender, headers=headers, urls=urls, attachments=attachments, threat_score=0)
    score_details = _threat_score(category_candidate, urls, attachments, header_findings, headers, sender)
    score = score_details["risk_score"]
    category = classify_mail(subject, body, sender, headers=headers, urls=urls, attachments=attachments, threat_score=score)
    payload = raw_bytes if raw_bytes else _canonical_bytes(subject, sender, recipient, body, headers)
    sha256 = hashlib.sha256(payload).hexdigest()
    parsed_output = {
        "meta": {"from": sender or "Not available", "to": recipient or "Not available", "subject": subject or "Not available", "date": headers.get("date") or "Not available"},
        "body": body,
        "headers": headers,
        "sha256_hash": sha256,
        "hops": [],
        "defects": parsed.get("defects", []),
    }
    return {
        "case_id": f"CS-{sha256[:12].upper()}",
        "parse_error": parsed.get("parse_error"),
        "team": settings.TEAM_NAME,
        "format_type": "Outlook MSG" if filename.lower().endswith(".msg") else "RFC Email / EML" if filename.lower().endswith(".eml") else "Pasted Text / Headers",
        "filename": filename,
        "parsed": parsed_output,
        "threat": {
            "risk_score": score,
            "baseline_score": score_details["baseline_score"],
            "adjustments": score_details["adjustments"],
            "authentication_context": score_details["authentication_context"],
            "score_breakdown": score_details["score_breakdown"],
            "status": "HIGH RISK" if score >= 70 else "REVIEW" if score >= 35 else "NO HIGH-RISK SIGNALS OBSERVED",
            "signals": score_details["score_breakdown"]["positive_contributors"],
            "note": "Backend deterministic triage score; not a probability and not a final malware or sender-verdict.",
        },
        "category_analysis": {**category, "risk_score": score},
        "dns_auth": _auth_snapshot(headers),
        "relay_info": {"ips": [], "hop_count": 0, "status": "Not reconstructed by this API version", "note": "A visible header IP is not proof of original sender identity or physical location."},
        "geo_data": {"status": "NOT LOOKED UP", "sender": None, "receiver": None, "note": "No analyst-IP fallback and no geolocation lookup performed by this API."},
        "aitm_analysis": urls,
        "attachment_analysis": attachments,
        "evidence": {"sha256": sha256, "raw_size_bytes": len(payload), "preservation": "The API response is not an immutable evidence vault record."},
        "limitations": [category.get("note", ""), "No DNS, cryptographic authentication, reputation, sandbox, AV, YARA, or geolocation lookup was performed.", "Legal admissibility and attribution require independent procedures and authority review."],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/", response_class=HTMLResponse)
def read_root():
    return HTMLResponse(content=HTML_CONTENT, status_code=200)


@app.get("/api/v1/health")
def api_health() -> Dict[str, Any]:
    return {"status": "online", "system": settings.PROJECT_NAME, "problem_statement": settings.PROBLEM_STATEMENT, "analysis_mode": "truthful deterministic triage", "fake_results": False}


@app.post(f"{settings.API_V1_STR}/analyze-raw")
async def analyze_raw_text(req: RawEmailAnalyzeRequest) -> Dict[str, Any]:
    headers = {str(key).lower(): str(value) for key, value in (req.headers or {}).items()}
    if not req.body.strip() and not req.subject.strip() and not req.sender.strip():
        raise HTTPException(status_code=422, detail="Provide message text, subject, sender, or headers before analysis.")
    return _build_result(req.subject.strip(), req.sender.strip(), req.recipient.strip(), req.body, headers, "pasted-text.txt", b"", {})


@app.post(f"{settings.API_V1_STR}/attachment")
async def analyze_attachment_endpoint(file: UploadFile = File(...)) -> Dict[str, Any]:
    filename = file.filename or "standalone-file"
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds the {settings.MAX_UPLOAD_BYTES} byte upload limit.")
    
    report = disassemble_attachment(filename, content)
    sha256 = report.get("sha256") or hashlib.sha256(content).hexdigest()
    risk_score = report.get("risk_score", 0)
    
    status = "HIGH RISK" if risk_score >= 70 else "REVIEW" if risk_score >= 35 else "NO HIGH-RISK SIGNALS OBSERVED"
    
    signals = [{"label": f, "points": 25, "evidence": "Observed by static byte inspector"} for f in report.get("findings", [])]
    
    return {
        "case_id": f"CS-ATT-{sha256[:10].upper()}",
        "format_type": "Standalone Attachment",
        "filename": filename,
        "mode": "attachment",
        "parsed": {
            "meta": {"from": "N/A (Standalone File)", "to": "N/A", "subject": f"Attachment: {filename}", "date": "N/A"},
            "headers": {},
            "body": f"Standalone static analysis for {filename}",
            "sha256_hash": sha256,
        },
        "threat": {
            "risk_score": risk_score,
            "baseline_score": risk_score,
            "adjustments": [],
            "status": status,
            "signals": signals,
            "score_breakdown": {
                "positive_contributors": signals,
                "deductions": [],
                "positive_total": risk_score,
                "adjustment_total": 0,
                "final_score": risk_score,
                "formula": f"{risk_score} observed points = {risk_score} final triage score"
            },
            "note": "Static browser/backend attachment inspection; file was not executed or detonated."
        },
        "category_analysis": {
            "category_id": "dangerous_attachments" if risk_score >= 50 else "unknown",
            "category_label": "Dangerous Attachment / Anomaly" if risk_score >= 50 else "Standalone File",
            "description": "Static byte inspection of file container, magic headers, and format boundaries.",
            "alert_level": "high" if risk_score >= 70 else "medium" if risk_score >= 35 else "low",
            "points": risk_score,
            "confidence": 85,
            "confidence_label": "Static inspection only",
            "spam_assessment": "Not Applicable",
            "recommended_action": "Detonate in cloud sandbox or inspect in isolated VM before opening." if risk_score >= 35 else "Static checks found no obvious high-risk markers; continue standard precautions."
        },
        "dns_auth": {
            "spf": "NOT APPLICABLE", "dkim": "NOT APPLICABLE", "dmarc": "NOT APPLICABLE", "arc": "NOT APPLICABLE",
            "note": "Standalone attachments have no email transport envelope."
        },
        "aitm_analysis": [],
        "attachment_analysis": [report],
        "evidence": {"sha256": sha256, "raw_size_bytes": len(content), "preservation": "Standalone static file inspection report."},
        "limitations": [
            "File was not executed, detonated, sandboxed, or scanned with antivirus / YARA.",
            "A low score is not a guarantee that the file is malware-free."
        ],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@app.post(f"{settings.API_V1_STR}/upload")
async def upload_email(file: UploadFile = File(...)) -> Dict[str, Any]:
    filename = file.filename or "uploaded.eml"
    extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds the {settings.MAX_UPLOAD_BYTES} byte upload limit.")
    
    if extension != "eml" and extension != "msg":
        # Handle standalone attachment automatically
        report = disassemble_attachment(filename, content)
        sha256 = report.get("sha256") or hashlib.sha256(content).hexdigest()
        risk_score = report.get("risk_score", 0)
        status = "HIGH RISK" if risk_score >= 70 else "REVIEW" if risk_score >= 35 else "NO HIGH-RISK SIGNALS OBSERVED"
        signals = [{"label": f, "points": 25, "evidence": "Observed by static byte inspector"} for f in report.get("findings", [])]
        return {
            "case_id": f"CS-ATT-{sha256[:10].upper()}",
            "format_type": "Standalone Attachment",
            "filename": filename,
            "mode": "attachment",
            "parsed": {
                "meta": {"from": "N/A (Standalone File)", "to": "N/A", "subject": f"Attachment: {filename}", "date": "N/A"},
                "headers": {},
                "body": f"Standalone static analysis for {filename}",
                "sha256_hash": sha256,
            },
            "threat": {
                "risk_score": risk_score,
                "baseline_score": risk_score,
                "adjustments": [],
                "status": status,
                "signals": signals,
                "score_breakdown": {
                    "positive_contributors": signals,
                    "deductions": [],
                    "positive_total": risk_score,
                    "adjustment_total": 0,
                    "final_score": risk_score,
                    "formula": f"{risk_score} observed points = {risk_score} final triage score"
                },
                "note": "Static attachment inspection; file was not executed or detonated."
            },
            "category_analysis": {
                "category_id": "dangerous_attachments" if risk_score >= 50 else "unknown",
                "category_label": "Dangerous Attachment / Anomaly" if risk_score >= 50 else "Standalone File",
                "description": "Static byte inspection of file container, magic headers, and format boundaries.",
                "alert_level": "high" if risk_score >= 70 else "medium" if risk_score >= 35 else "low",
                "points": risk_score,
                "confidence": 85,
                "confidence_label": "Static inspection only",
                "spam_assessment": "Not Applicable",
                "recommended_action": "Detonate in cloud sandbox or inspect in isolated VM before opening." if risk_score >= 35 else "Static checks found no obvious high-risk markers; continue standard precautions."
            },
            "dns_auth": {
                "spf": "NOT APPLICABLE", "dkim": "NOT APPLICABLE", "dmarc": "NOT APPLICABLE", "arc": "NOT APPLICABLE",
                "note": "Standalone attachments have no email transport envelope."
            },
            "aitm_analysis": [],
            "attachment_analysis": [report],
            "evidence": {"sha256": sha256, "raw_size_bytes": len(content), "preservation": "Standalone static file inspection report."},
            "limitations": [
                "File was not executed, detonated, sandboxed, or scanned with antivirus / YARA.",
                "A low score is not a guarantee that the file is malware-free."
            ],
            "generated_at": datetime.now(timezone.utc).isoformat()
        }

    parsed = parse_eml_stream(content, filename)
    attachment_reports = []
    for item in parsed.get("attachments", []):
        attachment_reports.append(disassemble_attachment(item.get("filename", "unnamed"), item.get("content", b"")))
    return _build_result(parsed["meta"].get("subject", ""), parsed["meta"].get("from", ""), parsed["meta"].get("to", ""), parsed.get("body", ""), parsed.get("headers", {}), filename, content, parsed, attachment_reports)


@app.post(f"{settings.API_V1_STR}/ai-review")
async def ai_review(req: AIReviewRequest) -> Dict[str, Any]:
    """Run an optional OpenRouter second opinion; never replace observed evidence."""
    return request_ai_second_opinion(req.evidence)


@app.get(f"{settings.API_V1_STR}/stix-export/{{case_hash}}")
def export_stix(case_hash: str) -> Dict[str, Any]:
    return {"status": "not_configured", "case_hash": case_hash, "message": "STIX export requires a persisted case and validated IOC provenance; no fabricated bundle was generated."}


@app.get(f"{settings.API_V1_STR}/honeypots")
def get_honeypots() -> Dict[str, Any]:
    return {"status": "not_configured", "honeypots": [], "message": "Honeypot telemetry is not connected in the web-only deployment."}


@app.post(f"{settings.API_V1_STR}/sandbox/navigate")
async def sandbox_navigate(req: SandboxNavigateRequest) -> Dict[str, Any]:
    target = req.url.strip()
    if not target:
        target = "https://duckduckgo.com"
    if not target.startswith("http://") and not target.startswith("https://"):
        target = f"https://{target}"
    
    try:
        subprocess.Popen(
            ["chromium", "--no-sandbox", "--user-data-dir=/tmp/vnc_chromium", "--disable-gpu", "--disable-dev-shm-usage", "--window-size=1280,720", "--window-position=0,0", "--start-maximized", target],
            env={**dict(os.environ), "DISPLAY": ":99"}
        )
        return {"status": "success", "navigated_url": target, "display": ":99"}
    except Exception as e:
        return {"status": "error", "message": str(e), "navigated_url": target}


@app.post(f"{settings.API_V1_STR}/sandbox/app/{{app_name}}")
async def sandbox_launch_app(app_name: str) -> Dict[str, Any]:
    env = {**dict(os.environ), "DISPLAY": ":99"}
    cmd_map = {
        "files": ["thunar", "/home/nee/Desktop"],
        "terminal": ["qterminal"],
        "editor": ["mousepad"],
        "pdf": ["atril"],
        "image": ["ristretto"],
        "browser": ["chromium", "--no-sandbox", "--user-data-dir=/tmp/vnc_chromium", "--disable-gpu", "--disable-software-rasterizer", "--disable-dev-shm-usage", "https://www.google.com"],
    }
    cmd = cmd_map.get(app_name.lower())
    if not cmd:
        raise HTTPException(status_code=400, detail=f"Unsupported sandbox tool '{app_name}'")
    
    try:
        subprocess.Popen(cmd, env=env)
        return {"status": "success", "app": app_name, "command": cmd[0], "display": ":99"}
    except Exception as e:
        return {"status": "error", "message": str(e), "app": app_name}


@app.post(f"{settings.API_V1_STR}/sandbox/clipboard")
async def sandbox_clipboard(req: ClipboardRequest) -> Dict[str, Any]:
    try:
        p = subprocess.Popen(
            ["xclip", "-selection", "clipboard"],
            env={**dict(os.environ), "DISPLAY": ":99"},
            stdin=subprocess.PIPE
        )
        p.communicate(input=req.text.encode('utf-8'))
        return {"status": "success", "length": len(req.text), "message": "Copied to virtual PC clipboard"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post(f"{settings.API_V1_STR}/sandbox/restart")
async def sandbox_restart() -> Dict[str, Any]:
    try:
        subprocess.run(["pkill", "-9", "-f", "chromium.*vnc_chromium"], env={**dict(os.environ), "DISPLAY": ":99"})
        subprocess.Popen(
            ["chromium", "--no-sandbox", "--user-data-dir=/tmp/vnc_chromium", "--disable-gpu", "--disable-software-rasterizer", "--disable-dev-shm-usage", "--window-size=1200,660", "--window-position=40,30", "https://www.google.com", "https://mail.google.com"],
            env={**dict(os.environ), "DISPLAY": ":99"}
        )
        return {"status": "success", "message": "Virtual desktop browser restarted clean"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post(f"{settings.API_V1_STR}/honeypots")
def create_honeypot(req: HoneypotCreateRequest) -> Dict[str, Any]:
    return {"status": "not_configured", "email": req.email, "message": "Honeypot creation requires an authenticated telemetry backend."}


@app.websocket("/websockify")
@app.websocket("/novnc/websockify")
async def novnc_websocket_proxy(websocket: WebSocket):
    """Multiplex noVNC RFB TCP socket directly over FastAPI WebSocket on a single port."""
    subprotocols = websocket.headers.get("sec-websocket-protocol", "")
    chosen_subproto = "binary" if "binary" in subprotocols else None
    if chosen_subproto:
        await websocket.accept(subprotocol=chosen_subproto)
    else:
        await websocket.accept()

    try:
        reader, writer = await asyncio.open_connection("127.0.0.1", 5999)
    except Exception as e:
        await websocket.close()
        return

    closed = asyncio.Event()

    async def ws_to_tcp():
        while not closed.is_set():
            try:
                msg = await websocket.receive()
                if msg["type"] == "websocket.receive":
                    if "bytes" in msg and msg["bytes"]:
                        writer.write(msg["bytes"])
                        await writer.drain()
                    elif "text" in msg and msg["text"]:
                        writer.write(msg["text"].encode("utf-8"))
                        await writer.drain()
                elif msg["type"] == "websocket.disconnect":
                    print("ws_to_tcp disconnect event received")
                    break
            except Exception as e:
                print("ws_to_tcp exception:", type(e), e)
                break
        closed.set()

    async def tcp_to_ws():
        while not closed.is_set():
            try:
                data = await reader.read(16384)
                if not data:
                    print("tcp_to_ws received empty data from VNC server (EOF)")
                    break
                await websocket.send_bytes(data)
            except Exception as e:
                print("tcp_to_ws exception:", type(e), e)
                break
        closed.set()

    t1 = asyncio.create_task(ws_to_tcp())
    t2 = asyncio.create_task(tcp_to_ws())

    await closed.wait()
    t1.cancel()
    t2.cancel()

    try:
        writer.close()
        await writer.wait_closed()
    except Exception:
        pass
    try:
        await websocket.close()
    except Exception:
        pass


# Mount noVNC static web assets directly onto the same FastAPI web server
novnc_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "novnc"))
if os.path.exists(novnc_dir):
    app.mount("/novnc", StaticFiles(directory=novnc_dir, html=True), name="novnc")
# Render Build Version 4.0 - Clean UI Route
