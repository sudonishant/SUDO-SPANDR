import re

# 1. Update backend/app/core/web_sandbox_engine.py
with open('backend/app/core/web_sandbox_engine.py', 'r', encoding='utf-8') as f:
    ws = f.read()

# Add google.com normalization
old_detect = '''    elif not target_url.startswith(("http://", "https://")) and ("." not in target_url or " " in target_url):
        is_search_query = True
        search_term = target_url'''

new_detect = '''    elif not target_url.startswith(("http://", "https://")) and ("." not in target_url or " " in target_url):
        is_search_query = True
        search_term = target_url

    norm_target = target_url.lower().replace("https://", "").replace("http://", "").rstrip("/")
    if norm_target in ["google.com", "www.google.com", "google", "search"]:
        is_search_query = True
        search_term = "Cyber Squad Threat Intelligence"'''

ws = ws.replace(old_detect, new_detect)

# Strip any meta CSP and X-Frame-Options tags inside _inject_safety_hud
strip_meta_code = '''def _inject_safety_hud(sanitized: str, target_url: str, resolved_ip: str, is_credential_trap: bool) -> str:
    """Injects the Safety HUD and In-App Interceptor and removes frame-blocking meta tags."""
    # Strip frame-busting meta headers so browser never throws xframe-neterror-page
    sanitized = re.sub(r'<meta[^>]*http-equiv=[\'"](?:content-security-policy|x-frame-options)[\'"][^>]*>', '', sanitized, flags=re.IGNORECASE)
'''

ws = re.sub(
    r'def _inject_safety_hud\(sanitized: str, target_url: str, resolved_ip: str, is_credential_trap: bool\) -> str:\s*"""Injects the Safety HUD and In-App Interceptor\."""',
    strip_meta_code.strip(),
    ws
)

with open('backend/app/core/web_sandbox_engine.py', 'w', encoding='utf-8') as f:
    f.write(ws)

print('Updated web_sandbox_engine.py successfully!')

# 2. Update backend/app/main.py preview-frame endpoint headers
with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    main_py = f.read()

old_preview = '''@app.get(f"{settings.API_V1_STR}/sandbox/preview-frame", response_class=HTMLResponse)
def sandbox_preview_frame(url: str) -> HTMLResponse:
    res = inspect_url_dom_and_headers(url)
    return HTMLResponse(content=res.get("sanitized_html", ""), status_code=200)'''

new_preview = '''@app.get(f"{settings.API_V1_STR}/sandbox/preview-frame", response_class=HTMLResponse)
def sandbox_preview_frame(url: str) -> HTMLResponse:
    res = inspect_url_dom_and_headers(url)
    headers = {
        "X-Frame-Options": "ALLOWALL",
        "Content-Security-Policy": "frame-ancestors *",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
    }
    return HTMLResponse(content=res.get("sanitized_html", ""), status_code=200, headers=headers)'''

main_py = main_py.replace(old_preview, new_preview)

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(main_py)

print('Updated main.py preview-frame route successfully!')

# 3. Update api/v1/sandbox/preview-frame.js (Vercel serverless edge proxy)
with open('api/v1/sandbox/preview-frame.js', 'r', encoding='utf-8') as f:
    vercel_js = f.read()

# Add X-Frame-Options and Content-Security-Policy headers
vercel_js = vercel_js.replace(
    "res.setHeader('Content-Type', 'text/html; charset=utf-8');",
    "res.setHeader('Content-Type', 'text/html; charset=utf-8');\n  res.setHeader('X-Frame-Options', 'ALLOWALL');\n  res.setHeader('Content-Security-Policy', 'frame-ancestors *');"
)

# Strip frame-busting meta headers in preview-frame.js
strip_vercel = '''  let finalHtml = htmlContent;
  finalHtml = finalHtml.replace(/<meta[^>]*http-equiv=['"](?:content-security-policy|x-frame-options)['"][^>]*>/gi, '');'''

vercel_js = re.sub(r'let finalHtml = htmlContent;', strip_vercel, vercel_js, count=1)

with open('api/v1/sandbox/preview-frame.js', 'w', encoding='utf-8') as f:
    f.write(vercel_js)

print('Updated api/v1/sandbox/preview-frame.js successfully!')

# 4. Update executeChromiumGo in static_index.py to load via srcdoc with fetch
with open('backend/app/static_index.py', 'r', encoding='utf-8') as f:
    si = f.read()

old_exec = '''      // Special clean authentic authentication portal test
      const lower = targetUrl.toLowerCase();
      if (lower.includes('accounts.google') || lower.includes('login.live.com') || lower.includes('sbi')) {
        renderChromiumAuthPage(targetUrl);
      } else {
        iframe.removeAttribute('srcdoc');
        iframe.src = '/api/v1/sandbox/preview-frame?url=' + encodeURIComponent(targetUrl);
      }'''

new_exec = '''      // Special clean authentic authentication portal test
      const lower = targetUrl.toLowerCase();
      const normHost = lower.replace('https://','').replace('http://','').replace('www.','').split('/')[0];

      if (lower.includes('accounts.google') || lower.includes('login.live.com') || lower.includes('sbi')) {
        renderChromiumAuthPage(targetUrl);
      } else if (normHost === 'google.com' || normHost === 'google') {
        // Render in-app search directly to prevent Google anti-embedding block
        try {
          const res = await fetch('/api/v1/sandbox/preview-frame?url=' + encodeURIComponent('search:Cyber Squad Threat Intelligence'));
          const html = await res.text();
          iframe.removeAttribute('src');
          iframe.srcdoc = html;
        } catch(e) {
          iframe.removeAttribute('src');
          iframe.srcdoc = `<div style="font-family:sans-serif;padding:30px;color:#e8eaed;background:#202124;text-align:center;">
            <h2 style="color:#8ab4f8;">Google Search Sandbox</h2>
            <p style="color:#9aa0a6;">Live search proxy active for ${targetUrl}</p>
          </div>`;
        }
      } else {
        // Load via srcdoc to bypass browser X-Frame-Options embedding restrictions!
        try {
          const res = await fetch('/api/v1/sandbox/preview-frame?url=' + encodeURIComponent(targetUrl));
          if (res.ok) {
            const html = await res.text();
            iframe.removeAttribute('src');
            iframe.srcdoc = html;
          } else {
            iframe.removeAttribute('srcdoc');
            iframe.src = '/api/v1/sandbox/preview-frame?url=' + encodeURIComponent(targetUrl);
          }
        } catch (err) {
          iframe.removeAttribute('srcdoc');
          iframe.src = '/api/v1/sandbox/preview-frame?url=' + encodeURIComponent(targetUrl);
        }
      }'''

si = si.replace(old_exec, new_exec)

with open('backend/app/static_index.py', 'w', encoding='utf-8') as f:
    f.write(si)

pure_html = si
if pure_html.startswith('HTML_CONTENT = r"""'):
    pure_html = pure_html[len('HTML_CONTENT = r"""'):]
elif pure_html.startswith('HTML_CONTENT = """'):
    pure_html = pure_html[len('HTML_CONTENT = """'):]

if pure_html.endswith('"""\n'):
    pure_html = pure_html[:-4]
elif pure_html.endswith('"""'):
    pure_html = pure_html[:-3]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(pure_html.strip() + '\n')

print('Updated static_index.py and index.html with srcdoc bypass!')
