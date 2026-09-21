#!/bin/bash
export DISPLAY=:99
export HOME=/tmp/vnc_sandbox_home
export USER=cyberuser

# Clean old chromium & wm
pkill -9 -f "chromium" 2>/dev/null || true
pkill -9 -f "xfwm4" 2>/dev/null || true

# Start Window Manager
xfwm4 --display=:99 --replace >/dev/null 2>&1 &
sleep 1

# Launch Chromium Pristine
chromium \
    --no-sandbox \
    --test-type \
    --user-data-dir=/tmp/cyber_sandbox/browser_data \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-dev-shm-usage \
    --hide-crash-restore-bubble \
    --no-first-run \
    --no-default-browser-check \
    --disable-session-crashed-bubble \
    --window-size=1260,700 \
    --window-position=10,10 \
    "http://127.0.0.1:8000" \
    "https://mail.google.com" \
    "https://www.virustotal.com" >/dev/null 2>&1 &

echo "Clean Detonation Desktop Started"
