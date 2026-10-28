import React from 'react';
import {
  Activity, ArrowRight, CheckCircle2, Clock3, FilePlus2, FileText, FolderOpen,
  Mail, Paperclip, ShieldCheck, Sparkles,
} from 'lucide-react';
import { useForensicStore } from '../store/useForensicStore';
import { formatBytes, formatDate } from '../lib/workspaceUtils';
import { PageHeader, RiskBadge, ScoreRing, SectionTitle, StatusLine } from '../components/WorkspaceUI';

const MODES = [
  {
    id: 'email_file', icon: Mail, title: 'Email evidence',
    description: 'Analyze complete .eml or .msg messages with transport headers, links and attachments.',
    meta: 'EML · MSG',
  },
  {
    id: 'text_email', icon: FileText, title: 'Text & headers',
    description: 'Paste message content or raw headers without inventing missing transport evidence.',
    meta: 'RFC 5322 · TEXT',
  },
  {
    id: 'attachment_file', icon: Paperclip, title: 'Attachment inspection',
    description: 'Inspect magic bytes, entropy, embedded markers and SHA-256 without executing the file.',
    meta: 'STATIC · LOCAL',
  },
];

function MetricCard({ icon: Icon, label, value, note, tone = 'blue' }) {
  return (
    <div className="metric-card">
      <span className={`metric-card__icon metric-card__icon--${tone}`}><Icon size={18} /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </div>
  );
}

function CurrentCase({ data, onOpen }) {
  if (!data) {
    return (
      <div className="current-case current-case--empty">
        <span className="current-case__empty-icon"><FolderOpen size={24} /></span>
        <h3>No active case</h3>
        <p>Your latest analysis will appear here with its score, top findings and evidence reference.</p>
        <button type="button" className="ui-button ui-button--secondary" onClick={onOpen}>Open sample library<ArrowRight size={15} /></button>
      </div>
    );
  }
  const signals = (data.threat?.signals || []).slice(0, 3);
  return (
    <div className="current-case">
      <div className="current-case__top">
        <ScoreRing score={data.threat?.risk_score || 0} />
        <div className="current-case__identity">
          <span className="ui-eyebrow">Active investigation</span>
          <h3>{data.case_id}</h3>
          <p>{data.category_analysis?.category_label || data.format_type || 'Submitted evidence'}</p>
          <RiskBadge data={data} compact />
        </div>
      </div>
      <div className="current-case__signals">
        {signals.length ? signals.map((signal, index) => (
          <div key={`${signal.label || signal}-${index}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{typeof signal === 'string' ? signal : signal.label}</p>
          </div>
        )) : <p className="muted-copy">No explicit threat-rule contributor was recorded. This is not a guarantee of safety.</p>}
      </div>
      <button type="button" className="ui-button ui-button--secondary ui-button--full" onClick={onOpen}>
        Continue investigation<ArrowRight size={15} />
      </button>
    </div>
  );
}

export default function DashboardPage({ onStart, onNavigate, onViewCase, health }) {
  const { cases, analysisData, storageStatus } = useForensicStore();
  const current = analysisData || cases[0] || null;
  const high = cases.filter((item) => (item.threat?.risk_score || 0) >= 70).length;
  const review = cases.filter((item) => {
    const score = item.threat?.risk_score || 0;
    return score >= 35 && score < 70;
  }).length;
  const bytes = cases.reduce((total, item) => total + (Number(item.evidence?.raw_size_bytes) || 0), 0);
  const cryptoReady = Boolean(health?.verification_capability?.spf?.real && health?.verification_capability?.dkim?.real);
  const geoReady = Boolean(health?.verification_capability?.geoip?.real);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Forensic command center"
        title="Evidence first. Every score explained."
        description="Analyze suspicious email in a local-first workspace, inspect the contributing signals and keep limitations visible."
        actions={(
          <>
            <button type="button" className="ui-button ui-button--secondary" onClick={() => onNavigate('samples')}>Browse samples</button>
            <button type="button" className="ui-button ui-button--primary" onClick={() => onStart('email_file')}><FilePlus2 size={16} />New analysis</button>
          </>
        )}
      />

      <section className="trust-banner" aria-label="Data handling notice">
        <span className="trust-banner__icon"><ShieldCheck size={21} /></span>
        <div><strong>Local analysis is ready</strong><p>{storageStatus === 'ready' ? 'Files are parsed in this browser and cases are saved in IndexedDB on this device. External AI and network-context requests remain explicit actions.' : storageStatus === 'loading' ? 'Files are parsed in this browser. Existing device cases are being restored; external AI and network-context requests remain explicit actions.' : 'Files are parsed in this browser, but device storage is unavailable. Cases remain in memory for this tab; external AI and network-context requests remain explicit actions.'}</p></div>
        <StatusLine tone={storageStatus === 'ready' ? 'ready' : 'warning'}>{storageStatus === 'ready' ? 'Saved on this device' : storageStatus === 'loading' ? 'Restoring device cases' : 'Memory fallback'}</StatusLine>
      </section>

      <section className="metrics-grid" aria-label="Case summary">
        <MetricCard icon={FolderOpen} label="Device cases" value={cases.length} note={storageStatus === 'ready' ? 'IndexedDB · restored after reload' : 'Available in this tab'} />
        <MetricCard icon={Activity} label="High risk" value={high} note="Triage score 70 or above" tone="red" />
        <MetricCard icon={Clock3} label="Needs review" value={review} note="Triage score 35–69" tone="amber" />
        <MetricCard icon={CheckCircle2} label="Evidence processed" value={formatBytes(bytes)} note="Original bytes observed" tone="green" />
      </section>

      <section>
        <SectionTitle title="Start an investigation" description="Choose the evidence contract that matches what you actually have." />
        <div className="mode-card-grid">
          {MODES.map(({ id, icon: Icon, title, description, meta }) => (
            <button type="button" className="mode-card" key={id} onClick={() => onStart(id)}>
              <span className="mode-card__top"><span className="mode-card__icon"><Icon size={21} /></span><span className="mode-card__meta">{meta}</span></span>
              <strong>{title}</strong>
              <p>{description}</p>
              <span className="mode-card__action">Start analysis<ArrowRight size={15} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-split">
        <div className="surface surface--padded">
          <SectionTitle
            eyebrow="Resume"
            title="Current case"
            action={current ? <span className="case-id-label">{current.case_id}</span> : null}
          />
          <CurrentCase data={current} onOpen={() => (current ? onViewCase(current.case_id) : onNavigate('samples'))} />
        </div>

        <div className="surface surface--padded">
          <SectionTitle eyebrow="Runtime" title="Capability status" description="Availability is shown per subsystem—not inferred from a single online badge." />
          <div className="capability-list">
            <div><span className="capability-list__icon"><ShieldCheck size={16} /></span><div><strong>Browser parser & scoring</strong><small>Local deterministic analysis</small></div><StatusLine tone="ready">Ready</StatusLine></div>
            <div><span className="capability-list__icon"><Sparkles size={16} /></span><div><strong>AI second opinion</strong><small>Optional third-party request</small></div><StatusLine>Opt-in</StatusLine></div>
            <div><span className="capability-list__icon"><Activity size={16} /></span><div><strong>SPF / DKIM verification</strong><small>Independent cryptographic checks</small></div><StatusLine tone={cryptoReady ? 'ready' : 'warning'}>{cryptoReady ? 'Available' : 'Unavailable'}</StatusLine></div>
            <div><span className="capability-list__icon"><Activity size={16} /></span><div><strong>Network & GeoIP context</strong><small>Registration and approximate network data</small></div><StatusLine tone={geoReady ? 'ready' : 'warning'}>{geoReady ? 'Available' : 'Limited'}</StatusLine></div>
          </div>
          <button type="button" className="text-button" onClick={() => onNavigate('settings')}>View runtime details<ArrowRight size={14} /></button>
        </div>
      </section>

      <section className="surface surface--padded">
        <SectionTitle
          eyebrow="Case history"
          title="Recent analyses"
          action={cases.length ? <button type="button" className="text-button" onClick={() => onNavigate('cases')}>View all cases<ArrowRight size={14} /></button> : null}
        />
        {cases.length ? (
          <div className="activity-list">
            {cases.slice(0, 4).map((item) => (
              <button type="button" className="activity-row" key={item.case_id} onClick={() => onViewCase(item.case_id)}>
                <span className="activity-row__icon">{item.mode === 'attachment' ? <Paperclip size={17} /> : <Mail size={17} />}</span>
                <span className="activity-row__main"><strong>{item._workspace?.sourceLabel || item.filename || item.case_id}</strong><small>{item.case_id} · {formatDate(item._workspace?.receivedAt || item.generated_at)}</small></span>
                {item._workspace?.sample ? <span className="sample-pill">Sample</span> : null}
                <RiskBadge data={item} compact />
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <div className="inline-empty"><Clock3 size={18} /><div><strong>No case activity yet</strong><p>Run your own evidence or choose a clearly labelled synthetic sample to get started.</p></div></div>
        )}
      </section>
    </div>
  );
}
