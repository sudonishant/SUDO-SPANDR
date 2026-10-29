#!/usr/bin/env node
/*
 * Verify that a deployed build actually serves the headers the repository
 * declares. Vercel dashboard overrides, preview deployments and older builds
 * silently drift from vercel.json — this script makes that drift visible.
 *
 * Usage:
 *   node scripts/verify-deploy-headers.mjs https://sudospandrsce.vercel.app
 *   DEPLOY_URL=https://example.com npm run verify:headers
 */

const target = process.argv[2] || process.env.DEPLOY_URL || '';

if (!target) {
  console.error('Usage: node scripts/verify-deploy-headers.mjs <https://deployment-url>');
  process.exit(2);
}

const url = target.replace(/\/+$/, '');
const EMBED_ORIGINS = ['https://webvm.io', 'https://copy.sh'];

function parseCsp(value) {
  const directives = {};
  for (const part of String(value || '').split(';')) {
    const [name, ...rest] = part.trim().split(/\s+/);
    if (name) directives[name.toLowerCase()] = rest;
  }
  return directives;
}

async function main() {
  let response;
  try {
    response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'spandr-header-check/1.0' } });
  } catch (error) {
    console.error(`✗ Could not reach ${url}: ${error.message}`);
    process.exit(1);
  }

  const headers = response.headers;
  const csp = parseCsp(headers.get('content-security-policy'));
  const frameSrc = csp['frame-src'] || [];
  const results = [];
  const add = (name, ok, detail) => results.push({ name, ok, detail });

  add('HTTP reachable', response.ok, `status ${response.status}`);

  add('Content-Security-Policy present', Boolean(headers.get('content-security-policy')), 'header must exist');

  const missingEmbed = EMBED_ORIGINS.filter((origin) => !frameSrc.includes(origin) && !frameSrc.some((entry) => {
    if (!entry.includes('*')) return false;
    const [scheme, host] = entry.replace('*.', '').split('://');
    return origin.startsWith(`${scheme}://`) && origin.endsWith(host);
  }));
  const schemeWildcard = frameSrc.some((entry) => entry === 'https:' || entry === 'http:' || entry === '*');
  add(
    'CSP frame-src allows the embedded WASM runtimes',
    schemeWildcard || missingEmbed.length === 0,
    missingEmbed.length && !schemeWildcard ? `missing ${missingEmbed.join(', ')}` : (schemeWildcard ? 'allowed by scheme wildcard' : 'ok'),
  );

  add(
    'CSP frame-src is not a bare scheme wildcard',
    !schemeWildcard,
    schemeWildcard ? 'frame-src https: lets any site be framed — pin the two engine origins' : 'ok',
  );

  const scriptSrc = csp['script-src'] || [];
  const wasmAllowed = scriptSrc.includes("'wasm-unsafe-eval'") || scriptSrc.includes("'unsafe-eval'");
  add(
    'CSP allows WebAssembly compilation',
    wasmAllowed,
    wasmAllowed ? 'wasm-unsafe-eval present' : "missing 'wasm-unsafe-eval' — the in-page x86 desktop cannot boot",
  );

  const coep = headers.get('cross-origin-embedder-policy') || '';
  add(
    'COEP enables crossOriginIsolated',
    /require-corp|credentialless/i.test(coep),
    coep ? `value: ${coep}` : 'missing — Browser Node.js (WebContainers) will not start',
  );

  add(
    'COOP is same-origin',
    (headers.get('cross-origin-opener-policy') || '').toLowerCase().startsWith('same-origin'),
    headers.get('cross-origin-opener-policy') || 'missing',
  );

  add('X-Frame-Options denies external framing', /deny/i.test(headers.get('x-frame-options') || ''), headers.get('x-frame-options') || 'missing');
  add('X-Content-Type-Options is nosniff', (headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff', 'ok');
  add('HSTS present', Boolean(headers.get('strict-transport-security')), headers.get('strict-transport-security') || 'missing');

  const failed = results.filter((item) => !item.ok);
  for (const item of results) {
    console.log(`${item.ok ? '✓' : '✗'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
  }

  console.log(`\n${results.length - failed.length}/${results.length} checks passed for ${url}`);
  if (failed.length) {
    console.log('Fix vercel.json (or the dashboard header override) and redeploy, then run this again.');
    process.exit(1);
  }
}

main();
