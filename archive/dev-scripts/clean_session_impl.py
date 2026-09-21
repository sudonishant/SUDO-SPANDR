import re

with open('backend/app/static_index.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Clean zero-script-tag Logged-In Webmail Dashboard
clean_session_js = '''
    function renderChromiumLoggedInSession(userEmail) {
      const iframe = document.getElementById('web-sandbox-iframe');
      const input = document.getElementById('chromium-url-input');
      const tabText = document.getElementById('chromium-tab-text');
      const email = userEmail || 'sudonishant@gmail.com';
      const initial = email.charAt(0).toUpperCase();

      if (input) input.value = 'https://mail.google.com/mail/u/0/#inbox';
      if (tabText) tabText.innerText = `Inbox (${email})`;
      if (!iframe) return;

      iframe.removeAttribute('src');
      iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gmail - Inbox (${email})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { background: #202124; color: #e8eaed; min-height: 100vh; display: flex; flex-direction: column; }
    
    .header { background: #292a2d; border-bottom: 1px solid #3c4043; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
    .brand { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 700; color: #fff; }
    .brand-tag { font-size: 10px; background: #3c4043; color: #8ab4f8; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
    
    .search-bar { flex: 1; max-width: 550px; position: relative; }
    .search-inp { width: 100%; background: #303134; border: 1px solid #5f6368; border-radius: 20px; padding: 8px 16px 8px 36px; color: #fff; font-size: 13px; outline: none; }
    .search-icon { position: absolute; left: 12px; top: 8px; font-size: 14px; color: #9aa0a6; }
    
    .profile-area { display: flex; align-items: center; gap: 10px; font-size: 12px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: #1a73e8; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
    .signout-btn { background: #3c4043; color: #f28b82; border: 1px solid #5f6368; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600; }
    .signout-btn:hover { background: #4a4d52; }

    .main-body { display: flex; flex: 1; overflow: hidden; }
    .sidebar { width: 220px; background: #202124; border-right: 1px solid #3c4043; padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; }
    .compose-btn { background: #c2e7ff; color: #001d35; font-weight: 700; border: none; padding: 12px 18px; border-radius: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 12px; cursor: pointer; }
    .side-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-radius: 18px; font-size: 13px; color: #bdc1c6; cursor: pointer; }
    .side-item:hover { background: #292a2d; color: #fff; }
    .side-item.active { background: #394457; color: #8ab4f8; font-weight: 700; }
    .badge { background: #ea4335; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; }

    .email-container { flex: 1; background: #1e1f22; display: flex; flex-direction: column; overflow: auto; }
    .toolbar-row { padding: 10px 18px; background: #292a2d; border-bottom: 1px solid #3c4043; font-size: 12px; color: #9aa0a6; display: flex; align-items: center; justify-content: space-between; }
    
    .email-row { display: flex; align-items: center; padding: 12px 18px; border-bottom: 1px solid #2d2f34; cursor: pointer; transition: background 0.15s; font-size: 13px; gap: 14px; }
    .email-row:hover { background: #292a2d; }
    .email-row.unread { background: #25262a; font-weight: 700; color: #fff; }
    .email-sender { width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .email-subj { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .email-date { font-size: 11.5px; color: #9aa0a6; min-width: 65px; text-align: right; }
    .tag-danger { background: rgba(234,67,53,0.2); color: #f28b82; border: 1px solid rgba(234,67,53,0.5); padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 6px; font-weight: 700; }
    .tag-safe { background: rgba(129,201,149,0.2); color: #81c995; border: 1px solid rgba(129,201,149,0.5); padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 6px; font-weight: 700; }

    #email-detail { display: none; padding: 24px; background: #202124; flex: 1; overflow: auto; }
  </style>
</head>
<body>
  
  <div class="header">
    <div class="brand">
      <span style="color:#ea4335;">M</span>ail
      <span class="brand-tag">SANDBOXED SESSION</span>
    </div>

    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-inp" placeholder="Search in mail...">
    </div>

    <div class="profile-area">
      <div class="avatar">${initial}</div>
      <div style="text-align:left;">
        <strong style="display:block;color:#fff;">${email}</strong>
        <span style="color:#81c995;font-size:10px;">● Authenticated Session Active</span>
      </div>
      <button class="signout-btn" onclick="window.parent.postMessage({type:'CHROMIUM_AUTH_PAGE', url:'https://accounts.google.com'}, '*')">Sign Out</button>
    </div>
  </div>

  <div class="main-body">
    <div class="sidebar">
      <button class="compose-btn" onclick="alert('📝 New draft in isolated memory')">✏️ Compose</button>
      <div class="side-item active"><span>📥 Inbox</span><span class="badge">3</span></div>
      <div class="side-item"><span>⭐ Starred</span></div>
      <div class="side-item"><span>📤 Sent</span></div>
      <div class="side-item" style="color:#f28b82;"><span>🚨 Phishing Drills</span><span style="font-size:10px;background:#3c4043;padding:1px 6px;border-radius:6px;">2</span></div>
      <div class="side-item"><span>🗑️ Trash</span></div>
    </div>

    <div id="email-list" class="email-container">
      <div class="toolbar-row">
        <span>Primary Inbox (${email})</span>
        <span style="color:#8ab4f8;">Protected by CyberSquad Section 65B Sentinel</span>
      </div>

      <div class="email-row unread" onclick="document.getElementById('email-list').style.display='none'; document.getElementById('email-detail').style.display='block'; document.getElementById('det-title').innerText='Urgent: Immediate KYC Update Required to Avoid Account Freezing'; document.getElementById('det-from').innerText='State Bank KYC Alert <alert@onlinesbi-security-update.net>'; document.getElementById('det-date').innerText='10:45 AM (15 minutes ago)'; document.getElementById('det-body').innerText='Dear Valued Customer,\\\\n\\\\nYour NetBanking access will be suspended within 24 hours due to non-compliance with the latest RBI mandatory KYC guidelines.\\\\n\\\\nPlease click the secure link below to verify your Pan Card and NetBanking credentials immediately:\\\\n\\\\n👉 http://103.145.22.8/sbi/verify-kyc.php\\\\n\\\\nSincerely,\\\\nState Bank of India Online Security Operations';">
        <span style="color:#fbbc04;">★</span>
        <span class="email-sender" style="color:#f28b82;">SBI Security Desk</span>
        <span class="email-subj"><span class="tag-danger">PHISHING DRILL</span> Urgent: Immediate KYC Update Required to Avoid Account Freezing</span>
        <span class="email-date">10:45 AM</span>
      </div>

      <div class="email-row unread" onclick="document.getElementById('email-list').style.display='none'; document.getElementById('email-detail').style.display='block'; document.getElementById('det-title').innerText='Critical: Your Office 365 Password Expires in 24 Hours'; document.getElementById('det-from').innerText='Microsoft 365 Support <no-reply@m365-pass-recovery.com>'; document.getElementById('det-date').innerText='Yesterday, 4:18 PM'; document.getElementById('det-body').innerText='Hello ${email},\\\\n\\\\nYour corporate password for domain access will expire today. Keep your current password by verifying your credentials through our self-service portal:\\\\n\\\\n👉 https://login.microsoftonline.pass-recovery.site/auth\\\\n\\\\nIf you do not update, you will lose access to corporate Outlook, OneDrive, and Teams.';">
        <span style="color:#9aa0a6;">☆</span>
        <span class="email-sender" style="color:#f28b82;">Microsoft 365 Support</span>
        <span class="email-subj"><span class="tag-danger">CREDENTIAL HARVEST</span> Critical: Your Office 365 Password Expires in 24 Hours</span>
        <span class="email-date">Yesterday</span>
      </div>

      <div class="email-row" onclick="document.getElementById('email-list').style.display='none'; document.getElementById('email-detail').style.display='block'; document.getElementById('det-title').innerText='Section 65B Forensic Integrity Certificate #SEC-65B-2026-9418 Verified'; document.getElementById('det-from').innerText='CyberSquad SOC <audit@cybersquad.gov.in>'; document.getElementById('det-date').innerText='Aug 31, 2026, 09:15 AM'; document.getElementById('det-body').innerText='Honorable Investigator,\\\\n\\\\nThis electronic message certifies that forensic evidentiary extraction has been notarized under Section 65B of the Indian Evidence Act.\\\\n\\\\nSHA-256 Hash Drift: 0.00% (Bit-by-Bit Immutable Match).\\\\nConsortium Blockchain Ledger Consensus: Confirmed on Proof-of-Authority Notary Network.';">
        <span style="color:#fbbc04;">★</span>
        <span class="email-sender" style="color:#81c995;">CyberSquad SOC</span>
        <span class="email-subj"><span class="tag-safe">CERTIFIED SAFE</span> Section 65B Forensic Integrity Certificate #SEC-65B-2026-9418 Verified</span>
        <span class="email-date">Aug 31</span>
      </div>
    </div>

    <div id="email-detail">
      <button onclick="document.getElementById('email-list').style.display='flex'; document.getElementById('email-detail').style.display='none';" style="background:#303134;border:1px solid #5f6368;color:#e8eaed;padding:6px 14px;border-radius:6px;cursor:pointer;margin-bottom:16px;font-size:12px;">← Back to Inbox</button>
      <div style="border-bottom:1px solid #3c4043;padding-bottom:14px;margin-bottom:18px;">
        <h2 id="det-title" style="font-size:18px;color:#fff;margin-bottom:8px;"></h2>
        <div style="font-size:12.5px;color:#9aa0a6;line-height:1.6;">
          <div><strong>From:</strong> <span id="det-from"></span></div>
          <div><strong>To:</strong> <span>${email}</span></div>
          <div><strong>Date:</strong> <span id="det-date"></span></div>
        </div>
      </div>
      <div id="det-body" style="background:#292a2d;border:1px solid #3c4043;border-radius:10px;padding:20px;font-size:13.5px;line-height:1.7;color:#e8eaed;white-space:pre-wrap;"></div>
      <div style="margin-top:20px;">
        <button onclick="window.parent.postMessage({type:'TRANSFER_TO_ANALYZER', sender:document.getElementById('det-from').innerText, subject:document.getElementById('det-title').innerText, body:document.getElementById('det-body').innerText}, '*')" style="background:linear-gradient(135deg, #ef4444, #dc2626);color:#fff;border:none;padding:10px 18px;border-radius:6px;font-weight:700;font-size:12.5px;cursor:pointer;">
          ⚡ Send Email to CyberSquad Forensic Engine
        </button>
      </div>
    </div>
  </div>

</body>
</html>`;
    }
'''

# Replace old renderChromiumLoggedInSession up to renderChromiumAuthPage
content = re.sub(
    r'function renderChromiumLoggedInSession\(userEmail\) \{[\s\S]*?function renderChromiumAuthPage\(targetUrl\) \{',
    clean_session_js.strip() + '\n\n    function renderChromiumAuthPage(targetUrl) {',
    content
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

print('Clean zero-script-tag session successfully written!')
