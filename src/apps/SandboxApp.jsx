import React from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Cpu, Globe, Loader2, Lock, Power, RotateCw,
  ShieldAlert, TerminalSquare, Wifi, WifiOff, X,
} from 'lucide-react';
import { staticUrlChecks } from '../lib/urlChecks';

const GUEST_APPS = {
  browser: { title: 'Chromium · air-gapped', short: 'Chromium', icon: Globe, x: 33, y: 5, w: 61, h: 63 },
  monitor: { title: 'System Monitor', short: 'Monitor', icon: Activity, x: 57, y: 20, w: 40, h: 52 },
  terminal: { title: 'guest@spandr-sbx:~', short: 'Terminal', icon: TerminalSquare, x: 2, y: 50, w: 47, h: 43 },
};

const SAMPLE_TARGET = 'http://paypa1-secure.com/verify?id=8842';

const BOOT_LINES = [
  'spandr virtual machine · qemu-kvm boot',
  'kernel 6.8.0-hardened · clocksource tsc',
  'net: eth0 10.0.2.15/24 · egress blocked by policy',
  'mounting evidence ro /evidence',
  'starting gui session · chromium sandboxed',
];

function stamp(date = new Date()) {
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

function useGuestClock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function useResources(running) {
  const [res, setRes] = React.useState({ cpu: 7, mem: 22, net: 0, uptime: 0 });
  React.useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setRes((prev) => ({
        cpu: Math.max(3, Math.min(96, Math.round(prev.cpu + (Math.random() - 0.5) * (running ? 26 : 7)))),
        mem: Math.max(18, Math.min(84, Math.round(prev.mem + (Math.random() - 0.5) * 5))),
        net: running ? Math.min(100, prev.net + Math.round(Math.random() * 22)) : Math.max(0, prev.net - 9),
        uptime: Math.floor((Date.now() - started) / 1000),
      }));
    }, 1600);
    return () => clearInterval(timer);
  }, [running]);
  return res;
}

function Meters({ res, running }) {
  const rows = [
    ['cpu', res.cpu, `${res.cpu}%`],
    ['mem', res.mem, `${res.mem}%`],
    ['net', res.net, res.net ? `${res.net} kbps` : 'idle'],
  ];
  return (
    <div className="vm__meters">
      {rows.map(([key, value, label]) => (
        <div className="vm__meter" key={key}>
          <span>{key}</span>
          <div className="vm__meter-bar"><i style={{ width: `${value}%`, background: key === 'net' && running ? 'linear-gradient(90deg,#f7ce46,var(--red))' : undefined }} /></div>
          <b>{label}</b>
        </div>
      ))}
    </div>
  );
}

export default function SandboxApp() {
  const clock = useGuestClock();
  const screenRef = React.useRef(null);
  const dragRef = React.useRef(null);

  const [url, setUrl] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | loading | done | unavailable
  const [local, setLocal] = React.useState(null);
  const [remote, setRemote] = React.useState(null);
  const [frameHtml, setFrameHtml] = React.useState('');
  const [frameLoading, setFrameLoading] = React.useState(false);
  const [frameError, setFrameError] = React.useState('');
  const [frameTarget, setFrameTarget] = React.useState('');
  const [log, setLog] = React.useState([{ t: stamp(), text: 'vm booted · network namespace isolated' }]);
  const [booted, setBooted] = React.useState(false);
  const [openApps, setOpenApps] = React.useState(() => (
    window.innerWidth < 780
      ? { browser: true, monitor: false, terminal: false }
      : { browser: true, monitor: false, terminal: true }
  ));
  const [pos, setPos] = React.useState(() => {
    const initial = {};
    Object.entries(GUEST_APPS).forEach(([id, app]) => { initial[id] = { x: app.x, y: app.y }; });
    return initial;
  });
  const [zOrder, setZOrder] = React.useState({ browser: 2, terminal: 3, monitor: 1 });
  const [activeGuest, setActiveGuest] = React.useState('browser');
  const [startOpen, setStartOpen] = React.useState(false);
  const [termLines, setTermLines] = React.useState([
    { tone: 'dim', text: 'spandr-sbx guest shell · type "help"' },
  ]);
  const [termValue, setTermValue] = React.useState('');
  const termInput = React.useRef(null);

  const res = useResources(state === 'loading' || state === 'done');

  const addLog = React.useCallback((text) => {
    setLog((lines) => [...lines, { t: stamp(), text }].slice(-40));
  }, []);

  React.useEffect(() => {
    setBooted(false);
    const timer = setTimeout(() => {
      setBooted(true);
      addLog('gui session ready · chromium isolated profile');
    }, 1500);
    return () => clearTimeout(timer);
  }, [addLog]);

  React.useEffect(() => {
    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = screenRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = ((event.clientX - drag.startX) / rect.width) * 100;
      const dy = ((event.clientY - drag.startY) / rect.height) * 100;
      const x = Math.min(Math.max(drag.originX + dx, 0), 100 - drag.w);
      const y = Math.min(Math.max(drag.originY + dy, 0), 100 - drag.h);
      setPos((all) => ({ ...all, [drag.id]: { x, y } }));
    };
    const onUp = () => { dragRef.current = null; document.body.style.cursor = ''; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const focusGuest = (id) => {
    setActiveGuest(id);
    setZOrder((all) => ({ ...all, [id]: Math.max(0, ...Object.values(all)) + 1 }));
  };

  const openGuest = (id) => {
    setOpenApps((all) => ({ ...all, [id]: true }));
    focusGuest(id);
    setStartOpen(false);
  };

  const closeGuest = (id) => {
    setOpenApps((all) => ({ ...all, [id]: false }));
  };

  const startDragGuest = (id, event) => {
    if (event.target.closest('button')) return;
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect) return;
    focusGuest(id);
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos[id].x,
      originY: pos[id].y,
      w: GUEST_APPS[id].w,
      h: GUEST_APPS[id].h,
    };
    document.body.style.cursor = 'grabbing';
  };

  /* ------------------------------------------------------------- analysis */

  const detonate = async (rawTarget) => {
    const target = (rawTarget ?? url).trim();
    if (rawTarget != null) setUrl(target);
    const checks = staticUrlChecks(target);
    setLocal(checks);
    setRemote(null);
    setFrameHtml('');
    setFrameTarget('');
    setFrameError('');
    openGuest('browser');
    setTermLines((lines) => [...lines, { tone: 'prompt', text: `$ detonate ${target}` }]);
    if (checks.error) {
      setState('idle');
      setTermLines((lines) => [...lines, { tone: 'bad', text: checks.error }]);
      return;
    }
    setState('loading');
    addLog(`resolving target ${checks.host}`);
    setTermLines((lines) => [...lines, { tone: 'dim', text: `resolving ${checks.host} inside guest…` }]);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/v1/sandbox/detonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setRemote(payload);
      setState('done');
      addLog(`detonation ok · mode=${payload.mode || 'unknown'} · risk=${payload.risk_score ?? 'n/a'}`);
      setTermLines((lines) => [...lines, { tone: 'ok', text: `detonation returned · risk ${payload.risk_score ?? 'n/a'} / 100` }]);
    } catch (error) {
      setRemote({ error: error?.message || 'unreachable' });
      setState('unavailable');
      addLog(`detonation failed · ${error?.message || 'unreachable'} — no fetch performed`);
      setTermLines((lines) => [...lines, { tone: 'bad', text: `container unreachable (${error?.message || 'error'}) — static checks only` }]);
    }
  };

  const renderSnapshot = async () => {
    if (!local?.href) {
      setTermLines((lines) => [...lines, { tone: 'bad', text: 'nothing to render — detonate a URL first' }]);
      return;
    }
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    setFrameLoading(true);
    setFrameError('');
    setFrameTarget(local.href);
    openGuest('browser');
    addLog('requesting sanitised DOM snapshot from preview-frame');
    setTermLines((lines) => [...lines, { tone: 'prompt', text: '$ render --isolated' }]);
    try {
      const response = await fetch(`${base}/api/v1/sandbox/preview-frame?url=${encodeURIComponent(local.href)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      setFrameHtml(html);
      addLog(`snapshot received · ${(html.length / 1024).toFixed(1)} KB of sanitised HTML`);
      setTermLines((lines) => [...lines, { tone: 'ok', text: `snapshot loaded · ${(html.length / 1024).toFixed(1)} KB` }]);
    } catch (error) {
      setFrameHtml('');
      setFrameError(error?.message || 'unreachable');
      addLog(`snapshot unavailable · ${error?.message || 'unreachable'}`);
      setTermLines((lines) => [...lines, { tone: 'bad', text: `preview service unavailable (${error?.message || 'error'})` }]);
    } finally {
      setFrameLoading(false);
    }
  };

  const reboot = () => {
    setStartOpen(false);
    setBooted(false);
    addLog('guest reboot requested · replaying boot');
    setTermLines([{ tone: 'dim', text: 'rebooting guest…' }]);
    setTimeout(() => { setBooted(true); addLog('gui session ready · chromium isolated profile'); }, 1600);
  };

  /* ------------------------------------------------------------- terminal */

  const runCommand = (raw) => {
    const input = raw.trim();
    if (!input) return;
    setTermLines((lines) => [...lines, { tone: 'prompt', text: `guest@spandr-sbx:~$ ${input}` }]);
    const [name, ...rest] = input.split(/\s+/);
    const arg = rest.join(' ');
    const print = (text, tone = '') => setTermLines((lines) => [...lines, { text, tone }]);

    switch (name) {
      case 'help':
        print('help · neofetch · ifconfig · ps · netstat · open <browser|monitor|terminal> · detonate <url> · render · clear · reboot');
        break;
      case 'neofetch':
        print('spandr-sbx-01 · Debian 12 · kernel 6.8.0-hardened · chromium 131 · 1280x720 · egress BLOCKED', 'dim');
        print('cpu 2 vcpu · ram 2048 MB · disk /evidence ro', 'dim');
        break;
      case 'ifconfig':
        print('eth0  inet 10.0.2.15  netmask 255.255.255.0  mtu 1500  (gateway refuses forward)', 'dim');
        print('lo    inet 127.0.0.1  mtu 65536', 'dim');
        break;
      case 'ps':
        print('1 init · 42 watchdog · 128 chromium --no-sandbox-guard · 129 renderer · 210 guest-shell', 'dim');
        break;
      case 'netstat':
        print(`egress 0 KB in / 0 KB out · policy DROP · last target ${local?.host || 'none'}`, 'dim');
        break;
      case 'open':
        if (GUEST_APPS[arg]) { openGuest(arg); print(`opening ${arg}`, 'ok'); }
        else print('open: browser, monitor or terminal', 'bad');
        break;
      case 'detonate':
        if (!arg) print('usage: detonate <url>', 'bad');
        else detonate(arg);
        break;
      case 'render':
        renderSnapshot();
        break;
      case 'clear':
        setTermLines([]);
        break;
      case 'reboot':
        reboot();
        break;
      case 'about':
        print('guest image built for SUDO SPANDR · the target never sees your browser', 'dim');
        break;
      default:
        print(`${name}: command not found`, 'bad');
    }
  };

  /* ----------------------------------------------------------------- view */

  const risk = remote?.risk_score;
  const flags = [...(local?.flags || []), ...(remote?.heuristic_flags || [])];
  const host = local?.host || 'no target';

  const renderGuestBody = (id) => {
    if (id === 'browser') {
      return (
        <div className="gwin__browser">
          <div className="gwin__tabs">
            <span className="gwin__tab"><Lock />{frameTarget ? host : 'about:blank'}</span>
            <span className="gwin__tab-dim">+</span>
          </div>
          <form
            className="gwin__address"
            onSubmit={(event) => { event.preventDefault(); detonate(); }}
          >
            {local?.protocol === 'http:' ? <WifiOff className="lock warn" /> : <Lock className="lock" />}
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://suspicious-link.example/login"
              spellCheck="false"
              aria-label="URL to detonate"
            />
            <button type="submit" className="btn btn--primary btn--xs" disabled={state === 'loading' || !url.trim()}>
              {state === 'loading' ? <Loader2 size={10} className="spin" /> : <ShieldAlert size={10} />}
              {state === 'loading' ? 'Running' : 'Detonate'}
            </button>
            <button type="button" className="btn btn--xs" onClick={renderSnapshot} disabled={!local?.href}>Render</button>
          </form>
          <div className="gwin__page">
            {frameError ? (
              <div className="gwin__splash">
                <AlertTriangle size={15} style={{ color: '#ff6b7a' }} />
                <strong>Snapshot unavailable</strong>
                <p>The preview service did not return a page ({frameError}). Static URL checks are still real; nothing was fetched from your browser.</p>
                <button type="button" className="btn btn--xs" onClick={renderSnapshot}><RotateCw size={10} /> Retry</button>
              </div>
            ) : frameHtml ? (
              <iframe title="Isolated detonation preview" srcDoc={frameHtml} sandbox="allow-scripts" referrerPolicy="no-referrer" />
            ) : frameLoading ? (
              <div className="gwin__splash"><Loader2 size={15} className="spin" style={{ color: '#ff97a3' }} /><strong>Fetching snapshot</strong><p>The guest requests the page; your browser never contacts the target.</p></div>
            ) : (
              <div className="gwin__splash">
                <Globe size={15} style={{ color: '#ff97a3' }} />
                <strong>{local?.href ? 'Ready to render' : 'Isolated browser'}</strong>
                <p>{local?.href ? 'Detonation checks are in. Render the sanitised DOM snapshot inside this guest window.' : 'Type a URL above. Static checks run in this tab; telemetry comes from the container. The guest has no route to the internet.'}</p>
                <button type="button" className="btn btn--xs" onClick={() => setUrl(SAMPLE_TARGET)}>Use sample target</button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (id === 'monitor') {
      return (
        <div className="gwin__monitor">
          <div className="gwin__specs">
            <span>host<b>spandr-sbx-01</b></span>
            <span>kernel<b>6.8.0-hardened</b></span>
            <span>chromium<b>131.0.6778</b></span>
            <span>display<b>1280 × 720</b></span>
            <span>egress<b style={{ color: '#9fe9bd' }}>BLOCKED</b></span>
          </div>
          <div className="gwin__risk">
            <strong style={{ color: risk >= 60 ? '#ff6b7a' : risk >= 30 ? '#f3d37a' : '#f4f1ef' }}>{risk != null ? risk : '—'}</strong>
            <small>risk / 100</small>
            <div className="gwin__riskbar"><i style={{ width: `${risk ?? 0}%` }} /></div>
          </div>
          <div className="gwin__flags">
            {flags.length ? flags.map((flag) => (
              <span className="gwin__flag" key={flag}><AlertTriangle size={9} />{flag}</span>
            )) : (
              <span className="gwin__flag ok"><CheckCircle2 size={9} />{local ? 'No structural warning (not a reputation verdict)' : 'No target loaded yet'}</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="gwin__term" onClick={() => termInput.current?.focus()}>
        <div className="gwin__term-out">
          {termLines.map((line, index) => (
            <div key={`${index}-${line.text}`} className={line.tone ? `tone-${line.tone}` : ''}>{line.text}</div>
          ))}
        </div>
        <form
          className="gwin__term-in"
          onSubmit={(event) => { event.preventDefault(); runCommand(termValue); setTermValue(''); }}
        >
          <span>guest@spandr-sbx:~$</span>
          <input
            ref={termInput}
            value={termValue}
            onChange={(event) => setTermValue(event.target.value)}
            spellCheck="false"
            aria-label="Guest terminal input"
          />
        </form>
      </div>
    );
  };

  return (
    <div className="vm">
      <div className="vm__main">
        <div className="vm__hostbar">
          <span className="vm__machine"><Cpu size={11} /> spandr-sbx-01</span>
          <span className="chip chip--green" style={{ fontSize: 8.5 }}><Wifi size={9} /> guest online</span>
          <span className="chip" style={{ fontSize: 8.5 }}>egress blocked</span>
          <span className="spacer" />
          <button type="button" className="btn btn--xs" onClick={renderSnapshot} disabled={!local?.href}><RotateCw size={10} /> Render</button>
          <button type="button" className="btn btn--xs" onClick={reboot}><Power size={10} /> Reboot</button>
        </div>

        <div
          className="vm__screen"
          ref={screenRef}
          onPointerDown={() => { setStartOpen(false); }}
        >
          <div className="vm__screen-bg" />

          {openApps.browser || openApps.monitor || openApps.terminal ? null : (
            <div className="vm__hint">Open an app from the taskbar</div>
          )}

          <div className="vm__deskicons">
            {Object.entries(GUEST_APPS).map(([id, app]) => {
              const Icon = app.icon;
              return (
                <button type="button" key={id} className="vm__deskicon" onDoubleClick={() => openGuest(id)} onClick={() => openGuest(id)}>
                  <span><Icon /></span>
                  {app.short}
                </button>
              );
            })}
          </div>

          {Object.entries(GUEST_APPS).filter(([id]) => openApps[id]).map(([id, app]) => {
            const Icon = app.icon;
            const active = activeGuest === id;
            return (
              <section
                key={id}
                className={`gwin ${active ? 'is-active' : ''}`}
                style={{ left: `${pos[id].x}%`, top: `${pos[id].y}%`, width: `${app.w}%`, height: `${app.h}%`, zIndex: zOrder[id] }}
                onPointerDown={() => focusGuest(id)}
                aria-label={app.title}
              >
                <header className="gwin__bar" onPointerDown={(event) => startDragGuest(id, event)}>
                  <span className="gwin__lights"><i /><i /><i /></span>
                  <span className="gwin__title"><Icon /> {app.title}</span>
                  <span className="spacer" />
                  <button type="button" className="gwin__close" aria-label={`Close ${app.short}`} onClick={() => closeGuest(id)}><X size={9} /></button>
                </header>
                <div className="gwin__body">{renderGuestBody(id)}</div>
              </section>
            );
          })}

          {startOpen ? (
            <div className="vm__startmenu" onPointerDown={(event) => event.stopPropagation()}>
              <div className="vm__startmenu-head">spandr-sbx-01</div>
              <div className="vm__startmenu-grid">
                {Object.entries(GUEST_APPS).map(([id, app]) => {
                  const Icon = app.icon;
                  return (
                    <button type="button" key={id} className="vm__startapp" onClick={() => openGuest(id)}>
                      <span><Icon /></span>{app.short}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="vm__startpower" onClick={reboot}><Power size={10} /> Reboot guest</button>
            </div>
          ) : null}

          <div className="vm__taskbar">
            <button
              type="button"
              className="vm__start"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setStartOpen((open) => !open)}
            >
              <span className="vm__start-dot" /> Start
            </button>
            {Object.entries(GUEST_APPS).map(([id, app]) => {
              const Icon = app.icon;
              return (
                <button
                  type="button"
                  key={id}
                  className={`vm__task ${openApps[id] ? 'is-open' : ''} ${activeGuest === id && openApps[id] ? 'is-active' : ''}`}
                  onClick={() => (openApps[id] ? focusGuest(id) : openGuest(id))}
                >
                  <Icon /> {app.short}
                </button>
              );
            })}
            <span className="spacer" />
            {risk != null ? <span className={`vm__tray-chip ${risk >= 60 ? 'is-bad' : ''}`}>risk {risk}</span> : null}
            <span className="vm__tray">{state === 'unavailable' ? <WifiOff size={9} /> : <Wifi size={9} />} {stamp(clock)}</span>
          </div>

          {!booted ? (
            <div className="vm__boot">
              <div className="vm__boot-mark"><ShieldAlert size={16} /></div>
              <strong>spandr-sbx-01</strong>
              <div className="vm__boot-log">
                {BOOT_LINES.map((line, index) => (
                  <span key={line} style={{ animationDelay: `${index * 0.22}s` }}>[ ok ] {line}</span>
                ))}
              </div>
              <div className="vm__boot-bar"><i /></div>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="vm__console">
        <div className="vm__console-head">
          <strong>Host observer</strong>
          <span className={`chip ${state === 'done' ? 'chip--red' : state === 'unavailable' ? 'chip--amber' : ''}`}>
            {state === 'done' ? 'detonated' : state === 'unavailable' ? 'backend offline' : state === 'loading' ? 'running' : 'standby'}
          </span>
        </div>
        <div className="vm__console-body">
          <div className="vm__observe">
            <span>uptime<b>{Math.floor(res.uptime / 60)}m {String(res.uptime % 60).padStart(2, '0')}s</b></span>
            <span>target<b>{host}</b></span>
            <span>mode<b>{remote?.mode || '—'}</b></span>
            <span>dns<b>{remote ? (remote.dns_resolved ? 'resolved' : 'not resolved') : '—'}</b></span>
            <span>http<b>{remote ? (remote.http_fetched ? 'fetched in container' : 'not fetched') : '—'}</b></span>
          </div>

          <Meters res={res} running={state === 'loading' || state === 'done'} />

          {state === 'unavailable' && (
            <div className="vm__flag"><AlertTriangle size={11} /> Backend unreachable ({remote?.error}). Nothing was fetched or executed.</div>
          )}
          {state === 'done' && remote?.threat_verdict ? <p className="hint">{remote.threat_verdict}</p> : null}

          {flags.length ? (
            <div className="vm__flags">
              {flags.map((flag) => <div className="vm__flag" key={flag}><AlertTriangle size={11} />{flag}</div>)}
            </div>
          ) : local && !local.error ? (
            <div className="vm__flag ok"><CheckCircle2 size={11} /> No structural warning — not a reputation verdict.</div>
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
