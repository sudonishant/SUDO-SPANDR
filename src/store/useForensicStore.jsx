import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  analyzeStandaloneAttachment,
  buildEmailAnalysis,
  parseEmlFile,
  parseMsgFile,
  parseTextInput,
  EMAIL_EXTENSIONS,
} from '../lib/forensics';
import { buildEvidenceGraphProjection } from '../lib/evidenceGraph';
import {
  clearDeviceCases,
  deleteDeviceCase,
  listDeviceCases,
  MAX_DEVICE_CASES,
  saveDeviceCase,
} from '../lib/caseDatabase';

const ForensicContext = createContext(null);

export function useForensicStore() {
  const context = useContext(ForensicContext);
  if (!context) throw new Error('useForensicStore must be used within a ForensicProvider');
  return context;
}

function withWorkspaceMeta(result, meta = {}) {
  return {
    ...result,
    _workspace: {
      receivedAt: new Date().toISOString(),
      sample: Boolean(meta.sample),
      sourceLabel: meta.sourceLabel || result.filename || result.format_type || 'Submitted evidence',
      origin: meta.origin || 'analysis',
      processing: 'Browser analysis',
    },
  };
}

export function ForensicProvider({ children }) {
  const [inputMode, setInputMode] = useState('email_file');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  // Raw File objects remain memory-only and are never written to IndexedDB.
  // REA requires an explicit second action and verifies the selected bytes.
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [cases, setCases] = useState([]);
  const [storageStatus, setStorageStatus] = useState('loading');
  const [storageError, setStorageError] = useState('');
  const [aiReview, setAiReview] = useState(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [sender, setSender] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const hydrationRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const storedCases = await listDeviceCases();
        if (cancelled) return;
        setCases(storedCases);
        setStorageStatus('ready');
        setStorageError('');
      } catch (hydrationError) {
        if (cancelled) return;
        setStorageStatus('unavailable');
        setStorageError(hydrationError?.message || 'Device storage is unavailable. Cases will remain in memory for this tab.');
      }
    };
    hydrationRef.current = hydrate();
    return () => { cancelled = true; };
  }, []);

  const noteStorageError = (storageFailure) => {
    setStorageStatus((current) => (current === 'unavailable' ? 'unavailable' : 'error'));
    setStorageError(storageFailure?.message || 'The case could not be saved on this device.');
  };

  const persistCase = async (caseData) => {
    try {
      await saveDeviceCase(caseData);
      setStorageStatus('ready');
      setStorageError('');
      return true;
    } catch (storageFailure) {
      noteStorageError(storageFailure);
      return false;
    }
  };

  const resetResult = () => {
    setAnalysisData(null);
    setEvidenceFile(null);
    setAiReview(null);
    setAiQuestion('');
    setGeoLoading(false);
    setGraphLoading(false);
    setError('');
    setActiveTab('overview');
  };

  const setInputs = (nextSender, nextRecipient, nextSubject, nextBody) => {
    setSender(nextSender);
    setRecipient(nextRecipient);
    setSubject(nextSubject);
    setBody(nextBody);
  };

  const clearSession = async () => {
    if (hydrationRef.current) await hydrationRef.current;
    try {
      await clearDeviceCases();
      setStorageStatus('ready');
      setStorageError('');
    } catch (storageFailure) {
      // Memory fallback still clears the visible tab even when the device
      // database cannot be opened. The storage warning remains visible.
      noteStorageError(storageFailure);
    }
    resetResult();
    setInputs('', '', '', '');
    setCases([]);
  };

  const runAnalysis = async (work, meta = {}) => {
    setLoading(true);
    setError('');
    try {
      // Restore existing cases before inserting a new one, avoiding a fast
      // first analysis racing the IndexedDB hydration read.
      if (hydrationRef.current) await hydrationRef.current;
      const rawResult = await work();
      if (!rawResult) throw new Error('Analysis did not return a result.');
      const result = withWorkspaceMeta(rawResult, meta);
      setAnalysisData(result);
      setEvidenceFile(meta.evidenceFile || null);
      setCases((current) => {
        const remaining = current.filter((item) => item.case_id !== result.case_id);
        return [result, ...remaining].slice(0, MAX_DEVICE_CASES);
      });
      setActiveTab('overview');
      // A storage failure is visible in Settings but does not discard a valid
      // analysis that is still available in memory.
      await persistCase(result);
      return result;
    } catch (analysisError) {
      setAnalysisData(null);
      setEvidenceFile(null);
      setError(analysisError?.message || 'Analysis failed. No result was generated.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const analyzeFile = async (file, meta = {}) => {
    if (!file) return null;
    const extension = file.name.toLowerCase().split('.').pop();
    const sourceMeta = { ...meta, sourceLabel: meta.sourceLabel || file.name, evidenceFile: file };
    if (EMAIL_EXTENSIONS.includes(extension)) {
      return runAnalysis(async () => {
        const parsed = extension === 'eml' ? await parseEmlFile(file) : await parseMsgFile(file);
        const result = await buildEmailAnalysis(parsed);
        setInputs(
          result.parsed.sender || '',
          result.parsed.recipient || '',
          result.parsed.subject || '',
          result.parsed.body || '',
        );
        return result;
      }, sourceMeta);
    }
    return runAnalysis(() => analyzeStandaloneAttachment(file), sourceMeta);
  };

  const analyzeText = async (overrides = {}, meta = {}) => {
    const values = {
      sender: overrides.sender ?? sender,
      recipient: overrides.recipient ?? recipient,
      subject: overrides.subject ?? subject,
      body: overrides.body ?? body,
    };
    return runAnalysis(async () => {
      const parsed = parseTextInput(values);
      return buildEmailAnalysis(parsed);
    }, { ...meta, sourceLabel: meta.sourceLabel || values.subject || 'Pasted headers and text' });
  };

  const selectCase = (caseId) => {
    const selected = cases.find((item) => item.case_id === caseId);
    if (!selected) return null;
    setAnalysisData(selected);
    setEvidenceFile(null);
    setAiReview(null);
    setAiQuestion('');
    setGraphLoading(false);
    setError('');
    setActiveTab('overview');
    return selected;
  };

  const removeCase = async (caseId) => {
    try {
      // Do not show a successful deletion before the device transaction has
      // committed; otherwise an immediate reload can resurrect the record.
      await deleteDeviceCase(caseId);
      setStorageStatus('ready');
      setStorageError('');
    } catch (storageFailure) {
      // In memory-only mode there is no device record to delete. Keep the
      // local workflow usable and surface why reload persistence is absent.
      noteStorageError(storageFailure);
    }
    setCases((current) => current.filter((item) => item.case_id !== caseId));
    if (analysisData?.case_id === caseId) resetResult();
  };

  const updateActiveCase = async (patch) => {
    if (!analysisData) return null;
    const updated = {
      ...analysisData,
      ...patch,
      _workspace: { ...analysisData._workspace, updatedAt: new Date().toISOString() },
    };
    setAnalysisData(updated);
    setCases((current) => current.map((item) => (item.case_id === updated.case_id ? updated : item)));
    await persistCase(updated);
    return updated;
  };

  const lookupIpContext = async () => {
    const ips = (analysisData?.relay_info?.ips || []).map((item) => item.ip).filter(Boolean);
    if (!ips.length) return { status: 'no_public_ips', results: [], message: 'No public header IP is available for lookup.' };
    setGeoLoading(true);
    try {
      const response = await fetch('/api/v1/ip-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || `Lookup failed (${response.status})`);
      await updateActiveCase({ geo_data: payload });
      return payload;
    } catch (lookupError) {
      const payload = { status: 'unavailable', results: [], message: lookupError?.message || 'Network context lookup failed.' };
      await updateActiveCase({ geo_data: payload });
      return payload;
    } finally {
      setGeoLoading(false);
    }
  };

  const projectEvidenceGraph = async () => {
    if (!analysisData) return null;
    setGraphLoading(true);
    let payload;
    try {
      const projection = buildEvidenceGraphProjection(analysisData);
      const configuredBackend = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const endpoint = configuredBackend
        ? `${configuredBackend}/api/v1/evidence-graph`
        : '/api/v1/analyze-eml?operation=graph';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projection),
      });
      payload = await response.json().catch(() => null);
      if (!payload || typeof payload !== 'object') throw new Error('Graph service returned an invalid response.');
      if (!response.ok && !['not_configured', 'unavailable'].includes(payload.status)) {
        const detail = typeof payload.detail === 'string' ? ` ${payload.detail}` : '';
        payload = {
          status: 'unavailable',
          case_id: analysisData.case_id,
          persisted: false,
          readback: false,
          source: 'none',
          message: `The backend rejected or could not complete the graph operation (${response.status}).${detail}`,
          graph: { nodes: [], edges: [] },
        };
      }
      if (payload.status === 'available' && !(payload.persisted && payload.readback && payload.source === 'neo4j_readback')) {
        payload = {
          ...payload,
          status: 'unavailable',
          persisted: false,
          readback: false,
          source: 'none',
          message: 'The service did not provide verified Neo4j write/readback evidence. The response will not be presented as a synchronized graph.',
          graph: { nodes: [], edges: [] },
        };
      }
    } catch (graphError) {
      payload = {
        status: 'unavailable',
        case_id: analysisData.case_id,
        database: 'Neo4j',
        persisted: false,
        readback: false,
        source: 'none',
        message: graphError?.message || 'Evidence-graph service is unavailable. No graph success is claimed.',
        graph: { nodes: [], edges: [] },
      };
    }
    try {
      await updateActiveCase({ neo4j_graph: payload });
      return payload;
    } finally {
      setGraphLoading(false);
    }
  };

  const runAiReview = async (question = aiQuestion) => {
    if (!analysisData) return null;
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const endpoint = `${baseUrl}/api/v1/ai-review`;
    setAiReview({ status: 'loading', message: 'Requesting a cautious AI second opinion…' });
    try {
      const parsed = analysisData.parsed || {};
      const result = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidence: {
            subject: parsed.subject || '',
            sender: parsed.sender || '',
            body: parsed.body || '',
            headers: parsed.headers || {},
            category_analysis: analysisData.category_analysis,
            threat: analysisData.threat,
            attachments: analysisData.attachment_analysis || [],
            user_question: String(question || '').slice(0, 2_000),
          },
        }),
      });
      const payload = await result.json();
      if (!result.ok) {
        setAiReview(payload);
        return payload;
      }
      setAiReview(payload);
      return payload;
    } catch (reviewError) {
      const payload = {
        status: 'error',
        message: reviewError?.message || 'AI second opinion unavailable. Deterministic triage remains available.',
      };
      setAiReview(payload);
      return payload;
    }
  };

  return (
    <ForensicContext.Provider value={{
      inputMode,
      setInputMode,
      activeTab,
      setActiveTab,
      loading,
      error,
      analysisData,
      evidenceFile,
      cases,
      storageStatus,
      storageError,
      selectCase,
      removeCase,
      clearSession,
      updateActiveCase,
      sender,
      recipient,
      subject,
      body,
      setInputs,
      analyzeFile,
      analyzeText,
      resetResult,
      aiReview,
      aiQuestion,
      setAiQuestion,
      runAiReview,
      geoLoading,
      lookupIpContext,
      graphLoading,
      projectEvidenceGraph,
    }}>
      {children}
    </ForensicContext.Provider>
  );
}
