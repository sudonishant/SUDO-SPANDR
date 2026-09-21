#!/usr/bin/env python3
"""
SUDO SPANDR SentinelMail — SIH Final Round 3 Quick Patch
Executes the rapid fix for the NLP Deception Findings display
as planned after judges give feedback in Rounds 1 & 2.
"""
import re
import os
import subprocess

print("=======================================================")
print("  SUDO SPANDR SentinelMail — Round 3 NLP Hotfix Patch  ")
print("=======================================================")

index_file = "index.html"
with open(index_file, "r", encoding="utf-8") as f:
    content = f.read()

target = r"""            ${(p.findings || []).map(f => `
              <div style="margin-top: 4px; font-size: 11px; line-height: 1.5;">
                <strong style="color: #60a5fa;">${f.category}:</strong>
                <span style="color: #cbd5e1;"> ${f.expl_en}</span><br>
                <span style="color: #94a3b8; font-style: italic;">👉 ${f.expl_hi}</span>
              </div>
            `).join('')}"""

replacement = r"""            ${(p.findings || []).map(f => {
              const category = f.category || 'Deceptive Psychological Pattern';
              const explEn = f.expl_en || f.description || f.evidence || (f.matched_snippets && f.matched_snippets.length > 0 ? `Observed indicator keywords: "${f.matched_snippets.join(', ')}"` : 'Deceptive persuasion technique observed in paragraph context.');
              const explHi = f.expl_hi || 'हमलावर द्वारा संदिग्ध भाषा और हेरफेर रणनीति का प्रयोग किया गया है। स्वतंत्र पुष्टि आवश्यक है।';
              return `
                <div style="margin-top: 4px; font-size: 11px; line-height: 1.5;">
                  <strong style="color: #60a5fa;">${category}:</strong>
                  <span style="color: #cbd5e1;"> ${explEn}</span><br>
                  <span style="color: #94a3b8; font-style: italic;">👉 ${explHi}</span>
                </div>
              `;
            }).join('')}"""

if target in content:
    content = content.replace(target, replacement, 1)
    with open(index_file, "w", encoding="utf-8") as f:
        f.write(content)
    print("✓ Successfully patched index.html for NLP Deception Findings!")

    # Synchronize static_index.py
    with open("backend/app/static_index.py", "w", encoding="utf-8") as f:
        f.write('HTML_CONTENT = r"""' + content + '"""\n')
    print("✓ Synchronized backend/app/static_index.py!")

    # Rebuild dist bundle
    subprocess.run(["npm", "run", "build"], check=True)
    print("✓ Rebuilt dist/ bundle for Vercel deployment!")

    print("\n[SUCCESS] Hotfix complete! Judges feedback implemented in seconds.")
    print("You can also trigger it instantly in the browser with: Ctrl + Shift + P")
else:
    print("[INFO] Target snippet already patched or modified.")
