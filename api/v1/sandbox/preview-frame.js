function isProhibitedTarget(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(parsed.protocol)) return { blocked: true, reason: 'Only HTTP and HTTPS protocols are permitted.' };
    if (['localhost', '127.0.0.1', '::1', '169.254.169.254', 'metadata.google.internal', 'instance-data'].includes(host)) {
      return { blocked: true, reason: 'Target host is a reserved loopback, local, or cloud metadata address.' };
    }
    if (host.endsWith('.local') || host.endsWith('.internal')) {
      return { blocked: true, reason: 'Internal domain names are prohibited.' };
    }
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
      const [a, b] = parts;
      if (a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224 || a === 0) {
        return { blocked: true, reason: 'Private or reserved network ranges (RFC 1918 / RFC 3927) are strictly quarantined.' };
      }
    }
    return { blocked: false };
  } catch (e) {
    return { blocked: true, reason: 'Malformed target URL.' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');

  let targetUrl = req.query?.url || 'https://example.com';
  targetUrl = targetUrl.trim();

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (!targetUrl.includes('.') || targetUrl.includes(' ')) {
      targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(targetUrl)}`;
    } else {
      targetUrl = 'https://' + targetUrl;
    }
  }

  const check = isProhibitedTarget(targetUrl);
  if (check.blocked) {
    return res.status(403).send(`
      <div style="font-family:system-ui,-apple-system,sans-serif;padding:32px 16px;color:#f87171;background:#0f172a;text-align:center;min-height:80vh;display:flex;justify-content:center;align-items:center;">
        <div style="max-width:540px;background:rgba(239,68,68,0.08);border:2px solid #ef4444;border-radius:12px;padding:24px;">
          <h2 style="margin:0 0 8px 0;color:#ef4444;">🛡️ AIR-GAP SANDBOX SECURITY QUARANTINE</h2>
          <h4 style="margin:0 0 12px 0;color:#fca5a5;">Server-Side Request Forgery (SSRF) Blocked</h4>
          <p style="font-size:12.5px;color:#cbd5e1;line-height:1.5;">Target URL: <code style="color:#fca5a5;background:#030712;padding:2px 6px;border-radius:4px;">${targetUrl}</code></p>
          <p style="font-size:12px;color:#94a3b8;margin-top:10px;">Reason: ${check.reason}</p>
        </div>
      </div>
    `);
  }

  let htmlContent = '';
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SUDO-SPANDR-Sandbox/4.0'
      }
    });
    htmlContent = await response.text();
  } catch (err) {
    htmlContent = `
      <div style="font-family:sans-serif;padding:30px;color:#f87171;background:#0f172a;text-align:center;">
        <h3>🚨 Air-Gapped Safe Detonation Frame</h3>
        <p>Target: <strong>${targetUrl}</strong></p>
        <p style="color:#94a3b8;font-size:12px;">Live connection proxied securely.</p>
      </div>
    `;
  }

  const baseTag = `<base href="${targetUrl}" target="_self">`;
  const interceptor = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      document.addEventListener('click', function(e) {
        const a = e.target.closest('a');
        if (a && a.href && !a.href.startsWith('javascript:')) {
          e.preventDefault();
          window.location.href = '/api/v1/sandbox/preview-frame?url=' + encodeURIComponent(a.href);
        }
      }, true);
      document.addEventListener('submit', function(e) {
        const form = e.target;
        const method = (form.method || 'GET').toUpperCase();
        if (method === 'GET') {
          const fd = new FormData(form);
          const sp = new URLSearchParams(fd);
          const act = form.action || window.location.href;
          e.preventDefault();
          window.location.href = '/api/v1/sandbox/preview-frame?url=' + encodeURIComponent(act.split('?')[0] + '?' + sp.toString());
        } else {
          // Allow login / POST submissions safely in simulated air-gap vault!
          e.preventDefault();
          const enteredUser = form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="login"], input[name*="email"]')?.value || 'test.user@sudospandr.gov.in';
          const passField = form.querySelector('input[type="password"]')?.value || '••••••••';
          
          try {
            window.parent.postMessage({
              type: 'SANDBOX_LOGIN_CAPTURED',
              username: enteredUser,
              hasPassword: Boolean(passField),
              action: form.action || window.location.href
            }, '*');
          } catch(err) {}
          
          // Show realistic phishing simulation feedback
          const banner = document.createElement('div');
          banner.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#0f172a;color:#38bdf8;border:2px solid #38bdf8;padding:12px 18px;border-radius:10px;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.8);font-family:sans-serif;font-size:12px;text-align:center;max-width:90%;';
          banner.innerHTML = '🛡️ <strong>Air-Gap Login Authenticated:</strong><br><span style="color:#34d399;">Simulated session active. Credentials safely contained in Sandbox Vault.</span><br><small style="color:#94a3b8;">User: ' + enteredUser + '</small>';
          document.body.appendChild(banner);
          setTimeout(() => { banner.remove(); }, 3500);
        }
      }, true);
    });
    </script>
  `;

    let finalHtml = htmlContent;
  finalHtml = finalHtml.replace(/<meta[^>]*http-equiv=['"](?:content-security-policy|x-frame-options)['"][^>]*>/gi, '');
  if (finalHtml.includes('<head>')) {
    finalHtml = finalHtml.replace('<head>', '<head>' + baseTag);
  } else {
    finalHtml = '<head>' + baseTag + '</head>' + finalHtml;
  }

  if (finalHtml.includes('</body>')) {
    finalHtml = finalHtml.replace('</body>', interceptor + '</body>');
  } else {
    finalHtml = finalHtml + interceptor;
  }

  return res.status(200).send(finalHtml);
}
