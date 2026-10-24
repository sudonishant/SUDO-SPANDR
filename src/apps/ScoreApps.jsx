/*
 * Focused scoring workbenches — one job each, instant verdict + score.
 *
 *  · EML / MSG Scorer  — drop a raw email file, full triage + score
 *  · Content Lab       — paste subject/body/header text, instant score
 *  · Attachment Lab    — drop ANY file, direct risk score
 *
 * Each panel runs the deterministic browser engine first (forensics.js) and
 * blends three AI lanes — keyword lexicon, NLP style features and a
 * BERT-distilled semantic lane (src/lib/nlp.js) — into one overall score.
 * HIGH risk (>= 70) unlocks the government-style signed report.
 */
import React from 'react';
import {
  AlertTriangle, Brain, FileSearch, FileText, Fingerprint, Loader2, Paperclip, ScrollText,
  ShieldCheck, Sparkles, Tag, UploadCloud,
} from 'lucide-react';
import {
  parseEmlFile, parseMsgFile, buildEmailAnalysis, analyzeStandaloneAttachment,
} from '../lib/forensics';
import { nlpScore, combineOverall } from '../lib/nlp';
import { buildGovReport, openGovReport, reportGate } from '../lib/reportGov';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const verdictTone = (status) => {
  if (/HIGH|LIKELY MALICIOUS/i.test(status || '')) return 'danger';
  if (/REVIEW|SUSPICIOUS/i.test(status || '')) return 'warn';
  return 'ok';
};

/* ---------------------------------------------------------------- shared UI */

export function ScoreMeter({ score = 0, status, label = 'RISK' }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const tone = verdictTone(status || (value >= 70 ? 'HIGH' : value >= 40 ? 'REVIEW' : 'ok'));
  const color = tone === 'danger' ? '#ff6b7a' : tone === 'warn' ? '#f3d37a' : '#9fe9bd';
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className="scoremeter">
      <svg width="92" height="92" viewBox="0 0 92 92" aria-label={`risk score ${value} of 100`}>
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
        <circle
          cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circ} ${circ}`} transform="rotate(-90 46 46)"
        />
        <text x="46" y="52" textAnchor="middle" fontSize="21" fontWeight="700" fill="#fff">{value}</text>
      </svg>
      <div className="scoremeter__label" style={{ color }}>{label}{status ? ` · ${status}` : ''}</div>
    </div>
  );
}

function SignalList({ signals = [], max = 8 }) {
  if (!signals.length) {
    return <div className="scorecard__none"><ShieldCheck size={12} /> No structural warning — not a verdict of safety.</div>;
  }
  return (
    <ul className="scorecard__signals">
      {signals.slice(0, max).map((sig, i) => {
        const text = typeof sig === 'string' ? sig : sig.label || sig.detail || JSON.stringify(sig);
        return <li key={`${i}-${text.slice(0, 24)}`}><AlertTriangle size={10} />{text}</li>;
      })}
    </ul>
  );
}

function AIPanel({ ai, overall }) {
  if (!ai) return null;
  const lanes = [
    { id: 'keyword', icon: Tag, title: 'Keyword lane', data: ai.keyword, sub: `${ai.keyword.matches.length} categor${ai.keyword.matches.length === 1 ? 'y' : 'ies'} matched` },
    { id: 'nlp', icon: Sparkles, title: 'NLP lane', data: ai.nlp, sub: `${ai.nlp.features.token_count} tokens · ${ai.nlp.features.bigram_count} bigrams` },
    { id: 'semantic', icon: Brain, title: 'BERT-distilled semantic', data: ai.semantic, sub: `cos(phish)=${ai.semantic.sim_phishing} · cos(benign)=${ai.semantic.sim_benign}` },
  ];
  return (
    <div className="scorecard__block">
      <h4>AI lanes — keywords · NLP · BERT-style semantic (offline)</h4>
      <div className="ailanes">
        {lanes.map((lane) => {
          const Icon = lane.icon;
          return (
            <div key={lane.id} className="ailane">
              <div className="ailane__head"><Icon size={11} /> {lane.title}</div>
              <div className="ailane__score" data-tone={verdictTone(lane.data.score >= 70 ? 'HIGH' : lane.data.score >= 40 ? 'REVIEW' : 'ok')}>{lane.data.score}</div>
              <div className="ailane__sub">{lane.sub}</div>
            </div>
          );
        })}
      </div>
      {ai.keyword.matches.filter((m) => m.weight > 0).length > 0 && (
        <div className="aikeywords">
          {ai.keyword.matches.filter((m) => m.weight > 0).map((m) => (
            <span key={m.category} className="chip chip--kw" title={m.hits.map((h) => `${h.word}×${h.count}`).join(', ')}>
              {m.label} <b>+{m.weight}</b>
            </span>
          ))}
        </div>
      )}
      {ai.nlp.signals.length > 0 && <SignalList signals={ai.nlp.signals} max={5} />}
      {ai.intents.length > 0 && (
        <div className="aikeywords">
          {ai.intents.map((i) => (
            <span key={i.intent} className="chip chip--intent">{i.label} <b>{i.confidence}%</b></span>
          ))}
        </div>
      )}
      <div className="scorecard__note">
        Combined AI score <b>{ai.combined}/100</b> · overall blended score <b>{overall}/100</b>.
        Semantic lane = 256-d distilled embeddings, computed in this browser; nothing is uploaded.
      </div>
    </div>
  );
}

function ReportPanel({ analysis, ai, overall }) {
  const [analyst, setAnalyst] = React.useState('');
  const [role, setRole] = React.useState('Cyber Forensic Analyst');
  const [done, setDone] = React.useState(false);
  const gate = reportGate(overall);
  return (
    <div className="scorecard__block reportpanel">
      <h4><ScrollText size={11} /> Government-style forensic report</h4>
      {gate ? (
        <>
          <div className="scorecard__none" style={{ color: '#f3d37a' }}>
            <AlertTriangle size={12} /> HIGH risk confirmed ({overall}/100) — report generation unlocked.
          </div>
          <div className="reportpanel__form">
            <input placeholder="Analyst name (for signature)" value={analyst} onChange={(e) => { setAnalyst(e.target.value); setDone(false); }} />
            <input placeholder="Designation" value={role} onChange={(e) => setRole(e.target.value)} />
            <button
              type="button"
              className="btn btn--primary btn--xs"
              onClick={() => {
                const html = buildGovReport({ analysis, ai, overall, analyst, role });
                setDone(openGovReport(html));
              }}
            >
              <ScrollText size={11} /> Generate signed report
            </button>
          </div>
          {done && <div className="scorecard__note">Report opened in a new tab — use Print / Save as PDF. It carries the evidence SHA-256 binding and the analyst signature block.</div>}
        </>
      ) : (
        <div className="scorecard__note">
          Report generation is <b>gated to HIGH risk findings only</b> (combined score ≥ 70).
          Current combined score: <b>{overall}/100</b>. Escalate the evidence or run the deep pass to enrich the case first.
        </div>
      )}
    </div>
  );
}

function FileDrop({ accept, hint, onFile, busy }) {
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef(null);
  return (
    <div
      className={`scoredrop ${over ? 'is-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {busy ? <Loader2 size={22} className="spin" /> : <UploadCloud size={22} />}
      <strong>{hint}</strong>
      <span>drop a file or click to browse · analysed locally in this browser</span>
    </div>
  );
}

function SampleBar({ items, onPick, busy }) {
  return (
    <div className="samplebar">
      <span className="samplebar__label">Bundled samples:</span>
      {items.map((item) => (
        <button key={item.path} type="button" className="chip chip--sample" disabled={busy} onClick={() => onPick(item)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

async function fetchSampleFile(path, filename) {
  const resp = await fetch(`${path}`);
  if (!resp.ok) throw new Error(`sample fetch failed (${resp.status})`);
  const blob = await resp.blob();
  return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
}

function useExternalAnalyze(kind, handler) {
  React.useEffect(() => {
    const onEvent = (e) => {
      const detail = e.detail || {};
      if (detail.kind !== kind || !detail.file) return;
      handler(detail.file, detail.text);
    };
    window.addEventListener('spandr:analyze', onEvent);
    return () => window.removeEventListener('spandr:analyze', onEvent);
  }, [kind, handler]);
}

/* ---------------------------------------------------------------- EML scorer */

export function EmlScoreApp() {
  const [busy, setBusy] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [ai, setAi] = React.useState(null);
  const [overall, setOverall] = React.useState(0);
  const [err, setErr] = React.useState('');
  const [apiNote, setApiNote] = React.useState('');

  const analyze = React.useCallback(async (file) => {
    if (!file) return;
    setBusy(true); setErr(''); setApiNote(''); setAi(null);
    try {
      const lower = file.name.toLowerCase();
      const parsed = lower.endsWith('.msg') ? await parseMsgFile(file) : await parseEmlFile(file);
      const report = await buildEmailAnalysis(parsed);
      const aiResult = nlpScore({
        subject: report.parsed?.subject || '',
        body: report.parsed?.body || '',
        urls: report.aitm_analysis || [],
        attachments: report.attachment_analysis || [],
      });
      const blended = combineOverall(report.threat?.risk_score, aiResult);
      setData(report);
      setAi(aiResult);
      setOverall(blended);
      // optional Threat-Lab deep pass (link/attachment engines) when reachable
      try {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(',')[1]);
          r.onerror = () => rej(new Error('read failed'));
          r.readAsDataURL(file);
        });
        const payload = lower.endsWith('.msg')
          ? {
            eml_text: `${report.parsed?.headers ? Object.entries(report.parsed.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : ''}\nSubject: ${report.parsed?.subject || ''}\n\n${report.parsed?.body || ''}`,
            files: (report.attachment_analysis || []).map((a) => ({ filename: a.filename, file_b64: '' })),
            urls: (report.aitm_analysis || []).map((u) => (typeof u === 'string' ? u : u.url)).filter(Boolean),
          }
          : { eml_b64: b64 };
        const resp = await fetch(`${API_BASE}/api/v1/sandbox/lab/auto-triage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          const triage = await resp.json();
          setData((prev) => ({ ...prev, lab_triage: triage }));
          setApiNote(`Threat-Lab deep pass: aggregate ${triage.aggregate_risk}/100 · ${triage.meta?.attachments_found ?? 0} attachment(s) · ${triage.meta?.links_found ?? 0} link(s) dissected`);
        } else {
          setApiNote('Threat-Lab API offline — score is local-browser triage only.');
        }
      } catch {
        setApiNote('Threat-Lab API unreachable — score is local-browser triage only.');
      }
    } catch (e) {
      setErr(e?.message || 'could not parse the message');
      setData(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useExternalAnalyze('email_file', analyze);

  const pickSample = async (item) => {
    try {
      setBusy(true); setErr('');
      const file = await fetchSampleFile(item.path, item.filename);
      await analyze(file);
    } catch (e) {
      setErr(e?.message || 'sample load failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scoreapp">
      <div className="scoreapp__head">
        <FileSearch size={15} />
        <div>
          <strong>EML / MSG Scorer</strong>
          <span>full message triage — headers, auth, body signals, links &amp; attachments · NLP + keyword + semantic lanes</span>
        </div>
      </div>
      {!data && <FileDrop accept=".eml,.msg" hint="Drop an .eml or .msg email file" onFile={analyze} busy={busy} />}
      <SampleBar busy={busy} onPick={pickSample} items={[
        { label: 'BEC phishing .eml', path: '/samples/sample-phishing.eml', filename: 'sample-phishing.eml' },
        { label: 'Credential theft .eml', path: '/samples/sample-credential.eml', filename: 'sample-credential.eml' },
        { label: 'Safe notice .eml', path: '/samples/sample-safe.eml', filename: 'sample-safe.eml' },
        { label: 'Phishing .msg', path: '/samples/sample-phishing.msg', filename: 'sample-phishing.msg' },
        { label: 'Safe .msg', path: '/samples/sample-safe.msg', filename: 'sample-safe.msg' },
      ]} />
      {err && <div className="scorecard__err">{err}</div>}
      {data && (
        <>
          <div className="scorecard">
            <ScoreMeter score={overall} status={data.threat?.status} />
            <div className="scorecard__meta">
              <div><span>case</span><b>{data.case_id}</b></div>
              <div><span>format</span><b>{data.format_type}</b></div>
              <div><span>category</span><b>{data.category_analysis?.category_label || '—'}</b></div>
              <div><span>from</span><b>{data.parsed?.sender || '—'}</b></div>
              <div><span>subject</span><b>{data.parsed?.subject || '—'}</b></div>
              <div><span>sha256</span><b className="mono">{(data.evidence?.sha256 || '').slice(0, 24)}…</b></div>
              <div><span>structural</span><b>{data.threat?.risk_score ?? 0}/100</b></div>
              <div><span>AI lanes</span><b>{ai ? ai.combined : 0}/100</b></div>
            </div>
          </div>
          <AIPanel ai={ai} overall={overall} />
          <div className="scorecard__row">
            <div className="scorecard__block">
              <h4>Structural signals (deterministic)</h4>
              <SignalList signals={data.threat?.signals || []} max={8} />
            </div>
            <div className="scorecard__block">
              <h4>Links ({(data.aitm_analysis || []).length}) · Attachments ({(data.attachment_analysis || []).length})</h4>
              {(data.aitm_analysis || []).slice(0, 5).map((u) => (
                <span key={u.url || u} className="chip-url">{typeof u === 'string' ? u : u.url}</span>
              ))}
              {(data.attachment_analysis || []).slice(0, 5).map((a) => (
                <span key={a.filename} className="chip-att"><Paperclip size={9} />{a.filename}<b>{a.risk_score ?? 0}</b></span>
              ))}
              {!(data.aitm_analysis || []).length && !(data.attachment_analysis || []).length && (
                <div className="scorecard__none"><ShieldCheck size={12} /> none observed</div>
              )}
            </div>
          </div>
          {data.lab_triage && (
            <div className="scorecard__block">
              <h4>Threat-Lab deep pass</h4>
              <SignalList signals={data.lab_triage.summary || []} max={8} />
              <div className="scorecard__note">{apiNote}</div>
            </div>
          )}
          <ReportPanel analysis={data} ai={ai} overall={overall} />
          <div className="scorecard__note">
            {(data.limitations || []).join(' · ')}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- content lab */

export function ContentLabApp() {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [ai, setAi] = React.useState(null);
  const [overall, setOverall] = React.useState(0);
  const [err, setErr] = React.useState('');

  const analyze = React.useCallback(async (inputText) => {
    const source = (inputText ?? text).trim();
    if (!source) { setErr('paste some email text first'); return; }
    setBusy(true); setErr('');
    try {
      const { parseTextInput } = await import('../lib/forensics');
      const parsed = parseTextInput({ body: source });
      const report = await buildEmailAnalysis(parsed);
      const aiResult = nlpScore({
        subject: report.parsed?.subject || '',
        body: report.parsed?.body || source,
        urls: report.aitm_analysis || [],
        attachments: [],
      });
      const blended = combineOverall(report.threat?.risk_score, aiResult);
      setData(report); setAi(aiResult); setOverall(blended);
    } catch (e) {
      setErr(e?.message || 'analysis failed');
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [text]);

  useExternalAnalyze('text_email', (file, eventText) => {
    if (eventText) { setText(eventText); analyze(eventText); }
    else if (file) { file.text().then((t) => { setText(t); analyze(t); }); }
  });

  const pickSample = async (item) => {
    try {
      setBusy(true);
      const resp = await fetch(item.path);
      const t = await resp.text();
      setText(t);
      await analyze(t);
    } catch (e) {
      setErr(e?.message || 'sample load failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scoreapp">
      <div className="scoreapp__head">
        <FileText size={15} />
        <div>
          <strong>Content Lab</strong>
          <span>paste email text or headers — intent, keywords and risk in one pass</span>
        </div>
      </div>
      <textarea
        className="scoreapp__text"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'From: someone@example.com\nSubject: URGENT wire transfer needed\n\nPaste the full email body here…'}
      />
      <div className="scoreapp__actions">
        <button type="button" className="btn btn--primary btn--xs" onClick={() => analyze()} disabled={busy}>
          {busy ? <Loader2 size={11} className="spin" /> : <FileText size={11} />} Score content
        </button>
        <button type="button" className="btn btn--xs" onClick={() => { setText(''); setData(null); setAi(null); }}>Clear</button>
      </div>
      <SampleBar busy={busy} onPick={pickSample} items={[
        { label: 'Risk · BEC wire', path: '/samples/email-text/risk/bec-wire-transfer.txt' },
        { label: 'Risk · OTP scam', path: '/samples/email-text/risk/otp-credential-scam.txt' },
        { label: 'Risk · extortion', path: '/samples/email-text/risk/extortion-sextortion.txt' },
        { label: 'Safe · maintenance', path: '/samples/email-text/safe/maintenance-notice.txt' },
        { label: 'Safe · meeting', path: '/samples/email-text/safe/meeting-invite.txt' },
        { label: 'Safe · report', path: '/samples/email-text/safe/quarterly-report.txt' },
      ]} />
      {err && <div className="scorecard__err">{err}</div>}
      {data && (
        <>
          <div className="scorecard">
            <ScoreMeter score={overall} status={data.threat?.status} />
            <div className="scorecard__meta">
              <div><span>case</span><b>{data.case_id}</b></div>
              <div><span>category</span><b>{data.category_analysis?.category_label || '—'}</b></div>
              <div><span>structural</span><b>{data.threat?.risk_score ?? 0}/100</b></div>
              <div><span>AI lanes</span><b>{ai ? ai.combined : 0}/100</b></div>
            </div>
          </div>
          <AIPanel ai={ai} overall={overall} />
          <div className="scorecard__block">
            <h4>Structural signals (deterministic)</h4>
            <SignalList signals={data.threat?.signals || []} max={8} />
          </div>
          <ReportPanel analysis={data} ai={ai} overall={overall} />
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- attachment lab */

export function AttachLabApp() {
  const [busy, setBusy] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [ai, setAi] = React.useState(null);
  const [overall, setOverall] = React.useState(0);
  const [err, setErr] = React.useState('');
  const [apiNote, setApiNote] = React.useState('');
  const [deep, setDeep] = React.useState(null);

  const analyze = React.useCallback(async (file) => {
    if (!file) return;
    setBusy(true); setErr(''); setApiNote(''); setDeep(null); setAi(null);
    try {
      const report = await analyzeStandaloneAttachment(file);
      const att = (report.attachment_analysis || [])[0] || {};
      // AI lanes over the extracted printable strings + filename
      const aiResult = nlpScore({
        subject: file.name,
        body: String(att.strings_sample || att.raw_text_excerpt || '').slice(0, 4000),
        urls: [],
        attachments: [att],
      });
      const blended = combineOverall(report.threat?.risk_score, aiResult);
      setData(report); setAi(aiResult); setOverall(blended);
      // optional deep engine pass
      try {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(',')[1]);
          r.onerror = () => rej(new Error('read failed'));
          r.readAsDataURL(file);
        });
        const resp = await fetch(`${API_BASE}/api/v1/sandbox/lab/attachment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, file_b64: b64 }),
        });
        if (resp.ok) {
          const payload = await resp.json();
          setDeep(payload);
          setApiNote(`Deep engine: risk ${payload.risk_score}/100 — ${payload.verdict}`);
        } else setApiNote('Deep engine offline — static browser analysis only.');
      } catch {
        setApiNote('Deep engine unreachable — static browser analysis only.');
      }
    } catch (e) {
      setErr(e?.message || 'could not analyse the attachment');
      setData(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useExternalAnalyze('attachment_file', analyze);

  const pickSample = async (item) => {
    try {
      setBusy(true); setErr('');
      const file = await fetchSampleFile(item.path, item.filename);
      await analyze(file);
    } catch (e) {
      setErr(e?.message || 'sample load failed');
    } finally {
      setBusy(false);
    }
  };

  const att = data ? (data.attachment_analysis || [])[0] || {} : null;

  return (
    <div className="scoreapp">
      <div className="scoreapp__head">
        <Paperclip size={15} />
        <div>
          <strong>Attachment Lab</strong>
          <span>drop any file — magic bytes, entropy, embedded markers &amp; direct score</span>
        </div>
      </div>
      {!data && <FileDrop accept="*" hint="Drop ANY attachment for a direct score" onFile={analyze} busy={busy} />}
      <SampleBar busy={busy} onPick={pickSample} items={[
        { label: 'invoice.pdf.exe', path: '/samples/attachments/invoice.pdf.exe', filename: 'invoice.pdf.exe' },
        { label: 'macro-invoice.doc', path: '/samples/attachments/macro-invoice.doc', filename: 'macro-invoice.doc' },
        { label: 'order-details.js', path: '/samples/attachments/order-details.js', filename: 'order-details.js' },
        { label: 'order-sheet.html', path: '/samples/attachments/order-sheet.html', filename: 'order-sheet.html' },
        { label: 'clean-summary.txt', path: '/samples/attachments/clean-summary.txt', filename: 'clean-summary.txt' },
      ]} />
      {err && <div className="scorecard__err">{err}</div>}
      {data && att && (
        <>
          <div className="scorecard">
            <ScoreMeter score={overall} label="FILE RISK" status={att.risk_level === 'HIGH' ? 'HIGH RISK' : att.risk_level === 'MEDIUM' ? 'REVIEW' : 'NO MARKERS'} />
            <div className="scorecard__meta">
              <div><span>file</span><b>{att.filename}</b></div>
              <div><span>type (magic)</span><b>{att.detected_type || '—'}</b></div>
              <div><span>ext</span><b>{att.extension}</b></div>
              <div><span>size</span><b>{att.size_bytes} bytes</b></div>
              <div><span>sha256</span><b className="mono">{(att.sha256 || '').slice(0, 24)}…</b></div>
              <div><span>entropy</span><b>{att.entropy} bits/byte {att.entropy > 7.2 ? '· packed/encrypted' : att.entropy > 5 ? '· mixed' : '· flat'}</b></div>
              <div><span>structural</span><b>{att.risk_score ?? 0}/100</b></div>
              <div><span>AI lanes</span><b>{ai ? ai.combined : 0}/100</b></div>
            </div>
          </div>
          <div className="entropybar"><i style={{ width: `${Math.min(100, (Number(att.entropy) || 0) / 8 * 100)}%` }} /></div>
          <div className="scorecard__row">
            <div className="scorecard__block">
              <h4><Fingerprint size={11} /> Static findings</h4>
              <SignalList signals={att.findings || []} max={10} />
            </div>
            <div className="scorecard__block">
              <h4>Format inspection</h4>
              <div className="scorecard__note">
                {att.primary_end_offset != null && <div>primary container ends at byte <b>{att.primary_end_offset}</b>{att.trailing_non_whitespace_bytes ? ` · ${att.trailing_non_whitespace_bytes} trailing non-whitespace bytes (possible appended payload)` : ''}</div>}
                {att.embedded_signatures?.length > 0 && <div>embedded signatures: {att.embedded_signatures.join(', ')}</div>}
                <div>{att.scanner}</div>
              </div>
            </div>
          </div>
          {ai && <AIPanel ai={ai} overall={overall} />}
          {deep && (
            <div className="scorecard__block">
              <h4>Threat-Lab deep engine</h4>
              <SignalList signals={deep.findings || []} max={10} />
              <div className="scorecard__note">{apiNote}</div>
            </div>
          )}
          {!deep && apiNote && <div className="scorecard__note">{apiNote}</div>}
          <ReportPanel analysis={data} ai={ai} overall={overall} />
        </>
      )}
    </div>
  );
}
