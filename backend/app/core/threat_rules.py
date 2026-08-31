"""Backwards-compatible wrapper for deterministic mail category triage."""
from __future__ import annotations

from typing import Any, Dict

from app.core.category_engine import classify_mail


def evaluate_threat_matrix(subject: str, body: str, headers: Dict[str, Any] | None = None) -> Dict[str, Any]:
    category = classify_mail(subject=subject, body=body, sender=str((headers or {}).get("from", "")), headers=headers or {})
    score = category.get("points", 0)
    return {
        "risk_score": score,
        "status": "HIGH RISK" if score >= 70 else "REVIEW" if score >= 35 else "NO HIGH-RISK SIGNALS OBSERVED",
        "verdict_badge": category.get("category_label", "Unknown / insufficient evidence"),
        "signals": category.get("evidence_points", []),
        "category_analysis": category,
        "recommended_action": category.get("recommended_action", "Review the original evidence before acting."),
        "note": "Deterministic category rules; not a probability and not a final sender or malware verdict.",
    }
