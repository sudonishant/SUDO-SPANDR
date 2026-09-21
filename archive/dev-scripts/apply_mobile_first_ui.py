import re

with open('backend/app/static_index.py', 'r') as f:
    content = f.read()

# Enhance Meta tags for Mobile Web App & PWA
mobile_meta = '''<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <meta name="theme-color" content="#030712">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="description" content="Cyber Squad - Next-Gen Email Forensic Ecosystem & In-App Threat Sandbox">
  <title>Cyber Squad - Forensic Analyst Dashboard</title>'''

content = re.sub(r'<!doctype html>[\s\S]*?<title>Cyber Squad - Forensic Analyst Dashboard</title>', mobile_meta, content)

# Inject Mobile-First Master CSS
mobile_master_css = '''
    /* Mobile-First Master Responsive Rules */
    @media (max-width: 680px) {
      .header-wrap { padding: 10px 12px !important; }
      .header-meta { display: none !important; }
      .main-wrap { padding: 10px 10px 30px !important; }
      
      .mode-bar { gap: 4px !important; padding: 4px !important; margin-bottom: 12px !important; }
      .mode-tab { min-width: 95px !important; padding: 8px 8px !important; font-size: 11px !important; }
      
      .card { padding: 12px 10px !important; border-radius: 12px !important; margin-bottom: 10px !important; }
      .dropzone-box { padding: 24px 12px !important; border-radius: 14px !important; }
      .dropzone-box i { width: 36px !important; height: 36px !important; }
      
      .sandbox-ctrl-row { flex-direction: column !important; }
      .sandbox-ctrl-row button { width: 100% !important; }
      
      .nav-tabs { gap: 3px !important; padding-bottom: 4px !important; }
      .nav-tab { padding: 7px 9px !important; font-size: 11px !important; }
      
      .result-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
      #map-container { height: 260px !important; }
      
      .dossier-sign-row { flex-direction: column !important; gap: 14px !important; }
      .dossier-sign-row > div:last-child { text-align: left !important; }
    }
'''

content = content.replace('</style>', mobile_master_css + '\n  </style>')

# Ensure touch inputs in sandbox control bar are responsive
content = content.replace(
    '<div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">',
    '<div class="sandbox-ctrl-row" style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">'
)

# Write to static_index.py and root index.html
with open('backend/app/static_index.py', 'w') as f:
    f.write(content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Mobile-First UI & Touch Optimizations successfully applied!')
