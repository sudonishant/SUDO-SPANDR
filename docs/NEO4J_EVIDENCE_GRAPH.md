# Neo4j evidence graph and real IP-based map

Updated: 2026-10-30

## Implemented behavior

### Evidence graph

The React **Evidence graph** tab is an explicit, separate action. It does not send the raw email or silently project a case during parsing. A successful panel means that the configured FastAPI backend completed a parameterized Neo4j write, committed it, queried the case subgraph and matched the returned node/relationship IDs against the projection.

The drawing and node inspector are renderings of that **database readback**. Generated Cypher text, a client-side preview, or a “synced” label is not accepted as success. Missing configuration, an unavailable database, or a readback mismatch produces an honest non-success state and no graph nodes.

The graph is evidence-scoped. It contains no inferred origin, campaign, `ATTRIBUTED_TO`, sender-control, ownership, or maliciousness relationship. Reported SPF/DKIM/DMARC/ARC results remain submitted receiver reports, not independent DNS or cryptographic verification.

### Real map

The Relay path uses Leaflet 1.9.4 and OpenStreetMap tiles. Numbered markers correspond to the IP evidence list and are created only from valid explicit-provider latitude/longitude pairs. There is no registration-country centroid, analyst/device-IP fallback, exact-sender claim, or geographic relay route.

OpenStreetMap attribution and a tile-request privacy disclosure are visible. The tile service can receive the browser IP, request metadata and requested map/tile area. Tile errors show a warning; IP rows and valid provider-coordinate markers are retained. An IP without coordinates remains in the evidence list without a marker.

## Graph data boundary

Only this strict payload is accepted by `POST /api/v1/evidence-graph`:

| Field | Content / constraint |
|---|---|
| `case_id`, `evidence_sha256` | Hash-bound `CS-…` or `FILE-…` case identity |
| `source_mode`, `triage_score`, category | Bounded analysis metadata |
| `sender`, `recipient` | Normalized email addresses without display names |
| `ips` | Up to 20 IP/field observations; no coordinates required |
| `urls` | Up to 20 HTTP(S) URLs; query/fragment are removed by the browser and rejected if submitted directly; userinfo is removed by the browser and rejected by the backend |
| `attachments` | Up to 20 filename/hash/size/type/risk metadata records, never file bytes |
| `reported_auth` | Up to 40 method/result/identity-domain/alignment/receiver/header-index summaries; no raw authentication header or evidence paragraph |

The browser payload builder is an allowlist, and the Pydantic backend model forbids extra properties. Subject, body, raw EML/MSG, arbitrary headers, attachment bytes, REA output, AI output, map coordinates and Neo4j credentials are not graph inputs. URL paths are retained and can still contain sensitive values; review the disclosure before projecting a case.

Nodes include case, claimed sender, recipient, domain, IP, URL, attachment and reported-auth kinds. Relationships include `HAS_CLAIMED_SENDER`, `HAS_RECIPIENT`, `OBSERVED_DOMAIN`, `OBSERVED_HEADER_IP`, `CONTAINS_URL`, `HAS_ATTACHMENT`, `HAS_REPORTED_AUTH_RESULT`, and domain/auth sub-relationships. All nodes carry the case ID; re-projection deletes and rebuilds only that case's subgraph.

## Configuration

Install backend dependencies and use a supported Neo4j 5.x server (Neo4j 5.26 requires Java 17 or 21):

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt

export NEO4J_URI='neo4j+s://your-private-instance.example'
export NEO4J_USER='your-database-user'
export NEO4J_PASSWORD='your-server-side-secret'
export NEO4J_DATABASE='neo4j'
.venv/bin/uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

For a **disposable loopback-only test instance** with Neo4j authentication disabled, `NEO4J_AUTH_DISABLED=true` is accepted only when the URI points to localhost/loopback. Do not use that mode for a deployed or shared database. Credentials and connection details stay in backend environment variables; they are not returned to the browser.

For the deployed React app, configure its existing backend proxy as well:

```bash
export BACKEND_ORIGIN='https://your-private-fastapi-backend.example'
```

The browser posts to `/api/v1/analyze-eml?operation=graph`. The existing serverless function forwards that operation to `/api/v1/evidence-graph`, so the Vercel budget remains **12/12 functions**. Local Vite uses the same browser route and rewrites it to FastAPI. Its local IP-context middleware executes the same real `api/v1/ip-context.js` provider handler rather than injecting mocked coordinates.

A local Neo4j/Neo4j Aura connection is not evidence of public deployment availability. Backend reachability, TLS, database retention, backups, network policy and the deployed proxy must be verified independently. Before exposing sensitive cases to untrusted users, add authenticated per-user authorization, quotas and retention controls; a case ID is not an authorization boundary.

## Verification

Run the non-database regressions and the real integration gate:

```bash
npm test
npm run lint
npm run check:functions
npm run build
PYTHONPATH=backend .venv/bin/python backend/security_test.py

# Requires a real configured Neo4j instance:
PYTHONPATH=backend .venv/bin/python backend/neo4j_integration_test.py
```

Verified locally on 2026-10-30:

- Real Neo4j 5.26.0 write/readback, idempotent re-projection and case isolation passed.
- The original submitted case `CS-5956E2BC7DFC` retained score **16**, category **Unknown / insufficient evidence**, three reported SPF-softfail nodes and its original SHA-256. Its graph returned **10 nodes and 13 relationships** from Neo4j readback.
- Browser, Vite proxy and the reused serverless proxy each completed the real graph operation. The outbound browser payload had only the documented allowlist keys.
- Live `ipwho.is` returned valid approximate coordinates for one original header IP; the second IP stayed visible without coordinates or a marker. Seventeen non-blocked OSM tile responses were observed with zero failed tile requests in the successful run.
- Separate failure checks passed: aborted tiles showed the tile warning while retaining provider/IP evidence; stopping Neo4j produced an unavailable state with zero graph nodes.
- Six graph/map axe states reported zero detected violation rules. Node **16/16**, claim lint **55 files**, build and serverless budget **12/12** also passed.

These are local verification results, not a new public deployment, certification, exact-geolocation finding or legal-admissibility claim.
