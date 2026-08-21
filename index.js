(() => {
  'use strict';

  const PLUGIN_ID = 'mvu-doctor-kemini-clean';
  const PROMPT_KEY = 'mvu-doctor-kemini-clean-runtime';
  const DEFAULTS = Object.freeze({ enabled: true, ticketCount: 8, recallLimit: 8, worldEngine: true, repairAttempts: 2 });
  const scriptUrl = document.currentScript?.src || '';
  const runtime = {
    core: null,
    active: null,
    timer: null,
    internalGeneration: false,
    epoch: 0,
    status: { phase: '正在初始化', detail: '', profiles: 0, branches: 0, durationMs: 0 },
  };

  const getContext = () => window.SillyTavern?.getContext?.();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function randomUnit() {
    if (window.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0] / 0x100000000;
    }
    return Math.random();
  }

  function settings(context = getContext()) {
    context.extensionSettings ||= {};
    context.extensionSettings[PLUGIN_ID] = { ...DEFAULTS, ...(context.extensionSettings[PLUGIN_ID] || {}) };
    return context.extensionSettings[PLUGIN_ID];
  }

  function saveSettings(context = getContext()) {
    if (typeof context?.saveSettingsDebounced === 'function') context.saveSettingsDebounced();
  }

  function metadata(context = getContext()) {
    context.chatMetadata ||= {};
    context.chatMetadata[PLUGIN_ID] ||= { schemaVersion: 1, world: { branches: [], npcIntents: [], agreements: [], hostilePlans: [], summary: '' }, diagnostics: [] };
    return context.chatMetadata[PLUGIN_ID];
  }

  async function saveMetadata(context = getContext()) {
    if (typeof context?.saveMetadata === 'function') await context.saveMetadata();
    else if (typeof context?.saveChat === 'function') await context.saveChat();
  }

  function latestMessage(context, user) {
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    for (let index = chat.length - 1; index >= 0; index -= 1) {
      if (Boolean(chat[index]?.is_user) === user && typeof chat[index]?.mes === 'string') return { index, message: chat[index] };
    }
    return null;
  }

  function clearInjection(context = getContext()) {
    try { context?.setExtensionPrompt?.(PROMPT_KEY, '', 1, 1, false, 0); } catch { /* host unavailable */ }
  }

  function setStatus(phase, detail = '', extra = {}) {
    runtime.status = { ...runtime.status, phase, detail, ...extra };
    const root = document.getElementById(`${PLUGIN_ID}-root`);
    if (!root) return;
    root.querySelector('[data-role="phase"]').textContent = runtime.status.phase;
    root.querySelector('[data-role="detail"]').textContent = runtime.status.detail;
    root.querySelector('[data-role="metrics"]').textContent = `档案 ${runtime.status.profiles} · 活跃世界项 ${runtime.status.branches} · ${Math.round(runtime.status.durationMs / 100) / 10}s`;
    root.dataset.state = /失败|缺少|不可用/.test(`${phase}${detail}`) ? 'error' : /完成|就绪/.test(phase) ? 'ready' : 'busy';
  }

  function addDiagnostic(kind, detail, context = getContext()) {
    const store = metadata(context);
    store.diagnostics.unshift({ at: new Date().toISOString(), kind, detail: String(detail || '') });
    store.diagnostics = store.diagnostics.slice(0, 30);
  }

  async function getMvu() {
    if (window.Mvu) return window.Mvu;
    try {
      if (window.TavernHelper?.waitGlobalInitialized) await window.TavernHelper.waitGlobalInitialized('Mvu');
    } catch { /* fall through */ }
    return window.Mvu || null;
  }

  async function mvuDataAt(Mvu, messageId) {
    if (!Mvu?.getMvuData || !Number.isInteger(Number(messageId))) return null;
    try { return await Promise.resolve(Mvu.getMvuData({ type: 'message', message_id: Number(messageId) })); }
    catch { return null; }
  }

  async function waitForMvuIdle(Mvu, session) {
    while (typeof Mvu?.isDuringExtraAnalysis === 'function' && Mvu.isDuringExtraAnalysis()) {
      if (session.cancelled || runtime.epoch !== session.epoch) throw new Error('任务已被新回合或聊天切换取消');
      await sleep(250);
    }
  }

  function activeWorldCount(world) {
    return ['branches', 'npcIntents', 'agreements', 'hostilePlans']
      .flatMap((key) => world?.[key] || []).filter((entry) => entry.status !== 'resolved').length;
  }

  async function prepareGeneration() {
    const context = getContext();
    const config = settings(context);
    if (!config.enabled || !runtime.core || runtime.internalGeneration) return;
    if (runtime.active) return;
    const chatId = String(context?.chatId || '');
    const latestAi = latestMessage(context, false);
    const latestUser = latestMessage(context, true);
    const session = {
      id: `gen-${Date.now().toString(36)}-${Math.floor(randomUnit() * 0xffffff).toString(36)}`,
      epoch: ++runtime.epoch,
      chatId,
      baselineIndex: latestAi?.index ?? -1,
      baselineText: latestAi?.message?.mes || '',
      startedAt: Date.now(),
      cancelled: false,
      tickets: runtime.core.generateTicketBatch(config.ticketCount, randomUnit),
    };
    runtime.active = session;
    let data = null;
    const Mvu = await getMvu();
    if (Mvu && latestAi) data = await mvuDataAt(Mvu, latestAi.index);
    const profiles = runtime.core.profilesFromData(data);
    const recall = runtime.core.selectWorldRecall(metadata(context).world, latestUser?.message?.mes || '', profiles, config.recallLimit);
    const injection = runtime.core.formatGenerationInjection({
      tickets: session.tickets,
      recall,
      profileDigest: runtime.core.profileDigestFromData(data),
    });
    try {
      context.setExtensionPrompt(PROMPT_KEY, injection, 1, 1, false, 0);
      setStatus('正文生成中', `已注入 ${session.tickets.length} 张候选票据和 ${recall.length} 条相关世界记录`);
    } catch (error) {
      session.cancelled = true;
      runtime.active = null;
      setStatus('生成前注入失败', error.message || String(error));
    }
  }

  async function rollbackMvu(Mvu, oldData, messageId) {
    try {
      await Mvu.replaceMvuData(runtime.core.deepClone(oldData), { type: 'message', message_id: messageId });
      return true;
    } catch { return false; }
  }

  async function repairProfileReceipt(session, message, reason, data) {
    const context = getContext();
    if (typeof context?.generateRaw !== 'function') throw new Error('酒馆generateRaw不可用，无法修复人物档案回执');
    const systemPrompt = `你是MVU人物档案格式修复器，不重写正文，不重新随机人格。根据最终正文、本轮既定characterCreationTicket和已有档案摘要，输出且只输出<人物档案更新>[完整JSON档案对象...]</人物档案更新>或<人物档案无变化/>。新人物必须使用一个未重复的本轮ticketId，personality必须保持该票据十四轴。所有规定字段和列表完整；正文缺失信息可以做不冲突推断并写入inferences；禁止未知、待定、未登记。旧人物回传合并后的完整档案。`;
    const prompt = `修复原因：${reason}\n本轮票据：${JSON.stringify(session.tickets)}\n已有档案摘要：${JSON.stringify(runtime.core.profileDigestFromData(data))}\n最终正文：${runtime.core.stripProfileReceipt(message)}`;
    runtime.internalGeneration = true;
    try {
      return await context.generateRaw({ systemPrompt, prompt, trimNames: false, responseLength: 3000 });
    } finally {
      runtime.internalGeneration = false;
    }
  }

  async function commitProfiles(session, messageId, message) {
    const Mvu = await getMvu();
    const hasMvu = Mvu?.getMvuData && Mvu?.parseMessage && Mvu?.replaceMvuData;
    if (hasMvu) await waitForMvuIdle(Mvu, session);
    const oldData = hasMvu ? await mvuDataAt(Mvu, messageId) : null;
    let receiptText = message;
    let receipt = runtime.core.parseProfileReceipt(receiptText);
    if (receipt.kind === 'nochange') return { ok: true, changed: 0, data: oldData };
    let prepared = receipt.kind === 'update'
      ? runtime.core.prepareProfileBatch(receipt.profiles, session.tickets, oldData)
      : { ok: false, errors: [receipt.error || '人物档案回执无效'] };
    const attempts = Math.max(0, Math.min(3, Number(settings().repairAttempts) || 0));
    for (let attempt = 0; !prepared.ok && attempt < attempts; attempt += 1) {
      try {
        setStatus('正在修复人物档案', `第 ${attempt + 1}/${attempts} 次：${prepared.errors.slice(0, 3).join('；')}`);
        receiptText = await repairProfileReceipt(session, message, prepared.errors.join('；'), oldData);
        receipt = runtime.core.parseProfileReceipt(receiptText);
        if (receipt.kind === 'nochange') return { ok: true, changed: 0, data: oldData };
        prepared = receipt.kind === 'update'
          ? runtime.core.prepareProfileBatch(receipt.profiles, session.tickets, oldData)
          : { ok: false, errors: [receipt.error || '修复模型没有返回有效档案回执'] };
      } catch (error) {
        prepared = { ok: false, errors: [`修复请求失败：${error.message || error}`] };
      }
    }
    if (!prepared.ok) return { ok: false, error: `整批档案校验失败，零写入：${prepared.errors.slice(0, 8).join('；')}` };
    if (!hasMvu) return { ok: false, error: 'MVU接口不可用，完整档案已生成但未写入任何状态' };
    if (!oldData) return { ok: false, error: '无法读取最终正文对应的MVU状态' };
    const patch = runtime.core.buildProfilePatch(oldData, prepared.profiles);
    let candidate;
    try { candidate = await Mvu.parseMessage(patch.block, runtime.core.deepClone(oldData)); }
    catch (error) { return { ok: false, error: `MVU无法解析人物档案补丁，零写入：${error.message || error}` }; }
    if (!runtime.core.verifyCommittedProfiles(candidate, prepared.profiles)) return { ok: false, error: 'MVU解析结果没有完整包含全部档案，零写入' };
    try {
      await Mvu.replaceMvuData(candidate, { type: 'message', message_id: messageId });
      const readback = await mvuDataAt(Mvu, messageId);
      if (!runtime.core.verifyCommittedProfiles(readback, prepared.profiles)) {
        const rolledBack = await rollbackMvu(Mvu, oldData, messageId);
        return { ok: false, error: `档案写入后读回不一致；${rolledBack ? '已回滚原状态' : '回滚失败，请勿继续本聊天'}` };
      }
      return { ok: true, changed: prepared.profiles.length, data: readback };
    } catch (error) {
      const rolledBack = await rollbackMvu(Mvu, oldData, messageId);
      return { ok: false, error: `档案提交失败；${rolledBack ? '已回滚原状态' : '回滚也失败'}：${error.message || error}` };
    }
  }

  async function advanceWorld(session, acceptedText, data) {
    const context = getContext();
    if (!settings(context).worldEngine) return { ok: true, skipped: true };
    if (typeof context?.generateRaw !== 'function') return { ok: false, error: '酒馆generateRaw不可用，世界引擎未推进' };
    const store = metadata(context);
    const systemPrompt = `你是独立世界推进器。根据已接受正文、已有世界状态和人物档案摘要，更新未决支线与NPC自主行动倾向。NPC的intent只能记录准备或尝试，不能把未在正文中裁决的尝试写成成功结果。不得替玩家决定行动、感受、同意或关系。只输出一个JSON对象，不要代码围栏：{"summary":"","branches":[],"npcIntents":[],"agreements":[],"hostilePlans":[]}。每项字段：id,title,actor,location,keywords,status(active|waiting|resolved|failed),intent,consequence。保留仍有效的旧项，合并重复项，已解决项标resolved。`;
    const prompt = `已有世界状态：\n${JSON.stringify(store.world)}\n人物档案摘要：\n${JSON.stringify(runtime.core.profileDigestFromData(data))}\n最终接受正文：\n${runtime.core.stripProfileReceipt(acceptedText)}`;
    try {
      runtime.internalGeneration = true;
      const raw = await context.generateRaw({ systemPrompt, prompt, trimNames: false, responseLength: 1800 });
      if (session.cancelled || runtime.epoch !== session.epoch || String(getContext()?.chatId || '') !== session.chatId) throw new Error('世界推进结果已过期');
      store.world = runtime.core.parseWorldState(raw, store.world);
      await saveMetadata(context);
      return { ok: true, world: store.world };
    } catch (error) {
      return { ok: false, error: `世界引擎失败：${error.message || error}` };
    } finally {
      runtime.internalGeneration = false;
    }
  }

  async function acceptFinal(session) {
    const context = getContext();
    if (session.cancelled || runtime.epoch !== session.epoch || String(context?.chatId || '') !== session.chatId) return;
    const latestAi = latestMessage(context, false);
    if (!latestAi || (latestAi.index === session.baselineIndex && latestAi.message.mes === session.baselineText)) {
      setStatus('最终正文未确认', '500ms后没有读到新的最终助手消息');
      return;
    }
    setStatus('医生处理中', '正在校验整批人物档案');
    const profileResult = await commitProfiles(session, latestAi.index, latestAi.message.mes);
    if (!profileResult.ok) {
      addDiagnostic('profile_failed', profileResult.error, context);
      await saveMetadata(context);
      setStatus('人物档案失败', profileResult.error, { durationMs: Date.now() - session.startedAt });
      return;
    }
    setStatus('人物档案已完成', profileResult.changed ? `原子提交 ${profileResult.changed} 张完整档案` : '本轮明确无档案变化');
    const worldResult = await advanceWorld(session, latestAi.message.mes, profileResult.data);
    const world = metadata(context).world;
    const profileCount = Object.keys(runtime.core.profilesFromData(profileResult.data)).length;
    if (!worldResult.ok) {
      addDiagnostic('world_failed', worldResult.error, context);
      await saveMetadata(context);
      setStatus('档案完成，世界引擎失败', worldResult.error, { profiles: profileCount, branches: activeWorldCount(world), durationMs: Date.now() - session.startedAt });
      return;
    }
    addDiagnostic('completed', `档案变更${profileResult.changed}张；世界项${activeWorldCount(world)}条`, context);
    await saveMetadata(context);
    setStatus('本轮医生完成', `档案与世界状态均已落定`, { profiles: profileCount, branches: activeWorldCount(world), durationMs: Date.now() - session.startedAt });
  }

  function endGeneration() {
    if (runtime.internalGeneration) return;
    const session = runtime.active;
    runtime.active = null;
    clearInjection();
    if (!session || session.cancelled) return;
    if (runtime.timer) clearTimeout(runtime.timer);
    runtime.timer = setTimeout(() => {
      runtime.timer = null;
      void acceptFinal(session);
    }, 500);
  }

  function cancelCurrent(reason = '已取消') {
    runtime.epoch += 1;
    if (runtime.active) runtime.active.cancelled = true;
    runtime.active = null;
    if (runtime.timer) clearTimeout(runtime.timer);
    runtime.timer = null;
    clearInjection();
    setStatus(reason, '不会伪造档案或世界推进进度');
  }

  function mountUi() {
    if (document.getElementById(`${PLUGIN_ID}-root`)) return;
    const root = document.createElement('section');
    root.id = `${PLUGIN_ID}-root`;
    root.dataset.state = 'busy';
    root.innerHTML = `<button class="mvu-kc-toggle" type="button" title="MVU人物与世界医生">🩺</button><div class="mvu-kc-panel"><div class="mvu-kc-title">MVU 人物与世界医生</div><div data-role="phase">正在初始化</div><div data-role="detail" class="mvu-kc-detail"></div><div data-role="metrics" class="mvu-kc-metrics">档案 0 · 活跃世界项 0 · 0s</div><label><input data-role="enabled" type="checkbox"> 启用</label><label>候选票据 <input data-role="tickets" type="number" min="1" max="24"></label><label>召回上限 <input data-role="recall" type="number" min="1" max="16"></label><label><input data-role="world" type="checkbox"> 正文后推进世界</label><button data-role="cancel" type="button">取消当前医生任务</button></div>`;
    document.body.appendChild(root);
    const context = getContext();
    const config = settings(context);
    root.querySelector('[data-role="enabled"]').checked = config.enabled;
    root.querySelector('[data-role="tickets"]').value = config.ticketCount;
    root.querySelector('[data-role="recall"]').value = config.recallLimit;
    root.querySelector('[data-role="world"]').checked = config.worldEngine;
    root.querySelector('.mvu-kc-toggle').addEventListener('click', () => root.classList.toggle('open'));
    root.querySelector('[data-role="cancel"]').addEventListener('click', () => cancelCurrent('用户已取消'));
    for (const [role, key, converter] of [['enabled', 'enabled', Boolean], ['tickets', 'ticketCount', Number], ['recall', 'recallLimit', Number], ['world', 'worldEngine', Boolean]]) {
      root.querySelector(`[data-role="${role}"]`).addEventListener('change', (event) => {
        settings(context)[key] = converter === Boolean ? event.target.checked : converter(event.target.value);
        saveSettings(context);
      });
    }
  }

  async function init() {
    if (!scriptUrl) throw new Error('无法定位扩展core.mjs');
    runtime.core = await import(new URL('./core.mjs', scriptUrl).href);
    let context = getContext();
    for (let attempt = 0; !context?.eventSource?.on && attempt < 120; attempt += 1) {
      await sleep(250);
      context = getContext();
    }
    if (!context?.eventSource?.on) throw new Error('SillyTavern事件接口不可用');
    settings(context);
    mountUi();
    const types = context.eventTypes || context.event_types || {};
    context.eventSource.on(types.GENERATION_STARTED || 'generation_started', async (_type, params = {}, dryRun) => {
      if (dryRun === true || params?.dryRun === true || params?.quiet === true || runtime.internalGeneration) return;
      await prepareGeneration();
    });
    context.eventSource.on(types.GENERATION_ENDED || 'generation_ended', endGeneration);
    context.eventSource.on(types.GENERATION_STOPPED || 'generation_stopped', () => cancelCurrent('生成已停止'));
    for (const event of [types.CHAT_CHANGED || 'chat_changed', types.CHAT_LOADED || 'chat_loaded']) {
      context.eventSource.on(event, () => cancelCurrent('聊天已切换'));
    }
    const store = metadata(context);
    setStatus('医生已就绪', '等待下一次正文生成', { branches: activeWorldCount(store.world) });
    console.info('[MVU Kemini Clean] initialized');
  }

  init().catch((error) => {
    console.error('[MVU Kemini Clean] init failed', error);
    mountUi();
    setStatus('医生初始化失败', error.message || String(error));
  });
})();
