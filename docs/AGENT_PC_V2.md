# Agent PC v2 — runtime registry, honest launchpad, deploy-header guard

Updated: 2026-10-29

This document describes the change set applied on top of the redesign described in
[AGENT_PC_REDESIGN.md](./AGENT_PC_REDESIGN.md). It keeps the same product scope: Agent PC is a
forensic *workstation* view, not a mail agent. Nothing here connects a mailbox, opens evidence
automatically or asserts that a message is safe.

## Problem being fixed

The previous Agent PC screen advertised three engines from two places (`HostedLinuxComputer.jsx`
and the now-unused `SandboxApp.jsx`), stored the engine only in component state, had no way to
recover a session after a reload, gave no signal when the embedded frame silently failed, and
printed the same "real Linux GUI with Chromium, terminal and files" promise for every engine —
including WebVM and v86, which do not ship Chromium at all.

Separately, the deployed site and the repository had drifted apart in security headers, and
`vercel.json` declared a `frame-src` that did not include the two engines the UI actually frames.

## What changed

### 1. One registry for every runtime — `src/lib/agentEngines.js`

- `AGENT_ENGINES` describes each runtime once: name, badge, kind (`wasm` | `hosted`), frame URL,
  standalone URL, summary, cost model, where it runs, real capabilities and hard limits.
- The UI renders these strings verbatim, so a card cannot promise a capability the runtime lacks.
- `probeDevice()` reports cores, reported device memory, mobile, WebAssembly support and
  `crossOriginIsolated`. It is local and synchronous; it never claims a runtime is "verified".
- `recommendedEngine()`, `engineReadiness()`, `engineShareUrl()` and `engineFromLocation()` keep
  the decision logic out of the component.

### 2. `src/components/HostedLinuxComputer.jsx` rewritten

| Area | Before | After |
| --- | --- | --- |
| Engine choice | component state only, lost on reload | persisted in `localStorage`, overridable by `?engine=…#/sandbox` |
| Mount behaviour | probed host once, no feedback | probes host, and **reattaches** to a session that is still running on the host |
| Embedded frame | fixed `src`, no reload, no exit path | session bar with Reload / Refit / Fullscreen / Open tab / Copy link |
| Failure states | one `error` string | explicit state machine (`idle → starting → running → stopping`, plus `error`) with readable labels |
| Dead desktop | never detected | 20 s health poll on the host runtime, honest "stopped outside this tab" message |
| Blank frame | silent | 12 s hint explaining frame policy vs. slow network, with an "open in tab" fallback |
| Control calls | no timeout | `AbortController`, 25 s timeout, explicit timeout message |
| Copy | clipboard only | clipboard with `execCommand` fallback and a visible result |
| Accessibility | status text only | `role="status" aria-live="polite"`, radiogroup semantics on engine cards, focusable help dialog closed with `Esc` |

The device preflight warns on mobile, single-core and low-memory devices before a WASM desktop is
booted, instead of letting the tab freeze.

### 3. `src/styles/agent-pc.css`

New styles for the session bar, runtime cards, preflight block and help dialog. It is imported last
in `src/index.css` so it refines the dark screen area without fighting the Fieldwork palette, and it
uses the existing design tokens (`--hairline`, `--ink-dim`, `--focus`, …) so light and dark themes
both stay coherent. Responsive rules collapse the three cards to one column under 900 px.

### 4. Deployment headers — `vercel.json`

- `frame-src` now pins the two engine origins (`https://webvm.io`, `https://*.webvm.io`,
  `https://copy.sh`, `https://*.copy.sh`) plus loopback for a local noVNC. The previous value did not
  allow them, so the embedded runtimes were blocked by our own policy.
- `Cross-Origin-Embedder-Policy` is now `credentialless` instead of `require-corp`.
  `require-corp` still yields `crossOriginIsolated` (needed by the WebContainers workbench) but
  rejects third-party frames that do not send `Cross-Origin-Resource-Policy`. `credentialless`
  keeps `crossOriginIsolated` in Chromium while allowing the engine frames to load. Firefox 119+
  and Safari do not grant isolation under `credentialless`; Browser Node.js therefore remains a
  Chromium-first path, which matches the previous documented support envelope.

### 5. `scripts/verify-deploy-headers.mjs` (`npm run verify:headers`)

The repository previously *declared* headers but never checked the deployment. The script fetches a
deployed URL and asserts: CSP present, engine origins permitted, no bare `https:` frame wildcard,
COEP present, COOP same-origin, `X-Frame-Options: DENY`, `nosniff`, HSTS. Run:

```bash
npm run verify:headers -- https://sudospandrsce.vercel.app
```

Against the current production deployment (2026-10-29) it reports **7/9**, failing:

- `CSP frame-src is not a bare scheme wildcard` — live `frame-src` contains `https:`, so any origin
  can be framed;
- `COEP enables crossOriginIsolated` — no COEP header at all on the live site, so Browser Node.js
  (WebContainers) cannot start there even though the repo declares it.

That drift, not the component code, is the main reason Agent PC feels unreliable in production.

Both new source files are added to `scripts/check-forensic-claims.mjs` (48 active files), so the
anti-fabrication lint now covers the Agent PC runtime descriptions too.

## Boundaries that are still true

- WebVM and v86 are **third-party sites**. Their guest traffic does not pass through this
  application, and nothing from the case workspace is copied into them. The UI says so twice.
- Case evidence and the guest runtime remain disconnected. Copying evidence into a sandbox needs an
  explicit, audited transfer path, which does not exist yet (see roadmap below).
- The host desktop still requires `scripts/setup-agent-computer.sh` and a tokenised control server on
  a machine you own. A serverless deployment cannot start it; the UI now shows that as a labelled
  state with a "Re-check host" action instead of a dead button.
- No session recording, keystroke capture or screenshot hashing exists.

## Verification performed here

- `npm run build` — passes (same 843 kB main chunk warning as before; CSS grows 288 kB → 296 kB).
- `npm run lint` — passes, 48 files.
- Server-side render smoke test of the component with `react-dom/server` — renders the launchpad,
  all three engine cards, the preflight list, and reports `data-runtime-status="stopped"`, which
  keeps the attribute values used by the earlier verification notes.
- `npm run verify:headers` against production — 7/9, failures listed above.
- Not performed: real browser interaction, axe scan, noVNC round-trip, and WASM boot on a live
  device. Those still need a browser session on the target hardware.

---

# Addendum — SUDO Desktop: a GUI PC that runs in the page (2026-10-29)

The user asked for "a GUI-based PC that runs on the web", not another link to someone else's
site. Agent PC now boots a **real x86 PC inside this page** on this deployment's own origin.

## How it works

| Piece | What it is |
| --- | --- |
| `v86` (npm, BSD-2-Clause) | x86 CPU + VGA emulator compiled to WebAssembly, loaded as a lazy chunk (`libv86` 357 kB, `v86.wasm` 2.0 MB) |
| `public/v86/seabios.bin`, `vgabios.bin` | BIOS + VGA option ROM, served from this deployment (no third-party origin) |
| `public/v86/kolibri.img` | Bundled 1.44 MB KolibriOS image — boots a windowed desktop in ~10 s |
| `src/components/BrowserDesktop.jsx` | Owns one emulator instance: boot, state machine, screenshot + SHA-256, zoom, reboot, teardown |
| `src/lib/agentEngines.js` | `desktop` engine is now the default and recommended entry on capable devices |

The guest has **no network device configured** (`networking` is deliberately omitted), so nothing
inside the guest can reach the internet or this workspace. The image is either the bundled floppy or
a file the analyst picks locally — that file is read with `FileReader` into memory, hashed, and never
uploaded.

## What the user gets

- **Boot**: "Start Agent PC" → guest desktop in the page (~10 s in a headless CI browser).
- **Use**: click the screen for focus, then mouse/keyboard behave normally (mouse wheel outside an
  unlocked pointer, guest pointer is relative).
- **Snapshot**: captures the guest canvas, computes SHA-256, shows size + hash and saves the exact
  same PNG. The hash is computed from the blob that is written to disk.
- **Zoom 100 / 150 / 200 %**, fullscreen, reboot.
- **Own image**: any `.iso` / `.img` / `.raw` / `.vhd` / `.qcow2` up to the browser's memory. Floppy,
  hard disk and CD boot paths are chosen by size and extension.
- **Emulated RAM**: 64 / 128 / 256 MB, honest about being emulated.
- **Honest limits on the card** (seeded from the registry): emulated CPU speed, KolibriOS is not a
  forensic Linux, no NIC, and "a tab is not an isolation boundary".

## Deployment requirement added

WebAssembly compilation is blocked by a strict CSP. `vercel.json` now serves
`script-src 'self' 'wasm-unsafe-eval'`, and `npm run verify:headers` checks for it. The deployed site
still fails that check (7/10) until the new `vercel.json` is deployed.

## Verification performed

`scripts/smoke-agent-pc.mjs` (Playwright, not a repo dependency) boots the guest in a real browser
and asserts the lifecycle. Against a production build (`vite preview`):

```
✓ Agent PC route loads            ✓ Guest reaches running state
✓ Runtime launchpad lists all 4   ✓ Guest actually draws its GUI (175 lit canvas samples)
✓ Deep link selects SUDO Desktop  ✓ Runtime status reflects the running guest
✓ Snapshot records PNG + SHA-256  ✓ Downloaded capture is a real PNG (61 KB)
✓ Stop tears the emulator down    ✓ Status returns to stopped
✓ No uncaught page errors         ✓ No horizontal overflow on mobile
✓ Launchpad renders on mobile     ✓ Mobile device warning is shown        → 14/14
```

`npm run build` and `npm run lint` (52 files) pass. Screenshots: `docs/ui/agent-pc-desktop.png`
(booted guest), `docs/ui/agent-pc-launchpad.png`, `docs/ui/agent-pc-mobile.png`.

Not verified: interactive typing inside the guest (the smoke test clicks the screen but types
nothing), audio, and performance on low-end hardware.

## Licences

SeaBIOS (LGPL-3.0), Bochs VGABIOS (LGPL-2.1), KolibriOS (GPL-2.0), v86 (BSD-2-Clause). Details and
pinned SHA-256 values: `public/v86/NOTICE.md` and `scripts/fetch-v86-assets.mjs`.
