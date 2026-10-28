import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CheckCircle2, Container, Download, FileSearch, FolderOpen, Globe2, HardDrive,
  Mail, MonitorPlay, Pause, Play, ShieldAlert, Upload, X,
} from 'lucide-react';
import { useForensicStore } from '../store/useForensicStore';
import { downloadCase } from '../lib/workspaceUtils';
import { PageHeader, RiskBadge, StatusLine } from '../components/WorkspaceUI';

function triagePlan(data) {
  const score = Number(data?.threat?.risk_score) || 0;
  if (score >= 70) {
    return {
      title: 'Quarantine review recommended',
      tone: 'high',
      steps: ['Do not open links or attachments on the analyst workstation.', 'Preserve the original message and verify the sender through an independent channel.', 'Review the score ledger, then follow your organisation’s quarantine procedure.'],
    };
  }
  if (score >= 35) {
    return {
      title: 'Analyst review required',
      tone: 'medium',
      steps: ['Verify sender identity, authentication evidence and message context.', 'Review every URL and attachment independently before taking action.', 'Record an analyst decision; the heuristic score is not a final verdict.'],
    };
  }
  return {
    title: 'No high-risk rule matched',
    tone: 'low',
    steps: ['This result does not prove that the message is safe.', 'Check missing authentication and transport evidence before trusting the content.', 'Keep the case for review or clear it according to your retention policy.'],
  };
}

function eventTime(value) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function WindowBar({ icon: Icon, title, onClose, closeLabel }) {
  return (
    <header className="computer-window__bar">
      <span className="computer-window__lights" aria-hidden="true"><i /><i /><i /></span>
      <span className="computer-window__title"><Icon size={13} />{title}</span>
      <button type="button" className="computer-window__close" aria-label={closeLabel} onClick={onClose}><X size={13} /></button>
    </header>
  );
}

export default function SandboxPage({ onNavigate, onViewCase, health }) {
  const { analyzeFile, cases, loading, storageStatus } = useForensicStore();
  const [running, setRunning] = useState(false);
  const [autoResume, setAutoResume] = useState(() => {
    try { return localStorage.getItem('spandr-computer-auto') === 'true'; } catch { return false; }
  });
  const [lastResult, setLastResult] = useState(null);
  const [intakeError, setIntakeError] = useState('');
  const [events, setEvents] = useState(() => [{ id: 'ready', at: new Date().toISOString(), message: 'Runtime ready. No mail has been processed.' }]);
  const [openPanes, setOpenPanes] = useState({ intake: true, result: true });
  const [activePane, setActivePane] = useState('intake');
  const [startOpen, setStartOpen] = useState(false);
  const fileRef = useRef(null);
  const edgeSandbox = health?.host_dependent_subsystems?.AIR_GAPPED_DETONATION_SANDBOX;
  const remoteAvailable = Boolean(edgeSandbox?.available_at_edge);
  const restoredResult = cases.find((item) => item._workspace?.origin === 'web-computer');
  const currentResult = lastResult || restoredResult || null;
  const plan = currentResult ? triagePlan(currentResult) : null;

  const addEvent = (message) => {
    const at = new Date().toISOString();
    setEvents((current) => [{ id: `${at}-${Math.random()}`, at, message }, ...current].slice(0, 8));
  };

  const openPane = (pane) => {
    setOpenPanes((current) => ({ ...current, [pane]: true }));
    setActivePane(pane);
    setStartOpen(false);
  };

  const closePane = (pane) => {
    setOpenPanes((current) => ({ ...current, [pane]: false }));
    setActivePane((current) => (current === pane ? (pane === 'intake' ? 'result' : 'intake') : current));
  };

  useEffect(() => {
    try { localStorage.setItem('spandr-computer-auto', String(autoResume)); } catch { /* optional preference */ }
  }, [autoResume]);

  useEffect(() => {
    if (!autoResume) return undefined;
    const syncWithVisibility = () => setRunning(!document.hidden);
    syncWithVisibility();
    document.addEventListener('visibilitychange', syncWithVisibility);
    return () => document.removeEventListener('visibilitychange', syncWithVisibility);
  }, [autoResume]);

  const start = () => {
    setRunning(true);
    setIntakeError('');
    setStartOpen(false);
    setOpenPanes({ intake: true, result: true });
    setActivePane('intake');
    addEvent('Web Computer started. Local guest desktop and mail intake are now available.');
  };

  const stop = () => {
    setRunning(false);
    setAutoResume(false);
    setStartOpen(false);
    addEvent('Web Computer stopped. No background mail intake remains active.');
  };

  const processFile = async (file) => {
    if (!file) return;
    if (!running) {
      setIntakeError('Start Web Computer before submitting mail.');
      return;
    }
    if (!/\.(eml|msg)$/i.test(file.name)) {
      setIntakeError('Web Computer currently accepts .eml and .msg mail files. Use New analysis for standalone attachments.');
      openPane('intake');
      return;
    }
    setIntakeError('');
    openPane('intake');
    addEvent(`Reading ${file.name} locally.`);
    const result = await analyzeFile(file, { sourceLabel: file.name, origin: 'web-computer' });
    if (result) {
      setLastResult(result);
      openPane('result');
      addEvent(`${file.name}: analysis complete with triage score ${result.threat?.risk_score || 0}/100.`);
    } else {
      setIntakeError('The message could not be analyzed. No result was generated; check the file and try again.');
      openPane('intake');
      addEvent(`${file.name}: analysis failed without generating a verdict.`);
    }
  };

  const goTo = (route) => {
    setStartOpen(false);
    onNavigate(route);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="On-demand mail operations"
        title="Virtual web computer"
        description={storageStatus === 'ready' ? 'Start a local mail-triage runtime when you need it. It accepts EML/MSG evidence, analyzes it automatically, creates an action plan and saves the case on this device.' : storageStatus === 'loading' ? 'Start a local mail-triage runtime when you need it. It accepts EML/MSG evidence, analyzes it automatically and creates an action plan while device storage is restored.' : 'Start a local mail-triage runtime when you need it. It accepts EML/MSG evidence, analyzes it automatically and creates an action plan; device storage is currently unavailable, so cases remain in this tab.'}
        meta={<StatusLine tone={running ? 'ready' : 'neutral'}>{running ? 'Running on this tab' : 'Stopped'}</StatusLine>}
      />

      <section className={`computer-shell surface ${running ? 'is-running' : ''}`} aria-label="Virtual web computer runtime">
        <div className="computer-topbar">
          <div className="computer-identity"><span><MonitorPlay size={21} /></span><div><strong>SUDO Web Computer</strong><small>Workspace guest desktop · local mail triage · not a remote VM</small></div></div>
          <div className="computer-controls">
            <span className={`computer-power-state ${running ? 'is-on' : ''}`}><i />{running ? 'ACTIVE' : 'OFFLINE'}</span>
            {running ? <button type="button" className="ui-button ui-button--secondary" onClick={stop}><Pause size={15} />Stop</button> : <button type="button" className="ui-button ui-button--primary" onClick={start}><Play size={15} />Start Web Computer</button>}
          </div>
        </div>

        <div className={`computer-screen ${running ? 'computer-screen--desktop' : 'computer-screen--off'}`}>
          {!running ? (
            <div className="computer-stopped">
              <span><MonitorPlay size={34} /></span>
              <h2>Computer is stopped</h2>
              <p>Nothing runs in the background. Start the workspace guest desktop manually, or enable active-tab auto-resume below.</p>
              <button type="button" className="ui-button ui-button--primary" onClick={start}><Play size={15} />Start local runtime</button>
            </div>
          ) : (
            <div className="computer-desktop">
              <div className="computer-desktop__topline"><span><i />SUDO-SPANDR / LOCAL GUEST DESKTOP</span><span>Mail triage only · no remote execution</span></div>
              <div className="computer-desktop__icons" aria-label="Guest desktop apps">
                <button type="button" onClick={() => openPane('intake')}><span><Mail size={16} /></span>Mail intake</button>
                <button type="button" onClick={() => openPane('result')}><span><FileSearch size={16} /></span>Triage report</button>
                <button type="button" onClick={() => goTo('cases')}><span><FolderOpen size={16} /></span>Case library</button>
              </div>

              <div className="computer-workspace">
                {openPanes.intake ? (
                  <section className={`computer-mail-intake computer-window ${activePane === 'intake' ? 'is-active' : ''}`} aria-labelledby="computer-intake-title" onPointerDown={() => setActivePane('intake')}>
                    <WindowBar icon={Mail} title="Mail intake · local guest app" onClose={() => closePane('intake')} closeLabel="Close mail intake window" />
                    <div className="computer-window__content">
                      <div className="computer-pane-title"><span><Mail size={18} /></span><div><h2 id="computer-intake-title">Mail intake</h2><p>Automatic analysis as soon as a message arrives here.</p></div></div>
                      <div
                        className="computer-dropzone"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => { event.preventDefault(); processFile(event.dataTransfer.files?.[0]); }}
                      >
                        <span><Upload size={23} /></span>
                        <strong>{loading ? 'Analyzing message…' : 'Drop an .eml or .msg file'}</strong>
                        <p>The message is parsed locally; no mailbox credentials or remote upload are used.</p>
                        <button type="button" className="ui-button ui-button--secondary" disabled={loading} onClick={() => fileRef.current?.click()}><Mail size={15} />{loading ? 'Please wait…' : 'Select mail file'}</button>
                        <input ref={fileRef} type="file" accept=".eml,.msg" hidden onChange={(event) => { processFile(event.target.files?.[0]); event.target.value = ''; }} />
                      </div>
                      {intakeError ? <div className="error-callout" role="alert">{intakeError}</div> : null}
                      <div className="computer-automation"><CheckCircle2 size={15} /><span><strong>Automatic local steps</strong>Parse → score → action plan → device case storage</span></div>
                    </div>
                  </section>
                ) : null}

                {openPanes.result ? (
                  <section className={`computer-result computer-window ${activePane === 'result' ? 'is-active' : ''}`} aria-live="polite" aria-label="Latest mail triage result" onPointerDown={() => setActivePane('result')}>
                    <WindowBar icon={FileSearch} title="Triage report · local guest app" onClose={() => closePane('result')} closeLabel="Close triage report window" />
                    <div className="computer-window__content">
                      {currentResult ? (
                        <>
                          <div className="computer-result__head"><div><span className="ui-eyebrow">Latest processed mail</span><h2>{currentResult._workspace?.sourceLabel || currentResult.case_id}</h2><code>{currentResult.case_id}</code></div><RiskBadge data={currentResult} compact /></div>
                          <div className="computer-score"><span>Triage score</span><strong>{currentResult.threat?.risk_score || 0}<small>/100</small></strong></div>
                          <div className={`computer-plan computer-plan--${plan.tone}`}><strong>{plan.title}</strong><ol>{plan.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
                          <div className="computer-result__actions"><button type="button" className="ui-button ui-button--primary" onClick={() => onViewCase(currentResult.case_id)}>Open full case<ArrowRight size={15} /></button><button type="button" className="ui-button ui-button--secondary" onClick={() => downloadCase(currentResult)}><Download size={15} />Export</button></div>
                        </>
                      ) : (
                        <div className="computer-result__empty"><FileSearch size={28} /><h2>Waiting for mail</h2><p>Drop a message into Mail intake. The action plan will appear here without executing links or attachments.</p><button type="button" className="ui-button ui-button--secondary" onClick={() => openPane('intake')}><Mail size={14} />Open mail intake</button></div>
                      )}
                    </div>
                  </section>
                ) : null}

                {!openPanes.intake && !openPanes.result ? <div className="computer-desktop__empty"><MonitorPlay size={26} /><strong>Guest desktop is ready</strong><p>Open an app from the desktop icons or taskbar.</p><button type="button" className="ui-button ui-button--primary" onClick={() => openPane('intake')}><Mail size={14} />Open mail intake</button></div> : null}
              </div>

              {startOpen ? <div className="computer-startmenu" id="computer-start-menu"><strong>Web Computer · local apps</strong><button type="button" onClick={() => openPane('intake')}><Mail size={14} />Mail intake</button><button type="button" onClick={() => openPane('result')}><FileSearch size={14} />Triage report</button><button type="button" onClick={() => goTo('cases')}><FolderOpen size={14} />Open case library</button><button type="button" onClick={() => goTo('url-lab')}><Globe2 size={14} />Open URL Lab</button></div> : null}
              <div className="computer-taskbar">
                <button type="button" className="computer-taskbar__start" aria-expanded={startOpen} aria-controls="computer-start-menu" onClick={() => setStartOpen((current) => !current)}><MonitorPlay size={13} />Start</button>
                <button type="button" className={openPanes.intake && activePane === 'intake' ? 'is-active' : ''} onClick={() => openPane('intake')}><Mail size={13} />Mail</button>
                <button type="button" className={openPanes.result && activePane === 'result' ? 'is-active' : ''} onClick={() => openPane('result')}><FileSearch size={13} />Triage</button>
                <span className="computer-taskbar__status"><i />LOCAL ONLY · no remote VM</span>
              </div>
            </div>
          )}
        </div>

        <div className="computer-statusbar">
          <label className="computer-auto"><input type="checkbox" checked={autoResume} onChange={(event) => { const enabled = event.target.checked; setAutoResume(enabled); if (enabled) setRunning(!document.hidden); addEvent(`Active-tab auto-resume ${enabled ? 'enabled' : 'disabled'}.`); }} /><span><strong>Active-tab auto-resume</strong><small>Runs only while this tab is visible; it does not monitor email in the background.</small></span></label>
          <span className="computer-storage"><HardDrive size={14} />{storageStatus === 'ready' ? 'Cases saved on device' : storageStatus === 'loading' ? 'Restoring storage…' : 'Memory fallback'}</span>
        </div>
      </section>

      <div className="computer-lower-grid">
        <section className="surface surface--padded">
          <div className="section-icon-title"><span><CheckCircle2 size={19} /></span><div><h2>Runtime activity</h2><p>Actual events from this Web Computer view.</p></div></div>
          <ol className="computer-event-list" aria-live="polite">{events.map((event) => <li key={event.id}><time dateTime={event.at}>{eventTime(event.at)}</time><span>{event.message}</span></li>)}</ol>
        </section>

        <section className="surface surface--padded">
          <div className="section-icon-title"><span><Container size={19} /></span><div><h2>External execution & mailbox</h2><p>Integrations are shown only when genuinely configured.</p></div></div>
          <dl className="runtime-list"><div><dt>Real mailbox / IMAP</dt><dd>Not connected</dd></div><div><dt>Remote isolated VM</dt><dd>{remoteAvailable ? 'Reported available' : 'Not connected'}</dd></div><div><dt>Automatic mail actions</dt><dd>Recommendations only</dd></div></dl>
          <p className="computer-integration-note">Live mail receiving, quarantine, replies or remote browsing require authenticated backend connectors and an isolated worker. This page never claims those actions happened.</p>
          <button type="button" className="ui-button ui-button--secondary" onClick={() => onNavigate('url-lab')}><Globe2 size={15} />Open network-free URL Lab</button>
        </section>
      </div>

      <section className="info-callout"><ShieldAlert size={18} /><div><strong>Human approval stays in the loop</strong><p>Web Computer analyzes submitted mail and drafts a triage plan. It does not auto-reply, delete, quarantine, open links, or declare a message safe.</p></div></section>
    </div>
  );
}
