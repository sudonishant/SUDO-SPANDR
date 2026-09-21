import re

with open('backend/app/static_index.py', 'r') as f:
    content = f.read()

# Update media query in static_index.py
mobile_css_replacement = '''
    /* Mobile-First Master Column & Grid Rules */
    @media (max-width: 680px) {
      .header-wrap { padding: 10px 12px !important; }
      .header-meta { display: none !important; }
      .main-wrap { padding: 10px 10px 30px !important; }
      
      /* Mode Bar: 2-Column Responsive Grid on Mobile for fast finger taps */
      .mode-bar {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 6px !important;
        padding: 6px !important;
        margin-bottom: 14px !important;
        background: rgba(15, 23, 42, 0.85) !important;
      }
      .mode-tab {
        width: 100% !important;
        min-width: 0 !important;
        padding: 11px 8px !important;
        font-size: 11.5px !important;
        justify-content: center !important;
        border-radius: 8px !important;
      }
      
      /* Navigation Tabs: 3-Column Touch Chip Grid on Mobile */
      .nav-tabs {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 4px !important;
        border-bottom: none !important;
        margin-bottom: 12px !important;
        padding-bottom: 0 !important;
      }
      .nav-tab {
        width: 100% !important;
        justify-content: center !important;
        padding: 9px 4px !important;
        font-size: 10.5px !important;
        border-radius: 8px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        background: rgba(15, 23, 42, 0.6) !important;
        text-align: center !important;
      }
      .nav-tab.active {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.35), rgba(37, 99, 235, 0.25)) !important;
        border-color: rgba(59, 130, 246, 0.7) !important;
        color: #93c5fd !important;
      }
      
      .card { padding: 12px 10px !important; border-radius: 12px !important; margin-bottom: 10px !important; }
      .dropzone-box { padding: 24px 12px !important; border-radius: 14px !important; }
      .dropzone-box i { width: 36px !important; height: 36px !important; }
      
      .sandbox-ctrl-row { flex-direction: column !important; }
      .sandbox-ctrl-row button { width: 100% !important; }
      
      .result-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
      #map-container { height: 260px !important; }
      
      .dossier-sign-row { flex-direction: column !important; gap: 14px !important; }
      .dossier-sign-row > div:last-child { text-align: left !important; }
    }
'''

content = re.sub(r'/\* Mobile-First Master Responsive Rules \*/[\s\S]*?/\* Map & Graph Containers \*/', mobile_css_replacement + '\n    /* Map & Graph Containers */', content)

# Write to static_index.py and clean root index.html
with open('backend/app/static_index.py', 'w') as f:
    f.write(content)

# Extract pure HTML for index.html without Python wrapper
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

print('Mobile Column / Grid Layout applied to mode-tabs and nav-tabs successfully!')
