# 🎯 SUDO SPANDR — Top 25 Judge Q&A Defense Master Guide
### SIH 2026 Problem Statement #26106

---

### Q1: Why is your scoring system deterministic rather than a deep learning neural network?
**Answer:** In legal digital forensics, a probabilistic neural network is a black box that cannot be audited in a court of law under Section 65B of the Indian Evidence Act. If a machine learning model outputs 0.87, no expert witness can testify to the exact mathematical reason. SUDO SPANDR uses a transparent, deterministic heuristic rule ledger where every score adjustment maps 1:1 to an RFC defect, header anomaly, or security observable.

### Q2: What if the attacker forged the Received headers to fake the originating IP?
**Answer:** In the SMTP RFC 5321 standard, an attacker can only forge the Received headers they create on their own client machine. As soon as the message hits the first reputable receiving MTA (like Google Workspace, Office 365, or a corporate gateway), that MTA appends a cryptographic, untamperable `Received: from ... by ... with ...` header from its own TCP socket. Our parser reads hops chronologically and anchors to the first trusted receiver hop.

### Q3: How do you verify SPF, DKIM, and DMARC?
**Answer:** We implement both passive RFC header inspection and active DNS evaluation. For SPF, we evaluate RFC 7208 mechanisms (`ip4`, `include`, `redirect`) against the sender IP. For DKIM, we extract the selector, fetch the public key TXT record, decode the DER public key, and verify the RSA-SHA256 signature. For DMARC, we verify strict organizational domain alignment between the RFC 5322 `From` and RFC 5321 `Return-Path` or DKIM `d=` tag.

### Q4: Why does your DMARC display say "BEST EFFORT"?
**Answer:** Because many senders do not publish a strict `p=reject` policy in their public DNS, but rather `p=none` or have missing records. Rather than giving false reassurance or failing valid mail, SUDO SPANDR evaluates Return-Path domain alignment and cryptographic signature consistency to provide a best-effort forensic confidence indicator.

### Q5: How does your blockchain notarization work? Is it real or fake?
**Answer:** It is real. We anchor SHA-256 evidence digests and case metadata onto the Polygon Amoy Testnet (Chain ID 80002) via our Solidity smart contract (`contracts/EvidenceNotary.sol`). Each case generates a verifiable transaction hash viewable on `amoy.polygonscan.com`. If offline, a deterministic SHA-256 Merkle tree root provides instant cryptographic witness proof without external network latency.

### Q6: How does the Postfix Milter integration work?
**Answer:** SUDO SPANDR provides an RFC-compliant Milter endpoint (`/api/gateway-milter-check`) designed to bind to Postfix via `libmilter` or socket proxy. It evaluates incoming messages during the SMTP `DATA` phase and returns native Postfix macros: `Milter.REJECT` (`550 5.7.1`), `Milter.QUARANTINE`, or `Milter.ACCEPT`.

### Q7: What makes your Indic Multilingual NLP unique?
**Answer:** Most phishing scanners only support English. SUDO SPANDR supports 8 scheduled Indian languages: Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, and Malayalam. It specifically identifies regional coercion triggers such as electricity disconnection scams, fake lottery notifications, and bank KYC suspension threats.

### Q8: How do you ensure DPDP Act 2023 compliance?
**Answer:** Under Section 6 and Section 43A of the IT Act, forensic triage tools must not expose innocent individuals' personal data. We built an automated PII redactor that detects Aadhaar numbers (with Verhoeff checksum validation), PAN cards (structural syntax), mobile numbers, and UPI VPAs, masking them before forensic reports are generated or exported.

### Q9: Can this run completely offline if an air-gapped forensic lab has no internet?
**Answer:** Yes! SUDO SPANDR is built with full client-side forensic fallback. If DNS or external APIs are unreachable, the browser or local Python engine parses RFC 5322 headers, inspects attachment byte containers, evaluates heuristic scoring, and generates printable dossiers 100% offline.

### Q10: How do you handle password-protected or encrypted attachments?
**Answer:** Our static attachment carver computes Shannon entropy across byte chunks. High entropy (> 7.2) strongly indicates encryption or packed malware payloads. Even without detonating, the engine flags anomalous entropy, obfuscated macro signatures, and polyglot file format mismatches.

### Q11: How do you distinguish between legitimate bulk newsletters and phishing?
**Answer:** Legitimate marketing emails publish valid SPF/DKIM records, include `List-Unsubscribe` headers (RFC 2369), and originate from high-reputation ESP infrastructure (SendGrid, Mailchimp). Phishing emails frequently exhibit display-name mismatch, lookalike domain spoofing, and lack cryptographic alignment.

### Q12: How do you prevent False Positives?
**Answer:** We follow a zero-bias rule. No points are ever added based on originating country. Furthermore, negative adjustments are granted when legitimate sender authentication (SPF/DKIM/DMARC pass) aligns cleanly with the envelope sender.

### Q13: What is the processing throughput per email?
**Answer:** The deterministic engine parses and scores an average EML file in 15 to 45 milliseconds, making it suitable for line-rate SMTP gateway filtering handling thousands of messages per minute.

### Q14: How does this map to MITRE ATT&CK?
**Answer:** We correlate observables to 10 Enterprise Matrix techniques (e.g. T1566.001, T1566.002, T1036.005, T1071.001) and generate valid MITRE ATT&CK Navigator v5.1 layer JSON files that can be directly imported into MITRE ATT&CK Navigator.

### Q15: How does your graph topology help investigators?
**Answer:** The Neo4j Cypher and interactive visual graph correlate claimed sender identity, originating IP, intermediate relay hops, embedded URLs, attachments, and campaign clusters into an intuitive attribution graph.

### Q16: What is Section 65B of the Indian Evidence Act?
**Answer:** Section 65B (and Section 63 of Bharatiya Sakshya Adhiniyam 2023) mandates that electronic evidence is admissible in court only if accompanied by a certificate stating the integrity, uncorrupted transmission, and cryptographic hash of the digital source material. SUDO SPANDR automatically formats a compliant digital custody certificate.

### Q17: Can an attacker bypass your URL detection using redirects or URL shorteners?
**Answer:** Our URL inspector unrolls redirects and inspects domain age, brand impersonation tokens, and homoglyph/punycode attacks (IDN homograph attacks). High-risk URLs can also be detonated in our isolated Chromium sandbox.

### Q18: What is Adversary-in-the-Middle (AitM) phishing?
**Answer:** AitM attackers use reverse proxies (like Evilginx) to proxy communication between victim and real service, harvesting session cookies and bypassing standard MFA. SUDO SPANDR identifies AitM indicators including intermediate domain proxying and token-harvesting lures.

### Q19: What database do you use for persistent storage?
**Answer:** SUDO SPANDR supports hybrid storage: Neo4j for identity and campaign correlation graphs, Supabase / PostgreSQL for indexed forensic case dossiers, and an in-memory fallback for air-gapped offline use.

### Q20: What is the Verhoeff algorithm?
**Answer:** The Verhoeff algorithm is a dihedral group D5 checksum algorithm used by UIDAI for Indian Aadhaar numbers. It detects all single-digit errors and all transposition errors between adjacent digits, ensuring we only redact genuine 12-digit Aadhaar identifiers.

### Q21: How do you handle batch email ingestion for large enterprise breaches?
**Answer:** Our `/api/v1/analyze-batch` endpoint clusters thousands of emails by campaign domain, subject templates, ASN subnet, and attachment hashes, identifying targeted multi-recipient spearphishing campaigns in seconds.

### Q22: What happens if an email contains multiple nested attachments?
**Answer:** The attachment carver recursively unpacks containers (ZIP, ISO, nested MIME parts) up to configurable depth limits, inspecting inner files for executable headers, macros, and hidden scripts.

### Q23: Is this tool cloud-dependent?
**Answer:** No. It is 100% cloud-agnostic. It runs seamlessly on local Linux/Windows workstations, air-gapped Docker containers, on-premise Postfix mail servers, or cloud edge environments like Vercel.

### Q24: What is the difference between Return-Path and From?
**Answer:** `From:` (RFC 5322) is what the user sees in their email client display. `Return-Path:` (RFC 5321 Envelope From) is where bounce messages are routed. Adversaries frequently spoof the display `From:` while the `Return-Path` points to a compromised account or anonymous relay.

### Q25: Why should our organization or the jury select SUDO SPANDR as #1?
**Answer:** SUDO SPANDR is the only solution in this competition that delivers: (1) 100% RFC-grounded deterministic truth, (2) native 8-language Indic threat intelligence, (3) real DPDP Act 2023 privacy compliance, (4) direct Postfix Milter gateway enforcement, and (5) legally admissible Section 65B blockchain certification on Polygon Amoy.
