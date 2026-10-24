import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Award, BadgeCheck, BookOpen, Bot, Boxes,
  CalendarDays, Check, CheckCircle2, ChevronRight, CircleDot, CloudRain, CloudSun, Code2, Cpu,
  Database, Download, FileCheck2, FileCode2, FileSearch, FileText, Fingerprint, Github, Globe,
  Hash, Info, KeyRound, LayoutDashboard, Link2, Lock, Mail, MapPin, MessageSquareText, Music,
  Network, Paperclip, Play, RefreshCw, Route, ScanLine, ScrollText, Search, Shield, ShieldAlert,
  ShieldCheck, Sparkles, Sun, Tag, Terminal, XCircle,
} from 'lucide-react';
import Dropzone from './components/Dropzone';
import { useForensicStore } from './store/useForensicStore';

const REPO_URL = 'https://github.com/sudonishant/SUDO-SPANDR';

/* ------------------------------------------------------------------ utils */

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('.reveal'));
    if (!nodes.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

/* ------------------------------------------------------------- desktop UI */

function ClockWidget() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = now.getSeconds();
  const minutes = now.getMinutes();
  const hours = now.getHours() % 12;
  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = hours * 30 + minutes * 0.5;
  return (
    <div className="widget widget--clock">
      <div className="clock" aria-label="Local time">
        <span className="clock__label">LOCAL</span>
        {Array.from({ length: 12 }).map((_, index) => (
          <span key={index} className="clock__tick" style={{ transform: `translate(-50%, 0) rotate(${index * 30}deg)`, top: '8px' }} />
        ))}
        <span className="clock__hand clock__hand--hour" style={{ transform: `translateX(-50%) rotate(${hourDeg}deg)` }} />
        <span className="clock__hand clock__hand--minute" style={{ transform: `translateX(-50%) rotate(${minuteDeg}deg)` }} />
        <span className="clock__hand clock__hand--second" style={{ transform: `translateX(-50%) rotate(${secondDeg}deg)` }} />
        <span className="clock__pin" />
      </div>
    </div>
  );
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function CalendarWidget() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  return (
    <div className="widget widget--calendar">
      <div className="cal__head">
        {today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()} · {today.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
      </div>
      <div className="cal__day">{today.getDate()}</div>
      <div className="cal__grid">
        {DOW.map((d, i) => <span key={`dow-${i}`} className="is-dow">{d}</span>)}
        {cells.map((day, index) => (
          <span
            key={`cell-${index}`}
            className={day === null ? 'is-other' : day === today.getDate() ? 'is-today' : ''}
          >
            {day === null ? '' : day}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlayerWidget() {
  return (
    <div className="widget widget--player">
      <div className="player__row">
        <div className="player__cover" aria-hidden="true" />
        <div>
          <div className="player__title">Chain of Custody</div>
          <div className="player__meta">SentinelMail — Evidence Session 77</div>
        </div>
      </div>
      <div className="player__controls">
        <button type="button" aria-label="Previous"><ScanLine size={13} /></button>
        <button type="button" aria-label="Play"><Play size={17} /></button>
        <button type="button" aria-label="Next"><Music size={13} /></button>
      </div>
      <div className="player__bar"><i /></div>
      <div className="player__time"><span>0:00</span><span>4:18</span></div>
    </div>
  );
}

const FORECAST = [
  { day: 'We', icon: Sun, temp: '31°' },
  { day: 'Th', icon: Sun, temp: '33°' },
  { day: 'Fr', icon: CloudSun, temp: '29°' },
  { day: 'Sa', icon: CloudRain, temp: '28°' },
  { day: 'Su', icon: Sun, temp: '30°' },
  { day: 'Mo', icon: CloudSun, temp: '32°' },
  { day: 'Tu', icon: CloudSun, temp: '27°' },
];

function WeatherWidget() {
  return (
    <div className="widget widget--weather">
      <div className="weather__head">
        <span className="weather__city">Patna, IN</span>
        <span className="weather__range">workstation · local</span>
      </div>
      <div className="weather__days">
        {FORECAST.map(({ day, icon: Icon, temp }, index) => (
          <div className={`weather__day ${index === 3 ? 'is-now' : ''}`} key={day}>
            <span>{day}</span>
            <Icon size={13} color="rgba(0,0,0,0.45)" />
            <b>{temp}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoteWidget() {
  return (
    <div className="note">
      <b>Redaction on</b>
      Personal data is masked before anything leaves the tab.
      <div style={{ marginTop: 6 }}><code>victim@ → v•••@</code></div>
    </div>
  );
}

function EvidenceCard() {
  const rows = [
    ['from', <span key="f">v<span className="selfie__redact">ictim</span>@bank.co</span>, ''],
    ['subject', 'URGENT: verify', 'amber'],
    ['spf', 'pass', 'green'],
    ['dkim', 'fail', 'red'],
    ['dmarc', 'none', 'amber'],
  ];
  return (
    <div className="widget widget--selfie">
      <div className="selfie">
        <div className="selfie__grain" />
        <div className="selfie__head">
          <i /><i /><i />
        </div>
        {rows.map(([label, value, tone]) => (
          <div className="selfie__line" key={label}>
            <span>{label}</span>
            <b className={tone}>{value}</b>
          </div>
        ))}
        <span className="selfie__tag">REDACTED VIEW</span>
      </div>
    </div>
  );
}

function AppCluster() {
  const tiles = [
    { label: 'Workspace', icon: Terminal, bg: 'linear-gradient(160deg,#3a3a3a,#141414)', id: 'workspace' },
    { label: 'Capabilities', icon: LayoutDashboard, bg: 'linear-gradient(160deg,#7cc0ff,#2e7cf6)', id: 'capabilities' },
    { label: 'Playbooks', icon: BookOpen, bg: 'linear-gradient(160deg,#a583f5,#6d3bd6)', id: 'playbooks' },
    { label: 'Achievements', icon: Award, bg: 'linear-gradient(160deg,#ffdf74,#f0a91c)', id: 'achievements' },
    { label: 'Signature', icon: ScrollText, bg: 'linear-gradient(160deg,#63e08a,#18a34a)', id: 'signature' },
    { label: 'API', icon: Code2, bg: 'linear-gradient(160deg,#4a4a4a,#0f0f0f)', id: 'signature' },
    { label: 'GitHub', icon: Github, bg: 'linear-gradient(160deg,#2f2f2f,#000000)', href: REPO_URL },
    { label: 'Email', icon: Mail, bg: 'linear-gradient(160deg,#ff8a7a,#e4392f)', href: 'mailto:security@example.org' },
  ];
  return (
    <div className="app-cluster" aria-label="Quick links">
      {tiles.map(({ label, icon: Icon, bg, id, href }) => (
        <a
          key={label}
          className="app-tile"
          style={{ background: bg }}
          href={href || `#${id}`}
          aria-label={label}
          title={label}
          onClick={(event) => { if (id) { event.preventDefault(); scrollToId(id); } }}
        >
          <Icon strokeWidth={2} />
        </a>
      ))}
    </div>
  );
}

const FOLDERS = [
  { label: 'Email file', mode: 'email_file' },
  { label: 'Paste text', mode: 'text_email' },
  { label: 'Attachment', mode: 'attachment_file' },
  { label: 'Capabilities', id: 'capabilities' },
  { label: 'Achievements', id: 'achievements' },
];

function FolderRail() {
  const { setInputMode } = useForensicStore();
  return (
    <nav className="rail" aria-label="Intake shortcuts">
      {FOLDERS.map(({ label, mode, id }) => (
        <button
          key={label}
          type="button"
          className="folder-btn"
          onClick={() => {
            if (mode) setInputMode(mode);
            scrollToId(id || 'workspace');
          }}
        >
          <span className="folder" aria-hidden="true">
            <span className="folder__back" />
            <span className="folder__tab" />
            <span className="folder__front" />
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Dock() {
  const today = new Date();
  const items = [
    { label: 'Workspace', icon: Terminal, bg: 'linear-gradient(160deg,#4a4a4a,#101010)', id: 'workspace' },
    { label: 'Email intake', icon: Mail, bg: 'linear-gradient(160deg,#7cc0ff,#2e7cf6)', id: 'workspace' },
    { label: 'Playbooks', icon: Sparkles, bg: 'linear-gradient(160deg,#b18cf7,#7a45e0)', id: 'playbooks' },
    { label: 'Achievements', icon: ShieldCheck, bg: 'linear-gradient(160deg,#ff8a7a,#ef3b45)', id: 'achievements' },
  ];
  const tail = [
    { label: 'Signature', icon: ScrollText, bg: 'linear-gradient(160deg,#6ce08e,#17a04a)', id: 'signature' },
    { label: 'Repository', icon: Github, bg: 'linear-gradient(160deg,#3a3a3a,#0b0b0b)', href: REPO_URL },
  ];
  return (
    <div className="dock" role="toolbar" aria-label="Quick navigation">
      {items.map(({ label, icon: Icon, bg, id }) => (
        <button key={label} type="button" className="dock__item" style={{ background: bg }} data-label={label} aria-label={label} onClick={() => scrollToId(id)}>
          <Icon />
        </button>
      ))}
      <button type="button" className="dock__cal" data-label="Workspace" aria-label="Workspace" onClick={() => scrollToId('workspace')}>
        <small>{today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</small>
        <b>{today.getDate()}</b>
      </button>
      {tail.map(({ label, icon: Icon, bg, id, href }) => (
        <a
          key={label}
          className="dock__item"
          style={{ background: bg }}
          data-label={label}
          aria-label={label}
          href={href || `#${id}`}
          onClick={(event) => { if (id) { event.preventDefault(); scrollToId(id); } }}
        >
          <Icon />
        </a>
      ))}
      <span className="dock__sep" />
      <button type="button" className="dock__item" style={{ background: 'linear-gradient(160deg,#f4f4f4,#dcdcdc)', color: '#111' }} data-label="Back to top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <ArrowUpRight />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ hero + nav */

function Menubar() {
  return (
    <div className="menubar">
      <span className="menubar__brand"><Shield size={13} /> SUDO SPANDR</span>
      <span className="menubar__sub">SentinelMail</span>
      <nav className="menubar__nav">
        <a href="#workspace">Workspace</a>
        <a href="#capabilities">Capabilities</a>
        <a href="#playbooks">Playbooks</a>
        <a href="#achievements">Achievements</a>
        <a href="#signature">Signature</a>
      </nav>
      <div className="menubar__right">
        <span className="menubar__status"><i className="menubar__dot" /> local mode</span>
        <span>{new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {new Date().toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero__grid">
        <div className="hero__col hero__col--left">
          <ClockWidget />
          <CalendarWidget />
          <PlayerWidget />
          <WeatherWidget />
          <EvidenceCard />
        </div>

        <div className="hero__center">
          <span className="pill pill--blue">SIH 2026 · Problem statement 26106</span>
          <h1 className="hero__name" style={{ marginTop: 18 }}>I&rsquo;m SentinelMail.</h1>
          <p className="hero__role">I read mail as <a href="#workspace">evidence.</a></p>
          <p className="hero__lead">
            Header reconstruction, authentication, relay order and attachment inspection — a deterministic
            triage that says what it can prove, and stays quiet about what it cannot.
          </p>
          <div className="hero__cta">
            <button type="button" className="btn btn--primary" onClick={() => scrollToId('workspace')}>
              Open the workspace <ArrowRight size={14} />
            </button>
            <a className="btn btn--ghost" href={REPO_URL} target="_blank" rel="noreferrer">
              <Github size={14} /> Repository
            </a>
          </div>
          <div className="hero__hint">No file upload in browser mode · nothing is executed · every claim is labelled</div>
        </div>

        <div className="hero__col hero__col--right">
          <FolderRail />
          <NoteWidget />
          <AppCluster />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- sections */

function Capabilities() {
  const cards = [
    { icon: Network, title: 'Header & relay path', copy: 'Received chain, hop order, public IPs in evidence order.' },
    { icon: ShieldCheck, title: 'Authentication', copy: 'SPF, DKIM, DMARC and ARC exactly as reported in headers.' },
    { icon: Tag, title: 'Category engine', copy: 'Phishing, BEC, spam or bulk — with the evidence behind it.' },
    { icon: Paperclip, title: 'Attachments', copy: 'Detected type, size, entropy, SHA-256 and static findings.' },
    { icon: ScrollText, title: 'Evidence integrity', copy: 'Preservation note, hashes and a JSON export of the result.' },
  ];
  return (
    <section className="section" id="capabilities">
      <div className="wrap">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow"><b>01</b><span className="eyebrow__rule" />Capabilities</span>
            <h2 className="section__title">What the workspace actually reads.</h2>
          </div>
          <p className="section__note">Five evidence surfaces, one honest rule: if the artefact is missing, the field says so instead of inventing a verdict.</p>
        </div>
        <div className="cap-grid reveal">
          {cards.map(({ icon: Icon, title, copy }) => (
            <article className="cap-card" key={title}>
              <span className="cap-card__icon"><Icon /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const SIGNALS = [
  { icon: FileCode2, title: 'RFC 5322 headers', copy: 'ordered, not guessed' },
  { icon: Shield, title: 'SPF · DKIM · DMARC', copy: 'as reported' },
  { icon: Mail, title: 'EML · MSG intake', copy: 'two parsers' },
  { icon: Hash, title: 'SHA-256', copy: 'payload fingerprint' },
  { icon: Fingerprint, title: 'Entropy', copy: 'container-aware' },
  { icon: Route, title: 'Relay order', copy: 'evidence sequence' },
  { icon: Globe, title: 'RDAP context', copy: 'registration only' },
  { icon: Lock, title: 'Redaction', copy: 'before export' },
  { icon: Database, title: 'ISO/IEC 27037', copy: 'preservation note' },
  { icon: Boxes, title: 'FastAPI backend', copy: 'optional depth' },
  { icon: Bot, title: 'AI second opinion', copy: 'opt-in, labelled' },
  { icon: Cpu, title: 'noVNC sandbox', copy: 'isolated detonation' },
];

function SignalsStrip() {
  const row = [...SIGNALS, ...SIGNALS];
  return (
    <section className="section section--canvas section--tight" id="standards">
      <div className="wrap" style={{ marginBottom: 18 }}>
        <span className="eyebrow reveal"><b>02</b><span className="eyebrow__rule" />Signals we surface</span>
      </div>
      <div className="marquee">
        <div className="marquee__track">
          {row.map(({ icon: Icon, title, copy }, index) => (
            <div className="chip-card" key={`${title}-${index}`}>
              <Icon />
              <div>
                <strong>{title}</strong>
                <small>{copy}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PILLARS = [
  {
    id: 'intake',
    tab: 'Intake',
    icon: FileSearch,
    eyebrow: 'Playbook 01',
    title: 'Start with the thing you actually have.',
    copy: 'A raw .eml, an Outlook .msg, pasted headers, or one attachment. Three different contracts — so the workspace asks which one before it says anything.',
    points: ['EML parsed as RFC-style text', 'MSG parsed as an Outlook container', 'Pasted body kept as body, headers kept as headers'],
    file: 'intake.eml',
    lines: [
      ['Format', 'EML · RFC 5322', 'ok'],
      ['Bytes read', '14,208', 'muted'],
      ['Executed', 'never', 'ok'],
      ['Network calls', 'none in browser mode', 'muted'],
    ],
    foot: ['Local parse', '0 uploads'],
  },
  {
    id: 'headers',
    tab: 'Headers',
    icon: Network,
    eyebrow: 'Playbook 02',
    title: 'Follow the headers before the story.',
    copy: 'Received lines are reconstructed in the order they appear, not sorted by a guess. Public IPs are extracted with the field they came from, so the hop order can be defended.',
    points: ['Chronological transport trace', 'Envelope vs. header domain comparison', 'Public IPs tagged with their source field'],
    file: 'relay.log',
    lines: [
      ['Hop 1', '203.0.113.10 · received', 'muted'],
      ['Hop 2', '198.51.100.24 · received', 'muted'],
      ['Hop 3', '192.0.2.7 · received', 'muted'],
      ['Order', 'evidence sequence', 'ok'],
    ],
    foot: ['RDAP lookup', 'on request'],
  },
  {
    id: 'auth',
    tab: 'Auth',
    icon: ShieldCheck,
    eyebrow: 'Playbook 03',
    title: 'Authentication is a header, not a promise.',
    copy: 'SPF, DKIM, DMARC and ARC are read from the Authentication-Results that the message carries. If the header is absent, the panel says absent — it does not run a DNS check it cannot show you.',
    points: ['Result values shown verbatim', 'Evidence source listed per row', 'Missing header reported as missing'],
    file: 'auth.json',
    lines: [
      ['SPF', 'as reported', 'muted'],
      ['DKIM', 'as reported', 'muted'],
      ['DMARC', 'as reported', 'muted'],
      ['ARC', 'no recognised header', 'warn'],
    ],
    foot: ['No fabricated pass', 'labels only'],
  },
  {
    id: 'files',
    tab: 'Files',
    icon: Paperclip,
    eyebrow: 'Playbook 04',
    title: 'Carve the payload, keep the receipt.',
    copy: 'Attachments are inspected statically: detected type, size, Shannon entropy, hashes and any structural notes. Nothing is executed in the tab, and nothing is called clean on your behalf.',
    points: ['Magic-byte style type detection', 'Entropy reported on the 0–8 scale', 'SHA-256 per artefact'],
    file: 'payload.bin',
    lines: [
      ['Detected type', 'application/pdf', 'muted'],
      ['Entropy', '7.42 / 8', 'warn'],
      ['SHA-256', 'a91f…c3d2', 'muted'],
      ['Verdict', 'human review required', 'bad'],
    ],
    foot: ['Static only', 'not detonated here'],
  },
];

function Playbooks() {
  return (
    <section className="deck" id="playbooks">
      <div className="wrap" style={{ paddingTop: 22, paddingBottom: 4 }}>
        <span className="eyebrow reveal"><b>03</b><span className="eyebrow__rule" />Playbooks</span>
        <h2 className="section__title reveal" style={{ marginBottom: 26 }}>Four panels. Same evidence, no theatre.</h2>
      </div>
      {PILLARS.map(({ id, tab, icon: Icon, eyebrow, title, copy, points, file, lines, foot }) => (
        <div className="deck__sticky" key={id}>
          <div className="wrap">
            <div className="deck__panel">
              <div className="deck__tabbar">
                <Icon />
                {tab}
                <em>{id}</em>
              </div>
              <div className="deck__panel-inner">
                <div className="deck__copy">
                  <span className="eyebrow">{eyebrow}</span>
                  <h3 style={{ marginTop: 10 }}>{title}</h3>
                  <p>{copy}</p>
                  <ul className="deck__list">
                    {points.map((point) => (
                      <li key={point}><Check /><span>{point}</span></li>
                    ))}
                  </ul>
                  <div className="deck__actions">
                    <button type="button" className="btn btn--primary" onClick={() => scrollToId('workspace')}>
                      Try it on your file <ArrowRight size={13} />
                    </button>
                    <a className="btn btn--ghost" href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer">
                      <BookOpen size={13} /> Read the docs
                    </a>
                  </div>
                </div>
                <div className="window">
                  <div className="window__bar">
                    <span className="window__dot window__dot--r" />
                    <span className="window__dot window__dot--y" />
                    <span className="window__dot window__dot--g" />
                    <span className="window__file">{file}</span>
                  </div>
                  <div className="window__body">
                    {lines.map(([label, value, tone]) => (
                      <div className="window__line" key={label}>
                        <span>{label}</span>
                        <b className={tone}>{value}</b>
                      </div>
                    ))}
                  </div>
                  <div className="window__foot">
                    <span>{foot[0]}</span>
                    <span>{foot[1]}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function Achievements() {
  const rows = [
    { icon: Tag, title: 'Category engine', copy: 'Phishing, BEC, spam and bulk classification, with points and coverage.' },
    { icon: Hash, title: 'Transparent scoring', copy: 'A 0–100 triage score with the exact contributors listed.' },
    { icon: ShieldCheck, title: 'Authentication reader', copy: 'SPF, DKIM, DMARC and ARC read from reported headers only.' },
    { icon: Route, title: 'Relay reconstruction', copy: 'Hop order and public IPs kept in the order the evidence shows.' },
    { icon: Paperclip, title: 'Attachment inspection', copy: 'Type, size, entropy, SHA-256 and static structural findings.' },
    { icon: Bot, title: 'AI second opinion', copy: 'Opt-in only, labelled as a model interpretation, never a verdict.' },
    { icon: FileCheck2, title: 'Dossier export', copy: 'A JSON result with case id, hashes and preservation notes.' },
    { icon: Code2, title: 'Open API surface', copy: 'FastAPI and serverless handlers for the heavier analysis paths.' },
  ];
  return (
    <section className="section section--bordered" id="achievements">
      <div className="wrap">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow"><b>04</b><span className="eyebrow__rule" />Achievements</span>
            <h2 className="section__title">Eight things this build does in public.</h2>
          </div>
          <p className="section__note">These are the working surfaces in this repository, not marketing milestones. Each one is either wired to evidence or not shown at all.</p>
        </div>
        <div className="ach-grid reveal">
          {rows.map(({ icon: Icon, title, copy }) => (
            <div className="ach-row" key={title}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className="ach-row__icon"><Icon /></span>
                <div>
                  <strong>{title}</strong>
                  <span>{copy}</span>
                </div>
              </div>
              <CheckCircle2 size={15} color="#1fb84a" style={{ flex: '0 0 auto', marginTop: 6 }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Signature() {
  const steps = [
    { icon: Lock, title: 'Read locally', copy: 'The browser parses the message. No upload happens unless you explicitly call the API.' },
    { icon: ScanLine, title: 'Report observations', copy: 'Every field is either observed, unavailable, or labelled as an AI interpretation.' },
    { icon: ScrollText, title: 'Export the receipt', copy: 'Download the result as JSON with its case id and hash trail intact.' },
  ];
  return (
    <section className="section section--canvas" id="signature">
      <div className="wrap">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow"><b>05</b><span className="eyebrow__rule" />Signature</span>
            <h2 className="section__title">The workflow is reproducible.</h2>
          </div>
          <p className="section__note">Clone it, run it, break it. The repository ships the audit script that fails the build when a forensic claim is fabricated.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.85fr) minmax(0,1.15fr)', gap: 26, alignItems: 'start' }} className="sig-grid reveal">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {steps.map(({ icon: Icon, title, copy }) => (
              <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className="ach-row__icon" style={{ background: '#fff', boxShadow: 'var(--card-shadow)' }}><Icon /></span>
                <div>
                  <strong style={{ fontSize: 14, letterSpacing: '-0.02em' }}>{title}</strong>
                  <p style={{ fontSize: 12, lineHeight: 1.55, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>{copy}</p>
                </div>
              </div>
            ))}
            <a className="btn btn--dark" href={REPO_URL} target="_blank" rel="noreferrer" style={{ width: 'fit-content', marginTop: 4 }}>
              <Github size={14} /> sudonishant / SUDO-SPANDR
            </a>
          </div>
          <div className="terminal">
            <div className="terminal__bar">
              <span className="window__dot window__dot--r" />
              <span className="window__dot window__dot--y" />
              <span className="window__dot window__dot--g" />
              <span className="terminal__file">sentinelmail — zsh</span>
            </div>
            <div className="terminal__body">
              <div><span className="prompt">$</span> npm install</div>
              <div><span className="prompt">$</span> npm run dev <span className="dim"># workspace on :5173</span></div>
              <div><span className="prompt">$</span> npm run lint</div>
              <div><span className="ok">✓</span> forensic claim audit — 35 files checked, 0 fabricated claims</div>
              <div><span className="prompt">$</span> npm run build</div>
              <div><span className="ok">✓</span> production distribution verified</div>
              <div><span className="prompt">$</span> curl -s /api/v1/health</div>
              <div><span className="ok">✓</span> service healthy <span className="dim">— evidence paths available</span></div>
              <div><span className="prompt">$</span> <span className="cursor" /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Playground() {
  return (
    <section className="section" id="playground">
      <div className="wrap">
        <div style={{ textAlign: 'center', marginBottom: 30 }} className="reveal">
          <h2 className="section__title" style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            The
            <span style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(160deg,#111,#333)', display: 'grid', placeItems: 'center', color: '#fff' }}>
              <Shield size={24} />
            </span>
            Playground
          </h2>
          <p style={{ margin: '14px auto 0', maxWidth: 460, fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>
            A safe place to open a suspicious mail without opening it in your real inbox.
          </p>
        </div>
        <div className="terminal reveal" style={{ maxWidth: 980, margin: '0 auto' }}>
          <div className="terminal__bar">
            <span className="window__dot window__dot--r" />
            <span className="window__dot window__dot--y" />
            <span className="window__dot window__dot--g" />
            <span className="terminal__file">privacy.md — read me first</span>
          </div>
          <div className="play-card">
            <div>
              <h3>Nothing leaves the tab by default.</h3>
              <p>
                Email files and attachments are parsed with JavaScript inside this page. The result, the hashes and the
                dossier are produced locally. Clearing the result removes them from the workspace.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <span className="pill pill--green"><Check size={11} /> local parse</span>
                <span className="pill"><Lock size={11} /> redaction</span>
                <span className="pill"><FileSearch size={11} /> static only</span>
              </div>
            </div>
            <div>
              <h3>Server paths are opt-in and visible.</h3>
              <p>
                Network context, sandbox detonation and the AI second opinion call the API in this repository. Each one
                is a button you press, and each answer is labelled with what it actually is.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <a className="btn btn--dark btn--sm" href={REPO_URL} target="_blank" rel="noreferrer"><Code2 size={12} /> API reference</a>
                <a className="btn btn--ghost btn--sm" href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer"><MessageSquareText size={12} /> Report a finding</a>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26 }} className="reveal">
          <button type="button" className="btn btn--primary" onClick={() => scrollToId('workspace')}>
            Open the workspace <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <span className="footer__brand"><Shield size={17} /> SUDO SPANDR</span>
            <p className="footer__lede">
              SentinelMail — deterministic email forensics for analysts who would rather see the evidence than a score.
            </p>
          </div>
          <div className="footer__col">
            <h4>Sections</h4>
            <nav className="footer__nav">
              <a href="#workspace">Workspace</a>
              <a href="#capabilities">Capabilities</a>
              <a href="#playbooks">Playbooks</a>
              <a href="#achievements">Achievements</a>
              <a href="#signature">Signature</a>
            </nav>
          </div>
          <div className="footer__col">
            <h4>Elsewhere</h4>
            <div className="footer__socials">
              <a className="footer__social" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub"><Github /></a>
              <a className="footer__social" href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer" aria-label="Documentation"><BookOpen /></a>
              <a className="footer__social" href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" aria-label="Issues"><MessageSquareText /></a>
              <a className="footer__social" href="#workspace" aria-label="Workspace"><Terminal /></a>
            </div>
          </div>
        </div>
        <div className="footer__legal">
          <span>© {new Date().getFullYear()} SUDO SPANDR · SentinelMail · MIT licensed</span>
          <span>Missing data is never replaced with a guess.</span>
        </div>
      </div>
    </footer>
  );
}

/* --------------------------------------------------------- result panels */

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
        <button type="button" className="btn btn--dark btn--sm" onClick={() => onRun(question)} style={{ width: 'fit-content' }}><Bot size={13} /> Run AI second opinion</button>
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
        {review.status !== 'not_configured' ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => onRun(question)} style={{ width: 'fit-content' }}>Try AI again</button> : null}
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
        <button type="button" className="btn btn--ghost btn--sm" onClick={onLookup} disabled={!ips.length || geoLoading} style={{ width: 'fit-content' }}>
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

function AnalysisResult({ data }) {
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
          <button type="button" className="btn btn--ghost btn--sm" onClick={runAiReview}><Bot size={13} /> AI second opinion</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={downloadJSON}><Download size={13} /> Export JSON</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetResult}><XCircle size={13} /> Clear</button>
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
    </section>
  );
}

function Workspace() {
  const { analysisData, loading } = useForensicStore();
  return (
    <section className="section section--bordered workspace" id="workspace">
      <div className="wrap">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow"><b>00</b><span className="eyebrow__rule" />Workspace</span>
            <h2 className="section__title">Drop one message. Read only what the evidence says.</h2>
          </div>
          <p className="section__note">The intake below is the real product. Everything above is how it behaves; everything below is what it returns.</p>
        </div>

        <Dropzone />

        {loading && (
          <div className="loading-row">
            <span className="spinner" />
            <div>
              <strong>Inspecting submitted evidence…</strong>
              <p>Parsing locally. No file is executed and no analyst IP is substituted for an email origin.</p>
            </div>
          </div>
        )}

        {analysisData && !loading && <AnalysisResult data={analysisData} />}

        {!analysisData && !loading && (
          <div className="empty-workspace">
            <FileSearch size={22} />
            <div>
              <strong>No evidence loaded</strong>
              <p>Pick one of the three modes above to begin. Results stay in this tab.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- app */

export default function App() {
  useReveal();
  return (
    <div className="shell">
      <Menubar />
      <Hero />
      <Workspace />
      <Capabilities />
      <SignalsStrip />
      <Playbooks />
      <Achievements />
      <Signature />
      <Playground />
      <Footer />
      <Dock />
    </div>
  );
}
