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

        defects = [str(defect) for defect in getattr(msg, "defects", [])]
        return {
            "meta": {"from": str(msg.get("From") or ""), "to": str(msg.get("To") or ""), "subject": str(msg.get("Subject") or "")},
            "body": body,
            "headers": headers,
            "sha256_hash": sha256_hash,
            "attachments": attachments,
            "hops": [],
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
