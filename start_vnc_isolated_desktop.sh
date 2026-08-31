#!/bin/bash
export DISPLAY=:99
export VNC_HOME="/tmp/vnc_sandbox_home"
export HOME="$VNC_HOME"
export XDG_CONFIG_HOME="$VNC_HOME/.config"
export XDG_DATA_HOME="$VNC_HOME/.local/share"
export XDG_DESKTOP_DIR="$VNC_HOME/Desktop"

# Kill previous instances on :99
pkill -9 -f "start_full_linux_desktop.sh" 2>/dev/null || true
pkill -9 -f "chromium.*vnc_chromium" 2>/dev/null || true

# Start private isolated D-Bus daemon for display :99
DBUS_ADDR=$(dbus-daemon --session --fork --print-address)
export DBUS_SESSION_BUS_ADDRESS=$DBUS_ADDR

# Launch XFCE Window Manager, Desktop Manager, and Panel inside isolated VNC_HOME
xfsettingsd --display=:99 --replace >/dev/null 2>&1 &
xfwm4 --display=:99 --replace >/dev/null 2>&1 &
xfdesktop --display=:99 --replace >/dev/null 2>&1 &
xfce4-panel --display=:99 >/dev/null 2>&1 &

sleep 2

# Launch Chromium Browser inside the virtual PC
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
    --window-size=1200,660 \
    --window-position=40,30 \
    "https://www.google.com" \
    "https://mail.google.com" >/dev/null 2>&1 &

while true; do
    if ! pgrep -f "xfce4-panel.*display=:99" > /dev/null; then
        xfce4-panel --display=:99 >/dev/null 2>&1 &
    fi
    if ! pgrep -f "xfwm4.*display=:99" > /dev/null; then
        xfwm4 --display=:99 --replace >/dev/null 2>&1 &
    fi
    sleep 3
done
