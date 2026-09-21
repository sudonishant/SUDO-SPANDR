import re

with open('backend/app/static_index.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Authentic Google Search Engine Page Generator for Chromium Sandbox
google_search_html = '''
    function renderChromiumGoogleSearch(query) {
      const iframe = document.getElementById('web-sandbox-iframe');
      const input = document.getElementById('chromium-url-input');
      const tabText = document.getElementById('chromium-tab-text');
      
      if (tabText) tabText.innerText = query ? (query + ' - Google Search') : 'Google';
      if (!iframe) return;

      iframe.removeAttribute('src');

      if (!query || query === 'google' || query === 'www.google.com' || query === 'google.com') {
        // Google Search Homepage
        iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #202124; color: #e8eaed; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; }
    .top-bar { display: flex; justify-content: flex-end; padding: 16px 24px; gap: 16px; align-items: center; font-size: 13px; }
    .top-bar a { color: #e8eaed; text-decoration: none; }
    .top-bar a:hover { text-decoration: underline; }
    .signin-btn { background: #8ab4f8; color: #202124; font-weight: 700; padding: 7px 16px; border-radius: 4px; text-decoration: none !important; }
    
    .center-box { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 20px; }
    .logo { font-size: 64px; font-weight: 700; letter-spacing: -2px; margin-bottom: 24px; user-select: none; }
    .g-blue { color: #8ab4f8; } .g-red { color: #ea4335; } .g-yellow { color: #fbbc04; } .g-green { color: #81c995; }
    
    .search-form { width: 100%; max-width: 580px; position: relative; margin-bottom: 24px; }
    .search-box { width: 100%; background: #303134; border: 1px solid #5f6368; border-radius: 24px; padding: 12px 20px 12px 42px; color: #fff; font-size: 14px; outline: none; box-shadow: 0 1px 6px rgba(0,0,0,0.3); }
    .search-box:focus { background: #303134; border-color: #8ab4f8; }
    .search-icon { position: absolute; left: 14px; top: 12px; font-size: 15px; color: #9aa0a6; }
    
    .btn-row { display: flex; gap: 12px; justify-content: center; }
    .g-btn { background: #303134; border: 1px solid #303134; color: #e8eaed; padding: 8px 16px; border-radius: 4px; font-size: 13px; cursor: pointer; }
    .g-btn:hover { border-color: #5f6368; }

    .footer { background: #171717; padding: 12px 24px; display: flex; justify-content: space-between; font-size: 12px; color: #9aa0a6; border-top: 1px solid #3c4043; flex-wrap: wrap; gap: 12px; }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="#" onclick="window.parent.postMessage({type:'CHROMIUM_NAVIGATE', url:'https://accounts.google.com'}, '*')">Gmail</a>
    <a href="#" onclick="window.parent.postMessage({type:'CHROMIUM_NAVIGATE', url:'https://accounts.google.com'}, '*')">Images</a>
    <a href="#" class="signin-btn" onclick="window.parent.postMessage({type:'CHROMIUM_NAVIGATE', url:'https://accounts.google.com'}, '*')">Sign in</a>
  </div>

  <div class="center-box">
    <div class="logo">
      <span class="g-blue">G</span><span class="g-red">o</span><span class="g-yellow">o</span><span class="g-blue">g</span><span class="g-green">l</span><span class="g-red">e</span>
      <span style="font-size:11px;background:#3c4043;padding:2px 6px;border-radius:4px;color:#8ab4f8;letter-spacing:0;vertical-align:super;font-weight:600;">SANDBOX</span>
    </div>

    <form class="search-form" onsubmit="event.preventDefault(); const q = document.getElementById('search-inp').value; window.parent.postMessage({type:'CHROMIUM_SEARCH', query: q}, '*');">
      <span class="search-icon">🔍</span>
      <input type="text" id="search-inp" class="search-box" placeholder="Search Google or type a URL..." autofocus>
      <div class="btn-row" style="margin-top:16px;">
        <button type="submit" class="g-btn">Google Search</button>
        <button type="button" class="g-btn" onclick="window.parent.postMessage({type:'CHROMIUM_SEARCH', query:'CyberSquad IOC Phishing Feeds'}, '*')">I'm Feeling Lucky</button>
      </div>
    </form>
  </div>

  <div class="footer">
    <div>India · Sandboxed Environment</div>
    <div style="display:flex;gap:16px;">
      <span>Air-Gap Memory Safe</span>
      <span>Zero External Tracking</span>
    </div>
  </div>
</body>
</html>`;
      } else {
        // Search Results Mode (fetch search results via proxy)
        fetch('/api/v1/sandbox/preview-frame?url=' + encodeURIComponent('search:' + query))
          .then(r => r.text())
          .then(html => {
            iframe.srcdoc = html;
          })
          .catch(() => {
            iframe.srcdoc = `<div style="font-family:sans-serif;padding:30px;color:#e8eaed;background:#202124;text-align:center;">
              <h2 style="color:#8ab4f8;">Google Search Sandbox</h2>
              <p style="color:#9aa0a6;">Showing results for: <strong>${query}</strong></p>
            </div>`;
          });
      }
    }
'''

content = re.sub(
    r'function renderChromiumAuthPage\(targetUrl\) \{',
    google_search_html.strip() + '\n\n    function renderChromiumAuthPage(targetUrl) {',
    content
)

# Update executeChromiumGo to check for Google and render properly
old_exec_go = '''      // Special clean authentic authentication portal test
      const lower = targetUrl.toLowerCase();
      const normHost = lower.replace('https://','').replace('http://','').replace('www.','').split('/')[0];

      if (lower.includes('accounts.google') || lower.includes('login.live.com') || lower.includes('sbi')) {
        renderChromiumAuthPage(targetUrl);
      } else if (normHost === 'google.com' || normHost === 'google') {'''

new_exec_go = '''      // Clean Google & Special Auth Detonation
      const lower = targetUrl.toLowerCase();
      const normHost = lower.replace('https://','').replace('http://','').replace('www.','').split('/')[0];

      if (lower.includes('accounts.google') || lower.includes('login.live.com') || lower.includes('sbi')) {
        renderChromiumAuthPage(targetUrl);
      } else if (normHost === 'google.com' || normHost === 'google') {
        renderChromiumGoogleSearch('');
      } else if (targetUrl.startsWith('https://html.duckduckgo.com') || lower.includes('google.com/search')) {
        let q = '';
        try { q = new URL(targetUrl).searchParams.get('q') || ''; } catch(e){}
        renderChromiumGoogleSearch(q);'''

content = content.replace(old_exec_go, new_exec_go)

# Write to static_index.py
with open('backend/app/static_index.py', 'w', encoding='utf-8') as f:
    f.write(content)

# Extract pure HTML for root index.html
pure_html = content
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

print('Integrated authentic Google Search Sandbox successfully into Chromium!')
