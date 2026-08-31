import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const activeFiles = [
  'src/App.jsx',
  'src/components/Dropzone.jsx',
  'src/store/useForensicStore.jsx',
  'src/lib/forensics.js',
  'backend/app/main.py',
  'backend/app/core/category_engine.py',
  'backend/app/core/parser_engine.py',
  'backend/app/core/openrouter_client.py',
  'backend/app/core/threat_rules.py',
  'api/v1/ai-review.js',
  'api/v1/ip-context.js',
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
];

const violations = [];
for (const relativeFile of activeFiles) {
  const filePath = path.join(root, relativeFile);
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

console.log(`Forensic-claim lint passed for ${activeFiles.length} active source files.`);
