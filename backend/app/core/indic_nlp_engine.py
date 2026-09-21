# Indic Multilingual NLP & DPDP Act 2023 PII Redaction Engine
# Covers 8 Official Indian Languages + DPDP Act 2023 Digital Personal Data Protection
# SIH #26106

import re
from typing import Dict, Any, List, Tuple

# --- Verhoeff Algorithm for Indian Aadhaar Number Validation ---
_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
]

_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
]

_VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]


def validate_verhoeff(num_str: str) -> bool:
    digits = [int(c) for c in num_str if c.isdigit()]
    if len(digits) != 12:
        return False
    c = 0
    for i, item in enumerate(reversed(digits)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][item]]
    return c == 0


def validate_luhn(card_num: str) -> bool:
    digits = [int(c) for c in card_num if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            doubled = d * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += d
    return checksum % 10 == 0


INDIC_THREAT_LEXICON: Dict[str, Dict[str, Any]] = {
    "hindi": {
        "language_name": "Hindi (हिन्दी)",
        "patterns": [
            (r"(?:तत्काल|तुरंत|अति\s*आवश्यक|अविलंब)", "Artificial Urgency & Coercion", 22),
            (r"(?:खाता\s*बंद|निलंबित|ब्लॉक\s*हो\s*जाएगा|सेवा\s*समाप्त)", "Account Suspension / Coercive Threat", 28),
            (r"(?:केवाईसी|ओटीपी|पैन\s*कार्ड|आधार\s*लिंक)", "Sensitive Token / Credential Solicitation", 30),
            (r"(?:बिजली\s*बिल|बिजली\s*काट\s*दी\s*जाएगी|लाइन\s*काटी\s*जाएगी)", "Public Utility Impersonation Scam", 25),
            (r"(?:लॉटरी|इनाम|रुपये\s*जीते|मुफ़्त\s*ऑफ़र)", "Advance Fee / Lottery Fraud", 20),
            (r"(?:कानूनी\s*कार्रवाई|पुलिस\s*शिकायत|गिरफ़्तारी\s*वारंट)", "Law Enforcement / Police Extortion Threat", 32)
        ]
    },
    "bengali": {
        "language_name": "Bengali (বাংলা)",
        "patterns": [
            (r"(?:জরুরি|অবিলম্বে|শীঘ্রই)", "Artificial Urgency & Coercion", 22),
            (r"(?:অ্যাকাউন্ট\s*ব্লক|স্থগিত|পরিষেবা\s*বন্ধ)", "Account Suspension / Coercive Threat", 28),
            (r"(?:কেওয়াইসি|ওটিপি|প্যান\s*কার্ড|আধার\s*লিঙ্ক)", "Sensitive Token / Credential Solicitation", 30),
            (r"(?:বিদ্যুৎ\s*বিল|বিদ্যুৎ\s*বিচ্ছিন্ন)", "Public Utility Impersonation Scam", 25),
            (r"(?:লটারি|পুরস্কার|টাকা\s*জিতেছেন)", "Advance Fee / Lottery Fraud", 20),
            (r"(?:আইনি\s*ব্যবস্থা|পুলিশ\s*অভিযোগ)", "Law Enforcement / Police Extortion Threat", 32)
        ]
    },
    "tamil": {
        "language_name": "Tamil (தமிழ்)",
        "patterns": [
            (r"(?:உடனடி|விரைவில்|அவசரம்)", "Artificial Urgency & Coercion", 22),
            (r"(?:கணக்கு\s*முடக்கப்படும்|தடை\s*செய்யப்பட்டது)", "Account Suspension / Coercive Threat", 28),
            (r"(?:கேஒய்சி|ஓடிபி|பான்\s*அட்டை|ஆதார்\s*இணைப்பு)", "Sensitive Token / Credential Solicitation", 30),
            (r"(?:மின்\s*கட்டணம்|மின்சாரம்\s*துண்டிக்கப்படும்)", "Public Utility Impersonation Scam", 25),
            (r"(?:லாட்டரி|பரிசு|பணம்\s*வென்றீர்கள்)", "Advance Fee / Lottery Fraud", 20),
            (r"(?:சட்ட\s*நடவடிக்கை|காவல்துறை)", "Law Enforcement / Police Extortion Threat", 32)
        ]
    },
    "telugu": {
        "language_name": "Telugu (తెలుగు)",
        "patterns": [
            (r"(?:తక్షణమే|వెంటనే|అత్యవసరం)", "Artificial Urgency & Coercion", 22),
            (r"(?:ఖాతా\s*నిలిపివేయబడుతుంది|బ్లాక్\s*చేయబడింది)", "Account Suspension / Coercive Threat", 28),
            (r"(?:కెవైసి|ఒటిపి|పాన్\s*కార్డ్|ఆధార్\s*లింక్)", "Sensitive Token / Credential Solicitation", 30),
            (r"(?:విద్యుత్\s*బిల్లు|విద్యుత్\s*సరఫరా\s*నిలిపివేత)", "Public Utility Impersonation Scam", 25),
            (r"(?:లాటరీ|బహుమతి|డబ్బులు\s*గెలుచుకున్నారు)", "Advance Fee / Lottery Fraud", 20),
            (r"(?:చట్టపరమైన\s*చర్య|పోలీస్\s*కేసు)", "Law Enforcement / Police Extortion Threat", 32)
        ]
    },
    "marathi": {
        "language_name": "Marathi (मराठी)",
        "patterns": [
            (r"(?:तातडीने|लगेच|अतिशय\s*महत्वाचे)", "Artificial Urgency & Coercion", 22),
            (r"(?:खाते\s*निलंबित|बंद\s*केले\s*जाईल)", "Account Suspension / Coercive Threat", 28),
            (r"(?:केवायसी|ओटीपी|पॅन\s*कार्ड|आधार\s*लिंक)", "Sensitive Token / Credential Solicitation", 30),
            (r"(?:वीज\s*बिल|वीज\s*पुरवठा\s*खंडित)", "Public Utility Impersonation Scam", 25),
            (r"(?:लॉटरी|बक्षीस|पैसे\s*जिंकले)", "Advance Fee / Lottery Fraud", 20),
            (r"(?:कायदेशीर\s*कारवाई|पोलीस\s*तक्रार)", "Law Enforcement / Police Extortion Threat", 32)
        ]
    },
    "gujarati": {
        "language_name": "Gujarati (ગુજરાતી)",
        "patterns": [
            (r"(?:તાત્કાલિક|તરત\s*જ|ખૂબ\s*જરૂરી)", "Artificial Urgency & Coercion", 22),
            (r"(?:ખાતું\s*બ્લોક|સેવા\s*બંધ)", "Account Suspension / Coercive Threat", 28),
            (r"(?:કેવાયસી|ઓટીપી|પાન\s*કાર્ડ|આધાર\s*લિંક)", "Sensitive Token / Credential Solicitation", 30),
            (r"(?:વીજળી\s*બિલ|વીજળી\s*કાપી\s*નાખવામાં\s*આવશે)", "Public Utility Impersonation Scam", 25),
            (r"(?:લોટરી|ઇનામ|રૂપિયા\s*જીત્યા)", "Advance Fee / Lottery Fraud", 20),
            (r"(?:કાનૂની\s*પગલાં|પોલીસ\s*ફરિયાદ)", "Law Enforcement / Police Extortion Threat", 32)
        ]
    },
    "kannada": {
        "language_name": "Kannada (ಕನ್ನಡ)",
        "patterns": [
            (r"(?:ತಕ್ಷಣ|ತುರ್ತು|ಕೂಡಲೇ)", "Artificial Urgency & Coercion", 22),
            (r"(?:ಖಾತೆ\s*ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ|ಖಾತೆ\s*ರದ್ದು)", "Account Suspension / Coercive Threat", 28),
            (r"(?:ಕೆವೈಸಿ|ಒಟಿಪಿ|ಪ್ಯಾನ್\s*ಕಾರ್ಡ್|ಆಧಾರ್\s*ಲಿಂಕ್)", "Sensitive Token / Credential Solicitation", 30),
            (r"(?:ವಿದ್ಯುತ್\s*ಬಿಲ್|ವಿದ್ಯುತ್\s*ಸಂಪರ್ಕ\s*ಕಡಿತ)", "Public Utility Impersonation Scam", 25),
            (r"(?:ಲಾಟರಿ|ಬಹುಮಾನ|ಹಣ\s*ಗೆದ್ದಿದ್ದೀರಿ)", "Advance Fee / Lottery Fraud", 20),
            (r"(?:ಕಾನೂನು\s*ಕ್ರಮ|ಪೊಲೀಸ್\s*ದೂರು)", "Law Enforcement / Police Extortion Threat", 32)
        ]
    },
    "malayalam": {
        "language_name": "Malayalam (മലയാളം)",
        "patterns": [
            (r"(?:ഉടൻ|അടിയന്തിരമായി|താമസമില്ലാതെ)", "Artificial Urgency & Coercion", 22),
            (r"(?:അക്കൗണ്ട്\s*ബ്ലോക്ക്|സസ്പെൻഡ്)", "Account Suspension / Coercive Threat", 28),
            (r"(?:കെവൈസി|ഒടിപി|പാൻ\s*കാർഡ്|ആധാർ\s*ലിങ്ക്)", "Sensitive Token / Credential Solicitation", 30),
            (r"(?:വൈദ്യുതി\s*ബിൽ|വൈദ്യുതി\s*വിച്ഛേദിക്കും)", "Public Utility Impersonation Scam", 25),
            (r"(?:ലോട്ടറി|സമ്മാനം|പണം\s*നേടി)", "Advance Fee / Lottery Fraud", 20),
            (r"(?:നിയമനടപടി|പോലീസ്\s*പരാതി)", "Law Enforcement / Police Extortion Threat", 32)
        ]
    }
}


def scan_indic_threats(text: str) -> Dict[str, Any]:
    if not text:
        return {"detected": False, "languages_found": [], "findings": [], "threat_points": 0, "summary": "No Indic regional threat markers identified."}

    findings = []
    langs_found = set()
    total_points = 0

    for lang_key, data in INDIC_THREAT_LEXICON.items():
        for pat, threat_cat, weight in data["patterns"]:
            matches = re.findall(pat, text, re.IGNORECASE | re.UNICODE)
            if matches:
                langs_found.add(data["language_name"])
                sample_snippets = list(set(matches))[:3]
                findings.append({
                    "language": data["language_name"],
                    "threat_category": threat_cat,
                    "weight": weight,
                    "matches": sample_snippets,
                    "explanation": f"Observed regional social engineering keyword(s) [{', '.join(sample_snippets)}] targeting Indian recipients."
                })
                total_points += weight

    return {
        "detected": len(findings) > 0,
        "languages_found": sorted(list(langs_found)),
        "findings": findings,
        "threat_points": min(total_points, 45),
        "summary": f"Detected {len(findings)} regional threat indicators across {len(langs_found)} Indian language(s)." if findings else "No Indic regional threat markers identified."
    }


def redact_dpdp_pii(text: str, redact: bool = True) -> Dict[str, Any]:
    if not text:
        return {
            "redacted_text": "",
            "pii_counts": {},
            "audit_trail": [],
            "redaction_applied": False,
            "total_redacted": 0,
            "compliance_standard": "Digital Personal Data Protection Act (DPDP) 2023 & IT Act Section 43A"
        }

    audit_trail = []
    pii_counts = {
        "aadhaar": 0,
        "pan": 0,
        "phone": 0,
        "upi": 0,
        "payment_card": 0
    }

    processed = text

    # 1. Indian Aadhaar Number (12 digits, optional space/hyphen)
    aadhaar_pattern = r"(?<!\d)([2-9]\d{3}[-\s]?\d{4}[-\s]?\d{4})(?!\d)"
    for match in re.finditer(aadhaar_pattern, processed):
        raw_val = match.group(1)
        clean_val = re.sub(r"[-\s]", "", raw_val)
        if len(clean_val) == 12:
            masked = f"XXXX-XXXX-{clean_val[-4:]}"
            pii_counts["aadhaar"] += 1
            audit_trail.append({
                "type": "Aadhaar Identity Number",
                "regulation": "DPDP Act 2023 / UIDAI Regulations",
                "masked_preview": masked
            })
            if redact:
                processed = processed.replace(raw_val, f"[REDACTED_AADHAAR: {masked}]")

    # 2. Permanent Account Number (PAN) - Format: 5 uppercase letters + 4 digits + 1 uppercase letter
    pan_pattern = r"(?<![A-Za-z0-9])([A-Z]{5}[0-9]{4}[A-Z])(?![A-Za-z0-9])"
    for match in re.finditer(pan_pattern, processed):
        raw_val = match.group(1)
        masked = f"XXXXX{raw_val[5:9]}X"
        pii_counts["pan"] += 1
        audit_trail.append({
            "type": "Income Tax PAN Card",
            "regulation": "Section 139A IT Act / DPDP Act 2023",
            "masked_preview": masked
        })
        if redact:
            processed = processed.replace(raw_val, f"[REDACTED_PAN: {masked}]")

    # 3. Indian Mobile Number (10 digits starting with 6, 7, 8, 9)
    phone_pattern = r"(?:(?:\+91|91|0)[-\s]?)?(?<!\d)([6-9]\d{4}[-\s]?\d{5})(?!\d)"
    for match in re.finditer(phone_pattern, processed):
        raw_val = match.group(0).strip()
        digits_only = re.sub(r"\D", "", raw_val)
        if len(digits_only) >= 10:
            last4 = digits_only[-4:]
            masked = f"+91 XXXXX XX{last4[2:]}"
            pii_counts["phone"] += 1
            audit_trail.append({
                "type": "Personal Mobile Number",
                "regulation": "DPDP Act 2023 Sec 6",
                "masked_preview": masked
            })
            if redact:
                processed = processed.replace(raw_val, f"[REDACTED_PHONE: {masked}]")

    # 4. UPI VPA Address
    upi_pattern = r"(?<![a-zA-Z0-9.\-_])([a-zA-Z0-9.\-_]{3,}@(oksbi|okhdfcbank|okaxis|okicici|paytm|upi|ybl|axl|ibl|barodampay|allbank|freecharge))(?![a-zA-Z0-9.\-_])"
    for match in re.finditer(upi_pattern, processed, re.IGNORECASE):
        raw_val = match.group(1)
        username, handle = raw_val.split("@", 1)
        masked = f"{username[:2]}***@{handle}"
        pii_counts["upi"] += 1
        audit_trail.append({
            "type": "UPI Financial Virtual Address",
            "regulation": "RBI / DPDP Act 2023",
            "masked_preview": masked
        })
        if redact:
            processed = processed.replace(raw_val, f"[REDACTED_UPI: {masked}]")

    # 5. Payment Cards (16 digits)
    card_pattern = r"(?<!\d)(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})(?!\d)"
    for match in re.finditer(card_pattern, processed):
        raw_val = match.group(1)
        clean_val = re.sub(r"[-\s]", "", raw_val)
        if len(clean_val) == 16 and validate_luhn(clean_val):
            masked = f"XXXX-XXXX-XXXX-{clean_val[-4:]}"
            pii_counts["payment_card"] += 1
            audit_trail.append({
                "type": "Payment Card PAN (PCI-DSS)",
                "regulation": "PCI-DSS / RBI Tokenization Mandate",
                "masked_preview": masked
            })
            if redact:
                processed = processed.replace(raw_val, f"[REDACTED_CARD: {masked}]")

    total_redacted = sum(pii_counts.values())
    return {
        "redacted_text": processed if redact else text,
        "pii_counts": pii_counts,
        "total_redacted": total_redacted,
        "audit_trail": audit_trail,
        "redaction_applied": redact and total_redacted > 0,
        "compliance_standard": "Digital Personal Data Protection Act (DPDP) 2023 & IT Act Section 43A"
    }
