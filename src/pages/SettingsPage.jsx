import React, { useState } from 'react';
import { Activity, CheckCircle2, Database, Download, Github, HardDrive, LockKeyhole, MonitorPlay, Moon, ShieldCheck, Sun, Trash2 } from 'lucide-react';
import { useForensicStore } from '../store/useForensicStore';
import { downloadCaseArchive } from '../lib/workspaceUtils';
import { PageHeader, StatusLine } from '../components/WorkspaceUI';

export default function SettingsPage({ theme, setTheme, health }) {
  const { cases, clearSession, storageStatus, storageError } = useForensicStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const clear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    try { await clearSession(); } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  const capabilities = health?.verification_capability || {};
  const storageLabel = storageStatus === 'ready' ? 'Saved on device' : storageStatus === 'loading' ? 'Restoring…' : storageStatus === 'error' ? 'Save issue' : 'Memory only';
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Workspace preferences" title="Settings & privacy" description="Control appearance, inspect runtime capability, and back up or clear evidence stored on this device." />

      <div className="settings-grid">
        <section className="surface surface--padded settings-section">
          <div className="section-icon-title"><span><Sun size={19} /></span><div><h2>Appearance</h2><p>Choose a readable theme for long analysis sessions.</p></div></div>
          <div className="theme-options" role="group" aria-label="Color theme">
            <button type="button" className={theme === 'light' ? 'is-active' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><span className="theme-preview theme-preview--light"><i /><b /><em /></span><span><Sun size={15} />Light</span>{theme === 'light' ? <CheckCircle2 size={16} /> : null}</button>
            <button type="button" className={theme === 'dark' ? 'is-active' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><span className="theme-preview theme-preview--dark"><i /><b /><em /></span><span><Moon size={15} />Dark</span>{theme === 'dark' ? <CheckCircle2 size={16} /> : null}</button>
          </div>
        </section>

        <section className="surface surface--padded settings-section">
          <div className="section-icon-title"><span><HardDrive size={19} /></span><div><h2>Device case storage</h2><p>{storageStatus === 'ready' ? 'Cases persist in this browser profile using IndexedDB.' : storageStatus === 'loading' ? 'Checking this browser profile’s IndexedDB…' : 'IndexedDB is unavailable; cases currently use memory only.'}</p></div></div>
          <dl className="runtime-list">
            <div><dt>Cases on this device</dt><dd>{cases.length}</dd></div>
            <div><dt>Storage status</dt><dd>{storageLabel}</dd></div>
            <div><dt>Retention</dt><dd>{storageStatus === 'ready' ? 'Until cleared/browser data deleted · 50-case cap' : 'This tab only · 50-case cap'}</dd></div>
            <div><dt>Remote case database</dt><dd>Not connected</dd></div>
          </dl>
          {storageError ? <div className="error-callout" role="alert">{storageError}</div> : null}
          <p className="storage-privacy-note">Anyone using this browser profile may be able to reopen these cases. Export a backup and clear device cases before using a shared device.</p>
          <div className="settings-storage-actions">
            <button type="button" className="ui-button ui-button--secondary" disabled={!cases.length} onClick={() => downloadCaseArchive(cases)}><Download size={15} />Export all</button>
            <button type="button" className={`ui-button ${confirmClear ? 'ui-button--danger' : 'ui-button--secondary'}`} disabled={!cases.length || clearing || storageStatus === 'loading'} onClick={clear}><Trash2 size={15} />{clearing ? 'Clearing…' : confirmClear ? 'Click again to clear everything' : 'Clear device cases'}</button>
          </div>
          {confirmClear ? <button type="button" className="text-button" onClick={() => setConfirmClear(false)}>Cancel</button> : null}
        </section>

        <section className="surface surface--padded settings-section settings-section--full">
          <div className="section-icon-title"><span><Activity size={19} /></span><div><h2>Runtime capabilities</h2><p>Live health response, separated by subsystem.</p></div></div>
          <div className="settings-capabilities">
            <div><span><ShieldCheck size={17} /></span><div><strong>Browser parser</strong><small>Local EML, MSG, text and attachment analysis</small></div><StatusLine tone="ready">Ready</StatusLine></div>
            <div><span><MonitorPlay size={17} /></span><div><strong>Agent PC</strong><small>Real Linux GUI plus secondary browser Node.js; no mailbox connected</small></div><StatusLine tone="ready">On-demand</StatusLine></div>
            <div><span><Activity size={17} /></span><div><strong>SPF verification</strong><small>{capabilities.spf?.degraded_reason || 'Independent verification when backend is available'}</small></div><StatusLine tone={capabilities.spf?.real ? 'ready' : 'warning'}>{capabilities.spf?.real ? 'Available' : 'Unavailable'}</StatusLine></div>
            <div><span><Activity size={17} /></span><div><strong>DKIM verification</strong><small>{capabilities.dkim?.degraded_reason || 'Cryptographic verification when backend is available'}</small></div><StatusLine tone={capabilities.dkim?.real ? 'ready' : 'warning'}>{capabilities.dkim?.real ? 'Available' : 'Unavailable'}</StatusLine></div>
            <div><span><Database size={17} /></span><div><strong>GeoIP context</strong><small>{capabilities.geoip?.degraded_reason || 'Approximate network context when configured'}</small></div><StatusLine tone={capabilities.geoip?.real ? 'ready' : 'warning'}>{capabilities.geoip?.real ? 'Available' : 'Limited'}</StatusLine></div>
          </div>
        </section>

        <section className="surface surface--padded settings-section settings-section--full">
          <div className="section-icon-title"><span><LockKeyhole size={19} /></span><div><h2>Data-flow policy</h2><p>Know where information is stored and when it leaves this browser.</p></div></div>
          <div className="policy-grid"><div><strong>Local by default</strong><p>Email and attachment parsing, static URL checks, scoring, report generation, and IndexedDB case storage on this browser profile.</p></div><div><strong>Explicit server request</strong><p>IP registration context and optional deep-analysis endpoints only after user action.</p></div><div><strong>Potential third party</strong><p>AI second opinion may send message content and headers to the configured AI provider. Review before use.</p></div></div>
          <a className="ui-button ui-button--secondary settings-repo" href="https://github.com/sudonishant/SUDO-SPANDR" target="_blank" rel="noreferrer"><Github size={15} />Open source repository</a>
        </section>
      </div>
    </div>
  );
}
