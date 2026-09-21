import subprocess, time, re, sys, qrcode, io

print("🚀 Creating Public HTTPS Tunnel for SentinelMail & noVNC Desktop...")
cmd = ['ssh', '-o', 'StrictHostKeyChecking=no', '-R', '80:127.0.0.1:8000', 'serveo.net']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

url = None
for _ in range(30):
    line = proc.stdout.readline()
    if not line:
        break
    m = re.search(r'https://[a-zA-Z0-9.-]+\.serveousercontent\.com', line)
    if m:
        url = m.group(0)
        break

if url:
    print("\n" + "="*62)
    print("🌍 100% LIVE PUBLIC INTERNET LINK (Accessible from Anywhere):")
    print(f"👉  {url}")
    print("="*62 + "\n")
    print("📱 SCAN THIS QR CODE ON ANY PHONE / MOBILE DATA:\n")
    qr = qrcode.QRCode()
    qr.add_data(url)
    f = io.StringIO()
    qr.print_ascii(out=f, invert=True)
    f.seek(0)
    print(f.read())
    print("="*62)
    print("Keep this script running while using the public link.")
    proc.wait()
else:
    print("Could not retrieve URL automatically.")
