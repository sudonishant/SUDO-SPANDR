#!/usr/bin/env node
/*
 * Deployment budget guard.
 *
 * Vercel Hobby allows max 12 serverless functions per deployment, and every
 * non-underscore file under api/ counts as one (api/_lib/* is exempt). This
 * project has already broken production deploys twice by crossing that line:
 * the deploy fails, the previous build stays live, and the site silently keeps
 * serving stale code and stale headers.
 *
 * This script also checks that the URLs the browser actually calls are routed
 * somewhere real — /api/v1/rea/status was called by the UI for months while the
 * files were named rea-status.js, so every request 404'd.
 *
 * Usage:
 *   node scripts/check-vercel-functions.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const apiDir = path.join(root, 'api');
const LIMIT = 12;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_lib' || entry.name === 'node_modules') continue;
      files.push(...await walk(full));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

/** Every browser-facing URL that must resolve to a function. */
const REQUIRED_ROUTES = [
  { url: '/api/v1/rea/status', file: 'api/v1/rea/[...path].js' },
  { url: '/api/v1/rea/analyze', file: 'api/v1/rea/[...path].js' },
  { url: '/api/v1/sandbox/lab/toolbox', file: 'api/v1/sandbox/lab/[...path].js' },
  { url: '/api/v1/sandbox/preview-frame', via: '/api/v1/sandbox/lab/preview-frame' },
  { url: '/api/v1/analyse-eml', optional: true },
];

const files = (await walk(apiDir)).map((file) => path.relative(root, file)).sort();
const failures = [];

console.log(`Serverless functions under api/: ${files.length} (limit ${LIMIT})`);
for (const file of files) console.log(`  · ${file}`);

if (files.length > LIMIT) {
  failures.push(
    `${files.length} functions exceed the Vercel Hobby limit of ${LIMIT}. Merge related endpoints into one catch-all file (see api/v1/rea/[...path].js).`,
  );
}

const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const rewrites = config.rewrites || [];
const rewriteSources = new Set(rewrites.map((rule) => rule.source));

for (const route of REQUIRED_ROUTES) {
  if (route.optional) continue;
  const exists = files.includes(route.file || '');
  if (!exists && !route.via) {
    failures.push(`${route.url} has no function file (${route.file || 'n/a'}).`);
    continue;
  }
  if (route.via && !rewriteSources.has(route.url)) {
    failures.push(`${route.url} needs a rewrite to ${route.via} in vercel.json.`);
  }
  console.log(`✓ ${route.url} → ${route.file || route.via}`);
}

// A moved endpoint must keep its old URL working for existing bookmarks.
for (const legacy of ['/api/v1/rea-analyze', '/api/v1/rea-status', '/api/v1/sandbox/preview-frame']) {
  if (!rewriteSources.has(legacy)) failures.push(`Legacy URL ${legacy} lost its rewrite.`);
}

if (failures.length) {
  console.error('\nDeployment budget check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`\nDeployment budget check passed: ${files.length}/${LIMIT} functions, all required routes routed.`);
