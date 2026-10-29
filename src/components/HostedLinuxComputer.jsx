import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Container, MonitorPlay, Pause, Play } from 'lucide-react';

async function controlRequest(path, method = 'GET') {
  const response = await fetch(`/api/v1/agent-computer/${path}`, { method, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Hosted computer control returned HTTP ${response.status}.`);
  return data;
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

const WASM_ENGINES = {
  webvm: {
    id: 'webvm',
    name: 'Debian WebVM',
    badge: 'CheerpX Wasm',
    description: 'Full Debian Linux x86 terminal in WebAssembly · ₹0 Server Cost · Client CPU/RAM',
    url: 'https://webvm.io/',
  },
  v86: {
    id: 'v86',
    name: 'v86 Linux',
    badge: 'x86 PC Wasm',
    description: 'Instant x86 PC Linux 2.6 emulator in WebAssembly · ₹0 Server Cost · Client CPU/RAM',
    url: 'https://copy.sh/v86/?profile=linux26',
  },
  backend: {
    id: 'backend',
    name: 'Host Docker',
    badge: 'Local noVNC',
    description: 'Local host agent computer running Chromium, xterm, and PCManFM over noVNC',
    url: null,
  },
};

export default function HostedLinuxComputer({ autoResume, onRunningChange, onEvent, onUserStop }) {
  const [engine, setEngine] = useState('webvm');
  const [status, setStatus] = useState('stopped');
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [streamLoaded, setStreamLoaded] = useState(false);

  const statusRef = useRef(status);
  const sessionRef = useRef(session);
  const mountedRef = useRef(true);
  const startPromiseRef = useRef(null);
  const eventRef = useRef(onEvent);
  const runningCallbackRef = useRef(onRunningChange);

  eventRef.current = onEvent;
  runningCallbackRef.current = onRunningChange;
  sessionRef.current = session;

  const emit = useCallback((message) => eventRef.current?.(message), []);
  const updateStatus = useCallback((next) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
    runningCallbackRef.current?.(next === 'running');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const runtime = await controlRequest('status');
        if (!mountedRef.current) return;
        const isAvail = Boolean(runtime.available);
        setBackendAvailable(isAvail);
        if (isAvail && runtime.running) {
          const liveSession = await controlRequest('session');
          if (!mountedRef.current) return;
          setEngine('backend');
          setSession(liveSession);
          setStreamLoaded(false);
          updateStatus('running');
        }
      } catch {
        if (!mountedRef.current) return;
        setBackendAvailable(false);
      }
    })();
    return () => {
      mountedRef.current = false;
      if (sessionRef.current && sessionRef.current.is_backend) {
        fetch('/api/v1/agent-computer/stop', { method: 'POST', keepalive: true }).catch(() => {});
      }
      runningCallbackRef.current?.(false);
    };
  }, [updateStatus]);

  const start = useCallback(() => {
    if (statusRef.current === 'running' && sessionRef.current) return Promise.resolve();
    if (startPromiseRef.current) return startPromiseRef.current;

    const promise = (async () => {
      updateStatus('starting');
      setError('');

      if (engine === 'backend') {
        try {
          const liveSession = await controlRequest('start', 'POST');
          if (!mountedRef.current) {
            await controlRequest('stop', 'POST').catch(() => {});
            return;
          }
          const wrapped = { ...liveSession, is_backend: true };
          setSession(wrapped);
          sessionRef.current = wrapped;
          setStreamLoaded(false);
          updateStatus('running');
          emit('Hosted Linux desktop started with real Chromium, terminal and file manager processes.');
        } catch (startError) {
          updateStatus('error');
          setError(startError.message);
          emit(`Hosted Linux start failed: ${startError.message}`);
        }
      } else {
        const wasmConfig = WASM_ENGINES[engine] || WASM_ENGINES.webvm;
        const wasmSession = {
          session_id: `wasm-${engine}-${Date.now()}`,
          frame_url: wasmConfig.url,
          is_backend: false,
          name: wasmConfig.name,
        };
        setSession(wasmSession);
        sessionRef.current = wasmSession;
        setStreamLoaded(false);
        updateStatus('running');
        emit(`Booted in-browser Linux via WebAssembly (${wasmConfig.name}). Running 100% client-side with ₹0 server cost.`);
      }
    })();

    startPromiseRef.current = promise;
    promise.finally(() => { if (startPromiseRef.current === promise) startPromiseRef.current = null; });
    return promise;
  }, [engine, emit, updateStatus]);

  const stop = useCallback(async () => {
    if (startPromiseRef.current) await startPromiseRef.current;
    updateStatus('stopping');
    try {
      if (sessionRef.current?.is_backend) {
        await controlRequest('stop', 'POST');
      }
      setSession(null);
      sessionRef.current = null;
      setStreamLoaded(false);
      updateStatus('stopped');
      emit('Agent PC stopped. Client memory freed.');
    } catch (stopError) {
      updateStatus('error');
      setError(stopError.message);
    }
  }, [emit, updateStatus]);

  useEffect(() => {
    if (!autoResume) return undefined;
    const syncWithVisibility = () => { if (document.hidden) stop(); else start(); };
    syncWithVisibility();
    document.addEventListener('visibilitychange', syncWithVisibility);
    return () => document.removeEventListener('visibilitychange', syncWithVisibility);
  }, [autoResume, start, stop]);

  const running = status === 'running' && Boolean(session);
  const busy = status === 'starting' || status === 'stopping' || status === 'checking';
  const activeConfig = WASM_ENGINES[engine] || WASM_ENGINES.webvm;

  return (
    <section className={`computer-shell surface hosted-computer ${running ? 'is-running' : ''}`} aria-label="Real GUI Agent PC" data-runtime-status={status}>
      <div className="computer-topbar">
        <div className="computer-identity">
          <span><Container size={21} /></span>
          <div>
            <strong>Agent PC · Live Linux GUI</strong>
            <small>{activeConfig.name} · {engine === 'backend' ? 'Local noVNC Docker' : 'WebAssembly Client-Side (₹0 Server Cost)'}</small>
          </div>
        </div>
        <div className="computer-controls">
          <span className={`computer-power-state ${running ? 'is-on' : ''}`}><i />{status.toUpperCase()}</span>
          {running || busy ? (
            <button type="button" className="ui-button ui-button--secondary" disabled={status === 'stopping' || status === 'checking'} onClick={() => { onUserStop?.(); stop(); }}>
              <Pause size={15} />{busy ? 'Working…' : 'Stop'}
            </button>
          ) : (
            <button type="button" className="ui-button ui-button--primary" onClick={start}>
              <Play size={15} />Start Agent PC
            </button>
          )}
        </div>
      </div>

      <div className="browser-computer__notice">
        <MonitorPlay size={14} />
        <span>
          {engine === 'backend'
            ? 'Host Docker Linux GUI runtime over noVNC. Host network enabled.'
            : '⚡ 100% Free (Zero Server Cost) · Pure WebAssembly Linux running on client CPU/RAM.'}
        </span>
      </div>

      {error ? <div className="error-callout browser-computer__error" role="alert">{error}</div> : null}

      <div className={`computer-screen hosted-computer__screen ${running ? '' : 'computer-screen--off'}`}>
        {running && session ? (
          <div className="hosted-computer__stream">
            {!streamLoaded ? (
              <div className="hosted-computer__loading" role="status">
                <MonitorPlay size={24} />
                <span>Loading {activeConfig.name} stream…</span>
              </div>
            ) : null}
            <iframe
              key={session.session_id}
              className="hosted-computer__frame"
              title={`Agent PC Linux desktop - ${activeConfig.name}`}
              src={session.frame_url}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-pointer-lock"
              allow="clipboard-read; clipboard-write; fullscreen"
              onLoad={(event) => {
                setStreamLoaded(true);
                themeNoVncControls(event.currentTarget);
              }}
            />
          </div>
        ) : (
          <div className="computer-stopped">
            <span><Container size={34} /></span>
            <h2>Agent PC is stopped</h2>
            <p>
              Choose your Linux engine below. WebVM and v86 run real Linux directly in this browser with WebAssembly at ₹0 server cost.
            </p>

            <div className="hosted-computer__modes" role="group" aria-label="Select Linux engine">
              {Object.values(WASM_ENGINES).map((eng) => (
                <button
                  key={eng.id}
                  type="button"
                  className={`hosted-computer__mode-btn ${engine === eng.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setEngine(eng.id);
                    setError('');
                  }}
                >
                  <span>{eng.name}</span>
                  <span className="hosted-computer__badge">{eng.badge}</span>
                </button>
              ))}
            </div>

            <p style={{ fontSize: '11px', color: 'var(--ink-faint)', maxWidth: '420px', margin: '0 auto 12px' }}>
              {activeConfig.description}
            </p>

            {engine === 'backend' && !backendAvailable ? (
              <div>
                <p style={{ color: '#ff97a3', fontSize: '11px', marginBottom: '8px' }}>
                  Local backend server is not connected. Use Debian WebVM or v86 above for instant zero-server-cost Linux.
                </p>
                <code className="hosted-computer__setup">sudo bash scripts/setup-agent-computer.sh</code>
              </div>
            ) : (
              <button type="button" className="ui-button ui-button--primary" disabled={busy} onClick={start}>
                <Play size={15} />Boot {activeConfig.name}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="browser-computer__footnote">
        {engine === 'backend'
          ? 'Local Docker POC. Production multi-user use requires authentication, per-user VMs, egress policy, and private VNC.'
          : 'Client-side WebAssembly execution. 100% private in your browser, ₹0 infrastructure cost.'}
      </div>
    </section>
  );
}
