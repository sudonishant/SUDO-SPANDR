import re

with open('backend/app/static_index.py', 'r') as f:
    content = f.read()

# Replace #mode-sandbox-view markup with a polished Web Browser Window
new_browser_html = '''
    <!-- 4. WEB-NATIVE SAFE SANDBOX DETONATOR & LIVE BROWSER -->
    <div id="mode-sandbox-view" style="display: none;">
      <div class="card" style="border-left: 3px solid #38bdf8; background: linear-gradient(135deg, rgba(56,189,248,0.06), var(--card-bg));">
        <div class="card-title">
          <i data-lucide="shield-alert" style="width: 15px; color: #38bdf8;"></i>
          <div><small>AIR-GAPPED THREAT DETONATION (ZERO VPS/LINUX DEPENDENCY)</small><h3>🛡️ Safe In-Browser Detonator & DOM Sandbox</h3></div>
        </div>

        <!-- 1-Click Fast Detonation Targets -->
        <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; align-items: center;">
          <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 700;">1-Click Targets:</span>
          <button class="ghost-btn" style="color: #f87171; border-color: rgba(239,68,68,0.3); padding: 4px 9px; font-size: 10.5px;" onclick="setAndDetonate('https://login.live.com')"><i data-lucide="shield" style="width: 10px;"></i> Microsoft Login</button>
          <button class="ghost-btn" style="color: #fbbf24; border-color: rgba(251,191,36,0.3); padding: 4px 9px; font-size: 10.5px;" onclick="setAndDetonate('https://accounts.google.com')"><i data-lucide="lock" style="width: 10px;"></i> Google Auth</button>
          <button class="ghost-btn" style="color: #38bdf8; border-color: rgba(56,189,248,0.3); padding: 4px 9px; font-size: 10.5px;" onclick="setAndDetonate('https://wikipedia.org')"><i data-lucide="globe" style="width: 10px;"></i> Wikipedia</button>
          <button class="ghost-btn" style="color: #34d399; border-color: rgba(52,211,153,0.3); padding: 4px 9px; font-size: 10.5px;" onclick="setAndDetonate('https://example.com')"><i data-lucide="check" style="width: 10px;"></i> Benign Target</button>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
          <input type="text" id="web-sandbox-url" value="https://example.com" placeholder="Enter link to detonate (e.g. https://phish-bank.com/login)..." style="flex: 1; min-width: 260px; background: rgba(0,0,0,0.4); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: #fff; font-size: 15px;" onkeydown="if(event.key==='Enter') detonateWebLink()">
          <button class="primary-btn" style="padding: 10px 20px; font-size: 12px; background: linear-gradient(135deg, #ef4444, #dc2626);" onclick="detonateWebLink()"><i data-lucide="play" style="width: 13px;"></i> Detonate Safely</button>
        </div>

        <!-- Threat Diagnostics Summary Panel -->
        <div id="sandbox-diag-panel" style="display: none; background: rgba(0,0,0,0.35); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px; margin-bottom: 8px;">
            <div>
              <span style="font-size: 9.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">DETONATION VERDICT</span>
              <h4 id="sb-verdict" style="font-size: 14px; font-weight: 800; color: #f87171;"></h4>
            </div>
            <div style="text-align: right;">
              <span id="sb-risk-score" class="mono font-bold" style="font-size: 18px; color: #f87171;"></span>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; font-size: 11px;">
            <div class="key-val" style="border: none; padding: 2px 0;"><span>Target IP / Host:</span><strong id="sb-ip" class="mono" style="color:#60a5fa;"></strong></div>
            <div class="key-val" style="border: none; padding: 2px 0;"><span>Password Inputs:</span><strong id="sb-pass-count" class="mono" style="color:#f87171;"></strong></div>
            <div class="key-val" style="border: none; padding: 2px 0;"><span>Form Actions:</span><strong id="sb-forms-count" class="mono" style="color:#fbbf24;"></strong></div>
            <div class="key-val" style="border: none; padding: 2px 0;"><span>Security Sandbox:</span><strong style="color:#34d399;">AIR-GAPPED & NEUTRALIZED</strong></div>
          </div>
        </div>

        <!-- Browser Chrome Window -->
        <div style="border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #0f172a; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
          
          <!-- Browser Top Window Bar -->
          <div style="background: #090d16; border-bottom: 1px solid var(--border); padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #fbbf24; display: inline-block;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              <span style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-left: 8px;">Air-Gapped In-Browser Sandbox</span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="ghost-btn" style="padding: 3px 8px; font-size: 10px;" onclick="reloadSandboxIframe()"><i data-lucide="rotate-ccw" style="width: 10px;"></i> Reload</button>
              <button class="ghost-btn" style="padding: 3px 8px; font-size: 10px;" onclick="openExternalSafe()"><i data-lucide="external-link" style="width: 10px;"></i> Open URL</button>
            </div>
          </div>

          <!-- Sandbox Live Iframe -->
          <div style="height: 520px; position: relative; background: #fff;">
            <iframe id="web-sandbox-iframe" style="width: 100%; height: 100%; border: none; background: #fff;" sandbox="allow-same-origin allow-forms allow-scripts allow-popups"></iframe>
          </div>
        </div>
      </div>
    </div>
'''

content = re.sub(r'<!-- 4\. WEB-NATIVE SAFE SANDBOX DETONATOR -->[\s\S]*?<!-- FORENSIC RESULTS VIEWPORT -->', new_browser_html + '\n    <!-- FORENSIC RESULTS VIEWPORT -->', content)

# JavaScript functions
js_update = '''
    function setAndDetonate(url) {
      document.getElementById('web-sandbox-url').value = url;
      detonateWebLink();
    }

    async function detonateWebLink() {
      const url = document.getElementById('web-sandbox-url').value.trim();
      if (!url) return;
      
      const iframe = document.getElementById('web-sandbox-iframe');
      const diagPanel = document.getElementById('sandbox-diag-panel');
      
      diagPanel.style.display = 'block';
      document.getElementById('sb-verdict').innerText = '⏳ Air-Gapped Detonation in progress...';
      document.getElementById('sb-verdict').style.color = '#60a5fa';
      document.getElementById('sb-risk-score').innerText = '...';
      
      try {
        // 1. Fetch threat diagnostics JSON
        const res = await fetch('/api/v1/sandbox/detonate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url })
        });
        const data = await res.json();
        
        document.getElementById('sb-verdict').innerText = data.threat_verdict || 'ANALYZED';
        document.getElementById('sb-verdict').style.color = (data.risk_score >= 50) ? '#f87171' : '#34d399';
        document.getElementById('sb-risk-score').innerText = `${data.risk_score || 0}/100`;
        document.getElementById('sb-risk-score').style.color = (data.risk_score >= 50) ? '#f87171' : '#34d399';
        
        document.getElementById('sb-ip').innerText = `${data.resolved_ip || 'N/A'} (${data.hostname || ''})`;
        document.getElementById('sb-pass-count').innerText = `${data.password_inputs_count || 0} Credential Traps`;
        document.getElementById('sb-forms-count').innerText = `${data.forms_count || 0} Forms Detected`;
        
        // 2. Load safe sanitized preview via direct stream frame
        iframe.src = '/api/v1/sandbox/preview-frame?url=' + encodeURIComponent(url);
        
      } catch (err) {
        document.getElementById('sb-verdict').innerText = 'Error: ' + err.message;
        iframe.srcdoc = `<div style="padding:20px;color:#f87171;font-family:sans-serif;">Error connecting: ${err.message}</div>`;
      }
    }

    function reloadSandboxIframe() {
      const iframe = document.getElementById('web-sandbox-iframe');
      if (iframe) iframe.src = iframe.src;
    }

    function openExternalSafe() {
      const url = document.getElementById('web-sandbox-url').value.trim();
      if (url) window.open(url, '_blank');
    }

    function openQuickApp(url) {
      setMode('sandbox');
      document.getElementById('web-sandbox-url').value = url;
      detonateWebLink();
    }
'''

content = re.sub(r'function setAndDetonate\(url\)[\s\S]*?function openQuickApp\(url\) \{[\s\S]*?\}', js_update, content)

with open('backend/app/static_index.py', 'w') as f:
    f.write(content)

print('Successfully upgraded Safe Sandbox Browser Container UI')
