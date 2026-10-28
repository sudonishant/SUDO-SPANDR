import { forwardRea } from '../_lib/reaProxy.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ available: false, status: 'method_not_allowed', message: 'Use GET for REA capability status.' });
  return forwardRea(req, res, 'status');
}
