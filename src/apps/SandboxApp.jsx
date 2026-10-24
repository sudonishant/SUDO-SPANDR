import React from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Cpu, Crosshair, Globe, Loader2, Lock, Power, RotateCw,
  ShieldAlert, TerminalSquare, Wifi, WifiOff, X,
} from 'lucide-react';
import { staticUrlChecks } from '../lib/urlChecks';

const GUEST_APPS = {
  browser: { title: 'Chromium · air-gapped', short: 'Chromium', icon: Globe, x: 33, y: 5, w: 61, h: 63 },
  lab: { title: 'Threat Lab · attachment & link analysis', short: 'ThreatLab', icon: Crosshair, x: 2, y: 5, w: 48, h: 43 },
  monitor: { title: 'System Monitor', short: 'Monitor', icon: Activity, x: 57, y: 20, w: 40, h: 52 },
  terminal: { title: 'guest@spandr-sbx:~', short: 'Terminal', icon: TerminalSquare, x: 2, y: 50, w: 47, h: 43 },
};

const SAMPLE_TARGET = 'http://paypa1-secure.com/verify?id=8842';

const BOOT_LINES = [
  'spandr virtual machine · qemu-kvm boot',
  'kernel 6.8.0-hardened · clocksource tsc',
  'net: eth0 10.0.2.15/24 · egress blocked by policy',
  'mounting evidence ro /evidence',
  'starting gui session · chromium sandboxed',
];

function stamp(date = new Date()) {
  return date.toLocaleTimeString('en-GB', { hour12: false });
}

function useGuestClock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function useResources(running) {
  const [res, setRes] = React.useState({ cpu: 7, mem: 22, net: 0, uptime: 0 });
  React.useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setRes((prev) => ({
        cpu: Math.max(3, Math.min(96, Math.round(prev.cpu + (Math.random() - 0.5) * (running ? 26 : 7)))),
        mem: Math.max(18, Math.min(84, Math.round(prev.mem + (Math.random() - 0.5) * 5))),
        net: running ? Math.min(100, prev.net + Math.round(Math.random() * 22)) : Math.max(0, prev.net - 9),
        uptime: Math.floor((Date.now() - started) / 1000),
      }));
    }, 1600);
    return () => clearInterval(timer);
  }, [running]);
  return res;
}

function Meters({ res, running }) {
  const rows = [
    ['cpu', res.cpu, `${res.cpu}%`],
    ['mem', res.mem, `${res.mem}%`],
    ['net', res.net, res.net ? `${res.net} kbps` : 'idle'],
  ];
  return (
    <div className="vm__meters">
      {rows.map(([key, value, label]) => (
        <div className="vm__meter" key={key}>
          <span>{key}</span>
          <div className="vm__meter-bar"><i style={{ width: `${value}%`, background: key === 'net' && running ? 'linear-gradient(90deg,#f7ce46,var(--red))' : undefined }} /></div>
          <b>{label}</b>
        </div>
      ))}
    </div>
  );
}

export default function SandboxApp() {
  const clock = useGuestClock();
  const screenRef = React.useRef(null);
  const dragRef = React.useRef(null);

  const [url, setUrl] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle | loading | done | unavailable
  const [local, setLocal] = React.useState(null);
  const [remote, setRemote] = React.useState(null);
  const [frameHtml, setFrameHtml] = React.useState('');
  const [frameLoading, setFrameLoading] = React.useState(false);
  const [frameError, setFrameError] = React.useState('');
  const [frameTarget, setFrameTarget] = React.useState('');
  const [log, setLog] = React.useState([{ t: stamp(), text: 'vm booted · network namespace isolated' }]);
  const [booted, setBooted] = React.useState(false);
  const [openApps, setOpenApps] = React.useState(() => (
    window.innerWidth < 780
      ? { browser: true, monitor: false, terminal: false, lab: false }
      : { browser: true, monitor: false, terminal: true, lab: false }
  ));
  const [pos, setPos] = React.useState(() => {
    const initial = {};
    Object.entries(GUEST_APPS).forEach(([id, app]) => { initial[id] = { x: app.x, y: app.y }; });
    return initial;
  });
  const [zOrder, setZOrder] = React.useState({ browser: 2, terminal: 3, monitor: 1, lab: 0 });
  const [activeGuest, setActiveGuest] = React.useState('browser');
  const [startOpen, setStartOpen] = React.useState(false);
  const [termLines, setTermLines] = React.useState([
    { tone: 'dim', text: 'spandr-sbx guest shell · type "help"' },
  ]);
  const [termValue, setTermValue] = React.useState('');
  const termInput = React.useRef(null);

  /* threat lab state */
  const [labTab, setLabTab] = React.useState('auto');
  const [labInput, setLabInput] = React.useState('');
  const [labUrls, setLabUrls] = React.useState('');
  const [labFile, setLabFile] = React.useState(null);
  const [labBusy, setLabBusy] = React.useState(false);
  const [labOut, setLabOut] = React.useState('');

  const res = useResources(state === 'loading' || state === 'done');

  const addLog = React.useCallback((text) => {
    setLog((lines) => [...lines, { t: stamp(), text }].slice(-40));
  }, []);

  React.useEffect(() => {
    setBooted(false);
    const timer = setTimeout(() => {
      setBooted(true);
      addLog('gui session ready · chromium isolated profile');
    }, 1500);
    return () => clearTimeout(timer);
  }, [addLog]);

  React.useEffect(() => {
    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = screenRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = ((event.clientX - drag.startX) / rect.width) * 100;
      const dy = ((event.clientY - drag.startY) / rect.height) * 100;
      const x = Math.min(Math.max(drag.originX + dx, 0), 100 - drag.w);
      const y = Math.min(Math.max(drag.originY + dy, 0), 100 - drag.h);
      setPos((all) => ({ ...all, [drag.id]: { x, y } }));
    };
    const onUp = () => { dragRef.current = null; document.body.style.cursor = ''; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const focusGuest = (id) => {
    setActiveGuest(id);
    setZOrder((all) => ({ ...all, [id]: Math.max(0, ...Object.values(all)) + 1 }));
  };

  const openGuest = (id) => {
    setOpenApps((all) => ({ ...all, [id]: true }));
    focusGuest(id);
    setStartOpen(false);
  };

  const closeGuest = (id) => {
    setOpenApps((all) => ({ ...all, [id]: false }));
  };

  const startDragGuest = (id, event) => {
    if (event.target.closest('button')) return;
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect) return;
    focusGuest(id);
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos[id].x,
      originY: pos[id].y,
      w: GUEST_APPS[id].w,
      h: GUEST_APPS[id].h,
    };
    document.body.style.cursor = 'grabbing';
  };

  /* ------------------------------------------------------------- analysis */

  const detonate = async (rawTarget) => {
    const target = (rawTarget ?? url).trim();
    if (rawTarget != null) setUrl(target);
    const checks = staticUrlChecks(target);
    setLocal(checks);
    setRemote(null);
    setFrameHtml('');
    setFrameTarget('');
    setFrameError('');
    openGuest('browser');
    setTermLines((lines) => [...lines, { tone: 'prompt', text: `$ detonate ${target}` }]);
    if (checks.error) {
      setState('idle');
      setTermLines((lines) => [...lines, { tone: 'bad', text: checks.error }]);
      return;
    }
    setState('loading');
    addLog(`resolving target ${checks.host}`);
    setTermLines((lines) => [...lines, { tone: 'dim', text: `resolving ${checks.host} inside guest…` }]);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/v1/sandbox/detonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setRemote(payload);
      setState('done');
      addLog(`detonation ok · mode=${payload.mode || 'unknown'} · risk=${payload.risk_score ?? 'n/a'}`);
      setTermLines((lines) => [...lines, { tone: 'ok', text: `detonation returned · risk ${payload.risk_score ?? 'n/a'} / 100` }]);
    } catch (error) {
      setRemote({ error: error?.message || 'unreachable' });
      setState('unavailable');
      addLog(`detonation failed · ${error?.message || 'unreachable'} — no fetch performed`);
      setTermLines((lines) => [...lines, { tone: 'bad', text: `container unreachable (${error?.message || 'error'}) — static checks only` }]);
    }
  };

  const renderSnapshot = async () => {
    if (!local?.href) {
      setTermLines((lines) => [...lines, { tone: 'bad', text: 'nothing to render — detonate a URL first' }]);
      return;
    }
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    setFrameLoading(true);
    setFrameError('');
    setFrameTarget(local.href);
    openGuest('browser');
    addLog('requesting sanitised DOM snapshot from preview-frame');
    setTermLines((lines) => [...lines, { tone: 'prompt', text: '$ render --isolated' }]);
    try {
      const response = await fetch(`${base}/api/v1/sandbox/preview-frame?url=${encodeURIComponent(local.href)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      setFrameHtml(html);
      addLog(`snapshot received · ${(html.length / 1024).toFixed(1)} KB of sanitised HTML`);
      setTermLines((lines) => [...lines, { tone: 'ok', text: `snapshot loaded · ${(html.length / 1024).toFixed(1)} KB` }]);
    } catch (error) {
      setFrameHtml('');
      setFrameError(error?.message || 'unreachable');
      addLog(`snapshot unavailable · ${error?.message || 'unreachable'}`);
      setTermLines((lines) => [...lines, { tone: 'bad', text: `preview service unavailable (${error?.message || 'error'})` }]);
    } finally {
      setFrameLoading(false);
    }
  };

  /* ------------------------------------------------------------- cyberlab */

  const labCall = React.useCallback(async (path, body) => {
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const isForm = body instanceof FormData;
    const response = await fetch(`${base}/api/v1/sandbox/lab/${path}`, {
      method: 'POST',
      headers: isForm ? {} : { 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }, []);

  const fmtRisk = (score) => `${score}/100`;

  const fmtAttachmentReport = (r) => {
    const lines = [];
    lines.push(`file      ${r.filename} · ${r.size_bytes} bytes`);
    lines.push(`hashes    md5 ${r.md5}`);
    lines.push(`          sha1 ${r.sha1}`);
    lines.push(`          sha256 ${r.sha256}`);
    lines.push(`format    ${r.format?.type || 'unknown'} · magic ${r.magic_hex}`);
    if (r.carver?.detected_type) lines.push(`carver    ${r.carver.detected_type} · entropy ${(r.carver.shannon_entropy ?? 0).toFixed(2)}`);
    if (r.format?.members?.length) lines.push(`members   ${r.format.members.slice(0, 10).join(', ')}`);
    if (r.format?.risky_members?.length) lines.push(`RISKY     ${r.format.risky_members.join(', ')}`);
    if (r.format?.macro_markers?.length) lines.push(`macros    ${r.format.macro_markers.join(', ')}`);
    if (r.iocs?.urls?.length) lines.push(`embedded URLs\n  ${r.iocs.urls.slice(0, 8).join('\n  ')}`);
    if (r.suspicious_strings?.length) lines.push(`strings   ${r.suspicious_strings.join(', ')}`);
    if (r.tools?.file) lines.push(`file(1)   ${r.tools.file}`);
    if (r.tools?.binwalk) lines.push(`binwalk\n${r.tools.binwalk.split('\n').slice(0, 8).join('\n')}`);
    lines.push('');
    lines.push('findings');
    (r.findings || []).forEach((f) => lines.push(`  • ${f}`));
    lines.push('');
    lines.push(`RISK ${fmtRisk(r.risk_score)} — ${r.verdict}`);
    lines.push(r.disclaimer || '');
    return lines.join('\n');
  };

  const fmtLinkReport = (r) => {
    const lines = [];
    lines.push(`url       ${r.url}`);
    lines.push(`host      ${r.host} · resolved ${(r.resolved_ips || []).join(', ') || 'unresolved'}`);
    if (r.structure_signals?.length) lines.push(`structure ${r.structure_signals.join(' | ')}`);
    if (r.redirect_chain?.length) {
      lines.push('redirect chain');
      r.redirect_chain.forEach((h, i) => lines.push(`  ${i + 1}. [${h.status}] ${h.url}${h.location ? ` → ${h.location}` : ''}`));
    }
    if (r.page?.title) lines.push(`title     ${r.page.title}`);
    if (r.page?.password_field) lines.push('page      PASSWORD INPUT FIELD present');
    if (r.page?.obfuscation?.length) lines.push(`obfusc.   ${r.page.obfuscation.join(', ')}`);
    if (r.tls_cert) lines.push(`tls cert\n${r.tls_cert.split('\n').slice(0, 5).join('\n')}`);
    if (r.headers && Object.keys(r.headers).length) {
      lines.push('headers');
      Object.entries(r.headers).slice(0, 10).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
    }
    lines.push('');
    lines.push('findings');
    (r.findings || []).forEach((f) => lines.push(`  • ${f}`));
    lines.push('');
    lines.push(`RISK ${fmtRisk(r.risk_score)} — ${r.verdict}`);
    lines.push(r.disclaimer || '');
    return lines.join('\n');
  };

  const fmtTriageReport = (r) => {
    const lines = [];
    lines.push('══ AUTO TRIAGE · email threat lab ══');
    const m = r.meta || {};
    if (m.subject !== undefined) {
      lines.push(`from      ${m.from || '—'}`);
      lines.push(`subject   ${m.subject || '—'}`);
      lines.push(`date      ${m.date || '—'}`);
    }
    lines.push(`payload   ${m.attachments_found ?? 0} attachment(s) · ${m.links_found ?? 0} link(s)`);
    lines.push('');
    lines.push('summary');
    (r.summary || []).forEach((s) => lines.push(`  ▸ ${s}`));
    lines.push('');
    (r.attachments || []).forEach((a) => {
      lines.push(`──── attachment · ${a.filename} · risk ${fmtRisk(a.risk_score)} ────`);
      lines.push(fmtAttachmentReport(a));
      lines.push('');
    });
    (r.links || []).forEach((u) => {
      lines.push(`──── link · ${u.url} · risk ${fmtRisk(u.risk_score)} ────`);
      lines.push(fmtLinkReport(u));
      lines.push('');
    });
    lines.push(`AGGREGATE RISK ${fmtRisk(r.aggregate_risk || 0)} — ${r.verdict}`);
    lines.push('recommended actions');
    (r.recommended_actions || []).forEach((a) => lines.push(`  ✔ ${a}`));
    lines.push('');
    lines.push(r.disclaimer || '');
    return lines.join('\n');
  };

  const fileToB64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });

  const runLab = React.useCallback(async (kind) => {
    setLabBusy(true);
    setLabOut(`running ${kind} analysis…`);
    setTermLines((lines) => [...lines, { tone: 'prompt', text: `$ threat-lab ${kind}` }]);
    try {
      let payload;
      let text;
      if (kind === 'auto') {
        const body = { urls: labUrls.split(/[\s,]+/).filter(Boolean) };
        if (labFile) {
          const b64 = await fileToB64(labFile);
          const isEml = /\.(eml|msg)$/i.test(labFile.name);
          if (isEml) body.eml_b64 = b64;
          else body.files = [{ filename: labFile.name, file_b64: b64 }];
        }
        payload = await labCall('auto-triage', body);
        text = fmtTriageReport(payload);
      } else if (kind === 'attach') {
        if (!labFile) throw new Error('choose an attachment first');
        const b64 = await fileToB64(labFile);
        payload = await labCall('attachment', { filename: labFile.name, file_b64: b64 });
        text = fmtAttachmentReport(payload);
      } else if (kind === 'link') {
        if (!labInput.trim()) throw new Error('enter a URL first');
        payload = await labCall('url', { url: labInput.trim() });
        text = payload.error ? `error   ${payload.error}` : fmtLinkReport(payload);
      } else if (kind === 'pcap') {
        if (!labFile) throw new Error('choose a .pcap file first');
        const b64 = await fileToB64(labFile);
        payload = await labCall('pcap', { filename: labFile.name, file_b64: b64 });
        text = `engine  ${payload.engine || 'n/a'}\nfile    ${payload.name} · ${payload.size} bytes\n\n` +
          `dns\n${payload.dns || '(none)'}\n\nhttp\n${payload.http || '(none)'}\n\n` +
          `credentials\n${payload.credentials || '(none)'}\n\nconversations\n${payload.conversations || '(none)'}\n\n` +
          `flags\n${(payload.flags || []).join('\n') || '(none)'}`;
      }
      setLabOut(text);
      setTermLines((lines) => [...lines, { tone: 'ok', text: `${kind} analysis complete · see Threat Lab window` }]);
      return payload;
    } catch (error) {
      const message = error?.message || 'unreachable';
      setLabOut(`threat lab engine unavailable (${message})\nthe analysis pipeline needs the backend API.`);
      setTermLines((lines) => [...lines, { tone: 'bad', text: `threat lab unavailable (${message})` }]);
      return null;
    } finally {
      setLabBusy(false);
    }
  }, [labCall, labFile, labInput, labUrls, setTermLines]);

  const reboot = () => {
    setStartOpen(false);
    setBooted(false);
    addLog('guest reboot requested · replaying boot');
    setTermLines([{ tone: 'dim', text: 'rebooting guest…' }]);
    setTimeout(() => { setBooted(true); addLog('gui session ready · chromium isolated profile'); }, 1600);
  };

  /* ------------------------------------------------------------- terminal */

  const runCommand = (raw) => {
    const input = raw.trim();
    if (!input) return;
    setTermLines((lines) => [...lines, { tone: 'prompt', text: `guest@spandr-sbx:~$ ${input}` }]);
    const [name, ...rest] = input.split(/\s+/);
    const arg = rest.join(' ');
    const print = (text, tone = '') => setTermLines((lines) => [...lines, { text, tone }]);

    switch (name) {
      case 'help':
        print('guest: help · neofetch · ifconfig · ps · netstat · open <browser|lab|monitor|terminal> · detonate <url> · render · clear · reboot');
        print('threat lab: triage · link <url> · webchk <url> · hashid <hash> · crack <hash> · nmap <host> · dig|ping|whois|traceroute <host> · toolbox');
        break;
      case 'neofetch':
        print('spandr-sbx-01 · Debian 12 · kernel 6.8.0-hardened · chromium 131 · 1280x720 · egress BLOCKED', 'dim');
        print('cpu 2 vcpu · ram 2048 MB · disk /evidence ro', 'dim');
        break;
      case 'ifconfig':
        print('eth0  inet 10.0.2.15  netmask 255.255.255.0  mtu 1500  (gateway refuses forward)', 'dim');
        print('lo    inet 127.0.0.1  mtu 65536', 'dim');
        break;
      case 'ps':
        print('1 init · 42 watchdog · 128 chromium --no-sandbox-guard · 129 renderer · 210 guest-shell', 'dim');
        break;
      case 'netstat':
        print(`egress 0 KB in / 0 KB out · policy DROP · last target ${local?.host || 'none'}`, 'dim');
        break;
      case 'open':
        if (GUEST_APPS[arg]) { openGuest(arg); print(`opening ${arg}`, 'ok'); }
        else print('open: browser, monitor or terminal', 'bad');
        break;
      case 'detonate':
        if (!arg) print('usage: detonate <url>', 'bad');
        else detonate(arg);
        break;
      case 'render':
        renderSnapshot();
        break;
      case 'toolbox':
        labCall('toolbox').then((t) => {
          print(`guest image ${t.guest_image} · private targets ${t.private_targets_allowed ? 'ALLOWED (lab mode)' : 'blocked'}`, 'dim');
          Object.entries(t.tools || {}).forEach(([name, info]) => {
            print(`  ${name.padEnd(11)} ${info.available ? 'real binary ✓' : 'builtin engine'}`, info.available ? 'ok' : 'dim');
          });
        }).catch((error) => print(`toolbox unavailable (${error?.message || 'error'})`, 'bad'));
        break;
      case 'triage':
        setLabTab('auto'); openGuest('lab');
        print('auto triage: drop a .eml / attachment + links into the Threat Lab window', 'ok');
        break;
      case 'nmap':
        if (!arg) { print('usage: nmap <host>', 'bad'); break; }
        labCall('portscan', { target: arg, mode: 'quick' }).then((r) => {
          if (r.error) { print(r.error, 'bad'); return; }
          (r.open || []).forEach((p) => print(`${String(p.port).padEnd(6)}${p.proto} open  ${p.service || ''} ${p.product || ''}`.trimEnd(), 'ok'));
          if (!(r.open || []).length) print('no open ports in quick scan', 'dim');
          print(`engine: ${r.engine || 'n/a'}`, 'dim');
        }).catch((error) => print(`scan failed (${error?.message || 'error'})`, 'bad'));
        break;
      case 'ping':
      case 'dig':
      case 'whois':
      case 'traceroute':
        if (!arg) { print(`usage: ${name} <host>`, 'bad'); break; }
        labCall('recon', { target: arg, action: name }).then((r) => {
          if (r.error) { print(r.error, 'bad'); return; }
          (r.output || '').split('\n').slice(0, 14).forEach((line) => print(line, 'dim'));
          print(`engine: ${r.engine || 'n/a'}`, 'ok');
        }).catch((error) => print(`recon failed (${error?.message || 'error'})`, 'bad'));
        break;
      case 'hashid':
      case 'crack':
        if (!arg) { print(`usage: ${name} <hash>`, 'bad'); break; }
        labCall('hashcrack', { hash: arg }).then((r) => {
          const types = (r.identify || []).map((t) => t.type).join(', ');
          print(`hash type: ${types || 'unknown'}`, 'dim');
          if (r.cracked) print(`CRACKED → ${r.password}  (${r.engine})`, 'ok');
          else print(`not cracked · ${r.message || ''}`, 'bad');
        }).catch((error) => print(`hash engine failed (${error?.message || 'error'})`, 'bad'));
        break;
      case 'webchk':
      case 'link':
        if (!arg) { print(`usage: ${name} <url>`, 'bad'); break; }
        setLabInput(arg); setLabTab('link'); openGuest('lab');
        labCall('url', { url: arg }).then((r) => {
          if (r.error) { print(r.error, 'bad'); return; }
          print(`RISK ${r.risk_score}/100 — ${r.verdict}`, r.risk_score >= 40 ? 'bad' : 'ok');
          (r.findings || []).slice(0, 8).forEach((f) => print(`  • ${f}`, 'dim'));
        }).catch((error) => print(`link analysis failed (${error?.message || 'error'})`, 'bad'));
        break;
      case 'clear':
        setTermLines([]);
        break;
      case 'reboot':
        reboot();
        break;
      case 'about':
        print('guest image built for SUDO SPANDR · the target never sees your browser', 'dim');
        break;
      default:
        print(`${name}: command not found`, 'bad');
    }
  };

  /* ----------------------------------------------------------------- view */

  const risk = remote?.risk_score;
  const flags = [...(local?.flags || []), ...(remote?.heuristic_flags || [])];
  const host = local?.host || 'no target';

  const renderGuestBody = (id) => {
    if (id === 'browser') {
      return (
        <div className="gwin__browser">
          <div className="gwin__tabs">
            <span className="gwin__tab"><Lock />{frameTarget ? host : 'about:blank'}</span>
            <span className="gwin__tab-dim">+</span>
          </div>
          <form
            className="gwin__address"
            onSubmit={(event) => { event.preventDefault(); detonate(); }}
          >
            {local?.protocol === 'http:' ? <WifiOff className="lock warn" /> : <Lock className="lock" />}
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://suspicious-link.example/login"
              spellCheck="false"
              aria-label="URL to detonate"
            />
            <button type="submit" className="btn btn--primary btn--xs" disabled={state === 'loading' || !url.trim()}>
              {state === 'loading' ? <Loader2 size={10} className="spin" /> : <ShieldAlert size={10} />}
              {state === 'loading' ? 'Running' : 'Detonate'}
            </button>
            <button type="button" className="btn btn--xs" onClick={renderSnapshot} disabled={!local?.href}>Render</button>
          </form>
          <div className="gwin__page">
            {frameError ? (
              <div className="gwin__splash">
                <AlertTriangle size={15} style={{ color: '#ff6b7a' }} />
                <strong>Snapshot unavailable</strong>
                <p>The preview service did not return a page ({frameError}). Static URL checks are still real; nothing was fetched from your browser.</p>
                <button type="button" className="btn btn--xs" onClick={renderSnapshot}><RotateCw size={10} /> Retry</button>
              </div>
            ) : frameHtml ? (
              <iframe title="Isolated detonation preview" srcDoc={frameHtml} sandbox="allow-scripts" referrerPolicy="no-referrer" />
            ) : frameLoading ? (
              <div className="gwin__splash"><Loader2 size={15} className="spin" style={{ color: '#ff97a3' }} /><strong>Fetching snapshot</strong><p>The guest requests the page; your browser never contacts the target.</p></div>
            ) : (
              <div className="gwin__splash">
                <Globe size={15} style={{ color: '#ff97a3' }} />
                <strong>{local?.href ? 'Ready to render' : 'Isolated browser'}</strong>
                <p>{local?.href ? 'Detonation checks are in. Render the sanitised DOM snapshot inside this guest window.' : 'Type a URL above. Static checks run in this tab; telemetry comes from the container. The guest has no route to the internet.'}</p>
                <button type="button" className="btn btn--xs" onClick={() => setUrl(SAMPLE_TARGET)}>Use sample target</button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (id === 'monitor') {
      return (
        <div className="gwin__monitor">
          <div className="gwin__specs">
            <span>host<b>spandr-sbx-01</b></span>
            <span>kernel<b>6.8.0-hardened</b></span>
            <span>chromium<b>131.0.6778</b></span>
            <span>display<b>1280 × 720</b></span>
            <span>egress<b style={{ color: '#9fe9bd' }}>BLOCKED</b></span>
          </div>
          <div className="gwin__risk">
            <strong style={{ color: risk >= 60 ? '#ff6b7a' : risk >= 30 ? '#f3d37a' : '#f4f1ef' }}>{risk != null ? risk : '—'}</strong>
            <small>risk / 100</small>
            <div className="gwin__riskbar"><i style={{ width: `${risk ?? 0}%` }} /></div>
          </div>
          <div className="gwin__flags">
            {flags.length ? flags.map((flag) => (
              <span className="gwin__flag" key={flag}><AlertTriangle size={9} />{flag}</span>
            )) : (
              <span className="gwin__flag ok"><CheckCircle2 size={9} />{local ? 'No structural warning (not a reputation verdict)' : 'No target loaded yet'}</span>
            )}
          </div>
        </div>
      );
    }

    if (id === 'lab') {
      return (
        <div className="gwin__lab">
          <div className="gwin__lab-tabs">
            {[['auto', '⚡ Auto Triage'], ['attach', '📎 Attachment'], ['link', '🔗 Link'], ['pcap', '📡 PCAP']].map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={`gwin__lab-tab ${labTab === key ? 'is-on' : ''}`}
                onClick={() => setLabTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="gwin__lab-form">
            {labTab === 'auto' && (
              <>
                <input
                  type="file"
                  accept=".eml,.msg,.txt,.pdf,.doc,.docx,.xls,.xlsx,.zip,.exe,.bin,*/*"
                  onChange={(event) => setLabFile(event.target.files?.[0] || null)}
                  aria-label="Email or attachment for auto triage"
                />
                <input
                  value={labUrls}
                  onChange={(event) => setLabUrls(event.target.value)}
                  placeholder="…or paste suspicious links (space/comma separated)"
                  spellCheck="false"
                  aria-label="Links for auto triage"
                />
              </>
            )}
            {labTab === 'attach' && (
              <input
                type="file"
                onChange={(event) => setLabFile(event.target.files?.[0] || null)}
                aria-label="Attachment to analyse"
              />
            )}
            {labTab === 'link' && (
              <input
                value={labInput}
                onChange={(event) => setLabInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') runLab('link'); }}
                placeholder="https://suspicious-link.example/login"
                spellCheck="false"
                aria-label="Link to analyse"
              />
            )}
            {labTab === 'pcap' && (
              <input
                type="file"
                accept=".pcap,.pcapng,.cap"
                onChange={(event) => setLabFile(event.target.files?.[0] || null)}
                aria-label="PCAP capture"
              />
            )}
            <button type="button" className="btn btn--primary btn--xs" disabled={labBusy} onClick={() => runLab(labTab)}>
              {labBusy ? <Loader2 size={10} className="spin" /> : <Crosshair size={10} />}
              {labBusy ? 'Analysing' : labTab === 'auto' ? 'Auto-Analyse' : 'Analyse'}
            </button>
            <button
              type="button"
              className="btn btn--xs"
              onClick={() => labCall('toolbox').then((t) => {
                const rows = Object.entries(t.tools || {})
                  .map(([name, info]) => `${name.padEnd(11)} ${info.available ? 'real binary ✓' : 'builtin engine'}`);
                setLabOut(`guest image  ${t.guest_image}\nanalysis engines\n\n${rows.join('\n')}`);
              }).catch((error) => setLabOut(`toolbox unavailable (${error?.message || 'error'})`))}
            >
              Toolbox
            </button>
          </div>
          <pre className="gwin__lab-out">{labOut || 'Threat Lab · real-PC attachment & link analysis\n\n  ⚡ Auto Triage   drop a suspicious .eml (or file + links) → attachments and links are\n                    carved, hashed, dissected and scored in one automated pass\n  📎 Attachment    deep static analysis: magic bytes, entropy, macros, PE/PDF/ZIP dives,\n                    embedded IOCs, exiftool + binwalk\n  🔗 Link          structure heuristics (typosquat/punycode), DNS, redirect chain,\n                    credential-form sniff, TLS certificate\n  📡 PCAP          traffic evidence: DNS, HTTP, credentials\n\n  nothing is executed — every verdict is labelled with its uncertainty'}</pre>
        </div>
      );
    }

    return (
      <div className="gwin__term" onClick={() => termInput.current?.focus()}>
        <div className="gwin__term-out">
          {termLines.map((line, index) => (
            <div key={`${index}-${line.text}`} className={line.tone ? `tone-${line.tone}` : ''}>{line.text}</div>
          ))}
        </div>
        <form
          className="gwin__term-in"
          onSubmit={(event) => { event.preventDefault(); runCommand(termValue); setTermValue(''); }}
        >
          <span>guest@spandr-sbx:~$</span>
          <input
            ref={termInput}
            value={termValue}
            onChange={(event) => setTermValue(event.target.value)}
            spellCheck="false"
            aria-label="Guest terminal input"
          />
        </form>
      </div>
    );
  };

  return (
    <div className="vm">
      <div className="vm__main">
        <div className="vm__hostbar">
          <span className="vm__machine"><Cpu size={11} /> spandr-sbx-01</span>
          <span className="chip chip--green" style={{ fontSize: 8.5 }}><Wifi size={9} /> guest online</span>
          <span className="chip" style={{ fontSize: 8.5 }}>egress blocked</span>
          <span className="spacer" />
          <button type="button" className="btn btn--xs" onClick={renderSnapshot} disabled={!local?.href}><RotateCw size={10} /> Render</button>
          <button type="button" className="btn btn--xs" onClick={reboot}><Power size={10} /> Reboot</button>
        </div>

        <div
          className="vm__screen"
          ref={screenRef}
          onPointerDown={() => { setStartOpen(false); }}
        >
          <div className="vm__screen-bg" />

          {openApps.browser || openApps.monitor || openApps.terminal || openApps.lab ? null : (
            <div className="vm__hint">Open an app from the taskbar</div>
          )}

          <div className="vm__deskicons">
            {Object.entries(GUEST_APPS).map(([id, app]) => {
              const Icon = app.icon;
              return (
                <button type="button" key={id} className="vm__deskicon" onDoubleClick={() => openGuest(id)} onClick={() => openGuest(id)}>
                  <span><Icon /></span>
                  {app.short}
                </button>
              );
            })}
          </div>

          {Object.entries(GUEST_APPS).filter(([id]) => openApps[id]).map(([id, app]) => {
            const Icon = app.icon;
            const active = activeGuest === id;
            return (
              <section
                key={id}
                className={`gwin ${active ? 'is-active' : ''}`}
                style={{ left: `${pos[id].x}%`, top: `${pos[id].y}%`, width: `${app.w}%`, height: `${app.h}%`, zIndex: zOrder[id] }}
                onPointerDown={() => focusGuest(id)}
                aria-label={app.title}
              >
                <header className="gwin__bar" onPointerDown={(event) => startDragGuest(id, event)}>
                  <span className="gwin__lights"><i /><i /><i /></span>
                  <span className="gwin__title"><Icon /> {app.title}</span>
                  <span className="spacer" />
                  <button type="button" className="gwin__close" aria-label={`Close ${app.short}`} onClick={() => closeGuest(id)}><X size={9} /></button>
                </header>
                <div className="gwin__body">{renderGuestBody(id)}</div>
              </section>
            );
          })}

          {startOpen ? (
            <div className="vm__startmenu" onPointerDown={(event) => event.stopPropagation()}>
              <div className="vm__startmenu-head">spandr-sbx-01</div>
              <div className="vm__startmenu-grid">
                {Object.entries(GUEST_APPS).map(([id, app]) => {
                  const Icon = app.icon;
                  return (
                    <button type="button" key={id} className="vm__startapp" onClick={() => openGuest(id)}>
                      <span><Icon /></span>{app.short}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="vm__startpower" onClick={reboot}><Power size={10} /> Reboot guest</button>
            </div>
          ) : null}

          <div className="vm__taskbar">
            <button
              type="button"
              className="vm__start"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setStartOpen((open) => !open)}
            >
              <span className="vm__start-dot" /> Start
            </button>
            {Object.entries(GUEST_APPS).map(([id, app]) => {
              const Icon = app.icon;
              return (
                <button
                  type="button"
                  key={id}
                  className={`vm__task ${openApps[id] ? 'is-open' : ''} ${activeGuest === id && openApps[id] ? 'is-active' : ''}`}
                  onClick={() => (openApps[id] ? focusGuest(id) : openGuest(id))}
                >
                  <Icon /> {app.short}
                </button>
              );
            })}
            <span className="spacer" />
            {risk != null ? <span className={`vm__tray-chip ${risk >= 60 ? 'is-bad' : ''}`}>risk {risk}</span> : null}
            <span className="vm__tray">{state === 'unavailable' ? <WifiOff size={9} /> : <Wifi size={9} />} {stamp(clock)}</span>
          </div>

          {!booted ? (
            <div className="vm__boot">
              <div className="vm__boot-mark"><ShieldAlert size={16} /></div>
              <strong>spandr-sbx-01</strong>
              <div className="vm__boot-log">
                {BOOT_LINES.map((line, index) => (
                  <span key={line} style={{ animationDelay: `${index * 0.22}s` }}>[ ok ] {line}</span>
                ))}
              </div>
              <div className="vm__boot-bar"><i /></div>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="vm__console">
        <div className="vm__console-head">
          <strong>Host observer</strong>
          <span className={`chip ${state === 'done' ? 'chip--red' : state === 'unavailable' ? 'chip--amber' : ''}`}>
            {state === 'done' ? 'detonated' : state === 'unavailable' ? 'backend offline' : state === 'loading' ? 'running' : 'standby'}
          </span>
        </div>
        <div className="vm__console-body">
          <div className="vm__observe">
            <span>uptime<b>{Math.floor(res.uptime / 60)}m {String(res.uptime % 60).padStart(2, '0')}s</b></span>
            <span>target<b>{host}</b></span>
            <span>mode<b>{remote?.mode || '—'}</b></span>
            <span>dns<b>{remote ? (remote.dns_resolved ? 'resolved' : 'not resolved') : '—'}</b></span>
            <span>http<b>{remote ? (remote.http_fetched ? 'fetched in container' : 'not fetched') : '—'}</b></span>
          </div>

          <Meters res={res} running={state === 'loading' || state === 'done'} />

          {state === 'unavailable' && (
            <div className="vm__flag"><AlertTriangle size={11} /> Backend unreachable ({remote?.error}). Nothing was fetched or executed.</div>
          )}
          {state === 'done' && remote?.threat_verdict ? <p className="hint">{remote.threat_verdict}</p> : null}

          {flags.length ? (
            <div className="vm__flags">
              {flags.map((flag) => <div className="vm__flag" key={flag}><AlertTriangle size={11} />{flag}</div>)}
            </div>
          ) : local && !local.error ? (
            <div className="vm__flag ok"><CheckCircle2 size={11} /> No structural warning — not a reputation verdict.</div>
          ) : null}

          <div className="vm__log">
            {log.map((line, index) => (
              <span key={`${line.t}-${index}`}><i>{line.t}</i> <b>›</b> {line.text}</span>
            ))}
          </div>
        </div>
        <div className="vm__foot">
          <span>docker compose up isolated-sandbox</span>
          <a href="https://github.com/sudonishant/SUDO-SPANDR#docker-deployment" target="_blank" rel="noreferrer">docs ↗</a>
        </div>
      </aside>
    </div>
  );
}
