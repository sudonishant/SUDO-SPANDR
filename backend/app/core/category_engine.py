"""Evidence-based mail category and alert classifier.

This is deterministic triage logic, not a trained model and not a probability.
The web client and backend should expose the same output contract.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List

TAXONOMY_PATH = Path(__file__).resolve().parents[3] / "shared" / "category_taxonomy.json"
try:
    TAXONOMY = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
except (FileNotFoundError, json.JSONDecodeError):
    TAXONOMY = {"categories": []}

CATEGORIES = {item["id"]: item for item in TAXONOMY.get("categories", [])}
SCORING_PATH = Path(__file__).resolve().parents[3] / "shared" / "scoring_rules.json"
try:
    SCORING = json.loads(SCORING_PATH.read_text(encoding="utf-8"))
except (FileNotFoundError, json.JSONDecodeError):
    SCORING = {"thresholds": {"review": 35, "high": 70}, "content_weights": {"url_review": 8, "attachment": 22}, "authentication_adjustments": {}, "benign_context_adjustments": {}, "limits": {"min": 0, "max": 100}}

RULES = {
    "phishing_bec": [
        ("credential request", r"\b(password|login|sign in|verify your account|credential|otp|security code|session expired)\b", 20),
        ("pressure language", r"\b(urgent|immediately|asap|final notice|account suspended|act now)\b", 14),
        ("impersonation or authority", r"\b(ceo|cfo|director|admin|security team|microsoft|bank support)\b", 12),
        ("payment redirection", r"\b(wire transfer|change.*bank|gift card|crypto|payment redirect|remittance)\b", 24),
    ],
    "malware_related": [
        ("executable or script marker", r"\.(exe|scr|bat|cmd|js|vbs|ps1|hta|jar|apk)\b", 34),
        ("macro or active-content marker", r"\b(macro|vba|powershell|javascript|openaction|launch)\b", 28),
    ],
    "banking_financial": [("financial vocabulary", r"\b(bank|account statement|invoice|payment|transfer|remittance|debit|credit|swift|iban|refund)\b", 26)],
    "otp_security": [("authentication vocabulary", r"\b(otp|one[- ]time (password|code)|verification code|security code|login code|sign[- ]in code|code below|log into|2fa|login attempt|password reset|suspicious activity|account locked)\b", 30)],
    "delivery_order": [("delivery vocabulary", r"\b(order|shipment|shipped|delivery|tracking|parcel|courier|dispatch|return label)\b", 30)],
    "promotional": [("marketing vocabulary", r"\b(sale|discount|offer|coupon|cashback|limited time|deal|shop now|unsubscribe|free gift)\b", 28)],
    "newsletter": [("publication vocabulary", r"\b(newsletter|digest|bulletin|weekly update|monthly update|edition|subscribe)\b", 28)],
    "social": [("social vocabulary", r"\b(mentioned you|commented|liked your|follow|friend request|community|invitation)\b", 28)],
    "corporate": [("business vocabulary", r"\b(meeting|agenda|hr|payroll|policy|project|quarterly|board|employee|internal)\b", 24)],
    "support": [("support vocabulary", r"\b(support ticket|case number|help desk|customer care|service request|ticket #)\b", 28)],
    "transactional": [("transaction vocabulary", r"\b(receipt|confirmation|booking|statement|order confirmation|appointment|subscription renewal)\b", 24)],
}

ALERT_TITLES = {
    "critical": "Quarantine / urgent analyst review",
    "review": "Manual review recommended",
    "low": "Low-priority informational alert",
    "info": "Informational — no high-risk alert",
}


def _text(value: Any) -> str:
    return str(value or "")


def organization_domain(value: str = "") -> str:
    parts = _text(value).lower().split(".")
    parts = [part for part in parts if part]
    return ".".join(parts[-2:]) if len(parts) >= 2 else (parts[0] if parts else "")


def authentication_context(headers: Dict[str, Any] | None = None, sender: str = "") -> Dict[str, Any]:
    headers = headers or {}
    auth_results = _text(headers.get("authentication-results"))
    pass_matches = re.findall(r"\b(?:spf|dkim|dmarc|arc)\s*=\s*pass\b", auth_results, re.IGNORECASE)
    dmarc_pass = bool(re.search(r"\bdmarc\s*=\s*pass\b", auth_results, re.IGNORECASE))
    any_fail = bool(re.search(r"\b(?:spf|dkim|dmarc|arc)\s*=\s*(?:fail|permerror)\b", auth_results, re.IGNORECASE))
    from_domain = _text(sender).split("@", 1)[-1] if "@" in _text(sender) else ""
    return_domain = _text(headers.get("return-path")).split("@", 1)[-1] if "@" in _text(headers.get("return-path")) else ""
    return {"pass_count": len(pass_matches), "dmarc_pass": dmarc_pass, "any_fail": any_fail, "aligned_from_return_path": bool(from_domain and return_domain and organization_domain(from_domain) == organization_domain(return_domain))}


def calculate_threat_score(category_id: str, category_points: float, urls: Iterable[Dict[str, Any]] | None = None, attachments: Iterable[Dict[str, Any]] | None = None, header_findings: Iterable[Dict[str, Any]] | None = None, headers: Dict[str, Any] | None = None, sender: str = "", category_evidence: Iterable[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    urls = list(urls or [])
    attachments = list(attachments or [])
    header_findings = list(header_findings or [])
    category_evidence = list(category_evidence or [])
    positive_contributors = [{"label": item.get("label", "Category signal"), "points": float(item.get("points", 0)), "evidence": item.get("source", "Category rule matched"), "source": item.get("source", "category-rule")} for item in category_evidence if float(item.get("points", 0)) > 0]
    extra_contributors = []
    url_weight = SCORING.get("content_weights", {}).get("url_review", 8)
    attachment_weight = SCORING.get("content_weights", {}).get("attachment", 22)
    for item in urls:
        if item.get("risk") == "REVIEW" and category_id != "phishing_bec":
            extra_contributors.append({"label": f"URL requires review: {item.get('domain', 'unknown domain')}", "points": url_weight, "evidence": "; ".join(item.get("reasons", [])) or "URL structure", "source": "url-review"})
    for item in attachments:
        if str(item.get("risk_level", "")).upper() != "LOW" and category_id != "malware_related":
            extra_contributors.append({"label": f"Attachment requires review: {item.get('filename', 'unnamed file')}", "points": min(attachment_weight, float(item.get("risk_score", 0))), "evidence": "; ".join(item.get("findings", [])), "source": "attachment-static-check"})
    for item in header_findings:
        extra_contributors.append({"label": item.get("label", "Header finding"), "points": float(item.get("weight", 0)), "evidence": "Observed in submitted headers", "source": "header-check"})
    positive_contributors.extend(extra_contributors)
    baseline = float(category_points or 0) + sum(item["points"] for item in extra_contributors)
    adjustments = []
    score = baseline
    auth = authentication_context(headers, sender)
    auth_adjustments = SCORING.get("authentication_adjustments", {})
    if auth["pass_count"] >= 3:
        points = auth_adjustments.get("three_or_more_passes", -24); score += points; adjustments.append({"label": "Multiple receiver-reported authentication passes", "points": points})
    if auth["dmarc_pass"]:
        points = auth_adjustments.get("dmarc_pass", -8); score += points; adjustments.append({"label": "DMARC reported pass", "points": points})
    if auth["aligned_from_return_path"]:
        points = auth_adjustments.get("aligned_from_return_path", -8); score += points; adjustments.append({"label": "From and Return-Path organizational domains align", "points": points})
    if auth["any_fail"]:
        points = auth_adjustments.get("any_fail", 24); score += points; adjustments.append({"label": "An authentication method reported fail/permerror", "points": points})
    benign_points = SCORING.get("benign_context_adjustments", {}).get(category_id)
    if benign_points:
        score += benign_points; adjustments.append({"label": f"{category_id} context adjustment", "points": benign_points})
    limits = SCORING.get("limits", {"min": 0, "max": 100})
    final_score = round(max(limits.get("min", 0), min(limits.get("max", 100), score)), 1)
    deduction_total = round(sum(float(item.get("points", 0)) for item in adjustments), 1)
    return {"risk_score": final_score, "baseline_score": round(baseline, 1), "adjustments": adjustments, "authentication_context": auth, "score_breakdown": {"positive_contributors": positive_contributors, "deductions": [{"label": item["label"], "points": item["points"], "evidence": "Context adjustment from submitted authentication/category evidence", "source": "shared-scoring-rules"} for item in adjustments], "positive_total": round(baseline, 1), "adjustment_total": deduction_total, "final_score": final_score, "formula": f"{round(baseline, 1)} observed points plus {deduction_total} adjustments = {final_score} final triage score"}}


def _category_evidence(category_id: str, text: str) -> List[Dict[str, Any]]:
    results = []
    for label, pattern, points in RULES.get(category_id, []):
        if re.search(pattern, text, re.IGNORECASE):
            results.append({"category_id": category_id, "label": label, "points": points, "source": "subject/body/sender text"})
    return results


def classify_mail(subject: str = "", body: str = "", sender: str = "", headers: Dict[str, Any] | None = None, urls: Iterable[Dict[str, Any]] | None = None, attachments: Iterable[Dict[str, Any]] | None = None, threat_score: float = 0) -> Dict[str, Any]:
    headers = headers or {}
    urls = list(urls or [])
    attachments = list(attachments or [])
    text = "\n".join((_text(subject), _text(body), _text(sender)))
    scores = {category_id: 0 for category_id in CATEGORIES}
    evidence: List[Dict[str, Any]] = []

    for category_id in RULES:
        items = _category_evidence(category_id, text)
        evidence.extend(items)
        scores[category_id] += sum(item["points"] for item in items)

    for url in urls:
        if url.get("risk") in {"REVIEW", "SUSPICIOUS"} or url.get("is_fake_link"):
            scores["phishing_bec"] = scores.get("phishing_bec", 0) + 18
            evidence.append({"category_id": "phishing_bec", "label": f"review URL: {url.get('domain', 'unknown domain')}", "points": 18, "source": "URL structure"})

    for attachment in attachments:
        level = str(attachment.get("risk_level", "")).upper()
        if level == "HIGH":
            scores["malware_related"] = scores.get("malware_related", 0) + 60
            evidence.append({"category_id": "malware_related", "label": f"high-risk attachment: {attachment.get('filename', 'unnamed')}", "points": 60, "source": "static file inspection"})
        elif level == "MEDIUM":
            scores["malware_related"] = scores.get("malware_related", 0) + 25
            evidence.append({"category_id": "malware_related", "label": f"attachment requires review: {attachment.get('filename', 'unnamed')}", "points": 25, "source": "static file inspection"})

    words = len(text.split())
    if not evidence and words >= 8:
        scores["legitimate"] = scores.get("legitimate", 0) + 18
        evidence.append({"category_id": "legitimate", "label": "No stronger category signal observed", "points": 18, "source": "content review"})
    if not evidence or (words < 8 and not sender and not subject):
        scores["unknown"] = scores.get("unknown", 0) + 30

    category_id = max(scores, key=scores.get) if scores else "unknown"
    if float(threat_score) >= 70 and scores.get("malware_related", 0) >= scores.get("phishing_bec", 0):
        category_id = "malware_related"
    elif float(threat_score) >= 70 and scores.get("phishing_bec", 0) > 0:
        category_id = "phishing_bec"
    if scores.get(category_id, 0) == 0:
        category_id = "unknown"

    category = CATEGORIES.get(category_id, CATEGORIES.get("unknown", {"label": "Unknown / insufficient evidence", "description": "Not enough reliable content to classify the message safely.", "default_alert": "review", "action": "Request more context or inspect the original message headers before acting."}))
    chosen = [item for item in evidence if item["category_id"] == category_id]
    points = min(100, scores.get(category_id, 0))
    confidence = 25 if category_id == "unknown" else min(98, 48 + len(chosen) * 10 + (5 if subject else 0) + (5 if sender else 0))
    alert_level = category.get("default_alert", "review")
    if category_id == "malware_related" or (category_id == "phishing_bec" and float(threat_score) >= 70):
        alert_level = "critical"
    elif category_id in {"phishing_bec", "banking_financial", "unknown"} or float(threat_score) >= 35:
        alert_level = "review"

    spam_signals = []
    if re.search(r"\b(unsubscribe|bulk|promotion|sale|discount|coupon|free gift)\b", text, re.IGNORECASE):
        spam_signals.append("marketing or bulk-mail language")
    if re.search(r"\b(dear customer|valued customer|click here|limited time)\b", text, re.IGNORECASE):
        spam_signals.append("generic mass-mail phrasing")

    return {
        "category_id": category_id,
        "category_label": category.get("label", category_id),
        "description": category.get("description", ""),
        "points": points,
        "confidence": confidence,
        "confidence_label": "Evidence coverage (not probability)",
        "evidence_points": chosen,
        "all_category_scores": sorted(({"category_id": key, "label": CATEGORIES.get(key, {}).get("label", key), "points": min(100, value)} for key, value in scores.items() if value > 0), key=lambda item: item["points"], reverse=True),
        "alert_level": alert_level,
        "alert_title": ALERT_TITLES.get(alert_level, ALERT_TITLES["review"]),
        "recommended_action": category.get("action", "Review the original evidence before acting."),
        "spam_assessment": "PROMOTIONAL / BULK SIGNALS OBSERVED" if spam_signals else "NO SPAM-SPECIFIC SIGNAL OBSERVED",
        "spam_signals": spam_signals,
        "note": "Category and confidence are heuristic triage outputs. Similar language can occur in both legitimate and malicious mail; verify context and source.",
    }
