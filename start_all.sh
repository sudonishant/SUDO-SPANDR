#!/bin/bash

echo "================================================================="
echo "🛡️  STARTING CYBER SQUAD SENTINELMAIL & VIRTUAL DESKTOP SANDBOX"
echo "================================================================="

# 1. Clean old locks
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true
pkill -9 -f "Xtightvnc" 2>/dev/null || true
pkill -9 -f "websockify" 2>/dev/null || true
pkill -9 -f "uvicorn" 2>/dev/null || true
pkill -9 -f "start_sandbox_desktop.sh" 2>/dev/null || true
pkill -9 -f "cloudflared" 2>/dev/null || true

# 2. Start Xtightvnc display :99
echo "[1/4] Starting VNC Display :99..."
/usr/bin/Xtightvnc :99 -geometry 1280x720 -depth 24 -rfbport 5999 -rfbauth /home/nee/.vnc/passwd -ac >/dev/null 2>&1 &
sleep 1

# 3. Start Chromium supervisor on :99
echo "[2/4] Starting Isolated Chromium & Window Manager on :99..."
./start_sandbox_desktop.sh >/dev/null 2>&1 &
sleep 1

# 4. Start Websockify on 7860
echo "[3/4] Starting noVNC Websockify on Port 7860..."
websockify --web backend/novnc 7860 127.0.0.1:5999 >/dev/null 2>&1 &
sleep 1

# 5. Start FastAPI Backend on 8000
echo "[4/4] Starting SentinelMail Dashboard on Port 8000..."
python3 -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 >/dev/null 2>&1 &
sleep 2

# 6. Start Cloudflare Tunnel for 100% permanent remote access
echo "Connecting Cloudflare Tunnel..."
GODEBUG=netdns=go /tmp/cloudflared --edge-ip-version 4 tunnel --url http://127.0.0.1:7860 > /tmp/cf_vnc.log 2>&1 &

sleep 6
TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' /tmp/cf_vnc.log | head -n 1)

echo ""
echo "================================================================="
echo "✅ EVERYTHING IS ONLINE & RUNNING!"
echo "================================================================="
echo "💻 Local Dashboard:     http://localhost:8000"
echo "🌐 Local LAN IP:        http://10.127.239.68:8000"
if [ -n "$TUNNEL_URL" ]; then
echo "📱 Phone / Public Link: ${TUNNEL_URL}/vnc.html?autoconnect=true&password=cybersqu&resize=remote&quality=8&compression=0&reconnect=true"
fi
echo "================================================================="
