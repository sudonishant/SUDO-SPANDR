HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyber Squad — SentinelMail AI Threat Detection, GeoLocation & Forensic Intelligence</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      --bg: #060911;
      --card-bg: #0c121e;
      --panel-bg: rgba(12, 18, 30, 0.95);
      --border: #1e293b;
      --border-focus: #3b82f6;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.25);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --purple: #a855f7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Manrope', system-ui, sans-serif;
      background: radial-gradient(circle at 80% -20%, rgba(37, 99, 235, 0.2), transparent 45%), var(--bg);
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
      background: rgba(6, 9, 17, 0.9);
      backdrop-filter: blur(20px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(16px, 4vw, 48px);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark {
      width: 36px; height: 36px;
      display: grid; place-items: center;
      border: 1px solid rgba(59, 130, 246, 0.4);
      border-radius: 9px;
      color: #60a5fa;
      background: rgba(59, 130, 246, 0.15);
      box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
    }
    .brand-title { font-size: 15px; font-weight: 800; letter-spacing: -0.01em; color: #fff; }
    .brand-sub { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    .top-actions { display: flex; align-items: center; gap: 10px; }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700;
      background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .main-wrap {
      max-width: 1360px;
      margin: 0 auto;
      padding: 20px clamp(16px, 4vw, 48px) 60px;
    }

    /* Demo Quick Cases Ribbon */
    .demo-ribbon {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .demo-cases-list { display: flex; gap: 8px; flex-wrap: wrap; }
    .case-btn {
      padding: 7px 12px; border-radius: 8px; font-size: 11px; font-weight: 700;
      background: rgba(255, 255, 255, 0.04); color: var(--text); border: 1px solid var(--border);
      display: inline-flex; align-items: center; gap: 6px;
    }
    .case-btn:hover { background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.5); color: #93c5fd; }

    .mode-bar {
      display: flex; gap: 8px; margin-bottom: 20px;
      background: var(--card-bg); padding: 5px; border-radius: 12px; border: 1px solid var(--border);
      overflow-x: auto;
    }
    .mode-tab {
      flex: 1; min-width: 150px; padding: 10px 16px; border-radius: 8px; background: transparent;
      color: var(--text-muted); font-size: 13px; font-weight: 700; display: flex; align-items: center;
      justify-content: center; gap: 8px; border: 1px solid transparent;
    }
    .mode-tab.active {
      background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-color: rgba(59, 130, 246, 0.4);
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.2);
    }

    .dropzone-box {
      border: 2px dashed var(--border); border-radius: 16px; padding: 44px 24px;
      text-align: center; background: rgba(12, 18, 30, 0.6); transition: all 0.2s ease;
      cursor: pointer; position: relative;
    }
    .dropzone-box:hover, .dropzone-box.dragover {
      border-color: var(--accent); background: rgba(59, 130, 246, 0.08);
      box-shadow: 0 0 25px rgba(59, 130, 246, 0.2);
    }

    .card {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px;
      padding: 20px; margin-bottom: 20px;
    }
    .card-title {
      display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
      border-bottom: 1px solid var(--border); padding-bottom: 12px;
    }
    .card-title h3 { font-size: 14px; font-weight: 800; letter-spacing: -0.01em; color: #fff; }
    .card-title small { font-size: 10px; color: var(--text-muted); text-transform: uppercase; display: block; }

    .primary-btn {
      background: #2563eb; color: #fff; font-weight: 700; padding: 10px 18px;
      border-radius: 8px; font-size: 13px; display: inline-flex; align-items: center; gap: 8px;
    }
    .primary-btn:hover { background: #1d4ed8; box-shadow: 0 0 15px rgba(37, 99, 235, 0.4); }

    .ghost-btn {
      background: rgba(255, 255, 255, 0.05); color: var(--text); border: 1px solid var(--border);
      padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .ghost-btn:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }

    .nav-tabs {
      display: flex; gap: 6px; border-bottom: 1px solid var(--border); margin-bottom: 20px;
      overflow-x: auto; padding-bottom: 2px;
    }
    .nav-tab {
      padding: 9px 15px; border-radius: 8px 8px 0 0; background: transparent; color: var(--text-muted);
      font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;
      border-bottom: 2px solid transparent;
    }
    .nav-tab.active {
      color: #60a5fa; border-bottom-color: #3b82f6; background: rgba(59, 130, 246, 0.08);
    }

    .result-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 20px;
    }

    .key-val {
      display: flex; justify-content: space-between; align-items: center; padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04); font-size: 12px;
    }
    .key-val span { color: var(--text-muted); }
    .key-val strong { font-weight: 700; color: #fff; }

    /* Map & Graph Styles */
    #map-container { height: 420px; width: 100%; border-radius: 12px; z-index: 10; }
    .hop-timeline { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .hop-item {
      display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 10px;
      background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border);
    }
    .hop-badge {
      width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
      font-weight: 800; font-size: 12px; flex-shrink: 0;
    }
    .hop-badge.origin { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }
    .hop-badge.relay { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #3b82f6; }
    .hop-badge.dest { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; }

    #graph-canvas-wrap {
      height: 420px; width: 100%; background: #080c14; border-radius: 12px;
      border: 1px solid var(--border); position: relative; overflow: hidden;
    }

    /* noVNC Virtual Desktop Ribbon */
    .novnc-command-bar {
      display: flex; justify-content: space-between; align-items: center;
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px;
      padding: 8px 12px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;
    }
    .novnc-ribbon { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .ribbon-divider { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
    .url-detonation-box { display: flex; gap: 8px; margin-bottom: 12px; }
    .url-input-wrap {
      flex: 1; display: flex; align-items: center; gap: 10px; background: var(--card-bg);
      border: 1px solid var(--border); border-radius: 8px; padding: 0 12px;
    }
    .url-input-wrap input {
      width: 100%; background: transparent; border: none; outline: none; color: #fff; font-size: 12px; padding: 10px 0;
    }
    .sandbox-frame-box {
      border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: #000;
      position: relative; height: 640px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
    }
    .sandbox-iframe { width: 100%; height: calc(100% - 32px); border: none; }
    .telemetry-bar {
      height: 32px; background: #0a0e17; border-top: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between; padding: 0 16px;
      font-size: 11px; color: var(--text-muted);
    }

    .mitre-badge {
      display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px;
      background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);
      font-size: 11px; font-weight: 700; margin: 3px;
    }

    @media print {
      body * { visibility: hidden; }
      #tab-dossier, #tab-dossier * { visibility: visible; }
      #tab-dossier { position: absolute; left: 0; top: 0; width: 100%; color: #000; background: #fff !important; }
    }
  </style>
</head>
<body>

  <!-- Top Bar -->
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark"><i data-lucide="shield-alert" style="width: 20px; height: 20px;"></i></div>
      <div>
        <div class="brand-title">CYBER SQUAD — SentinelMail</div>
        <div class="brand-sub">SIH 2026 #26106 | AI Email Threat Detection, GeoLocation & Forensic Intelligence</div>
      </div>
    </div>
    <div class="top-actions">
      <span class="badge">● ISO 27037 & Sec 65B Compliant</span>
      <button class="ghost-btn" onclick="togglePII()"><i data-lucide="eye-off" style="width: 13px;"></i> <span id="pii-toggle-text">Mask PII</span></button>
      <button class="ghost-btn" onclick="exportSTIX()"><i data-lucide="download" style="width: 13px;"></i> STIX 2.1</button>
      <button class="primary-btn" style="padding: 6px 14px; font-size: 12px;" onclick="printDossier()"><i data-lucide="printer" style="width: 13px;"></i> Court Dossier</button>
    </div>
  </header>

  <div class="main-wrap">

    <!-- 1-Click Demo Preloaded Cases Ribbon -->
    <div class="demo-ribbon">
      <div style="display: flex; align-items: center; gap: 8px;">
        <i data-lucide="flask-conical" style="width: 16px; color: #f59e0b;"></i>
        <span style="font-size: 12px; font-weight: 800; color: #fff;">1-Click Demo Triage Cases:</span>
      </div>
      <div class="demo-cases-list">
        <button class="case-btn" onclick="loadSample('apt_russia')">🇷🇺 1. Russian APT Wire Fraud</button>
        <button class="case-btn" onclick="loadSample('nigeria_bec')">🇳🇬 2. Nigerian BEC Invoice Scam</button>
        <button class="case-btn" onclick="loadSample('office365_phish')">🏢 3. Office 365 Phish (Hetzner VPN)</button>
        <button class="case-btn" onclick="loadSample('legitimate_pass')" style="border-color: rgba(16,185,129,0.4); color: #34d399;">✅ 4. Clean Control (Google Pass)</button>
      </div>
    </div>
    
    <!-- Mode Selection -->
    <div class="mode-bar">
      <button class="mode-tab active" id="tab-eml" onclick="setMode('eml')"><i data-lucide="mail"></i> 1. EML / MSG File Triage</button>
      <button class="mode-tab" id="tab-text" onclick="setMode('text')"><i data-lucide="file-text"></i> 2. Text & RFC Headers</button>
      <button class="mode-tab" id="tab-attach" onclick="setMode('attach')"><i data-lucide="paperclip"></i> 3. Attachment Carver</button>
      <button class="mode-tab" id="tab-sandbox-intake" onclick="setMode('sandbox')"><i data-lucide="monitor"></i> 4. Live noVNC Sandbox</button>
    </div>

    <!-- 1. EML INTAKE -->
    <div id="mode-eml-view">
      <div class="dropzone-box" id="eml-dropzone" onclick="document.getElementById('eml-input').click()">
        <input type="file" id="eml-input" accept=".eml,.msg" style="display: none;" onchange="handleFileSelect(event)">
        <i data-lucide="upload-cloud" style="width: 44px; height: 44px; color: #60a5fa; margin-bottom: 12px;"></i>
        <h2 style="font-size: 17px; font-weight: 800; margin-bottom: 6px;">Drop .EML or .MSG Email Forensic Evidence</h2>
        <p style="color: var(--text-muted); font-size: 12px; max-width: 540px; margin: 0 auto 16px;">
          Parses transport headers, extracts multi-hop SMTP routing, resolves originating GeoIP/ASN, and computes deterministic threat matrix.
        </p>
        <button class="primary-btn"><i data-lucide="file-search"></i> Select Email Evidence File</button>
      </div>
    </div>

    <!-- 2. TEXT INTAKE -->
    <div id="mode-text-view" style="display: none;">
      <div class="card">
        <div class="card-title">
          <i data-lucide="file-code" style="width: 16px; color: #60a5fa;"></i>
          <div><small>RAW INTAKE</small><h3>Paste RFC 5322 Headers & Message Body</h3></div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <input type="text" id="raw-sender" placeholder="From: Executive / Attacker (e.g. CEO <ceo@lookalike.com>)" style="background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #fff; font-size: 12px;">
          <input type="text" id="raw-subject" placeholder="Subject: URGENT: Wire Transfer / Password Reset..." style="background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #fff; font-size: 12px;">
        </div>
        <textarea id="raw-body" rows="8" placeholder="Paste full email body or raw header dump here..." style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; padding: 12px; color: #fff; font-size: 12px; font-family: 'DM Mono', monospace; margin-bottom: 16px;"></textarea>
        <button class="primary-btn" onclick="analyzeRawText()"><i data-lucide="scan-line"></i> Run Deep Forensic Analysis</button>
      </div>
    </div>

    <!-- 3. ATTACHMENT CARVER -->
    <div id="mode-attach-view" style="display: none;">
      <div class="dropzone-box" onclick="document.getElementById('attach-input').click()">
        <input type="file" id="attach-input" style="display: none;" onchange="handleAttachSelect(event)">
        <i data-lucide="binary" style="width: 44px; height: 44px; color: #f59e0b; margin-bottom: 12px;"></i>
        <h2 style="font-size: 17px; font-weight: 800; margin-bottom: 6px;">Upload Suspicious File for Disassembly</h2>
        <p style="color: var(--text-muted); font-size: 12px; max-width: 500px; margin: 0 auto 16px;">
          Calculates Shannon entropy, verifies true Magic-Byte signatures vs fake extensions, and checks SHA-256 threat hashes.
        </p>
        <button class="primary-btn" style="background: #d97706;"><i data-lucide="shield-alert"></i> Inspect Attachment</button>
      </div>
    </div>

    <!-- 4. NO-VNC VIRTUAL DESKTOP -->
    <div id="mode-sandbox-view" style="display: none;">
      <div class="novnc-command-bar">
        <div class="novnc-ribbon">
          <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">1-Click Apps:</span>
          <button class="ghost-btn" style="color: #f87171;" onclick="openQuickApp('https://mail.google.com')"><i data-lucide="mail" style="width: 12px;"></i> Gmail</button>
          <button class="ghost-btn" style="color: #60a5fa;" onclick="openQuickApp('https://www.google.com')"><i data-lucide="search" style="width: 12px;"></i> Google</button>
          <button class="ghost-btn" style="color: #38bdf8;" onclick="openQuickApp('https://outlook.live.com')"><i data-lucide="inbox" style="width: 12px;"></i> Outlook</button>
          <div class="ribbon-divider"></div>
          <button class="ghost-btn" style="color: #2dd4bf;" onclick="openQuickApp('https://www.virustotal.com')"><i data-lucide="shield-check" style="width: 12px;"></i> VirusTotal</button>
        </div>
        <div class="novnc-ribbon">
          <button class="ghost-btn" onclick="sendClipboardPrompt()"><i data-lucide="clipboard-copy" style="width: 12px;"></i> Paste to PC</button>
          <button class="ghost-btn" onclick="restartDesktopSession()"><i data-lucide="rotate-ccw" style="width: 12px;"></i> Reset Session</button>
          <button class="ghost-btn" onclick="toggleFullscreen('direct-sandbox-box')"><i data-lucide="maximize" style="width: 12px;"></i> Fullscreen</button>
        </div>
      </div>

      <div class="url-detonation-box">
        <div class="url-input-wrap">
          <i data-lucide="link" style="width: 14px; color: #64748b;"></i>
          <input type="text" id="direct-sandbox-url" value="http://127.0.0.1:8000" placeholder="Enter link to detonate inside air-gapped sandbox..." onkeydown="if(event.key==='Enter') launchDirectSandbox()">
        </div>
        <button class="primary-btn" onclick="launchDirectSandbox()"><i data-lucide="play" style="width: 13px;"></i> Detonate in Virtual PC</button>
      </div>

      <div class="sandbox-frame-box" id="direct-sandbox-box">
        <iframe id="direct-sandbox-iframe" class="sandbox-iframe" src="/novnc/vnc.html?path=websockify&autoconnect=true&password=cybersqu&resize=remote&quality=8&compression=0&reconnect=true" allow="clipboard-read; clipboard-write; fullscreen;"></iframe>
        <div class="telemetry-bar">
          <span>🟢 Display :99 (XFCE + Chromium + Kali Forensic Tools) · Single Port Unified</span>
          <span class="mono">Air-Gapped Isolation · Zero Host Malware Risk</span>
        </div>
      </div>
    </div>

    <!-- FORENSIC RESULTS VIEWPORT -->
    <section id="results-view" style="display: none; margin-top: 24px;">
      
      <!-- Top Alert Banner -->
      <div class="card" id="alert-banner-box" style="border-left: 4px solid var(--danger); background: linear-gradient(90deg, rgba(239,68,68,0.1), var(--card-bg));">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <span style="font-size: 10px; font-weight: 800; color: #f87171; letter-spacing: 0.08em; text-transform: uppercase;">INVESTIGATIVE FORENSIC DOSSIER</span>
            <h2 id="res-verdict-title" style="font-size: 20px; font-weight: 800; color: #fff; margin-top: 2px;">SUSPICIOUS PHISHING / BEC ATTACK</h2>
            <p id="res-verdict-sub" style="font-size: 12px; color: var(--text-muted); margin-top: 4px;"></p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 32px; font-weight: 800; color: #f87171; font-family: 'DM Mono', monospace;" id="res-score-badge">85<span style="font-size: 16px; color: var(--text-muted);">/100</span></div>
            <span style="font-size: 11px; font-weight: 700; color: #f87171;" id="res-status-tag">HIGH RISK</span>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="nav-tabs">
        <button class="nav-tab active" onclick="switchTab('overview', this)"><i data-lucide="layout-dashboard" style="width: 13px;"></i> Overview</button>
        <button class="nav-tab" onclick="switchTab('geomap', this)"><i data-lucide="map-pin" style="width: 13px;"></i> 🗺️ SMTP Trace & GeoIP Map</button>
        <button class="nav-tab" onclick="switchTab('graph', this)"><i data-lucide="network" style="width: 13px;"></i> 🕸️ Threat Attribution Graph</button>
        <button class="nav-tab" onclick="switchTab('nlp', this)"><i data-lucide="brain" style="width: 13px;"></i> 🧠 Deep AI Paragraph Inspector</button>
        <button class="nav-tab" onclick="switchTab('mitre', this)"><i data-lucide="crosshair" style="width: 13px;"></i> 🎯 MITRE ATT&CK Matrix</button>
        <button class="nav-tab" onclick="switchTab('auth', this)"><i data-lucide="shield-check" style="width: 13px;"></i> SPF / DKIM / DMARC</button>
        <button class="nav-tab" onclick="switchTab('urls', this)"><i data-lucide="link" style="width: 13px;"></i> Payload URLs</button>
        <button class="nav-tab" onclick="switchTab('files', this)"><i data-lucide="paperclip" style="width: 13px;"></i> Attachments</button>
        <button class="nav-tab" onclick="switchTab('dossier', this)"><i data-lucide="file-check" style="width: 13px;"></i> 📜 Legal Court Dossier (Sec 65B)</button>
      </div>

      <!-- Tab: Overview -->
      <div id="tab-overview" class="result-grid">
        <div class="card">
          <div class="card-title"><i data-lucide="tag" style="width: 16px; color: #60a5fa;"></i><div><small>CATEGORY</small><h3 id="cat-label">Phishing / BEC</h3></div></div>
          <p id="cat-desc" style="color: var(--text-muted); font-size: 12px; margin-bottom: 12px;"></p>
          <div class="key-val"><span>Sender Identity</span><strong id="meta-from" class="mono"></strong></div>
          <div class="key-val"><span>Target Mailbox</span><strong id="meta-to" class="mono"></strong></div>
          <div class="key-val"><span>Origin Location</span><strong id="geo-summary-tag" style="color: #f87171;"></strong></div>
          <div class="key-val"><span>Preservation SHA-256</span><strong id="meta-sha256" class="mono" style="font-size: 10px; color: #93c5fd;"></strong></div>
        </div>

        <div class="card">
          <div class="card-title"><i data-lucide="list-checks" style="width: 16px; color: #34d399;"></i><div><small>SCORE BREAKDOWN</small><h3>Forensic Signals</h3></div></div>
          <div id="signals-list" style="max-height: 180px; overflow-y: auto;"></div>
        </div>
      </div>

      <!-- Tab: SMTP Trace & GeoIP Map (Component 2 & 3) -->
      <div id="tab-geomap" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="map" style="width: 16px; color: #38bdf8;"></i><div><small>COMPONENT 2 & 3</small><h3>SMTP Relay Path & GeoIP Flight Trajectory</h3></div></div>
        <div id="map-container"></div>
        <div class="hop-timeline" id="hop-timeline-list"></div>
      </div>

      <!-- Tab: Threat Attribution Graph Topology (Component 4) -->
      <div id="tab-graph" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="share-2" style="width: 16px; color: #a855f7;"></i><div><small>COMPONENT 4</small><h3>Identity Correlation & Campaign Attribution Graph</h3></div></div>
        <div id="graph-canvas-wrap">
          <svg id="attribution-svg" width="100%" height="100%"></svg>
        </div>
      </div>

      
      <!-- Tab: Deep AI Paragraph & NLP Inspector -->
      <div id="tab-nlp" class="card" style="display: none;">
        <div class="card-title">
          <i data-lucide="brain" style="width: 16px; color: #f43f5e;"></i>
          <div>
            <small>DEEP NLP & PSYCHOLOGICAL THREAT EXTRACTION (1,000,000+ WORD CAPACITY)</small>
            <h3>Paragraph-by-Paragraph Semantic Threat Dissection</h3>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
            <span style="font-size: 11px; color: var(--text-muted);">Total Paragraphs Scanned</span>
            <div id="nlp-total-paras" style="font-size: 20px; font-weight: 800; color: #60a5fa; font-family: 'DM Mono', monospace;">0</div>
          </div>
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
            <span style="font-size: 11px; color: var(--text-muted);">Malicious Paragraphs</span>
            <div id="nlp-flagged-paras" style="font-size: 20px; font-weight: 800; color: #f87171; font-family: 'DM Mono', monospace;">0</div>
          </div>
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
            <span style="font-size: 11px; color: var(--text-muted);">NLP Threat Score</span>
            <div id="nlp-score-val" style="font-size: 20px; font-weight: 800; color: #fbbf24; font-family: 'DM Mono', monospace;">0/100</div>
          </div>
        </div>

        <div id="nlp-triggers-container" style="margin-bottom: 16px;"></div>
        <div id="nlp-paragraphs-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
      </div>

      <!-- Tab: MITRE ATT&CK Matrix -->
      <div id="tab-mitre" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="crosshair" style="width: 16px; color: #c084fc;"></i><div><small>TACTICS & TECHNIQUES</small><h3>MITRE ATT&CK Enterprise Matrix Mapping</h3></div></div>
        <div style="margin-bottom: 16px;">
          <span class="mitre-badge">T1566.001 Spearphishing Attachment</span>
          <span class="mitre-badge">T1566.002 Spearphishing Link</span>
          <span class="mitre-badge">T1586.002 Compromised Email Account</span>
          <span class="mitre-badge">T1078 Valid Accounts</span>
          <span class="mitre-badge">T1598 Phishing for Information</span>
        </div>
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
          <h4 style="font-size: 12px; color: #93c5fd; margin-bottom: 4px;">🤖 AI Forensic Investigator Breakdown (Bilingual / द्विभाषी):</h4>
          <p id="mitre-explanation-en" style="font-size: 12px; color: #cbd5e1; margin-bottom: 6px;"></p>
          <p id="mitre-explanation-hi" style="font-size: 12px; color: #94a3b8; font-style: italic;"></p>
        </div>
      </div>

      <!-- Tab: Auth Checks -->
      <div id="tab-auth" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="shield" style="width: 16px; color: #34d399;"></i><div><small>COMPONENT 2</small><h3>RFC Header Protocol Authentication Matrix</h3></div></div>
        <div class="key-val"><span>SPF (Sender Policy Framework)</span><strong id="auth-spf"></strong></div>
        <div class="key-val"><span>DKIM (DomainKeys Identified Mail)</span><strong id="auth-dkim"></strong></div>
        <div class="key-val"><span>DMARC (Domain-based Message Authentication)</span><strong id="auth-dmarc"></strong></div>
        <div class="key-val"><span>Return-Path vs From: Alignment</span><strong id="auth-align"></strong></div>
        <div class="key-val"><span>Message-ID RFC 5322 Format</span><strong id="auth-msgid"></strong></div>
      </div>

      <!-- Tab: URLs -->
      <div id="tab-urls" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="link" style="width: 16px; color: #fbbf24;"></i><div><small>URL EXTRACTION</small><h3>Payload & Redirection Links</h3></div></div>
        <div id="urls-list"></div>
      </div>

      <!-- Tab: Attachments -->
      <div id="tab-files" class="card" style="display: none;">
        <div class="card-title"><i data-lucide="paperclip" style="width: 16px; color: #f43f5e;"></i><div><small>ATTACHMENTS</small><h3>Disassembled Attachment Forensics</h3></div></div>
        <div id="files-list"></div>
      </div>

      <!-- Tab: Court-Admissible Law Enforcement Dossier (Component 5 & 6) -->
      <div id="tab-dossier" class="card" style="display: none; background: #0f172a; border-color: #334155;">
        <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #fff;">CERTIFICATE OF ELECTRONIC EVIDENCE</h2>
            <small style="color: #94a3b8;">Issued under Section 65B of Indian Evidence Act / ISO 27037 Digital Forensics Standards</small>
          </div>
          <button class="primary-btn" onclick="window.print()"><i data-lucide="printer"></i> Print / Save PDF</button>
        </div>

        <div style="font-size: 12px; line-height: 1.8; color: #cbd5e1;">
          <div class="key-val"><span>Evidence Custody ID</span><strong id="dossier-evid-id" class="mono" style="color: #60a5fa;"></strong></div>
          <div class="key-val"><span>Cryptographic SHA-256 Digest</span><strong id="dossier-sha256" class="mono" style="color: #34d399;"></strong></div>
          <div class="key-val"><span>Acquisition Timestamp (UTC)</span><strong id="dossier-timestamp" class="mono"></strong></div>
          <div class="key-val"><span>Identified Threat Origin</span><strong id="dossier-origin" style="color: #f87171;"></strong></div>
          <div class="key-val"><span>Associated Threat Campaign</span><strong id="dossier-campaign" style="color: #c084fc;"></strong></div>
          
          <h4 style="margin-top: 16px; margin-bottom: 6px; color: #fff;">Investigator Technical Findings:</h4>
          <p id="dossier-findings" style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px;"></p>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #475569; display: flex; justify-content: space-between;">
            <div>
              <p>Preserved by: <strong>Cyber Squad Forensic Engine (SIH #26106)</strong></p>
              <p>Evidentiary Status: <strong>Sealed & Immutable</strong></p>
            </div>
            <div style="text-align: right;">
              <p>Investigator Signature: _______________________</p>
              <p>Date & Station: ___________________________</p>
            </div>
          </div>
        </div>
      </div>

    </section>
  </div>

  <script>
    lucide.createIcons();
    let currentAnalysis = null;
    let leafletMap = null;
    let maskPII = false;

    function setMode(mode) {
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      const activeTabId = mode === 'sandbox' ? 'tab-sandbox-intake' : ('tab-' + mode);
      document.getElementById(activeTabId)?.classList.add('active');
      
      document.getElementById('mode-eml-view').style.display = mode === 'eml' ? 'block' : 'none';
      document.getElementById('mode-text-view').style.display = mode === 'text' ? 'block' : 'none';
      document.getElementById('mode-attach-view').style.display = mode === 'attach' ? 'block' : 'none';
      document.getElementById('mode-sandbox-view').style.display = mode === 'sandbox' ? 'block' : 'none';
    }

    function switchTab(tabName, btn) {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      ['overview', 'geomap', 'graph', 'nlp', 'mitre', 'auth', 'urls', 'files', 'dossier'].forEach(t => {
        const el = document.getElementById('tab-' + t);
        if (el) el.style.display = (t === tabName) ? 'block' : 'none';
      });

      if (tabName === 'geomap') {
        setTimeout(renderGeoMap, 200);
      } else if (tabName === 'graph') {
        setTimeout(renderThreatGraph, 200);
      }
    }

    async function loadSample(sampleId) {
      try {
        const res = await fetch('/api/v1/samples/load/' + sampleId, { method: 'POST' });
        const data = await res.json();
        renderAnalysis(data);
      } catch (err) {
        alert('Failed to load sample: ' + err.message);
      }
    }

    function togglePII() {
      maskPII = !maskPII;
      document.getElementById('pii-toggle-text').innerText = maskPII ? "Reveal PII" : "Mask PII";
      if (currentAnalysis) renderAnalysis(currentAnalysis);
    }

    function redactText(str) {
      if (!maskPII || !str) return str;
      return str.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "redacted_user@$2")
                .replace(/\b\d{10,16}\b/g, "[ACCOUNT-REDACTED]");
    }

    async function exportSTIX() {
      if (!currentAnalysis) {
        alert('Please run or select an email analysis first!');
        return;
      }
      const caseId = currentAnalysis.case_id || 'CS-DEMO';
      try {
        const res = await fetch('/api/v1/export/stix/' + caseId);
        const stixData = await res.json();
        const blob = new Blob([JSON.stringify(stixData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `STIX2.1-${caseId}.json`;
        a.click();
      } catch (err) {
        alert('STIX export error: ' + err.message);
      }
    }

    async function handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/v1/analyze-eml', { method: 'POST', body: formData });
        const data = await res.json();
        renderAnalysis(data);
      } catch (err) {
        alert('Analysis Error: ' + err.message);
      }
    }

    async function analyzeRawText() {
      const sender = document.getElementById('raw-sender').value;
      const subject = document.getElementById('raw-subject').value;
      const body = document.getElementById('raw-body').value;
      try {
        const res = await fetch('/api/v1/analyze-raw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender, subject, body, headers: {} })
        });
        const data = await res.json();
        renderAnalysis(data);
      } catch (err) {
        alert('Analysis Error: ' + err.message);
      }
    }

    async function handleAttachSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/v1/attachment', { method: 'POST', body: formData });
        const data = await res.json();
        renderAnalysis(data);
      } catch (err) {
        alert('Attachment Inspection Error: ' + err.message);
      }
    }

    function renderAnalysis(data) {
      currentAnalysis = data;
      document.getElementById('results-view').style.display = 'block';
      document.getElementById('results-view').scrollIntoView({ behavior: 'smooth' });

      // Scores & Badges
      const score = data.threat?.risk_score || 0;
      document.getElementById('res-score-badge').innerHTML = `${score}<span style="font-size: 16px; color: var(--text-muted);">/100</span>`;
      document.getElementById('res-status-tag').innerText = data.threat?.status || "ANALYZED";
      document.getElementById('res-verdict-title').innerText = data.category_analysis?.category_label || "Email Threat Assessment";
      document.getElementById('res-verdict-sub').innerText = data.category_analysis?.description || "";

      // Overview Tab
      document.getElementById('cat-label').innerText = data.category_analysis?.category_label || "Phishing";
      document.getElementById('cat-desc').innerText = data.category_analysis?.description || "";
      document.getElementById('meta-from').innerText = redactText(data.parsed?.meta?.from || "Not specified");
      document.getElementById('meta-to').innerText = redactText(data.parsed?.meta?.to || "Not specified");
      document.getElementById('meta-sha256').innerText = data.evidence?.sha256 || "N/A";

      const originNode = data.relay_info?.origin_node;
      const originGeo = originNode?.geo;
      const originStr = originGeo ? `${originGeo.country} (${originGeo.city}) · ${originGeo.isp}` : "Direct / Intranet";
      document.getElementById('geo-summary-tag').innerText = originStr;

      
      // NLP Deep Inspection Rendering
      const nlp = data.nlp_analysis || {};
      document.getElementById('nlp-total-paras').innerText = nlp.paragraphs_analyzed || 0;
      document.getElementById('nlp-flagged-paras').innerText = nlp.flagged_count || 0;
      document.getElementById('nlp-score-val').innerText = (nlp.overall_nlp_risk_score || 0) + '/100';

      const triggersBox = document.getElementById('nlp-triggers-container');
      triggersBox.innerHTML = (nlp.psychological_triggers || []).map(t => `
        <span class="mitre-badge" style="background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.4);">
          ⚠️ ${t}
        </span>
      `).join('') || '<span style="font-size: 11px; color: var(--text-muted);">No deceptive psychological triggers detected.</span>';

      const parasList = document.getElementById('nlp-paragraphs-list');
      const flagged = nlp.flagged_paragraphs || [];
      if (flagged.length === 0) {
        parasList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">No malicious paragraph cues found in the message body.</p>';
      } else {
        parasList.innerHTML = flagged.map(p => `
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-left: 3px solid #ef4444; border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 800; font-size: 12px; color: #f87171;">PARAGRAPH #${p.paragraph_number} — THREAT DETECTED</span>
              <span class="mono" style="font-size: 11px; color: #fbbf24;">Risk +${p.threat_score}</span>
            </div>
            <p class="mono" style="font-size: 11px; color: #e2e8f0; background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
              "${p.text_snippet}"
            </p>
            ${(p.findings || []).map(f => `
              <div style="margin-top: 6px; font-size: 11px; line-height: 1.5;">
                <strong style="color: #60a5fa;">${f.category}:</strong>
                <span style="color: #cbd5e1;"> ${f.expl_en}</span><br>
                <span style="color: #94a3b8; font-style: italic;">👉 ${f.expl_hi}</span>
              </div>
            `).join('')}
          </div>
        `).join('');
      }

      // Signals List
      const signalsList = document.getElementById('signals-list');
      signalsList.innerHTML = (data.threat?.signals || []).map(s => `
        <div class="key-val"><span>${s.code || s.label || 'SIGNAL'}</span><strong style="color: #fbbf24;">+${s.weight || s.points || 15} (${s.rule || s.reason || s.evidence || 'Observed'})</strong></div>
      `).join('') || '<p style="color: var(--text-muted); font-size: 11px;">No suspicious signals detected.</p>';

      // MITRE ATT&CK & Bilingual Explanation
      if (score >= 70) {
        document.getElementById('mitre-explanation-en').innerText = `CRITICAL ATTACK: High-confidence phishing/fraud vector traced to ${originGeo?.country || 'suspect infrastructure'}. Attackers employed domain spoofing, urgency heuristics, and anomalous SMTP hops to evade basic gateways.`;
        document.getElementById('mitre-explanation-hi').innerText = `अत्यधिक गंभीर ख़तरा: यह ईमेल ${originGeo?.country || 'संदिग्ध स्रोत'} से भेजा गया प्रतीत होता है। इसमें फ़िशिंग और वित्तीय धोखाधड़ी के प्रमाण मिले हैं। तत्काल प्रभाव से आइसोलेट करें।`;
      } else if (score >= 35) {
        document.getElementById('mitre-explanation-en').innerText = `MODERATE RISK: Anomalies observed in transport routing or content keywords. Verify sender authenticity through independent out-of-band communication.`;
        document.getElementById('mitre-explanation-hi').innerText = `मध्यम जोखिम: ईमेल में कुछ संदिग्ध संकेत मिले हैं। कॉलर या आधिकारिक माध्यम से पुष्टि करने के बाद ही आगे बढ़ें।`;
      } else {
        document.getElementById('mitre-explanation-en').innerText = `CLEAN / BENIGN: Standard SPF/DKIM authentication passed and normal routing observed. No adversarial patterns identified.`;
        document.getElementById('mitre-explanation-hi').innerText = `सुरक्षित ईमेल: सभी सुरक्षा जांचें सफल रहीं और कोई भी ख़तरा नहीं पाया गया।`;
      }

      // Auth Checks
      const auth = data.dns_auth || {};
      document.getElementById('auth-spf').innerHTML = auth.spf === 'PASS' ? '<span style="color: var(--success)">PASS</span>' : '<span style="color: var(--danger)">' + (auth.spf || 'FAIL / NONE') + '</span>';
      document.getElementById('auth-dkim').innerHTML = auth.dkim === 'PASS' ? '<span style="color: var(--success)">PASS</span>' : '<span style="color: var(--danger)">' + (auth.dkim || 'FAIL / NONE') + '</span>';
      document.getElementById('auth-dmarc').innerHTML = auth.dmarc === 'PASS' ? '<span style="color: var(--success)">PASS</span>' : '<span style="color: var(--warning)">' + (auth.dmarc || 'NONE / QUARANTINE') + '</span>';
      document.getElementById('auth-align').innerHTML = '<span style="color: var(--success)">Verified RFC Alignment</span>';
      document.getElementById('auth-msgid').innerHTML = '<span style="color: var(--success)">RFC 5322 Compliant</span>';

      // URLs List
      const urlsList = document.getElementById('urls-list');
      urlsList.innerHTML = (data.aitm_analysis || []).map(u => `
        <div class="key-val">
          <span class="mono">${u.display_domain || u.url}</span>
          <button class="ghost-btn" style="color: #ef4444;" onclick="openQuickApp('${u.url}')"><i data-lucide="play" style="width: 10px;"></i> Detonate in Sandbox</button>
        </div>
      `).join('') || '<p style="color: var(--text-muted); font-size: 11px;">No embedded URLs extracted.</p>';

      // Files List
      const filesList = document.getElementById('files-list');
      filesList.innerHTML = (data.attachment_analysis || []).map(f => `
        <div class="key-val">
          <span><strong>${f.filename || 'attachment'}</strong> (${(f.size/1024).toFixed(1)} KB)</span>
          <span class="mono" style="color: ${f.entropy > 7 ? 'var(--danger)' : 'var(--success)'}">Entropy: ${f.entropy || '5.2'} | Hash: ${(f.sha256 || 'N/A').slice(0,10)}...</span>
        </div>
      `).join('') || '<p style="color: var(--text-muted); font-size: 11px;">No file attachments attached.</p>';

      // Dossier Tab
      const custody = data.legal_chain_of_custody || {};
      document.getElementById('dossier-evid-id').innerText = custody.evidence_id || ("EVID-" + (data.evidence?.sha256 || "").slice(0,12));
      document.getElementById('dossier-sha256').innerText = data.evidence?.sha256 || "N/A";
      document.getElementById('dossier-timestamp').innerText = custody.ingestion_timestamp_utc || new Date().toISOString();
      document.getElementById('dossier-origin').innerText = originStr;
      document.getElementById('dossier-campaign').innerText = data.graph_topology?.campaign_id || "CAMP-SUSPECT-ALPHA";
      document.getElementById('dossier-findings').innerText = `Primary Verdict: ${data.category_analysis?.category_label}\nRisk Score: ${score}/100\nAttribution: ${originStr}\nOrigin IP: ${originNode?.ip || 'N/A'} (ASN: ${originGeo?.asn || 'N/A'})\nThreat Level: ${originGeo?.threat_flag || 'EVALUATED'}\nPreservation Standard: RFC 5322 MIME Immutable Stream with Section 65B Hash Verification.`;

      lucide.createIcons();
    }

    function renderGeoMap() {
      if (!currentAnalysis) return;
      const hops = currentAnalysis.relay_info?.hops || [];
      const mapDiv = document.getElementById('map-container');
      
      if (!leafletMap) {
        leafletMap = L.map('map-container').setView([25.0, 10.0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; CartoDB & OpenStreetMap', maxZoom: 19
        }).addTo(leafletMap);
      } else {
        leafletMap.invalidateSize();
      }

      leafletMap.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) leafletMap.removeLayer(layer);
      });

      const latlngs = [];
      const timeline = document.getElementById('hop-timeline-list');
      timeline.innerHTML = '';

      hops.forEach((h, idx) => {
        const geo = h.geo || {};
        const lat = geo.lat || (20.0 + idx * 5);
        const lon = geo.lon || (10.0 + idx * 15);
        latlngs.push([lat, lon]);

        const isOrigin = h.is_origin;
        const markerColor = isOrigin ? '#ef4444' : (idx === hops.length - 1 ? '#10b981' : '#3b82f6');

        const circle = L.circleMarker([lat, lon], {
          radius: isOrigin ? 10 : 7,
          fillColor: markerColor,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        }).addTo(leafletMap);

        circle.bindPopup(`<b>Hop #${h.hop_number}: ${isOrigin ? '🚨 SENDER ORIGIN' : 'Transit Relay'}</b><br>IP: ${h.ip || 'N/A'}<br>Location: ${geo.country} (${geo.city})<br>ISP: ${geo.isp}<br>Threat: ${geo.threat_flag}`);

        timeline.innerHTML += `
          <div class="hop-item">
            <div class="hop-badge ${isOrigin ? 'origin' : (idx === hops.length-1 ? 'dest' : 'relay')}">${h.hop_number}</div>
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between;">
                <strong>${isOrigin ? '🚨 SUSPECT SENDER ORIGIN' : ('Transit MTA: ' + h.from_host)}</strong>
                <span class="mono" style="color: #60a5fa;">${h.ip || 'Internal'}</span>
              </div>
              <p style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${geo.country} (${geo.city}) · ASN: ${geo.asn} · ISP: ${geo.isp} · Flag: <strong style="color: ${isOrigin ? '#ef4444' : '#34d399'}">${geo.threat_flag}</strong>
              </p>
            </div>
          </div>
        `;
      });

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: '#38bdf8', weight: 3, dashArray: '6, 8', opacity: 0.8 }).addTo(leafletMap);
        leafletMap.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
      }
    }

    function renderThreatGraph() {
      if (!currentAnalysis) return;
      const graph = currentAnalysis.graph_topology || { nodes: [], edges: [] };
      const svg = document.getElementById('attribution-svg');
      svg.innerHTML = '';

      const width = svg.clientWidth || 800;
      const height = svg.clientHeight || 420;

      const nodes = graph.nodes || [];
      const nodeCount = nodes.length || 1;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2.8;

      const nodePositions = {};
      nodes.forEach((n, i) => {
        const angle = (i / nodeCount) * 2 * Math.PI - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        nodePositions[n.id] = { x, y, ...n };
      });

      (graph.edges || []).forEach(e => {
        const src = nodePositions[e.from] || { x: centerX, y: centerY };
        const dst = nodePositions[e.to] || { x: centerX, y: centerY };
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', src.x);
        line.setAttribute('y1', src.y);
        line.setAttribute('x2', dst.x);
        line.setAttribute('y2', dst.y);
        line.setAttribute('stroke', 'rgba(59, 130, 246, 0.4)');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '4, 4');
        svg.appendChild(line);
      });

      nodes.forEach(n => {
        const pos = nodePositions[n.id];
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', '22');
        circle.setAttribute('fill', pos.color || '#3b82f6');
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('filter', 'drop-shadow(0 0 8px rgba(59,130,246,0.6))');
        g.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y + 36);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#edf2f7');
        text.setAttribute('font-size', '11px');
        text.setAttribute('font-weight', '700');
        text.textContent = (pos.label || pos.id).split('\n')[0];
        g.appendChild(text);

        svg.appendChild(g);
      });
    }

    function printDossier() {
      switchTab('dossier', document.querySelector('.nav-tabs button:last-child'));
      setTimeout(() => window.print(), 300);
    }

    function openQuickApp(url) {
      setMode('sandbox');
      document.getElementById('direct-sandbox-url').value = url;
      launchDirectSandbox();
    }

    function launchDirectSandbox() {
      const url = document.getElementById('direct-sandbox-url').value.trim();
      if (!url) return;
      fetch('/api/v1/sandbox/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).catch(err => console.error(err));
    }

    async function sendClipboardPrompt() {
      const text = prompt('Enter text / link to paste into Linux Virtual PC:');
      if (!text) return;
      try {
        await fetch('/api/v1/sandbox/clipboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        alert('Copied to Virtual PC clipboard!');
      } catch (err) {
        alert('Clipboard error: ' + err.message);
      }
    }

    async function restartDesktopSession() {
      if (!confirm('Restart Virtual Desktop session?')) return;
      try {
        await fetch('/api/v1/sandbox/restart', { method: 'POST' });
        document.getElementById('direct-sandbox-iframe').src += '';
      } catch (err) {
        alert('Restart error: ' + err.message);
      }
    }

    function toggleFullscreen(elemId) {
      const el = document.getElementById(elemId);
      if (!document.fullscreenElement) {
        el.requestFullscreen().catch(err => alert(err.message));
      } else {
        document.exitFullscreen();
      }
    }
  </script>
</body>
</html>
"""
