// POST /api/v1/sandbox/lab/auto-triage — one-click automated email evidence triage (edge)
import { autoTriage } from './_labcore.js';

export const config = { api: { bodyParser: { sizeLimit: '40mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', detail: 'POST {eml_b64 | files | urls}.' });
  }
  const body = req.body || {};
  const urls = Array.isArray(body.urls) ? body.urls : (typeof body.urls === 'string' ? body.urls.split(/[\s,]+/).filter(Boolean) : []);
  const files = Array.isArray(body.files) ? body.files : [];
  if (!body.eml_b64 && !body.eml_text && !files.length && !urls.length) {
    return res.status(400).json({ error: 'empty_request', detail: 'Provide an .eml, files ({filename, file_b64}), or at least one URL.' });
  }
  try {
    return res.status(200).json(await autoTriage({
      eml_b64: body.eml_b64,
      eml_text: body.eml_text,
      files,
      urls,
    }));
  } catch (e) {
    return res.status(500).json({ error: 'triage_failed', detail: e.message });
  }
}
