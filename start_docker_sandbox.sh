#!/bin/bash
set -e

echo "=== [1/3] Checking Docker installation ==="
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt update
    sudo apt install -y docker.io
    sudo systemctl enable --now docker
    sudo usermod -aG docker $USER
fi

echo "=== [2/3] Cleaning up any old sandbox containers ==="
sudo docker rm -f cyber-sandbox 2>/dev/null || true

echo "=== [3/3] Pulling and launching Isolated Linux Desktop Docker Container ==="
# Using linuxserver/webtop:ubuntu-xfce for a complete isolated Linux Desktop with zero SSL iframe issues
sudo docker run -d \
  --name cyber-sandbox \
  --restart unless-stopped \
  -p 7860:3000 \
  --shm-size=1gb \
  -e TITLE="CyberSquad Isolated Sandbox" \
  lscr.io/linuxserver/webtop:ubuntu-xfce

echo ""
echo "================================================================"
echo "✅ DOCKER SANDBOX IS LIVE ON PORT 7860!"
echo "Open Dashboard at: http://localhost:8000"
echo "================================================================"
