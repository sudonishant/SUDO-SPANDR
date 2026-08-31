import React, { createContext, useContext, useState } from 'react';
import { analyzeStandaloneAttachment, buildEmailAnalysis, parseEmlFile, parseMsgFile, parseTextInput, EMAIL_EXTENSIONS } from '../lib/forensics';

const ForensicContext = createContext(null);

export function useForensicStore() {
  const context = useContext(ForensicContext);
  if (!context) throw new Error('useForensicStore must be used within a ForensicProvider');
  return context;
}

export function ForensicProvider({ children }) {
  const [inputMode, setInputMode] = useState('email_file');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [aiReview, setAiReview] = useState(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [sender, setSender] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const resetResult = () => {
    setAnalysisData(null);
    setAiReview(null);
    setAiQuestion('');
    setGeoLoading(false);
    setError('');
    setActiveTab('overview');
  };

  const setInputs = (nextSender, nextRecipient, nextSubject, nextBody) => {
    setSender(nextSender);
    setRecipient(nextRecipient);
    setSubject(nextSubject);
    setBody(nextBody);
  };

  const runAnalysis = async (work) => {
    setLoading(true);
    setError('');
    try {
      const result = await work();
      setAnalysisData(result);
      setActiveTab('overview');
      return result;
    } catch (analysisError) {
      setAnalysisData(null);
      setError(analysisError?.message || 'Analysis failed. No result was generated.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const analyzeFile = async (file) => {
    if (!file) return null;
    const extension = file.name.toLowerCase().split('.').pop();
    if (EMAIL_EXTENSIONS.includes(extension)) {
      return runAnalysis(async () => {
        const parsed = extension === 'eml' ? await parseEmlFile(file) : await parseMsgFile(file);
        const result = await buildEmailAnalysis(parsed);
        setInputs(result.parsed.sender || '', result.parsed.recipient || '', result.parsed.subject || '', result.parsed.body || '');
        return result;
      });
    }
    return runAnalysis(() => analyzeStandaloneAttachment(file));
  };

  const analyzeText = async () => runAnalysis(async () => {
    const parsed = parseTextInput({ sender, recipient, subject, body });
    return buildEmailAnalysis(parsed);
  });

  const lookupIpContext = async () => {
    const ips = (analysisData?.relay_info?.ips || []).map((item) => item.ip).filter(Boolean);
    if (!ips.length) return { status: 'no_public_ips', results: [], message: 'No public header IP is available for lookup.' };
    setGeoLoading(true);
    try {
      const response = await fetch('/api/v1/ip-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ips }) });
      const payload = await response.json();
      setAnalysisData((current) => current ? { ...current, geo_data: payload } : current);
      return payload;
    } catch (lookupError) {
      const payload = { status: 'unavailable', results: [], message: lookupError?.message || 'Network context lookup failed.' };
      setAnalysisData((current) => current ? { ...current, geo_data: payload } : current);
      return payload;
    } finally {
      setGeoLoading(false);
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence: { subject: parsed.subject || '', sender: parsed.sender || '', body: parsed.body || '', headers: parsed.headers || {}, category_analysis: analysisData.category_analysis, threat: analysisData.threat, attachments: analysisData.attachment_analysis || [], user_question: String(question || '').slice(0, 2_000) } }),
      });
      const payload = await result.json();
      if (!result.ok) {
        setAiReview(payload);
        return payload;
      }
      setAiReview(payload);
      return payload;
    } catch (reviewError) {
      const payload = { status: 'error', message: reviewError?.message || 'AI second opinion unavailable. Deterministic triage remains available.' };
      setAiReview(payload);
      return payload;
    }
  };

  return (
    <ForensicContext.Provider value={{
      inputMode, setInputMode, activeTab, setActiveTab, loading, error, analysisData,
      sender, recipient, subject, body, setInputs, analyzeFile, analyzeText, resetResult, aiReview, aiQuestion, setAiQuestion, runAiReview, geoLoading, lookupIpContext,
    }}>
      {children}
    </ForensicContext.Provider>
  );
}
