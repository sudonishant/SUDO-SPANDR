# ⚡ SUDO SPANDR — 30-Second Elevator Answers

- **Why deterministic instead of ML?**
  *"Courts require explainable evidence under Section 65B, not black-box neural probabilities. Every point in SUDO SPANDR maps to an auditable RFC defect."*

- **How do you handle spoofed Received headers?**
  *"Attackers can only forge their own hops. The first reputable enterprise MTA appends an immutable TCP-authenticated Received header that anchors our hop reconstruction."*

- **Why does DMARC say 'BEST EFFORT'?**
  *"Because the sender's DNS had no strict `p=reject` published. Rather than guessing, we evaluate Return-Path alignment and DKIM signatures to provide honest triage."*

- **Is the blockchain real?**
  *"Yes, anchored to Polygon Amoy Testnet (Chain ID 80002) via `contracts/EvidenceNotary.sol` with live explorer verification on Polygonscan."*

- **How does it stop emails before the user sees them?**
  *"Through our native Postfix Milter daemon (`/api/gateway-milter-check`), which rejects hostile messages with an SMTP 550 5.7.1 code at the gateway socket."*

- **What is your regional differentiator?**
  *"8 Indian languages threat detection (Hindi, Bengali, Tamil, etc.) + automatic DPDP Act 2023 Aadhaar, PAN, and UPI redaction."*
