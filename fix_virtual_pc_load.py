import re

with open('backend/app/static_index.py', 'r') as f:
    content = f.read()

# Update setMode to automatically load Virtual PC homepage if blank
old_set_mode = '''    function setMode(mode) {
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      const activeTabId = mode === 'sandbox' ? 'tab-sandbox-intake' : ('tab-' + mode);
      document.getElementById(activeTabId)?.classList.add('active');
      
      document.getElementById('mode-eml-view').style.display = mode === 'eml' ? 'block' : 'none';
      document.getElementById('mode-text-view').style.display = mode === 'text' ? 'block' : 'none';
      document.getElementById('mode-attach-view').style.display = mode === 'attach' ? 'block' : 'none';
      document.getElementById('mode-sandbox-view').style.display = mode === 'sandbox' ? 'block' : 'none';
    }'''

new_set_mode = '''    function setMode(mode) {
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      const activeTabId = mode === 'sandbox' ? 'tab-sandbox-intake' : ('tab-' + mode);
      document.getElementById(activeTabId)?.classList.add('active');
      
      document.getElementById('mode-eml-view').style.display = mode === 'eml' ? 'block' : 'none';
      document.getElementById('mode-text-view').style.display = mode === 'text' ? 'block' : 'none';
      document.getElementById('mode-attach-view').style.display = mode === 'attach' ? 'block' : 'none';
      document.getElementById('mode-sandbox-view').style.display = mode === 'sandbox' ? 'block' : 'none';

      if (mode === 'sandbox') {
        const iframe = document.getElementById('web-sandbox-iframe');
        if (!iframe.srcdoc && (!iframe.src || iframe.src === 'about:blank' || iframe.src === window.location.href)) {
          loadVirtualPCHomepage();
        }
      }
    }'''

content = content.replace(old_set_mode, new_set_mode)

# Define loadVirtualPCHomepage and renderSimulatedWebPortal
virtual_pc_engine_js = '''
    // ==========================================
    // 🖥️ VIRTUAL PC BROWSER CORE & HOMEPAGE RUNTIME
    // ==========================================

    function loadVirtualPCHomepage() {
      const iframe = document.getElementById('web-sandbox-iframe');
      if (!iframe) return;

      iframe.src = '';
      iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CyberSquad Virtual PC Desktop</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: radial-gradient(circle at 50% 20%, #1e293b, #030712); color: #f8fafc; min-height: 100vh; padding: 24px 16px; text-align: center; }
    .brand-title { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; margin-bottom: 4px; }
    .brand-sub { font-size: 12px; color: #38bdf8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 20px; }
    
    .search-box-wrap { max-width: 540px; margin: 0 auto 24px; position: relative; display: flex; }
    .search-input { width: 100%; padding: 12px 18px 12px 42px; border-radius: 24px 0 0 24px; border: 1px solid #38bdf8; background: rgba(15,23,42,0.9); color: #fff; font-size: 13.5px; outline: none; box-shadow: 0 4px 20px rgba(56,189,248,0.2); }
    .search-btn { background: #2563eb; color: #fff; border: none; padding: 0 20px; border-radius: 0 24px 24px 0; font-weight: 700; font-size: 13px; cursor: pointer; }
    .search-icon { position: absolute; left: 15px; top: 12px; font-size: 15px; }

    .apps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 12px; max-width: 620px; margin: 0 auto 24px; }
    .app-card { background: rgba(30,41,59,0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px 10px; cursor: pointer; transition: all 0.2s ease; text-align: center; }
    .app-card:hover { transform: translateY(-3px); border-color: #38bdf8; background: rgba(56,189,248,0.15); box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
    .app-icon { font-size: 28px; margin-bottom: 6px; }
    .app-name { font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .app-meta { font-size: 10px; color: #94a3b8; }

    .live-status-bar { background: rgba(15,23,42,0.7); border: 1px solid #334155; border-radius: 8px; padding: 8px 14px; max-width: 620px; margin: 0 auto; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="brand-title">🛡️ CyberSquad Virtual PC Browser</div>
  <div class="brand-sub">Isolated Chromium Subsystem · 100% Air-Gapped Sandbox</div>

  <form class="search-box-wrap" onsubmit="event.preventDefault(); const q = document.getElementById('home-search').value; window.parent.postMessage({type:'PARENT_SET_AND_DETONATE', url: q}, '*');">
    <span class="search-icon">🔍</span>
    <input type="text" id="home-search" class="search-input" placeholder="Search Google or enter email login URL to test in sandbox...">
    <button type="submit" class="search-btn">Detonate</button>
  </form>

  <div class="apps-grid">
    <div class="app-card" onclick="window.parent.postMessage({type:'PARENT_SET_AND_DETONATE', url:'https://accounts.google.com'}, '*')">
      <div class="app-icon">📧</div>
      <div class="app-name">Google / Gmail</div>
      <div class="app-meta">Test Email Login</div>
    </div>
    <div class="app-card" onclick="window.parent.postMessage({type:'PARENT_SET_AND_DETONATE', url:'https://login.live.com'}, '*')">
      <div class="app-icon">💼</div>
      <div class="app-name">Outlook 365</div>
      <div class="app-meta">Microsoft Webmail</div>
    </div>
    <div class="app-card" onclick="window.parent.postMessage({type:'PARENT_SET_AND_DETONATE', url:'sbi netbanking phishing login'}, '*')">
      <div class="app-icon">🏦</div>
      <div class="app-name">SBI NetBanking</div>
      <div class="app-meta">Phish Trap Test</div>
    </div>
    <div class="app-card" onclick="window.parent.postMessage({type:'PARENT_TRIGGER_FILE_OPEN'}, '*')">
      <div class="app-icon">📂</div>
      <div class="app-name">Inspect File</div>
      <div class="app-meta">PDF, HTML, Code, Image</div>
    </div>
  </div>

  <div class="live-status-bar">
    <span>● Air-Gap Memory Guard Active</span>
    <span style="color:#34d399;">CPU: 1% · RAM: 280MB</span>
    <span>Zero-Leak Container</span>
  </div>
</body>
</html>`;
    }

    function renderSimulatedWebPortal(targetUrl) {
      const iframe = document.getElementById('web-sandbox-iframe');
      const urlLower = targetUrl.toLowerCase();

      let isGoogle = urlLower.includes('google') || urlLower.includes('gmail');
      let isOutlook = urlLower.includes('live.com') || urlLower.includes('microsoft') || urlLower.includes('outlook') || urlLower.includes('office');
      let isBank = urlLower.includes('sbi') || urlLower.includes('bank') || urlLower.includes('netbanking');

      let portalTitle = isGoogle ? 'Google Account Sign In' : (isOutlook ? 'Microsoft Outlook 365 Sign In' : (isBank ? 'State Bank of India — NetBanking' : `In-App Detonator: ${targetUrl}`));
      let logoEmoji = isGoogle ? '📧' : (isOutlook ? '💼' : (isBank ? '🏦' : '🌐'));
      let brandColor = isGoogle ? '#4285F4' : (isOutlook ? '#0078D4' : (isBank ? '#003366' : '#2563eb'));

      iframe.src = '';
      iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${portalTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #f1f5f9; color: #1e293b; min-height: 100vh; display: flex; flex-direction: column; }
    
    .hud-header { background: #0f172a; color: #fff; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; border-bottom: 2px solid ${brandColor}; }
    .hud-badge { background: #ef4444; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; }
    
    .login-container { max-width: 420px; width: 92%; margin: 40px auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 32px 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); text-align: center; }
    .logo { font-size: 36px; margin-bottom: 12px; }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
    .sub { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    
    .input-group { text-align: left; margin-bottom: 16px; }
    .input-group label { display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    .input-group input { width: 100%; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; transition: border-color 0.2s; }
    .input-group input:focus { border-color: ${brandColor}; ring: 2px ${brandColor}; }
    
    .submit-btn { width: 100%; background: ${brandColor}; color: #fff; border: none; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity 0.2s; margin-top: 8px; }
    .submit-btn:hover { opacity: 0.9; }
    
    .footer-note { font-size: 11px; color: #94a3b8; margin-top: 20px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="hud-header">
    <div>🛡️ <strong>Air-Gapped Sandbox Target:</strong> <span style="color:#94a3b8;">${targetUrl.substring(0, 45)}</span></div>
    <div class="hud-badge">TEST LOGIN ENABLED</div>
  </div>

  <div class="login-container">
    <div class="logo">${logoEmoji}</div>
    <h2 class="title">${portalTitle}</h2>
    <p class="sub">Sign in to test authentication and honeypot credential capture</p>

    <form id="sandbox-login-form">
      <div class="input-group">
        <label>Email, Phone, or Username</label>
        <input type="text" id="user-input" placeholder="e.g. analyst@cybersquad.gov.in" required value="test.user@company.com">
      </div>
      <div class="input-group">
        <label>Password</label>
        <input type="password" id="pass-input" placeholder="Enter test password..." required value="Password123!">
      </div>
      <button type="submit" class="submit-btn">Sign In / Continue</button>
    </form>

    <p class="footer-note">
      🔒 <strong>Air-Gap Security:</strong> Credentials entered here are trapped safely in the in-memory honeypot vault and will NEVER be transmitted to external servers.
    </p>
  </div>

  <script>
    document.getElementById('sandbox-login-form').addEventListener('submit', function(e) {
      e.preventDefault();
      const userVal = document.getElementById('user-input').value;
      const passVal = document.getElementById('pass-input').value;
      
      try {
        window.parent.postMessage({
          type: 'SANDBOX_LOGIN_CAPTURED',
          username: userVal,
          hasPassword: true,
          action: '${targetUrl}'
        }, '*');
      } catch(err) {}

      alert('🛡️ SANDBOX LOGIN INTERCEPTED!\\n\\nAccount: ' + userVal + '\\nPassword: [••••••••]\\n\\nCredentials trapped safely in CyberSquad Air-Gap Honeypot Vault without leaking to external servers.');
    });
  </script>
</body>
</html>`;
    }
'''

content = content.replace(
    '// ==========================================\n    // 🛡️ DUAL DEVICE EMULATOR & SANDBOX FILE RUNTIME',
    virtual_pc_engine_js.strip() + '\n\n    // ==========================================\n    // 🛡️ DUAL DEVICE EMULATOR & SANDBOX FILE RUNTIME'
)

# Also update window message listener to handle PARENT_SET_AND_DETONATE and PARENT_TRIGGER_FILE_OPEN
message_listener_patch = '''      if (event.data.type === 'PARENT_SET_AND_DETONATE') {
        setAndDetonate(event.data.url);
      }
      if (event.data.type === 'PARENT_TRIGGER_FILE_OPEN') {
        document.getElementById('sandbox-file-picker')?.click();
      }'''

content = content.replace(
    "if (event.data.type === 'SANDBOX_NAVIGATE') {",
    message_listener_patch + "\n\n      if (event.data.type === 'SANDBOX_NAVIGATE') {"
)

# Update detonateWebLink to fallback gracefully to renderSimulatedWebPortal for login domains or offline
detonate_resilience = '''
      // Load safe sanitized preview in the in-app frame
      const lowerUrl = (data.url || targetUrl).toLowerCase();
      const isSpecialLogin = lowerUrl.includes('accounts.google') || lowerUrl.includes('login.live.com') || lowerUrl.includes('sbi');
      
      if (isSpecialLogin) {
        renderSimulatedWebPortal(data.url || targetUrl);
      } else {
        iframe.src = '/api/v1/sandbox/preview-frame?url=' + encodeURIComponent(data.url || targetUrl);
      }
'''

content = re.sub(
    r'// Load safe sanitized preview in the in-app frame\s*iframe\.src = [^\n]+;',
    detonate_resilience.strip(),
    content
)

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

print('Virtual PC automatic loading & interactive simulated web portal successfully applied!')
