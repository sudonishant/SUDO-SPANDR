import { decodeWords } from 'postal-mime';
import { getDomain, parse as parseDomain } from 'tldts';

const AUTH_METHODS = ['spf', 'dkim', 'dmarc', 'arc'];
const AUTH_RESULT_HEADERS = new Set(['authentication-results', 'x-authentication-results', 'arc-authentication-results']);
const RESULT_CODES = 'pass|fail|softfail|neutral|none|temperror|permerror|policy|hardfail';
const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i;

const BRANDS = [
  { id: 'microsoft', label: 'Microsoft', pattern: /\b(microsoft|office\s*365|outlook|hotmail)\b/i, domains: ['microsoft.com', 'microsoftonline.com', 'office.com', 'office365.com', 'live.com', 'outlook.com', 'hotmail.com'] },
  { id: 'google', label: 'Google', pattern: /\b(google|gmail|youtube)\b/i, domains: ['google.com', 'gmail.com', 'googlemail.com', 'youtube.com'] },
  { id: 'apple', label: 'Apple', pattern: /\b(apple|icloud)\b/i, domains: ['apple.com', 'icloud.com', 'me.com', 'mac.com'] },
  { id: 'paypal', label: 'PayPal', pattern: /\bpaypal\b/i, domains: ['paypal.com', 'paypal.co.in'] },
  { id: 'amazon', label: 'Amazon', pattern: /\b(amazon|aws)\b/i, domains: ['amazon.com', 'amazon.in', 'amazon.co.uk', 'aws.amazon.com'] },
  { id: 'meta', label: 'Meta / Facebook', pattern: /\b(facebook|instagram|meta)\b/i, domains: ['facebook.com', 'instagram.com', 'meta.com'] },
  { id: 'linkedin', label: 'LinkedIn', pattern: /\blinkedin\b/i, domains: ['linkedin.com'] },
  { id: 'netflix', label: 'Netflix', pattern: /\bnetflix\b/i, domains: ['netflix.com'] },
];

function clean(value) {
  return String(value ?? '').replace(/\u0000/g, '').trim();
}

export function decodeHeaderValue(value = '') {
  const text = clean(value);
  if (!text) return '';
  try { return clean(decodeWords(text)); } catch { return text; }
}

export function addressDomain(value = '') {
  const match = clean(value).match(EMAIL_IN_TEXT);
  if (match?.[1]) return normalizeDomain(match[1]);
  const fallback = clean(value).replace(/^.*</, '').replace(/>.*$/, '').replace(/^mailto:/i, '');
  return fallback.includes('@') ? normalizeDomain(fallback.split('@').pop()) : '';
}

export function normalizeDomain(value = '') {
  const input = clean(value).replace(/^[<([{]+/, '').replace(/[>\])};,.]+$/, '').replace(/\.$/, '').toLowerCase();
  if (!input) return '';
  try { return new URL(`http://${input}`).hostname.replace(/\.$/, '').toLowerCase(); } catch { return input; }
}

export function organizationDomain(value = '') {
  const hostname = normalizeDomain(value);
  if (!hostname) return '';
  const registrable = getDomain(hostname);
  if (registrable) return registrable.toLowerCase();
  const parts = hostname.split('.').filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

export function domainAlignment(left = '', right = '') {
  const leftDomain = normalizeDomain(left);
  const rightDomain = normalizeDomain(right);
  const leftOrganization = organizationDomain(leftDomain);
  const rightOrganization = organizationDomain(rightDomain);
  return {
    aligned: Boolean(leftOrganization && rightOrganization && leftOrganization === rightOrganization),
    strict: Boolean(leftDomain && rightDomain && leftDomain === rightDomain),
    left: leftDomain,
    right: rightDomain,
    left_organization: leftOrganization,
    right_organization: rightOrganization,
  };
}

function levenshtein(left = '', right = '') {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

export function reviewDomain(value = '') {
  const domain = normalizeDomain(value);
  if (!domain || !domain.includes('.')) return [];
  const findings = [];
  const organization = organizationDomain(domain);
  if (domain.includes('xn--')) {
    findings.push({ id: 'punycode-domain', label: 'Internationalized/punycode domain needs visual verification', weight: 10, evidence: `${domain} uses an A-label; visually similar characters can be difficult to distinguish.` });
  }
  const parsed = parseDomain(domain);
  const stem = String(parsed.domainWithoutSuffix || organization.split('.')[0] || '').toLowerCase();
  const tokens = stem.split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
  for (const brand of BRANDS) {
    if (brand.domains.includes(organization)) continue;
    const token = tokens.find((candidate) => {
      const distance = levenshtein(candidate, brand.id);
      return distance > 0 && distance <= (brand.id.length >= 8 ? 2 : 1);
    });
    if (token) {
      findings.push({ id: 'lookalike-domain', label: `Possible ${brand.label} look-alike domain`, weight: 14, evidence: `${domain} contains “${token}”, which is similar to “${brand.id}” but is not a configured ${brand.label} domain. This is a review signal, not attribution.` });
      break;
    }
  }
  return findings;
}

function brandInText(value = '') {
  return BRANDS.find((brand) => brand.pattern.test(value)) || null;
}

export function headerAnomalies({ headers = {}, sender = '', replyTo = '', fromName = '', sourceMode = '', headerEntries = [] }) {
  const findings = [];
  const fromDomain = addressDomain(sender || headers.from);
  const fromOrganization = organizationDomain(fromDomain);
  const replyDomain = addressDomain(replyTo || headers['reply-to']);
  const senderHeaderDomain = addressDomain(headers.sender);
  const rawFrom = decodeHeaderValue(headers.from || '');
  const displayName = clean(fromName || rawFrom.replace(/<[^>]+>/g, '').replace(/^['"]|['"]$/g, '')).trim();

  if (replyDomain && fromDomain && replyDomain !== fromDomain) {
    findings.push({ id: 'reply-to-mismatch', label: 'Reply-To domain differs from From domain', weight: 16, evidence: `Replies are directed to ${replyDomain}, while the visible From domain is ${fromDomain}. This can be legitimate, but is important in payment or credential requests.` });
  }

  const displayAddress = rawFrom.replace(/<[^>]+>/g, '').match(EMAIL_IN_TEXT);
  if (displayAddress && addressDomain(displayAddress[0]) !== fromDomain) {
    findings.push({ id: 'display-address-mismatch', label: 'Display text contains a different email address', weight: 14, evidence: `The From display text mentions ${displayAddress[0]}, but the actual visible From address is ${sender || rawFrom}.` });
  }

  const domainFindings = reviewDomain(fromDomain);
  findings.push(...domainFindings);
  const brand = brandInText(displayName);
  const brandMismatch = brand && fromOrganization && !brand.domains.includes(fromOrganization);
  if (brandMismatch && !domainFindings.some((item) => item.id === 'lookalike-domain')) {
    findings.push({ id: 'display-name-domain-mismatch', label: `${brand.label} display name uses an unrelated sender domain`, weight: 12, evidence: `Display name “${displayName}” suggests ${brand.label}, while the visible From organization domain is ${fromOrganization}.` });
  } else if (!brand && displayName && !EMAIL_IN_TEXT.test(displayName) && /\b(ceo|cfo|chief executive|managing director|director|admin|support|security|bank|finance department|accounts department)\b/i.test(displayName)) {
    findings.push({ id: 'display-name-review', label: 'Authority display name needs independent verification', weight: 8, evidence: `The display name is “${displayName}”. A display name alone does not establish the sender's identity or authority.` });
  }

  if (senderHeaderDomain && fromDomain && senderHeaderDomain !== fromDomain) {
    findings.push({ id: 'sender-from-mismatch', label: 'Sender and From domains differ', weight: 4, evidence: `Sender domain ${senderHeaderDomain} differs from visible From domain ${fromDomain}; this also occurs with legitimate delegated mailing.` });
  }
  if ((headers['from']?.match(/@/g) || []).length > 1) {
    findings.push({ id: 'multiple-from-addresses', label: 'Multiple addresses appear in the From field', weight: 10, evidence: 'Multiple visible author addresses require manual standards and provenance review.' });
  }

  const spamFlag = clean(headers['x-spam-flag']).toLowerCase() === 'yes' || /^yes\b/i.test(clean(headers['x-spam-status']));
  if (spamFlag) findings.push({ id: 'receiver-spam-flag', label: 'A submitted header carries a spam flag', weight: 18, evidence: 'X-Spam-Flag or X-Spam-Status reports spam in the submitted headers; the producing receiver has not been independently authenticated.' });

  if (sourceMode === 'msg' && !headerEntries.length) {
    findings.push({ id: 'msg-transport-unavailable', label: 'MSG transport headers are unavailable', weight: 0, evidence: 'The MSG reader exposed message properties but no original transport header block. Missing Received or authentication fields are not treated as proof of spoofing.' });
  } else {
    if (!headers.from && !sender) findings.push({ id: 'missing-from', label: 'From header is missing', weight: 8, evidence: 'No visible author address was parsed.' });
    if (!headers['message-id']) findings.push({ id: 'missing-message-id', label: 'Message-ID header is missing', weight: 4, evidence: 'No Message-ID was present in the submitted header block.' });
    if (!headers.date) findings.push({ id: 'missing-date', label: 'Date header is missing', weight: 3, evidence: 'No Date field was present in the submitted header block.' });
    if (!headers.received) findings.push({ id: 'missing-received', label: 'No Received header was supplied; relay path unavailable', weight: 8, evidence: 'The submitted evidence contains no SMTP Received chain.' });
  }
  return findings;
}

function fallbackHeaderEntries(headers = {}) {
  return Object.entries(headers).flatMap(([name, value]) => String(value || '').split('\n').map((part) => ({ name, value: part })));
}

function parseProperties(value = '') {
  const properties = {};
  const pattern = /\b((?:smtp|header|policy|body|properties)\.[a-z0-9_-]+|client-ip|envelope-from|helo|identity|receiver|mechanism)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s;]+))/gi;
  for (const match of String(value).matchAll(pattern)) properties[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return properties;
}

function parseAuthenticationEntries(headers, headerEntries) {
  const entries = (headerEntries?.length ? headerEntries : fallbackHeaderEntries(headers)).filter((entry) => AUTH_RESULT_HEADERS.has(String(entry.name).toLowerCase()) || ['received-spf', 'x-received-spf'].includes(String(entry.name).toLowerCase()));
  const results = [];
  const rawHeaders = [];
  entries.forEach((entry, entryIndex) => {
    const headerName = String(entry.name).toLowerCase();
    const value = clean(entry.value);
    rawHeaders.push({ name: entry.name, value });
    if (['received-spf', 'x-received-spf'].includes(headerName)) {
      const match = value.match(new RegExp(`^\\s*(${RESULT_CODES})\\b`, 'i'));
      if (match) {
        const properties = parseProperties(value);
        if (properties['envelope-from'] && !properties['smtp.mailfrom']) properties['smtp.mailfrom'] = properties['envelope-from'];
        if (properties.helo && !properties['smtp.helo']) properties['smtp.helo'] = properties.helo;
        results.push({ method: 'spf', result: match[1].toLowerCase(), properties, authserv_id: properties.receiver || 'Not reported', header_name: entry.name, header_index: entryIndex, evidence: value.slice(0, 1200) });
      }
      return;
    }
    const authservId = clean(value.split(';')[0]) || 'Not reported';
    const methodPattern = new RegExp(`\\b(spf|dkim|dmarc|arc)\\s*=\\s*(${RESULT_CODES})\\b`, 'gi');
    const matches = [...value.matchAll(methodPattern)];
    matches.forEach((match, index) => {
      const start = match.index ?? 0;
      const end = index + 1 < matches.length ? matches[index + 1].index ?? value.length : value.length;
      const segment = value.slice(start, end).trim();
      results.push({ method: match[1].toLowerCase(), result: match[2].toLowerCase(), properties: parseProperties(segment), authserv_id: authservId, header_name: entry.name, header_index: entryIndex, evidence: segment.slice(0, 1200) });
    });
  });
  return { results, rawHeaders };
}

function aggregateMethod(results, method, headers) {
  const methodResults = results.filter((item) => item.method === method);
  if (!methodResults.length) {
    if (method === 'dkim' && headers['dkim-signature']) return 'PRESENT — signature not cryptographically verified in browser';
    if (method === 'arc' && (headers['arc-seal'] || headers['arc-message-signature'] || headers['arc-authentication-results'])) return 'PRESENT — chain not independently verified in browser';
    return method === 'dkim' || method === 'arc' ? 'NOT PRESENT' : 'NOT VERIFIED';
  }
  const states = [...new Set(methodResults.map((item) => item.result.toUpperCase()))];
  if (states.length === 1) return `REPORTED ${states[0]}${methodResults.length > 1 ? ` · ${methodResults.length} RESULTS` : ''}`;
  return `MIXED REPORTED RESULTS · ${states.join(' + ')}`;
}

function authenticationAlignment(results, sender) {
  const fromDomain = addressDomain(sender);
  const fromOrganization = organizationDomain(fromDomain);
  const spfResults = results.filter((item) => item.method === 'spf');
  const dkimResults = results.filter((item) => item.method === 'dkim');
  const dmarcResults = results.filter((item) => item.method === 'dmarc');
  const spfRows = spfResults.map((item) => {
    const mailFrom = item.properties['smtp.mailfrom'] || '';
    const helo = item.properties['smtp.helo'] || '';
    const identity = mailFrom || helo;
    const identityDomain = addressDomain(identity) || normalizeDomain(identity);
    const alignment = domainAlignment(fromDomain, identityDomain);
    return {
      method: 'SPF', result: item.result, identity: identity || 'Identity not reported', identity_domain: identityDomain,
      identity_role: mailFrom ? 'MAIL FROM' : helo ? 'HELO · not DMARC alignment' : 'Identity not reported',
      // DMARC SPF alignment concerns the MAIL FROM domain. A HELO-only pass
      // is useful reported evidence but cannot establish that alignment.
      aligned: mailFrom && identityDomain ? alignment.aligned : null,
      authserv_id: item.authserv_id,
    };
  });
  const dkimRows = dkimResults.map((item) => {
    const identity = item.properties['header.d'] || item.properties.d || '';
    const identityDomain = normalizeDomain(identity);
    const alignment = domainAlignment(fromDomain, identityDomain);
    return { method: 'DKIM', result: item.result, identity: identity || 'Signing domain not reported', identity_domain: identityDomain, identity_role: 'DKIM d=', aligned: identityDomain ? alignment.aligned : null, authserv_id: item.authserv_id };
  });
  const dmarcRows = dmarcResults.map((item) => ({ method: 'DMARC', result: item.result, identity: item.properties['header.from'] || fromDomain || 'Author domain not reported', identity_domain: fromDomain, identity_role: 'header.from · receiver result', aligned: null, authserv_id: item.authserv_id }));
  const spfAlignedPass = spfRows.some((item) => item.result === 'pass' && item.aligned === true);
  const dkimAlignedPass = dkimRows.some((item) => item.result === 'pass' && item.aligned === true);
  const dmarcPass = dmarcRows.some((item) => item.result === 'pass');
  const dmarcFail = dmarcRows.some((item) => ['fail', 'permerror', 'hardfail'].includes(item.result));
  const anyProtocolPass = [...spfRows, ...dkimRows].some((item) => item.result === 'pass');
  return {
    from_domain: fromDomain,
    from_organization_domain: fromOrganization,
    rows: [...spfRows, ...dkimRows, ...dmarcRows],
    spf_aligned_pass: spfAlignedPass,
    dkim_aligned_pass: dkimAlignedPass,
    reported_dmarc_pass: dmarcPass,
    reported_dmarc_fail: dmarcFail,
    visible_from_reported_validated: dmarcPass || spfAlignedPass || dkimAlignedPass,
    passes_without_visible_from_alignment: anyProtocolPass && !dmarcPass && !spfAlignedPass && !dkimAlignedPass,
    comparison: 'Relaxed organizational-domain comparison using the Public Suffix List; strict policy modes and live DNS policy were not evaluated.',
  };
}

export function authenticationSnapshot(headers = {}, headerEntries = [], sender = '') {
  const { results, rawHeaders } = parseAuthenticationEntries(headers, headerEntries);
  const allEntries = headerEntries?.length ? headerEntries : fallbackHeaderEntries(headers);
  const signatureHeaders = allEntries.filter((entry) => ['dkim-signature', 'arc-seal', 'arc-message-signature'].includes(String(entry.name).toLowerCase())).map((entry) => ({ name: entry.name, value: clean(entry.value) }));
  const evidenceHeaders = [...rawHeaders, ...signatureHeaders];
  const alignment = authenticationAlignment(results, sender || headers.from);
  const snapshot = {};
  AUTH_METHODS.forEach((method) => { snapshot[method] = aggregateMethod(results, method, headers); });
  return {
    ...snapshot,
    reported_header: rawHeaders.length ? `${rawHeaders.length} submitted result header(s); receiver/authserv-id trust not established` : signatureHeaders.length ? 'Signature field(s) present; no reported receiver result parsed' : 'Not present',
    evidence_sources: [...new Set(evidenceHeaders.map((item) => item.name))],
    raw_reported: evidenceHeaders.length ? evidenceHeaders.map((item) => `${item.name}: ${item.value}`).join('\n') : 'No Authentication-Results, ARC-Authentication-Results, X-Authentication-Results, Received-SPF, DKIM-Signature, ARC-Seal, or ARC-Message-Signature header was supplied.',
    results,
    alignment,
    note: 'REPORTED values come from submitted receiver headers, which a sender can also forge. No live SPF/DKIM/DMARC/ARC DNS or cryptographic verification runs in this browser lane. Authentication and domain alignment are evaluated separately from content safety; a pass never proves that a message is safe.',
  };
}

export function authenticationContext(headers = {}, headerEntries = [], sender = '') {
  const snapshot = authenticationSnapshot(headers, headerEntries, sender);
  const results = snapshot.results;
  const failed = results.filter((item) => ['fail', 'permerror', 'hardfail'].includes(item.result));
  const states = {};
  results.forEach((item) => {
    states[item.method] ||= new Set();
    states[item.method].add(item.result);
  });
  return {
    pass_count: results.filter((item) => item.method !== 'arc' && item.result === 'pass').length,
    dmarc_pass: snapshot.alignment.reported_dmarc_pass,
    any_fail: failed.length > 0,
    failed_methods: [...new Set(failed.map((item) => item.method.toUpperCase()))],
    mixed_methods: Object.entries(states).filter(([, values]) => values.size > 1).map(([method]) => method.toUpperCase()),
    aligned_from_return_path: domainAlignment(addressDomain(sender), addressDomain(headers['return-path'])).aligned,
    spf_aligned_pass: snapshot.alignment.spf_aligned_pass,
    dkim_aligned_pass: snapshot.alignment.dkim_aligned_pass,
    passes_without_visible_from_alignment: snapshot.alignment.passes_without_visible_from_alignment,
    result_count: results.length,
  };
}

export function relayHops(headerEntries = []) {
  return headerEntries.filter((entry) => String(entry.name).toLowerCase() === 'received').map((entry, index) => {
    const value = clean(entry.value);
    const from = value.match(/\bfrom\s+([^\s(;]+)/i)?.[1] || 'Not reported';
    const by = value.match(/\bby\s+([^\s(;]+)/i)?.[1] || 'Not reported';
    const protocol = value.match(/\bwith\s+([^\s(;]+)/i)?.[1] || 'Not reported';
    const date = value.includes(';') ? clean(value.slice(value.lastIndexOf(';') + 1)) : 'Not reported';
    return { position: index + 1, from, by, protocol, date, raw: value.slice(0, 1600), order: 'Submitted top-to-bottom order; not a proof of chronology or sender identity.' };
  });
}
