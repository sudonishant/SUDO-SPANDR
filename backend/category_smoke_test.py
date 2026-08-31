from app.core.category_engine import classify_mail

cases = [
    ("Legitimate team meeting", "The agenda for our internal meeting is attached for review.", "colleague@example.test", "corporate"),
    ("20% discount this weekend", "Shop now and unsubscribe at any time.", "marketing@example.test", "promotional"),
    ("Urgent verify your account", "Your account is suspended. Verify your password now at https://login-verify.example.test", "security@example.test", "phishing_bec"),
    ("Your order has shipped", "Track your parcel using the order reference.", "dispatch@example.test", "delivery_order"),
]

for subject, body, sender, expected in cases:
    result = classify_mail(subject, body, sender)
    assert result["category_id"] == expected, (expected, result)
    assert 0 <= result["confidence"] <= 98
    assert result["confidence_label"] == "Evidence coverage (not probability)"

print(f"category smoke tests passed: {len(cases)}")
