import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Globe2, Link2, LockKeyhole, Network, Play, RotateCcw, ShieldCheck } from 'lucide-react';
import { staticUrlChecks } from '../lib/urlChecks';
import { PageHeader, StatusLine } from '../components/WorkspaceUI';

const SAMPLE_URL = 'http://secure-login.example/verify?id=8842';

export default function UrlLabPage({ onNavigate }) {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const analyze = (value = url) => {
    const target = String(value || '').trim();
    if (!target) {
      setError('Enter a URL to inspect.');
      setResult(null);
      return;
    }
    const checks = staticUrlChecks(target);
    if (!checks.href) {
      setError(checks.error || checks.flags?.[0] || 'The URL could not be parsed.');
      setResult(null);
      return;
    }
    setError('');
    setResult({ ...checks, input: target, inspectedAt: new Date().toISOString() });
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify({ ...result, mode: 'browser-static-checks', network_request: false }, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'spandr-url-static-assessment.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Safe URL inspection"
        title="URL Lab"
        description="Inspect URL structure without opening the destination. This page does not fetch the target or claim to provide reputation data."
        meta={<StatusLine tone="ready">No network request</StatusLine>}
      />

      <div className="url-lab-layout">
        <section className="surface surface--padded">
          <form onSubmit={(event) => { event.preventDefault(); analyze(); }}>
            <label className="ui-label" htmlFor="url-inspection-input">Suspicious URL</label>
            <div className="url-input-row">
              <span><Link2 size={18} /></span>
              <input id="url-inspection-input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://suspicious-link.example/login" spellCheck="false" autoComplete="off" />
              <button type="submit" className="ui-button ui-button--primary"><Play size={15} />Inspect</button>
            </div>
            <p className="field-help">The normalized URL is displayed as text only; there is no clickable link to the target.</p>
          </form>
          <div className="url-sample-row"><span>Need an example?</span><button type="button" className="text-button" onClick={() => { setUrl(SAMPLE_URL); analyze(SAMPLE_URL); }}>Load reserved-domain sample</button></div>
          {error ? <div className="error-callout" role="alert">{error}</div> : null}
        </section>

        <aside className="surface surface--padded url-privacy-card">
          <span className="aside-icon"><LockKeyhole size={20} /></span>
          <h2>What happens on Inspect?</h2>
          <ul className="check-list">
            <li><CheckCircle2 size={15} /><span>URL parsing runs inside this browser.</span></li>
            <li><CheckCircle2 size={15} /><span>No DNS, HTTP or reputation request is made.</span></li>
            <li><CheckCircle2 size={15} /><span>No page content or credentials are requested.</span></li>
          </ul>
        </aside>
      </div>

      {result ? (
        <section className="surface surface--padded url-result" aria-live="polite">
          <div className="url-result__head">
            <div><span className="ui-eyebrow">Static assessment</span><h2>{result.flags.length ? 'Review recommended' : 'No structural warnings observed'}</h2><p>{result.flags.length ? `${result.flags.length} observable URL signal${result.flags.length === 1 ? '' : 's'} need analyst attention.` : 'This does not establish that the destination is safe or reachable.'}</p></div>
            <span className={`url-result__icon ${result.flags.length ? 'is-warning' : ''}`}>{result.flags.length ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}</span>
          </div>
          <div className="url-facts">
            <div><span>Hostname</span><code>{result.host}</code></div>
            <div><span>Protocol</span><strong>{result.protocol?.replace(':', '').toUpperCase()}</strong></div>
            <div><span>Inspection mode</span><strong>Browser static</strong></div>
          </div>
          <div className="normalized-url"><span>Normalized URL</span><code>{result.href}</code></div>
          <div className="url-findings">
            <h3>Observed signals</h3>
            {result.flags.length ? result.flags.map((flag) => <div key={flag}><AlertTriangle size={15} /><span>{flag}</span></div>) : <div className="is-calm"><CheckCircle2 size={15} /><span>No structural rule in this browser checker added a warning.</span></div>}
          </div>
          <div className="url-result__actions"><button type="button" className="ui-button ui-button--secondary" onClick={download}><Download size={15} />Export assessment</button><button type="button" className="ui-button ui-button--ghost" onClick={() => { setResult(null); setUrl(''); }}><RotateCcw size={15} />Clear</button></div>
        </section>
      ) : null}

      <section className="detonation-callout">
        <span><Network size={21} /></span>
        <div><h2>Need live detonation?</h2><p>Live browsing requires a separately deployed, isolated sandbox service. The static URL lab never pretends that a screenshot, DNS lookup or DOM inspection occurred.</p></div>
        <button type="button" className="ui-button ui-button--secondary" onClick={() => onNavigate('sandbox')}>View sandbox status<Globe2 size={15} /></button>
      </section>
    </div>
  );
}
