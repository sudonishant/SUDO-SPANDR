import React, { useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ExternalLink, Globe2, Info, Loader2, Lock, Play, ScanLine,
  ShieldAlert, SquareArrowOutUpRight, XCircle,
} from 'lucide-react';

const SHORTENERS = /^(bit\.ly|tinyurl\.com|goo\.gl|rb\.gy|t\.co|is\.gd|shorturl\.at|ow\.ly)$/i;

/** Deterministic, browser-side URL checks. No network, no reputation lookup. */
export function staticUrlChecks(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return { flags: [], host: null, href: null, error: 'Enter a URL first.' };
  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { flags: ['URL parser rejected this value'], host: null, href: null };
  }
  const flags = [];
  if (parsed.protocol !== 'https:') flags.push('Not HTTPS — transport is unencrypted');
  if (parsed.username || parsed.password) flags.push('Credentials embedded in the URL');
  if (/%40|@/.test(value.replace(/^https?:\/\//i, '')) && !parsed.username) flags.push('“@” present in the path — possible redirect trick');
  if (parsed.hostname.includes('xn--')) flags.push('Punycode hostname — possible homoglyph domain');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)) flags.push('IP literal used instead of a hostname');
  if (parsed.hostname.split('.').length > 3) flags.push('Deep subdomain chain');
  if (SHORTENERS.test(parsed.hostname)) flags.push('Known link shortener — final destination is hidden');
  if (/(login|signin|verify|secure|auth|account|payment|invoice|update|wallet|seed)/i.test(`${parsed.hostname}${parsed.pathname}`)) {
    flags.push('Credential or payment themed host/path');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') flags.push(`Non-standard port ${parsed.port}`);
  if (parsed.hostname.length > 40) flags.push('Unusually long hostname');
  if (parsed.pathname.length > 120) flags.push('Very long path — often used to bury the real target');
  return { flags, host: parsed.hostname, href: parsed.href, protocol: parsed.protocol };
}

function Tone({ value }) {
  const text = String(value);
  if (/fail|blocked|suspicious|high|error|true|⚠️/i.test(text)) return <b className="bad">{text}</b>;
  if (/pass|low|clean|false|ok/i.test(text)) return <b className="ok">{text}</b>;
  return <b className="muted">{text}</b>;
}

export default function Sandbox() {
  const [url, setUrl] = useState('');
  const [local, setLocal] = useState(null);
  const [remote, setRemote] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | done | unavailable
  const [frameUrl, setFrameUrl] = useState('');
  const [frameLoading, setFrameLoading] = useState(false);
  const frameRef = useRef(null);

  const run = async (event) => {
    event?.preventDefault();
    const checks = staticUrlChecks(url);
    setLocal(checks);
    setRemote(null);
    setFrameUrl('');
    if (checks.error) { setState('idle'); return; }
    setState('loading');
    try {
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/v1/sandbox/detonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error(`Sandbox endpoint returned HTTP ${response.status}`);
      const payload = await response.json();
      setRemote(payload);
      setState('done');
    } catch (error) {
      setRemote({ error: error?.message || 'Sandbox endpoint unreachable.' });
      setState('unavailable');
    }
  };

  const openPreview = () => {
    if (!local?.href) return;
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    setFrameLoading(true);
    setFrameUrl(`${base}/api/v1/sandbox/preview-frame?url=${encodeURIComponent(local.href)}`);
    setTimeout(() => setFrameLoading(false), 1400);
  };

  const risk = remote?.risk_score;
  const reviewLabel = local?.flags?.length ? `${local.flags.length} browser-side structural warning${local.flags.length > 1 ? 's' : ''}` : 'No browser-side structural warning observed';

  return (
    <section className="section section--canvas" id="sandbox">
      <div className="wrap">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow"><b>01</b><span className="eyebrow__rule" />Sandbox</span>
            <h2 className="section__title">Open the link without opening it yourself.</h2>
          </div>
          <p className="section__note">
            Two layers: deterministic checks here in the tab, and an isolated browser detonation served by the
            backend container. Every answer is labelled with which layer produced it.
          </p>
        </div>

        <div className="sandbox reveal">
          <div className="window">
            <div className="window__bar">
              <span className="window__dot window__dot--r" />
              <span className="window__dot window__dot--y" />
              <span className="window__dot window__dot--g" />
              <span className="window__file">spandr-sandbox — isolated preview</span>
            </div>
            <form className="sandbox__form" onSubmit={run}>
              <div className="sandbox__bar">
                <Lock size={13} />
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://suspicious-link.example/login"
                  spellCheck="false"
                  aria-label="URL to inspect"
                />
                <button type="submit" className="app-btn app-btn--sm" disabled={!url.trim() || state === 'loading'}>
                  <span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#ff8a7a,#e4392f)' }}>
                    {state === 'loading' ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
                  </span>
                  {state === 'loading' ? 'Inspecting…' : 'Detonate'}
                </button>
              </div>
              <p className="sandbox__hint">
                Never paste live credentials. The isolated preview is fetched by the backend container, not by your browser.
              </p>
            </form>

            {local && !local.error && (
              <div className="sandbox__grid">
                <div className="sandbox__col">
                  <div className="panel__head">
                    <span className="panel__icon"><ScanLine size={14} /></span>
                    <div><small>Layer 1 · browser</small><h3>Static URL checks</h3></div>
                  </div>
                  <div className="kv"><span>Host</span><strong className="mono">{local.host}</strong></div>
                  <div className="kv"><span>Scheme</span><strong className="mono">{local.protocol}</strong></div>
                  <div className="kv"><span>Result</span><strong>{reviewLabel}</strong></div>
                  {local.flags.length ? (
                    <ul className="sandbox__flags">
                      {local.flags.map((flag) => <li key={flag}><AlertTriangle size={12} />{flag}</li>)}
                    </ul>
                  ) : (
                    <p className="sandbox__ok"><CheckCircle2 size={13} /> No structural warning. That is not a reputation or malware verdict.</p>
                  )}
                </div>

                <div className="sandbox__col">
                  <div className="panel__head">
                    <span className="panel__icon"><ShieldAlert size={14} /></span>
                    <div><small>Layer 2 · backend</small><h3>Detonation telemetry</h3></div>
                  </div>

                  {state === 'unavailable' && (
                    <div className="empty-panel">
                      <strong>Sandbox backend not reachable.</strong> {remote?.error} Nothing was fetched or executed —
                      the button only reports what the API returned.
                    </div>
                  )}

                  {state === 'done' && remote && (
                    <>
                      <div className="kv"><span>Status</span><Tone value={remote.status || 'unknown'} /></div>
                      <div className="kv"><span>Mode</span><Tone value={remote.mode || 'unknown'} /></div>
                      <div className="kv"><span>Risk score</span><Tone value={risk != null ? `${risk}/100` : 'not returned'} /></div>
                      <div className="kv"><span>DNS resolved</span><Tone value={String(Boolean(remote.dns_resolved))} /></div>
                      <div className="kv"><span>HTTP fetched</span><Tone value={String(Boolean(remote.http_fetched))} /></div>
                      <div className="kv"><span>Verdict</span><strong>{remote.threat_verdict || 'not returned'}</strong></div>
                      {remote.heuristic_flags?.length ? (
                        <ul className="sandbox__flags">
                          {remote.heuristic_flags.map((flag) => <li key={flag}><AlertTriangle size={12} />{flag}</li>)}
                        </ul>
                      ) : null}
                      {remote.note ? <p className="disclaimer">{remote.note}</p> : null}
                    </>
                  )}

                  {state === 'idle' && (
                    <div className="empty-panel">
                      Run a detonation to collect backend telemetry. Full DOM inspection, form capture and screenshots need the
                      Docker sandbox container (<code>docker compose up isolated-sandbox</code>, noVNC on <code>:7860</code>).
                    </div>
                  )}

                  {state === 'loading' && <div className="empty-panel">Asking the sandbox service…</div>}
                </div>
              </div>
            )}

            {local && !local.error && (
              <div className="sandbox__preview">
                <div className="sandbox__preview-head">
                  <div>
                    <small>ISOLATED PREVIEW</small>
                    <p>Fetched and sanitised by the backend, rendered inside this frame only.</p>
                  </div>
                  <div className="sandbox__preview-actions">
                    <button type="button" className="app-btn app-btn--sm" onClick={openPreview}>
                      <span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#7cc0ff,#2e7cf6)' }}><Globe2 size={13} /></span>
                      Load isolated preview
                    </button>
                    {frameUrl ? (
                      <a className="app-btn app-btn--sm" href={frameUrl} target="_blank" rel="noreferrer">
                        <span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#a7a7a7,#5b5b5b)' }}><SquareArrowOutUpRight size={13} /></span>
                        Open raw
                      </a>
                    ) : null}
                  </div>
                </div>

                {frameUrl ? (
                  <div className="sandbox__frame">
                    {frameLoading && <div className="sandbox__frame-loading"><Loader2 size={14} className="spin" /> Loading isolated render…</div>}
                    <iframe
                      ref={frameRef}
                      title="Isolated URL preview"
                      src={frameUrl}
                      sandbox="allow-scripts allow-same-origin"
                      referrerPolicy="no-referrer"
                      onLoad={() => setFrameLoading(false)}
                    />
                  </div>
                ) : (
                  <div className="sandbox__frame sandbox__frame--empty">
                    <XCircle size={16} />
                    <div>
                      <strong>Preview not loaded</strong>
                      <p>Press “Load isolated preview”. Nothing is fetched from the target until you do.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="window__foot">
              <span><Info size={11} style={{ display: 'inline', verticalAlign: '-2px' }} /> Air-gapped container path: docker compose up isolated-sandbox</span>
              <a href="https://github.com/sudonishant/SUDO-SPANDR#docker-deployment" target="_blank" rel="noreferrer" className="footer-link">
                Sandbox docs <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
