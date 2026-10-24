/*
 * Real Browser — Browserling-style remote browsing with a transparent
 * network data-flow log ("kaha kaha data ja raha hai, kis tarah se").
 *
 *  · Live VM mode  — streams the REAL Chromium from the air-gapped sandbox
 *                    container over noVNC (docker compose up isolated-sandbox)
 *  · Safe Snapshot — sanitised DOM rendered locally; your browser never
 *                    contacts the target
 *  · Flow Log      — every hop the analysis makes: DNS → TCP → HTTP method /
 *                    path → redirect chain → what data would leave the device
 */
import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Globe, Loader2, Lock, MonitorPlay, Network, Radio, RefreshCw, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { staticUrlChecks } from '../lib/urlChecks';

const SAMPLE = 'http://paypa1-secure.com/verify?id=8842';

function FlowRow({ hop }) {
  const icon = {
    local: <ShieldAlert size={11} />, dns: <Network size={11} />, http: <Globe size={11} />,
    data: <ArrowRight size={11} />, page: <AlertTriangle size={11} />, error: <WifiOff size={11} />,
    ok: <CheckCircle2 size={11} />,
  }[hop.kind] || <Radio size={11} />;
  return (
    <div className={`flowrow flowrow--${hop.kind}`}>
      <i className="flowrow__t">{hop.t}</i>
      <span className="flowrow__icon">{icon}</span>
      <span className="flowrow__tag">{hop.kind.toUpperCase()}</span>
      <span className="flowrow__text">{hop.text}</span>
    </div>
  );
}

export default function BrowserApp() {
  const [url, setUrl] = React.useState('');
  const [mode, setMode] = React.useState('live'); // live | snapshot
  const [busy, setBusy] = React.useState(false);
  const [flow, setFlow] = React.useState([]);
  const [checks, setChecks] = React.useState(null);
  const [deep, setDeep] = React.useState(null);
  const [frameHtml, setFrameHtml] = React.useState('');
  const [vncUp, setVncUp] = React.useState(null); // null unknown, true/false
  const [error, setError] = React.useState('');

  const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
  const push = (kind, text) => setFlow((f) => [...f.slice(-60), { t: stamp(), kind, text }]);

  React.useEffect(() => {
    // probe whether the real VM (noVNC websocket endpoint) is alive
    const probe = async () => {
      try {
        const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/novnc/websockify`);
        const timer = setTimeout(() => { try { ws.close(); } catch (e) {} }, 2500);
        ws.onopen = () => { clearTimeout(timer); setVncUp(true); try { ws.close(); } catch (e) {} };
        ws.onerror = () => { clearTimeout(timer); setVncUp(false); };
      } catch {
        setVncUp(false);
      }
    };
    probe();
  }, []);

  const open = async () => {
    const target = url.trim() || SAMPLE;
    if (!url.trim()) setUrl(SAMPLE);
    setBusy(true); setError(''); setDeep(null); setFlow([]);
    push('local', `static URL inspection started for ${target} (no packet leaves this browser yet)`);
    const checks = staticUrlChecks(target);
    setChecks(checks);
    if (checks.error) {
      push('error', checks.error);
      setBusy(false);
      return;
    }
    push('ok', `parsed host ${checks.host} · scheme ${checks.protocol}`);
    (checks.flags || []).forEach((f) => push('page', `static flag: ${f}`));

    push('http', `delegating live fetch to the analysis engine (server-side), target ${checks.href}`);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/v1/sandbox/lab/url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: checks.href }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setDeep(payload);

      // ---- network data-flow reconstruction ----
      if (payload.resolved_ips?.length) {
        push('dns', `DNS ${payload.host} → ${payload.resolved_ips.join(', ')}`);
      } else {
        push('dns', `DNS ${payload.host} did not resolve (domain may be dead or sinkholed)`);
      }
      (payload.structure_signals || []).forEach((s) => push('page', s));
      (payload.redirect_chain || []).forEach((hop, i) => {
        push('http', `hop ${i + 1}: GET ${hop.url} → ${hop.status}${hop.location ? ` · redirects to ${hop.location}` : ''}`);
        if (hop.location) push('data', `browser would follow to ${hop.location} (automatic, no user consent per hop)`);
      });
      if (payload.page?.password_field) {
        push('page', 'page contains a PASSWORD FIELD — any credentials typed here would be POSTed to the page owner');
        push('data', 'what would leave the device on submit: username + password in HTTP body');
      }
      if (payload.page?.obfuscation?.length) {
        push('page', `obfuscation markers: ${payload.page.obfuscation.join(', ')}`);
      }
      if (payload.page?.meta_refresh) push('http', 'meta-refresh redirect present (silent navigation)');
      if (payload.tls_cert) push('ok', `TLS certificate observed:\n${String(payload.tls_cert).split('\n')[0]}`);
      push('ok', `verdict: risk ${payload.risk_score}/100 — ${payload.verdict}`);

      // snapshot render if available
      if (mode === 'snapshot') {
        push('local', 'requesting sanitised DOM snapshot (guest fetches the page — not your browser)');
        const snap = await fetch(`${base}/api/v1/sandbox/preview-frame?url=${encodeURIComponent(checks.href)}`);
        if (snap.ok) setFrameHtml(await snap.text());
        else push('error', `snapshot service returned HTTP ${snap.status}`);
      }
    } catch (e) {
      setError(e?.message || 'engine unreachable');
      push('error', `analysis engine unreachable (${e?.message || 'error'}) — static checks above are still real`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="browserapp">
      <div className="browserapp__bar">
        <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Browser mode">
          <option value="live">🖥 Live VM · real Chromium (noVNC)</option>
          <option value="snapshot">🛡 Safe snapshot · sanitised DOM</option>
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
          placeholder="https://suspicious-link.example/login"
          spellCheck="false"
          aria-label="URL to open"
        />
        <button type="button" className="btn btn--primary btn--xs" onClick={open} disabled={busy}>
          {busy ? <Loader2 size={10} className="spin" /> : <Globe size={10} />} Open &amp; trace
        </button>
        <button type="button" className="btn btn--xs" onClick={() => { setUrl(SAMPLE); }}><RefreshCw size={10} /> Sample</button>
      </div>

      <div className="browserapp__main">
        <div className="browserapp__view">
          {mode === 'live' ? (
            vncUp === false ? (
              <div className="browserapp__splash">
                <MonitorPlay size={26} style={{ color: '#ff97a3' }} />
                <strong>Real VM is offline</strong>
                <p>
                  The live Chromium desktop streams from the air-gapped sandbox container.
                  Start it with <code>docker compose up isolated-sandbox</code>, or use
                  <b> Safe snapshot</b> mode — the analysis engine fetches the page server-side
                  and renders a sanitised DOM; your browser never contacts the target.
                </p>
                <button type="button" className="btn btn--xs" onClick={() => setMode('snapshot')}>Switch to safe snapshot</button>
              </div>
            ) : (
              <iframe
                title="Real Chromium (noVNC)"
                className="browserapp__frame"
                src="/novnc/vnc.html?autoconnect=true&resize=scale&path=novnc/websockify&view_only=0"
                sandbox="allow-scripts allow-same-origin"
              />
            )
          ) : frameHtml ? (
            <iframe
              title="Isolated snapshot"
              className="browserapp__frame"
              srcDoc={frameHtml}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="browserapp__splash">
              <Globe size={26} style={{ color: '#ff97a3' }} />
              <strong>{checks?.href ? 'Ready to render snapshot' : 'Isolated browser'}</strong>
              <p>
                {checks?.href
                  ? 'Press Open & trace to fetch the sanitised DOM snapshot inside this window.'
                  : 'Type a URL and press Open & trace. Static checks run locally; live fetches happen in the analysis engine.'}
              </p>
            </div>
          )}
        </div>

        <aside className="browserapp__flow">
          <div className="browserapp__flow-head">
            <Network size={11} /> DATA FLOW LOG
            <span className="chip" style={{ marginLeft: 'auto' }}>{flow.length} events</span>
          </div>
          {checks && (
            <div className="browserapp__chain">
              <span className="chain-node">you</span><ArrowRight size={9} />
              <span className="chain-node">DNS</span><ArrowRight size={9} />
              <span className="chain-node mono">{deep?.resolved_ips?.[0] || checks.host}</span><ArrowRight size={9} />
              <span className="chain-node mono">{checks.protocol === 'https:' ? '443 · TLS' : '80 · cleartext'}</span>
            </div>
          )}
          <div className="browserapp__flow-list">
            {flow.length === 0 && (
              <div className="browserapp__flow-empty">
                <Wifi size={13} /> every request will be logged here — where the data goes and how it gets there.
              </div>
            )}
            {flow.map((hop, i) => <FlowRow key={`${hop.t}-${i}`} hop={hop} />)}
          </div>
          {deep && (
            <div className="browserapp__verdict">
              <span>RISK</span>
              <b style={{ color: deep.risk_score >= 70 ? '#ff6b7a' : deep.risk_score >= 40 ? '#f3d37a' : '#9fe9bd' }}>{deep.risk_score}/100</b>
              <small>{deep.verdict}</small>
            </div>
          )}
          {error && <div className="browserapp__err"><WifiOff size={11} /> {error}</div>}
          <div className="browserapp__disclaimer">
            <Lock size={9} /> Live mode streams a real remote browser. Snapshot mode never touches the target from your device. {vncUp === true ? <span style={{ color: '#9fe9bd' }}>· VM online</span> : vncUp === false ? <span style={{ color: '#f3d37a' }}>· VM offline</span> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
