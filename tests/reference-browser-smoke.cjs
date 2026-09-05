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
  await page.evaluate(({ profileReplies: replies, discoveryReplies: suppliedDiscoveryReplies, slowProfile, slowDiagnosis, slowMetadata, diagnosisReply, diagnosisReplies, mvuPatchMode, saveChatFailOnce, saveMetadataFailOnce, initialMvuState, nativeStoryBusy }) => {
    const durableKv = new Map();
    let remainingSlowProfileWrites = 0;
    let remainingProfileWriteFailures = 0;
    let remainingPipelineWriteFailures = 0;
    let resolveDurableWrite = null;
    let mutationIncidentAfterPendingReadback = null;
    let mutationIncidentReadyForWorldRead = null;
    let writeMutationLatchCopies = null;
    let profileDurableCommitSerial = 0;
    let staleAfterProfileCommit = null;
    let staleAfterCommittedReceiptRead = null;
    const nativeStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemWithFaultInjection(key, value) {
      if (this === localStorage
        && String(key).startsWith('mvuDoctorReferencePipeline:')
        && remainingPipelineWriteFailures > 0) {
        remainingPipelineWriteFailures -= 1;
        throw new DOMException('synthetic pipeline checkpoint quota failure', 'QuotaExceededError');
      }
      return nativeStorageSetItem.call(this, key, value);
    };
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
          if (mode === 'readwrite'
            && pendingWrites.some(([key]) => key.startsWith('mvuDoctorReferenceProfileStore:'))) {
            profileDurableCommitSerial += 1;
          }
          const pendingMutationReadback = mode === 'readonly' && pendingReads.some(([key]) => {
            if (!key.startsWith('mvuDoctorReferenceMutationIntegrity:')) return false;
            try { return JSON.parse(durableKv.get(key) || 'null')?.clearPending === true; }
            catch { return false; }
          });
          const incidentToInject = pendingMutationReadback ? mutationIncidentAfterPendingReadback : null;
          if (incidentToInject) mutationIncidentAfterPendingReadback = null;
          transaction.oncomplete?.();
          if (incidentToInject) mutationIncidentReadyForWorldRead = incidentToInject;
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
    const pendingDiagnoses = [];
    let worldState = {
      round: 0,
      worldDigest: 'WORLD_BASE_SENTINEL',
      blackbox: { secretAssets: ['暗线账本'] },
      model: '剧情内部模型字段',
    };
    let worldCheckpoint = null;
    let remainingSlowMetadata = slowMetadata ? 1 : 0;
    let remainingSaveMetadataFailures = saveMetadataFailOnce ? 1 : 0;
    let remainingSaveChatFailures = saveChatFailOnce ? 1 : 0;
    let resolveMetadata = null;
    const worldSettings = {
      apiUrl: 'https://example.invalid/v1/chat/completions', model: 'stub-model',
      apiKey: 'SUPER_SECRET_BROWSER_SMOKE_KEY', connectionMode: 'direct', tonePrompt: '原生语气设定',
      engineEnabled: true, evolveMode: 'auto', syncToChat: true, injectionEnabled: true,
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
    window.__worldAbortCalls = 0;
    window.__worldStateWrites = [];
    window.__worldPanelOpens = 0;
    window.__worldPanelRefreshes = 0;
    window.__mvuReads = [];
    window.__mvuParseCalls = 0;
    window.__mvuWrites = [];
    window.__saves = [];
    window.__downloads = [];
    window.__profilePrompts = [];
    window.__modelCalls = [];
    window.__diagnosisRequests = [];
    window.__storyNotifications = [];
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
    window.__profilePending = () => Boolean(pendingProfile);
    window.__resolveDiagnosis = (value) => {
      const current = pendingDiagnoses.shift();
      current?.resolve(value);
    };
    window.__diagnosisPending = () => pendingDiagnoses.length > 0;
    window.__diagnosisPendingCount = () => pendingDiagnoses.length;
    window.__resolveMetadata = () => { const resolve = resolveMetadata; resolveMetadata = null; resolve?.(); };
    window.__slowNextMetadata = () => { remainingSlowMetadata += 1; };
    window.__failNextSaveMetadata = () => { remainingSaveMetadataFailures += 1; };
    window.__metadataPending = () => Boolean(resolveMetadata);
    window.__slowNextDurableWrite = () => { remainingSlowProfileWrites += 1; };
    window.__failNextDurableWrite = () => { remainingProfileWriteFailures += 1; };
    window.__failNextPipelineWrites = (count = 1) => { remainingPipelineWriteFailures += Math.max(1, Number(count) || 1); };
    window.__durableWritePending = () => Boolean(resolveDurableWrite);
    window.__resolveDurableWrite = () => { const resolve = resolveDurableWrite; resolveDurableWrite = null; resolve?.(); };
    window.__setDiagnosisReply = (value) => { activeDiagnosisReply = String(value); queuedDiagnosisReplies = []; };
    window.__setDiscoveryReplies = (values) => {
      queuedDiscoveryReplies = Array.isArray(values) ? values.map(String) : [];
    };
    window.__failNextSaveChat = () => { remainingSaveChatFailures += 1; };
    window.SillyTavern = { getContext: () => context };

    const mvuState = structuredClone(initialMvuState);
    const storyFixCfg = { autoFixEnabled: true };
    const mvu = {
      getMvuData: async (request) => {
        window.__mvuReads.push(structuredClone(request));
        return structuredClone(mvuState);
      },
      parseMessage: async (_block, oldData) => {
        window.__mvuParseCalls += 1;
        return mvuPatchMode === 'apply'
          ? { ...structuredClone(oldData), hp: Number(oldData?.hp || 0) + 1 }
          : structuredClone(oldData);
      },
      replaceMvuData: async (next) => {
        window.__mvuWrites.push({ before: structuredClone(mvuState), after: structuredClone(next) });
        Object.assign(mvuState, structuredClone(next));
      },
    };
    window.__mvuState = () => structuredClone(mvuState);
    let nativeStoryBusyState = Boolean(nativeStoryBusy);
    window.__nativeStoryCancelCalls = 0;
    window.__finishNativeStory = () => { nativeStoryBusyState = false; };
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
      stripMechanismBlocks: (value) => String(value || '')
        .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/giu, '')
        .replace(/<UpdateVariable>[\s\S]*$/iu, '')
        .replace(/\n{3,}/gu, '\n\n').trim(),
      buildDiagnosePromptFrom: () => 'diagnose the accepted final',
      beginPostReplyCall: () => { const controller = new AbortController(); return { signal: controller.signal, end() {} }; },
      showAutoDiagGenerating: () => null,
      dismissToast() {},
      callDirect: async (_endpoint, _apiKey, body) => {
        window.__stages.push('diagnosis');
        window.__diagnosisRequests.push(structuredClone(body?.messages || []));
        const reply = queuedDiagnosisReplies.length ? queuedDiagnosisReplies.shift() : activeDiagnosisReply;
        if (!slowDiagnosis) return reply;
        return new Promise((resolve) => { pendingDiagnoses.push({ resolve }); });
      },
      resolveEndpointUrl: (settings) => settings.endpoint,
      callProfile: async (_profileId, messages) => {
        window.__stages.push('diagnosis');
        window.__diagnosisRequests.push(structuredClone(messages || []));
        const reply = queuedDiagnosisReplies.length ? queuedDiagnosisReplies.shift() : activeDiagnosisReply;
        if (!slowDiagnosis) return reply;
        return new Promise((resolve) => { pendingDiagnoses.push({ resolve }); });
      },
      writeUpdateBlockToMessage: async (index, block) => {
        const message = context.chat[index];
        if (!message || !block) return;
        if (!String(message.mes || '').includes(block)) message.mes = `${String(message.mes || '').trimEnd()}\n\n${block}`;
        if (Array.isArray(message.swipes) && typeof message.swipes[message.swipe_id] === 'string') message.swipes[message.swipe_id] = message.mes;
      },
      refreshMessageBar() {},
      notifyAutoDiagnose(result, patch) {
        window.__storyNotifications.push({ status: String(result?.status || ''), patch: String(patch || '') });
      },
      cancelPostReply() { window.__nativeStoryCancelCalls += 1; },
      postReplyState: () => ({ busy: nativeStoryBusyState }),
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
    writeMutationLatchCopies = (record) => {
      const currentChatId = String(record?.chatId || context.chatId || '');
      const key = `mvuDoctorReferenceMutationIntegrity:${encodeURIComponent(currentChatId)}`;
      const value = JSON.stringify(record);
      nativeStorageSetItem.call(localStorage, key, value);
      worldStore.set(key, value);
      durableKv.set(key, value);
    };
    window.__setMutationLatch = (record) => writeMutationLatchCopies(structuredClone(record));
    window.__injectMutationIncidentAfterClearPending = (record) => {
      mutationIncidentAfterPendingReadback = structuredClone(record);
    };
    window.__mutationLatchCopies = () => {
      const key = `mvuDoctorReferenceMutationIntegrity:${encodeURIComponent(context.chatId)}`;
      const parse = (raw) => {
        try { return JSON.parse(raw || 'null'); } catch { return { corrupt: true, raw: String(raw) }; }
      };
      return {
        local: parse(localStorage.getItem(key)),
        mirror: parse(worldStore.get(key)),
        durable: parse(durableKv.get(key)),
      };
    };
    window.__durableGet = (key) => durableKv.get(String(key)) ?? null;
    window.__setWorldStoreCopies = (key, value) => {
      const storageKey = String(key);
      const raw = String(value);
      worldStore.set(storageKey, raw);
      durableKv.set(storageKey, raw);
    };
    const markProfileEvidenceStale = (mutationTarget = 'assistant') => {
      const message = mutationTarget === 'user'
        ? [...context.chat].reverse().find((entry) => entry?.is_user)
        : context.chat.at(-1);
      if (!message || message.is_system) return;
      const changed = `${String(message.mes || '')}\n\nPROFILE_POST_COMMIT_STALE_SENTINEL`;
      message.mes = changed;
      if (Array.isArray(message.swipes) && typeof message.swipes[message.swipe_id] === 'string') {
        message.swipes[message.swipe_id] = changed;
      }
    };
    window.__staleAfterNextProfileCommit = (failRollback = false, mutationTarget = 'assistant') => {
      staleAfterProfileCommit = {
        afterSerial: profileDurableCommitSerial + 1,
        failRollback: Boolean(failRollback),
        mutationTarget: String(mutationTarget || 'assistant'),
      };
    };
    window.__staleAfterNextCommittedReceiptRead = (mutationTarget = 'user') => {
      staleAfterCommittedReceiptRead = { mutationTarget: String(mutationTarget || 'user') };
    };
    window.__worldStoreWrites = [];
    window.__worldStore = worldStore;
    window.WORLD_ENGINE_STORE = {
      getItem: (key) => {
        const value = worldStore.has(key) ? worldStore.get(key) : null;
        if (String(key).startsWith('mvuDoctorReferenceMutationIntegrity:')
          && mutationIncidentReadyForWorldRead) {
          const incident = mutationIncidentReadyForWorldRead;
          mutationIncidentReadyForWorldRead = null;
          // Return the phase-1 tombstone to the read already in progress, but
          // install the newer incident before phase 2 can clear the old one.
          // A correct incident-id CAS must observe it on the final write path.
          writeMutationLatchCopies(incident);
          return value;
        }
        if (String(key).startsWith('mvuDoctorReferenceProfileStore:')
          && staleAfterCommittedReceiptRead) {
          const plan = staleAfterCommittedReceiptRead;
          staleAfterCommittedReceiptRead = null;
          queueMicrotask(() => markProfileEvidenceStale(plan.mutationTarget));
        }
        if (String(key).startsWith('mvuDoctorReferenceProfileStore:')
          && staleAfterProfileCommit
          && profileDurableCommitSerial >= staleAfterProfileCommit.afterSerial) {
          const plan = staleAfterProfileCommit;
          staleAfterProfileCommit = null;
          queueMicrotask(() => {
            if (plan.failRollback) remainingProfileWriteFailures += 1;
            markProfileEvidenceStale(plan.mutationTarget);
          });
        }
        return value;
      },
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
      saveCheckpoint: (value) => {
        worldCheckpoint = structuredClone(value);
        window.__worldStateWrites.push({ kind: 'checkpoint', value: structuredClone(value) });
      },
      saveState: (value) => {
        worldState = structuredClone(value);
        window.__worldStateWrites.push({ kind: 'state', value: structuredClone(value) });
      },
    };
    window.WORLD_ENGINE_WORLDBOOK = { buildPromptSection: async () => '原版世界后台提示' };
    window.WORLD_ENGINE_INJECT = { buildContext: (state) => JSON.stringify(state) };
    window.WORLD_ENGINE = {
      async manualEvolve(mode, reason) {
        const promptSection = await window.WORLD_ENGINE_WORLDBOOK.buildPromptSection();
        const injection = window.WORLD_ENGINE_INJECT.buildContext(window.WORLD_ENGINE_CORE.loadState());
        const before = structuredClone(worldState);
        window.__worldCalls.push({ mode, reason, beforeRound: before.round, beforeDigest: before.worldDigest, promptSection, injection });
        return true;
      },
    };
    window.WORLD_ENGINE_EVOLUTION = {
      abort() { window.__worldAbortCalls += 1; },
      getLastError: () => '',
      getLastDebug: () => ({ owner: 'native-world' }),
    };
    window.WORLD_ENGINE_UI = {
      showPanel() { window.__worldPanelOpens += 1; },
      refresh() { window.__worldPanelRefreshes += 1; },
    };
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
    slowDiagnosis: Boolean(options.slowDiagnosis),
    diagnosisReply: options.diagnosisReply || '<JSONPatch>[]</JSONPatch>',
    diagnosisReplies: Array.isArray(options.diagnosisReplies) ? options.diagnosisReplies : [],
    mvuPatchMode: options.mvuPatchMode || 'noop',
    slowMetadata: Boolean(options.slowMetadata),
    saveChatFailOnce: Boolean(options.saveChatFailOnce),
    saveMetadataFailOnce: Boolean(options.saveMetadataFailOnce),
    nativeStoryBusy: Boolean(options.nativeStoryBusy),
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

async function startReceivedTicketWithoutEnd(page, assistantText) {
  return page.evaluate(async (text) => {
    window.__setChat([{ is_user: true, mes: '请继续。' }]);
    await window.__emit('message_sent');
    await window.__emit('generation_started', 'normal', {}, false);
    window.__append({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] });
    await window.__emit('message_received', 1, 'normal');
    return structuredClone(window.MVUDoctorProfileEngine.getRuntime().acceptedGeneration);
  }, assistantText);
}

async function waitForSettled(page, expectedPhase, timeout = 8000) {
  await page.waitForFunction((phase) => window.MVUDoctorProfileEngine.getRuntime().phase === phase, expectedPhase, { timeout });
}

test('0.9.10 mature World adapter and Doctor browser smoke', { timeout: 300000 }, async (t) => {
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

    await t.test('390x844 shows all five tabs without horizontal scrolling and reaches the final overview action', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await installHarness(page);
        await page.locator('#mvu-ref-launcher').click();
        const geometry = await page.evaluate(() => {
          document.querySelector('#mvu-ref-panel nav [data-tab="overview"]')?.click();
          const panel = document.getElementById('mvu-ref-panel');
          const nav = panel.querySelector('nav');
          const section = panel.querySelector('[data-page="overview"]');
          const tabs = [...nav.querySelectorAll('[data-tab]')];
          const actions = [...section.querySelectorAll('[data-action]')];
          const panelRect = panel.getBoundingClientRect();
          const navRect = nav.getBoundingClientRect();
          const sectionRect = section.getBoundingClientRect();
          const rect = (element) => {
            const value = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              left: value.left, top: value.top, right: value.right, bottom: value.bottom,
              width: value.width, height: value.height,
              visible: value.width > 0 && value.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
              labelFits: element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1,
            };
          };
          const maxScrollTop = Math.max(0, section.scrollHeight - section.clientHeight);
          section.scrollTop = section.scrollHeight;
          const lastAction = actions.at(-1);
          const lastRect = lastAction.getBoundingClientRect();
          return {
            panel: {
              ...rect(panel), clientWidth: panel.clientWidth, scrollWidth: panel.scrollWidth,
            },
            nav: {
              ...rect(nav), clientWidth: nav.clientWidth, scrollWidth: nav.scrollWidth,
            },
            section: {
              ...rect(section), clientWidth: section.clientWidth, scrollWidth: section.scrollWidth,
              clientHeight: section.clientHeight, scrollHeight: section.scrollHeight,
              scrollTop: section.scrollTop, maxScrollTop, overflowY: getComputedStyle(section).overflowY,
            },
            tabs: tabs.map((element) => ({ ...rect(element), insidePanel: element.getBoundingClientRect().left >= panelRect.left - 1
              && element.getBoundingClientRect().right <= panelRect.right + 1,
              insideNav: element.getBoundingClientRect().left >= navRect.left - 1
              && element.getBoundingClientRect().right <= navRect.right + 1 })),
            actions: actions.map((element) => ({ ...rect(element), horizontallyInside: element.getBoundingClientRect().left >= sectionRect.left - 1
              && element.getBoundingClientRect().right <= sectionRect.right + 1 })),
            lastActionAtEnd: !!lastAction && lastRect.top >= sectionRect.top - 1 && lastRect.bottom <= sectionRect.bottom + 1,
          };
        });
        assert.equal(geometry.tabs.length, 5, JSON.stringify(geometry));
        assert.ok(geometry.tabs.every((tab) => tab.visible && tab.insidePanel && tab.insideNav && tab.labelFits), JSON.stringify(geometry));
        assert.ok(geometry.nav.scrollWidth <= geometry.nav.clientWidth + 1, JSON.stringify(geometry));
        assert.ok(geometry.panel.scrollWidth <= geometry.panel.clientWidth + 1, JSON.stringify(geometry));
        assert.ok(geometry.section.scrollWidth <= geometry.section.clientWidth + 1, JSON.stringify(geometry));
        assert.ok(['auto', 'scroll'].includes(geometry.section.overflowY), JSON.stringify(geometry));
        assert.ok(geometry.section.scrollHeight > geometry.section.clientHeight, JSON.stringify(geometry));
        assert.ok(Math.abs(geometry.section.scrollTop - geometry.section.maxScrollTop) <= 1, JSON.stringify(geometry));
        assert.ok(geometry.actions.length >= 5 && geometry.actions.every((action) => action.visible && action.horizontallyInside), JSON.stringify(geometry));
        assert.equal(geometry.lastActionAtEnd, true, JSON.stringify(geometry));
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

    await t.test('public world injection exposes only observable consequences without mutating private state', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const evidence = await page.evaluate(() => {
          const privateState = {
            round: 3,
            worldDigest: '白露正在暗中收集所有同伴的弱点。',
            winds: [
              { id: 'wind-low', topic: '低级风声主题', level: 2, content: '二级公开风声', source: '地方转述' },
              { id: 'wind-high', topic: '高级风声主题', level: 3, content: '三级公开风声', source: '大区公告' },
            ],
            events: [
              { name: '低阶筹备', level: 2, stage: '筹备', evolveResult: '尚未公开的低阶变化' },
              { name: '高阶进行中', level: 3, stage: '执行', evolveResult: '大区运输已经出现公开延误' },
              { name: '港口警报', level: 1, stage: '已爆发', evolveResult: '港口已经响起警报' },
              { name: '旧桥坍塌', level: 2, stage: '已完成', evolveResult: '旧桥已经坍塌' },
            ],
            factions: [{
              name: '公开可见的商会', currentGoal: '秘密垄断港口',
              core_person: '幕后首领', powerPillars: ['暗中收买的卫队'],
            }],
            enemies: [{ name: '尚未公开的敌人' }],
            influenceChain: [{ from: '幕后首领', to: '港口卫队' }],
            blackbox: {
              secretActions: [{ action: '秘密记录同伴资料' }],
              secretAssets: [{ name: '暗藏名册' }],
            },
          };
          const before = structuredClone(privateState);
          const memoryPayloads = [];
          window.MEMORY_ENGINE = {
            ingestWorldEvolution(payload) {
              memoryPayloads.push(structuredClone(payload));
              return { accepted: true, replace: payload?.replace === true };
            },
          };
          // Mirror the frozen World 3.0.2 injector's own visibility policy so
          // this test exercises the Doctor redaction wrapper around the real
          // native contract rather than around a JSON echo stub.
          window.WORLD_ENGINE_INJECT.buildContext = (state) => {
            const injectAllLevels = window.WORLD_ENGINE_API.getSettings().injectAllLevels === true;
            const visible = structuredClone(state);
            visible.events = (visible.events || []).filter((event) => (
              injectAllLevels
              || Number(event.level || 0) >= 3
              || event.stage === '已爆发'
              || event.stage === '已完成'
            ));
            visible.winds = (visible.winds || []).filter((wind) => (
              injectAllLevels || Number(wind.level || 0) >= 3
            ));
            return JSON.stringify(visible);
          };
          window.MVUDoctorProfileEngine.installWorldPublicProjection();
          const output = window.WORLD_ENGINE_INJECT.buildContext(privateState);
          const publicPayload = {
            worldDigest: 'SECRET_DIGEST_MUST_NOT_ENTER_MEMORY',
            worldUpdate: privateState,
            replace: true,
            source: 'reroll-replacement',
          };
          const publicPayloadBefore = structuredClone(publicPayload);
          const currentWorldSettings = window.WORLD_ENGINE_API.getSettings(true);
          window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({
            ...currentWorldSettings, injectAllLevels: false,
          }));
          const memoryReceipt = window.MEMORY_ENGINE.ingestWorldEvolution(publicPayload);
          const allLevelsPayload = {
            ...structuredClone(publicPayload), replace: false, source: 'all-levels-enabled',
          };
          const allLevelsBefore = structuredClone(allLevelsPayload);
          window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({
            ...window.WORLD_ENGINE_API.getSettings(true), injectAllLevels: true,
          }));
          const allLevelsReceipt = window.MEMORY_ENGINE.ingestWorldEvolution(allLevelsPayload);
          window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({
            ...window.WORLD_ENGINE_API.getSettings(true), injectAllLevels: false,
          }));
          const hiddenOnlyPayload = {
            worldDigest: 'HIDDEN_ONLY_SECRET_DIGEST',
            worldUpdate: {
              round: 4,
              worldDigest: '幕后人物正在改变计划',
              events: [{ stage: '酝酿中', content: '仍未公开的支线' }],
              factions: [{ currentGoal: '秘密目标', core_person: '幕后人物' }],
              blackbox: { secretActions: [{ action: '暗中行动' }], secretAssets: [{ name: '秘密资产' }] },
            },
            replace: true,
            source: 'hidden-reroll-replacement',
          };
          const hiddenOnlyBefore = structuredClone(hiddenOnlyPayload);
          const hiddenReceipt = window.MEMORY_ENGINE.ingestWorldEvolution(hiddenOnlyPayload);
          return {
            output, projection: JSON.parse(output), privateState, before,
            publicPayload, publicPayloadBefore, hiddenOnlyPayload, hiddenOnlyBefore,
            allLevelsPayload, allLevelsBefore,
            memoryPayloads, memoryReceipt, allLevelsReceipt, hiddenReceipt,
          };
        });
        assert.match(evidence.output, /公开风声/u);
        assert.match(evidence.output, /后台摘要已隔离/u);
        assert.match(evidence.output, /高阶进行中|大区运输已经出现公开延误/u);
        assert.match(evidence.output, /港口已经响起警报|旧桥已经坍塌/u);
        assert.match(evidence.output, /公开可见的商会/u);
        assert.doesNotMatch(evidence.output, /暗中收集|尚未公开的低阶变化|秘密垄断港口|幕后首领|暗中收买|尚未公开的敌人|港口卫队|秘密记录同伴资料|暗藏名册/u);
        assert.deepEqual(evidence.projection.events.map((event) => event.stage), ['执行', '已爆发', '已完成']);
        assert.deepEqual(evidence.projection.winds.map((wind) => [wind.topic, wind.source]), [['高级风声主题', '大区公告']]);
        assert.equal(Object.hasOwn(evidence.projection.factions[0], 'currentGoal'), false);
        assert.equal(Object.hasOwn(evidence.projection.factions[0], 'core_person'), false);
        assert.equal(Object.hasOwn(evidence.projection.factions[0], 'powerPillars'), false);
        assert.deepEqual(evidence.projection.enemies, []);
        assert.deepEqual(evidence.projection.influenceChain, []);
        assert.deepEqual(evidence.projection.blackbox.secretActions, []);
        assert.deepEqual(evidence.projection.blackbox.secretAssets, []);
        assert.deepEqual(evidence.privateState, evidence.before, 'projection must never alter the persisted native object');
        assert.deepEqual(evidence.publicPayload, evidence.publicPayloadBefore, 'Memory projection must not mutate the public-source payload');
        assert.deepEqual(evidence.allLevelsPayload, evidence.allLevelsBefore, 'all-level Memory projection must not mutate its source payload');
        assert.deepEqual(evidence.hiddenOnlyPayload, evidence.hiddenOnlyBefore, 'hidden-only Memory projection must not mutate its source payload');
        assert.equal(evidence.memoryReceipt.replace, true);
        assert.equal(evidence.allLevelsReceipt.replace, false);
        assert.equal(evidence.hiddenReceipt.replace, true);
        assert.equal(evidence.memoryPayloads.length, 3);
        const [publicMemory, allLevelsMemory, hiddenMemory] = evidence.memoryPayloads;
        assert.equal(publicMemory.replace, true, 'reroll replace semantics must reach mature Memory unchanged');
        assert.equal(publicMemory.source, 'reroll-replacement');
        assert.match(publicMemory.worldDigest, /公开世界变化/u);
        assert.match(publicMemory.worldDigest, /三级公开风声|高阶进行中|港口警报|旧桥坍塌/u);
        assert.doesNotMatch(publicMemory.worldDigest, /二级公开风声/u);
        assert.deepEqual(publicMemory.worldUpdate.events.map((event) => event.stage), ['执行', '已爆发', '已完成']);
        assert.deepEqual(publicMemory.worldUpdate.winds.map((wind) => wind.content), ['三级公开风声']);
        assert.deepEqual(publicMemory.worldUpdate.winds.map((wind) => [wind.topic, wind.source]), [['高级风声主题', '大区公告']]);
        assert.doesNotMatch(JSON.stringify(publicMemory), /SECRET_DIGEST|暗中收集|秘密伏击|秘密目标|幕后人物|秘密资产/u);
        assert.equal(allLevelsMemory.replace, false);
        assert.equal(allLevelsMemory.source, 'all-levels-enabled');
        assert.deepEqual(allLevelsMemory.worldUpdate.winds.map((wind) => wind.content), ['二级公开风声', '三级公开风声']);
        assert.deepEqual(allLevelsMemory.worldUpdate.events.map((event) => event.stage), ['筹备', '执行', '已爆发', '已完成']);
        assert.match(allLevelsMemory.worldDigest, /二级公开风声/u);
        assert.equal(hiddenMemory.replace, true, 'hidden-only reroll must still let Memory perform its replace rollback');
        assert.equal(hiddenMemory.source, 'hidden-reroll-replacement');
        assert.equal(hiddenMemory.worldDigest, '', 'hidden-only evolution must not create a no-op public minute');
        assert.deepEqual(hiddenMemory.worldUpdate.events, []);
        assert.deepEqual(hiddenMemory.worldUpdate.blackbox, { secretActions: [], secretAssets: [] });
        assert.doesNotMatch(JSON.stringify(hiddenMemory), /HIDDEN_ONLY_SECRET_DIGEST|幕后人物|仍未公开|暗中行动|秘密资产/u);
      } finally { await page.close(); }
    });

    await t.test('accepted final runs diagnosis and profile while World receives a bounded native extra-instruction', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          actorInstruction: window.MVUDoctorProfileEngine.buildWorldActorInstruction({ round: 0, events: [] }),
          profileWrites: window.__profileStoreWrites(),
          modelCalls: window.__modelCalls,
          manualWorldCalls: window.__worldCalls,
          worldAbortCalls: window.__worldAbortCalls,
          worldStateWrites: window.__worldStateWrites,
          worldSettings: window.WORLD_ENGINE_API.getSettings(true),
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'profile']);
        assert.equal(evidence.runtime.lastResult.ok, true);
        assert.equal(evidence.runtime.lastResult.profile.count, 1);
        assert.equal(evidence.runtime.lastResult.profile.modelCalls, 2);
        assert.equal(Object.keys(evidence.profiles).length, 1);
        assert.match(evidence.actorInstruction, /【本轮非玩家主体推进】/u);
        assert.match(evidence.actorInstruction, new RegExp(completeProfile.name, 'u'));
        assert.match(evidence.actorInstruction, new RegExp(completeProfile.personality.coreDesire, 'u'));
        assert.match(evidence.actorInstruction, new RegExp(completeProfile.personality.socialMotive, 'u'));
        assert.match(evidence.actorInstruction, new RegExp(completeProfile.currentState.goal, 'u'));
        assert.match(evidence.actorInstruction, /本轮必须推进一个非玩家主体/u);
        assert.match(evidence.actorInstruction, /脚本轮换的非玩家候选/u);
        assert.match(evidence.actorInstruction, /若其唯一合理动作只是等待\{\{user\}\}/u);
        assert.match(evidence.actorInstruction, /不得只更新world_digest、influenceChain或reputation/u);
        assert.doesNotMatch(evidence.actorInstruction, new RegExp(completeProfile.personality.temperament, 'u'));
        assert.doesNotMatch(evidence.actorInstruction, new RegExp(completeProfile.currentState.emotion, 'u'));
        assert.doesNotMatch(evidence.actorInstruction, new RegExp(completeProfile.history, 'u'));
        assert.doesNotMatch(evidence.actorInstruction, /最终正文中白露|可修订补全/u);
        assert.doesNotMatch(evidence.actorInstruction, /blackbox[^\n]*仅(?:限|由)\{\{user\}\}/u, 'Doctor must not replace World\'s native blackbox ownership with a player-only rule');
        assert.ok(evidence.actorInstruction.length <= 2200, 'the World extra-instruction has a hard bounded budget');
        assert.equal(evidence.profileWrites.length, 1);
        assert.deepEqual(evidence.manualWorldCalls, []);
        assert.equal(evidence.worldAbortCalls, 0);
        assert.deepEqual(evidence.worldStateWrites, []);
        assert.equal(evidence.worldSettings.evolveMode, 'auto');
        assert.equal(evidence.worldSettings.engineEnabled, true);
        assert.equal(evidence.worldSettings.syncToChat, true);
        assert.equal(evidence.worldSettings.injectionEnabled, true);
        const withoutPlayer = await page.evaluate(() => {
          const store = window.MVUDoctorProfileEngine.getStore();
          const playerProfile = structuredClone(Object.values(store.profiles)[0]);
          playerProfile.profileId = 'synthetic-player-profile';
          playerProfile.name = '旧人格名';
          playerProfile.aliases = ['玩家'];
          window.__context.chat.find((message) => message.is_user).name = '旧人格名';
          store.profiles[playerProfile.profileId] = playerProfile;
          window.WORLD_ENGINE_STORE.setItem(
            'mvuDoctorReferenceProfileStore:chat-a',
            JSON.stringify(store),
          );
          return window.MVUDoctorProfileEngine.buildWorldActorInstruction({ round: 0 });
        });
        assert.doesNotMatch(withoutPlayer, /旧人格名/u, 'player profile must never enter the World instruction');
        const authoritativeIdentity = await page.evaluate(() => {
          const store = window.MVUDoctorProfileEngine.getStore();
          const template = structuredClone(Object.values(store.profiles)[0]);
          const add = (profileId, name) => {
            const profile = structuredClone(template);
            profile.profileId = profileId;
            profile.name = name;
            profile.aliases = [];
            store.profiles[profileId] = profile;
          };
          add('locked-persona-profile', '锁定人格名');
          add('default-persona-profile', '默认但未激活人格');
          add('mentioned-npc-profile', '被询问角色');
          window.__context.chatMetadata.persona = 'locked-persona-id';
          window.__context.powerUserSettings = {
            default_persona: 'default-persona-id',
            personas: {
              'locked-persona-id': '锁定人格名',
              'default-persona-id': '默认但未激活人格',
            },
          };
          window.__context.chat.find((message) => message.is_user).mes = '请问姓名：被询问角色。';
          window.WORLD_ENGINE_STORE.setItem(
            'mvuDoctorReferenceProfileStore:chat-a',
            JSON.stringify(store),
          );
          return [0, 1, 2, 3].map((round) => window.MVUDoctorProfileEngine.buildWorldActorInstruction({ round }));
        });
        assert.doesNotMatch(authoritativeIdentity.join('|'), /锁定人格名/u, 'the chat-locked persona is the player');
        assert.match(authoritativeIdentity.join('|'), /默认但未激活人格/u, 'an inactive default persona must not be guessed as the player');
        assert.match(authoritativeIdentity.join('|'), /被询问角色/u, 'ordinary text asking an NPC name must not turn that NPC into the player');
        const actorSelection = await page.evaluate(() => {
          const source = structuredClone(Object.values(window.MVUDoctorProfileEngine.getStore().profiles)[0]);
          const inflate = (profileId, name) => {
            const profile = structuredClone(source);
            const visit = (value, key = '') => {
              if (Array.isArray(value)) return value.map((item) => `${item}${'详'.repeat(500)}`);
              if (value && typeof value === 'object') {
                for (const [childKey, child] of Object.entries(value)) value[childKey] = visit(child, childKey);
                return value;
              }
              if (typeof value === 'string' && !['profileId', 'name'].includes(key)) return `${value}${'详'.repeat(500)}`;
              return value;
            };
            visit(profile);
            profile.profileId = profileId;
            profile.name = name;
            profile.aliases = [];
            return profile;
          };
          const store = window.MVUDoctorProfileEngine.getStore();
          store.profiles = {
            relatedA: inflate('related-a', '关联甲'),
            relatedB: inflate('related-b', '关联乙'),
            relatedC: inflate('related-c', '关联丙'),
            relatedD: inflate('related-d', '关联丁'),
            backgroundA: inflate('background-a', '后台甲'),
            backgroundB: inflate('background-b', '后台乙'),
          };
          window.__context.chatMetadata.persona = '';
          window.__context.powerUserSettings = { default_persona: '', personas: {} };
          window.__context.chat.find((message) => message.is_user).name = '测试玩家';
          window.__context.chat.find((message) => message.is_user).mes = '关联甲、关联乙、关联丙和关联丁都在当前输入中。';
          window.WORLD_ENGINE_STORE.setItem(
            'mvuDoctorReferenceProfileStore:chat-a',
            JSON.stringify(store),
          );
          return {
            active: window.MVUDoctorProfileEngine.buildWorldActorInstruction({
              round: 0,
              events: [{ name: '后台甲正在筹备远处行动', stage: '筹备' }],
            }),
            rotating: [0, 1, 2].map((round) => window.MVUDoctorProfileEngine
              .buildWorldActorInstruction({ round, events: [] })),
          };
        });
        assert.match(actorSelection.active, /后台甲/u, 'an existing native event selects its non-player actor first');
        assert.match(actorSelection.rotating[0], /第一人优先/u);
        assert.notEqual(actorSelection.rotating[0], actorSelection.rotating[1], 'round number rotates the native actor choice when no event owns the turn');
        assert.ok(actorSelection.rotating.every((instruction) => instruction.length <= 2200));
        const disabledInstruction = await page.evaluate(() => {
          window.__context.extensionSettings['mvu-doctor-kemini-clean'] = {
            mvuDoctorReferenceSettings: { enabled: true, profileEnabled: false },
          };
          return {
            instruction: window.MVUDoctorProfileEngine.buildWorldActorInstruction({ round: 9 }),
          };
        });
        assert.match(disabledInstruction.instruction, /没有可用Doctor人物档案/u);
        assert.doesNotMatch(disabledInstruction.instruction, /关联甲|后台甲/u, 'disabling profile export must not leak old profile data into World');
      } finally { await page.close(); }
    });

    await t.test('default diagnosis wait stays compatible while the native World wait continues through profile commit', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowProfile: true });
        await runAcceptedReply(page);
        await page.evaluate(() => {
          window.__diagnosisBarrierReceipt = null;
          window.__profileBarrierReceipt = null;
          window.__diagnosisBarrierPromise = window.MVUDoctorProfileEngine.waitForWorldDiagnosis({
            aiMsg: window.__context.chat.at(-1).mes,
          }).then((receipt) => { window.__diagnosisBarrierReceipt = receipt; return receipt; });
          window.__profileBarrierPromise = window.MVUDoctorProfileEngine.waitForWorldDiagnosis({
            aiMsg: window.__context.chat.at(-1).mes,
            throughProfile: true,
          }).then((receipt) => { window.__profileBarrierReceipt = receipt; return receipt; });
        });
        await page.waitForFunction(() => window.__diagnosisBarrierReceipt
          && window.__stages.includes('profile')
          && window.MVUDoctorProfileEngine.getRuntime().pipelineBusy === true);
        const evidence = await page.evaluate(() => ({
          publicApi: typeof window.MVUDoctorProfileEngine.waitForWorldDiagnosis,
          receipt: window.__diagnosisBarrierReceipt,
          profileReceipt: window.__profileBarrierReceipt,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
          profilePending: window.__profilePending(),
        }));
        assert.equal(evidence.publicApi, 'function');
        assert.deepEqual(evidence.receipt, { ok: true, status: 'diagnosis-complete' });
        assert.equal(evidence.checkpoint.status, 'running');
        assert.equal(evidence.checkpoint.nextStep, 'profile');
        assert.equal(evidence.runtime.pipelineBusy, true, 'profile is still unresolved when the barrier releases');
        assert.equal(evidence.profilePending, true, 'the profile model promise remains unresolved');
        assert.equal(evidence.profileReceipt, null, 'World must not start from an empty actor set while this profile is still pending');
        assert.notEqual(evidence.runtime.phase, 'done');
        await page.evaluate((reply) => window.__resolveProfile(reply), profileEnvelope());
        await waitForSettled(page, 'done');
        await page.waitForFunction(() => Boolean(window.__profileBarrierReceipt));
        const settled = await page.evaluate(() => ({
          receipt: window.__profileBarrierReceipt,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
        }));
        assert.deepEqual(settled.receipt, { ok: true, status: 'profile-complete' });
        assert.equal(settled.checkpoint.status, 'complete');
        assert.equal(settled.checkpoint.nextStep, '');
        assert.equal(Object.keys(settled.profiles).length, 1);
      } finally { await page.close(); }
    });

    await t.test('a concurrent manual MVU recheck owns the barrier until its current diagnosis finishes', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowDiagnosis: true });
        const assistant = '白露：这一楼已有完整检查点，但当前手动复检还没有返回。';
        await page.evaluate((text) => {
          window.__setChat([
            { is_user: true, mes: '请重新检查这一楼。' },
            { is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text] },
          ]);
          window.__manualDiagnosisFinished = false;
          window.__manualDiagnosisValue = null;
          window.__manualDiagnosisError = '';
          window.MVUDoctorProfileEngine.runDiagnosis().then(
            (value) => { window.__manualDiagnosisValue = value; window.__manualDiagnosisFinished = true; },
            (error) => { window.__manualDiagnosisError = error?.message || String(error); window.__manualDiagnosisFinished = true; },
          );
        }, assistant);
        await page.waitForFunction(() => window.__diagnosisPending()
          && window.MVUDoctorProfileEngine.getRuntime().pipelineBusy
          && window.MVUDoctorProfileEngine.getRuntime().manualDiagnosisBinding?.token > 0);
        await page.evaluate(() => {
          window.__manualBarrierReceipt = null;
          window.MVUDoctorProfileEngine.waitForWorldDiagnosis({
            aiMsg: window.__context.chat.at(-1).mes,
          }).then((receipt) => { window.__manualBarrierReceipt = receipt; });
        });
        await page.waitForTimeout(250);
        const pending = await page.evaluate(() => ({
          receipt: window.__manualBarrierReceipt,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.equal(pending.receipt, null, 'an older complete checkpoint must not satisfy a live manual diagnosis');
        assert.equal(pending.checkpoint.status, 'complete');
        assert.equal(pending.checkpoint.nextStep, '');
        assert.equal(pending.checkpoint.target.generationKey, pending.runtime.manualDiagnosisBinding.generationKey);
        assert.equal(pending.runtime.pipelineBusy, true);

        await page.evaluate(() => window.__resolveDiagnosis('<JSONPatch>[]</JSONPatch>'));
        await page.waitForFunction(() => window.__manualDiagnosisFinished && window.__manualBarrierReceipt);
        const settled = await page.evaluate(() => ({
          receipt: window.__manualBarrierReceipt,
          value: window.__manualDiagnosisValue,
          error: window.__manualDiagnosisError,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
        }));
        assert.equal(settled.error, '');
        assert.equal(settled.value.status, 'nochange');
        assert.deepEqual(settled.receipt, { ok: true, status: 'diagnosis-complete' });
        assert.equal(settled.runtime.manualDiagnosisBinding, null);
        assert.equal(settled.runtime.pipelineBusy, false);
      } finally { await page.close(); }
    });

    await t.test('editing the triggering user row while diagnosis is in flight discards the stale evidence', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowDiagnosis: true });
        await runAcceptedReply(page);
        await page.waitForFunction(() => window.__diagnosisPending());
        await page.evaluate(() => {
          window.__context.chat[0].mes = '诊断发出后被编辑的另一条用户输入。';
        });
        await page.evaluate(() => window.__resolveDiagnosis('<JSONPatch>[]</JSONPatch>'));
        await waitForSettled(page, 'discarded');
        const evidence = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          stages: window.__stages,
        }));
        assert.equal(evidence.result.status, 'stale');
        assert.equal(evidence.result.errorCode, 'stale_accepted_target');
        assert.match(evidence.result.error, /触发用户输入已变化/u);
        assert.deepEqual(evidence.stages, ['diagnosis']);
      } finally { await page.close(); }
    });

    await t.test('changing the previous assistant MVU snapshot while diagnosis is in flight discards the stale evidence', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowDiagnosis: true });
        await page.evaluate(() => {
          const clone = (value) => structuredClone(value);
          const states = new Map([
            [0, { stat_data: { 测试状态: { 属性: 5 } } }],
            [2, { stat_data: { 测试状态: { 属性: 7 } } }],
          ]);
          const internals = window.StoryOracleAPI.unsafe.eval('get doctor test internals');
          internals.getMvu = async () => ({
            async getMvuData(request) {
              return clone(states.get(Number(request?.message_id)) || null);
            },
            async parseMessage(_block, oldData) { return clone(oldData); },
            async replaceMvuData(next, request) { states.set(Number(request?.message_id), clone(next)); },
          });
          window.__changePreviousMvu = () => states.set(0, { stat_data: { 测试状态: { 属性: 6 } } });
        });
        await runAcceptedReplyInTauriOrder(page);
        await page.waitForFunction(() => window.__diagnosisPending());
        await page.evaluate(() => window.__changePreviousMvu());
        await page.evaluate(() => window.__resolveDiagnosis('<JSONPatch>[]</JSONPatch>'));
        await waitForSettled(page, 'discarded');
        const evidence = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          stages: window.__stages,
        }));
        assert.equal(evidence.result.status, 'stale');
        assert.equal(evidence.result.errorCode, 'stale_accepted_target');
        assert.match(evidence.result.error, /更新前MVU证据已变化/u);
        assert.deepEqual(evidence.stages, ['diagnosis']);
      } finally { await page.close(); }
    });

    await t.test('an older overlapping manual recheck cannot clear the newer recheck binding', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowDiagnosis: true });
        await page.evaluate(() => {
          const assistant = '白露：两次手动复检并发时，后一次事务必须保持所有权。';
          window.__setChat([
            { is_user: true, mes: '连续复检。' },
            { is_user: false, is_system: false, mes: assistant, swipe_id: 0, swipes: [assistant] },
          ]);
          window.__firstManualFinished = false;
          window.__firstManualError = '';
          window.MVUDoctorProfileEngine.runDiagnosis().then(
            () => { window.__firstManualFinished = true; },
            (error) => { window.__firstManualError = error?.message || String(error); window.__firstManualFinished = true; },
          );
        });
        await page.waitForFunction(() => window.__diagnosisPendingCount() === 1
          && window.MVUDoctorProfileEngine.getRuntime().manualDiagnosisBinding?.token > 0);
        const firstToken = await page.evaluate(() => window.MVUDoctorProfileEngine.getRuntime().manualDiagnosisBinding.token);

        await page.evaluate(() => {
          window.__secondManualFinished = false;
          window.__secondManualError = '';
          window.MVUDoctorProfileEngine.runDiagnosis().then(
            () => { window.__secondManualFinished = true; },
            (error) => { window.__secondManualError = error?.message || String(error); window.__secondManualFinished = true; },
          );
        });
        await page.waitForFunction((oldToken) => window.__diagnosisPendingCount() === 2
          && window.MVUDoctorProfileEngine.getRuntime().manualDiagnosisBinding?.token > oldToken, firstToken);
        const secondToken = await page.evaluate(() => window.MVUDoctorProfileEngine.getRuntime().manualDiagnosisBinding.token);

        await page.evaluate(() => window.__resolveDiagnosis('<JSONPatch>[]</JSONPatch>'));
        await page.waitForFunction(() => window.__firstManualFinished);
        const afterOldFinally = await page.evaluate(() => ({
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          pending: window.__diagnosisPendingCount(),
          firstError: window.__firstManualError,
        }));
        assert.ok(afterOldFinally.firstError, 'the superseded manual run should finish as a stale task');
        assert.equal(afterOldFinally.runtime.manualDiagnosisBinding.token, secondToken);
        assert.equal(afterOldFinally.runtime.pipelineBusy, true);
        assert.equal(afterOldFinally.pending, 1);

        await page.evaluate(() => window.__resolveDiagnosis('<JSONPatch>[]</JSONPatch>'));
        await page.waitForFunction(() => window.__secondManualFinished);
        const final = await page.evaluate(() => ({
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          pending: window.__diagnosisPendingCount(),
          secondError: window.__secondManualError,
        }));
        assert.equal(final.secondError, '');
        assert.equal(final.runtime.manualDiagnosisBinding, null);
        assert.equal(final.runtime.pipelineBusy, false);
        assert.equal(final.pending, 0);
      } finally { await page.close(); }
    });

    await t.test('diagnosis barrier releases on failed and cancelled checkpoints without hanging', async () => {
      const failedPage = await browser.newPage({ viewport: { width: 900, height: 760 } });
      const cancelledPage = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(failedPage, { diagnosisReply: '无法识别的诊断文本' });
        await runAcceptedReply(failedPage);
        await failedPage.evaluate(() => {
          window.__diagnosisBarrierReceipt = null;
          window.MVUDoctorProfileEngine.waitForWorldDiagnosis({
            aiMsg: window.__context.chat.at(-1).mes,
          }).then((receipt) => { window.__diagnosisBarrierReceipt = receipt; });
        });
        await failedPage.waitForFunction(() => window.__diagnosisBarrierReceipt
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'failed');
        const failed = await failedPage.evaluate(() => ({
          receipt: window.__diagnosisBarrierReceipt,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.deepEqual(failed.receipt, { ok: false, status: 'diagnosis-failed' });
        assert.equal(failed.checkpoint.status, 'failed');
        assert.equal(failed.checkpoint.nextStep, 'diagnosis');

        await installHarness(cancelledPage, { slowDiagnosis: true });
        await runAcceptedReply(cancelledPage);
        await cancelledPage.evaluate(() => {
          window.__diagnosisBarrierReceipt = null;
          window.MVUDoctorProfileEngine.waitForWorldDiagnosis({
            aiMsg: window.__context.chat.at(-1).mes,
          }).then((receipt) => { window.__diagnosisBarrierReceipt = receipt; });
        });
        await cancelledPage.waitForFunction(() => window.__diagnosisPending()
          && window.MVUDoctorProfileEngine.getRuntime().phase === 'diagnosing');
        await cancelledPage.evaluate(() => window.MVUDoctorProfileEngine.cancel());
        await cancelledPage.waitForFunction(() => window.__diagnosisBarrierReceipt);
        const cancelled = await cancelledPage.evaluate(() => ({
          receipt: window.__diagnosisBarrierReceipt,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.equal(cancelled.checkpoint.status, 'cancelled');
        assert.notEqual(cancelled.receipt.status, 'stale');
        assert.notEqual(cancelled.receipt.status, 'timeout');
        await cancelledPage.evaluate(() => window.__resolveDiagnosis('<JSONPatch>[]</JSONPatch>'));
      } finally {
        await failedPage.close();
        await cancelledPage.close();
      }
    });

    await t.test('same-floor old generation keys never satisfy the barrier and missing handoffs are bounded', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const assistant = '白露：相同可见正文仍必须由本次generationKey拥有。';
        const active = await startReceivedTicketWithoutEnd(page, assistant);
        const evidence = await page.evaluate(async () => {
          const key = 'mvuDoctorReferencePipeline:chat-a';
          const assistantText = window.__context.chat[1].mes;
          const target = {
            chatId: 'chat-a', index: 1, swipeId: 0, content: assistantText,
            generationKey: 'chat-a:old-generation-key',
          };
          const run = async (withOldCheckpoint) => {
            if (withOldCheckpoint) localStorage.setItem(key, JSON.stringify({
              status: 'complete', nextStep: '', target,
            }));
            else localStorage.removeItem(key);
            const started = performance.now();
            const receipt = await Promise.race([
              window.MVUDoctorProfileEngine.waitForWorldDiagnosis({ aiMsg: assistantText }),
              new Promise((resolve) => setTimeout(() => resolve({ status: 'timeout' }), 2800)),
            ]);
            return { receipt, elapsed: performance.now() - started };
          };
          return { oldKey: await run(true), missing: await run(false) };
        }, active);
        assert.equal(active.receivedMessageId, 1);
        assert.ok(active.generationKey);
        assert.equal(evidence.oldKey.receipt.status, 'diagnosis-handoff-missing');
        assert.equal(evidence.missing.receipt.status, 'diagnosis-handoff-missing');
        assert.notEqual(evidence.oldKey.receipt.status, 'diagnosis-complete');
        assert.ok(evidence.oldKey.elapsed < 2800, JSON.stringify(evidence.oldKey));
        assert.ok(evidence.missing.elapsed < 2800, JSON.stringify(evidence.missing));
      } finally { await page.close(); }
    });

    await t.test('diagnosis barrier returns stale when its chat or swipe binding changes', async () => {
      const swipePage = await browser.newPage({ viewport: { width: 900, height: 760 } });
      const chatPage = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const original = '白露：这是屏障绑定的原回复。';
        const replacement = '白露：这是另一个swipe。';
        await installHarness(swipePage);
        const swipeTicket = await startReceivedTicketWithoutEnd(swipePage, original);
        const swipe = await swipePage.evaluate(async ({ ticket, oldText, newText }) => {
          localStorage.setItem('mvuDoctorReferencePipeline:chat-a', JSON.stringify({
            status: 'running', nextStep: 'diagnosis',
            target: { chatId: 'chat-a', index: 1, swipeId: 0, content: oldText, generationKey: ticket.generationKey },
          }));
          const gate = window.MVUDoctorProfileEngine.waitForWorldDiagnosis({ aiMsg: oldText });
          setTimeout(() => {
            const message = window.__context.chat[1];
            message.swipe_id = 1;
            message.swipes = [oldText, newText];
            message.mes = newText;
          }, 30);
          return Promise.race([gate, new Promise((resolve) => setTimeout(() => resolve({ status: 'timeout' }), 1200))]);
        }, { ticket: swipeTicket, oldText: original, newText: replacement });

        await installHarness(chatPage);
        const chatTicket = await startReceivedTicketWithoutEnd(chatPage, original);
        const chat = await chatPage.evaluate(async ({ ticket, text }) => {
          localStorage.setItem('mvuDoctorReferencePipeline:chat-a', JSON.stringify({
            status: 'running', nextStep: 'diagnosis',
            target: { chatId: 'chat-a', index: 1, swipeId: 0, content: text, generationKey: ticket.generationKey },
          }));
          const gate = window.MVUDoctorProfileEngine.waitForWorldDiagnosis({ aiMsg: text });
          setTimeout(() => { void window.__switchChat('chat-b'); }, 30);
          return Promise.race([gate, new Promise((resolve) => setTimeout(() => resolve({ status: 'timeout' }), 1200))]);
        }, { ticket: chatTicket, text: original });
        assert.equal(swipe.status, 'stale');
        assert.equal(chat.status, 'stale');
      } finally {
        await swipePage.close();
        await chatPage.close();
      }
    });

    await t.test('wrapped and sentence-final placeholders trigger the existing one-shot profile repair before commit', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const placeholderProfile = structuredClone(completeProfile);
        placeholderProfile.identity.occupation = '职业为“未知”';
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'profile']);
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'profile', 'profile-repair']);
        assert.equal(evidence.result.profile.modelCalls, 3);
        assert.equal(evidence.result.profile.repaired, true);
        const initialErrors = evidence.result.profile.initialErrors.join('；');
        assert.match(initialErrors, /identity\.occupation/u);
        assert.match(initialErrors, /currentState\.location/u);
        assert.match(initialErrors, /currentState\.emotion/u);
        assert.match(initialErrors, /resources\[0\]/u);
        assert.doesNotMatch(serialized, /未知|不详|待定|未登记|未设定|暂无|正文未提及/u);
        assert.equal(Object.keys(evidence.profiles).length, 1);
        assert.equal(evidence.profileWrites.length, 1);
      } finally { await page.close(); }
    });

    await t.test('a substantive occupation may describe an unknown object without being rejected as a placeholder', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const contextualProfile = structuredClone(completeProfile);
        contextualProfile.identity.occupation = '负责追查未知来源信号的前线侦察员';
        await installHarness(page, {
          profileReplies: [profileEnvelope(contextualProfile)],
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          profileWrites: window.__profileStoreWrites(),
          modelCalls: window.__modelCalls,
        }));
        const [stored] = Object.values(evidence.profiles);
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'profile']);
        assert.equal(evidence.result.profile.modelCalls, 2);
        assert.equal(evidence.result.profile.repaired, false);
        assert.equal(stored.identity.occupation, contextualProfile.identity.occupation);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.result.profile.modelCalls, 3);
        assert.equal(evidence.result.profile.repaired, true);
        assert.match(evidence.result.profile.initialErrors.join('；'), /人物发现/u);
        assert.equal(Object.keys(evidence.profiles).length, 1);
      } finally { await page.close(); }
    });

    await t.test('a discovered canonical name not present in the accepted reply is repaired to its visible stable name', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          discoveryReplies: [discoveryEnvelope(['露医生']), discoveryEnvelope(['白露'])],
          profileReplies: [profileEnvelope()],
        });
        await runAcceptedReply(page, '白露收起药囊，示意队伍继续向前。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          modelCalls: window.__modelCalls,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
        }));
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'discovery-repair', 'profile']);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.result.profile.modelCalls, 3);
        assert.equal(evidence.result.profile.repaired, true);
        assert.match(evidence.result.profile.initialErrors.join('；'), /没有使用最终正文逐字出现/u);
        assert.match(evidence.modelCalls[1].prompt, /每个detectedCharacters项目必须逐字出现在最终正文/u);
        assert.equal(Object.keys(evidence.profiles).length, 1);
      } finally { await page.close(); }
    });

    await t.test('an unbound discovered name cannot be repaired away as an empty no-character turn', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          discoveryReplies: [
            discoveryEnvelope(['露医生']),
            discoveryEnvelope([], '本轮没有需要记录的非玩家人物。'),
          ],
          profileReplies: [profileEnvelope()],
        });
        await runAcceptedReply(page, '白露收起药囊，示意队伍继续向前。');
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          modelCalls: window.__modelCalls,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          world: window.WORLD_ENGINE_CORE.loadState(),
        }));
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'discovery-repair']);
        assert.deepEqual(evidence.stages, ['diagnosis']);
        assert.equal(evidence.result.failedStep, 'profile');
        assert.match(evidence.result.error, /不能把初次报告的1个人物缩减为0个/u);
        assert.match(evidence.modelCalls[1].prompt, /不得删除人物、缩减人数、返回空数组/u);
        assert.equal(Object.keys(evidence.profiles).length, 0);
        assert.equal(Number(evidence.world.round || 0), 0);
      } finally { await page.close(); }
    });

    await t.test('a multi-character binding repair cannot silently drop only the unbound person', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          discoveryReplies: [
            discoveryEnvelope(['白露', '露医生']),
            discoveryEnvelope(['白露']),
          ],
          profileReplies: [profileEnvelope()],
        });
        await runAcceptedReply(page, '白露收起药囊；银狼则把纸片藏进袖口。');
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          modelCalls: window.__modelCalls,
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          world: window.WORLD_ENGINE_CORE.loadState(),
        }));
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'discovery-repair']);
        assert.deepEqual(evidence.stages, ['diagnosis']);
        assert.equal(evidence.result.failedStep, 'profile');
        assert.match(evidence.result.error, /不能把初次报告的2个人物缩减为1个/u);
        assert.match(evidence.modelCalls[1].prompt, /至少返回2个不同称谓/u);
        assert.equal(Object.keys(evidence.profiles).length, 0);
        assert.equal(Number(evidence.world.round || 0), 0);
      } finally { await page.close(); }
    });

    await t.test('an unrecoverable profile discovery fails without touching independent native World', async () => {
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
          manualWorldCalls: window.__worldCalls,
          worldAbortCalls: window.__worldAbortCalls,
          worldStateWrites: window.__worldStateWrites,
          worldContract: {
            manualEvolve: typeof window.WORLD_ENGINE?.manualEvolve,
            loadState: typeof window.WORLD_ENGINE_CORE?.loadState,
            showPanel: typeof window.WORLD_ENGINE_UI?.showPanel,
          },
        }));
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'discovery-repair']);
        assert.deepEqual(evidence.stages, ['diagnosis']);
        assert.equal(evidence.result.failedStep, 'profile');
        assert.match(evidence.result.error, /人物发现单次修复后仍不可用/u);
        assert.equal(Object.keys(evidence.profiles).length, 0);
        assert.deepEqual(evidence.manualWorldCalls, []);
        assert.equal(evidence.worldAbortCalls, 0);
        assert.deepEqual(evidence.worldStateWrites, []);
        assert.deepEqual(evidence.worldContract, {
          manualEvolve: 'function', loadState: 'function', showPanel: 'function',
        });
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.runtime.lastResult.ok, true);
        assert.equal(evidence.worldCalls.length, 0);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.runtime.lastResult.ok, true);
        assert.equal(evidence.worldCalls.length, 0);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.calls, 0);
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
        assert.deepEqual(beforeLateEnd.stages, ['diagnosis', 'profile']);
        assert.equal(beforeLateEnd.worldCalls, 0);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.calls, 0);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.calls, 0);
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

    await t.test('a newer ended ticket supersedes an older failed Doctor checkpoint after reload', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          discoveryReplies: ['旧任务无法解析', '旧任务修复后仍无法解析', discoveryEnvelope()],
        });
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'diagnosis', 'profile']);
        assert.equal(evidence.calls, 0);
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
        assert.deepEqual(after.stages, ['diagnosis', 'profile']);
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

    await t.test('a nonempty Story Oracle patch with no MVU effect stays visible as an unverified warning', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { diagnosisReply: '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":10}]</JSONPatch></UpdateVariable>' });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.result.status, 'complete_with_warning');
        assert.equal(evidence.result.diagnosis.status, 'unverified');
        assert.equal(evidence.result.diagnosis.applicationComplete, false);
        await page.evaluate(() => window.__emit('chat_loaded'));
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().lastResult?.recoveredFromCheckpoint === true);
        const restored = await page.evaluate(() => window.MVUDoctorProfileEngine.getRuntime().lastResult);
        assert.equal(restored.status, 'complete_with_warning');
        assert.equal(restored.diagnosis.status, 'unverified');
        assert.equal(restored.diagnosis.recoveredFromCheckpoint, true);
      } finally { await page.close(); }
    });

    await t.test('a cancelled checkpoint with an empty next step remains cancelled after reload', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        await page.evaluate(async () => {
          const key = 'mvuDoctorReferencePipeline:chat-a';
          const checkpoint = JSON.parse(localStorage.getItem(key));
          localStorage.setItem(key, JSON.stringify({
            ...checkpoint, status: 'cancelled', nextStep: '', cancelledAt: new Date().toISOString(),
          }));
          await window.__emit('chat_loaded');
        });
        await waitForSettled(page, 'cancelled');
        const runtime = await page.evaluate(() => window.MVUDoctorProfileEngine.getRuntime());
        assert.equal(runtime.phase, 'cancelled');
        assert.equal(runtime.lastResult, null);
      } finally { await page.close(); }
    });

    await t.test('diagnosis restores the five-part evidence packet and applies a residual fix to the current post-state', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '<UpdateVariable><Analysis>当前值7距离本轮明确目标12仍差5。</Analysis><JSONPatch>[{"op":"delta","path":"/测试状态/属性","value":5}]</JSONPatch></UpdateVariable>',
        });
        await page.evaluate(async () => {
          const clone = (value) => structuredClone(value);
          const states = new Map([
            [0, { stat_data: { 测试状态: { 属性: 5 } } }],
            [1, { display_data: { 测试状态: { 属性: 999 } } }],
            [3, { stat_data: { 测试状态: { 属性: 7 } } }],
          ]);
          const internals = window.StoryOracleAPI.unsafe.eval('get doctor test internals');
          internals.getMvu = async () => ({
            async getMvuData(request) {
              window.__mvuReads.push(clone(request));
              const id = Number(request?.message_id);
              return states.has(id) ? clone(states.get(id)) : null;
            },
            async parseMessage(block, oldData) {
              const next = clone(oldData);
              const patchText = String(block).match(/<JSONPatch\b[^>]*>([\s\S]*?)<\/JSONPatch>/iu)?.[1] || '[]';
              const operations = JSON.parse(patchText);
              for (const operation of operations) {
                const parts = String(operation.path || '').split('/').slice(1);
                let parent = next.stat_data;
                for (const part of parts.slice(0, -1)) parent = parent[part];
                const key = parts.at(-1);
                if (operation.op === 'delta') parent[key] += Number(operation.value || 0);
                else if (operation.op === 'replace') parent[key] = clone(operation.value);
              }
              return next;
            },
            async replaceMvuData(next, request) {
              states.set(Number(request?.message_id), clone(next));
            },
          });
          window.__semanticState = (id) => clone(states.get(Number(id)) || null);
          const prior = '上一回合的测试状态仍是旧默认值5。';
          const displayOnly = '这一楼只有显示缓存，不能成为变量前态。';
          const user = '本回合把初始值明确设为10，并获得2点奖励。';
          const assistant = '白露确认初始值10，奖励生效后最终值应为12。\n<UpdateVariable><Analysis>只记录奖励。</Analysis><JSONPatch>[{"op":"delta","path":"/测试状态/属性","value":2}]</JSONPatch></UpdateVariable>';
          window.__setChat([
            { is_user: false, is_system: false, mes: prior, swipe_id: 0, swipes: [prior] },
            { is_user: false, is_system: false, mes: displayOnly, swipe_id: 0, swipes: [displayOnly] },
            { is_user: true, is_system: false, mes: user },
          ]);
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          window.__append({ is_user: false, is_system: false, mes: assistant, swipe_id: 0, swipes: [assistant] });
          await window.__emit('message_received', 3, 'normal');
          await window.__emit('generation_ended');
        });
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => {
          const request = window.__diagnosisRequests.at(-1) || [];
          const systemMessage = String(request.find((message) => message.role === 'system')?.content || '');
          const userMessage = String(request.find((message) => message.role === 'user')?.content || '');
          return {
            systemMessage,
            userMessage,
            current: window.__semanticState(3),
            pre: window.__semanticState(0),
            notifications: structuredClone(window.__storyNotifications),
            result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          };
        });
        assert.match(evidence.systemMessage, /^diagnose the accepted final/u, 'Story Oracle remains the base diagnostic prompt');
        assert.match(evidence.systemMessage, /current post-update 只是原更新落地后的观测结果/u);
        for (const evidenceTag of ['pre_update_stat_data', 'current_post_update_stat_data', 'original_update_block', 'triggering_user_input', 'accepted_narrative']) {
          assert.match(evidence.userMessage, new RegExp(`<${evidenceTag}>`));
        }
        assert.match(evidence.userMessage, /本回合把初始值明确设为10，并获得2点奖励/u);
        assert.match(evidence.userMessage, /白露确认初始值10，奖励生效后最终值应为12/u);
        assert.match(evidence.userMessage, /【核对顺序】/u);
        assert.equal(evidence.pre.stat_data.测试状态.属性, 5);
        assert.equal(evidence.current.stat_data.测试状态.属性, 12, 'the correction is residual against post-state, not a replay of the old delta');
        assert.equal(evidence.result.diagnosis.status, 'applied');
        assert.equal(evidence.result.diagnosis.semanticProof, false);
        assert.deepEqual(evidence.notifications.map((entry) => entry.status), ['applied']);
      } finally { await page.close(); }
    });

    await t.test('diagnosis without an inline update treats current state as the unapplied starting point', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>',
        });
        await runAcceptedReply(page, '白露看了一眼窗外，本轮没有发生需要写入变量的变化。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => {
          const request = window.__diagnosisRequests.at(-1) || [];
          return {
            systemMessage: String(request.find((message) => message.role === 'system')?.content || ''),
            userMessage: String(request.find((message) => message.role === 'user')?.content || ''),
          };
        });
        assert.match(evidence.systemMessage, /^diagnose the accepted final/u);
        assert.match(evidence.systemMessage, /current pre-update 是本轮尚未写入变化时的起点/u);
        assert.match(evidence.userMessage, /<current_pre_update_stat_data>/u);
        assert.doesNotMatch(evidence.userMessage, /<current_post_update_stat_data>/u);
        assert.match(evidence.userMessage, /<accepted_narrative>[\s\S]*本轮没有发生需要写入变量的变化/u);
      } finally { await page.close(); }
    });

    await t.test('official MVU alone applies array inserts, rounded deltas, dates, and described values', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '<UpdateVariable><JSONPatch>['
            + '{"op":"delta","path":"/测试状态/浮点","value":0.2},'
            + '{"op":"delta","path":"/测试状态/浮点","value":0.3},'
            + '{"op":"delta","path":"/测试状态/时间","value":60000},'
            + '{"op":"delta","path":"/测试状态/说明值","value":3},'
            + '{"op":"insert","path":"/测试状态/列表/-","value":"b"},'
            + '{"op":"insert","path":"/测试状态/列表/-","value":"c"},'
            + '{"op":"insert","path":"/测试状态/队列/1","value":"y"},'
            + '{"op":"insert","path":"/测试状态/队列/-","value":"w"}'
            + ']</JSONPatch></UpdateVariable>',
        });
        await page.evaluate(() => {
          const clone = (value) => structuredClone(value);
          const states = new Map([[1, { stat_data: { 测试状态: {
            浮点: 0.1,
            时间: '2026-09-04T00:00:00.000Z',
            说明值: [2, '说明保持不变'],
            列表: ['a'],
            队列: ['x', 'z'],
          } } }]]);
          const internals = window.StoryOracleAPI.unsafe.eval('get doctor test internals');
          internals.getMvu = async () => ({
            async getMvuData(request) {
              return clone(states.get(Number(request?.message_id)) || null);
            },
            async parseMessage(block, oldData) {
              const next = clone(oldData);
              const patchText = String(block).match(/<JSONPatch\b[^>]*>([\s\S]*?)<\/JSONPatch>/iu)?.[1] || '[]';
              for (const operation of JSON.parse(patchText)) {
                const parts = String(operation.path || '').split('/').slice(1);
                let parent = next.stat_data;
                for (const part of parts.slice(0, -1)) parent = parent[part];
                const key = parts.at(-1);
                if (operation.op === 'insert') {
                  const index = key === '-' ? parent.length : Number(key);
                  parent.splice(index, 0, clone(operation.value));
                  continue;
                }
                if (operation.op !== 'delta') continue;
                const current = parent[key];
                const wrapped = Array.isArray(current) && current.length === 2 && typeof current[1] === 'string';
                const base = wrapped ? current[0] : current;
                let updated;
                if (typeof base === 'string') updated = new Date(new Date(base).getTime() + operation.value).toISOString();
                else updated = parseFloat((base + operation.value).toPrecision(12));
                if (wrapped) current[0] = updated;
                else parent[key] = updated;
              }
              return next;
            },
            async replaceMvuData(next, request) {
              states.set(Number(request?.message_id), clone(next));
            },
          });
          window.__officialMvuState = () => clone(states.get(1));
        });
        await runAcceptedReply(page, '白露整理完物品，时间与记录随本轮行动更新。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          state: window.__officialMvuState(),
          diagnosis: window.MVUDoctorProfileEngine.getRuntime().lastResult.diagnosis,
        }));
        assert.equal(evidence.diagnosis.status, 'applied');
        assert.equal(evidence.diagnosis.applicationComplete, true);
        assert.deepEqual(evidence.diagnosis.unresolved, []);
        assert.equal(evidence.state.stat_data.测试状态.浮点, 0.6);
        assert.equal(evidence.state.stat_data.测试状态.时间, '2026-09-04T00:01:00.000Z');
        assert.deepEqual(evidence.state.stat_data.测试状态.说明值, [5, '说明保持不变']);
        assert.deepEqual(evidence.state.stat_data.测试状态.列表, ['a', 'b', 'c']);
        assert.deepEqual(evidence.state.stat_data.测试状态.队列, ['x', 'y', 'z', 'w']);
      } finally { await page.close(); }
    });

    await t.test('an already-normalized object insert is not reinterpreted by a shadow patch engine', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          initialMvuState: { stat_data: { 契约者: { 背包: { 新手短刃: { 名称: '新手短刃', 倍率: 1, 模板补全: '由官方MVU schema规范化' } } } } },
          diagnosisReply: '<UpdateVariable><Analysis>倍率已经是整数1，不需要改变其他字段。</Analysis><JSONPatch>[{"op":"replace","path":"/契约者/背包/新手短刃/倍率","value":1}]</JSONPatch></UpdateVariable>',
        });
        await page.evaluate(() => {
          const clone = (value) => structuredClone(value);
          const states = new Map([[1, { stat_data: { 契约者: { 背包: { 新手短刃: {
            名称: '新手短刃', 倍率: 1, 模板补全: '由官方MVU schema规范化',
          } } } } }]]);
          let parseCount = 0;
          let replaceCount = 0;
          const internals = window.StoryOracleAPI.unsafe.eval('get doctor test internals');
          internals.getMvu = async () => ({
            async getMvuData(request) {
              return clone(states.get(Number(request?.message_id)) || null);
            },
            async parseMessage(block, oldData) {
              parseCount += 1;
              return clone(oldData);
            },
            async replaceMvuData(next, request) {
              replaceCount += 1;
              states.set(Number(request?.message_id), clone(next));
            },
          });
          window.__normalizedInsertEvidence = () => ({
            state: clone(states.get(1)), parseCount, replaceCount,
          });
        });
        await runAcceptedReply(page, '白露确认行囊里已经出现新手短刃。\n<UpdateVariable><Analysis>把新手短刃加入对象背包，schema随后补齐模板字段。</Analysis><JSONPatch>[{"op":"insert","path":"/契约者/背包/新手短刃","value":{"名称":"新手短刃","倍率":1.0}}]</JSONPatch></UpdateVariable>');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          official: window.__normalizedInsertEvidence(),
          stages: [...window.__stages],
        }));
        assert.equal(evidence.result.status, 'complete_with_warning');
        assert.equal(evidence.result.diagnosis.status, 'unverified');
        assert.equal(evidence.result.diagnosis.applicationComplete, false);
        assert.equal(evidence.result.diagnosis.canProceed, true);
        assert.equal(evidence.result.diagnosis.verificationMode, 'story-oracle-official-mvu');
        assert.equal(evidence.result.diagnosis.officialResult, 'parsed-equivalent');
        assert.deepEqual(evidence.result.diagnosis.operations, []);
        assert.deepEqual(evidence.result.diagnosis.unresolved, []);
        assert.equal(evidence.official.parseCount, 1, 'the correction must be parsed exactly once by official MVU');
        assert.equal(evidence.official.replaceCount, 0, 'an official no-op must remain zero-write');
        assert.equal(evidence.official.state.stat_data.契约者.背包.新手短刃.模板补全, '由官方MVU schema规范化');
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
      } finally { await page.close(); }
    });

    await t.test('Story Oracle wrapped empty JSONPatch is the original nochange success path', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>',
          mvuPatchMode: 'apply',
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          notifications: window.__storyNotifications,
          parseCalls: window.__mvuParseCalls,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.result.diagnosis.status, 'nochange');
        assert.equal(evidence.result.diagnosis.semanticProof, false);
        assert.match(evidence.result.diagnosis.verdict, /不是脚本对剧情语义的独立证明/u);
        assert.equal(evidence.parseCalls, 1, 'a wrapped empty result still traverses the single official MVU parser');
        assert.equal(evidence.result.diagnosis.mvu.hp, 10, 'an explicit empty result remains zero-write even if parsing normalizes a candidate');
        assert.deepEqual(evidence.notifications, [], 'model nochange must not invoke Story Oracle\'s misleading clean-success notifier');
      } finally { await page.close(); }
    });

    await t.test('display-only or empty wrapped state cannot masquerade as current stat_data', async () => {
      for (const invalidState of [{ display_data: { hp: 10 } }, { stat_data: {} }]) {
        const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
        try {
          await installHarness(page, { initialMvuState: invalidState });
          await runAcceptedReply(page);
          await waitForSettled(page, 'failed');
          const evidence = await page.evaluate(() => ({
            result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
            requests: window.__diagnosisRequests,
            stages: window.__stages,
          }));
          assert.equal(evidence.result.failedStep, 'diagnosis');
          assert.match(evidence.result.error, /没有可用的stat_data快照/u);
          assert.deepEqual(evidence.requests, []);
          assert.deepEqual(evidence.stages, []);
        } finally { await page.close(); }
      }
    });

    await t.test('a mechanism-only reply does not create a second duplicated diagnosis narrative packet', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>',
          discoveryReplies: [discoveryEnvelope([], '本轮没有叙事人物。')],
        });
        await runAcceptedReply(page, '<UpdateVariable><Analysis>只有机制更新。</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>');
        await waitForSettled(page, 'done');
        const request = await page.evaluate(() => {
          const request = window.__diagnosisRequests.at(-1) || [];
          return {
            systemMessage: String(request.find((message) => message.role === 'system')?.content || ''),
            userMessage: String(request.find((message) => message.role === 'user')?.content || ''),
          };
        });
        assert.match(request.systemMessage, /^diagnose the accepted final/u);
        assert.match(request.userMessage, /<accepted_narrative>[\s\S]*本楼没有可独立读取的叙事正文，只有变量机制区块/u);
        assert.equal((request.userMessage.match(/只有机制更新/gu) || []).length, 1, 'the mechanism block appears only in original_update_block, not duplicated as narrative');
      } finally { await page.close(); }
    });

    await t.test('host API error replies never become diagnosis or profile input, including manual retry', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page, '[API 错误]\n连接目标服务失败，请重试。\n<StatusPlaceHolderImpl/>');
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(async () => {
          const engine = window.MVUDoctorProfileEngine;
          const manual = [];
          for (const action of [engine.runDiagnosis, engine.runProfile]) {
            try { await action(); manual.push('unexpected-success'); }
            catch (error) { manual.push(error.code); }
          }
          return {
            result: engine.getRuntime().lastResult,
            busy: engine.getRuntime().pipelineBusy,
            stages: window.__stages,
            writes: window.__mvuWrites.length,
            profiles: Object.keys(engine.getStore().profiles || {}).length,
            manual,
            ticket: engine.getRuntime().acceptedGeneration,
            markers: ['[API错误]\n请求失败', '[API Error]\nRequest failed', '角色说：“[API 错误]只是屏幕提示。”', '请求失败的旅人回到了营地。']
              .map(engine.isHostErrorReply),
          };
        });
        assert.equal(evidence.result.failedStep, 'generation');
        assert.equal(evidence.result.errorCode, 'host_generation_error_reply');
        assert.equal(evidence.busy, false);
        assert.equal(evidence.ticket, null);
        assert.deepEqual(evidence.stages, []);
        assert.equal(evidence.writes, 0);
        assert.equal(evidence.profiles, 0);
        assert.deepEqual(evidence.manual, ['host_generation_error_reply', 'host_generation_error_reply']);
        assert.deepEqual(evidence.markers, [true, true, false, false]);
        await runNextAcceptedReply(page);
        await waitForSettled(page, 'done');
        assert.deepEqual(await page.evaluate(() => window.__stages), ['diagnosis', 'profile']);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'diagnosis', 'profile']);
        assert.equal(evidence.result.diagnosis.status, 'nochange');
        assert.equal(evidence.result.diagnosis.diagnosisAttempts.length, 2);
        assert.equal(evidence.result.diagnosis.diagnosisAttempts[0].kind, 'transport-error-content');
        assert.equal(evidence.result.diagnosis.diagnosisAttempts[1].kind, 'response');
      } finally { await page.close(); }
    });

    await t.test('two Story Oracle backend error envelopes fail before profile and leave native World untouched', async () => {
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
          manualWorldCalls: window.__worldCalls,
          worldAbortCalls: window.__worldAbortCalls,
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'diagnosis']);
        assert.equal(evidence.result.failedStep, 'diagnosis');
        assert.equal(evidence.result.errorCode, 'story_oracle_transport_error_response');
        assert.equal(evidence.result.diagnosisAttempts.length, 2);
        assert.deepEqual(evidence.manualWorldCalls, []);
        assert.equal(evidence.worldAbortCalls, 0);
      } finally { await page.close(); }
    });

    await t.test('an empty JSONPatch example outside the returned nonempty block is rejected as ambiguous', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '示例：<JSONPatch>[]</JSONPatch>\n实际：<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>',
          mvuPatchMode: 'apply',
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          parseCalls: window.__mvuParseCalls,
          writes: window.__mvuWrites.length,
          profileCalls: window.__modelCalls.filter((call) => call.kind === 'profile').length,
        }));
        assert.equal(evidence.result.failedStep, 'diagnosis');
        assert.equal(evidence.result.errorCode, 'story_oracle_ambiguous_jsonpatch');
        assert.equal(evidence.parseCalls, 0, 'an ambiguous full response must not reach official MVU parsing');
        assert.equal(evidence.writes, 0, 'an ambiguous full response must not write MVU state');
        assert.equal(evidence.profileCalls, 0, 'an ambiguous diagnosis must not advance to profile generation');
      } finally { await page.close(); }
    });

    await t.test('an empty JSONPatch example inside the selected envelope cannot hide a second patch', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '<UpdateVariable><Analysis>空结果示例：<JSONPatch>[]</JSONPatch></Analysis><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>',
          mvuPatchMode: 'apply',
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          stages: window.__stages,
        }));
        assert.equal(evidence.result.failedStep, 'diagnosis');
        assert.equal(evidence.result.errorCode, 'story_oracle_ambiguous_jsonpatch');
        assert.deepEqual(evidence.stages, ['diagnosis']);
      } finally { await page.close(); }
    });

    await t.test('a second complete or truncated UpdateVariable cannot hide behind the first empty envelope', async () => {
      for (const suffix of [
        '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>',
        '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]',
      ]) {
        const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
        try {
          await installHarness(page, {
            diagnosisReply: `<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>${suffix}`,
          });
          await runAcceptedReply(page);
          await waitForSettled(page, 'failed');
          const result = await page.evaluate(() => window.MVUDoctorProfileEngine.getRuntime().lastResult);
          assert.equal(result.failedStep, 'diagnosis');
          assert.equal(result.errorCode, 'story_oracle_ambiguous_update_envelope');
        } finally { await page.close(); }
      }
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
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'done'
          && window.__modelCalls.filter((call) => call.kind === 'profile').length === 2);
        const rerolled = await page.evaluate((promptStart) => ({
          prompts: window.__profilePrompts.slice(promptStart),
          store: window.MVUDoctorProfileEngine.getStore(),
          modelCalls: window.__modelCalls.slice(promptStart),
          manualWorldCalls: window.__worldCalls,
        }), first.promptCount);
        assert.doesNotMatch(JSON.stringify(rerolled.prompts), /OLD_SWIPE_PROFILE_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(rerolled.store.profiles), /OLD_SWIPE_PROFILE_SENTINEL/u);
        assert.match(JSON.stringify(rerolled.store.profiles), /NEW_SWIPE_PROFILE_SENTINEL/u);
        assert.deepEqual(rerolled.manualWorldCalls, []);

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
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'done'
          && window.__modelCalls.filter((call) => call.kind === 'profile').length === 2);

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
          prompts: window.__profilePrompts.length,
        }));
        assert.equal(blocked.prompts, promptStart);

        await page.evaluate(() => window.__resolveDurableWrite());
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'done'
          && window.__modelCalls.filter((call) => call.kind === 'profile').length === 3, null, { timeout: 8000 });
        const evidence = await page.evaluate((fromPrompt) => ({
          prompts: window.__profilePrompts.slice(fromPrompt),
          store: window.MVUDoctorProfileEngine.getStore(),
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          manualWorldCalls: window.__worldCalls,
        }), promptStart);
        const finalJson = JSON.stringify(evidence);
        assert.doesNotMatch(JSON.stringify(evidence.prompts), /DELAYED_OLD_BRANCH_SENTINEL|CURRENT_NEW_BRANCH_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(evidence.store.profiles), /DELAYED_OLD_BRANCH_SENTINEL|CURRENT_NEW_BRANCH_SENTINEL/u);
        assert.match(JSON.stringify(evidence.store.profiles), /FINAL_REROLL_BRANCH_SENTINEL/u);
        assert.deepEqual(evidence.manualWorldCalls, []);
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
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'done'
          && window.__modelCalls.filter((call) => call.kind === 'profile').length === 2);

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
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'done'
          && window.__modelCalls.filter((call) => call.kind === 'profile').length === 2);
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
          manualWorldCalls: window.__worldCalls,
        }), promptStart);
        assert.deepEqual(evidence.manualWorldCalls, []);
        assert.equal(evidence.prompts.length, 0);
        assert.match(`${evidence.runtime.detail}\n${JSON.stringify(evidence.runtime.lastResult)}`, /回滚.*持久化|rollback/iu);
        assert.match(JSON.stringify(evidence.store.profiles), /ROLLBACK_FAIL_NEW_SENTINEL/u);
        assert.doesNotMatch(JSON.stringify(evidence.store.profiles), /ROLLBACK_FAIL_OLD_SENTINEL/u);
      } finally { await page.close(); }
    });

    await t.test('automatic continue merges into the same normal Doctor ticket without driving World', async () => {
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
        assert.equal(evidence.calls.length, 0);
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'diagnosis', 'profile']);
        assert.equal(evidence.worldCalls.length, 0);
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
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'done'
          && window.MVUDoctorProfileEngine.getRuntime().lastResult?.generationType === 'swipe');
        const evidence = await page.evaluate(() => ({ calls: window.__worldCalls, result: window.MVUDoctorProfileEngine.getRuntime().lastResult }));
        assert.equal(evidence.calls.length, 0);
        assert.equal(evidence.result.world.status, 'native-independent');
        assert.equal(evidence.result.generationType, 'swipe');
      } finally { await page.close(); }
    });

    await t.test('a structured NPC id with empty profile output cannot be reported green', async () => {
      const empty = JSON.stringify({
        detectedCharacters: [], profiles: [],
        noProfileReason: '这一轮是纯环境描述，确实没有任何需要持续记录的非玩家人物。',
      });
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          discoveryReplies: [discoveryEnvelope(['NPC-7'])],
          profileReplies: [empty, empty],
        });
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
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
        assert.deepEqual(evidence.stages, ['diagnosis']);
        assert.deepEqual(evidence.result.profile.currentReplyCandidates, []);
        assert.deepEqual(evidence.result.profile.mvuInventoryCandidates, ['白露']);
        assert.deepEqual(evidence.result.profile.discoveredCandidates, []);
        assert.deepEqual(evidence.result.profile.completionCandidates, []);
        assert.equal(evidence.result.profile.modelCalls, 1);
        assert.match(evidence.result.profile.requestPrompt, /姓名消歧提示[^]*不能据此认定人物在本楼出现/u);
        assert.match(evidence.result.profile.requestPrompt, /姓名消歧提示[^]*白露/u);
        assert.equal(Object.keys(evidence.profiles).length, 0);
        assert.equal(evidence.result.world.status, 'native-independent');
        assert.equal(evidence.result.world.round, 0);
      } finally { await page.close(); }
    });

    await t.test('a single stable title binds the completed row before validation without a second identity list', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const generated = {
          ...structuredClone(completeProfile), name: '苏砚', aliases: [],
          evidence: ['最终正文只公开了稳定称谓“引导者”及其当前行动'],
          inferences: ['姓名“苏砚”是结合世界背景作出的可修订补全'],
        };
        await installHarness(page, {
          initialMvuState: { hp: 10 },
          discoveryReplies: [discoveryEnvelope(['引导者'])],
          profileReplies: [JSON.stringify({ detectedCharacters: ['错误的平行名单'], profiles: [generated] })],
        });
        await runAcceptedReply(page, '引导者收起名册，示意队伍继续向前。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          profiles: Object.values(window.MVUDoctorProfileEngine.getStore().profiles),
          modelCalls: window.__modelCalls,
          worldCalls: window.__worldCalls,
        }));
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'profile']);
        assert.equal(evidence.result.profile.repaired, false);
        assert.equal(evidence.profiles.length, 1);
        assert.equal(evidence.profiles[0].name, '引导者');
        assert.ok(evidence.profiles[0].aliases.includes('苏砚'));
        assert.equal(Object.hasOwn(evidence.profiles[0], 'rowId'), false);
        assert.equal(evidence.worldCalls.length, 0);
      } finally { await page.close(); }
    });

    await t.test('two target rows bind by exact rowId even when the model returns them out of order', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const sourceNames = ['引导者', '门卫'];
        const generatedNames = ['苏砚', '周衡'];
        const profiles = generatedNames.map((name) => ({
          ...structuredClone(completeProfile), name, aliases: [],
          evidence: [`正文中的稳定称谓与目标行由脚本绑定，${name}是补全姓名`],
          inferences: [`姓名${name}属于可修订补全`],
        }));
        await installHarness(page, {
          initialMvuState: { hp: 10 },
          discoveryReplies: [discoveryEnvelope(sourceNames)],
          profileReplies: [JSON.stringify({
            detectedCharacters: ['故意错误'],
            profiles: [{ ...profiles[1], rowId: 'P2' }, { ...profiles[0], rowId: 'P1' }],
          })],
        });
        await runAcceptedReply(page, '引导者翻开名册，门卫则留在门边检查通行凭据。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          profiles: Object.values(window.MVUDoctorProfileEngine.getStore().profiles),
          profileWrites: window.__profileStoreWrites(),
          worldCalls: window.__worldCalls,
        }));
        const guide = evidence.profiles.find((profile) => profile.name === '引导者');
        const guard = evidence.profiles.find((profile) => profile.name === '门卫');
        assert.equal(evidence.result.profile.modelCalls, 2);
        assert.equal(evidence.result.profile.repaired, false);
        assert.ok(guide.aliases.includes('苏砚'));
        assert.ok(guard.aliases.includes('周衡'));
        assert.equal(evidence.profileWrites.length, 1);
        assert.equal(evidence.worldCalls.length, 0);
      } finally { await page.close(); }
    });

    await t.test('ambiguous target rows use the existing one repair then fail atomically with complete evidence', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const initialProfiles = ['苏砚', '周衡'].map((name) => ({
          ...structuredClone(completeProfile), name, aliases: [],
          history: `INITIAL_ROW_BIND_SENTINEL ${name}`,
        }));
        const repairProfiles = [
          { ...structuredClone(completeProfile), name: '苏砚', rowId: 'P1', history: 'REPAIR_ROW_BIND_SENTINEL first' },
          { ...structuredClone(completeProfile), name: '重复行', rowId: 'P1', history: 'REPAIR_ROW_BIND_SENTINEL duplicate' },
          { ...structuredClone(completeProfile), name: '未知行', rowId: 'PX', history: 'REPAIR_ROW_BIND_SENTINEL unknown' },
        ];
        await installHarness(page, {
          initialMvuState: { hp: 10 },
          discoveryReplies: [discoveryEnvelope(['引导者', '门卫'])],
          profileReplies: [
            JSON.stringify({ profiles: initialProfiles }),
            JSON.stringify({ profiles: repairProfiles }),
          ],
        });
        await runAcceptedReply(page, '引导者核对路线，门卫在一旁检查门闩。');
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(() => ({
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          profiles: window.MVUDoctorProfileEngine.getStore().profiles,
          modelCalls: window.__modelCalls,
          worldCalls: window.__worldCalls,
        }));
        const profileResult = evidence.runtime.lastResult.profile;
        assert.deepEqual(evidence.modelCalls.map((call) => call.kind), ['discovery', 'profile', 'profile-repair']);
        assert.match(profileResult.initialErrors.join('；'), /缺少rowId/u);
        assert.match(profileResult.repairErrors.join('；'), /重复返回/u);
        assert.match(profileResult.repairErrors.join('；'), /未知rowId PX/u);
        assert.match(profileResult.repairErrors.join('；'), /P2（门卫）没有返回档案/u);
        assert.match(profileResult.initialRaw, /INITIAL_ROW_BIND_SENTINEL/u);
        assert.match(profileResult.repairRaw, /REPAIR_ROW_BIND_SENTINEL/u);
        assert.match(profileResult.requestPrompt, /"rowId":"P1","sourceName":"引导者"/u);
        assert.match(profileResult.repairRequestPrompt, /"rowId":"P2","sourceName":"门卫"/u);
        assert.equal(Object.keys(evidence.profiles).length, 0);
        assert.equal(evidence.worldCalls.length, 0);
        const durableFailure = evidence.runtime.runReports.find((run) => run.result?.profile?.repairRaw);
        assert.match(durableFailure.result.profile.initialRaw, /INITIAL_ROW_BIND_SENTINEL/u);
        assert.match(durableFailure.result.profile.repairRaw, /REPAIR_ROW_BIND_SENTINEL/u);

        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-action="export"]').click();
        await page.waitForFunction(() => window.__downloads.length === 1);
        const report = JSON.parse((await page.evaluate(() => window.__downloads[0])).content);
        const exportedFailure = report.runtime.runs.find((run) => run.result?.profile?.repairRaw);
        assert.match(exportedFailure.result.profile.initialRaw, /INITIAL_ROW_BIND_SENTINEL/u);
        assert.match(exportedFailure.result.profile.repairRaw, /REPAIR_ROW_BIND_SENTINEL/u);
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
          profileReplies: [
            JSON.stringify({ profiles: profiles.slice(0, 7).map((profile, index) => ({ ...profile, rowId: `P${index + 1}` })) }),
            JSON.stringify({ profiles: profiles.slice(7).map((profile, index) => ({ ...profile, rowId: `P${index + 1}` })) }),
          ],
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
        assert.deepEqual(evidence.stages, ['diagnosis', ...Array(9).fill('profile')]);
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
          profileReplies: [
            JSON.stringify({ profiles: [
              { ...refreshedCurrent, rowId: 'P1' },
              { ...echoedInventory, rowId: 'PX' },
            ] }),
            JSON.stringify({ profiles: [{ ...refreshedCurrent, rowId: 'P1' }] }),
          ],
        });
        await page.evaluate(({ current, remote }) => {
          window.__context.chatMetadata.mvuDoctorReferenceProfiles = {
            schema: 2, chatId: 'chat-a', revision: 1,
            profiles: { [current.profileId]: current, [remote.profileId]: remote },
            branches: {}, profileReceipts: {}, history: [], updatedAt: new Date().toISOString(),
          };
          window.__setChat([
            { is_user: true, mes: '只检查眼前的人。' },
            { is_user: false, is_system: false, mes: '白姑娘把药箱放到桌边。', swipe_id: 0, swipes: ['白姑娘把药箱放到桌边。'] },
           ]);
        }, { current: currentProfile, remote: remoteProfile });
        await page.evaluate(async () => {
          const extensionKey = 'mvu-doctor-kemini-clean';
          window.__context.extensionSettings[extensionKey] = {
            mvuDoctorReferenceSettings: { profileEnabled: false },
          };
          try {
            await window.MVUDoctorProfileEngine.runDiagnosis();
          } finally {
            window.__context.extensionSettings[extensionKey].mvuDoctorReferenceSettings.profileEnabled = true;
          }
        });
        await waitForSettled(page, 'done');
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
        assert.equal(evidence.store.profiles['profile-current'].name, '白露');
        assert.ok(evidence.store.profiles['profile-current'].aliases.includes('白姑娘'));
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
        assert.deepEqual(evidence.stages, ['diagnosis']);
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
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'done'
          && window.MVUDoctorProfileEngine.getStore().history.length === 2);
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          store: window.MVUDoctorProfileEngine.getStore(),
        }));
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'diagnosis']);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'profile']);
        assert.match(evidence.prompts[1], /权威目标行[^]*林澄[^]*延后批次人物[^]*陆遥/u);
        assert.match(evidence.prompts[2], /权威目标行[^]*陆遥/u);
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
        const legitimateB = {
          ...structuredClone(completeProfile), name: names[1], aliases: [],
          currentState: { ...structuredClone(completeProfile.currentState), goal: 'LEGITIMATE_SECOND_BATCH_GOAL' },
        };
        await installHarness(page, {
          initialMvuState: { hp: 10 },
          discoveryReplies: [JSON.stringify({ detectedCharacters: names, noCharacterReason: '' })],
          profileReplies: [
            profileEnvelope(incompleteA),
            JSON.stringify({ profiles: [{ ...repairedA, rowId: 'P1' }] }),
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile', 'profile', 'profile']);
        assert.match(evidence.prompts[2], /延后批次人物[^]*绝不能返回[^]*乔霁/u);
      } finally { await page.close(); }
    });

    await t.test('a later batch cannot replace an already completed target through a reverse alias', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        const names = ['岑野', '乔霁'];
        const first = { ...structuredClone(completeProfile), name: names[0], aliases: [] };
        const second = {
          ...structuredClone(completeProfile), name: names[1], aliases: [names[0]],
          currentState: { ...structuredClone(completeProfile.currentState), goal: 'REVERSE_ALIAS_SECOND_GOAL' },
        };
        await installHarness(page, {
          initialMvuState: { hp: 10 },
          discoveryReplies: [discoveryEnvelope(names)],
          profileReplies: [profileEnvelope(first), profileEnvelope(second)],
        });
        await page.evaluate(() => {
          window.__context.extensionSettings['mvu-doctor-kemini-clean'] = {
            mvuDoctorReferenceSettings: { maxTokens: 3000 },
          };
        });
        await runAcceptedReply(page, '岑野留在台阶上警戒，乔霁绕到后窗检查痕迹。');
        await waitForSettled(page, 'done');
        const evidence = await page.evaluate(() => ({
          profile: window.MVUDoctorProfileEngine.getRuntime().lastResult.profile,
          profiles: Object.values(window.MVUDoctorProfileEngine.getStore().profiles),
          profileWrites: window.__profileStoreWrites(),
        }));
        const firstStored = evidence.profiles.find((profile) => profile.name === names[0]);
        const secondStored = evidence.profiles.find((profile) => profile.name === names[1]);
        assert.equal(evidence.profile.count, 2);
        assert.ok(firstStored);
        assert.equal(secondStored.currentState.goal, 'REVERSE_ALIAS_SECOND_GOAL');
        assert.ok(!secondStored.aliases.includes(names[0]));
        assert.equal(evidence.profileWrites.length, 1);
      } finally { await page.close(); }
    });

    await t.test('manual Story repair migrates the accepted identity without invoking native World', async () => {
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
          const repair = await window.MVUDoctorProfileEngine.runDiagnosis();
          return {
            repair,
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            worldCalls: window.__worldCalls,
          };
        });
        assert.notEqual(evidence.runtime.lastAccepted.identity, before.identity);
        assert.equal(evidence.runtime.lastAccepted.generationKey, before.generationKey);
        assert.ok(evidence.repair.diagnosis || evidence.repair.profile || evidence.repair.status);
        assert.equal(evidence.worldCalls.length, 0);
      } finally { await page.close(); }
    });

    await t.test('manual diagnosis recovery resumes profile from a failed Doctor checkpoint', async () => {
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'diagnosis', 'profile']);
        assert.equal(evidence.calls, 0);
        assert.equal(evidence.checkpoint.status, 'complete');
      } finally { await page.close(); }
    });

    await t.test('profile retry preserves a parsed-equivalent warning from the durable diagnosis receipt', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          diagnosisReply: '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":10}]</JSONPatch></UpdateVariable>',
          discoveryReplies: ['无法解析的人物发现', '修复后仍无法解析'],
        });
        await runAcceptedReply(page);
        await waitForSettled(page, 'failed');
        const before = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.equal(before.result.failedStep, 'profile');
        assert.equal(before.result.diagnosis.status, 'unverified');
        assert.equal(before.checkpoint.diagnosisReceipt.status, 'unverified');
        await page.evaluate(async () => {
          window.__setDiscoveryReplies([JSON.stringify({ detectedCharacters: ['白露'], noCharacterReason: '' })]);
          await window.MVUDoctorProfileEngine.runCurrent();
        });
        await waitForSettled(page, 'done');
        const after = await page.evaluate(() => ({
          result: window.MVUDoctorProfileEngine.getRuntime().lastResult,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
          stages: window.__stages,
        }));
        assert.equal(after.result.status, 'complete_with_warning');
        assert.equal(after.result.diagnosis.status, 'unverified');
        assert.equal(after.result.diagnosis.recoveredFromCheckpoint, true);
        assert.equal(after.checkpoint.diagnosisReceipt.status, 'unverified');
        assert.deepEqual(after.stages, ['diagnosis', 'profile']);
      } finally { await page.close(); }
    });

    await t.test('a committed profile receipt skips a duplicate model call when reload resumes profile', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const before = await page.evaluate(() => ({
          stages: [...window.__stages],
          modelCalls: window.__modelCalls.length,
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
          receipts: Object.values(window.MVUDoctorProfileEngine.getStore().profileReceipts || {}),
        }));
        assert.equal(before.checkpoint.lastCompletedStep, 'profile');
        assert.ok(before.checkpoint.diagnosisReceipt?.evidenceReceipt?.targetMvu?.payloadFingerprint);
        assert.equal(before.receipts.length, 1);
        assert.ok(before.receipts[0].diagnosisReceiptFingerprint);
        await page.evaluate(async () => {
          const key = 'mvuDoctorReferencePipeline:chat-a';
          const checkpoint = JSON.parse(localStorage.getItem(key));
          localStorage.setItem(key, JSON.stringify({
            ...checkpoint,
            status: 'running', nextStep: 'profile', lastCompletedStep: 'diagnosis',
            reason: 'synthetic-reload-after-profile-commit', updatedAt: new Date().toISOString(),
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
        assert.deepEqual(evidence.stages, before.stages);
        assert.equal(await page.evaluate(() => window.__modelCalls.length), before.modelCalls);
        assert.equal(evidence.result.profile.status, 'already-committed');
        assert.equal(evidence.result.profile.modelCalls, 0);
        assert.equal(evidence.calls, 0);
      } finally { await page.close(); }
    });

    await t.test('a Story write followed by save failure compensates MVU and body without migrating identity', async () => {
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
          mvu: window.__mvuState(),
          latch: window.__mutationLatchCopies(),
          checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
        }));
        assert.equal(before.runtime.lastResult.failedStep, 'diagnosis');
        assert.equal(before.latest, '白露：我先替你看一看伤口。');
        assert.equal(before.mvu.hp, 10);
        assert.notEqual(before.latch.local?.compromised, true);
        assert.equal(before.runtime.lastAccepted.identity, before.checkpoint.target.identity);
        assert.ok(before.checkpoint.target.generationKey);
        await page.evaluate(async () => {
          window.__setDiagnosisReply('<JSONPatch>[]</JSONPatch>');
          await window.MVUDoctorProfileEngine.runDiagnosis();
        });
        await waitForSettled(page, 'done');
        const after = await page.evaluate(() => ({ stages: window.__stages, calls: window.__worldCalls.length }));
        assert.deepEqual(after.stages, ['diagnosis', 'diagnosis', 'profile']);
        assert.equal(after.calls, 0);
      } finally { await page.close(); }
    });

    await t.test('manual Story save failure also compensates MVU and keeps the accepted identity', async () => {
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
          const failedContent = window.__context.chat.at(-1).mes;
          const failedMvu = window.__mvuState();
          const failedLatch = window.__mutationLatchCopies();
          window.__setDiagnosisReply('<JSONPatch>[]</JSONPatch>');
          const retry = await window.MVUDoctorProfileEngine.runDiagnosis();
          return { before, afterFailure, checkpoint, failedContent, failedMvu, failedLatch, retry, error, calls: window.__worldCalls };
        });
        assert.match(evidence.error, /synthetic saveChat failure/u);
        assert.equal(evidence.afterFailure.identity, evidence.before.identity);
        assert.equal(evidence.afterFailure.generationKey, evidence.before.generationKey);
        assert.equal(evidence.checkpoint.target.identity, evidence.before.identity);
        assert.equal(evidence.failedContent, '白露：我先替你看一看伤口。');
        assert.equal(evidence.failedMvu.hp, 10);
        assert.notEqual(evidence.failedLatch.local?.compromised, true);
        assert.ok(evidence.retry.diagnosis || evidence.retry.profile || evidence.retry.status);
        assert.equal(evidence.calls.length, 0);
      } finally { await page.close(); }
    });

    await t.test('a durable diagnosis receipt sidecar recovers with zero re-diagnosis while a compensated profile reruns once', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, {
          slowDiagnosis: true,
          profileReplies: [profileEnvelope(), profileEnvelope()],
        });
        await runAcceptedReply(page);
        await page.waitForFunction(() => window.__diagnosisPending());
        const initialCheckpoint = await page.evaluate(() => localStorage.getItem('mvuDoctorReferencePipeline:chat-a'));
        assert.ok(initialCheckpoint);
        await page.evaluate(() => {
          window.__failNextPipelineWrites(2);
          window.__resolveDiagnosis('<JSONPatch>[]</JSONPatch>');
        });
        await waitForSettled(page, 'failed');
        const sidecar = await page.evaluate(() => {
          const key = [...window.__worldStore.keys()]
            .find((candidate) => candidate.startsWith('mvuDoctorReferenceDiagnosisReceipt:'));
          return {
            key: key || '',
            mirror: key ? window.__worldStore.get(key) : null,
            durable: key ? window.__durableGet(key) : null,
            diagnosisCalls: window.__diagnosisRequests.length,
          };
        });
        assert.ok(sidecar.key, 'diagnosis success must create a durable receipt sidecar before the local checkpoint handoff');
        assert.equal(sidecar.durable, sidecar.mirror, 'the sidecar requires an IndexedDB readback, not only the sync mirror');
        assert.equal(sidecar.diagnosisCalls, 1);

        await page.evaluate(async (checkpointRaw) => {
          localStorage.setItem('mvuDoctorReferencePipeline:chat-a', checkpointRaw);
          await window.__emit('chat_loaded');
        }, initialCheckpoint);
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'done'
          || window.__diagnosisPendingCount() > 0, null, { timeout: 8000 });
        const recovered = await page.evaluate(() => ({
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          diagnosisCalls: window.__diagnosisRequests.length,
          pendingDiagnoses: window.__diagnosisPendingCount(),
          stages: [...window.__stages],
        }));
        assert.equal(recovered.pendingDiagnoses, 0, 'reload must not start another diagnosis request');
        assert.equal(recovered.diagnosisCalls, 1, 'the durable sidecar owns recovery after checkpoint loss');
        assert.equal(recovered.runtime.phase, 'done');
        assert.equal(recovered.stages.filter((stage) => stage === 'diagnosis').length, 1,
          'durable diagnosis completion must prevent re-diagnosis');
        assert.equal(recovered.stages.filter((stage) => stage === 'profile').length, 2,
          'the profile committed before checkpoint failure is compensated, then rerun exactly once');
      } finally { await page.close(); }
    });

    await t.test('an older diagnosis clear cannot overwrite a newer mutation-integrity incident', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { slowDiagnosis: true });
        await runAcceptedReply(page);
        await page.waitForFunction(() => window.__diagnosisPending());
        await page.evaluate(() => window.__resolveDiagnosis('<JSONPatch>[]</JSONPatch>'));
        await waitForSettled(page, 'done');
        const beforeProfileCalls = await page.evaluate(() => window.__modelCalls.filter((call) => call.kind === 'profile').length);
        await page.evaluate(() => {
          const checkpoint = JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a'));
          const target = checkpoint.target;
          const message = window.__context.chat[target.index];
          const snapshot = window.__mvuState();
          window.__setMutationLatch({
            schema: 2,
            chatId: target.chatId,
            compromised: true,
            errorCode: 'stale_diagnosis_rollback_failed',
            error: 'synthetic older diagnosis rollback incident',
            at: new Date(Date.now() - 1000).toISOString(),
            incidentId: 'diagnosis-incident-old',
            recovery: {
              kind: 'diagnosis', chatId: target.chatId, messageId: target.index,
              swipeId: target.swipeId, generationKey: target.generationKey,
              mvuSnapshot: snapshot, mvuCandidate: { ...snapshot, hp: Number(snapshot.hp || 0) + 1 },
              originalContent: message.mes, candidateContent: message.mes,
              patchBlock: '<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>',
            },
          });
          window.__injectMutationIncidentAfterClearPending({
            schema: 2,
            chatId: target.chatId,
            compromised: true,
            errorCode: 'profile_branch_rollback_failed',
            error: 'synthetic newer profile rollback incident',
            at: new Date().toISOString(),
            incidentId: 'profile-incident-new',
            recovery: { kind: 'profile', chatId: target.chatId, generationKey: target.generationKey },
          });
          window.__manualIncidentRecoveryDone = false;
          window.__manualIncidentRecoveryError = '';
          window.MVUDoctorProfileEngine.runDiagnosis().then(
            () => { window.__manualIncidentRecoveryDone = true; },
            (error) => {
              window.__manualIncidentRecoveryError = error?.message || String(error);
              window.__manualIncidentRecoveryDone = true;
            },
          );
        });
        await page.waitForFunction(() => window.__diagnosisPendingCount() === 1);
        await page.evaluate(() => window.__resolveDiagnosis('<JSONPatch>[]</JSONPatch>'));
        await page.waitForFunction(() => window.__manualIncidentRecoveryDone);
        const evidence = await page.evaluate(() => ({
          error: window.__manualIncidentRecoveryError,
          copies: window.__mutationLatchCopies(),
          profileCalls: window.__modelCalls.filter((call) => call.kind === 'profile').length,
        }));
        assert.match(evidence.error, /事务完整性|事故|incident|清除/u);
        for (const [source, copy] of Object.entries(evidence.copies)) {
          assert.equal(copy?.compromised, true, `${source} must remain fail-closed`);
          assert.equal(copy?.errorCode, 'profile_branch_rollback_failed', `${source} must retain the newer incident kind`);
          assert.equal(copy?.incidentId, 'profile-incident-new', `${source} must retain the newer incident identity`);
        }
        assert.equal(evidence.profileCalls, beforeProfileCalls, 'a failed CAS clear must not resume profile generation');
      } finally { await page.close(); }
    });

    await t.test('Doctor waits for an in-flight native Story task and never issues a second diagnosis', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { nativeStoryBusy: true });
        const cancelCallsAtStart = await page.evaluate(() => window.__nativeStoryCancelCalls);
        await runAcceptedReply(page);
        await page.waitForFunction((baseline) => window.MVUDoctorProfileEngine.getRuntime().phase === 'diagnosing'
          && window.__nativeStoryCancelCalls > baseline, cancelCallsAtStart);
        await page.waitForTimeout(150);
        const blocked = await page.evaluate(() => ({
          diagnosisCalls: window.__diagnosisRequests.length,
          parseCalls: window.__mvuParseCalls,
          writes: window.__mvuWrites.length,
        }));
        assert.deepEqual(blocked, { diagnosisCalls: 0, parseCalls: 0, writes: 0 });
        await page.evaluate(() => window.__finishNativeStory());
        await waitForSettled(page, 'failed');
        const completed = await page.evaluate(() => ({
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          diagnosisCalls: window.__diagnosisRequests.length,
          parseCalls: window.__mvuParseCalls,
          writes: window.__mvuWrites.length,
        }));
        assert.equal(completed.runtime.lastResult.errorCode, 'native_story_post_reply_preempted');
        assert.equal(completed.diagnosisCalls, 0);
        assert.equal(completed.parseCalls, 0);
        assert.equal(completed.writes, 0);
      } finally { await page.close(); }
    });

    await t.test('profile post-commit staleness rolls back exactly, and a failed rollback latches the incident', async () => {
      for (const failRollback of [false, true]) {
        const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
        try {
          await installHarness(page, { slowProfile: true });
          await runAcceptedReply(page);
          await page.waitForFunction(() => window.__profilePending());
          await page.evaluate(({ reply, fail }) => {
            window.__staleAfterNextProfileCommit(fail);
            window.__resolveProfile(reply);
          }, { reply: profileEnvelope(), fail: failRollback });
          await waitForSettled(page, failRollback ? 'failed' : 'discarded');
          const evidence = await page.evaluate(() => {
            const profileKey = 'mvuDoctorReferenceProfileStore:chat-a';
            const durableRaw = window.__durableGet(profileKey);
            return {
              runtime: window.MVUDoctorProfileEngine.getRuntime(),
              mirror: window.MVUDoctorProfileEngine.getStore(),
              durable: durableRaw ? JSON.parse(durableRaw) : null,
              latch: window.__mutationLatchCopies(),
              latest: window.__context.chat.at(-1).mes,
            };
          });
          assert.match(evidence.latest, /PROFILE_POST_COMMIT_STALE_SENTINEL/u);
          if (!failRollback) {
            assert.equal(evidence.runtime.lastResult.status, 'stale');
            assert.equal(Object.keys(evidence.mirror.profiles || {}).length, 0);
            assert.equal(Object.keys(evidence.durable?.profiles || {}).length, 0);
            assert.notEqual(evidence.latch.local?.compromised, true);
          } else {
            assert.equal(evidence.runtime.lastResult.errorCode, 'profile_branch_rollback_failed');
            assert.equal(Object.keys(evidence.durable?.profiles || {}).length, 1, 'failed durable rollback leaves the committed candidate uncertain');
            assert.equal(evidence.latch.local?.compromised, true);
            assert.equal(evidence.latch.local?.errorCode, 'profile_branch_rollback_failed');
            assert.equal(evidence.latch.mirror?.compromised, true);
          }
        } finally { await page.close(); }
      }
    });

    await t.test('applied diagnosis side effects are compensated when profile evidence turns stale after commit', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      const originalAssistant = '白露：我先替你看一看伤口。';
      try {
        await installHarness(page, {
          slowProfile: true,
          mvuPatchMode: 'apply',
          diagnosisReply: '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>',
        });
        await runAcceptedReply(page, originalAssistant);
        await page.waitForFunction(() => window.__profilePending());
        await page.evaluate((reply) => {
          window.__staleAfterNextProfileCommit(false, 'user');
          window.__resolveProfile(reply);
        }, profileEnvelope());
        await waitForSettled(page, 'discarded');
        const evidence = await page.evaluate(() => {
          const profileKey = 'mvuDoctorReferenceProfileStore:chat-a';
          const durableRaw = window.__durableGet(profileKey);
          return {
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            mirror: window.MVUDoctorProfileEngine.getStore(),
            durable: durableRaw ? JSON.parse(durableRaw) : null,
            latch: window.__mutationLatchCopies(),
            assistant: window.__context.chat.at(-1).mes,
            user: window.__context.chat.find((message) => message?.is_user)?.mes || '',
            mvu: window.__mvuState(),
            mvuWrites: window.__mvuWrites.length,
          };
        });
        assert.equal(evidence.runtime.lastResult.status, 'stale');
        assert.equal(evidence.runtime.lastResult.failedStep, 'diagnosis');
        assert.equal(evidence.assistant, originalAssistant, 'Doctor-written repair body must return to its exact pre-diagnosis text');
        assert.match(evidence.user, /PROFILE_POST_COMMIT_STALE_SENTINEL/u, 'the external evidence change itself must not be overwritten');
        assert.equal(evidence.mvu.hp, 10, 'the applied MVU candidate must be compensated to its exact snapshot');
        assert.equal(evidence.mvuWrites, 2, 'one candidate write requires exactly one compensating MVU write');
        assert.equal(Object.keys(evidence.mirror.profiles || {}).length, 0);
        assert.equal(Object.keys(evidence.durable?.profiles || {}).length, 0);
        assert.notEqual(evidence.latch.local?.compromised, true);
      } finally { await page.close(); }
    });

    await t.test('ordinary manual diagnosis completes its bound profile, returns the diagnosis verdict, and stale reload never replays a model', async () => {
      for (const applied of [false, true]) {
        const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
        const originalAssistant = applied
          ? '白露：这次手动复检会留下可补偿的变量修复。'
          : '白露：这次手动复检不会产生变量副作用。';
        try {
          await installHarness(page, {
            mvuPatchMode: applied ? 'apply' : 'noop',
            diagnosisReply: applied
              ? '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>'
              : '<JSONPatch>[]</JSONPatch>',
          });
          const beforeReload = await page.evaluate(async ({ assistant, shouldApply }) => {
            window.__setChat([
              { is_user: true, mes: '手动复检这一楼的MVU，并按正常流程补齐人物档案。' },
              { is_user: false, is_system: false, mes: assistant, swipe_id: 0, swipes: [assistant] },
            ]);
            const diagnosis = await window.MVUDoctorProfileEngine.runDiagnosis();
            const checkpoint = JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null');
            const store = window.MVUDoctorProfileEngine.getStore();
            const receipt = store.profileReceipts?.[checkpoint?.target?.generationKey] || null;
            const fingerprint = (value) => {
              const source = String(value || '');
              let hash = 2166136261;
              for (let index = 0; index < source.length; index += 1) {
                hash ^= source.charCodeAt(index);
                hash = Math.imul(hash, 16777619);
              }
              return `${source.length}-${(hash >>> 0).toString(36)}`;
            };
            const triggeringUser = window.__context.chat.find((message) => message?.is_user);
            triggeringUser.mes = `${String(triggeringUser.mes || '')}\n\nMANUAL_DIAGNOSIS_STALE_SENTINEL_${shouldApply ? 'APPLIED' : 'NOCHANGE'}`;
            return {
              diagnosis,
              checkpoint,
              runtimeResult: window.MVUDoctorProfileEngine.getRuntime().lastResult,
              receipt,
              expectedDiagnosisReceiptFingerprint: fingerprint(JSON.stringify(checkpoint?.diagnosisReceipt || null)),
              profiles: Object.keys(store.profiles || {}).length,
              receipts: Object.keys(store.profileReceipts || {}).length,
              diagnosisCalls: window.__diagnosisRequests.length,
              modelCalls: window.__modelCalls.map((call) => call.kind),
              assistant: window.__context.chat.at(-1).mes,
              mvu: window.__mvuState(),
            };
          }, { assistant: originalAssistant, shouldApply: applied });
          assert.equal(beforeReload.diagnosis.status, applied ? 'applied' : 'nochange');
          assert.equal(beforeReload.runtimeResult.diagnosis.status, beforeReload.diagnosis.status,
            'the public API must return the original diagnosis verdict while the runtime records the full pipeline');
          assert.equal(beforeReload.runtimeResult.profile.ok, true);
          assert.equal(beforeReload.checkpoint.status, 'complete');
          assert.equal(beforeReload.checkpoint.lastCompletedStep, 'profile',
            'an ordinary manual recheck must finish the normal bound profile stage');
          assert.equal(beforeReload.checkpoint.nextStep, '');
          assert.equal(beforeReload.checkpoint.profileTransactionExpected, true);
          assert.equal(beforeReload.profiles, 1);
          assert.equal(beforeReload.receipts, 1, 'the normal manual flow must commit one profile receipt');
          assert.equal(beforeReload.receipt?.status, 'committed');
          assert.equal(beforeReload.receipt?.generationKey, beforeReload.checkpoint.target.generationKey);
          assert.equal(beforeReload.receipt?.identity, beforeReload.checkpoint.target.identity);
          assert.equal(beforeReload.receipt?.diagnosisReceiptFingerprint,
            beforeReload.expectedDiagnosisReceiptFingerprint,
            'the profile receipt must bind the actual diagnosis receipt, not a fabricated or empty verdict');
          assert.equal(beforeReload.diagnosisCalls, 1, 'ordinary manual diagnosis must call Story exactly once');
          assert.deepEqual(beforeReload.modelCalls, ['discovery', 'profile'],
            'this reply has one profile candidate, so the normal manual flow must perform only its required profile calls');
          if (applied) {
            assert.equal(beforeReload.mvu.hp, 11);
            assert.match(beforeReload.assistant, /<UpdateVariable>/u);
          } else {
            assert.equal(beforeReload.mvu.hp, 10);
            assert.equal(beforeReload.assistant, originalAssistant);
          }

          await page.evaluate(async () => { await window.__emit('chat_loaded'); });
          await page.waitForFunction(() => ['discarded', 'failed'].includes(
            window.MVUDoctorProfileEngine.getRuntime().phase,
          ));
          const recovered = await page.evaluate(() => ({
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
            store: window.MVUDoctorProfileEngine.getStore(),
            diagnosisCalls: window.__diagnosisRequests.length,
            modelCalls: window.__modelCalls.length,
            assistant: window.__context.chat.at(-1).mes,
            mvu: window.__mvuState(),
            latch: window.__mutationLatchCopies(),
          }));
          assert.equal(recovered.diagnosisCalls, beforeReload.diagnosisCalls,
            'reload must not replay the manual diagnosis model');
          assert.equal(recovered.modelCalls, beforeReload.modelCalls.length,
            'reload must not repeat any profile model call after the completed manual pipeline');
          assert.equal(Object.keys(recovered.store.profiles || {}).length, 0);
          assert.equal(Object.keys(recovered.store.profileReceipts || {}).length, 0);
          for (const [source, copy] of Object.entries(recovered.latch)) {
            assert.notEqual(copy?.errorCode, 'profile_branch_rollback_failed',
              `${source} must not demand a profile rollback for a diagnosis-only completion`);
          }
          if (!applied) {
            assert.equal(recovered.runtime.lastResult.status, 'stale',
              'a stale nochange receipt has no side effects and must be reported honestly as stale');
            assert.equal(recovered.mvu.hp, 10);
            assert.equal(recovered.assistant, originalAssistant);
            for (const [source, copy] of Object.entries(recovered.latch)) {
              assert.notEqual(copy?.compromised, true, `${source} must stay clean for side-effect-free nochange`);
            }
          } else {
            const diagnosisCompensated = recovered.mvu.hp === 10 && recovered.assistant === originalAssistant;
            if (diagnosisCompensated) {
              assert.equal(recovered.runtime.lastResult.status, 'stale');
              for (const [source, copy] of Object.entries(recovered.latch)) {
                assert.notEqual(copy?.compromised, true, `${source} must be clean after exact diagnosis compensation`);
              }
            } else {
              for (const [source, copy] of Object.entries(recovered.latch)) {
                assert.equal(copy?.compromised, true, `${source} must block an uncompensated applied diagnosis`);
                assert.equal(copy?.errorCode, 'stale_diagnosis_rollback_failed',
                  `${source} must attribute the incident to diagnosis compensation, never a missing profile receipt`);
              }
              assert.equal(recovered.runtime.failedStep, '');
              assert.notEqual(recovered.checkpoint?.nextStep, 'diagnosis',
                'an uncompensated applied diagnosis must not become replayable');
            }
          }
        } finally { await page.close(); }
      }
    });

    await t.test('a direct committed profile receipt with a missing or corrupt rollback capsule fails closed before any model replay', async () => {
      for (const capsuleFault of ['missing', 'corrupt']) {
        const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
        try {
          await installHarness(page);
          await runAcceptedReply(page);
          await waitForSettled(page, 'done');
          const beforeReload = await page.evaluate((fault) => {
            const checkpointKey = 'mvuDoctorReferencePipeline:chat-a';
            const profileKey = 'mvuDoctorReferenceProfileStore:chat-a';
            const checkpoint = JSON.parse(localStorage.getItem(checkpointKey) || 'null');
            const store = window.MVUDoctorProfileEngine.getStore();
            const receiptKey = checkpoint?.target?.generationKey;
            const receipt = store.profileReceipts?.[receiptKey];
            if (!receipt) throw new Error('test precondition: committed profile receipt is missing');
            if (fault === 'missing') delete receipt.profileBeforeImages;
            else receipt.profileBeforeImages = 'CORRUPT_ROLLBACK_CAPSULE';
            window.__setWorldStoreCopies(profileKey, JSON.stringify(store));
            localStorage.setItem(checkpointKey, JSON.stringify({
              ...checkpoint,
              status: 'running', nextStep: 'profile', lastCompletedStep: 'diagnosis',
              reason: `synthetic-direct-receipt-${fault}-capsule`, updatedAt: new Date().toISOString(),
            }));
            return {
              receipt: structuredClone(receipt),
              diagnosisCalls: window.__diagnosisRequests.length,
              modelCalls: window.__modelCalls.length,
            };
          }, capsuleFault);
          assert.equal(beforeReload.receipt.status, 'committed');
          assert.ok(beforeReload.receipt.beforeProfileDigest);
          assert.ok(beforeReload.receipt.beforeBranchDigest);
          assert.ok(beforeReload.receipt.diagnosisReceiptFingerprint,
            'the direct receipt must remain otherwise valid and diagnosis-bound');

          await page.evaluate(async () => { await window.__emit('chat_loaded'); });
          await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'failed');
          const recovered = await page.evaluate(() => ({
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
            diagnosisCalls: window.__diagnosisRequests.length,
            modelCalls: window.__modelCalls.length,
            latch: window.__mutationLatchCopies(),
          }));
          assert.equal(recovered.diagnosisCalls, beforeReload.diagnosisCalls,
            `${capsuleFault}: recovery must not replay Story diagnosis`);
          assert.equal(recovered.modelCalls, beforeReload.modelCalls,
            `${capsuleFault}: an unusable rollback capsule must be rejected before discovery/profile calls`);
          for (const [source, copy] of Object.entries(recovered.latch)) {
            assert.equal(copy?.compromised, true, `${capsuleFault}/${source}: the unsafe direct receipt must remain fail-closed`);
            assert.equal(copy?.errorCode, 'profile_branch_rollback_failed',
              `${capsuleFault}/${source}: the persisted incident must identify profile rollback integrity`);
          }
          assert.equal(recovered.runtime.failedStep, '',
            `${capsuleFault}: a persisted integrity incident, not a retryable profile step, must own recovery`);
          assert.notEqual(recovered.checkpoint?.nextStep, 'profile',
            `${capsuleFault}: the unsafe committed receipt must not remain directly retryable`);
        } finally { await page.close(); }
      }
    });

    await t.test('historical complete survives a new user turn whose generation stops before any assistant reply', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const beforeReload = await page.evaluate(async () => {
          const store = window.MVUDoctorProfileEngine.getStore();
          const checkpoint = JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null');
          const assistantCount = window.__context.chat.filter((message) => message && !message.is_user && !message.is_system).length;
          window.__context.chat.push({ is_user: true, mes: '下一轮输入已经发送，但这次生成随后被停止。' });
          await window.__emit('message_sent');
          await window.__emit('generation_started', 'normal', {}, false);
          await window.__emit('generation_stopped');
          return {
            checkpoint,
            profiles: JSON.stringify(store.profiles || {}),
            branches: JSON.stringify(store.branches || {}),
            receipts: JSON.stringify(store.profileReceipts || {}),
            diagnosisCalls: window.__diagnosisRequests.length,
            modelCalls: window.__modelCalls.length,
            assistantCount,
            phaseAfterStop: window.MVUDoctorProfileEngine.getRuntime().phase,
          };
        });
        assert.equal(beforeReload.checkpoint.status, 'complete');
        assert.equal(beforeReload.checkpoint.lastCompletedStep, 'profile');
        assert.equal(beforeReload.phaseAfterStop, 'cancelled');

        await page.evaluate(async () => { await window.__emit('chat_loaded'); });
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().phase === 'done');
        const recovered = await page.evaluate(() => {
          const store = window.MVUDoctorProfileEngine.getStore();
          return {
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
            ticket: JSON.parse(localStorage.getItem('mvuDoctorReferenceGeneration:chat-a') || 'null'),
            profiles: JSON.stringify(store.profiles || {}),
            branches: JSON.stringify(store.branches || {}),
            receipts: JSON.stringify(store.profileReceipts || {}),
            diagnosisCalls: window.__diagnosisRequests.length,
            modelCalls: window.__modelCalls.length,
            assistantCount: window.__context.chat.filter((message) => message && !message.is_user && !message.is_system).length,
            tailIsUser: window.__context.chat.at(-1)?.is_user === true,
            latch: window.__mutationLatchCopies(),
          };
        });
        assert.equal(recovered.runtime.lastResult.status, 'complete');
        assert.equal(recovered.checkpoint.status, 'complete');
        assert.equal(recovered.checkpoint.lastCompletedStep, 'profile');
        assert.equal(recovered.ticket, null, 'the stopped new generation must not be resurrected on reload');
        assert.equal(recovered.assistantCount, beforeReload.assistantCount, 'no new assistant reply exists to process');
        assert.equal(recovered.tailIsUser, true);
        assert.equal(recovered.diagnosisCalls, beforeReload.diagnosisCalls,
          'historical validation must not replay the completed diagnosis');
        assert.equal(recovered.modelCalls, beforeReload.modelCalls,
          'historical validation must not repeat discovery or profile generation');
        assert.equal(recovered.profiles, beforeReload.profiles, 'the completed active profiles must be preserved exactly');
        assert.equal(recovered.branches, beforeReload.branches, 'the completed branch snapshots must be preserved exactly');
        assert.equal(recovered.receipts, beforeReload.receipts, 'the completed profile receipt must remain reusable');
        for (const [source, copy] of Object.entries(recovered.latch)) {
          assert.notEqual(copy?.compromised, true, `${source}: a later normal user turn is not historical evidence tampering`);
          assert.notEqual(copy?.errorCode, 'stale_diagnosis_rollback_failed');
          assert.notEqual(copy?.errorCode, 'profile_branch_rollback_failed');
        }
      } finally { await page.close(); }
    });

    await t.test('a crash after durable profile commit compensates stale evidence or latches without model replay', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const beforeReload = await page.evaluate(() => {
          const key = 'mvuDoctorReferencePipeline:chat-a';
          const checkpoint = JSON.parse(localStorage.getItem(key));
          const store = window.MVUDoctorProfileEngine.getStore();
          const branchProfileCount = (value) => Object.values(value?.branches || {})
            .reduce((count, branch) => count + Object.keys(branch || {}).length, 0);
          localStorage.setItem(key, JSON.stringify({
            ...checkpoint,
            status: 'running', nextStep: 'profile', lastCompletedStep: 'diagnosis',
            reason: 'synthetic-crash-after-durable-profile-commit', updatedAt: new Date().toISOString(),
          }));
          const triggeringUser = window.__context.chat.find((message) => message?.is_user);
          triggeringUser.mes = `${String(triggeringUser.mes || '')}\n\nPOST_PROFILE_COMMIT_CRASH_STALE_SENTINEL`;
          return {
            profiles: Object.keys(store.profiles || {}).length,
            receipts: Object.keys(store.profileReceipts || {}).length,
            branchProfiles: branchProfileCount(store),
            diagnosisCalls: window.__diagnosisRequests.length,
            modelCalls: window.__modelCalls.length,
          };
        });
        assert.equal(beforeReload.profiles, 1, 'the simulated crash starts after the profile is durably visible');
        assert.equal(beforeReload.receipts, 1, 'the committed transaction must retain its rollback receipt');
        assert.ok(beforeReload.branchProfiles > 0, 'the committed swipe branch must exist before recovery');

        await page.evaluate(async () => { await window.__emit('chat_loaded'); });
        await page.waitForFunction(() => ['discarded', 'failed'].includes(
          window.MVUDoctorProfileEngine.getRuntime().phase,
        ));
        const recovered = await page.evaluate(() => {
          const profileKey = 'mvuDoctorReferenceProfileStore:chat-a';
          const durableRaw = window.__durableGet(profileKey);
          const mirror = window.MVUDoctorProfileEngine.getStore();
          const durable = durableRaw ? JSON.parse(durableRaw) : null;
          const branchProfileCount = (value) => Object.values(value?.branches || {})
            .reduce((count, branch) => count + Object.keys(branch || {}).length, 0);
          return {
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
            mirror,
            durable,
            mirrorBranchProfiles: branchProfileCount(mirror),
            durableBranchProfiles: branchProfileCount(durable),
            diagnosisCalls: window.__diagnosisRequests.length,
            modelCalls: window.__modelCalls.length,
            latch: window.__mutationLatchCopies(),
          };
        });
        assert.equal(recovered.diagnosisCalls, beforeReload.diagnosisCalls,
          'crash recovery must not replay diagnosis after its durable receipt');
        assert.equal(recovered.modelCalls, beforeReload.modelCalls,
          'stale evidence must be handled before any profile retry');
        const profileFullyCompensated = Object.keys(recovered.mirror.profiles || {}).length === 0
          && Object.keys(recovered.durable?.profiles || {}).length === 0
          && Object.keys(recovered.mirror.profileReceipts || {}).length === 0
          && Object.keys(recovered.durable?.profileReceipts || {}).length === 0
          && recovered.mirrorBranchProfiles === 0
          && recovered.durableBranchProfiles === 0;
        if (profileFullyCompensated) {
          assert.equal(recovered.runtime.lastResult.status, 'stale');
          for (const [source, copy] of Object.entries(recovered.latch)) {
            assert.notEqual(copy?.compromised, true, `${source} must stay clean after exact profile compensation`);
          }
        } else {
          for (const [source, copy] of Object.entries(recovered.latch)) {
            assert.equal(copy?.compromised, true, `${source} must block an uncertain committed profile`);
            assert.equal(copy?.errorCode, 'profile_branch_rollback_failed',
              `${source} must identify the uncompensated durable profile transaction`);
          }
          assert.equal(recovered.runtime.failedStep, '', 'the integrity latch must own recovery after rollback uncertainty');
          assert.notEqual(recovered.checkpoint?.nextStep, 'profile',
            'an uncompensated committed profile must not remain directly retryable');
        }
      } finally { await page.close(); }
    });

    await t.test('reload staleness after an already-committed receipt removes every resumable profile branch without another model call', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        const beforeModelCalls = await page.evaluate(() => window.__modelCalls.length);
        await page.evaluate(async () => {
          const key = 'mvuDoctorReferencePipeline:chat-a';
          const checkpoint = JSON.parse(localStorage.getItem(key));
          localStorage.setItem(key, JSON.stringify({
            ...checkpoint,
            status: 'running', nextStep: 'profile', lastCompletedStep: 'diagnosis',
            reason: 'synthetic-reload-before-profile-finalization', updatedAt: new Date().toISOString(),
          }));
          await window.__emit('chat_loaded');
          window.__staleAfterNextCommittedReceiptRead('user');
        });
        await waitForSettled(page, 'discarded');
        const evidence = await page.evaluate(() => {
          const profileKey = 'mvuDoctorReferenceProfileStore:chat-a';
          const durableRaw = window.__durableGet(profileKey);
          const mirror = window.MVUDoctorProfileEngine.getStore();
          const durable = durableRaw ? JSON.parse(durableRaw) : null;
          const branchProfileCount = (store) => Object.values(store?.branches || {})
            .reduce((count, branch) => count + Object.keys(branch || {}).length, 0);
          return {
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            mirror,
            durable,
            mirrorBranchProfiles: branchProfileCount(mirror),
            durableBranchProfiles: branchProfileCount(durable),
            modelCalls: window.__modelCalls.length,
            latch: window.__mutationLatchCopies(),
          };
        });
        assert.equal(evidence.runtime.lastResult.status, 'stale');
        assert.equal(evidence.modelCalls, beforeModelCalls, 'receipt recovery must not call either diagnosis or profile model again');
        assert.equal(Object.keys(evidence.mirror.profiles || {}).length, 0, 'the recovered committed profile must be compensated');
        assert.equal(Object.keys(evidence.durable?.profiles || {}).length, 0, 'durable active profiles must match the compensation');
        assert.equal(Object.keys(evidence.mirror.profileReceipts || {}).length, 0, 'the stale committed receipt must not remain reusable');
        assert.equal(Object.keys(evidence.durable?.profileReceipts || {}).length, 0, 'the durable stale receipt must be removed');
        assert.equal(evidence.mirrorBranchProfiles, 0, 'a later swipe restore must not resurrect the stale committed profile');
        assert.equal(evidence.durableBranchProfiles, 0, 'durable branch history must not retain a resumable stale profile');
        assert.notEqual(evidence.latch.local?.compromised, true);
      } finally { await page.close(); }
    });

    await t.test('reload of a stale applied diagnosis either compensates every side effect or latches without rediagnosing', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      const originalAssistant = '白露：我先替你看一看伤口。';
      try {
        await installHarness(page, {
          mvuPatchMode: 'apply',
          diagnosisReply: '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/hp","value":11}]</JSONPatch></UpdateVariable>',
        });
        await runAcceptedReply(page, originalAssistant);
        await waitForSettled(page, 'done');
        const before = await page.evaluate(() => ({
          diagnosisCalls: window.__diagnosisRequests.length,
          modelCalls: window.__modelCalls.length,
          assistant: window.__context.chat.at(-1).mes,
          mvu: window.__mvuState(),
          profiles: Object.keys(window.MVUDoctorProfileEngine.getStore().profiles || {}).length,
        }));
        assert.equal(before.mvu.hp, 11);
        assert.match(before.assistant, /<UpdateVariable>/u);
        assert.equal(before.profiles, 1);

        await page.evaluate(async () => {
          const triggeringUser = window.__context.chat.find((message) => message?.is_user);
          triggeringUser.mes = `${String(triggeringUser.mes || '')}\n\nRELOAD_PREVIOUS_USER_STALE_SENTINEL`;
          await window.__emit('chat_loaded');
        });
        await waitForSettled(page, 'failed');
        const evidence = await page.evaluate(() => {
          const profileKey = 'mvuDoctorReferenceProfileStore:chat-a';
          const durableRaw = window.__durableGet(profileKey);
          const mirror = window.MVUDoctorProfileEngine.getStore();
          const durable = durableRaw ? JSON.parse(durableRaw) : null;
          const branchProfileCount = (store) => Object.values(store?.branches || {})
            .reduce((count, branch) => count + Object.keys(branch || {}).length, 0);
          return {
            runtime: window.MVUDoctorProfileEngine.getRuntime(),
            checkpoint: JSON.parse(localStorage.getItem('mvuDoctorReferencePipeline:chat-a') || 'null'),
            mirror,
            durable,
            mirrorBranchProfiles: branchProfileCount(mirror),
            durableBranchProfiles: branchProfileCount(durable),
            assistant: window.__context.chat.at(-1).mes,
            mvu: window.__mvuState(),
            diagnosisCalls: window.__diagnosisRequests.length,
            modelCalls: window.__modelCalls.length,
            latch: window.__mutationLatchCopies(),
          };
        });
        assert.equal(evidence.diagnosisCalls, before.diagnosisCalls, 'reload must not invoke Story diagnosis again');
        assert.equal(evidence.modelCalls, before.modelCalls, 'reload recovery must not invoke the profile model again');
        assert.equal(Object.keys(evidence.mirror.profiles || {}).length, 0, 'the stale diagnosis-bound active profile must be compensated');
        assert.equal(Object.keys(evidence.durable?.profiles || {}).length, 0, 'durable active profiles must match the compensation');
        assert.equal(Object.keys(evidence.mirror.profileReceipts || {}).length, 0, 'the stale profile receipt must not remain reusable');
        assert.equal(Object.keys(evidence.durable?.profileReceipts || {}).length, 0, 'the durable stale profile receipt must be removed');
        assert.equal(evidence.mirrorBranchProfiles, 0, 'no swipe branch may resurrect the stale profile');
        assert.equal(evidence.durableBranchProfiles, 0, 'no durable branch may resurrect the stale profile');

        const diagnosisFullyCompensated = evidence.mvu.hp === 10 && evidence.assistant === originalAssistant;
        if (diagnosisFullyCompensated) {
          assert.notEqual(evidence.latch.local?.compromised, true);
        } else {
          for (const [source, copy] of Object.entries(evidence.latch)) {
            assert.equal(copy?.compromised, true, `${source} must block recovery when no durable diagnosis compensation capsule exists`);
            assert.equal(copy?.errorCode, 'stale_diagnosis_rollback_failed', `${source} must identify the uncompensated diagnosis transaction`);
          }
          assert.notEqual(evidence.checkpoint?.nextStep, 'diagnosis', 'an uncompensated applied diagnosis must not become eligible for another diagnosis call');
          assert.equal(evidence.runtime.failedStep, '', 'the integrity latch, not a retryable diagnosis step, must own recovery');
        }
      } finally { await page.close(); }
    });

    await t.test('successful manual diagnosis supersedes an unreachable old Doctor checkpoint without driving World', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page, { diagnosisReply: '无法识别的诊断文本' });
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
          return { anchor, checkpoint, calls: window.__worldCalls, stages: window.__stages };
        });
        assert.match(evidence.anchor.generationKey, /:manual:/u);
        assert.equal(evidence.checkpoint.status, 'complete');
        assert.ok(evidence.checkpoint.supersededGenerationKey);
        assert.equal(evidence.calls.length, 0);
        assert.deepEqual(evidence.stages, ['diagnosis', 'diagnosis', 'profile']);
        assert.equal(evidence.checkpoint.lastCompletedStep, 'profile');
        assert.equal(evidence.checkpoint.profileTransactionExpected, true);
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
        assert.ok(beforeReload.ids.length >= 3);
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

    await t.test('open profile page refreshes after Doctor commit and World page delegates to native UI', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-tab="profiles"]').click();
        assert.match(await page.locator('[data-page="profiles"]').innerText(), /还没有人物档案/u);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        assert.match(await page.locator('[data-page="profiles"]').innerText(), /白露/u);

        await page.evaluate(() => {
          window.MVUDoctorWorldbookBridgeStatus = {
            status: 'missing', ready: false, chatId: 'chat-a',
            detail: 'WORLD_BOOK_BRIDGE_MISSING_SENTINEL', at: new Date().toISOString(),
          };
        });
        await page.locator('[data-tab="world"]').click();
        const worldPageText = await page.locator('[data-page="world"]').innerText();
        assert.match(worldPageText, /"round": 0/u);
        assert.match(worldPageText, /世界书：未就绪/u);
        assert.match(worldPageText, /WORLD_BOOK_BRIDGE_MISSING_SENTINEL/u);
        await page.locator('[data-page="world"] [data-action="open-native-world"]').click();
        const nativeUi = await page.evaluate(() => ({
          opens: window.__worldPanelOpens,
          refreshes: window.__worldPanelRefreshes,
          manualWorldCalls: window.__worldCalls.length,
        }));
        assert.equal(nativeUi.opens, 1);
        assert.equal(nativeUi.refreshes, 1);
        assert.equal(nativeUi.manualWorldCalls, 0);
      } finally { await page.close(); }
    });

    await t.test('saving the shared connection preserves native World scheduling and persistence controls', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        const before = await page.evaluate(() => window.WORLD_ENGINE_API.getSettings(true));
        await page.locator('#mvu-ref-launcher').click();
        await page.locator('[data-tab="settings"]').click();
        await page.locator('[name="api-endpoint"]').fill('https://new-host.invalid/v1');
        await page.locator('[name="api-model"]').fill('new-model');
        await page.locator('[name="api-key"]').fill('NEW_SECRET_BROWSER_KEY');
        await page.locator('[name="api-proxy"]').check();
        await page.locator('[name="global-prompt"]').fill('新的原生语气附加提示');
        await page.locator('[data-action="save-api"]').click();
        await page.waitForFunction(() => window.MVUDoctorProfileEngine.getRuntime().detail.includes('World原生连接已保存'));
        const evidence = await page.evaluate(() => ({
          settings: window.WORLD_ENGINE_API.getSettings(true),
          manualWorldCalls: window.__worldCalls,
          worldAbortCalls: window.__worldAbortCalls,
          worldStateWrites: window.__worldStateWrites,
        }));
        assert.equal(evidence.settings.apiUrl, 'https://new-host.invalid/v1/chat/completions');
        assert.equal(evidence.settings.model, 'new-model');
        assert.equal(evidence.settings.apiKey, 'NEW_SECRET_BROWSER_KEY');
        assert.equal(evidence.settings.connectionMode, 'proxy');
        assert.equal(evidence.settings.tonePrompt, '新的原生语气附加提示');
        for (const key of ['evolveMode', 'engineEnabled', 'syncToChat', 'injectionEnabled']) {
          assert.equal(evidence.settings[key], before[key], key);
        }
        assert.deepEqual(evidence.manualWorldCalls, []);
        assert.equal(evidence.worldAbortCalls, 0);
        assert.deepEqual(evidence.worldStateWrites, []);
      } finally { await page.close(); }
    });

    await t.test('full report excludes the API key', async () => {
      const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
      try {
        await installHarness(page);
        await runAcceptedReply(page);
        await waitForSettled(page, 'done');
        await page.evaluate(async () => { await window.__emit('chat_loaded'); });
        await page.evaluate(() => {
          window.MVUDoctorWorldbookBridgeStatus = {
            status: 'missing', ready: false, chatId: 'chat-a',
            detail: 'WORLD_BOOK_REPORT_SENTINEL', at: '2026-08-30T00:00:00.000Z',
          };
        });
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
        assert.deepEqual(report.worldbookBridge, {
          status: 'missing', ready: false, chatId: 'chat-a',
          detail: 'WORLD_BOOK_REPORT_SENTINEL', at: '2026-08-30T00:00:00.000Z',
        });
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
        await page.evaluate(async (reply) => {
          window.__resolveProfile(reply);
          await window.__switchChat('chat-b');
        }, profileEnvelope({ ...structuredClone(completeProfile), history: 'STALE_AFTER_RESPONSE_SENTINEL' }));
        await page.waitForFunction(() => window.WORLD_ENGINE_STORE.keys().some((key) => (
          key.startsWith('mvuDoctorReferenceReport:chat-a:entry:')
          && String(window.WORLD_ENGINE_STORE.getItem(key)).includes('STALE_AFTER_RESPONSE_SENTINEL')
        )));
        const evidence = await page.evaluate(() => ({
          stages: window.__stages,
          metadataA: window.__metadataByChat['chat-a'],
          metadataB: window.__metadataByChat['chat-b'],
          saves: window.__saves,
          runtime: window.MVUDoctorProfileEngine.getRuntime(),
          oldReports: window.WORLD_ENGINE_STORE.keys()
            .filter((key) => key.startsWith('mvuDoctorReferenceReport:chat-a:entry:'))
            .map((key) => JSON.parse(window.WORLD_ENGINE_STORE.getItem(key))),
        }));
        assert.deepEqual(evidence.metadataA, {});
        assert.deepEqual(evidence.metadataB, {});
        assert.equal(evidence.saves.length, 0);
        assert.ok(!evidence.stages.includes('world'));
        assert.notEqual(evidence.runtime.phase, 'done');
        const staleReport = evidence.oldReports.find((entry) => entry.result?.profile?.status === 'stale');
        assert.match(staleReport.result.profile.initialRaw, /STALE_AFTER_RESPONSE_SENTINEL/u);
        assert.match(staleReport.result.profile.requestPrompt, /权威目标行/u);
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
          worldAbortCalls: window.__worldAbortCalls,
        }));
        assert.equal(evidence.checkpoint.status, 'cancelled');
        assert.equal(evidence.runtime.phase, 'cancelled');
        assert.equal(evidence.stages.filter((stage) => stage === 'profile').length, 1);
        assert.equal(evidence.stages.filter((stage) => stage === 'world').length, 0);
        assert.equal(evidence.worldAbortCalls, 0);
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
        assert.deepEqual(evidence.stages, ['diagnosis', 'profile']);
        assert.equal(evidence.runtime.lastResult.ok, true);
      } finally { await page.close(); }
    });
  } finally {
    await browser.close();
  }
});
