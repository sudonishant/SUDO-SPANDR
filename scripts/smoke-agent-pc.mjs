#!/usr/bin/env node
/*
 * Agent PC smoke test — boots the in-page x86 desktop in a real browser and
 * checks the lifecycle, the capture path and the mobile layout.
 *
 * Playwright is intentionally NOT a dependency of this repository (it pulls a
 * ~150 MB browser). Install it once, then run the test:
 *
 *   npm i -D playwright && npx playwright install chromium
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/smoke-agent-pc.mjs http://127.0.0.1:4173
 *
 * Exit code 0 means every assertion passed.
 */

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const base = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

try {
  /* ---------- desktop viewport: launchpad + boot + capture + stop ---------- */
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${base}/?engine=desktop#/sandbox`, { waitUntil: 'networkidle' });
  check('Agent PC route loads', (await page.title()).includes('Agent PC'), await page.title());

  const cards = await page.locator('.agent-pc__card-head strong').allTextContents();
  check('Runtime launchpad lists all engines', cards.length === 4, cards.join(' / '));
  check('Deep link selects SUDO Desktop', await page.locator('.agent-pc__card.is-active').innerText().then((t) => t.includes('SUDO Desktop')));

  await page.getByRole('button', { name: /Boot SUDO Desktop/i }).click();

  let lit = 0;
  let phase = '';
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    phase = await page.locator('.native-pc').getAttribute('data-phase');
    lit = await page.evaluate(() => {
      const canvas = document.querySelector('.native-pc__canvas');
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas.width) return 0;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4 * 211) if (data[i] + data[i + 1] + data[i + 2] > 30) count++;
      return count;
    });
    if (phase === 'running' && lit > 40) break;
  }
  check('Guest reaches running state', phase === 'running', `phase=${phase}`);
  check('Guest actually draws its GUI', lit > 40, `${lit} lit samples on canvas`);
  check(
    'Runtime status reflects the running guest',
    (await page.locator('.hosted-computer').getAttribute('data-runtime-status')) === 'running',
  );
  await page.locator('.native-pc').scrollIntoViewIfNeeded();
  await page.waitForTimeout(7000); // let the guest finish painting its desktop
  await page.locator('.native-pc').screenshot({ path: 'docs/ui/agent-pc-desktop.png' });

  await page.getByRole('button', { name: /^Snapshot$/ }).last().click();
  await page.waitForTimeout(1500);
  const meta = await page.locator('.native-pc__meta').innerText();
  check('Snapshot records a PNG with a SHA-256', /last screenshot \d+ KB · [0-9a-f]{16}/.test(meta.replace(/\n/g, ' ')), meta.replace(/\n/g, ' | '));

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    page.locator('.native-pc__link').click(),
  ]);
  if (download) {
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    check('Downloaded capture is a real PNG', buffer.length > 1000 && buffer.slice(1, 4).toString() === 'PNG', `${buffer.length} bytes`);
  }

  await page.getByRole('button', { name: /^Stop$/ }).click();
  await page.waitForTimeout(2500);
  check('Stop tears the emulator down', (await page.locator('.native-pc').count()) === 0);
  check('Status returns to stopped', (await page.locator('.hosted-computer').getAttribute('data-runtime-status')) === 'stopped');
  check('No uncaught page errors on desktop flow', errors.length === 0, errors.slice(0, 3).join(' | '));

  /* ---------- mobile viewport: layout only, no boot ---------- */
  const mobile = await browser.newPage({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  });
  await mobile.goto(`${base}/?engine=desktop#/sandbox`, { waitUntil: 'networkidle' });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('No horizontal overflow on mobile', overflow <= 1, `overflow ${overflow}px`);
  const mobileCards = await mobile.locator('.agent-pc__card').count();
  check('Launchpad renders on mobile', mobileCards === 4, `${mobileCards} cards`);
  await mobile.locator('.agent-pc__preflight').scrollIntoViewIfNeeded();
  const deviceWarning = await mobile.locator('.agent-pc__device-warn').count();
  check('Mobile device warning is shown', deviceWarning === 1);
  await mobile.screenshot({ path: 'docs/ui/agent-pc-mobile.png' });

  /* ---------- launchpad screenshot for the docs ---------- */
  await page.screenshot({ path: 'docs/ui/agent-pc-launchpad.png' });
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${base}`);
process.exit(failed.length ? 1 : 0);
