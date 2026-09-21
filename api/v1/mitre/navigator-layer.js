export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const caseId = req.query.case_id || 'DEMO-26106';

  const layer = {
    name: `SUDO SPANDR Forensic Layer - ${caseId}`,
    versions: { attack: '16', navigator: '5.1.0', layer: '4.5' },
    domain: 'enterprise-attack',
    description: `Automated forensic correlation layer generated for Case ${caseId} under SIH #26106`,
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
