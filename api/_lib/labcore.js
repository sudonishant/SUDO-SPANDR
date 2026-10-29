// Shared CyberLab / Threat Lab analysis core (edge-safe, pure JS).
// Mirrors backend/app/core/cyberlab_engine.py — deterministic static analysis,
// no execution, explicit uncertainty in every verdict.

import crypto from 'crypto';

const SUSPICIOUS_STRINGS = [
  'powershell', 'cmd.exe', 'wscript.shell', 'createobject', 'autoopen',
  'document_open', 'workbook_open', 'shell(', 'urldownloadtofile',
  'virtualalloc', 'createremotethread', 'base64 -decode', 'frombase64string',
  'hidden', '-enc', 'invoke-expression', 'iex(', 'certutil', 'bitsadmin',
  'mshta', 'regsvr32', 'rundll32', 'schtasks',
];
const SUSPICIOUS_TLDS = new Set(['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'icu', 'click', 'link', 'live', 'online', 'site', 'club', 'work', 'buzz', 'rest', 'cam', 'monster']);
const BRAND_KEYWORDS = ['paypal', 'apple', 'microsoft', 'google', 'amazon', 'netflix', 'bank', 'hdfc', 'sbi', 'icici', 'paytm', 'phonepe', 'gpay', 'whatsapp', 'instagram', 'facebook', 'linkedin', 'dropbox', 'outlook', 'office365', 'onedrive', 'dhl', 'fedex', 'irctc'];
const RISKY_MEMBERS = /\.(exe|scr|bat|cmd|js|vbs|ps1|hta|jar|apk|dll|lnk|iso|img|docm|xlsm|pptm)\s*$/i;

export function verdict(score) {
  if (score >= 70) return 'LIKELY MALICIOUS — treat as hostile evidence';
  if (score >= 40) return 'SUSPICIOUS — manual analyst review required';
  if (score >= 20) return 'LOW-SUSPICION — note the observations before releasing';
  return 'NO STATIC MARKERS — not a verdict of safety';
}

export function hashes(buf) {
  return {
    md5: crypto.createHash('md5').update(buf).digest('hex'),
    sha1: crypto.createHash('sha1').update(buf).digest('hex'),
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
  };
}

function entropy(buf) {
  if (!buf.length) return 0;
  const freq = new Array(256).fill(0);
  const n = Math.min(buf.length, 2_000_000);
  for (let i = 0; i < n; i++) freq[buf[i]]++;
  let h = 0;
  for (const f of freq) {
    if (f) { const p = f / n; h -= p * Math.log2(p); }
  }
  return h;
}

function iocsFromText(text) {
  const urls = [...new Set((text.match(/https?:\/\/[^\s"'<>\\)]+/gi) || []).map((u) => u.replace(/[.,;)]+$/, '')))].slice(0, 40);
  const emails = [...new Set(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])].slice(0, 20);
  const ips = [...new Set(text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [])].slice(0, 20);
  return { urls, emails, ips };
}

function zipMemberNames(buf) {
  // light central-directory scan (names only) — no decompression
  const names = [];
  for (let i = 0; i + 46 < buf.length && names.length < 200; i++) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x01 && buf[i + 3] === 0x02) {
      const nameLen = buf.readUInt16LE(i + 28);
      if (nameLen > 0 && nameLen < 255 && i + 46 + nameLen <= buf.length) {
        names.push(buf.toString('latin1', i + 46, i + 46 + nameLen));
      }
    }
  }
  return names;
}

export function attachmentAnalyze(buf, filename) {
  const name = filename || 'attachment.bin';
  const findings = [];
  let score = 0;
  const head = buf.subarray(0, 16);
  const report = {
    filename: name,
    size_bytes: buf.length,
    ...hashes(buf),
    magic_hex: head.toString('hex').slice(0, 48),
    entropy: entropy(buf),
    engine: 'edge static analyzer (JS)',
  };

  // filename tricks
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|jpg|png|zip)\.(exe|vbs|bat|scr|js|ps1|hta|jar|apk)$/i.test(name)) {
    findings.push('Double-extension filename requires review; filename alone does not prove maliciousness.');
    score += 45;
  }
  if (/[\u202a-\u202e\u2066-\u2069]/.test(name)) {
    findings.push('Bidirectional Unicode control character appears in the filename.');
    score += 45;
  }

  // strings / IOC sweep
  const text = buf.toString('latin1', 0, Math.min(buf.length, 2_000_000));
  const low = text.toLowerCase();
  const hits = SUSPICIOUS_STRINGS.filter((s) => low.includes(s));
  if (hits.length) {
    findings.push(`suspicious script/API strings present: ${hits.slice(0, 10).join(', ')}`);
    score += Math.min(35, 8 * hits.length);
  }
  const iocs = iocsFromText(text);
  if (iocs.urls.length) {
    findings.push(`${iocs.urls.length} URL(s) embedded in the file`);
    score += 10;
  }
  report.iocs = iocs;
  report.suspicious_strings = hits;

  // format dives
  const fmt = {};
  if (head[0] === 0x4d && head[1] === 0x5a) {
    fmt.type = 'PE executable';
    findings.push('file is a Windows PE executable — detonate in the VM before any trust decision');
    score += 25;
    const pe = ['VirtualAlloc', 'LoadLibrary', 'GetProcAddress', 'Wininet', 'Urlmon', 'CreateProcess'].filter((s) => text.includes(s));
    fmt.pe_indicators = pe;
    if (pe.includes('VirtualAlloc') || pe.includes('Urlmon')) {
      findings.push('PE strings suggest process injection or download behaviour');
      score += 15;
    }
  } else if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) {
    fmt.type = 'OLE compound (legacy Office)';
    const markers = ['VBA', 'Macros', 'AutoOpen', 'Document_Open', 'ThisDocument'].filter((m) => text.includes(m));
    fmt.macro_markers = markers;
    if (markers.length) {
      findings.push(`legacy Office container carries macro markers: ${markers.slice(0, 6).join(', ')}`);
      score += 25;
    }
  } else if (head[0] === 0x50 && head[1] === 0x4b) {
    fmt.type = 'ZIP container';
    const members = zipMemberNames(buf);
    fmt.members = members.slice(0, 40);
    const risky = members.filter((m) => RISKY_MEMBERS.test(m));
    fmt.risky_members = risky;
    if (members.some((m) => m.toLowerCase().endsWith('vbaproject.bin'))) {
      findings.push('OOXML container embeds vbaProject.bin (macro payload)');
      score += 30;
    }
    if (risky.length) {
      findings.push(`archive contains risky members: ${risky.slice(0, 6).join(', ')}`);
      score += 25;
    }
    if (members.length > 200) {
      findings.push('archive has an unusually large member count (possible zip bomb)');
      score += 15;
    }
  } else if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
    fmt.type = 'PDF';
    let active = 0;
    for (const marker of ['/JavaScript', '/JS', '/OpenAction', '/Launch', '/EmbeddedFile', '/AA']) {
      const count = text.split(marker).length - 1;
      if (count) { fmt[marker] = count; }
      if (['/JavaScript', '/JS', '/OpenAction', '/Launch', '/AA'].includes(marker)) active += count;
    }
    if (active) {
      findings.push(`PDF contains ${active} active-content markers (JS/OpenAction/Launch)`);
      score += Math.min(40, 12 * active);
    }
  } else if (head[0] === 0x1f && head[1] === 0x8b) {
    fmt.type = 'gzip stream';
  } else if (head[0] === 0x52 && head[1] === 0x61 && head[2] === 0x72 && head[3] === 0x21) {
    fmt.type = 'RAR archive';
    score += 10;
  } else if (/^%PDF/.test(text.slice(0, 8))) {
    fmt.type = 'PDF';
  } else {
    fmt.type = 'unknown / generic bytes';
  }
  report.format = fmt;

  if (report.entropy > 7.4 && buf.length > 256) {
    findings.push(`very high entropy (${report.entropy.toFixed(2)}) — packed/encrypted payload possible`);
    score += 15;
  }

  if (!findings.length) findings.push('no static malice markers observed — this is not a safety guarantee');
  report.findings = findings;
  report.risk_score = Math.min(100, score);
  report.verdict = verdict(report.risk_score);
  report.disclaimer = 'Static inspection only — the file was never executed. Strings and markers are evidence, not proof of maliciousness.';
  return report;
}

function isPrivateIp(ip) {
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
}

export async function urlAnalyze(rawUrl) {
  let url = (rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  let parsed;
  try { parsed = new URL(url); } catch (e) {
    return { error: `malformed URL: ${e.message}`, url };
  }
  const findings = [];
  let score = 0;
  const report = { url, host: parsed.hostname, engine: 'edge static analyzer (JS)' };
  const host = parsed.hostname;
  const signals = [];

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) { signals.push('host is a raw IP address'); score += 25; }
  if (host.startsWith('xn--') || host.split('.').some((l) => l.startsWith('xn--'))) {
    signals.push('punycode/IDN host (possible homoglyph spoof)'); score += 30;
  }
  if (url.includes('@')) { signals.push('URL contains @ (credential/cloaking trick)'); score += 30; }
  if (parsed.port && !['80', '443'].includes(parsed.port)) { signals.push(`non-standard port ${parsed.port}`); score += 15; }
  const labels = host.split('.');
  if (labels.length >= 4) { signals.push(`${labels.length}-label deep subdomain chain`); score += 15; }
  const tld = (labels[labels.length - 1] || '').toLowerCase();
  if (SUSPICIOUS_TLDS.has(tld)) { signals.push(`budget/abuse-prone TLD .${tld}`); score += 15; }
  const first = (labels[0] || '').toLowerCase();
  for (const brand of BRAND_KEYWORDS) {
    if (first.includes(brand) && first !== brand) {
      signals.push(`brand keyword '${brand}' inside a look-alike hostname (typosquat)`);
      score += 30;
      break;
    }
    if (host.toLowerCase().includes(brand) && !first.includes(brand)) {
      signals.push(`brand keyword '${brand}' buried in subdomain of unrelated domain`);
      score += 20;
      break;
    }
  }
  if (/login|verify|secure|update|account|signin|webscr|confirm/i.test(url)) {
    signals.push('credential-phishing style path keywords'); score += 15;
  }
  if (url.length > 120) { signals.push('unusually long URL'); score += 10; }
  if (parsed.protocol === 'http:') { signals.push('cleartext HTTP (no TLS)'); score += 10; }
  report.structure_signals = signals;
  findings.push(...signals);

  // live fetch: redirect chain + page sniff (guarded; failure is fine)
  const chain = [];
  let body = '';
  let headers = {};
  try {
    let current = url;
    for (let hop = 0; hop < 6; hop++) {
      const resp = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'Mozilla/5.0 (SPANDR Threat Lab - static inspection)' },
      });
      const loc = resp.headers.get('location') || '';
      chain.push({ url: current, status: resp.status, location: loc });
      headers = Object.fromEntries(resp.headers.entries());
      if ([301, 302, 303, 307, 308].includes(resp.status) && loc) {
        current = new URL(loc, current).toString();
        if (isPrivateIp(new URL(current).hostname) && process.env.CYBERLAB_ALLOW_PRIVATE !== '1') {
          findings.push('redirect points at a private address — chain stopped (policy)');
          break;
        }
        continue;
      }
      body = (await resp.text()).slice(0, 200_000);
      break;
    }
  } catch (e) {
    findings.push(`fetch failed (target may be down or blocking): ${e.message}`);
  }
  if (chain.length > 1) {
    findings.push(`redirect chain hops through ${chain.length} URLs (possible cloaking)`);
    score += 15;
  }
  report.redirect_chain = chain;
  report.headers = headers;

  const bodyLow = body.toLowerCase();
  const page = {};
  if (/<input[^>]+type=["']password/.test(bodyLow)) {
    page.password_field = true;
    findings.push('page contains a password input field');
    score += 20;
  }
  const title = body.match(/<title>(.*?)<\/title>/is);
  page.title = title ? title[1].trim().slice(0, 120) : '';
  page.obfuscation = ['eval(', 'unescape(', 'document.write(', 'atob(', '<iframe'].filter((m) => bodyLow.includes(m));
  if (page.obfuscation.length) {
    findings.push(`obfuscation/embedded-frame markers: ${page.obfuscation.join(', ')}`);
    score += 15;
  }
  if (/meta[^>]+refresh/.test(bodyLow)) {
    page.meta_refresh = true;
    findings.push('meta-refresh redirect present');
    score += 10;
  }
  report.page = page;

  report.findings = findings.length ? findings : ['no structural phishing markers observed — not a safety guarantee'];
  report.risk_score = Math.min(100, score);
  report.verdict = verdict(report.risk_score);
  report.disclaimer = 'Link inspected from the analysis host, not the analyst\'s browser. Static + fetched-page evidence only.';
  return report;
}

export function extractFromEml(emlText) {
  const meta = {
    subject: (emlText.match(/^Subject:\s*(.*)$/im) || [])[1] || '',
    from: (emlText.match(/^From:\s*(.*)$/im) || [])[1] || '',
    to: (emlText.match(/^To:\s*(.*)$/im) || [])[1] || '',
    date: (emlText.match(/^Date:\s*(.*)$/im) || [])[1] || '',
  };
  const attachments = [];
  // base64 attachments: Content-Disposition: attachment; filename="x" ... <b64 block>
  const re = /Content-Disposition:[^\n]*filename="?([^";\n]+)"?[\s\S]*?(?:Content-Transfer-Encoding:\s*base64\s*\n+)([\s\S]*?)(?:\n--|\n\n[A-Z-]+:|$)/gi;
  let m;
  while ((m = re.exec(emlText)) !== null) {
    const b64 = m[2].replace(/\s+/g, '');
    if (b64.length > 8) {
      try { attachments.push({ filename: m[1].trim(), data_b64: b64 }); } catch (e) { /* skip */ }
    }
  }
  const urls = [...new Set((emlText.match(/https?:\/\/[^\s"'<>\\)]+/gi) || []).map((u) => u.replace(/[.,;)\]}]+$/, '')))];
  return { meta, attachments, urls };
}

export async function autoTriage({ eml_b64, eml_text, files = [], urls = [] }) {
  const linkList = [...(urls || [])];
  const fileItems = [...(files || [])];
  const meta = { attachments_found: 0, links_found: 0 };

  if (eml_b64 || eml_text) {
    const emlText = eml_text || Buffer.from(eml_b64, 'base64').toString('latin1');
    const parsed = extractFromEml(emlText);
    Object.assign(meta, parsed.meta);
    for (const a of parsed.attachments) fileItems.push(a);
    for (const u of parsed.urls) if (!linkList.includes(u)) linkList.push(u);
  }

  meta.attachments_found = fileItems.length;
  meta.links_found = linkList.length;

  const attachments = fileItems.slice(0, 12).map((f) =>
    attachmentAnalyze(Buffer.from(f.data_b64 || f.file_b64 || '', 'base64'), f.filename));
  const links = [];
  for (const u of linkList.slice(0, 20)) links.push(await urlAnalyze(u));

  const scores = [...attachments, ...links].map((r) => r.risk_score || 0);
  const worst = scores.length ? Math.max(...scores) : 0;
  const weighted = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 0.4 + worst * 0.6) : 0;

  const summary = [];
  for (const r of attachments) summary.push(`[attachment] ${r.filename} · risk ${r.risk_score}/100 · ${r.verdict}`);
  for (const r of links) summary.push(`[link] ${r.url} · risk ${r.risk_score}/100 · ${r.verdict}`);

  const actions = [];
  if (attachments.some((r) => r.risk_score >= 70)) actions.push('quarantine the high-risk attachment and detonate it inside the air-gapped VM');
  if (attachments.some((r) => r.format && (r.format.macro_markers || []).length)) actions.push('macro-enabled document: open only with macros disabled or in the VM');
  if (links.some((r) => r.risk_score >= 70)) actions.push('do not open the high-risk link on a corporate host; inspect via Render Snapshot');
  if (links.some((r) => r.page && r.page.password_field)) actions.push('credential-harvesting page: submit nothing; preserve for takedown');
  if (!actions.length) actions.push('no automatic containment triggered — apply standard caution');

  return {
    pipeline: 'email threat lab · auto triage',
    meta,
    attachments,
    links,
    aggregate_risk: Math.min(100, weighted),
    verdict: verdict(weighted),
    summary: summary.length ? summary : ['nothing to analyse — provide an .eml, files, or URLs'],
    recommended_actions: actions,
    disclaimer: 'Fully automated static triage. Nothing was executed; no verdict here is a legal or reputational conclusion. Missing data is never guessed.',
  };
}

export function pcapAnalyze(buf, filename) {
  // minimal classic-pcap sweep: DNS qnames, HTTP lines, credentials, FLAG regex
  const result = {
    name: filename || 'capture.pcap',
    size: buf.length,
    engine: 'edge pcap parser (JS)',
    dns: [], http: [], credentials: [], flags: [],
  };
  result.flags = [...new Set((buf.toString('latin1').match(/FLAG\{[^}]+\}/g) || []))];
  if (buf.length < 24) { result.error = 'file too small to be a pcap'; return result; }
  const magic = buf.readUInt32LE(0);
  const le = magic === 0xa1b2c3d4 || magic === 0xa1b23c4d;
  const be = magic === 0xd4c3b2a1 || magic === 0x4d3cb2a1;
  if (!le && !be) { result.error = `unrecognised pcap magic ${buf.subarray(0, 4).toString('hex')}`; return result; }
  const u16 = (off) => (le ? buf.readUInt16LE(off) : buf.readUInt16BE(off));
  const u32 = (off) => (le ? buf.readUInt32LE(off) : buf.readUInt32BE(off));
  let off = 24;
  let count = 0;
  while (off + 16 <= buf.length && count < 2000) {
    const incl = u32(off + 8);
    off += 16;
    const frame = buf.subarray(off, off + incl);
    off += incl;
    count++;
    if (frame.length < 34) continue;
    const ethertype = (frame[12] << 8) | frame[13];
    if (ethertype !== 0x0800) continue;
    const ip = frame.subarray(14);
    if ((ip[0] >> 4) !== 4) continue;
    const ihl = (ip[0] & 0x0f) * 4;
    const proto = ip[9];
    const src = `${ip[12]}.${ip[13]}.${ip[14]}.${ip[15]}`;
    const dst = `${ip[16]}.${ip[17]}.${ip[18]}.${ip[19]}`;
    const seg = ip.subarray(ihl);
    if (proto === 17 && seg.length > 8) {
      const dport = (seg[2] << 8) | seg[3];
      if (dport === 53) {
        let i = 8 + 12; const labels = []; // skip UDP header (8) + DNS header (12)
        while (i < seg.length) {
          const len = seg[i];
          if (!len || (len & 0xc0)) break;
          labels.push(seg.toString('latin1', i + 1, i + 1 + len));
          i += 1 + len;
        }
        if (labels.length) result.dns.push(`${src} -> ${dst}  ${labels.join('.')}`);
      }
    } else if (proto === 6 && seg.length > 20) {
      const doff = ((seg[12] >> 4) & 0x0f) * 4;
      const payload = seg.subarray(doff).toString('latin1');
      const req = payload.match(/(GET|POST|PUT|DELETE|HEAD)\s+(\S+)\s+HTTP/);
      const host = (payload.match(/Host:\s*([^\r\n]+)/i) || [])[1] || '';
      if (req) result.http.push(`${src} -> ${dst} ${req[1]} http://${host}${req[2]}`);
      const creds = [...payload.matchAll(/(username|user|login|password|pass|pwd)=([^&\s\r\n]+)/gi)];
      if (creds.length) result.credentials.push(`${host} ${creds.map((c) => `${c[1]}=${c[2]}`).join(' ')}`);
    }
  }
  result.protocols = `parsed ${count} frames · ${result.dns.length} DNS · ${result.http.length} HTTP`;
  result.dns = result.dns.slice(0, 60).join('\n');
  result.http = result.http.slice(0, 60).join('\n');
  result.credentials = result.credentials.slice(0, 40).join('\n');
  return result;
}

/* ===== endpoint handlers (single catch-all function on Vercel) =====
   Vercel Hobby allows max 12 serverless functions per deployment; every non-underscore
   file under api/ counts as one. All /api/v1/sandbox/lab/* routes share ONE function
   (see [[...path]].js). Add new lab routes as handlers here, never as new api/ files. */

/* ---------- /attachment ---------- */
// POST /api/v1/sandbox/lab/attachment — deep static attachment analysis (edge)



export async function handleAttachment(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', detail: 'POST a file as {filename, file_b64}.' });
  }
  const { filename, file_b64: fileB64 } = req.body || {};
  if (!fileB64) {
    return res.status(400).json({ error: 'missing_file', detail: 'Provide {filename, file_b64} (base64 file bytes).' });
  }
  try {
    const buf = Buffer.from(fileB64, 'base64');
    if (!buf.length) throw new Error('empty file');
    return res.status(200).json(attachmentAnalyze(buf, filename || 'attachment.bin'));
  } catch (e) {
    return res.status(400).json({ error: 'analysis_failed', detail: e.message });
  }
}

/* ---------- /url ---------- */
// POST /api/v1/sandbox/lab/url — deep suspicious-link analysis (edge)


export async function handleUrl(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  let url = '';
  if (req.method === 'POST') url = req.body?.url || '';
  else url = req.query?.url || '';
  url = (url || '').trim();
  if (!url) {
    return res.status(400).json({ error: 'missing_url', detail: 'Provide a URL to analyse.' });
  }
  try {
    return res.status(200).json(await urlAnalyze(url));
  } catch (e) {
    return res.status(500).json({ error: 'analysis_failed', detail: e.message });
  }
}

/* ---------- /auto-triage ---------- */
// POST /api/v1/sandbox/lab/auto-triage — one-click automated email evidence triage (edge)



export async function handleAutoTriage(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', detail: 'POST {eml_b64 | files | urls}.' });
  }
  const body = req.body || {};
  const urls = Array.isArray(body.urls) ? body.urls : (typeof body.urls === 'string' ? body.urls.split(/[\s,]+/).filter(Boolean) : []);
  const files = Array.isArray(body.files) ? body.files : [];
  if (!body.eml_b64 && !body.eml_text && !files.length && !urls.length) {
    return res.status(400).json({ error: 'empty_request', detail: 'Provide an .eml, files ({filename, file_b64}), or at least one URL.' });
  }
  try {
    return res.status(200).json(await autoTriage({
      eml_b64: body.eml_b64,
      eml_text: body.eml_text,
      files,
      urls,
    }));
  } catch (e) {
    return res.status(500).json({ error: 'triage_failed', detail: e.message });
  }
}

/* ---------- /pcap ---------- */
// POST /api/v1/sandbox/lab/pcap — traffic evidence dissection (edge parser)



export async function handlePcap(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', detail: 'POST {filename, file_b64}.' });
  }
  const { filename, file_b64: fileB64 } = req.body || {};
  if (!fileB64) {
    return res.status(400).json({ error: 'missing_file', detail: 'Provide {filename, file_b64} (base64 pcap bytes).' });
  }
  try {
    return res.status(200).json(pcapAnalyze(Buffer.from(fileB64, 'base64'), filename || 'capture.pcap'));
  } catch (e) {
    return res.status(400).json({ error: 'analysis_failed', detail: e.message });
  }
}

/* ---------- /toolbox ---------- */
// GET /api/v1/sandbox/lab/toolbox — which analysis engines this deployment has
export async function handleToolbox(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  return res.status(200).json({
    guest_image: 'spandr-sbx-cyberlab',
    private_targets_allowed: process.env.CYBERLAB_ALLOW_PRIVATE === '1',
    edge: true,
    tools: {
      attachment_lab: { binary: 'edge-js', available: true },
      url_lab: { binary: 'edge-js', available: true },
      auto_triage: { binary: 'edge-js', available: true },
      pcap_parser: { binary: 'edge-js', available: true },
    },
  });
}

/*
 * The former same-origin remote-HTML proxy stays disabled: proxying active
 * third-party documents into the application origin created an XSS,
 * credential-capture, framing and SSRF boundary that an iframe srcDoc sandbox
 * could not repair. It lives here (not in its own file) because Vercel Hobby
 * caps serverless functions per deployment; /api/v1/sandbox/preview-frame is
 * rewritten to this route in vercel.json.
 */
export async function handlePreviewFrame(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  return res.status(410).json({
    error: 'remote_preview_disabled',
    detail: 'The same-origin remote-HTML preview proxy is disabled. Use network-free URL Lab checks, or deploy an authenticated, isolated detonation worker with restricted egress.',
    remote_fetch_performed: false,
    live_detonation_available: false,
  });
}
