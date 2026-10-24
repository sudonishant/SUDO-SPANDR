import React from 'react';
import { Minus, Square, X } from 'lucide-react';

/**
 * Draggable / resizable window shell.
 * Pointer events only (no libraries), clamped to the desktop area.
 */
export default function Window({
  win, active, onFocus, onClose, onMinimize, onToggleMax, onMove, onResize, children,
}) {
  const ref = React.useRef(null);
  const drag = React.useRef(null);
  const resize = React.useRef(null);

  React.useEffect(() => {
    const onPointerMove = (event) => {
      if (drag.current) {
        const { startX, startY, originX, originY } = drag.current;
        const maxX = window.innerWidth - 180;
        const maxY = window.innerHeight - 120;
        const nextX = Math.min(Math.max(originX + event.clientX - startX, -win.w + 220), maxX);
        const nextY = Math.min(Math.max(originY + event.clientY - startY, 0), maxY);
        onMove(win.id, nextX, nextY);
      }
      if (resize.current) {
        const { startX, startY, originW, originH } = resize.current;
        const width = Math.max(360, Math.min(originW + event.clientX - startX, window.innerWidth - 24));
        const height = Math.max(240, Math.min(originH + event.clientY - startY, window.innerHeight - 90));
        onResize(win.id, width, height);
      }
    };
    const onPointerUp = () => {
      drag.current = null;
      resize.current = null;
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [win.id, win.w, onMove, onResize]);

  const startDrag = (event) => {
    if (event.button !== 0) return;
    if (win.maximized) return;
    if (event.target.closest('button')) return;
    onFocus(win.id);
    drag.current = { startX: event.clientX, startY: event.clientY, originX: win.x, originY: win.y };
    document.body.style.cursor = 'grabbing';
  };

  const startResize = (event) => {
    event.stopPropagation();
    resize.current = { startX: event.clientX, startY: event.clientY, originW: win.w, originH: win.h };
    document.body.style.cursor = 'nwse-resize';
  };

  const style = win.maximized
    ? { left: 8, top: 8, width: 'calc(100% - 16px)', height: 'calc(100% - 16px)', zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  const Icon = win.icon;

  return (
    <section
      ref={ref}
      className={`window ${active ? '' : 'is-inactive'} ${win.minimized ? 'is-minimized' : ''}`}
      style={style}
      onPointerDown={() => onFocus(win.id)}
      aria-label={win.title}
      role="dialog"
    >
      <header className="window__bar" onPointerDown={startDrag} onDoubleClick={() => onToggleMax(win.id)}>
        <div className="window__lights">
          <button className="window__light window__light--close" onClick={() => onClose(win.id)} aria-label="Close">
            <X strokeWidth={3.4} />
          </button>
          <button className="window__light window__light--min" onClick={() => onMinimize(win.id)} aria-label="Minimise">
            <Minus strokeWidth={3.4} />
          </button>
          <button className="window__light window__light--max" onClick={() => onToggleMax(win.id)} aria-label="Maximise">
            <Square strokeWidth={3} />
          </button>
        </div>
        <span className="window__app">
          <span className="window__app-icon" style={{ background: win.accent || 'linear-gradient(160deg,#ff3b50,#b31527)' }}>
            {Icon ? <Icon /> : null}
          </span>
          <span className="window__title">{win.title}</span>
          {win.subtitle ? <span className="window__sub">{win.subtitle}</span> : null}
        </span>
        <span className="window__bar-spacer" />
        {win.badge ? <span className={`chip ${win.badgeTone || ''}`}>{win.badge}</span> : null}
      </header>
      <div className={`window__body ${win.flush ? 'window__body--flush' : ''}`}>{children}</div>
      {win.maximized ? null : <span className="window__resize" onPointerDown={startResize} />}
    </section>
  );
}
