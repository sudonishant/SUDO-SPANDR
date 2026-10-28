import React, { useMemo, useState } from 'react';
import { Beaker, FileText, Loader2, Mail, Paperclip, Play, ShieldAlert } from 'lucide-react';
import { SAMPLE_LIBRARY } from '../data/samples';
import { useForensicStore } from '../store/useForensicStore';
import { PageHeader } from '../components/WorkspaceUI';

const FILTERS = [['all', 'All samples'], ['email_file', 'Email files'], ['text_email', 'Text'], ['attachment_file', 'Attachments']];

export default function SamplesPage({ onAnalyzed }) {
  const { analyzeFile, analyzeText } = useForensicStore();
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const samples = useMemo(() => SAMPLE_LIBRARY.filter((item) => filter === 'all' || item.mode === filter), [filter]);

  const runSample = async (sample) => {
    setBusyId(sample.id);
    setError('');
    try {
      const response = await fetch(sample.path);
      if (!response.ok) throw new Error(`Sample could not be loaded (${response.status}).`);
      const blob = await response.blob();
      const meta = { sample: true, sourceLabel: sample.name };
      const result = sample.mode === 'text_email'
        ? await analyzeText({ sender: '', recipient: '', subject: sample.title, body: await blob.text() }, meta)
        : await analyzeFile(new File([blob], sample.name, { type: blob.type || 'application/octet-stream' }), meta);
      if (result) onAnalyzed();
    } catch (loadError) {
      setError(loadError?.message || 'Sample analysis failed.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Synthetic test corpus"
        title="Sample library"
        description="Run realistic parser and scoring scenarios without submitting real evidence. Every result created here is labelled as a sample."
        meta={<span className="soft-badge"><Beaker size={12} />{SAMPLE_LIBRARY.length} local files</span>}
      />

      <div className="warning-callout"><ShieldAlert size={18} /><div><strong>Demo data is not live threat intelligence</strong><p>Sample names describe the test scenario only. The resulting score still comes from the actual parser and rule engine.</p></div></div>

      <div className="filter-pills filter-pills--large" aria-label="Filter sample library">
        {FILTERS.map(([id, label]) => <button type="button" key={id} className={filter === id ? 'is-active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
      </div>

      {error ? <div className="error-callout" role="alert">{error}</div> : null}

      <section className="sample-grid">
        {samples.map((sample) => {
          const Icon = sample.mode === 'attachment_file' ? Paperclip : sample.mode === 'text_email' ? FileText : Mail;
          const busy = busyId === sample.id;
          return (
            <article className="sample-card surface" key={sample.id}>
              <div className="sample-card__top"><span className="sample-card__icon"><Icon size={20} /></span><span className={`scenario-pill scenario-pill--${sample.tone}`}>{sample.scenario}</span></div>
              <span className="sample-card__format">{sample.format} · SYNTHETIC</span>
              <h2>{sample.title}</h2>
              <p>{sample.description}</p>
              <code>{sample.name}</code>
              <button type="button" className="ui-button ui-button--secondary ui-button--full" disabled={Boolean(busyId)} onClick={() => runSample(sample)}>
                {busy ? <Loader2 size={15} className="spin" /> : <Play size={15} />}{busy ? 'Analyzing sample…' : 'Analyze sample'}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
