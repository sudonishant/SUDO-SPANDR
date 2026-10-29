import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import {
  Camera, Cpu, Download, HardDrive, Loader2, Maximize2, MousePointerClick, RefreshCw,
  ShieldAlert, Square, Zap,
} from 'lucide-react';
import v86WasmUrl from 'v86/build/v86.wasm?url';

/* ------------------------------------------------------------------------- *
 * SUDO Desktop — a real x86 PC emulated in WebAssembly, in this page.
 *
 * Everything runs in the analyst's tab: the BIOS ROMs and the bundled guest
 * image are served from this deployment, the CPU/GPU/memory are emulated by
 * `v86` in a worker, and no byte of the guest is uploaded anywhere. The guest
 * has no network device configured, so it cannot call out.
 * ------------------------------------------------------------------------- */

const ASSET_BASE = `${import.meta.env.BASE_URL}v86/`;
const KOLIBRI_SIZE = 1474560;

const MB = 1024 * 1024;
export const MEMORY_CHOICES = [64, 128, 256];

function formatBytes(value) {
  if (!value || Number.isNaN(value)) return '—';
  if (value < 1024) return `${value} B`;
  if (value < MB) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / MB).toFixed(value < 10 * MB ? 1 : 0)} MB`;
}

function bufferSha256(buffer) {
  return crypto.subtle.digest('SHA-256', buffer).then((digest) => (
    [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  ));
}

function readFileBuffer(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('The image file could not be read.'));
    reader.readAsArrayBuffer(file);
  });
}

const BrowserDesktop = forwardRef(function BrowserDesktop({
  source, memoryMB = 128, onEvent, onState, onArtifact,
}, ref) {
  const screenRef = useRef(null);
  const emulatorRef = useRef(null);
  const disposedRef = useRef(false);
  const lastShotRef = useRef(null); // the exact blob whose SHA-256 is displayed

  const [phase, setPhase] = useState('idle'); // idle | loading | booting | running | error
  const [statusLine, setStatusLine] = useState('Emulator not started.');
  const [imageInfo, setImageInfo] = useState(null);
  const [lastShot, setLastShot] = useState(null);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);

  const emit = useCallback((message) => onEvent?.(message), [onEvent]);

  const publish = useCallback((next, detail) => {
    setPhase(next);
    setStatusLine(detail || '');
    onState?.(next);
  }, [onState]);

  /* --- teardown ---------------------------------------------------------- */

  const shutdown = useCallback(async () => {
    const emulator = emulatorRef.current;
    emulatorRef.current = null;
    if (!emulator) return;
    try {
      emulator.remove_listener?.('emulator-ready');
      await emulator.stop();
      await emulator.destroy();
    } catch {
      // A guest that never finished booting can reject teardown; it is already gone.
    }
    if (!disposedRef.current) publish('idle', 'Emulator stopped. Guest memory was released.');
  }, [publish]);

  useEffect(() => () => {
    disposedRef.current = true;
    const emulator = emulatorRef.current;
    emulatorRef.current = null;
    try { emulator?.destroy?.(); } catch { /* teardown during unmount is best-effort */ }
  }, []);

  /* --- boot -------------------------------------------------------------- */

  const boot = useCallback(async () => {
    // React StrictMode mounts, unmounts and remounts in development; the boot
    // effect runs again, so the disposed flag must be cleared here.
    disposedRef.current = false;
    if (emulatorRef.current) await shutdown();
    if (!screenRef.current) return;
    setError('');
    setLastShot(null);
    publish('loading', 'Loading the emulator and guest image…');

    let V86;
    try {
      ({ V86 } = await import('v86'));
    } catch (loadError) {
      setError(`The emulator module could not be loaded: ${loadError.message}`);
      publish('error', 'Emulator module failed to load.');
      return;
    }

    const options = {
      wasm_path: v86WasmUrl,
      screen_container: screenRef.current,
      memory_size: memoryMB * MB,
      vga_memory_size: 8 * MB,
      bios: { url: `${ASSET_BASE}seabios.bin` },
      vga_bios: { url: `${ASSET_BASE}vgabios.bin` },
      autostart: true,
      disable_speaker: true,
      // No `networking` block on purpose: the guest has no NIC, so it cannot
      // reach the network even if the guest OS has its own stack.
    };

    try {
      if (source?.type === 'file' && source.file) {
        publish('loading', `Reading ${source.file.name} locally…`);
        const buffer = await readFileBuffer(source.file, (loaded, total) => {
          if (total) setStatusLine(`Reading ${source.file.name}: ${Math.round((loaded / total) * 100)}%`);
        });
        const sha256 = await bufferSha256(buffer);
        const size = buffer.byteLength;
        const name = source.file.name;
        const lower = name.toLowerCase();
        const info = { name, size, sha256, kind: 'disk' };

        if (lower.endsWith('.iso') || size > 512 * MB) {
          options.cdrom = { buffer };
          options.boot_order = 0x123; // CD, HDD, floppy
          info.kind = 'CD image';
        } else if (size <= KOLIBRI_SIZE * 2) {
          options.fda = { buffer };
          options.boot_order = 0x321; // floppy, HDD, CD
          info.kind = 'floppy image';
        } else {
          options.hda = { buffer };
          options.boot_order = 0x132; // HDD, CD, floppy
          info.kind = 'hard-disk image';
        }
        setImageInfo(info);
        emit(`Loaded ${name} (${formatBytes(size)}, ${info.kind}) from this device. SHA-256 ${sha256.slice(0, 16)}…`);
        onArtifact?.({ name, sha256, size, at: new Date().toISOString(), kind: 'guest-image' });
      } else {
        options.fda = { url: `${ASSET_BASE}kolibri.img`, size: KOLIBRI_SIZE };
        options.boot_order = 0x321;
        setImageInfo({
          name: 'kolibri.img',
          size: KOLIBRI_SIZE,
          kind: 'bundled floppy image',
          sha256: 'ae4f9ff74829d455e7db8bc6107a0475e888c74b7a9cbb6664700f984f0645f0',
        });
        emit('Booting the bundled KolibriOS image (1.44 MB, served from this deployment).');
      }

      publish('booting', 'Emulator started. Waiting for the guest to draw its first frame…');
      const bootStartedAt = Date.now();
      const emulator = new V86(options);
      emulatorRef.current = emulator;
      const isCurrent = () => emulatorRef.current === emulator;

      emulator.add_listener('download-progress', (event) => {
        if (!isCurrent() || !event?.lengthComputable) return;
        setStatusLine(`Loading ${event.file_name || 'image'}: ${Math.round((event.loaded / event.total) * 100)}%`);
      });
      emulator.add_listener('download-error', (event) => {
        if (!isCurrent()) return;
        setError(`A guest asset failed to download (${event?.file_name || 'image'}). Rebuild with node scripts/fetch-v86-assets.mjs.`);
        publish('error', 'Guest asset download failed.');
      });
      let painted = false;
      emulator.add_listener('screen-set-size', ([width, height]) => {
        if (disposedRef.current || !isCurrent()) return;
        painted = true;
        setStatusLine(`Guest screen ${width}×${height}. Click the screen to give it keyboard focus.`);
      });
      // `emulator-ready` can fire before this listener is attached, so the real
      // readiness signal is the guest switching to graphics mode plus is_running().
      const poll = setInterval(() => {
        if (disposedRef.current || !isCurrent()) { clearInterval(poll); return; }
        const alive = typeof emulator.is_running === 'function' ? emulator.is_running() : true;
        if (alive && (painted || Date.now() - bootStartedAt > 8000)) {
          clearInterval(poll);
          publish('running', 'Guest is running. Click the screen, then use the mouse and keyboard normally.');
          emit('In-page x86 PC is running. The guest has no network device.');
        }
      }, 400);
      emulator.add_listener('emulator-stopped', () => clearInterval(poll));
      emulator.add_listener('emulator-stopped', () => {
        clearInterval(poll);
        if (disposedRef.current || !isCurrent()) return;
        publish('idle', 'Guest halted.');
      });
    } catch (bootError) {
      setError(bootError.message || 'The emulator could not start.');
      publish('error', 'Emulator failed to start.');
    }
  }, [emit, memoryMB, onArtifact, publish, shutdown, source]);

  useEffect(() => {
    // Scheduled, not immediate: React StrictMode mounts twice in development, and
    // the throw-away first mount must not boot (or emit for) an emulator.
    const timer = setTimeout(() => { boot(); }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- imperative API used by the Agent PC shell ------------------------- */

  const snapshot = useCallback(async () => {
    const emulator = emulatorRef.current;
    if (!emulator) {
      setError('The guest is not running, so there is nothing to capture.');
      return null;
    }

    // Prefer the canvas the guest is drawing into; it is same-origin and never tainted.
    let blob = null;
    const canvas = screenRef.current?.querySelector('canvas');
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      blob = await new Promise((resolve) => {
        try { canvas.toBlob(resolve, 'image/png'); } catch { resolve(null); }
      });
    }

    // Text-mode guests have no canvas pixels, so fall back to the emulator's own capture.
    if (!blob) {
      try {
        const shot = emulator.screen_make_screenshot?.();
        if (shot && typeof shot.toBlob === 'function') {
          blob = await new Promise((resolve) => shot.toBlob(resolve, 'image/png'));
        } else if (shot && shot.tagName === 'IMG' && String(shot.src).startsWith('data:image/')) {
          const base64 = String(shot.src).split(',')[1] || '';
          const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
          blob = new Blob([bytes], { type: 'image/png' });
        }
      } catch {
        blob = null;
      }
    }

    if (!blob || blob.size === 0) {
      setError('This screen could not be captured as PNG yet. Wait for the guest desktop to finish drawing and try again.');
      return null;
    }
    const buffer = await blob.arrayBuffer();
    const sha256 = await bufferSha256(buffer);
    const shot = { name: `agent-pc-${Date.now()}.png`, size: blob.size, sha256, at: new Date().toISOString() };
    lastShotRef.current = { ...shot, blob };
    setLastShot(shot);
    onArtifact?.({ ...shot, kind: 'screenshot' });
    emit(`Screen captured locally (${formatBytes(blob.size)}, SHA-256 ${sha256.slice(0, 16)}…). Download it to attach to the case.`);
    return { ...shot, blob };
  }, [emit, onArtifact]);

  const saveCapture = useCallback(async () => {
    const shot = lastShotRef.current || await snapshot();
    if (!shot?.blob) return null;
    const url = URL.createObjectURL(shot.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = shot.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return shot;
  }, [snapshot]);

  useImperativeHandle(ref, () => ({
    boot,
    shutdown,
    restart: async () => { await shutdown(); await boot(); },
    snapshot,
    fullscreen: () => {
      try { emulatorRef.current?.screen_go_fullscreen?.(); } catch { /* browser refusal is non-fatal */ }
    },
    setScale: (value) => {
      setScale(value);
      try { emulatorRef.current?.screen_set_scale?.(value, value); } catch { /* ignore */ }
    },
    downloadLastScreenshot: saveCapture,
  }), [boot, saveCapture, shutdown, snapshot]);

  const busy = phase === 'loading' || phase === 'booting';

  return (
    <div className="native-pc" data-phase={phase}>
      {/* v86 expects exactly two children in its container: a text-mode div and a canvas. */}
      <div className="native-pc__screen-wrap">
        <div className="native-pc__screen" ref={screenRef} tabIndex={0} aria-label="Emulated PC screen">
          <div className="native-pc__text" />
          <canvas className="native-pc__canvas" />
        </div>
        {phase !== 'running' ? (
          <div className="native-pc__overlay" role="status" aria-live="polite">
            {busy ? <Loader2 size={22} className="agent-pc__spin" /> : phase === 'error' ? <ShieldAlert size={22} /> : <Zap size={22} />}
            <strong>
              {busy ? 'Booting the guest…' : phase === 'error' ? 'The emulator stopped' : 'Guest halted'}
            </strong>
            <span>{error || statusLine}</span>
            {busy ? <small>First boot loads ~2.4 MB of emulator and guest image from this deployment.</small> : null}
          </div>
        ) : null}
      </div>

      <div className="native-pc__bar">
        <span className="native-pc__chip"><Cpu size={13} />x86 · v86 · {memoryMB} MB</span>
        <span className="native-pc__chip"><HardDrive size={13} />{imageInfo ? `${imageInfo.name} · ${formatBytes(imageInfo.size)}` : 'image pending'}</span>
        <span className="native-pc__chip native-pc__chip--off"><ShieldAlert size={13} />no network device</span>
        <span className="native-pc__hint"><MousePointerClick size={13} />Click the screen for keyboard focus</span>
        <div className="native-pc__tools">
          <label className="native-pc__scale">
            Zoom
            <select
              value={scale}
              onChange={(event) => {
                const value = Number(event.target.value);
                setScale(value);
                try { emulatorRef.current?.screen_set_scale?.(value, value); } catch { /* ignore */ }
              }}
            >
              <option value={1}>100%</option>
              <option value={1.5}>150%</option>
              <option value={2}>200%</option>
            </select>
          </label>
          <button type="button" className="agent-pc__tool" onClick={snapshot} disabled={phase !== 'running'}>
            <Camera size={14} /><span>Snapshot</span>
          </button>
          <button
            type="button"
            className="agent-pc__tool"
            onClick={() => { try { emulatorRef.current?.screen_go_fullscreen?.(); } catch { /* ignore */ } }}
            disabled={phase !== 'running'}
          >
            <Maximize2 size={14} /><span>Fullscreen</span>
          </button>
          <button
            type="button"
            className="agent-pc__tool"
            onClick={async () => { await shutdown(); await boot(); }}
            disabled={busy}
          >
            <RefreshCw size={14} /><span>Reboot</span>
          </button>
        </div>
      </div>

      {error && phase === 'running' ? <p className="native-pc__error" role="alert">{error}</p> : null}

      {imageInfo ? (
        <div className="native-pc__meta">
          <span>SHA-256 <code title={imageInfo.sha256}>{imageInfo.sha256.slice(0, 32)}…</code></span>
          <span>{imageInfo.kind}</span>
          {lastShot ? (
            <span className="native-pc__meta-shot">
              last screenshot {formatBytes(lastShot.size)} · {lastShot.sha256.slice(0, 16)}…
              <button type="button" className="native-pc__link" onClick={saveCapture}>
                <Download size={12} />save
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

export default BrowserDesktop;
export { formatBytes };
