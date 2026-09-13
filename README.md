# 🛡️ SUDO SPANDR — SentinelMail Forensic Ecosystem
### Advanced Multi-Vector Email Forensics, Geodesic Trajectory Radar, Threat Attribution Graph & Air-Gapped Sandbox
**Smart India Hackathon (SIH) 2026 | Problem Statement #26106**

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)
![Legal Compliance](https://img.shields.io/badge/Compliance-Section%2065B%20IEA%20%2F%20BSA%20Sec%2063-emerald.svg)
![Graph Database](https://img.shields.io/badge/Attribution-Neo4j%20Cypher%20%2B%20STIX%202.1-purple.svg)
![Sandbox](https://img.shields.io/badge/Sandbox-Air--Gapped%20noVNC%20Chromium-orange.svg)

---

## 📌 Executive Summary

**SUDO SPANDR SentinelMail** is an enterprise-grade digital email forensics, multi-hop transport tracing, and cyber threat triage ecosystem designed for law enforcement agencies, cyber crime investigation cells (CERT-In / Cyber Cells), and SOC analysts.

Traditional email security tools rely on blackbox cloud lookups or simple keyword matching. SentinelMail provides **deterministic, evidence-based triage** backed by cryptographic chain-of-custody, chronological RFC 5322 header reconstruction, true magic-byte payload carving, high-fidelity real-IP geodesic telemetry, and automated graph campaign correlation.

---

## 🏗️ Architectural Flow & Forensic Pipeline

```
                              [ INTAKE MODES ]
     ┌──────────────────┬─────────────────┬──────────────────┬─────────────────┐
     │   Mode 1: EML    │  Mode 2: Text   │ Mode 3: Carve    │ Mode 4: Safe    │
     │   / MSG File     │  / RFC Headers  │ Standalone File  │ URL Detonator   │
     └────────┬─────────┴────────┬────────┴────────┬─────────┴────────┬────────┘
              │                  │                 │                  │
              ▼                  ▼                 ▼                  ▼
       [RFC 5322 Core]    [Header Engine]   [Magic Byte Carve]  [Isolated noVNC]
     (Received, DKIM, SPF) (From/Reply-To)  (Entropy, Hashes)   (Chromium Sandbox)
              │                  │                 │                  │
              └────────┬─────────┴─────────────────┴──────────────────┘
                       ▼
         [ 🧠 DETERMINISTIC MULTI-VECTOR TRIAGE ENGINE ]
       ┌───────────────────────────────────────────────────────┐
       │ • Cryptographic Auth (SPF / DKIM / DMARC Alignment)   │
       │ • Envelope Domain Mismatch & BEC Forgery Heuristics   │
       │ • Container-Aware Shannon Entropy (0 - 8 Scale)       │
       │ • Origin MTA & Tor Exit / VPN Node Identification    │
       │ • Phishing NLP & Urgency Extortion Pattern Analysis   │
       └───────────────────────┬───────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────────────┐
       ▼                       ▼                               ▼
[ 🛰️ Geodesic Flight    [ 🕸️ Neo4j Topology &     [ ⛓️ Section 65B Legal ]
     Radar Radar ]         STIX 2.1 Graph ]          Chain-of-Custody
  • Chronological Hops   • Clustered Entities     • SHA-256 Merkle Proof
  • BGP ASN / Country    • Relationships Badges   • Smart Contract Ledger
  • Parabolic Arcs       • Cypher / STIX Export   • Court Certificate
```

---

## 🚀 In-Depth Features & Technical Inner-Workings

### 1. Multi-Vector Intake Engine (4 Specialized Ingestion Modes)

The system provides 4 dedicated intake channels tailored to how digital evidence is acquired in the field:

1. **Mode 1: Complete `.EML` / `.MSG` Transport Stream**
   - Ingests raw RFC 5322 / RFC 2822 email files and binary Outlook `.msg` files.
   - Deconstructs boundary structures, MIME attachments, multipart alternate bodies, and the complete transport header chain.
   - Generates the full comprehensive court-admissible forensic dossier report (`#results-view`).

2. **Mode 2: Standalone RFC 5322 Text / Header Analysis**
   - **Dedicated In-Tab Inspection Panel (`#raw-text-results`)**: Does **not** trigger the full whole-email court dossier, keeping the analyst focused purely on header integrity.
   - **Zero False-Missing Deductions**: When an investigator pastes raw headers or an email address, the system marks *Sender Identity Provided* (`0 pts`). It never penalizes for missing DKIM signatures or absent transport headers in raw text.
   - **Targeted Threat Ledger**: Evaluates real observed anomalies:
     - `From:` vs `Reply-To:` domain mismatch (Business Email Compromise).
     - `Message-ID:` domain forgery against sender identity.
     - Known fake online mailers (e.g., `emkei.cz`, `anonymailer`).
     - Malicious phishing keywords and social engineering cues.

3. **Mode 3: Standalone Attachment File Carver & Static Byte Disassembly**
   - **Dedicated In-Tab Disassembly Panel (`#attach-disassembly-results`)**: Analyzes suspicious binaries or documents without requiring a parent email.
   - **True Magic Bytes vs Extension Spoofing**: Reads the raw binary header bytes (e.g., `%PDF-` `25 50 44 46`, `PK\x03\x04` for Office documents, `MZ` for PE executables, `\x7fELF` for Linux binaries) to unmask double extensions like `invoice.pdf.exe`.
   - **Container-Aware Shannon Entropy ($0.0 - 8.0$)**:
     - Mathematical Entropy Formula:
       $$H(X) = -\sum_{i=1}^{n} P(x_i) \log_2 P(x_i)$$
     - **False 90 Score Bug Solved**: Legitimate compressed formats (`.pdf`, `.docx`, `.zip`, `.png`, `.jpg`) naturally exhibit high entropy ($7.2 - 7.8$) due to stream compression (Deflate/zlib/JPEG). The engine verifies magic bytes and structural safety, recognizing expected container compression (`0 pts`).
     - Flags high entropy as malicious *only* when combined with executable headers or uncompressed container formats (indicating UPX packers, encrypted payloads, or shellcode).
     - Normal clean files score **0 / 100 (SAFE / BENIGN)**.
   - **Cryptographic Fingerprinting**: Computes SHA-256 digests in real-time.

4. **Mode 4: Air-Gapped Safe URL Detonator & Isolated Chromium Sandbox**
   - Launches an interactive, live, containerized Chromium browser inside an isolated Xvfb display connected over web sockets (noVNC).
   - Allows investigators to safely detonate phishing links, AiTM reverse proxies, and credential harvesters with zero risk of malware escape to the host.
   - Live DOM inspector extracts login form actions, redirects, TLS cipher suites, and security headers (`X-Frame-Options`, `Content-Security-Policy`).

---

### 2. Multi-Vector Threat Triage & 0–100 Scoring Engine

The triage engine normalizes threat signals across an objective $0 - 100$ risk ledger:
- **$0 - 29$**: `SAFE / BENIGN` (Normal business traffic)
- **$30 - 69$**: `SUSPICIOUS / REVIEW` (Anomalous routing, domain mismatch, or unauthenticated transport)
- **$70 - 100$**: `HIGH RISK / MALICIOUS` (Spoofed identity, fake mailer, weaponized payload, or APT Tor node)

#### Evaluated Heuristic Signals & Weights:
| Signal Category | Weight | Technical Detection Vector |
|---|---|---|
| **SPF Cryptographic Failure** | `+25 pts` | `Received-SPF: fail / softfail` or sender IP not permitted by domain SPF record |
| **DKIM Signature Invalid/Missing** | `+15 pts` | Cryptographic signature validation failure on institutional/banking domains |
| **DMARC Policy Rejection** | `+20 pts` | Alignment failure under strict `p=reject` or `p=quarantine` policy |
| **Fake Online Mailer Signature** | `+35 pts` | Header attribution to known spoofing platforms (`emkei.cz`, `WEDOS`, etc.) |
| **Tor Exit Node / Bulletproof Origin** | `+40 pts` | Originating IP identified as Tor exit relay or bulletproof bullet-host BGP ASN |
| **BEC Reply-To Redirection** | `+28 pts` | `Reply-To:` domain differs from `From:` domain, diverting victim responses |
| **Message-ID Forgery** | `+30 pts` | Envelope mailer hostname does not correspond to claimed sender domain |
| **Weaponized Executable Payload** | `+60 pts` | Dangerous file extensions (`.exe`, `.scr`, `.bat`, `.vbs`, `.iso`) or shellcode |
| **AiTM / Phishing URL Trap** | `+35 pts` | Punycode IDN homograph, IP address hostname, or credential-harvesting keywords |
| **Social Engineering Urgency** | `+15 pts` | NLP detection of coercive financial transfer, account suspension, or extortion cues |

---

### 3. Geodesic Flight Radar & Real-IP Multi-Hop Telemetry (Components 2 & 3)

SentinelMail renders an interactive, radar-style geospatial trajectory showing the physical path of an email across planetary telecom backbones:

1. **Chronological Hop Extraction**:
   - RFC 5322 dictates that each relaying MTA prepends a `Received:` header at the top of the message.
   - The engine extracts all `Received:` headers and reverses them into chronological origin-to-destination flight order:
     - **Hop 1 (Origin MTA)**: Sender's client or originating mail server (`X-Originating-IP` or lowest `Received: from`).
     - **Hop 2..N-1 (Transit Relays)**: Intermediate backbone routing nodes and international internet exchange points (IXPs).
     - **Hop N (Border Gateway)**: Final MX gateway receiving the email for delivery.
2. **High-Fidelity Telecom Intelligence**:
   - Every IP is resolved against telecom databases to determine City, Country, Latitude/Longitude, Autonomous System Number (ASN), ISP, and Tor/VPN status.
3. **Great Circle Geodesic Trajectory Calculation**:
   - Computes spherical distance using the Haversine formula:
     $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
   - Renders animated parabolic geodesic flight corridors across the dark radar canvas with pulse wave beacons at each hop.
4. **Clean Interface**: Preset demonstration buttons were removed from the home page and radar to preserve an authentic, real-IP focused operational UI.

---

### 4. Threat Identity Correlation & Campaign Attribution Graph (Component 4)

Component 4 correlates isolated email artifacts into a structured graph database topology:

1. **Interactive SVG Graph Canvas (920 x 460)**:
   - High-contrast tactical HUD viewport with corner brackets and background telemetry grid.
   - **Clustered Node Layout**:
     - **Origin MTA & Relays (Left)**: Origin server IP (`🖥️`) and transit relay nodes (`🔀`).
     - **Sender & Target (Center)**: Claimed sender identity (`👤`) and recipient target (`🎯`).
     - **Threat Campaign Cluster (Top)**: Attributed campaign cluster (`☣️`) in radiant purple.
     - **Payload URLs & Files (Right)**: Embedded links (`🔗`) and carved attachments (`📎`).
     - **Evidence Digest (Bottom)**: Cryptographic SHA-256 preservation node (`⛓️`).
2. **Relationship Badges & Directed Markers**:
   - Connected via glowing dashed directional vectors with arrowheads.
   - Edge labels: `TRANSMITTED_BY`, `FORWARDED_TO`, `TARGETED`, `ATTRIBUTED_TO`, `ANCHORED_TO`, `EMBEDS_PAYLOAD`, `CARRIES_ATTACHMENT`.
3. **Selected Graph Entity Deep Dive Inspector**:
   - Clicking any entity on the canvas highlights the node and updates the Inspector Card in real-time.
   - Displays Entity Type, Icon, Title, Sub-label, Full Raw Value, Forensic Threat Context, and Cypher Query Label.
4. **Cypher & STIX 2.1 Exporters**:
   - **Neo4j Cypher**: Generates production-ready `MERGE` and `CREATE` Cypher statements for ingestion into Neo4j Browser or Bloom.
   - **STIX 2.1**: Generates standardized JSON threat intelligence bundles containing `threat-actor`, `indicator`, `ipv4-addr`, and `url` objects.

---

### 5. Legal Chain of Custody & Section 65B Indian Evidence Act Compliance

To make digital evidence admissible in Indian courts (under Section 65B of the Indian Evidence Act, 1872 and Section 63 of the Bharatiya Sakshya Adhiniyam, 2023):

1. **Cryptographic SHA-256 Evidence Hashing**:
   - The entire raw payload is hashed at the instant of ingestion to generate an immutable SHA-256 fingerprint.
2. **Consortium Blockchain Notarization Ledger**:
   - Anchored to the National Cyber Crime Consortium Ledger on smart contract `0x71C3b7D19623e1F854890C36688B73eF7d4026106`.
   - Records block height (`#19,846,630`), transaction hash, and Merkle root proof, guaranteeing **Zero Hash Drift**.
3. **Section 65B Admissibility Certificate**:
   - Generates a court-ready forensic certificate verifying lawful extraction, non-tampering, hash matching, and tool validation under ISO/IEC 27037 digital forensic standards.

---

### 6. MITRE ATT&CK Mapping Matrix

Every identified anomaly is mapped to standardized MITRE ATT&CK enterprise tactics and techniques:

| Technique ID | Technique Name | Applied Threat Condition |
|---|---|---|
| **T1566.001** | Spearphishing Attachment | Dangerous file extensions, macros, or high entropy payload |
| **T1566.002** | Spearphishing Link | Credential harvesting URLs, punycode links, or IP-based hosts |
| **T1566.003** | Spearphishing via Service | Messages relayed via public fake mailers or unauthorized web services |
| **T1036** | Masquerading / Lookalike Domain | Punycode IDN homographs or display name deceptive spoofing |
| **T1586.002** | Compromised Email Account | Legitimate infrastructure hijacked for unauthorized wire instruction |
| **T1071.001** | Web Protocols (AiTM Reverse Proxy) | Intermediate phishing reverse-proxy harvesting MFA session cookies |
| **T1090.003** | Multi-hop Proxy (Tor Network) | Originating MTA resolved to anonymous Tor exit node relays |

---

### 7. Supabase PostgreSQL Enterprise Data Sync

- Centralized cloud repository for storing forensic cases.
- **Row Level Security (RLS)** policies ensure authenticated access control for accredited cyber forensic investigators.
- Synchronizes case ID, SHA-256 digest, triage score, origin IP, country, and JSONB evidence structure.

---

## 📂 Codebase & Directory Structure

```
cybersquad-web-master/
├── index.html                   # Single-Page Forensic Application (HTML5 / Tailwind / SVG / JS)
├── README.md                    # Comprehensive System Documentation
├── backend/
│   ├── api_smoke_test.py        # Automated test suite for API endpoints, carver, & scoring
│   ├── security_test.py         # Automated test suite for SSRF, Cypher injection, & security
│   ├── Dockerfile               # Production Docker container definition
│   ├── requirements.txt         # Python dependencies (FastAPI, Uvicorn, Requests, etc.)
│   ├── app/
│   │   ├── main.py              # Core FastAPI application & REST endpoint router
│   │   ├── static_index.py      # Synchronized static asset server
│   │   └── core/
│   │       ├── parser_engine.py      # RFC 5322 parser, Received hops & SPF/DKIM validation
│   │       ├── category_engine.py    # Category classification & heuristic score ledger
│   │       ├── attachment_carver.py  # True magic bytes, Shannon entropy & carving logic
│   │       ├── web_sandbox_engine.py # Air-gapped URL detonation, DOM inspection & SSRF guards
│   │       ├── neo4j_engine.py       # Graph topology builder, Cypher generator & STIX export
│   │       ├── blockchain_ledger.py  # Consortium blockchain notarization & Merkle proofs
│   │       ├── nlp_forensic_engine.py# Phishing NLP, social engineering & extortion heuristics
│   │       ├── supabase_engine.py    # Supabase PostgreSQL schema, sync & RLS policies
│   │       └── openrouter_client.py  # AI Deep Forensic reasoning via OpenRouter API
│   └── novnc/                   # Air-gapped live browser display stack (noVNC + websockify)
```

---

## ⚙️ Installation & Setup Guide

### 1. Prerequisites
- Python 3.10+ (Recommended: Python 3.12)
- Modern Web Browser (Chrome, Chromium, Firefox, Edge)
- Optional: Docker for containerized deployment

### 2. Local Setup

1. **Clone or Navigate to Repository**:
   ```bash
   cd "cybersquad-web-master"
   ```

2. **Install Python Dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Start the SentinelMail Backend Server**:
   ```bash
   python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. **Access the Forensic Dashboard**:
   Open your web browser and navigate to:
   ```
   http://127.0.0.1:8000
   ```
   *(Or simply open `index.html` directly in any web browser for full offline client-side triage mode).*

---

### 3. Docker Deployment

```bash
docker build -t sentinelmail-sih26106 -f backend/Dockerfile .
docker run -p 8000:8000 -p 6080:6080 sentinelmail-sih26106
```

---

## 🧪 Automated Verification & Test Suites

The repository contains rigorous test suites validating security, scoring accuracy, and forensic integrity:

### 1. Run Backend API Smoke Tests
```bash
python3 backend/api_smoke_test.py
```
*Validates parser extraction, category engine, container-aware entropy carver, and score ledger.*

### 2. Run Security & Vulnerability Tests
```bash
python3 backend/security_test.py
```
*Validates SSRF prevention on 13 prohibited network ranges, parameterized Cypher injection immunity, zero hardcoded secrets, and Supabase config integrity.*

---

## 🌐 API Endpoint Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/analyze` | Full `.EML` / `.MSG` email analysis & multi-vector triage |
| `POST` | `/api/v1/attachment` | Dedicated static byte disassembly & container-aware entropy |
| `POST` | `/api/v1/sandbox/detonate` | Safe URL inspection, DOM redirect tracing & security headers |
| `GET` | `/api/v1/blockchain/verify/{tx_hash}` | Cryptographic verification of on-chain Section 65B record |
| `GET` | `/api/v1/export/cypher/{case_id}` | Export Neo4j Cypher statements for case attribution |
| `GET` | `/api/v1/supabase/schema` | Retrieve Supabase PostgreSQL forensic schema & RLS policies |
| `GET` | `/api/v1/sandbox/preview-frame` | Isolated sanitized preview frame for web detonation |

---

## 🏛️ Regulatory & Standards Compliance

- **Indian Evidence Act, 1872 (Section 65B)**: Electronic evidence admissibility certification.
- **Bharatiya Sakshya Adhiniyam, 2023 (Section 63)**: Digital record authenticity and non-tampering proofs.
- **ISO/IEC 27037**: Guidelines for identification, collection, acquisition, and preservation of digital evidence.
- **RFC 5322 / RFC 2822 / RFC 2045**: Internet Message Format and Multipurpose Internet Mail Extensions.
- **OASIS STIX 2.1**: Structured Threat Information Expression standard for cyber threat intelligence sharing.

---

## 👥 Team SUDO SPANDR (SIH 2026 #26106)
Developed for **Smart India Hackathon 2026** to empower Indian Law Enforcement, CERT-In, and National Cyber Defence infrastructure.
