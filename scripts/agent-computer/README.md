# Agent computer runtimes

## Browser Node.js (default)

The default Web Computer mode uses `@webcontainer/api` and xterm.js. It executes real Node.js/jsh
in the browser tab and needs no host compute process. It is **not a full Linux OS or Chromium
desktop**. COOP/COEP cross-origin isolation is required, the first boot loads the StackBlitz
runtime, and commercial production use may require a WebContainer API license. Workspace snapshots
use IndexedDB; device-storage failure falls back to memory only.

## Hosted Linux (optional)

This is a **real Linux desktop runtime**, not a simulated desktop in React. It runs Chromium,
Xterm, PCManFM, Fluxbox and Xvfb as the dedicated unprivileged `spandrvm` operating-system user.
The host workspace is not mounted into that account. noVNC/websockify and VNC listen on localhost;
the Vite development server proxies the desktop under the same origin.

It is intended for a private local development sandbox. It is not a hardware VM, an air-gapped
network namespace, or a production multi-tenant service. Production use requires authenticated
sessions, per-user containers/VMs, egress policy, resource quotas, audit logging and private VNC.

## One-time host setup (Debian)

```bash
sudo bash scripts/setup-agent-computer.sh
```

The setup installs OS packages, creates the `spandrvm` user and copies the bundled noVNC client.
No repository secrets are copied.

## Start the control plane and web workspace

Use a random token shared only by the local control server and Vite proxy. Do not commit it.

```bash
export AGENT_COMPUTER_TOKEN="$(openssl rand -hex 32)"
node scripts/agent-computer-server.mjs &
AGENT_COMPUTER_TOKEN="$AGENT_COMPUTER_TOKEN" \
AGENT_COMPUTER_TARGET="http://127.0.0.1:8765" \
AGENT_COMPUTER_NOVNC_TARGET="http://127.0.0.1:7860" \
npm run dev -- --host 0.0.0.0
```

Then open Web Computer → Hosted Linux and press **Start Linux desktop**. Start/stop calls manage actual desktop
processes. Files in `/var/lib/spandrvm/share` belong to the desktop account and persist across
runtime restarts on that host.
