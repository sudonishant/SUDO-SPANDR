// The former same-origin remote-HTML proxy was disabled deliberately.
// Proxying active third-party documents into the application origin created an
// XSS, credential-capture, framing and SSRF boundary that an iframe srcDoc
// sandbox could not repair. Live detonation belongs in an isolated worker.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  return res.status(410).json({
    error: 'remote_preview_disabled',
    detail: 'The same-origin remote-HTML preview proxy is disabled. Use network-free URL Lab checks, or deploy an authenticated, isolated detonation worker with restricted egress.',
    remote_fetch_performed: false,
    live_detonation_available: false,
  });
}
