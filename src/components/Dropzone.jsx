import React, { useRef, useState } from 'react';
import { FileText, FileUp, Mail, MessageSquareText, Paperclip, Play, ShieldAlert } from 'lucide-react';
import { useForensicStore } from '../store/useForensicStore';

const MODES = [
  { id: 'email_file', label: 'Email file', hint: '.eml + .msg', icon: Mail },
  { id: 'text_email', label: 'Text / headers', hint: 'paste content', icon: MessageSquareText },
  { id: 'attachment_file', label: 'Attachment', hint: 'file only', icon: Paperclip },
];

const ACCEPT = {
  email_file: '.eml,.msg',
  attachment_file: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.7z,.txt,.html,.htm,.js,.vbs,.ps1,.exe,.apk',
};

export default function Dropzone() {
  const { inputMode, setInputMode, loading, error, sender, recipient, subject, body, setInputs, analyzeFile, analyzeText } = useForensicStore();
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedName, setSelectedName] = useState('');

  const pickFile = (file) => {
    if (!file) return;
    setSelectedName(file.name);
    analyzeFile(file);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    pickFile(event.dataTransfer.files?.[0]);
  };

  const mode = MODES.find((item) => item.id === inputMode) || MODES[0];
  const Icon = mode.icon;

  return (
    <section className="intake-shell" aria-labelledby="intake-title">
      <div className="eyebrow"><ShieldAlert size={14} /> Evidence intake</div>
      <div className="intake-heading">
        <div>
          <h2 id="intake-title">Choose exactly what you are analysing</h2>
          <p>Each mode uses a different evidence contract. Missing transport data is shown as unavailable—not guessed.</p>
        </div>
        <div className="mode-status"><span className="status-dot" /> Browser static analysis</div>
      </div>

      <div className="mode-tabs" role="tablist" aria-label="Analysis input type">
        {MODES.map((item) => {
          const ItemIcon = item.icon;
          const active = item.id === inputMode;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={active} className={`mode-tab ${active ? 'active' : ''}`} onClick={() => setInputMode(item.id)}>
              <ItemIcon size={16} />
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
            </button>
          );
        })}
      </div>

      {inputMode === 'text_email' ? (
        <div className="text-intake" role="tabpanel">
          <div className="form-grid">
            <label>Sender<input value={sender} onChange={(e) => setInputs(e.target.value, recipient, subject, body)} placeholder="person@example.com" /></label>
            <label>Recipient<input value={recipient} onChange={(e) => setInputs(sender, e.target.value, subject, body)} placeholder="analyst@organisation.in" /></label>
          </div>
          <label>Subject<input value={subject} onChange={(e) => setInputs(sender, recipient, e.target.value, body)} placeholder="Optional subject line" /></label>
          <label>Message or raw headers<textarea value={body} onChange={(e) => setInputs(sender, recipient, subject, e.target.value)} placeholder={'Paste body text or raw headers here…\n\nReceived: from mail.example.net (203.0.113.10)\nAuthentication-Results: example.org; dkim=pass'} rows={9} /></label>
          <div className="intake-actions"><span className="helper-text">No DNS, reputation, sandbox or geolocation lookup is performed in this browser flow.</span><button className="primary-button" type="button" onClick={analyzeText} disabled={loading || !body.trim()}><Play size={15} /> {loading ? 'Analysing…' : 'Analyse pasted input'}</button></div>
        </div>
      ) : (
        <div className={`drop-panel ${dragActive ? 'drag-active' : ''}`} role="tabpanel" onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={onDrop}>
          <div className="drop-icon"><Icon size={24} /></div>
          <h3>{inputMode === 'email_file' ? 'Drop an .eml or .msg file' : 'Drop one standalone attachment'}</h3>
          <p>{inputMode === 'email_file' ? 'EML is parsed as raw RFC-style email. MSG is parsed as an Outlook container with its own embedded metadata.' : 'The file is inspected statically. It is not executed, detonated or declared clean by this browser app.'}</p>
          <button className="primary-button" type="button" onClick={() => inputRef.current?.click()} disabled={loading}><FileUp size={15} /> {loading ? 'Analysing…' : 'Select file'}</button>
          <input ref={inputRef} type="file" accept={ACCEPT[inputMode]} hidden onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = ''; }} />
          <div className="accepted-types"><FileText size={13} /> {inputMode === 'email_file' ? '.EML · .MSG' : 'PDF · Office · images · archives · scripts · binaries'}</div>
          {selectedName && <div className="selected-file">Selected: <strong>{selectedName}</strong></div>}
        </div>
      )}

      {error && <div className="error-banner" role="alert">{error}</div>}
    </section>
  );
}
