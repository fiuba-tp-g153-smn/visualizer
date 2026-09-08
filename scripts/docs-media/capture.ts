/**
 * Screenshot and clip capture for the user manual.
 *
 * Every image and clip under docs/imgs/manual and docs/videos is produced by
 * this runner from the manifest in shots.config.ts — never by hand — so a
 * later change to the UI is a re-run, not a hunt for who has the original
 * screen recording. Run it with `make docs-media` (see README.md beside it).
 *
 * What makes a capture deterministic here, and why each step exists:
 *
 *   1. State is SEEDED, not clicked into. Each shot writes its localStorage
 *      keys (src/app/constants/storage-keys.constants.ts) with addInitScript
 *      before first paint, so the app boots straight into the wanted state.
 *   2. The map is PINNED: fixed centre, zoom and base map per shot, written
 *      through the same seeded keys, so two shots of one panel never differ by
 *      the terrain behind them.
 *   3. We wait for TILES, not for the network. Leaflet keeps prefetching, so
 *      `networkidle` never settles; instead we wait until no `.leaflet-tile`
 *      is still loading for two consecutive frames, then for the fade.
 *   4. The app points at REAL backends (the dev server is started with the
 *      URLs in BACKENDS below), so imagery is real without standing up the
 *      whole stack. Only the alerts backend is local, because generating an
 *      aviso writes to a database.
 *   5. The CURSOR is drawn by cursor.ts, injected before first paint, and moved
 *      with `page.mouse.move(x, y, { steps })` so it glides in clips.
 *
 * Annotations (numbered callouts) are drawn by injecting an outline and a badge
 * on the target selector before the shot, so they are reproduced on re-capture
 * instead of living in an edited PNG.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';

import { CURSOR_INIT_SCRIPT } from './cursor';
import { SHOTS, type Shot, type Step } from './shots.config';

// ── Backends ─────────────────────────────────────────────────────────────────
// The dev server injects these at build time (custom-webpack.config.js). Real
// data-service for real imagery; local alerts-service because the aviso clip
// writes an alert; local metrics-api for the Procesamiento tab.
export const BACKENDS = {
  DATA_SERVICE_BASE_URL: process.env.DATA_SERVICE_BASE_URL ?? 'https://data.mapasmn.com',
  ALERTS_SERVICE_BASE_URL: process.env.ALERTS_SERVICE_BASE_URL ?? 'http://localhost:6007',
  METRICS_SERVICE_BASE_URL: process.env.METRICS_SERVICE_BASE_URL ?? 'http://localhost:6020',
  DOCS_URL: '/docs-site',
};

const PORT = Number(process.env.DOCS_MEDIA_PORT ?? 4299);
const BASE_URL = process.env.DOCS_MEDIA_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const ROOT = resolve(__dirname, '..', '..');
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const DRY = process.argv.includes('--list');

// ── Dev server ───────────────────────────────────────────────────────────────

async function isUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await isUp(BASE_URL)) {
    console.log(`dev server already listening at ${BASE_URL} — reusing it`);
    return null;
  }
  if (process.env.DOCS_MEDIA_BASE_URL) {
    throw new Error(`DOCS_MEDIA_BASE_URL=${BASE_URL} is not answering`);
  }
  console.log(`starting ng serve on :${PORT} against`, BACKENDS);
  const child = spawn(
    'npx',
    ['ng', 'serve', '--port', String(PORT), '--host', '127.0.0.1', '--poll', '2000'],
    { cwd: ROOT, env: { ...process.env, ...BACKENDS }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  child.stdout?.on('data', (d) => process.stdout.write(`[ng] ${d}`));
  child.stderr?.on('data', (d) => process.stderr.write(`[ng] ${d}`));
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    if (await isUp(BASE_URL)) return child;
    await new Promise((r) => setTimeout(r, 2000));
  }
  child.kill();
  throw new Error('ng serve did not come up within 10 minutes');
}

// ── Seeding ──────────────────────────────────────────────────────────────────

/** Mirrors buildStorageKey() in src/app/constants/storage-keys.constants.ts. */
const STORAGE_VERSION = '2026-06-10T00:00:00Z';
export const key = (name: string) => `mapasmn.${name}@${STORAGE_VERSION}`;

function seedScript(seed: Record<string, unknown>): string {
  const entries = Object.entries(seed).map(([name, value]) => [key(name), JSON.stringify(value)]);
  return `(() => {
    try { localStorage.clear(); } catch (e) {}
    for (const [k, v] of ${JSON.stringify(entries)}) {
      try { localStorage.setItem(k, v); } catch (e) {}
    }
  })();`;
}

// ── Waiting ──────────────────────────────────────────────────────────────────

/** Resolve when no Leaflet tile is loading for two consecutive frames, plus the fade. */
export async function waitForTiles(page: Page, timeoutMs = 60_000): Promise<void> {
  // A string expression, not a TS function: tsx injects a `__name` helper into
  // serialised functions that does not exist inside the page.
  const NONE_LOADING =
    "document.querySelectorAll('.leaflet-tile-loaded').length > 0 && " +
    "document.querySelectorAll('.leaflet-tile:not(.leaflet-tile-loaded)').length === 0";
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await page.waitForFunction(NONE_LOADING, undefined, { timeout: Math.max(1, deadline - Date.now()), polling: 'raf' });
    await page.evaluate('new Promise((r) => requestAnimationFrame(() => r(0)))');
    if (await page.evaluate(NONE_LOADING)) break;
    if (Date.now() > deadline) throw new Error('tiles kept loading past the deadline');
  }
  await page.waitForTimeout(250);
}

async function waitFor(page: Page, shot: Shot): Promise<void> {
  if (shot.waitFor) await page.locator(shot.waitFor).first().waitFor({ state: 'visible' });
  if (shot.waitTiles !== false) await waitForTiles(page);
  await page.waitForTimeout(shot.settleMs ?? 400);
}

// ── Cursor motion and steps ──────────────────────────────────────────────────

async function glideTo(page: Page, target: Locator | { x: number; y: number }, steps = 25) {
  let x: number;
  let y: number;
  if ('x' in target) {
    ({ x, y } = target);
  } else {
    const box = await target.boundingBox();
    if (!box) throw new Error('target has no bounding box');
    x = box.x + box.width / 2;
    y = box.y + box.height / 2;
  }
  await page.mouse.move(x, y, { steps });
  return { x, y };
}

async function runStep(page: Page, step: Step): Promise<void> {
  switch (step.do) {
    case 'click': {
      const target = page.locator(step.target).first();
      await target.waitFor({ state: 'visible' });
      // Glide the pointer there for the cursor overlay, then let Playwright do the
      // actionable click (it re-checks visibility and scrolls into view).
      await glideTo(page, target, step.steps);
      try {
        await target.click({ timeout: 8_000 });
      } catch {
        // A Material tooltip left open by the pointer can sit over the target and
        // fail the hit test; the element itself is fine, so click it directly.
        await target.dispatchEvent('click');
      }
      await page.waitForTimeout(step.pauseMs ?? 500);
      return;
    }
    case 'dblclick': {
      const target = page.locator(step.target).first();
      await target.waitFor({ state: 'visible' });
      await glideTo(page, target, step.steps);
      await target.dblclick();
      await page.waitForTimeout(step.pauseMs ?? 500);
      return;
    }
    case 'clickAt': {
      await glideTo(page, { x: step.x, y: step.y }, step.steps);
      await page.mouse.down();
      await page.waitForTimeout(80);
      await page.mouse.up();
      await page.waitForTimeout(step.pauseMs ?? 500);
      return;
    }
    case 'dblclickAt': {
      await glideTo(page, { x: step.x, y: step.y }, step.steps);
      await page.mouse.dblclick(step.x, step.y);
      await page.waitForTimeout(step.pauseMs ?? 500);
      return;
    }
    case 'rightClick': {
      const target = page.locator(step.target).first();
      await glideTo(page, target, step.steps);
      await page.mouse.down({ button: 'right' });
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(step.pauseMs ?? 500);
      return;
    }
    case 'rightClickAt': {
      await glideTo(page, { x: step.x, y: step.y }, step.steps);
      await page.mouse.down({ button: 'right' });
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(step.pauseMs ?? 500);
      return;
    }
    case 'drag': {
      const target = page.locator(step.target).first();
      await target.waitFor({ state: 'visible' });
      const from = await glideTo(page, target, step.steps);
      await page.mouse.down();
      await page.mouse.move(from.x + step.dx, from.y + step.dy, { steps: step.steps ?? 25 });
      await page.mouse.up();
      await page.waitForTimeout(step.pauseMs ?? 500);
      return;
    }
    case 'hover': {
      await glideTo(page, page.locator(step.target).first(), step.steps);
      await page.waitForTimeout(step.pauseMs ?? 500);
      return;
    }
    case 'moveTo': {
      await glideTo(page, { x: step.x, y: step.y }, step.steps);
      await page.waitForTimeout(step.pauseMs ?? 200);
      return;
    }
    case 'type': {
      const target = page.locator(step.target).first();
      await glideTo(page, target, step.steps);
      await target.click();
      await target.fill('');
      await target.pressSequentially(step.text, { delay: 60 });
      await page.waitForTimeout(step.pauseMs ?? 500);
      return;
    }
    case 'press': {
      await page.keyboard.press(step.key);
      await page.waitForTimeout(step.pauseMs ?? 300);
      return;
    }
    case 'wait': {
      await page.waitForTimeout(step.ms);
      return;
    }
    case 'waitFor': {
      await page.locator(step.target).first().waitFor({ state: 'visible', timeout: step.timeoutMs ?? 60_000 });
      await page.waitForTimeout(step.pauseMs ?? 300);
      return;
    }
    case 'waitTiles': {
      await waitForTiles(page);
      return;
    }
    case 'scrollIntoView': {
      await page.locator(step.target).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(step.pauseMs ?? 300);
      return;
    }
    case 'evaluate': {
      await page.evaluate(step.script);
      await page.waitForTimeout(step.pauseMs ?? 200);
      return;
    }
  }
}

// ── Annotation ───────────────────────────────────────────────────────────────

const ANNOTATE_CSS = `
  .docs-callout { outline: 3px solid #f5a623 !important; outline-offset: 3px !important;
                  box-shadow: 0 0 0 6px rgba(245, 166, 35, 0.25) !important; position: relative; }
  .docs-callout-badge { position: absolute; z-index: 2147483000; width: 26px; height: 26px;
                        border-radius: 50%; background: #f5a623; color: #1d233f; font: 700 15px/26px system-ui, sans-serif;
                        text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.4); pointer-events: none; }
`;

async function annotate(page: Page, selectors: string[], clipSelector?: string): Promise<void> {
  await page.addStyleTag({ content: ANNOTATE_CSS });
  await page.evaluate(([sels, clipSel]) => {
    // Badges sit just outside the element's top-left corner; inside a clipped panel
    // they are pulled back in so the crop does not cut them in half.
    const bounds = clipSel ? document.querySelector(clipSel)?.getBoundingClientRect() ?? null : null;
    sels.forEach((sel, i) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) throw new Error(`annotate: selector not found: ${sel}`);
      el.classList.add('docs-callout');
      const rect = el.getBoundingClientRect();
      const badge = document.createElement('div');
      badge.className = 'docs-callout-badge';
      badge.textContent = String(i + 1);
      let left = rect.left - 14;
      let top = rect.top - 14;
      if (bounds) {
        left = Math.max(left, bounds.left + 2);
        top = Math.max(top, bounds.top + 2);
      }
      badge.style.left = `${left}px`;
      badge.style.top = `${top}px`;
      badge.style.position = 'fixed';
      document.body.appendChild(badge);
    });
  }, [selectors, clipSelector ?? null] as const);
  await page.waitForTimeout(150);
}

// ── One shot ─────────────────────────────────────────────────────────────────

async function openPage(browser: Browser, shot: Shot, recordDir?: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.kind === 'shot' ? 2 : 1,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    recordVideo: recordDir ? { dir: recordDir, size: shot.viewport } : undefined,
  });
  await context.addInitScript(seedScript(shot.seed));
  if (shot.kind === 'clip' || shot.cursor) await context.addInitScript(CURSOR_INIT_SCRIPT);
  const page = await context.newPage();
  page.on('pageerror', (err) => console.warn(`  [page error] ${err.message}`));
  await page.goto(`${BASE_URL}${shot.route}`, { waitUntil: 'load' });
  // The app shows a splash until the bundle boots; nothing below is meaningful before this.
  const ready = shot.route.startsWith('/status') ? '.status__bar' : shot.route.startsWith('/docs') ? '.docs-header' : 'mat-card.button-bar';
  await page.locator(ready).first().waitFor({ state: 'visible', timeout: 120_000 });
  // The static splash (#app-splash in index.html) stays painted over the app until the
  // zone is stable; a screenshot taken before it goes is a blue rectangle with a logo.
  await page.locator('#app-splash').waitFor({ state: 'detached', timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  return { context, page };
}

async function captureShot(browser: Browser, shot: Shot): Promise<void> {
  const out = resolve(ROOT, shot.output);
  mkdirSync(dirname(out), { recursive: true });
  const { context, page } = await openPage(browser, shot);
  try {
    for (const step of shot.steps ?? []) await runStep(page, step);
    await waitFor(page, shot);
    // Stills: a tooltip left behind by the last click would sit on top of the
    // panel; hide them for the screenshot only (clips keep them, they are useful there).
    await page.addStyleTag({ content: '.mat-mdc-tooltip, .mdc-tooltip { display: none !important; }' });
    await page.waitForTimeout(150);
    if (shot.annotate?.length) await annotate(page, shot.annotate, shot.clip);
    if (shot.clip) {
      await page.locator(shot.clip).first().screenshot({ path: out, type: 'png' });
    } else {
      await page.screenshot({ path: out, type: 'png', fullPage: false });
    }
  } catch (err) {
    await debugShot(page, shot.id);
    throw err;
  } finally {
    await context.close();
  }
}

/** On failure, keep a full-page screenshot under tmp/docs-media so the drift is visible. */
async function debugShot(page: Page, id: string): Promise<void> {
  try {
    const dir = resolve(ROOT, 'tmp', 'docs-media');
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: resolve(dir, `${id}-failed.png`), fullPage: false });
    console.log(`  debug screenshot: tmp/docs-media/${id}-failed.png`);
  } catch {
    /* best effort */
  }
}

async function captureClip(browser: Browser, shot: Shot): Promise<void> {
  const out = resolve(ROOT, shot.output);
  mkdirSync(dirname(out), { recursive: true });
  const tmp = resolve(ROOT, 'tmp', 'docs-media', shot.id);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  // The recording starts when the page is created, so it opens with the load
  // and the splash; remember when the app became ready and cut the head off.
  const openedAt = Date.now();
  const { context, page } = await openPage(browser, shot, tmp);
  let video: string | null = null;
  let readyOffsetS = 0;
  try {
    await waitFor(page, shot);
    readyOffsetS = (Date.now() - openedAt) / 1000;
    // Bring the cursor on screen before anything happens.
    await page.mouse.move(shot.viewport.width / 2, shot.viewport.height / 2, { steps: 1 });
    await page.waitForTimeout(400);
    for (const step of shot.steps ?? []) await runStep(page, step);
    await page.waitForTimeout(shot.tailMs ?? 1200);
    video = (await page.video()?.path()) ?? null;
  } catch (err) {
    await debugShot(page, shot.id);
    throw err;
  } finally {
    await context.close(); // flushes the recording
  }
  if (!video) throw new Error(`no video recorded for ${shot.id}`);
  // Playwright records VP8/WebM at the context viewport; re-encode to a
  // compact VP9 so the clip is small enough to ship, then cut the poster.
  const ff = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-ss', readyOffsetS.toFixed(2), '-i', video,
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1', '-an',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    out,
  ]);
  if (ff.status !== 0) throw new Error(`ffmpeg failed for ${shot.id}: ${ff.stderr}`);
  const poster = out.replace(/\.webm$/, '-poster.webp');
  const fp = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.5', '-i', out, '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", poster]);
  if (fp.status !== 0) throw new Error(`poster failed for ${shot.id}: ${fp.stderr}`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]);
  const seconds = Number.parseFloat(probe.stdout.toString().trim());
  if (Number.isFinite(seconds)) process.stdout.write(`${seconds.toFixed(1)} s of clip, `);
  rmSync(tmp, { recursive: true, force: true });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const selected = SHOTS.filter((s) => ONLY.length === 0 || ONLY.includes(s.id));
  if (DRY) {
    for (const s of selected) console.log(`${s.kind.padEnd(4)} ${s.id.padEnd(34)} ${s.output}${s.blocked ? `  BLOCKED: ${s.blocked}` : ''}`);
    return 0;
  }
  const localAlerts = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BACKENDS.ALERTS_SERVICE_BASE_URL);
  for (const s of selected.filter((s) => s.blocked)) console.log(`skip ${s.id}: BLOCKED — ${s.blocked}`);
  for (const s of selected.filter((s) => s.requiresLocalAlerts && !localAlerts)) console.log(`skip ${s.id}: writes an alert and ALERTS_SERVICE_BASE_URL is not local`);
  const runnable = selected.filter((s) => !s.blocked && !(s.requiresLocalAlerts && !localAlerts));

  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];
  try {
    for (const shot of runnable) {
      const t0 = Date.now();
      process.stdout.write(`${shot.kind} ${shot.id} … `);
      try {
        if (shot.kind === 'clip') await captureClip(browser, shot);
        else await captureShot(browser, shot);
        const size = statSync(resolve(ROOT, shot.output)).size;
        console.log(`ok (${Math.round(size / 1024)} kB, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      } catch (err) {
        console.log(`FAILED: ${(err as Error).message}`);
        failures.push(shot.id);
      }
    }
  } finally {
    await browser.close();
    server?.kill();
  }
  if (failures.length) {
    console.log(`\n${failures.length} capture(s) failed: ${failures.join(', ')}`);
    return 1;
  }
  console.log(`\n${runnable.length} capture(s) written`);
  return 0;
}

main().then((code) => process.exit(code), (err) => { console.error(err); process.exit(1); });
