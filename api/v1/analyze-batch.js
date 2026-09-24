export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'method_not_allowed',
      detail: 'POST required with JSON body containing emails array or EML content array.'
    });
  }

  // If FastAPI backend is deployed, proxy the batch request
  const backendOrigin = process.env.BACKEND_ORIGIN;
  if (backendOrigin) {
    try {
      const upstream = await fetch(`${backendOrigin}/api/v1/analyze-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (err) {
      return res.status(502).json({
        error: 'backend_unreachable',
        detail: `FastAPI backend at ${backendOrigin} did not respond: ${err.message}`,
        fallback: 'Submit individual emails via the main UI for client-side triage.'
      });
    }
  }

  // No backend configured — honest degraded response
  const emails = req.body?.emails || req.body?.eml_contents || [];
  return res.status(503).json({
    error: 'backend_not_configured',
    status: 'BATCH_ANALYSIS_UNAVAILABLE',
    detail: 'Batch campaign clustering and cross-correlation require the Python FastAPI backend with full NLP, DKIM/SPF verification, and GeoIP engines. Edge serverless functions cannot perform real batch analysis.',
    submitted_count: Array.isArray(emails) ? emails.length : 0,
    fallback_available: 'client_side_parser',
    note: 'Deploy the FastAPI backend (see render.yaml) and set BACKEND_ORIGIN env var to enable real batch processing.',
    timestamp: new Date().toISOString()
  });
};
