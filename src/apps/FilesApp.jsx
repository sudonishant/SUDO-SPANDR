import React from 'react';
import { FileText, FolderOpen, HardDrive, Paperclip, Search, TerminalSquare, FileCode2, ShieldCheck, Mail, Bug, Beaker } from 'lucide-react';

/*
 * File manager with a bundled sample corpus:
 *  · EML samples / MSG samples          → open in EML-MSG Scorer
 *  · Email text — risk / safe           → open in Content Lab
 *  · Attachments                        → open in Attachment Lab
 * Real sample bytes live under /samples/ (public/samples) and are fetched
 * into the scorer apps via the 'spandr:analyze' event bus.
 */

const SAMPLE_META = {
  '/samples/sample-phishing.eml': { mode: 'email_file', target: 'eml', preview: 'BEC phishing .eml — MD impersonation, wire-transfer lure, macro attachment (base64 part).\n\nFrom: "Managing Director" <ceo.office@corp-secure-mail.com>\nSubject: URGENT: Payment approval needed before 3 PM\n\n… MIME part: payment-sheet.doc (base64 attachment) …\n\n[sample evidence — synthetic]' },
  '/samples/sample-credential.eml': { mode: 'email_file', target: 'eml', preview: 'Credential phishing .eml — fake Microsoft account alert, look-alike domain.\n\nFrom: "Microsoft Account Security" <no-reply@microsft-account-verify.com>\nSubject: Unusual sign-in activity - verify your account now\n\n[sample evidence — synthetic]' },
  '/samples/sample-safe.eml': { mode: 'email_file', target: 'eml', preview: 'Safe newsletter .eml — SPF/DKIM/DMARC pass, routine maintenance notice.\n\nFrom: "Monthly Newsletter" <newsletter@trusted-enterprise.com>\nSubject: October edition - office maintenance schedule\n\n[sample evidence — synthetic]' },
  '/samples/sample-phishing.msg': { mode: 'email_file', target: 'eml', preview: 'Outlook MSG (binary OLE) — account-suspension phishing, credential-harvest link.\n\nFrom: "PayPal Security" <accounts@paypa1-secure.com>\nSubject: URGENT: Your account will be suspended in 24 hours\n\n[real .msg container — parse with the MSG reader]' },
  '/samples/sample-safe.msg': { mode: 'email_file', target: 'eml', preview: 'Outlook MSG (binary OLE) — routine IT maintenance notice, no lures.\n\nFrom: "Internal IT Helpdesk" <newsletter@trusted-enterprise.com>\nSubject: Monthly IT maintenance notice - October\n\n[real .msg container — parse with the MSG reader]' },
  '/samples/email-text/risk/bec-wire-transfer.txt': { mode: 'text_email', target: 'content', preview: 'BEC text sample — payment diversion with updated bank details.' },
  '/samples/email-text/risk/otp-credential-scam.txt': { mode: 'text_email', target: 'content', preview: 'Credential-phishing text sample — OTP + password harvest.' },
  '/samples/email-text/risk/extortion-sextortion.txt': { mode: 'text_email', target: 'content', preview: 'Extortion text sample — bitcoin demand with threats.' },
  '/samples/email-text/safe/maintenance-notice.txt': { mode: 'text_email', target: 'content', preview: 'Benign text sample — routine maintenance notice.' },
  '/samples/email-text/safe/meeting-invite.txt': { mode: 'text_email', target: 'content', preview: 'Benign text sample — meeting invite.' },
  '/samples/email-text/safe/quarterly-report.txt': { mode: 'text_email', target: 'content', preview: 'Benign text sample — quarterly report note.' },
  '/samples/attachments/invoice.pdf.exe': { mode: 'attachment_file', target: 'attach', preview: 'Executable with document-looking double extension (MZ magic).' },
  '/samples/attachments/macro-invoice.doc': { mode: 'attachment_file', target: 'attach', preview: 'OLE document sample with macro markers (AutoOpen/Shell strings).' },
  '/samples/attachments/order-details.js': { mode: 'attachment_file', target: 'attach', preview: 'JavaScript dropper-style sample (WScript.Shell + encoded command).' },
  '/samples/attachments/order-sheet.html': { mode: 'attachment_file', target: 'attach', preview: 'HTML sample with script redirect + phishing link.' },
  '/samples/attachments/clean-summary.txt': { mode: 'attachment_file', target: 'attach', preview: 'Clean text file — baseline for the attachment lab.' },
};

function sampleEntry(name, src, kind, size, accent) {
  const meta = SAMPLE_META[src] || { mode: 'attachment_file', target: 'attach', preview: 'sample file' };
  return {
    name, size, date: '2026-10-24 00:00', kind, accent,
    mode: meta.mode, target: meta.target, src,
    body: meta.preview,
  };
}

const FS = {
  samples_eml: {
    label: 'EML Samples', icon: Mail,
    files: [
      sampleEntry('sample-phishing.eml', '/samples/sample-phishing.eml', 'eml', '1.4 KB', '#ef233c'),
      sampleEntry('sample-credential.eml', '/samples/sample-credential.eml', 'eml', '1.0 KB', '#f7ce46'),
      sampleEntry('sample-safe.eml', '/samples/sample-safe.eml', 'eml', '719 B', '#38d17a'),
    ],
  },
  samples_msg: {
    label: 'MSG Samples', icon: Beaker,
    files: [
      sampleEntry('sample-phishing.msg', '/samples/sample-phishing.msg', 'msg', '5.1 KB', '#ef233c'),
      sampleEntry('sample-safe.msg', '/samples/sample-safe.msg', 'msg', '4.6 KB', '#38d17a'),
    ],
  },
  email_text_risk: {
    label: 'Email Text — Risk', icon: Bug,
    files: [
      sampleEntry('bec-wire-transfer.txt', '/samples/email-text/risk/bec-wire-transfer.txt', 'txt', '0.7 KB', '#ef233c'),
      sampleEntry('otp-credential-scam.txt', '/samples/email-text/risk/otp-credential-scam.txt', 'txt', '0.7 KB', '#ef233c'),
      sampleEntry('extortion-sextortion.txt', '/samples/email-text/risk/extortion-sextortion.txt', 'txt', '0.5 KB', '#ef233c'),
    ],
  },
  email_text_safe: {
    label: 'Email Text — Safe', icon: ShieldCheck,
    files: [
      sampleEntry('maintenance-notice.txt', '/samples/email-text/safe/maintenance-notice.txt', 'txt', '0.4 KB', '#38d17a'),
      sampleEntry('meeting-invite.txt', '/samples/email-text/safe/meeting-invite.txt', 'txt', '0.4 KB', '#38d17a'),
      sampleEntry('quarterly-report.txt', '/samples/email-text/safe/quarterly-report.txt', 'txt', '0.3 KB', '#38d17a'),
    ],
  },
  attachments: {
    label: 'Attachments', icon: Paperclip,
    files: [
      sampleEntry('invoice.pdf.exe', '/samples/attachments/invoice.pdf.exe', 'exe', '83 B', '#ef233c'),
      sampleEntry('macro-invoice.doc', '/samples/attachments/macro-invoice.doc', 'doc', '0.6 KB', '#f7ce46'),
      sampleEntry('order-details.js', '/samples/attachments/order-details.js', 'js', '0.3 KB', '#f7ce46'),
      sampleEntry('order-sheet.html', '/samples/attachments/order-sheet.html', 'html', '0.2 KB', '#f7ce46'),
      sampleEntry('clean-summary.txt', '/samples/attachments/clean-summary.txt', 'txt', '0.1 KB', '#38d17a'),
    ],
  },
  evidence: {
    label: 'Evidence', icon: FolderOpen,
    files: [
      { name: 'phishing-sample.eml', size: '14.2 KB', date: '2026-10-24 09:12', kind: 'eml', mode: 'email_file', target: 'eml', accent: '#ef233c',
        body: `Return-Path: <accounts@paypa1-secure.com>\nReceived: from mail.paypa1-secure.com (203.0.113.45)\n        by mx.cybercell.gov.in with SMTP id 4f2a9c;\n        Sat, 24 Oct 2026 09:12:41 +0530\nAuthentication-Results: mx.cybercell.gov.in;\n        spf=fail smtp.mailfrom=paypa1-secure.com;\n        dkim=none; dmarc=fail action=quarantine\nFrom: "PayPal Support" <accounts@paypa1-secure.com>\nReply-To: recovery-desk@gmail.com\nTo: analyst@cybercell.gov.in\nSubject: URGENT: Your account will be suspended in 24 hours\nMessage-ID: <20261024085711.4f2a9c@paypa1-secure.com>\n\nDear customer,\nYour account will be suspended within 24 hours unless you verify.\nhttp://paypa1-secure.com/verify?id=8842&session=ae91\n\n— sample evidence, synthetic.` },
      { name: 'invoice-clean.eml', size: '4.1 KB', date: '2026-10-24 10:00', kind: 'eml', mode: 'email_file', target: 'eml', accent: '#38d17a',
        body: `Return-Path: <billing@trusted-enterprise.com>\nReceived: from mail.trusted-enterprise.com (103.22.14.80)\n        by mx.gov.in with ESMTP id 9a1;\n        Sat, 24 Oct 2026 10:00:12 +0530\nAuthentication-Results: mx.gov.in; spf=pass; dkim=pass; dmarc=pass\nFrom: "Billing" <billing@trusted-enterprise.com>\nTo: accounts@state-agency.gov.in\nSubject: Routine Invoice & Service Summary\n\nQuarterly service summary is attached. No action required.` },
      { name: 'vendor-invoice.pdf', size: '238 KB', date: '2026-10-23 18:44', kind: 'pdf', mode: 'attachment_file', target: 'attach', accent: '#f7ce46',
        body: `%PDF-1.7\n1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj\n2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>> endobj\n3 0 obj <</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>> endobj\ntrailer <</Size 4/Root 1 0 R>>\n%%EOF\n\n[static inspection only — the file is never executed in this tab]` },
      { name: 'headers.txt', size: '2.8 KB', date: '2026-10-22 11:03', kind: 'txt', mode: 'text_email', target: 'content', accent: '#8a8a92',
        body: `Received: from mail.paypa1-secure.com (203.0.113.45)\n        by mx.cybercell.gov.in with SMTP id 4f2a9c\nReceived: from unknown (198.51.100.77) by mail.paypa1-secure.com\nAuthentication-Results: mx.cybercell.gov.in; spf=fail; dkim=none; dmarc=fail\nX-Originating-IP: [203.0.113.45]` },
    ],
  },
  reports: {
    label: 'Reports', icon: FileCode2,
    files: [
      { name: 'case-CS-0927878F.json', size: '18.4 KB', date: '2026-10-24 18:59', kind: 'json', accent: '#57a4f0',
        body: `{\n  "case_id": "CS-0927878FF5C7",\n  "format_type": "Pasted Headers + Text",\n  "threat": { "risk_score": 95, "status": "HIGH RISK" },\n  "category_analysis": { "category_label": "Phishing / BEC", "points": 52, "confidence": 88 },\n  "dns_auth": { "spf": "REPORTED FAIL", "dkim": "REPORTED NONE", "dmarc": "REPORTED FAIL" },\n  "evidence": { "sha256": "0927878ff5c7392ce5d2d2de5132b7c072fa86db0a5545490d80784dd2e9ba05" }\n}\n\n[example shape — run an analysis to produce your own]` },
      { name: 'mitigation-draft.txt', size: '1.2 KB', date: '2026-10-24 18:59', kind: 'txt', accent: '#8a8a92',
        body: `# containment draft (not applied)\niptables -I INPUT 1 -s 203.0.113.45 -j DROP\nnft add rule inet spandr_quarantine input ip saddr 203.0.113.45 drop\n\n# review with your network owner before applying` },
    ],
  },
  system: {
    label: 'System', icon: HardDrive,
    files: [
      { name: 'README.md', size: '26.7 KB', date: '2026-10-24 19:20', kind: 'md', accent: '#a1a1aa',
        body: `# SUDO SPANDR — SentinelMail\n\nDeterministic email forensics for analysts.\n\n- intake: .eml, .msg, pasted headers, single attachment\n- browser parses locally, no upload\n- every panel reports what it observed, or says unavailable\n\nDocs: https://github.com/sudonishant/SUDO-SPANDR#readme` },
      { name: 'docker-compose.yml', size: '617 B', date: '2026-10-24 19:20', kind: 'yml', accent: '#a1a1aa',
        body: `services:\n  web-app:\n    build: { context: ., dockerfile: Dockerfile }\n    ports: ["8000:8000"]\n  isolated-sandbox:\n    build: { context: ., dockerfile: Dockerfile.sandbox }\n    ports: ["7860:7860"]` },
      { name: 'LICENSE', size: '1.1 KB', date: '2026-09-01 00:00', kind: 'txt', accent: '#8a8a92',
        body: 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software")…' },
    ],
  },
};

async function openSampleInScorer(file, openFile) {
  if (file.src) {
    try {
      const resp = await fetch(file.src);
      const blob = await resp.blob();
      const realFile = new File([blob], file.name, { type: blob.type || 'application/octet-stream' });
      let text = null;
      if (file.mode === 'text_email') text = await blob.text();
      window.dispatchEvent(new CustomEvent('spandr:analyze', { detail: { file: realFile, kind: file.mode, text } }));
      openFile?.({ kind: 'scorer', target: file.target });
      return;
    } catch {
      // fall through to preview-based open
    }
  }
  if (file.mode === 'text_email') {
    window.dispatchEvent(new CustomEvent('spandr:analyze', { detail: { file: null, kind: 'text_email', text: file.body } }));
    openFile?.({ kind: 'scorer', target: 'content' });
    return;
  }
  // inline evidence samples: synthesise a File from the preview body
  const realFile = new File([file.body || ''], file.name, { type: 'message/rfc822' });
  window.dispatchEvent(new CustomEvent('spandr:analyze', { detail: { file: realFile, kind: file.mode || 'email_file' } }));
  openFile?.({ kind: 'scorer', target: file.target || (file.mode === 'attachment_file' ? 'attach' : 'eml') });
}

export default function FilesApp({ openFile, initialFolder = 'samples_eml' }) {
  const [folder, setFolder] = React.useState(initialFolder);
  const [selected, setSelected] = React.useState(null);
  const [query, setQuery] = React.useState('');

  const files = FS[folder].files.filter((file) => file.name.toLowerCase().includes(query.toLowerCase()));
  const current = selected || files[0] || null;

  return (
    <div className="files">
      <div className="files__sidebar">
        <div className="files__group">Sample corpus</div>
        {Object.entries(FS).slice(0, 5).map(([key, value]) => {
          const Icon = value.icon;
          return (
            <button
              key={key}
              type="button"
              className={`files__nav ${folder === key ? 'is-active' : ''}`}
              onClick={() => { setFolder(key); setSelected(null); }}
            >
              <Icon /> {value.label}
              <span className="count">{value.files.length}</span>
            </button>
          );
        })}
        <div className="files__group">Locations</div>
        {Object.entries(FS).slice(5).map(([key, value]) => {
          const Icon = value.icon;
          return (
            <button
              key={key}
              type="button"
              className={`files__nav ${folder === key ? 'is-active' : ''}`}
              onClick={() => { setFolder(key); setSelected(null); }}
            >
              <Icon /> {value.label}
              <span className="count">{value.files.length}</span>
            </button>
          );
        })}
        <div className="files__group">System</div>
        <button type="button" className="files__nav" onClick={() => openFile?.({ kind: 'terminal' })}><TerminalSquare /> Terminal</button>
        <button type="button" className="files__nav" onClick={() => openFile?.({ kind: 'about' })}><ShieldCheck /> About</button>
      </div>

      <div className="files__main">
        <div className="files__bar">
          <Search size={12} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files"
            style={{ background: 'none', border: 0, outline: 'none', flex: '1 1 auto', fontSize: '10.5px', color: 'inherit' }}
          />
          <strong>{FS[folder].label}</strong>
          <span>{files.length} items</span>
        </div>

        <div className="files__list">
          {files.map((file) => (
            <button
              key={file.name}
              type="button"
              className={`file-row ${current?.name === file.name ? 'is-selected' : ''}`}
              onClick={() => setSelected(file)}
              onDoubleClick={() => openSampleInScorer(file, openFile)}
            >
              <span className="file-row__icon" style={{ '--doc-accent': file.accent }}>{file.kind.toUpperCase().slice(0, 4)}</span>
              <span className="file-row__name">{file.name}</span>
              <span className="file-row__size">{file.size}</span>
              <span className="file-row__date">{file.date.slice(5, 16)}</span>
            </button>
          ))}
          {!files.length && <div className="empty-panel">No file matches “{query}”.</div>}
        </div>

        {current && (
          <div className="files__preview">
            <div className="files__preview-head">
              <FileText size={12} style={{ color: '#ff97a3' }} />
              <strong>{current.name}</strong>
              <span className="chip">{current.kind.toUpperCase()} · {current.size}</span>
              {current.mode ? (
                <button type="button" className="btn btn--sm" onClick={() => openSampleInScorer(current, openFile)}>
                  {current.target === 'attach' ? 'Analyze in Attachment Lab →' : current.target === 'content' ? 'Score in Content Lab →' : 'Score in EML/MSG Scorer →'}
                </button>
              ) : (
                <button type="button" className="btn btn--sm" onClick={() => openFile?.({ kind: 'dossier' })}>Open dossier →</button>
              )}
            </div>
            <pre>{current.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
