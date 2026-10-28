import React from 'react';
import { FileSearch, RotateCcw } from 'lucide-react';
import Dropzone from '../components/Dropzone';
import AnalysisResult from './Report';
import { useForensicStore } from '../store/useForensicStore';

export default function WorkspaceApp() {
  const { analysisData, loading, resetResult } = useForensicStore();

  if (analysisData && !loading) {
    return (
      <div className="workspace">
        <div className="workspace__bar">
          <span className="chip chip--red">{analysisData.case_id || 'CASE'}</span>
          <span className="workspace__meta">
            {analysisData.format_type || analysisData.parsed?.format || 'submitted evidence'} · parsed locally
          </span>
          <span className="spacer" />
          <button type="button" className="btn btn--sm" onClick={resetResult}><RotateCcw size={11} /> New analysis</button>
        </div>
        <div className="workspace__scroll"><AnalysisResult data={analysisData} /></div>
      </div>
    );
  }

  return (
    <div>
      <Dropzone />
      {loading && (
        <div className="loading-row">
          <span className="spinner" />
          <div>
            <strong>Inspecting submitted evidence…</strong>
            <p>Parsing locally. No file is executed and no analyst IP is substituted for an email origin.</p>
          </div>
        </div>
      )}
      {!loading && (
        <div className="empty-workspace">
          <FileSearch size={18} />
          <div>
            <strong>No evidence loaded</strong>
            <p>Pick a mode above, or drag a file onto the intake panel. Results are saved on this device when storage is available.</p>
          </div>
        </div>
      )}
    </div>
  );
}
