#!/bin/bash
export DISPLAY=:99

# Clean locks
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true
rm -rf /tmp/vnc_chromium/Singleton* 2>/dev/null || true

# Launch Window Manager
xfwm4 --replace >/dev/null 2>&1 &

# High-Performance Chromium Supervisor Loop
while true; do
    if ! pgrep -f "chromium.*vnc_chromium" > /dev/null; then
        echo "Launching Optimized Zero-Lag Chromium on :99..."
        chromium \
            --no-sandbox \
            --user-data-dir=/tmp/vnc_chromium \
            --disable-gpu \
            --disable-software-rasterizer \
            --disable-dev-shm-usage \
            --disable-background-timer-throttling \
            --disable-backgrounding-occluded-windows \
            --disable-renderer-backgrounding \
            --num-raster-threads=4 \
            --window-size=1280,720 \
            --window-position=0,0 \
            --start-maximized \
            "https://www.google.com" \
            "https://mail.google.com" >/tmp/vnc_chrome_runner.log 2>&1
    fi
    sleep 2
done
