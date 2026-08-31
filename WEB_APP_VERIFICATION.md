# Web app verification notes

## Browser smoke tests

- The Vite app mounted successfully after moving the Node-oriented MSG reader to a lazy import.
- The intake UI shows three explicit modes: Email file (`.eml` + `.msg`), Text / headers, and Attachment.
- Pasted header/body flow was tested with a sample containing `Received`, `Authentication-Results`, `Reply-To`, urgency, credential language, and a review URL. The UI returned a heuristic triage score, observed signal list, header/auth tabs, and explicit limitations. It did not claim verified SPF/DKIM/DMARC or geolocation.
- Standalone attachment flow was tested with a harmless `verification-sample.txt` fixture. The UI displayed file-only evidence, SHA-256, size, detected type, static findings, and the explicit statement that no clean-malware verdict was made.
- The first direct import of `@kenjiuno/msgreader` caused a blank page because the package pulls Node-oriented `buffer`/`string_decoder` dependencies. The import was changed to lazy loading so initial app mount is not blocked; MSG parse errors are intended to be shown explicitly rather than fabricated.

## Build verification

- `npm ci` passed.
- `npm run build` passed after the changes.
- Vite still reports a browser compatibility warning from the lazy MSG reader chunk and a bundle-size warning; these are non-blocking but should be addressed in a future MSG-specific worker/server implementation.

## Additional verification

- The EML fixture parsed successfully as `RFC Email / EML`. The UI extracted From, To, Subject, public IP evidence from the Received field, reported SPF/DKIM/DMARC outcomes as reported/not independently verified, flagged the Reply-To mismatch and review URL, and showed the raw-byte SHA-256.

- An intentionally invalid `.msg` fixture was handled without crashing the app. The UI identified it as `Outlook MSG`, showed `Not available` for sender/recipient/subject, displayed the SHA-256 and size, and surfaced the parser error. No sender, body, route, or attachment metadata was fabricated.

## Vercel deployment verification

The Vercel project `cybersquadsce` is linked to `sudonishant/cybersquad-web` on the `master` branch. Deployment `dpl_5CyVecXYpF9j3vG1JqxR6EDugier` was created from commit `c42434f`, reached `READY` in production, and returned HTTP 200 through the Vercel deployment fetch path. Its build log shows `npm ci`, `npm run build`, and successful Vite output with no `buffer` or `string_decoder` compatibility warnings after the alias fix.

Normal unauthenticated browser navigation redirected to Vercel login because project SSO protection is enabled for non-custom domains. This is an access-control setting, not a deployment/build failure. The project’s effective protection configuration has password protection disabled, SSO enabled for all except custom domains, and no trusted-IP restriction.

## Advanced classification and AI verification

The frontend and backend now read the shared `shared/category_taxonomy.json` and expose the same category identifiers, evidence points, confidence-coverage label, alert levels, spam/bulk assessment, and recommended actions. Smoke tests passed for legitimate/corporate, promotional, phishing/BEC, and delivery/order examples. The backend API route registration and non-fabricating malformed-EML parser test also passed.

An optional user-triggered OpenRouter second-opinion route was added. The connector is enabled in the current Manus session, and the live OpenRouter models endpoint returned HTTP 200. A paid model request returned HTTP 402 and a free model request returned HTTP 429, so the app intentionally shows a transparent unavailable/configuration state rather than claiming AI output. In deployment, configure `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and `VITE_API_BASE_URL` on the secured backend/frontend environments.

The IP view now uses a motion-reduced-friendly animated evidence-order timeline for extracted header IPs. It does not draw a geographic route or infer a physical location.

## Supplied EML score correction

`Yourcode_872859.eml` is classified as `OTP / security alert`. Its submitted headers report SPF pass, DKIM pass, DMARC pass, and ARC-authenticated results, with an organizational-domain alignment between `accounts.linktr.ee` and `mail.accounts.linktr.ee`. The corrected evidence-aware model applies positive authentication/context adjustments instead of penalizing ordinary HTML asset and tracking URLs. Regression output: category `otp_security`, baseline 30, final triage score 0, and no high-risk alert. This is not a claim that the email content is guaranteed safe; the recommendation remains to use the official app/site and never share the OTP.

The AI configuration error was corrected by adding a same-origin `/api/v1/ai-review` Vercel function and excluding `/api/` from the SPA catch-all rewrite. The browser now calls same-origin by default; an external `VITE_API_BASE_URL` remains optional. If `OPENROUTER_API_KEY` is absent or OpenRouter is rate-limited, the UI shows a truthful unavailable state.

## Live Vercel AI-route fix

Vercel runtime logs showed that the first serverless implementation exported a default handler returning a Web `Response`, which the configured Vercel runtime ignored. The function was changed to the named `POST(request)` format. A local handler smoke test now returns HTTP 200 with the expected `not_configured` response when the key is intentionally blank. The production route had one prior request but no grouped runtime errors; after redeployment, recheck the route with a fresh AI-review click.


## Explainable scoring and unsupported-engine deactivation

The score response now contains a reconciled `score_breakdown` with observed contributors, each contributor's points and evidence, context deductions/adjustments, positive and adjustment totals, the arithmetic formula, and the final bounded score. The frontend renders this as “Why is the score this high?” for email, pasted text, headers, and standalone attachment flows; it is also included in JSON export and backend API output.

The following inactive or unsupported demo claims were removed rather than left dormant: CatBERT-v3, fuzzy/TLSH matching, simulated browser crawling, VirusTotal lookup, YARA scanning, STIX/TAXII publishing, honeypot/canary telemetry modules, BSA certificate generation, and legal/RBAC signing structures. The active implementation is limited to local parsing, deterministic category/rule scoring, static attachment inspection, submitted-header/IP evidence extraction, and optional server-side OpenRouter advisory review.

The portable EML regression now uses `EML_FIXTURE_PATH` when provided and skips cleanly when the private sample is absent. Validation passed: `npm run lint`, `npm run build`, category smoke tests, API/parser/score-ledger smoke tests, the supplied EML regression, Python compilation, and `git diff --check`. The supplied Linktree OTP regression reconciles as 30 observed points plus -50 context adjustments, bounded to a final triage score of 0; this remains a heuristic and not a safety guarantee.


## Latest deployment after score-ledger update

Commit `8c3daba` (“Deactivate unsupported engines and explain scores”) reached Vercel production as deployment `dpl_GZ9vzhRYDA4kVamPS2Y3xoVxBNmy`, state `READY`, from the GitHub `master` branch. The deployment fetch returned HTTP 200 and served the rebuilt Vite assets. Vercel build logs show `npm ci`, zero reported vulnerabilities, successful Vite compilation, and completed output deployment. The project’s SSO protection redirects unauthenticated API fetches to Vercel login, so the protected AI route was not invoked through an anonymous GET; use an authenticated project session and a POST from the app to test the configured OpenRouter key/quota. No AI output is claimed without a successful server-side response.


## Free-model OpenRouter routing

The live OpenRouter catalog was queried before selecting a model. `nvidia/nemotron-3-super-120b-a12b:free` returned HTTP 200 with valid strict JSON-schema output in a harmless smoke test, so it is now the primary free model. The route falls back to `openrouter/free`, `google/gemma-4-31b-it:free`, and `minimax/minimax-m3:free`; configured models are ignored unless they are explicitly free IDs. Each request has a bounded timeout and the route makes only a small finite number of attempts. HTTP 429 responses are returned as `rate_limited` and shown transparently in the UI; deterministic triage remains available.


## Full end-to-end audit corrections

The active FastAPI attachment inspector was rewritten to use actual submitted bytes. It now reports real signature bytes, detected type, actual size, actual Shannon entropy, filename/content markers, bounded heuristic risk, and an explicit scanner limitation. Empty input remains zero bytes with unavailable signature data; no default PDF bytes, invented entropy, or ransomware verdict is produced. The backend threat `signals` list now matches the score-ledger contributors, including scored URL, attachment, and header evidence.

The unreferenced stale AiTM similarity scanner and deep-AI compatibility alias were removed after audit. The current backend OpenRouter client and Vercel function use the same free-model-first routing and structured response contract. Local invocation of the exact Vercel handler with synthetic evidence returned an available structured response from `nvidia/nemotron-3-super-120b-a12b:free`.


## Production-browser parser fix

A live browser upload of the supplied EML exposed a real defect: the sender appeared unavailable because the parser decoded quoted-printable sequences across the entire raw message before splitting headers from the body, allowing DKIM base64 text to absorb the subsequent `From` header. The parser now preserves raw headers, decodes quoted-printable only in MIME body extraction and URL inspection, and correctly extracts `info@accounts.linktr.ee` from the supplied EML in local reproduction. The category remains OTP/security with a reconciled zero triage score based on explicit context deductions.


## Production OpenRouter configuration and timeout correction

The user added `OPENROUTER_API_KEY` as a Vercel Production Secret and triggered a Production redeploy. A synthetic browser request then showed the route was receiving the request but remained loading while sequential free-model attempts ran. The route was tightened to a 35-second total budget and at most two model attempts, while retaining the verified free NVIDIA primary and free-router fallback. This prevents a prolonged spinner and returns a truthful provider error or rate-limit state when the free provider is unavailable. Local invocation of the exact route still returned a structured response from `nvidia/nemotron-3-super-120b-a12b:free`.


## Final production AI verification

After the user configured `OPENROUTER_API_KEY` as a Vercel Production Secret and the bounded-time route deployment reached READY, a clean browser session submitted synthetic-only pasted evidence. The canonical production app returned a structured AI second opinion from `nvidia/nemotron-3-super-120b-a12b:free`, rendered the model name and `HUMAN REVIEW REQUIRED`, and displayed observation, risk summary, recommended action, model-reported confidence, and limitations. No private email data was sent in this verification request. The production OpenRouter connection is therefore verified end-to-end; free-provider rate limits remain possible and are handled with a truthful unavailable/rate-limited state.


## 2026-08-27 — authentication, multilingual AI, and approximate network-context audit

A second end-to-end code audit found that the browser authentication snapshot only consumed the plain `Authentication-Results` header. Inbox exports can instead expose `ARC-Authentication-Results`, `X-Authentication-Results`, `Received-SPF`, or signature-presence headers. The frontend and FastAPI snapshot now recognize all of these sources, show the source-header names and a bounded raw reported snippet, and label every value as receiver-reported/present/not verified. The audit regression passed against the supplied Inbox-exported EML and an ARC-only synthetic message; the supplied EML reports SPF pass, DKIM pass, DMARC pass, ARC evidence, and DKIM signature presence without claiming browser-side cryptographic or DNS verification.

The Vercel app now exposes an optional user-triggered `POST /api/v1/ip-context` endpoint. It sends only extracted public header IPv4 addresses to public RDAP registration data and returns conservative network organization, registered country/range when supplied, and heuristic likely network type. It explicitly does not return exact physical location, sender attribution, or person identity. The research boundary follows [RFC 7601](https://www.rfc-editor.org/rfc/rfc7601/), [RFC 9082](https://www.rfc-editor.org/rfc/rfc9082/), IANA RDAP bootstrap registries, and MaxMind's geolocation-accuracy guidance.

The AI panel now accepts an optional question about the current evidence. The server-side OpenRouter prompt detects Devanagari, Bengali, Arabic, Cyrillic, Hinglish vocabulary, and ordinary English cues, asks the selected free model to answer in the user's language/style, and preserves the strict cautious JSON schema. No client-side secret is used and deterministic triage remains authoritative.

Validation passed: frontend authentication regression, mocked multilingual AI-route schema test, live RDAP route test using a public test IP, Vercel route syntax checks, `npm run lint`, `npm run build`, backend API/category/attachment/parser/score-ledger tests, portable supplied-EML regression, Python compilation, and `git diff --check`.


## 2026-08-27 — live IP extraction correction

The production Relay path audit exposed that the original permissive IPv4 regular expression could extract a timestamp fragment such as `08.25.13.40` or `25.13.40.43` from a Gmail `Received` date. The frontend extractor now uses strict octet grammar plus digit/dot boundaries; the RDAP endpoint applies the same strict validation. The supplied EML regression now requires the only extracted public header IP to be `206.55.150.5`, and the complete validation suite passes after this correction.

## 2026-08-27 — multilingual AI claim-safety correction

A corrected direct production smoke test used the route's required nested `evidence` envelope and synthetic-only content. The free OpenRouter route returned the expected structured fields and `response_language: Hinglish`, but the model text included unsupported certainty/attribution language such as “definitely phishing”, “fake DNS”, and “safe to click”. This output was treated as a real quality defect, not a valid verdict.

The Vercel route now applies a post-generation guard to reject incomplete or unsupported AI assertions before rendering them, then tries the bounded free-model fallback. The mirrored FastAPI client applies the same guard and the prompts now explicitly prohibit certainty, DNS ownership, exact location, malware-clean claims, and click/open assurances. If the provider still returns an unsafe or incomplete object, the app reports that no AI verdict was generated and leaves deterministic triage authoritative.

Local validation after this correction passed the focused JavaScript claim-guard regression, serverless syntax checks, forensic-claim lint, frontend build, FastAPI smoke suite, supplied-EML regression, Python compilation, and `git diff --check`. A fresh production smoke test after the next deployment is required before claiming the corrected multilingual response is live.

## 2026-08-27 — post-deployment multilingual AI verification

Commit `ec9b2c8` deployed to the canonical Vercel production project as READY deployment `dpl_4JmLfQ5FGs7MM9WZSSDZaY5aWjaB`. A synthetic Hinglish question returned `status: available`, the free NVIDIA primary model, `response_language: Hinglish`, and a cautious answer grounded in the supplied score signals. A separate synthetic Devanagari question returned `status: available`, the same free primary model, `response_language: Hindi`, and a cautious Hindi explanation with independent verification and human review guidance.

A subsequent identical synthetic call returned a truthful `upstream_error` after the bounded free-model attempts because the provider returned no structured content. This confirms that free-model availability is intermittent and not unlimited; the route withholds an AI verdict rather than fabricating one. The frontend already renders the corresponding unavailable state while deterministic triage remains available.

## 2026-08-27 — steganography claim removal and concatenated-file correction

The repository audit found no active steganography engine to preserve; the attachment workflow is now explicitly documented as not performing steganography or hidden-payload detection. The submitted `/home/ubuntu/upload/output.jpg` was reproduced without opening the image: it is 40,909 bytes, begins as JPEG, has a JPEG end marker at offset `1970`, and contains a `%PDF-` signature at offset `1972` followed by `%%EOF` near the file end. The previous inspector returned LOW / score 0 because it stopped at the first JPEG type signature.

The frontend and FastAPI inspectors now report non-whitespace bytes after a recognized JPEG, PNG, or PDF boundary and recognize a known secondary signature only when it begins at the first non-whitespace byte after that boundary. The real sample now reports `JPEG image`, `MEDIUM`, score `60`, trailing bytes `38937`, and a secondary `PDF` signature at offset `1972`. The finding is explicitly called a format-boundary anomaly / concatenated or multi-format file; it does not claim steganography or malware. A simplistic GIF end-marker heuristic was intentionally excluded to avoid a new false positive.

The private user sample is used only as an external local regression fixture and is not committed to the repository. Synthetic regression coverage also verifies the same behavior without private data.

## 2026-08-27 — live browser confirmation of concatenated-file fix

After deployment `dpl_9hg841yPrnDUJndm2gqbgMgNbzHZ` reached READY, the actual uploaded `output.jpg` was tested in the canonical production app’s separate standalone Attachment workflow. The UI reported `REVIEW`, score `60`, `JPEG image`, `40909 bytes`, the JPEG boundary at offset `1970`, and a PDF signature at offset `1972`. It showed the two observed signals and explicitly stated that this is a format-boundary anomaly / concatenated or multi-format observation, not steganography detection. No steganography verdict was displayed.

## 2026-08-27 — AI no-content compatibility fallback

Production logs showed `POST /api/v1/ai-review` returning `502` with bounded attempts when a free model returned HTTP 200 but no readable structured content. This was a provider/model response-format compatibility issue, not a reason to fabricate an answer. The Vercel route now extracts string or content-array responses, accepts fenced JSON only after parsing, validates every field and unsupported-claim guard, and performs one same-model compatibility retry without `response_format` when the first response has no readable content or invalid JSON. The FastAPI draft mirrors this behavior.

Local JavaScript and Python regressions simulate null content followed by a content-array fenced JSON response. They confirm the first request uses strict schema formatting, the compatibility retry omits it, the language field is preserved, and unsafe claims remain rejected. If both attempts fail, the route still returns an explicit unavailable/error state and deterministic triage remains authoritative.

## 2026-08-27 — live AI no-content fallback confirmation

Deployment `dpl_EREaYYeZMbfLtYbVsduihvtKtk8k` for the deterministic-fallback build reached READY. A synthetic-only production request still received no usable OpenRouter content and correctly returned HTTP `502` with `status: upstream_error`, but now also returned a `fallback` object. The fallback was explicitly Hinglish, identified itself as not an AI answer, repeated the deterministic `71/100` score and supplied signals, required independent verification/human review, and preserved the provider error. The UI renders this fallback as `Deterministic explanation — not an AI response` and offers `Try AI again`; no private email evidence was sent.
