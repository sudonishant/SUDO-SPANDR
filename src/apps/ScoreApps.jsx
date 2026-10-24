/*
 * Focused scoring workbenches — one job each, instant verdict + score.
 *  · EmlScoreApp     — .eml / .msg  → full triage + score
 *  · ContentLabApp   — pasted content → threat score
 *  · AttachLabApp    — any file → direct score
 * Reuses the local forensic engines in lib/forensics.js (nothing leaves the
 * browser) and opportunistically upgrades with the Threat-Lab API when the
 * backend/edge function is reachable.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, Paperclip, RefreshCw, UploadCloud } from 'lucide-react';
import { analyzeStandaloneAttachment, buildEmailAnalysis, parseEmlFile, parseMsgFile, parseTextInput } from '../lib/forensics';

/* ---------------------------------------------------------------- score ring */
export function ScoreMeter({ score, label, status }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const color = s >= 70 ? '#ff5c6c' : s >= 40 ? '#f7ce46' : s >= 20 ? '#8fd3ff' : '#7ee2a8';
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  return (
    <div className="scoremeter">
      <svg viewBox="0 0 130 130" width="130" height="130" aria-label={`risk score ${s} of 100`}>
        <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
        <circle
          cx="65" cy="65" r={radius} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${(s / 100) * circ} ${circ}`} transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.4s' }}
        />
        <text x="65" y="62" textAnchor="middle" fill="#fff" fontSize="30" fontWeight="800" fontFamily="var(--font-mono)">{s}</text>
        <text x="65" y="82" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="var(--font-mono)">/ 100</text>
      </svg>
      <div className="scoremeter__label" style={{ color }}>{label || status || (s >= 70 ? 'HIGH RISK' : s >= 40 ? 'REVIEW' : s >= 20 ? 'LOW SUSPICION' : 'NO MARKERS')}</div>
    </div>
  );
}

function SignalList({ signals, max = 12 }) {
  if (!signals?.length) {
    return <div className="scorecard__none"><CheckCircle2 size={12} /> No structural warning — not a verdict of safety.</div>;
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

/* ---------------------------------------------------------------- EML scorer */
export function EmlScoreApp() {
  const [busy, setBusy] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [apiNote, setApiNote] = React.useState('');

  const analyze = async (file) => {
    setBusy(true); setErr(''); setApiNote('');
    try {
      const lower = file.name.toLowerCase();
      const parsed = lower.endsWith('.msg') ? await parseMsgFile(file) : await parseEmlFile(file);
      const report = await buildEmailAnalysis(parsed);
      setData(report);
      // optional Threat-Lab deep pass (link/attachment engines) when reachable
      try {
        const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(',')[1]);
          r.onerror = () => rej(new Error('read failed'));
          r.readAsDataURL(file);
        });
        const resp = await fetch(`${base}/api/v1/sandbox/lab/auto-triage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eml_b64: b64 }),
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
  };

  return (
    <div className="scoreapp">
      <div className="scoreapp__head">
        <FileSearch size={15} />
        <div>
          <strong>EML / MSG Scorer</strong>
          <span>full message triage — headers, auth, body signals, links &amp; attachments</span>
        </div>
      </div>
      {!data && <FileDrop accept=".eml,.msg" hint="Drop an .eml or .msg email file" onFile={analyze} busy={busy} />}
      {err && <div className="scorecard__err">{err}</div>}
      {data && (
        <>
          <div className="scorecard">
            <ScoreMeter score={data.threat?.risk_score} status={data.threat?.status} />
            <div className="scorecard__meta">
              <div><span>case</span><b>{data.case_id}</b></div>
              <div><span>format</span><b>{data.format_type}</b></div>
              <div><span>category</span><b>{data.category_analysis?.category_label || '—'}</b></div>
              <div><span>from</span><b>{data.parsed?.sender || '—'}</b></div>
              <div><span>subject</span><b>{data.parsed?.subject || '—'}</b></div>
              <div><span>sha256</span><b className="mono">{(data.evidence?.sha256 || '').slice(0, 24)}…</b></div>
            </div>
          </div>
          <div className="scorecard__row">
            <div className="scorecard__block">
              <h4>Threat signals</h4>
              <SignalList signals={data.threat?.signals?.map((s) => s.label || s)} />
            </div>
            <div className="scorecard__block">
              <h4>Header findings</h4>
              <SignalList signals={data.header_findings} max={6} />
            </div>
          </div>
          <div className="scorecard__row">
            <div className="scorecard__block">
              <h4>Links ({data.aitm_analysis?.length || 0})</h4>
              {(data.aitm_analysis || []).slice(0, 8).map((u) => <div className="chip-url mono" key={u}>{u}</div>)}
              {!data.aitm_analysis?.length && <div className="scorecard__none">no URL extracted</div>}
            </div>
            <div className="scorecard__block">
              <h4>Attachments ({data.attachment_analysis?.length || 0})</h4>
              {(data.attachment_analysis || []).slice(0, 8).map((a) => (
                <div className="chip-att" key={a.sha256 || a.filename}>
                  <Paperclip size={10} /> {a.filename}
                  <b>{a.risk_score ?? 0}</b>
                </div>
              ))}
              {!data.attachment_analysis?.length && <div className="scorecard__none">no attachment</div>}
            </div>
          </div>
          {data.lab_triage && (
            <div className="scorecard__block">
              <h4>Threat-Lab deep pass</h4>
              <SignalList signals={data.lab_triage.summary || []} max={10} />
            </div>
          )}
          {apiNote && <div className="scorecard__note">{apiNote}</div>}
          <button type="button" className="btn btn--xs" onClick={() => setData(null)}><RefreshCw size={10} /> Analyse another</button>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- content scorer */
const CONTENT_LEXICON = [
  [/\b(urgent|immediately|within\s+\d+\s+hours?|expires?\s+(today|soon)|suspend(ed)?|locked)\b/gi, 'urgency / account-suspension pressure', 12],
  [/\b(wire\s+transfer|rtgs|neft|swift|iban|beneficiary|payment\s+details|gift\s+cards?)\b/gi, 'payment / wire-transfer language', 15],
  [/\b(verify\s+your\s+(account|password|identity)|confirm\s+your\s+(password|details)|update\s+your\s+(account|billing))\b/gi, 'credential verification lure', 18],
  [/\b(dear\s+(customer|user|sir|madam)|your\s+account\s+will\s+be\s+(closed|suspended))\b/gi, 'generic impersonation phrasing', 10],
  [/\b(confidential|do\s+not\s+tell|keep\s+this\s+(secret|between)|discreet(ly)?)\b/gi, 'secrecy / BEC isolation request', 15],
  [/(https?:\/\/)?[^\s]+\.(tk|ml|ga|cf|gq|xyz|top|icu|click|link|live|site|club|work|buzz)\b/gi, 'budget / abuse-prone link TLD', 12],
  [/\b(bit\.ly|tinyurl|goo\.gl|t\.co|is\.gd|rb\.gy)\b/gi, 'URL shortener (hides destination)', 10],
  [/<script|javascript:|onerror\s*=|<iframe|document\.write|unescape\(|atob\(/gi, 'obfuscated / active web content', 15],
  [/\b(password|otp|one[- ]time\s+pass|cvv|aadhaar|pan\s+card|credit\s+card\s+number)\b/gi, 'sensitive credential request', 12],
  [/\b(invoice|payment\s+overdue|outstanding\s+(balance|payment)|pending\s+transaction)\b/gi, 'invoice / payment-bait theme', 8],
];

export function ContentLabApp() {
  const [text, setText] = React.useState('');
  const [result, setResult] = React.useState(null);

  const analyse = () => {
    const body = text || '';
    const signals = [];
    let score = 0;
    for (const [pattern, label, points] of CONTENT_LEXICON) {
      const matches = body.match(pattern);
      if (matches) {
        score += Math.min(points * 2, points * matches.length);
        signals.push(`${label} ×${matches.length}`);
      }
    }
    const urls = [...new Set(body.match(/https?:\/\/[^\s"'<>]+/gi) || [])];
    const emails = [...new Set(body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])];
    const ips = [...new Set(body.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [])];
    if (urls.length) { score += 10; signals.push(`${urls.length} link(s) embedded`); }
    if (emails.length > 3) { score += 8; signals.push(`${emails.length} addresses referenced`); }
    if (body.length > 40 && body.length < 40) signals.push('unusually short message');
    setResult({
      score: Math.min(100, score),
      signals, urls, emails, ips,
      words: body.trim() ? body.trim().split(/\s+/).length : 0,
    });
  };

  return (
    <div className="scoreapp">
      <div className="scoreapp__head">
        <FileSearch size={15} />
        <div>
          <strong>Content Lab</strong>
          <span>paste email body / text / HTML — get a threat score with evidence</span>
        </div>
      </div>
      <textarea
        className="scoreapp__text"
        rows={9}
        placeholder="Paste the suspicious content here (email body, chat, SMS, web page source)…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="scoreapp__actions">
        <button type="button" className="btn btn--primary btn--xs" onClick={analyse} disabled={!text.trim()}>
          <FileSearch size={10} /> Score content
        </button>
        <button type="button" className="btn btn--xs" onClick={() => { setText(''); setResult(null); }}>Clear</button>
      </div>
      {result && (
        <>
          <div className="scorecard">
            <ScoreMeter score={result.score} />
            <div className="scorecard__meta">
              <div><span>words</span><b>{result.words}</b></div>
              <div><span>links</span><b>{result.urls.length}</b></div>
              <div><span>addresses</span><b>{result.emails.length}</b></div>
              <div><span>raw IPs</span><b>{result.ips.length}</b></div>
            </div>
          </div>
          <div className="scorecard__block">
            <h4>Why this score</h4>
            <SignalList signals={result.signals} />
          </div>
          {!!result.urls.length && (
            <div className="scorecard__block">
              <h4>Links found</h4>
              {result.urls.slice(0, 10).map((u) => <div className="chip-url mono" key={u}>{u}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- attachment scorer */
export function AttachLabApp() {
  const [busy, setBusy] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [apiNote, setApiNote] = React.useState('');

  const analyze = async (file) => {
    setBusy(true); setErr(''); setApiNote('');
    try {
      const report = await analyzeStandaloneAttachment(file);
      setData(report);
      try {
        const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(',')[1]);
          r.onerror = () => rej(new Error('read failed'));
          r.readAsDataURL(file);
        });
        const resp = await fetch(`${base}/api/v1/sandbox/lab/attachment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, file_b64: b64 }),
        });
        if (resp.ok) {
          const deep = await resp.json();
          setData((prev) => ({ ...prev, lab_deep: deep }));
          setApiNote(`Threat-Lab deep engine: risk ${deep.risk_score}/100 — ${deep.verdict}`);
        } else {
          setApiNote('Threat-Lab API offline — score is local-browser static check only.');
        }
      } catch {
        setApiNote('Threat-Lab API unreachable — score is local-browser static check only.');
      }
    } catch (e) {
      setErr(e?.message || 'could not analyse the file');
      setData(null);
    } finally {
      setBusy(false);
    }
  };

  const att = data?.attachment_analysis?.[0];

  return (
    <div className="scoreapp">
      <div className="scoreapp__head">
        <Paperclip size={15} />
        <div>
          <strong>Attachment Lab</strong>
          <span>drop any attachment — magic bytes, entropy, macros, embedded IOCs → direct score</span>
        </div>
      </div>
      {!data && <FileDrop accept="*" hint="Drop an attachment to score it" onFile={analyze} busy={busy} />}
      {err && <div className="scorecard__err">{err}</div>}
      {data && att && (
        <>
          <div className="scorecard">
            <ScoreMeter score={att.risk_score} label={att.risk_level === 'HIGH' ? 'HIGH RISK' : att.risk_level === 'MEDIUM' ? 'REVIEW' : 'NO MARKERS'} />
            <div className="scorecard__meta">
              <div><span>file</span><b>{att.filename}</b></div>
              <div><span>type</span><b>{att.detected_type || '—'}</b></div>
              <div><span>size</span><b>{att.size_bytes?.toLocaleString()} bytes</b></div>
              <div><span>entropy</span><b>{(att.entropy ?? att.shannon_entropy ?? 0).toFixed?.(2) ?? att.entropy}</b></div>
              <div><span>sha256</span><b className="mono">{(att.sha256 || '').slice(0, 24)}…</b></div>
              <div><span>magic</span><b className="mono">{att.magic_bytes || '—'}</b></div>
            </div>
          </div>
          <div className="scorecard__block">
            <h4>Findings</h4>
            <SignalList signals={att.findings} max={14} />
          </div>
          {data.lab_deep && (
            <div className="scorecard__block">
              <h4>Threat-Lab deep engine</h4>
              <SignalList signals={data.lab_deep.findings || []} max={10} />
            </div>
          )}
          {apiNote && <div className="scorecard__note">{apiNote}</div>}
          <button type="button" className="btn btn--xs" onClick={() => setData(null)}><RefreshCw size={10} /> Analyse another</button>
        </>
      )}
    </div>
  );
}
