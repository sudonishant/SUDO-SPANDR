export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Reuse this existing function for the explicit evidence-graph operation so
  // the deployment remains within the 12-function budget. No Neo4j credential
  // or direct database connection is exposed to the browser.
  const graphOperation = req.query?.operation === 'graph';
  if (graphOperation && req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', detail: 'Evidence-graph projection requires POST with sanitized case metadata.' });
  }
  if (graphOperation) res.setHeader('Cache-Control', 'no-store');

  const backend = process.env.BACKEND_ORIGIN || process.env.VITE_BACKEND_URL;
  if (!backend) {
    return res.status(503).json({
      error: 'backend_not_configured',
      status: graphOperation ? 'not_configured' : undefined,
      persisted: graphOperation ? false : undefined,
      readback: graphOperation ? false : undefined,
      detail: graphOperation
        ? 'BACKEND_ORIGIN is not configured. Neo4j projection and database readback are unavailable; no graph success is claimed.'
        : 'BACKEND_ORIGIN environment variable is not configured. Refusing to fabricate unverified analysis in edge serverless functions. Run the FastAPI backend to obtain genuine cryptographic & MITRE triage.',
      fallback_available: graphOperation ? undefined : 'client_side_parser'
    });
  }

  try {
    const upstreamPath = graphOperation ? '/api/v1/evidence-graph' : '/api/v1/analyze-eml';
    const upstreamUrl = `${backend.replace(/\/$/, '')}${upstreamPath}`;
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
