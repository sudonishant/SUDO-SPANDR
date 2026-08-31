#!/bin/bash
export DISPLAY=:99
export HOME=/tmp/vnc_sandbox_home
export USER=cyberuser

mkdir -p /tmp/vnc_sandbox_home/Desktop
mkdir -p /tmp/vnc_sandbox_home/.config/xfce4
mkdir -p /tmp/cyber_sandbox/browser_data

# Create Cyber Squad Wallpaper if not exists
python3 -c "
from PIL import Image, ImageDraw, ImageFont
img = Image.new('RGB', (1280, 720), color=(10, 15, 29))
draw = ImageDraw.Draw(img)

# Cyber Grid
for x in range(0, 1280, 40):
    draw.line([(x, 0), (x, 720)], fill=(18, 28, 52), width=1)
for y in range(0, 720, 40):
    draw.line([(0, y), (1280, y)], fill=(18, 28, 52), width=1)

draw.rectangle([400, 240, 880, 440], fill=(13, 22, 42), outline=(56, 189, 248), width=2)
draw.text((440, 280), 'CYBER SQUAD SENTINELMAIL', fill=(56, 189, 248))
draw.text((440, 320), 'AIR-GAPPED VIRTUAL DETONATION SANDBOX', fill=(148, 163, 184))
draw.text((440, 360), 'STATUS: ISOLATED GUEST LINUX DESKTOP', fill=(34, 197, 94))
img.save('/tmp/sandbox_wallpaper.png')
" 2>/dev/null || true

# Clean old desktop processes
pkill -9 -f "xfdesktop" 2>/dev/null || true
pkill -9 -f "xfce4-panel" 2>/dev/null || true
pkill -9 -f "xfwm4" 2>/dev/null || true
pkill -9 -f "chromium.*cyber_sandbox" 2>/dev/null || true

# Desktop Shortcuts
cat << 'D1' > /tmp/vnc_sandbox_home/Desktop/Terminal.desktop
[Desktop Entry]
Version=1.0
Type=Application
Name=Terminal (Root/Sandbox)
Comment=Isolated Shell Terminal
Exec=qterminal
Icon=utilities-terminal
Terminal=false
StartupNotify=true
D1

cat << 'D2' > /tmp/vnc_sandbox_home/Desktop/FileManager.desktop
[Desktop Entry]
Version=1.0
Type=Application
Name=File Manager
Comment=Explore Sandbox Files
Exec=thunar /tmp/vnc_sandbox_home
Icon=system-file-manager
Terminal=false
StartupNotify=true
D2

cat << 'D3' > /tmp/vnc_sandbox_home/Desktop/SentinelMail.desktop
[Desktop Entry]
Version=1.0
Type=Application
Name=SentinelMail SOC Portal
Comment=Email Forensic Triage
Exec=chromium --user-data-dir=/tmp/cyber_sandbox/browser_data --app=http://127.0.0.1:8000
Icon=applications-internet
Terminal=false
StartupNotify=true
D3

cat << 'D4' > /tmp/vnc_sandbox_home/Desktop/Gmail.desktop
[Desktop Entry]
Version=1.0
Type=Application
Name=Gmail Webmail
Comment=Safe Detonation Email
Exec=chromium --user-data-dir=/tmp/cyber_sandbox/browser_data --app=https://mail.google.com
Icon=mail-client
Terminal=false
StartupNotify=true
D4

cat << 'D5' > /tmp/vnc_sandbox_home/Desktop/VirusTotal.desktop
[Desktop Entry]
Version=1.0
Type=Application
Name=VirusTotal Scanner
Comment=URL & Hash Reputation
Exec=chromium --user-data-dir=/tmp/cyber_sandbox/browser_data --app=https://www.virustotal.com
Icon=security-high
Terminal=false
StartupNotify=true
D5

chmod +x /tmp/vnc_sandbox_home/Desktop/*.desktop

# 1. Start Window Manager
xfwm4 --display=:99 --replace >/dev/null 2>&1 &
sleep 1

# 2. Start Desktop Manager (xfdesktop)
xfdesktop --display=:99 >/dev/null 2>&1 &
sleep 1

# 3. Start Panel / Taskbar (xfce4-panel)
xfce4-panel --display=:99 >/dev/null 2>&1 &
sleep 1

# 4. Start Chromium in window mode (not covering entire screen so taskbar & desktop icons are visible!)
chromium \
    --no-sandbox \
    --user-data-dir=/tmp/cyber_sandbox/browser_data \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-dev-shm-usage \
    --window-size=1000,600 \
    --window-position=140,50 \
    "http://127.0.0.1:8000" >/dev/null 2>&1 &

echo "Full Linux Desktop Started on :99"
