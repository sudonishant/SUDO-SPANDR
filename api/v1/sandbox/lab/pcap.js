// POST /api/v1/sandbox/lab/pcap — traffic evidence dissection (edge parser)
import { pcapAnalyze } from './_labcore.js';

export const config = { api: { bodyParser: { sizeLimit: '30mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', detail: 'POST {filename, file_b64}.' });
  }
  const { filename, file_b64: fileB64 } = req.body || {};
  if (!fileB64) {
    return res.status(400).json({ error: 'missing_file', detail: 'Provide {filename, file_b64} (base64 pcap bytes).' });
  }
  try {
    return res.status(200).json(pcapAnalyze(Buffer.from(fileB64, 'base64'), filename || 'capture.pcap'));
  } catch (e) {
    return res.status(400).json({ error: 'analysis_failed', detail: e.message });
  }
}
