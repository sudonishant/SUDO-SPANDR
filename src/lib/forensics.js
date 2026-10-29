import PostalMime from 'postal-mime';
import taxonomy from '../../shared/category_taxonomy.json';
import scoringRules from '../../shared/scoring_rules.json';
import {
  addressDomain,
  authenticationContext as buildAuthenticationContext,
  authenticationSnapshot as buildAuthenticationSnapshot,
  decodeHeaderValue,
  domainAlignment,
  headerAnomalies as findHeaderAnomalies,
  organizationDomain,
  relayHops as buildRelayHops,
  reviewDomain,
} from './emailIntelligence';

const CATEGORY_DEFINITIONS = Object.fromEntries(taxonomy.categories.map((category) => [category.id, category]));
const EMAIL_EXTENSIONS = ['eml', 'msg'];
const ATTACHMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip', 'rar', '7z', 'txt', 'html', 'htm', 'js', 'vbs', 'ps1', 'exe', 'apk'];

const AUTHENTICATION_METHODS = ['spf', 'dkim', 'dmarc', 'arc'];
const PUBLIC_IPV4 = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?![\d.])/g;
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`]+/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const RISK_RULES = [
  { id: 'urgency', label: 'Urgency or pressure language', weight: 12, pattern: /\b(urgent|immediately|asap|action required|within \d+ hours|within 24 hours|final notice|today|now|deadline|before (?:eod|close of business)|account (?:will be|gets) (?:closed|suspended|locked)|permanent closure|expires?)\b/i },
  { id: 'credential', label: 'Credential, account or login request', weight: 20, pattern: /\b(password|login|log into|sign in|verify your (?:account|identity)|confirm your (?:account|identity)|credential|one[- ]time (?:password|code)|otp|security code|session expired|webmail|account suspended|unusual sign[- ]in|update your account|recovery code)\b/i },
  { id: 'financial', label: 'Financial, payment or beneficiary request', weight: 22, pattern: /\b(wire transfer|bank account|bank details|account details|beneficiary|payment|invoice|gift card|crypto|bitcoin|remittance|change.*account|funds|upi|neft|rtgs|imps|swift|iban|payment details)\b/i },
  { id: 'secrecy', label: 'Secrecy, callback avoidance or bypass language', weight: 10, pattern: /\b(do not call|cannot take calls?|no calls?|keep confidential|keep this between us|do not tell|do not inform|don['’]t tell|bypass|secret|discreet|confidential acquisition)\b/i },
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

function extractMimeText(rawBody = '', contentType = '', transferEncoding = '') {
  const boundary = String(contentType).match(/boundary\s*=\s*"?([^";]+)"?/i)?.[1];
  if (!boundary) return stripHtml(/quoted-printable/i.test(transferEncoding) ? decodeQuotedPrintableText(rawBody) : rawBody);
  const parts = rawBody.split(`--${boundary}`);
  let htmlCandidate = '';
  for (const part of parts) {
    const separator = part.match(/\r?\n\r?\n/);
    if (!separator) continue;
    const index = separator.index ?? 0;
    const partHeaders = parseHeaderBlock(part.slice(0, index)).headers;
    const encodedContent = part.slice(index + separator[0].length).replace(/--\s*$/, '');
    const content = /quoted-printable/i.test(partHeaders['content-transfer-encoding'] || '') ? decodeQuotedPrintableText(encodedContent) : encodedContent;
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

function isIpv4Address(value = '') {
  const parts = String(value).split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isIpv6Address(value = '') {
  const input = clean(value).replace(/^IPv6:/i, '').replace(/%.*$/, '');
  if (!input.includes(':') || input.split('::').length > 2) return false;
  const compressed = input.includes('::');
  const [head = '', tail = ''] = input.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const parts = [...headParts, ...tailParts];
  if (parts.some((part) => !part)) return false;
  let units = parts.length;
  parts.forEach((part, index) => {
    if (index === parts.length - 1 && part.includes('.')) {
      if (!isIpv4Address(part)) units = -1;
      else units += 1;
    } else if (!/^[0-9a-f]{1,4}$/i.test(part)) units = -1;
  });
  if (units < 0) return false;
  return compressed ? units < 8 : units === 8;
}

function ipv6Candidates(value = '') {
  const text = String(value);
  const candidates = new Set();
  for (const match of text.matchAll(/\[([^\]\r\n]+)\]/g)) if (match[1].includes(':')) candidates.add(match[1]);
  text.split(/[\s,;()<>]+/).forEach((token) => { if (token.includes(':')) candidates.add(token); });
  return [...candidates].map((candidate) => clean(candidate).replace(/^IPv6:/i, '').replace(/^[[(]+/, '').replace(/[\]),;.]+$/, '')).filter(isIpv6Address);
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
    const text = String(value);
    [...text.matchAll(PUBLIC_IPV4)].forEach((match) => {
      // Do not turn the dotted tail of an IPv4-mapped IPv6 address into a
      // separate public IPv4 observation before the API boundary sees it.
      if (text[Math.max(0, (match.index || 0) - 1)] === ':') return;
      if (isIpv4Address(match[0])) values.push({ ip: match[0], field });
    });
    ipv6Candidates(value).forEach((ip) => values.push({ ip, field }));
  });
  const seen = new Set();
  return values.filter(({ field, ip }) => {
    const key = `${field}\u0000${ip.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractUrls(rawText = '') {
  // Input is decoded by the MIME/MSG parser. Blindly applying quoted-printable
  // decoding here would corrupt ordinary query strings such as "session=ae91".
  const normalizedText = String(rawText);
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
      const domainFindings = isAsset ? [] : reviewDomain(hostname);
      if (!isAsset && url.protocol !== 'https:') reasons.push('Not HTTPS');
      if (!isAsset && (url.username || url.password)) reasons.push('URL contains userinfo; the visible prefix can hide the real destination');
      if (!isAsset && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) reasons.push('IP-literal hostname instead of a domain name');
      if (!isAsset && url.port && !['80', '443'].includes(url.port)) reasons.push(`Non-standard web port ${url.port}`);
      if (!isAsset && !isTracking && hostname.split('.').length > 3) reasons.push('Deep subdomain');
      if (!isAsset && /[0-9]{7,}/.test(hostname)) reasons.push('Numeric hostname pattern');
      if (!isAsset && /(login|verify|secure|auth|account|payment|update)/i.test(`${url.pathname} ${hostname}`)) reasons.push('Credential/payment-themed path or hostname');
      reasons.push(...domainFindings.map((item) => item.label));
      return { url: rawUrl, domain: hostname, risk: reasons.length ? 'REVIEW' : 'UNASSESSED', kind: isAsset ? 'email asset/reference' : isTracking ? 'tracking redirect' : 'actionable link', reasons, domain_findings: domainFindings };
    } catch {
      return { url: rawUrl, domain: 'Invalid URL', risk: 'REVIEW', kind: 'unparsed', reasons: ['URL parser rejected this value'] };
    }
  });
}

function decodeHtmlEntities(value = '') {
  return String(value).replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

function combineMessageText(text = '', html = '') {
  const plain = clean(text);
  const htmlText = clean(stripHtml(decodeHtmlEntities(html)));
  if (plain && htmlText) {
    if (plain.includes(htmlText)) return plain;
    if (htmlText.includes(plain)) return htmlText;
    return `${plain}\n${htmlText}`;
  }
  return plain || htmlText;
}

function extractHtmlLinkFindings(html = '') {
  if (!html) return [];
  const findings = [];
  const anchorPattern = /<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html).matchAll(anchorPattern)) {
    const href = decodeHtmlEntities(match[1] || match[2] || match[3] || '').trim();
    const visibleText = clean(stripHtml(decodeHtmlEntities(match[4] || '')));
    if (/^(?:javascript|data):/i.test(href)) {
      findings.push({ id: 'active-link-scheme', label: 'HTML link uses an active/data scheme', weight: 20, evidence: `${href.slice(0, 80)} is not an ordinary web destination and requires static review.` });
      continue;
    }
    if (!/^https?:\/\//i.test(href)) continue;
    const visibleHost = visibleText.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(?:\/|\s|$)/i)?.[1];
    if (!visibleHost) continue;
    try {
      const destinationHost = new URL(href).hostname;
      if (!domainAlignment(visibleHost, destinationHost).aligned) {
        findings.push({ id: 'link-text-mismatch', label: 'Visible link text and actual destination differ', weight: 16, evidence: `Link text suggests ${visibleHost}, but the HTML destination is ${destinationHost}.` });
      }
    } catch { /* The URL extractor records malformed HTTP values separately. */ }
    if (findings.length >= 5) break;
  }
  return findings;
}

function authenticationSnapshot(headers, headerEntries = [], sender = '') {
  return buildAuthenticationSnapshot(headers, headerEntries, sender);
}

function headerAnomalies({ headers, sender, replyTo, fromName = '', sourceMode = '', headerEntries = [] }) {
  return findHeaderAnomalies({ headers, sender, replyTo, fromName, sourceMode, headerEntries });
}

function authenticationContext(headers = {}, headerEntries = [], sender = '') {
  return buildAuthenticationContext(headers, headerEntries, sender);
}

function assessTextSignals({ subject, body, sender, urls, attachments, headerFindings, contentFindings = [], headers = {}, headerEntries = [] }) {
  const text = `${subject}\n${body}`;
  const signals = [];
  const adjustments = [];
  let baselineScore = 0;
  const addSignal = (signal) => {
    const weight = Number(signal.weight || 0);
    baselineScore += weight;
    signals.push({ ...signal, weight, evidence: signal.evidence || 'Observed in submitted evidence' });
  };

  RISK_RULES.forEach((rule) => {
    if (rule.pattern.test(text)) addSignal({ id: rule.id, label: rule.label, weight: rule.weight, evidence: 'Matched in decoded subject, plain-text and/or HTML message content.' });
  });
  urls.filter((url) => url.risk === 'REVIEW').forEach((url) => {
    addSignal({ id: 'url-review', label: `URL requires review: ${url.domain}`, weight: scoringRules.content_weights.url_review, evidence: url.reasons.join(', ') || 'URL structure' });
  });
  attachments.filter((attachment) => attachment.risk_level !== 'LOW').forEach((attachment) => {
    const weight = Math.min(scoringRules.content_weights.attachment, attachment.risk_score || 0);
    addSignal({ id: 'attachment-review', label: `Attachment requires review: ${attachment.filename}`, weight, evidence: attachment.findings.join('; ') });
  });
  [...headerFindings, ...contentFindings].forEach((finding) => addSignal(finding));

  const has = (id) => signals.some((signal) => signal.id === id);
  const combinations = [
    { when: has('credential') && has('urgency'), id: 'combo-credential-pressure', label: 'Credential request is combined with pressure language', weight: scoringRules.combination_weights?.credential_pressure ?? 8 },
    { when: has('financial') && (has('urgency') || has('secrecy')), id: 'combo-payment-pressure', label: 'Payment request is combined with urgency or secrecy', weight: scoringRules.combination_weights?.payment_pressure ?? 10 },
    { when: has('reply-to-mismatch') && (has('financial') || has('credential')), id: 'combo-reply-path-request', label: 'Reply-path mismatch amplifies a payment or credential request', weight: scoringRules.combination_weights?.reply_path_request ?? 10 },
    { when: has('link-text-mismatch') && has('credential'), id: 'combo-misleading-credential-link', label: 'Misleading destination is combined with a credential request', weight: scoringRules.combination_weights?.misleading_credential_link ?? 8 },
    { when: has('financial') && (has('display-name-review') || has('display-name-domain-mismatch') || has('lookalike-domain')), id: 'combo-authority-payment', label: 'Authority or look-alike identity is combined with a payment request', weight: scoringRules.combination_weights?.authority_payment ?? 10 },
  ];
  combinations.filter((item) => item.when).forEach((item) => addSignal({ id: item.id, label: item.label, weight: item.weight, evidence: 'Added only because all listed evidence signals co-occur; this is a transparent combination rule, not an AI inference.' }));

  let score = baselineScore;
  const auth = authenticationContext(headers, headerEntries, sender);
  if (auth.any_fail) {
    const points = scoringRules.authentication_adjustments.any_fail;
    score += points;
    adjustments.push({ label: `Authentication failure reported${auth.failed_methods.length ? `: ${auth.failed_methods.join(', ')}` : ''}`, points, evidence: 'Receiver-reported fail/permerror/hardfail in submitted headers; independently re-verify before attribution.', source: 'authentication-header-check' });
  } else if (auth.spf_softfail) {
    const points = scoringRules.authentication_adjustments.spf_softfail ?? 16;
    score += points;
    adjustments.push({
      label: `SPF softfail reported${auth.spf_softfail_count > 1 ? ` · ${auth.spf_softfail_count} submitted results` : ''}`,
      points,
      evidence: 'Receiver-reported SPF softfail is weaker than SPF fail and is not proof of spoofing. Repeated copies of the same submitted disposition are not scored multiple times.',
      source: 'authentication-header-check',
    });
  } else if (auth.passes_without_visible_from_alignment && (has('financial') || has('credential') || has('reply-to-mismatch'))) {
    const points = scoringRules.authentication_adjustments.unaligned_pass_with_request ?? 8;
    score += points;
    adjustments.push({ label: 'Reported protocol pass does not validate the visible From domain', points, evidence: 'SPF/DKIM pass evidence lacks visible-From alignment while a sensitive request is present. DMARC alignment was not independently recomputed.', source: 'authentication-alignment-check' });
  }

  const bounded = Math.max(scoringRules.limits.min, Math.min(scoringRules.limits.max, score));
  const status = bounded >= scoringRules.thresholds.high ? 'HIGH RISK' : bounded >= scoringRules.thresholds.review ? 'REVIEW' : 'NO HIGH-RISK SIGNALS OBSERVED';
  const positiveContributors = signals.map((signal) => ({ label: signal.label, points: Number(signal.weight || 0), evidence: signal.evidence || 'Observed in submitted evidence', source: signal.id || 'deterministic-rule' })).filter((item) => item.points > 0);
  const deductions = adjustments.map((adjustment) => ({ label: adjustment.label, points: Number(adjustment.points || 0), evidence: adjustment.evidence || 'Context adjustment from submitted authentication evidence', source: adjustment.source || 'shared-scoring-rules' }));
  const adjustmentTotal = deductions.reduce((total, item) => total + item.points, 0);
  return {
    risk_score: bounded,
    baseline_score: baselineScore,
    adjustments,
    authentication_context: auth,
    status,
    signals,
    score_breakdown: {
      positive_contributors: positiveContributors,
      deductions,
      positive_total: baselineScore,
      adjustment_total: adjustmentTotal,
      final_score: bounded,
      formula: `${baselineScore} observed points ${adjustmentTotal >= 0 ? '+' : '-'} ${Math.abs(adjustmentTotal)} authentication/context adjustment = ${bounded} final triage score`,
    },
    note: scoringRules.confidence_note,
  };
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

function classifyMail({ subject = '', body = '', sender = '', urls = [], attachments = [], threatScore = 0, authenticationReview = false }) {
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
  if (!evidence.length && bodyWords >= 8 && !authenticationReview) {
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
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1) return 'OLE compound document (CFB)';
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

export async function inspectAttachment({ filename, buffer, content }) {
  // `content` is an accepted alias for `buffer` (MSG attachment readers return `content`)
  const source = buffer !== undefined ? buffer : content;
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source || new ArrayBuffer(0));
  const ext = extensionOf(filename);
  const type = magicType(bytes);
  const rawText = decodeBytes(bytes.slice(0, Math.min(bytes.length, 2_000_000)));
  const findings = [];
  let riskScore = 0;
  const boundary = formatBoundaryInspection(bytes, type);
  const executableType = /executable/i.test(type);
  const documentLike = /^(pdf|zip|rar|png|jpeg|gif|doc|docx|xls|xlsx|ppt|pptx|rtf|csv|txt|html|htm)$/i.test(ext) || ['PDF', 'ZIP / Office Open XML container', 'RAR archive', 'PNG image', 'JPEG image', 'GIF image', 'OLE compound document (CFB)'].includes(type);
  if (executableType && documentLike) { findings.push('File extension/content mismatch: executable magic bytes detected for a document/media-looking file.'); riskScore += 80; }
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|jpg|png|zip)\.(exe|scr|bat|cmd|js|vbs|ps1|hta|jar)$/i.test(filename)) { findings.push('Double-extension filename requires review.'); riskScore += 45; }
  if (/[\u202a-\u202e\u2066-\u2069]/.test(filename)) { findings.push('Bidirectional Unicode control character appears in filename.'); riskScore += 45; }
  if (/\/javascript|\/js|\/launch|openaction/i.test(rawText) && /pdf/i.test(ext)) { findings.push('PDF text contains active-content markers; static inspection cannot prove exploitability.'); riskScore += 35; }
  if (/(autoopen|document_open|vbaproject|powershell|wscript\.shell)/i.test(rawText) && /\.(docm?|xlsm?|pptm?|docx|xlsx|pptx)$/i.test(filename)) { findings.push('Office-like content contains macro/script markers; macro execution was not performed.'); riskScore += 35; }
  if (/\.(js|vbs|ps1|hta|bat|cmd|wsf|jse)$/i.test(filename) || /OLE compound/.test(type)) {
    if (/(wscript\.shell|powershell|cmd\.exe|activeXObject|eval\(|frombase64string|createobject|autoopen|document_open|vbaproject|msxml2\.xmlhttp)/i.test(rawText)) {
      findings.push('Script/document contains execution, download or macro-launch markers (static strings only; nothing was executed).');
      riskScore += 45;
    }
  }
  if (/\.(html?|mht)$/i.test(filename) && /<\s*script/i.test(rawText)) {
    findings.push('HTML content contains embedded script; possible redirect/drive-by lure.');
    riskScore += 25;
    if (/https?:\/\/[^\s"'<>]+/i.test(rawText)) { findings.push('HTML references an external URL from inside the document.'); riskScore += 15; }
  }
  if (/powershell.{0,40}(-enc|-encodedcommand)/i.test(rawText)) {
    findings.push('Encoded PowerShell command pattern observed in strings.');
    riskScore += 30;
  }
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

function postalAddress(value) {
  if (!value) return '';
  if (value.address) return clean(value.address);
  if (Array.isArray(value.group)) return value.group.map((item) => postalAddress(item)).filter(Boolean).join(', ');
  return '';
}

function postalAddressList(values) {
  return (Array.isArray(values) ? values : values ? [values] : []).flatMap((value) => postalAddress(value).split(',')).map(clean).filter(Boolean);
}

function firstUsefulEmail(...values) {
  for (const value of values) {
    const address = firstAddress(value);
    if (address.includes('@')) return address;
  }
  return clean(values.find((value) => clean(value)) || '');
}

function parseRawEmail(rawText, filename, sourceMode) {
  const normalizedRawText = String(rawText || '').replace(/^(?:\r?\n)+/, '');
  const { headerText, body } = splitEmailText(normalizedRawText);
  const { headers, entries } = parseHeaderBlock(headerText);
  const sender = firstAddress(headers.from || headers.sender);
  const recipient = firstAddress(headers.to);
  const subject = decodeHeaderValue(headers.subject) || filename || 'No subject';
  const replyTo = firstAddress(headers['reply-to']);
  const ips = extractIps(headers, headerText);
  const displayBody = extractMimeText(body, headers['content-type'], headers['content-transfer-encoding']);
  const html = /text\/html/i.test(headers['content-type'] || '') ? body : '';
  return {
    sourceMode, filename, rawText: normalizedRawText, headers, headerEntries: entries, body: displayBody, sender, recipient, subject, replyTo, ips,
    fromName: decodeHeaderValue(headers.from || '').replace(/<[^>]+>/g, '').replace(/^['"]|['"]$/g, '').trim(),
    urls: extractUrls(`${headerText}\n${displayBody}`), contentFindings: extractHtmlLinkFindings(html), attachments: [],
    message_structure: { parser: 'Built-in pasted-text parser', plain_text_present: Boolean(displayBody), html_present: Boolean(html), attachment_count: 0, transport_headers_present: Boolean(entries.length) },
  };
}

/* Carve MIME attachment parts (base64 or text) out of a raw EML body so
   attachment scoring works on .eml intake, not just the deep-lab engine. */
function extractMimeAttachments(rawText) {
  const text = String(rawText || '');
  const attachments = [];
  const boundaryMatch = text.match(/boundary="?([^";\r\n]+)"?/i);
  const parts = boundaryMatch
    ? text.split(`--${boundaryMatch[1]}`).slice(1)
    : [text];
  parts.forEach((part) => {
    const head = (part.split(/\r?\n\r?\n/)[0] || '');
    if (!/content-disposition:\s*attachment/i.test(head) && !/filename\*?=/i.test(head)) return;
    const nameMatch = head.match(/filename\*?="?([^";\r\n]+)"?/i) || head.match(/name="?([^";\r\n]+)"?/i);
    const filename = clean(nameMatch ? nameMatch[1] : '') || 'unnamed-attachment';
    const bodyText = part.slice(part.search(/\r?\n\r?\n/) >= 0 ? part.search(/\r?\n\r?\n/) + 2 : 0);
    let bytes;
    if (/content-transfer-encoding:\s*base64/i.test(head)) {
      const b64 = bodyText.replace(/\s+/g, '');
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(bodyText.replace(/\r?\n/g, '\r\n'));
    }
    if (bytes.length) attachments.push({ filename, buffer: bytes });
  });
  return attachments;
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
  const report = await inspectAttachment({ filename: file.name, buffer });
  try {
    const email = await PostalMime.parse(buffer, {
      attachmentEncoding: 'arraybuffer',
      rfc822Attachments: true,
      maxNestingDepth: 32,
      maxRfc822NestingDepth: 3,
      maxHeadersSize: 1_000_000,
      maxPartCount: 2000,
    });
    const headerEntries = (email.headers || []).map((header) => ({ name: header.originalKey || header.key, value: clean(header.value) }));
    const headers = {};
    headerEntries.forEach(({ name, value }) => {
      const key = String(name).toLowerCase();
      headers[key] = headers[key] ? `${headers[key]}\n${value}` : value;
    });
    const headerText = headerEntries.map((entry) => `${entry.name}: ${entry.value}`).join('\n');
    const sender = firstUsefulEmail(postalAddress(email.from), postalAddress(email.sender), headers.from, headers.sender);
    const recipient = postalAddressList(email.to).join(', ') || firstAddress(headers.to);
    const replyTo = postalAddressList(email.replyTo)[0] || firstAddress(headers['reply-to']);
    const subject = clean(email.subject) || decodeHeaderValue(headers.subject) || file.name || 'No subject';
    const body = combineMessageText(email.text, email.html);
    const attachments = (email.attachments || []).map((attachment, index) => ({
      filename: clean(attachment.filename) || `unnamed-attachment-${index + 1}`,
      buffer: attachment.content instanceof Uint8Array ? attachment.content : new Uint8Array(attachment.content || new ArrayBuffer(0)),
    }));
    return {
      sourceMode: 'eml', filename: file.name, rawText: decodeBytes(buffer), rawBytes: buffer, rawHash: report.sha256, fileReport: report,
      headers, headerEntries, body, sender, recipient, subject, replyTo,
      fromName: clean(email.from?.name) || decodeHeaderValue(headers.from || '').replace(/<[^>]+>/g, '').replace(/^['"]|['"]$/g, '').trim(),
      ips: extractIps(headers, headerText),
      urls: extractUrls(`${headerText}\n${subject}\n${email.text || ''}\n${email.html || ''}`),
      contentFindings: extractHtmlLinkFindings(email.html),
      attachments,
      message_structure: {
        parser: 'PostalMime · RFC MIME decoding', plain_text_present: Boolean(clean(email.text)), html_present: Boolean(clean(email.html)),
        attachment_count: attachments.length, inline_attachment_count: (email.attachments || []).filter((item) => item.disposition === 'inline').length,
        transport_headers_present: Boolean(headerEntries.length), header_count: headerEntries.length,
      },
      input_note: 'EML parsed locally with standards-oriented nested MIME, charset, base64 and quoted-printable decoding. Plain text and HTML are analyzed separately before triage. Authentication results remain receiver-reported, not independently verified.',
    };
  } catch (error) {
    const rawText = decodeBytes(buffer);
    const parsed = parseRawEmail(rawText, file.name, 'eml');
    try { parsed.attachments = extractMimeAttachments(rawText); } catch { parsed.attachments = []; }
    return {
      ...parsed, rawBytes: buffer, rawHash: report.sha256, fileReport: report,
      parseError: `PostalMime could not fully parse this EML (${error?.message || 'unknown parser error'}); a limited built-in fallback was used.`,
      input_note: 'Deep EML parsing was incomplete. The result uses a limited fallback and must not be treated as a complete MIME inspection.',
    };
  }
}

export function normalizeMsgData(info, { filename = 'message.msg', attachments = [], containerReport = null, rawBytes = new Uint8Array() } = {}) {
  const headersText = clean(info.headers);
  const parsedHeaders = parseHeaderBlock(headersText);
  const sender = firstUsefulEmail(info.senderSmtpAddress, info.senderEmail, info.sentRepresentingSmtpAddress, info.creatorSMTPAddress, parsedHeaders.headers.from, parsedHeaders.headers.sender);
  const recipient = addressList((info.recipients || []).map((recipientInfo) => recipientInfo.email || recipientInfo.name).join(', ')).join(', ') || firstAddress(parsedHeaders.headers.to);
  const subject = clean(info.subject) || decodeHeaderValue(parsedHeaders.headers.subject) || filename;
  const parsed = parseRawEmail(headersText, filename, 'msg');
  const htmlSource = typeof info.bodyHtml === 'string' ? info.bodyHtml : typeof info.html === 'string' ? info.html : info.html ? decodeBytes(info.html) : '';
  const bodyText = combineMessageText(info.body, htmlSource);
  return {
    ...parsed,
    sender,
    recipient,
    subject,
    body: bodyText,
    fromName: clean(info.senderName) || parsed.fromName,
    headers: parsedHeaders.headers,
    headerEntries: parsedHeaders.entries,
    attachments: (attachments || []).map((attachment, index) => ({
      filename: attachment.filename || attachment.fileName || `unnamed-attachment-${index + 1}`,
      buffer: attachment.buffer || attachment.content || new Uint8Array(),
    })),
    // Analyze both MSG plain and HTML bodies. A plain-body-only flow misses
    // HTML-only credential lures and their actual link destinations.
    urls: extractUrls(`${headersText}\n${subject}\n${info.body || ''}\n${htmlSource}`),
    contentFindings: extractHtmlLinkFindings(htmlSource),
    message_structure: {
      parser: '@kenjiuno/msgreader · Outlook property decoding', plain_text_present: Boolean(clean(info.body)), html_present: Boolean(clean(htmlSource)),
      attachment_count: attachments.length, transport_headers_present: Boolean(headersText), header_count: parsedHeaders.entries.length,
    },
    rawBytes,
    rawHash: containerReport?.sha256,
    fileReport: containerReport,
    input_note: 'Outlook MSG container parsed with a dedicated MSG reader. Plain and HTML bodies are analyzed when present. Embedded transport headers are shown when available; missing headers are reported as unavailable rather than reconstructed as original evidence.',
  };
}

export async function parseMsgFile(file) {
  const buffer = await file.arrayBuffer();
  // Hash the original MSG container even when parsing succeeds. Previously a
  // successful parse could accidentally hash only the reconstructed headers.
  const containerReport = await inspectAttachment({ filename: file.name, buffer });
  try {
    const msgModule = await import('@kenjiuno/msgreader');
    // CJS/ESM interop differs between bundlers (vite, esbuild, node) — resolve
    // every known shape before falling back; a wrong shape here silently zeroed
    // every .msg score in the past ("MsgReader is not a constructor").
    const MsgReader = typeof msgModule.default === 'function' ? msgModule.default
      : typeof msgModule.default?.default === 'function' ? msgModule.default.default
        : typeof msgModule.MsgReader === 'function' ? msgModule.MsgReader
          : msgModule.default || msgModule;
    if (typeof MsgReader !== 'function') throw new Error('MSG reader module did not expose a constructor');
    const reader = new MsgReader(buffer);
    const info = reader.getFileData();
    const attachments = [];
    (info.attachments || []).forEach((attachmentInfo) => {
      try {
        const attachment = reader.getAttachment(attachmentInfo);
        attachments.push({ filename: attachment.fileName || attachmentInfo.fileName || 'unnamed-attachment', content: attachment.content instanceof Uint8Array ? attachment.content : new Uint8Array(attachment.content || []) });
      } catch {
        attachments.push({ filename: attachmentInfo.fileName || 'attachment-unreadable', content: new Uint8Array() });
      }
    });
    return normalizeMsgData(info, { filename: file.name, attachments, containerReport, rawBytes: buffer });
  } catch (error) {
    return { sourceMode: 'msg', filename: file.name, rawBytes: buffer, rawHash: containerReport.sha256, sender: '', recipient: '', subject: '', body: '', headers: {}, headerEntries: [], ips: [], urls: [], attachments: [], fileReport: containerReport, parseError: `MSG parsing failed: ${error?.message || 'unknown parser error'}`, input_note: 'This is a binary Outlook MSG file that could not be parsed. No sender, body, route, or attachment claims were invented.' };
  }
}

export async function buildEmailAnalysis(parsed) {
  const attachments = [];
  for (const attachment of parsed.attachments || []) attachments.push(await inspectAttachment(attachment));
  const headers = parsed.headers || {};
  const headerEntries = parsed.headerEntries || [];
  const headerFindings = headerAnomalies({ headers, sender: parsed.sender, replyTo: parsed.replyTo, fromName: parsed.fromName, sourceMode: parsed.sourceMode, headerEntries });
  const contentFindings = parsed.contentFindings || [];
  const dnsAuth = authenticationSnapshot(headers, headerEntries, parsed.sender);
  const categoryCandidate = classifyMail({ subject: parsed.subject, body: parsed.body, sender: parsed.sender, urls: parsed.urls || [], attachments, threatScore: 0 });
  const threat = assessTextSignals({ subject: parsed.subject, body: parsed.body, sender: parsed.sender, urls: parsed.urls || [], attachments, headerFindings, contentFindings, headers, headerEntries, categoryId: categoryCandidate.category_id });
  const categoryAnalysis = classifyMail({
    subject: parsed.subject, body: parsed.body, sender: parsed.sender, urls: parsed.urls || [], attachments, threatScore: threat.risk_score,
    authenticationReview: threat.authentication_context.any_fail || threat.authentication_context.spf_softfail,
  });
  const rawHash = parsed.rawHash || await sha256Hex(new TextEncoder().encode(parsed.rawText || parsed.body || ''));
  const hops = buildRelayHops(headerEntries);
  const explanations = [];
  if (!dnsAuth.results.length) explanations.push('No supported receiver authentication result was parsed. Missing Authentication-Results is not treated as proof of either legitimacy or spoofing.');
  if (dnsAuth.alignment.reported_dmarc_fail) explanations.push('A submitted receiver header reports DMARC failure for the visible author domain. Independently verify the receiver and original authentication evidence.');
  if (threat.authentication_context.spf_softfail) explanations.push(`Submitted receiver evidence reports SPF softfail${threat.authentication_context.spf_softfail_count > 1 ? ` in ${threat.authentication_context.spf_softfail_count} result fields` : ''}. This is a review signal weaker than SPF fail; it does not independently prove spoofing or malicious content.`);
  if (dnsAuth.alignment.visible_from_reported_validated) explanations.push('At least one reported result supports visible-From validation or alignment. This addresses an authentication layer only; it does not make the message content, links or requests trustworthy.');
  if (dnsAuth.alignment.passes_without_visible_from_alignment) explanations.push('SPF/DKIM pass evidence is present without demonstrated alignment to the visible From domain. A protocol pass—including HELO-only SPF or a signature for another domain—must not be read as validation of the displayed sender.');
  if (threat.authentication_context.mixed_methods.length) explanations.push(`Conflicting results appear for ${threat.authentication_context.mixed_methods.join(', ')} across submitted headers. All results are retained instead of silently selecting one.`);
  if (parsed.message_structure?.html_present) explanations.push('HTML content was decoded and inspected for text signals, destinations and display-versus-destination mismatches; it was not rendered or executed.');
  explanations.push('Scoring is additive: reported authentication passes and benign-looking category labels do not subtract from observed threat signals.');

  const fromDomain = addressDomain(parsed.sender);
  const replyDomain = addressDomain(parsed.replyTo);
  const returnPath = firstAddress(headers['return-path']);
  const returnDomain = addressDomain(returnPath);
  const deepEmail = {
    message_structure: parsed.message_structure || { parser: 'Built-in parser', transport_headers_present: Boolean(headerEntries.length) },
    identity: {
      visible_from: parsed.sender || 'Not parsed', display_name: parsed.fromName || 'Not parsed',
      from_domain: fromDomain || 'Not parsed', from_organization_domain: organizationDomain(fromDomain) || 'Not parsed',
      reply_to: parsed.replyTo || 'Not present', reply_to_domain: replyDomain || 'Not present',
      return_path: returnPath || 'Not present', return_path_domain: returnDomain || 'Not present',
      return_path_alignment: domainAlignment(fromDomain, returnDomain),
    },
    authentication_alignment: dnsAuth.alignment,
    content_findings: contentFindings,
    top_findings: [
      ...threat.signals.map((signal) => ({ label: signal.label, weight: Number(signal.weight || 0), evidence: signal.evidence })),
      ...threat.adjustments.map((adjustment) => ({ label: adjustment.label, weight: Number(adjustment.points || 0), evidence: adjustment.evidence })),
    ].sort((a, b) => b.weight - a.weight).slice(0, 6),
    explanations,
    score_policy: 'Observed signals are additive. Authentication passes and message-category labels never erase those signals. Scores remain heuristic triage, not probability or a final attribution verdict.',
  };

  return {
    mode: parsed.sourceMode,
    parseError: parsed.parseError || null,
    case_id: `CS-${rawHash.slice(0, 12).toUpperCase()}`,
    format_type: parsed.sourceMode === 'msg' ? 'Outlook MSG' : parsed.sourceMode === 'eml' ? 'RFC Email / EML' : parsed.sourceMode === 'text-headers' ? 'Pasted Headers + Text' : 'Pasted Text',
    filename: parsed.filename,
    parsed: { ...parsed, rawBytes: undefined, rawText: undefined, attachments: undefined, sha256_hash: rawHash },
    threat,
    category_analysis: categoryAnalysis,
    dns_auth: dnsAuth,
    deep_email: deepEmail,
    relay_info: {
      ips: parsed.ips || [], hops, hop_count: hops.length, ip_count: parsed.ips?.length || 0,
      status: parsed.ips?.length ? 'Header IPs extracted from submitted evidence' : 'No IP extracted from submitted headers',
      note: 'Received entries and IPs are submitted evidence, not proof of original sender identity, complete chronology or physical location.',
    },
    geo_data: { status: 'NOT LOOKED UP', sender: null, receiver: null, note: 'No analyst/device IP fallback. Browser mode does not send extracted IPs to a geolocation provider.' },
    aitm_analysis: parsed.urls || [],
    attachment_analysis: attachments,
    authorship_analysis: { classification: 'NOT ASSESSED', ai_likeness_percent: null, confidence: 'N/A', observed_indicators: [], explanation: 'AI-generated text detection is intentionally not claimed by this web-only heuristic flow.' },
    header_findings: headerFindings,
    content_findings: contentFindings,
    evidence: { sha256: rawHash, raw_size_bytes: parsed.rawBytes?.byteLength || null, preservation: 'Parsed case data is stored in this browser profile when IndexedDB is available; original bytes are not uploaded to an immutable evidence vault by this static web app.' },
    limitations: [parsed.input_note, 'Risk score is heuristic triage, not a probability.', 'No external threat-intelligence, live DNS, sandbox, AV, YARA, or cryptographic verification was performed in browser mode.', 'Authentication-Results and related receiver headers are treated as submitted, unauthenticated provenance unless independently verified.'],
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
    evidence: { sha256: report.sha256, raw_size_bytes: report.size_bytes, preservation: 'Parsed case data is stored in this browser profile when IndexedDB is available; this is not an immutable forensic archive.' }, limitations: [report.scanner],
  };
}

export { EMAIL_EXTENSIONS, ATTACHMENT_EXTENSIONS, extensionOf };
