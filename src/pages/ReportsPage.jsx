import React from 'react';
import { Download, FileBarChart, FilePlus2, FolderOpen, Printer, ShieldCheck } from 'lucide-react';
import { DossierView } from '../components/Dossier';
import { useForensicStore } from '../store/useForensicStore';
import { downloadCase } from '../lib/workspaceUtils';
import { EmptyState, PageHeader } from '../components/WorkspaceUI';

export default function ReportsPage({ onStart }) {
  const { analysisData, cases, selectCase, storageStatus } = useForensicStore();
  // A saved case is a complete analysis result. Fall back to the latest one so
  // the report route never becomes blank merely because no new scan is active.
  const reportData = analysisData || cases[0] || null;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Review & export"
        title="Case report"
        description="Open any saved case and review its evidence, hash scope, network context, deep-inspection lanes, limitations and analyst-handling record."
        meta={reportData ? <span className="soft-badge"><ShieldCheck size={12} />Human analyst review required</span> : null}
        actions={<><button type="button" className="ui-button ui-button--secondary" onClick={() => onStart('email_file')}><FilePlus2 size={15} />New analysis</button>{reportData ? <><button type="button" className="ui-button ui-button--secondary" onClick={() => downloadCase(reportData)}><Download size={15} />Export JSON</button><button type="button" className="ui-button ui-button--primary" onClick={() => window.print()}><Printer size={15} />Print report</button></> : null}</>}
      />

      {reportData ? (
        <>
          <section className="surface report-case-picker no-print" aria-label="Saved report selection">
            <div className="report-case-picker__label"><FolderOpen size={17} /><div><strong>Saved case dossiers</strong><span>{cases.length} case{cases.length === 1 ? '' : 's'} available{storageStatus === 'unavailable' ? ' in this tab; device persistence is unavailable' : ' on this device'}</span></div></div>
            <label htmlFor="report-case-select">Report to display</label>
            <select id="report-case-select" value={reportData.case_id} onChange={(event) => selectCase(event.target.value)}>
              {cases.map((item) => <option key={item.case_id} value={item.case_id}>{item.case_id} — {item._workspace?.sourceLabel || item.filename || item.format_type}</option>)}
            </select>
            {!analysisData ? <span className="soft-badge">Latest saved case loaded</span> : null}
          </section>
          <section className="surface report-document">
            <DossierView data={reportData} />
          </section>
        </>
      ) : (
        <section className="surface"><EmptyState icon={FileBarChart} title="No saved report is available" description="Create an analysis first. The resulting case is saved on this device when storage is available and can then be reopened here—without a pre-filled verdict." actionLabel="New analysis" onAction={() => onStart('email_file')} /></section>
      )}
    </div>
  );
}
