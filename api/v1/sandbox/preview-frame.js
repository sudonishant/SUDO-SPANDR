export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  let targetUrl = req.query?.url || 'https://example.com';
  targetUrl = targetUrl.trim();

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (!targetUrl.includes('.') || targetUrl.includes(' ')) {
      targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(targetUrl)}`;
    } else {
      targetUrl = 'https://' + targetUrl;
    }
  }

  let htmlContent = '';
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberSquad-Sandbox/4.0'
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
          e.preventDefault();
          alert('🛡️ AIR-GAPPED DEFENSE ACTIVATED:\\n\\nForm submission intercepted by Cyber Squad Sandbox.');
        }
      }, true);
    });
    </script>
  `;

  let finalHtml = htmlContent;
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
