import React from 'react';
import {
  Bot, Code2, FileCode2, Fingerprint, Github, Hash, Lock, Network, Paperclip, Shield, ShieldCheck, Tag,
} from 'lucide-react';

const CAPS = [
  { icon: Network, title: 'Header & relay path', copy: 'Received chain, hop order and public IPs in evidence order.' },
  { icon: ShieldCheck, title: 'Authentication reader', copy: 'SPF, DKIM, DMARC, ARC exactly as reported in the headers.' },
  { icon: Tag, title: 'Category engine', copy: 'Phishing, BEC, spam or bulk — with points and coverage.' },
  { icon: Paperclip, title: 'Attachment inspection', copy: 'Detected type, size, entropy and SHA-256 per artefact.' },
  { icon: Hash, title: 'Transparent scoring', copy: 'A 0–100 triage score with every contributor listed.' },
  { icon: Bot, title: 'AI second opinion', copy: 'Opt-in only, labelled as a model interpretation.' },
  { icon: Code2, title: 'Open API surface', copy: 'FastAPI and serverless handlers for the heavy paths.' },
  { icon: Lock, title: 'Nothing leaves the tab', copy: 'Files are parsed in the browser; sandbox calls are explicit.' },
];

export default function AboutApp({ onOpen }) {
  return (
    <div className="about">
      <div className="about__hero">
        <span className="about__mark"><Shield size={22} /></span>
        <div className="about__title">
          <h2>SUDO SPANDR</h2>
          <p>SentinelMail · deterministic email forensics · SIH 2026 · PS 26106</p>
        </div>
      </div>

      <div className="about__grid">
        {CAPS.map(({ icon: Icon, title, copy }) => (
          <div className="about__card" key={title}>
            <h4><Icon /> {title}</h4>
            <p>{copy}</p>
          </div>
        ))}
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onOpen('workspace')}><FileCode2 size={11} /> Open workspace</button>
        <button type="button" className="btn btn--sm" onClick={() => onOpen('sandbox')}><Fingerprint size={11} /> Detonate a link</button>
        <button type="button" className="btn btn--sm" onClick={() => onOpen('files')}><Paperclip size={11} /> Browse evidence</button>
        <a className="btn btn--sm" href="https://github.com/sudonishant/SUDO-SPANDR" target="_blank" rel="noreferrer"><Github size={11} /> Repository</a>
      </div>

      <div className="about__foot">
        <span>MIT licensed · build 4.0.0 · {new Date().getFullYear()}</span>
        <span>Missing data is never replaced with a guess.</span>
      </div>
    </div>
  );
}
