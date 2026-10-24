import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, ChevronRight, Download, FileCode2, Hash, Info, LayoutDashboard,
  Link2, Mail, MapPin, Network, Paperclip, Printer, Radar, Shield, ShieldAlert, Tag, XCircle,
} from 'lucide-react';
import { useForensicStore } from '../store/useForensicStore';
import MitrePanel from '../components/MitrePanel';
import { DossierView } from '../components/Dossier';


function Panel({ icon: Icon, eyebrow, title, children, full = false }) {
  return (
    <section className={`panel ${full ? 'panel--full' : ''}`}>
      <div className="panel__head">
        <span className="panel__icon"><Icon size={14} /></span>
        <div><small>{eyebrow}</small><h3>{title}</h3></div>
      </div>
      {children}
    </section>
  );
}

function KV({ label, value, mono = false }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <strong className={mono ? 'mono' : ''}>{value || 'Not available'}</strong>
    </div>
  );
}

function StatusIcon({ risk }) {
  if (risk === 'HIGH') return <AlertTriangle size={18} />;
  if (risk === 'MEDIUM') return <Info size={18} />;
  return <CheckCircle2 size={18} />;
}

function CategoryPanel({ category }) {
  if (!category) return <div className="empty-panel">Category analysis is not available for this result.</div>;
  return (
    <div className={`category-panel ${category.alert_level}`}>
      <div className="category-topline">
        <div><small>PRIMARY CATEGORY</small><h4>{category.category_label}</h4></div>
        <div className="alert-badge">{category.alert_level.toUpperCase()}</div>
      </div>
      <p className="category-description">{category.description}</p>
      <div className="category-metrics">
        <div><strong>{category.points}</strong><span>category points</span></div>
        <div><strong>{category.confidence}%</strong><span>evidence coverage</span></div>
      </div>
      <div className="category-alert">
        <AlertTriangle size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
        <div><strong>{category.alert_title}</strong><p>{category.recommended_action}</p></div>
      </div>
      <div className="category-spam">
        <span>SPAM / BULK CHECK</span>
        <strong>{category.spam_assessment}</strong>
        {category.spam_signals?.length ? <p>{category.spam_signals.join(' · ')}</p> : null}
      </div>
      {category.all_category_scores?.length > 1 && (
        <div className="category-alternatives">
          <span>OTHER MATCHED CATEGORIES</span>
          {category.all_category_scores.slice(0, 4).map((item) => (
            <div key={item.category_id}><span>{item.label}</span><strong>{item.points}</strong></div>
          ))}
        </div>
      )}
      <p className="disclaimer">{category.confidence_label}. {category.note}</p>
    </div>
  );
}

function ScoreBreakdown({ threat }) {
  const breakdown = threat?.score_breakdown;
  if (!breakdown) return <div className="empty-panel">Score breakdown is not available for this result.</div>;
  const positives = breakdown.positive_contributors || [];
  const deductions = breakdown.deductions || [];
  return (
    <div className="score-ledger">
      <div className="score-formula">
        <span>FORMULA</span>
        <code>{breakdown.formula}</code>
        <p className="score-ledger-note">Category points are classification evidence and are not automatically added to the threat score. Only the listed threat contributors affect this formula.</p>
      </div>
      <div className="score-ledger-columns">
        <div>
          <div className="ledger-heading"><strong>Observed contributors</strong><span className="signal-weight positive">+{breakdown.positive_total}</span></div>
          {positives.length ? positives.map((item, index) => (
            <div className="ledger-row" key={`positive-${item.label}-${index}`}>
              <div><strong>{item.label}</strong><p>{item.evidence}</p><small>{item.source}</small></div>
              <span className="signal-weight positive">+{item.points}</span>
            </div>
          )) : <p className="muted">No positive point contributor was recorded.</p>}
        </div>
        <div>
          <div className="ledger-heading"><strong>Context deductions</strong><span className="signal-weight deduction">{breakdown.adjustment_total}</span></div>
          {deductions.length ? deductions.map((item, index) => (
            <div className="ledger-row" key={`deduction-${item.label}-${index}`}>
              <div><strong>{item.label}</strong><p>{item.evidence}</p><small>{item.source}</small></div>
              <span className="signal-weight deduction">{item.points}</span>
            </div>
          )) : <p className="muted">No deductions or adjustments were applied.</p>}
        </div>
      </div>
      <div className="ledger-final"><span>FINAL TRIAGE SCORE</span><strong>{breakdown.final_score}/100</strong></div>
      <p className="disclaimer">Positive points are observed signals, not proof of maliciousness. Negative adjustments are context only and do not prove that a message is safe. A zero contributor total means no explicit threat rule added points; it does not mean the message was cryptographically verified as safe.</p>
    </div>
  );
}

function AIReviewPanel({ review, onRun, question, onQuestionChange }) {
  const questionBox = (
    <div className="ai-question-box">
      <label htmlFor="ai-question">ASK ABOUT THIS ANALYSIS</label>
      <input id="ai-question" value={question} onChange={(event) => onQuestionChange(event.target.value)} placeholder="Ask in Hindi, Hinglish, English, or another language…" maxLength={2000} />
      <small>AI answers in the language you use. Do not enter secrets or unnecessary personal data.</small>
    </div>
  );
  if (!review) {
    return (
      <div className="ai-review-empty">
        <p>AI is an optional second opinion. It runs only after you press the button, and it never replaces observed evidence or the deterministic category.</p>
        {questionBox}
        <button type="button" className="app-btn app-btn--sm" onClick={() => onRun(question)} style={{ width: 'fit-content' }}><span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#b18cf7,#7a45e0)' }}><Bot size={13} /></span>Run AI second opinion</button>
      </div>
    );
  }
  if (review.status === 'loading') return <div className="empty-panel">Requesting a cautious AI second opinion…</div>;
  if (review.status !== 'available') {
    return (
      <div className="ai-review-message">
        {questionBox}
        <strong>{review.status === 'not_configured' ? 'AI not configured' : review.status === 'rate_limited' ? 'Free model temporarily rate-limited' : 'AI review unavailable'}</strong>
        <p>{review.message}</p>
        {review.retry_after ? <small>Provider retry hint: {review.retry_after}.</small> : null}
        <small>No AI verdict was generated. Deterministic triage remains available.</small>
        {review.fallback?.answer ? (
          <div className="ai-fallback">
            <strong>Deterministic explanation — not an AI response</strong>
            <p>{review.fallback.answer}</p>
            <p>{review.fallback.risk_summary}</p>
            <p>{review.fallback.recommended_action}</p>
          </div>
        ) : null}
        {review.status !== 'not_configured' ? <button type="button" className="app-btn app-btn--sm" onClick={() => onRun(question)} style={{ width: 'fit-content' }}><span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#b18cf7,#7a45e0)' }}><RefreshCw size={12} /></span>Try AI again</button> : null}
      </div>
    );
  }
  const result = review.result || {};
  return (
    <div className="ai-review-panel">
      <div className="ai-review-heading">
        <span><Bot size={14} /> OpenRouter second opinion</span>
        <span className="mini-badge neutral">{review.model || 'FREE ROUTER'} · HUMAN REVIEW REQUIRED</span>
      </div>
      {questionBox}
      <p><strong>Answer:</strong> {result.answer || 'No answer field returned.'}</p>
      <p><strong>Response language:</strong> {result.response_language || 'Not reported'}</p>
      <p><strong>Observation:</strong> {result.category_observation}</p>
      <p><strong>Risk summary:</strong> {result.risk_summary}</p>
      <p><strong>Recommended action:</strong> {result.recommended_action}</p>
      <p><strong>AI confidence:</strong> {result.confidence}% — model-reported interpretation, not probability or proof.</p>
      {result.limitations?.length ? <div className="limitation-list">{result.limitations.map((item, index) => <p key={index}>{item}</p>)}</div> : null}
      <p className="disclaimer">{review.note}</p>
    </div>
  );
}

function AuthenticationPanel({ auth }) {
  if (!auth) return <div className="empty-panel">Authentication does not apply to a standalone attachment.</div>;
  const rows = [['SPF', auth.spf], ['DKIM', auth.dkim], ['DMARC', auth.dmarc], ['ARC', auth.arc]];
  return (
    <div className="auth-grid">
      {rows.map(([label, value]) => (
        <div className="auth-item" key={label}><span>{label}</span><strong>{value}</strong></div>
      ))}
      <div className="auth-evidence">
        <span>AUTHENTICATION EVIDENCE FOUND</span>
        <strong>{auth.reported_header}</strong>
        <p>{auth.evidence_sources?.length ? auth.evidence_sources.join(' · ') : 'No recognised authentication header was found in the submitted EML/MSG headers.'}</p>
        <code>{String(auth.raw_reported || '').slice(0, 1600)}</code>
      </div>
      <p className="disclaimer">{auth.note}</p>
    </div>
  );
}

function HeaderPanel({ data }) {
  const parsed = data.parsed || {};
  const headers = parsed.headerEntries || [];
  if (!headers.length) return <div className="empty-panel">No structured transport headers were supplied. This is expected for ordinary pasted body text.</div>;
  return (
    <div className="header-table">
      {headers.slice(0, 24).map((item, index) => (
        <div className="header-row" key={`${item.name}-${index}`}><span>{item.name}</span><code>{item.value}</code></div>
      ))}
      {headers.length > 24 && <p className="muted">Showing first 24 headers. The complete raw evidence is not stored by this browser-only demo.</p>}
    </div>
  );
}

function RelayPanel({ relay, onLookup, geoLoading }) {
  if (!relay) return <div className="empty-panel">Standalone attachments have no SMTP relay path.</div>;
  const ips = relay.ips || [];
  return (
    <div>
      <div className="relay-summary">
        <div><small>PUBLIC IPs EXTRACTED</small><strong>{ips.length}</strong></div>
        <div><small>HOP STATUS</small><strong>{relay.status}</strong></div>
      </div>
      {ips.length ? (
        <div className="ip-route-visual" aria-label="Observed IP relay order">
          {ips.map((item, index) => (
            <React.Fragment key={`${item.ip}-${index}`}>
              <div className="ip-route-node">
                <span className="route-pulse">{index + 1}</span>
                <code>{item.ip}</code>
                <small>{item.field}</small>
              </div>
              {index < ips.length - 1 && <span className="route-connector" aria-hidden="true" />}
            </React.Fragment>
          ))}
        </div>
      ) : <div className="empty-panel">No public IP was extracted from the submitted headers; route visualisation is unavailable.</div>}
      <div className="ip-context-action">
        <button type="button" className="app-btn app-btn--sm" onClick={onLookup} disabled={!ips.length || geoLoading} style={{ width: 'fit-content' }}>
          <span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#5aa8f5,#2f7fe0)' }}><Globe size={12} /></span>
          {geoLoading ? 'Looking up registration context…' : 'Check approximate network context'}
        </button>
        <small>Uses public RDAP registration data only. It may indicate a cloud/hosting or access network, but it cannot identify a person or exact location.</small>
      </div>
      <p className="disclaimer" style={{ marginTop: 8 }}>{relay.note} The order shown is extracted evidence order, not a geographic route.</p>
    </div>
  );
}

function URLPanel({ urls }) {
  if (!urls?.length) return <div className="empty-panel">No URL was extracted from the submitted content.</div>;
  return (
    <div className="url-list">
      {urls.map((url, index) => (
        <div className="url-row" key={`${url.url}-${index}`}>
          <div className="url-heading">
            <Link2 size={13} />
            <code>{url.url}</code>
            <span className={`mini-badge ${url.risk === 'REVIEW' ? 'warn' : 'neutral'}`}>{url.risk}</span>
          </div>
          <p>{url.reasons?.length ? url.reasons.join(' · ') : 'No browser-side structural warning observed. Reputation was not queried.'}</p>
        </div>
      ))}
    </div>
  );
}

function SignalList({ signals }) {
  if (!signals?.length) return <div className="empty-panel">No high-risk signal was observed in the submitted evidence.</div>;
  return (
    <div className="signal-list">
      {signals.map((signal, index) => {
        const isText = typeof signal === 'string';
        const label = isText ? signal : signal.label;
        const evidence = isText ? 'Observed by the standalone static inspector' : signal.evidence;
        const weight = isText ? null : signal.weight;
        return (
          <div className="signal-row" key={`${label}-${index}`}>
            <span className="signal-mark">{weight > 15 ? '!' : '·'}</span>
            <div><strong>{label}</strong><p>{evidence || 'No additional explanation was returned.'}</p></div>
            {weight != null && <span className="signal-weight positive">+{weight}</span>}
          </div>
        );
      })}
    </div>
  );
}

function AttachmentPanel({ attachments }) {
  if (!attachments?.length) return <div className="empty-panel">No attachment was extracted from this evidence.</div>;
  return (
    <div className="attachment-list">
      {attachments.map((attachment) => (
        <div className="attachment-row" key={`${attachment.filename}-${attachment.sha256}`}>
          <div className="attachment-icon"><Paperclip size={15} /></div>
          <div className="attachment-main">
            <div className="url-heading">
              <strong style={{ fontSize: 11.5 }}>{attachment.filename}</strong>
              <span className={`mini-badge ${attachment.risk_level === 'HIGH' ? 'warn' : 'neutral'}`}>{attachment.risk_level}</span>
            </div>
            <div className="attachment-meta">
              <span>{attachment.detected_type}</span>
              <span>{attachment.size_bytes} bytes</span>
              <span>entropy {attachment.entropy}</span>
            </div>
            <p>{attachment.findings?.join(' ')}</p>
            <code>{attachment.sha256}</code>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalysisResultView({ data }) {
  const [active, setActive] = useState('overview');
  const {
    resetResult, aiReview, aiQuestion, setAiQuestion, runAiReview, geoLoading, lookupIpContext,
  } = useForensicStore();
  const parsed = data.parsed || {};
  const threat = data.threat || {};
  const score = threat.risk_score ?? 0;
  const risk = score >= 70 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';

  const tabs = useMemo(() => {
    const base = [['overview', 'Overview', LayoutDashboard]];
    if (['eml', 'msg', 'text-headers', 'text'].includes(data.mode)) {
      base.push(['headers', 'Headers', FileCode2], ['auth', 'Auth checks', Shield], ['route', 'Relay path', Network], ['links', 'URLs', Link2]);
    }
    if (['eml', 'msg', 'attachment'].includes(data.mode)) base.push(['files', 'Files', Paperclip]);
    base.push(['mitre', 'MITRE', Radar], ['dossier', 'Dossier', Printer]);
    return base;
  }, [data.mode]);

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${data.case_id}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="report" aria-live="polite">
      <div className={`verdict ${risk.toLowerCase()}`}>
        <div className="verdict__icon"><StatusIcon risk={risk} /></div>
        <div>
          <div className="verdict__eyebrow">{data.format_type} · {data.case_id}</div>
          <h2 className="verdict__title">{threat.status}</h2>
          <p className="verdict__note">{threat.note}</p>
        </div>
        <div className="verdict__score"><strong>{score}</strong><span>triage score / 100</span></div>
      </div>

      {data.parseError && <div className="error-banner" role="alert">MSG parser could not read this file: {data.parseError}</div>}

      <div className="report-toolbar">
        <div className="report-toolbar__left">
          <span className="live-pill"><i /> Result available</span>
          <span>No fake pass/fail claims are generated.</span>
        </div>
        <div className="report-toolbar__actions">
          <button type="button" className="app-btn app-btn--sm" onClick={runAiReview}><span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#b18cf7,#7a45e0)' }}><Bot size={13} /></span>AI second opinion</button>
          <button type="button" className="app-btn app-btn--sm" onClick={downloadJSON}><span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#63e08a,#18a34a)' }}><Download size={13} /></span>Export JSON</button>
          <button type="button" className="app-btn app-btn--sm" onClick={resetResult}><span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#ff8a7a,#e4392f)' }}><XCircle size={13} /></span>Clear</button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={active === id} className={`tab ${active === id ? 'active' : ''}`} onClick={() => setActive(id)}>
            <Icon size={13} />{label}<ChevronRight size={11} />
          </button>
        ))}
      </div>

      {active === 'overview' && (
        <div className="report-grid">
          <Panel icon={Tag} eyebrow="Category & alert" title="What kind of mail is this?">
            <CategoryPanel category={data.category_analysis} />
          </Panel>
          <Panel icon={Hash} eyebrow="Transparent risk score" title="Why is the score this high?">
            <ScoreBreakdown threat={threat} />
          </Panel>
          <Panel icon={Bot} eyebrow="Optional AI interpretation" title="Second opinion">
            <AIReviewPanel review={aiReview} onRun={runAiReview} question={aiQuestion} onQuestionChange={setAiQuestion} />
          </Panel>
          <Panel
            icon={data.mode === 'attachment' ? Paperclip : Mail}
            eyebrow={data.mode === 'attachment' ? 'File evidence' : 'Input identity'}
            title={data.mode === 'attachment' ? 'Standalone attachment' : 'Submitted message'}
          >
            <KV label={data.mode === 'attachment' ? 'File' : 'From'} value={data.mode === 'attachment' ? data.filename : parsed.sender} mono />
            <KV label={data.mode === 'attachment' ? 'Detected type' : 'To'} value={data.mode === 'attachment' ? data.attachment_analysis?.[0]?.detected_type : parsed.recipient} mono />
            <KV label={data.mode === 'attachment' ? 'Size' : 'Subject'} value={data.mode === 'attachment' ? `${data.attachment_analysis?.[0]?.size_bytes || 0} bytes` : parsed.subject} />
            <KV label="Source mode" value={data.format_type} />
          </Panel>
          <Panel icon={ShieldAlert} eyebrow="Evidence signals" title="Why this needs attention">
            <SignalList signals={threat.signals} />
          </Panel>
          <Panel icon={Hash} eyebrow="Evidence integrity" title="Hash and preservation">
            <KV label="SHA-256" value={data.evidence?.sha256} mono />
            <KV label="Raw size" value={data.evidence?.raw_size_bytes ? `${data.evidence.raw_size_bytes} bytes` : 'Not retained in browser result'} />
            <p className="disclaimer">{data.evidence?.preservation}</p>
          </Panel>
          <Panel icon={Info} eyebrow="Limitations" title="Read before acting" full>
            <div className="limitation-list">
              {data.limitations?.map((item, index) => <p key={index}>{item}</p>)}
            </div>
          </Panel>
        </div>
      )}

      {active === 'headers' && (
        <div className="report-grid">
          <Panel icon={FileCode2} eyebrow="Email evidence" title="Submitted header fields" full>
            <HeaderPanel data={data} />
          </Panel>
        </div>
      )}

      {active === 'auth' && (
        <div className="report-grid">
          <Panel icon={Shield} eyebrow="No fabricated verdicts" title="Authentication checks" full>
            <AuthenticationPanel auth={data.dns_auth} />
          </Panel>
        </div>
      )}

      {active === 'route' && (
        <div className="report-grid">
          <Panel icon={Network} eyebrow="Observed metadata only" title="Relay and IP evidence" full>
            <RelayPanel relay={data.relay_info} onLookup={lookupIpContext} geoLoading={geoLoading} />
            <div className="geo-card">
              <MapPin size={15} />
              <div>
                <strong>{data.geo_data?.status || 'NOT AVAILABLE'}</strong>
                <p>{data.geo_data?.note}</p>
                {data.geo_data?.results?.map((item) => (
                  <div className="geo-result" key={item.ip}>
                    <code>{item.ip}</code>
                    <strong>{item.network_type || 'NETWORK TYPE NOT DETERMINED'}</strong>
                    <span>{[item.organization, item.network_name, item.country].filter(Boolean).join(' · ') || item.message || 'Registration context unavailable'}</span>
                    <small>{item.note || item.network_type_basis}</small>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {active === 'links' && (
        <div className="report-grid">
          <Panel icon={Link2} eyebrow="Static URL extraction" title="Links found in message" full>
            <URLPanel urls={data.aitm_analysis} />
          </Panel>
        </div>
      )}

      {active === 'files' && (
        <div className="report-grid">
          <Panel icon={Paperclip} eyebrow="Static file inspection" title="Attachments and file markers" full>
            <AttachmentPanel attachments={data.attachment_analysis} />
          </Panel>
        </div>
      )}

      {active === 'mitre' && (
        <div className="report-grid">
          <Panel icon={Radar} eyebrow="Vocabulary, not evidence" title="ATT&CK mapping" full>
            <MitrePanel caseId={data.case_id} />
          </Panel>
        </div>
      )}

      {active === 'dossier' && (
        <div className="report-grid">
          <Panel icon={Printer} eyebrow="Session output · review before use" title="Case dossier, containment draft and ATT&CK mapping" full>
            <DossierView data={data} />
            <MitrePanel caseId={data.case_id} />
          </Panel>
        </div>
      )}
    </section>
  );
}


export default AnalysisResultView;
