/*
 * SINGLE catch-all Vercel function for /api/v1/rea/*.
 *
 * Two reasons this is one file and not two:
 *   1. Vercel Hobby allows max 12 serverless functions per deployment and every
 *      non-underscore file under api/ counts as one. Splitting analyze/status
 *      into separate files pushed the project over the limit and broke deploys.
 *   2. The client already calls /api/v1/rea/status and /api/v1/rea/analyze,
 *      which never existed as routes (the files were rea-status.js /
 *      rea-analyze.js), so those requests 404'd.
 *
 * Legacy URLs /api/v1/rea-analyze and /api/v1/rea-status are rewritten to this
 * function in vercel.json, so existing bookmarks keep working.
 */
import { forwardRea } from '../../_lib/reaProxy.js';

export const config = { maxDuration: 60 };

const ROUTES = {
  analyze: {
    method: 'POST',
    message: 'Use POST with a bounded file and its SHA-256 digest.',
    run: (req, res) => forwardRea(req, res, 'analyze'),
  },
  status: {
    method: 'GET',
    message: 'Use GET for REA capability status.',
    run: (req, res) => forwardRea(req, res, 'status'),
  },
};

function routeFromUrl(req) {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const segments = pathname.split('/').filter(Boolean); // api v1 rea <route>
    const index = segments.indexOf('rea');
    return index >= 0 ? (segments[index + 1] || '') : '';
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  const route = routeFromUrl(req);
  const entry = ROUTES[route];
  if (!entry) {
    return res.status(404).json({
      ok: false,
      error: 'Unknown REA route',
      detail: `route=${route}`,
      available: Object.keys(ROUTES),
    });
  }
  if (req.method !== entry.method) {
    return res.status(405).json({ ok: false, status: 'method_not_allowed', message: entry.message });
  }
  return entry.run(req, res);
}
