import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, Beaker, FileBarChart, FilePlus2, FolderOpen, Github, Globe2,
  LayoutDashboard, Link2, LockKeyhole, Menu, MonitorPlay, Moon, Plus,
  Settings, ShieldCheck, Sun, X,
} from 'lucide-react';
import { useForensicStore } from './store/useForensicStore';
import { BrandMark } from './components/WorkspaceUI';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import CasesPage from './pages/CasesPage';
import SamplesPage from './pages/SamplesPage';
import UrlLabPage from './pages/UrlLabPage';
import SandboxPage from './pages/SandboxPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

const NAVIGATION = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'analysis', label: 'New analysis', icon: FilePlus2 },
      { id: 'cases', label: 'Cases', icon: FolderOpen, count: true },
    ],
  },
  {
    label: 'Investigate',
    items: [
      { id: 'url-lab', label: 'URL Lab', icon: Link2 },
      { id: 'sandbox', label: 'Web Computer', icon: MonitorPlay },
      { id: 'samples', label: 'Sample library', icon: Beaker },
    ],
  },
  {
    label: 'Output',
    items: [
      { id: 'reports', label: 'Case report', icon: FileBarChart },
      { id: 'settings', label: 'Settings & privacy', icon: Settings },
    ],
  },
];

const ROUTES = Object.fromEntries(NAVIGATION.flatMap((group) => group.items.map((item) => [item.id, item])));
const MOBILE_ROUTES = ['overview', 'analysis', 'cases', 'sandbox'];

function routeFromHash() {
  const value = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return ROUTES[value] ? value : 'overview';
}

function useMobileLayout() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.('(max-width: 780px)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 780px)');
    const update = () => setIsMobile(query.matches);
    update();
    if (query.addEventListener) query.addEventListener('change', update);
    else query.addListener(update);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', update);
      else query.removeListener(update);
    };
  }, []);
  return isMobile;
}

function useRuntimeHealth() {
  const [health, setHealth] = useState({ status: 'checking' });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    (async () => {
      try {
        const response = await fetch('/api/v1/health', { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Health endpoint returned ${response.status}`);
        const payload = await response.json();
        setHealth(payload);
      } catch {
        setHealth({ status: 'unavailable', backend_connected: false, verification_capability: {} });
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  return health;
}

export default function App() {
  const {
    cases, storageStatus, resetResult, setInputMode, selectCase,
  } = useForensicStore();
  const [route, setRoute] = useState(routeFromHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('spandr-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const health = useRuntimeHealth();
  const isMobile = useMobileLayout();
  const mainRef = useRef(null);
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.history.replaceState(null, '', '#/overview');
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#05070a' : '#f5f8fc');
    try { localStorage.setItem('spandr-theme', theme); } catch { /* preference persistence is optional */ }
  }, [theme]);

  useEffect(() => {
    if (!mobileOpen || !isMobile) return undefined;
    const sidebar = sidebarRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar?.querySelector('.sidebar-close')?.focus({ preventScroll: true });

    const trapFocus = (event) => {
      if (event.key !== 'Tab' || !sidebar) return;
      const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', trapFocus);
      menuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [isMobile, mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    mainRef.current?.focus({ preventScroll: true });
    document.title = `${ROUTES[route]?.label || 'Workspace'} · SUDO SPANDR`;
  }, [route]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        resetResult();
        setInputMode('email_file');
        window.location.hash = '/analysis';
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [resetResult, setInputMode]);

  const navigate = useCallback((next) => {
    if (!ROUTES[next]) return;
    if (route === next) {
      mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileOpen(false);
      return;
    }
    window.location.hash = `/${next}`;
  }, [route]);

  const startAnalysis = useCallback((mode = 'email_file') => {
    resetResult();
    setInputMode(mode);
    navigate('analysis');
  }, [navigate, resetResult, setInputMode]);

  const viewCase = useCallback((caseId) => {
    if (selectCase(caseId)) navigate('analysis');
  }, [navigate, selectCase]);

  const page = (() => {
    if (route === 'analysis') return <AnalysisPage onNavigate={navigate} />;
    if (route === 'cases') return <CasesPage onViewCase={viewCase} onStart={startAnalysis} />;
    if (route === 'samples') return <SamplesPage onAnalyzed={() => navigate('analysis')} />;
    if (route === 'url-lab') return <UrlLabPage onNavigate={navigate} />;
    if (route === 'sandbox') return <SandboxPage onNavigate={navigate} onViewCase={viewCase} health={health} />;
    if (route === 'reports') return <ReportsPage onStart={startAnalysis} />;
    if (route === 'settings') return <SettingsPage theme={theme} setTheme={setTheme} health={health} />;
    return <DashboardPage onStart={startAnalysis} onNavigate={navigate} onViewCase={viewCase} health={health} />;
  })();

  const currentRoute = ROUTES[route] || ROUTES.overview;

  return (
    <div className="prod-app">
      <a className="skip-link" href="#main-workspace">Skip to main content</a>
      {mobileOpen ? <button type="button" tabIndex={-1} className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}

      <aside
        id="workspace-sidebar"
        ref={sidebarRef}
        className={`app-sidebar ${mobileOpen ? 'is-open' : ''}`}
        role={isMobile && mobileOpen ? 'dialog' : undefined}
        aria-modal={isMobile && mobileOpen ? true : undefined}
        aria-label="Workspace navigation"
        inert={isMobile && !mobileOpen ? '' : undefined}
      >
        <div className="sidebar-brand">
          <span className="sidebar-brand__mark"><BrandMark size={35} /></span>
          <div><strong>SUDO SPANDR</strong><span>SentinelMail workspace</span></div>
          <button type="button" className="sidebar-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={19} /></button>
        </div>

        <button type="button" className="sidebar-new" onClick={() => startAnalysis('email_file')}><Plus size={17} />New investigation<span>Alt N</span></button>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {NAVIGATION.map((group) => (
            <div className="sidebar-nav__group" key={group.label}>
              <span className="sidebar-nav__label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`sidebar-nav__item ${active ? 'is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => navigate(item.id)}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                    {item.count && cases.length ? <b>{cases.length}</b> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-runtime">
          <div className="sidebar-runtime__head"><span><Activity size={15} /></span><strong>Local workspace</strong><i /></div>
          <p>{storageStatus === 'ready' ? 'Parser ready · cases saved on device' : storageStatus === 'loading' ? 'Restoring cases from this device…' : 'Parser ready · memory fallback active'}</p>
          <div><span>Device storage</span><b className={storageStatus === 'ready' ? 'is-ready' : ''}>{storageStatus === 'loading' ? 'Restoring…' : storageStatus === 'ready' ? 'Saved locally' : 'Check settings'}</b></div>
        </div>

        <div className="sidebar-footer">
          <span><LockKeyhole size={15} /></span>
          <div><strong>Private device storage</strong><small>No remote case database</small></div>
          <a href="https://github.com/sudonishant/SUDO-SPANDR" target="_blank" rel="noreferrer" aria-label="Open GitHub repository"><Github size={16} /></a>
        </div>
      </aside>

      <div className="app-frame" inert={isMobile && mobileOpen ? '' : undefined}>
        <header className="app-topbar">
          <div className="topbar-left">
            <button ref={menuButtonRef} type="button" className="mobile-menu" aria-label="Open navigation" aria-controls="workspace-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <span className="mobile-brand"><BrandMark size={27} /></span>
            <div className="breadcrumb"><span>SentinelMail</span><i>/</i><strong>{currentRoute.label}</strong></div>
          </div>
          <div className="topbar-actions">
            <span className="local-ready"><i /><ShieldCheck size={14} />Local engine ready</span>
            <button type="button" className="theme-toggle" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button type="button" className="ui-button ui-button--primary topbar-new" aria-label="New analysis" onClick={() => startAnalysis('email_file')}><Plus size={16} /><span>New analysis</span></button>
          </div>
        </header>

        <main id="main-workspace" className="app-main" ref={mainRef} tabIndex={-1}>
          {page}
          <footer className="workspace-footer"><span>SUDO SPANDR · Evidence-based triage</span><span>Scores support review; they do not prove maliciousness or safety.</span></footer>
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation" inert={isMobile && mobileOpen ? '' : undefined}>
        {MOBILE_ROUTES.map((id) => {
          const item = ROUTES[id];
          const Icon = item.icon;
          return <button type="button" key={id} className={route === id ? 'is-active' : ''} aria-current={route === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} /><span>{id === 'analysis' ? 'Analyze' : id === 'overview' ? 'Home' : id === 'sandbox' ? 'Computer' : item.label}</span></button>;
        })}
      </nav>
    </div>
  );
}
