#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
if [[ ${EUID} -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo -n)
fi

"${SUDO[@]}" apt-get update
"${SUDO[@]}" apt-get install -y --no-install-recommends \
  chromium fluxbox pcmanfm supervisor websockify x11vnc xterm

if ! id spandrvm >/dev/null 2>&1; then
  "${SUDO[@]}" useradd --system --create-home --home-dir /var/lib/spandrvm --shell /bin/bash spandrvm
fi

"${SUDO[@]}" mkdir -p \
  /var/lib/spandrvm/.fluxbox \
  /var/lib/spandrvm/.config/chromium \
  /var/lib/spandrvm/share \
  /var/lib/spandrvm/novnc
"${SUDO[@]}" cp -a "$ROOT_DIR/backend/novnc/." /var/lib/spandrvm/novnc/
"${SUDO[@]}" cp "$ROOT_DIR/scripts/agent-computer/supervisord.conf" /var/lib/spandrvm/supervisord.conf
"${SUDO[@]}" cp "$ROOT_DIR/scripts/agent-computer/fluxbox-menu" /var/lib/spandrvm/.fluxbox/menu
"${SUDO[@]}" cp "$ROOT_DIR/scripts/agent-computer/fluxbox-init" /var/lib/spandrvm/.fluxbox/init
"${SUDO[@]}" chown -R spandrvm:spandrvm /var/lib/spandrvm
"${SUDO[@]}" chmod 700 /var/lib/spandrvm /var/lib/spandrvm/share
"${SUDO[@]}" chmod 600 /var/lib/spandrvm/supervisord.conf

printf 'Agent computer host setup complete. Host workspace is not mounted into spandrvm.\n'
