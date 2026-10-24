import React from 'react';
import { FileText, FolderOpen, HardDrive, Search, TerminalSquare, FileCode2, FileWarning, ShieldCheck } from 'lucide-react';

const FS = {
  evidence: {
    label: 'Evidence',
    icon: FolderOpen,
    files: [
      { name: 'phishing-sample.eml', size: '14.2 KB', date: '2026-10-24 09:12', kind: 'eml', mode: 'email_file', accent: '#ef233c',
        body: `Return-Path: <accounts@paypa1-secure.com>\nReceived: from mail.paypa1-secure.com (203.0.113.45)\n        by mx.cybercell.gov.in with SMTP id 4f2a9c;\n        Sat, 24 Oct 2026 09:12:41 +0530\nAuthentication-Results: mx.cybercell.gov.in;\n        spf=fail smtp.mailfrom=paypa1-secure.com;\n        dkim=none; dmarc=fail action=quarantine\nFrom: "PayPal Support" <accounts@paypa1-secure.com>\nReply-To: recovery-desk@gmail.com\nTo: analyst@cybercell.gov.in\nSubject: URGENT: Your account will be suspended in 24 hours\nMessage-ID: <20261024085711.4f2a9c@paypa1-secure.com>\n\nDear customer,\nYour account will be suspended within 24 hours unless you verify.\nhttp://paypa1-secure.com/verify?id=8842&session=ae91\n\n— sample evidence, synthetic.` },
      { name: 'invoice-clean.eml', size: '4.1 KB', date: '2026-10-24 10:00', kind: 'eml', mode: 'email_file', accent: '#38d17a',
        body: `Return-Path: <billing@trusted-enterprise.com>\nReceived: from mail.trusted-enterprise.com (103.22.14.80)\n        by mx.gov.in with ESMTP id 9a1;\n        Sat, 24 Oct 2026 10:00:12 +0530\nAuthentication-Results: mx.gov.in; spf=pass; dkim=pass; dmarc=pass\nFrom: "Billing" <billing@trusted-enterprise.com>\nTo: accounts@state-agency.gov.in\nSubject: Routine Invoice & Service Summary\n\nQuarterly service summary is attached. No action required.` },
      { name: 'vendor-invoice.pdf', size: '238 KB', date: '2026-10-23 18:44', kind: 'pdf', mode: 'attachment_file', accent: '#f7ce46',
        body: `%PDF-1.7\n1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj\n2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>> endobj\n3 0 obj <</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>> endobj\ntrailer <</Size 4/Root 1 0 R>>\n%%EOF\n\n[static inspection only — the file is never executed in this tab]` },
      { name: 'headers.txt', size: '2.8 KB', date: '2026-10-22 11:03', kind: 'txt', mode: 'text_email', accent: '#8a8a92',
        body: `Received: from mail.paypa1-secure.com (203.0.113.45)\n        by mx.cybercell.gov.in with SMTP id 4f2a9c\nReceived: from unknown (198.51.100.77) by mail.paypa1-secure.com\nAuthentication-Results: mx.cybercell.gov.in; spf=fail; dkim=none; dmarc=fail\nX-Originating-IP: [203.0.113.45]` },
    ],
  },
  reports: {
    label: 'Reports',
    icon: FileCode2,
    files: [
      { name: 'case-CS-0927878F.json', size: '18.4 KB', date: '2026-10-24 18:59', kind: 'json', accent: '#57a4f0',
        body: `{\n  "case_id": "CS-0927878FF5C7",\n  "format_type": "Pasted Headers + Text",\n  "threat": { "risk_score": 95, "status": "HIGH RISK" },\n  "category_analysis": { "category_label": "Phishing / BEC", "points": 52, "confidence": 88 },\n  "dns_auth": { "spf": "REPORTED FAIL", "dkim": "REPORTED NONE", "dmarc": "REPORTED FAIL" },\n  "evidence": { "sha256": "0927878ff5c7392ce5d2d2de5132b7c072fa86db0a5545490d80784dd2e9ba05" }\n}\n\n[example shape — run an analysis to produce your own]` },
      { name: 'mitigation-draft.txt', size: '1.2 KB', date: '2026-10-24 18:59', kind: 'txt', accent: '#8a8a92',
        body: `# containment draft (not applied)\niptables -I INPUT 1 -s 203.0.113.45 -j DROP\nnft add rule inet spandr_quarantine input ip saddr 203.0.113.45 drop\n\n# review with your network owner before applying` },
    ],
  },
  system: {
    label: 'System',
    icon: HardDrive,
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

export default function FilesApp({ openFile, initialFolder = 'evidence' }) {
  const [folder, setFolder] = React.useState(initialFolder);
  const [selected, setSelected] = React.useState(null);
  const [query, setQuery] = React.useState('');

  const files = FS[folder].files.filter((file) => file.name.toLowerCase().includes(query.toLowerCase()));
  const current = selected || files[0] || null;

  return (
    <div className="files">
      <div className="files__sidebar">
        <div className="files__group">Locations</div>
        {Object.entries(FS).map(([key, value]) => {
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
              onDoubleClick={() => openFile?.(file)}
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
                <button type="button" className="btn btn--sm" onClick={() => openFile?.(current)}>Open in workspace →</button>
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

export { FS };
