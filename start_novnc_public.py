import subprocess, time, re, sys, qrcode, io

print("🚀 Creating Direct Public HTTPS URL for noVNC Virtual Desktop...")
cmd = ['ssh', '-o', 'StrictHostKeyChecking=no', '-R', '80:127.0.0.1:7860', 'serveo.net']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

url = None
for _ in range(30):
    line = proc.stdout.readline()
    if not line:
        break
    m = re.search(r'https://[a-zA-Z0-9.-]+\.serveousercontent\.com', line)
    if m:
        raw_url = m.group(0)
        url = f"{raw_url}/vnc.html?autoconnect=true&password=cybersqu&resize=remote&quality=8&compression=0&reconnect=true"
        break

if url:
    print("\n" + "="*68)
    print("🌍 100% DIRECT PUBLIC VIRTUAL DESKTOP LINK (Opens Desktop on Phone):")
    print(f"👉  {url}")
    print("="*68 + "\n")
    print("📱 SCAN THIS QR CODE ON ANY PHONE CAMERA:\n")
    qr = qrcode.QRCode()
    qr.add_data(url)
    f = io.StringIO()
    qr.print_ascii(out=f, invert=True)
    f.seek(0)
    print(f.read())
    print("="*68)
    proc.wait()
