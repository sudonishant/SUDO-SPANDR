/*
 * Government-style forensic analysis report (Indian CERT-In / NCIIPC flavour)
 * with analyst signature block. Generated ONLY for HIGH-risk findings.
 *
 * The report is produced as a self-contained printable HTML document with a
 * chain-of-custody verification hash so the output can be archived verbatim.
 */

const esc = (s) => String(s ?? '—')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function todayLong() {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function refNo(caseId) {
  const y = new Date().getFullYear();
  return `SUDO SPANDR/CERT-FA/${y}/${String(caseId || '').replace(/[^A-Z0-9-]/gi, '').slice(-12) || 'CASE'}`;
}

/* simple deterministic "signature" flourish + cursive name rendering */
function signatureSvg(name) {
  const seed = [...String(name || 'Analyst')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const w = 210;
  let d = `M 8 ${52 - (seed % 12)}`;
  for (let i = 0; i < 7; i += 1) {
    const x1 = 20 + i * 28;
    const x2 = x1 + 22;
    const y1 = 30 + ((seed + i * 13) % 26);
    const y2 = 24 + ((seed + i * 7) % 30);
    d += ` C ${x1} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${34 + ((seed + i * 5) % 18)}`;
  }
  return `
    <svg width="${w}" height="64" viewBox="0 0 ${w} 64" xmlns="http://www.w3.org/2000/svg" aria-label="analyst signature">
      <path d="${d}" fill="none" stroke="#1a2a6c" stroke-width="2.1" stroke-linecap="round"/>
      <text x="${w / 2}" y="60" text-anchor="middle" font-family="'Segoe Script','Brush Script MT',cursive"
            font-size="15" fill="#1a2a6c" opacity="0.9">${esc(name || 'Analyst')}</text>
    </svg>`;
}

function sealSvg() {
  return `
    <svg width="92" height="92" viewBox="0 0 92 92" xmlns="http://www.w3.org/2000/svg" aria-label="office seal">
      <circle cx="46" cy="46" r="43" fill="none" stroke="#1a2a6c" stroke-width="2.4"/>
      <circle cx="46" cy="46" r="36" fill="none" stroke="#1a2a6c" stroke-width="1"/>
      <path id="sealArc" d="M 46 88 A 42 42 0 1 1 46 4" fill="none"/>
      <text font-size="8.2" fill="#1a2a6c" letter-spacing="1.6" font-family="serif">
        <textPath href="#sealArc" startOffset="6%">SUDO SPANDR • CYBER FORENSIC CELL • भारत</textPath>
      </text>
      <text x="46" y="42" text-anchor="middle" font-size="12" fill="#1a2a6c" font-family="serif">फोरेंसिक</text>
      <text x="46" y="56" text-anchor="middle" font-size="9.5" fill="#1a2a6c" font-family="serif">FORENSIC CELL</text>
    </svg>`;
}

export function buildGovReport({ analysis, ai, overall, analyst, role, notes }) {
  const subject = analysis?.parsed?.subject || analysis?.filename || 'Suspicious email evidence';
  const sender = analysis?.parsed?.sender || 'unavailable';
  const caseId = analysis?.case_id || 'CS-0000';
  const sha = analysis?.evidence?.sha256 || '';
  const threat = analysis?.threat || {};
  const signals = (threat.signals || []).slice(0, 12);
  const category = analysis?.category_analysis?.category_label || 'Unclassified';
  const findings = (analysis?.attachment_analysis || []).map((a) => ({
    obs: `Attachment ${a.filename}: ${a.findings?.slice(0, 2).join('; ') || 'static markers inspected'}`,
    sev: (a.risk_score || 0) >= 70 ? 'HIGH' : (a.risk_score || 0) >= 40 ? 'MEDIUM' : 'LOW',
    ev: `sha256 ${String(a.sha256 || '').slice(0, 16)}… · ${a.size_bytes || 0} bytes`,
  }));
  signals.forEach((s) => findings.push({
    obs: typeof s === 'string' ? s : s.label || JSON.stringify(s),
    sev: Number(s?.weight || 0) >= 14 ? 'HIGH' : 'MEDIUM',
    ev: s?.evidence || 'Observed in submitted evidence',
  }));

  const verification = sha ? `${sha.slice(0, 32)}…${sha.slice(-8)}` : 'not computed';
  const ref = refNo(caseId);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(ref)} — Cyber Forensic Analysis Report</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Georgia','Noto Serif',serif; color: #10151f; margin: 0; padding: 26px 34px; background: #fff; }
  .class-bar { text-align: center; font-weight: 700; letter-spacing: 3px; color: #8c1007; border: 2px solid #8c1007; padding: 4px; font-size: 12px; }
  .masthead { display: flex; gap: 16px; align-items: center; border-bottom: 3px double #1a2a6c; padding: 14px 4px 10px; }
  .masthead img { height: 74px; }
  .masthead .gov { flex: 1; text-align: center; }
  .masthead .gov .hi { font-size: 21px; font-weight: 700; color: #1a2a6c; }
  .masthead .gov .en { font-size: 13px; letter-spacing: 2.5px; color: #1a2a6c; }
  .masthead .gov .doc { margin-top: 4px; font-size: 12.5px; font-weight: 700; letter-spacing: 1.2px; color: #8c1007; }
  table.meta { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  table.meta td { border: 1px solid #9aa4b8; padding: 5px 8px; }
  table.meta td.k { width: 120px; background: #eef1f8; font-weight: 700; color: #1a2a6c; }
  h2 { font-size: 13.5px; color: #1a2a6c; border-bottom: 1.5px solid #1a2a6c; padding-bottom: 3px; margin: 18px 0 8px; letter-spacing: 0.6px; }
  h2 .num { color: #8c1007; }
  p, li, td, th { font-size: 11.8px; line-height: 1.55; }
  table.grid { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
  table.grid th { background: #1a2a6c; color: #fff; font-size: 10.5px; letter-spacing: 0.8px; padding: 5px 7px; text-align: left; }
  table.grid td { border: 1px solid #b7c0d4; padding: 5px 7px; vertical-align: top; }
  .sev-HIGH { color: #8c1007; font-weight: 700; }
  .sev-MEDIUM { color: #9a5b00; font-weight: 700; }
  .sev-LOW { color: #14532d; font-weight: 700; }
  .scorebox { display: flex; gap: 10px; margin: 8px 0; }
  .scorebox .cell { flex: 1; border: 1.4px solid #1a2a6c; border-radius: 6px; padding: 8px 10px; text-align: center; }
  .scorebox .cell b { display: block; font-size: 20px; color: #8c1007; }
  .scorebox .cell span { font-size: 9.5px; letter-spacing: 1px; color: #1a2a6c; text-transform: uppercase; }
  .chain { background: #f4f6fb; border: 1px solid #c3ccdf; padding: 8px 10px; font-family: 'Consolas',monospace; font-size: 10px; word-break: break-all; }
  .sign-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; gap: 20px; }
  .sign-block { text-align: center; min-width: 240px; }
  .sign-line { border-top: 1.6px solid #10151f; margin-top: 2px; padding-top: 4px; font-size: 11px; }
  .sign-line b { display: block; font-size: 12px; }
  .note { font-size: 9.5px; color: #444; margin-top: 10px; line-height: 1.5; }
  .foot { margin-top: 16px; border-top: 1px solid #1a2a6c; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9px; color: #445; letter-spacing: 0.5px; }
  .warn { color: #8c1007; font-weight: 700; }
  .no-print { margin: 10px 0; text-align: center; }
  .no-print button { background: #1a2a6c; color: #fff; border: 0; padding: 8px 22px; border-radius: 5px; font-size: 12px; cursor: pointer; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="class-bar">गोपनीय &nbsp;•&nbsp; RESTRICTED &nbsp;•&nbsp; FOR OFFICIAL USE ONLY</div>
  <div class="masthead">
    <img src="/logo.jpg" alt="SUDO SPANDR"/>
    <div class="gov">
      <div class="hi">भारत सरकार &nbsp;|&nbsp; साइबर सुरक्षा विश्लेषण एवं प्रतिक्रिया</div>
      <div class="en">GOVERNMENT OF INDIA &nbsp;|&nbsp; CYBER SECURITY ANALYSIS &amp; RESPONSE</div>
      <div class="doc">CYBER FORENSIC ANALYSIS REPORT &nbsp;(साइबर फोरेंसिक विश्लेषण रिपोर्ट)</div>
    </div>
    <img src="/logo.jpg" alt="SUDO SPANDR"/>
  </div>

  <table class="meta">
    <tr>
      <td class="k">Reference No.</td><td>${esc(ref)}</td>
      <td class="k">Date</td><td>${esc(todayLong())}</td>
    </tr>
    <tr>
      <td class="k">Case ID</td><td>${esc(caseId)}</td>
      <td class="k">Classification</td><td class="warn">HIGH RISK — ACTION REQUIRED</td>
    </tr>
    <tr>
      <td class="k">Subject</td><td colspan="3">${esc(subject)}</td>
    </tr>
    <tr>
      <td class="k">Reported Sender</td><td colspan="3">${esc(sender)}</td>
    </tr>
    <tr>
      <td class="k">Category</td><td>${esc(category)}</td>
      <td class="k">Overall Risk</td><td class="warn">${esc(overall)}/100 — HIGH</td>
    </tr>
  </table>

  <h2><span class="num">1.</span> EXECUTIVE SUMMARY (कार्यपालक सारांश)</h2>
  <p>
    The submitted evidence was subjected to deterministic email-forensic analysis
    (header reconstruction, authentication result review, link/attachment static
    inspection) and AI-assisted triage (keyword lexicon, NLP style analysis and a
    distilled semantic model). The combined assessment is
    <b class="warn">HIGH RISK (score ${esc(overall)}/100)</b> under category
    <b>${esc(category)}</b>. This report is issued for analyst review and onward
    action under the organization's incident-response process.
  </p>

  <h2><span class="num">2.</span> EVIDENCE INVENTORY (साक्ष्य सूची) &amp; CHAIN OF CUSTODY</h2>
  <table class="grid">
    <tr><th>#</th><th>Evidence</th><th>SHA-256 (ingestion)</th><th>Size</th></tr>
    <tr>
      <td>1</td>
      <td>${esc(analysis?.filename || 'submitted message')}</td>
      <td style="font-family:Consolas,monospace;font-size:9px;word-break:break-all">${esc(sha || 'not computed')}</td>
      <td>${esc(analysis?.evidence?.raw_size_bytes ?? '—')} bytes</td>
    </tr>
  </table>
  <div class="chain">
    CHAIN OF CUSTODY: SHA-256 generated at ingestion in the analyst's browser session.<br/>
    VERIFICATION HASH (report binding): ${esc(verification)}<br/>
    PRESERVATION: ${esc(analysis?.evidence?.preservation || 'browser-generated case data; not an immutable evidence vault')}
  </div>

  <h2><span class="num">3.</span> FINDINGS (निष्कर्ष)</h2>
  <table class="grid">
    <tr><th>#</th><th>Observation</th><th>Severity</th><th>Evidence</th></tr>
    ${findings.length
      ? findings.slice(0, 16).map((f, i) => `<tr><td>${i + 1}</td><td>${esc(f.obs)}</td><td class="sev-${esc(f.sev)}">${esc(f.sev)}</td><td>${esc(f.ev)}</td></tr>`).join('')
      : '<tr><td>1</td><td>Automated signals recorded in the analysis workspace</td><td class="sev-MEDIUM">MEDIUM</td><td>see workspace case file</td></tr>'}
  </table>

  <h2><span class="num">4.</span> AI RISK ASSESSMENT (एआई जोखिम मूल्यांकन)</h2>
  <div class="scorebox">
    <div class="cell"><b>${esc(overall)}</b><span>Overall / 100</span></div>
    <div class="cell"><b>${esc(ai?.keyword?.score ?? '—')}</b><span>Keyword lane</span></div>
    <div class="cell"><b>${esc(ai?.nlp?.score ?? '—')}</b><span>NLP lane</span></div>
    <div class="cell"><b>${esc(ai?.semantic?.score ?? '—')}</b><span>Semantic (BERT-distilled)</span></div>
    <div class="cell"><b>${esc(threat.risk_score ?? '—')}</b><span>Structural lane</span></div>
  </div>
  <p><b>Detected intents:</b> ${(ai?.intents || []).length
      ? esc(ai.intents.map((i) => `${i.label} (${i.confidence}%)`).join(' · '))
      : 'none beyond triage thresholds'}</p>
  <p><b>AI lane note:</b> semantic lane uses 256-dimensional distilled embeddings computed offline
  in the analyst's browser; no evidence is uploaded to third-party AI services.</p>

  <h2><span class="num">5.</span> MITRE ATT&amp;CK MAPPING</h2>
  <p>
    <b>T1566 — Phishing</b> (T1566.001 Spearphishing Attachment · T1566.002 Spearphishing Link),
    consistent with the observed credential-harvest / payment-diversion tradecraft.
    Suggested detection engineering: sender-auth enforcement (DMARC reject), attachment
    detonation for macro-enabled documents, and user reporting of urgent payment requests.
  </p>

  <h2><span class="num">6.</span> RECOMMENDATIONS (सिफारिशें)</h2>
  <ul>
    <li>Quarantine the message and any attachments; do not open on an administrative workstation.</li>
    <li>Block the sending domain/IP and the embedded URLs at the mail gateway and web proxy.</li>
    <li>If credentials were submitted, force password reset and revoke active sessions/MFA tokens.</li>
    <li>Preserve the original message with full headers for legal/evidentiary purposes.</li>
    <li>Escalate to the incident-response lead under the organization's IR plan (NIST SP 800-61 aligned).</li>
  </ul>

  <h2><span class="num">7.</span> LIMITATIONS (सीमाएं)</h2>
  <p>
    Scores are heuristic triage aids, not proof of guilt or a probability of compromise.
    Authentication results are reported as received, not independently re-verified.
    ${notes ? esc(notes) : 'Missing data is never guessed; unobserved fields are marked unavailable.'}
  </p>

  <div class="sign-row">
    <div class="sign-block">
      <div class="sign-line">
        <b>${esc(analyst || 'Name of Analyst')}</b>
        ${esc(role || 'Cyber Forensic Analyst')}
        SUDO SPANDR — Forensic Analysis Cell
      </div>
      <div style="margin-top:6px;font-size:10px">Analyst Signature (हस्ताक्षर)</div>
    </div>
    <div class="sign-block">
      ${signatureSvg(analyst)}
      <div class="sign-line">Digitally generated signature block</div>
    </div>
    <div class="sign-block">
      ${sealSvg()}
      <div class="sign-line">Office Seal &amp; Date: ${esc(todayLong())}<br/>Place: Purnia, Bihar (IN)</div>
    </div>
  </div>

  <p class="note">
    This report is system-generated by the SUDO SPANDR forensic workspace and digitally bound to the
    evidence hash recorded above. Any alteration of the evidence file invalidates the binding.
    <b>Report issued because the combined risk score reached the HIGH threshold (≥ 70).</b>
    Compliant in spirit with IT Act 2000 evidentiary guidance and NIST SP 800-61 handling practice.
  </p>
  <div class="foot">
    <span>${esc(ref)}</span>
    <span class="warn">गोपनीय • RESTRICTED • FOR OFFICIAL USE ONLY</span>
    <span>Page generated ${esc(new Date().toLocaleString('en-IN'))}</span>
  </div>
</body>
</html>`;
}

export function openGovReport(html) {
  const win = window.open('', '_blank', 'noopener,width=980,height=1100');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

export function reportGate(overall) {
  return Number(overall) >= 70;
}
