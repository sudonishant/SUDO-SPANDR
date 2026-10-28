function configuration() {
  const base = String(process.env.REA_SERVICE_URL || '').replace(/\/+$/, '');
  const token = String(process.env.REA_SERVICE_TOKEN || '');
  if (!base || !token) return null;
  try {
    const url = new URL(base);
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) return null;
    return { base, token };
  } catch {
    return null;
  }
}

export function reaUnavailable(res, message = 'REA is not configured for this deployment. Run the authenticated local sidecar or configure REA_SERVICE_URL and REA_SERVICE_TOKEN for a private service.') {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({
    available: false,
    status: 'not_configured',
    message,
    engine: { name: 'REA — Reverse Engineer Anything', source: 'https://github.com/morluto/rea', license: 'MIT' },
    max_file_bytes: 3 * 1024 * 1024,
    upload_notice: 'No file bytes were sent. A configured service receives bytes only after the analyst explicitly runs deep inspection.',
  });
}

export async function forwardRea(req, res, operation) {
  const config = configuration();
  if (!config) return reaUnavailable(res);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const init = {
      method: operation === 'status' ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${config.token}`, accept: 'application/json' },
      signal: controller.signal,
    };
    if (operation === 'analyze') {
      const serialized = JSON.stringify(req.body || {});
      if (Buffer.byteLength(serialized) > 4_500_000) return res.status(413).json({ ok: false, status: 'too_large', message: 'The bounded REA request exceeds 4.5 MB.' });
      init.headers['content-type'] = 'application/json';
      init.body = serialized;
    }
    const upstream = await fetch(`${config.base}/${operation}`, init);
    const payload = await upstream.json().catch(() => ({ ok: false, status: 'invalid_upstream_response', message: 'The configured REA service did not return JSON.' }));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(upstream.status).json(payload);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(error?.name === 'AbortError' ? 504 : 502).json({
      ok: false,
      available: false,
      status: error?.name === 'AbortError' ? 'timeout' : 'unavailable',
      message: error?.name === 'AbortError' ? 'The configured REA service timed out.' : 'The configured REA service could not be reached.',
    });
  } finally {
    clearTimeout(timer);
  }
}
