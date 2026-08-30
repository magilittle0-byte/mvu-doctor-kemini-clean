const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const styleSource = fs.readFileSync(path.join(repoRoot, 'style.css'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(repoRoot, 'profile-engine.js'), 'utf8');

function loadPlaywright() {
  try { return require('playwright'); }
  catch {
    const bundled = path.join(
      os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright',
    );
    if (fs.existsSync(bundled)) return require(bundled);
    throw new Error('Playwright module is unavailable; browser smoke cannot run reliably.');
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
  if (!found) throw new Error('No installed Chromium/Chrome/Edge executable was found for headless smoke.');
  return found;
}

const completeProfile = {
  name: '白露',
  aliases: ['白姑娘'],
  identity: {
    species: '人类', gender: '女性', age: '二十岁上下', occupation: '行旅医者',
    affiliation: '暂未加入固定势力', socialPosition: '以医术换取通行与信任的独立旅人',
  },
  appearance: {
    overall: '衣着朴素整洁，神态柔弱但观察细密', body: '身形轻巧，行动克制而稳定',
    face: '面容清秀，注视他人时会刻意收敛判断感', hair: '乌发束成方便行走的低髻',
    voice: '声线轻柔，措辞谨慎', physiology: '人类女性，体能普通，长期行旅使耐力较好',
  },
  personality: {
    temperament: '外柔内韧，习惯先观察再行动', coreDesire: '掌握足够信息以确保自身与病患安全',
    values: '重视承诺、实际救助与信息边界', thinking: '通过细节交叉验证判断可信度',
    attachment: '慢热且谨慎，一旦建立信任会长期维护', socialMotive: '以无害形象降低戒心并建立合作',
    interest: '优先获得药材、通行条件和可靠消息', conflict: '先退让换取观察空间，必要时精准反击',
    stress: '压力增大时话更少、记录更细', moralBoundary: '不利用医术主动伤害无辜者',
    expression: '常用柔和问句试探对方态度', actionHabit: '交谈后会暗中整理人物与风险记录',
    weakness: '过度依赖信息完整性，可能延误需要直觉决断的时机', humor: '偶尔用温和的自嘲缓解紧张',
  },
  history: '曾在多地随医者学习，独自行旅后养成了记录地方人物与风险的习惯。',
  currentState: {
    location: '临时营地边缘', condition: '轻度疲劳但行动无碍', emotion: '表面平静，内心保持警觉',
    goal: '确认同行者的可靠程度并补足沿途药材',
  },
  relationships: ['与同行者仍处在谨慎建立信任的早期阶段'],
  knowledge: ['知道基础医理、常见药材与行旅风险'],
  capabilities: ['诊疗常见伤病、观察细节、整理情报'],
  resources: ['随身药囊、少量盘缠与个人记录册'],
  evidence: ['最终正文中白露以姓名对白并表现出细致观察'],
  inferences: ['未明说的行旅经历与记录习惯是结合职业和行为作出的可修订补全'],
};

function profileEnvelope(profile = completeProfile) {
  return JSON.stringify({ detectedCharacters: [profile.name], noProfileReason: '', profiles: [profile] });
}

function discoveryEnvelope(names = ['白露'], reason = '') {
  return JSON.stringify({
    detectedCharacters: names,
    noCharacterReason: names.length ? '' : reason,
  });
}

async function installHarness(page, options = {}) {
  const profileReplies = Array.isArray(options.profileReplies)
    ? options.profileReplies
    : [profileEnvelope(), JSON.stringify({
      detectedCharacters: [], profiles: [],
      noProfileReason: '本轮没有需要新增或修复的人物，已有完整人物只作背景连续性参考',
    })];
  const discoveryReplies = Array.isArray(options.discoveryReplies)
    ? options.discoveryReplies
    : Array.from({ length: 8 }, () => discoveryEnvelope());
  await page.route('https://mvu-doctor.test/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="chat"></main></body></html>',
  }));
  await page.goto('https://mvu-doctor.test/');
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
  await page.addStyleTag({ content: styleSource });
  await page.evaluate(({ profileReplies: replies, discoveryReplies: suppliedDiscoveryReplies, slowProfile, slowMetadata, diagnosisReply, diagnosisReplies, mvuPatchMode, worldFailOnce, saveChatFailOnce, saveMetadataFailOnce, initialMvuState }) => {
    const durableKv = new Map();
    let remainingSlowProfileWrites = 0;
    let remainingProfileWriteFailures = 0;
    let resolveDurableWrite = null;
    const durableDatabase = {
      objectStoreNames: { contains: (name) => name === 'kv' },
      createObjectStore() {},
      transaction(_storeName, mode) {
        const pendingWrites = [];
        const pendingReads = [];
        let shouldFail = false;
        const transaction = {
          error: null,
          oncomplete: null,
          onerror: null,
          onabort: null,
          objectStore() {
            return {
              put(value, key) { pendingWrites.push([String(key), String(value)]); },
              get(key) {
                const request = { result: undefined, error: null, onsuccess: null, onerror: null };
                pendingReads.push([String(key), request]);
                return request;
              },
            };
          },
        };
        const finish = () => {
          if (shouldFail) {
            transaction.error = new Error('synthetic IndexedDB transaction failure');
            transaction.onabort?.();
            return;
          }
          for (const [key, value] of pendingWrites) durableKv.set(key, value);
          for (const [key, request] of pendingReads) {
            request.result = durableKv.get(key);
            request.onsuccess?.();
          }
          transaction.oncomplete?.();
        };
        setTimeout(() => {
          const isProfileWrite = mode === 'readwrite'
            && pendingWrites.some(([key]) => key.startsWith('mvuDoctorReferenceProfileStore:'));
          const shouldDelay = isProfileWrite && remainingSlowProfileWrites > 0;
          shouldFail = isProfileWrite && remainingProfileWriteFailures > 0;
          if (shouldDelay) remainingSlowProfileWrites -= 1;
          if (shouldFail) remainingProfileWriteFailures -= 1;
          if (shouldDelay) resolveDurableWrite = finish;
          else finish();
        }, 0);
        return transaction;
      },
    };
    const fakeIndexedDb = {
      open() {
        const request = { result: durableDatabase, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
        setTimeout(() => request.onsuccess?.(), 0);
        return request;
      },
    };
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: fakeIndexedDb });
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
    const metadataByChat = { 'chat-a': {}, 'chat-b': {} };
    let activeChat = 'chat-a';
    let profileReplyIndex = 0;
    let activeDiagnosisReply = diagnosisReply;
    let queuedDiagnosisReplies = Array.isArray(diagnosisReplies) ? diagnosisReplies.map(String) : [];
    let queuedDiscoveryReplies = Array.isArray(suppliedDiscoveryReplies) ? suppliedDiscoveryReplies.map(String) : [];
    let pendingProfile = null;
    let worldState = {
      round: 0,
      worldDigest: 'WORLD_BASE_SENTINEL',
      blackbox: { secretAssets: ['暗线账本'] },
      model: '剧情内部模型字段',
    };
    let worldCheckpoint = null;
    let remainingWorldFailures = worldFailOnce ? 1 : 0;
    let remainingSlowMetadata = slowMetadata ? 1 : 0;
    let remainingSaveMetadataFailures = saveMetadataFailOnce ? 1 : 0;
    let remainingSaveChatFailures = saveChatFailOnce ? 1 : 0;
    let resolveMetadata = null;
    const worldSettings = {
      apiUrl: 'https://example.invalid/v1/chat/completions', model: 'stub-model',
      apiKey: 'SUPER_SECRET_BROWSER_SMOKE_KEY', connectionMode: 'direct', evolveMode: 'manual',
    };
    const context = {
      chatId: activeChat,
      name1: '测试玩家',
      name2: '测试角色卡',
      chat: [],
      chatMetadata: metadataByChat[activeChat],
      extensionSettings: {
        storyOracle: {
          mode: 'direct', endpoint: worldSettings.apiUrl, model: worldSettings.model,
          apiKey: worldSettings.apiKey, maxTokens: 4096, temperature: 0.2,
          sendTemperature: false, autoDiagnoseEnabled: false,
        },
      },
      eventSource,
      event_types: {
        MESSAGE_SENT: 'message_sent', GENERATION_STARTED: 'generation_started',
        GENERATION_ENDED: 'generation_ended', GENERATION_STOPPED: 'generation_stopped',
        MESSAGE_RECEIVED: 'message_received', MESSAGE_SWIPED: 'message_swiped', CHAT_LOADED: 'chat_loaded',
      },
      updateChatMetadata(update, reset) {
        const next = reset ? { ...update } : { ...metadataByChat[activeChat], ...update };
        metadataByChat[activeChat] = next;
        context.chatMetadata = next;
      },
      async saveMetadata() {
        window.__saves.push({ chatId: activeChat, snapshot: structuredClone(metadataByChat[activeChat]) });
        if (remainingSaveMetadataFailures > 0) {
          remainingSaveMetadataFailures -= 1;
          throw new Error('synthetic saveMetadata failure');
        }
        if (remainingSlowMetadata > 0) {
          remainingSlowMetadata -= 1;
          await new Promise((resolve) => { resolveMetadata = resolve; });
        }
      },
      async saveChat() {
        if (remainingSaveChatFailures > 0) {
          remainingSaveChatFailures -= 1;
          throw new Error('synthetic saveChat failure');
        }
      },
      saveSettingsDebounced() {},
    };
    window.__stages = [];
    window.__worldCalls = [];
    window.__mvuReads = [];
    window.__saves = [];
    window.__downloads = [];
    window.__profilePrompts = [];
    window.__modelCalls = [];
    window.__discoveryCalls = 0;
    window.__metadataByChat = metadataByChat;
    window.__context = context;
    window.__emit = (...args) => eventSource.emit(...args);
    window.__switchChat = async (nextChat) => {
      activeChat = nextChat;
      context.chatId = nextChat;
      context.chat = [];
      context.chatMetadata = metadataByChat[nextChat];
      await eventSource.emit('chat_loaded');
    };
    window.__setChat = (messages) => { context.chat = structuredClone(messages); };
    window.__append = (message) => { context.chat.push(structuredClone(message)); };
    window.__resolveProfile = (value) => {
      const current = pendingProfile;
      pendingProfile = null;
      current?.resolve(value);
    };
    window.__resolveMetadata = () => { const resolve = resolveMetadata; resolveMetadata = null; resolve?.(); };
    window.__slowNextMetadata = () => { remainingSlowMetadata += 1; };
    window.__failNextSaveMetadata = () => { remainingSaveMetadataFailures += 1; };
    window.__metadataPending = () => Boolean(resolveMetadata);
    window.__slowNextDurableWrite = () => { remainingSlowProfileWrites += 1; };
    window.__failNextDurableWrite = () => { remainingProfileWriteFailures += 1; };
    window.__durableWritePending = () => Boolean(resolveDurableWrite);
    window.__resolveDurableWrite = () => { const resolve = resolveDurableWrite; resolveDurableWrite = null; resolve?.(); };
    window.__setDiagnosisReply = (value) => { activeDiagnosisReply = String(value); queuedDiagnosisReplies = []; };
    window.__failNextSaveChat = () => { remainingSaveChatFailures += 1; };
    window.SillyTavern = { getContext: () => context };

    const mvuState = structuredClone(initialMvuState);
    const storyFixCfg = { autoFixEnabled: true };
    const mvu = {
      getMvuData: async (request) => {
        window.__mvuReads.push(structuredClone(request));
        return structuredClone(mvuState);
      },
      parseMessage: async (_block, oldData) => mvuPatchMode === 'apply'
        ? { ...structuredClone(oldData), hp: Number(oldData?.hp || 0) + 1 }
        : structuredClone(oldData),
      replaceMvuData: async (next) => Object.assign(mvuState, structuredClone(next)),
    };
    const extractUpdateBlock = (value) => String(value || '').match(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable>/iu)?.[0] || '';
    const storyInternals = {
      getCtx: () => context,
      getSettings: () => context.extensionSettings.storyOracle,
      getMvu: async () => mvu,
      diagPickerActive: () => false,
      buildDiagSelectedWi: async () => ({ block: '' }),
      buildWorldInfo: async () => '',
      wiContextMode: () => 'st',
      collectMvuUpdateRules: async () => [],
      getMvuStatData: async () => structuredClone(mvuState),
      resolveAutoTargetMessage: (chat, index) => ({ idx: index, text: chat[index]?.mes || '' }),
      extractUpdateBlock,
      buildDiagnosePromptFrom: () => 'diagnose the accepted final',
      beginPostReplyCall: () => { const controller = new AbortController(); return { signal: controller.signal, end() {} }; },
      showAutoDiagGenerating: () => null,
      dismissToast() {},
      callDirect: async () => {
        window.__stages.push('diagnosis');
        return queuedDiagnosisReplies.length ? queuedDiagnosisReplies.shift() : activeDiagnosisReply;
      },
      resolveEndpointUrl: (settings) => settings.endpoint,
      callProfile: async () => {
        window.__stages.push('diagnosis');
        return queuedDiagnosisReplies.length ? queuedDiagnosisReplies.shift() : activeDiagnosisReply;
      },
      writeUpdateBlockToMessage: async (index, block) => {
        const message = context.chat[index];
        if (!message || !block) return;
        if (!String(message.mes || '').includes(block)) message.mes = `${String(message.mes || '').trimEnd()}\n\n${block}`;
        if (Array.isArray(message.swipes) && typeof message.swipes[message.swipe_id] === 'string') message.swipes[message.swipe_id] = message.mes;
      },
      refreshMessageBar() {},
      notifyAutoDiagnose() {},
      cancelPostReply() {},
      getFixCfg: () => ({ ...storyFixCfg }),
      setFixCfg: (next) => Object.assign(storyFixCfg, next),
      awaitMvuIdle: async () => 0,
      mvuIsBusy: () => false,
      resetCancelled() {},
    };
    window.StoryOracleAPI = {
      context: { buildCardSection: () => '测试角色卡权威信息', buildWorldInfo: async () => '测试世界书权威信息' },
      unsafe: {
        eval(expression) {
          if (String(expression).includes('JSON.parse(JSON.stringify(convo))')) return { entries: ['browser-smoke'] };
          if (String(expression).trim() === 'getMvuStatData()') return structuredClone(mvuState);
          return storyInternals;
        },
      },
    };

    const worldStore = new Map([['world_engine_settings', JSON.stringify(worldSettings)]]);
    window.__worldStoreWrites = [];
    window.__worldStore = worldStore;
    window.WORLD_ENGINE_STORE = {
      getItem: (key) => worldStore.has(key) ? worldStore.get(key) : null,
      setItem: (key, value) => {
        worldStore.set(key, String(value));
        window.__worldStoreWrites.push({ key: String(key), value: String(value) });
        if (key === 'world_engine_settings') Object.assign(worldSettings, JSON.parse(value));
      },
      removeItem: (key) => worldStore.delete(key),
      keys: () => [...worldStore.keys()],
    };
    window.__profileStoreWrites = () => window.__worldStoreWrites.filter((entry) => entry.key.startsWith('mvuDoctorReferenceProfileStore:'));
    window.WORLD_ENGINE_API = {
      getSettings: () => ({ ...worldSettings }),
      async callApi(prompt, _maxTokens, _temperature, signal) {
        const promptText = String(prompt || '');
        window.__profilePrompts.push(promptText);
        const kind = promptText.includes('把下面的人物发现结果修成指定JSON')
          ? 'discovery-repair'
          : (promptText.includes('你只执行人物发现')
            ? 'discovery'
            : (promptText.includes('你正在修复一份人物档案填表结果') ? 'profile-repair' : 'profile'));
        window.__modelCalls.push({ kind, prompt: promptText, maxTokens: Number(_maxTokens) });
        if (kind === 'discovery' || kind === 'discovery-repair') {
          window.__discoveryCalls += 1;
          if (!queuedDiscoveryReplies.length) throw new Error(`unexpected ${kind} call: discovery reply queue exhausted`);
          return queuedDiscoveryReplies.shift();
        }
        window.__stages.push('profile');
        const reply = replies[Math.min(profileReplyIndex, replies.length - 1)];
        profileReplyIndex += 1;
        if (!slowProfile) return reply;
        return new Promise((resolve, reject) => {
          pendingProfile = { resolve, reject };
          signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
        });
      },
    };
    window.WORLD_ENGINE_CORE = {
      getChatId: () => activeChat,
      loadState: () => structuredClone(worldState),
      restoreCheckpoint: () => worldCheckpoint ? structuredClone(worldCheckpoint) : null,
      saveCheckpoint: (value) => { worldCheckpoint = structuredClone(value); },
      saveState: (value) => { worldState = structuredClone(value); },
    };
    window.WORLD_ENGINE_WORLDBOOK = { buildPromptSection: async () => '原版世界后台提示' };
    window.WORLD_ENGINE_INJECT = { buildContext: (state) => JSON.stringify(state) };
    window.WORLD_ENGINE = {
      async manualEvolve(mode, reason) {
        window.__stages.push('world');
        const promptSection = await window.WORLD_ENGINE_WORLDBOOK.buildPromptSection();
        const injection = window.WORLD_ENGINE_INJECT.buildContext(window.WORLD_ENGINE_CORE.loadState());
        const before = structuredClone(worldState);
        window.__worldCalls.push({ mode, reason, beforeRound: before.round, beforeDigest: before.worldDigest, promptSection, injection });
        if (remainingWorldFailures > 0) {
          remainingWorldFailures -= 1;
          return false;
        }
        if (mode === 'forward') {
          worldCheckpoint = structuredClone(before);
          worldState.round += 1;
        }
        worldState.worldDigest = context.chat.at(-1)?.mes || worldState.worldDigest;
        return true;
      },
    };
    window.WORLD_ENGINE_EVOLUTION = { abort() {}, getLastError: () => '' };
    window.MEMORY_ENGINE_SETTINGS = { getSettings: () => ({ engineEnabled: false, evolveMode: 'manual' }), patchSettings() {} };

    const blobs = new Map();
    let blobSerial = 0;
    URL.createObjectURL = (blob) => { const id = `blob:smoke-${++blobSerial}`; blobs.set(id, blob); return id; };
    URL.revokeObjectURL = (id) => blobs.delete(id);
    HTMLAnchorElement.prototype.click = function click() {
      const blob = blobs.get(this.href);
      const connected = this.isConnected;
      if (blob) blob.text().then((content) => window.__downloads.push({ name: this.download, content, connected }));
    };
  }, {
    profileReplies,
    discoveryReplies,
    slowProfile: Boolean(options.slowProfile),
    diagnosisReply: options.diagnosisReply || '<JSONPatch>[]</JSONPatch>',
    diagnosisReplies: Array.isArray(options.diagnosisReplies) ? options.diagnosisReplies : [],
    mvuPatchMode: options.mvuPatchMode || 'noop',
    worldFailOnce: Boolean(options.worldFailOnce),
    slowMetadata: Boolean(options.slowMetadata),
    saveChatFailOnce: Boolean(options.saveChatFailOnce),
    saveMetadataFailOnce: Boolean(options.saveMetadataFailOnce),
    initialMvuState: options.initialMvuState || {
      hp: 10,
      契约者: { 当前敌人: { 白露: { 姓名: '白露' } } },
    },
  });
  await page.addScriptTag({ content: runtimeSource });
  await page.waitForFunction(() => window.MVUDoctorProfileEngine?.ready === true);
}

async function runAcceptedReply(page, assistantText = '白露：我先替你看一看伤口。') {
  await page.evaluate(async (text) => {
    window.__setChat([{ is_user: true, mes: '请继续。' }]);
    await window.__emit('message_sent');
    await window.__emit('generation_started', 'normal', {}, false);
    window.__append({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] });
    await window.__emit('message_received', 1, 'normal');
    await window.__emit('generation_ended');
  }, assistantText);
}

async function runAcceptedReplyInTauriOrder(page, assistantText = '白露：我先替你看一看伤口。') {
  await page.evaluate(async (text) => {
    const oldText = '旧楼层保持不变。';
    window.__setChat([{ is_user: false, is_system: false, mes: oldText, swipe_id: 0, swipes: [oldText] }]);
    await window.__emit('generation_started', 'normal', {}, false);
    window.__append({ is_user: true, mes: '请继续。' });
    window.__append({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] });
    await window.__emit('generation_ended');
    await window.__emit('message_received', 2, 'normal');
  }, assistantText);
}

async function runAcceptedReplyWithLateMessageAndBackgroundNormal(page, assistantText = '白露：我先替你看一看伤口。') {
  await page.evaluate(async (text) => {
    const oldText = '旧楼层保持不变。';
    window.__setChat([{ is_user: false, is_system: false, mes: oldText, swipe_id: 0, swipes: [oldText] }]);
    await window.__emit('generation_started', 'normal', {}, false);
    window.__append({ is_user: true, mes: '请继续。' });
    window.__append({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] });
    await window.__emit('generation_ended');
    await window.__emit('message_received', 2, 'normal');
    // TauriTavern can deliver the matching MESSAGE_SENT after the accepted
    // assistant row.  A separate extension may then run a background normal
    // generation; neither event may replace the accepted main-reply ticket.
    await window.__emit('message_sent');
    await window.__emit('generation_started', 'normal', {}, false);
    await window.__emit('generation_ended');
  }, assistantText);
}

async function runAcceptedReplyWithTauriMessageOrderAndBackgroundNormal(page, assistantText = '白露：我先替你看一看伤口。') {
  await page.evaluate(async (text) => {
    const oldText = '旧楼层保持不变。';
    window.__setChat([{ is_user: false, is_system: false, mes: oldText, swipe_id: 0, swipes: [oldText] }]);
    await window.__emit('generation_started', 'normal', {}, false);
    window.__append({ is_user: true, mes: '请继续。' });
    await window.__emit('message_sent');
    window.__append({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] });
    await window.__emit('message_received', 2, 'normal');
    await window.__emit('generation_ended');
    await window.__emit('generation_started', 'normal', {}, false);
    await window.__emit('generation_ended');
  }, assistantText);
}

async function runNextAcceptedReply(page, assistantText = '白露：我把新发现记进了随身册页。') {
  await page.evaluate(async (text) => {
    window.__append({ is_user: true, mes: '继续观察并行动。' });
    await window.__emit('message_sent');
    await window.__emit('generation_started', 'normal', {}, false);
    window.__append({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] });
    await window.__emit('message_received', window.__context.chat.length - 1, 'normal');
    await window.__emit('generation_ended');
  }, assistantText);
}

async function waitForSettled(page, expectedPhase, timeout = 8000) {
  await page.waitForFunction((phase) => window.MVUDoctorProfileEngine.getRuntime().phase === phase, expectedPhase, { timeout });
}

test('0.8.6 reference runtime browser smoke', { timeout: 180000 }, async (t) => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, executablePath: systemBrowser() });
  try {
    await t.test('desktop and mobile panel remain inside the viewport', async () => {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      try {
        await installHarness(page);
        await page.locator('#mvu-ref-launcher').click();
        for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 390, height: 200 }]) {
          await page.setViewportSize(viewport);
          const geometry = await page.evaluate(() => {
            const rect = document.getElementById('mvu-ref-panel').getBoundingClientRect();
            return {
              left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
              width: rect.width, height: rect.height,
              viewportWidth: innerWidth, viewportHeight: innerHeight,
              bodyWidth: document.documentElement.scrollWidth,
            };
          });
          assert.ok(geometry.left >= -1 && geometry.top >= -1, JSON.stringify(geometry));
          assert.ok(geometry.right <= geometry.viewportWidth + 1, JSON.stringify(geometry));
          assert.ok(geometry.bottom <= geometry.viewportHeight + 1, JSON.stringify(geometry));
          assert.ok(geometry.bodyWidth <= geometry.viewportWidth + 1, JSON.stringify(geometry));
          assert.ok(geometry.width >= Math.min(360, viewport.width - 2), JSON.stringify(geometry));
        }
      } finally { await page.close(); }
    });

    await t.test('mobile panel tracks real visualViewport height and offset below 240px', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 720 } });
      try {
        await page.addInitScript(() => {
          const state = { height: 219, offsetTop: 31 };
          const viewport = new EventTarget();
          Object.defineProperties(viewport, {
            height: { get: () => state.height },
            width: { get: () => innerWidth },
            offsetTop: { get: () => state.offsetTop },
            offsetLeft: { get: () => 0 },
            pageTop: { get: () => state.offsetTop },
            pageLeft: { get: () => 0 },
            scale: { get: () => 1 },
          });
          Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
          window.__setSyntheticVisualViewport = (height, offsetTop) => {
            state.height = height;
            state.offsetTop = offsetTop;
            viewport.dispatchEvent(new Event('resize'));
            viewport.dispatchEvent(new Event('scroll'));
          };
        });
        await installHarness(page);
        await page.locator('#mvu-ref-launcher').click();
        const snapshot = () => page.evaluate(() => {
          const panel = document.getElementById('mvu-ref-panel').getBoundingClientRect();
          const close = document.querySelector('#mvu-ref-panel header > button').getBoundingClientRect();
          const root = document.documentElement.style;
          return {
            panel: { top: panel.top, bottom: panel.bottom, height: panel.height },
            close: { top: close.top, bottom: close.bottom },
            visual: {
              top: visualViewport.offsetTop, height: visualViewport.height,
              bottom: visualViewport.offsetTop + visualViewport.height,
            },
            cssTop: root.getPropertyValue('--mvu-ref-visual-top'),
            cssHeight: root.getPropertyValue('--mvu-ref-visual-height'),
          };
        });
        let geometry = await snapshot();
        assert.equal(geometry.cssTop, '31px');
        assert.equal(geometry.cssHeight, '219px');
        assert.ok(geometry.panel.top >= geometry.visual.top + 7, JSON.stringify(geometry));
        assert.ok(geometry.panel.bottom <= geometry.visual.bottom - 7, JSON.stringify(geometry));
        assert.ok(geometry.close.top >= geometry.visual.top && geometry.close.bottom <= geometry.visual.bottom, JSON.stringify(geometry));

        await page.evaluate(() => window.__setSyntheticVisualViewport(173, 83));
        await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--mvu-ref-visual-height') === '173px');
        geometry = await snapshot();
        assert.equal(geometry.cssTop, '83px');
        assert.equal(geometry.cssHeight, '173px');
        assert.ok(geometry.panel.height >= 1, JSON.stringify(geometry));
        assert.ok(geometry.panel.top >= geometry.visual.top + 7, JSON.stringify(geometry));
        assert.ok(geometry.panel.bottom <= geometry.visual.bottom - 7, JSON.stringify(geometry));
        assert.ok(geometry.close.top >= geometry.visual.top && geometry.close.bottom <= geometry.visual.bottom, JSON.stringify(geometry));
      } finally { await page.close(); }
    });

    await t.test('public world injection removes blackbox secrets without mutating private state', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const evidence = await page.evaluate(() => {
          const privateState = {
            round: 3,
            winds: [{ content: '公开风声' }],
            blackbox: {
              secretActions: [{ action: '秘密记录同伴资料' }],
              secretAssets: [{ name: '暗藏名册' }],
            },
          };
          window.MVUDoctorProfileEngine.installWorldContextBridge();
          const output = window.WORLD_ENGINE_INJECT.buildContext(privateState);
          return { output, privateState };
        });
        assert.match(evidence.output, /公开风声/u);
        assert.doesNotMatch(evidence.output, /秘密记录同伴资料|暗藏名册/u);
        assert.equal(evidence.privateState.blackbox.secretActions.length, 1);
        assert.equal(evidence.privateState.blackbox.secretAssets.length, 1);
      } finally { await page.close(); }
    });

    await t.test('accepted final runs diagnosis, discovery, profile fill and world in the real call order', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          profileWrites: window.__profileStoreWrites(),
          modelCalls: window.__modelCalls,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'profile']);
        assert.equal(evidence.runtime.lastResult.ok, true);
        assert.equal(evidence.runtime.lastResult.profile.count, 1);
        assert.equal(evidence.runtime.lastResult.profile.modelCalls, 2);
        assert.equal(Object.keys(evidence.profiles).length, 1);
        assert.equal(evidence.profileWrites.length, 1);
      } finally { await page.close(); }
    });

    await t.test('wrapped and sentence-final placeholders trigger the existing one-shot profile repair before commit', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const placeholderProfile = structuredClone(completeProfile);
        placeholderProfile.currentState.location = '临时营地边缘，具体位置未知';
        placeholderProfile.currentState.emotion = '未知：外表仍保持平静';
        placeholderProfile.resources = ['未知。'];
        await installHarness(page, {
          profileReplies: [profileEnvelope(placeholderProfile), profileEnvelope(completeProfile)],
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          profileWrites: window.__profileStoreWrites(),
          modelCalls: window.__modelCalls,
        }));
        const serialized = JSON.stringify(evidence.profiles);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'profile', 'world']);
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'profile', 'profile-repair']);
        assert.equal(evidence.result.profile.modelCalls, 3);
        assert.equal(evidence.result.profile.repaired, true);
        assert.match(evidence.result.profile.initialErrors.join('；'), /currentState\.location|currentState\.emotion|resources\[0\]/u);
        assert.doesNotMatch(serialized, /未知|不详|待定|未登记|未设定|暂无|正文未提及/u);
        assert.equal(Object.keys(evidence.profiles).length, 1);
        assert.equal(evidence.profileWrites.length, 1);
      } finally { await page.close(); }
    });

    await t.test('malformed name discovery is repaired once before any profile fill', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          discoveryReplies: ['这不是可解析的名单', discoveryEnvelope()],
          profileReplies: [profileEnvelope()],
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          modelCalls: window.__modelCalls,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
        }));
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'discovery-repair', 'profile']);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.result.profile.modelCalls, 3);
        assert.equal(evidence.result.profile.repaired, true);
        assert.match(evidence.result.profile.initialErrors.join('；'), /人物发现/u);
        assert.equal(Object.keys(evidence.profiles).length, 1);
      } finally { await page.close(); }
    });

    await t.test('an unrecoverable name discovery fails closed before profile fill and world', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          discoveryReplies: ['这不是可解析的名单', '修复后仍不是JSON'],
          profileReplies: [profileEnvelope()],
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          modelCalls: window.__modelCalls,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
        }));
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'discovery-repair']);
        assert.deepEqual(evidence.stages, ['diagnosis']);
        assert.equal(evidence.result.failedStep, 'profile');
        assert.match(evidence.result.error, /人物发现单次修复后仍不可用/u);
        assert.equal(Object.keys(evidence.profiles).length, 0);
      } finally { await page.close(); }
    });

    await t.test('Tauri order with generation start before the user row still runs exactly once', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReplyInTauriOrder(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.result.ok, true);
      } finally { await page.close(); }
    });

    await t.test('late message event and background normal generation cannot steal the accepted ticket', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReplyWithLateMessageAndBackgroundNormal(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          worldCalls: window.__worldCalls,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.runtime.lastResult.ok, true);
        assert.equal(evidence.worldCalls.length, 1);
      } finally { await page.close(); }
    });

    await t.test('Tauri message order and background normal generation cannot steal the accepted ticket', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReplyWithTauriMessageOrderAndBackgroundNormal(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          worldCalls: window.__worldCalls,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.runtime.lastResult.ok, true);
        assert.equal(evidence.worldCalls.length, 1);
      } finally { await page.close(); }
    });

    await t.test('dry-run style start without a matching end cannot swallow the main accepted reply', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(async () => {
          const oldText = '旧楼层保持不变。';
          window.__setChat([{ is_user: false, is_system: false, mes: oldText, swipe_id: 0, swipes: [oldText] }]);
          await window.__emit('generation_started', 'normal', {}, false);
          window.__append({ is_user: true, mes: '请继续。' });
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'quiet', { quiet: true }, false);
          const text = '白露：我先替你看一看伤口。';
          window.__append({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] });
          await window.__emit('message_received', 2, 'normal');
          await window.__emit('generation_ended');
        });
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          ticket: window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.ticket, null);
      } finally { await page.close(); }
    });

    await t.test('a stale END before the matching START cannot complete the next user turn', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const latch = await page.evaluate(async () => {
          const oldText = '旧楼层保持不变。';
          window.__setChat([
            { is_user: false, is_system: false, mes: oldText, swipe_id: 0, swipes: [oldText] },
            { is_user: true, mes: '请继续。' },
          ]);
          await window.__emit('message_sent');
          const provisional = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          await window.__emit('generation_ended');
          const afterStaleEnd = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          await window.__emit('generation_started', 'normal', {}, false);
          const afterStart = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          const reply = '白露：我先替你看一看伤口。';
          window.__append({ is_user: false, is_system: false, mes: reply, swipe_id: 0, swipes: [reply] });
          await window.__emit('message_received', 2, 'normal');
          const afterReceipt = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          return { provisional, afterStaleEnd, afterStart, afterReceipt };
        });
        assert.equal(latch.afterStaleEnd.generationKey, latch.provisional.generationKey);
        assert.equal(latch.afterStaleEnd.serial, latch.provisional.serial);
        assert.equal(latch.afterStaleEnd.awaitingStart, true);
        assert.equal(latch.afterStaleEnd.endObserved, false);
        assert.equal(latch.afterStart.awaitingStart, false);
        assert.equal(latch.afterStart.endObserved, false);
        assert.equal(latch.afterReceipt.receivedMessageId, 2);
        assert.equal(latch.afterReceipt.completionScheduled, false);
        await page.waitForTimeout(1400);
        assert.deepEqual(await page.evaluate(() => window.__stages), []);
        await page.evaluate(async () => { await window.__emit('generation_ended'); });
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          calls: window.__worldCalls.length,
          accepted: window.MVUDoctorProfileEngine.getRuntime().lastAccepted,
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.calls, 1);
        assert.equal(evidence.accepted.index, 2);
        assert.equal(evidence.ticket, null);
      } finally { await page.close(); }
    });

    await t.test('crossed background start and main end join the exact MESSAGE_RECEIVED row once', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const latch = await page.evaluate(async () => {
          const oldText = '旧楼层保持不变。';
          window.__setChat([{ is_user: false, is_system: false, mes: oldText, swipe_id: 0, swipes: [oldText] }]);
          await window.__emit('generation_started', 'normal', {}, false);
          const mainTicket = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          window.__append({ is_user: true, mes: '请继续。' });
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          const afterBackgroundStart = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          await window.__emit('generation_ended');
          const afterEnd = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          const text = '白露：我先替你看一看伤口。';
          window.__append({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] });
          const messageId = window.__context.chat.length - 1;
          await window.__emit('message_received', messageId, 'extension');
          const afterForeignReceipt = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          await window.__emit('message_received', messageId, 'normal');
          await window.__emit('message_received', messageId, 'normal');
          const afterReceipt = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          return { mainTicket, afterBackgroundStart, afterEnd, afterForeignReceipt, afterReceipt, messageId, stages: [...window.__stages] };
        });
        assert.equal(latch.afterBackgroundStart.serial, latch.mainTicket.serial);
        assert.equal(latch.afterBackgroundStart.generationKey, latch.mainTicket.generationKey);
        assert.equal(latch.afterEnd.endObserved, true);
        assert.equal(latch.afterEnd.completionScheduled, false);
        assert.equal(latch.afterForeignReceipt.receivedMessageId, null);
        assert.equal(latch.afterReceipt.receivedMessageId, latch.messageId);
        assert.equal(latch.afterReceipt.targetMessageId, latch.messageId);
        assert.equal(latch.afterReceipt.completionScheduled, true);
        assert.equal(latch.afterReceipt.status, 'ended');
        assert.deepEqual(latch.stages, []);
        await waitForSettled(page, 'done');
        const beforeLateEnd = await page.evaluate(() => {
          const runtime = window.MVUDoctorProfileEngine.getRuntime();
          const store = window.MVUDoctorProfileEngine.getStore();
          return {
            stages: [...window.__stages], worldCalls: window.__worldCalls.length,
            revision: store.revision, history: store.history.length,
            reports: runtime.runReports.length, identity: runtime.lastResult.identity,
            acceptedGeneration: runtime.acceptedGeneration,
            acceptedIndex: runtime.lastAccepted.index,
          };
        });
        assert.deepEqual(beforeLateEnd.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(beforeLateEnd.worldCalls, 1);
        assert.equal(beforeLateEnd.acceptedGeneration, null);
        assert.equal(beforeLateEnd.acceptedIndex, latch.messageId);
        await page.evaluate(async () => {
          await window.__emit('message_received', 2, 'normal');
          await window.__emit('generation_ended');
          await window.__emit('generation_ended');
        });
        await page.waitForTimeout(1400);
        const afterLateEnd = await page.evaluate(() => {
          const runtime = window.MVUDoctorProfileEngine.getRuntime();
          const store = window.MVUDoctorProfileEngine.getStore();
          return {
            stages: [...window.__stages], worldCalls: window.__worldCalls.length,
            revision: store.revision, history: store.history.length,
            reports: runtime.runReports.length, identity: runtime.lastResult.identity,
          };
        });
        assert.deepEqual(afterLateEnd, {
          stages: beforeLateEnd.stages, worldCalls: beforeLateEnd.worldCalls,
          revision: beforeLateEnd.revision, history: beforeLateEnd.history,
          reports: beforeLateEnd.reports, identity: beforeLateEnd.identity,
        });
      } finally { await page.close(); }
    });

    await t.test('an exact receipt cannot retarget to another swipe before END', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const receipt = await page.evaluate(async () => {
          window.__setChat([{ is_user: true, mes: '请继续。' }]);
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          const accepted = '白露：这是原本落盘的答复。';
          window.__append({ is_user: false, is_system: false, mes: accepted, swipe_id: 0, swipes: [accepted] });
          await window.__emit('message_received', 1, 'normal');
          const fixed = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          const message = window.__context.chat[1];
          const foreign = '白露：这是后来切换到的另一条swipe。';
          message.swipe_id = 1;
          message.swipes = [accepted, foreign];
          message.mes = foreign;
          await window.__emit('generation_ended');
          return fixed;
        });
        assert.equal(receipt.receivedMessageId, 1);
        assert.equal(receipt.receivedSwipeId, 0);
        assert.equal(receipt.completionScheduled, false);
        await page.waitForTimeout(200);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          calls: window.__worldCalls.length,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
          checkpoint: localStorage.getItem('mvuDoctorReferencePipeline:chat-a'),
        }));
        assert.deepEqual(evidence.stages, []);
        assert.equal(evidence.calls, 0);
        assert.equal(evidence.runtime.phase, 'failed');
        assert.equal(evidence.runtime.acceptedGeneration, null);
        assert.equal(evidence.ticket, null);
        assert.equal(evidence.checkpoint, null);
      } finally { await page.close(); }
    });

    await t.test('idle background normal generation with no new user layer is discarded', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const before = await page.evaluate(() => ({
          generationKey: window.MVUDoctorProfileEngine.getRuntime().lastResult?.generationKey,
          stages: [...window.__stages],
        }));
        await page.evaluate(async () => {
          await window.__emit('generation_started', 'normal', {}, false);
          await window.__emit('generation_ended');
        });
        await page.waitForTimeout(1800);
        const after = await page.evaluate(() => ({
          generationKey: window.MVUDoctorProfileEngine.getRuntime().lastResult?.generationKey,
          stages: window.__stages,
          phase: window.MVUDoctorProfileEngine.getRuntime().phase,
          acceptedGeneration: window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration,
        }));
        assert.deepEqual(after.stages, before.stages);
        assert.equal(after.generationKey, before.generationKey);
        assert.equal(after.phase, 'done');
        assert.equal(after.acceptedGeneration, null);
      } finally { await page.close(); }
    });

    await t.test('background END classification is frozen before a later user message arrives', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const before = await page.evaluate(() => ({
          stages: [...window.__stages], calls: window.__worldCalls.length,
          reports: window.MVUDoctorProfileEngine.getRuntime().runReports.length,
          identity: window.MVUDoctorProfileEngine.getRuntime().lastResult.identity,
        }));
        const oldKey = await page.evaluate(async () => {
          await window.__emit('generation_started', 'normal', {}, false);
          const key = window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration.generationKey;
          await window.__emit('generation_ended');
          window.__append({ is_user: true, mes: '这是END以后才到达的新用户回合。' });
          return key;
        });
        await page.waitForTimeout(1200);
        const cleared = await page.evaluate(() => ({
          stages: [...window.__stages], calls: window.__worldCalls.length,
          reports: window.MVUDoctorProfileEngine.getRuntime().runReports.length,
          identity: window.MVUDoctorProfileEngine.getRuntime().lastResult.identity,
          phase: window.MVUDoctorProfileEngine.getRuntime().phase,
          active: window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration,
          durable: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
        }));
        assert.deepEqual(cleared.stages, before.stages);
        assert.equal(cleared.calls, before.calls);
        assert.equal(cleared.reports, before.reports);
        assert.equal(cleared.identity, before.identity);
        assert.equal(cleared.phase, 'done');
        assert.equal(cleared.active, null);
        assert.equal(cleared.durable, null);
        const nextKey = await page.evaluate(async () => {
          await window.__emit('message_sent');
          return window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration.generationKey;
        });
        assert.notEqual(nextKey, oldKey);
      } finally { await page.close(); }
    });

    await t.test('ended generation ticket survives a chat reload during the accepted-final wait window', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const ticket = await page.evaluate(async () => {
          window.__setChat([{ is_user: true, mes: '请继续。' }]);
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          const reply = '白露：我会把这件事记下来。';
          window.__append({ is_user: false, is_system: false, mes: reply, swipe_id: 0, swipes: [reply] });
          await window.__emit('message_received', 1, 'normal');
          await window.__emit('generation_ended');
          const persisted = JSON.parse(localStorage.getItem('mvuDoctorReferenceGeneration:chat-a') || 'null');
          await window.__emit('chat_loaded');
          return persisted;
        });
        assert.equal(ticket.status, 'ended');
        assert.ok(ticket.generationKey);
        await waitForSettled(page, 'done', 4000);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.ticket, null);
        assert.equal(evidence.checkpoint.status, 'complete');
      } finally { await page.close(); }
    });

    await t.test('a received-only ticket closes at reload and processes its fixed reply once', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const before = await page.evaluate(async () => {
          window.__setChat([{ is_user: true, mes: '请继续。' }]);
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          const reply = '白露：刷新以后也只能处理这一条。';
          window.__append({ is_user: false, is_system: false, mes: reply, swipe_id: 0, swipes: [reply] });
          await window.__emit('message_received', 1, 'normal');
          const ticket = JSON.parse(localStorage.getItem('mvuDoctorReferenceGeneration:chat-a') || 'null');
          await window.__emit('chat_loaded');
          return ticket;
        });
        assert.equal(before.endObserved, false);
        assert.equal(before.receivedMessageId, 1);
        assert.equal(before.receivedSwipeId, 0);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages, calls: window.__worldCalls.length,
          accepted: window.MVUDoctorProfileEngine.getRuntime().lastAccepted,
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.calls, 1);
        assert.equal(evidence.accepted.index, 1);
        assert.equal(evidence.accepted.swipeId, 0);
        assert.equal(evidence.ticket, null);
      } finally { await page.close(); }
    });

    await t.test('an END-only ticket is reconstructed strictly at reload and processed once', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const before = await page.evaluate(async () => {
          window.__setChat([{ is_user: true, mes: '请继续。' }]);
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          const reply = '白露：结束信号虽先到，刷新后仍只认这一楼。';
          window.__append({ is_user: false, is_system: false, mes: reply, swipe_id: 0, swipes: [reply] });
          await window.__emit('generation_ended');
          const ticket = JSON.parse(localStorage.getItem('mvuDoctorReferenceGeneration:chat-a') || 'null');
          await window.__emit('chat_loaded');
          return ticket;
        });
        assert.equal(before.endObserved, true);
        assert.equal(before.receivedMessageId, null);
        assert.equal(before.hadUserAtEnd, true);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages, calls: window.__worldCalls.length,
          accepted: window.MVUDoctorProfileEngine.getRuntime().lastAccepted,
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.calls, 1);
        assert.equal(evidence.accepted.index, 1);
        assert.equal(evidence.accepted.swipeId, 0);
        assert.equal(evidence.ticket, null);
      } finally { await page.close(); }
    });

    await t.test('a pure START ticket is cleared at reload instead of waiting for dead events', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(async () => {
          window.__setChat([{ is_user: true, mes: '请继续。' }]);
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          await window.__emit('chat_loaded');
        });
        await page.waitForTimeout(100);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
        }));
        assert.deepEqual(evidence.stages, []);
        assert.equal(evidence.runtime.phase, 'discarded');
        assert.equal(evidence.runtime.acceptedGeneration, null);
        assert.equal(evidence.ticket, null);
      } finally { await page.close(); }
    });

    await t.test('reload clears a received-only ticket when its exact target vanished', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(async () => {
          window.__setChat([{ is_user: true, mes: '请继续。' }]);
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          const reply = '白露：这条正文随后被宿主删除。';
          window.__append({ is_user: false, is_system: false, mes: reply, swipe_id: 0, swipes: [reply] });
          await window.__emit('message_received', 1, 'normal');
          window.__context.chat.splice(1, 1);
          await window.__emit('chat_loaded');
        });
        await page.waitForTimeout(150);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages, calls: window.__worldCalls.length,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
          checkpoint: localStorage.getItem('mvuDoctorReferencePipeline:chat-a'),
        }));
        assert.deepEqual(evidence.stages, []);
        assert.equal(evidence.calls, 0);
        assert.equal(evidence.runtime.phase, 'failed');
        assert.equal(evidence.runtime.acceptedGeneration, null);
        assert.equal(evidence.ticket, null);
        assert.equal(evidence.checkpoint, null);
      } finally { await page.close(); }
    });

    await t.test('reload clears a receipt whose fixed swipe has drifted', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const receipt = await page.evaluate(async () => {
          const oldText = '白露：旧的答复。';
          window.__setChat([
            { is_user: true, mes: '请回答。' },
            { is_user: false, is_system: false, mes: oldText, swipe_id: 0, swipes: [oldText] },
          ]);
          window.WORLD_ENGINE_CORE.saveCheckpoint({
            round: 5, worldDigest: 'WORLD_BASE_SENTINEL',
            blackbox: { secretAssets: ['基底暗线'] },
          });
          window.WORLD_ENGINE_CORE.saveState({
            round: 6, worldDigest: 'OLD_SWIPE_WORLD_SENTINEL',
            blackbox: { secretAssets: ['旧分支暗线'] },
          });
          await window.__emit('generation_started', 'regenerate', {}, false);
          const nextText = '白露：这是重写后的答复。';
          const message = window.__context.chat[1];
          message.mes = nextText;
          message.swipe_id = 1;
          message.swipes = [oldText, nextText];
          await window.__emit('message_received', 1, 'normal');
          const fixed = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          const foreign = '白露：这是刷新前切换到的第三条答复。';
          message.swipe_id = 2;
          message.swipes.push(foreign);
          message.mes = foreign;
          await window.__emit('chat_loaded');
          return fixed;
        });
        assert.equal(receipt.receivedSwipeId, 1);
        await page.waitForTimeout(150);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages, calls: window.__worldCalls.length,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
        }));
        assert.deepEqual(evidence.stages, []);
        assert.equal(evidence.calls, 0);
        assert.equal(evidence.runtime.phase, 'failed');
        assert.equal(evidence.runtime.acceptedGeneration, null);
        assert.equal(evidence.ticket, null);
      } finally { await page.close(); }
    });

    await t.test('a newer ended ticket supersedes an older failed checkpoint after reload', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { worldFailOnce: true });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const ticket = await page.evaluate(async () => {
          window.__append({ is_user: true, mes: '请继续下一步。' });
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          const reply = '白露：这一次我会继续处理新的线索。';
          window.__append({ is_user: false, is_system: false, mes: reply, swipe_id: 0, swipes: [reply] });
          await window.__emit('message_received', window.__context.chat.length - 1, 'normal');
          await window.__emit('generation_ended');
          const persisted = JSON.parse(localStorage.getItem('mvuDoctorReferenceGeneration:chat-a') || 'null');
          await window.__emit('chat_loaded');
          return persisted;
        });
        assert.equal(ticket.status, 'ended');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          calls: window.__worldCalls.length,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world', 'diagnosis', 'world']);
        assert.equal(evidence.calls, 2);
        assert.equal(evidence.checkpoint.status, 'complete');
        assert.equal(evidence.checkpoint.target.generationKey, ticket.generationKey);
      } finally { await page.close(); }
    });

    await t.test('ended ticket is retained when initial pipeline checkpoint persistence fails', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(() => {
          const original = Storage.prototype.setItem;
          window.__blockPipelineStorage = true;
          Storage.prototype.setItem = function patchedSetItem(key, value) {
            if (window.__blockPipelineStorage && String(key).startsWith('mvuDoctorReferencePipeline:')) {
              throw new Error('synthetic pipeline storage failure');
            }
            return original.call(this, key, value);
          };
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const before = await page.evaluate(() => ({
          ticket: JSON.parse(localStorage.getItem('mvuDoctorReferenceGeneration:chat-a') || 'null'),
          checkpoint: localStorage.getItem('mvuDoctorReferencePipeline:chat-a'),
          stages: window.__stages,
        }));
        assert.equal(before.ticket.status, 'ended');
        assert.equal(before.checkpoint, null);
        assert.deepEqual(before.stages, []);
        await page.evaluate(async () => {
          window.__blockPipelineStorage = false;
          await window.__emit('chat_loaded');
        });
        await waitForSettled(page, 'done');
        const after = await page.evaluate(() => ({
          stages: window.__stages,
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
        }));
        assert.deepEqual(after.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(after.ticket, null);
      } finally { await page.close(); }
    });

    await t.test('quiet hidden generation never consumes or starts the accepted-final pipeline', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(async () => {
          await window.__emit('generation_started', 'quiet', { quiet: true }, false);
          await window.__emit('generation_ended');
        });
        await page.waitForTimeout(1500);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
        }));
        assert.deepEqual(evidence.stages, []);
        assert.equal(evidence.runtime.acceptedGeneration, null);
      } finally { await page.close(); }
    });

    await t.test('stopped main generation clears its durable ticket and never starts Doctor', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(async () => {
          window.__setChat([{ is_user: true, mes: '请继续。' }]);
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          await window.__emit('generation_stopped');
        });
        await page.waitForTimeout(100);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          ticket: localStorage.getItem('mvuDoctorReferenceGeneration:chat-a'),
        }));
        assert.deepEqual(evidence.stages, []);
        assert.equal(evidence.runtime.phase, 'cancelled');
        assert.equal(evidence.runtime.acceptedGeneration, null);
        assert.equal(evidence.ticket, null);
      } finally { await page.close(); }
    });

    await t.test('AI opening without a prior user action is not treated as a playable turn', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(async () => {
          await window.__emit('generation_started', 'normal', {}, false);
          const text = '这里是角色卡的默认开场。';
          window.__append({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] });
          await window.__emit('message_received', 0, 'first_message');
          await window.__emit('generation_ended');
        });
        await page.waitForTimeout(1700);
        const evidence = await page.evaluate(() => ({ stages: window.__stages, runtime: window.MVUDoctorProfileEngine.getRuntime() }));
        assert.deepEqual(evidence.stages, []);
        assert.equal(evidence.runtime.phase, 'idle');
        assert.match(evidence.runtime.detail, /AI开场/u);
      } finally { await page.close(); }
    });

    await t.test('a nonempty Story Oracle patch with no MVU effect follows the original nochange path', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { diagnosisReply: '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":10}]</JSONPatch></UpdateVariable>' });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.result.diagnosis.status, 'nochange');
      } finally { await page.close(); }
    });

    await t.test('Story Oracle wrapped empty JSONPatch is the original nochange success path', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { diagnosisReply: '<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>' });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.result.diagnosis.status, 'nochange');
      } finally { await page.close(); }
    });

    await t.test('Story Oracle backend error content retries the identical diagnosis once before continuing', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReplies: ['[API错误]\nRequest failed with status code 520', '<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>'],
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'diagnosis', 'profile', 'world']);
        assert.equal(evidence.result.diagnosis.status, 'nochange');
        assert.equal(evidence.result.diagnosis.diagnosisAttempts.length, 2);
        assert.equal(evidence.result.diagnosis.diagnosisAttempts[0].kind, 'transport-error-content');
        assert.equal(evidence.result.diagnosis.diagnosisAttempts[1].kind, 'response');
      } finally { await page.close(); }
    });

    await t.test('two Story Oracle backend error envelopes fail with the transport code and never reach profile or world', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReplies: ['[API错误]\nRequest failed with status code 520', '[API错误]\nRequest failed with status code 520'],
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'diagnosis']);
        assert.equal(evidence.result.failedStep, 'diagnosis');
        assert.equal(evidence.result.errorCode, 'story_oracle_transport_error_response');
        assert.equal(evidence.result.diagnosisAttempts.length, 2);
      } finally { await page.close(); }
    });

    await t.test('an empty example outside the returned nonempty block cannot hide a real correction', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '示例：<JSONPatch>[]</JSONPatch>\n实际：<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>',
          mvuPatchMode: 'apply',
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const result = await page.evaluate(() => window.MVUDoctorProfileEngine.getRuntime().lastResult);
        assert.equal(result.diagnosis.status, 'applied');
      } finally { await page.close(); }
    });

    await t.test('soft title suggestions do not become mandatory profile rows', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page, '紧急播报：本段只是界面标题。\n白露说道：“我先替你看一看伤口。”');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.equal(Object.keys(evidence.profiles).length, 1);
        assert.equal(evidence.result.ok, true);
      } finally { await page.close(); }
    });

    await t.test('player prose before action verbs never becomes a mandatory NPC', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page, '你若有所思地点了点头，看看系统会把什么显示出来。白露说道：“我先看看。”');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.equal(Object.keys(evidence.profiles).length, 1);
        assert.equal(evidence.result.ok, true);
        assert.equal(evidence.result.profile.count, 1);
      } finally { await page.close(); }
    });

    await t.test('short named action subjects keep adverbs and connectors outside the name', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page, '白露偷偷把纸片收好。白露微微点头。白露又把药囊系紧。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.equal(Object.keys(evidence.profiles).length, 1);
        assert.equal(evidence.result.ok, true);
        assert.equal(evidence.result.profile.count, 1);
      } finally { await page.close(); }
    });

    await t.test('free prose action fragments never become mandatory profile names', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page, '白露说道：“先别动。”她手里拿着把短刀，另一只手握着那把旧伞。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.equal(Object.keys(evidence.profiles).length, 1);
        assert.equal(evidence.result.ok, true);
        assert.equal(evidence.result.profile.count, 1);
      } finally { await page.close(); }
    });

    await t.test('all MVU reads and writes stay pinned to the accepted numeric message id', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>',
          mvuPatchMode: 'apply',
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          reads: window.__mvuReads,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.equal(evidence.result.diagnosis.status, 'applied');
        assert.ok(evidence.reads.length >= 4);
        assert.ok(evidence.reads.every((entry) => entry?.type === 'message' && Number.isInteger(entry?.message_id)));
      } finally { await page.close(); }
    });

    await t.test('chat reroll restores the frozen World Engine checkpoint and forwards from that base', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(async () => {
          const oldText = '白露：旧的答复。';
          window.__setChat([
            { is_user: true, mes: '请回答。' },
            { is_user: false, is_system: false, mes: oldText, swipe_id: 0, swipes: [oldText] },
          ]);
          // A real rejected swipe follows an earlier forward commit, which is
          // where frozen World Engine 3.0.2 saves the a-side checkpoint.
          window.WORLD_ENGINE_CORE.saveCheckpoint(window.WORLD_ENGINE_CORE.loadState());
          await window.__emit('generation_started', 'regenerate', {}, false);
          const nextText = '白露：这是重写后的答复。';
          const message = window.__context.chat[1];
          message.mes = nextText;
          message.swipe_id = 1;
          message.swipes = [oldText];
          message.swipes.length = 2;
          await window.__emit('message_received', 1, 'normal');
          window.__rerollReceipt = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          message.swipes[1] = nextText;
          await window.__emit('generation_ended');
        });
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          call: window.__worldCalls[0],
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          accepted: window.MVUDoctorProfileEngine.getRuntime().lastAccepted,
          stages: window.__stages,
          receipt: window.__rerollReceipt,
        }));
        assert.equal(evidence.receipt.type, 'regenerate');
        assert.equal(evidence.receipt.receivedMessageType, 'normal');
        assert.equal(evidence.receipt.receivedMessageId, 1);
        assert.equal(evidence.receipt.receivedSwipeId, 1);
        assert.equal(evidence.receipt.endObserved, false);
        assert.equal(evidence.receipt.completionScheduled, false);
        assert.equal(evidence.call.mode, 'forward');
        assert.equal(evidence.call.reason, 'reroll');
        assert.equal(evidence.call.beforeDigest, 'WORLD_BASE_SENTINEL');
        assert.equal(evidence.result.world.mode, 'checkpoint-forward');
        assert.equal(evidence.result.world.afterRound, evidence.result.world.beforeRound + 1);
        assert.equal(evidence.result.generationType, 'regenerate');
        assert.equal(evidence.accepted.index, 1);
        assert.equal(evidence.accepted.swipeId, 1);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
      } finally { await page.close(); }
    });

    await t.test('reroll removes old swipe profile content before new prompts and restores each branch independently', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const oldProfile = {
          ...structuredClone(completeProfile),
          history: 'OLD_SWIPE_PROFILE_SENTINEL：旧分支独有经历。',
          inferences: ['OLD_SWIPE_PROFILE_SENTINEL：旧分支推断。'],
        };
        const newProfile = {
          ...structuredClone(completeProfile),
          history: 'NEW_SWIPE_PROFILE_SENTINEL：新分支独有经历。',
          inferences: ['NEW_SWIPE_PROFILE_SENTINEL：新分支推断。'],
        };
        await installHarness(page, {
          discoveryReplies: [discoveryEnvelope(), discoveryEnvelope(), discoveryEnvelope(), discoveryEnvelope()],
          profileReplies: [profileEnvelope(oldProfile), profileEnvelope(newProfile)],
        });
        const oldText = '白露把旧药囊放在左侧桌角。';
        const newText = '白露换用新的银针，转身走向窗边。';
        await runAcceptedReply(page, oldText);
        await waitForSettled(page, 'done');
        const first = await page.evaluate(() => ({
          promptCount: window.__profilePrompts.length,
          store: window.MVUDoctorProfileEngine.getStore(),
        }));
        assert.match(JSON.stringify(first.store.profiles), /OLD_SWIPE_PROFILE_SENTINEL/u);

        await page.evaluate(async ({ oldReply, newReply }) => {
          await window.__emit('generation_started', 'regenerate', {}, false);
          const message = window.__context.chat[1];
          message.mes = newReply;
          message.swipe_id = 1;
          message.swipes = [oldReply, newReply];
          await window.__emit('message_received', 1, 'normal');
          await window.__emit('generation_ended');
        }, { oldReply: oldText, newReply: newText });
        await page.waitForFunction(() => window.__worldCalls.length === 2
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'done');
        const rerolled = await page.evaluate((promptStart) => ({
          prompts: window.__profilePrompts.slice(promptStart),
          store: window.MVUDoctorProfileEngine.getStore(),
          modelCalls: window.__modelCalls.slice(promptStart),
          worldCall: window.__worldCalls[1],
        }), first.promptCount);
        assert.doesNotMatch(JSON.stringify(rerolled.prompts), /OLD_SWIPE_PROFILE_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(rerolled.store.profiles), /OLD_SWIPE_PROFILE_SENTINEL/u);
        assert.match(JSON.stringify(rerolled.store.profiles), /NEW_SWIPE_PROFILE_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(rerolled.worldCall), /OLD_SWIPE_PROFILE_SENTINEL/u);
        assert.match(rerolled.worldCall.promptSection, /NEW_SWIPE_PROFILE_SENTINEL/u);
        assert.doesNotMatch(rerolled.worldCall.injection, /OLD_SWIPE_PROFILE_SENTINEL/u);

        await page.evaluate(async (oldReply) => {
          const message = window.__context.chat[1];
          message.swipe_id = 0;
          message.mes = oldReply;
          await window.__emit('message_swiped', 1);
        }, oldText);
        await page.waitForFunction(() => {
          try {
            return JSON.stringify(window.MVUDoctorProfileEngine.getStore().profiles)
              .includes('OLD_SWIPE_PROFILE_SENTINEL');
          } catch { return false; }
        });
        let selected = await page.evaluate(() => JSON.stringify(window.MVUDoctorProfileEngine.getStore().profiles));
        assert.match(selected, /OLD_SWIPE_PROFILE_SENTINEL/u);
        assert.doesNotMatch(selected, /NEW_SWIPE_PROFILE_SENTINEL/u);

        await page.evaluate(async (newReply) => {
          const message = window.__context.chat[1];
          message.swipe_id = 1;
          message.mes = newReply;
          await window.__emit('message_swiped', 1);
        }, newText);
        await page.waitForFunction(() => {
          try {
            return JSON.stringify(window.MVUDoctorProfileEngine.getStore().profiles)
              .includes('NEW_SWIPE_PROFILE_SENTINEL');
          } catch { return false; }
        });
        selected = await page.evaluate(() => JSON.stringify(window.MVUDoctorProfileEngine.getStore().profiles));
        assert.match(selected, /NEW_SWIPE_PROFILE_SENTINEL/u);
        assert.doesNotMatch(selected, /OLD_SWIPE_PROFILE_SENTINEL/u);
      } finally { await page.close(); }
    });

    await t.test('a cancelled delayed branch restore fully unwinds before the next reroll reads profiles', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const oldProfile = {
          ...structuredClone(completeProfile),
          history: 'DELAYED_OLD_BRANCH_SENTINEL：只能属于旧分支。',
          inferences: ['DELAYED_OLD_BRANCH_SENTINEL：旧分支推断。'],
        };
        const newProfile = {
          ...structuredClone(completeProfile),
          history: 'CURRENT_NEW_BRANCH_SENTINEL：只能属于新分支。',
          inferences: ['CURRENT_NEW_BRANCH_SENTINEL：新分支推断。'],
        };
        const finalProfile = {
          ...structuredClone(completeProfile),
          history: 'FINAL_REROLL_BRANCH_SENTINEL：第三分支独有经历。',
          inferences: ['FINAL_REROLL_BRANCH_SENTINEL：第三分支推断。'],
        };
        await installHarness(page, {
          discoveryReplies: [
            discoveryEnvelope(), discoveryEnvelope(), discoveryEnvelope(),
            discoveryEnvelope(), discoveryEnvelope(), discoveryEnvelope(),
          ],
          profileReplies: [profileEnvelope(oldProfile), profileEnvelope(newProfile), profileEnvelope(finalProfile)],
        });
        const oldText = '白露把旧药囊放在左侧桌角。';
        const newText = '白露换用新的银针，转身走向窗边。';
        const finalText = '白露收起银针，拿起第三只青瓷药盒。';
        await runAcceptedReply(page, oldText);
        await waitForSettled(page, 'done');
        await page.evaluate(async ({ oldReply, newReply }) => {
          await window.__emit('generation_started', 'regenerate', {}, false);
          const message = window.__context.chat[1];
          message.mes = newReply;
          message.swipe_id = 1;
          message.swipes = [oldReply, newReply];
          await window.__emit('message_received', 1, 'normal');
          await window.__emit('generation_ended');
        }, { oldReply: oldText, newReply: newText });
        await page.waitForFunction(() => window.__worldCalls.length === 2
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'done');

        const promptStart = await page.evaluate(() => window.__profilePrompts.length);
        await page.evaluate(async (oldReply) => {
          window.__slowNextDurableWrite();
          const message = window.__context.chat[1];
          message.swipe_id = 0;
          message.mes = oldReply;
          await window.__emit('message_swiped', 1);
        }, oldText);
        await page.waitForFunction(() => window.__durableWritePending());

        await page.evaluate(async ({ oldReply, newReply, finalReply }) => {
          await window.__emit('generation_started', 'regenerate', {}, false);
          const message = window.__context.chat[1];
          message.mes = finalReply;
          message.swipe_id = 2;
          message.swipes = [oldReply, newReply, finalReply];
          await window.__emit('message_received', 1, 'normal');
          await window.__emit('generation_ended');
        }, { oldReply: oldText, newReply: newText, finalReply: finalText });
        await new Promise((resolve) => setTimeout(resolve, 120));
        let blocked = await page.evaluate(() => ({
          worldCalls: window.__worldCalls.length,
          prompts: window.__profilePrompts.length,
        }));
        assert.equal(blocked.worldCalls, 2);
        assert.equal(blocked.prompts, promptStart);

        await page.evaluate(() => window.__resolveDurableWrite());
        await page.waitForFunction(() => window.__worldCalls.length === 3
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'done', null, { timeout: 8000 });
        const evidence = await page.evaluate((fromPrompt) => ({
          prompts: window.__profilePrompts.slice(fromPrompt),
          store: window.MVUDoctorProfileEngine.getStore(),
          worldCall: window.__worldCalls[2],
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
        }), promptStart);
        const finalJson = JSON.stringify(evidence);
        assert.doesNotMatch(JSON.stringify(evidence.prompts), /DELAYED_OLD_BRANCH_SENTINEL|CURRENT_NEW_BRANCH_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(evidence.store.profiles), /DELAYED_OLD_BRANCH_SENTINEL|CURRENT_NEW_BRANCH_SENTINEL/u);
        assert.match(JSON.stringify(evidence.store.profiles), /FINAL_REROLL_BRANCH_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(evidence.worldCall), /DELAYED_OLD_BRANCH_SENTINEL|CURRENT_NEW_BRANCH_SENTINEL/u);
        assert.match(evidence.worldCall.promptSection, /FINAL_REROLL_BRANCH_SENTINEL/u);
        assert.doesNotMatch(evidence.worldCall.injection, /DELAYED_OLD_BRANCH_SENTINEL|CURRENT_NEW_BRANCH_SENTINEL/u);
        assert.equal(evidence.runtime.phase, 'done');
        assert.doesNotMatch(finalJson, /人物档案分支恢复失败/u);
      } finally { await page.close(); }
    });

    await t.test('chat switching waits a delayed restore rollback and preserves the original chat branch', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const oldProfile = {
          ...structuredClone(completeProfile),
          history: 'CROSS_CHAT_OLD_SENTINEL：旧 swipe 独有。',
          inferences: ['CROSS_CHAT_OLD_SENTINEL：旧 swipe 推断。'],
        };
        const newProfile = {
          ...structuredClone(completeProfile),
          history: 'CROSS_CHAT_NEW_SENTINEL：当前 swipe 独有。',
          inferences: ['CROSS_CHAT_NEW_SENTINEL：当前 swipe 推断。'],
        };
        await installHarness(page, {
          discoveryReplies: [discoveryEnvelope(), discoveryEnvelope(), discoveryEnvelope(), discoveryEnvelope()],
          profileReplies: [profileEnvelope(oldProfile), profileEnvelope(newProfile)],
        });
        const oldText = '白露把旧药囊放在左侧桌角。';
        const newText = '白露换用新的银针，转身走向窗边。';
        await runAcceptedReply(page, oldText);
        await waitForSettled(page, 'done');
        await page.evaluate(async ({ oldReply, newReply }) => {
          await window.__emit('generation_started', 'regenerate', {}, false);
          const message = window.__context.chat[1];
          message.mes = newReply;
          message.swipe_id = 1;
          message.swipes = [oldReply, newReply];
          await window.__emit('message_received', 1, 'normal');
          await window.__emit('generation_ended');
        }, { oldReply: oldText, newReply: newText });
        await page.waitForFunction(() => window.__worldCalls.length === 2
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'done');

        await page.evaluate(async (oldReply) => {
          window.__slowNextDurableWrite();
          const message = window.__context.chat[1];
          message.swipe_id = 0;
          message.mes = oldReply;
          await window.__emit('message_swiped', 1);
        }, oldText);
        await page.waitForFunction(() => window.__durableWritePending());
        await page.evaluate(() => { window.__pendingChatSwitch = window.__switchChat('chat-b'); });
        await page.waitForFunction(() => window.__context.chatId === 'chat-b');
        await page.evaluate(() => window.__resolveDurableWrite());
        await page.evaluate(() => window.__pendingChatSwitch);

        let evidence = await page.evaluate(() => ({
          activeChat: window.__context.chatId,
          activeStore: window.MVUDoctorProfileEngine.getStore(),
          chatB: window.__metadataByChat['chat-b'],
          profileRawA: window.__worldStore.get('mvuDoctorReferenceProfileStore:chat-a'),
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
        }));
        assert.equal(evidence.activeChat, 'chat-b');
        assert.doesNotMatch(JSON.stringify(evidence.activeStore), /CROSS_CHAT_OLD_SENTINEL|CROSS_CHAT_NEW_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(evidence.chatB), /CROSS_CHAT_OLD_SENTINEL|CROSS_CHAT_NEW_SENTINEL/u);
        const chatAStore = JSON.parse(evidence.profileRawA);
        assert.match(JSON.stringify(chatAStore.profiles), /CROSS_CHAT_NEW_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(chatAStore.profiles), /CROSS_CHAT_OLD_SENTINEL/u);
        assert.match(JSON.stringify(chatAStore.branches), /CROSS_CHAT_OLD_SENTINEL/u);
        assert.match(JSON.stringify(chatAStore.branches), /CROSS_CHAT_NEW_SENTINEL/u);
        assert.equal(evidence.runtime.phase, 'idle');
        assert.doesNotMatch(JSON.stringify(evidence.runtime), /人物档案分支恢复失败/u);

        await page.evaluate(() => window.__switchChat('chat-a'));
        evidence = await page.evaluate(() => ({
          activeChat: window.__context.chatId,
          store: window.MVUDoctorProfileEngine.getStore(),
          profileRawA: window.__worldStore.get('mvuDoctorReferenceProfileStore:chat-a'),
        }));
        assert.equal(evidence.activeChat, 'chat-a');
        assert.match(JSON.stringify(evidence.store.profiles), /CROSS_CHAT_NEW_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(evidence.store.profiles), /CROSS_CHAT_OLD_SENTINEL/u);
        const lastSavedStore = JSON.parse(evidence.profileRawA);
        assert.match(JSON.stringify(lastSavedStore.profiles), /CROSS_CHAT_NEW_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(lastSavedStore.profiles), /CROSS_CHAT_OLD_SENTINEL/u);
        assert.match(JSON.stringify(lastSavedStore.branches), /CROSS_CHAT_OLD_SENTINEL/u);
      } finally { await page.close(); }
    });

    await t.test('a failed stale-branch rollback save blocks the next reroll instead of reporting success', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const oldProfile = {
          ...structuredClone(completeProfile),
          history: 'ROLLBACK_FAIL_OLD_SENTINEL：旧分支。',
          inferences: ['ROLLBACK_FAIL_OLD_SENTINEL：旧分支推断。'],
        };
        const newProfile = {
          ...structuredClone(completeProfile),
          history: 'ROLLBACK_FAIL_NEW_SENTINEL：当前分支。',
          inferences: ['ROLLBACK_FAIL_NEW_SENTINEL：当前分支推断。'],
        };
        await installHarness(page, {
          discoveryReplies: [discoveryEnvelope(), discoveryEnvelope(), discoveryEnvelope(), discoveryEnvelope()],
          profileReplies: [profileEnvelope(oldProfile), profileEnvelope(newProfile)],
        });
        const oldText = '白露把旧药囊放在左侧桌角。';
        const newText = '白露换用新的银针，转身走向窗边。';
        const blockedText = '白露准备打开第三只药箱。';
        await runAcceptedReply(page, oldText);
        await waitForSettled(page, 'done');
        await page.evaluate(async ({ oldReply, newReply }) => {
          await window.__emit('generation_started', 'regenerate', {}, false);
          const message = window.__context.chat[1];
          message.mes = newReply;
          message.swipe_id = 1;
          message.swipes = [oldReply, newReply];
          await window.__emit('message_received', 1, 'normal');
          await window.__emit('generation_ended');
        }, { oldReply: oldText, newReply: newText });
        await page.waitForFunction(() => window.__worldCalls.length === 2
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'done');
        const promptStart = await page.evaluate(() => window.__profilePrompts.length);

        await page.evaluate(async (oldReply) => {
          window.__slowNextDurableWrite();
          const message = window.__context.chat[1];
          message.swipe_id = 0;
          message.mes = oldReply;
          await window.__emit('message_swiped', 1);
        }, oldText);
        await page.waitForFunction(() => window.__durableWritePending());
        await page.evaluate(async ({ oldReply, newReply, blockedReply }) => {
          await window.__emit('generation_started', 'regenerate', {}, false);
          const message = window.__context.chat[1];
          message.mes = blockedReply;
          message.swipe_id = 2;
          message.swipes = [oldReply, newReply, blockedReply];
          await window.__emit('message_received', 1, 'normal');
          await window.__emit('generation_ended');
          window.__failNextDurableWrite();
          window.__resolveDurableWrite();
        }, { oldReply: oldText, newReply: newText, blockedReply: blockedText });
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'failed');
        const evidence = await page.evaluate((fromPrompt) => ({
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          prompts: window.__profilePrompts.slice(fromPrompt),
          store: window.MVUDoctorProfileEngine.getStore(),
          worldCalls: window.__worldCalls.length,
        }), promptStart);
        assert.equal(evidence.worldCalls, 2);
        assert.equal(evidence.prompts.length, 0);
        assert.match(`${evidence.runtime.detail}\n${JSON.stringify(evidence.runtime.lastResult)}`, /回滚.*持久化|rollback/iu);
        assert.match(JSON.stringify(evidence.store.profiles), /ROLLBACK_FAIL_NEW_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(evidence.store.profiles), /ROLLBACK_FAIL_OLD_SENTINEL/u);
      } finally { await page.close(); }
    });

    await t.test('automatic continue merges into the same normal ticket and advances world once', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(async () => {
          const oldText = '旧楼层保持不变。';
          window.__setChat([{ is_user: false, is_system: false, mes: oldText, swipe_id: 0, swipes: [oldText] }]);
          await window.__emit('generation_started', 'normal', {}, false);
          window.__append({ is_user: true, mes: '请继续。' });
          await window.__emit('message_sent');
          const partial = '白露：这是尚未完成的答复。';
          window.__append({ is_user: false, is_system: false, mes: partial, swipe_id: 0, swipes: [partial] });
          await window.__emit('message_received', 2, 'normal');
          await window.__emit('generation_ended');
          await window.__emit('generation_started', 'continue', {}, false);
          const message = window.__context.chat.at(-1);
          const complete = `${partial}现在补完。`;
          message.mes = complete;
          message.swipes[message.swipe_id] = complete;
          await window.__emit('message_received', 2, 'appendFinal');
          await window.__emit('generation_ended');
        });
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          calls: window.__worldCalls,
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          lastAccepted: window.MVUDoctorProfileEngine.getRuntime().lastAccepted,
          finalText: window.__context.chat.at(-1).mes,
        }));
        assert.equal(evidence.calls.length, 1);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.calls[0].mode, 'forward');
        assert.equal(evidence.result.generationType, 'normal');
        assert.equal(evidence.result.identity, evidence.lastAccepted.identity);
        assert.match(evidence.finalText, /现在补完/u);
      } finally { await page.close(); }
    });

    await t.test('delayed continue cancels a partial pipeline and processes only the completed text', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowProfile: true });
        await runAcceptedReply(page, '白露：这是尚未完成的答复。');
        await page.waitForFunction(() => window.__stages.filter((stage) => stage === 'profile').length === 1
          && window.MVUDoctorProfileEngine.getRuntime().pipelineBusy === true);
        const continuation = await page.evaluate(async () => {
          const before = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          await window.__emit('generation_started', 'continue', {}, false);
          const message = window.__context.chat.at(-1);
          message.mes = `${message.mes}现在补完。`;
          message.swipes[message.swipe_id] = message.mes;
          await window.__emit('message_received', window.__context.chat.length - 1, 'appendFinal');
          await window.__emit('generation_ended');
          const after = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          await window.__emit('chat_loaded');
          return { before, after };
        });
        assert.equal(continuation.before.status, 'processing');
        assert.equal(continuation.after.generationKey, continuation.before.generationKey);
        assert.ok(continuation.after.serial > continuation.before.serial);
        await page.waitForFunction(() => window.__stages.filter((stage) => stage === 'profile').length === 2);
        await page.evaluate((reply) => window.__resolveProfile(reply), profileEnvelope());
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          worldCalls: window.__worldCalls,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          finalText: window.__context.chat.at(-1).mes,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'diagnosis', 'profile', 'world']);
        assert.equal(evidence.worldCalls.length, 1);
        assert.equal(evidence.worldCalls[0].mode, 'forward');
        assert.equal(evidence.runtime.lastResult.identity, evidence.runtime.lastAccepted.identity);
        assert.match(evidence.finalText, /现在补完/u);
        assert.equal(Object.keys(evidence.profiles).length, 1);
      } finally { await page.close(); }
    });

    await t.test('a real overswipe slot with byte-identical text is still accepted exactly once', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const accepted = '白露：我先替你看一看伤口。';
        await installHarness(page, { profileReplies: [profileEnvelope(), profileEnvelope()] });
        await runAcceptedReply(page, accepted);
        await waitForSettled(page, 'done');
        await page.evaluate(async (text) => {
          const message = window.__context.chat[1];
          message.swipe_id = 1;
          message.swipes = [text];
          message.mes = text;
          await window.__emit('message_swiped', 1);
          await window.__emit('generation_started', 'swipe', {}, false);
          message.swipes = [text, text];
          message.mes = text;
          await window.__emit('message_received', 1, 'swipe');
          await window.__emit('generation_ended');
        }, accepted);
        await page.waitForFunction(() => window.__worldCalls.length === 2
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'done');
        const evidence = await page.evaluate(() => ({ calls: window.__worldCalls, result: window.MVUDoctorProfileEngine.getRuntime().lastResult }));
        assert.equal(evidence.calls.length, 2);
        assert.equal(evidence.calls[1].mode, 'forward');
        assert.equal(evidence.result.world.mode, 'checkpoint-forward');
        assert.equal(evidence.result.world.afterRound, evidence.result.world.beforeRound + 1);
        assert.equal(evidence.result.generationType, 'swipe');
      } finally { await page.close(); }
    });

    await t.test('a persisted failed world checkpoint resumes only its exact target', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { worldFailOnce: true });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const before = await page.evaluate(() => ({
          calls: window.__worldCalls.length,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.equal(before.calls, 1);
        assert.equal(before.checkpoint.status, 'failed');
        assert.equal(before.checkpoint.nextStep, 'world');

        await page.evaluate(async () => { await window.__emit('chat_loaded'); });
        await page.evaluate(() => window.MVUDoctorProfileEngine.runCurrent());
        await page.waitForFunction(() => window.__worldCalls.length === 2
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'done');
        const after = await page.evaluate(() => ({ stages: window.__stages, calls: window.__worldCalls.length }));
        assert.equal(after.calls, 2);
        assert.equal(after.stages.filter((stage) => stage === 'diagnosis').length, 1);
        assert.equal(after.stages.filter((stage) => stage === 'profile').length, 1);
      } finally { await page.close(); }
    });

    await t.test('a structured NPC id with empty profile output cannot be reported green', async () => {
      const empty = JSON.stringify({
        detectedCharacters: [], profiles: [],
        noProfileReason: '这一轮是纯环境描述，确实没有任何需要持续记录的非玩家人物。',
      });
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { profileReplies: [empty, empty] });
        await runAcceptedReply(page, 'NPC-7把纸片收进袖中，脸上仍是柔弱的笑。');
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'profile']);
        assert.equal(evidence.runtime.lastResult.ok, false);
        assert.equal(evidence.runtime.lastResult.failedStep, 'profile');
        assert.match(evidence.runtime.lastResult.error, /人物档案事务没有完成|档案仍不完整/u);
        assert.equal(Object.keys(evidence.profiles).length, 0);
        assert.ok(!evidence.stages.includes('world'));
      } finally { await page.close(); }
    });

    await t.test('JSONPatch actor fields discover the value without mistaking field names or array indexes for people', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { initialMvuState: { hp: 10 } });
        await runAcceptedReply(page, `白露收起药囊。
<JSONPatch>[
  {"op":"replace","path":"/当前敌人/名称","value":"白露"},
  {"op":"replace","path":"/当前敌人/0/姓名","value":"白露"}
]</JSONPatch>`);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          profile: window.MVUDoctorProfileEngine.getRuntime().lastResult.profile,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.deepEqual(evidence.profile.completionCandidates, ['白露']);
        assert.ok(evidence.profile.discoveredCandidates.includes('白露'));
        assert.ok(!evidence.profile.discoveredCandidates.includes('名称'));
        assert.ok(!evidence.profile.discoveredCandidates.includes('0'));
        assert.equal(Object.values(evidence.profiles)[0].name, '白露');
      } finally { await page.close(); }
    });

    await t.test('cumulative MVU inventory is only a discovery hint and cannot create an offscreen profile', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          initialMvuState: { hp: 10, 契约者: { 小队: { 名称: '测试小队', 成员: [{ 姓名: '白露' }] } } },
          discoveryReplies: [discoveryEnvelope([], '本楼只有空走廊与静止帘幕，没有任何非玩家人物出现')],
        });
        await runAcceptedReply(page, '走廊尽头的旧帘子没有动静。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'world']);
        assert.deepEqual(evidence.result.profile.currentReplyCandidates, []);
        assert.deepEqual(evidence.result.profile.mvuInventoryCandidates, ['白露']);
        assert.deepEqual(evidence.result.profile.discoveredCandidates, []);
        assert.deepEqual(evidence.result.profile.completionCandidates, []);
        assert.equal(evidence.result.profile.modelCalls, 1);
        assert.match(evidence.result.profile.requestPrompt, /姓名消歧提示[^]*不能据此认定人物在本楼出现/u);
        assert.match(evidence.result.profile.requestPrompt, /姓名消歧提示[^]*白露/u);
        assert.equal(Object.keys(evidence.profiles).length, 0);
        assert.equal(evidence.result.world.afterRound, 1);
      } finally { await page.close(); }
    });

    await t.test('all nine newcomers in the current accepted reply are committed instead of dropping actor nine', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const names = Array.from({ length: 9 }, (_, index) => `同行者${index + 1}`);
        const profiles = names.map((name) => ({
          ...structuredClone(completeProfile), name, aliases: [],
          evidence: [`修复后的MVU本轮小队成员包含${name}`],
          inferences: [`其完整背景为结合当前世界与小队身份生成的可修订补全`],
        }));
        await installHarness(page, {
          initialMvuState: { hp: 10, 契约者: { 小队: { 名称: '九人小队', 成员: names.map((姓名) => ({ 姓名 })) } } },
          discoveryReplies: [JSON.stringify({ detectedCharacters: names, noCharacterReason: '' })],
          profileReplies: [JSON.stringify({ detectedCharacters: names, noProfileReason: '', profiles })],
        });
        await runAcceptedReply(page, `${names.join('、')}已经在门外集合。`);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          profile: window.MVUDoctorProfileEngine.getRuntime().lastResult.profile,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
        }));
        assert.equal(evidence.profile.completionCandidates.length, 9);
        assert.equal(evidence.profile.count, 9);
        assert.equal(Object.keys(evidence.profiles).length, 9);
      } finally { await page.close(); }
    });

    await t.test('a legal 3000-token profile limit batches nine required actors and commits the store only once', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const names = Array.from({ length: 9 }, (_, index) => `低额同行者${index + 1}`);
        const profiles = names.map((name) => ({
          ...structuredClone(completeProfile), name, aliases: [],
          evidence: [`修复后的MVU本轮小队成员包含${name}`],
          inferences: [`其完整背景为结合当前世界与小队身份生成的可修订补全`],
        }));
        await installHarness(page, {
          initialMvuState: { hp: 10, 契约者: { 小队: { 名称: '低额九人小队', 成员: names.map((姓名) => ({ 姓名 })) } } },
          discoveryReplies: [JSON.stringify({ detectedCharacters: names, noCharacterReason: '' })],
          profileReplies: profiles.map((profile) => profileEnvelope(profile)),
        });
        await page.evaluate(() => {
          window.__context.extensionSettings['mvu-doctor-kemini-clean'] = {
            mvuDoctorReferenceSettings: { maxTokens: 3000 },
          };
        });
        await runAcceptedReply(page, `${names.join('、')}按各自分工在门外集合。`);
        await waitForSettled(page, 'done', 12000);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          profile: window.MVUDoctorProfileEngine.getRuntime().lastResult.profile,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          profileWrites: window.__profileStoreWrites(),
        }));
        assert.equal(evidence.profile.batchCapacity, 1);
        assert.equal(evidence.profile.batchCount, 9);
        assert.equal(evidence.profile.modelCalls, 10);
        assert.equal(evidence.profile.count, 9);
        assert.equal(Object.keys(evidence.profiles).length, 9);
        assert.equal(evidence.profileWrites.length, 1, 'all batches must share one atomic IndexedDB commit');
        assert.deepEqual(evidence.stages, ['diagnosis', ...Array(9).fill('profile'), 'world']);
      } finally { await page.close(); }
    });

    await t.test('manual refill is scoped to the current reply and does not rewrite unrelated MVU inventory', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const currentProfile = { ...structuredClone(completeProfile), profileId: 'profile-current' };
        const remoteProfile = {
          ...structuredClone(completeProfile), profileId: 'profile-remote', name: '远方商人', aliases: [],
          currentState: { ...structuredClone(completeProfile.currentState), goal: '在远方港口完成自己的货运计划' },
        };
        const refreshedCurrent = {
          ...structuredClone(currentProfile),
          currentState: { ...structuredClone(currentProfile.currentState), goal: '完成本楼伤情观察并更新记录' },
        };
        const echoedInventory = {
          ...structuredClone(completeProfile), name: '远方队友', aliases: [],
          evidence: ['整份MVU库存中存在远方队友，但本楼没有出现'],
          inferences: ['其余字段是模型对无关库存人物的越界补全'],
        };
        await installHarness(page, {
          initialMvuState: {
            hp: 10,
            契约者: { 小队: { 成员: [{ 姓名: '白露' }, { 姓名: '远方商人' }, { 姓名: '远方队友' }] } },
          },
          profileReplies: [JSON.stringify({
            detectedCharacters: ['白露', '远方队友'], noProfileReason: '',
            profiles: [refreshedCurrent, echoedInventory],
          })],
        });
        await page.evaluate(({ current, remote }) => {
          window.__context.chatMetadata.mvuDoctorReferenceProfiles = {
            schema: 2, chatId: 'chat-a', revision: 1,
            profiles: { [current.profileId]: current, [remote.profileId]: remote },
            branches: {}, profileReceipts: {}, history: [], updatedAt: new Date().toISOString(),
          };
          window.__setChat([
            { is_user: true, mes: '只检查眼前的人。' },
            { is_user: false, is_system: false, mes: '白露把药箱放到桌边。', swipe_id: 0, swipes: ['白露把药箱放到桌边。'] },
          ]);
        }, { current: currentProfile, remote: remoteProfile });
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-action="retry-profile"]').click();
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
            result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            store: window.MVUDoctorProfileEngine.getStore(),
            profileWrites: window.__profileStoreWrites(),
        }));
        assert.deepEqual(evidence.result.currentReplyCandidates, ['白露']);
        assert.ok(evidence.result.mvuInventoryCandidates.includes('远方商人'));
        assert.ok(evidence.result.mvuInventoryCandidates.includes('远方队友'));
        assert.deepEqual(evidence.result.completionCandidates, ['白露']);
        assert.equal(evidence.runtime.phase, 'done');
        assert.match(evidence.runtime.detail, /人物手动补档完成：1张完整档案/u);
        assert.equal(JSON.stringify(evidence.store.profiles['profile-remote']), JSON.stringify(remoteProfile));
        assert.equal(evidence.store.profiles['profile-current'].currentState.goal, '完成本楼伤情观察并更新记录');
        assert.ok(!Object.values(evidence.store.profiles).some((profile) => profile.name === '远方队友'));
        assert.equal(evidence.profileWrites.length, 1);
      } finally { await page.close(); }
    });

    await t.test('a truly character-free turn is checked once by the profile model and still continues', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          initialMvuState: { hp: 10 },
          discoveryReplies: [discoveryEnvelope([], '最终正文明确说明空旷石廊没有任何非玩家人物出现')],
          profileReplies: [JSON.stringify({
            detectedCharacters: [], profiles: [],
            noProfileReason: '最终正文明确说明空旷石廊没有任何非玩家人物出现',
          })],
        });
        await runAcceptedReply(page, '雨势逐渐减弱，空旷石廊里没有任何人物出现。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'world']);
        assert.equal(evidence.result.profile.status, 'no-profile');
        assert.equal(evidence.result.profile.modelCalls, 1);
        assert.equal(evidence.result.profile.count, 0);
      } finally { await page.close(); }
    });

    await t.test('an already complete actor is not overwritten when the next discovery call finds no newcomer', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          discoveryReplies: [
            JSON.stringify({ detectedCharacters: ['白露'], noCharacterReason: '' }),
            JSON.stringify({ detectedCharacters: ['白露'], noCharacterReason: '' }),
          ],
          profileReplies: [profileEnvelope(), JSON.stringify({
            detectedCharacters: [], profiles: [],
            noProfileReason: '本轮只有已有完整档案的白露，没有需要新增或修复的人物',
          })],
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        await runNextAcceptedReply(page);
        await page.waitForFunction(() => window.__worldCalls.length === 2
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          store: window.MVUDoctorProfileEngine.getStore(),
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world', 'diagnosis', 'world']);
        assert.equal(evidence.result.profile.status, 'no-profile');
        assert.equal(evidence.result.profile.modelCalls, 1);
        assert.equal(evidence.result.profile.noProfileReason, '本轮实际出现的人物均已有完整档案，无需新增或修复');
        assert.equal(evidence.store.history.length, 2);
        assert.ok(evidence.store.history[1].committedProfileIds.length === 0);
        assert.ok(Object.keys(evidence.store.branches).length >= 4);
      } finally { await page.close(); }
    });

    await t.test('a prose-only newcomer is discovered and completed even when MVU has no actor container', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { initialMvuState: { hp: 10 } });
        await runAcceptedReply(page, '白露推门进来，把药箱轻轻放到桌边。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          profile: window.MVUDoctorProfileEngine.getRuntime().lastResult.profile,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.deepEqual(evidence.profile.completionCandidates, ['白露']);
        assert.equal(evidence.profile.modelCalls, 2);
        assert.equal(Object.values(evidence.profiles)[0].name, '白露');
      } finally { await page.close(); }
    });

    await t.test('two prose-only newcomers are discovered as names and completed in bounded atomic batches', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const names = ['林澄', '陆遥'];
        const profiles = names.map((name) => ({
          ...structuredClone(completeProfile), name, aliases: [],
          evidence: [`最终正文中${name}在门廊内采取了独立行动`],
          inferences: [`其背景是结合本轮行为与世界材料形成的可修订补全`],
        }));
        await installHarness(page, {
          initialMvuState: { hp: 10 },
          discoveryReplies: [JSON.stringify({ detectedCharacters: names, noCharacterReason: '' })],
          profileReplies: profiles.map((profile) => profileEnvelope(profile)),
        });
        await page.evaluate(() => {
          window.__context.extensionSettings['mvu-doctor-kemini-clean'] = {
            mvuDoctorReferenceSettings: { maxTokens: 3000 },
          };
        });
        await runAcceptedReply(page, '林澄将湿斗篷挂在门边，陆遥则蹲下检查地上的新鲜车辙。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          profile: window.MVUDoctorProfileEngine.getRuntime().lastResult.profile,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          profileWrites: window.__profileStoreWrites(),
          prompts: window.__profilePrompts,
          discoveryCalls: window.__discoveryCalls,
        }));
        assert.deepEqual(evidence.profile.currentReplyCandidates, []);
        assert.deepEqual(evidence.profile.mvuInventoryCandidates, []);
        assert.deepEqual(evidence.profile.discoveredCandidates, names);
        assert.deepEqual(evidence.profile.completionCandidates, names);
        assert.equal(evidence.profile.batchCapacity, 1);
        assert.equal(evidence.profile.batchCount, 2);
        assert.equal(evidence.profile.modelCalls, 3);
        assert.equal(Object.keys(evidence.profiles).length, 2);
        assert.equal(evidence.profileWrites.length, 1);
        assert.equal(evidence.discoveryCalls, 1);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'profile', 'world']);
        assert.match(evidence.prompts[1], /本批待处理人物[^]*林澄[^]*延后批次人物[^]*陆遥/u);
        assert.match(evidence.prompts[2], /本批待处理人物[^]*陆遥/u);
      } finally { await page.close(); }
    });

    await t.test('a repair response cannot consume a deferred actor through an alias', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const names = ['岑野', '乔霁'];
        const incompleteA = {
          ...structuredClone(completeProfile), name: names[0], aliases: [],
          currentState: { ...structuredClone(completeProfile.currentState), location: '' },
        };
        const repairedA = { ...structuredClone(completeProfile), name: names[0], aliases: [names[1]] };
        const poisonedB = { ...structuredClone(completeProfile), name: names[1], aliases: [] };
        const legitimateB = {
          ...structuredClone(completeProfile), name: names[1], aliases: [],
          currentState: { ...structuredClone(completeProfile.currentState), goal: 'LEGITIMATE_SECOND_BATCH_GOAL' },
        };
        await installHarness(page, {
          initialMvuState: { hp: 10 },
          discoveryReplies: [JSON.stringify({ detectedCharacters: names, noCharacterReason: '' })],
          profileReplies: [
            profileEnvelope(incompleteA),
            JSON.stringify({ detectedCharacters: names, noProfileReason: '', profiles: [repairedA, poisonedB] }),
            profileEnvelope(legitimateB),
          ],
        });
        await page.evaluate(() => {
          window.__context.extensionSettings['mvu-doctor-kemini-clean'] = {
            mvuDoctorReferenceSettings: { maxTokens: 3000 },
          };
        });
        await runAcceptedReply(page, '岑野守在左侧门柱旁，乔霁沿着墙根逐寸检查机关。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          profile: window.MVUDoctorProfileEngine.getRuntime().lastResult.profile,
          profiles: Object.values(window.MVUDoctorProfileEngine.getStore().profiles),
          profileWrites: window.__profileStoreWrites(),
          prompts: window.__profilePrompts,
        }));
        const storedA = evidence.profiles.find((profile) => profile.name === names[0]);
        const storedB = evidence.profiles.find((profile) => profile.name === names[1]);
        assert.equal(evidence.profile.repaired, true);
        assert.equal(evidence.profile.batchCapacity, 1);
        assert.equal(evidence.profile.batchCount, 2);
        assert.equal(evidence.profile.modelCalls, 4);
        assert.equal(evidence.profile.count, 2);
        assert.ok(!storedA.aliases.includes(names[1]));
        assert.equal(storedB.currentState.goal, 'LEGITIMATE_SECOND_BATCH_GOAL');
        assert.equal(evidence.profileWrites.length, 1);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'profile', 'profile', 'world']);
        assert.match(evidence.prompts[2], /延后批次人物[^]*绝不能返回[^]*乔霁/u);
      } finally { await page.close(); }
    });

    await t.test('world receipt makes a manual retry of the same accepted text idempotent', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const retry = await page.evaluate(() => window.MVUDoctorProfileEngine.runWorld(false));
        const evidence = await page.evaluate(() => ({
          worldCalls: window.__worldCalls,
          persistence: window.MVUDoctorProfileEngine.getRuntime().reportPersistence,
        }));
        assert.equal(retry.status, 'already-committed');
        assert.equal(evidence.worldCalls.length, 1);
        assert.equal(evidence.persistence.ok, true, JSON.stringify(evidence.persistence));
      } finally { await page.close(); }
    });

    await t.test('manual Story repair migrates the accepted identity without opening a second world receipt', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { mvuPatchMode: 'apply' });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const before = await page.evaluate(() => ({
          identity: window.MVUDoctorProfileEngine.getRuntime().lastAccepted.identity,
          generationKey: window.MVUDoctorProfileEngine.getRuntime().lastAccepted.generationKey,
        }));
        const evidence = await page.evaluate(async () => {
          window.__setDiagnosisReply('<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>');
          await window.MVUDoctorProfileEngine.runDiagnosis();
          const retry = await window.MVUDoctorProfileEngine.runWorld(false);
          return {
            retry,
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            worldCalls: window.__worldCalls,
          };
        });
        assert.notEqual(evidence.runtime.lastAccepted.identity, before.identity);
        assert.equal(evidence.runtime.lastAccepted.generationKey, before.generationKey);
        assert.equal(evidence.retry.status, 'already-committed');
        assert.equal(evidence.worldCalls.length, 1);
      } finally { await page.close(); }
    });

    await t.test('manual diagnosis recovery resumes profile and world from a failed diagnosis checkpoint', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { diagnosisReply: '无法识别的诊断文本', mvuPatchMode: 'apply' });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const before = await page.evaluate(() => window.MVUDoctorProfileEngine.getRuntime().lastResult);
        assert.equal(before.failedStep, 'diagnosis');
        await page.evaluate(async () => {
          window.__setDiagnosisReply('<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>');
          await window.MVUDoctorProfileEngine.runDiagnosis();
        });
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          calls: window.__worldCalls.length,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'diagnosis', 'profile', 'world']);
        assert.equal(evidence.calls, 1);
        assert.equal(evidence.checkpoint.status, 'complete');
      } finally { await page.close(); }
    });

    await t.test('a committed profile receipt skips a duplicate model call when reload lands before the world checkpoint', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(() => {
          const reply = '白露：我先替你看一看伤口。';
          window.__setChat([
            { is_user: true, mes: '请继续。' },
            { is_user: false, is_system: false, mes: reply, swipe_id: 0, swipes: [reply] },
          ]);
        });
        const first = await page.evaluate(() => window.MVUDoctorProfileEngine.runProfile());
        assert.equal(first.modelCalls, 2);
        await page.evaluate(async () => {
          const store = window.MVUDoctorProfileEngine.getStore();
          const receipt = Object.values(store.profileReceipts)[0];
          const generationKey = 'chat-a:receipt-window:test-generation';
          store.profileReceipts[generationKey] = { ...receipt, generationKey };
          window.WORLD_ENGINE_STORE.setItem('mvuDoctorReferenceProfileStore:chat-a', JSON.stringify(store));
          const message = window.__context.chat[receipt.messageId];
          const target = {
            chatId: receipt.chatId, index: receipt.messageId, swipeId: receipt.swipeId,
            fingerprint: receipt.fingerprint, identity: receipt.identity, generationKey, content: message.mes,
          };
          localStorage.setItem('mvuDoctorReferencePipeline:chat-a', JSON.stringify({
            status: 'running', target, generationType: 'normal', nextStep: 'profile',
            reason: 'auto', lastCompletedStep: 'diagnosis', updatedAt: new Date().toISOString(),
          }));
          await window.__emit('chat_loaded');
        });
        await page.waitForTimeout(1200);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          calls: window.__worldCalls.length,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.equal(evidence.runtime.phase, 'done', JSON.stringify({ runtime: evidence.runtime, checkpoint: evidence.checkpoint }));
        assert.deepEqual(evidence.stages, ['profile', 'world']);
        assert.equal(evidence.result.profile.status, 'already-committed');
        assert.equal(evidence.result.profile.modelCalls, 0);
        assert.equal(evidence.calls, 1);
      } finally { await page.close(); }
    });

    await t.test('a Story write followed by save failure preserves identity and manual recovery continues', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>',
          mvuPatchMode: 'apply',
          saveChatFailOnce: true,
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const before = await page.evaluate(() => ({
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          latest: window.__context.chat.at(-1).mes,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.equal(before.runtime.lastResult.failedStep, 'diagnosis');
        assert.ok(before.latest.includes('<UpdateVariable>'));
        assert.equal(before.runtime.lastAccepted.identity, before.checkpoint.target.identity);
        assert.ok(before.checkpoint.target.generationKey);
        await page.evaluate(async () => {
          window.__setDiagnosisReply('<JSONPatch>[]</JSONPatch>');
          await window.MVUDoctorProfileEngine.runDiagnosis();
        });
        await waitForSettled(page, 'done');
        const after = await page.evaluate(() => ({ stages: window.__stages, calls: window.__worldCalls.length }));
        assert.deepEqual(after.stages, ['diagnosis', 'diagnosis', 'profile', 'world']);
        assert.equal(after.calls, 1);
      } finally { await page.close(); }
    });

    await t.test('manual Story save failure also migrates identity before exposing the error', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { mvuPatchMode: 'apply' });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(async () => {
          const before = window.MVUDoctorProfileEngine.getRuntime().lastAccepted;
          window.__failNextSaveChat();
          window.__setDiagnosisReply('<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>');
          let error = '';
          try { await window.MVUDoctorProfileEngine.runDiagnosis(); }
          catch (caught) { error = caught?.message || String(caught); }
          const afterFailure = window.MVUDoctorProfileEngine.getRuntime().lastAccepted;
          const checkpoint = JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null');
          window.__setDiagnosisReply('<JSONPatch>[]</JSONPatch>');
          await window.MVUDoctorProfileEngine.runDiagnosis();
          const retry = await window.MVUDoctorProfileEngine.runWorld(false);
          return { before, afterFailure, checkpoint, retry, error, calls: window.__worldCalls };
        });
        assert.match(evidence.error, /synthetic saveChat failure/u);
        assert.notEqual(evidence.afterFailure.identity, evidence.before.identity);
        assert.equal(evidence.afterFailure.generationKey, evidence.before.generationKey);
        assert.equal(evidence.checkpoint.target.identity, evidence.afterFailure.identity);
        assert.equal(evidence.retry.status, 'already-committed');
        assert.equal(evidence.calls.length, 1);
      } finally { await page.close(); }
    });

    await t.test('successful manual diagnosis supersedes an unreachable old checkpoint and unlocks world', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { worldFailOnce: true });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(async () => {
          const message = window.__context.chat.at(-1);
          const edited = `${message.mes}\n\n白露：这是用户在医生失败后保留的当前版本。`;
          message.mes = edited;
          message.swipes[message.swipe_id] = edited;
          window.__setDiagnosisReply('<JSONPatch>[]</JSONPatch>');
          await window.MVUDoctorProfileEngine.runDiagnosis();
          const anchor = window.MVUDoctorProfileEngine.getRuntime().lastAccepted;
          const checkpoint = JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null');
          const world = await window.MVUDoctorProfileEngine.runWorld(false);
          return { anchor, checkpoint, world, calls: window.__worldCalls, stages: window.__stages };
        });
        assert.match(evidence.anchor.generationKey, /:manual:/u);
        assert.equal(evidence.checkpoint.reason, 'manual-diagnosis-anchor');
        assert.ok(evidence.checkpoint.supersededGenerationKey);
        assert.equal(evidence.world.status, 'advanced');
        assert.equal(evidence.calls.length, 2);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world', 'diagnosis', 'world']);
      } finally { await page.close(); }
    });

    await t.test('manual world on an old unbound chat creates one durable key and remains idempotent after Story writes', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { mvuPatchMode: 'apply' });
        const evidence = await page.evaluate(async () => {
          const reply = '白露：这是安装医生以前就存在的旧回复。';
          window.__setChat([
            { is_user: true, mes: '检查这条旧回复。' },
            { is_user: false, is_system: false, mes: reply, swipe_id: 0, swipes: [reply] },
          ]);
          const first = await window.MVUDoctorProfileEngine.runWorld(false);
          const key = window.MVUDoctorProfileEngine.getRuntime().lastAccepted.generationKey;
          window.__setDiagnosisReply('<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>');
          await window.MVUDoctorProfileEngine.runDiagnosis();
          const second = await window.MVUDoctorProfileEngine.runWorld(false);
          return { first, second, key, runtime: window.MVUDoctorProfileEngine.getRuntime(), calls: window.__worldCalls };
        });
        assert.equal(evidence.first.status, 'advanced');
        assert.equal(evidence.second.status, 'already-committed');
        assert.equal(evidence.runtime.lastAccepted.generationKey, evidence.key);
        assert.equal(evidence.calls.length, 1);
      } finally { await page.close(); }
    });

    await t.test('missing persisted report entries are exposed instead of silently exported as complete', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(async () => {
          const base = 'mvuDoctorReferenceReport:chat-a';
          const ids = JSON.parse(window.WORLD_ENGINE_STORE.getItem(`${base}:index`) || '[]');
          window.WORLD_ENGINE_STORE.removeItem(`${base}:entry:${ids[0]}`);
          await window.__emit('chat_loaded');
          return window.MVUDoctorProfileEngine.getRuntime();
        });
        assert.equal(evidence.reportPersistence.ok, false);
        assert.match(evidence.reportPersistence.error, /缺失或损坏/u);
        assert.ok(evidence.diagnostics.some((item) => item.phase === 'report-incomplete'));
      } finally { await page.close(); }
    });

    await t.test('reports and diagnostics persist in the mature World Engine store without new sessionStorage writes', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const beforeReload = await page.evaluate(() => {
          const base = 'mvuDoctorReferenceReport:chat-a';
          const ids = JSON.parse(window.WORLD_ENGINE_STORE.getItem(`${base}:index`) || '[]');
          const storedReports = ids.map((id) => JSON.parse(window.WORLD_ENGINE_STORE.getItem(`${base}:entry:${id}`)));
          const storedDiagnostics = JSON.parse(window.WORLD_ENGINE_STORE.getItem('mvuDoctorReferenceDiagnostics:chat-a') || '[]');
          const runtime = window.MVUDoctorProfileEngine.getRuntime();
          return {
            ids, storedReports, storedDiagnostics,
            runtimeReports: runtime.runReports,
            runtimeDiagnostics: runtime.diagnostics,
            sessionIndex: sessionStorage.getItem(`${base}:index`),
            sessionDiagnostics: sessionStorage.getItem('mvuDoctorReferenceDiagnostics:chat-a'),
          };
        });
        assert.ok(beforeReload.ids.length >= 4);
        assert.deepEqual(beforeReload.storedReports, beforeReload.runtimeReports);
        assert.deepEqual(beforeReload.storedDiagnostics, beforeReload.runtimeDiagnostics);
        assert.equal(beforeReload.sessionIndex, null);
        assert.equal(beforeReload.sessionDiagnostics, null);
        await page.evaluate(async () => { await window.__emit('chat_loaded'); });
        const afterReload = await page.evaluate(() => window.MVUDoctorProfileEngine.getRuntime());
        assert.equal(afterReload.reportPersistence.ok, true);
        assert.deepEqual(afterReload.runReports, beforeReload.runtimeReports);
        assert.ok(afterReload.runReports.some((run) => run.result?.profile?.requestPrompt));
      } finally { await page.close(); }
    });

    await t.test('legacy session reports migrate byte-for-byte into the mature store without deleting the only fallback copy', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { initialMvuState: { hp: 10 } });
        const evidence = await page.evaluate(async () => {
          const base = 'mvuDoctorReferenceReport:chat-a';
          const id = '1788000000000-legacy';
          const entry = { at: '2026-08-30T00:00:00.000Z', target: { chatId: 'chat-a' }, result: { legacy: true, full: '完整内容' } };
          const diagnostics = [{ at: '2026-08-30T00:00:00.000Z', phase: 'legacy-sentinel', detail: '旧诊断完整内容' }];
          const values = {
            [`${base}:entry:${id}`]: JSON.stringify(entry),
            [`${base}:index`]: JSON.stringify([id]),
            [`${base}:manifest`]: JSON.stringify({ attemptedCount: 1, savedCount: 1, complete: true, lastSavedAt: entry.at, lastError: '' }),
            'mvuDoctorReferenceDiagnostics:chat-a': JSON.stringify(diagnostics),
          };
          for (const [key, value] of Object.entries(values)) {
            window.WORLD_ENGINE_STORE.removeItem(key);
            sessionStorage.setItem(key, value);
          }
          await window.__emit('chat_loaded');
          return {
            entry: JSON.parse(window.WORLD_ENGINE_STORE.getItem(`${base}:entry:${id}`)),
            index: JSON.parse(window.WORLD_ENGINE_STORE.getItem(`${base}:index`)),
            manifest: JSON.parse(window.WORLD_ENGINE_STORE.getItem(`${base}:manifest`)),
            diagnostics: JSON.parse(window.WORLD_ENGINE_STORE.getItem('mvuDoctorReferenceDiagnostics:chat-a')),
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            legacyCopies: Object.fromEntries(Object.keys(values).map((key) => [key, sessionStorage.getItem(key)])),
          };
        });
        assert.deepEqual(evidence.entry.result, { legacy: true, full: '完整内容' });
        assert.deepEqual(evidence.index, ['1788000000000-legacy']);
        assert.equal(evidence.manifest.complete, true);
        assert.ok(evidence.diagnostics.some((item) => item.phase === 'legacy-sentinel'));
        assert.deepEqual(evidence.runtime.runReports[0].result, { legacy: true, full: '完整内容' });
        assert.ok(Object.values(evidence.legacyCopies).every((value) => value !== null));
      } finally { await page.close(); }
    });

    await t.test('a corrupt mature report entry is quarantined and restored from its valid legacy copy', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { initialMvuState: { hp: 10 } });
        const evidence = await page.evaluate(async () => {
          const base = 'mvuDoctorReferenceReport:chat-a';
          const id = '1788000000001-recover';
          const entryKey = `${base}:entry:${id}`;
          const validEntry = {
            at: '2026-08-30T00:01:00.000Z', target: { chatId: 'chat-a' },
            result: { recovered: true, full: '有效旧报告全文' },
          };
          const manifest = JSON.stringify({
            attemptedCount: 1, savedCount: 1, complete: true,
            lastSavedAt: validEntry.at, lastError: '',
          });
          window.WORLD_ENGINE_STORE.setItem(entryKey, '{broken-report-json');
          window.WORLD_ENGINE_STORE.setItem(`${base}:index`, JSON.stringify([id]));
          window.WORLD_ENGINE_STORE.setItem(`${base}:manifest`, manifest);
          sessionStorage.setItem(entryKey, JSON.stringify(validEntry));
          sessionStorage.setItem(`${base}:index`, JSON.stringify([id]));
          sessionStorage.setItem(`${base}:manifest`, manifest);
          await window.__emit('chat_loaded');
          const quarantines = window.WORLD_ENGINE_STORE.keys().filter((key) => key.startsWith(`${entryKey}:corrupt:`));
          return {
            restored: JSON.parse(window.WORLD_ENGINE_STORE.getItem(entryKey)),
            quarantines: quarantines.map((key) => window.WORLD_ENGINE_STORE.getItem(key)),
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            legacy: sessionStorage.getItem(entryKey),
          };
        });
        assert.equal(evidence.restored.result.full, '有效旧报告全文');
        assert.ok(evidence.quarantines.includes('{broken-report-json'));
        assert.equal(evidence.runtime.reportPersistence.ok, true);
        assert.equal(evidence.runtime.runReports[0].result.recovered, true);
        assert.match(evidence.legacy, /有效旧报告全文/u);
      } finally { await page.close(); }
    });

    await t.test('a valid legacy diagnostic copy recovers a corrupt target without deleting either forensic source', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const evidence = await page.evaluate(async () => {
          const key = 'mvuDoctorReferenceDiagnostics:chat-a';
          const legacy = [{ at: '2026-08-30T01:00:00.000Z', phase: 'legacy-recovery', detail: '可恢复的完整旧诊断' }];
          window.WORLD_ENGINE_STORE.setItem(key, '{broken-json');
          sessionStorage.setItem(key, JSON.stringify(legacy));
          await window.__emit('chat_loaded');
          const quarantines = window.WORLD_ENGINE_STORE.keys().filter((item) => item.startsWith(`${key}:corrupt:`));
          return {
            restored: JSON.parse(window.WORLD_ENGINE_STORE.getItem(key)),
            quarantine: quarantines.map((item) => window.WORLD_ENGINE_STORE.getItem(item)),
            legacy: sessionStorage.getItem(key),
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
          };
        });
        assert.ok(evidence.restored.some((item) => item.phase === 'legacy-recovery'));
        assert.ok(evidence.quarantine.includes('{broken-json'));
        assert.match(evidence.legacy, /legacy-recovery/u);
        assert.ok(evidence.runtime.diagnostics.some((item) => item.phase === 'legacy-recovery'));
      } finally { await page.close(); }
    });

    await t.test('rapid B to C chat loads cannot let the late B read overwrite or persist into C', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { initialMvuState: { hp: 10 } });
        const evidence = await page.evaluate(async () => {
          window.__metadataByChat['chat-c'] = {};
          window.WORLD_ENGINE_STORE.setItem('mvuDoctorReferenceDiagnostics:chat-b', JSON.stringify([
            { at: '2026-08-30T02:00:00.000Z', phase: 'chat-b-only', detail: 'B诊断' },
          ]));
          window.WORLD_ENGINE_STORE.setItem('mvuDoctorReferenceDiagnostics:chat-c', JSON.stringify([
            { at: '2026-08-30T02:00:01.000Z', phase: 'chat-c-only', detail: 'C诊断' },
          ]));
          const loadB = window.__switchChat('chat-b');
          const loadC = window.__switchChat('chat-c');
          await Promise.all([loadB, loadC]);
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            activeChat: window.__context.chatId,
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            storedC: JSON.parse(window.WORLD_ENGINE_STORE.getItem('mvuDoctorReferenceDiagnostics:chat-c') || '[]'),
          };
        });
        assert.equal(evidence.activeChat, 'chat-c');
        assert.ok(evidence.runtime.diagnostics.some((item) => item.phase === 'chat-c-only'));
        assert.ok(!evidence.runtime.diagnostics.some((item) => item.phase === 'chat-b-only'));
        assert.ok(evidence.storedC.some((item) => item.phase === 'chat-c-only'));
        assert.ok(!evidence.storedC.some((item) => item.phase === 'chat-b-only'));
      } finally { await page.close(); }
    });

    await t.test('a new generation in the same chat invalidates a late chat-load restore', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { initialMvuState: { hp: 10 } });
        const evidence = await page.evaluate(async () => {
          window.WORLD_ENGINE_STORE.setItem('mvuDoctorReferenceDiagnostics:chat-a', JSON.stringify([{
            at: new Date().toISOString(), phase: 'stale-load-sentinel', detail: '不得覆盖新生成状态',
          }]));
          const load = window.__emit('chat_loaded');
          window.__append({ is_user: true, mes: '立即开始新回合。' });
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          const before = structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
          await load;
          const after = window.MVUDoctorProfileEngine.getRuntime();
          return { before, after };
        });
        assert.ok(evidence.before?.generationKey);
        assert.equal(evidence.after.acceptedGeneration.generationKey, evidence.before.generationKey);
        assert.equal(evidence.after.acceptedGeneration.serial, evidence.before.serial);
        assert.equal(evidence.after.phase, 'waiting');
        assert.ok(!evidence.after.diagnostics.some((item) => item.phase === 'stale-load-sentinel'));
      } finally { await page.close(); }
    });

    await t.test('diagnostic read loss stays durably latched after the primary record later becomes parseable', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { initialMvuState: { hp: 10 } });
        await page.evaluate(async () => {
          const key = 'mvuDoctorReferenceDiagnostics:chat-a';
          sessionStorage.removeItem(key);
          window.WORLD_ENGINE_STORE.setItem(key, '{irrecoverable-diagnostic-json');
          await window.__emit('chat_loaded');
          if (!window.MVUDoctorProfileEngine.getRuntime().diagnosticPersistence.integrityCompromised) {
            throw new Error('read loss was not detected');
          }
          window.WORLD_ENGINE_STORE.setItem(key, '[]');
          await window.__emit('chat_loaded');
        });
        const runtime = await page.evaluate(() => window.MVUDoctorProfileEngine.getRuntime());
        assert.equal(runtime.diagnosticPersistence.integrityCompromised, true);
        assert.equal(runtime.diagnosticPersistence.ok, false);
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-action="export"]').click();
        await page.waitForFunction(() => window.__downloads.length === 1);
        const download = await page.evaluate(() => window.__downloads[0]);
        const report = JSON.parse(download.content);
        assert.match(download.name, /^mvu-doctor-incomplete-evidence-/u);
        assert.equal(report.exportIntegrity.complete, false);
        assert.equal(report.exportIntegrity.diagnosticPersistence.integrityCompromised, true);
      } finally { await page.close(); }
    });

    await t.test('open profile and world pages refresh after background commits without another tab click', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-tab="profiles"]').click();
        assert.match(await page.locator('[data-page="profiles"]').innerText(), /还没有人物档案/u);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        assert.match(await page.locator('[data-page="profiles"]').innerText(), /白露/u);

        await page.locator('[data-tab="world"]').click();
        assert.match(await page.locator('[data-page="world"]').innerText(), /"round": 1/u);
        await runNextAcceptedReply(page);
        await page.waitForFunction(() => window.__worldCalls.length === 2
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'done');
        assert.match(await page.locator('[data-page="world"]').innerText(), /"round": 2/u);
      } finally { await page.close(); }
    });

    await t.test('full report excludes the API key', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        await page.evaluate(async () => { await window.__emit('chat_loaded'); });
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-action="export"]').click();
        await page.waitForFunction(() => window.__downloads.length === 1);
        const download = await page.evaluate(() => window.__downloads[0]);
        assert.match(download.name, /^mvu-doctor-full-report-/u);
        assert.ok(!download.content.includes('SUPER_SECRET_BROWSER_SMOKE_KEY'));
        assert.ok(!download.content.includes('https://example.invalid/v1/chat/completions'));
        assert.ok(!download.content.includes('stub-model'));
        assert.equal(download.connected, true);
        const report = JSON.parse(download.content);
        assert.equal(report.exportIntegrity.complete, true);
        assert.deepEqual(report.api, { configured: true, excluded: true });
        assert.equal(report.doctorSettings.maxTokens, 12000);
        assert.equal(report.runtime.diagnosticPersistence.ok, true);
        assert.ok(report.runtime.runs.some((run) => run.result?.profile?.initialRaw));
        assert.equal(report.world.blackbox.secretAssets[0], '暗线账本');
        assert.equal(report.world.model, '剧情内部模型字段');
        assert.ok(Object.values(report.profiles.profiles)[0].profileId);
      } finally { await page.close(); }
    });

    await t.test('export rejects an active Doctor pipeline and succeeds after an explicit retry', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowProfile: true });
        await runAcceptedReply(page);
        await page.waitForFunction(() => window.__stages.includes('profile')
          && window.MVUDoctorProfileEngine.getRuntime().pipelineBusy === true);
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-action="export"]').click();
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'report-waiting');
        let evidence = await page.evaluate(() => ({
          downloads: window.__downloads.length,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
        }));
        assert.equal(evidence.downloads, 0);
        assert.match(evidence.runtime.detail, /医生任务仍在运行/u);
        await page.evaluate((reply) => window.__resolveProfile(reply), profileEnvelope());
        await waitForSettled(page, 'done');
        await page.locator('[data-action="export"]').click();
        await page.waitForFunction(() => window.__downloads.length === 1);
        evidence = await page.evaluate(() => ({
          download: window.__downloads[0],
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
        }));
        assert.match(evidence.download.name, /^mvu-doctor-full-report-/u);
        assert.equal(JSON.parse(evidence.download.content).exportIntegrity.complete, true);
      } finally { await page.close(); }
    });

    await t.test('an export that loses chat ownership neither downloads nor writes status into the incoming chat', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { initialMvuState: { hp: 10 } });
        await page.evaluate(() => {
          window.__setChat([
            { is_user: true, mes: '导出测试。' },
            { is_user: false, is_system: false, mes: '当前聊天正文。', swipe_id: 0, swipes: ['当前聊天正文。'] },
          ]);
          const internals = window.StoryOracleAPI.unsafe.eval('get doctor test internals');
          let resolveMvu;
          internals.getMvu = async () => ({
            getMvuData: () => new Promise((resolve) => {
              resolveMvu = resolve;
              window.__exportMvuStarted = true;
            }),
          });
          window.__resolveExportMvu = () => resolveMvu?.({ hp: 10 });
        });
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-action="export"]').click();
        await page.waitForFunction(() => window.__exportMvuStarted === true);
        await page.evaluate(async () => {
          await window.__switchChat('chat-b');
          window.__resolveExportMvu();
          await new Promise((resolve) => setTimeout(resolve, 30));
        });
        const evidence = await page.evaluate(() => ({
          downloads: window.__downloads,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          chatId: window.__context.chatId,
        }));
        assert.equal(evidence.chatId, 'chat-b');
        assert.equal(evidence.downloads.length, 0);
        assert.equal(evidence.runtime.exportBusy, false);
        assert.ok(!evidence.runtime.diagnostics.some((item) => /报告导出/u.test(String(item.detail || ''))));
      } finally { await page.close(); }
    });

    await t.test('automatic status refresh does not erase unsaved settings fields', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-tab="settings"]').click();
        await page.locator('[name="api-endpoint"]').fill('https://typed-but-not-saved.invalid/v1/chat/completions');
        await page.locator('[data-tab="diagnostics"]').click();
        await page.locator('[data-tab="settings"]').click();
        assert.equal(await page.locator('[name="api-endpoint"]').inputValue(), 'https://typed-but-not-saved.invalid/v1/chat/completions');
        await page.evaluate(async () => { await window.__emit('chat_loaded'); });
        await page.waitForTimeout(50);
        assert.equal(await page.locator('[name="api-endpoint"]').inputValue(), 'https://typed-but-not-saved.invalid/v1/chat/completions');
      } finally { await page.close(); }
    });

    await t.test('switching chat prevents an old pending profile task from committing', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowProfile: true });
        await runAcceptedReply(page);
        await page.waitForFunction(() => window.__stages.includes('profile'));
        await page.evaluate(async () => {
          await window.__switchChat('chat-b');
          window.__resolveProfile(JSON.stringify({ detectedCharacters: ['白露'], noProfileReason: '', profiles: [] }));
        });
        await page.waitForTimeout(100);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          metadataA: window.__metadataByChat['chat-a'],
          metadataB: window.__metadataByChat['chat-b'],
          saves: window.__saves,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
        }));
        assert.deepEqual(evidence.metadataA, {});
        assert.deepEqual(evidence.metadataB, {});
        assert.equal(evidence.saves.length, 0);
        assert.ok(!evidence.stages.includes('world'));
        assert.notEqual(evidence.runtime.phase, 'done');
      } finally { await page.close(); }
    });

    await t.test('explicit cancel persists a tombstone and chat reload does not resume the task', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowProfile: true });
        await runAcceptedReply(page);
        await page.waitForFunction(() => window.__stages.includes('profile'));
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-action="cancel"]').click();
        await page.evaluate(async () => { await window.__emit('chat_loaded'); });
        await page.waitForTimeout(900);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.equal(evidence.checkpoint.status, 'cancelled');
        assert.equal(evidence.runtime.phase, 'cancelled');
        assert.equal(evidence.stages.filter((stage) => stage === 'profile').length, 1);
        assert.equal(evidence.stages.filter((stage) => stage === 'world').length, 0);
      } finally { await page.close(); }
    });

    await t.test('a confirmed new user generation during durable profile save rolls the stale commit back', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(() => window.__slowNextDurableWrite());
        await runAcceptedReply(page);
        await page.waitForFunction(() => window.__durableWritePending());
        await page.evaluate(async () => {
          await window.__emit('generation_started', 'normal', {}, false);
          window.__append({ is_user: true, mes: '这是下一轮明确的用户输入。' });
          await window.__emit('message_sent');
          window.__resolveDurableWrite();
        });
        await page.waitForFunction(() => window.__profileStoreWrites().length >= 2);
        const evidence = await page.evaluate(() => ({
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
        }));
        assert.deepEqual(evidence.profiles, {});
        assert.ok(!evidence.stages.includes('world'));
        assert.notEqual(evidence.runtime.phase, 'done');
      } finally { await page.close(); }
    });

    await t.test('a background normal generation during durable profile save cannot cancel the accepted pipeline', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.evaluate(() => window.__slowNextDurableWrite());
        await runAcceptedReply(page);
        await page.waitForFunction(() => window.__durableWritePending());
        await page.evaluate(async () => {
          await window.__emit('generation_started', 'normal', {}, false);
          await window.__emit('generation_ended');
          window.__resolveDurableWrite();
        });
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
        }));
        assert.equal(Object.keys(evidence.profiles).length, 1);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'world']);
        assert.equal(evidence.runtime.lastResult.ok, true);
      } finally { await page.close(); }
    });
  } finally {
    await browser.close();
  }
});
