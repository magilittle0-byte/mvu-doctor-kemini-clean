// Source and version boundaries: docs/guidance/host-source-map.md.
// This bridge owns no generation scheduler and never starts a legacy module.
export const GUIDE_SETTINGS_KEY = 'guidanceBackstageV1';
export const GUIDE_PROMPT_KEY = 'guidance_backstage_v1';
export const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function digest(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonical(value));
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
}
export const fault = (code, detail) => Object.assign(new Error(detail), { code });

// Database's explicit input wrapper only; incomplete/unwrapped input is intact.
function userInput(value) {
  const text = String(value || '');
  if (!text.trimStart().startsWith('以下是用户的本轮输入：')) return text;
  const end = text.lastIndexOf('</本轮用户输入>');
  const start = end < 0 ? -1 : text.lastIndexOf('<本轮用户输入>', end);
  return start < 0 ? text : text.slice(start + '<本轮用户输入>'.length, end).trim();
}

export function createGuideHost({
  getContext = () => globalThis.SillyTavern?.getContext?.(),
  getOpenAI = () => import('/scripts/openai.js'),
  fetchImpl = (...args) => globalThis.fetch(...args),
  getDocument = () => globalThis.document,
} = {}) {
  let disposed = false, requestActive = false;
  const controllers = new Set();
  function context() {
    if (disposed) throw fault('host_disposed', '指导已停用');
    const ctx = getContext();
    if (!ctx) throw fault('host_missing', '酒馆尚未就绪');
    return ctx;
  }
  function scope() {
    const ctx = context(), card = ctx.characters?.[ctx.characterId] || {};
    const chatId = String(ctx.chatId || ctx.chat_id || ctx.getCurrentChatId?.() || '');
    if (!chatId || chatId === 'default') return null;
    return { chatId, character: String(card.avatar || (ctx.characterId ?? '')), groupId: String(ctx.groupId ?? ''),
      worldbook: String(ctx.chatMetadata?.world_info || card.data?.extensions?.world || ''),
      cardVersion: String(card.data?.character_version || '') };
  }
  function messageText(row) {
    const active = row?.swipes?.[Number(row?.swipe_id) || 0];
    return String(typeof active === 'string' ? active : row?.mes || '');
  }
  const isAssistant = row => !!row && !row.is_user && !row.is_system && !!messageText(row).trim();
  const rowsThrough = (chat, index) => chat.slice(0, index + 1).map(row => ({
    user: row?.is_user === true, system: row?.is_system === true,
    swipe: Number(row?.swipe_id) || 0, text: messageText(row),
  }));
  function latestIndex() {
    const chat = context().chat || [];
    for (let i = chat.length - 1; i >= 0; i--) if (isAssistant(chat[i])) return i;
    return -1;
  }
  async function capture(index = latestIndex()) {
    const ctx = context(), currentScope = scope(), row = ctx.chat?.[index];
    if (!currentScope || !Number.isInteger(index) || !isAssistant(row)) return null;
    const content = messageText(row), swipeId = Number(row.swipe_id) || 0;
    if (String(row.mes || '') !== content) return null;
    let userIndex = -1, userText = '';
    for (let i = index - 1; i >= 0; i--) if (ctx.chat[i]?.is_user && !ctx.chat[i]?.is_system) {
      userIndex = i; userText = messageText(ctx.chat[i]); break;
    }
    if (userIndex < 0 || !userText.trim()) return null;
    const scopeSignature = canonical(currentScope), prefixSignature = canonical(rowsThrough(ctx.chat, index));
    const target = { scope: currentScope, scopeSignature, prefixSignature, index, swipeId, userIndex, userText, content,
      scopeKey: await digest(currentScope),
      identity: await digest({ index, swipeId, content, userIndex, userText }),
      lineage: await digest({ scope: currentScope, rows: JSON.parse(prefixSignature) }) };
    assertTarget(target);
    return target;
  }
  function assertTarget(target) {
    const ctx = context(), row = ctx.chat?.[target?.index];
    if (!target || canonical(scope()) !== target.scopeSignature || !isAssistant(row)
      || Number(row.swipe_id || 0) !== target.swipeId || messageText(row) !== target.content || String(row.mes || '') !== target.content
      || ctx.chat?.[target.userIndex]?.is_user !== true || messageText(ctx.chat[target.userIndex]) !== target.userText
      || canonical(rowsThrough(ctx.chat, target.index)) !== target.prefixSignature) {
      throw fault('stale_target', '正文、聊天或此前分支已经变化，旧候选不能提交');
    }
    // Later rows are allowed for history reads; runtime's epoch/current-target
    // check is the sole authority permitting a candidate to commit.
    return true;
  }
  async function captureHistory(toTarget, afterIndex = -1) {
    const target = toTarget || await capture();
    if (!target) return [];
    assertTarget(target);
    const from = Number.isInteger(afterIndex) ? afterIndex : Number(afterIndex?.index ?? -1);
    const result = [];
    for (let i = Math.max(0, from + 1); i <= target.index; i++) {
      if (!isAssistant(context().chat[i])) continue;
      const candidate = await capture(i);
      if (candidate) result.push(candidate);
    }
    assertTarget(target);
    return result;
  }
  async function branches() {
    const currentScope = scope();
    if (!currentScope) return [];
    const rows = rowsThrough(context().chat || [], (context().chat || []).length - 1);
    const signature = canonical(rows), scopeKey = await digest(currentScope), result = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].user || rows[i].system || !rows[i].text.trim()) continue;
      result.push({ index: i, scopeKey, lineage: await digest({ scope: currentScope, rows: rows.slice(0, i + 1) }) });
    }
    if (canonical(scope()) !== canonical(currentScope)
      || canonical(rowsThrough(context().chat || [], (context().chat || []).length - 1)) !== signature)
      throw fault('stale_target', '读取分支时正文发生变化');
    return result;
  }
  function settings() {
    const own = context().extensionSettings?.[GUIDE_SETTINGS_KEY] || {};
    return { enabled: own.enabled !== false, maxTokens: Number.isInteger(own.maxTokens) && own.maxTokens >= 1024 && own.maxTokens <= 16384 ? own.maxTokens : 4096,
      detailsOpen: own.detailsOpen === true };
  }
  function updateSettings(values) {
    const ctx = context(), next = { ...settings() };
    if (typeof values?.enabled === 'boolean') next.enabled = values.enabled;
    if (typeof values?.detailsOpen === 'boolean') next.detailsOpen = values.detailsOpen;
    if (Number.isInteger(values?.maxTokens) && values.maxTokens >= 1024 && values.maxTokens <= 16384) next.maxTokens = values.maxTokens;
    if (!ctx.extensionSettings || typeof ctx.saveSettingsDebounced !== 'function') throw fault('settings_unavailable', '宿主设置接口不可用');
    ctx.extensionSettings[GUIDE_SETTINGS_KEY] = next;
    ctx.saveSettingsDebounced();
    return clone(next);
  }
  async function readback(target) {
    assertTarget(target);
    const ctx = context(), card = ctx.characters?.[ctx.characterId];
    if (ctx.groupId || !card?.avatar || typeof ctx.getRequestHeaders !== 'function')
      throw fault('host_readback_unsupported', '此聊天类型尚无已验证的存档读回接口');
    let response, saved;
    try {
      response = await fetchImpl('/api/chats/get', { method: 'POST', headers: ctx.getRequestHeaders(), cache: 'no-store',
        body: JSON.stringify({ ch_name: card.name, file_name: target.scope.chatId, avatar_url: card.avatar }) });
      if (!response.ok) throw new Error();
      saved = await response.json();
    } catch { throw fault('host_readback_transport', '宿主存档读回失败'); }
    assertTarget(target);
    if (!Array.isArray(saved)) throw fault('host_readback_format', '宿主存档格式不符');
    const offset = saved[0] && !Object.hasOwn(saved[0], 'mes') ? 1 : 0;
    const rows = saved.slice(offset), row = rows[target.index];
    if (!row || String(row.mes || '') !== target.content || canonical(rowsThrough(rows, target.index)) !== target.prefixSignature)
      throw fault('host_readback_target', '尚未从存档读回当前准确正文及分支');
    return true;
  }
  async function material(target, baseline = null, { activatedEntries = [], observed = false, afterIndex } = {}) {
    assertTarget(target);
    const ctx = context(), limitations = [];
    if (typeof ctx.getCharacterCardFields !== 'function')
      throw fault('authority_unavailable', '宿主未提供当前卡读取接口');
    const fields = clone(ctx.getCharacterCardFields() || {});
    const card = ['description', 'personality', 'scenario', 'persona', 'creatorNotes', 'charDepthPrompt']
      .filter(key => typeof fields[key] === 'string' && fields[key].trim()).map(key => `[${key}]\n${fields[key]}`).join('\n\n');
    if (!card.trim()) throw fault('authority_unavailable', '当前卡未取得可读设定，未编造替代内容');
    // Even dry-run getWorldInfoPrompt can write the author's-note prompt in
    // 1.18.0. Only consume the main generation's already observed activation.
    const entries = observed && Array.isArray(activatedEntries) ? clone(activatedEntries) : [];
    const world = entries.filter(entry => entry && !entry.disable && typeof entry.content === 'string' && entry.content.trim())
      .map(entry => entry.content.trim()).join('\n\n');
    if (!world) limitations.push('本轮未取得主请求激活的世界规则；缺依据的事项只能暂缓，不代表世界书不存在。');
    else limitations.push('世界规则来自本轮主请求报告的激活条目；宏未另行运行，不代表全部世界书或正文已消费。');
    const from = Number.isInteger(afterIndex) ? afterIndex : Number.isInteger(baseline) ? baseline : Number(baseline?.index ?? baseline?.target?.index ?? -1);
    const history = ctx.chat.slice(Math.max(0, from + 1), target.index + 1).flatMap((row, offset) => {
      if (!row || row.is_system || !messageText(row).trim()) return [];
      return [{ index: Math.max(0, from + 1) + offset, role: row.is_user ? 'user' : 'assistant',
        content: row.is_user ? userInput(messageText(row)) : messageText(row) }];
    });
    const authority = { card, world };
    const authorityHash = await digest(authority);
    assertTarget(target);
    return { authority, authorityHash, history, players: [...new Set([ctx.name1, ...ctx.chat.slice(0, target.index + 1).filter(row => row.is_user).map(row => row.name)].filter(Boolean))],
      limitations, narrative: target.content, userText: userInput(target.userText), worldMode: world ? 'observed-main-activation' : 'unavailable' };
  }
  async function buildPayload(messages, maxTokens) {
    const ctx = context(), service = ctx.ChatCompletionService;
    if (ctx.mainApi !== 'openai' || typeof service?.presetToGeneratePayload !== 'function' || typeof service?.sendRequest !== 'function')
      throw fault('model_route_unavailable', '当前连接未提供已核对的聊天模型调用接口');
    let native;
    try { native = await getOpenAI(); } catch { throw fault('model_route_unavailable', '当前模型选择接口不可用'); }
    if (typeof native.getChatCompletionModel !== 'function') throw fault('model_route_unavailable', '无法读取当前实际模型');
    const model = native.getChatCompletionModel(ctx.chatCompletionSettings);
    if (!model) throw fault('model_unconfigured', '当前主连接尚未选择模型');
    // Native builder clones current settings. An empty preset preserves them;
    // explicit model is necessary because createGenerationParameters has no fallback.
    const payload = await service.presetToGeneratePayload({}, {}, { model, messages: clone(messages), stream: false, max_tokens: maxTokens });
    if (!payload || payload.model !== model || !payload.chat_completion_source) throw fault('model_route_unavailable', '当前模型路由未能完整解析');
    return { service, payload };
  }
  async function requestFingerprint(maxTokens = settings().maxTokens) {
    const { payload } = await buildPayload([], maxTokens);
    const { messages, user_name, char_name, group_names, ...route } = payload;
    return digest(route);
  }
  async function request(messages, { signal, maxTokens = settings().maxTokens, target } = {}) {
    if (requestActive) throw fault('request_in_progress', '指导已有请求尚未真正结束');
    if (!Array.isArray(messages) || !messages.length || messages.some(row => !['system', 'user', 'assistant'].includes(row?.role) || typeof row?.content !== 'string'))
      throw fault('model_input_invalid', '指导请求格式不完整');
    if (signal?.aborted) throw fault('cancelled', '指导请求已取消');
    context();
    requestActive = true;
    const ctl = new AbortController(), abort = () => ctl.abort();
    controllers.add(ctl); signal?.addEventListener('abort', abort, { once: true });
    const check = () => { if (ctl.signal.aborted || disposed) throw fault('cancelled', '指导请求已取消'); if (target) assertTarget(target); };
    try {
      check();
      const before = await requestFingerprint(maxTokens);
      check();
      const { service, payload } = await buildPayload(messages, maxTokens);
      check();
      const { messages: ignored, user_name, char_name, group_names, ...route } = payload;
      if (await digest(route) !== before) throw fault('model_route_changed', '连接在请求准备期间发生变化');
      check();
      const result = await service.sendRequest(payload, true, ctl.signal);
      check();
      if (await requestFingerprint(maxTokens) !== before) throw fault('model_route_changed', '模型连接已经变化，旧结果未采用');
      check();
      if (typeof result?.content !== 'string' || !result.content.trim()) throw fault('model_empty', '模型没有返回完整文本');
      return result.content;
    } catch (error) {
      if (ctl.signal.aborted || disposed) throw fault('cancelled', '指导请求已取消');
      const allowed = new Set(['stale_target', 'model_route_changed', 'model_route_unavailable', 'model_unconfigured', 'model_empty']);
      if (allowed.has(error?.code)) throw error;
      // Transport errors can include endpoint/key material. Never forward them.
      throw fault('model_transport', '指导模型请求未完成，已有完整记录保留');
    } finally {
      signal?.removeEventListener('abort', abort); controllers.delete(ctl); requestActive = false;
    }
  }
  function setPrompt(text) {
    const ctx = context();
    if (typeof ctx.setExtensionPrompt !== 'function') throw fault('prompt_unavailable', '宿主前置提示接口不可用');
    ctx.setExtensionPrompt(GUIDE_PROMPT_KEY, String(text || ''), 1, 0, false);
  }
  const clearPrompt = () => setPrompt('');
  const isGenerating = () => getDocument()?.body?.dataset?.generating === 'true';
  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(fault('cancelled', '等待已取消'));
      const abort = () => { clearTimeout(timer); reject(fault('cancelled', '等待已取消')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  function destroy() {
    if (disposed) return;
    try { clearPrompt(); } finally { disposed = true; for (const ctl of controllers) ctl.abort(); }
  }
  return Object.freeze({ context, scope, settings, updateSettings, capture, captureHistory, assertTarget, latestIndex,
    branches, material, request, requestFingerprint, readback, setPrompt, clearPrompt, isGenerating, delay, destroy, messageText });
}
