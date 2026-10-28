# SentinelMail UI production update

**Implementation date:** 28 October 2026<br>
**Source baseline:** `79feea3abdbb9306d1a7068fdf35ded1b3579549`<br>
**Status:** implemented and validated locally; the public Vercel deployment was not updated by this workspace session.

## What changed

### Brand and responsive analyst workspace

- Applied the user-supplied SUDO SPANDR emblem as the shared `BrandMark`, favicon and Apple touch icon. Blue asset variants are in `public/spandr-mark.png`, `public/spandr-favicon.png` and `public/spandr-logo-blue.jpg`.
- Moved the workspace visual system to white surfaces, black navigation/runtime chrome and blue primary actions, with readable light/dark theme tokens.
- Kept the responsive hash-routed shell: Overview, New analysis, Cases, URL Lab, Web Computer, Sample library, Case report and Settings/privacy.
- Kept desktop sidebar, mobile drawer/bottom navigation, route titles, skip link, visible focus states, reduced-motion handling, focus trapping/restoration and inert background content.

### Device-persistent evidence and case workflow

- Replaced the memory-only case library with IndexedDB persistence in `src/lib/caseDatabase.js` and hydration/persistence handling in `src/store/useForensicStore.jsx`.
- Cases are restored when the browser profile starts, and create/update/delete/clear operations are reflected in the device database. Delete/clear UI state waits for the device operation so an immediate reload cannot resurrect a record. Reload restores the case library; reopen a case from Cases to continue its analysis view.
- Retention is bounded to the newest 50 cases. The UI explains that records remain until explicitly cleared or browser data is deleted.
- Added device-wide JSON archive export, per-case export and two-step clear-device-cases confirmation.
- IndexedDB-unavailable/private-mode behavior is an explicit memory-only fallback: analysis remains usable, but the UI does not promise reload persistence.
- Evidence/case records are not written to `localStorage`. Only non-evidence preferences such as theme and Web Computer auto-resume use preference storage.
- Settings explains the shared-device risk: another person using the same browser profile may reopen saved cases. Export and clear cases before shared use.
- Reused the existing EML, MSG, pasted-text, attachment, category and transparent scoring engines. All 11 synthetic samples remain labelled and run through the real analyzer.

### Virtual Web Computer

- Replaced the simulated workspace desktop with two explicit real-runtime modes in `src/pages/SandboxPage.jsx`.
- **Browser Node.js** boots StackBlitz WebContainers in the browser tab, mounts a virtual filesystem, connects an xterm.js `jsh` terminal and provides editable workspace files. It is not represented as a full Linux OS, Chromium desktop or host shell.
- Browser workspace snapshots use their own IndexedDB database (`src/lib/browserComputerStorage.js`), with memory-only fallback when device storage is unavailable. Evidence/workspace file contents are not written to `localStorage`.
- **Hosted Linux (optional)** connects to the local authenticated control proxy in `scripts/agent-computer-server.mjs`. Start/Stop manages actual Xvfb, Fluxbox, Chromium, xterm, PCManFM, x11vnc and websockify processes as the dedicated `spandrvm` user. The host workspace is not mounted and noVNC binds to localhost.
- Manual **Start/Stop** controls the selected runtime. Optional **Active-tab auto-resume** starts it while the tab is visible and stops it when hidden; it does not provide background mailbox monitoring.
- User-supplied `.eml` and `.msg` files use the separate submitted-mail automation panel. The existing local analyzer parses, scores, generates a recommendation plan and saves the resulting case when device storage is available.
- WebContainers requires COOP/COEP cross-origin isolation and initial StackBlitz runtime network access. Commercial production use may require a WebContainer API license; these requirements are shown rather than hidden.
- No mailbox/IMAP, autonomous quarantine/reply/delete action or hardware VM is claimed. Hosted Linux is a local POC, not an air-gapped production multi-tenant runtime.

### Honest capabilities and safety

- URL Lab performs browser-only static URL parsing and does not fetch the target, DNS, page content or reputation data.
- The legacy same-origin remote-HTML preview proxy returns **410 Gone** in both serverless and FastAPI implementations. It performs no target fetch and emits restrictive framing/content headers.
- The serverless heuristic detonation response no longer advertises a preview URL and no longer describes an unmatched pattern as proof of low risk.
- Added Vercel security headers, including CSP, clickjacking protection, MIME-sniffing protection, referrer/permissions policy and immutable caching for hashed assets.
- Preservation/report wording now distinguishes browser-profile case storage from an immutable evidence vault.

## Validation performed

### Current real-runtime checks

- Browser WebContainer reached `running` with `crossOriginIsolated` and `SharedArrayBuffer` available. An edited program generated the actual terminal output `PLAYWRIGHT_REAL_EXECUTION 42`; this was not a canned terminal string.
- Graceful browser shell exit, WebContainer teardown and reload completed with zero page errors. The saved program was restored from IndexedDB, no workspace-file fallback was written to `localStorage`, and storage-unavailable behavior showed memory-only status.
- Active-tab auto-resume performed actual visible start → hidden stop → visible restart. Submitted `sample-phishing.eml` then completed automatic triage and restored its saved Web Computer case after reload.
- The production bundle was also served with Vercel-equivalent CSP/COOP/COEP headers; real WebContainer execution and graceful stop passed. `Referrer-Policy: strict-origin-when-cross-origin` is required because StackBlitz's headless endpoint rejects referrer-less requests.
- Hosted Linux noVNC reported `Connected` through local and same-origin proxy tests. Stop closed VNC and the hardened control plane verified zero remaining `spandrvm` processes before returning.
- Fixed browser editor/terminal sizing removed an xterm resize-observer growth loop. Desktop layout remained stable at a 560px workspace, mobile had no horizontal overflow, and current light/dark/mobile axe scans detected zero violation rules.
- Direct automated access to the external E2B preview URL returned the platform's **403 traffic-access-token-required** page. This is not counted as an external user-browser validation; that confirmation remains pending.

### Earlier workspace and backend checks

- `npm run build` — passed with Vite 6.4.5; **1,648 modules transformed**. Bundle report: CSS 244.84 KB raw / 102.05 KB gzip; main JS 662.50 KB / 184.58 KB gzip; secondary chunks 57.34 KB / 15.24 KB gzip and 19.95 KB / 7.52 KB gzip. Vite reports a large-chunk warning.
- `npm run lint` — forensic-claim string lint passed for **35 active source files**, including the new runtime components.
- `npm audit` — **0 known vulnerabilities** after non-breaking dependency updates at validation time.
- Browser smoke suite — **2/2 passed** for sample → analysis → report → cases, static URL inspection with zero target requests, theme persistence, Alt+N and mobile navigation/focus management.
- Sample corpus smoke — **11/11** samples analyzed, 11 device cases listed and clear-device-cases completed without runtime errors.
- Earlier persistence smoke covered case restore/delete/clear, EML automatic triage and auto-resume on the previous local mail-desktop UI. The new browser/hosted runtime UI has separate real-execution checks listed above; the retired guest-window/Start-menu assertions no longer apply.
- IndexedDB-unavailable fallback smoke — passed: analysis remained usable, memory-only status was shown and no reload persistence was claimed.
- Automated axe scans over WCAG 2/2.1/2.2 A/AA rules — final scans detected **zero violation rules** on tested empty/intake/library/settings routes, actual high-risk analysis, reports, light/dark themes, mobile overview/open drawer, and active Web Computer desktop/mobile states. This is not a substitute for a full manual accessibility audit.
- Backend API/category/parser/score-ledger/attachment smoke, 7 feature tests, security script and 4 category cases — previously passed from the repository root; no backend behavior was changed for this branding/persistence phase. The optional EML regression fixture was absent and remained **SKIP**, not a pass.
- Sandbox safety smoke — preview endpoint returned 410, made zero remote fetches and heuristic detonation returned no preview link.

## Still required before a production release

1. Deploy this source through the project's normal review/CI process and verify that the public deployment no longer serves the older monolithic UI. Local validation does not update the live site.
2. Add authentication, tenant authorization, rate limits and quotas to applicable API routes. Do not expose detonation or case evidence publicly.
3. If live mail receiving or remote detonation is required, add authenticated mailbox connectors and private queued, isolated workers with restricted egress, streaming resource limits and non-public VNC. The current Web Computer is intentionally local and on-demand.
4. Define production evidence encryption/key management, immutable audit/chain-of-custody storage, backups, retention policy and shared-device operational guidance. IndexedDB alone is not a forensic archive.
5. Re-run upload, API, CSP, cross-origin, AI-review, persistence and optional backend integration tests against the actual deployment configuration.
6. Review remaining legacy/report source and unsupported legal/certification claims before re-enabling those workflows.
7. Complete manual keyboard, screen-reader, zoom/reflow, browser-matrix and real-evidence regression testing.
8. Confirm WebContainer API licensing for the intended open-source/POC/commercial deployment and verify StackBlitz engine/preview domains under the production CSP and embedding model.
