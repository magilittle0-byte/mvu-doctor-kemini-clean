const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const vendorRoot = path.join(repoRoot, 'vendor', 'world-engine-v3.0.2');

function loadPlaywright() {
  try { return require('playwright'); }
  catch {
    const bundled = path.join(
      os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright',
    );
    if (fs.existsSync(bundled)) return require(bundled);
    throw new Error('Playwright module is unavailable; vendor reroll injection gate cannot run.');
  }
}

function systemBrowser() {
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('No installed Chromium/Chrome/Edge executable was found.');
  return found;
}

const moduleStubs = {
  'world-engine-store.js': `{
    const data=new Map();
    window.__vendorWorldStore=data;
    window.WORLD_ENGINE_STORE={
      hydrate:async()=>{},
      getItem:(key)=>data.has(key)?data.get(key):null,
      setItem:(key,value)=>data.set(key,String(value)),
      removeItem:(key)=>data.delete(key),
      keys:()=>[...data.keys()]
    };
  }`,
  'world-engine-api.js': `window.WORLD_ENGINE_API={
    callApi:async()=>'',
    getSettings:()=>({engineEnabled:true,injectIntoPrompt:true,injectAllLevels:true,injectMaxChars:12000})
  };`,
  'world-engine-worldbook.js': `window.WORLD_ENGINE_WORLDBOOK={buildPromptSection:async()=>''};`,
  'world-engine-chatcache.js': `window.WORLD_ENGINE_CHATCACHE={init:()=>{}};`,
  'world-engine-inject-inspector.js': `window.WORLD_ENGINE_INJECT_INSPECTOR={init:()=>{}};`,
  'world-engine-preset.js': `window.WORLD_ENGINE_PRESET={getActivePreset:()=>({})};`,
  'world-engine-rules-loader.js': `window.WORLD_ENGINE_RULES={loadRules:async()=>({count:0}),getCoreRulesSummary:()=>''};`,
  'world-engine-ledger.js': `window.WORLD_ENGINE_LEDGER={recordChanges:()=>{}};`,
  'world-engine-evolution.js': `window.WORLD_ENGINE_EVOLUTION={evolve:async()=>true,abort:()=>{},isRunning:()=>false};`,
  'memory-engine-settings.js': `window.MEMORY_ENGINE_SETTINGS={getSettings:()=>({}),patchSettings:()=>{}};`,
  'memory-engine-data.js': `window.MEMORY_ENGINE_DATA={loadState:()=>({}),saveState:()=>{}};`,
  'memory-engine-timeline.js': `window.MEMORY_ENGINE_TIMELINE={captureRange:()=>[],auditRefs:()=>({}),syncHidden:()=>{}};`,
  'memory-engine-prompt.js': `window.MEMORY_ENGINE_PROMPT={buildUserPrompt:()=>''};`,
  'memory-engine-small-summary-prompt.js': `window.MEMORY_ENGINE_SMALL_SUMMARY_PROMPT={buildUserPrompt:()=>''};`,
  'memory-engine-big-summary-prompt.js': `window.MEMORY_ENGINE_BIG_SUMMARY_PROMPT={buildUserPrompt:()=>''};`,
  'memory-engine.js': `window.MEMORY_ENGINE={init:()=>{},applyInjection:()=>{},abort:()=>{},isRunning:()=>false};`,
  'world-engine-diag.js': `window.WORLD_ENGINE_DIAG={collect:()=>({}),download:()=>{}};`,
  'world-engine-ui.js': `window.WORLD_ENGINE_UI={
    buildPanel:()=>{},buildInputButton:()=>{},refresh:()=>{},setInjectedScope:(value)=>{window.__scope=value;}
  };`,
};

function worldState(round, marker, chatLayer) {
  return {
    round,
    chatLayer,
    worldDigest: marker,
    memories: [], events: [], factions: [], worldTrends: [],
    winds: [{ type: 'report', level: 4, scope: '测试范围', content: marker }],
    enemies: [], influenceChain: [],
    reputation: {}, economy: { climate: '平稳', signals: [] },
    regionalIncident: { active: false },
    blackbox: { secretActions: [], secretAssets: [] },
  };
}

test('frozen World Engine generation-start reroll injects checkpoint rather than current branch', async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: systemBrowser(),
    headless: true,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  const browserLogs = [];
  page.on('console', (message) => browserLogs.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => browserLogs.push(`pageerror: ${error?.stack || error}`));
  try {
    await page.route('https://vendor-reroll.test/**', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head></head><body></body></html>',
    }));
    await page.route('https://world-engine.test/**', (route) => {
      const url = new URL(route.request().url());
      const basename = path.posix.basename(url.pathname);
      if (basename === 'manifest.json') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: '3.0.2' }) });
      }
      if (basename === 'world-engine.js' || basename === 'world-engine-core.js' || basename === 'world-engine-inject.js') {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: fs.readFileSync(path.join(vendorRoot, basename), 'utf8'),
        });
      }
      if (Object.hasOwn(moduleStubs, basename)) {
        return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: moduleStubs[basename] });
      }
      return route.abort();
    });
    await page.goto('https://vendor-reroll.test/');
    await page.evaluate(() => {
      const listeners = new Map();
      const eventSource = {
        on(name, handler) {
          const list = listeners.get(name) || [];
          list.push(handler);
          listeners.set(name, list);
        },
        async emit(name, ...args) {
          for (const handler of listeners.get(name) || []) await handler(...args);
        },
      };
      window.__injections = [];
      window.__context = {
        chatId: 'chat-a',
        chat: [{ is_user: true, mes: '请重写。' }, { is_user: false, mes: '旧正文', swipe_id: 0 }],
        eventSource,
        event_types: {
          GENERATION_ENDED: 'generation_ended', CHAT_LOADED: 'chat_loaded',
          MESSAGE_SWIPED: 'message_swiped', GENERATION_STARTED: 'generation_started',
        },
        setExtensionPrompt(name, content, position, depth) {
          window.__injections.push({ name, content: String(content || ''), position, depth });
        },
      };
      window.SillyTavern = { getContext: () => window.__context };
      window.__emitVendor = (...args) => eventSource.emit(...args);
    });
    await page.addScriptTag({ url: 'https://world-engine.test/world-engine.js' });
    try { await page.waitForFunction(() => Boolean(window.WORLD_ENGINE), null, { timeout: 8000 }); }
    catch (error) { throw new Error(`${error.message}\n${browserLogs.join('\n')}`); }
    await page.evaluate(({ current, checkpoint }) => {
      window.WORLD_ENGINE_CORE.saveState(current);
      window.WORLD_ENGINE_CORE.saveCheckpoint(checkpoint);
      window.__injections.length = 0;
    }, {
      current: worldState(6, 'OLD_WORLD_SENTINEL', 20),
      checkpoint: worldState(5, 'BASE_WORLD_SENTINEL', 18),
    });

    await page.evaluate(async () => {
      await window.__emitVendor('message_swiped', 1);
      await window.__emitVendor('generation_started', 'regenerate', {}, false);
    });
    const evidence = await page.evaluate(() => ({ injections: window.__injections, scope: window.__scope }));
    assert.ok(evidence.injections.length >= 2);
    const last = evidence.injections.at(-1);
    assert.equal(last.name, 'world-engine-world');
    assert.equal(last.position, 1);
    assert.equal(last.depth, 1);
    assert.match(last.content, /BASE_WORLD_SENTINEL/u);
    assert.doesNotMatch(last.content, /OLD_WORLD_SENTINEL/u);
    assert.equal(evidence.scope, 'checkpoint');
  } finally {
    await page.close();
    await browser.close();
  }
});

test('frozen World Engine checkpoint restore then forward replaces the rejected swipe state', async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: systemBrowser(),
    headless: true,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  try {
    await page.goto('about:blank');
    await page.evaluate(() => {
      const data = new Map();
      window.WORLD_ENGINE_STORE = {
        hydrate: async () => {},
        getItem: (key) => data.has(key) ? data.get(key) : null,
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: (key) => data.delete(key),
        keys: () => [...data.keys()],
      };
      window.__context = {
        chatId: 'chat-a',
        chat: [{ is_user: true, mes: '请重写。' }, { is_user: false, mes: '新的正文', swipe_id: 1 }],
      };
      window.SillyTavern = { getContext: () => window.__context };
      window.WORLD_ENGINE_API = {
        getSettings: () => ({
          localRegionalIncidentChancePercent: 0,
          localNearEventChancePercent: 0,
          localDistantEventChancePercent: 0,
          localCapWorldTrends: 4,
          localCapEnemies: 8,
          localCapInfluence: 12,
          localCapEconomySignals: 8,
          localCapBlackbox: 12,
          apiAutoRetries: 0,
        }),
        callApi: async () => JSON.stringify({
          events: [], factions: [], worldTrends: [],
          winds: [{ id: null, topic: '新分支风声', type: 'report', level: 1, content: 'FORWARDED_WORLD_SENTINEL', scope: '测试区', source: '新正文' }],
          economy: { climate: '平稳', signals: [] },
          reputation: {},
          world_digest: 'FORWARDED_WORLD_SENTINEL',
          enemies: [], influenceChain: [],
          blackbox: { secretActions: [], secretAssets: [] },
        }),
        parseJSON: (value) => JSON.parse(value),
      };
      window.WORLD_ENGINE_RULES = { getAllRulesText: () => '测试规则' };
      window.WORLD_ENGINE_WORLDBOOK = { buildPromptSection: async () => '' };
      window.WORLD_ENGINE_PRESET = { getOverrides: () => null };
      window.MEMORY_ENGINE = { buildWorldEngineContext: () => '' };
      Math.random = () => 0.99;
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(vendorRoot, 'world-engine-core.js'), 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync(path.join(vendorRoot, 'world-engine-evolution.js'), 'utf8') });

    const evidence = await page.evaluate(async ({ current, checkpoint }) => {
      const core = window.WORLD_ENGINE_CORE;
      core.saveState(current);
      core.saveCheckpoint(checkpoint);

      // This is the minimal Doctor adapter sequence: reuse the frozen a/b
      // mechanism, then let the frozen forward path own all state mutation.
      const base = core.restoreCheckpoint();
      core.saveState(base);
      const working = core.loadState();
      const ok = await window.WORLD_ENGINE_EVOLUTION.evolve(
        working,
        '请重写。',
        '新的正文',
        { mode: 'forward', dialogueText: '用户：请重写。\nAI：新的正文' },
      );
      return {
        ok,
        current: core.loadState(),
        checkpoint: core.restoreCheckpoint(),
      };
    }, {
      current: worldState(6, 'OLD_WORLD_SENTINEL', 20),
      checkpoint: worldState(5, 'BASE_WORLD_SENTINEL', 18),
    });

    assert.equal(evidence.ok, true);
    assert.equal(evidence.current.round, 6);
    assert.equal(evidence.current.worldDigest, 'FORWARDED_WORLD_SENTINEL');
    assert.match(JSON.stringify(evidence.current), /FORWARDED_WORLD_SENTINEL/u);
    assert.doesNotMatch(JSON.stringify(evidence.current), /OLD_WORLD_SENTINEL/u);
    assert.equal(evidence.checkpoint.round, 5);
    assert.match(JSON.stringify(evidence.checkpoint), /BASE_WORLD_SENTINEL/u);
    assert.doesNotMatch(JSON.stringify(evidence.checkpoint), /OLD_WORLD_SENTINEL/u);
  } finally {
    await page.close();
    await browser.close();
  }
});
