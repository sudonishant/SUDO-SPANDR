# Agent PC — Review + Upgrade (Hinglish)

**Repo:** `sudonishant/SUDO-SPANDR` · **Live:** `sudospandrsce.vercel.app` · **Date:** 29 Oct 2026

---

## 1. Ek line mein

Agent PC ka **UI + runtime logic rewrite** ho gaya, aur ab isme **ek asli GUI PC bhi browser ke andar
chalta hai** (x86 emulator, aapke hi origin pe, ₹0 server) — section 3.5 dekho. Saath mein 9 asli
problem mili hain; unme se **3 production-breaking** hain jo live deployment ke headers aur missing
backend ki wajah se hain, code ki galti se nahi.

---

## 2. Jo maine abhi improve kar diya (code chal raha hai, build pass)

### 2.1 Nayi files

| File | Kya karti hai |
| --- | --- |
| `src/lib/agentEngines.js` | **Ek hi registry** har runtime ke liye — WebVM, v86, Host Docker. Naam, badge, cost, kaha chalta hai, kya kar sakta hai, kya **nahi** kar sakta. UI yahi strings render karta hai, isliye koi card jhooth nahi bol sakta. Plus `probeDevice()` (cores / memory / mobile / WebAssembly), `recommendedEngine()`, deep-link parse. |
| `src/components/HostedLinuxComputer.jsx` | **Poora rewrite** (290 → ~560 lines). Session bar, state machine, host health poll, frame failure detection, help dialog. |
| `src/styles/agent-pc.css` | Session bar, runtime cards, preflight, dialog ke styles — Fieldwork tokens use karte hue, light + dark dono mein. |
| `src/components/BrowserDesktop.jsx` | **In-page GUI PC** (v86): boot, state machine, PNG snapshot + SHA-256, zoom, reboot, teardown. |
| `scripts/verify-deploy-headers.mjs` | `npm run verify:headers -- <url>` — deployment ke asli headers check karta hai (CSP, COEP, COOP, XFO, HSTS, wasm). Isse repo aur live site ka drift pakda gaya. |
| `scripts/smoke-agent-pc.mjs` | Playwright smoke test — asli browser me boot → GUI paint → snapshot → stop (14/14 pass). |
| `scripts/fetch-v86-assets.mjs` | KolibriOS + BIOS assets fetch/verify (SHA-256 pinned). |
| `public/v86/` | Bundled guest + BIOS + licence notice. |
| `docs/AGENT_PC_V2.md` | Engineering detail: kya badla, kyun, kya verify hua. |

### 2.2 Agent PC ab kaisa dikhta/chalta hai

**Pehle (live site):**

- Engine select karo → page reload → selection **gayab**.
- "Start Agent PC" dabao → agar frame blank aaya to **koi explanation nahi**, sirf blank screen.
- Koi session info nahi — kaunsa session chal raha hai, kitni der se, pata nahi.
- Reload/fullscreen/open-in-tab jaisa **koi escape hatch nahi**.
- Host desktop ka status ek baar mount pe check hota tha, phir kabhi nahi.
- Sab engines ke liye same line: *"Real Chromium + terminal + files"* — WebVM/v86 mein Chromium
  hota hi nahi. Yeh factual overclaim tha.
- Delete ho chuke `SandboxApp.jsx` mein ek **doosra Agent PC** (1140 lines) pada hai, jo galat
  behaviour dikhata hai agar koi use import kar le.

**Ab:**

1. **Launchpad cards** — teen cards, har card pe real capabilities (Shell / Desktop / Chromium /
   Disk) aur "₹0 infrastructure" vs "Your server pays". Jo card selected hai wahi pe *SELECTED*.
2. **Preflight block** — start karne se pehle hi likha hota hai ki us engine ki limit kya hai
   (e.g. "nothing from this workspace is copied into the guest"), aur device weak ho to warning
   ("mobile detected", "1 logical core", "WebAssembly unavailable").
3. **Session bar** (jaise VS Code ka status bar) — live chip, uptime timer, core count, short
   session id, aur buttons: **Reload · Refit · Fullscreen · Open tab · Copy link**.
4. **Blank frame ka honest handling** — 12 second tak kuch paint nahi hua to banner aata hai:
   *"Frame policy ya slow network ho sakta hai — tab mein kholein"* + button.
5. **Reattach** — agar host pe desktop pehle se chal raha hai, page kholne pe wahi session attach
   ho jaata hai (pehle `status` sirf availability batata tha).
6. **Dead session detection** — host desktop 20s poll pe band mila to "stopped outside this tab"
   message, silent freeze nahi.
7. **Timeout + abort** — control calls pe 25s `AbortController`, warna request hamesha pending
   rehti thi.
8. **Engine persistence + deep link** — `?engine=webvm#/sandbox` se seedha WebVM khulta hai,
   aur choice `localStorage` mein rehti hai.
9. **Help dialog** (ⓘ) — "what this page can and cannot do": mailbox connected nahi, evidence guest
   mein copy nahi hota, screen recording/keystroke capture nahi hota. `Esc` se band.
10. **Accessibility** — `role="status" aria-live`, radiogroup semantics, focus-visible outlines,
    `prefers-reduced-motion`, mobile pe toolbar labels icon-only.
11. `data-runtime-status` attribute ki values purani hi rakhi (`stopped` / `starting` / `running` /
    `stopping` / `error`) taaki jo bhi existing check likha hai woh na tute.

### 2.3 Deployment fix (`vercel.json`)

Yeh sabse important tha:

```diff
- frame-src 'self' https://stackblitz.com https://*.stackblitz.com https://*.webcontainer.io;
+ frame-src 'self' https://stackblitz.com https://*.stackblitz.com https://*.webcontainer.io
+           https://webvm.io https://*.webvm.io https://copy.sh https://*.copy.sh
+           http://localhost:* http://127.0.0.1:*;

- Cross-Origin-Embedder-Policy: require-corp
+ Cross-Origin-Embedder-Policy: credentialless
```

**Kyun:** `require-corp` ke saath third-party frame tabhi load hota hai jab woh `CORP` header bheje.
webvm.io/copy.sh nahi bhejte → Agent PC ka default engine **aapki hi CSP se block** ho raha tha.
`credentialless` Chromium mein `crossOriginIsolated` bhi deta hai (WebContainers ke liye zaroori) aur
engine frames bhi allow karta hai.

### 2.4 Verify kya kiya

```
npm run build   → ✓ built (843 kB main chunk warning pehle se hi thi)
npm run lint    → ✓ 48 files (2 nayi files bhi anti-fabrication lint mein add ki)
SSR smoke test  → ✓ launchpad + 3 engine cards + preflight render, status="stopped"
npm run verify:headers -- https://sudospandrsce.vercel.app → 7/9
```

---

## 3. Audit: kya kya problem hai (evidence ke saath)

### P0 — production tod rahe hain

| # | Problem | Evidence | Fix |
| --- | --- | --- | --- |
| 1 | **Live site pe COEP header hi nahi** → Browser Node.js (WebContainers) `crossOriginIsolated` check fail karega, matlab aapka "secondary workshop" live pe chal hi nahi raha | `npm run verify:headers` → `✗ COEP enables crossOriginIsolated — missing` | repo ka `vercel.json` push + prod redeploy, phir script dobara |
| 2 | **Live CSP `frame-src` mein bare `https:`** → koi bhi site frame ho sakti hai; aur repo ki CSP (jo pinned thi) engine origins allow hi nahi karti | header output: `frame-src ... https: http:` | dono ko ek karo (maine repo wala pin kar diya) |
| 3 | **`/api/v1/agent-computer/*` Vercel pe exist hi nahi karta** — `api/` folder mein aisa koi function nahi, sirf `scripts/agent-computer-server.mjs` (localhost). UI phir bhi "Host Docker" card dikhata tha | `ls api/v1` mein agent-computer nahi; `vite.config.mjs` sirf dev proxy | UI ab ise *labelled unavailable state* + "Re-check host" dikhata hai. Asli fix: alag host (Render/Fly) pe control plane + token, ya card ko "local-only" mark karo |

### P1 — security aur maintainability

| # | Problem | Evidence | Suggestion |
| --- | --- | --- | --- |
| 4 | **`/api/v1/sandbox/lab/url` bina auth, bina rate-limit ke server-side fetch karta hai** (6 redirect hops, 200 KB body) | `api/_lib/labcore.js` — `handleUrl` mein `fetch`, koi token/ratelimit nahi | Upstash/Redis rate limit (10/min/IP), `Origin` check, egress allow-list, `CYBERLAB_ALLOW_PRIVATE` production pe off |
| 5 | **Do Agent PC implementations** — `src/apps/SandboxApp.jsx` (1140 lines) + `HostedLinuxComputer` | grep: `SandboxApp` imported by 0 files; `ScoreApps` 594, `FilesApp` 241, `BrowserApp` 227, `TerminalApp` 97, `Window.jsx` 122 bhi 0 imports | delete karo — 2,500+ lines confusion khatam, reviewers ko "kaunsa real hai" nahi sochna padega |
| 6 | **Agent PC ka koi automated test nahi** — verification markdown mein hai, CI mein nahi | `.github/workflows` mein build/lint hai, UI e2e nahi | Playwright: launchpad render, engine switch, deep link, a11y roles, "stopped after Stop" |
| 7 | **`npm run build` ek hi 843 kB chunk** | build output | `React.lazy` + `manualChunks` (lucide, d3-geo/world-atlas, msgreader alag) — first paint tez |
| 8 | **Host control plane single-tenant**: ek hi `spandrvm` user, ek hi session, koi per-user isolation nahi | `scripts/agent-computer-server.mjs` state object global hai | per-session container + unique VNC password + TTL reaper (neeche roadmap) |

### P2 — product/honesty gaps

| # | Problem | Detail |
| --- | --- | --- |
| 9 | **Evidence → sandbox bridge nahi hai** | Case ka EML/attachment guest mein nahi jaata. Analyst ko manually copy karna padta hai — jo forensically galat hai (chain of custody). |
| 10 | **Session ka koi artefact nahi** | Screenshot, screenshot ka SHA-256, command log, session duration — kuch bhi case mein save nahi hota. "Agent PC" ka matlab hi evidence banana hai. |
| 11 | **WebVM/v86 third-party origin** | Guest ka traffic aapke server se nahi guzarta — demo ke liye theek, par "forensic workstation" kehne ke liye kamzor. Self-host karna padega. |
| 12 | **Dead code ka risk** | `SandboxApp.jsx` ke andar `BOOT_LINES` fake boot messages ("qemu-kvm boot", "egress blocked by policy") hain — agar koi use wapas import kar de to app jhoot bolne lagegi. Isliye delete zaroori hai. |

---

## 3.5 UPDATE — “GUI wala PC jo web pe chale” add ho gaya ✅

Aapne kaha tha Agent PC me ek aisi cheez chahiye jo **browser me hi GUI PC** chalaye. Woh add kar diya —
aur ab woh **aapke hi deployment ke origin** pe chalta hai, kisi dusri website ka iframe nahi.

### Kya bana

| Cheez | Detail |
| --- | --- |
| **Emulator** | `v86` (npm, BSD-2-Clause) — asli x86 CPU + VGA, WebAssembly me. Lazy chunk: 357 kB JS + 2 MB wasm |
| **Guest** | KolibriOS ka 1.44 MB floppy image — **repo me hi bundled**, `public/v86/` se serve hota hai |
| **BIOS** | SeaBIOS + Bochs VGABIOS, repo me bundled (pinned SHA-256) |
| **Naya component** | `src/components/BrowserDesktop.jsx` — boot, state machine, screenshot+SHA-256, zoom, reboot, teardown |
| **Default engine** | SUDO Desktop ab **default + recommended** hai (WebVM/v86-hosted/Host Docker bhi waise hi hain) |

### User ko kya milta hai

1. **Start Agent PC** → ~10 second me page ke andar hi asli desktop aa jata hai (screenshot:
   `docs/ui/agent-pc-desktop.png`).
2. Desktop pe icons, taskbar, Menu — mouse + keyboard normal chalte hain (screen pe click karke focus).
3. **Snapshot** button: guest ka PNG + uska **SHA-256** + size, aur wahi PNG download hota hai.
4. **Zoom 100 / 150 / 200 %**, fullscreen, reboot.
5. **Apni image bhi boot kar sakte ho**: `.iso` / `.img` / `.raw` / `.vhd` / `.qcow2`.
   File sirf `FileReader` se memory me padhi jati hai — **upload nahi hoti**.
6. **Emulated RAM: 64 / 128 / 256 MB.**

### Honesty (design ka part)

- Guest me **network device hi nahi** hai (`networking` deliberately omit) — guest se internet ya
  workspace tak koi rasta nahi.
- Card pe saaf likha hai: emulated CPU dheemi hai, KolibriOS forensic Linux **nahi** hai, aur
  "browser tab = isolation boundary nahi hai".
- Isliye yeh demo/teaching ke liye solid hai; malware detonation ke liye Phase 3 (microVM) hi sahi rasta hai.

### Deployment requirement (important)

WebAssembly compile karne ke liye CSP me `script-src 'wasm-unsafe-eval'` chahiye. `vercel.json` me add
kar diya aur verifier me check bhi. **Live site abhi bhi purane headers pe hai** — redeploy karte hi
GUI PC production pe chal jayega.

### Verify (real browser, headless Chromium)

```
node scripts/smoke-agent-pc.mjs http://127.0.0.1:4173
→ 14/14 passed
  ✓ 4 engine cards   ✓ guest running   ✓ GUI canvas paint (175 samples)
  ✓ snapshot PNG + SHA-256   ✓ downloaded file asli PNG (61 KB)
  ✓ Stop pe emulator teardown   ✓ koi page error nahi
  ✓ mobile pe no horizontal overflow   ✓ mobile device warning
```

Extra scripts:

```bash
npm run assets:v86          # assets re-fetch / verify (SHA-256 pinned)
npm run verify:v86-assets   # sirf verify, no network
npm run smoke:agent-pc      # browser me pura lifecycle test
```

### Ab bhi pending (honest)

- Live deployment pe redeploy nahi hua — isliye production pe abhi purana UI + purane headers.
- Guest ke andar typing ka automated test nahi (click tak test hai).
- Low-end hardware pe performance measure nahi ki.
- KolibriOS GPL-2.0 hai — agar aap ise commercial product bana rahe ho to licence notice rakhna
  (`public/v86/NOTICE.md` me sab likha hai).

---

## 4. Aage kya improve kar sakte ho — roadmap

### Phase 1 — “reliable demo” (1–2 din, sabse zyada ROI)

1. `vercel.json` push karo, prod redeploy, `npm run verify:headers` **9/9** karao.
2. Dead code delete: `src/apps/{SandboxApp,ScoreApps,FilesApp,BrowserApp,TerminalApp,CaseApps,AboutApp}.jsx`, `src/os/Window.jsx` (agar `WorkspaceApp` bhi nikal do to `src/apps` poora hata do).
3. `/api/v1/sandbox/lab/*` pe rate limit + `Origin` allow-list.
4. Playwright smoke test CI mein (launchpad → start → stop, deep link, Esc dialog).
5. Bundle splitting (`manualChunks`), warna 3G pe first paint slow.

### Phase 2 — “evidence-aware Agent PC” (1 hafta) — yeh asli differentiator hai

> Note: in-page GUI PC + screenshot SHA-256 already ship ho chuke hain (section 3.5). Neeche wale
> items abhi baaki hain.

6. **One-click evidence transfer**: case ka EML/attachment guest mein mount karo — read-only, SHA-256
   verify ke saath, aur transfer event ko case timeline mein log karo. (WebVM ke liye self-host
   CheerpX/`webvm` build + its own FS bridge; host desktop ke liye bind mount.)
7. **Session artefact**: start/stop pe screenshot (PNG) + uska SHA-256 + tool list + duration →
   case JSON mein, aur report mein "Sandbox session" section.
8. **Command allow-list / audit log**: guest ke shell commands capture karke case mein append karo.
   "Human approval in the loop" ko product feature banao, slogan nahi.
9. **TTL + quota**: session 15 min idle pe auto-stop, per-day minutes ka quota, UI pe live countdown.
10. **Clipboard guard**: guest ↔ host clipboard pe warning, kyunki forensic evidence clipboard se
    leak hota hai.

### Phase 3 — “product-grade isolation” (3–4 hafte)

11. **Per-user microVM**: Firecracker / Kata / E2B / Fly Machines. Har session = ek disposable VM,
    apna VNC password, apna network namespace.
12. **noVNC auth ke peeche**: abhi websockify localhost pe hai; public deployment ke liye
    WSS + short-lived signed token + per-session subdomain chahiye.
13. **Egress policy**: default deny, sirf evidence hashing aur update ke endpoints allow, DNS proxy
    ke through — kyunki malware detonation mein egress hi data leak ka rasta hai.
14. **Observability**: session start/stop latency, boot failure rate, frame-load success rate,
    cost per session — Prometheus/OTel.
15. **Retention**: guest disk TTL, encrypted snapshot, delete-on-case-close.

---

## 5. Zero-cost vs. real isolation — options

| Option | Isolation | Cost | Effort | Honest verdict |
| --- | --- | --- | --- | --- |
| Third-party iframe (WebVM/v86) — *aaj jo hai* | **Koi nahi** (unka origin, unka trust) | ₹0 | done | Demo/pitch ke liye theek. Evidence ke liye nahi. |
| Self-host **v86** apne server pe (static assets) | Browser tab, aapka origin | ~₹0 (static) | 1 din | Bahut acha upgrade: same engine, par URL aur branding aapki, CSP control aapke paas |
| Self-host **CheerpX/WebVM** build | Browser tab, aapka origin | ₹0–low | 2–3 din | Best zero-cost compromise; WebVM open-source hai, build karke apne domain pe chalao |
| **WebContainers** (already hai) | Browser tab, StackBlitz runtime | license for commercial | done | Node.js ke liye acha, full Linux GUI nahi |
| Host Docker + noVNC (single tenant) | Host + unprivileged user | 1 VPS (~₹400–800/mo) | done | Aaj ka best "real desktop"; multi-user nahi |
| **microVM per session** (Firecracker/E2B/Fly) | Hardware-level, disposable | pay per second | 2–4 hafte | Yahi woh rasta hai jise "forensic sandbox" keh sakte ho |
| Managed (E2B / Daytona / Modal) | VM-level | free tier + usage | 3–5 din | Demo ke liye fastest serious path |

**Mera suggestion:** Phase 1 ke baad **self-hosted v86/WebVM** karo (₹0, aapka origin, CSP clean),
aur SIH demo ke liye ek optional **E2B microVM** card add karo — phir teeno cards honest hain:
*"free but weak", "our origin but browser-isolated", "real VM, paid"*.

---

## 6. Agent PC ke liye 12 concrete UX features (naam + kyun)

1. **Session timeline** — kaunsa command/screenshot kab hua, ek scrollable list (case export ke liye).
2. **Snapshot button** — screenshot + SHA-256 ek click mein case mein.
3. **Evidence tray** — drag karo analyst ke desktop se guest mein; auto hash + manifest.
4. **Read-only badge** — jab guest read-only mount pe chalta hai to permanent amber ribbon.
5. **Network switch** — "off / restricted / open" toggle, aur guest pe visible watermark.
6. **Idle countdown** — 15:00 → auto-stop, cost surprise nahi.
7. **"Why is this slow?" panel** — cores, memory, frame-load time, boot time — sab real numbers.
8. **Engine compare drawer** — capabilities table (already data ready hai `AGENT_ENGINES` mein).
9. **Resume last session** — IndexedDB mein session metadata; reboot pe "resume" vs "fresh".
10. **Keyboard palette (⌘K)** — Start, Stop, Snapshot, Fullscreen, Open tab.
11. **Error codes** — `ACP-401` (token), `ACP-FRAME` (framing blocked), `ACP-TIMEOUT`,
    `ACP-DEAD` — support/demo ke waqt instant diagnosis.
12. **Analyst notes per session** — guest ke andar kya dekha, case ke saath save.

---

## 7. Security checklist (Agent PC ke liye)

- [ ] Control plane sirf `127.0.0.1` pe, token ≥ 32 bytes, `timingSafeEqual` (✅ already hai)
- [ ] noVNC public internet pe **kabhi** na kholo bina WSS + token ke
- [ ] Session ke saath `VNC password` rotate karo, guest cleanup pe process kill + port close (✅ server karta hai)
- [ ] Guest egress default-deny; DNS proxy; private IP block (✅ `isPrivateIp` labcore mein hai)
- [ ] `frame-src` pinned, bare `https:` nahi (maine repo mein kar diya)
- [ ] `/api/*` pe rate limit + `Origin` allow-list
- [ ] Evidence transfer ke waqt hash verify, aur case mein log
- [ ] Screenshot/recording me **PII redaction** option (kyunki email body mein PII hota hai)

---

## 8. Chalane ka tarika

```bash
npm install
npm run dev                # http://localhost:5173  → Agent PC tab
npm run build && npm run lint
npm run verify:headers -- https://sudospandrsce.vercel.app

# optional: real host desktop (Ubuntu/Debian box, sudo chahiye)
sudo bash scripts/setup-agent-computer.sh
AGENT_COMPUTER_TOKEN=$(openssl rand -hex 32) node scripts/agent-computer-server.mjs
# .env.local
AGENT_COMPUTER_TARGET=http://127.0.0.1:8765
AGENT_COMPUTER_TOKEN=<same token>
```

---

## 9. Is change ki honest limits

- **Real browser pe test nahi hua** — sandbox mein headless Chrome nahi tha. Build, lint,
  header-check aur SSR render pass hain; actual click-through aapko karna hoga.
- **WebVM/v86 ka actual boot** third-party site pe depend karta hai; agar woh framing band kar dein
  to sirf "Open tab" bachega — isliye woh button permanent rakha hai.
- **axe accessibility scan nahi chalaya** — roles/labels sahi likhe hain, par automated proof nahi.
- **Host Docker path** yahan test nahi ho sakta (Vercel pe us server ka koi function hi nahi).
- Agent PC ka scope wahi rakha: **koi mailbox connect nahi, koi auto-action nahi**.
