HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyber Squad — SentinelMail Threat Triage & Live noVNC Desktop Sandbox</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      --bg: #07090e;
      --card-bg: #0d131c;
      --panel-bg: rgba(13, 19, 28, 0.92);
      --border: #202e40;
      --border-focus: #3b82f6;
      --text: #edf2f7;
      --text-muted: #8292a4;
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.25);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Manrope', system-ui, sans-serif;
      background: radial-gradient(circle at 80% -20%, rgba(37, 99, 235, 0.18), transparent 45%), var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.5;
    }
    code, .mono { font-family: 'DM Mono', monospace; }
    button, input, textarea, select { font-family: inherit; }
    button { cursor: pointer; border: none; outline: none; transition: all 0.15s ease; }
    button:disabled { cursor: not-allowed; opacity: 0.5; }

    .topbar {
      height: 64px;
      border-bottom: 1px solid var(--border);
      background: rgba(7, 9, 14, 0.9);
      backdrop-filter: blur(20px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(16px, 4vw, 48px);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-mark {
      width: 32px; height: 32px;
      display: grid; place-items: center;
      border: 1px solid rgba(59, 130, 246, 0.4);
      border-radius: 8px;
      color: #60a5fa;
      background: rgba(59, 130, 246, 0.12);
    }
    .brand strong { font-size: 13px; letter-spacing: 0.12em; display: block; }
    .brand span { color: var(--text-muted); font-size: 10px; }
    
    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
      color: #6ee7b7;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 4px 10px;
      border-radius: 20px;
    }
    .status-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
    }

    .container {
      width: min(1200px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 60px;
    }

    /* Modern Mode Selector Tabs */
    .mode-tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .mode-tab {
      background: #0f1622;
      border: 1px solid #1e2c3d;
      color: #94a3b8;
      padding: 12px 14px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: left;
    }
    .mode-tab:hover { border-color: #3b82f6; color: #e2e8f0; }
    .mode-tab.active {
      background: #1e293b;
      border-color: #3b82f6;
      color: #f8fafc;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
    }
    .mode-tab strong { display: block; font-size: 13px; font-weight: 700; }
    .mode-tab small { display: block; font-size: 10px; color: var(--text-muted); }

    .mode-tab.sandbox-tab.active {
      background: rgba(59, 130, 246, 0.15);
      border-color: #60a5fa;
      color: #ffffff;
    }

    .intake-shell {
      background: var(--panel-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      margin-bottom: 24px;
    }

    .dropzone {
      border: 2px dashed #2a3c52;
      border-radius: 12px;
      padding: 32px 20px;
      text-align: center;
      background: rgba(11, 16, 24, 0.6);
    }
    .dropzone.dragover { border-color: var(--accent); background: rgba(59, 130, 246, 0.1); }
    .dropzone-icon {
      width: 44px; height: 44px;
      border-radius: 10px;
      background: #172435;
      color: #93c5fd;
      display: grid; place-items: center;
      margin: 0 auto 12px;
    }
    .dropzone h3 { font-size: 15px; margin-bottom: 4px; }
    .dropzone p { color: var(--text-muted); font-size: 11px; margin-bottom: 14px; }
    
    .primary-btn {
      background: #2563eb;
      color: #ffffff;
      padding: 9px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .primary-btn:hover { background: #1d4ed8; }

    .ghost-btn {
      background: #0f172a;
      color: #cbd5e1;
      border: 1px solid #273549;
      padding: 6px 11px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .ghost-btn:hover { background: #1e293b; border-color: #3b82f6; color: #fff; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    label { display: block; font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
    input[type="text"], textarea {
      width: 100%;
      background: #090e15;
      border: 1px solid #202e40;
      border-radius: 8px;
      padding: 9px 12px;
      color: var(--text);
      font-size: 12px;
      outline: none;
    }
    input[type="text"]:focus, textarea:focus { border-color: var(--border-focus); }

    /* Ultra-Clean noVNC Command Center */
    .novnc-command-bar {
      background: #090e16;
      border: 1px solid #1c2a3b;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .novnc-ribbon {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .ribbon-divider {
      width: 1px;
      height: 18px;
      background: #243448;
      margin: 0 4px;
    }

    .url-detonation-box {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .url-input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #090e16;
      border: 1px solid #202e40;
      border-radius: 8px;
      padding: 6px 12px;
      flex: 1;
    }
    .url-input-wrap input {
      background: transparent;
      border: none;
      color: #f1f5f9;
      font-size: 12px;
      width: 100%;
      outline: none;
    }

    .sandbox-frame-box {
      border: 1px solid #1e2c3e;
      border-radius: 12px;
      background: #000;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 750px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    .sandbox-topbar {
      background: #0c121b;
      border-bottom: 1px solid #1c2a3b;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .sandbox-iframe {
      width: 100%;
      flex: 1;
      border: none;
      background: #000;
    }
    .telemetry-bar {
      background: #080c13;
      border-top: 1px solid #192535;
      padding: 6px 12px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
    }

    .results-shell { margin-top: 28px; }
    .verdict-banner {
      border-radius: 14px;
      border: 1px solid #29405b;
      padding: 16px 20px;
      background: linear-gradient(120deg, rgba(30, 58, 138, 0.25), #0d131c);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .verdict-banner.high { border-color: #832727; background: linear-gradient(120deg, rgba(127, 29, 29, 0.3), #160e10); }
    .verdict-banner.medium { border-color: #855c1b; background: linear-gradient(120deg, rgba(120, 80, 20, 0.3), #16150e); }
    
    .score-badge strong { font-size: 32px; font-weight: 800; line-height: 1; display: block; }
    .score-badge span { font-size: 10px; color: var(--text-muted); }

    .nav-tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .nav-tab {
      background: #0f1622;
      color: #94a3b8;
      border: 1px solid #1e2c3d;
      border-radius: 8px;
      padding: 7px 12px;
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .nav-tab.active { background: #2563eb; color: #fff; border-color: #2563eb; }

    .result-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
    .card-title { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .card-title h3 { font-size: 13px; font-weight: 700; }
    .card-title small { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 800; }

    .key-val { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #16202d; font-size: 11px; }
    .key-val:last-child { border-bottom: none; }
    .key-val span { color: #64748b; }
    .key-val strong { color: #e2e8f0; text-align: right; max-width: 65%; word-break: break-all; }

    .ledger-row { display: flex; justify-content: space-between; padding: 6px 8px; background: #0a0f16; border-radius: 6px; margin-bottom: 4px; font-size: 11px; }
    .ledger-pts-pos { color: #10b981; font-weight: 700; font-family: monospace; }
    .ledger-pts-neg { color: #60a5fa; font-weight: 700; font-family: monospace; }

    .loader { width: 18px; height: 18px; border: 2px solid #334155; border-top-color: #60a5fa; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    @media (max-width: 900px) { .mode-tabs { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .mode-tabs, .form-grid, .result-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>

  <header class="topbar">
    <div class="brand">
      <div class="brand-mark">
        <i data-lucide="shield"></i>
      </div>
      <div>
        <strong>CYBER SQUAD</strong>
        <span>SentinelMail / 26106</span>
      </div>
    </div>
    <div class="status-badge">
      <span class="status-dot"></span>
      <span>VIRTUAL DESKTOP LIVE</span>
    </div>
  </header>

  <div class="container">
    <!-- 4 Intake Tabs -->
    <div class="mode-tabs">
      <button class="mode-tab active" id="tab-eml" onclick="setMode('eml')">
        <i data-lucide="mail"></i>
        <div>
          <strong>Email File</strong>
          <small>.eml / .msg triage</small>
        </div>
      </button>
      <button class="mode-tab" id="tab-text" onclick="setMode('text')">
        <i data-lucide="message-square-text"></i>
        <div>
          <strong>Text / Headers</strong>
          <small>Paste body & RFC headers</small>
        </div>
      </button>
      <button class="mode-tab" id="tab-attach" onclick="setMode('attach')">
        <i data-lucide="paperclip"></i>
        <div>
          <strong>Attachment</strong>
          <small>Entropy & boundary scan</small>
        </div>
      </button>
      <button class="mode-tab sandbox-tab" id="tab-sandbox-intake" onclick="setMode('sandbox')">
        <i data-lucide="monitor" style="color: #60a5fa;"></i>
        <div>
          <strong>noVNC Desktop</strong>
          <small>Interactive Linux PC</small>
        </div>
      </button>
    </div>

    <!-- Intake Container -->
    <section class="intake-shell">
      <!-- 1. EML Mode Dropzone -->
      <div id="mode-eml-view">
        <div class="dropzone" id="dropzone-eml" ondragover="handleDragOver(event, 'dropzone-eml')" ondragleave="handleDragLeave(event, 'dropzone-eml')" ondrop="handleDrop(event, 'eml')">
          <div class="dropzone-icon"><i data-lucide="file-up"></i></div>
          <h3>Drag & Drop .EML / .MSG Email File</h3>
          <p>Extracts transport headers, SPF/DKIM/DMARC snapshot, public IPs, and embedded URLs.</p>
          <input type="file" id="file-input-eml" accept=".eml,.msg" style="display: none;" onchange="handleFileSelected(this.files[0])">
          <button class="primary-btn" onclick="document.getElementById('file-input-eml').click()">
            <i data-lucide="upload" style="width: 14px; height: 14px;"></i> Select Email File
          </button>
        </div>
      </div>

      <!-- 2. Text / Headers Mode -->
      <div id="mode-text-view" style="display: none;">
        <div class="form-grid">
          <div><label>Sender</label><input type="text" id="text-sender" placeholder="accounts@security-alert.com"></div>
          <div><label>Recipient</label><input type="text" id="text-recipient" placeholder="analyst@enterprise.in"></div>
        </div>
        <div style="margin-bottom: 10px;"><label>Subject</label><input type="text" id="text-subject" placeholder="Security alert: Unusual sign-in attempt detected"></div>
        <div style="margin-bottom: 12px;">
          <label>Raw Headers & Message Body</label>
          <textarea id="text-body" rows="6" placeholder="Paste full RFC headers and message text here..."></textarea>
        </div>
        <button class="primary-btn" onclick="analyzePastedText()">
          <i data-lucide="play" style="width: 14px; height: 14px;"></i> Run Heuristic Analysis
        </button>
      </div>

      <!-- 3. Attachment Mode -->
      <div id="mode-attach-view" style="display: none;">
        <div class="dropzone" id="dropzone-attach" ondragover="handleDragOver(event, 'dropzone-attach')" ondragleave="handleDragLeave(event, 'dropzone-attach')" ondrop="handleDrop(event, 'attach')">
          <div class="dropzone-icon"><i data-lucide="file-search"></i></div>
          <h3>Drop Standalone Attachment for Static Inspection</h3>
          <p>Computes SHA-256, Shannon entropy, magic bytes mismatch, and concatenated format boundaries.</p>
          <input type="file" id="file-input-attach" style="display: none;" onchange="handleAttachmentSelected(this.files[0])">
          <button class="primary-btn" onclick="document.getElementById('file-input-attach').click()">
            <i data-lucide="paperclip" style="width: 14px; height: 14px;"></i> Choose Attachment
          </button>
        </div>
      </div>

      <!-- 4. STREAMLINED NO-VNC VIRTUAL LINUX DESKTOP -->
      <div id="mode-sandbox-view" style="display: none;">
        <!-- Unified Sleek Ribbon -->
        <div class="novnc-command-bar">
          <div class="novnc-ribbon">
            <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Apps:</span>
            <button class="ghost-btn" style="color: #f87171;" onclick="openQuickApp('https://mail.google.com')"><i data-lucide="mail" style="width: 12px;"></i> Gmail</button>
            <button class="ghost-btn" style="color: #60a5fa;" onclick="openQuickApp('https://www.google.com')"><i data-lucide="search" style="width: 12px;"></i> Google</button>
            <button class="ghost-btn" style="color: #38bdf8;" onclick="openQuickApp('https://outlook.live.com')"><i data-lucide="inbox" style="width: 12px;"></i> Outlook</button>
            
            <div class="ribbon-divider"></div>
            
            <button class="ghost-btn" style="color: #fbbf24;" onclick="launchNativeApp('files')"><i data-lucide="folder" style="width: 12px;"></i> Files</button>
            <button class="ghost-btn" style="color: #34d399;" onclick="launchNativeApp('terminal')"><i data-lucide="terminal" style="width: 12px;"></i> Terminal</button>
            <button class="ghost-btn" style="color: #a78bfa;" onclick="launchNativeApp('editor')"><i data-lucide="code" style="width: 12px;"></i> Editor</button>
            <button class="ghost-btn" style="color: #93c5fd;" onclick="launchNativeApp('pdf')"><i data-lucide="file-text" style="width: 12px;"></i> PDF</button>

            <div class="ribbon-divider"></div>

            <button class="ghost-btn" style="color: #2dd4bf;" onclick="openQuickApp('https://www.virustotal.com')"><i data-lucide="shield-check" style="width: 12px;"></i> VirusTotal</button>
          </div>

          <div class="novnc-ribbon">
            <button class="ghost-btn" onclick="sendClipboardPrompt()"><i data-lucide="clipboard-copy" style="width: 12px;"></i> Paste to PC</button>
            <button class="ghost-btn" onclick="restartDesktopSession()"><i data-lucide="rotate-ccw" style="width: 12px;"></i> Reset</button>
            <button class="ghost-btn" onclick="toggleFullscreen('direct-sandbox-box')"><i data-lucide="maximize" style="width: 12px;"></i> Fullscreen</button>
          </div>
        </div>

        <!-- URL Detonation Search Bar -->
        <div class="url-detonation-box">
          <div class="url-input-wrap">
            <i data-lucide="link" style="width: 14px; color: #64748b;"></i>
            <input type="text" id="direct-sandbox-url" value="https://duckduckgo.com" placeholder="Enter any link to open in Linux Virtual PC (e.g. https://phishing-portal.xyz)..." onkeydown="if(event.key==='Enter') launchDirectSandbox()">
          </div>
          <button class="primary-btn" onclick="launchDirectSandbox()">
            <i data-lucide="play" style="width: 13px; height: 13px;"></i> Detonate
          </button>
        </div>

        <!-- Real Linux noVNC Desktop Viewport Frame -->
        <div class="sandbox-frame-box" id="direct-sandbox-box">
          <iframe id="direct-sandbox-iframe" class="sandbox-iframe" src="https://leather-globe-ben-corn.trycloudflare.com/vnc.html?autoconnect=true&password=cybersqu&resize=remote&quality=8&compression=0&reconnect=true" allow="clipboard-read; clipboard-write; fullscreen;"></iframe>
          <div class="telemetry-bar">
            <span>🟢 Single-Port Unified (Port 8000) · Display :99 (XFCE + Chromium + Kali Tools)</span>
            <span class="mono">Air-Gapped Isolation · Zero Host Malware Risk</span>
          </div>
        </div>
      </div>

      <div id="loading-spinner" style="display: none; align-items: center; justify-content: center; gap: 10px; padding: 14px; color: #93c5fd; font-size: 12px;">
        <div class="loader"></div>
        <span>Analyzing submitted evidence and extracting threat telemetry...</span>
      </div>
    </section>

    <!-- Results Section -->
    <section id="results-area" class="results-shell" style="display: none;">
      <div id="verdict-banner" class="verdict-banner">
        <div>
          <h2 id="verdict-status" style="font-size: 18px; font-weight: 800;">HIGH RISK</h2>
          <p id="verdict-note" style="color: var(--text-muted); font-size: 11px;">Calculated heuristic triage score from observed signals.</p>
        </div>
        <div class="score-badge">
          <strong id="verdict-score">78</strong>
          <span>score / 100</span>
        </div>
      </div>

      <div class="nav-tabs">
        <button class="nav-tab active" id="btn-tab-overview" onclick="switchResultTab('overview', this)"><i data-lucide="layout-dashboard" style="width: 12px;"></i> Overview</button>
        <button class="nav-tab" id="btn-tab-files" onclick="switchResultTab('files', this)"><i data-lucide="paperclip" style="width: 12px;"></i> Files & Attachments</button>
        <button class="nav-tab" id="btn-tab-headers" onclick="switchResultTab('headers', this)"><i data-lucide="file-code" style="width: 12px;"></i> Headers</button>
        <button class="nav-tab" id="btn-tab-auth" onclick="switchResultTab('auth', this)"><i data-lucide="shield" style="width: 12px;"></i> Auth Checks</button>
        <button class="nav-tab" id="btn-tab-urls" onclick="switchResultTab('urls', this)"><i data-lucide="link" style="width: 12px;"></i> URLs</button>
        <button class="nav-tab" id="btn-tab-sandbox" onclick="switchResultTab('sandbox', this)"><i data-lucide="monitor" style="width: 12px;"></i> 🛡️ Desktop Sandbox</button>
      </div>

      <!-- Tab Content: Overview -->
      <div id="tab-overview" class="result-grid">
        <div class="card">
          <div class="card-title">
            <i data-lucide="tag" style="width: 16px; color: #60a5fa;"></i>
            <div><small>CATEGORY</small><h3 id="cat-label">Phishing / BEC</h3></div>
          </div>
          <p id="cat-desc" style="color: var(--text-muted); font-size: 11px; margin-bottom: 10px;"></p>
          <div class="key-val"><span>Alert Level</span><strong id="cat-alert" style="color: var(--danger);">HIGH</strong></div>
          <div class="key-val"><span>Spam Assessment</span><strong id="cat-spam">Suspicious</strong></div>
          <div class="key-val"><span>Recommendation</span><strong id="cat-action">Verify sender out-of-band.</strong></div>
        </div>

        <div class="card">
          <div class="card-title">
            <i data-lucide="hash" style="width: 16px; color: #34d399;"></i>
            <div><small>SCORE LEDGER</small><h3>Observed Signals</h3></div>
          </div>
          <div id="ledger-items" style="max-height: 160px; overflow-y: auto; margin-bottom: 8px;"></div>
          <div class="key-val" style="border-top: 1px solid var(--border); padding-top: 8px;">
            <span>Formula</span>
            <code id="ledger-formula" class="mono" style="font-size: 10px; color: #93c5fd;"></code>
          </div>
        </div>
      </div>

      <!-- Tab Content: Files & Attachments -->
      <div id="tab-files" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="paperclip" style="width: 16px;"></i><div><small>STATIC FILE CARVER</small><h3>Attachment Telemetry</h3></div></div>
        <div id="files-list"></div>
      </div>

      <!-- Tab Content: Headers -->
      <div id="tab-headers" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="file-code" style="width: 16px;"></i><div><small>TRANSPORT HEADERS</small><h3>RFC Headers</h3></div></div>
        <div id="headers-list" style="max-height: 400px; overflow-y: auto;"></div>
      </div>

      <!-- Tab Content: Auth Checks -->
      <div id="tab-auth" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="shield" style="width: 16px;"></i><div><small>AUTHENTICATION</small><h3>Reported DNS Snapshot</h3></div></div>
        <div class="key-val"><span>SPF</span><strong id="auth-spf"></strong></div>
        <div class="key-val"><span>DKIM</span><strong id="auth-dkim"></strong></div>
        <div class="key-val"><span>DMARC</span><strong id="auth-dmarc"></strong></div>
        <div class="key-val"><span>ARC</span><strong id="auth-arc"></strong></div>
      </div>

      <!-- Tab Content: URLs -->
      <div id="tab-urls" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="link" style="width: 16px;"></i><div><small>URL EXTRACTION</small><h3>Extracted Links</h3></div></div>
        <div id="urls-list"></div>
      </div>

      <!-- Tab Content: Desktop Sandbox inside Results -->
      <div id="tab-sandbox" style="display: none;">
        <div class="sandbox-frame-box" id="result-sandbox-box" style="height: 600px;">
          <iframe id="sandbox-iframe" class="sandbox-iframe" src="https://leather-globe-ben-corn.trycloudflare.com/vnc.html?autoconnect=true&password=cybersqu&resize=remote&quality=8&compression=0&reconnect=true" allow="clipboard-read; clipboard-write; fullscreen;"></iframe>
        </div>
      </div>
    </section>
  </div>

  <script>
    lucide.createIcons();
    let currentAnalysis = null;

    function setMode(mode) {
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      const activeTabId = mode === 'sandbox' ? 'tab-sandbox-intake' : ('tab-' + mode);
      document.getElementById(activeTabId)?.classList.add('active');
      
      document.getElementById('mode-eml-view').style.display = mode === 'eml' ? 'block' : 'none';
      document.getElementById('mode-text-view').style.display = mode === 'text' ? 'block' : 'none';
      document.getElementById('mode-attach-view').style.display = mode === 'attach' ? 'block' : 'none';
      document.getElementById('mode-sandbox-view').style.display = mode === 'sandbox' ? 'block' : 'none';
    }

    function openQuickApp(url) {
      document.getElementById('direct-sandbox-url').value = url;
      launchDirectSandbox();
    }

    async function launchNativeApp(appName) {
      try {
        await fetch('/api/v1/sandbox/app/' + appName, { method: 'POST' });
      } catch (err) {
        console.error('App launch error:', err);
      }
    }

    async function sendClipboardPrompt() {
      const text = prompt("Enter or paste text/URL to copy into Linux PC clipboard:");
      if (!text) return;
      try {
        await fetch('/api/v1/sandbox/clipboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text })
        });
        alert('Copied to virtual PC! You can now press Ctrl+V in the desktop.');
      } catch (e) {
        alert('Clipboard error: ' + e.message);
      }
    }

    async function restartDesktopSession() {
      try {
        await fetch('/api/v1/sandbox/restart', { method: 'POST' });
        reloadDirectSandbox();
      } catch(e) {
        console.error(e);
      }
    }

    async function launchDirectSandbox() {
      const url = document.getElementById('direct-sandbox-url').value.trim();
      if (!url) return;
      try {
        await fetch('/api/v1/sandbox/navigate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url })
        });
      } catch (err) {
        console.error('Navigation error:', err);
      }
    }

    function reloadDirectSandbox() {
      const iframe = document.getElementById('direct-sandbox-iframe');
      iframe.src = iframe.src;
    }

    function toggleFullscreen(boxId) {
      const el = document.getElementById(boxId);
      if (!document.fullscreenElement) {
        el.requestFullscreen().catch(console.error);
      } else {
        document.exitFullscreen().catch(console.error);
      }
    }

    function handleDragOver(e, id) { e.preventDefault(); document.getElementById(id).classList.add('dragover'); }
    function handleDragLeave(e, id) { document.getElementById(id).classList.remove('dragover'); }
    function handleDrop(e, mode) {
      e.preventDefault();
      const dropId = mode === 'attach' ? 'dropzone-attach' : 'dropzone-eml';
      document.getElementById(dropId).classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        if (mode === 'attach') handleAttachmentSelected(e.dataTransfer.files[0]);
        else handleFileSelected(e.dataTransfer.files[0]);
      }
    }

    function showLoading(show) { document.getElementById('loading-spinner').style.display = show ? 'flex' : 'none'; }

    async function handleFileSelected(file) {
      if (!file) return;
      showLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/v1/upload', { method: 'POST', body: formData });
        const data = await res.json();
        renderAnalysisResult(data);
      } catch (err) {
        alert('Upload error: ' + err.message);
      } finally {
        showLoading(false);
      }
    }

    async function handleAttachmentSelected(file) {
      if (!file) return;
      showLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/v1/attachment', { method: 'POST', body: formData });
        const data = await res.json();
        renderAnalysisResult(data);
      } catch (err) {
        alert('Attachment error: ' + err.message);
      } finally {
        showLoading(false);
      }
    }

    async function analyzePastedText() {
      const sender = document.getElementById('text-sender').value;
      const recipient = document.getElementById('text-recipient').value;
      const subject = document.getElementById('text-subject').value;
      const body = document.getElementById('text-body').value;
      if (!body.trim() && !subject.trim()) { alert('Please paste message body or headers'); return; }

      showLoading(true);
      try {
        const res = await fetch('/api/v1/analyze-raw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender, recipient, subject, body, headers: {} })
        });
        const data = await res.json();
        renderAnalysisResult(data);
      } catch (err) {
        alert('Analysis error: ' + err.message);
      } finally {
        showLoading(false);
      }
    }

    function renderAnalysisResult(data) {
      currentAnalysis = data;
      document.getElementById('results-area').style.display = 'block';
      const threat = data.threat || {};
      const score = threat.risk_score || 0;
      
      const banner = document.getElementById('verdict-banner');
      banner.className = 'verdict-banner ' + (score >= 70 ? 'high' : score >= 35 ? 'medium' : '');
      document.getElementById('verdict-status').innerText = threat.status || 'ANALYSIS COMPLETE';
      document.getElementById('verdict-score').innerText = score;

      const cat = data.category_analysis || {};
      document.getElementById('cat-label').innerText = cat.category_label || 'Unknown';
      document.getElementById('cat-desc').innerText = cat.description || '';
      document.getElementById('cat-alert').innerText = (cat.alert_level || 'low').toUpperCase();
      document.getElementById('cat-spam').innerText = cat.spam_assessment || 'Clean';
      document.getElementById('cat-action').innerText = cat.recommended_action || 'No action needed';

      const breakdown = threat.score_breakdown || {};
      const ledgerBox = document.getElementById('ledger-items');
      ledgerBox.innerHTML = '';
      (breakdown.positive_contributors || []).forEach(item => {
        ledgerBox.innerHTML += '<div class="ledger-row"><span>' + item.label + '</span><span class="ledger-pts-pos">+' + item.points + '</span></div>';
      });
      (breakdown.deductions || []).forEach(item => {
        ledgerBox.innerHTML += '<div class="ledger-row"><span>' + item.label + '</span><span class="ledger-pts-neg">' + item.points + '</span></div>';
      });
      document.getElementById('ledger-formula').innerText = breakdown.formula || (score + ' points');

      const auth = data.dns_auth || {};
      document.getElementById('auth-spf').innerText = auth.spf || 'NOT PRESENT';
      document.getElementById('auth-dkim').innerText = auth.dkim || 'NOT PRESENT';
      document.getElementById('auth-dmarc').innerText = auth.dmarc || 'NOT PRESENT';
      document.getElementById('auth-arc').innerText = auth.arc || 'NOT PRESENT';

      // Files list
      const filesList = document.getElementById('files-list');
      filesList.innerHTML = '';
      const attachments = data.attachment_analysis || [];
      if (!attachments.length) {
        filesList.innerHTML = '<p style="color: #64748b; font-size: 11px;">No attachments found.</p>';
      } else {
        attachments.forEach(att => {
          filesList.innerHTML += `
            <div style="background: #090e16; border: 1px solid #1c2a3b; border-radius: 8px; padding: 10px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: #93c5fd; font-size: 12px;">${att.filename}</strong>
                <span style="font-size: 10px; color: ${att.risk_score >= 50 ? 'var(--danger)' : 'var(--success)'}; font-weight: 700;">${att.risk_score || 0}/100</span>
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Entropy: ${att.entropy || 0} · SHA256: ${(att.sha256 || '').slice(0, 16)}...</div>
            </div>
          `;
        });
      }

      // Headers list
      const headersList = document.getElementById('headers-list');
      headersList.innerHTML = '';
      const rawHeaders = data.parsed?.headers || {};
      Object.keys(rawHeaders).forEach(k => {
        headersList.innerHTML += '<div class="key-val"><span style="text-transform: capitalize;">' + k + '</span><strong class="mono" style="font-size: 10px;">' + rawHeaders[k] + '</strong></div>';
      });

      // URLs list
      const urlsList = document.getElementById('urls-list');
      urlsList.innerHTML = '';
      (data.aitm_analysis || []).forEach(u => {
        urlsList.innerHTML += `
          <div style="display: flex; justify-content: space-between; align-items: center; background: #090e16; border: 1px solid #1c2a3b; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px;">
            <code class="mono" style="color: #93c5fd; font-size: 11px;">${u.url}</code>
            <button class="ghost-btn" onclick="openUrlInDesktopSandbox('${u.url}')">
              <i data-lucide="monitor" style="width: 11px;"></i> Detonate
            </button>
          </div>`;
      });

      lucide.createIcons();
      switchResultTab(data.mode === 'attachment' ? 'files' : 'overview', document.getElementById(data.mode === 'attachment' ? 'btn-tab-files' : 'btn-tab-overview'));
      window.scrollTo({ top: document.getElementById('results-area').offsetTop - 60, behavior: 'smooth' });
    }

    function switchResultTab(tabId, btn) {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      ['overview', 'files', 'headers', 'auth', 'urls', 'sandbox'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.style.display = t === tabId ? (t === 'overview' ? 'grid' : 'block') : 'none';
      });
      if (btn) btn.classList.add('active');
    }

    function openUrlInDesktopSandbox(url) {
      setMode('sandbox');
      document.getElementById('direct-sandbox-url').value = url;
      launchDirectSandbox();
    }
  </script>
</body>
</html>
"""
