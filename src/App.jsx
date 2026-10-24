import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryFull, Command, FileCode2, FolderOpen, Github, Info, Lock, Printer, Radar,
  RotateCcw, Search, Shield, TerminalSquare, Volume2, Wifi,
} from 'lucide-react';
import Window from './os/Window';
import WorkspaceApp from './apps/WorkspaceApp';
import SandboxApp from './apps/SandboxApp';
import FilesApp from './apps/FilesApp';
import TerminalApp from './apps/TerminalApp';
import AboutApp from './apps/AboutApp';
import { MitreApp, DossierApp } from './apps/CaseApps';
import { useForensicStore } from './store/useForensicStore';

const REPO_URL = 'https://github.com/sudonishant/SUDO-SPANDR';

const APPS = {
  workspace: {
    title: 'Workspace', icon: FileCode2, accent: 'linear-gradient(160deg,#ff3b50,#b31527)',
    w: 980, h: 620, dock: 'linear-gradient(160deg,#ff3b50,#a3121f)',
  },
  sandbox: {
    title: 'Sandbox VM', icon: Radar, accent: 'linear-gradient(160deg,#ff8a5c,#b3261b)',
    w: 1040, h: 640, dock: 'linear-gradient(160deg,#ff8a5c,#a81e14)',
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
    title: 'About SPANDR', icon: Info, accent: 'linear-gradient(160deg,#4a4d55,#16171a)',
    w: 700, h: 520, dock: 'linear-gradient(160deg,#4a4d55,#121316)',
  },
};

const DESKTOP_FILES = [
  { name: 'phishing-sample.eml', meta: '14.2 KB · eml', kind: 'eml', accent: '#ef233c', open: 'files' },
  { name: 'invoice-clean.eml', meta: '4.1 KB · eml', kind: 'eml', accent: '#38d17a', open: 'files' },
  { name: 'vendor-invoice.pdf', meta: '238 KB · pdf', kind: 'pdf', accent: '#f7ce46', open: 'files' },
  { name: 'case-report.json', meta: '18.4 KB · json', kind: 'json', accent: '#57a4f0', open: 'dossier' },
  { name: 'README.md', meta: 'docs', kind: 'md', accent: '#a1a1aa', open: 'about' },
];

/* ------------------------------------------------------------------ pieces */

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
      <span className="wallpaper__word" aria-hidden="true">SPANDR</span>
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
        ['About SPANDR', 'about'], ['—'], ['New analysis', 'workspace'], ['Open evidence', 'files'],
        ['—'], ['Restart session', 'restart'], ['Lock desktop', 'lock'],
      ],
    },
    File: {
      label: 'File',
      items: [
        ['New analysis', 'workspace'], ['Open evidence…', 'files'], ['Detonate a link', 'sandbox'],
        ['—'], ['Print dossier', 'dossier'], ['Close window', 'close'],
      ],
    },
    Analysis: {
      label: 'Analysis',
      items: [
        ['Workspace', 'workspace'], ['Sandbox VM', 'sandbox'], ['MITRE mapping', 'mitre'], ['Dossier & containment', 'dossier'],
      ],
    },
    View: {
      label: 'View',
      items: [['Toggle full screen', 'fullscreen'], ['Terminal', 'terminal'], ['—'], ['Open repository', 'repo']],
    },
    Help: {
      label: 'Help',
      items: [['About SPANDR', 'about'], ['Documentation', 'docs'], ['Report a finding', 'issues']],
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
            {key === 'spandr' ? <><span className="menu-brand__mark" />SPANDR</> : value.label}
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

function DesktopIcons({ onOpen, onContext }) {
  const [selected, setSelected] = useState(null);
  return (
    <div className="desktop-icons">
      {DESKTOP_FILES.map((file) => (
        <button
          key={file.name}
          type="button"
          className={`file-tile ${selected === file.name ? 'is-selected' : ''}`}
          onClick={() => setSelected(file.name)}
          onDoubleClick={() => onOpen(file.open)}
          onContextMenu={(event) => { event.preventDefault(); onContext?.({ x: event.clientX, y: event.clientY }); }}
          title={`Double-click to open ${file.name}`}
        >
          <span
            className={`doc ${file.kind === 'pdf' ? 'doc--red' : ''}`}
            data-ext={file.kind.toUpperCase()}
            style={{ '--doc-accent': file.accent }}
          >
            <span className="doc__lines"><i /><i /><i /></span>
          </span>
          <span className="file-tile__label">{file.name}</span>
          <span className="file-tile__meta">{file.meta}</span>
        </button>
      ))}
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
    ['About SPANDR', () => onOpen('about')],
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
  const items = ['workspace', 'sandbox', 'files', 'terminal', 'mitre', 'dossier'];
  return (
    <div className="dock-wrap">
      <nav className="dock" aria-label="Applications">
        {items.map((id) => {
          const app = APPS[id];
          const Icon = app.icon;
          return (
            <button
              key={id}
              type="button"
              className="dock__item"
              style={{ background: app.dock }}
              data-label={app.title}
              aria-label={app.title}
              onClick={() => onOpen(id)}
            >
              <Icon />
              {openIds.includes(id) ? <span className="dock__dot" /> : null}
            </button>
          );
        })}
        <span className="dock__sep" />
        <a className="dock__item" style={{ background: 'linear-gradient(160deg,#2c2f36,#0f1012)' }} data-label="Repository" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Repository">
          <Github />
        </a>
        <button className="dock__item dock__trash" data-label="About" aria-label="About" onClick={() => onOpen('about')}>
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
        <div className="boot__mark" />
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
      open('workspace');
      if (window.innerWidth >= 780) open('sandbox');
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
        width = Math.min(width, Math.round(vw * 0.53));
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
    if (id === 'workspace') return <WorkspaceApp />;
    if (id === 'sandbox') return <SandboxApp />;
    if (id === 'files') return (
      <FilesApp
        openFile={(file) => {
          if (file?.kind === 'terminal') open('terminal');
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
      <Menubar onAction={action} onOpen={open} activeTitle={activeWindow?.title} quickOpen={quickOpen} setQuickOpen={setQuickOpen} />
      {quickOpen ? <QuickPanel onAction={action} onOpen={open} onClose={() => setQuickOpen(false)} /> : null}
      <div
        onPointerDown={() => setQuickOpen(false)}
        onContextMenu={(event) => { event.preventDefault(); setCtxMenu({ x: event.clientX, y: event.clientY }); }}
        style={{ position: 'absolute', inset: '32px 0 0', zIndex: 1 }}
        aria-hidden="true"
      />
      <DesktopIcons onOpen={open} onContext={(at) => setCtxMenu(at)} />
      {ctxMenu ? <DesktopMenu at={ctxMenu} onClose={() => setCtxMenu(null)} onAction={action} onOpen={open} /> : null}

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
          >
            {renderApp(win.id)}
          </Window>
        ))}
      </div>

      <Dock onOpen={open} openIds={windows.map((win) => win.id)} />

      {locked && (
        <div className="boot" style={{ opacity: 1, visibility: 'visible' }}>
          <div className="boot__inner">
            <div className="boot__mark" />
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
