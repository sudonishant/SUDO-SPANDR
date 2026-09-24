export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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
      ? '⚠️ SUSPICIOUS: URL pattern matches credential-harvesting indicators'
      : riskScore >= 30
        ? '🟡 MODERATE: Some suspicious URL characteristics detected'
        : '🟢 LOW RISK: No obvious phishing URL patterns detected',
    note: 'This is edge-only URL pattern analysis. No real HTTP fetch, DNS resolution, DOM inspection, or screenshot capture was performed. For full air-gapped Chromium detonation with DOM analysis, form detection, and screenshot capture, deploy the Docker sandbox container (see docker-compose.yml).',
    preview_available: `/api/v1/sandbox/preview-frame?url=${encodeURIComponent(url)}`,
    timestamp: new Date().toISOString()
  });
}
