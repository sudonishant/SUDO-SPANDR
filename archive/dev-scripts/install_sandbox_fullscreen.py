import re

with open('backend/app/static_index.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Fullscreen CSS
fullscreen_css = '''
    .chromium-browser-frame.is-fullscreen {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      z-index: 9999999 !important;
      margin: 0 !important;
      border-radius: 0 !important;
      border: none !important;
      box-shadow: none !important;
      display: flex !important;
      flex-direction: column !important;
      background: #202124 !important;
    }
    .chromium-browser-frame.is-fullscreen .chromium-viewport {
      flex: 1 !important;
      height: 100% !important;
      min-height: 0 !important;
    }
'''

content = content.replace(
    '/* Authentic Chromium Browser Sandbox */',
    '/* Authentic Chromium Browser Sandbox */' + fullscreen_css
)

# 2. Update Card Title Header with Full Screen button
old_card_actions = '''          <div style="display: flex; gap: 6px; align-items: center;">
            <input type="file" id="sandbox-file-picker" style="display: none;" onchange="sandboxOpenFile(event)">
            <button class="ghost-btn" style="padding: 5px 12px; font-size: 11px; border-color: rgba(139,92,246,0.4); color: #c084fc;" onclick="document.getElementById('sandbox-file-picker').click()">
              <i data-lucide="folder-open" style="width: 11px;"></i> 📂 Open File in Browser
            </button>
          </div>'''

new_card_actions = '''          <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            <button class="primary-btn" id="btn-card-fullscreen" style="padding: 5px 12px; font-size: 11px; background: linear-gradient(135deg, #0284c7, #0369a1); font-weight: 700;" onclick="toggleSandboxFullscreen()">
              <i data-lucide="maximize-2" style="width: 11px;"></i> <span id="txt-card-fullscreen">⛶ Full Screen Sandbox</span>
            </button>
            <input type="file" id="sandbox-file-picker" style="display: none;" onchange="sandboxOpenFile(event)">
            <button class="ghost-btn" style="padding: 5px 12px; font-size: 11px; border-color: rgba(139,92,246,0.4); color: #c084fc;" onclick="document.getElementById('sandbox-file-picker').click()">
              <i data-lucide="folder-open" style="width: 11px;"></i> 📂 Open File in Browser
            </button>
          </div>'''

content = content.replace(old_card_actions, new_card_actions)

# 3. Update Chromium Tabstrip with Full Screen toggle
old_tabstrip = '''          <!-- Top Tabstrip -->
          <div class="chromium-tabstrip">
            <div class="chromium-tab" id="chromium-tab-title">
              <i data-lucide="globe" style="width: 12px; color: #8ab4f8;"></i>
              <span id="chromium-tab-text">Google</span>
            </div>
            <button class="chromium-newtab-btn" title="New Tab" onclick="loadChromiumWelcome()">+</button>
          </div>'''

new_tabstrip = '''          <!-- Top Tabstrip -->
          <div class="chromium-tabstrip">
            <div class="chromium-tab" id="chromium-tab-title">
              <i data-lucide="globe" style="width: 12px; color: #8ab4f8;"></i>
              <span id="chromium-tab-text">Google</span>
            </div>
            <button class="chromium-newtab-btn" title="New Tab" onclick="loadChromiumWelcome()">+</button>
            <div style="margin-left: auto; display: flex; align-items: center; gap: 6px;">
              <button class="ghost-btn" id="btn-toggle-fullscreen" style="padding: 3px 10px; font-size: 11px; border-color: rgba(56,189,248,0.4); color: #38bdf8; display: flex; align-items: center; gap: 5px;" onclick="toggleSandboxFullscreen()" title="Toggle Full Screen Sandbox (Esc to exit)">
                <i data-lucide="maximize" style="width: 12px;"></i> <span id="txt-toggle-fullscreen">Full Screen</span>
              </button>
            </div>
          </div>'''

content = content.replace(old_tabstrip, new_tabstrip)

# 4. Update Toolbar next to Go with Maximize icon
old_toolbar_go = '''            <button class="primary-btn" style="padding: 7px 16px; font-size: 11.5px; background: #1a73e8; border-radius: 18px;" onclick="executeChromiumGo()">
              Go
            </button>
          </div>'''

new_toolbar_go = '''            <button class="primary-btn" style="padding: 7px 16px; font-size: 11.5px; background: #1a73e8; border-radius: 18px;" onclick="executeChromiumGo()">
              Go
            </button>
            <button class="chromium-nav-btn" title="Toggle Full Screen (Esc to exit)" onclick="toggleSandboxFullscreen()"><i data-lucide="maximize-2" style="width: 14px;"></i></button>
          </div>'''

content = content.replace(old_toolbar_go, new_toolbar_go)

# 5. Add JavaScript Fullscreen toggle logic
fullscreen_js = '''
    function toggleSandboxFullscreen() {
      const frame = document.querySelector('.chromium-browser-frame');
      if (!frame) return;

      const isFull = frame.classList.toggle('is-fullscreen');

      const txt1 = document.getElementById('txt-toggle-fullscreen');
      const txt2 = document.getElementById('txt-card-fullscreen');
      if (txt1) txt1.innerText = isFull ? 'Exit Full Screen' : 'Full Screen';
      if (txt2) txt2.innerText = isFull ? '🗗 Exit Full Screen' : '⛶ Full Screen Sandbox';

      if (isFull) {
        if (frame.requestFullscreen) {
          frame.requestFullscreen().catch(() => {});
        } else if (frame.webkitRequestFullscreen) {
          frame.webkitRequestFullscreen();
        }
      } else {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }

      if (window.lucide) lucide.createIcons();
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const frame = document.querySelector('.chromium-browser-frame');
        if (frame && frame.classList.contains('is-fullscreen')) {
          toggleSandboxFullscreen();
        }
      }
    });

    document.addEventListener('fullscreenchange', function() {
      const frame = document.querySelector('.chromium-browser-frame');
      if (!document.fullscreenElement && frame && frame.classList.contains('is-fullscreen')) {
        frame.classList.remove('is-fullscreen');
        const txt1 = document.getElementById('txt-toggle-fullscreen');
        const txt2 = document.getElementById('txt-card-fullscreen');
        if (txt1) txt1.innerText = 'Full Screen';
        if (txt2) txt2.innerText = '⛶ Full Screen Sandbox';
        if (window.lucide) lucide.createIcons();
      }
    });
'''

content = content.replace(
    'function loadChromiumWelcome() {',
    fullscreen_js.strip() + '\n\n    function loadChromiumWelcome() {'
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

print('Full Screen Sandbox functionality successfully installed!')
