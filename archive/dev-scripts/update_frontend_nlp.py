import re

with open('backend/app/static_index.py', 'r') as f:
    content = f.read()

# 1. Add NLP Inspector tab button
nlp_tab_btn = '<button class="nav-tab" onclick="switchTab(\'nlp\', this)"><i data-lucide="brain" style="width: 13px;"></i> 🧠 Deep AI Paragraph Inspector</button>'

if 'switchTab(\'nlp\'' not in content:
    content = content.replace(
        '<button class="nav-tab" onclick="switchTab(\'mitre\', this)">',
        nlp_tab_btn + '\n        <button class="nav-tab" onclick="switchTab(\'mitre\', this)">'
    )

# 2. Add NLP Inspector tab content
nlp_tab_content = '''
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
'''

if 'id="tab-nlp"' not in content:
    content = content.replace(
        '<!-- Tab: MITRE ATT&CK Matrix -->',
        nlp_tab_content + '\n      <!-- Tab: MITRE ATT&CK Matrix -->'
    )

# 3. Update switchTab to include 'nlp'
content = content.replace(
    "['overview', 'geomap', 'graph', 'mitre', 'auth', 'urls', 'files', 'dossier']",
    "['overview', 'geomap', 'graph', 'nlp', 'mitre', 'auth', 'urls', 'files', 'dossier']"
)

# 4. Update renderAnalysis to render NLP details
nlp_render_code = '''
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
'''

if '// NLP Deep Inspection Rendering' not in content:
    content = content.replace(
        '// Signals List',
        nlp_render_code + '\n      // Signals List'
    )

with open('backend/app/static_index.py', 'w') as f:
    f.write(content)
print('Successfully updated static_index.py with Deep AI Paragraph & NLP Inspector')
