"""Loss-aware RFC-style MIME parser for EML evidence.

A parse failure is returned as structured data. No fallback identity is invented.
"""
from __future__ import annotations

import email
import hashlib
import re
from email import policy
from email.message import Message
from html.parser import HTMLParser
from typing import Any, Dict, List


class _HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: List[str] = []

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if text:
            self.parts.append(text)

    def text(self) -> str:
        return " ".join(self.parts)


def _strip_html(value: str) -> str:
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value)).strip()


def _part_text(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        raw = part.get_payload()
        text = str(raw or "")
    else:
        charset = part.get_content_charset() or "utf-8"
        try:
            text = payload.decode(charset, errors="replace")
        except LookupError:
            text = payload.decode("utf-8", errors="replace")
    if part.get_content_type() == "text/html" or re.search(r"<(?:!doctype|html|body)\b", text, re.IGNORECASE):
        return _strip_html(text)
    return text


def _headers(message: Message) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for name, value in message.items():
        key = name.lower()
        rendered = str(value)
        result[key] = f"{result[key]}\n{rendered}" if key in result else rendered
    return result


import ipaddress


def is_public_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved)
    except ValueError:
        return False


try:
    from app.core.geo_engine import classify_ip
except ImportError:
    from backend.app.core.geo_engine import classify_ip

def resolve_ip_intel(ip_str: str) -> Dict[str, Any]:
    return classify_ip(ip_str)


def parse_received_hops(raw_received_headers: List[str]) -> List[Dict[str, Any]]:
    hops: List[Dict[str, Any]] = []
    chronological = list(reversed(raw_received_headers))

    for idx, header_text in enumerate(chronological):
        ip_matches = re.findall(r"\[([0-9]{1,3}(?:\.[0-9]{1,3}){3})\]", header_text)
        if not ip_matches:
            ip_matches = re.findall(r"\b([0-9]{1,3}(?:\.[0-9]{1,3}){3})\b", header_text)

        ip = ip_matches[0] if ip_matches else ""
        
        from_match = re.search(r"from\s+([^\s;()]+)", header_text, re.IGNORECASE)
        from_host = from_match.group(1).strip() if from_match else "unknown-source"

        by_match = re.search(r"by\s+([^\s;()]+)", header_text, re.IGNORECASE)
        by_host = by_match.group(1).strip() if by_match else "unknown-relay"

        with_match = re.search(r"with\s+([^\s;()]+)", header_text, re.IGNORECASE)
        protocol = with_match.group(1).upper() if with_match else "SMTP"

        time_match = re.search(r";\s*([A-Za-z]+,\s+[0-9]+\s+[A-Za-z]+\s+[0-9]{4}\s+[0-9:]+\s+[+-][0-9]{4}|[A-Za-z0-9\s:+-]{15,40})", header_text)
        timestamp_str = time_match.group(1).strip() if time_match else ""

        geo = resolve_ip_intel(ip) if ip else {
            "country": "Relay Host", "country_code": "REL", "city": from_host,
            "lat": 0.0, "lon": 0.0, "isp": "Transit MTA", "asn": "N/A",
            "is_vpn_tor": False, "threat_flag": "INTERNAL ROUTE"
        }

        hops.append({
            "hop_number": idx + 1,
            "is_origin": (idx == 0) and bool(ip and is_public_ip(ip)),
            "from_host": from_host,
            "by_host": by_host,
            "ip": ip,
            "protocol": protocol,
            "timestamp": timestamp_str,
            "geo": geo,
            "raw_header": header_text.strip()
        })

    has_origin = any(h["is_origin"] for h in hops)
    if not has_origin and hops:
        for h in hops:
            if h["ip"] and is_public_ip(h["ip"]):
                h["is_origin"] = True
                break

    return hops


def parse_eml_stream(raw_bytes: bytes, filename: str = "uploaded.eml") -> Dict[str, Any]:
    sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
    try:
        msg = email.message_from_bytes(raw_bytes, policy=policy.default)
        headers = _headers(msg)
        plain_parts: List[str] = []
        html_parts: List[str] = []
        attachments: List[Dict[str, Any]] = []
        for part in msg.walk():
            disposition = (part.get_content_disposition() or "").lower()
            file_name = part.get_filename()
            if file_name or disposition == "attachment":
                content = part.get_payload(decode=True) or b""
                attachments.append({"filename": file_name or "unnamed-attachment", "content": content, "size": len(content), "content_type": part.get_content_type()})
                continue
            if part.get_content_type() == "text/plain":
                plain_parts.append(_part_text(part))
            elif part.get_content_type() == "text/html":
                html_parts.append(_part_text(part))

        body = "\n\n".join(item for item in plain_parts if item.strip()).strip()
        if not body and html_parts:
            extractor = _HTMLTextExtractor()
            extractor.feed("\n".join(html_parts))
            body = extractor.text()

        raw_received = msg.get_all("Received", [])
        hops = parse_received_hops(raw_received)

        auth_results = str(msg.get("Authentication-Results") or "")
        dkim_sig = str(msg.get("DKIM-Signature") or "")
        return_path = str(msg.get("Return-Path") or "")
        reply_to = str(msg.get("Reply-To") or "")
        from_hdr = str(msg.get("From") or "")
        to_hdr = str(msg.get("To") or "")
        subject_hdr = str(msg.get("Subject") or "")
        message_id = str(msg.get("Message-ID") or "")

        defects = [str(defect) for defect in getattr(msg, "defects", [])]
        return {
            "meta": {
                "from": from_hdr,
                "to": to_hdr,
                "subject": subject_hdr,
                "return_path": return_path,
                "reply_to": reply_to,
                "message_id": message_id,
                "authentication_results": auth_results,
                "dkim_signature": dkim_sig
            },
            "body": body,
            "headers": headers,
            "sha256_hash": sha256_hash,
            "attachments": attachments,
            "hops": hops,
            "parse_error": None,
            "defects": defects,
        }
    except Exception as error:  # noqa: BLE001 - preserve evidence failure as data
        return {
            "meta": {"from": "", "to": "", "subject": ""},
            "body": "",
            "headers": {},
            "sha256_hash": sha256_hash,
            "attachments": [],
            "hops": [],
            "parse_error": f"EML parsing failed: {error}",
            "defects": [],
        }
