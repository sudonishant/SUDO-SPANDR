/*
 * Agent PC engine registry — single source of truth for every runtime the
 * Agent PC page can start.
 *
 * Rules this file follows (see docs/AGENT_PC_V2.md):
 *   1. Every engine declares what it actually is, where it runs and what it
 *      cannot do. The UI renders these strings verbatim, so no card can
 *      advertise a capability that the runtime does not have.
 *   2. Engine URLs are isolated here. If a third-party project changes its
 *      frame policy, only this file needs to change.
 *   3. Nothing here talks to the network. `probeDevice()` is local-only.
 */

export const AGENT_ENGINES = {
  desktop: {
    id: 'desktop',
    name: 'SUDO Desktop',
    short: 'SUDO Desktop',
    badge: 'In-page x86 PC',
    kind: 'native',
    frameUrl: null,
    standaloneUrl: null,
    summary: 'A real graphical PC booted by an x86 emulator inside this page. Bundled 1.4 MB desktop OS, or boot your own ISO / disk image — nothing is uploaded.',
    cost: '₹0 infrastructure',
    runsOn: 'This browser tab, on this origin',
    capabilities: [
      { label: 'Desktop', value: 'Windowed GUI' },
      { label: 'Guest', value: 'Bundled or your own image' },
      { label: 'Network', value: 'No NIC in the guest' },
      { label: 'Capture', value: 'PNG + SHA-256' },
    ],
    limits: [
      'Emulated CPU: roughly 1990s-to-2000s speed. Modern desktop Linux will boot but feel very slow.',
      'The bundled guest is KolibriOS — a small hobby OS with a GUI, not a forensic Linux distribution.',
      'No network device is attached, so nothing inside the guest can reach the internet or this workspace.',
      'It is a browser tab, not an isolation boundary: treat anything you boot as running on your own machine.',
    ],
    hardware: { minCores: 2, minMemoryGB: 2, mobile: 'slow' },
  },

  webvm: {
    id: 'webvm',
    name: 'Debian WebVM',
    short: 'WebVM',
    badge: 'WASM · CheerpX',
    kind: 'wasm',
    frameUrl: 'https://webvm.io/',
    standaloneUrl: 'https://webvm.io/',
    summary: 'Full Debian x86 userland compiled to WebAssembly. Real shell and X desktop, boots in seconds, runs on this tab’s CPU.',
    cost: '₹0 infrastructure',
    runsOn: 'This browser tab (third-party origin)',
    capabilities: [
      { label: 'Shell', value: 'Debian x86 userland' },
      { label: 'Desktop', value: 'X on canvas' },
      { label: 'Chromium', value: 'Not bundled' },
      { label: 'Disk', value: 'Tab memory only' },
    ],
    limits: [
      'Hosted on webvm.io, not on this deployment — the guest traffic and files never pass through our server.',
      'Nothing from this workspace (case files, EML, attachments) is copied into the guest automatically.',
      'Guest disk lives inside this tab; reloading the page loses everything inside the VM.',
    ],
    hardware: { minCores: 2, minMemoryGB: 2, mobile: 'slow' },
  },

  v86: {
    id: 'v86',
    name: 'v86 Legacy PC',
    short: 'v86',
    badge: 'WASM · x86 PC',
    kind: 'wasm',
    frameUrl: 'https://copy.sh/v86/?profile=linux26',
    standaloneUrl: 'https://copy.sh/v86/?profile=linux26',
    summary: 'A real x86 PC emulated in WebAssembly with a small Linux 2.6 image. Fast to boot, useful for shell practice and teaching.',
    cost: '₹0 infrastructure',
    runsOn: 'This browser tab (third-party origin)',
    capabilities: [
      { label: 'Shell', value: 'Linux 2.6 busybox' },
      { label: 'Desktop', value: 'Console only' },
      { label: 'Network', value: 'Not configured' },
      { label: 'Disk', value: 'Emulated, tab memory' },
    ],
    limits: [
      'Legacy kernel: current forensic tooling will not run inside it.',
      'Console only — there is no graphical desktop or file manager.',
      'Hosted on copy.sh; the guest is outside this application’s trust boundary.',
    ],
    hardware: { minCores: 1, minMemoryGB: 1, mobile: 'usable' },
  },

  backend: {
    id: 'backend',
    name: 'Host Docker desktop',
    short: 'Host desktop',
    badge: 'Local noVNC',
    kind: 'hosted',
    frameUrl: null,
    standaloneUrl: null,
    summary: 'Real Chromium, xterm and PCManFM running as an unprivileged account on a host you control, streamed over noVNC.',
    cost: 'Your server pays',
    runsOn: 'Configured host via authenticated control plane',
    capabilities: [
      { label: 'Browser', value: 'Real Chromium' },
      { label: 'Terminal', value: 'xterm' },
      { label: 'Files', value: 'PCManFM' },
      { label: 'Disk', value: 'Persistent guest home' },
    ],
    limits: [
      'Requires scripts/setup-agent-computer.sh plus a running control server with a token — a serverless deployment cannot start it.',
      'Not air-gapped: the guest has outbound network access.',
      'Single-tenant proof of concept. Production needs per-user isolation, private VNC and egress policy.',
    ],
    hardware: { minCores: 0, minMemoryGB: 0, mobile: 'usable' },
  },
};

export const ENGINE_ORDER = ['desktop', 'webvm', 'v86', 'backend'];

export const ENGINE_STORAGE_KEY = 'spandr-agent-engine';

export function engineById(id) {
  return AGENT_ENGINES[id] || AGENT_ENGINES[ENGINE_ORDER[0]];
}

/**
 * Local, synchronous environment probe. Used to set expectations before a
 * WASM desktop is booted — never to claim that a runtime is "verified".
 */
export function probeDevice() {
  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const cores = Number(nav.hardwareConcurrency) || 0;
  const reportedMemoryGB = Number(nav.deviceMemory) || 0;
  const mobile = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(nav.userAgent || '');
  const wasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  const crossOriginIsolated = typeof globalThis.crossOriginIsolated === 'boolean'
    ? globalThis.crossOriginIsolated
    : false;

  const warnings = [];
  if (!wasm) warnings.push('WebAssembly is unavailable in this browser, so no WASM desktop can boot.');
  if (mobile) warnings.push('Mobile device detected: WASM desktops are slow and the on-screen keyboard usually does not reach the guest.');
  if (cores && cores < 2) warnings.push(`Only ${cores} logical CPU core reported; boot and typing will feel sluggish.`);
  if (reportedMemoryGB && reportedMemoryGB < 2) warnings.push(`Browser reports ${reportedMemoryGB} GB device memory; a WASM desktop may be terminated by the OS.`);

  return {
    cores,
    reportedMemoryGB,
    reportedMemoryIsCapped: Boolean(reportedMemoryGB === 8),
    mobile,
    wasm,
    crossOriginIsolated,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}

/** Which engine should be highlighted first on this device. */
export function recommendedEngine(device) {
  if (device?.wasm === false) return 'backend';
  return device?.mobile ? 'v86' : 'desktop';
}

/** Short, honest status line for the given engine on the given device. */
export function engineReadiness(engineId, device) {
  const engine = engineById(engineId);
  if (engine.kind === 'hosted') return { tone: 'neutral', text: 'Needs the local control plane' };
  if (device?.wasm === false) return { tone: 'blocked', text: 'WebAssembly unavailable' };
  if (device?.mobile) return { tone: 'caution', text: 'Will boot, but slow on mobile' };
  if (engine.kind === 'native') return { tone: 'ready', text: 'Boots on this origin — no server, no third party' };
  return { tone: 'ready', text: 'Runs in this tab — no server needed' };
}

/**
 * Build a shareable deep link for an engine (used by “copy link”).
 * The engine lives in the query string because the app router owns the hash
 * (`#/sandbox`) and would otherwise treat `sandbox?engine=…` as an unknown route.
 */
export function engineShareUrl(engineId) {
  const engine = engineById(engineId);
  const base = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;
  return `${base}?engine=${engine.id}#/sandbox`;
}

/** Parse `?engine=webvm#/sandbox` (or a legacy hash form) on boot. */
export function engineFromLocation() {
  if (typeof window === 'undefined') return null;
  const sources = [window.location.search || '', window.location.hash || ''];
  for (const source of sources) {
    const match = source.match(/[?&]engine=([a-z0-9-]+)/i);
    if (match) {
      const id = match[1].toLowerCase();
      if (AGENT_ENGINES[id]) return id;
    }
  }
  return null;
}
