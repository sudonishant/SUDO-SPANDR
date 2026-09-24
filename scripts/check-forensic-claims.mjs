import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const activeFiles = [
  // Frontend
  'src/App.jsx',
  'src/components/Dropzone.jsx',
  'src/store/useForensicStore.jsx',
  'src/lib/forensics.js',
  'index.html',
  // Python backend core
  'backend/app/main.py',
  'backend/app/core/category_engine.py',
  'backend/app/core/parser_engine.py',
  'backend/app/core/openrouter_client.py',
  'backend/app/core/threat_rules.py',
  'backend/app/core/auth_verifier.py',
  'backend/app/core/blockchain_ledger.py',
  'backend/app/core/geo_engine.py',
  'backend/app/core/indic_nlp_engine.py',
  'backend/app/core/mitre_engine.py',
  'backend/app/core/web_sandbox_engine.py',
  'backend/app/core/nlp_forensic_engine.py',
  'backend/app/static_index.py',
  // Serverless edge functions
  'api/v1/ai-review.js',
  'api/v1/ip-context.js',
  'api/v1/analyze-eml.js',
  'api/v1/analyze-batch.js',
  'api/v1/blockchain/verify.js',
  'api/v1/gateway-milter-check.js',
  'api/v1/health.js',
  'api/v1/mitre/navigator-layer.js',
  'api/v1/sandbox/detonate.js',
  'api/v1/sandbox/preview-frame.js',
  'api/v1/supabase/schema.js',
];
const forbidden = [
  'CatBERT-v3',
  'catbert',
  'Fuzzy Hash',
  'fuzzy_hash',
  'TLSH',
  'simulated_hash',
  'AI-Likeness',
  'VirusTotal',
  'STIX/TAXII',
  'YARA scan',
  'ipapi.co',
  'DOM similarity',
  'rsa-sha256 signature valid',
  'PASS (v=spf1',
  'exact geographical',
  'current user public IP',
  'ACTIVE & IMMUTABLE',
  'legal certificate valid',
  'suspicious-sender@',
  'victim@enterprise',
  'attacker@bad-actor',
  // Additional anti-fabrication markers
  'SEALED_ON_CHAIN',
  '0x88439F3eC7160330D1671E0a03e76d0eFC0fFEE1',
  'Section 65B(4) Certified',
  'APT-SPOOF-CZ',
  'BATCH_TRIAGE_COMPLETED',
];

let skipped = 0;
const violations = [];
for (const relativeFile of activeFiles) {
  const filePath = path.join(root, relativeFile);
  if (!fs.existsSync(filePath)) {
    skipped++;
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  for (const marker of forbidden) {
    if (content.toLowerCase().includes(marker.toLowerCase())) violations.push(`${relativeFile}: ${marker}`);
  }
}

if (violations.length) {
  console.error('Fabricated-claim lint failed:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`Forensic-claim lint passed for ${activeFiles.length - skipped} active source files (${skipped} skipped / not found).`);
