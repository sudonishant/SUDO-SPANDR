import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const HOST = process.env.REA_HOST || '127.0.0.1';
const PORT = Number(process.env.REA_PORT || 8788);
const TOKEN = String(process.env.REA_SERVICE_TOKEN || '');
const NODE_BIN = process.env.REA_NODE_BIN || '';
const CLI_PATH = process.env.REA_CLI_PATH || '';
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_BODY_BYTES = 4_500_000;
const MAX_OUTPUT_BYTES = 1_800_000;
const MAX_STDERR_BYTES = 65_536;
const children = new Set();
let activeAnalyses = 0;
let capabilitiesCache = null;

if (!TOKEN || Buffer.byteLength(TOKEN) < 24) throw new Error('REA_SERVICE_TOKEN must be a secret of at least 24 bytes.');
if (!NODE_BIN || !existsSync(NODE_BIN)) throw new Error('Set REA_NODE_BIN to a supported Node.js runtime (for REA 6.8.0: ^22.23.4, ^24.22.1, or >=26.12.1).');
if (!CLI_PATH || !existsSync(CLI_PATH)) throw new Error('Set REA_CLI_PATH to the pinned rea-agents scripts/rea.mjs path.');

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

function authorised(req) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const provided = String(req.headers['x-rea-token'] || bearer || '');
  const expectedBuffer = Buffer.from(TOKEN);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

async function readJson(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('Use application/json.'), { status: 415 });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request body exceeds the bounded upload limit.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON request.'), { status: 400 });
  }
}

function safeFilename(value) {
  const base = path.basename(String(value || 'evidence.bin')).normalize('NFKC');
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 120);
  return cleaned || 'evidence.bin';
}

function validBase64(value) {
  return typeof value === 'string' && value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function killChild(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch {
    try { child.kill('SIGKILL'); } catch { /* already exited */ }
  }
}

function runRea(args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(NODE_BIN, [CLI_PATH, ...args, '--format', 'json', '--full-output'], {
      cwd,
      shell: false,
      detached: process.platform !== 'win32',
      env: {
        PATH: process.env.PATH || '/usr/bin:/bin',
        HOME: cwd,
        TMPDIR: cwd,
        NO_COLOR: '1',
        LANG: 'C.UTF-8',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(child);
    const stdout = [];
    const stderr = [];
    let stdoutSize = 0;
    let stderrSize = 0;
    let settled = false;
    let failure = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      children.delete(child);
      resolve(value);
    };
    const timer = setTimeout(() => {
      failure = `REA lane exceeded the ${Math.round(timeoutMs / 1000)} second timeout.`;
      killChild(child);
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdoutSize += chunk.length;
      if (stdoutSize > MAX_OUTPUT_BYTES) {
        failure = 'REA lane output exceeded the bounded summary limit.';
        killChild(child);
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrSize += chunk.length;
      if (stderrSize <= MAX_STDERR_BYTES) stderr.push(chunk);
    });
    child.on('error', (error) => finish({ envelope: null, error: error.message }));
    child.on('close', (code) => {
      if (failure) return finish({ envelope: null, error: failure });
      const output = Buffer.concat(stdout).toString('utf8');
      try {
        const envelope = JSON.parse(output);
        finish({ envelope, error: null, exitCode: code });
      } catch {
        finish({ envelope: null, error: `REA did not return bounded JSON (exit ${code}). ${Buffer.concat(stderr).toString('utf8').slice(-1200)}` });
      }
    });
  });
}

function sanitize(value, temporaryRoot, depth = 0) {
  if (depth > 14) return '[depth limited]';
  if (typeof value === 'string') return value.split(temporaryRoot).join('[temporary REA workspace]');
  if (Array.isArray(value)) return value.slice(0, 150).map((item) => sanitize(item, temporaryRoot, depth + 1));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === 'evidence_bundle') continue;
      output[key] = sanitize(item, temporaryRoot, depth + 1);
    }
    return output;
  }
  return value;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function projectLane(envelope, id, operation, temporaryRoot) {
  if (!envelope?.ok) {
    const error = envelope?.error || {};
    return {
      id,
      operation,
      status: ['capability_unavailable', 'target_unavailable'].includes(error.code) ? 'unsupported' : 'error',
      code: error.code || 'analysis_failed',
      message: error.message || 'REA did not return a completed analysis envelope.',
      remediation: error.remediation?.action || null,
      limitations: ['This lane did not produce a completed result; no finding is inferred from the failure.'],
    };
  }
  const summary = envelope.data?.summary || envelope.data || {};
  const normalized = summary.normalized_result || {};
  return {
    id,
    operation,
    status: 'completed',
    provider: summary.provider || null,
    summary: sanitize(summary, temporaryRoot),
    limitations: unique([
      ...(summary.limitations || []),
      ...(normalized.limitations || []),
      ...(normalized.summary?.limitations || []),
    ]).slice(0, 50),
  };
}

async function engineInfo() {
  try {
    const packageJson = JSON.parse(await fs.readFile(path.resolve(path.dirname(CLI_PATH), '../package.json'), 'utf8'));
    return { name: 'REA — Reverse Engineer Anything', package: packageJson.name || 'rea-agents', version: packageJson.version || 'unknown', source: 'https://github.com/morluto/rea', license: 'MIT' };
  } catch {
    return { name: 'REA — Reverse Engineer Anything', package: 'rea-agents', version: 'unknown', source: 'https://github.com/morluto/rea', license: 'MIT' };
  }
}

async function capabilities(temporaryRoot) {
  if (capabilitiesCache) return capabilitiesCache;
  const { envelope, error } = await runRea(['capabilities'], temporaryRoot, 20_000);
  if (error || !envelope?.ok) return { status: 'unavailable', message: error || envelope?.error?.message || 'Capability inventory failed.' };
  const data = envelope.data || {};
  capabilitiesCache = {
    status: 'available',
    built_in: (data.capabilities || []).map((entry) => ({
      id: entry.provider?.id,
      name: entry.provider?.name,
      available_operations: (entry.groups || []).filter((group) => group.available).flatMap((group) => group.operations || []),
      limitations: entry.shared_limitations || [],
    })),
    deep_providers: (data.analysis_provider_candidates || []).map((entry) => ({
      id: entry.provider?.id,
      name: entry.provider?.name,
      status: entry.availability?.status || 'unknown',
      reason: entry.availability?.reason || null,
      selected: Boolean(entry.selected),
    })),
  };
  return capabilitiesCache;
}

async function analyze(req, res) {
  if (activeAnalyses >= 2) return json(res, 429, { ok: false, status: 'busy', message: 'Two REA analyses are already running. Retry after one completes.' });
  const input = await readJson(req);
  const expectedHash = String(input.sha256 || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return json(res, 400, { ok: false, status: 'invalid_request', message: 'A valid SHA-256 digest is required.' });
  if (!validBase64(input.content_base64)) return json(res, 400, { ok: false, status: 'invalid_request', message: 'The file must be standard padded base64.' });
  const bytes = Buffer.from(input.content_base64, 'base64');
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) return json(res, 413, { ok: false, status: 'too_large', message: `File must be between 1 byte and ${MAX_FILE_BYTES} bytes.`, max_file_bytes: MAX_FILE_BYTES });
  if (bytes.toString('base64') !== input.content_base64) return json(res, 400, { ok: false, status: 'invalid_request', message: 'Base64 encoding is not canonical.' });
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== expectedHash) return json(res, 400, { ok: false, status: 'hash_mismatch', message: 'Uploaded bytes do not match the supplied SHA-256 digest.' });

  activeAnalyses += 1;
  const startedAt = new Date().toISOString();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spandr-rea-'));
  try {
    const inputDirectory = path.join(temporaryRoot, 'input');
    await fs.mkdir(inputDirectory, { mode: 0o700 });
    const filename = safeFilename(input.filename);
    const filePath = path.join(inputDirectory, filename);
    await fs.writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
    const extension = path.extname(filename).toLowerCase();
    const lanes = [];

    const artifact = await runRea([
      'inspect-artifact', filePath,
      '--detail', 'summary',
      '--evidence_output', path.join(temporaryRoot, 'artifact-evidence'),
      '--integrity-policy', 'fail',
    ], temporaryRoot, 20_000);
    lanes.push(artifact.error ? { id: 'artifact', operation: 'inspect_artifact', status: 'error', message: artifact.error, limitations: ['No artifact result is inferred from this failure.'] } : projectLane(artifact.envelope, 'artifact', 'inspect_artifact', temporaryRoot));

    if (['.js', '.mjs', '.cjs', '.asar'].includes(extension)) {
      const args = ['analyze-javascript-application', extension === '.asar' ? filePath : inputDirectory];
      if (extension !== '.asar') args.push('--source-path', filename, '--artifact-format', 'directory');
      else args.push('--artifact-format', 'asar');
      args.push(
        '--detail', 'summary',
        '--evidence_output', path.join(temporaryRoot, 'javascript-evidence'),
        '--max-heap-mb', '512',
        '--analysis-timeout-ms', '30000',
        '--max-semantic-nodes', '50000',
        '--max-semantic-nodes-per-file', '10000',
        '--max-semantic-unknowns', '50000',
        '--max-semantic-unknowns-per-file', '10000',
      );
      const javascript = await runRea(args, temporaryRoot, 35_000);
      lanes.push(javascript.error ? { id: 'javascript', operation: 'analyze_javascript_application', status: 'error', message: javascript.error, limitations: ['No JavaScript semantic result is inferred from this failure.'] } : projectLane(javascript.envelope, 'javascript', 'analyze_javascript_application', temporaryRoot));
    } else {
      lanes.push({ id: 'javascript', operation: 'analyze_javascript_application', status: 'not_applicable', message: 'JavaScript deep reconstruction is exposed only for .js, .mjs, .cjs, and .asar inputs in this bounded web lane.', limitations: ['Other formats retain the generic inspect_artifact result; no native decompiler or dynamic execution is implied.'] });
    }

    const completed = lanes.filter((lane) => lane.status === 'completed').length;
    return json(res, 200, {
      ok: completed > 0,
      status: completed > 0 ? 'completed' : 'unavailable',
      engine: await engineInfo(),
      file: { name: filename, size_bytes: bytes.length, sha256: actualHash },
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      lanes,
      limitations: [
        'Bounded static inspection only: the submitted file was not executed by this service.',
        'Results are summary projections. Temporary input copies and complete REA evidence bundles are deleted after the response.',
        'Unavailable, unsupported, partial, or empty lanes do not establish absence of malicious behaviour.',
        'No antivirus verdict, dynamic sandbox result, sender attribution, or legal certification is produced.',
      ],
    });
  } finally {
    activeAnalyses -= 1;
    await fs.rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!authorised(req)) return json(res, 401, { ok: false, status: 'unauthorised', message: 'A valid REA service token is required.' });
    if (req.method === 'GET' && req.url === '/status') {
      const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spandr-rea-status-'));
      try {
        return json(res, 200, {
          available: true,
          status: 'available',
          transport: 'Authenticated REA service through the configured same-origin proxy',
          engine: await engineInfo(),
          max_file_bytes: MAX_FILE_BYTES,
          lanes: [
            { id: 'artifact', operation: 'inspect_artifact', inputs: 'Bounded single files', behavior: 'Static inventory, observations, coverage, and next probes' },
            { id: 'javascript', operation: 'analyze_javascript_application', inputs: '.js, .mjs, .cjs, .asar', behavior: 'Bounded static JavaScript/Electron reconstruction; no target execution' },
          ],
          capabilities: await capabilities(temporaryRoot),
          upload_notice: 'Bytes are sent to this configured REA service only after the analyst presses Run deep inspection. Selecting a file alone does not upload it.',
          cleanup: 'Temporary input and evidence-bundle directories are deleted after each analysis response.',
        });
      } finally {
        await fs.rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
      }
    }
    if (req.method === 'POST' && req.url === '/analyze') return await analyze(req, res);
    return json(res, 404, { ok: false, status: 'not_found', message: 'Use GET /status or POST /analyze.' });
  } catch (error) {
    return json(res, error.status || 500, { ok: false, status: 'error', message: error.status ? error.message : 'REA service failed to process the request.' });
  }
});

server.requestTimeout = 75_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.listen(PORT, HOST, () => console.log(`REA analysis service listening on http://${HOST}:${PORT} (authentication required; token not logged).`));

function shutdown() {
  for (const child of children) killChild(child);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
