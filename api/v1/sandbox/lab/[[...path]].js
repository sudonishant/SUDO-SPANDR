/*
 * SINGLE catch-all Vercel function for every /api/v1/sandbox/lab/* route.
 *
 * Why one file: Vercel Hobby allows max 12 serverless functions per deployment
 * and every non-underscore file under api/ counts as one. Shared logic and the
 * per-route handlers live in api/_lib/labcore.js (underscore = never a function).
 *
 * Routes:  POST /api/v1/sandbox/lab/attachment | /url | /auto-triage | /pcap
 *          GET  /api/v1/sandbox/lab/toolbox
 */
import {
  handleAttachment,
  handleUrl,
  handleAutoTriage,
  handlePcap,
  handleToolbox,
} from '../../../_lib/labcore.js';

const ROUTES = {
  attachment: handleAttachment,
  url: handleUrl,
  'auto-triage': handleAutoTriage,
  pcap: handlePcap,
  toolbox: handleToolbox,
};

// largest body needed is auto-triage with base64 attachments
export const config = { api: { bodyParser: { sizeLimit: '40mb' } } };

export default async function handler(req, res) {
  const parts = Array.isArray(req.query.path) ? req.query.path : (req.query.path ? [req.query.path] : []);
  const route = parts[0] || '';
  const fn = ROUTES[route];
  if (!fn) {
    res.status(404).json({
      error: 'Unknown lab route',
      detail: `route=${route}`,
      available: Object.keys(ROUTES),
    });
    return;
  }
  await fn(req, res);
}
