export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const backend = process.env.BACKEND_ORIGIN || process.env.VITE_BACKEND_URL;
  if (!backend) {
    return res.status(503).json({
      error: 'backend_not_configured',
      detail: 'BACKEND_ORIGIN environment variable is not configured. Refusing to fabricate unverified analysis in edge serverless functions. Run the FastAPI backend to obtain genuine cryptographic & MITRE triage.',
      fallback_available: 'client_side_parser'
    });
  }

  try {
    const upstreamUrl = `${backend.replace(/\/$/, '')}/api/v1/analyze-eml`;
    const response = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
      },
      body: req.method !== 'GET' ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({
      error: 'upstream_backend_error',
      detail: `Failed to connect to forensic backend at ${backend}: ${err.message}`
    });
  }
}
