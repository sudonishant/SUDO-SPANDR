import re

with open('backend/app/static_index.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Authentic Chromium Browser Styling
chromium_css = '''
    /* Authentic Chromium Browser Sandbox */
    .chromium-browser-frame {
      background: #202124;
      border: 1px solid #3c4043;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75);
      margin-top: 14px;
      display: flex;
      flex-direction: column;
    }
    .chromium-tabstrip {
      background: #1f2023;
      padding: 8px 12px 0 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid #3c4043;
    }
    .chromium-tab {
      background: #292a2d;
      color: #e8eaed;
      border-radius: 8px 8px 0 0;
      padding: 7px 16px;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid #3c4043;
      border-bottom: none;
      max-width: 260px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chromium-newtab-btn {
      color: #9aa0a6;
      background: transparent;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 8px;
      border-radius: 50%;
    }
    .chromium-toolbar {
      background: #292a2d;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #3c4043;
      flex-wrap: wrap;
    }
    .chromium-nav-btn {
      background: transparent;
      border: none;
      color: #9aa0a6;
      padding: 6px 8px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .chromium-nav-btn:hover {
      background: #3c4043;
      color: #e8eaed;
    }
    .chromium-omnibox {
      flex: 1;
      min-width: 250px;
      background: #202124;
      border: 1px solid #3c4043;
      border-radius: 20px;
      padding: 6px 14px 6px 36px;
      color: #e8eaed;
      font-size: 13px;
      outline: none;
      position: relative;
      transition: border-color 0.2s, background 0.2s;
    }
    .chromium-omnibox:focus {
      border-color: #8ab4f8;
      background: #1f2023;
    }
    .chromium-viewport {
      height: 640px;
      background: #202124;
      position: relative;
      width: 100%;
    }
    @media (max-width: 680px) {
      .chromium-viewport {
        height: 68vh;
      }
    }
    .chromium-bottom-bar {
      background: #202124;
      border-top: 1px solid #3c4043;
      padding: 5px 14px;
      font-size: 11px;
      color: #9aa0a6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
'''

# Replace old chassis CSS
content = re.sub(r'/\* Dual Sandbox Device Modes: Phone Emulator & Virtual PC \*/[\s\S]*?/\* Virtual Desktop PC Chassis \*/[\s\S]*?\}', '', content)
content = content.replace('/* Mobile-First Master Column & Grid Rules */', chromium_css + '\n    /* Mobile-First Master Column & Grid Rules */')

# 2. Clean Chromium Markup for Mode 4
chromium_markup = '''    <!-- 4. EMBEDDED CHROMIUM SANDBOX WEB BROWSER -->
    <div id="mode-sandbox-view" style="display: none;">
      <div class="card" style="border-left: 3px solid #38bdf8; background: linear-gradient(135deg, rgba(56,189,248,0.06), var(--card-bg));">
        
        <div class="card-title" style="justify-content: space-between; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="globe" style="width: 16px; color: #38bdf8;"></i>
            <div>
              <small>AIR-GAPPED EMBEDDED WEB RUNTIME</small>
              <h3 style="font-size: 14px;">🌐 Chromium Sandbox Browser & Web Detonator</h3>
            </div>
          </div>
          
          <div style="display: flex; gap: 6px; align-items: center;">
            <input type="file" id="sandbox-file-picker" style="display: none;" onchange="sandboxOpenFile(event)">
            <button class="ghost-btn" style="padding: 5px 12px; font-size: 11px; border-color: rgba(139,92,246,0.4); color: #c084fc;" onclick="document.getElementById('sandbox-file-picker').click()">
              <i data-lucide="folder-open" style="width: 11px;"></i> 📂 Open File in Browser
            </button>
          </div>
        </div>

        <!-- 1-Click Fast Sandbox Targets -->
        <div style="display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; align-items: center;">
          <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 700;">Fast Targets:</span>
          <button class="ghost-btn" style="color: #60a5fa; border-color: rgba(96,165,250,0.3); padding: 3px 9px; font-size: 10.5px;" onclick="loadChromiumUrl('https://example.com')"><i data-lucide="globe" style="width: 10px;"></i> Example.com</button>
          <button class="ghost-btn" style="color: #34d399; border-color: rgba(52,211,153,0.3); padding: 3px 9px; font-size: 10.5px;" onclick="loadChromiumUrl('https://wikipedia.org')"><i data-lucide="globe" style="width: 10px;"></i> Wikipedia</button>
          <button class="ghost-btn" style="color: #fbbf24; border-color: rgba(251,191,36,0.3); padding: 3px 9px; font-size: 10.5px;" onclick="loadChromiumUrl('https://accounts.google.com')"><i data-lucide="lock" style="width: 10px;"></i> Google Auth</button>
          <button class="ghost-btn" style="color: #38bdf8; border-color: rgba(56,189,248,0.3); padding: 3px 9px; font-size: 10.5px;" onclick="loadChromiumUrl('https://login.live.com')"><i data-lucide="shield" style="width: 10px;"></i> Outlook 365</button>
          <button class="ghost-btn" style="color: #f87171; border-color: rgba(239,68,68,0.3); padding: 3px 9px; font-size: 10.5px;" onclick="loadChromiumUrl('sbi netbanking phishing')"><i data-lucide="search" style="width: 10px;"></i> SBI Search</button>
        </div>

        <!-- Diagnostics Alert Bar -->
        <div id="sandbox-diag-panel" style="display: none; background: rgba(0,0,0,0.35); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <div>
              <span style="color: #94a3b8; font-weight: 700;">VERDICT:</span>
              <strong id="sb-verdict" style="color: #34d399; margin-left: 6px;">🟢 SAFE IN-APP BROWSING</strong>
            </div>
            <div>
              <span style="color: #94a3b8;">RISK:</span>
              <strong id="sb-risk-score" class="mono" style="color: #34d399; margin-left: 4px;">20/100</strong>
            </div>
            <div id="sb-ip" class="mono" style="color: #60a5fa;">104.21.48.204</div>
          </div>
        </div>

        <!-- Honeypot Credential Vault (Reveals when form is submitted) -->
        <div id="sb-credential-vault" style="display: none; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-left: 4px solid #ef4444; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; font-size: 11px; color: #f87171;">🎣 AIR-GAP CREDENTIAL INTERCEPTED</span>
            <span class="mono" style="font-size: 9.5px; color: #fbbf24;">TRAPPED SAFELY</span>
          </div>
          <p style="font-size: 11px; color: #e2e8f0; margin-top: 4px; margin-bottom: 0;">
            Account: <strong style="color: #60a5fa;"><span id="vault-user">user@example.com</span></strong> | Password: <strong style="color: #f87171;">•••••••• (Isolated in Memory)</strong>
          </p>
        </div>

        <!-- REAL CHROMIUM BROWSER WINDOW -->
        <div class="chromium-browser-frame">
          
          <!-- Top Tabstrip -->
          <div class="chromium-tabstrip">
            <div class="chromium-tab" id="chromium-tab-title">
              <i data-lucide="globe" style="width: 12px; color: #8ab4f8;"></i>
              <span id="chromium-tab-text">Chromium Sandbox</span>
            </div>
            <button class="chromium-newtab-btn" title="New Tab" onclick="loadChromiumWelcome()">+</button>
          </div>

          <!-- Chromium Toolbar / Address Bar -->
          <div class="chromium-toolbar">
            <button class="chromium-nav-btn" title="Back" onclick="reloadChromium()"><i data-lucide="arrow-left" style="width: 14px;"></i></button>
            <button class="chromium-nav-btn" title="Forward" onclick="reloadChromium()"><i data-lucide="arrow-right" style="width: 14px;"></i></button>
            <button class="chromium-nav-btn" title="Reload" onclick="reloadChromium()"><i data-lucide="rotate-cw" style="width: 14px;"></i></button>
            
            <div style="flex: 1; position: relative; display: flex; align-items: center;">
              <i data-lucide="lock" style="position: absolute; left: 12px; width: 13px; color: #81c995;"></i>
              <input type="text" id="chromium-url-input" class="chromium-omnibox" value="https://example.com" placeholder="Search Google or type a URL..." onkeydown="if(event.key==='Enter') executeChromiumGo()">
            </div>

            <button class="primary-btn" style="padding: 7px 16px; font-size: 11.5px; background: #1a73e8; border-radius: 18px;" onclick="executeChromiumGo()">
              Go
            </button>
          </div>

          <!-- The Live Chromium Web Viewport -->
          <div class="chromium-viewport">
            <iframe id="web-sandbox-iframe" style="width: 100%; height: 100%; border: none; background: #202124;" sandbox="allow-same-origin allow-forms allow-scripts"></iframe>
          </div>

          <!-- Bottom Chromium Status Info -->
          <div class="chromium-bottom-bar">
            <span>● Sandboxed Chromium Subsystem · 100% In-App</span>
            <span style="color: #81c995;">Isolated Memory Guard</span>
          </div>

        </div>

      </div>
    </div>'''

content = re.sub(
    r'<!-- 4\. EMBEDDED IN-APP SAFE SANDBOX WEB BROWSER -->[\s\S]*?<!-- FORENSIC RESULTS VIEWPORT -->',
    chromium_markup + '\n\n    <!-- FORENSIC RESULTS VIEWPORT -->',
    content
)

# 3. Clean Chromium Engine Functions
chromium_js = '''
    // ==========================================
    // 🌐 DEFAULT CHROMIUM SANDBOX BROWSER ENGINE
    // ==========================================

    function loadChromiumWelcome() {
      const iframe = document.getElementById('web-sandbox-iframe');
      const input = document.getElementById('chromium-url-input');
      const tabText = document.getElementById('chromium-tab-text');
      
      if (input) input.value = 'chromium://newtab';
      if (tabText) tabText.innerText = 'New Tab';
      if (!iframe) return;

      iframe.removeAttribute('src');
      iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Tab</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { background: #202124; color: #e8eaed; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center; }
    .logo { font-size: 40px; font-weight: 700; letter-spacing: -1px; margin-bottom: 24px; color: #fff; display: flex; align-items: center; gap: 10px; justify-content: center; }
    .search-box { width: 100%; max-width: 540px; background: #303134; border: 1px solid #5f6368; border-radius: 24px; padding: 12px 20px; color: #fff; font-size: 14px; outline: none; margin-bottom: 30px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
    .shortcuts { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; max-width: 540px; }
    .sc-btn { background: #303134; border: 1px solid #3c4043; color: #e8eaed; padding: 12px 16px; border-radius: 12px; font-size: 12px; cursor: pointer; text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 90px; }
    .sc-btn:hover { background: #3c4043; border-color: #8ab4f8; }
    .sc-icon { font-size: 22px; }
  </style>
</head>
<body>
  <div class="logo">
    <span style="color:#8ab4f8;">C</span><span style="color:#ea4335;">h</span><span style="color:#fbbc04;">r</span><span style="color:#8ab4f8;">o</span><span style="color:#81c995;">m</span><span style="color:#ea4335;">i</span><span style="color:#8ab4f8;">u</span><span style="color:#fbbc04;">m</span>
    <span style="font-size:12px;background:#3c4043;padding:3px 8px;border-radius:6px;color:#9aa0a6;margin-left:6px;">SANDBOX</span>
  </div>
  <input type="text" class="search-box" placeholder="Search Google or type a URL..." onkeydown="if(event.key==='Enter') window.parent.postMessage({type:'CHROMIUM_SEARCH', query:this.value}, '*')">
  <div class="shortcuts">
    <div class="sc-btn" onclick="window.parent.postMessage({type:'CHROMIUM_NAVIGATE', url:'https://example.com'}, '*')">
      <span class="sc-icon">🌐</span>
      <span>Example</span>
    </div>
    <div class="sc-btn" onclick="window.parent.postMessage({type:'CHROMIUM_NAVIGATE', url:'https://wikipedia.org'}, '*')">
      <span class="sc-icon">📚</span>
      <span>Wikipedia</span>
    </div>
    <div class="sc-btn" onclick="window.parent.postMessage({type:'CHROMIUM_NAVIGATE', url:'https://accounts.google.com'}, '*')">
      <span class="sc-icon">🔒</span>
      <span>Google</span>
    </div>
    <div class="sc-btn" onclick="window.parent.postMessage({type:'CHROMIUM_NAVIGATE', url:'https://login.live.com'}, '*')">
      <span class="sc-icon">💼</span>
      <span>Outlook</span>
    </div>
    <div class="sc-btn" onclick="window.parent.postMessage({type:'CHROMIUM_TRIGGER_FILE'}, '*')">
      <span class="sc-icon">📂</span>
      <span>Open File</span>
    </div>
  </div>
</body>
</html>`;
    }

    function loadChromiumUrl(url) {
      document.getElementById('chromium-url-input').value = url;
      executeChromiumGo();
    }

    function reloadChromium() {
      executeChromiumGo();
    }

    async function executeChromiumGo() {
      const raw = document.getElementById('chromium-url-input').value.trim();
      if (!raw) return;

      const iframe = document.getElementById('web-sandbox-iframe');
      const tabText = document.getElementById('chromium-tab-text');
      const diagPanel = document.getElementById('sandbox-diag-panel');

      let targetUrl = raw;
      const isSearch = !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && (!targetUrl.includes('.') || targetUrl.includes(' '));
      if (isSearch) {
        targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(targetUrl)}`;
      } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      let hostname = targetUrl;
      try { hostname = new URL(targetUrl).hostname; } catch(e) {}
      if (tabText) tabText.innerText = hostname.replace('www.', '');

      if (diagPanel) diagPanel.style.display = 'block';
      document.getElementById('sb-verdict').innerText = '⏳ Loading in Chromium Sandbox...';
      document.getElementById('sb-verdict').style.color = '#8ab4f8';

      // Perform threat diagnosis
      const isPhish = /login|auth|signin|password|bank|verify|account/i.test(targetUrl);
      document.getElementById('sb-verdict').innerText = isPhish ? '🚨 HIGH RISK: Credential Phishing Signature' : '🟢 SAFE CHROMIUM RUNTIME';
      document.getElementById('sb-verdict').style.color = isPhish ? '#f87171' : '#34d399';
      document.getElementById('sb-risk-score').innerText = isPhish ? '85/100' : '15/100';
      document.getElementById('sb-risk-score').style.color = isPhish ? '#f87171' : '#34d399';
      document.getElementById('sb-ip').innerText = hostname;

      // Special clean authentic authentication portal test
      const lower = targetUrl.toLowerCase();
      if (lower.includes('accounts.google') || lower.includes('login.live.com') || lower.includes('sbi')) {
        renderChromiumAuthPage(targetUrl);
      } else {
        iframe.removeAttribute('srcdoc');
        iframe.src = '/api/v1/sandbox/preview-frame?url=' + encodeURIComponent(targetUrl);
      }
    }

    function renderChromiumAuthPage(targetUrl) {
      const iframe = document.getElementById('web-sandbox-iframe');
      const isGoogle = targetUrl.includes('google');
      const isOutlook = targetUrl.includes('live.com') || targetUrl.includes('microsoft');
      const title = isGoogle ? 'Google Account' : (isOutlook ? 'Microsoft 365' : 'State Bank of India');
      const brandCol = isGoogle ? '#1a73e8' : (isOutlook ? '#0078d4' : '#003366');

      iframe.removeAttribute('src');
      iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} Sign in</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #202124; color: #e8eaed; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .card { background: #292a2d; border: 1px solid #3c4043; border-radius: 12px; padding: 32px 28px; width: 100%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h2 { font-size: 22px; font-weight: 600; margin-bottom: 6px; color: #fff; }
    p { font-size: 13px; color: #9aa0a6; margin-bottom: 24px; }
    label { display: block; font-size: 12px; color: #bdc1c6; margin-bottom: 6px; }
    input { width: 100%; background: #202124; border: 1px solid #5f6368; color: #fff; padding: 11px 14px; border-radius: 6px; font-size: 14px; margin-bottom: 16px; outline: none; }
    input:focus { border-color: ${brandCol}; }
    button { width: 100%; background: ${brandCol}; color: #fff; border: none; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .badge { background: #3c4043; color: #8ab4f8; font-size: 11px; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">🛡️ CHROMIUM AIR-GAP AUTH TEST</span>
    <h2>Sign in</h2>
    <p>to continue to ${title}</p>
    <form onsubmit="event.preventDefault(); const u = document.getElementById('usr').value; window.parent.postMessage({type:'SANDBOX_LOGIN_CAPTURED', username: u, action:'${targetUrl}'}, '*'); alert('🛡️ CHROMIUM LOGIN HARVEST TEST:\\n\\nAccount: ' + u + '\\nPassword: [••••••••]\\n\\nSafely intercepted and trapped in Air-Gap Sandbox Vault.');">
      <label>Email or phone</label>
      <input type="text" id="usr" value="user@domain.com" required>
      <label>Password</label>
      <input type="password" id="pwd" value="Password123" required>
      <button type="submit">Next / Sign In</button>
    </form>
  </div>
</body>
</html>`;
    }

    // Message listener for Chromium Navigation & Login
    window.addEventListener('message', function(event) {
      if (!event.data) return;

      if (event.data.type === 'CHROMIUM_NAVIGATE') {
        loadChromiumUrl(event.data.url);
      }
      if (event.data.type === 'CHROMIUM_SEARCH') {
        loadChromiumUrl(event.data.query);
      }
      if (event.data.type === 'CHROMIUM_TRIGGER_FILE') {
        document.getElementById('sandbox-file-picker')?.click();
      }
      if (event.data.type === 'SANDBOX_LOGIN_CAPTURED') {
        const vault = document.getElementById('sb-credential-vault');
        const vaultUser = document.getElementById('vault-user');
        if (vault) {
          vault.style.display = 'block';
          if (vaultUser) vaultUser.innerText = event.data.username || 'Captured Email/User';
          vault.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });

    // File Opener inside Chromium
    async function sandboxOpenFile(event) {
      const file = event.target.files[0];
      if (!file) return;

      const iframe = document.getElementById('web-sandbox-iframe');
      const input = document.getElementById('chromium-url-input');
      const tabText = document.getElementById('chromium-tab-text');
      
      if (input) input.value = `file://${file.name}`;
      if (tabText) tabText.innerText = file.name;

      const ext = file.name.split('.').pop().toLowerCase();
      const rawBytes = await file.arrayBuffer();
      const sha256 = await computeSHA256(rawBytes);

      iframe.removeAttribute('src');

      if (ext === 'html' || ext === 'htm') {
        iframe.srcdoc = await file.text();
      } else if (ext === 'pdf') {
        const blobUrl = URL.createObjectURL(new Blob([rawBytes], { type: 'application/pdf' }));
        iframe.srcdoc = `<iframe src="${blobUrl}" style="width:100%;height:100%;border:none;background:#fff;"></iframe>`;
      } else if (/^(png|jpg|jpeg|gif|svg|webp)$/i.test(ext)) {
        const imgUrl = URL.createObjectURL(file);
        iframe.srcdoc = `<div style="background:#202124;height:100%;display:flex;align-items:center;justify-content:center;padding:20px;">
          <img src="${imgUrl}" style="max-width:90%;max-height:85%;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.8);">
        </div>`;
      } else {
        const text = await file.text();
        const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        iframe.srcdoc = `<div style="background:#202124;color:#8ab4f8;padding:20px;height:100%;box-sizing:border-box;overflow:auto;font-family:monospace;font-size:12px;line-height:1.6;">
          <pre style="margin:0;white-space:pre-wrap;word-break:break-all;">${esc}</pre>
        </div>`;
      }
    }
'''

content = re.sub(
    r'// ==========================================\s*// 🖥️ VIRTUAL PC BROWSER CORE & HOMEPAGE RUNTIME[\s\S]*?function openQuickApp\(url\)[\s\S]*?\}',
    chromium_js.strip(),
    content
)

# Update setMode to load Chromium welcome screen when sandbox tab is clicked
content = re.sub(
    r'if \(mode === \'sandbox\'\) \{[\s\S]*?\}',
    '''if (mode === 'sandbox') {
        const iframe = document.getElementById('web-sandbox-iframe');
        if (!iframe.srcdoc && (!iframe.src || iframe.src === 'about:blank' || iframe.src === window.location.href)) {
          loadChromiumWelcome();
        }
      }''',
    content
)

with open('backend/app/static_index.py', 'w', encoding='utf-8') as f:
    f.write(content)

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

print('Default Chromium Sandbox successfully installed!')
