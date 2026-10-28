import React from 'react';
import { Download, FileBarChart, FilePlus2, Printer, ShieldCheck } from 'lucide-react';
import { DossierView } from '../components/Dossier';
import { useForensicStore } from '../store/useForensicStore';
import { downloadCase } from '../lib/workspaceUtils';
import { EmptyState, PageHeader } from '../components/WorkspaceUI';

export default function ReportsPage({ onStart }) {
  const { analysisData } = useForensicStore();
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Review & export"
        title="Case report"
        description="Generate a transparent snapshot of observed values, hashes, limitations and draft containment guidance."
        meta={analysisData ? <span className="soft-badge"><ShieldCheck size={12} />Analyst review required</span> : null}
        actions={analysisData ? <><button type="button" className="ui-button ui-button--secondary" onClick={() => downloadCase(analysisData)}><Download size={15} />Export JSON</button><button type="button" className="ui-button ui-button--primary" onClick={() => window.print()}><Printer size={15} />Print report</button></> : null}
      />

      {analysisData ? (
        <section className="surface report-document print-area">
          <div className="report-document__masthead">
            <div><span className="ui-eyebrow">SUDO SPANDR · SentinelMail</span><h2>Forensic analysis snapshot</h2><p>System-generated working document · not a certified court exhibit</p></div>
            <FileBarChart size={30} />
          </div>
          <DossierView data={analysisData} />
        </section>
      ) : (
        <section className="surface"><EmptyState icon={FileBarChart} title="No report is ready" description="Open or create an analysis first. Reports are built from actual analysis results rather than a pre-filled demo verdict." actionLabel="New analysis" onAction={() => onStart('email_file')} /></section>
      )}
    </div>
  );
}
