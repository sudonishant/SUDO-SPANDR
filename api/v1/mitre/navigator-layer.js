export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const caseId = req.query.case_id || 'DEMO-26106';
  const backend = process.env.BACKEND_ORIGIN || process.env.VITE_BACKEND_URL;

  // If Python FastAPI backend is configured, proxy for dynamic MITRE correlation
  if (backend) {
    try {
      const upstreamUrl = `${backend.replace(/\/$/, '')}/api/v1/mitre/navigator-layer?case_id=${encodeURIComponent(caseId)}`;
      const response = await fetch(upstreamUrl, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      return res.status(502).json({
        error: 'upstream_mitre_error',
        detail: `Failed to connect to MITRE engine at ${backend}: ${err.message}`
      });
    }
  }

  // Edge mode: Return base template with clear metadata explaining edge prototype state
  const layer = {
    name: `SUDO SPANDR Forensic Layer - ${caseId}`,
    versions: { attack: '16', navigator: '5.1.0', layer: '4.5' },
    domain: 'enterprise-attack',
    description: `Preloaded reference forensic ATT&CK correlation layer for Case ${caseId}. Live dynamic correlation requires Python FastAPI backend (backend/app/core/mitre_engine.py).`,
    mode: 'REFERENCE_PRELOADED_LAYER',
    dynamic_correlation_available: false,
    filters: { platforms: ['Windows', 'Linux', 'macOS', 'Office 365', 'Google Workspace'] },
    sorting: 3,
    layout: { layout: 'side', aggregateFunction: 'average', showID: true, showName: true },
    hideDisabled: false,
    techniques: [
      { techniqueID: 'T1566.001', score: 1, color: '#e11d48', comment: 'Spearphishing Attachment detected (macro/entropy signature)' },
      { techniqueID: 'T1566.002', score: 1, color: '#e11d48', comment: 'Spearphishing Link flagged in body' },
      { techniqueID: 'T1566.003', score: 1, color: '#f59e0b', comment: 'Spearphishing via Third-Party Spoofing Service' },
      { techniqueID: 'T1036.005', score: 1, color: '#f59e0b', comment: 'Masquerading: Legitimate Name and Header Spoofing' },
      { techniqueID: 'T1586.002', score: 1, color: '#38bdf8', comment: 'Compromised Webmail Origin / Relay Account' },
      { techniqueID: 'T1071.001', score: 1, color: '#c084fc', comment: 'Web Application Protocol / Credential Redirect' },
      { techniqueID: 'T1090.003', score: 1, color: '#c084fc', comment: 'Multi-Hop Anonymizing Proxy / Tor Exit Node' }
    ],
    gradient: { colors: ['#22c55e', '#f59e0b', '#ef4444'], minValue: 0, maxValue: 1 }
  };

  return res.status(200).json(layer);
};
