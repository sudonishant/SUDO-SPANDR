import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { File } from 'node:buffer';
import test, { after } from 'node:test';
import { build } from 'esbuild';
import ipContextHandler, { isPublicIp } from '../api/v1/ip-context.js';
import analyzeEmlHandler from '../api/v1/analyze-eml.js';
import { buildDossierModel } from '../src/lib/dossierModel.js';
import { buildGovReport } from '../src/lib/reportGov.js';
import { buildEvidenceGraphProjection } from '../src/lib/evidenceGraph.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const root = fileURLToPath(new URL('../', import.meta.url));
const buildDir = path.join(root, 'node_modules', '.cache', 'spandr-email-forensics-test');
const outfile = path.join(buildDir, 'forensics.mjs');
await fs.mkdir(buildDir, { recursive: true });
await build({
  entryPoints: [path.join(root, 'src/lib/forensics.js')],
  outfile,
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'silent',
});
const {
  buildEmailAnalysis,
  normalizeMsgData,
  parseEmlFile,
  parseMsgFile,
} = await import(`${pathToFileURL(outfile).href}?test=${Date.now()}`);
after(() => fs.rm(buildDir, { recursive: true, force: true }));

const cache = new Map();
async function analyzeFile(relativePath) {
  if (!cache.has(relativePath)) {
    cache.set(relativePath, (async () => {
      const absolute = path.join(root, relativePath);
      const bytes = await fs.readFile(absolute);
      const file = new File([bytes], path.basename(relativePath));
      const parsed = relativePath.endsWith('.msg') ? await parseMsgFile(file) : await parseEmlFile(file);
      return buildEmailAnalysis(parsed);
    })());
  }
  return cache.get(relativePath);
}

test('reported SPF/DKIM/DMARC passes do not erase a decoded payment request', async () => {
  const report = await analyzeFile('tests/fixtures/authenticated-payment.eml');
  assert.ok(report.threat.risk_score >= 50, `Expected substantive triage score, got ${report.threat.risk_score}`);
  assert.ok(['spf', 'dkim', 'dmarc'].every((key) => /PASS/.test(report.dns_auth[key])));
  assert.equal(report.deep_email.identity.return_path_alignment.aligned, true);
  assert.match(report.dns_auth.raw_reported, /DKIM-Signature:/i);
  assert.ok(report.threat.score_breakdown.positive_total > 0);
  assert.ok(report.threat.score_breakdown.deductions.every((item) => item.points >= 0));
  assert.match(report.deep_email.score_policy, /never erase/i);
});

test('base64 HTML-only EML exposes content and actual link destination', async () => {
  const report = await analyzeFile('tests/fixtures/base64-html-only.eml');
  assert.equal(report.deep_email.message_structure.html_present, true);
  assert.equal(report.deep_email.message_structure.plain_text_present, false);
  assert.match(report.parsed.body, /session expired/i);
  assert.ok(report.aitm_analysis.some((item) => item.url === 'https://login-secure.attacker.test/account'));
  assert.ok(report.threat.risk_score >= 40, `HTML-only lure was suppressed to ${report.threat.risk_score}`);
});

test('nested MIME decodes encoded subject, plain/HTML parts, mismatch and attachment', async () => {
  const report = await analyzeFile('tests/fixtures/nested-mime.eml');
  assert.equal(report.parsed.subject, 'Payment required');
  assert.match(report.parsed.body, /Urgent invoice payment required/);
  assert.equal(report.attachment_analysis.length, 1);
  assert.equal(report.attachment_analysis[0].filename, 'invoice.pdf');
  assert.match(report.attachment_analysis[0].sha256, /^[a-f0-9]{64}$/);
  assert.ok(report.aitm_analysis.some((item) => item.url === 'https://pay.attacker.test/login'));
  assert.ok(report.content_findings.some((item) => item.id === 'link-text-mismatch'));
  assert.equal(report.relay_info.hop_count, 2);
});

test('ordinary URL query bytes are not blindly quoted-printable decoded', async () => {
  const report = await analyzeFile('public/samples/sample-credential.eml');
  assert.ok(report.aitm_analysis.some((item) => item.url === 'http://microsft-account-verify.com/login?session=ae91&id=8842'));
});

test('SPF softfail produces one explainable adjustment instead of a zero score', async () => {
  const report = await analyzeFile('tests/fixtures/spf-softfail.eml');
  assert.equal(report.threat.risk_score, 16);
  assert.equal(report.threat.baseline_score, 0);
  assert.equal(report.threat.adjustments.length, 1);
  assert.equal(report.threat.score_breakdown.adjustment_total, 16);
  assert.equal(report.threat.authentication_context.any_fail, false);
  assert.equal(report.threat.authentication_context.spf_softfail, true);
  assert.equal(report.threat.authentication_context.spf_softfail_count, 3);
  assert.equal(report.category_analysis.category_id, 'unknown');
  assert.equal(report.category_analysis.alert_level, 'review');
  assert.match(report.dns_auth.spf, /SOFTFAIL/);
  assert.match(report.threat.adjustments[0].label, /SPF softfail/);
  assert.match(report.threat.adjustments[0].evidence, /not proof of spoofing/i);
  assert.match(report.deep_email.top_findings[0].label, /SPF softfail/);
  assert.ok(report.deep_email.explanations.some((item) => /weaker than SPF fail/i.test(item)));
  const model = buildDossierModel(report);
  assert.ok(model.findings.some((item) => /SPF softfail/i.test(item.label) && item.weight === 16));
});

test('Neo4j payload preserves reported-auth and IP evidence without raw message content', async () => {
  const report = await analyzeFile('tests/fixtures/spf-softfail.eml');
  const projection = buildEvidenceGraphProjection(report);
  assert.equal(projection.case_id, report.case_id);
  assert.equal(projection.evidence_sha256, report.evidence.sha256);
  assert.equal(projection.triage_score, 16);
  assert.equal(projection.reported_auth.length, 3);
  assert.ok(projection.reported_auth.every((item) => item.method === 'spf' && item.result === 'softfail'));
  assert.ok(!('body' in projection) && !('headers' in projection) && !('raw_eml' in projection) && !('subject' in projection));
  assert.ok(!JSON.stringify(projection).includes(report.parsed.body));
  assert.ok(projection.ips.length > 0);
  assert.ok(projection.reported_auth.every((item) => !('evidence' in item) && !('properties' in item)));
});

test('Neo4j URL sanitization removes secrets while analysis retains original evidence', async () => {
  const report = await analyzeFile('public/samples/sample-credential.eml');
  const projection = buildEvidenceGraphProjection(report);
  assert.ok(report.aitm_analysis.some((item) => item.url.includes('session=ae91')));
  assert.ok(projection.urls.length > 0);
  assert.ok(projection.urls.every((item) => !item.url.includes('?') && !item.url.includes('#') && !item.url.includes('session=ae91')));
  assert.ok(projection.urls.every((item) => !item.url.includes('@')));
  assert.ok(projection.attachments.every((item) => !('content' in item) && !('bytes' in item)));
});

test('safe EML control remains low-signal rather than being inflated', async () => {
  const report = await analyzeFile('public/samples/sample-safe.eml');
  assert.equal(report.parseError, null);
  assert.ok(report.threat.risk_score <= 10, `Safe control scored ${report.threat.risk_score}`);
});

test('shipped binary MSG files parse through the real MSG reader', async () => {
  const safe = await analyzeFile('public/samples/sample-safe.msg');
  const phishing = await analyzeFile('public/samples/sample-phishing.msg');
  assert.equal(safe.parseError, null);
  assert.equal(phishing.parseError, null);
  assert.ok(safe.parsed.headerEntries.length > 0);
  assert.ok(phishing.parsed.headerEntries.length > 0);
  assert.ok(safe.parsed.body.length > 50);
  assert.ok(phishing.threat.risk_score >= 60);
});

test('MSG HTML-only normalization works without inventing transport headers', async () => {
  const info = {
    senderEmail: 'security@company.example',
    senderName: 'Account Security',
    recipients: [{ email: 'user@company.example' }],
    subject: 'Session expired',
    body: '',
    bodyHtml: '<html><body><p>Verify your account and password immediately.</p><a href="https://login-secure.attacker.test/msg">https://company.example/account</a></body></html>',
    headers: '',
    attachments: [],
  };
  const parsed = normalizeMsgData(info, {
    filename: 'html-only.msg',
    containerReport: { sha256: 'a'.repeat(64) },
    rawBytes: new Uint8Array([1, 2, 3]),
  });
  const report = await buildEmailAnalysis(parsed);
  assert.equal(report.deep_email.message_structure.html_present, true);
  assert.equal(report.deep_email.message_structure.plain_text_present, false);
  assert.equal(report.deep_email.message_structure.transport_headers_present, false);
  assert.equal(report.parsed.headerEntries.length, 0);
  assert.ok(report.aitm_analysis.some((item) => item.url === 'https://login-secure.attacker.test/msg'));
  assert.ok(report.content_findings.some((item) => item.id === 'link-text-mismatch'));
  assert.ok(report.threat.risk_score > 0);
  assert.match(report.dns_auth.note, /not independent|not.*verified|reported/i);
});

test('SPF HELO-only pass is not misrepresented as DMARC MAIL FROM alignment', async () => {
  const authenticationResults = 'mx.company.example; spf=pass smtp.helo=company.example';
  const report = await buildEmailAnalysis({
    sourceMode: 'eml', filename: 'helo-only.eml', sender: 'cfo@company.example', recipient: 'user@company.example',
    subject: 'Routine notice', body: 'Routine notice', fromName: 'Finance', replyTo: '',
    headers: { from: 'cfo@company.example', 'authentication-results': authenticationResults },
    headerEntries: [{ name: 'From', value: 'cfo@company.example' }, { name: 'Authentication-Results', value: authenticationResults }],
    urls: [], attachments: [], rawHash: 'b'.repeat(64), rawBytes: new Uint8Array([1]),
  });
  const spf = report.dns_auth.alignment.rows.find((row) => row.method === 'SPF');
  assert.equal(spf.aligned, null);
  assert.match(spf.identity_role, /not DMARC alignment/i);
  assert.equal(report.dns_auth.alignment.spf_aligned_pass, false);
  assert.equal(report.dns_auth.alignment.visible_from_reported_validated, false);
  assert.equal(report.dns_auth.alignment.passes_without_visible_from_alignment, true);
});

test('formal dossier and standalone HTML retain deep-email evidence layers', async () => {
  const report = await analyzeFile('tests/fixtures/nested-mime.eml');
  const model = buildDossierModel(report);
  assert.ok(model.authentication.alignment.rows.length > 0);
  assert.equal(model.authentication.structure.html_present, true);
  assert.ok(model.authentication.explanations.length > 0);
  const html = buildGovReport({ analysis: report });
  assert.match(html, /Message identity and decoding coverage/);
  assert.match(html, /Reported identity alignment/);
  assert.match(html, /PostalMime/);
  assert.match(html, /payments@supplier\.example/);
  assert.match(html, /Authentication passes and message-category labels never erase/);
});

test('IPv4 and IPv6 public-IP boundary rejects reserved and expanded bypass forms', () => {
  const rejected = [
    '', 'not-an-ip', '0.0.0.0', '10.0.0.1', '127.0.0.1', '169.254.1.1',
    '172.16.0.1', '192.168.1.1', '100.64.0.1', '192.0.2.1', '198.51.100.1',
    '203.0.113.1', '224.0.0.1', '::', '::1', '0:0:0:0:0:0:0:1',
    '::ffff:8.8.8.8', '0:0:0:0:0:ffff:808:808', 'fc00::1', 'fd12::1',
    'fe80::1', 'fec0::1', 'ff02::1', '2001:db8::1',
    '2001:0db8:0000:0000:0000:0000:0000:0001', '3fff::1', '2001:2::1',
    '2001:10::1', '100::1', '64:ff9b::808:808', '5f00::1',
  ];
  rejected.forEach((ip) => assert.equal(isPublicIp(ip), false, `Should reject ${ip || '<empty>'}`));
  ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4860::8888'].forEach((ip) => assert.equal(isPublicIp(ip), true, `Should accept ${ip}`));
});

test('received-header extraction retains IPv6 evidence without splitting mapped IPv4', async () => {
  const report = await analyzeFile('tests/fixtures/reserved-ip.eml');
  const ips = report.relay_info.ips.map((item) => item.ip);
  assert.ok(ips.includes('2606:4700:4700::1111'));
  assert.ok(ips.includes('2001:db8::1'));
  assert.ok(ips.includes('10.20.30.40'));
  assert.ok(ips.includes('::ffff:8.8.8.8'));
  assert.ok(!ips.includes('8.8.8.8'), 'Mapped IPv6 dotted tail must not become a standalone IPv4 observation');
  assert.equal(report.relay_info.hop_count, 4);
});

test('reserved-only API input returns before any provider egress', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; throw new Error('Unexpected provider request'); };
  const response = {
    statusCode: 200,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; },
  };
  try {
    await ipContextHandler({ method: 'POST', body: JSON.stringify({ ips: ['10.0.0.1', '::1', '0:0:0:0:0:ffff:808:808', '2001:db8::1'] }) }, response);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalled, false);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.status, 'no_public_ips');
  assert.deepEqual(response.payload.results, []);
});

test('existing analysis proxy forwards graph metadata without adding Neo4j credentials', async () => {
  const originalFetch = globalThis.fetch;
  const originalBackend = process.env.BACKEND_ORIGIN;
  let captured = null;
  const projection = { case_id: 'CS-0123456789AB', evidence_sha256: 'a'.repeat(64) };
  const response = {
    statusCode: 200,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; },
  };
  try {
    process.env.BACKEND_ORIGIN = 'https://backend.example.test';
    globalThis.fetch = async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ status: 'unavailable', persisted: false, readback: false, graph: { nodes: [], edges: [] } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    };
    await analyzeEmlHandler({ method: 'POST', query: { operation: 'graph' }, headers: { 'content-type': 'application/json' }, body: projection }, response);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBackend === undefined) delete process.env.BACKEND_ORIGIN;
    else process.env.BACKEND_ORIGIN = originalBackend;
  }
  assert.equal(captured.url, 'https://backend.example.test/api/v1/evidence-graph');
  assert.deepEqual(JSON.parse(captured.options.body), projection);
  assert.ok(!JSON.stringify(captured.options.headers).toLowerCase().includes('neo4j'));
  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.status, 'unavailable');
  assert.equal(response.payload.readback, false);
});
