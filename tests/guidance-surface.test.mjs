import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const surfaceSource = readFileSync(new URL('../guide/surface.mjs', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../guide/style.css', import.meta.url), 'utf8');
function playwright() {
  try { return require('playwright'); }
  catch {
    return require(path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright'));
  }
}
function executablePath() {
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate));
}

test('panel Escape is isolated from host stop, composing is preserved, and destruction removes capture', async () => {
  // The empty browser context imports only the real surface module. All URLs are
  // fulfilled locally; no host, model, private chat, or existing profile is used.
  const browser = await playwright().chromium.launch({ headless: true, executablePath: executablePath() });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 720 } });
    await context.route('**/*', route => route.fulfill({ status: 200,
      contentType: route.request().url().endsWith('/surface.mjs') ? 'text/javascript' : 'text/html',
      body: route.request().url().endsWith('/surface.mjs') ? surfaceSource
        : '<!doctype html><title>Guidance keyboard regression</title><button id="host-target">Host control</button>' }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://guidance-surface.test/');
    await page.addStyleTag({ content: styleSource });
    await page.evaluate(async () => {
      window.hostStops = 0;
      window.hostKeys = [];
      // Register first: a late bubble listener would reproduce the native stop.
      document.addEventListener('keydown', event => {
        hostKeys.push(event.key);
        if (event.key === 'Escape' && !event.isComposing) hostStops++;
      });
      const { createGuideSurface } = await import('/surface.mjs');
      window.surface = createGuideSurface({ getStatus: () => ({ ready: true, enabled: true, status: 'idle' }) });
      surface.open();
    });
    const bounds = await page.locator('#mvu-guidance-panel').boundingBox();
    assert.ok(bounds.y >= 72 && bounds.y + bounds.height <= 712, 'narrow layout reserves host controls and bottom space');
    await page.locator('.guide-close').press('F2');
    assert.deepEqual(await page.evaluate(() => ({ hidden: surface.panel.hidden, keys: hostKeys })), { hidden: false, keys: ['F2'] });

    const composing = await page.evaluate(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true });
      document.querySelector('.guide-close').dispatchEvent(event);
      return { hidden: surface.panel.hidden, prevented: event.defaultPrevented, stops: hostStops, keys: hostKeys };
    });
    assert.deepEqual(composing, { hidden: false, prevented: false, stops: 0, keys: ['F2', 'Escape'] });

    await page.locator('.guide-close').press('Escape');
    assert.deepEqual(await page.evaluate(() => ({ hidden: surface.panel.hidden, stops: hostStops, keys: hostKeys })),
      { hidden: true, stops: 0, keys: ['F2', 'Escape'] });
    assert.equal(await page.evaluate(() => {
      surface.open();
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.querySelector('.guide-close').dispatchEvent(event);
      return event.defaultPrevented;
    }), true);

    await page.locator('#host-target').press('Escape');
    assert.equal(await page.evaluate(() => hostStops), 1, 'closed panel must leave host Escape available');
    await page.evaluate(() => { surface.open(); surface.destroy(); });
    assert.equal(await page.locator('#mvu-guidance-root').count(), 0);
    // Destroy while open: a leaked capture listener would still swallow Escape
    // because its detached panel is visible in the old closure.
    await page.locator('#host-target').press('Escape');
    assert.equal(await page.evaluate(() => hostStops), 2, 'destroy must remove capture with the matching option');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
