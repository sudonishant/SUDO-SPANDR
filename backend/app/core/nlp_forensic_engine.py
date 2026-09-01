"""High-Capacity Deep NLP & Psychological Social Engineering Analyzer for Email Body Forensics.
SIH 2026 Problem Statement #26106.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List, Tuple


NLP_THREAT_PATTERNS = [
    {
        "id": "nlp_urgent_pressure",
        "category": "Artificial Urgency & Fear Induction",
        "severity": "HIGH",
        "weight": 18,
        "pattern": r"(?i)\b(urgent|immediately|asap|within\s+\d+\s*(?:hours?|mins?|days?)|act\s+now|immediate\s+action\s+required|final\s+notice|account\s+(?:suspended|terminated|deactivated|frozen)|arrest\s+warrant|legal\s+consequences?|lawsuit|penalty\s+applied)\b",
        "expl_en": "Attacker manufactures artificial time pressure and fear to bypass critical logical thinking.",
        "expl_hi": "हमलावर सोचने का समय दिए बिना जल्दबाज़ी और डर पैदा करके शिकार को फंसाने की कोशिश कर रहा है।"
    },
    {
        "id": "nlp_executive_impersonation",
        "category": "Executive Authority & Confidentiality Trap",
        "severity": "CRITICAL",
        "weight": 24,
        "pattern": r"(?i)\b(strictly\s+confidential|do\s+not\s+call\s+me|i\s+am\s+in\s+a\s+meeting|board\s+approval|executive\s+directive|ceo\s+request|authorized\s+by\s+(?:management|director)|keep\s+this\s+between\s+us|per\s+my\s+previous\s+discussion)\b",
        "expl_en": "Impersonates executive leadership and demands secrecy/isolation to prevent out-of-band verification.",
        "expl_hi": "कंपनी के बड़े अधिकारी (CEO/MD) के नाम पर गोपनीयता की आड़ लेकर स्वतंत्र पुष्टि रोकने का प्रयास।"
    },
    {
        "id": "nlp_payment_diversion",
        "category": "BEC Financial Fraud & Account Diversion",
        "severity": "CRITICAL",
        "weight": 30,
        "pattern": r"(?i)\b(wire\s+transfer|remittance|updated\s+(?:bank|account|iban|swift|routing)|change\s+of\s+banking\s+details|new\s+payment\s+instructions?|direct\s+deposit|invoice\s+(?:settlement|payment|due)|crypto(?:currency)?|bitcoin|gift\s+cards?|western\s+union)\b",
        "expl_en": "Solicits immediate redirection of funds or alterations to vendor payment instructions (Classic BEC).",
        "expl_hi": "बैंक खाते का विवरण बदलकर कंपनी या व्यक्ति के पैसों को हमलावर के खाते में डाइवर्ट करने का प्रयास।"
    },
    {
        "id": "nlp_credential_harvest",
        "category": "Credential Harvesting & MFA Trap",
        "severity": "CRITICAL",
        "weight": 28,
        "pattern": r"(?i)\b(verify\s+your\s+(?:identity|account|password)|sign\s+in\s+to\s+confirm|password\s+(?:expired|reset)|security\s+alert|enter\s+your\s+(?:otp|pin|credentials?|login)|mfa\s+token|two-factor\s+verification|click\s+here\s+to\s+(?:unlock|reactivate))\b",
        "expl_en": "Attempts to capture user passwords, session tokens, or one-time codes via fraudulent authentication lures.",
        "expl_hi": "पासवर्ड, OTP या लॉगिन क्रेडेंशियल चुराने के लिए बनाया गया नकली सुरक्षा अलर्ट।"
    },
    {
        "id": "nlp_generic_mass_lure",
        "category": "Generic Mass Phishing Lure",
        "severity": "MEDIUM",
        "weight": 14,
        "pattern": r"(?i)\b(dear\s+(?:customer|user|valued\s+member|email\s+user|winner)|lottery\s+prize|congratulations\s+you\s+won|inheritance\s+funds?|unclaimed\s+funds?|beneficiary|compensation\s+fund)\b",
        "expl_en": "Uses unaddressed mass templates characteristic of broad-spectrum phishing or advance-fee scams.",
        "expl_hi": "सामान्य और बिना नाम वाले टेम्पलेट्स जो बड़े पैमाने पर फ़िशिंग और लॉटरी स्कैम में उपयोग किए जाते हैं।"
    }
]


def detect_unicode_homoglyphs(text: str) -> List[Dict[str, Any]]:
    findings = []
    zero_width = [c for c in text if c in {'\u200b', '\u200c', '\u200d', '\ufeff', '\u202a', '\u202b', '\u202e'}]
    if zero_width:
        findings.append({
            "type": "ZERO_WIDTH_EVASION",
            "label": f"Hidden Zero-Width Unicode Characters ({len(zero_width)} detected)",
            "severity": "CRITICAL",
            "weight": 25,
            "description": "Invisible characters injected to evade spam filters and keyword matchers."
        })

    cyrillic_chars = [c for c in text if '\u0400' <= c <= '\u04FF']
    latin_chars = [c for c in text if 'a' <= c.lower() <= 'z']
    if cyrillic_chars and latin_chars:
        sample_chars = "".join(set(cyrillic_chars[:6]))
        findings.append({
            "type": "HOMOGLYPH_OBFUSCATION",
            "label": f"Mixed Script / Cyrillic Homoglyphs detected ('{sample_chars}')",
            "severity": "HIGH",
            "weight": 22,
            "description": "Visually identical foreign alphabet characters used to spoof brand names and evade filters."
        })

    return findings


def analyze_body_paragraphs(body_text: str) -> Dict[str, Any]:
    if not body_text or not body_text.strip():
        return {
            "paragraphs_analyzed": 0,
            "flagged_count": 0,
            "overall_nlp_risk_score": 0,
            "evasion_findings": [],
            "psychological_triggers": [],
            "flagged_paragraphs": []
        }

    raw_paras = [p.strip() for p in re.split(r"\n\s*\n|\r\n\s*\r\n", body_text) if p.strip()]
    if not raw_paras:
        raw_paras = [body_text.strip()]

    flagged_paragraphs = []
    observed_triggers = set()
    total_nlp_points = 0

    evasion_findings = detect_unicode_homoglyphs(body_text)
    for ev in evasion_findings:
        total_nlp_points += ev.get("weight", 20)

    for idx, para in enumerate(raw_paras):
        para_findings = []
        para_score = 0
        
        for rule in NLP_THREAT_PATTERNS:
            matches = list(re.finditer(rule["pattern"], para))
            if matches:
                matched_phrases = list(set(m.group(0).lower() for m in matches))
                para_findings.append({
                    "rule_id": rule["id"],
                    "category": rule["category"],
                    "severity": rule["severity"],
                    "weight": rule["weight"],
                    "matched_snippets": matched_phrases,
                    "expl_en": rule["expl_en"],
                    "expl_hi": rule["expl_hi"]
                })
                para_score += rule["weight"]
                observed_triggers.add(rule["category"])

        if para_findings:
            total_nlp_points += para_score
            flagged_paragraphs.append({
                "paragraph_number": idx + 1,
                "text_snippet": para[:280] + ("..." if len(para) > 280 else ""),
                "findings": para_findings,
                "threat_score": min(100, para_score)
            })

    nlp_risk = min(100, total_nlp_points)

    return {
        "paragraphs_analyzed": len(raw_paras),
        "flagged_count": len(flagged_paragraphs),
        "overall_nlp_risk_score": nlp_risk,
        "evasion_findings": evasion_findings,
        "psychological_triggers": list(observed_triggers),
        "flagged_paragraphs": flagged_paragraphs
    }
