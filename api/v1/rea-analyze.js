import { forwardRea } from '../_lib/reaProxy.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, status: 'method_not_allowed', message: 'Use POST with a bounded file and its SHA-256 digest.' });
  return forwardRea(req, res, 'analyze');
}
