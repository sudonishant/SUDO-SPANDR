import subprocess, time, re, sys, os, qrcode, io, socket

print("🚀 Starting all SentinelMail Services...")

# Clean old locks and processes
os.system("rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true")
os.system("pkill -9 -f 'Xtightvnc' 2>/dev/null || true")
os.system("pkill -9 -f 'websockify' 2>/dev/null || true")
os.system("pkill -9 -f 'uvicorn' 2>/dev/null || true")
os.system("pkill -9 -f 'cloudflared' 2>/dev/null || true")
os.system("pkill -9 -f 'start_sandbox_desktop' 2>/dev/null || true")
os.system("pkill -9 -f 'chromium.*cyber_sandbox' 2>/dev/null || true")

# 1. Start Xtightvnc
print("[1/4] Starting VNC Display :99...")
subprocess.Popen(["/usr/bin/Xtightvnc", ":99", "-geometry", "1280x720", "-depth", "24", "-rfbport", "5999", "-rfbauth", "/home/nee/.vnc/passwd", "-ac"],
                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

# 2. Start Desktop Environment
print("[2/4] Starting Isolated Chromium on :99...")
subprocess.Popen(["./start_sandbox_desktop.sh"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

# 3. Start Websockify on 7860
print("[3/4] Starting Websockify on 7860...")
subprocess.Popen(["websockify", "--web", "backend/novnc", "7860", "127.0.0.1:5999"],
                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

# 4. Start Uvicorn on 8000
print("[4/4] Starting SentinelMail Dashboard on 8000...")
subprocess.Popen(["python3", "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"],
                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2)

# 5. Start Cloudflare Tunnel on 8000
print("Connecting Cloudflare Secure Tunnel...")
env = dict(os.environ)
env['GODEBUG'] = 'netdns=go'
cf_proc = subprocess.Popen(["/tmp/cloudflared", "--edge-ip-version", "4", "tunnel", "--url", "http://127.0.0.1:8000"],
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)

tunnel_url = None
for _ in range(40):
    line = cf_proc.stdout.readline()
    if not line:
        break
    m = re.search(r'https://[a-zA-Z0-9.-]+\.trycloudflare\.com', line)
    if m:
        tunnel_url = m.group(0)
        break

# Get Local IP
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(('8.8.8.8', 80))
    local_ip = s.getsockname()[0]
except Exception:
    local_ip = '10.127.239.68'
finally:
    s.close()

local_url = f"http://{local_ip}:8000"

print("\n" + "="*70)
print("🎉 100% LIVE! CHAL RAHA HAI! PHONE ME OPEN KAREIN:")
print("="*70)
if tunnel_url:
    print(f"🌍 PUBLIC LINK (Open Anywhere on Mobile Data 4G/5G / Wi-Fi):")
    print(f"👉  {tunnel_url}")
    print(f"🖥️  DIRECT NOVNC DESKTOP TAB / FULLSCREEN:")
    print(f"👉  {tunnel_url}/novnc/vnc.html?path=websockify&autoconnect=true&password=cybersqu&resize=remote&quality=8&compression=0&reconnect=true")
    with open('/tmp/active_phone_link.txt', 'w') as f:
        f.write(tunnel_url)
print("-" * 70)
print(f"🏠 SAME WI-FI / HOTSPOT LINK:")
print(f"👉  {local_url}")
print("="*70 + "\n")

if tunnel_url:
    print("📱 SCAN THIS QR CODE WITH YOUR PHONE CAMERA TO OPEN INSTANTLY:\n")
    qr = qrcode.QRCode()
    qr.add_data(tunnel_url)
    f = io.StringIO()
    qr.print_ascii(out=f, invert=True)
    f.seek(0)
    print(f.read())
    print("="*70)

cf_proc.wait()
