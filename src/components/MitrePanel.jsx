import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bot, Download, Info, Loader2, ShieldCheck } from 'lucide-react';

const STATIC_NAMES = {
  'T1566.001': 'Spearphishing attachment',
  'T1566.002': 'Spearphishing link',
  'T1566.003': 'Spearphishing via service',
  'T1036.005': 'Masquerading: match legitimate name',
  'T1586.002': 'Compromise accounts: email accounts',
  'T1071.001': 'Application layer protocol: web',
  'T1090.003': 'Proxy: multi-hop proxy',
  'T1204.001': 'User execution: malicious link',
  'T1204.002': 'User execution: malicious file',
  'T1598': 'Phishing for information',
};

export default function MitrePanel({ caseId }) {
  const [state, setState] = useState('loading');
  const [layer, setLayer] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setState('loading');
      try {
        const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        const response = await fetch(`${base}/api/v1/mitre/navigator-layer?case_id=${encodeURIComponent(caseId || 'DEMO-26106')}`);
        if (!response.ok) throw new Error(`MITRE endpoint returned HTTP ${response.status}`);
        const payload = await response.json();
        if (!alive) return;
        setLayer(payload);
        setState('done');
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'MITRE endpoint unreachable.');
        setState('unavailable');
      }
    })();
    return () => { alive = false; };
  }, [caseId]);

  const techniques = layer?.techniques || [];
  const isReference = layer?.mode === 'REFERENCE_PRELOADED_LAYER' || layer?.dynamic_correlation_available === false;

  const exportLayer = () => {
    if (!layer) return;
    const blob = new Blob([JSON.stringify(layer, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `spandr-mitre-${caseId || 'case'}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  if (state === 'loading') {
    return <div className="empty-panel"><Loader2 size={13} className="spin" style={{ display: 'inline', verticalAlign: '-2px' }} /> Loading ATT&CK layer…</div>;
  }

  if (state === 'unavailable') {
    return (
      <div className="empty-panel">
        <strong>MITRE mapping needs the API.</strong> {error}
        <br />
        The layer is produced by <code>backend/app/core/mitre_engine.py</code> and served at
        <code> /api/v1/mitre/navigator-layer</code>. Without it, this panel shows nothing rather than guessing technique IDs
        from the subject line.
      </div>
    );
  }

  return (
    <div className="mitre">
      <div className="mitre__head">
        <div>
          <span className={`pill ${isReference ? 'pill--amber' : 'pill--green'}`}>
            {isReference ? 'reference layer · not case-matched' : 'case-matched layer'}
          </span>
          <p className="mitre__name">{layer?.name || 'ATT&CK layer'}</p>
          {layer?.description ? <p className="disclaimer">{layer.description}</p> : null}
        </div>
        <button type="button" className="app-btn app-btn--sm" onClick={exportLayer}>
          <span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#7cc0ff,#2e7cf6)' }}><Download size={13} /></span>
          Export layer JSON
        </button>
      </div>

      {isReference ? (
        <div className="mitre__warn">
          <AlertTriangle size={13} />
          <p>
            These techniques come from the static reference template shipped with the edge function. They are
            <strong> not correlated to this case</strong> — treat them as a checklist, not findings.
          </p>
        </div>
      ) : null}

      {techniques.length ? (
        <div className="mitre__list">
          {techniques.map((technique) => (
            <div className="mitre__row" key={`${technique.techniqueID}-${technique.comment}`}>
              <code>{technique.techniqueID}</code>
              <div>
                <strong>{STATIC_NAMES[technique.techniqueID] || 'ATT&CK technique'}</strong>
                <p>{technique.comment || 'No comment returned.'}</p>
              </div>
              <span className="pill">{technique.score != null ? `score ${technique.score}` : 'n/a'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-panel">The layer returned no techniques.</div>
      )}

      <p className="disclaimer">
        <Info size={11} style={{ display: 'inline', verticalAlign: '-2px' }} /> ATT&CK is a vocabulary, not evidence. A
        mapped technique does not raise or lower the triage score in this workspace.
      </p>
    </div>
  );
}

export function AhnPanelPlaceholder() {
  return (
    <div className="empty-panel">
      <Bot size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> AI second opinion lives in the Overview tab.
      <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: '-2px', marginLeft: 6 }} />
    </div>
  );
}
