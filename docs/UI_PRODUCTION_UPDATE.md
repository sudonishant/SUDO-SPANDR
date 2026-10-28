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

- Replaced the old sandbox status surface with an honest on-demand local mail-triage runtime in `src/pages/SandboxPage.jsx`.
- Start opens a workspace-style **guest desktop** with dark desktop chrome, Mail Intake and Triage Report windows, desktop icons, Start menu and taskbar. Windows can be closed/reopened without leaving the workspace; mobile stacks the same apps without horizontal overflow.
- Manual **Start/Stop** controls the runtime. Optional **Active-tab auto-resume** starts it when the visible Web Computer tab is active and pauses it when the tab is hidden; it does not provide background mailbox monitoring.
- User-supplied `.eml` and `.msg` files can be selected or dropped into Mail intake. The existing local analyzer automatically parses, scores, generates a recommendation plan and saves the resulting case when device storage is available.
- The result panel links to the full case/report and exports the actual result. Runtime activity lists real start, intake, completion and failure events from the current view; no incoming mail is fabricated.
- The integration panel explicitly states that real mailbox/IMAP, remote isolated VM and autonomous quarantine/reply/delete actions are not connected. No links or attachments are executed and no message is declared safe from a low score.

### Honest capabilities and safety

- URL Lab performs browser-only static URL parsing and does not fetch the target, DNS, page content or reputation data.
- The legacy same-origin remote-HTML preview proxy returns **410 Gone** in both serverless and FastAPI implementations. It performs no target fetch and emits restrictive framing/content headers.
- The serverless heuristic detonation response no longer advertises a preview URL and no longer describes an unmatched pattern as proof of low risk.
- Added Vercel security headers, including CSP, clickjacking protection, MIME-sniffing protection, referrer/permissions policy and immutable caching for hashed assets.
- Preservation/report wording now distinguishes browser-profile case storage from an immutable evidence vault.

## Validation performed

- `npm run build` — passed; **1,627 modules transformed**. Final bundle report: CSS 233.16 KB raw / 98.84 KB gzip; main JS 312.63 KB / 94.02 KB gzip; secondary JS 57.34 KB / 15.24 KB gzip.
- `npm run lint` — forensic-claim string lint passed for **31 active source files**.
- Production `npm audit --omit=dev` — **0 known vulnerabilities** at validation time; dependency changes were not made for this feature.
- Browser smoke suite — **2/2 passed** for sample → analysis → report → cases, static URL inspection with zero target requests, theme persistence, Alt+N and mobile navigation/focus management.
- Sample corpus smoke — **11/11** samples analyzed, 11 device cases listed and clear-device-cases completed without runtime errors.
- Dedicated persistence/Web Computer smoke (`/home/user/persistence-webcomputer-smoke.cjs`) — passed reload restore, close/reopen of a persistent browser profile, individual deletion, clear-all persistence, guest-window close/reopen and Start-menu recovery, EML automatic triage/case creation, saved Web Computer result restore, opt-in reload auto-resume and visibility pause/resume.
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
