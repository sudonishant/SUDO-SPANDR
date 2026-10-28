# Evidence map, formal dossier and REA deep inspection

Updated: 2026-10-28

## Current user-facing behavior

- The original blue/white SUDO SPANDR emblem and favicon are restored. The warm Fieldwork interface remains, but the emblem is not recolored.
- **Case report** now opens the active analysis or the latest saved device case. A saved-case selector allows switching without running a new scan.
- The formal bilingual dossier is an **independent, non-governmental analyst working document**. It records case metadata, hash scope, handling gaps, reported authentication, IP evidence, approximate network context, URLs/files, optional REA lanes, recommendations, limitations and human-review fields.
- The standalone HTML report uses a complete Blob document rather than `window.open(..., 'noopener')` plus `document.write`. It is self-contained and does not need external scripts, fonts, images or map tiles.
- The legacy Python fallback dossier presentation no longer labels itself as a government division, court certificate, tamper-proof record or certified custody document. Existing dynamic field IDs are retained.

No government seal, generated signature, court-admissibility conclusion, automatic containment, or continuous-custody claim is produced. For Indian proceedings, applicable electronic-record requirements—including Section 63 of the Bharatiya Sakshya Adhiniyam, 2023—need qualified legal and forensic review.

## IP evidence and approximate map

The Relay path keeps extracted public IP addresses visible independently of lookup success. On the explicit **Check IP + approximate location** action, the serverless endpoint sends only those public IPv4 addresses to:

1. `rdap.org` for public network-registration context;
2. `ipwho.is` for approximate city/region/country and latitude/longitude estimates.

The map is rendered locally from the Natural Earth `world-atlas` country outline using `d3-geo` and `topojson-client`. It does not request third-party map tiles and does not substitute the analyst/device IP.

Provider failure is partial and visible: RDAP can fail while approximate coordinates succeed, or vice versa. Missing/invalid coordinates produce an honest empty-map state; the IP list remains. Markers are not connected as a geographic route. Cloud, VPN, proxy and hosting estimates can describe infrastructure rather than an end user. No accuracy radius is invented when the provider does not supply one.

## REA integration architecture

Upstream: <https://github.com/morluto/rea> — **Reverse Engineer Anything**, MIT licensed.

The integration pins `rea-agents` **6.8.0** in `rea-sidecar/package.json` and invokes the official `scripts/rea.mjs` CLI in a separate authenticated service. REA 6.8.0 requires Node.js `^22.23.4`, `^24.22.1`, or `>=26.12.1`; the repository's older frontend runtime must not be used to launch the CLI.

The lockfile applies a local `zod` **4.6.6** override to address GHSA-mrhx-c7xc-m3w5 in the upstream-pinned 4.4.3 dependency. This is not an upstream REA release claim. The capability inventory, both exposed completed lanes and unsupported-file behavior were rerun against the override; unexposed REA commands are not thereby certified.

Two bounded lanes are exposed:

| Lane | Inputs | Behavior |
|---|---|---|
| `inspect_artifact` | One bounded file | Static inventory, observations, coverage and next probes |
| `analyze_javascript_application` | `.js`, `.mjs`, `.cjs`, `.asar` | Bounded static JavaScript/Electron reconstruction and summary evidence |

The web adapter does **not** execute the submitted target and does not bundle or claim Hopper, Ghidra, IDA, Kuna, firmware extraction, antivirus, dynamic sandboxing or a universal clean/malicious verdict. Live capability inventory reports unavailable optional providers. Unsupported and failed lanes remain explicit.

### Evidence binding and privacy

- Raw `File` objects remain memory-only; they are not written to IndexedDB.
- After reload, the analyst reselects the exact original file or a recorded attachment.
- The browser computes SHA-256 and refuses association when it does not match the active case evidence.
- Selecting a file does not upload it. Bytes are sent only after **Run deep inspection**.
- The sidecar independently recomputes and verifies SHA-256.
- Limits: 3 MiB file, 4.5 MB request, two concurrent analyses, fixed CLI commands, no shell, per-lane timeouts and output caps.
- Temporary input and complete evidence-bundle directories are deleted after the response. Only bounded, path-sanitised summary evidence is returned and saved with the case.
- Local browser analysis remains intact if REA is unavailable. No synthetic REA result is substituted.

## Local setup

Use a supported Node runtime for both dependency installation and the REA CLI. Example with `nvm`:

```bash
nvm install 24.22.1
nvm use 24.22.1
npm ci --prefix rea-sidecar --ignore-scripts

export REA_NODE_BIN="$(command -v node)"
export REA_CLI_PATH="$PWD/rea-sidecar/node_modules/rea-agents/scripts/rea.mjs"
export REA_SERVICE_TOKEN="replace-with-a-random-secret-of-at-least-24-bytes"
export REA_HOST=127.0.0.1
export REA_PORT=8788
npm run rea:service
```

In a second terminal, use the **same secret** without committing it:

```bash
export REA_SERVICE_TOKEN="the-same-random-secret"
export REA_PROXY_TARGET=http://127.0.0.1:8788
npm run dev
```

The Vite proxy injects `x-rea-token`; the browser does not receive the service credential. The sidecar itself listens on localhost by default. Do not expose it publicly without TLS, authenticated per-user controls, quotas and isolation.

## Optional deployed relay

The included Vercel functions return an honest **503 / not_configured** when no service is configured. To use a privately hosted sidecar, set:

- `REA_SERVICE_URL=https://your-private-rea-service.example`
- `REA_SERVICE_TOKEN=<the private service secret>`

`api/v1/rea-status.js` and `api/v1/rea-analyze.js` forward only the fixed `/status` and `/analyze` operations with a server-side Bearer token. Remote production service availability, provider configuration, egress policy and isolation must be independently verified. A Vercel deployment alone does not install a persistent REA engine.

## Validation performed locally

- Production build and claim lint passed; root frontend and REA-sidecar `npm audit --omit=dev` both reported zero vulnerabilities after the validated Zod override.
- Real IP handler test: `ipwho.is` returned valid approximate coordinates for a public test IP; RDAP HTTP 403 remained visible as a partial-provider failure.
- Real sidecar: unauthenticated status **401**; JavaScript artifact + JavaScript application lanes **completed**; unknown binary returned explicit unsupported output; hash mismatch **400**; oversized upload **413**; temporary-directory count after tests **0**.
- End-to-end browser: IP + map, no-coordinate fallback with IP evidence retained, detailed Dossier, non-blank standalone HTML, saved-case reload/selector, real REA analysis/export/persistence and mobile overflow checks passed with zero page errors.
- Print PDF: 4 non-blank pages, 6,947 extracted text characters, with case ID, integrity, IP/network, REA and legal-review sections present.
- Legacy UI smoke **2/2**, sample corpus **11/11**, and IndexedDB-unavailable fallback passed.
- Real hosted Agent PC start → noVNC Connected/canvas/Chromium → Stop passed. Browser Node.js execution, editing, reboot persistence and EML case persistence passed with zero page errors.
- Axe scans covered general routes, analysis/report light/dark, map light/dark, REA light/dark, mobile Dossier, and standalone HTML desktop/mobile: zero detected violation rules. Automated scans do not replace manual accessibility review.

## Not claimed

This document does not claim a new public deployment, public hosted-REA availability, government certification, legal admissibility, immutable custody, exact sender geolocation, or universal analysis of every file type. Public Agent PC and REA availability must be checked independently after deployment and configuration.
