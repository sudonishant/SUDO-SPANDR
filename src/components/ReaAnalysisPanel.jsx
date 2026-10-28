import React, { useEffect, useId, useMemo, useState } from 'react';
import { Braces, CheckCircle2, Download, FileSearch, Info, LoaderCircle, Play, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { useForensicStore } from '../store/useForensicStore';

const MAX_FILE_BYTES = 3 * 1024 * 1024;

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(chunks.join(''));
}

function label(value) {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function FactGrid({ title, value }) {
  const facts = useMemo(() => {
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).filter(([, item]) => item === null || ['string', 'number', 'boolean'].includes(typeof item)).slice(0, 18);
  }, [value]);
  if (!facts.length) return null;
  return (
    <div className="rea-facts">
      <h4>{title}</h4>
      <div>{facts.map(([key, item]) => <span key={key}><small>{label(key)}</small><strong>{item === null ? 'Not reported' : String(item)}</strong></span>)}</div>
    </div>
  );
}

function ReaLane({ lane }) {
  const normalized = lane.summary?.normalized_result || {};
  const summary = normalized.summary || {};
  const limitations = lane.limitations || lane.summary?.limitations || [];
  const unknowns = normalized.unknowns || [];
  return (
    <article className={`rea-lane rea-lane--${lane.status || 'unknown'}`}>
      <header>
        <div><Braces size={15} /><div><strong>{label(lane.operation || lane.id || 'REA lane')}</strong><span>{lane.provider?.name || lane.summary?.provider?.name || 'Provider not reported'}</span></div></div>
        <span className={`mini-badge ${lane.status === 'completed' ? 'neutral' : 'warn'}`}>{String(lane.status || 'unknown').replace(/_/g, ' ')}</span>
      </header>
      {lane.message ? <p className="rea-lane__message">{lane.message}</p> : null}
      <div className="rea-fact-grid">
        <FactGrid title="Artifact identity" value={lane.summary?.subject || summary.manifest} />
        <FactGrid title="Statistics" value={summary.statistics} />
        <FactGrid title="Inventory" value={summary.available_counts} />
        <FactGrid title="Manifest" value={summary.manifest} />
        <FactGrid title="Coverage" value={summary.coverage?.application ? summary.coverage.application : normalized.coverage || summary.source_coverage} />
      </div>
      {unknowns.length ? <details className="rea-details"><summary>Unknowns and bounded coverage ({unknowns.length})</summary><ul>{unknowns.slice(0, 30).map((item, index) => <li key={index}>{item}</li>)}</ul></details> : null}
      {limitations.length ? <details className="rea-details" open={lane.status !== 'completed'}><summary>Provider limitations ({limitations.length})</summary><ul>{limitations.slice(0, 40).map((item, index) => <li key={index}>{item}</li>)}</ul></details> : null}
      {lane.summary ? <details className="rea-details"><summary>Bounded REA evidence JSON</summary><pre>{JSON.stringify(lane.summary, null, 2)}</pre></details> : null}
    </article>
  );
}

function CapabilityDetails({ capability }) {
  const inventory = capability?.capabilities;
  if (!inventory) return null;
  return (
    <details className="rea-details rea-capabilities">
      <summary>Live provider capability inventory</summary>
      {inventory.status !== 'available' ? <p>{inventory.message || 'Capability inventory is unavailable.'}</p> : (
        <>
          <h4>Built-in operations reported available</h4>
          {(inventory.built_in || []).map((provider) => (
            <div className="rea-provider" key={provider.id}><strong>{provider.name || provider.id}</strong><p>{provider.available_operations?.length ? provider.available_operations.join(' · ') : 'No available operation reported'}</p>{provider.limitations?.map((item, index) => <small key={index}>{item}</small>)}</div>
          ))}
          <h4>Optional deep providers</h4>
          {(inventory.deep_providers || []).map((provider) => (
            <div className="rea-provider" key={provider.id}><strong>{provider.name || provider.id} · {provider.status}</strong><p>{provider.reason || (provider.selected ? 'Selected by REA' : 'Not selected')}</p></div>
          ))}
        </>
      )}
    </details>
  );
}

export default function ReaAnalysisPanel() {
  const { analysisData: data, evidenceFile, updateActiveCase } = useForensicStore();
  const inputId = useId();
  const [capability, setCapability] = useState({ status: 'loading', available: false });
  const [selectedFile, setSelectedFile] = useState(evidenceFile || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const result = data?.rea_analysis || null;

  useEffect(() => {
    setSelectedFile(evidenceFile || null);
    setError('');
  }, [data?.case_id, evidenceFile]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/rea/status', { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        return { ...payload, available: Boolean(payload.available && response.ok) };
      })
      .then((payload) => { if (!controller.signal.aborted) setCapability(payload); })
      .catch((requestError) => {
        if (!controller.signal.aborted) setCapability({ available: false, status: 'unavailable', message: requestError?.message || 'REA capability service is unavailable.' });
      });
    return () => controller.abort();
  }, []);

  const run = async () => {
    if (!selectedFile || !data) return;
    setBusy(true);
    setError('');
    let digest = '';
    let matchedEvidence = null;
    try {
      const maximum = Number(capability.max_file_bytes) || MAX_FILE_BYTES;
      if (!selectedFile.size || selectedFile.size > maximum) throw new Error(`Choose a non-empty file no larger than ${maximum.toLocaleString('en-IN')} bytes.`);
      const buffer = await selectedFile.arrayBuffer();
      digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const candidates = [
        { hash: data.evidence?.sha256 || data.parsed?.sha256_hash, label: data.filename || 'Primary submitted evidence' },
        ...(data.attachment_analysis || []).map((item) => ({ hash: item.sha256, label: `Attachment: ${item.filename}` })),
      ].filter((item) => item.hash);
      const matched = candidates.find((item) => String(item.hash).toLowerCase() === digest);
      if (!matched) throw new Error('SHA-256 mismatch. Select the exact original file for this case or one of its recorded attachments; no bytes were uploaded.');
      matchedEvidence = matched.label;

      const response = await fetch('/api/v1/rea/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ filename: selectedFile.name, size_bytes: selectedFile.size, sha256: digest, content_base64: bufferToBase64(buffer) }),
      });
      const payload = await response.json().catch(() => ({ ok: false, status: 'invalid_response', message: `REA endpoint returned HTTP ${response.status} without a JSON result.` }));
      await updateActiveCase({
        rea_analysis: {
          ...payload,
          status: payload.status || (response.ok ? 'completed' : 'unavailable'),
          file_sha256: digest,
          matched_evidence: matched.label,
          requested_at: new Date().toISOString(),
          transport: capability.transport || 'Configured same-origin REA endpoint',
        },
      });
    } catch (requestError) {
      const message = requestError?.message || 'REA analysis failed.';
      setError(message);
      if (matchedEvidence) {
        await updateActiveCase({
          rea_analysis: {
            ok: false,
            status: 'unavailable',
            message,
            file: { name: selectedFile.name, size_bytes: selectedFile.size, sha256: digest },
            file_sha256: digest,
            matched_evidence: matchedEvidence,
            requested_at: new Date().toISOString(),
            lanes: [],
            limitations: ['No REA result was produced. Existing local browser findings are unchanged.'],
          },
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadResult = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${data.case_id}-rea-evidence.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1_000);
  };

  return (
    <div className="rea-panel">
      <div className="rea-intro">
        <div><span className="rea-intro__icon"><FileSearch size={20} /></span><div><small>OPTIONAL · PINNED UPSTREAM INTEGRATION</small><h3>REA deep static inspection</h3><p>Uses <a href="https://github.com/morluto/rea" target="_blank" rel="noreferrer">morluto/rea</a> through an authenticated service. It supplements—not replaces—the local browser analyzer.</p></div></div>
        <span className={`soft-badge ${capability.available ? 'soft-badge--green' : ''}`}>{capability.status === 'loading' ? 'Checking capability' : capability.available ? 'Service available' : 'Service unavailable'}</span>
      </div>

      <div className="rea-disclosure"><Info size={16} /><p>{capability.upload_notice || 'No bytes are uploaded while choosing a file. Pressing Run sends the selected bytes to the configured REA endpoint only after SHA-256 evidence matching.'} Static inspection does not execute the target or prove that a file is safe.</p></div>

      <div className="rea-upload">
        <label htmlFor={inputId}>Original evidence or recorded attachment</label>
        <div className="rea-upload__row">
          <input id={inputId} type="file" disabled={busy} onChange={(event) => { setSelectedFile(event.target.files?.[0] || null); setError(''); }} />
          <button type="button" className="ui-button ui-button--primary" disabled={!selectedFile || busy || !capability.available} onClick={run}>{busy ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}{busy ? 'Running bounded REA lanes…' : 'Run deep inspection'}</button>
        </div>
        <small>{selectedFile ? `${selectedFile.name} · ${selectedFile.size.toLocaleString('en-IN')} bytes` : evidenceFile ? 'Original file is available in memory.' : 'Saved cases do not retain raw bytes; re-select the exact original file.'} Maximum {((Number(capability.max_file_bytes) || MAX_FILE_BYTES) / (1024 * 1024)).toFixed(0)} MiB.</small>
      </div>
      {error ? <div className="error-banner" role="alert">{error}</div> : null}
      {!capability.available && capability.status !== 'loading' ? <div className="empty-panel"><strong>REA is not configured here.</strong><p>{capability.message || 'Start the authenticated local sidecar or configure a private REA service for this deployment.'} No substitute or fabricated deep-analysis result was generated.</p></div> : null}
      <CapabilityDetails capability={capability} />

      {result ? (
        <section className="rea-result" aria-live="polite">
          <header><div><CheckCircle2 size={17} /><div><strong>Saved REA case record</strong><span>{result.engine?.name || 'REA'} {result.engine?.version || ''} · {result.engine?.package || 'package not reported'} · {result.status}</span></div></div><div><button type="button" className="app-btn app-btn--sm" onClick={downloadResult}><span className="app-btn__icon"><Download size={13} /></span>Export REA JSON</button><button type="button" className="app-btn app-btn--sm" onClick={() => updateActiveCase({ rea_analysis: null })}><span className="app-btn__icon"><Trash2 size={13} /></span>Clear result</button></div></header>
          <div className="rea-provenance"><ShieldCheck size={15} /><div><strong>Evidence binding: {result.matched_evidence || 'See recorded file digest'}</strong><code>{result.file?.sha256 || result.file_sha256 || 'No digest recorded'}</code><small>{result.transport || 'Configured REA service'} · {result.requested_at || result.completed_at || 'Time not recorded'}</small></div></div>
          {result.message ? <p className="rea-lane__message">{result.message}</p> : null}
          {(result.lanes || []).map((lane, index) => <ReaLane key={`${lane.id}-${index}`} lane={lane} />)}
          {result.limitations?.length ? <div className="rea-limitations"><strong>Integration limitations</strong>{result.limitations.map((item, index) => <p key={index}>{item}</p>)}</div> : null}
        </section>
      ) : <div className="empty-panel"><UploadCloud size={18} /><strong>No REA result is saved for this case.</strong><p>Run the optional lane above. Existing local file findings remain valid as their own bounded analysis.</p></div>}
    </div>
  );
}
