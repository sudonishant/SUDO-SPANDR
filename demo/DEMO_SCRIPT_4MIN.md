# 🎙️ SUDO SPANDR — 4-Minute Winning Judge Demo Script
### SIH 2026 Problem Statement #26106 | Team SUDO SPANDR

---

## ⏱️ MINUTE 1 (0:00 - 1:00) — The Problem & Instant Intake
**Speaker Action:** Stand tall, open browser to `sudospandrsce.vercel.app` (or local instance). Hold up phone or click sample email button.

> **Spoken:**
> "Good morning respected judges. Email fraud accounts for over 72% of all enterprise breaches and cyber financial crime in India today. But traditional security tools either produce uninterpretable machine learning black boxes that fail in court, or basic regex checklists that miss multi-hop spoofing.
> 
> We present **SUDO SPANDR** — an end-to-end Forensic Email Triage, Threat Extraction, and Automated Gateway Enforcement platform built strictly around RFC standards, Indian IT Act Section 65B, and the DPDP Act 2023.
> 
> Watch how fast it works. I am dragging an inbound phishing email (`01_bec_wire_fraud.eml`) into our ingest window. In less than 150 milliseconds, our deterministic parser disassembles the MIME envelope, extracts every SMTP transmission hop, computes an immutable SHA-256 evidence anchor, and classifies the risk."

---

## ⏱️ MINUTE 2 (1:00 - 2:00) — Deep Forensics & Truthful Cryptography
**Speaker Action:** Click on **Hop Flow & Geolocation**, then click **SPF / DKIM / DMARC** tab.

> **Spoken:**
> "Notice two crucial engineering breakthroughs here:
> 
> First, **True RFC-Aware Network Attribution**: Unlike naive tools that arbitrarily flag foreign IP addresses or penalize safe countries, our engine classifies private subnets, loopbacks, and intermediate relays under RFC 1918. Country of origin is strictly forensic context — zero arbitrary threat points added.
> 
> Second, **Truthful Cryptographic Authentication**: In the SPF/DKIM tab, notice our status: **BEST EFFORT**. Why? Because the sender's public DNS lacked a strict `p=reject` DMARC record. Instead of failing blindly or giving false reassurance, SUDO SPANDR inspects Return-Path alignment, verifies DKIM RSA-SHA256 signatures, and clearly explains its heuristic triage in plain English and Hindi."

---

## ⏱️ MINUTE 3 (2:00 - 3:00) — MITRE ATT&CK & Enterprise Gateway Enforcement
**Speaker Action:** Click on **Tactics & MITRE ATT&CK** tab. Show the AI Copilot and download Navigator layer button. Then switch to Gateway Simulator.

> **Spoken:**
> "Forensic triage is only half the battle — security teams need operational response and court admissibility.
> 
> Here in our **MITRE ATT&CK tab**, every email observable is mapped to Enterprise Matrix techniques — from T1566 Spearphishing Attachment to T1071 AitM Credential Harvest. With one click, an investigator can export the official **MITRE ATT&CK Navigator v5.1 Layer JSON** for their SIEM.
> 
> If the analyst needs instant clarity, our embedded **AI Forensic Copilot** answers complex queries like *'Ye email fake hai ya real?'* in bilingual English/Hindi.
> 
> Furthermore, SUDO SPANDR doesn't just sit on a desktop: we built a live **Postfix Milter Gateway integration** (`/api/gateway-milter-check`). When malicious mail arrives at the mail server, our engine returns a native SMTP `550 5.7.1` rejection at the TCP socket layer before the victim's inbox ever rings."

---

## ⏱️ MINUTE 4 (3:00 - 4:00) — Indic Multilingual AI, DPDP Act PII Redaction & Blockchain Notary
**Speaker Action:** Load `05_hindi_electricity_phishing.eml`. Show the Indic Threat card, PII Redaction toggles, and Polygon Amoy verification.

> **Spoken:**
> "Finally, India's threat landscape is unique. Cybercriminals weaponize regional languages to scam citizens via electricity bill and fake lottery lures. 
> 
> SUDO SPANDR features a native **Indic Threat Engine** covering 8 Indian languages — Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, and Malayalam. 
> 
> Simultaneously, under the **Digital Personal Data Protection Act 2023**, forensic examiners cannot leak Aadhaar numbers, PAN cards, phone numbers, or UPI IDs. Our engine automatically detects and cryptographically masks PII using the Verhoeff and Luhn algorithms.
> 
> And to seal the chain of custody under Section 65B / BSA 2023, every case hash and Merkle root is notarized to the **Polygon Amoy Testnet (Chain ID 80002)** with verifiable block explorer links.
> 
> Thank you, judges. We are ready for your questions."
