import os, re

# ==========================================================
# 🛡️ REBRANDING ENGINE: "Cyber Squad" -> "SUDO SPANDR"
# ==========================================================

root = '.'

# Core active web files
web_files = [
    'index.html',
    'backend/app/static_index.py',
    'backend/app/config.py',
    'backend/app/main.py',
    'backend/app/core/web_sandbox_engine.py',
    'backend/app/core/openrouter_client.py',
    'backend/app/core/supabase_engine.py',
    'backend/app/core/blockchain_ledger.py',
    'backend/app/core/neo4j_engine.py',
    'api/v1/sandbox/preview-frame.js',
    'api/v1/ai-review.js',
    'package.json',
    'package-lock.json',
    'wrangler.json',
    'README.md',
    'start_all.sh',
    'start_docker_sandbox.sh',
    'start_full_linux_desktop.sh'
]

def replace_in_file(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original = content

    # 1. Exact case variations of CYBER SQUAD / Cyber Squad / CyberSquad
    content = content.replace("CYBER SQUAD", "SUDO SPANDR")
    content = content.replace("Cyber Squad", "SUDO SPANDR")
    content = content.replace("cyber squad", "sudo spandr")
    content = content.replace("CyberSquad", "SUDO SPANDR")
    content = content.replace("cybersquad", "sudospandr")
    content = content.replace("CYBERSQUAD", "SUDO_SPANDR")

    # 2. Fix specific composite identifiers
    content = content.replace("SUDO SPANDR-ThreatSearch", "SUDO-SPANDR-ThreatSearch")
    content = content.replace("SUDO SPANDR-Sandbox", "SUDO-SPANDR-Sandbox")
    content = content.replace("sudospandr-web-frontend", "sudo-spandr-web-frontend")
    content = content.replace("sudospandr-web", "sudo-spandr-web")
    content = content.replace("audit@sudospandr.gov.in", "audit@sudospandr.gov.in")
    content = content.replace("test.user@sudospandr.gov.in", "test.user@sudospandr.gov.in")
    content = content.replace("test.analyst@sudospandr.gov.in", "test.analyst@sudospandr.gov.in")

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {filepath}")

for rel in web_files:
    replace_in_file(os.path.join(root, rel))

# Ensure index.html and static_index.py stay in exact sync
with open(os.path.join(root, 'backend/app/static_index.py'), 'r', encoding='utf-8') as f:
    si = f.read()

pure_html = si
if pure_html.startswith('HTML_CONTENT = r"""'):
    pure_html = pure_html[len('HTML_CONTENT = r"""'):]
elif pure_html.startswith('HTML_CONTENT = """'):
    pure_html = pure_html[len('HTML_CONTENT = """'):]

if pure_html.endswith('"""\n'):
    pure_html = pure_html[:-4]
elif pure_html.endswith('"""'):
    pure_html = pure_html[:-3]

with open(os.path.join(root, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(pure_html.strip() + '\n')

print("Sync completed for index.html and static_index.py!")
