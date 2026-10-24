import React from 'react';
import { FileSearch, Printer } from 'lucide-react';
import MitrePanel from '../components/MitrePanel';
import { DossierView } from '../components/Dossier';
import { useForensicStore } from '../store/useForensicStore';

function NeedsCase({ onOpen }) {
  return (
    <div className="pane">
      <div className="empty-panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <strong style={{ fontSize: 12 }}>No case loaded yet</strong>
        <p>This surface is built from a real analysis result. Run one first — nothing here is pre-filled with sample verdicts.</p>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onOpen('workspace')}>
          <FileSearch size={11} /> Open workspace
        </button>
      </div>
    </div>
  );
}

export function MitreApp({ onOpen }) {
  const { analysisData } = useForensicStore();
  if (!analysisData) return <NeedsCase onOpen={onOpen} />;
  return <div className="pane"><MitrePanel caseId={analysisData.case_id} /></div>;
}

export function DossierApp({ onOpen }) {
  const { analysisData } = useForensicStore();
  if (!analysisData) return <NeedsCase onOpen={onOpen} />;
  return (
    <div className="pane">
      <div className="dossier__head" style={{ marginBottom: 10 }}>
        <div className="pane-title" style={{ margin: 0 }}><Printer size={11} /> {analysisData.case_id}</div>
        <span className="chip chip--red">review before use</span>
      </div>
      <DossierView data={analysisData} />
    </div>
  );
}
