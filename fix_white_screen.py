import re

with open('backend/app/static_index.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the white viewport box and white iframe with dark themed iframe with embedded default home srcdoc
old_viewport = '''          <!-- EMBEDDED SANDBOXED VIEWPORT -->
          <div id="sandbox-viewport-box" style="height: 620px; position: relative; background: #fff;">
            <iframe id="web-sandbox-iframe" style="width: 100%; height: 100%; border: none; background: #fff;" sandbox="allow-same-origin allow-forms allow-scripts"></iframe>
          </div>'''

new_viewport = '''          <!-- EMBEDDED SANDBOXED VIEWPORT -->
          <div id="sandbox-viewport-box" style="height: 620px; position: relative; background: #090d16;">
            <iframe id="web-sandbox-iframe" style="width: 100%; height: 100%; border: none; background: #090d16;" sandbox="allow-same-origin allow-forms allow-scripts" srcdoc="&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;head&gt;&lt;meta charset='utf-8'&gt;&lt;meta name='viewport' content='width=device-width, initial-scale=1.0'&gt;&lt;title&gt;Virtual PC Desktop&lt;/title&gt;&lt;style&gt;*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}body{background:radial-gradient(circle at 50% 20%,#1e293b,#030712);color:#f8fafc;min-height:100vh;padding:28px 16px;text-align:center;}.brand-title{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;letter-spacing:-0.5px;}.brand-sub{font-size:11px;color:#38bdf8;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:20px;}.search-box-wrap{max-width:540px;margin:0 auto 24px;position:relative;display:flex;}.search-input{width:100%;padding:12px 18px 12px 42px;border-radius:24px 0 0 24px;border:1px solid #38bdf8;background:rgba(15,23,42,0.9);color:#fff;font-size:13.5px;outline:none;box-shadow:0 4px 20px rgba(56,189,248,0.2);}.search-btn{background:#2563eb;color:#fff;border:none;padding:0 22px;border-radius:0 24px 24px 0;font-weight:700;font-size:13px;cursor:pointer;}.search-icon{position:absolute;left:15px;top:12px;font-size:15px;}.apps-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;max-width:620px;margin:0 auto 24px;}.app-card{background:rgba(30,41,59,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 10px;cursor:pointer;transition:all 0.2s ease;text-align:center;}.app-card:hover{transform:translateY(-3px);border-color:#38bdf8;background:rgba(56,189,248,0.15);box-shadow:0 8px 24px rgba(0,0,0,0.6);}.app-icon{font-size:28px;margin-bottom:6px;}.app-name{font-size:12px;font-weight:700;color:#fff;margin-bottom:2px;}.app-meta{font-size:10px;color:#94a3b8;}.live-status-bar{background:rgba(15,23,42,0.7);border:1px solid #334155;border-radius:8px;padding:8px 14px;max-width:620px;margin:0 auto;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;}&lt;/style&gt;&lt;/head&gt;&lt;body&gt;&lt;div class='brand-title'&gt;🛡️ CyberSquad Virtual PC Browser&lt;/div&gt;&lt;div class='brand-sub'&gt;Isolated Chromium Subsystem · 100% Air-Gapped Sandbox&lt;/div&gt;&lt;form class='search-box-wrap' onsubmit='event.preventDefault();const q=document.getElementById(&quot;home-search&quot;).value;window.parent.postMessage({type:&quot;PARENT_SET_AND_DETONATE&quot;,url:q},&quot;*&quot;);'&gt;&lt;span class='search-icon'&gt;🔍&lt;/span&gt;&lt;input type='text' id='home-search' class='search-input' placeholder='Search Google or enter email login URL to test in sandbox...'&gt;&lt;button type='submit' class='search-btn'&gt;Detonate&lt;/button&gt;&lt;/form&gt;&lt;div class='apps-grid'&gt;&lt;div class='app-card' onclick='window.parent.postMessage({type:&quot;PARENT_SET_AND_DETONATE&quot;,url:&quot;https://accounts.google.com&quot;},&quot;*&quot;)'&gt;&lt;div class='app-icon'&gt;📧&lt;/div&gt;&lt;div class='app-name'&gt;Google / Gmail&lt;/div&gt;&lt;div class='app-meta'&gt;Test Email Login&lt;/div&gt;&lt;/div&gt;&lt;div class='app-card' onclick='window.parent.postMessage({type:&quot;PARENT_SET_AND_DETONATE&quot;,url:&quot;https://login.live.com&quot;},&quot;*&quot;)'&gt;&lt;div class='app-icon'&gt;💼&lt;/div&gt;&lt;div class='app-name'&gt;Outlook 365&lt;/div&gt;&lt;div class='app-meta'&gt;Microsoft Webmail&lt;/div&gt;&lt;/div&gt;&lt;div class='app-card' onclick='window.parent.postMessage({type:&quot;PARENT_SET_AND_DETONATE&quot;,url:&quot;sbi netbanking phishing login&quot;},&quot;*&quot;)'&gt;&lt;div class='app-icon'&gt;🏦&lt;/div&gt;&lt;div class='app-name'&gt;SBI NetBanking&lt;/div&gt;&lt;div class='app-meta'&gt;Phish Trap Test&lt;/div&gt;&lt;/div&gt;&lt;div class='app-card' onclick='window.parent.postMessage({type:&quot;PARENT_TRIGGER_FILE_OPEN&quot;},&quot;*&quot;)'&gt;&lt;div class='app-icon'&gt;📂&lt;/div&gt;&lt;div class='app-name'&gt;Inspect File&lt;/div&gt;&lt;div class='app-meta'&gt;PDF, HTML, Code, Image&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;&lt;div class='live-status-bar'&gt;&lt;span&gt;● Air-Gap Memory Guard Active&lt;/span&gt;&lt;span style='color:#34d399;'&gt;CPU: 1% · RAM: 280MB&lt;/span&gt;&lt;span&gt;Zero-Leak Container&lt;/span&gt;&lt;/div&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>
          </div>'''

content = content.replace(old_viewport, new_viewport)

# In loadVirtualPCHomepage and renderSimulatedWebPortal, use removeAttribute('src') instead of assigning empty string
content = content.replace(
    "iframe.src = '';\n      iframe.srcdoc =",
    "iframe.removeAttribute('src');\n      iframe.srcdoc ="
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

print('Successfully removed background: #fff and embedded default home srcdoc directly in iframe markup!')
