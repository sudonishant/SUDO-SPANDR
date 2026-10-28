# Agent PC and Fieldwork UI redesign

Updated: 2026-10-28

> Subsequent evidence-workbench update: see [Evidence map, formal dossier and REA deep inspection](./EVIDENCE_DOSSIER_REA.md). The current interface uses the original blue/white emblem; the earlier warm-recolored emblem variant is no longer referenced.

## Product scope

SUDO SPANDR remains an email/BEC analysis and forensic-review workspace. The existing local
workflow—ingest, extract, analyze, validate, explainable risk, report, device-case retention and
analyst review—was preserved. This update does not restore unsupported claims such as automatic
quarantine, immutable evidence, court admissibility or a connected live mailbox.

## Changes

- Replaced primary URL Lab navigation and the intake detonator entry point with **Agent PC**.
- Removed the unused standalone URL Lab page. Legacy `#/url-lab` bookmarks redirect to `#/sandbox`.
- Made the **real hosted Linux GUI** the default Agent PC runtime: actual Chromium, xterm, PCManFM,
  Fluxbox and noVNC under the dedicated unprivileged `spandrvm` account.
- Preserved **Browser Node.js** as the secondary WebContainers workshop. It is explicitly not full
  Linux, a Chromium desktop or a remote VM.
- Kept submitted EML/MSG local triage, explainable plans, case export and IndexedDB persistence.
- Introduced the Fieldwork theme: warm sand/parchment surfaces, forest teal, copper and plum.
  Light mode is not pure white and dark mode is not pure black; application actions are not blue.
- Themed application chrome and runtime surfaces. The subsequent evidence update restores and preserves the original emblem colours and favicon.
- Themed the application, runtime chrome, noVNC controls, Fluxbox root and xterm. Actual web content
  inside Chromium keeps its own colors.
- Added keyboard focus for the scrollable runtime-activity list and accessible terminal ANSI colors.
- Consumed WebContainers shell-exit rejections during intentional teardown; an unexpected closure of
  a mounted active runtime now produces an honest stopped/error state instead of an unhandled rejection.

## Runtime and security boundaries

- The hosted control plane listens on localhost and requires an authentication token. The Vite proxy
  injects that token; the browser does not receive the control credential.
- The host workspace is not mounted into the guest. The guest home persists on its host.
- The local hosted runtime has network access; it is not air-gapped and is not a hardware VM.
- Production multi-user hosting still requires authenticated per-user isolation, private VNC,
  egress policy, quotas, rate limits, encryption/key management, observability, backups and retention.
- WebContainers execution is browser-side. First boot needs StackBlitz runtime network access and
  commercial production use may require a WebContainer API license.
- No mailbox is connected. The UI does not auto-reply, delete, quarantine or claim that a message is
  safe. Analyst approval remains necessary.

## Validation performed

- Production build passed; claim lint passed; `npm audit` reported zero vulnerabilities.
- Desktop/mobile UI smoke: **2/2 passed**, including legacy redirect, theme persistence, keyboard
  drawer behavior and horizontal-overflow checks.
- Hosted Agent PC: Start → noVNC **Connected** + visible canvas + reported Chromium lifecycle → Stop
  passed repeatedly. After Stop: zero `spandrvm` processes, closed 5900/7860 ports and
  `stopping: false`.
- Direct unauthenticated control request returned **401**. Guest read of the host workspace was
  denied.
- Browser Node.js: real `node index.js` execution, evidence-file read, edited-code execution,
  graceful Stop, IndexedDB restore after reload, restored-code execution after reboot, submitted
  EML auto-triage and saved-case reload passed. After the teardown-rejection hardening, the complete
  browser suite passed three consecutive runs with zero page errors.
- Sample corpus: **11/11 passed**; device cases listed and cleared. IndexedDB-unavailable fallback
  retained analysis and honestly reported memory-only/non-persistent behavior.
- Final axe scans covered application routes, analysis/report results, light/dark themes, mobile
  overview/drawer, stopped Agent PC and running Browser Node.js states: **zero detected violation
  rules**. Automated scans do not replace a complete manual accessibility audit.

## Still not externally verified

- No new production deployment is claimed by this document.
- Arena iframe/WebContainer compatibility still depends on the embedder's cross-origin-isolation
  headers; a direct browser tab with the required COOP/COEP headers remains the reliable path.
- Hosted keyboard/mouse input was not part of the automated proof; the test verified the real
  lifecycle, connected noVNC session and canvas, not every interactive input path.
- External user-browser and deployed isolation checks remain pending.
