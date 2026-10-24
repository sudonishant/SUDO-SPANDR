import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Lock, RotateCw, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { staticUrlChecks } from '../lib/urlChecks';

const SPEC = [
  ['host', 'spandr-sbx-01'],
  ['kernel', '6.8.0-hardened'],
  ['chromium', '131.0.6778'],
  ['display', '1280 × 720 · headless'],
  ['egress', 'BLOCKED'],
];

function stamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export default function SandboxApp() {
  const [url, setUrl] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | loading | done | unavailable
  const [local, setLocal] = React.useState(null);
  const [remote, setRemote] = React.useState(null);
  const [frameHtml, setFrameHtml] = React.useState('');
  const [frameTarget, setFrameTarget] = React.useState('');
  const [frameLoading, setFrameLoading] = React.useState(false);
  const [frameError, setFrameError] = React.useState('');
  const [log, setLog] = React.useState([{ t: stamp(), text: 'vm booted · network namespace isolated' }]);

  const addLog = (text) => setLog((lines) => [...lines, { t: stamp(), text }].slice(-40));

  const detonate = async (event) => {
    event?.preventDefault();
    const checks = staticUrlChecks(url);
    setLocal(checks);
    setRemote(null);
    setFrameHtml('');
    setFrameError('');
    setFrameTarget('');
    if (checks.error) { setState('idle'); return; }
    setState('loading');
    addLog(`resolving target ${checks.host}`);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/v1/sandbox/detonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setRemote(payload);
      setState('done');
      addLog(`detonation ok · mode=${payload.mode || 'unknown'} · risk=${payload.risk_score ?? 'n/a'}`);
    } catch (error) {
      setRemote({ error: error?.message || 'unreachable' });
      setState('unavailable');
      addLog(`detonation failed · ${error?.message || 'unreachable'} — no fetch performed`);
    }
  };

  const loadPreview = async () => {
    if (!local?.href) return;
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    setFrameLoading(true);
    setFrameError('');
    setFrameTarget(local.href);
    addLog('requesting sanitised DOM snapshot from preview-frame');
    try {
      const response = await fetch(`${base}/api/v1/sandbox/preview-frame?url=${encodeURIComponent(local.href)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      setFrameHtml(html);
      addLog(`snapshot received · ${(html.length / 1024).toFixed(1)} KB of sanitised HTML`);
    } catch (error) {
      setFrameHtml('');
      setFrameError(error?.message || 'unreachable');
      addLog(`snapshot unavailable · ${error?.message || 'unreachable'}`);
    } finally {
      setFrameLoading(false);
    }
  };

  const risk = remote?.risk_score;
  const flags = [...(local?.flags || []), ...(remote?.heuristic_flags || [])];
  const host = local?.host || new URL('https://example.com').hostname;

  return (
    <div className="vm">
      <div className="vm__main">
        <form className="vm__toolbar" onSubmit={detonate}>
          <div className="vm__nav">
            <button type="button" title="Back"><RotateCw size={12} style={{ transform: 'scaleX(-1)' }} /></button>
            <button type="button" title="Forward"><RotateCw size={12} /></button>
            <button type="button" title="Reload" onClick={loadPreview}><RotateCw size={12} /></button>
          </div>
          <div className="vm__url">
            {local?.protocol === 'http:' ? <WifiOff size={11} style={{ color: '#ff97a3' }} /> : <Lock />}
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="type a URL to detonate — https://suspicious-link.example/login"
              spellCheck="false"
              aria-label="URL to detonate"
            />
          </div>
          <button type="submit" className="btn btn--primary btn--sm" disabled={state === 'loading' || !url.trim()}>
            {state === 'loading' ? <Loader2 size={11} className="spin" /> : <ShieldAlert size={11} />}
            {state === 'loading' ? 'Detonating…' : 'Detonate'}
          </button>
          <button type="button" className="btn btn--sm" onClick={loadPreview} disabled={!local?.href}>
            <RotateCw size={11} /> Render
          </button>
        </form>

        <div className="vm__screen">
          <div className="vm__screen-grid" />
          <div className="vm__stage">
          <div className="vm__browser">
            <div className="vm__browser-bar">
              <div className="vm__browser-lights"><i /><i /><i /></div>
              <div className="vm__tab"><Lock size={8} />{frameTarget ? host : 'about:blank'}</div>
            </div>
            <div className="vm__browser-address">
              {local?.protocol === 'http:' ? <WifiOff className="lock" style={{ color: '#ff97a3' }} /> : <Lock className="lock" />}
              <code>{local?.href || url || 'no target loaded'}</code>
            </div>
            <div className="vm__browser-body">
              {frameError ? (
                <div className="vm__splash">
                  <AlertTriangle size={16} style={{ color: '#ff6b7a' }} />
                  <h4>Snapshot unavailable</h4>
                  <p>The preview service did not return a page ({frameError}). Static URL checks above are still real; nothing was fetched from your browser.</p>
                  <button type="button" className="btn btn--sm" onClick={loadPreview}><RotateCw size={11} /> Retry</button>
                </div>
              ) : frameHtml ? (
                <iframe
                  title="Isolated detonation preview"
                  srcDoc={frameHtml}
                  sandbox="allow-scripts"
                  referrerPolicy="no-referrer"
                  onLoad={() => addLog('snapshot rendered inside the isolated frame')}
                />
              ) : frameLoading ? (
                <div className="vm__splash">
                  <Loader2 size={16} className="spin" style={{ color: '#ff97a3' }} />
                  <h4>Fetching isolated snapshot</h4>
                  <p>The backend container requests the page; your browser never contacts the target.</p>
                </div>
              ) : (
                <div className="vm__splash">
                  <ShieldAlert size={18} style={{ color: '#ff6b7a' }} />
                  <h4>Isolated browser ready</h4>
                  <p>
                    Enter a link above. Static checks run here instantly; detonation telemetry comes from the
                    container, and the DOM snapshot is rendered inside this frame only.
                  </p>
                  <span className="chip chip--red">air-gapped</span>
                </div>
              )}
            </div>
          </div>
          </div>

          <div className="vm__taskbar">
            <span className="vm__start"><ShieldAlert size={9} /> SPANDR</span>
            <span className="vm__task"><Lock size={9} /> isolated-browser</span>
            <span className="spacer" />
            <span className="vm__tray">{state === 'done' ? <Wifi size={9} /> : <WifiOff size={9} />} {stamp()}</span>
          </div>
        </div>
      </div>

      <aside className="vm__console">
        <div className="vm__console-head">
          <strong>Machine console</strong>
          <span className={`chip ${state === 'done' ? 'chip--red' : state === 'unavailable' ? 'chip--amber' : ''}`}>
            {state === 'done' ? 'detonated' : state === 'unavailable' ? 'backend offline' : state === 'loading' ? 'running' : 'standby'}
          </span>
        </div>
        <div className="vm__console-body">
          {SPEC.map(([key, value]) => (
            <div className="vm__spec" key={key}><span>{key}</span><b>{value}</b></div>
          ))}

          <div className="vm__gauge">
            <div>
              <strong style={{ color: risk >= 60 ? '#ff6b7a' : risk >= 30 ? '#f3d37a' : '#f4f1ef' }}>{risk != null ? risk : '—'}</strong>
              <small>risk / 100</small>
            </div>
            <div className="vm__gauge-bar"><i style={{ width: `${risk ?? 0}%` }} /></div>
          </div>

          {state === 'unavailable' && (
            <div className="vm__flag"><AlertTriangle size={11} /> Backend unreachable ({remote?.error}). Nothing was fetched or executed.</div>
          )}

          {local && !local.error && (
            <div className="vm__flags">
              {flags.length ? flags.map((flag) => (
                <div className="vm__flag" key={flag}><AlertTriangle size={11} />{flag}</div>
              )) : (
                <div className="vm__flag ok"><CheckCircle2 size={11} /> No structural warning — not a reputation verdict.</div>
              )}
            </div>
          )}

          {state === 'done' && remote?.threat_verdict ? (
            <p className="hint">{remote.threat_verdict}</p>
          ) : null}

          <div className="vm__log">
            {log.map((line, index) => (
              <span key={`${line.t}-${index}`}><i>{line.t}</i> <b>›</b> {line.text}</span>
            ))}
          </div>
        </div>
        <div className="vm__foot">
          <span>docker compose up isolated-sandbox</span>
          <a href="https://github.com/sudonishant/SUDO-SPANDR#docker-deployment" target="_blank" rel="noreferrer">docs ↗</a>
        </div>
      </aside>
    </div>
  );
}
