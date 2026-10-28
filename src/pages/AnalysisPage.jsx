import React from 'react';
import { CheckCircle2, FilePlus2, LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react';
import WorkspaceApp from '../apps/WorkspaceApp';
import { useForensicStore } from '../store/useForensicStore';
import { PageHeader, RiskBadge } from '../components/WorkspaceUI';

export default function AnalysisPage({ onNavigate }) {
  const { analysisData, storageStatus, resetResult, setInputMode } = useForensicStore();

  const newAnalysis = () => {
    resetResult();
    setInputMode('email_file');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={analysisData ? 'Active investigation' : 'Evidence intake'}
        title={analysisData ? analysisData.case_id : 'New analysis'}
        description={analysisData
          ? `${analysisData._workspace?.sourceLabel || analysisData.format_type} · ${storageStatus === 'ready' ? 'saved on this device' : 'available in this tab'}`
          : 'Choose exactly what you have. Missing evidence is marked unavailable instead of being guessed.'}
        meta={analysisData ? <RiskBadge data={analysisData} compact /> : <span className="soft-badge"><LockKeyhole size={12} />{storageStatus === 'ready' ? 'Device storage on' : storageStatus === 'loading' ? 'Restoring storage' : 'Memory fallback'}</span>}
        actions={analysisData ? (
          <>
            <button type="button" className="ui-button ui-button--secondary" onClick={() => onNavigate('reports')}>Open report</button>
            <button type="button" className="ui-button ui-button--primary" onClick={newAnalysis}><RotateCcw size={15} />New analysis</button>
          </>
        ) : (
          <button type="button" className="ui-button ui-button--secondary" onClick={() => onNavigate('samples')}>Use a sample</button>
        )}
      />

      {!analysisData ? (
        <div className="analysis-stepper" aria-label="Analysis workflow">
          <div className="is-active"><span>1</span><div><strong>Submit evidence</strong><small>Local file or pasted content</small></div></div>
          <i />
          <div><span>2</span><div><strong>Review findings</strong><small>Signals, score and limitations</small></div></div>
          <i />
          <div><span>3</span><div><strong>Export report</strong><small>JSON or printable dossier</small></div></div>
        </div>
      ) : null}

      <div className={`analysis-layout ${analysisData ? 'analysis-layout--result' : ''}`}>
        <section className={`surface ${analysisData ? 'analysis-result-surface' : 'surface--padded analysis-intake'}`}>
          <WorkspaceApp />
        </section>

        {!analysisData ? (
          <aside className="analysis-aside">
            <section className="surface surface--padded">
              <span className="aside-icon"><ShieldCheck size={20} /></span>
              <h2>Evidence handling</h2>
              <p className="aside-intro">This intake is local by default. No file is executed and no “clean” verdict is inferred from a low score.</p>
              <ul className="check-list">
                <li><CheckCircle2 size={15} /><span><strong>Browser processing</strong>Original bytes stay in this tab for this workflow.</span></li>
                <li><CheckCircle2 size={15} /><span><strong>Transparent output</strong>Every point contributor is shown in the score ledger.</span></li>
                <li><CheckCircle2 size={15} /><span><strong>Explicit external calls</strong>AI and network lookups require a separate action.</span></li>
              </ul>
            </section>
            <section className="info-callout">
              <FilePlus2 size={18} />
              <div><strong>Just exploring?</strong><p>Use the synthetic corpus to test EML, MSG, text and attachment paths without uploading real evidence.</p><button type="button" className="text-button" onClick={() => onNavigate('samples')}>Open sample library</button></div>
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
