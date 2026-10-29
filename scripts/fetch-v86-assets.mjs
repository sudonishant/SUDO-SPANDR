#!/usr/bin/env node
/*
 * Fetch the assets needed by the in-page GUI desktop (SUDO Desktop).
 *
 * The desktop runs v86 — a real x86 PC emulated in WebAssembly — inside this
 * page. That needs three files that are not shipped by the npm package:
 *
 *   public/v86/seabios.bin    x86 system BIOS (SeaBIOS, LGPL-3.0)
 *   public/v86/vgabios.bin    VGA option ROM (Bochs VGABIOS, LGPL-2.1)
 *   public/v86/kolibri.img    KolibriOS 1.44 MB floppy image (GPL-2.0)
 *
 * They are committed to the repo so a static deploy works with no build-time
 * network access. This script only exists to re-fetch or update them, and it
 * verifies the SHA-256 of every download before writing.
 *
 * Usage:
 *   node scripts/fetch-v86-assets.mjs            # verify/refresh bundled assets
 *   node scripts/fetch-v86-assets.mjs --check    # verify only, no network
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'public', 'v86');

const ASSETS = [
  {
    file: 'seabios.bin',
    url: 'https://copy.sh/v86/bios/seabios.bin',
    sha256: '73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98',
    licence: 'SeaBIOS — LGPL-3.0',
  },
  {
    file: 'vgabios.bin',
    url: 'https://copy.sh/v86/bios/vgabios.bin',
    sha256: 'a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880',
    licence: 'Bochs VGABIOS — LGPL-2.1',
  },
  {
    file: 'kolibri.img',
    url: 'https://builds.kolibrios.org/en_US/data/data/kolibri.img',
    sha256: 'ae4f9ff74829d455e7db8bc6107a0475e888c74b7a9cbb6664700f984f0645f0',
    licence: 'KolibriOS — GPL-2.0',
  },
];

const checkOnly = process.argv.includes('--check');

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  let failures = 0;

  for (const asset of ASSETS) {
    const target = path.join(outDir, asset.file);

    if (await exists(target)) {
      const current = await readFile(target);
      const hash = digest(current);
      if (hash === asset.sha256) {
        console.log(`✓ ${asset.file} — already present and verified (${current.byteLength} bytes)`);
        continue;
      }
      console.log(`! ${asset.file} — present but checksum differs (${hash.slice(0, 12)}…)`);
      if (checkOnly) { failures++; continue; }
    } else if (checkOnly) {
      console.log(`✗ ${asset.file} — missing`);
      failures++;
      continue;
    }

    console.log(`↓ downloading ${asset.file} from ${asset.url}`);
    const response = await fetch(asset.url, { redirect: 'follow' });
    if (!response.ok) {
      console.error(`✗ ${asset.file} — HTTP ${response.status}`);
      failures++;
      continue;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const hash = digest(buffer);
    if (hash !== asset.sha256) {
      console.error(`✗ ${asset.file} — unexpected SHA-256 ${hash}`);
      console.error('  Upstream may have published a new build. Review the licence and update the pin above.');
      failures++;
      continue;
    }
    await writeFile(target, buffer);
    console.log(`✓ ${asset.file} — ${buffer.byteLength} bytes, sha256 ${hash.slice(0, 16)}… (${asset.licence})`);
  }

  if (failures) {
    console.error(`\n${failures} asset(s) failed. The in-page desktop will fall back to engine options that do not need them.`);
    process.exit(1);
  }
  console.log('\nAll in-page desktop assets verified.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
