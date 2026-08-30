(() => {
  'use strict';

  const PLUGIN_ID = 'mvu-doctor-kemini-clean';
  const VERSION = '0.8.9-reference-baseline';
  const WORLD_VERSION = '3.0.2';
  const WORLD_GLOBALS = ['WORLD_ENGINE_STORE', 'WORLD_ENGINE_CORE', 'WORLD_ENGINE_API'];
  const WORLD_SETTINGS_KEY = 'world_engine_settings';

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

  function configureWorldSettings(ctx) {
    const store = window.WORLD_ENGINE_STORE;
    const api = window.WORLD_ENGINE_API;
    if (!store?.getItem || !store?.setItem || !api?.getSettings) return;
    const old = oldDoctorSettings(ctx);
    const legacyApi = old.api && typeof old.api === 'object' ? old.api : {};
    let current = {};
    try { current = JSON.parse(store.getItem(WORLD_SETTINGS_KEY) || '{}'); } catch { current = {}; }
    const next = {
      ...current,
      ...(current.apiUrl || !legacyApi.endpoint ? {} : {
        apiUrl: normalizeSharedEndpoint(legacyApi.endpoint),
        apiKey: String(legacyApi.apiKey || ''),
        model: String(legacyApi.model || 'gpt-3.5-turbo'),
        connectionMode: 'proxy',
      }),
      engineEnabled: true,
      injectIntoPrompt: true,
      syncToChat: true,
      autoBackup: true,
      // The original auto listener remains installed but becomes a no-op.  The
      // accepted-final orchestrator calls WORLD_ENGINE.manualEvolve itself after
      // MVU and profile completion.
      evolveMode: 'manual',
    };
    store.setItem(WORLD_SETTINGS_KEY, JSON.stringify(next));
    api.getSettings(true);
    try { window.MEMORY_ENGINE_SETTINGS?.patchSettings?.({ engineEnabled: false, evolveMode: 'manual' }); } catch { /* optional original subsystem */ }
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

  function synchronizeSharedApiSettings(ctx) {
    const store = window.WORLD_ENGINE_STORE;
    const api = window.WORLD_ENGINE_API;
    if (!ctx?.extensionSettings || !store?.getItem || !store?.setItem || !api?.getSettings) return;
    const world = api.getSettings(true) || {};
    const story = ctx.extensionSettings.storyOracle ||= {};
    const legacy = oldDoctorSettings(ctx)?.api || {};
    const worldReady = Boolean(world.apiUrl && world.model);
    const storyReady = Boolean(story.endpoint && story.model);
    const endpoint = normalizeSharedEndpoint(worldReady ? world.apiUrl : (storyReady ? story.endpoint : legacy.endpoint));
    const model = String(worldReady ? world.model : (storyReady ? story.model : legacy.model || '')).trim();
    const apiKey = String(worldReady ? world.apiKey || '' : (storyReady ? story.apiKey || '' : legacy.apiKey || ''));
    const connectionMode = worldReady ? world.connectionMode : (story.directViaBackend === false ? 'direct' : 'proxy');
    if (!endpoint || !model) return;
    let current = {};
    try { current = JSON.parse(store.getItem(WORLD_SETTINGS_KEY) || '{}'); } catch { current = {}; }
    store.setItem(WORLD_SETTINGS_KEY, JSON.stringify({
      ...current, apiUrl: endpoint, model, apiKey, connectionMode,
      engineEnabled: true, injectIntoPrompt: true, syncToChat: true, evolveMode: 'manual',
    }));
    api.getSettings(true);
    Object.assign(story, {
      mode: 'direct', endpoint, model, apiKey,
      directViaBackend: connectionMode === 'proxy', directRawUrl: true, autoDiagnoseEnabled: false,
    });
    ctx.saveSettingsDebounced?.();
    const worldReadback = api.getSettings(true) || {};
    if (normalizeSharedEndpoint(worldReadback.apiUrl) !== endpoint || String(worldReadback.model || '') !== model
      || String(worldReadback.apiKey || '') !== apiKey || worldReadback.connectionMode !== connectionMode
      || normalizeSharedEndpoint(story.endpoint) !== endpoint || String(story.model || '') !== model
      || String(story.apiKey || '') !== apiKey || story.directRawUrl !== true) {
      throw new Error('Story Oracle与World Engine的共用API同步后读回不一致');
    }
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
    configureWorldSettings(ctx || context());

    const storyAlreadyLoaded = Boolean(window.StoryOracleAPI);
    if (!storyAlreadyLoaded) {
      await loadScript(`${root}/vendor/story-oracle-v1.35.4/index.js`, 'mvu-ref-story-entry');
    }
    // A script element alone is not readiness evidence.  Always await the exact
    // original hook API, including when Story Oracle was installed separately.
    await waitFor(() => Boolean(window.StoryOracleAPI?.unsafe?.eval), '故事神谕完整运行层', 60000);
    assertStoryContract();
    seedStoryOracleSettings(ctx || context());
    synchronizeSharedApiSettings(ctx || context());

    await loadScript(`${root}/profile-engine.js`, 'mvu-ref-profile-entry');
    await waitFor(() => Boolean(window.MVUDoctorProfileEngine?.ready), '人物档案填表引擎');
    window.MVUDoctorProfileEngine.installWorldContextBridge?.();

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
