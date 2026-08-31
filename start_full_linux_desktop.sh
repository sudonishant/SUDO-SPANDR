#!/bin/bash
export DISPLAY=:99

# Clean locks
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true
rm -rf /tmp/vnc_chromium/Singleton* 2>/dev/null || true

# Start private isolated D-Bus daemon for display :99
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ] || ! dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames >/dev/null 2>&1; then
    DBUS_ADDR=$(dbus-daemon --session --fork --print-address)
    export DBUS_SESSION_BUS_ADDRESS=$DBUS_ADDR
    echo "Private D-Bus initialized: $DBUS_SESSION_BUS_ADDRESS"
fi

# Launch complete XFCE desktop environment
xfsettingsd --display=:99 --replace >/dev/null 2>&1 &
xfwm4 --display=:99 --replace >/dev/null 2>&1 &
xfdesktop --display=:99 --replace >/dev/null 2>&1 &
xfce4-panel --display=:99 >/dev/null 2>&1 &

sleep 2

# Launch Chromium Browser with Google & Gmail
if ! pgrep -f "chromium.*vnc_chromium" > /dev/null; then
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
fi

# Keep background services alive
while true; do
    if ! pgrep -f "xfce4-panel.*display=:99" > /dev/null; then
        xfce4-panel --display=:99 >/dev/null 2>&1 &
    fi
    if ! pgrep -f "xfwm4.*display=:99" > /dev/null; then
        xfwm4 --display=:99 --replace >/dev/null 2>&1 &
    fi
    sleep 3
done
