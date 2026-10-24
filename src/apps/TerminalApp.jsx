import React from 'react';

const BANNER = [
  'SUDO SPANDR shell · v4.0 · air-gapped session',
  'type "help" for the command list',
];

export default function TerminalApp({ onCommand }) {
  const [lines, setLines] = React.useState(BANNER.map((text) => ({ tone: 'dim', text })));
  const [value, setValue] = React.useState('');
  const [history, setHistory] = React.useState([]);
  const [cursor, setCursor] = React.useState(-1);
  const outRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [lines]);

  const push = (text, tone = '') => setLines((all) => [...all, { text, tone }]);

  const commands = {
    help: () => push('commands: help · whoami · status · ls · open <app> · analyze · clear · date · uname · about'),
    whoami: () => push('analyst@spandr — local session, no telemetry'),
    date: () => push(new Date().toString()),
    uname: () => push('SPANDR 4.0 desktop · chromium class runtime · isolated profile'),
    status: () => {
      push('backend        optional (FastAPI)', 'dim');
      push('browser parse  ready', 'ok');
      push('sandbox        requires container', 'dim');
      push('uploads        none', 'ok');
    },
    ls: () => push('Evidence/  Reports/  System/   sandbox/  README.md'),
    about: () => push('SUDO SPANDR — SentinelMail. Deterministic email forensics. Missing data is never replaced with a guess.'),
    clear: () => setLines([]),
  };

  const run = (raw) => {
    const input = raw.trim();
    push(`analyst@spandr ~ % ${input}`, 'prompt');
    if (!input) return;
    setHistory((all) => [input, ...all].slice(0, 30));
    setCursor(-1);
    const [name, arg] = input.split(/\s+/);
    if (commands[name]) { commands[name](); return; }
    if (name === 'open') {
      const apps = ['workspace', 'sandbox', 'files', 'mitre', 'dossier', 'about', 'terminal'];
      if (apps.includes(arg)) { onCommand?.(arg); push(`opening ${arg}…`, 'ok'); }
      else push(`open: unknown app "${arg || ''}" — try workspace, sandbox, files, mitre, dossier, about`, 'bad');
      return;
    }
    if (name === 'analyze') {
      onCommand?.('workspace');
      push('opening workspace — drop an .eml/.msg or paste headers', 'ok');
      return;
    }
    push(`${name}: command not found`, 'bad');
  };

  return (
    <div className="term" onClick={() => inputRef.current?.focus()}>
      <div className="term__out" ref={outRef}>
        {lines.map((line, index) => (
          <div className={`term__line ${line.tone ? `term__line--${line.tone}` : ''}`} key={`${index}-${line.text}`}>{line.text}</div>
        ))}
      </div>
      <form
        className="term__input"
        onSubmit={(event) => { event.preventDefault(); run(value); setValue(''); }}
      >
        <span>analyst@spandr ~ %</span>
        <input
          ref={inputRef}
          value={value}
          autoFocus
          spellCheck="false"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' && history.length) {
              event.preventDefault();
              const next = Math.min(cursor + 1, history.length - 1);
              setCursor(next);
              setValue(history[next]);
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const next = cursor - 1;
              setCursor(next);
              setValue(next >= 0 ? history[next] : '');
            }
          }}
          aria-label="Terminal input"
        />
      </form>
    </div>
  );
}
