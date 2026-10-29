import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight, Camera, Check, CircleHelp, Container, Copy, Cpu, Expand, Gauge, HardDrive,
  Loader2, MonitorPlay, Pause, Play, PlugZap, RefreshCw, ShieldAlert, TriangleAlert, Upload, X,
} from 'lucide-react';
import {
  AGENT_ENGINES, ENGINE_ORDER, ENGINE_STORAGE_KEY, engineById, engineFromLocation, engineReadiness,
  engineShareUrl, probeDevice, recommendedEngine,
} from '../lib/agentEngines';
import BrowserDesktop, { MEMORY_CHOICES, formatBytes } from './BrowserDesktop';

/* ------------------------------------------------------------------------- *
 * Control plane client (local host desktop only)
 * ------------------------------------------------------------------------- */

const CONTROL_TIMEOUT_MS = 25000;

async function controlRequest(path, method = 'GET') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONTROL_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/v1/agent-computer/${path}`, {
      method,
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Hosted computer control returned HTTP ${response.status}.`);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The host control plane did not answer in time.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function themeNoVncControls(frame) {
  try {
    const frameDocument = frame.contentDocument;
    if (!frameDocument?.head || frameDocument.querySelector('style[data-spandr-novnc-theme]')) return;
    const style = frameDocument.createElement('style');
    style.dataset.spandrNovncTheme = '';
    style.textContent = ':root{--novnc-blue:#536d5b!important;--novnc-lightblue:#c78e64!important;--novnc-darkblue:#354d3e!important;--novnc-grey:#d8c9b4!important;--novnc-lightgrey:#eee1ca!important;--novnc-darkgrey:#8f8375!important;--novnc-buttongrey:rgba(238,225,202,.28)!important;}';
    frameDocument.head.appendChild(style);
  } catch {
    // A remotely hosted noVNC origin may not permit styling; its real stream still works.
  }
}

/* ------------------------------------------------------------------------- *
 * Small helpers
 * ------------------------------------------------------------------------- */

function formatUptime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = String(Math.floor(safe / 3600)).padStart(2, '0');
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function shortSessionId(value) {
  if (!value) return '—';
  const text = String(value);
  return text.length > 14 ? `${text.slice(0, 8)}…${text.slice(-4)}` : text;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const holder = document.createElement('textarea');
      holder.value = text;
      holder.setAttribute('readonly', '');
      holder.style.position = 'fixed';
      holder.style.opacity = '0';
      document.body.appendChild(holder);
      holder.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(holder);
      return ok;
    } catch {
      return false;
    }
  }
}

const STATUS_LABEL = {
  idle: 'Stopped',
  probing: 'Checking host',
  starting: 'Starting',
  running: 'Running',
  stopping: 'Stopping',
  error: 'Needs attention',
};

/* ------------------------------------------------------------------------- *
 * Component
 * ------------------------------------------------------------------------- */

export default function HostedLinuxComputer({ autoResume, onRunningChange, onEvent, onUserStop }) {
  const [engine, setEngine] = useState(() => {
    const fromLink = engineFromLocation();
    if (fromLink) return fromLink;
    try {
      const stored = localStorage.getItem(ENGINE_STORAGE_KEY);
      if (stored && AGENT_ENGINES[stored]) return stored;
    } catch { /* storage is optional */ }
    return 'desktop';
  });
  const [status, setStatus] = useState('idle');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [hostAvailable, setHostAvailable] = useState(null); // null = unknown, false = no control plane
  const [device, setDevice] = useState(null);
  const [frameKey, setFrameKey] = useState(0);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameSlow, setFrameSlow] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [uptime, setUptime] = useState(0);
  const [guestMemoryMB, setGuestMemoryMB] = useState(128);
  const [ownImage, setOwnImage] = useState(null);

  const statusRef = useRef(status);
  const sessionRef = useRef(session);
  const mountedRef = useRef(true);
  const startPromiseRef = useRef(null);
  const eventRef = useRef(onEvent);
  const runningCallbackRef = useRef(onRunningChange);
  const screenRef = useRef(null);
  const desktopRef = useRef(null);
  const imageInputRef = useRef(null);
  const helpCloseRef = useRef(null);
  const startedAtRef = useRef(null);

  eventRef.current = onEvent;
  runningCallbackRef.current = onRunningChange;
  sessionRef.current = session;

  const emit = useCallback((message) => eventRef.current?.(message), []);

  const updateStatus = useCallback((next) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
    runningCallbackRef.current?.(next === 'running');
  }, []);

  const activeConfig = engineById(engine);
  const readiness = useMemo(() => engineReadiness(engine, device), [engine, device]);
  const running = status === 'running' && Boolean(session);
  const busy = status === 'starting' || status === 'stopping' || status === 'probing';
  const isHosted = activeConfig.kind === 'hosted';
  const isNative = activeConfig.kind === 'native';
  const canEmbed = Boolean(activeConfig.frameUrl);

  /* --- environment + host probe ------------------------------------------ */

  const probeHost = useCallback(async () => {
    if (!mountedRef.current) return false;
    try {
      const runtime = await controlRequest('status');
      if (!mountedRef.current) return false;
      const available = Boolean(runtime.available);
      setHostAvailable(available);
      if (available && runtime.running) {
        const live = await controlRequest('session');
        if (!mountedRef.current) return available;
        setSession({ ...live, is_hosted: true });
        startedAtRef.current = live.started_at ? Date.parse(live.started_at) : Date.now();
        setFrameLoaded(false);
        updateStatus('running');
        emit('Reattached to a desktop session that was already running on the host.');
      }
      return available;
    } catch {
      if (mountedRef.current) setHostAvailable(false);
      return false;
    }
  }, [emit, updateStatus]);

  useEffect(() => {
    mountedRef.current = true;
    setDevice(probeDevice());
    probeHost();
    return () => {
      mountedRef.current = false;
      if (sessionRef.current?.is_hosted) {
        fetch('/api/v1/agent-computer/stop', { method: 'POST', keepalive: true }).catch(() => {});
      }
      runningCallbackRef.current?.(false);
    };
  }, [probeHost]);

  useEffect(() => {
    try { localStorage.setItem(ENGINE_STORAGE_KEY, engine); } catch { /* optional preference */ }
  }, [engine]);

  /* --- uptime ------------------------------------------------------------- */

  useEffect(() => {
    if (!running) return undefined;
    const startedAt = startedAtRef.current || Date.now();
    const tick = () => setUptime(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [running, session?.session_id]);

  /* --- host desktop health poll ------------------------------------------ */

  useEffect(() => {
    if (!running || !isHosted) return undefined;
    const timer = setInterval(async () => {
      try {
        const runtime = await controlRequest('status');
        if (!mountedRef.current) return;
        if (!runtime.running) {
          setSession(null);
          sessionRef.current = null;
          updateStatus('error');
          setError('The host desktop stopped outside this tab. Any unsaved guest work may be gone; start it again.');
          emit('Host desktop exited unexpectedly; session marked as stopped.');
        }
      } catch {
        if (mountedRef.current) setHostAvailable(false);
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [running, isHosted, emit, updateStatus]);

  /* --- slow-frame hint ---------------------------------------------------- */

  useEffect(() => {
    if (!running || !canEmbed || frameLoaded) { setFrameSlow(false); return undefined; }
    const timer = setTimeout(() => {
      if (mountedRef.current && !frameLoaded) setFrameSlow(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [running, canEmbed, frameLoaded, frameKey]);

  /* --- start / stop ------------------------------------------------------- */

  const start = useCallback(() => {
    if (statusRef.current === 'running' && sessionRef.current) return Promise.resolve();
    if (startPromiseRef.current) return startPromiseRef.current;

    const promise = (async () => {
      updateStatus('starting');
      setError('');
      setFrameSlow(false);

      if (activeConfig.kind === 'hosted') {
        try {
          const liveSession = await controlRequest('start', 'POST');
          if (!mountedRef.current) {
            await controlRequest('stop', 'POST').catch(() => {});
            return;
          }
          const wrapped = { ...liveSession, is_hosted: true };
          setSession(wrapped);
          sessionRef.current = wrapped;
          startedAtRef.current = Date.now();
          setFrameLoaded(false);
          setFrameKey((value) => value + 1);
          updateStatus('running');
          emit('Host desktop started with real Chromium, terminal and file manager processes.');
        } catch (startError) {
          updateStatus('error');
          setError(`${startError.message} The desktop stays stopped; nothing was launched.`);
          emit(`Host desktop start failed: ${startError.message}`);
        }
        return;
      }

      if (device?.wasm === false) {
        updateStatus('error');
        setError('This browser cannot run WebAssembly, so a WASM desktop cannot boot here.');
        return;
      }

      if (activeConfig.kind === 'native') {
        const nativeSession = {
          session_id: `native-${activeConfig.id}-${Date.now().toString(36)}`,
          is_native: true,
          name: activeConfig.name,
        };
        startedAtRef.current = Date.now();
        setSession(nativeSession);
        sessionRef.current = nativeSession;
        updateStatus('starting');
        emit(ownImage
          ? `${activeConfig.name}: booting ${ownImage.name} from this device in the emulator.`
          : `${activeConfig.name}: booting the bundled guest with ${guestMemoryMB} MB of emulated RAM.`);
        return;
      }

      const wasmSession = {
        session_id: `wasm-${activeConfig.id}-${Date.now().toString(36)}`,
        frame_url: activeConfig.frameUrl,
        is_hosted: false,
        name: activeConfig.name,
      };
      setSession(wasmSession);
      sessionRef.current = wasmSession;
      startedAtRef.current = Date.now();
      setFrameLoaded(false);
      setFrameKey((value) => value + 1);
      updateStatus('running');
      emit(`${activeConfig.name} loaded in an embedded frame (${activeConfig.runsOn}). Guest files stay inside that tab.`);
    })();

    startPromiseRef.current = promise;
    promise.finally(() => { if (startPromiseRef.current === promise) startPromiseRef.current = null; });
    return promise;
  }, [activeConfig, device?.wasm, emit, guestMemoryMB, ownImage, updateStatus]);

  const stop = useCallback(async () => {
    if (startPromiseRef.current) await startPromiseRef.current;
    updateStatus('stopping');
    try {
      if (sessionRef.current?.is_hosted) await controlRequest('stop', 'POST');
      if (sessionRef.current?.is_native) await desktopRef.current?.shutdown();
      setSession(null);
      sessionRef.current = null;
      startedAtRef.current = null;
      setFrameLoaded(false);
      setFrameSlow(false);
      setUptime(0);
      updateStatus('idle');
      emit('Runtime stopped. Embedded guest state is discarded with this session.');
    } catch (stopError) {
      updateStatus('error');
      setError(stopError.message);
    }
  }, [emit, updateStatus]);

  const restart = useCallback(async () => {
    if (sessionRef.current?.is_hosted) {
      await stop();
      await start();
      return;
    }
    if (sessionRef.current?.is_native) {
      await desktopRef.current?.restart();
      startedAtRef.current = Date.now();
      emit('In-page guest rebooted. Anything saved inside the guest was discarded.');
      return;
    }
    setFrameLoaded(false);
    setFrameSlow(false);
    setFrameKey((value) => value + 1);
    startedAtRef.current = Date.now();
    emit('Embedded runtime frame reloaded. Anything inside the guest was reset.');
  }, [emit, start, stop]);

  /* --- auto-resume -------------------------------------------------------- */

  useEffect(() => {
    if (!autoResume) return undefined;
    const syncWithVisibility = () => {
      if (document.hidden) {
        if (sessionRef.current) stop();
      } else if (!sessionRef.current) {
        start();
      }
    };
    syncWithVisibility();
    document.addEventListener('visibilitychange', syncWithVisibility);
    return () => document.removeEventListener('visibilitychange', syncWithVisibility);
  }, [autoResume, start, stop]);

  /* --- keyboard + dialog -------------------------------------------------- */

  useEffect(() => {
    if (!helpOpen) return undefined;
    helpCloseRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') setHelpOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [helpOpen]);

  const handleNativeState = useCallback((state) => {
    if (state === 'loading' || state === 'booting') updateStatus('starting');
    else if (state === 'running') updateStatus('running');
    else if (state === 'error') updateStatus('error');
  }, [updateStatus]);

  const captureScreen = useCallback(async () => {
    const first = await desktopRef.current?.snapshot();
    if (!first) return;
    await desktopRef.current?.downloadLastScreenshot();
  }, []);

  const selectEngine = (id) => {
    if (sessionRef.current) stop();
    setEngine(id);
    setError('');
    setFrameSlow(false);
    emit(`Engine switched to ${engineById(id).name}. Nothing has been started yet.`);
  };

  const openStandalone = () => {
    if (!activeConfig.standaloneUrl) return;
    window.open(activeConfig.standaloneUrl, '_blank', 'noopener,noreferrer');
    emit(`Opened ${activeConfig.name} in a separate tab. That tab is a third-party site outside this application.`);
  };

  const shareSession = async () => {
    const url = engineShareUrl(activeConfig.id);
    const ok = await copyText(url);
    setCopied(ok ? 'link' : 'failed');
    setTimeout(() => setCopied(''), 2200);
    emit(ok
      ? 'Copied a deep link to this page and engine. Guest state is never included in a link.'
      : 'Clipboard access was blocked by the browser; the link is shown below.');
  };

  const requestFullscreen = async () => {
    try {
      await screenRef.current?.requestFullscreen?.();
    } catch {
      setError('Fullscreen was refused by the browser. Use the browser’s own fullscreen command.');
    }
  };

  /* --- render ------------------------------------------------------------- */

  return (
    <section
      className={`computer-shell surface hosted-computer ${running ? 'is-running' : ''}`}
      aria-label="Agent PC runtime"
      data-runtime-status={status === 'idle' ? 'stopped' : status}
      data-engine={activeConfig.id}
    >
      <div className="computer-topbar">
        <div className="computer-identity">
          <span><Container size={21} /></span>
          <div>
            <strong>Agent PC</strong>
            <small>{activeConfig.name} · {activeConfig.runsOn}</small>
          </div>
        </div>
        <div className="computer-controls">
          <span className={`computer-power-state ${running ? 'is-on' : ''}`} role="status" aria-live="polite">
            <i />{STATUS_LABEL[status] || status.toUpperCase()}
          </span>
          <button
            type="button"
            className="ui-button ui-button--secondary agent-pc__icon-btn"
            onClick={() => setHelpOpen(true)}
            aria-label="Runtime help and keyboard shortcuts"
            title="Help"
          >
            <CircleHelp size={15} />
          </button>
          {running || busy ? (
            <button
              type="button"
              className="ui-button ui-button--secondary"
              disabled={status === 'stopping' || status === 'probing'}
              onClick={() => { onUserStop?.(); stop(); }}
            >
              <Pause size={15} />{status === 'starting' ? 'Cancel' : status === 'stopping' ? 'Stopping…' : 'Stop'}
            </button>
          ) : (
            <button type="button" className="ui-button ui-button--primary" onClick={start}>
              <Play size={15} />Start Agent PC
            </button>
          )}
        </div>
      </div>

      <div className="browser-computer__notice">
        {isHosted ? <ShieldAlert size={14} /> : isNative ? <HardDrive size={14} /> : <PlugZap size={14} />}
        <span>
          {isHosted
            ? 'Real Chromium desktop on a host you control. Network is enabled; this is not an air gap.'
            : isNative
              ? 'A real x86 PC emulated on this origin: guest CPU, memory and disk all live in this tab, and the guest has no network device.'
              : 'Runs entirely in this tab on your own CPU. Nothing is uploaded to this deployment — and nothing is copied in either.'}
        </span>
      </div>

      {error ? (
        <div className="error-callout browser-computer__error" role="alert">
          <TriangleAlert size={15} /> <span>{error}</span>
        </div>
      ) : null}

      {running ? (
        <div className="agent-pc__sessionbar">
          <span className={`agent-pc__chip agent-pc__chip--${running ? 'live' : 'idle'}`}>
            <i />{running ? 'Session live' : 'Idle'}
          </span>
          <span className="agent-pc__meta"><Gauge size={13} />Uptime <b>{formatUptime(uptime)}</b></span>
          <span className="agent-pc__meta"><Cpu size={13} />{device?.cores ? `${device.cores} logical cores` : 'CPU unshared'}</span>
          <span className="agent-pc__meta agent-pc__meta--id" title={session?.session_id || ''}>
            Session <code>{shortSessionId(session?.session_id)}</code>
          </span>
          <div className="agent-pc__toolbar">
            {isNative ? (
              <button type="button" className="agent-pc__tool" onClick={captureScreen} title="Capture the guest screen as a PNG with its SHA-256">
                <Camera size={14} /><span>Snapshot</span>
              </button>
            ) : null}
            <button type="button" className="agent-pc__tool" onClick={restart} title="Reload the runtime">
              <RefreshCw size={14} /><span>Reload</span>
            </button>
            {!isNative ? (
              <button type="button" className="agent-pc__tool" onClick={() => { setFrameKey((v) => v + 1); setFrameLoaded(false); }} title="Reload only the embedded frame">
                <MonitorPlay size={14} /><span>Refit</span>
              </button>
            ) : null}
            {!isNative ? (
              <button type="button" className="agent-pc__tool" onClick={requestFullscreen} title="Fullscreen the screen area">
                <Expand size={14} /><span>Fullscreen</span>
              </button>
            ) : null}
            {canEmbed ? (
              <button type="button" className="agent-pc__tool" onClick={openStandalone} title="Open the runtime in its own tab">
                <ArrowUpRight size={14} /><span>Open tab</span>
              </button>
            ) : null}
            <button type="button" className="agent-pc__tool" onClick={shareSession} title="Copy a link to this page and engine">
              {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied === 'link' ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>
      ) : null}

      <div ref={screenRef} className={`computer-screen hosted-computer__screen ${running ? '' : 'computer-screen--off'}`}>
        {session && isNative ? (
          <div className="hosted-computer__stream">
            <BrowserDesktop
              ref={desktopRef}
              source={ownImage ? { type: 'file', file: ownImage } : { type: 'bundled' }}
              memoryMB={guestMemoryMB}
              onState={handleNativeState}
              onEvent={emit}
              onArtifact={(artifact) => emit(
                artifact.kind === 'screenshot'
                  ? `Screenshot captured locally: ${artifact.name} · sha256 ${artifact.sha256.slice(0, 16)}…`
                  : `Guest image fingerprinted: ${artifact.name} · sha256 ${artifact.sha256.slice(0, 16)}…`,
              )}
            />
          </div>
        ) : running && session ? (
          <div className="hosted-computer__stream">
            {!frameLoaded ? (
              <div className="hosted-computer__loading" role="status">
                <Loader2 size={22} className="agent-pc__spin" />
                <span>Loading {activeConfig.name}…</span>
                <small>{isHosted ? 'Waiting for the noVNC stream from the host.' : 'The third-party runtime is booting in its own frame.'}</small>
              </div>
            ) : null}
            {frameSlow && !frameLoaded ? (
              <div className="agent-pc__frame-hint" role="alert">
                <TriangleAlert size={16} />
                <div>
                  <strong>Still blank after 12 seconds</strong>
                  <p>
                    {isHosted
                      ? 'The noVNC stream has not painted yet. Check that the control server and websockify are reachable from this device.'
                      : `${activeConfig.short} may refuse to be embedded by this deployment, or the network is slow. Open it in its own tab instead.`}
                  </p>
                  {canEmbed ? (
                    <button type="button" className="ui-button ui-button--secondary" onClick={openStandalone}>
                      <ArrowUpRight size={15} />Open {activeConfig.short} in a tab
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {canEmbed ? (
              <iframe
                key={`${session.session_id}-${frameKey}`}
                className="hosted-computer__frame"
                title={`Agent PC runtime — ${activeConfig.name}`}
                src={session.frame_url}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-pointer-lock"
                allow="clipboard-read; clipboard-write; fullscreen"
                referrerPolicy="no-referrer"
                onLoad={(event) => {
                  setFrameLoaded(true);
                  themeNoVncControls(event.currentTarget);
                }}
              />
            ) : (
              <iframe
                key={`${session.session_id}-${frameKey}`}
                className="hosted-computer__frame"
                title={`Agent PC runtime — ${activeConfig.name}`}
                src={session.frame_url || '/novnc/vnc.html?autoconnect=true&resize=scale&path=novnc/websockify&view_only=0'}
                onLoad={(event) => {
                  setFrameLoaded(true);
                  themeNoVncControls(event.currentTarget);
                }}
              />
            )}
          </div>
        ) : (
          <div className="computer-stopped">
            <span><Container size={34} /></span>
            <h2>Agent PC is stopped</h2>
            <p>
              Pick a runtime, then start it. Every option is labelled with what it really is; none of them
              processes your mailbox or opens evidence on its own.
            </p>

            <div className="agent-pc__grid" role="radiogroup" aria-label="Select Agent PC runtime">
              {ENGINE_ORDER.map((id) => {
                const item = AGENT_ENGINES[id];
                const isSelected = engine === id;
                const unavailable = item.kind === 'hosted' && hostAvailable === false;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`agent-pc__card ${isSelected ? 'is-active' : ''} ${unavailable ? 'is-unavailable' : ''}`}
                    onClick={() => selectEngine(id)}
                  >
                    <div className="agent-pc__card-head">
                      <strong>{item.name}</strong>
                      <span className="hosted-computer__badge">{item.badge}</span>
                    </div>
                    <p>{item.summary}</p>
                    <dl className="agent-pc__caps">
                      {item.capabilities.map((capability) => (
                        <div key={capability.label}>
                          <dt>{capability.label}</dt>
                          <dd>{capability.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="agent-pc__card-foot">
                      <span>{isSelected ? <Check size={12} /> : null}{isSelected ? 'Selected' : 'Select'}</span>
                      <span>{item.cost}</span>
                    </div>
                    {unavailable ? <span className="agent-pc__card-warn">Control plane not reachable here</span> : null}
                  </button>
                );
              })}
            </div>

            <div className="agent-pc__preflight">
              <div className="agent-pc__preflight-head">
                <strong>{activeConfig.name}</strong>
                <span className={`agent-pc__tone agent-pc__tone--${readiness.tone}`}>{readiness.text}</span>
              </div>
              <ul>
                {activeConfig.limits.map((limit) => <li key={limit}>{limit}</li>)}
              </ul>
              {device?.warnings?.length ? (
                <div className="agent-pc__device-warn">
                  <TriangleAlert size={14} />
                  <span>{device.warnings[0]}</span>
                </div>
              ) : null}
            </div>

            {isNative ? (
              <div className="agent-pc__guest">
                <div className="agent-pc__guest-row">
                  <span className="agent-pc__guest-label"><HardDrive size={14} />Guest</span>
                  <div className="agent-pc__guest-choices" role="group" aria-label="Guest image">
                    <button
                      type="button"
                      className={`agent-pc__guest-btn ${!ownImage ? 'is-active' : ''}`}
                      aria-pressed={!ownImage}
                      onClick={() => setOwnImage(null)}
                    >
                      Bundled KolibriOS <small>1.4 MB · served from this deployment</small>
                    </button>
                    <button
                      type="button"
                      className={`agent-pc__guest-btn ${ownImage ? 'is-active' : ''}`}
                      aria-pressed={Boolean(ownImage)}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Upload size={13} /> Your ISO / IMG
                      <small>{ownImage ? `${ownImage.name} · ${formatBytes(ownImage.size)}` : 'read locally, never uploaded'}</small>
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept=".iso,.img,.bin,.raw,.vhd,.qcow2"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        setOwnImage(file);
                        emit(`${file.name} selected as the guest image. It will be read on this device when the guest boots.`);
                      }}
                    />
                  </div>
                </div>
                <div className="agent-pc__guest-row">
                  <span className="agent-pc__guest-label"><Cpu size={14} />Emulated RAM</span>
                  <div className="agent-pc__memory" role="group" aria-label="Emulated memory">
                    {MEMORY_CHOICES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`agent-pc__memory-btn ${guestMemoryMB === size ? 'is-active' : ''}`}
                        aria-pressed={guestMemoryMB === size}
                        onClick={() => setGuestMemoryMB(size)}
                      >
                        {size} MB
                      </button>
                    ))}
                  </div>
                </div>
                {ownImage && ownImage.size > 512 * 1024 * 1024 ? (
                  <p className="agent-pc__guest-warn">
                    <TriangleAlert size={13} /> {formatBytes(ownImage.size)} image: it is read fully into memory before boot, so tablets and phones may fail. Keep the tab in the foreground.
                  </p>
                ) : null}
              </div>
            ) : null}

            {engine === 'backend' && hostAvailable === false ? (
              <div className="agent-pc__backend-missing">
                <p>No control plane answered on this deployment. The host desktop needs the local server below — a static deployment cannot start it.</p>
                <code className="hosted-computer__setup">sudo bash scripts/setup-agent-computer.sh &amp;&amp; AGENT_COMPUTER_TOKEN=… node scripts/agent-computer-server.mjs</code>
                <button type="button" className="ui-button ui-button--secondary" onClick={probeHost}>
                  <RefreshCw size={14} />Re-check host
                </button>
              </div>
            ) : (
              <button type="button" className="ui-button ui-button--primary" disabled={busy} onClick={start}>
                <Play size={15} />Boot {activeConfig.name}
              </button>
            )}

            <p className="agent-pc__reco">
              Suggested for this device: <b>{AGENT_ENGINES[recommendedEngine(device)]?.name}</b>
              {device ? ` · reported ${device.cores || '?'} cores${device.reportedMemoryGB ? ` · ${device.reportedMemoryGB} GB${device.reportedMemoryIsCapped ? '+' : ''} memory` : ''}` : ''}
            </p>
          </div>
        )}
      </div>

      <div className="browser-computer__footnote">
        {isHosted
          ? 'Local Docker proof of concept. Production multi-user use needs authentication, per-user isolation, egress policy and private VNC.'
          : isNative
            ? 'Emulated in this tab (v86, x86). No network device, no upload — but also no isolation from your own browser. KolibriOS, SeaBIOS and the VGA ROM are bundled under their own licences (public/v86/NOTICE.md).'
            : 'Third-party WebAssembly runtime in an embedded frame. Guest traffic, files and network exit through that provider — do not paste live evidence into it.'}
      </div>

      {helpOpen ? (
        <div className="agent-pc__dialog-backdrop" role="presentation" onClick={() => setHelpOpen(false)}>
          <div
            className="agent-pc__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-pc-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="agent-pc__dialog-head">
              <h2 id="agent-pc-help-title">Agent PC · what this page can and cannot do</h2>
              <button ref={helpCloseRef} type="button" className="agent-pc__tool" onClick={() => setHelpOpen(false)} aria-label="Close help">
                <X size={16} />
              </button>
            </div>
            <div className="agent-pc__dialog-body">
              <h3>What runs here</h3>
              <ul>
                <li>A third-party WebAssembly Linux embedded in a frame, or a desktop you host yourself through the authenticated control plane.</li>
                <li>Session metadata in the bar above the screen: engine, uptime, core count and a short session id. No secrets are displayed.</li>
              </ul>
              <h3>What does not happen</h3>
              <ul>
                <li>No mailbox is connected, so nothing is received, replied to, deleted or quarantined.</li>
                <li>Case files, EML messages and attachments are not copied into the guest runtime.</li>
                <li>No screen recording, keystroke capture or hidden exfiltration runs from this page.</li>
              </ul>
              <h3>Keyboard</h3>
              <ul>
                <li><kbd>Esc</kbd> closes this dialog.</li>
                <li>Fullscreen mode uses the browser’s own <kbd>Esc</kbd> to exit; guest keystrokes only reach the runtime while the frame has focus.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
