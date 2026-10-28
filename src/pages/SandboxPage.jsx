import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CheckCircle2, Code2, Container, Download, FileSearch, Globe2, HardDrive,
  Mail, MonitorPlay, ShieldAlert, Upload,
} from 'lucide-react';
import { useForensicStore } from '../store/useForensicStore';
import { downloadCase } from '../lib/workspaceUtils';
import { PageHeader, RiskBadge, StatusLine } from '../components/WorkspaceUI';
import BrowserComputer from '../components/BrowserComputer';
import HostedLinuxComputer from '../components/HostedLinuxComputer';

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

export default function SandboxPage({ onNavigate, onViewCase }) {
  const { analyzeFile, cases, loading, storageStatus } = useForensicStore();
  const [runtimeMode, setRuntimeMode] = useState(() => {
    try { return localStorage.getItem('spandr-computer-runtime') === 'linux' ? 'linux' : 'browser'; } catch { return 'browser'; }
  });
  const [running, setRunning] = useState(false);
  const [autoResume, setAutoResume] = useState(() => {
    try { return localStorage.getItem('spandr-computer-auto') === 'true'; } catch { return false; }
  });
  const [lastResult, setLastResult] = useState(null);
  const [intakeError, setIntakeError] = useState('');
  const [events, setEvents] = useState(() => [{ id: 'ready', at: new Date().toISOString(), message: 'No computer runtime started. No mail has been processed.' }]);
  const fileRef = useRef(null);
  const restoredResult = cases.find((item) => item._workspace?.origin === 'web-computer');
  const currentResult = lastResult || restoredResult || null;
  const plan = currentResult ? triagePlan(currentResult) : null;

  const addEvent = useCallback((message) => {
    const at = new Date().toISOString();
    setEvents((current) => [{ id: `${at}-${Math.random()}`, at, message }, ...current].slice(0, 10));
  }, []);

  useEffect(() => {
    try { localStorage.setItem('spandr-computer-auto', String(autoResume)); } catch { /* optional preference */ }
  }, [autoResume]);

  const selectRuntime = (mode) => {
    if (mode === runtimeMode) return;
    setRunning(false);
    setRuntimeMode(mode);
    setIntakeError('');
    try { localStorage.setItem('spandr-computer-runtime', mode); } catch { /* optional preference */ }
    addEvent(`Switched to ${mode === 'browser' ? 'browser Node.js' : 'hosted Linux'} mode.`);
  };

  const processFile = async (file) => {
    if (!file) return;
    if (!running) {
      setIntakeError('Start the selected computer before submitting mail.');
      return;
    }
    if (!/\.(eml|msg)$/i.test(file.name)) {
      setIntakeError('Mail automation accepts .eml and .msg files. Use New analysis for standalone attachments.');
      return;
    }
    setIntakeError('');
    addEvent(`Reading ${file.name} locally.`);
    const result = await analyzeFile(file, { sourceLabel: file.name, origin: 'web-computer' });
    if (result) {
      setLastResult(result);
      addEvent(`${file.name}: analysis complete with triage score ${result.threat?.risk_score || 0}/100.`);
    } else {
      setIntakeError('The message could not be analyzed. No result was generated; check the file and try again.');
      addEvent(`${file.name}: analysis failed without generating a verdict.`);
    }
  };

  const runtimeProps = {
    autoResume,
    onRunningChange: setRunning,
    onEvent: addEvent,
    onUserStop: () => setAutoResume(false),
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Real browser and hosted computing"
        title="Virtual web computer"
        description={storageStatus === 'ready' ? 'Run a real Node.js workspace in your browser, or connect the optional hosted Linux desktop. Submitted EML/MSG evidence can then be analyzed and saved as a device case.' : storageStatus === 'loading' ? 'Run a real Node.js workspace in your browser, or connect the optional hosted Linux desktop. Device case storage is being restored.' : 'Run a real Node.js workspace in your browser, or connect the optional hosted Linux desktop. Device case storage is unavailable, so new cases remain in this tab.'}
        meta={<StatusLine tone={running ? 'ready' : 'neutral'}>{running ? `${runtimeMode === 'browser' ? 'Browser runtime' : 'Linux desktop'} running` : 'Selected runtime stopped'}</StatusLine>}
      />

      <div className="runtime-mode-switch" role="group" aria-label="Computer runtime type">
        <button type="button" className={runtimeMode === 'browser' ? 'is-active' : ''} aria-pressed={runtimeMode === 'browser'} onClick={() => selectRuntime('browser')}><Code2 size={17} /><span><strong>Browser Node.js</strong><small>WebContainers + terminal + editor</small></span></button>
        <button type="button" className={runtimeMode === 'linux' ? 'is-active' : ''} aria-pressed={runtimeMode === 'linux'} onClick={() => selectRuntime('linux')}><Container size={17} /><span><strong>Hosted Linux</strong><small>Optional Chromium + terminal + files</small></span></button>
      </div>

      {runtimeMode === 'browser' ? <BrowserComputer {...runtimeProps} /> : <HostedLinuxComputer {...runtimeProps} />}

      <div className="computer-preferences surface">
        <label className="computer-auto"><input type="checkbox" checked={autoResume} onChange={(event) => { const enabled = event.target.checked; setAutoResume(enabled); addEvent(`Active-tab auto-resume ${enabled ? 'enabled' : 'disabled'} for the selected runtime.`); }} /><span><strong>Active-tab auto-resume</strong><small>Starts the selected runtime while visible and stops it when hidden. It does not monitor email.</small></span></label>
        <span className="computer-storage"><HardDrive size={14} />{storageStatus === 'ready' ? 'Cases saved on device' : storageStatus === 'loading' ? 'Restoring storage…' : 'Memory fallback'}</span>
      </div>

      <section className="mail-automation-section" aria-labelledby="mail-automation-title">
        <div className="section-heading"><div><span className="ui-eyebrow">Workspace automation</span><h2 id="mail-automation-title">Submitted mail triage</h2><p>After you submit a message, the existing local analyzer scores it and prepares a review plan. No mailbox is connected.</p></div><span className={`mail-automation-state ${running ? 'is-ready' : ''}`}><i />{running ? 'Ready for submitted files' : 'Start a computer first'}</span></div>
        <div className="mail-automation-grid">
          <section className="surface surface--padded" aria-labelledby="computer-intake-title">
            <div className="computer-pane-title"><span><Mail size={18} /></span><div><h2 id="computer-intake-title">Mail intake</h2><p>Automatic analysis after a file is submitted here.</p></div></div>
            <div
              className={`computer-dropzone ${!running ? 'is-disabled' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); processFile(event.dataTransfer.files?.[0]); }}
            >
              <span><Upload size={23} /></span>
              <strong>{loading ? 'Analyzing message…' : 'Drop an .eml or .msg file'}</strong>
              <p>The message is parsed locally; no mailbox credentials or remote upload are used.</p>
              <button type="button" className="ui-button ui-button--secondary" disabled={loading || !running} onClick={() => fileRef.current?.click()}><Mail size={15} />{loading ? 'Please wait…' : 'Select mail file'}</button>
              <input ref={fileRef} type="file" accept=".eml,.msg" hidden onChange={(event) => { processFile(event.target.files?.[0]); event.target.value = ''; }} />
            </div>
            {intakeError ? <div className="error-callout" role="alert">{intakeError}</div> : null}
            <div className="computer-automation"><CheckCircle2 size={15} /><span><strong>Automatic local steps</strong>Parse → score → action plan → device case storage</span></div>
          </section>

          <section className="surface surface--padded" aria-live="polite" aria-label="Latest mail triage result">
            {currentResult ? (
              <>
                <div className="computer-result__head"><div><span className="ui-eyebrow">Latest processed mail</span><h2>{currentResult._workspace?.sourceLabel || currentResult.case_id}</h2><code>{currentResult.case_id}</code></div><RiskBadge data={currentResult} compact /></div>
                <div className="computer-score"><span>Triage score</span><strong>{currentResult.threat?.risk_score || 0}<small>/100</small></strong></div>
                <div className={`computer-plan computer-plan--${plan.tone}`}><strong>{plan.title}</strong><ol>{plan.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
                <div className="computer-result__actions"><button type="button" className="ui-button ui-button--primary" onClick={() => onViewCase(currentResult.case_id)}>Open full case<ArrowRight size={15} /></button><button type="button" className="ui-button ui-button--secondary" onClick={() => downloadCase(currentResult)}><Download size={15} />Export</button></div>
              </>
            ) : (
              <div className="computer-result__empty"><FileSearch size={28} /><h2>Waiting for submitted mail</h2><p>Start a runtime and submit a message. The action plan will appear here without executing links or attachments.</p></div>
            )}
          </section>
        </div>
      </section>

      <div className="computer-lower-grid">
        <section className="surface surface--padded">
          <div className="section-icon-title"><span><CheckCircle2 size={19} /></span><div><h2>Runtime activity</h2><p>Actual events from this Web Computer view.</p></div></div>
          <ol className="computer-event-list" aria-live="polite">{events.map((event) => <li key={event.id}><time dateTime={event.at}>{eventTime(event.at)}</time><span>{event.message}</span></li>)}</ol>
        </section>

        <section className="surface surface--padded">
          <div className="section-icon-title"><span><MonitorPlay size={19} /></span><div><h2>Execution & mailbox boundaries</h2><p>Capabilities are labeled by their real runtime.</p></div></div>
          <dl className="runtime-list"><div><dt>Browser WebContainer</dt><dd>{runtimeMode === 'browser' && running ? 'Running in this tab' : 'Available; stopped'}</dd></div><div><dt>Hosted Linux desktop</dt><dd>{runtimeMode === 'linux' && running ? 'Running on configured host' : 'Optional; not running'}</dd></div><div><dt>Real mailbox / IMAP</dt><dd>Not connected</dd></div><div><dt>Automatic mail actions</dt><dd>Recommendations only</dd></div></dl>
          <p className="computer-integration-note">Live mail receiving, quarantine, replies or remote browsing require authenticated backend connectors and isolated workers. This page never claims those actions happened.</p>
          <button type="button" className="ui-button ui-button--secondary" onClick={() => onNavigate('url-lab')}><Globe2 size={15} />Open network-free URL Lab</button>
        </section>
      </div>

      <section className="info-callout"><ShieldAlert size={18} /><div><strong>Human approval stays in the loop</strong><p>Web Computer analyzes submitted mail and drafts a triage plan. It does not auto-reply, delete, quarantine, open links, or declare a message safe.</p></div></section>
    </div>
  );
}
