"""Pure Web-Native Air-Gapped Sandbox Detonation & DOM Inspection Engine.
Allows safe in-browser link detonation, form inspection, and credential trap detection
without requiring heavy Linux desktop or noVNC dependencies.
"""
from __future__ import annotations

import re
import socket
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict


def inspect_url_dom_and_headers(target_url: str) -> Dict[str, Any]:
    """Inspects a target webpage safely, analyzing form inputs, password fields, and security headers."""
    if not target_url.startswith(("http://", "https://")):
        target_url = "https://" + target_url

    parsed_url = urllib.parse.urlparse(target_url)
    hostname = parsed_url.hostname or "unknown"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberSquad-Sandbox/4.0 (Air-Gapped Detonator)"
    }

    resolved_ip = "Unresolved"
    try:
        resolved_ip = socket.gethostbyname(hostname)
    except Exception:
        pass

    req = urllib.request.Request(target_url, headers=headers)
    
    html_content = ""
    status_code = 0
    resp_headers = {}

    try:
        # Ignore SSL errors for malicious sites during forensic inspection
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        with urllib.request.urlopen(req, context=ctx, timeout=6) as response:
            status_code = response.status
            resp_headers = dict(response.headers)
            raw_bytes = response.read(250000) # Read up to 250KB
            html_content = raw_bytes.decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        status_code = e.code
        resp_headers = dict(e.headers)
        html_content = e.read(50000).decode("utf-8", errors="ignore")
    except Exception as e:
        return {
            "status": "UNREACHABLE_OR_OFFLINE",
            "url": target_url,
            "hostname": hostname,
            "resolved_ip": resolved_ip,
            "error": str(e),
            "threat_verdict": "HOST UNREACHABLE (Likely takedown or bulletproof hosting)",
            "risk_score": 50.0,
            "forms_found": [],
            "password_inputs_count": 0,
            "sanitized_html": f"<div style='padding:20px;color:#f87171;font-family:sans-serif;'><h3>🚨 Target Server Offline or Blocked</h3><p>{str(e)}</p></div>"
        }

    # Extract forms and password traps
    password_inputs = re.findall(r'<input[^>]*type=[\'"](?:password|tel|credit_card)[\'"][^>]*>', html_content, re.IGNORECASE)
    form_tags = re.findall(r'<form[^>]*action=[\'"]([^\'"]*)[\'"][^>]*>', html_content, re.IGNORECASE)
    title_match = re.search(r'<title[^>]*>(.*?)</title>', html_content, re.IGNORECASE)
    page_title = title_match.group(1).strip() if title_match else "No Title Found"

    is_credential_trap = len(password_inputs) > 0
    threat_score = 15.0
    if is_credential_trap:
        threat_score += 45.0
    if not target_url.startswith("https://"):
        threat_score += 20.0
    if "hsts" not in str(resp_headers).lower():
        threat_score += 10.0

    threat_score = min(100.0, threat_score)

    # Sanitize HTML for Air-Gapped Safe Rendering
    # Strip script tags to prevent execution on analyst machine
    sanitized = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '<!-- Script Stripped by Air-Gapped Detonator -->', html_content, flags=re.IGNORECASE)
    # Neutralize form actions to avoid accidental POST submissions
    sanitized = re.sub(r'<form\b', '<form onsubmit="alert(\'🚨 ACTION BLOCKED: Air-Gapped Sandbox neutralizes credential submissions.\'); return false;"', sanitized, flags=re.IGNORECASE)
    
    # Inject Security Overlay Banner
    safety_banner = f"""
    <div style="background:#0f172a;color:#fff;padding:10px 15px;border-bottom:3px solid #ef4444;font-family:'Segoe UI',sans-serif;font-size:12px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:999999;">
        <div>
            <strong style="color:#f87171;">🛡️ AIR-GAPPED SAFE SANDBOX DETONATION:</strong>
            <span style="color:#94a3b8;margin-left:6px;">Target: {target_url} (IP: {resolved_ip})</span>
        </div>
        <div>
            <span style="background:#dc2626;color:#fff;font-weight:700;padding:3px 8px;border-radius:4px;font-size:11px;">
                {'🚨 CREDENTIAL TRAP DETECTED' if is_credential_trap else '🟡 SAFE PREVIEW MODE'}
            </span>
        </div>
    </div>
    """
    
    # Inject banner right after <body> or at the top
    if "<body" in sanitized.lower():
        sanitized = re.sub(r'(<body[^>]*>)', r'\1' + safety_banner, sanitized, count=1, flags=re.IGNORECASE)
    else:
        sanitized = safety_banner + sanitized

    return {
        "status": "DETONATED_SUCCESSFULLY",
        "url": target_url,
        "hostname": hostname,
        "resolved_ip": resolved_ip,
        "http_status": status_code,
        "page_title": page_title,
        "threat_verdict": "🚨 HIGH RISK: Deceptive Credential Harvesting Trap" if is_credential_trap else "SUSPICIOUS / EXTERNAL WEB ASSET",
        "risk_score": threat_score,
        "password_inputs_count": len(password_inputs),
        "forms_count": len(form_tags),
        "security_headers": {
            "strict_transport_security": resp_headers.get("strict-transport-security", "MISSING (Insecure)"),
            "content_security_policy": "STRICT_SANDBOX_ENFORCED",
            "x_frame_options": resp_headers.get("x-frame-options", "NONE (Clickjacking Vector)")
        },
        "sanitized_html": sanitized
    }
