with open('backend/app/static_index.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the inner script block in renderSimulatedWebPortal
old_portal_form = '''    <form id="sandbox-login-form">
      <div class="input-group">
        <label>Email, Phone, or Username</label>
        <input type="text" id="user-input" placeholder="e.g. analyst@cybersquad.gov.in" required value="test.user@company.com">
      </div>
      <div class="input-group">
        <label>Password</label>
        <input type="password" id="pass-input" placeholder="Enter test password..." required value="Password123!">
      </div>
      <button type="submit" class="submit-btn">Sign In / Continue</button>
    </form>

    <p class="footer-note">
      🔒 <strong>Air-Gap Security:</strong> Credentials entered here are trapped safely in the in-memory honeypot vault and will NEVER be transmitted to external servers.
    </p>
  </div>

  <script>
    document.getElementById('sandbox-login-form').addEventListener('submit', function(e) {
      e.preventDefault();
      const userVal = document.getElementById('user-input').value;
      const passVal = document.getElementById('pass-input').value;
      
      try {
        window.parent.postMessage({
          type: 'SANDBOX_LOGIN_CAPTURED',
          username: userVal,
          hasPassword: true,
          action: '${targetUrl}'
        }, '*');
      } catch(err) {}

      alert('🛡️ SANDBOX LOGIN INTERCEPTED!\\n\\nAccount: ' + userVal + '\\nPassword: [••••••••]\\n\\nCredentials trapped safely in CyberSquad Air-Gap Honeypot Vault without leaking to external servers.');
    });
  </script>
</body>
</html>`;'''

new_portal_form = '''    <form id="sandbox-login-form" onsubmit="event.preventDefault(); const u = document.getElementById('user-input').value; window.parent.postMessage({type:'SANDBOX_LOGIN_CAPTURED', username: u, hasPassword: true, action: '${targetUrl}'}, '*'); alert('🛡️ SANDBOX LOGIN INTERCEPTED!\\n\\nAccount: ' + u + '\\nPassword: [••••••••]\\n\\nCredentials trapped safely in CyberSquad Air-Gap Honeypot Vault.');">
      <div class="input-group">
        <label>Email, Phone, or Username</label>
        <input type="text" id="user-input" placeholder="e.g. analyst@cybersquad.gov.in" required value="test.user@company.com">
      </div>
      <div class="input-group">
        <label>Password</label>
        <input type="password" id="pass-input" placeholder="Enter test password..." required value="Password123!">
      </div>
      <button type="submit" class="submit-btn">Sign In / Continue</button>
    </form>

    <p class="footer-note">
      🔒 <strong>Air-Gap Security:</strong> Credentials entered here are trapped safely in the in-memory honeypot vault and will NEVER be transmitted to external servers.
    </p>
  </div>
</body>
</html>`;'''

content = content.replace(old_portal_form, new_portal_form)

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

print('Inner script tag completely eliminated from string templates!')
