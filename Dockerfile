# ==============================================================================
# Cyber Squad SentinelMail & Isolated Sandbox — Unified Hugging Face Space
# SIH 2026 Problem Statement #26106
# ==============================================================================

FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    PORT=7860 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_DIR=/app \
    HOME=/home/appuser

WORKDIR ${APP_DIR}

# Install system tools, Chromium, Xvfb, XFWM4, noVNC & websockify
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    xvfb \
    x11vnc \
    xfwm4 \
    novnc \
    websockify \
    supervisor \
    chromium \
    thunar \
    mousepad \
    atril \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libnss3 \
    procps \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt websockify uvicorn

# Copy application source files
COPY . ${APP_DIR}/

# Create non-root user for Hugging Face security guidelines (UID 1000)
RUN useradd -m -u 1000 appuser && \
    mkdir -p /home/appuser/.config /tmp/cyber_sandbox && \
    chown -R appuser:appuser ${APP_DIR} /home/appuser /tmp/cyber_sandbox

# Configure supervisord
COPY <<'CONFIG' /etc/supervisor/conf.d/supervisord.conf
[supervisord]
nodaemon=true
user=appuser
logfile=/tmp/supervisord.log
pidfile=/tmp/supervisord.pid

[program:xvfb]
command=Xvfb :99 -screen 0 1280x720x24 -nolisten tcp -ac
autorestart=true
priority=100

[program:xfwm4]
command=xfwm4 --display=:99 --replace
environment=DISPLAY=":99"
autorestart=true
priority=200

[program:x11vnc]
command=x11vnc -display :99 -nopw -listen 127.0.0.1 -rfbport 5999 -forever -shared
autorestart=true
priority=300

[program:websockify]
command=websockify --web /usr/share/novnc 7861 127.0.0.1:5999
autorestart=true
priority=400

[program:uvicorn]
command=python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 7860
autorestart=true
priority=500
CONFIG

USER appuser
EXPOSE 7860

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
