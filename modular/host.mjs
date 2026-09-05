import { clone, canonical, digest, fault, equal, usable } from './variables/core.mjs';

export function createHost(getContext = () => globalThis.SillyTavern?.getContext?.()) {
  function context() { const ctx = getContext(); if (!ctx) throw fault('host_missing', '酒馆尚未就绪'); return ctx; }
  function scope() {
    const ctx = context();
    const chatId = String(ctx.chatId || ctx.chat_id || ctx.getCurrentChatId?.() || '');
    const card = ctx.characters?.[ctx.characterId] || {};
    if (!chatId || chatId === 'default') return null;
    return {
      chatId, character: String(card.avatar || (ctx.characterId ?? '')), groupId: String(ctx.groupId ?? ''),
      worldbook: String(ctx.chatMetadata?.world_info || card.data?.extensions?.world || ''),
      cardVersion: String(card.data?.character_version || ''),
    };
  }
  function messageText(message) {
    const id = Number(message?.swipe_id) || 0;
    const active = message?.swipes?.[id];
    return String(typeof active === 'string' ? active : message?.mes || '').trim();
  }
  function latestIndex() {
    const chat = context().chat || [];
    for (let i = chat.length - 1; i >= 0; i--) if (!chat[i]?.is_user && !chat[i]?.is_system && messageText(chat[i])) return i;
    return -1;
  }
  async function capture(index = latestIndex()) {
    const ctx = context(), currentScope = scope();
    const message = ctx.chat?.[index];
    if (!currentScope || !message || message.is_user || message.is_system || !messageText(message)) return null;
    const content = messageText(message), swipeId = Number(message.swipe_id) || 0;
    if (String(message.mes || '').trim() !== content) return null;
    let userIndex = -1, userText = '';
    for (let i = index - 1; i >= 0; i--) if (ctx.chat[i]?.is_user) { userIndex = i; userText = messageText(ctx.chat[i]); break; }
    if (userIndex < 0 || !userText) return null;
    const scopeSignature = canonical(currentScope);
    const identity = await digest({ index, swipeId, content, userIndex, userText });
    const target = { scope: currentScope, scopeSignature, scopeKey: await digest(currentScope), identity, index, swipeId, content, userIndex, userText };
    assertTarget(target);
    return target;
  }
  function assertTarget(target) {
    const ctx = context(), currentScope = scope();
    const message = ctx.chat?.[target?.index];
    if (!target || canonical(currentScope) !== target.scopeSignature || !message || message.is_user || message.is_system
      || (Number(message.swipe_id) || 0) !== target.swipeId || messageText(message) !== target.content || String(message.mes || '').trim() !== target.content
      || messageText(ctx.chat?.[target.userIndex]) !== target.userText || ctx.chat?.[target.userIndex]?.is_user !== true
      || ctx.chat.slice(target.index + 1).some(row => row && !row.is_system && (row.is_user || messageText(row)))) {
      throw fault('stale_target', '正文、swipe或聊天已经变化，旧任务已作废');
    }
  }
  async function previousMvu(target, mvu) {
    assertTarget(target);
    const ctx = context();
    for (let i = target.index - 1; i >= 0; i--) {
      if (!ctx.chat[i] || ctx.chat[i].is_user || ctx.chat[i].is_system) continue;
      const payload = clone(await mvu.getMvuData({ type: 'message', message_id: i }));
      assertTarget(target);
      if (usable(payload)) return { index: i, swipeId: Number(ctx.chat[i].swipe_id) || 0, content: messageText(ctx.chat[i]), payload };
    }
    return null;
  }
  function contextSnapshot(target) {
    assertTarget(target);
    const ctx = context();
    return { ...ctx, chat: clone(ctx.chat.slice(0, target.index + 1)) };
  }
  function settings() {
    const ctx = context();
    const own = ctx.extensionSettings?.mvuDoctorModular || {};
    const prior = ctx.extensionSettings?.['mvu-doctor-kemini-clean']?.mvuDoctorReferenceSettings || {};
    return {
      enabled: own.enabled !== false,
      maxAttempts: Math.max(1, Math.min(6, Math.floor(Number(own.maxAttempts) || 3))),
      globalPrompt: String(own.globalPrompt ?? prior.globalPrompt ?? ''),
    };
  }
  function updateSettings(values) {
    const ctx = context();
    ctx.extensionSettings.mvuDoctorModular = { ...settings(), ...values };
    ctx.saveSettingsDebounced?.();
  }
  async function saveChat(target, expected) {
    assertTarget(target);
    const ctx = context();
    if (typeof ctx.saveChat !== 'function') throw fault('host_save_missing', '宿主未提供聊天保存接口');
    await ctx.saveChat(); assertTarget(target);
    return readback(target, expected);
  }
  async function readback(target, expected) {
    assertTarget(target);
    const ctx = context();
    // Use the host's own getChat route to verify persisted data, rather than
    // confusing getMvuData's live message mirror with disk readback.
    const card = ctx.characters?.[ctx.characterId];
    if (ctx.groupId || !card?.avatar) throw fault('host_readback_unsupported', '当前宿主作用域尚无已验证的存档读回适配');
    const response = await fetch('/api/chats/get', {
      method: 'POST', headers: ctx.getRequestHeaders(), cache: 'no-store',
      body: JSON.stringify({ ch_name: card.name, file_name: target.scope.chatId, avatar_url: card.avatar }),
    });
    assertTarget(target);
    if (!response.ok) throw fault('host_readback_transport', '宿主存档读回请求失败');
    const rows = await response.json(); assertTarget(target);
    if (!Array.isArray(rows)) throw fault('host_readback_format', '宿主存档读回格式不符');
    const offset = rows[0] && !Object.hasOwn(rows[0], 'mes') ? 1 : 0;
    const row = rows[target.index + offset];
    if (!row || messageText(row) !== target.content || Number(row.swipe_id || 0) !== target.swipeId) throw fault('host_readback_target', '宿主存档中没有读回当前精确正文');
    const saved = Array.isArray(row.variables) ? row.variables[target.swipeId] : row.variables;
    if (expected && !equal(saved, expected)) throw fault('host_mvu_durable_mismatch', '宿主存档变量与候选不一致，不能宣称修复已保存');
    return true;
  }
  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(fault('cancelled', '任务已取消'));
      const onAbort = () => { clearTimeout(timer); reject(fault('cancelled', '任务已取消')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
  return Object.freeze({ context, scope, capture, latestIndex, messageText, assertTarget, previousMvu, contextSnapshot, settings, updateSettings, saveChat, readback, delay });
}
