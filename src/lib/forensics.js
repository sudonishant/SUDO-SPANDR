import taxonomy from '../../shared/category_taxonomy.json';
import scoringRules from '../../shared/scoring_rules.json';

const CATEGORY_DEFINITIONS = Object.fromEntries(taxonomy.categories.map((category) => [category.id, category]));
const EMAIL_EXTENSIONS = ['eml', 'msg'];
const ATTACHMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip', 'rar', '7z', 'txt', 'html', 'htm', 'js', 'vbs', 'ps1', 'exe', 'apk'];

const AUTHENTICATION_METHODS = ['spf', 'dkim', 'dmarc', 'arc'];
const PUBLIC_IPV4 = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?![\d.])/g;
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`]+/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const RISK_RULES = [
  { id: 'urgency', label: 'Urgency or pressure language', weight: 12, pattern: /\b(urgent|immediately|asap|action required|within \d+ hours|final notice|today|now)\b/i },
  { id: 'credential', label: 'Credential or login request', weight: 18, pattern: /\b(password|login|sign in|verify your account|credential|one[- ]time password|otp|security code|session expired)\b/i },
  { id: 'financial', label: 'Financial or payment request', weight: 22, pattern: /\b(wire transfer|bank account|payment|invoice|gift card|crypto|bitcoin|remittance|change.*account|funds)\b/i },
  { id: 'secrecy', label: 'Secrecy or bypass language', weight: 10, pattern: /\b(do not call|keep confidential|do not tell|bypass|secret|discreet)\b/i },
  { id: 'suspicious-url', label: 'Suspicious URL characteristics', weight: 18, pattern: /\b(?:login|verify|secure|auth)[-_.]/i },
  { id: 'attachment', label: 'Executable or script attachment indicator', weight: 22, pattern: /\.(?:exe|scr|bat|cmd|js|vbs|ps1|hta|jar|apk)(?:\b|$)/i },
];

function clean(value) {
  return String(value ?? '').replace(/\u0000/g, '').trim();
}

function extensionOf(filename = '') {
  return filename.toLowerCase().split('.').pop() || '';
}

function decodeBytes(buffer) {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
}

function sha256Hex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || new ArrayBuffer(0));
  return crypto.subtle.digest('SHA-256', bytes).then((digest) =>
    Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(''),
  );
}

function parseHeaderBlock(headerText) {
  const unfolded = clean(headerText).replace(/\r?\n[ \t]+/g, ' ');
  const headers = {};
  const entries = [];
  unfolded.split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator <= 0) return;
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    const key = name.toLowerCase();
    headers[key] = headers[key] ? `${headers[key]}\n${value}` : value;
    entries.push({ name, value });
  });
  return { headers, entries };
}

function decodeQuotedPrintableText(value = '') {
  return String(value).replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function splitEmailText(rawText) {
  const match = rawText.match(/\r?\n\r?\n/);
  if (!match) return { headerText: rawText, body: '' };
  const index = match.index ?? rawText.length;
  return { headerText: rawText.slice(0, index), body: rawText.slice(index + match[0].length) };
}

function stripHtml(value = '') {
  return clean(String(value).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

function extractMimeText(rawBody = '', contentType = '') {
  const boundary = String(contentType).match(/boundary\s*=\s*"?([^";]+)"?/i)?.[1];
  if (!boundary) return stripHtml(decodeQuotedPrintableText(rawBody));
  const parts = rawBody.split(`--${boundary}`);
  let htmlCandidate = '';
  for (const part of parts) {
    const separator = part.match(/\r?\n\r?\n/);
    if (!separator) continue;
    const index = separator.index ?? 0;
    const partHeaders = parseHeaderBlock(part.slice(0, index)).headers;
    const content = decodeQuotedPrintableText(part.slice(index + separator[0].length).replace(/--\s*$/, ''));
    if (/text\/plain/i.test(partHeaders['content-type'] || '')) return stripHtml(content);
    if (/text\/html/i.test(partHeaders['content-type'] || '')) htmlCandidate = content;
  }
  return stripHtml(htmlCandidate || rawBody);
}

function firstAddress(value = '') {
  const match = clean(value).match(EMAIL_PATTERN);
  return match?.[0] || clean(value);
}

function addressList(value = '') {
  return [...clean(value).matchAll(EMAIL_PATTERN)].map((match) => match[0]);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractIps(headers, rawText = '') {
  const values = [];
  const source = [];
  const received = headers['received'];
  if (received) source.push(['Received', received]);
  ['x-originating-ip', 'x-sender-ip', 'client-ip'].forEach((name) => {
    if (headers[name]) source.push([name, headers[name]]);
  });
  source.forEach(([field, value]) => {
    [...String(value).matchAll(PUBLIC_IPV4)].forEach((match) => values.push({ ip: match[0], field }));
  });
  return unique(values.map((value) => `${value.field}:${value.ip}`)).map((item) => {
    const [field, ip] = item.split(':');
    return { field, ip };
  });
}

function extractUrls(rawText = '') {
  const normalizedText = decodeQuotedPrintableText(rawText);
  const seen = new Set();
  return [...String(normalizedText).matchAll(URL_PATTERN)].map((match) => match[0].replace(/[),.;]+$/, '')).filter((rawUrl) => {
    const key = rawUrl.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((rawUrl) => {
    try {
      const url = new URL(rawUrl);
      const hostname = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();
      const isAsset = hostname === 'www.w3.org' || hostname.includes('stripocdn.email') || /\.(css|png|jpe?g|gif|webp|svg)$/i.test(path) || path.includes('/images/');
      const isTracking = hostname.endsWith('.awstrack.me') || hostname.includes('track') || hostname.includes('click');
      const reasons = [];
      if (!isAsset && url.protocol !== 'https:') reasons.push('Not HTTPS');
      if (!isAsset && hostname.includes('xn--')) reasons.push('Punycode hostname');
      if (!isAsset && !isTracking && hostname.split('.').length > 3) reasons.push('Deep subdomain');
      if (!isAsset && /[0-9]{7,}/.test(hostname)) reasons.push('Numeric hostname pattern');
      if (!isAsset && /(login|verify|secure|auth|account|payment|update)/i.test(`${url.pathname} ${hostname}`)) reasons.push('Credential/payment-themed path or hostname');
      return { url: rawUrl, domain: hostname, risk: reasons.length ? 'REVIEW' : 'UNASSESSED', kind: isAsset ? 'email asset/reference' : isTracking ? 'tracking redirect' : 'actionable link', reasons };
    } catch {
      return { url: rawUrl, domain: 'Invalid URL', risk: 'REVIEW', kind: 'unparsed', reasons: ['URL parser rejected this value'] };
    }
  });
}

function authenticationSnapshot(headers) {
  const normalizedHeaders = headers || {};
  const authResultHeaders = [
    ['Authentication-Results', normalizedHeaders['authentication-results']],
    ['ARC-Authentication-Results', normalizedHeaders['arc-authentication-results']],
    ['X-Authentication-Results', normalizedHeaders['x-authentication-results']],
  ].filter(([, value]) => value).map(([name, value]) => `${name}: ${value}`);
  const authResults = authResultHeaders.join('\n');
  const receivedSpf = normalizedHeaders['received-spf'] || normalizedHeaders['x-received-spf'] || '';
  const reported = {};
  AUTHENTICATION_METHODS.forEach((method) => {
    const match = authResults.match(new RegExp(`\\b${method}\\s*=\\s*(pass|fail|softfail|neutral|none|temperror|permerror)`, 'i'));
    if (match) reported[method] = `REPORTED ${match[1].toUpperCase()}`;
    else if (method === 'spf') {
      const spfMatch = String(receivedSpf).match(/^\\s*(pass|fail|softfail|neutral|none|temperror|permerror)\\b/i);
      reported[method] = spfMatch ? `REPORTED ${spfMatch[1].toUpperCase()} (Received-SPF)` : 'NOT VERIFIED';
    } else reported[method] = 'NOT VERIFIED';
  });
  const dkim = reported.dkim !== 'NOT VERIFIED' ? reported.dkim : normalizedHeaders['dkim-signature'] ? 'PRESENT — signature not cryptographically verified in browser' : 'NOT PRESENT';
  const arc = reported.arc !== 'NOT VERIFIED' ? reported.arc : normalizedHeaders['arc-seal'] || normalizedHeaders['arc-message-signature'] || normalizedHeaders['arc-authentication-results'] ? 'PRESENT — chain not independently verified in browser' : 'NOT PRESENT';
  return {
    spf: reported.spf,
    dkim,
    dmarc: reported.dmarc,
    arc,
    reported_header: authResults || receivedSpf ? 'Present; receiver provenance not verified in browser' : 'Not present',
    evidence_sources: [...authResultHeaders.map((item) => item.split(':', 1)[0]), ...(receivedSpf ? ['Received-SPF'] : []), ...(normalizedHeaders['dkim-signature'] ? ['DKIM-Signature'] : [])],
    raw_reported: authResults || receivedSpf || 'No Authentication-Results, ARC-Authentication-Results, X-Authentication-Results, or Received-SPF header was supplied.',
    note: 'REPORTED values come from submitted receiver headers. Browser analysis does not perform SPF/DKIM/DMARC/ARC cryptographic or DNS verification; a reported pass is not proof that the message content is safe.',
  };
}

function headerAnomalies({ headers, sender, replyTo }) {
  const findings = [];
  const fromDomain = firstAddress(sender).split('@')[1]?.toLowerCase();
  const replyDomain = firstAddress(replyTo).split('@')[1]?.toLowerCase();
  if (replyTo && fromDomain && replyDomain && fromDomain !== replyDomain) {
    findings.push({ id: 'reply-to-mismatch', label: 'Reply-To domain differs from From domain', weight: 16 });
  }
  const displayName = clean(headers['from']).replace(/<[^>]+>/g, '').trim();
  if (displayName && !EMAIL_PATTERN.test(displayName) && /\b(ceo|cfo|director|admin|support|security|bank|microsoft|google|apple)\b/i.test(displayName)) {
    findings.push({ id: 'display-name-review', label: 'Trusted-brand or authority display name needs verification', weight: 8 });
  }
  if (!headers['message-id']) findings.push({ id: 'missing-message-id', label: 'Message-ID header is missing', weight: 4 });
  if (!headers['date']) findings.push({ id: 'missing-date', label: 'Date header is missing', weight: 3 });
  if (!headers['received']) findings.push({ id: 'missing-received', label: 'No Received header was supplied; relay path unavailable', weight: 8 });
  return findings;
}

function organizationDomain(value = '') {
  const parts = clean(value).toLowerCase().split('.').filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join('.') : parts[0] || '';
}

function authenticationContext(headers = {}, sender = '') {
  const authResults = String(headers['authentication-results'] || '');
  const passMatches = authResults.match(/\b(?:spf|dkim|dmarc|arc)\s*=\s*pass\b/gi) || [];
  const dmarcPass = /\bdmarc\s*=\s*pass\b/i.test(authResults);
  const anyFail = /\b(?:spf|dkim|dmarc|arc)\s*=\s*(?:fail|permerror)\b/i.test(authResults);
  const fromDomain = firstAddress(sender).split('@')[1] || '';
  const returnDomain = firstAddress(headers['return-path']).split('@')[1] || '';
  return { pass_count: passMatches.length, dmarc_pass: dmarcPass, any_fail: anyFail, aligned_from_return_path: Boolean(fromDomain && returnDomain && organizationDomain(fromDomain) === organizationDomain(returnDomain)) };
}

function assessTextSignals({ subject, body, sender, urls, attachments, headerFindings, headers = {}, categoryId = 'unknown' }) {
  const text = `${subject}\n${body}`;
  const signals = [];
  const adjustments = [];
  let baselineScore = 0;
  RISK_RULES.forEach((rule) => {
    if (rule.pattern.test(text)) {
      baselineScore += rule.weight;
      signals.push({ id: rule.id, label: rule.label, weight: rule.weight, evidence: 'Matched in submitted subject/body content' });
    }
  });
  urls.filter((url) => url.risk === 'REVIEW').forEach((url) => {
    signals.push({ id: 'url-review', label: `URL requires review: ${url.domain}`, weight: scoringRules.content_weights.url_review, evidence: url.reasons.join(', ') || 'URL structure' });
    baselineScore += scoringRules.content_weights.url_review;
  });
  attachments.filter((attachment) => attachment.risk_level !== 'LOW').forEach((attachment) => {
    const weight = Math.min(scoringRules.content_weights.attachment, attachment.risk_score || 0);
    baselineScore += weight;
    signals.push({ id: 'attachment-review', label: `Attachment requires review: ${attachment.filename}`, weight, evidence: attachment.findings.join('; ') });
  });
  headerFindings.forEach((finding) => {
    baselineScore += finding.weight;
    signals.push({ ...finding, evidence: 'Observed in submitted headers' });
  });
  let score = baselineScore;
  const auth = authenticationContext(headers, sender);
  if (auth.pass_count >= 3) { score += scoringRules.authentication_adjustments.three_or_more_passes; adjustments.push({ label: 'Multiple receiver-reported authentication passes', points: scoringRules.authentication_adjustments.three_or_more_passes }); }
  if (auth.dmarc_pass) { score += scoringRules.authentication_adjustments.dmarc_pass; adjustments.push({ label: 'DMARC reported pass', points: scoringRules.authentication_adjustments.dmarc_pass }); }
  if (auth.aligned_from_return_path) { score += scoringRules.authentication_adjustments.aligned_from_return_path; adjustments.push({ label: 'From and Return-Path organizational domains align', points: scoringRules.authentication_adjustments.aligned_from_return_path }); }
  if (auth.any_fail) { score += scoringRules.authentication_adjustments.any_fail; adjustments.push({ label: 'An authentication method reported fail/permerror', points: scoringRules.authentication_adjustments.any_fail }); }
  const benignAdjustment = scoringRules.benign_context_adjustments[categoryId];
  if (benignAdjustment) { score += benignAdjustment; adjustments.push({ label: `${categoryId} context adjustment`, points: benignAdjustment }); }
  const bounded = Math.max(scoringRules.limits.min, Math.min(scoringRules.limits.max, score));
  const status = bounded >= scoringRules.thresholds.high ? 'HIGH RISK' : bounded >= scoringRules.thresholds.review ? 'REVIEW' : 'NO HIGH-RISK SIGNALS OBSERVED';
  const positiveContributors = signals.map((signal) => ({ label: signal.label, points: Number(signal.weight || 0), evidence: signal.evidence || 'Observed in submitted evidence', source: signal.id || 'deterministic-rule' })).filter((item) => item.points > 0);
  const deductions = adjustments.map((adjustment) => ({ label: adjustment.label, points: Number(adjustment.points || 0), evidence: 'Context adjustment from submitted authentication/category evidence', source: 'shared-scoring-rules' }));
  return { risk_score: bounded, baseline_score: baselineScore, adjustments, authentication_context: auth, status, signals, score_breakdown: { positive_contributors: positiveContributors, deductions, positive_total: baselineScore, adjustment_total: deductions.reduce((total, item) => total + item.points, 0), final_score: bounded, formula: `${baselineScore} observed points ${deductions.length ? `plus ${deductions.map((item) => item.points).join(' + ')} adjustments` : ''} = ${bounded} final triage score` }, note: scoringRules.confidence_note };
}

const CATEGORY_RULES = {
  phishing_bec: [
    ['credential request', /\b(password|login|sign in|verify your account|credential|otp|security code|session expired)\b/i, 20],
    ['pressure language', /\b(urgent|immediately|asap|final notice|account suspended|act now)\b/i, 14],
    ['impersonation or authority', /\b(ceo|cfo|director|admin|security team|microsoft|bank support)\b/i, 12],
    ['payment redirection', /\b(wire transfer|change.*bank|gift card|crypto|payment redirect|remittance)\b/i, 24],
  ],
  malware_related: [
    ['executable/script marker', /\.(exe|scr|bat|cmd|js|vbs|ps1|hta|jar|apk)\b/i, 34],
    ['macro or active-content marker', /\b(macro|vba|powershell|javascript|openaction|launch)\b/i, 28],
  ],
  banking_financial: [['financial vocabulary', /\b(bank|account statement|invoice|payment|transfer|remittance|debit|credit|swift|iban|refund)\b/i, 26]],
  otp_security: [['authentication vocabulary', /\b(otp|one[- ]time (password|code)|verification code|security code|login code|sign[- ]in code|code below|log into|2fa|login attempt|password reset|suspicious activity|account locked)\b/i, 30]],
  delivery_order: [['delivery vocabulary', /\b(order|shipment|shipped|delivery|tracking|parcel|courier|dispatch|return label)\b/i, 30]],
  promotional: [['marketing vocabulary', /\b(sale|discount|offer|coupon|cashback|limited time|deal|shop now|unsubscribe|free gift)\b/i, 28]],
  newsletter: [['publication vocabulary', /\b(newsletter|digest|bulletin|weekly update|monthly update|edition|subscribe)\b/i, 28]],
  social: [['social vocabulary', /\b(mentioned you|commented|liked your|follow|friend request|community|invitation)\b/i, 28]],
  corporate: [['business vocabulary', /\b(meeting|agenda|hr|payroll|policy|project|quarterly|board|employee|internal)\b/i, 24]],
  support: [['support vocabulary', /\b(support ticket|case number|help desk|customer care|service request|ticket #)\b/i, 28]],
  transactional: [['transaction vocabulary', /\b(receipt|confirmation|booking|statement|order confirmation|appointment|subscription renewal)\b/i, 24]],
};

function classifyMail({ subject = '', body = '', sender = '', urls = [], attachments = [], threatScore = 0 }) {
  const text = `${subject}\n${body}\n${sender}`;
  const scores = Object.fromEntries(Object.keys(CATEGORY_DEFINITIONS).map((id) => [id, 0]));
  const evidence = [];
  Object.entries(CATEGORY_RULES).forEach(([categoryId, rules]) => rules.forEach(([label, pattern, points]) => {
    if (pattern.test(text)) {
      scores[categoryId] += points;
      evidence.push({ category_id: categoryId, label, points, source: 'subject/body/sender text' });
    }
  }));
  urls.filter((url) => url.risk === 'REVIEW').forEach((url) => {
    scores.phishing_bec += 18;
    evidence.push({ category_id: 'phishing_bec', label: `review URL: ${url.domain}`, points: 18, source: 'URL structure' });
  });
  attachments.forEach((attachment) => {
    if (attachment.risk_level === 'HIGH') {
      scores.malware_related += 60;
      evidence.push({ category_id: 'malware_related', label: `high-risk attachment: ${attachment.filename}`, points: 60, source: 'static file inspection' });
    } else if (attachment.risk_level === 'MEDIUM') {
      scores.malware_related += 25;
      evidence.push({ category_id: 'malware_related', label: `attachment requires review: ${attachment.filename}`, points: 25, source: 'static file inspection' });
    }
  });

  const bodyWords = text.split(/\s+/).filter(Boolean).length;
  if (!evidence.length && bodyWords >= 8) {
    scores.legitimate = 18;
    evidence.push({ category_id: 'legitimate', label: 'No stronger category signal observed', points: 18, source: 'content review' });
  }
  if (!evidence.length || (bodyWords < 8 && !sender && !subject)) scores.unknown = 30;

  let categoryId = Object.entries(scores).sort(([, left], [, right]) => right - left)[0]?.[0] || 'unknown';
  if (threatScore >= 70 && scores.malware_related >= scores.phishing_bec) categoryId = 'malware_related';
  else if (threatScore >= 70 && scores.phishing_bec > 0) categoryId = 'phishing_bec';
  else if (scores[categoryId] === 0) categoryId = 'unknown';

  const category = CATEGORY_DEFINITIONS[categoryId] || CATEGORY_DEFINITIONS.unknown;
  const categoryEvidence = evidence.filter((item) => item.category_id === categoryId);
  const points = Math.min(100, scores[categoryId] || 0);
  const confidence = categoryId === 'unknown' ? 25 : Math.min(98, 48 + categoryEvidence.length * 10 + (subject ? 5 : 0) + (sender ? 5 : 0));
  let alertLevel = category.default_alert;
  if (categoryId === 'malware_related' || (categoryId === 'phishing_bec' && threatScore >= 70)) alertLevel = 'critical';
  else if (categoryId === 'phishing_bec' || categoryId === 'banking_financial' || categoryId === 'unknown' || threatScore >= 35) alertLevel = 'review';
  const alertTitles = { critical: 'Quarantine / urgent analyst review', review: 'Manual review recommended', low: 'Low-priority informational alert', info: 'Informational — no high-risk alert' };
  const spamSignals = [
    /\b(unsubscribe|bulk|promotion|sale|discount|coupon|free gift)\b/i.test(text) ? 'marketing or bulk-mail language' : null,
    /\b(dear customer|valued customer|click here|limited time)\b/i.test(text) ? 'generic mass-mail phrasing' : null,
  ].filter(Boolean);
  return {
    category_id: categoryId, category_label: category.label, description: category.description,
    points, confidence, confidence_label: 'Evidence coverage (not probability)', evidence_points: categoryEvidence,
    all_category_scores: Object.entries(scores).filter(([, value]) => value > 0).map(([id, value]) => ({ category_id: id, label: CATEGORY_DEFINITIONS[id].label, points: Math.min(100, value) })).sort((a, b) => b.points - a.points),
    alert_level: alertLevel, alert_title: alertTitles[alertLevel], recommended_action: category.action,
    spam_assessment: spamSignals.length ? 'PROMOTIONAL / BULK SIGNALS OBSERVED' : 'NO SPAM-SPECIFIC SIGNAL OBSERVED', spam_signals: spamSignals,
    note: 'Category and confidence are heuristic triage outputs. Similar language can occur in both legitimate and malicious mail; verify context and source.',
  };
}

function magicType(bytes) {
  const b = bytes || new Uint8Array();
  if (b[0] === 0x4d && b[1] === 0x5a) return 'Windows executable (MZ)';
  if (b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) return 'Linux executable (ELF)';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'PDF';
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'ZIP / Office Open XML container';
  if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) return 'RAR archive';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'PNG image';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'JPEG image';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'GIF image';
  return 'Unknown / not identified by first bytes';
}

const SECONDARY_SIGNATURES = [
  ['PDF', new Uint8Array([0x25, 0x50, 0x44, 0x46])],
  ['JPEG image', new Uint8Array([0xff, 0xd8, 0xff])],
  ['PNG image', new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
  ['GIF image', new Uint8Array([0x47, 0x49, 0x46])],
  ['ZIP / Office Open XML container', new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
  ['RAR archive', new Uint8Array([0x52, 0x61, 0x72, 0x21])],
  ['Windows executable (MZ)', new Uint8Array([0x4d, 0x5a])],
  ['Linux executable (ELF)', new Uint8Array([0x7f, 0x45, 0x4c, 0x46])],
];

function byteSequenceIndex(bytes, signature, start = 0) {
  for (let offset = Math.max(0, start); offset <= bytes.length - signature.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < signature.length; index += 1) {
      if (bytes[offset + index] !== signature[index]) { matches = false; break; }
    }
    if (matches) return offset;
  }
  return -1;
}

function byteSequenceLastIndex(bytes, signature) {
  let last = -1;
  let next = 0;
  while (next <= bytes.length - signature.length) {
    const found = byteSequenceIndex(bytes, signature, next);
    if (found < 0) break;
    last = found;
    next = found + 1;
  }
  return last;
}

function nonWhitespaceByteCount(bytes) {
  return bytes.reduce((count, byte) => count + ([0x09, 0x0a, 0x0d, 0x20].includes(byte) ? 0 : 1), 0);
}

function firstNonWhitespaceOffset(bytes, start) {
  for (let offset = Math.max(0, start); offset < bytes.length; offset += 1) {
    if (![0x09, 0x0a, 0x0d, 0x20].includes(bytes[offset])) return offset;
  }
  return -1;
}

function formatBoundaryInspection(bytes, detectedType) {
  const endMarkers = {
    'JPEG image': new Uint8Array([0xff, 0xd9]),
    'PNG image': new Uint8Array([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]),
    PDF: new Uint8Array([0x25, 0x25, 0x45, 0x4f, 0x46]),
  };
  const marker = endMarkers[detectedType];
  if (!marker) return { primary_end_offset: null, trailing_bytes: 0, trailing_non_whitespace_bytes: 0, embedded_signatures: [] };
  const primaryEnd = detectedType === 'PDF' ? byteSequenceLastIndex(bytes, marker) : byteSequenceIndex(bytes, marker);
  if (primaryEnd < 0) return { primary_end_offset: null, trailing_bytes: 0, trailing_non_whitespace_bytes: 0, embedded_signatures: [] };
  const trailingStart = primaryEnd + marker.length;
  const trailing = bytes.slice(trailingStart);
  const firstContentOffset = firstNonWhitespaceOffset(bytes, trailingStart);
  const embeddedSignatures = firstContentOffset < 0 ? [] : SECONDARY_SIGNATURES.map(([label, signature]) => {
    return byteSequenceIndex(bytes, signature, firstContentOffset) === firstContentOffset ? { type: label, offset: firstContentOffset } : null;
  }).filter(Boolean);
  return { primary_end_offset: primaryEnd, trailing_bytes: trailing.length, trailing_non_whitespace_bytes: nonWhitespaceByteCount(trailing), embedded_signatures: embeddedSignatures };
}

function entropy(bytes) {
  if (!bytes?.length) return 0;
  const counts = new Array(256).fill(0);
  bytes.forEach((byte) => { counts[byte] += 1; });
  return Number(counts.reduce((total, count) => {
    if (!count) return total;
    const p = count / bytes.length;
    return total - p * Math.log2(p);
  }, 0).toFixed(2));
}

export async function inspectAttachment({ filename, buffer }) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || new ArrayBuffer(0));
  const ext = extensionOf(filename);
  const type = magicType(bytes);
  const rawText = decodeBytes(bytes.slice(0, Math.min(bytes.length, 2_000_000)));
  const findings = [];
  let riskScore = 0;
  const boundary = formatBoundaryInspection(bytes, type);
  const executableType = /executable/i.test(type);
  const documentLike = /^(pdf|zip|rar|png|jpeg|gif)$/i.test(ext) || ['PDF', 'ZIP / Office Open XML container', 'RAR archive', 'PNG image', 'JPEG image', 'GIF image'].includes(type);
  if (executableType && documentLike) { findings.push('File extension/content mismatch: executable magic bytes detected for a document/media-looking file.'); riskScore += 80; }
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|jpg|png|zip)\.(exe|scr|bat|cmd|js|vbs|ps1|hta|jar)$/i.test(filename)) { findings.push('Double-extension filename requires review.'); riskScore += 45; }
  if (/[\u202a-\u202e\u2066-\u2069]/.test(filename)) { findings.push('Bidirectional Unicode control character appears in filename.'); riskScore += 45; }
  if (/\/javascript|\/js|\/launch|openaction/i.test(rawText) && /pdf/i.test(ext)) { findings.push('PDF text contains active-content markers; static inspection cannot prove exploitability.'); riskScore += 35; }
  if (/(autoopen|document_open|vbaproject|powershell|wscript\.shell)/i.test(rawText) && /\.(docm?|xlsm?|pptm?|docx|xlsx|pptx)$/i.test(filename)) { findings.push('Office-like content contains macro/script markers; macro execution was not performed.'); riskScore += 35; }
  if (/\.(zip|rar|7z)$/i.test(ext) && /\.(exe|scr|bat|cmd|js|vbs|ps1)\b/i.test(rawText)) { findings.push('Archive text contains an executable/script filename marker; archive members were not fully unpacked in browser.'); riskScore += 30; }
  if (boundary.trailing_non_whitespace_bytes > 0) {
    findings.push(`Bytes were found after the detected ${type} end marker at offset ${boundary.primary_end_offset}; this is a format-boundary anomaly, not steganography detection or proof of malware.`);
    riskScore += 25;
  }
  boundary.embedded_signatures.forEach((signature) => {
    findings.push(`A ${signature.type} signature was found at byte offset ${signature.offset} immediately after the primary ${type} boundary; the file may be concatenated or multi-format. This static observation does not prove maliciousness.`);
    riskScore += /executable|ELF/i.test(signature.type) ? 60 : 35;
  });
  if (!findings.length) findings.push('No high-risk byte/name marker was observed by this browser-side static check. It is not a malware-clean verdict.');
  return {
    filename: filename || 'unnamed-file', extension: ext.toUpperCase(), detected_type: type,
    size_bytes: bytes.length, sha256: await sha256Hex(bytes), entropy: entropy(bytes),
    risk_score: Math.min(100, riskScore), risk_level: riskScore >= 70 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW',
    primary_end_offset: boundary.primary_end_offset, trailing_bytes: boundary.trailing_bytes, trailing_non_whitespace_bytes: boundary.trailing_non_whitespace_bytes,
    embedded_signatures: boundary.embedded_signatures,
    findings, scanner: 'Browser static inspection; no execution, sandbox, AV, YARA, steganography, or reputation lookup performed.',
  };
}

function parseRawEmail(rawText, filename, sourceMode) {
  const normalizedRawText = String(rawText || '').replace(/^(?:\r?\n)+/, '');
  const { headerText, body } = splitEmailText(normalizedRawText);
  const { headers, entries } = parseHeaderBlock(headerText);
  const sender = firstAddress(headers.from || headers.sender);
  const recipient = firstAddress(headers.to);
  const subject = clean(headers.subject) || filename || 'No subject';
  const replyTo = firstAddress(headers['reply-to']);
  const ips = extractIps(headers, headerText);
  const displayBody = extractMimeText(body, headers['content-type']);
  return { sourceMode, filename, rawText: normalizedRawText, headers, headerEntries: entries, body: displayBody, sender, recipient, subject, replyTo, ips, urls: extractUrls(`${headerText}\n${body}`), attachments: [] };
}

export function parseTextInput({ sender = '', recipient = '', subject = '', body = '' }) {
  const parsed = parseRawEmail(body, 'pasted-text.txt', 'text');
  const looksLikeHeaders = /^\s*(received|from|to|subject|date|message-id|authentication-results):/im.test(body);
  return {
    ...parsed,
    sourceMode: looksLikeHeaders ? 'text-headers' : 'text',
    sender: clean(sender) || parsed.sender,
    recipient: clean(recipient) || parsed.recipient,
    subject: clean(subject) || parsed.subject,
    body: looksLikeHeaders && parsed.body ? parsed.body : body,
    input_note: looksLikeHeaders ? 'Header-like lines were parsed from pasted text; cryptographic/DNS checks are not performed in browser.' : 'Only user-pasted content was analyzed; no transport headers were available unless included in the text.',
  };
}

export async function parseEmlFile(file) {
  const buffer = await file.arrayBuffer();
  const rawText = decodeBytes(buffer);
  const parsed = parseRawEmail(rawText, file.name, 'eml');
  const report = await inspectAttachment({ filename: file.name, buffer });
  return { ...parsed, rawBytes: buffer, rawHash: report.sha256, fileReport: report, input_note: 'RFC-style raw email text parsed locally. Authentication results are reported only, not independently verified.' };
}

export async function parseMsgFile(file) {
  const buffer = await file.arrayBuffer();
  try {
    const msgModule = await import('@kenjiuno/msgreader');
    const MsgReader = msgModule.default || msgModule;
    const reader = new MsgReader(buffer);
    const info = reader.getFileData();
    const headersText = clean(info.headers);
    const parsedHeaders = parseHeaderBlock(headersText);
    const sender = firstAddress(info.senderEmail || parsedHeaders.headers.from);
    const recipient = addressList((info.recipients || []).map((recipientInfo) => recipientInfo.email || recipientInfo.name).join(', ')).join(', ');
    const subject = clean(info.subject) || file.name;
    const attachments = [];
    (info.attachments || []).forEach((attachmentInfo) => {
      try {
        const attachment = reader.getAttachment(attachmentInfo);
        attachments.push({ filename: attachment.fileName || attachmentInfo.fileName || 'unnamed-attachment', content: attachment.content instanceof Uint8Array ? attachment.content : new Uint8Array(attachment.content || []) });
      } catch {
        attachments.push({ filename: attachmentInfo.fileName || 'attachment-unreadable', content: new Uint8Array() });
      }
    });
    const parsed = parseRawEmail(headersText, file.name, 'msg');
    return { ...parsed, sender, recipient, subject, body: clean(info.body), headers: parsedHeaders.headers, headerEntries: parsedHeaders.entries, attachments, rawBytes: buffer, input_note: 'Outlook MSG container parsed with a dedicated MSG reader. Embedded transport headers are shown when present; browser mode does not re-run DNS/cryptographic verification.' };
  } catch (error) {
    const report = await inspectAttachment({ filename: file.name, buffer });
    return { sourceMode: 'msg', filename: file.name, rawBytes: buffer, rawHash: report.sha256, sender: '', recipient: '', subject: '', body: '', headers: {}, headerEntries: [], ips: [], urls: [], attachments: [], fileReport: report, parseError: `MSG parsing failed: ${error?.message || 'unknown parser error'}`, input_note: 'This is a binary Outlook MSG file that could not be parsed. No sender, body, route, or attachment claims were invented.' };
  }
}

export async function buildEmailAnalysis(parsed) {
  const attachments = [];
  for (const attachment of parsed.attachments || []) attachments.push(await inspectAttachment(attachment));
  const headerFindings = headerAnomalies({ headers: parsed.headers || {}, sender: parsed.sender, replyTo: parsed.replyTo });
  const categoryCandidate = classifyMail({ subject: parsed.subject, body: parsed.body, sender: parsed.sender, urls: parsed.urls || [], attachments, threatScore: 0 });
  const threat = assessTextSignals({ subject: parsed.subject, body: parsed.body, sender: parsed.sender, urls: parsed.urls || [], attachments, headerFindings, headers: parsed.headers || {}, categoryId: categoryCandidate.category_id });
  const categoryAnalysis = classifyMail({ subject: parsed.subject, body: parsed.body, sender: parsed.sender, urls: parsed.urls || [], attachments, threatScore: threat.risk_score });
  const rawHash = parsed.rawHash || await sha256Hex(new TextEncoder().encode(parsed.rawText || parsed.body || ''));
  return {
    mode: parsed.sourceMode,
    parseError: parsed.parseError || null,
    case_id: `CS-${rawHash.slice(0, 12).toUpperCase()}`,
    format_type: parsed.sourceMode === 'msg' ? 'Outlook MSG' : parsed.sourceMode === 'eml' ? 'RFC Email / EML' : parsed.sourceMode === 'text-headers' ? 'Pasted Headers + Text' : 'Pasted Text',
    filename: parsed.filename,
    parsed: { ...parsed, rawBytes: undefined, rawText: undefined, attachments: undefined, sha256_hash: rawHash },
    threat,
    category_analysis: categoryAnalysis,
    dns_auth: authenticationSnapshot(parsed.headers || {}),
    relay_info: { ips: parsed.ips || [], hop_count: parsed.ips?.length || 0, status: parsed.ips?.length ? 'Visible IPs extracted from submitted header fields' : 'No public IP extracted from submitted headers', note: 'IP extraction does not prove original sender identity or physical location.' },
    geo_data: { status: 'NOT LOOKED UP', sender: null, receiver: null, note: 'No analyst/device IP fallback. Browser mode does not send extracted IPs to a geolocation provider.' },
    aitm_analysis: parsed.urls || [],
    attachment_analysis: attachments,
    authorship_analysis: { classification: 'NOT ASSESSED', ai_likeness_percent: null, confidence: 'N/A', observed_indicators: [], explanation: 'AI-generated text detection is intentionally not claimed by this web-only heuristic flow.' },
    header_findings: headerFindings,
    evidence: { sha256: rawHash, raw_size_bytes: parsed.rawBytes?.byteLength || null, preservation: 'Browser session only; upload to an immutable evidence vault is not performed by this static web app.' },
    limitations: [parsed.input_note, 'Risk score is heuristic triage, not a probability.', 'No external threat-intelligence, DNS, sandbox, AV, YARA, or cryptographic verification was performed in browser mode.'],
  };
}

export async function analyzeStandaloneAttachment(file) {
  const report = await inspectAttachment({ filename: file.name, buffer: await file.arrayBuffer() });
  const categoryAnalysis = classifyMail({ subject: file.name, body: '', sender: '', attachments: [report], threatScore: report.risk_score });
  return {
    mode: 'attachment', case_id: `FILE-${report.sha256.slice(0, 12).toUpperCase()}`, format_type: 'Standalone Attachment', filename: file.name,
    attachment_analysis: [report], category_analysis: categoryAnalysis, threat: { risk_score: report.risk_score, status: report.risk_level === 'HIGH' ? 'HIGH RISK' : report.risk_level === 'MEDIUM' ? 'REVIEW' : 'NO HIGH-RISK MARKER OBSERVED', signals: report.findings, score_breakdown: { positive_contributors: report.risk_score > 0 ? [{ label: 'Static attachment marker(s)', points: report.risk_score, evidence: report.findings.join('; '), source: 'attachment-static-check' }] : [], deductions: [], positive_total: report.risk_score, adjustment_total: 0, final_score: report.risk_score, formula: `${report.risk_score} observed attachment points plus 0 adjustments = ${report.risk_score} final triage score` }, note: 'Static browser check only; absence of a marker is not a clean-malware verdict.' },
    parsed: { meta: { filename: file.name, size_bytes: report.size_bytes }, sha256_hash: report.sha256 },
    geo_data: { status: 'NOT APPLICABLE', note: 'Standalone file has no email transport route.' }, dns_auth: null, relay_info: null, aitm_analysis: [], authorship_analysis: null,
    evidence: { sha256: report.sha256, raw_size_bytes: report.size_bytes, preservation: 'Browser session only; not an immutable forensic archive.' }, limitations: [report.scanner],
  };
}

export { EMAIL_EXTENSIONS, ATTACHMENT_EXTENSIONS, extensionOf };
