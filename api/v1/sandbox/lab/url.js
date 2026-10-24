// POST /api/v1/sandbox/lab/url — deep suspicious-link analysis (edge)
import { urlAnalyze } from './_labcore.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  let url = '';
  if (req.method === 'POST') url = req.body?.url || '';
  else url = req.query?.url || '';
  url = (url || '').trim();
  if (!url) {
    return res.status(400).json({ error: 'missing_url', detail: 'Provide a URL to analyse.' });
  }
  try {
    return res.status(200).json(await urlAnalyze(url));
  } catch (e) {
    return res.status(500).json({ error: 'analysis_failed', detail: e.message });
  }
}
