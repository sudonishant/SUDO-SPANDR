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

export default function HostedLinuxComputer({ autoResume, onRunningChange, onEvent, onUserStop }) {
  const [status, setStatus] = useState('checking');
  const [available, setAvailable] = useState(false);
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
        setAvailable(Boolean(runtime.available));
        if (runtime.running) {
          const liveSession = await controlRequest('session');
          if (!mountedRef.current) return;
          setSession(liveSession);
          setStreamLoaded(false);
          updateStatus('running');
        } else {
          updateStatus(runtime.available ? 'stopped' : 'unavailable');
          if (!runtime.available) setError('Hosted Linux dependencies are not installed on this host. Run the documented setup script to enable this optional mode.');
        }
      } catch (probeError) {
        if (!mountedRef.current) return;
        setAvailable(false);
        updateStatus('unavailable');
        setError(`Hosted Linux is not connected here. ${probeError.message}`);
      }
    })();
    return () => {
      mountedRef.current = false;
      if (sessionRef.current) fetch('/api/v1/agent-computer/stop', { method: 'POST', keepalive: true }).catch(() => {});
      runningCallbackRef.current?.(false);
    };
  }, [updateStatus]);

  const start = useCallback(() => {
    if (statusRef.current === 'running' && sessionRef.current) return Promise.resolve();
    if (startPromiseRef.current) return startPromiseRef.current;
    const promise = (async () => {
      updateStatus('starting');
      setError('');
      try {
        const liveSession = await controlRequest('start', 'POST');
        if (!mountedRef.current) {
          await controlRequest('stop', 'POST').catch(() => {});
          return;
        }
        setSession(liveSession);
        sessionRef.current = liveSession;
        setStreamLoaded(false);
        updateStatus('running');
        emit('Hosted Linux desktop started with real Chromium, terminal and file manager processes.');
      } catch (startError) {
        updateStatus('error');
        setError(startError.message);
        emit(`Hosted Linux start failed: ${startError.message}`);
      }
    })();
    startPromiseRef.current = promise;
    promise.finally(() => { if (startPromiseRef.current === promise) startPromiseRef.current = null; });
    return promise;
  }, [emit, updateStatus]);

  const stop = useCallback(async () => {
    if (startPromiseRef.current) await startPromiseRef.current;
    if (statusRef.current === 'unavailable') return;
    updateStatus('stopping');
    try {
      await controlRequest('stop', 'POST');
      setSession(null);
      sessionRef.current = null;
      setStreamLoaded(false);
      updateStatus('stopped');
      emit('Hosted Linux processes stopped. The guest home remains on its host.');
    } catch (stopError) {
      updateStatus('error');
      setError(stopError.message);
    }
  }, [emit, updateStatus]);

  useEffect(() => {
    if (!autoResume || !available) return undefined;
    const syncWithVisibility = () => { if (document.hidden) stop(); else start(); };
    syncWithVisibility();
    document.addEventListener('visibilitychange', syncWithVisibility);
    return () => document.removeEventListener('visibilitychange', syncWithVisibility);
  }, [autoResume, available, start, stop]);

  const running = status === 'running' && session;
  const busy = status === 'starting' || status === 'stopping' || status === 'checking';

  return (
    <section className={`computer-shell surface hosted-computer ${running ? 'is-running' : ''}`} aria-label="Real GUI Agent PC" data-runtime-status={status}>
      <div className="computer-topbar">
        <div className="computer-identity"><span><Container size={21} /></span><div><strong>Agent PC · Live Linux GUI</strong><small>Real Chromium · xterm · PCManFM · dedicated unprivileged user</small></div></div>
        <div className="computer-controls">
          <span className={`computer-power-state ${running ? 'is-on' : ''}`}><i />{status.toUpperCase()}</span>
          {running || busy ? <button type="button" className="ui-button ui-button--secondary" disabled={status === 'stopping' || status === 'checking'} onClick={() => { onUserStop?.(); stop(); }}><Pause size={15} />{busy ? 'Working…' : 'Stop'}</button> : <button type="button" className="ui-button ui-button--primary" disabled={!available} onClick={start}><Play size={15} />Start Agent PC</button>}
        </div>
      </div>

      <div className="browser-computer__notice"><MonitorPlay size={14} /><span>Real Linux GUI runtime. Network enabled; not air-gapped and not a hardware VM. Host workspace is not mounted.</span></div>
      {error ? <div className="error-callout browser-computer__error" role="alert">{error}</div> : null}

      <div className={`computer-screen hosted-computer__screen ${running ? '' : 'computer-screen--off'}`}>
        {running ? (
          <div className="hosted-computer__stream">
            {!streamLoaded ? <div className="hosted-computer__loading" role="status"><MonitorPlay size={24} /><span>Loading the real Linux desktop stream…</span></div> : null}
            <iframe
              key={session.session_id}
              className="hosted-computer__frame"
              title="Real hosted Linux desktop"
              src={session.frame_url}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              allow="clipboard-read; clipboard-write"
              onLoad={(event) => { setStreamLoaded(true); themeNoVncControls(event.currentTarget); }}
            />
          </div>
        ) : (
          <div className="computer-stopped">
            <span><Container size={34} /></span>
            <h2>{status === 'unavailable' ? 'Agent PC host is not connected' : 'Agent PC is stopped'}</h2>
            <p>{status === 'unavailable' ? 'The real GUI needs the local control server and OS packages. Browser Node.js remains available as a secondary workshop without a compute backend.' : 'Start launches actual desktop processes. No incoming mail or shell runs in the background while stopped.'}</p>
            {status === 'unavailable' ? <code className="hosted-computer__setup">sudo bash scripts/setup-agent-computer.sh</code> : <button type="button" className="ui-button ui-button--primary" disabled={!available || busy} onClick={start}><Play size={15} />Boot real Agent PC</button>}
          </div>
        )}
      </div>
      <div className="browser-computer__footnote">Local POC only. Production multi-user use requires authentication, per-user VMs/containers, egress policy, quotas and private VNC.</div>
    </section>
  );
}
