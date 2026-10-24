const SHORTENERS = /^(bit\.ly|tinyurl\.com|goo\.gl|rb\.gy|t\.co|is\.gd|shorturl\.at|ow\.ly)$/i;

/** Deterministic, browser-side URL checks. No network, no reputation lookup. */
export function staticUrlChecks(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return { flags: [], host: null, href: null, error: 'Enter a URL first.' };
  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { flags: ['URL parser rejected this value'], host: null, href: null };
  }
  const flags = [];
  if (parsed.protocol !== 'https:') flags.push('Not HTTPS — transport is unencrypted');
  if (parsed.username || parsed.password) flags.push('Credentials embedded in the URL');
  if (/%40|@/.test(value.replace(/^https?:\/\//i, '')) && !parsed.username) flags.push('“@” present in the path — possible redirect trick');
  if (parsed.hostname.includes('xn--')) flags.push('Punycode hostname — possible homoglyph domain');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)) flags.push('IP literal used instead of a hostname');
  if (parsed.hostname.split('.').length > 3) flags.push('Deep subdomain chain');
  if (SHORTENERS.test(parsed.hostname)) flags.push('Known link shortener — final destination is hidden');
  if (/(login|signin|verify|secure|auth|account|payment|invoice|update|wallet|seed)/i.test(`${parsed.hostname}${parsed.pathname}`)) {
    flags.push('Credential or payment themed host/path');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') flags.push(`Non-standard port ${parsed.port}`);
  if (parsed.hostname.length > 40) flags.push('Unusually long hostname');
  if (parsed.pathname.length > 120) flags.push('Very long path — often used to bury the real target');
  return { flags, host: parsed.hostname, href: parsed.href, protocol: parsed.protocol };
}

