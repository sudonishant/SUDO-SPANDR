import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryFull, Command, FileCode2, FileSearch, FileText, FolderOpen, Github, Globe, Info, Lock, Mail,
  Paperclip, Printer, Radar, RotateCcw, Search, Shield, TerminalSquare, Volume2, Wifi,
} from 'lucide-react';
import Window from './os/Window';
import WorkspaceApp from './apps/WorkspaceApp';
import SandboxApp from './apps/SandboxApp';
import FilesApp from './apps/FilesApp';
import TerminalApp from './apps/TerminalApp';
import AboutApp from './apps/AboutApp';
import { MitreApp, DossierApp } from './apps/CaseApps';
import { EmlScoreApp, ContentLabApp, AttachLabApp } from './apps/ScoreApps';
import BrowserApp from './apps/BrowserApp';
import { useForensicStore } from './store/useForensicStore';

const REPO_URL = 'https://github.com/sudonishant/SUDO-SPANDR';

const APPS = {
  eml: {
    title: 'EML / MSG Scorer', icon: Mail, accent: 'linear-gradient(160deg,#ff5c7a,#b31527)',
    w: 860, h: 620, dock: 'linear-gradient(160deg,#ff5c7a,#a3121f)',
  },
  content: {
    title: 'Content Lab', icon: FileText, accent: 'linear-gradient(160deg,#ffb45c,#b3561b)',
    w: 820, h: 600, dock: 'linear-gradient(160deg,#ffb45c,#a84e14)',
  },
  attach: {
    title: 'Attachment Lab', icon: Paperclip, accent: 'linear-gradient(160deg,#5cd9ff,#1b6bb3)',
    w: 820, h: 600, dock: 'linear-gradient(160deg,#5cd9ff,#1556a8)',
  },
  browser: {
    title: 'Real Browser', icon: Globe, accent: 'linear-gradient(160deg,#7ee2a8,#1c8a58)',
    w: 1100, h: 680, ratio: 0.58, dock: 'linear-gradient(160deg,#7ee2a8,#166b43)',
  },
  workspace: {
    title: 'Workspace', icon: FileCode2, accent: 'linear-gradient(160deg,#ff3b50,#b31527)',
    w: 980, h: 620, dock: 'linear-gradient(160deg,#ff3b50,#a3121f)',
  },
  sandbox: {
    title: 'Sandbox VM', icon: Radar, accent: 'linear-gradient(160deg,#ff8a5c,#b3261b)',
    w: 1040, h: 660, ratio: 0.58, dock: 'linear-gradient(160deg,#ff8a5c,#a81e14)',
  },
  files: {
    title: 'Files', icon: FolderOpen, accent: 'linear-gradient(160deg,#8a8f9b,#3a3d45)',
    w: 760, h: 520, dock: 'linear-gradient(160deg,#8a8f9b,#2e3138)',
  },
  terminal: {
    title: 'Terminal', icon: TerminalSquare, accent: 'linear-gradient(160deg,#3c3f47,#101114)',
    w: 660, h: 400, dock: 'linear-gradient(160deg,#3c3f47,#0b0c0e)',
  },
  mitre: {
    title: 'MITRE ATT&CK', icon: Shield, accent: 'linear-gradient(160deg,#6f7bff,#2b2f9e)',
    w: 720, h: 520, dock: 'linear-gradient(160deg,#6f7bff,#272b8f)',
  },
  dossier: {
    title: 'Dossier', icon: Printer, accent: 'linear-gradient(160deg,#f7ce46,#a57908)',
    w: 760, h: 560, dock: 'linear-gradient(160deg,#f7ce46,#8f6a06)',
  },
  about: {
    title: 'About SUDO SPANDR', icon: Info, accent: 'linear-gradient(160deg,#4a4d55,#16171a)',
    w: 700, h: 520, dock: 'linear-gradient(160deg,#4a4d55,#121316)',
  },
};

const LAUNCH = [
  { id: 'eml', label: 'EML Scorer', hint: 'Email .eml/.msg → score' },
  { id: 'content', label: 'Content Lab', hint: 'Paste content → score' },
  { id: 'attach', label: 'Attachment Lab', hint: 'File → direct score' },
  { id: 'browser', label: 'Real Browser', hint: 'Live Chrome + data-flow log' },
  { id: 'sandbox', label: 'Sandbox VM', hint: 'Real virtual computer' },
  { id: 'files', label: 'Files', hint: 'Evidence & reports' },
];

function MobileStatus({ locked }) {
  const now = useClock();
  return (
    <div className="phone__status">
      <span className="phone__time">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
      <span className="phone__brand"><img src="/logo.jpg" alt="" className="phone__brand-logo" /> SUDO SPANDR</span>
      <span className="phone__status-icons">
        <Lock size={10} />
        <Wifi size={11} />
        <BatteryFull size={13} />
      </span>
      {locked ? <span className="phone__locked-dot" /> : null}
    </div>
  );
}

function MobileHome({ onOpen }) {
  const now = useClock();
  const tools = ['mitre', 'dossier', 'about'];
  return (
    <div className="phone">
      <div className="phone__head">
        <span className="phone__eyebrow">SentinelMail · forensic desktop</span>
        <h1>SUDO SPANDR</h1>
        <p>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · air-gapped session</p>
      </div>

      <div className="phone__grid">
        {LAUNCH.map((item) => {
          const app = APPS[item.id];
          const Icon = app.icon;
          return (
            <button type="button" key={item.id} className="phone__app" onClick={() => onOpen(item.id)}>
              <span className="phone__app-icon" style={{ background: app.dock }}><Icon /></span>
              <span className="phone__app-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="phone__tools">
        {tools.map((id) => {
          const app = APPS[id];
          const Icon = app.icon;
          return (
            <button type="button" key={id} className="phone__tool" onClick={() => onOpen(id)}>
              <span style={{ background: app.dock }}><Icon /></span>{app.title}
            </button>
          );
        })}
      </div>

      <div className="phone__card">
        <Shield size={13} />
        <div>
          <strong>Evidence stays on this device</strong>
          <p>Files are parsed locally. The sandbox container is the only thing that touches a URL, and only when you press detonate.</p>
        </div>
      </div>

      <div className="phone__dock">
        {LAUNCH.map((item) => {
          const app = APPS[item.id];
          const Icon = app.icon;
          return (
            <button type="button" key={item.id} className="phone__dock-app" onClick={() => onOpen(item.id)} aria-label={app.title}>
              <span style={{ background: app.dock }}><Icon /></span>
            </button>
          );
        })}
      </div>
      <span className="phone__indicator" />
    </div>
  );
}

function Wallpaper() {
  const stars = useMemo(() => Array.from({ length: 70 }).map((_, index) => ({
    left: `${(index * 37 + 11) % 100}%`,
    top: `${(index * 53 + 7) % 100}%`,
    delay: `${(index % 9) * 0.6}s`,
    size: index % 7 === 0 ? 2 : 1.5,
  })), []);
  return (
    <div className="wallpaper" aria-hidden="true">
      <div className="wallpaper__base" />
      <div className="wallpaper__glow" />
      <div className="wallpaper__grid" />
      <div className="wallpaper__stars">
        {stars.map((star, index) => (
          <i key={index} style={{ left: star.left, top: star.top, animationDelay: star.delay, width: star.size, height: star.size }} />
        ))}
      </div>
      <div className="wallpaper__scan" />
      <span className="wallpaper__word" aria-hidden="true">SUDO SPANDR</span>
      <div className="wallpaper__vignette" />
      <div className="wallpaper__noise" />
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function Menubar({ onAction, onOpen, activeTitle, quickOpen, setQuickOpen }) {
  const [menu, setMenu] = useState(null);
  const now = useClock();
  const ref = useRef(null);
  const [compact, setCompact] = useState(() => window.innerWidth < 780);

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 780);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onClick = (event) => { if (ref.current && !ref.current.contains(event.target)) setMenu(null); };
    document.addEventListener('pointerdown', onClick);
    return () => document.removeEventListener('pointerdown', onClick);
  }, []);

  const menus = {
    spandr: {
      label: '◆',
      items: [
        ['About SUDO SPANDR', 'about'], ['—'], ['New analysis', 'workspace'], ['Open evidence', 'files'],
        ['—'], ['Restart session', 'restart'], ['Lock desktop', 'lock'],
      ],
    },
    File: {
      label: 'File',
      items: [
        ['Score an email (.eml/.msg)', 'eml'], ['Score content', 'content'], ['Score an attachment', 'attach'],
        ['—'],
        ['New analysis', 'workspace'], ['Open evidence…', 'files'], ['Real browser', 'browser'], ['Detonate a link', 'sandbox'],
        ['—'], ['Print dossier', 'dossier'], ['Close window', 'close'],
      ],
    },
    Analysis: {
      label: 'Analysis',
      items: [
        ['EML / MSG Scorer', 'eml'], ['Content Lab', 'content'], ['Attachment Lab', 'attach'],
        ['—'],
        ['Workspace', 'workspace'], ['Real Browser', 'browser'], ['Sandbox VM (real PC)', 'sandbox'], ['MITRE mapping', 'mitre'], ['Dossier & containment', 'dossier'],
      ],
    },
    View: {
      label: 'View',
      items: [['Toggle full screen', 'fullscreen'], ['Terminal', 'terminal'], ['—'], ['Open repository', 'repo']],
    },
    Help: {
      label: 'Help',
      items: [['About SUDO SPANDR', 'about'], ['Documentation', 'docs'], ['Report a finding', 'issues']],
    },
  };

  const run = (id) => {
    setMenu(null);
    if (id === 'repo' || id === 'docs' || id === 'issues') {
      const url = id === 'repo' ? REPO_URL : id === 'docs' ? `${REPO_URL}#readme` : `${REPO_URL}/issues`;
      window.open(url, '_blank', 'noreferrer');
      return;
    }
    onAction(id);
  };

  return (
    <header className="menubar" ref={ref}>
      {Object.entries(menus).map(([key, value]) => (
        <div key={key} style={{ position: 'relative' }}>
          <button
            type="button"
            className={`${key === 'spandr' ? 'menu-brand' : 'menu-item'} ${menu === key ? 'is-open' : ''}`}
            onClick={() => setMenu(menu === key ? null : key)}
          >
            {key === 'spandr' ? <><img src="/logo.jpg" alt="" className="menu-brand__logo" />SUDO SPANDR</> : value.label}
          </button>
          {menu === key && (
            <div className="dropdown" style={{ left: 0, top: 30 }}>
              {value.items.map((item, index) => (
                item[0] === '—' ? <div className="dropdown__sep" key={`sep-${index}`} /> : (
                  <button type="button" key={item[0]} onClick={() => run(item[1])}>
                    <span>{item[0]}</span>
                  </button>
                )
              ))}
            </div>
          )}
        </div>
      ))}
      <span className="menu-spacer" />
      {activeTitle ? <span className="menu-chip"><Command size={9} />{activeTitle}</span> : null}
      <span className="menu-status"><i className="menu-status__dot" /> local</span>
      <button type="button" className={`menu-item ${quickOpen ? 'is-open' : ''}`} onClick={() => setQuickOpen(!quickOpen)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <Wifi size={12} /><Volume2 size={12} /><BatteryFull size={13} />
      </button>
      <span className="menu-clock">
        {compact
          ? now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : `${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
      </span>
      <button type="button" className="menu-icon" onClick={() => onOpen('about')} aria-label="About"><Search size={12} /></button>
    </header>
  );
}

function DesktopLauncher({ onOpen, onContext }) {
  return (
    <div
      className="launcher"
      onContextMenu={(event) => { event.preventDefault(); onContext?.({ x: event.clientX, y: event.clientY }); }}
    >
      <div className="launcher__head">
        <img src="/logo.jpg" alt="SUDO SPANDR logo" className="launcher__logo" />
        <span className="launcher__eyebrow">SentinelMail · deterministic email forensics</span>
        <h1 className="launcher__title">Welcome to <span>SUDO SPANDR</span></h1>
        <p className="launcher__sub">Pick an app. Evidence is parsed on this machine — nothing is uploaded.</p>
      </div>

      <div className="launcher__apps">
        {LAUNCH.map((item) => {
          const app = APPS[item.id];
          const Icon = app.icon;
          return (
            <button
              key={item.id}
              type="button"
              className="launcher__app"
              onClick={() => onOpen(item.id)}
              aria-label={`Open ${app.title}`}
              title={`Open ${app.title}`}
            >
              <span className="launcher__icon" style={{ background: app.dock }}>
                <Icon />
              </span>
              <span className="launcher__label">{item.label}</span>
              <span className="launcher__hint">{item.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="launcher__foot">
        <span><i /> local session</span>
        <button type="button" onClick={() => onOpen('mitre')}>MITRE</button>
        <button type="button" onClick={() => onOpen('dossier')}>Dossier</button>
        <button type="button" onClick={() => onOpen('about')}>About</button>
      </div>
    </div>
  );
}

function DesktopMenu({ at, onClose, onAction, onOpen }) {
  const items = [
    ['New analysis', () => onOpen('workspace')],
    ['Open evidence', () => onOpen('files')],
    ['Open terminal', () => onOpen('terminal')],
    ['—'],
    ['Detonate a link', () => onOpen('sandbox')],
    ['—'],
    ['MITRE mapping', () => onOpen('mitre')],
    ['Dossier & containment', () => onOpen('dossier')],
    ['About SUDO SPANDR', () => onOpen('about')],
    ['—'],
    ['Lock session', () => onAction('lock')],
    ['Restart session', () => onAction('restart')],
  ];
  return (
    <div
      className="dropdown"
      style={{ left: Math.min(at.x, window.innerWidth - 200), top: Math.min(at.y, window.innerHeight - 260), position: 'fixed', zIndex: 950 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {items.map((item, index) => (item[0] === '—'
        ? <div className="dropdown__sep" key={`sep-${index}`} />
        : <button type="button" key={item[0]} onClick={() => { onClose(); item[1](); }}><span>{item[0]}</span></button>))}
    </div>
  );
}

function Dock({ onOpen, openIds }) {
  return (
    <div className="dock-wrap">
      <nav className="dock" aria-label="Applications">
        {LAUNCH.map((item) => {
          const app = APPS[item.id];
          const Icon = app.icon;
          return (
            <button
              key={item.id}
              type="button"
              className="dock__item"
              style={{ background: app.dock }}
              data-label={app.label}
              aria-label={app.title}
              onClick={() => onOpen(item.id)}
            >
              <Icon />
              {openIds.includes(item.id) ? <span className="dock__dot" /> : null}
            </button>
          );
        })}
        <span className="dock__sep" />
        <button className="dock__item" style={{ background: 'linear-gradient(160deg,#3a3d45,#0f1012)' }} data-label="About" aria-label="About SUDO SPANDR" onClick={() => onOpen('about')}>
          <Info />
        </button>
      </nav>
    </div>
  );
}

function QuickPanel({ onAction, onOpen, onClose }) {
  return (
    <div className="quick" onPointerDown={(event) => event.stopPropagation()}>
      <div className="quick__grid">
        <button type="button" className="quick__item is-on"><Wifi />Wi‑Fi</button>
        <button type="button" className="quick__item"><Volume2 />Sound</button>
        <button type="button" className="quick__item" onClick={() => onOpen('sandbox')}><Radar />Sandbox</button>
        <button type="button" className="quick__item" onClick={() => onAction('lock')}><Lock />Lock</button>
      </div>
      <div className="quick__row"><span>Session</span><b>local · no telemetry</b></div>
      <div className="quick__row"><span>Uploads</span><b>0</b></div>
      <div className="quick__row"><span>Evidence</span><b>memory only</b></div>
      <div className="rule" />
      <div className="btn-row">
        <button type="button" className="btn btn--sm" onClick={() => onAction('restart')}><RotateCcw size={11} /> Restart</button>
        <button type="button" className="btn btn--sm" onClick={() => onOpen('about')}><Info size={11} /> About</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function BootScreen({ done }) {
  const [line, setLine] = useState('initialising isolated profile');
  useEffect(() => {
    const steps = [
      'mounting evidence vault',
      'loading deterministic parsers',
      'attaching sandbox container',
      'desktop ready',
    ];
    const timers = steps.map((step, index) => setTimeout(() => setLine(step), 380 * (index + 1)));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className={`boot ${done ? 'is-done' : ''}`} aria-hidden={done}>
      <div className="boot__inner">
        <img src="/logo.jpg" alt="" className="boot__logo" />
        <div className="boot__name">SUDO SPANDR</div>
        <div className="boot__log">{line}<br />sentinelmail desktop · no telemetry</div>
        <div className="boot__bar"><i /></div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- shell */

let zTop = 20;
let cascade = 0;

export default function App() {
  const { resetResult } = useForensicStore();
  const [windows, setWindows] = useState([]);
  const [booted, setBooted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 780);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 780);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    const onDown = (event) => {
      if (ctxMenu) setCtxMenu(null);
      if (quickOpen && !event.target.closest('.quick') && !event.target.closest('.menubar')) setQuickOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') { setQuickOpen(false); setCtxMenu(null); }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [quickOpen, ctxMenu]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBooted(true);
    }, 1650);
    return () => clearTimeout(timer);
  }, []);

  const focus = useCallback((id) => {
    zTop += 1;
    setWindows((all) => all.map((win) => (win.id === id ? { ...win, z: zTop, minimized: false } : win)));
  }, []);

  const open = useCallback((id) => {
    if (!APPS[id]) return;
    const isSmall = window.innerWidth < 780;
    setWindows((all) => {
      if (isSmall) {
        const existing = all.find((win) => win.id === id);
        zTop += 1;
        const app = APPS[id];
        const shell = {
          id,
          title: app.title,
          icon: app.icon,
          accent: app.accent,
          z: zTop,
          x: 0,
          y: 0,
          w: window.innerWidth - 16,
          h: window.innerHeight - 48,
          minimized: false,
          maximized: true,
          flush: id === 'sandbox' || id === 'files' || id === 'terminal',
        };
        if (existing) return [{ ...existing, ...shell }];
        return [shell];
      }
      const existing = all.find((win) => win.id === id);
      zTop += 1;
      if (existing) return all.map((win) => (win.id === id ? { ...win, z: zTop, minimized: false } : win));
      const app = APPS[id];
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const visible = all.filter((win) => !win.minimized);
      let width = Math.min(app.w, vw - 80);
      let height = Math.min(Math.max(app.h, Math.round(vh * 0.66)), vh - 170);
      let x;
      let y;
      if (!visible.length) {
        x = vw > 900 ? 128 : 24;
        y = 46;
        width = Math.min(width, Math.round(vw * (app.ratio || 0.53)));
      } else if (visible.length === 1) {
        // tile beside the existing window instead of stacking on top of it
        const other = visible[0];
        const gap = 18;
        x = other.x + other.w + gap;
        if (x + 360 > vw) {
          // not enough room beside it: cascade with a visible offset, fully on screen
          width = Math.min(app.w, Math.round(vw * 0.58));
          height = Math.min(app.h, vh - 180);
          x = Math.max(16, Math.min(vw - width - 20, other.x + 44));
          y = Math.max(44, Math.min(vh - height - 92, other.y + 44));
        } else {
          width = Math.min(app.w, vw - x - 22);
          y = other.y;
        }
      } else {
        const offset = (cascade++ % 6) * 24;
        x = 120 + offset;
        y = 56 + offset;
      }
      return [...all, {
        id,
        title: app.title,
        icon: app.icon,
        accent: app.accent,
        z: zTop,
        x, y, w: width, h: height,
        minimized: false,
        maximized: false,
        flush: id === 'sandbox' || id === 'files' || id === 'terminal',
      }];
    });
  }, []);

  const close = useCallback((id) => setWindows((all) => all.filter((win) => win.id !== id)), []);
  const minimize = useCallback((id) => setWindows((all) => all.map((win) => (win.id === id ? { ...win, minimized: true } : win))), []);
  const toggleMax = useCallback((id) => setWindows((all) => all.map((win) => (win.id === id ? { ...win, maximized: !win.maximized } : win))), []);
  const move = useCallback((id, x, y) => setWindows((all) => all.map((win) => (win.id === id ? { ...win, x, y } : win))), []);
  const resize = useCallback((id, w, h) => setWindows((all) => all.map((win) => (win.id === id ? { ...win, w, h } : win))), []);

  const action = useCallback((id) => {
    if (id === 'restart') {
      resetResult();
      setWindows([]);
      setBooted(false);
      setLocked(false);
      setTimeout(() => setBooted(true), 1700);
      return;
    }
    if (id === 'lock') { setLocked(true); return; }
    if (id === 'close') {
      setWindows((all) => {
        const active = [...all].sort((a, b) => b.z - a.z)[0];
        return active ? all.filter((win) => win.id !== active.id) : all;
      });
      return;
    }
    if (id === 'fullscreen') {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
      return;
    }
    open(id);
  }, [open, resetResult]);

  const activeWindow = [...windows].filter((win) => !win.minimized).sort((a, b) => b.z - a.z)[0];

  const renderApp = (id) => {
    if (id === 'eml') return <EmlScoreApp />;
    if (id === 'content') return <ContentLabApp />;
    if (id === 'attach') return <AttachLabApp />;
    if (id === 'browser') return <BrowserApp />;
    if (id === 'workspace') return <WorkspaceApp />;
    if (id === 'sandbox') return <SandboxApp />;
    if (id === 'files') return (
      <FilesApp
        openFile={(file) => {
          if (file?.kind === 'scorer') {
            const target = file.target === 'attach' ? 'attach' : file.target === 'content' ? 'content' : 'eml';
            open(target);
          } else if (file?.kind === 'terminal') open('terminal');
          else if (file?.kind === 'about') open('about');
          else if (file?.kind === 'dossier') open('dossier');
          else open('files');
        }}
      />
    );
    if (id === 'terminal') return <TerminalApp onCommand={(app) => open(app)} />;
    if (id === 'mitre') return <MitreApp onOpen={open} />;
    if (id === 'dossier') return <DossierApp onOpen={open} />;
    if (id === 'about') return <AboutApp onOpen={open} />;
    return null;
  };

  return (
    <div className="os">
      <Wallpaper />
      {isMobile ? <MobileStatus locked={locked} /> : (
        <>
          <Menubar onAction={action} onOpen={open} activeTitle={activeWindow?.title} quickOpen={quickOpen} setQuickOpen={setQuickOpen} />
          {quickOpen ? <QuickPanel onAction={action} onOpen={open} onClose={() => setQuickOpen(false)} /> : null}
        </>
      )}
      {!isMobile ? (
        <>
          <div
            onPointerDown={() => setQuickOpen(false)}
            onContextMenu={(event) => { event.preventDefault(); setCtxMenu({ x: event.clientX, y: event.clientY }); }}
            style={{ position: 'absolute', inset: '32px 0 0', zIndex: 1 }}
            aria-hidden="true"
          />
          {windows.length === 0 ? <DesktopLauncher onOpen={open} onContext={(at) => setCtxMenu(at)} /> : null}
          {ctxMenu ? <DesktopMenu at={ctxMenu} onClose={() => setCtxMenu(null)} onAction={action} onOpen={open} /> : null}
        </>
      ) : null}
      {isMobile && windows.length === 0 ? <MobileHome onOpen={open} /> : null}

      <div className="windows">
        {windows.map((win) => (
          <Window
            key={win.id}
            win={win}
            active={activeWindow?.id === win.id}
            onFocus={focus}
            onClose={close}
            onMinimize={minimize}
            onToggleMax={toggleMax}
            onMove={move}
            onResize={resize}
            mobile={isMobile}
          >
            {renderApp(win.id)}
          </Window>
        ))}
      </div>

      {!isMobile ? <Dock onOpen={open} openIds={windows.map((win) => win.id)} /> : null}

      {locked && (
        <div className="boot" style={{ opacity: 1, visibility: 'visible' }}>
          <div className="boot__inner">
            <img src="/logo.jpg" alt="" className="boot__logo" />
            <div className="boot__name">SESSION LOCKED</div>
            <div className="boot__log">evidence stays in memory only<br />nothing is written to disk</div>
            <button type="button" className="btn btn--primary" onClick={() => setLocked(false)}><Lock size={12} /> Unlock session</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => action('restart')}>
              <RotateCcw size={11} /> Restart
            </button>
          </div>
        </div>
      )}

      <BootScreen done={booted} />
    </div>
  );
}
