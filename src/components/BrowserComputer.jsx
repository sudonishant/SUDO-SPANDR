import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Code2, FileCode2, MonitorPlay, Pause, Play, RefreshCw, Save, TerminalSquare } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { loadBrowserWorkspace, saveBrowserWorkspace } from '../lib/browserComputerStorage';

const DEFAULT_FILES = {
  'index.js': `import { readFile } from 'node:fs/promises';\n\nconst evidence = await readFile('./evidence/message.txt', 'utf8');\nconsole.log('SUDO browser agent: real Node.js execution');\nconsole.log('Evidence bytes:', Buffer.byteLength(evidence));\nconsole.log('First line:', evidence.trim().split(/\\r?\\n/)[0]);\n`,
  'evidence/message.txt': 'Submitted evidence stays in this browser runtime.\nNo mailbox is connected.\n',
  'package.json': '{\n  "name": "spandr-browser-agent",\n  "private": true,\n  "type": "module",\n  "scripts": { "start": "node index.js" }\n}\n',
  'README.md': '# Browser agent workspace\n\nThis is a WebContainers Node.js runtime, not a full Linux VM.\nUse the terminal to run `node index.js`, `npm --version`, or `ls`.\n',
};

function validFilePath(path) {
  if (typeof path !== 'string' || path.length > 120 || path.startsWith('/') || !/^[a-zA-Z0-9._/-]+$/.test(path)) return false;
  return path.split('/').every((part) => part && !['.', '..', '__proto__', 'prototype', 'constructor'].includes(part));
}

function normalizeFiles(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const entries = Object.entries(saved).filter(([path, value]) => validFilePath(path) && typeof value === 'string' && value.length <= 200000).slice(0, 20);
  return entries.length ? { ...DEFAULT_FILES, ...Object.fromEntries(entries) } : null;
}

function toFileSystemTree(files) {
  const root = {};
  Object.entries(files).forEach(([path, contents]) => {
    if (!validFilePath(path)) return;
    const parts = path.split('/');
    let cursor = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        cursor[part] = { file: { contents } };
      } else {
        cursor[part] ||= { directory: {} };
        cursor = cursor[part].directory;
      }
    });
  });
  return root;
}

export default function BrowserComputer({ autoResume, onRunningChange, onEvent, onUserStop }) {
  const [status, setStatus] = useState('stopped');
  const [error, setError] = useState('');
  const [files, setFiles] = useState(() => ({ ...DEFAULT_FILES }));
  const [storageStatus, setStorageStatus] = useState('loading');
  const [activeFile, setActiveFile] = useState('index.js');
  const [dirty, setDirty] = useState(false);
  const terminalElementRef = useRef(null);
  const terminalRef = useRef(null);
  const fitRef = useRef(null);
  const containerRef = useRef(null);
  const shellRef = useRef(null);
  const inputRef = useRef(null);
  const loadPromiseRef = useRef(null);
  const startPromiseRef = useRef(null);
  const stopPromiseRef = useRef(null);
  const mountedRef = useRef(true);
  const statusRef = useRef(status);
  const filesRef = useRef(files);
  const eventRef = useRef(onEvent);
  const runningCallbackRef = useRef(onRunningChange);
  eventRef.current = onEvent;
  runningCallbackRef.current = onRunningChange;
  filesRef.current = files;

  const emit = useCallback((message) => eventRef.current?.(message), []);
  const updateStatus = useCallback((next) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
    runningCallbackRef.current?.(next === 'running');
  }, []);

  useEffect(() => {
    let active = true;
    const promise = (async () => {
      try {
        const normalized = normalizeFiles(await loadBrowserWorkspace());
        if (!active) return;
        if (normalized) {
          filesRef.current = normalized;
          setFiles(normalized);
        }
        setStorageStatus('ready');
      } catch {
        if (active) setStorageStatus('memory');
      }
    })();
    loadPromiseRef.current = promise;
    return () => { active = false; };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      scrollback: 5000,
      fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
      fontSize: 13,
      theme: { background: '#071019', foreground: '#d7e3ee', cursor: '#67e8f9', selectionBackground: '#164e63' },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(terminalElementRef.current);
    terminal.writeln('\x1b[37mBrowser computer stopped. Press Start to boot WebContainers.\x1b[0m');
    terminalRef.current = terminal;
    fitRef.current = fit;
    const inputDisposable = terminal.onData((data) => {
      const writer = inputRef.current;
      if (writer) writer.write(data).catch((writeError) => emit(`Terminal input failed: ${writeError.message}`));
    });
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => { try { fit.fit(); } catch { /* hidden or not laid out yet */ } });
    });
    observer.observe(terminalElementRef.current);
    requestAnimationFrame(() => { try { fit.fit(); } catch { /* initial layout */ } });

    return () => {
      mountedRef.current = false;
      observer.disconnect();
      inputDisposable.dispose();
      const container = containerRef.current;
      const writer = inputRef.current;
      if (writer) {
        writer.write('exit\n').catch(() => {}).finally(() => {
          Promise.resolve(container?.teardown()).catch(() => {});
        });
      } else {
        Promise.resolve(container?.teardown()).catch(() => {});
      }
      inputRef.current = null;
      shellRef.current = null;
      containerRef.current = null;
      terminal.dispose();
      runningCallbackRef.current?.(false);
    };
  }, [emit]);

  const start = useCallback(() => {
    if (statusRef.current === 'running') return Promise.resolve();
    if (startPromiseRef.current) return startPromiseRef.current;

    const promise = (async () => {
      updateStatus('booting');
      setError('');
      const terminal = terminalRef.current;
      terminal?.reset();
      terminal?.writeln('\x1b[36mBooting WebContainers in this browser…\x1b[0m');
      try {
        await loadPromiseRef.current;
        if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
          throw new Error('Cross-origin isolation is unavailable in this embedded view. Open the workspace directly in a new browser tab, with COOP/COEP enabled, and try again.');
        }
        const { WebContainer } = await import('@webcontainer/api');
        const container = await WebContainer.boot({ workdirName: 'spandr-browser-agent' });
        containerRef.current = container;
        if (!mountedRef.current) { await container.teardown(); return; }
        terminal?.writeln('\x1b[37mMounting the persistent virtual filesystem…\x1b[0m');
        await container.mount(toFileSystemTree(filesRef.current));
        const shell = await container.spawn('jsh', [], { terminal: { cols: terminal?.cols || 80, rows: terminal?.rows || 24 } });
        shellRef.current = shell;
        inputRef.current = shell.input.getWriter();
        shell.output.pipeTo(new WritableStream({
          write(data) { terminalRef.current?.write(data); },
        })).catch((streamError) => {
          if (mountedRef.current && statusRef.current === 'running') emit(`Terminal output closed: ${streamError.message}`);
        });
        shell.exit.then((code) => {
          if (mountedRef.current && statusRef.current === 'running') {
            updateStatus('stopped');
            inputRef.current = null;
            shellRef.current = null;
            containerRef.current = null;
            Promise.resolve(container.teardown()).catch(() => {});
            emit(`Browser shell exited with code ${code}. Start the computer to open a new shell.`);
          }
        });
        updateStatus('running');
        emit('Browser WebContainer started. Node.js, jsh and the virtual filesystem are running in this tab.');
      } catch (bootError) {
        try { await containerRef.current?.teardown(); } catch { /* no active runtime to clean up */ }
        containerRef.current = null;
        shellRef.current = null;
        inputRef.current = null;
        updateStatus('error');
        const message = bootError?.message || 'WebContainers could not start in this browser.';
        setError(message);
        terminal?.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
        emit(`Browser computer start failed: ${message}`);
      }
    })();

    startPromiseRef.current = promise;
    promise.finally(() => { if (startPromiseRef.current === promise) startPromiseRef.current = null; });
    return promise;
  }, [emit, updateStatus]);

  const stop = useCallback(() => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    const promise = (async () => {
      if (startPromiseRef.current) await startPromiseRef.current;
      if (!containerRef.current && statusRef.current === 'stopped') return;
      updateStatus('stopping');
      try {
        const shell = shellRef.current;
        if (shell && inputRef.current) {
          try {
            await inputRef.current.write('exit\n');
            await Promise.race([shell.exit, new Promise((resolve) => setTimeout(resolve, 1800))]);
          } catch { /* teardown below remains the final cleanup path */ }
        }
        await containerRef.current?.teardown();
        terminalRef.current?.reset();
        terminalRef.current?.writeln('\x1b[37mBrowser computer stopped. Workspace snapshots remain in IndexedDB when available.\x1b[0m');
        emit('Browser WebContainer stopped. Browser-side execution is no longer running.');
      } catch (stopError) {
        setError(stopError?.message || 'The browser runtime did not stop cleanly.');
      } finally {
        inputRef.current = null;
        shellRef.current = null;
        containerRef.current = null;
        updateStatus('stopped');
      }
    })();
    stopPromiseRef.current = promise;
    promise.finally(() => { if (stopPromiseRef.current === promise) stopPromiseRef.current = null; });
    return promise;
  }, [emit, updateStatus]);

  useEffect(() => {
    if (!autoResume) return undefined;
    const syncWithVisibility = () => { if (document.hidden) stop(); else start(); };
    syncWithVisibility();
    document.addEventListener('visibilitychange', syncWithVisibility);
    return () => document.removeEventListener('visibilitychange', syncWithVisibility);
  }, [autoResume, start, stop]);

  const saveActiveFile = useCallback(async () => {
    const contents = filesRef.current[activeFile] ?? '';
    let persisted = true;
    try {
      await saveBrowserWorkspace(filesRef.current);
      if (mountedRef.current) setStorageStatus('ready');
    } catch {
      persisted = false;
      if (mountedRef.current) setStorageStatus('memory');
    }
    if (containerRef.current && statusRef.current === 'running') await containerRef.current.fs.writeFile(activeFile, contents);
    setDirty(false);
    emit(`${activeFile} ${persisted ? 'saved on this device' : 'kept in memory for this tab'}${statusRef.current === 'running' ? ' and written to the virtual filesystem' : ''}.`);
  }, [activeFile, emit]);

  const runProject = useCallback(async () => {
    await saveActiveFile();
    const writer = inputRef.current;
    if (!writer || statusRef.current !== 'running') return;
    await writer.write('node index.js\n');
    emit('Executed node index.js in the browser WebContainer.');
  }, [emit, saveActiveFile]);

  const syncFromRuntime = useCallback(async () => {
    if (!containerRef.current || statusRef.current !== 'running') return;
    const contents = await containerRef.current.fs.readFile(activeFile, 'utf-8');
    const next = { ...filesRef.current, [activeFile]: contents };
    filesRef.current = next;
    setFiles(next);
    try {
      await saveBrowserWorkspace(next);
      if (mountedRef.current) setStorageStatus('ready');
    } catch {
      if (mountedRef.current) setStorageStatus('memory');
    }
    setDirty(false);
    emit(`${activeFile} refreshed from the live virtual filesystem.`);
  }, [activeFile, emit]);

  const running = status === 'running';
  const busy = status === 'booting' || status === 'stopping';

  return (
    <section className={`computer-shell surface browser-computer ${running ? 'is-running' : ''}`} aria-label="Browser Node.js computer" data-runtime-status={status}>
      <div className="computer-topbar">
        <div className="computer-identity"><span><Code2 size={21} /></span><div><strong>Browser Agent Computer</strong><small>WebContainers Node.js · xterm.js · virtual files · not full Linux</small></div></div>
        <div className="computer-controls">
          <span className={`computer-power-state ${running ? 'is-on' : ''}`}><i />{status.toUpperCase()}</span>
          {running || busy ? <button type="button" className="ui-button ui-button--secondary" disabled={status === 'stopping'} onClick={() => { onUserStop?.(); stop(); }}><Pause size={15} />{busy ? 'Working…' : 'Stop'}</button> : <button type="button" className="ui-button ui-button--primary" onClick={start}><Play size={15} />Start browser computer</button>}
        </div>
      </div>

      <div className="browser-computer__notice"><MonitorPlay size={14} /><span>Real Node.js/Wasm execution in this tab. No host shell, Chromium desktop, mailbox, or remote VM.</span></div>
      {error ? <div className="error-callout browser-computer__error" role="alert">{error}</div> : null}

      <div className="browser-workspace">
        <section className="browser-editor" aria-label="Browser computer code editor">
          <div className="browser-pane__toolbar"><span><FileCode2 size={14} />Workspace files</span><div><button type="button" title="Save active file" aria-label="Save active file" disabled={!dirty && !running} onClick={() => saveActiveFile().catch((saveError) => setError(saveError.message))}><Save size={14} /></button><button type="button" title="Refresh active file from runtime" aria-label="Refresh active file from runtime" disabled={!running} onClick={() => syncFromRuntime().catch((syncError) => setError(syncError.message))}><RefreshCw size={14} /></button></div></div>
          <div className="browser-file-tabs" role="tablist" aria-label="Virtual files">{Object.keys(files).map((path) => <button type="button" role="tab" aria-selected={activeFile === path} className={activeFile === path ? 'is-active' : ''} key={path} onClick={() => setActiveFile(path)}>{path}</button>)}</div>
          <textarea
            className="browser-code-editor"
            aria-label={`Code editor for ${activeFile}`}
            value={files[activeFile] ?? ''}
            spellCheck={false}
            onChange={(event) => {
              const next = { ...filesRef.current, [activeFile]: event.target.value };
              filesRef.current = next;
              setFiles(next);
              setDirty(true);
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveActiveFile().catch((saveError) => setError(saveError.message)); }
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && running) { event.preventDefault(); runProject(); }
            }}
          />
          <div className="browser-editor__footer"><span>{dirty ? 'Unsaved changes' : storageStatus === 'ready' ? 'Saved on this device' : storageStatus === 'loading' ? 'Restoring workspace…' : 'Memory only · this tab'}</span><button type="button" className="ui-button ui-button--primary" disabled={!running || busy} onClick={() => runProject().catch((runError) => setError(runError.message))}><Play size={13} />Run index.js</button></div>
        </section>

        <section className="browser-terminal" aria-label="Browser computer terminal">
          <div className="browser-pane__toolbar"><span><TerminalSquare size={14} />jsh terminal</span><span>{running ? 'Live process' : 'Start to execute'}</span></div>
          <div className="browser-terminal__surface" ref={terminalElementRef} data-testid="browser-terminal" />
        </section>
      </div>

      <div className="browser-computer__footnote">First boot needs StackBlitz runtime network access. Execution is browser-side; commercial production use may require a WebContainer API license.</div>
    </section>
  );
}
