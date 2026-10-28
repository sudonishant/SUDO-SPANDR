export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let url = '';
  if (req.method === 'POST') {
    url = req.body?.url || '';
  } else {
    url = req.query?.url || '';
  }

  url = url.trim();
  if (!url) {
    return res.status(400).json({
      error: 'missing_url',
      detail: 'Provide a URL to detonate in the sandbox.'
    });
  }

  const isSearch = !url.startsWith('http://') && !url.startsWith('https://') && (!url.includes('.') || url.includes(' '));
  if (isSearch) {
    url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(url)}`;
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  let hostname = 'unknown';
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    hostname = url;
  }

  // Edge-only heuristic: URL keyword pattern matching (no real HTTP fetch or DNS)
  const phishPatterns = /login|signin|auth|password|bank|verify|secure|update|account|credential|paypal|microsoft|apple/i;
  const suspiciousPatterns = /bit\.ly|tinyurl|goo\.gl|rb\.gy|t\.co|is\.gd|shorturl/i;
  const isPhishKw = phishPatterns.test(url);
  const isSuspiciousShortener = suspiciousPatterns.test(hostname);

  let riskScore = 15;
  const flags = [];
  if (isPhishKw) { riskScore += 45; flags.push('URL contains credential-harvesting keywords'); }
  if (isSuspiciousShortener) { riskScore += 30; flags.push('URL uses link shortener (obfuscation)'); }
  if (url.includes('@')) { riskScore += 20; flags.push('URL contains @ symbol (redirect trick)'); }
  if ((url.match(/\./g) || []).length > 4) { riskScore += 15; flags.push('Excessive subdomains'); }

  riskScore = Math.min(riskScore, 100);

  return res.status(200).json({
    status: 'EDGE_HEURISTIC_ANALYSIS',
    mode: 'URL_PATTERN_ONLY',
    url: url,
    hostname: hostname,
    resolved_ip: null,
    dns_resolved: false,
    http_fetched: false,
    risk_score: riskScore,
    heuristic_flags: flags,
    threat_verdict: riskScore >= 60
      ? 'REVIEW: URL pattern matches configured credential-harvesting indicators'
      : riskScore >= 30
        ? 'REVIEW: Some observable URL characteristics matched configured patterns'
        : 'NO STRUCTURAL WARNING: No configured URL pattern matched; safety is not established',
    note: 'This is edge-only URL pattern analysis. No real HTTP fetch, DNS resolution, DOM inspection, reputation lookup, or screenshot capture was performed. A low score does not establish that a destination is safe.',
    live_detonation_available: false,
    preview_available: null,
    preview_disabled_reason: 'The unsafe same-origin remote-HTML proxy is disabled. Use an authenticated isolated worker for live detonation.',
    timestamp: new Date().toISOString()
  });
}
