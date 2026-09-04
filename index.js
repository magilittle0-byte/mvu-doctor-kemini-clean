(() => {
  'use strict';

  const PLUGIN_ID = 'mvu-doctor-kemini-clean';
  const VERSION = '0.9.4';
  const WORLD_VERSION = '3.0.2';
  const WORLD_GLOBALS = ['WORLD_ENGINE_STORE', 'WORLD_ENGINE_CORE', 'WORLD_ENGINE_API'];
  const WORLD_SETTINGS_KEY = 'world_engine_settings';
  const WORLD_BOOK_INITIALIZER = Symbol.for('mvu-doctor.native-worldbook-initializer');
  const WORLD_EVOLUTION_BARRIER = Symbol.for('mvu-doctor.native-world-diagnosis-barrier');
  const WORLD_DIALOGUE_FILTER_BRIDGE = Symbol.for('mvu-doctor.native-world-dialogue-filter');
  const WORLD_API_SERIAL_LANE = Symbol.for('mvu-doctor.shared-world-api-serial-lane');
  const WORLD_ACTOR_CONTEXT_BRIDGE = Symbol.for('mvu-doctor.native-world-actor-context');
  const MVU_DIALOGUE_FILTERS = [
    '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gi',
    '/<UpdateVariable>[\\s\\S]*$/i',
  ];
  let worldbookInitialization = { chatId: '', promise: null, attempt: 0 };
  let worldbookAttemptSerial = 0;

  function filterMvuMechanismBlocks(value) {
    return String(value ?? '')
      .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '')
      .replace(/<UpdateVariable>[\s\S]*$/i, '');
  }

  function installWorldDialogueFilterBridge() {
    const core = window.WORLD_ENGINE_CORE;
    if (!core?.filterDialogue) return false;
    if (core[WORLD_DIALOGUE_FILTER_BRIDGE]) return true;
    const original = core.filterDialogue.bind(core);
    core.filterDialogue = function(value, settings, onError) {
      const withoutMechanismBlocks = filterMvuMechanismBlocks(value);
      return filterMvuMechanismBlocks(original(withoutMechanismBlocks, settings, onError));
    };
    Object.defineProperty(core, WORLD_DIALOGUE_FILTER_BRIDGE, {
      value: { original }, configurable: false,
    });
    return true;
  }

  function installWorldApiSerialLane() {
    const api = window.WORLD_ENGINE_API;
    if (!api?.callApi) return false;
    if (api[WORLD_API_SERIAL_LANE]) return true;
    const original = api.callApi.bind(api);
    let tail = Promise.resolve();
    let sequence = 0;
    api.callApi = function(...args) {
      sequence += 1;
      const signal = args[3];
      const run = async () => {
        if (signal?.aborted) {
          const error = new Error('请求已取消');
          error.name = 'AbortError';
          throw error;
        }
        return original(...args);
      };
      // Doctor profiles, native World and native Memory deliberately share
      // this one transport.  Serialize only their individual network calls;
      // each engine keeps its own scheduler, retry, rollback and task state.
      const request = tail.then(run, run);
      tail = request.then(() => undefined, () => undefined);
      return request;
    };
    Object.defineProperty(api, WORLD_API_SERIAL_LANE, {
      value: { original, sequence: () => sequence }, configurable: false,
    });
    return true;
  }

  function buildWorldActorContextSection(actorSeeds, enabled = true) {
    if (!enabled || !Array.isArray(actorSeeds)) return '';
    const profileContext = actorSeeds.length
      ? `${JSON.stringify(actorSeeds)}`
      : '本轮人物阶段没有可投影的完整非玩家档案。不要因此停止世界：只从当前世界状态、已选世界书和近期对话中已经存在的势力、环境或社会过程选择主体；不得凭空杜撰人物档案。';
    return `========== 非玩家行动主体（Doctor人物档案投影） ==========
以下档案只提供非玩家主体的有限视角、目标、能力与约束，不表示这些行动已经发生，也不得覆盖世界书、当前世界状态或本轮已接受正文。
每轮先从这些人物、当前世界状态中的势力，或环境/社会过程里选择至少一个真实存在的非玩家主体；根据其自身目标、有限知识、资源、弱点、阻力与所需时间，形成一项具体的尝试、准备、观察或计划变化，再用World原生字段记录其结果。主体的尝试不等于成功，必须经过世界规则裁决。私密行动只进入blackbox；只有被观察、留痕或传播后的后果才能进入公开字段。当前状态中仍有效的secretActions与secretAssets必须在本轮blackbox继续返回；只在已经完成、曝光、失效或有事实更新时改变或移除，不能因为本轮无变化而省略。推进可以与{{user}}完全无关；不得替{{user}}决定行动、对白、感受、同意或结果。
${profileContext}`;
  }

  function installWorldActorContextBridge() {
    const memory = window.MEMORY_ENGINE;
    if (!memory?.buildWorldEngineContext) return false;
    const existing = memory[WORLD_ACTOR_CONTEXT_BRIDGE];
    if (existing?.version === VERSION && memory.buildWorldEngineContext === existing.installed) return true;
    const originalBuildWorldEngineContext = typeof existing?.original === 'function'
      ? existing.original : memory.buildWorldEngineContext.bind(memory);
    memory.buildWorldEngineContext = function(...args) {
      const nativeContext = originalBuildWorldEngineContext(...args);
      let actorSeeds = [];
      let actorContextEnabled = false;
      try {
        const profileEngine = window.MVUDoctorProfileEngine;
        actorContextEnabled = profileEngine?.worldActorContextEnabled?.() === true;
        actorSeeds = profileEngine?.getWorldActorSeeds?.(args[0]) || [];
      } catch (error) {
        // Actor context is an optional mature World prompt extension.  A
        // profile read fault must not replace or block native Memory context.
        console.warn('[MVU Doctor] 非玩家行动主体读取失败；World保留原生Memory上下文继续', error);
      }
      const actorContext = buildWorldActorContextSection(actorSeeds, actorContextEnabled);
      if (!actorContext) return nativeContext;
      return [String(nativeContext || '').trim(), actorContext].filter(Boolean).join('\n\n');
    };
    Object.defineProperty(memory, WORLD_ACTOR_CONTEXT_BRIDGE, {
      value: {
        original: originalBuildWorldEngineContext,
        installed: memory.buildWorldEngineContext,
        version: VERSION,
      },
      configurable: true,
    });
    return true;
  }

  function publishWorldbookBridgeStatus(status, detail = '', expectedChatId = '') {
    const currentChatId = String(window.WORLD_ENGINE_WORLDBOOK?.getChatId?.() || '');
    if (expectedChatId && currentChatId !== expectedChatId) return false;
    window.MVUDoctorWorldbookBridgeStatus = {
      status,
      ready: status === 'ready',
      chatId: currentChatId,
      detail: String(detail || ''),
      at: new Date().toISOString(),
    };
    return true;
  }

  function context() {
    try { return window.SillyTavern?.getContext?.() || null; }
    catch { return null; }
  }

  function baseUrl() {
    const scripts = [...document.getElementsByTagName('script')];
    const own = scripts.find((script) => /mvu-doctor-kemini-clean\/index\.js(?:\?|$)/i.test(String(script.src || '')))
      || document.currentScript;
    const src = String(own?.src || '');
    return src ? src.slice(0, src.lastIndexOf('/')) : './scripts/extensions/third-party/mvu-doctor-kemini-clean';
  }

  function loadStyle(url, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }

  function loadScript(url, id) {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === 'true') return Promise.resolve();
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = id;
      script.src = url;
      script.async = false;
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
      script.addEventListener('error', () => reject(new Error(`加载参考源码失败：${url}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function waitFor(test, label, timeoutMs = 30000) {
    const started = Date.now();
    while (!test()) {
      if (Date.now() - started > timeoutMs) throw new Error(`${label}在${Math.ceil(timeoutMs / 1000)}秒内没有完成初始化`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  function oldDoctorSettings(ctx) {
    const stored = ctx?.extensionSettings?.[PLUGIN_ID];
    return stored && typeof stored === 'object' ? stored : {};
  }

  function normalizeSharedEndpoint(value) {
    const endpoint = String(value || '').trim().replace(/\/+$/, '');
    if (!endpoint) return '';
    return /\/chat\/completions$/i.test(endpoint) ? endpoint : `${endpoint}/chat/completions`;
  }

  function seedStoryOracleSettings(ctx) {
    if (!ctx?.extensionSettings) return;
    const old = oldDoctorSettings(ctx);
    const target = ctx.extensionSettings.storyOracle ||= {};
    let changed = false;
    // The unmodified Story Oracle listens to MESSAGE_RECEIVED.  Kemini owns the
    // accepted-final boundary, so its bridge invokes the original diagnose chain
    // explicitly and keeps the native listener dormant.
    if (target.autoDiagnoseEnabled !== false) {
      target.autoDiagnoseEnabled = false;
      changed = true;
    }
    if (target.autoDiagnoseDelayMs == null) {
      target.autoDiagnoseDelayMs = 600;
      changed = true;
    }
    const legacyApi = old.api && typeof old.api === 'object' ? old.api : {};
    if (!target.endpoint && legacyApi.endpoint) {
      target.mode = 'direct';
      target.endpoint = normalizeSharedEndpoint(legacyApi.endpoint);
      target.apiKey = String(legacyApi.apiKey || '');
      target.model = String(legacyApi.model || '');
      target.directViaBackend = true;
      target.directRawUrl = true;
      changed = true;
    }
    if (changed) {
      try { ctx.saveSettingsDebounced?.(); } catch { /* reference UI remains authoritative */ }
    }
  }

  function migrateWorldSettings(ctx) {
    const store = window.WORLD_ENGINE_STORE;
    const api = window.WORLD_ENGINE_API;
    if (!store?.getItem || !store?.setItem || !api?.getSettings) return;
    const old = oldDoctorSettings(ctx);
    const legacyApi = old.api && typeof old.api === 'object' ? old.api : {};
    let current = {};
    try { current = JSON.parse(store.getItem(WORLD_SETTINGS_KEY) || '{}'); } catch { current = {}; }
    const migrationKey = 'mvu_doctor_native_world_owner_v1';
    const migrated = store.getItem(migrationKey) === 'done';
    const memoryMigrationKey = 'mvu_doctor_native_memory_owner_v1';
    const memoryMigrationState = store.getItem(memoryMigrationKey);
    const memoryMigrated = memoryMigrationState === 'done';
    const forced08Signature = current.evolveMode === 'manual'
      && current.engineEnabled === true
      && current.injectIntoPrompt === true
      && current.syncToChat === true
      && current.autoBackup === true;
    const legacyMemoryProvenance = memoryMigrationState === 'pending'
      || (!migrated && forced08Signature);
    if (!memoryMigrated && !migrated && forced08Signature) {
      // Keep independent proof before changing the World signature.  If the
      // Memory API is temporarily unavailable, a later boot can still finish
      // this migration instead of silently stranding disabled/manual state.
      store.setItem(memoryMigrationKey, 'pending');
    }
    let evolveFilterRegex = String(current.evolveFilterRegex || '');
    const worldCore = window.WORLD_ENGINE_CORE;
    const filterDialogue = worldCore?.[WORLD_DIALOGUE_FILTER_BRIDGE]?.original || worldCore?.filterDialogue;
    if (typeof filterDialogue === 'function') {
      const nonMandatoryLines = evolveFilterRegex.split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !MVU_DIALOGUE_FILTERS.includes(line));
      const customFilterRegex = nonMandatoryLines.join('\n');
      const probes = [
        {
          expected: '前文后文',
          sample: '前文<UpdateVariable>MVU_DOCTOR_CLOSED_OUTER_090<JSONPatch>MVU_DOCTOR_CLOSED_INNER_090</JSONPatch></UpdateVariable>后文',
        },
        {
          expected: '前文',
          sample: '前文<UpdateVariable>MVU_DOCTOR_OPEN_OUTER_090<JSONPatch>MVU_DOCTOR_OPEN_INNER_090',
        },
      ];
      const requiresMandatoryPrefix = probes.some((probe) => {
        const filtered = filterDialogue(probe.sample, { ...current, evolveFilterRegex: customFilterRegex });
        // Removing only the tag spelling or the nested JSONPatch is
        // insufficient: Analysis/other payloads would still contaminate
        // World.  The complete outer block must disappear exactly.
        return filtered !== probe.expected;
      });
      // Mandatory closed-before-open order must precede user filters.  An open
      // rule placed first would consume the rest of a valid closed block.  The
      // exact lines are de-duplicated on every migration pass, so settings do
      // not grow when a broad user rule strips only tags.
      evolveFilterRegex = [
        ...(requiresMandatoryPrefix ? MVU_DIALOGUE_FILTERS : []),
        ...nonMandatoryLines,
      ].join('\n');
    }
    const next = {
      ...current,
      ...(!current.apiUrl && legacyApi.endpoint ? {
        apiUrl: normalizeSharedEndpoint(legacyApi.endpoint),
        apiKey: String(legacyApi.apiKey || ''),
        model: String(legacyApi.model || 'gpt-3.5-turbo'),
        connectionMode: 'proxy',
      } : {}),
      // 0.8.x wrote this exact five-field signature on every boot.  Only that
      // signature is migrated; any deviation is treated as a user-owned World
      // setting and remains untouched.
      ...(!migrated && forced08Signature
        ? { evolveMode: 'auto', syncToChat: false, autoBackup: false } : {}),
      evolveFilterRegex,
    };
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      store.setItem(WORLD_SETTINGS_KEY, JSON.stringify(next));
      api.getSettings(true);
    }
    if (!memoryMigrated && legacyMemoryProvenance) {
      // 0.8.x also disabled the bundled Memory Engine on every boot.  Restore
      // only that exact forced pair, and only while the World signature above
      // proves this is our legacy write rather than a user-owned preference.
      try {
        const memory = window.MEMORY_ENGINE_SETTINGS;
        if (!memory?.getSettings || !memory?.patchSettings) throw new Error('原版Memory设置接口尚未就绪');
        let memorySettings = memory.getSettings(true);
        if (memorySettings?.engineEnabled === false && memorySettings?.evolveMode === 'manual') {
          memory.patchSettings({ engineEnabled: true, evolveMode: 'auto' });
          memorySettings = memory.getSettings(true);
          if (memorySettings?.engineEnabled !== true || memorySettings?.evolveMode !== 'auto') {
            throw new Error('原版Memory设置写入后未能读回');
          }
        }
        store.setItem(memoryMigrationKey, 'done');
      } catch (error) {
        console.warn('[MVU Doctor] 旧版Memory强制设置迁移尚未完成；下次启动将重试', error);
      }
    }
    if (!migrated) store.setItem(migrationKey, 'done');
  }

  async function initializeWorldbookSelectionOnce() {
    const worldbook = window.WORLD_ENGINE_WORLDBOOK;
    if (!worldbook?.getChatId || !worldbook?.hasSelection
      || !worldbook?.loadCurrentEntries || !worldbook?.saveSelectedIds) return false;
    const currentChatId = String(worldbook.getChatId() || '');
    if (!currentChatId || currentChatId === 'default' || worldbook.hasSelection('world')) return false;
    const entries = await worldbook.loadCurrentEntries();
    if (String(worldbook.getChatId() || '') !== currentChatId || worldbook.hasSelection('world')) return false;
    if (!Array.isArray(entries) || entries.length === 0) return false;
    worldbook.saveSelectedIds(entries.filter((entry) => !entry.disabled).map((entry) => entry.id), 'world');
    return true;
  }

  function ensureWorldbookSelectionForCurrentChat(retries = 0) {
    const worldbook = window.WORLD_ENGINE_WORLDBOOK;
    const currentChatId = String(worldbook?.getChatId?.() || '');
    if (!currentChatId || currentChatId === 'default') return Promise.resolve(false);
    if (worldbookInitialization.chatId !== currentChatId) {
      worldbookInitialization = { chatId: currentChatId, promise: null, attempt: 0 };
    }
    if (worldbookInitialization.chatId === currentChatId && worldbookInitialization.promise) {
      return worldbookInitialization.promise;
    }
    const promise = (async () => {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, attempt * 200));
        if (String(worldbook?.getChatId?.() || '') !== currentChatId) return false;
        try {
          if (await initializeWorldbookSelectionOnce()) return true;
          if (worldbook?.hasSelection?.('world')) return true;
        } catch (error) {
          if (attempt >= retries) throw error;
        }
      }
      return false;
    })();
    const attempt = ++worldbookAttemptSerial;
    worldbookInitialization = { chatId: currentChatId, promise, attempt };
    void promise.then((ready) => {
      if (!ready && worldbookInitialization.chatId === currentChatId
        && worldbookInitialization.attempt === attempt
        && worldbookInitialization.promise === promise) worldbookInitialization.promise = null;
    }, () => {
      if (worldbookInitialization.chatId === currentChatId
        && worldbookInitialization.attempt === attempt
        && worldbookInitialization.promise === promise) worldbookInitialization.promise = null;
    });
    return promise;
  }

  function installWorldbookSelectionInitializer(ctx) {
    if (window[WORLD_BOOK_INITIALIZER]) return;
    const eventSource = ctx?.eventSource;
    if (!eventSource?.on) return;
    const run = () => setTimeout(() => {
      const nextChatId = String(window.WORLD_ENGINE_WORLDBOOK?.getChatId?.() || '');
      if (worldbookInitialization.chatId !== nextChatId) {
        worldbookInitialization = { chatId: nextChatId, promise: null, attempt: 0 };
      }
      publishWorldbookBridgeStatus('pending', '正在读取当前聊天的内嵌世界书选择', nextChatId);
      const selectionPromise = ensureWorldbookSelectionForCurrentChat(2);
      const scheduledAttempt = worldbookInitialization.attempt;
      const ownsCurrentAttempt = () => String(window.WORLD_ENGINE_WORLDBOOK?.getChatId?.() || '') === nextChatId
        && worldbookInitialization.chatId === nextChatId
        && worldbookInitialization.attempt === scheduledAttempt
        && (worldbookInitialization.promise === selectionPromise || worldbookInitialization.promise === null);
      void selectionPromise.then((ready) => {
        if (!ownsCurrentAttempt()) return;
        publishWorldbookBridgeStatus(
          ready ? 'ready' : 'pending',
          ready ? '本聊天的原版World世界书选择已就绪' : '尚未读取到可选择的内嵌世界书；首次推演前会再次尝试',
          nextChatId,
        );
      }).catch((error) => {
        if (!ownsCurrentAttempt()) return;
        publishWorldbookBridgeStatus('pending', `原版世界书预热失败：${error?.message || error}`, nextChatId);
        console.warn('[MVU Doctor] 原版世界书首次选择初始化失败，将在本聊天首次推演前重试', error);
      });
    }, 0);
    const eventName = ctx?.event_types?.CHAT_LOADED || ctx?.eventTypes?.CHAT_LOADED || 'chat_loaded';
    eventSource.on(eventName, run);
    Object.defineProperty(window, WORLD_BOOK_INITIALIZER, { value: { eventName }, configurable: false });
    run();
  }

  function installWorldEvolutionDiagnosisBarrier() {
    const evolution = window.WORLD_ENGINE_EVOLUTION;
    if (!evolution?.evolve) return false;
    const existing = evolution[WORLD_EVOLUTION_BARRIER];
    if (existing?.version === VERSION && evolution.evolve === existing.installed) return true;
    if (existing && (typeof existing !== 'object' || typeof existing.original !== 'function')) return false;
    const original = typeof existing?.original === 'function'
      ? existing.original : evolution.evolve.bind(evolution);
    const installed = async function(state, userMsg, aiMsg, opts) {
      const evolutionChatId = String(window.WORLD_ENGINE_WORLDBOOK?.getChatId?.() || '');
      const stillEvolutionChat = () => String(window.WORLD_ENGINE_WORLDBOOK?.getChatId?.() || '') === evolutionChatId;
      // The native settings UI remains user-owned and may be edited after
      // boot.  Keep the same mature Story block filter at this single runtime
      // boundary so a deleted setting cannot reintroduce raw MVU mechanism
      // text into World; persisted World settings and scheduling stay intact.
      const safeAiMsg = filterMvuMechanismBlocks(aiMsg);
      const hasDialogueText = Boolean(opts && Object.prototype.hasOwnProperty.call(opts, 'dialogueText'));
      const safeOpts = hasDialogueText
        ? { ...opts, dialogueText: filterMvuMechanismBlocks(opts.dialogueText) }
        : opts;
      // All native manual paths, including manual time evolution, may run when
      // the chat ends on a user row and therefore have no assistant row to
      // diagnose. Inspect the original aiMsg rather than safeAiMsg: a real
      // assistant row made solely of an MVU block must still pass the identity
      // gate instead of masquerading as the no-assistant path.
      const hasAssistantInput = Boolean(String(aiMsg || '').trim());
      try {
        let ready = await ensureWorldbookSelectionForCurrentChat(2);
        const worldbook = window.WORLD_ENGINE_WORLDBOOK;
        const currentChatId = String(worldbook?.getChatId?.() || '');
        if (currentChatId !== evolutionChatId) return false;
        if (!ready && currentChatId && currentChatId !== 'default'
          && !worldbook?.hasSelection?.('world')) {
          // A CHAT_LOADED prewarm may have completed before the embedded book
          // became readable.  Its resolved false Promise must not make the
          // first actual World turn skip initialization.
          if (worldbookInitialization.chatId === currentChatId) {
            worldbookInitialization.promise = null;
          }
          ready = await ensureWorldbookSelectionForCurrentChat(3);
          if (!stillEvolutionChat()) return false;
        }
        publishWorldbookBridgeStatus(
          ready ? 'ready' : 'missing',
          ready
            ? '本聊天的原版World世界书选择已就绪'
            : '首次推演仍未读取到内嵌世界书选择；World将按原生空选择语义继续，本轮需在诊断页核查',
          evolutionChatId,
        );
        if (!ready) console.warn('[MVU Doctor] 首次推演未能取得内嵌世界书选择；已记录到Doctor诊断状态');
      } catch (error) {
        if (!stillEvolutionChat()) return false;
        publishWorldbookBridgeStatus('error', `首次推演世界书初始化失败：${error?.message || error}`, evolutionChatId);
        console.warn('[MVU Doctor] 本轮世界书首次选择初始化失败；原版World将按自己的空选择语义继续', error);
      }
      if (!stillEvolutionChat()) return false;
      if (hasAssistantInput) {
        try {
          const receipt = await window.MVUDoctorProfileEngine?.waitForWorldDiagnosis?.({
            aiMsg: safeAiMsg,
            dialogueText: safeOpts?.dialogueText,
            throughProfile: true,
          });
          if (!stillEvolutionChat()) return false;
          if (receipt?.status === 'stale') return false;
        } catch (error) {
          if (!stillEvolutionChat()) return false;
          // A bridge fault must not permanently kill the mature World lifecycle.
          // The native dialogue filter still prevents MVU mechanism blocks from
          // entering the evolution prompt, so continuing is the recoverable path.
          console.warn('[MVU Doctor] 变量确认屏障异常；World按已过滤正文继续', error);
        }
      }
      if (!stillEvolutionChat()) return false;
      return original(state, userMsg, safeAiMsg, safeOpts);
    };
    evolution.evolve = installed;
    if (existing) {
      try {
        Object.assign(existing, { original, installed, version: VERSION });
      } catch {
        evolution.evolve = original;
        return false;
      }
    } else {
      Object.defineProperty(evolution, WORLD_EVOLUTION_BARRIER, {
        value: { original, installed, version: VERSION }, configurable: true,
      });
    }
    const receipt = evolution[WORLD_EVOLUTION_BARRIER];
    return receipt?.version === VERSION
      && receipt?.installed === installed
      && evolution.evolve === installed;
  }

  function assertWorldContract() {
    const missing = [...WORLD_GLOBALS, 'WORLD_ENGINE'].filter((name) => !window[name]);
    if (missing.length) throw new Error(`世界引擎运行合同不完整：缺少${missing.join('、')}`);
    if (typeof window.WORLD_ENGINE.manualEvolve !== 'function') throw new Error('世界引擎缺少manualEvolve入口');
    const bundled = Boolean(document.getElementById('mvu-ref-world-entry'));
    const loadedVersion = String(window.WORLD_ENGINE_VERSION || '');
    if (!bundled && loadedVersion !== WORLD_VERSION) {
      throw new Error(`检测到其他世界引擎运行实例（${loadedVersion || '版本未知'}）；本版只接受冻结的${WORLD_VERSION}合同，拒绝静默混用`);
    }
    if (loadedVersion && loadedVersion !== WORLD_VERSION) {
      throw new Error(`世界引擎版本不匹配：需要${WORLD_VERSION}，实际${loadedVersion}`);
    }
  }

  function assertStoryContract() {
    const api = window.StoryOracleAPI;
    if (!api?.isCompatible?.(1) || typeof api?.unsafe?.eval !== 'function') throw new Error('故事神谕Hook API合同不兼容');
    let compatible = false;
    try {
      compatible = api.unsafe.eval(`[
        typeof getCtx, typeof getSettings, typeof getMvu, typeof diagPickerActive,
        typeof buildDiagSelectedWi, typeof buildWorldInfo, typeof wiContextMode,
        typeof collectMvuUpdateRules, typeof resolveAutoTargetMessage,
        typeof extractUpdateBlock, typeof buildDiagnosePromptFrom, typeof beginPostReplyCall,
        typeof showAutoDiagGenerating, typeof dismissToast, typeof callDirect,
        typeof resolveEndpointUrl, typeof callProfile, typeof writeUpdateBlockToMessage,
        typeof refreshMessageBar, typeof notifyAutoDiagnose, typeof cancelPostReply,
        typeof getFixCfg, typeof setFixCfg, typeof awaitMvuIdle, typeof mvuIsBusy
      ].every((kind) => kind === 'function')`);
    } catch { compatible = false; }
    if (!compatible) throw new Error('已安装的故事神谕缺少1.35.4桥接所需函数；拒绝用未知实现冒充冻结原件');
  }

  function exposeBootStatus(status, detail = '') {
    window.MVUDoctorReferenceBaseline = {
      version: VERSION,
      status,
      detail: String(detail || ''),
      references: {
        storyOracle: 'Story Oracle 1.35.4 diagnostic components with pinned-message adapter',
        profileFill: 'Doctor profile fill using Life State Engine 5.35 tolerant parser and one directed repair',
        worldEngine: 'Disnight World Engine 3.0.2',
      },
    };
    window.dispatchEvent(new CustomEvent('mvu-doctor-reference-status', { detail: window.MVUDoctorReferenceBaseline }));
  }

  async function boot() {
    const root = baseUrl();
    const ctx = context();
    exposeBootStatus('loading');
    seedStoryOracleSettings(ctx);

    loadStyle(`${root}/vendor/world-engine-v3.0.2/style.css`, 'mvu-ref-world-style');
    loadStyle(`${root}/vendor/story-oracle-v1.35.4/style.css`, 'mvu-ref-story-style');

    const existingWorldCount = WORLD_GLOBALS.filter((name) => window[name]).length;
    if (existingWorldCount > 0 && existingWorldCount < WORLD_GLOBALS.length) {
      throw new Error('检测到不完整的既有世界引擎全局对象；拒绝在残缺实例上继续加载');
    }
    if (!WORLD_GLOBALS.every((name) => window[name])) {
      await loadScript(`${root}/vendor/world-engine-v3.0.2/world-engine.js`, 'mvu-ref-world-entry');
      await waitFor(() => WORLD_GLOBALS.every((name) => window[name]), '独立世界引擎');
    }
    // WORLD_ENGINE is only exposed after the original loader has hydrated its
    // IndexedDB mirror, loaded every world module and bound the host lifecycle.
    await waitFor(() => Boolean(window.WORLD_ENGINE?.manualEvolve), '独立世界引擎完整运行层', 60000);
    assertWorldContract();
    migrateWorldSettings(ctx || context());
    installWorldApiSerialLane();
    installWorldDialogueFilterBridge();
    installWorldbookSelectionInitializer(ctx || context());

    const storyAlreadyLoaded = Boolean(window.StoryOracleAPI);
    if (!storyAlreadyLoaded) {
      await loadScript(`${root}/vendor/story-oracle-v1.35.4/index.js`, 'mvu-ref-story-entry');
    }
    // A script element alone is not readiness evidence.  Always await the exact
    // original hook API, including when Story Oracle was installed separately.
    await waitFor(() => Boolean(window.StoryOracleAPI?.unsafe?.eval), '故事神谕完整运行层', 60000);
    assertStoryContract();
    seedStoryOracleSettings(ctx || context());
    await loadScript(`${root}/profile-engine.js`, 'mvu-ref-profile-entry');
    await waitFor(() => Boolean(window.MVUDoctorProfileEngine?.ready), '人物档案填表引擎');
    if (window.MVUDoctorProfileEngine.version !== VERSION
      || typeof window.MVUDoctorProfileEngine.getWorldActorSeeds !== 'function'
      || typeof window.MVUDoctorProfileEngine.worldActorContextEnabled !== 'function') {
      throw new Error(`人物档案引擎版本或行动主体接口不匹配：需要${VERSION}，实际${window.MVUDoctorProfileEngine.version || '未知'}`);
    }
    window.MVUDoctorProfileEngine.installWorldPublicProjection?.();
    if (!installWorldActorContextBridge()) throw new Error('原版World缺少Memory人物上下文接缝，拒绝把行动主体适配伪装成就绪');
    if (!installWorldEvolutionDiagnosisBarrier()) throw new Error('原版World推演屏障升级失败，拒绝把旧版等待语义伪装成就绪');

    exposeBootStatus('ready');
    console.info(`[MVU Doctor] ${VERSION} 成熟组件适配链已就绪`);
  }

  window.mvuDoctorKeminiGenerateInterceptor = async function(...args) {
    const delegate = window.worldEngineMemoryGenerateInterceptor;
    if (typeof delegate === 'function') return delegate(...args);
    return undefined;
  };

  boot().catch((error) => {
    exposeBootStatus('failed', error?.message || error);
    console.error('[MVU Doctor] 成熟组件适配链初始化失败', error);
    try { window.toastr?.error?.(error?.message || String(error), 'MVU Doctor 初始化失败'); } catch { /* no-op */ }
  });
})();
