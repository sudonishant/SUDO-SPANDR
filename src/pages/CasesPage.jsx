import React, { useMemo, useState } from 'react';
import { Download, FilePlus2, FolderOpen, Mail, Paperclip, Search, Trash2 } from 'lucide-react';
import { useForensicStore } from '../store/useForensicStore';
import { downloadCase, formatDate } from '../lib/workspaceUtils';
import { EmptyState, PageHeader, RiskBadge } from '../components/WorkspaceUI';

const FILTERS = [
  ['all', 'All cases'],
  ['high', 'High risk'],
  ['review', 'Review'],
  ['low', 'Lower score'],
];

export default function CasesPage({ onViewCase, onStart }) {
  const { cases, removeCase, storageStatus } = useForensicStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [confirmId, setConfirmId] = useState('');

  const filtered = useMemo(() => cases.filter((item) => {
    const score = item.threat?.risk_score || 0;
    const matchesFilter = filter === 'all'
      || (filter === 'high' && score >= 70)
      || (filter === 'review' && score >= 35 && score < 70)
      || (filter === 'low' && score < 35);
    const haystack = `${item.case_id} ${item._workspace?.sourceLabel} ${item.category_analysis?.category_label} ${item.parsed?.subject}`.toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  }), [cases, filter, query]);

  const remove = (caseId) => {
    if (confirmId !== caseId) {
      setConfirmId(caseId);
      return;
    }
    removeCase(caseId);
    setConfirmId('');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Device case manager"
        title="Cases"
        description={storageStatus === 'ready' ? 'Reopen, export or remove analyses saved in this browser’s IndexedDB. Cases remain after reload until you remove them or clear browser data.' : storageStatus === 'loading' ? 'Restoring analyses from this browser’s IndexedDB…' : 'Device storage is unavailable, so analyses remain in memory for this tab only. Enable IndexedDB or export cases before closing it.'}
        meta={<span className="soft-badge">{cases.length} {storageStatus === 'ready' ? 'on this device' : 'in this tab'}</span>}
        actions={<button type="button" className="ui-button ui-button--primary" onClick={() => onStart('email_file')}><FilePlus2 size={16} />New analysis</button>}
      />

      {storageStatus === 'loading' ? (
        <section className="surface"><EmptyState icon={FolderOpen} title="Restoring device cases" description="Reading this browser profile’s IndexedDB. Your saved analyses will appear shortly." /></section>
      ) : cases.length ? (
        <>
          <section className="case-toolbar surface">
            <label className="search-field"><Search size={16} /><span className="sr-only">Search cases</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search case ID, subject, source or category…" /></label>
            <div className="filter-pills" aria-label="Filter cases">
              {FILTERS.map(([id, label]) => <button type="button" key={id} className={filter === id ? 'is-active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
            </div>
          </section>

          <section className="surface case-table-wrap">
            <table className="case-table">
              <caption className="sr-only">Cases saved on this browser profile</caption>
              <thead><tr><th>Case & source</th><th>Category</th><th>Assessment</th><th>Captured</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.case_id}>
                    <td><button type="button" className="case-source" onClick={() => onViewCase(item.case_id)}><span>{item.mode === 'attachment' ? <Paperclip size={16} /> : <Mail size={16} />}</span><div><strong>{item._workspace?.sourceLabel || item.case_id}</strong><small>{item.case_id}{item._workspace?.sample ? ' · Synthetic sample' : ''}</small></div></button></td>
                    <td><span className="category-cell">{item.category_analysis?.category_label || item.format_type || 'Uncategorized'}</span></td>
                    <td><RiskBadge data={item} compact /></td>
                    <td><span className="date-cell">{formatDate(item._workspace?.receivedAt || item.generated_at)}</span></td>
                    <td><div className="row-actions"><button type="button" className="icon-button" title="Export JSON" aria-label={`Export ${item.case_id}`} onClick={() => downloadCase(item)}><Download size={15} /></button><button type="button" className={`icon-button ${confirmId === item.case_id ? 'icon-button--confirm' : ''}`} title={confirmId === item.case_id ? 'Click again to confirm' : 'Remove from this device'} aria-label={`Remove ${item.case_id}`} onClick={() => remove(item.case_id)}><Trash2 size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? <div className="table-empty">No cases match this search and filter.</div> : null}
          </section>

          <div className="case-mobile-list">
            {filtered.map((item) => (
              <article className="surface case-mobile-card" key={item.case_id}>
                <div className="case-mobile-card__head"><div><span className="ui-eyebrow">{item.case_id}</span><h3>{item._workspace?.sourceLabel}</h3></div><RiskBadge data={item} compact /></div>
                <p>{item.category_analysis?.category_label || item.format_type}</p>
                <small>{formatDate(item._workspace?.receivedAt || item.generated_at)}</small>
                <div className="case-mobile-card__actions"><button type="button" className="ui-button ui-button--primary" onClick={() => onViewCase(item.case_id)}>Open case</button><button type="button" className="ui-button ui-button--secondary" onClick={() => downloadCase(item)}><Download size={14} />Export</button><button type="button" className="icon-button" aria-label={`Remove ${item.case_id}`} onClick={() => remove(item.case_id)}><Trash2 size={15} /></button></div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <section className="surface">
          <EmptyState icon={FolderOpen} title="No cases on this device" description={storageStatus === 'ready' ? 'Analyzed evidence will appear here and be restored after reload. Nothing is pre-filled and no remote case database is connected.' : 'Analyzed evidence will appear here for this tab only until device storage is available. Nothing is pre-filled and no remote case database is connected.'} actionLabel="Create your first analysis" onAction={() => onStart('email_file')} />
        </section>
      )}
    </div>
  );
}
