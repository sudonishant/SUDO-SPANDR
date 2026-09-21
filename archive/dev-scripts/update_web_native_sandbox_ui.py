import re

with open('backend/app/static_index.py', 'r') as f:
    content = f.read()

# Replace Tab 4 button text
content = content.replace(
    '<button class="mode-tab" id="tab-sandbox-intake" onclick="setMode(\'sandbox\')"><i data-lucide="monitor"></i> 4. Virtual Sandbox</button>',
    '<button class="mode-tab" id="tab-sandbox-intake" onclick="setMode(\'sandbox\')"><i data-lucide="shield-alert"></i> 4. Safe URL Detonator</button>'
)

# Replace the entire #mode-sandbox-view markup with Web-Native Safe Detonator UI
new_sandbox_html = '''
    <!-- 4. WEB-NATIVE SAFE SANDBOX DETONATOR -->
    <div id="mode-sandbox-view" style="display: none;">
      <div class="card" style="border-left: 3px solid #38bdf8; background: linear-gradient(135deg, rgba(56,189,248,0.06), var(--card-bg));">
        <div class="card-title">
          <i data-lucide="shield-alert" style="width: 15px; color: #38bdf8;"></i>
          <div><small>AIR-GAPPED THREAT DETONATION (ZERO LINUX/VPS DEPENDENCY)</small><h3>🛡️ Web-Native Safe Link Detonator & DOM Sandbox</h3></div>
        </div>

        <!-- Quick 1-Click Test URLs -->
        <div style="display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; align-items: center;">
          <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 700;">1-Click Detonate:</span>
          <button class="ghost-btn" style="color: #f87171; border-color: rgba(239,68,68,0.3); padding: 4px 9px; font-size: 10.5px;" onclick="setAndDetonate('https://login.live.com')"><i data-lucide="shield" style="width: 10px;"></i> Microsoft Login</button>
          <button class="ghost-btn" style="color: #fbbf24; border-color: rgba(251,191,36,0.3); padding: 4px 9px; font-size: 10.5px;" onclick="setAndDetonate('https://accounts.google.com')"><i data-lucide="lock" style="width: 10px;"></i> Google Auth</button>
          <button class="ghost-btn" style="color: #34d399; border-color: rgba(52,211,153,0.3); padding: 4px 9px; font-size: 10.5px;" onclick="setAndDetonate('https://example.com')"><i data-lucide="check" style="width: 10px;"></i> Benign Target</button>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
          <input type="text" id="web-sandbox-url" value="https://example.com" placeholder="Enter suspicious link to detonate (e.g. https://phish-bank.com/login)..." style="flex: 1; min-width: 260px; background: rgba(0,0,0,0.4); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: #fff; font-size: 15px;" onkeydown="if(event.key==='Enter') detonateWebLink()">
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
            <div class="key-val" style="border: none; padding: 2px 0;"><span>DOM Security:</span><strong style="color:#34d399;">AIR-GAPPED ISOLATED</strong></div>
          </div>
        </div>

        <!-- Air-Gapped Sandboxed Preview Iframe -->
        <div style="border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #000; height: 500px; position: relative;">
          <iframe id="web-sandbox-iframe" style="width: 100%; height: 100%; border: none;" sandbox="allow-same-origin allow-forms"></iframe>
        </div>
      </div>
    </div>
'''

# Replace old #mode-sandbox-view block
content = re.sub(r'<!-- 4\. NO-VNC VIRTUAL DESKTOP -->[\s\S]*?<!-- FORENSIC RESULTS VIEWPORT -->', new_sandbox_html + '\n    <!-- FORENSIC RESULTS VIEWPORT -->', content)

# Add JavaScript detonateWebLink function
js_funcs = '''
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
        
        // Render sanitized HTML safely in the sandbox iframe
        iframe.srcdoc = data.sanitized_html || '<h3>Preview not available</h3>';
        
      } catch (err) {
        document.getElementById('sb-verdict').innerText = 'Error: ' + err.message;
        iframe.srcdoc = `<div style="padding:20px;color:#f87171;">Error connecting: ${err.message}</div>`;
      }
    }

    function openQuickApp(url) {
      setMode('sandbox');
      document.getElementById('web-sandbox-url').value = url;
      detonateWebLink();
    }
'''

# Update JS in static_index.py
content = re.sub(r'function openQuickApp\(url\)[\s\S]*?function toggleFullscreen\(elemId\) \{[\s\S]*?\}', js_funcs, content)

with open('backend/app/static_index.py', 'w') as f:
    f.write(content)

print('Successfully applied Web-Native Safe Sandbox Detonator update')
