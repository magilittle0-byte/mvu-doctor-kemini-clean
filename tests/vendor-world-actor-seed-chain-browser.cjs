const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const vendorRoot = path.join(repoRoot, 'vendor', 'world-engine-v3.0.2');

const vendorModules = [
  'world-engine-store.js',
  'world-engine-core.js',
  'world-engine-api.js',
  'world-engine-worldbook.js',
  'world-engine-chatcache.js',
  'world-engine-inject-inspector.js',
  'world-engine-preset.js',
  'world-engine-rules-loader.js',
  'world-engine-ledger.js',
  'world-engine-evolution.js',
  'world-engine-inject.js',
  'memory-engine-settings.js',
  'memory-engine-data.js',
  'memory-engine-timeline.js',
  'memory-engine-prompt.js',
  'memory-engine-small-summary-prompt.js',
  'memory-engine-big-summary-prompt.js',
  'memory-engine.js',
];

const actorProfile = {
  profileId: 'profile-seed-chain-actor',
  name: '远岫',
  aliases: ['岫掌柜'],
  identity: {
    species: '人类',
    gender: '女性',
    age: '三十岁上下',
    occupation: '驿港账房',
    affiliation: '驿港行会',
    socialPosition: '负责核验货单与安排短程运力的中层管事',
  },
  appearance: {
    overall: '衣着利落，随身带着分色账签',
    body: '身形匀称，走动时步伐很快',
    face: '神情温和，核账时目光专注',
    hair: '黑发用木簪束起，方便伏案工作',
    voice: '声线清楚，报数时刻意放慢语速',
    physiology: '普通人类体质，长时间伏案后肩颈容易僵硬',
  },
  personality: {
    temperament: '务实而有耐心，不轻易把猜测说成结论',
    coreDesire: '让自己负责的货路在混乱中仍可稳定运转',
    values: '重视可核验的承诺与对等交换',
    thinking: '先比对票据、时间与人证，再决定是否行动',
    attachment: '慢热但守信，会长期维护经过验证的合作关系',
    socialMotive: '通过解决具体麻烦积累可信赖的合作人脉',
    interest: '优先保障货路、账目与雇工安全',
    conflict: '先留证和谈判，必要时才调用行会规则施压',
    stress: '压力增大时会反复复核数字并缩短表达',
    moralBoundary: '不拿无辜雇工顶罪，也不伪造伤亡记录',
    expression: '习惯先复述对方条件，再指出其中缺口',
    actionHabit: '每次安排后都会留下可追溯的账签和备用路线',
    weakness: '过分依赖完整票据，面对突发口头消息时决断偏慢',
    humor: '会用一本正经的账房比喻缓和争执',
  },
  history: '早年随商队往返多座驿港，后来因擅长整理混乱账目进入行会。',
  currentState: {
    location: '北栈桥账房',
    condition: '状态良好，但连续值夜后略显疲惫',
    emotion: '对近期货单缺页保持克制的警惕',
    goal: '查清缺页来源并在不惊动可疑人员的前提下恢复备用货路',
  },
  relationships: ['与驿港雇工保持讲规则但愿意照顾实际困难的合作关系'],
  knowledge: ['掌握驿港货单格式、轮班安排与三条备用货路'],
  capabilities: ['核对账目、安排短程运输、识别常见票据篡改'],
  resources: ['行会账房钥匙、分色账签与两名可信雇工'],
  evidence: ['合成测试档案明确给出远岫的身份、目标、知识与资源'],
  inferences: ['人物经历仅用于本地合成回归，不来自私人聊天或角色卡'],
};

function loadPlaywright() {
  try { return require('playwright'); }
  catch {
    const bundled = path.join(
      os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright',
    );
    if (fs.existsSync(bundled)) return require(bundled);
    throw new Error('Playwright module is unavailable; native World actor-seed chain gate cannot run.');
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

async function addVendorModules(page, modules = vendorModules) {
  for (const filename of modules) {
    await page.addScriptTag({ content: fs.readFileSync(path.join(vendorRoot, filename), 'utf8') });
  }
}

async function resetOriginStorage(page) {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('world_engine');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('failed to reset world_engine test database'));
      request.onblocked = () => reject(new Error('world_engine test database reset blocked'));
    });
  });
}

async function installHostFixture(page) {
  await page.evaluate(() => {
    const listeners = new Map();
    const eventSource = {
      on(name, handler) {
        const handlers = listeners.get(name) || [];
        handlers.push(handler);
        listeners.set(name, handlers);
      },
      async emit(name, ...args) {
        for (const handler of listeners.get(name) || []) await handler(...args);
      },
    };
    const chatMetadata = {};
    const context = {
      chatId: 'chat-seed-chain',
      name1: '测试玩家',
      name2: '合成角色卡',
      chat: [
        { is_user: true, is_system: false, name: '测试玩家', mes: '继续处理驿港眼前的事务。' },
        { is_user: false, is_system: false, name: '合成角色卡', mes: '远岫核对完手边货单，暂时留在北栈桥。', swipe_id: 0 },
      ],
      chatMetadata,
      extensionSettings: {
        storyOracle: { autoDiagnoseEnabled: false },
        'mvu-doctor-kemini-clean': {
          mvuDoctorReferenceSettings: {
            enabled: true,
            diagnoseEnabled: false,
            profileEnabled: true,
            globalPrompt: '',
          },
        },
      },
      eventSource,
      event_types: {
        MESSAGE_SENT: 'message_sent',
        GENERATION_STARTED: 'generation_started',
        GENERATION_ENDED: 'generation_ended',
        GENERATION_STOPPED: 'generation_stopped',
        MESSAGE_RECEIVED: 'message_received',
        MESSAGE_SWIPED: 'message_swiped',
        MESSAGE_DELETED: 'message_deleted',
        CHAT_LOADED: 'chat_loaded',
      },
      setExtensionPrompt(name, content, position, depth) {
        window.__extensionPrompts ||= new Map();
        window.__extensionPrompts.set(name, { content: String(content || ''), position, depth });
      },
      updateChatMetadata(update, reset) {
        const next = reset ? { ...update } : { ...chatMetadata, ...update };
        Object.keys(chatMetadata).forEach((key) => delete chatMetadata[key]);
        Object.assign(chatMetadata, next);
      },
      saveSettingsDebounced() {},
      async saveSettings() {},
      async saveMetadata() {},
      async saveChat() {},
      async saveChatConditional() {},
    };
    window.__context = context;
    window.SillyTavern = { getContext: () => context };

    // Profile Engine initialization needs the frozen Story Oracle capability
    // surface, but this regression never invokes its diagnosis or transport.
    const storyInternals = {
      getFixCfg: () => ({ autoFixEnabled: false }),
      setFixCfg() {},
      resetCancelled() {},
    };
    window.StoryOracleAPI = {
      isCompatible: () => true,
      context: {
        buildCardSection: () => '合成角色卡权威信息',
        buildWorldInfo: async () => '合成世界书权威信息',
      },
      unsafe: {
        eval(expression) {
          if (String(expression).includes('.every((kind) => kind === \'function\')')) return true;
          return storyInternals;
        },
      },
    };
  });
}

async function waitForIndexedDbValue(page, key, predicateSource) {
  await page.waitForFunction(async ({ storageKey, source }) => {
    const raw = await new Promise((resolve, reject) => {
      const open = indexedDB.open('world_engine', 1);
      open.onerror = () => reject(open.error || new Error('failed to open world_engine database'));
      open.onsuccess = () => {
        const database = open.result;
        const request = database.transaction('kv', 'readonly').objectStore('kv').get(storageKey);
        request.onsuccess = () => { database.close(); resolve(request.result ?? null); };
        request.onerror = () => { database.close(); reject(request.error || new Error('failed to read durable value')); };
      };
    });
    return Function('raw', `return (${source})(raw);`)(raw);
  }, { storageKey: key, source: predicateSource }, { timeout: 10000 });
}

test('Doctor actor task enters only the native World extra-instruction slot; hidden NPC work follows native blackbox semantics', async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: systemBrowser(),
    headless: true,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  });
  const browserContext = await browser.newContext();
  const page = await browserContext.newPage();
  const browserLogs = [];
  const modelRequests = [];
  page.on('console', (message) => browserLogs.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => browserLogs.push(`pageerror: ${error?.stack || error}`));

  const worldUpdate = {
    events: [{
      id: null,
      name: '驿港备用货路复核',
      type: 'progress',
      level: 3,
      stage: '筹备',
      stageRound: 2,
      desc: 'PUBLIC_RESULT_SENTINEL：远岫派雇工先核验东堤转运点，结果尚待回报',
      stall: false,
    }],
    factions: [],
    worldTrends: [],
    winds: [{
      id: null,
      topic: '东堤转运点复核',
      type: 'report',
      level: 3,
      content: 'PUBLIC_RESULT_SENTINEL：东堤开始公开复核来往货单',
      scope: '驿港东堤与北栈桥',
      source: '行会告示→往来雇工',
    }],
    economy: { climate: '平稳', signals: [] },
    reputation: {},
    world_digest: 'PUBLIC_RESULT_SENTINEL：驿港行会开始复核备用货路，公开流程未牵涉测试玩家。',
    enemies: [],
    influenceChain: [],
    blackbox: {
      secretActions: [{
        action: 'SECRET_ACTION_SENTINEL：远岫让可信雇工暗查缺页账签的纸张来源',
        witnesses: '仅远岫与该雇工',
      }],
      secretAssets: [{
        name: 'SECRET_ASSET_SENTINEL：未公开的缺页对照簿',
        exposure: 8,
        status: '有效',
      }],
    },
  };
  const worldModelReply = [
    '模型前置说明（原生宽容解析应忽略）。',
    '```json',
    JSON.stringify({ world_digest: 'DECOY_WORLD_SENTINEL' }),
    '```',
    '最终对象如下：',
    JSON.stringify(worldUpdate),
    '模型尾注（同样应忽略）。',
  ].join('\n');
  const memoryModelReply = [
    '以下是合成联动结果：',
    '```json',
    JSON.stringify({
      personal_memory: [],
      entity_updates: [{
        type: 'organization',
        name: '驿港行会',
        aliases: [],
        description: '负责驿港公开货路与账目协调的稳定组织',
        event: 'PUBLIC_RESULT_SENTINEL：行会公开启动东堤货单复核',
        time: '第二日',
      }],
    }),
    '```',
    '联动结束。',
  ].join('\n');

  try {
    await page.route('https://vendor-actor-chain.test/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/scripts/world-info.js') {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: `export async function getSortedEntries() {
            return [{
              uid: 7,
              world: '合成世界书',
              comment: '驿港公开约束',
              content: 'WORLDBOOK_NATIVE_SENTINEL：驿港货单变动必须留下公开复核记录。',
              constant: true,
              disable: false
            }];
          }`,
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>',
      });
    });
    await page.route('https://doctor-adapter.test/**', (route) => {
      const url = new URL(route.request().url());
      const basename = path.posix.basename(url.pathname);
      if (basename === 'index.js') {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: fs.readFileSync(path.join(repoRoot, 'index.js'), 'utf8'),
        });
      }
      if (basename.endsWith('.css')) {
        return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      }
      return route.abort();
    });
    await page.route('https://model.test/**', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const prompt = String(body.messages?.[0]?.content || '');
      const kind = prompt.includes('你是一个世界推演引擎') ? 'world'
        : (prompt.includes('【世界引擎本轮返回】') ? 'memory-link' : 'unexpected');
      modelRequests.push({ kind, url: route.request().url(), body });
      const content = kind === 'world' ? worldModelReply
        : (kind === 'memory-link' ? memoryModelReply : JSON.stringify({ error: 'unexpected synthetic request' }));
      return route.fulfill({
        status: kind === 'unexpected' ? 500 : 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }],
        }),
      });
    });

    await page.goto('https://vendor-actor-chain.test/');
    await resetOriginStorage(page);
    await installHostFixture(page);

    await addVendorModules(page, ['world-engine-store.js']);
    await page.evaluate(() => window.WORLD_ENGINE_STORE.hydrate());
    await page.evaluate(({ profile }) => {
      window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({
        apiUrl: 'https://model.test/v1',
        apiKey: 'synthetic-test-key',
        model: 'synthetic-world-model',
        connectionMode: 'direct',
        temperature: 0,
        maxTokens: 4096,
        apiTimeoutMs: 5000,
        apiAutoRetries: 0,
        engineEnabled: true,
        evolveMode: 'manual',
        injectIntoPrompt: true,
        injectAllLevels: false,
        injectMaxChars: 20000,
        memoryLinkEnabled: false,
        worldbookTrigger: false,
        localRegionalIncidentChancePercent: 0,
        localDistantEventLedgerThreshold: 10,
        localDistantEventChancePercent: 0,
        localNearEventChancePercent: 0,
      }));
      window.WORLD_ENGINE_STORE.setItem('memory_engine_settings', JSON.stringify({
        apiUrl: 'https://model.test/v1',
        apiKey: 'synthetic-test-key',
        model: 'synthetic-memory-model',
        connectionMode: 'direct',
        temperature: 0,
        maxTokens: 4096,
        apiTimeoutMs: 5000,
        apiAutoRetries: 0,
        engineEnabled: true,
        injectIntoPrompt: true,
        injectIntoWorldEngine: true,
        worldEngineMemoryLimit: 5,
        bigSummaryEveryX: 99,
        hideCoveredRawText: false,
      }));
      window.WORLD_ENGINE_STORE.setItem('mvuDoctorReferenceProfileStore:chat-seed-chain', JSON.stringify({
        schema: 2,
        chatId: 'chat-seed-chain',
        revision: 1,
        profiles: { [profile.profileId]: profile },
        branches: {},
        profileReceipts: {},
        history: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
      }));
    }, { profile: actorProfile });

    await addVendorModules(page, vendorModules.slice(1));
    await page.evaluate(() => {
      window.WORLD_ENGINE_WORLDBOOK.saveSelectedIds(['合成世界书::7'], 'world');
      const memoryState = window.MEMORY_ENGINE_DATA.defaultState();
      const record = {
        ownerId: 'char_000001',
        time: '第一日',
        memory: 'MEMORY_NATIVE_SENTINEL：远岫知道东堤备用货路的旧核验顺序。',
      };
      memoryState.personal_memory = [{
        id: 'char_000001',
        names: ['远岫', '岫掌柜'],
        memory: { 第一日: [record.memory] },
      }];
      memoryState.knowledge_index = { 远岫: [record], 岫掌柜: [record] };
      window.MEMORY_ENGINE_DATA.saveState(memoryState);

      const state = window.WORLD_ENGINE_CORE.getDefaultState();
      state.round = 4;
      state.worldDigest = 'BASE_WORLD_SENTINEL：驿港账目暂时平稳。';
      state.factions = [{
        id: 'faction_1',
        name: '驿港行会',
        scope: '驿港与邻近货路',
        status: '稳固',
        relation: '中立',
        currentGoal: '核对缺页货单并维持运输',
        core_person: '远岫',
        powerPillars: ['货路', '账房'],
      }];
      window.WORLD_ENGINE_CORE.saveState(state);
      Math.random = () => 0.99;
    });

    await page.addScriptTag({ content: fs.readFileSync(path.join(repoRoot, 'profile-engine.js'), 'utf8') });
    try {
      await page.waitForFunction(() => window.MVUDoctorProfileEngine?.ready === true, null, { timeout: 10000 });
    } catch (error) {
      throw new Error(`${error.message}\n${browserLogs.join('\n')}`);
    }
    await page.evaluate(() => {
      // index.js only needs the already-loaded native runtime's public entry
      // to validate its adapter contract; the tested evolve call below remains
      // WORLD_ENGINE_EVOLUTION's real implementation.
      window.WORLD_ENGINE_VERSION = '3.0.2';
      window.WORLD_ENGINE = { manualEvolve: async () => false };
      const profileMarker = document.createElement('script');
      profileMarker.id = 'mvu-ref-profile-entry';
      profileMarker.dataset.loaded = 'true';
      document.head.appendChild(profileMarker);
    });
    await page.addScriptTag({ url: 'https://doctor-adapter.test/mvu-doctor-kemini-clean/index.js' });
    try {
      await page.waitForFunction(() => window.MVUDoctorReferenceBaseline?.status === 'ready', null, { timeout: 10000 });
    } catch (error) {
      throw new Error(`${error.message}\n${browserLogs.join('\n')}`);
    }

    const evidence = await page.evaluate(async () => {
      const state = window.WORLD_ENGINE_CORE.loadState();
      const actorInstruction = window.MVUDoctorProfileEngine.buildWorldActorInstruction(state);
      const evolutionBridge = window.WORLD_ENGINE_EVOLUTION[
        Symbol.for('mvu-doctor.native-world-diagnosis-barrier')
      ];
      if (!evolutionBridge?.original) throw new Error('native evolution adapter receipt is unavailable');
      const ok = await evolutionBridge.original(
        state,
        '继续处理驿港事务。',
        '远岫核对完手边货单，暂时留在北栈桥。',
        { mode: 'forward', dialogueText: '用户：继续处理驿港事务。\nAI：远岫核对完手边货单，暂时留在北栈桥。' },
      );
      const worldReadback = window.WORLD_ENGINE_CORE.loadState();
      const worldDebug = window.WORLD_ENGINE_EVOLUTION.getLastDebug();
      const injectionBridge = window.WORLD_ENGINE_INJECT[
        Symbol.for('mvu-doctor.reference.world-public-projection-bridge')
      ];
      if (!injectionBridge?.original) throw new Error('public World projection receipt is unavailable');
      const nativeBackstageInjection = injectionBridge.original(worldReadback, []);
      const publicNarrativeInjection = window.WORLD_ENGINE_INJECT.buildContext(worldReadback, []);
      const memoryLink = await window.MEMORY_ENGINE.ingestWorldEvolution({
        layer: window.WORLD_ENGINE_CORE.getChatLayer(),
        worldRound: worldReadback.round,
        worldDigest: worldReadback.worldDigest,
        worldUpdate: worldReadback.lastEvolveResult,
        replace: false,
        force: true,
      });
      return {
        ok,
        actorInstruction,
        worldReadback,
        worldDebug,
        nativeBackstageInjection,
        publicNarrativeInjection,
        memoryLink,
        memoryDebug: window.MEMORY_ENGINE.getLastDebug(),
        memoryReadback: window.MEMORY_ENGINE_DATA.loadState(),
        actorBridgeInstalled: Boolean(window.MEMORY_ENGINE[
          Symbol.for('mvu-doctor.native-world-actor-context')
        ]),
        memoryProjectionInstalled: Boolean(window.MEMORY_ENGINE[
          Symbol.for('mvu-doctor.reference.world-memory-public-projection-bridge')
        ]),
      };
    });

    assert.equal(evidence.ok, true);
    assert.match(evidence.actorInstruction, /【本轮非玩家主体推进】/u);
    assert.match(evidence.actorInstruction, /profile-seed-chain-actor/u);
    assert.match(evidence.actorInstruction, /远岫/u);
    assert.match(evidence.actorInstruction, /相关人物/u);
    assert.match(evidence.actorInstruction, /blackbox\.secretActions/u);
    assert.doesNotMatch(evidence.actorInstruction, /NPC隐秘行动不得写入 blackbox/u);
    assert.ok(evidence.actorInstruction.length <= 2200);
    assert.equal(evidence.actorBridgeInstalled, false);
    assert.equal(evidence.memoryProjectionInstalled, true);

    const memorySegment = evidence.worldDebug.segments.find((segment) => segment.key === 'memory-engine');
    const extraInstructionSegment = evidence.worldDebug.segments.find((segment) => segment.key === 'extra-instr');
    assert.ok(memorySegment, 'native World debug map must expose its real Memory prompt segment');
    assert.ok(extraInstructionSegment, 'native World debug map must expose its late dynamic instruction segment');
    assert.match(memorySegment.content, /【记忆引擎提供的相关人物与实体信息】/u);
    assert.match(memorySegment.content, /MEMORY_NATIVE_SENTINEL/u);
    assert.doesNotMatch(memorySegment.content, /【本轮非玩家主体推进】/u);
    assert.doesNotMatch(memorySegment.content, /profile-seed-chain-actor/u);
    assert.match(extraInstructionSegment.content, /【本轮非玩家主体推进】/u);
    assert.match(extraInstructionSegment.content, /profile-seed-chain-actor/u);
    assert.match(extraInstructionSegment.content, /远岫/u);
    assert.match(extraInstructionSegment.content, /相关人物/u);
    assert.match(extraInstructionSegment.content, /blackbox\.secretActions/u);
    assert.doesNotMatch(extraInstructionSegment.content, /NPC隐秘行动不得写入 blackbox/u);
    assert.match(evidence.worldDebug.prompt, /WORLDBOOK_NATIVE_SENTINEL/u);
    assert.match(evidence.worldDebug.prompt, /MEMORY_NATIVE_SENTINEL/u);
    assert.match(evidence.worldDebug.prompt, /【本轮非玩家主体推进】/u);
    assert.match(evidence.worldDebug.prompt, /持续事项不能只写 world_digest/u);

    assert.equal(modelRequests.length, 2);
    assert.deepEqual(modelRequests.map((request) => request.kind), ['world', 'memory-link']);
    assert.equal(modelRequests[0].url, 'https://model.test/v1/chat/completions');
    assert.equal(modelRequests[0].body.messages[0].content, evidence.worldDebug.prompt);
    assert.match(evidence.worldDebug.rawResult, /DECOY_WORLD_SENTINEL/u);
    assert.match(evidence.worldDebug.rawResult, /模型尾注/u);

    assert.equal(evidence.worldReadback.round, 5);
    assert.equal(evidence.worldReadback.worldDigest, worldUpdate.world_digest);
    assert.doesNotMatch(JSON.stringify(evidence.worldReadback), /DECOY_WORLD_SENTINEL/u);
    const publicEvent = evidence.worldReadback.events.find((event) => event.name === '驿港备用货路复核');
    assert.ok(publicEvent, 'public World event must survive the native parser and merge');
    assert.match(String(publicEvent.id), /^event_\d+$/u);
    assert.equal(evidence.worldReadback.winds[0].id, 'wind_1');
    assert.match(JSON.stringify(evidence.worldReadback.blackbox), /SECRET_ACTION_SENTINEL/u);
    assert.match(JSON.stringify(evidence.worldReadback.blackbox), /SECRET_ASSET_SENTINEL/u);

    // Upstream World exposes blackbox in its own buildContext; Doctor's public
    // wrapper is the anti-omniscience boundary that removes it for narrative use.
    assert.match(evidence.nativeBackstageInjection, /SECRET_ACTION_SENTINEL/u);
    assert.match(evidence.nativeBackstageInjection, /SECRET_ASSET_SENTINEL/u);
    assert.match(evidence.publicNarrativeInjection, /PUBLIC_RESULT_SENTINEL/u);
    assert.match(evidence.publicNarrativeInjection, /后台摘要已隔离/u);
    assert.match(evidence.publicNarrativeInjection, /无未公开信息/u);
    assert.doesNotMatch(evidence.publicNarrativeInjection, /SECRET_ACTION_SENTINEL/u);
    assert.doesNotMatch(evidence.publicNarrativeInjection, /SECRET_ASSET_SENTINEL/u);

    assert.match(evidence.memoryDebug.prompt, /PUBLIC_RESULT_SENTINEL/u);
    assert.doesNotMatch(evidence.memoryDebug.prompt, /SECRET_ACTION_SENTINEL/u);
    assert.doesNotMatch(evidence.memoryDebug.prompt, /SECRET_ASSET_SENTINEL/u);
    assert.match(evidence.memoryDebug.rawResult, /以下是合成联动结果/u);
    assert.ok(evidence.memoryLink.added >= 2);
    assert.match(JSON.stringify(evidence.memoryReadback), /MEMORY_NATIVE_SENTINEL/u);
    assert.match(JSON.stringify(evidence.memoryReadback), /PUBLIC_RESULT_SENTINEL/u);
    assert.doesNotMatch(JSON.stringify(evidence.memoryReadback), /SECRET_ACTION_SENTINEL/u);
    assert.doesNotMatch(JSON.stringify(evidence.memoryReadback), /SECRET_ASSET_SENTINEL/u);

    await waitForIndexedDbValue(
      page,
      'world_engine_chat-seed-chain',
      `(raw) => typeof raw === 'string' && raw.includes('PUBLIC_RESULT_SENTINEL') && raw.includes('SECRET_ACTION_SENTINEL')`,
    );
    await waitForIndexedDbValue(
      page,
      'memory_engine_state_chat-seed-chain',
      `(raw) => typeof raw === 'string' && raw.includes('MEMORY_NATIVE_SENTINEL') && raw.includes('PUBLIC_RESULT_SENTINEL') && !raw.includes('SECRET_ACTION_SENTINEL')`,
    );

    await page.reload();
    await installHostFixture(page);
    await addVendorModules(page, ['world-engine-store.js']);
    await page.evaluate(() => window.WORLD_ENGINE_STORE.hydrate());
    await addVendorModules(page, ['world-engine-core.js', 'memory-engine-data.js']);
    const durableReadback = await page.evaluate(() => ({
      world: window.WORLD_ENGINE_CORE.loadState(),
      memory: window.MEMORY_ENGINE_DATA.loadState(),
    }));
    assert.equal(durableReadback.world.round, 5);
    assert.equal(durableReadback.world.worldDigest, worldUpdate.world_digest);
    assert.match(JSON.stringify(durableReadback.world.blackbox), /SECRET_ACTION_SENTINEL/u);
    assert.match(JSON.stringify(durableReadback.world.blackbox), /SECRET_ASSET_SENTINEL/u);
    assert.match(JSON.stringify(durableReadback.world.winds), /PUBLIC_RESULT_SENTINEL/u);
    assert.match(JSON.stringify(durableReadback.memory), /MEMORY_NATIVE_SENTINEL/u);
    assert.match(JSON.stringify(durableReadback.memory), /PUBLIC_RESULT_SENTINEL/u);
    assert.doesNotMatch(JSON.stringify(durableReadback.memory), /SECRET_ACTION_SENTINEL/u);
  } finally {
    await page.close();
    await browserContext.close();
    await browser.close();
  }
});
