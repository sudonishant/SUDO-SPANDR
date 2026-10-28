import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.AGENT_COMPUTER_PORT || 8765);
const TOKEN = process.env.AGENT_COMPUTER_TOKEN || '';
const CONFIG = '/var/lib/spandrvm/supervisord.conf';
const PASSWORD_FILE = '/var/lib/spandrvm/vnc.pass';
const REQUIRED = [
  '/usr/bin/Xvfb', '/usr/bin/x11vnc', '/usr/bin/websockify', '/usr/bin/fluxbox',
  '/usr/bin/xterm', '/usr/bin/pcmanfm', '/usr/bin/chromium', '/usr/bin/supervisord',
];

if (TOKEN.length < 16) {
  console.error('AGENT_COMPUTER_TOKEN must be set to a random value of at least 16 characters.');
  process.exit(1);
}
const expectedTokenHash = crypto.createHash('sha256').update(TOKEN).digest();

const state = {
  available: REQUIRED.every((path) => fs.existsSync(path)),
  child: null,
  running: false,
  session: null,
  starting: null,
  stopping: null,
  lastError: '',
  logTail: '',
};

function authorized(req) {
  const supplied = String(req.headers['x-agent-computer-token'] || '');
  const hash = crypto.createHash('sha256').update(supplied).digest();
  return crypto.timingSafeEqual(hash, expectedTokenHash);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function publicStatus() {
  return {
    available: state.available,
    running: state.running,
    starting: Boolean(state.starting) && !state.running,
    stopping: Boolean(state.stopping) && state.running,
    runtime: 'linux-desktop',
    user: 'spandrvm',
    host_workspace: 'not mounted',
    network: 'enabled in the local runtime; not air-gapped',
    features: ['Chromium', 'Linux terminal', 'File manager', 'Persistent guest home'],
    started_at: state.session?.startedAt || null,
    error: state.lastError || null,
  };
}

function sessionPayload() {
  if (!state.running || !state.session) return null;
  return {
    ...publicStatus(),
    session_id: state.session.id,
    frame_url: state.session.frameUrl,
  };
}

function runSync(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 7000,
    maxBuffer: 64 * 1024,
    ...options,
  });
}

function appendLog(chunk) {
  state.logTail = `${state.logTail}${String(chunk)}`.slice(-8000);
}

function checkTcp(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: HOST, port });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(700);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function checkHttp(path) {
  return new Promise((resolve) => {
    const request = http.get({ host: HOST, port: 7860, path, timeout: 700 }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.once('timeout', () => { request.destroy(); resolve(false); });
    request.once('error', () => resolve(false));
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDesktop(child) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Desktop process exited during startup. ${state.logTail.slice(-800)}`);
    const [vncReady, webReady] = await Promise.all([checkTcp(5900), checkHttp('/vnc.html')]);
    if (vncReady && webReady) return;
    await sleep(300);
  }
  throw new Error(`Desktop did not become ready within 25 seconds. ${state.logTail.slice(-800)}`);
}

function removePassword() {
  runSync('sudo', ['-n', 'runuser', '-u', 'spandrvm', '--', 'rm', '-f', PASSWORD_FILE]);
}

function stopProcesses() {
  runSync('sudo', ['-n', 'runuser', '-u', 'spandrvm', '--', '/usr/bin/supervisorctl', '-c', CONFIG, 'shutdown']);
  runSync('sudo', ['-n', 'pkill', '-TERM', '-u', 'spandrvm']);
}

async function haltGuestProcesses() {
  stopProcesses();
  await sleep(350);
  runSync('sudo', ['-n', 'pkill', '-KILL', '-u', 'spandrvm']);
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const remaining = runSync('sudo', ['-n', 'pgrep', '-u', 'spandrvm']);
    if (remaining.status === 1) return;
    if (remaining.status !== 0) throw new Error(`Could not verify guest process shutdown: ${remaining.stderr || 'pgrep failed'}`);
    await sleep(150);
  }
  throw new Error('Guest processes did not exit within 6 seconds.');
}

async function startComputer() {
  if (state.stopping) await state.stopping;
  if (state.running && state.session) return sessionPayload();
  if (state.starting) return state.starting;

  state.starting = (async () => {
    if (!state.available) throw new Error('Real desktop dependencies are not installed. Run scripts/setup-agent-computer.sh first.');
    state.lastError = '';
    state.logTail = '';
    await haltGuestProcesses();
    removePassword();

    const id = crypto.randomUUID();
    const password = crypto.randomBytes(24).toString('base64url');
    const write = runSync('sudo', ['-n', 'runuser', '-u', 'spandrvm', '--', 'sh', '-c', `umask 077; cat > ${PASSWORD_FILE}`], { input: `${password}\n` });
    if (write.status !== 0) throw new Error(`Could not create the VNC session credential: ${write.stderr || write.error?.message || 'unknown error'}`);

    const child = spawn('sudo', ['-n', 'runuser', '-u', 'spandrvm', '--', '/usr/bin/supervisord', '-c', CONFIG], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    state.child = child;
    child.stdout.on('data', appendLog);
    child.stderr.on('data', appendLog);
    child.once('error', (error) => { appendLog(error.message); });
    child.once('exit', (code, signal) => {
      if (state.child === child) {
        state.child = null;
        state.running = false;
        state.session = null;
        if (code !== 0 && signal !== 'SIGTERM') state.lastError = `Desktop process exited (${code ?? signal}).`;
      }
    });

    try {
      await waitForDesktop(child);
    } catch (error) {
      await haltGuestProcesses().catch((cleanupError) => appendLog(cleanupError.message));
      removePassword();
      throw error;
    }

    const startedAt = new Date().toISOString();
    state.running = true;
    state.session = {
      id,
      startedAt,
      frameUrl: `/novnc/vnc.html?autoconnect=true&resize=scale&path=novnc/websockify&view_only=0&password=${encodeURIComponent(password)}`,
    };
    console.log(`[agent-computer] started session ${id}`);
    return sessionPayload();
  })();

  try {
    return await state.starting;
  } catch (error) {
    state.running = false;
    state.session = null;
    state.child = null;
    state.lastError = error?.message || 'Desktop start failed.';
    throw error;
  } finally {
    state.starting = null;
  }
}

async function stopComputer() {
  if (state.stopping) return state.stopping;
  state.stopping = (async () => {
    if (state.starting) await state.starting.catch(() => {});
    const sessionId = state.session?.id;
    if (state.child?.pid) {
      try { process.kill(-state.child.pid, 'SIGTERM'); } catch { /* process may already be stopped */ }
    }
    await haltGuestProcesses();
    removePassword();
    state.child = null;
    state.running = false;
    state.session = null;
    state.lastError = '';
    if (sessionId) console.log(`[agent-computer] stopped session ${sessionId}`);
    return publicStatus();
  })();

  try {
    return await state.stopping;
  } finally {
    state.stopping = null;
  }
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url || '/', `http://${HOST}`).pathname;
  if (!authorized(req)) {
    sendJson(res, 401, { error: 'Unauthorized local computer control request.' });
    return;
  }

  try {
    if (req.method === 'GET' && (path === '/status' || path === '/health')) {
      sendJson(res, 200, publicStatus());
      return;
    }
    if (req.method === 'GET' && path === '/session') {
      if (!state.running) { sendJson(res, 409, { error: 'Computer is stopped.' }); return; }
      sendJson(res, 200, sessionPayload());
      return;
    }
    if (req.method === 'POST' && path === '/start') {
      sendJson(res, 200, await startComputer());
      return;
    }
    if (req.method === 'POST' && path === '/stop') {
      sendJson(res, 200, await stopComputer());
      return;
    }
    sendJson(res, 404, { error: 'Unknown agent-computer control route.' });
  } catch (error) {
    sendJson(res, 500, { ...publicStatus(), error: error?.message || 'Agent computer operation failed.' });
  }
});

async function shutdown() {
  try { await stopComputer(); } finally { process.exit(0); }
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

server.listen(PORT, HOST, () => {
  console.log(`[agent-computer] control server listening on http://${HOST}:${PORT}; available=${state.available}`);
});
