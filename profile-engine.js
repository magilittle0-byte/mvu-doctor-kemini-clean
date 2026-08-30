(() => {
  'use strict';

  const ENGINE_VERSION = '0.8.0-reference-baseline';
  const METADATA_KEY = 'mvuDoctorReferenceProfiles';
  const SETTINGS_KEY = 'mvuDoctorReferenceSettings';
  const REPORT_STORAGE_PREFIX = 'mvuDoctorReferenceReport:';
  const DIAGNOSTIC_STORAGE_PREFIX = 'mvuDoctorReferenceDiagnostics:';
  const PIPELINE_STORAGE_PREFIX = 'mvuDoctorReferencePipeline:';
  const GENERATION_TICKET_PREFIX = 'mvuDoctorReferenceGeneration:';
  const WORLD_RECEIPT_STORAGE_PREFIX = 'mvuDoctorReferenceWorldReceipt:';
  const MAX_HISTORY = 24;
  const MAX_BRANCH_MESSAGES = 8;
  const EMPTY_VALUE = /^(?:未知|不详|待定|待确认|未登记|未说明|暂无|无法确认|unknown|null|n\/a)?$/iu;
  const WORLD_CONTEXT_BRIDGE = Symbol.for('mvu-doctor.reference.world-context-bridge');
  const WORLD_PUBLIC_PROJECTION_BRIDGE = Symbol.for('mvu-doctor.reference.world-public-projection-bridge');
  const STALE_TASK = 'stale_accepted_target';

  // Direct transplant from Life State Engine ver5.35, content lines 295-374.
  // Keep this parser sequence unchanged: fence -> punctuation -> balanced candidates -> trailing commas.
  function stripCodeFence(text) {
    const source = String(text || '').trim();
    const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : source;
  }

  function normalizeJsonPunctuation(text) {
    return String(text || '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/，/g, ',')
      .replace(/：/g, ':');
  }

  function removeJsonTrailingCommas(text) {
    return String(text || '').replace(/,\s*([}\]])/g, '$1');
  }

  function balancedJsonCandidates(text) {
    const source = String(text || '').trim();
    const candidates = [];
    for (let start = 0; start < source.length; start += 1) {
      if (source[start] !== '{' && source[start] !== '[') continue;
      const stack = [];
      let inString = false;
      let escaped = false;
      for (let index = start; index < source.length; index += 1) {
        const character = source[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') {
          inString = true;
          continue;
        }
        if (character === '{' || character === '[') stack.push(character);
        else if (character === '}' || character === ']') {
          const opener = stack.pop();
          if ((opener === '{' && character !== '}') || (opener === '[' && character !== ']')) break;
          if (stack.length === 0) {
            candidates.push(source.slice(start, index + 1));
            start = index;
            break;
          }
        }
      }
    }
    return candidates;
  }

  function parseJsonCandidate(source) {
    const raw = String(source || '').trim();
    const normalized = normalizeJsonPunctuation(raw);
    const candidates = [raw, ...balancedJsonCandidates(raw), normalized, ...balancedJsonCandidates(normalized)];
    const attempts = candidates.flatMap((value) => [value, removeJsonTrailingCommas(value)])
      .filter((value, index, values) => value && values.indexOf(value) === index);
    let lastError = null;
    for (const attempt of attempts) {
      try { return JSON.parse(attempt); } catch (error) { lastError = error; }
    }
    const error = Object.assign(new Error(`外接模型没有返回可修复的 JSON：${lastError?.message || '未知格式错误'}`), {
      code: 'external_json_invalid',
      response_text: String(source || '').slice(0, 6000),
    });
    throw error;
  }

  function parseJsonResponse(text) {
    let source = stripCodeFence(text);
    const tagged = source.match(/^<人物档案\b[^>]*>([\s\S]*?)<\/人物档案>$/i);
    if (tagged) source = tagged[1].trim();
    if (source === 'null') return null;
    return parseJsonCandidate(source);
  }

  function ctx() {
    try { return window.SillyTavern?.getContext?.() || null; }
    catch { return null; }
  }

  function deepClone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) { return String(value ?? '').trim(); }

  function usable(value) {
    const valueText = text(value);
    return valueText.length > 0 && !EMPTY_VALUE.test(valueText);
  }

  function at(object, path) {
    return path.split('.').reduce((value, key) => value?.[key], object);
  }

  function stableId(name) {
    const source = text(name).toLocaleLowerCase();
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `profile-${(hash >>> 0).toString(36)}`;
  }

  function chatId() {
    const context = ctx();
    const hostId = text(context?.chatId || context?.chat_id || context?.getCurrentChatId?.());
    if (hostId && hostId !== 'default') return hostId;
    try {
      const worldId = window.WORLD_ENGINE_CORE?.getChatId?.();
      if (worldId && String(worldId) !== 'default') return String(worldId);
    } catch { /* continue */ }
    return '';
  }

  function emptyStore() {
    return { schema: 2, chatId: chatId(), revision: 0, profiles: {}, branches: {}, history: [], updatedAt: '' };
  }

  function readStore() {
    const currentChatId = chatId();
    if (!currentChatId) return emptyStore();
    const context = ctx();
    const value = context?.chatMetadata?.[METADATA_KEY];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyStore();
    const cloned = deepClone(value);
    if (text(cloned.chatId) && text(cloned.chatId) !== currentChatId) return emptyStore();
    cloned.profiles = cloned.profiles && typeof cloned.profiles === 'object' && !Array.isArray(cloned.profiles) ? cloned.profiles : {};
    cloned.branches = cloned.branches && typeof cloned.branches === 'object' && !Array.isArray(cloned.branches) ? cloned.branches : {};
    cloned.history = Array.isArray(cloned.history) ? cloned.history : [];
    return { ...emptyStore(), ...cloned, chatId: currentChatId };
  }

  async function saveMetadata(context) {
    if (typeof context?.saveMetadata === 'function') {
      await context.saveMetadata();
      return 'durable';
    }
    if (typeof context?.saveChat === 'function') {
      await context.saveChat();
      return 'durable';
    }
    if (typeof context?.saveMetadataDebounced === 'function') {
      context.saveMetadataDebounced();
      throw new Error('宿主只提供去抖保存，无法确认人物档案已经持久化；本次提交已撤回');
    }
    throw new Error('宿主没有可用的聊天元数据保存接口');
  }

  function storeDigest(value) {
    return JSON.stringify({
      schema: Number(value?.schema || 0),
      chatId: text(value?.chatId),
      revision: Number(value?.revision || 0),
      profiles: value?.profiles || {},
      branches: value?.branches || {},
      history: value?.history || [],
    });
  }

  let storeCommitTail = Promise.resolve();

  async function commitStoreNow(next, expectedChatId = chatId(), expectedRevision = null, assertCurrent = null) {
    if (typeof assertCurrent === 'function') assertCurrent();
    const context = ctx();
    if (!expectedChatId || expectedChatId === 'default') throw new Error('当前聊天尚未取得稳定ID，拒绝写入人物档案');
    if (!context?.chatMetadata) throw new Error('当前聊天元数据不可用');
    if (chatId() !== expectedChatId) throw Object.assign(new Error('任务目标聊天已变化，拒绝跨聊天提交'), { code: STALE_TASK });
    const snapshot = deepClone(next);
    snapshot.chatId = expectedChatId;
    snapshot.updatedAt = new Date().toISOString();
    const previous = context.chatMetadata[METADATA_KEY] === undefined
      ? undefined : deepClone(context.chatMetadata[METADATA_KEY]);
    if (expectedRevision !== null && Number(previous?.revision || 0) !== Number(expectedRevision || 0)) {
      throw Object.assign(new Error('人物档案基线版本已变化，旧任务不得覆盖新提交'), { code: STALE_TASK });
    }
    try {
      if (typeof assertCurrent === 'function') assertCurrent();
      if (typeof context.updateChatMetadata === 'function') context.updateChatMetadata({ [METADATA_KEY]: snapshot });
      else context.chatMetadata[METADATA_KEY] = snapshot;
      const persistence = await saveMetadata(context);
      if (typeof assertCurrent === 'function') assertCurrent();
      if (chatId() !== expectedChatId) throw Object.assign(new Error('保存期间聊天已切换，拒绝确认旧任务'), { code: STALE_TASK });
      const freshContext = ctx();
      const readback = freshContext?.chatMetadata?.[METADATA_KEY];
      if (!readback || readback.chatId !== snapshot.chatId || storeDigest(readback) !== storeDigest(snapshot)) {
        throw new Error('人物档案提交后的完整宿主读回不一致');
      }
      return { store: deepClone(readback), persistence };
    } catch (error) {
      const active = ctx();
      if (active && chatId() === expectedChatId && active.chatMetadata) {
        const current = active.chatMetadata[METADATA_KEY];
        if (storeDigest(current) === storeDigest(snapshot)) {
          if (previous === undefined) delete active.chatMetadata[METADATA_KEY];
          else if (typeof active.updateChatMetadata === 'function') active.updateChatMetadata({ [METADATA_KEY]: previous });
          else active.chatMetadata[METADATA_KEY] = previous;
          try { await saveMetadata(active); }
          catch (rollbackError) {
            error.rollbackError = rollbackError?.message || String(rollbackError);
          }
        }
      }
      throw error;
    }
  }

  async function commitStore(next, expectedChatId = chatId(), expectedRevision = null, assertCurrent = null) {
    const previousCommit = storeCommitTail;
    let release;
    storeCommitTail = new Promise((resolve) => { release = resolve; });
    await previousCommit;
    try { return await commitStoreNow(next, expectedChatId, expectedRevision, assertCurrent); }
    finally { release(); }
  }

  function settings() {
    const context = ctx();
    const current = context?.extensionSettings?.['mvu-doctor-kemini-clean']?.[SETTINGS_KEY];
    return {
      enabled: current?.enabled !== false,
      diagnoseEnabled: current?.diagnoseEnabled !== false,
      profileEnabled: current?.profileEnabled !== false,
      worldEnabled: current?.worldEnabled !== false,
      globalPrompt: text(current?.globalPrompt),
      maxTokens: Math.max(3000, Number(current?.maxTokens) || 12000),
      temperature: Math.max(0, Math.min(1.5, Number(current?.temperature) || 0.35)),
    };
  }

  function saveSettings(next) {
    const context = ctx();
    if (!context?.extensionSettings) return;
    const root = context.extensionSettings['mvu-doctor-kemini-clean'] ||= {};
    root[SETTINGS_KEY] = { ...settings(), ...next };
    context.saveSettingsDebounced?.();
  }

  function messageText(message) {
    const swipeId = Number(message?.swipe_id);
    if (Array.isArray(message?.swipes) && Number.isInteger(swipeId) && swipeId >= 0 && swipeId < message.swipes.length) {
      return text(message.swipes[swipeId]);
    }
    return text(message?.mes);
  }

  function activeSwipeSlot(message) {
    const swipeId = Number(message?.swipe_id);
    const hasIndex = Number.isInteger(swipeId) && swipeId >= 0;
    const materialized = hasIndex && Array.isArray(message?.swipes) && typeof message.swipes[swipeId] === 'string';
    return { swipeId: hasIndex ? swipeId : 0, materialized };
  }

  function contentFingerprint(value) {
    const source = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${source.length}-${(hash >>> 0).toString(36)}`;
  }

  function decorateTarget(target) {
    if (!target) return null;
    const currentChatId = chatId();
    if (!currentChatId) return null;
    const decorated = { ...target, chatId: currentChatId, fingerprint: contentFingerprint(target.content) };
    decorated.identity = `${decorated.chatId}:${decorated.index}:${decorated.swipeId}:${decorated.fingerprint}`;
    return decorated;
  }

  function latestAssistant() {
    const chat = ctx()?.chat || [];
    for (let index = chat.length - 1; index >= 0; index -= 1) {
      const message = chat[index];
      if (!message?.is_user && !message?.is_system && messageText(message)) {
        return decorateTarget({ index, message, swipeId: Number(message.swipe_id) || 0, content: messageText(message) });
      }
    }
    return null;
  }

  function targetIsCurrent(target) {
    if (!target || chatId() !== target.chatId) return false;
    const message = ctx()?.chat?.[target.index];
    if (!message || message.is_user || message.is_system) return false;
    const latest = latestAssistant();
    const hasLaterNarrativeMessage = (ctx()?.chat || []).slice(target.index + 1)
      .some((item) => item && !item.is_system && (item.is_user || messageText(item)));
    return !hasLaterNarrativeMessage
      && latest?.index === target.index
      && latest?.identity === target.identity
      && (Number(message.swipe_id) || 0) === Number(target.swipeId)
      && contentFingerprint(messageText(message)) === target.fingerprint;
  }

  function requireCurrentTarget(target, stage) {
    if (targetIsCurrent(target)) return;
    throw Object.assign(new Error(`${stage}时最终正文已变化，本次旧任务已丢弃`), { code: STALE_TASK });
  }

  function branchKey(messageId, swipeId, fingerprint) { return `${Number(messageId)}:${Number(swipeId) || 0}:${text(fingerprint)}`; }
  function branchBaseKey(messageId, fingerprint) { return `${Number(messageId)}:base:${text(fingerprint)}`; }

  function pruneBranches(branches) {
    const source = branches && typeof branches === 'object' ? branches : {};
    const messageIds = [...new Set(Object.keys(source).map((key) => Number(key.split(':')[0])).filter(Number.isInteger))]
      .sort((left, right) => right - left);
    const keep = new Set(messageIds.slice(0, MAX_BRANCH_MESSAGES));
    return Object.fromEntries(Object.entries(source).filter(([key]) => keep.has(Number(key.split(':')[0]))));
  }

  function profileNameSet(profile) {
    return new Set([profile?.name, ...(profile?.aliases || [])].map((value) => text(value).toLocaleLowerCase()).filter(Boolean));
  }

  function findUniqueExistingProfile(profiles, candidate) {
    if (candidate?.profileId && profiles[candidate.profileId]) return profiles[candidate.profileId];
    const candidateNames = profileNameSet(candidate);
    const matches = Object.values(profiles).filter((profile) => [...profileNameSet(profile)].some((name) => candidateNames.has(name)));
    if (matches.length > 1) throw new Error(`人物${candidate?.name || '未命名'}与多个既有档案别名冲突，拒绝猜测合并`);
    return matches[0] || null;
  }

  function previousUser(index) {
    const chat = ctx()?.chat || [];
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (chat[cursor]?.is_user) return messageText(chat[cursor]);
    }
    return '';
  }

  function recentContext(index, limit = 6) {
    const chat = ctx()?.chat || [];
    return chat.slice(Math.max(0, index - limit), index + 1).map((message, offset) => ({
      role: message?.is_user ? 'user' : (message?.is_system ? 'system' : 'assistant'),
      text: messageText(message).slice(0, 7000),
      index: Math.max(0, index - limit) + offset,
    }));
  }

  function playerNames(target) {
    const context = ctx();
    const names = new Set([
      context?.name1,
      context?.user_name,
      context?.userName,
      previousUser(target.index).match(/(?:真名|姓名|名字|落款真名)\s*[：:]\s*([^\s，。；;]+)/u)?.[1],
    ].map(text).filter(Boolean));
    return [...names];
  }

  const REQUIRED_TEXT = [
    'name', 'identity.species', 'identity.gender', 'identity.age', 'identity.occupation',
    'identity.affiliation', 'identity.socialPosition', 'appearance.overall', 'appearance.body',
    'appearance.face', 'appearance.hair', 'appearance.voice', 'appearance.physiology',
    'personality.temperament', 'personality.coreDesire', 'personality.values', 'personality.thinking',
    'personality.attachment', 'personality.socialMotive', 'personality.interest', 'personality.conflict',
    'personality.stress', 'personality.moralBoundary', 'personality.expression', 'personality.actionHabit',
    'personality.weakness', 'personality.humor', 'history', 'currentState.location',
    'currentState.condition', 'currentState.emotion', 'currentState.goal',
  ];
  const REQUIRED_ARRAYS = ['aliases', 'relationships', 'knowledge', 'capabilities', 'resources', 'evidence', 'inferences'];

  function validateProfile(profile, index) {
    const errors = [];
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return [`第${index + 1}张档案不是对象`];
    for (const path of REQUIRED_TEXT) if (!usable(at(profile, path))) errors.push(`第${index + 1}张档案缺少${path}`);
    for (const path of REQUIRED_ARRAYS) {
      const value = at(profile, path);
      if (!Array.isArray(value)) errors.push(`第${index + 1}张档案的${path}必须是数组`);
      else if (path !== 'aliases' && value.length < 1) errors.push(`第${index + 1}张档案的${path}不能为空`);
    }
    return errors;
  }

  function normalizeEnvelope(value) {
    if (Array.isArray(value)) return { profiles: value, detectedCharacters: value.map((profile) => text(profile?.name)).filter(Boolean), noProfileReason: '' };
    if (!value || typeof value !== 'object') return { profiles: [], detectedCharacters: [], noProfileReason: '', invalid: true };
    const profiles = Array.isArray(value.profiles) ? value.profiles : [];
    const detectedCharacters = Array.isArray(value.detectedCharacters)
      ? value.detectedCharacters.map(text).filter(Boolean)
      : profiles.map((profile) => text(profile?.name)).filter(Boolean);
    return { ...value, profiles, detectedCharacters, noProfileReason: text(value.noProfileReason) };
  }

  function validateEnvelope(envelope, players, requiredCandidates = []) {
    const errors = [];
    if (envelope.invalid) errors.push('返回顶层必须是对象');
    if (!Array.isArray(envelope.profiles)) errors.push('profiles必须是数组');
    const excluded = new Set(players.map((name) => name.toLocaleLowerCase()));
    const names = new Set();
    const coveredNames = new Set();
    const nameOwners = new Map();
    envelope.profiles.forEach((profile, index) => {
      errors.push(...validateProfile(profile, index));
      const name = text(profile?.name).toLocaleLowerCase();
      for (const profileName of profileNameSet(profile)) {
        if (excluded.has(profileName) || PLAYER_LABEL.test(profileName)) errors.push(`玩家身份或玩家代词${profileName}不得写入NPC档案姓名或别名`);
        const priorOwner = nameOwners.get(profileName);
        if (priorOwner !== undefined && priorOwner !== index) errors.push(`第${priorOwner + 1}张与第${index + 1}张档案共享姓名或别名${profileName}`);
        else nameOwners.set(profileName, index);
      }
      if (name && names.has(name)) errors.push(`人物${profile.name}重复`);
      if (name) names.add(name);
      for (const candidateName of profileNameSet(profile)) coveredNames.add(candidateName);
    });
    if (envelope.detectedCharacters.length > 0 && envelope.profiles.length === 0) errors.push('检测到人物但没有返回完整档案');
    const detected = new Set(envelope.detectedCharacters.map((name) => name.toLocaleLowerCase()));
    for (const name of names) if (!detected.has(name)) errors.push(`完整档案${name}没有出现在detectedCharacters`);
    for (const name of detected) if (!names.has(name)) errors.push(`detectedCharacters中的${name}没有对应完整档案`);
    for (const candidate of requiredCandidates) {
      if (!coveredNames.has(text(candidate).toLocaleLowerCase())) errors.push(`高置信人物${candidate}没有对应完整档案或别名`);
    }
    if (envelope.profiles.length === 0) {
      if (!usable(envelope.noProfileReason) || envelope.noProfileReason.length < 8) errors.push('空档案结果必须说明本轮为何确实没有可持续记录的NPC');
      if (requiredCandidates.length) errors.push(`正文存在必须核对的人物候选：${requiredCandidates.join('、')}`);
    }
    return errors;
  }

  const LABEL_BLOCKLIST = new Set([
    '状态', '档案', '人物', '世界', '任务', '选项', '时间', '地点', '环境', '系统', '用户', '玩家',
    '主人公', '主角', '契约者', '当前环境', '任务进度', '回廊地图', '世界状态', '变量更新', '人物档案',
    '剧情摘要', '本轮摘要', '状态更新', '副本情报', '敌情警戒', '职业树', '旁白',
    '正文', '摘要', '变量', '属性', '生命', '法力', '力量', '敏捷', '体质', '智力', '精神', '魅力',
    'content', 'details', 'summary', 'updatevariable', 'jsonpatch',
  ]);
  const NON_PERSON_LABEL = /(?:环境|地图|任务|进度|状态|档案|世界|回廊|旁白|系统|变量|更新|摘要|情报|警戒|选项|属性|数值|面板|记录|正文|总览|目标|事件|物资库)$/u;
  const PLAYER_LABEL = /^(?:user|玩家|用户|主人公|主角|契约者|我|你)$/iu;
  const PLAYER_PROSE_PREFIX = /^(?:你|我|咱|我们|你们|玩家|用户)/u;
  const SUBJECT_FUNCTION_SUFFIX = /(?:会|要|想|将|能|可|正|又|也|都|还)$/u;

  function highConfidenceCandidates(target, store, players) {
    const content = target?.content || '';
    const excluded = new Set(players.map((name) => name.toLocaleLowerCase()));
    const found = new Set();
    const add = (value) => {
      const name = text(value).replace(/^[【\[（(]|[】\]）)]$/g, '');
      const key = name.toLocaleLowerCase();
      if (name.length < 2 || name.length > 40 || excluded.has(key) || LABEL_BLOCKLIST.has(key)
        || NON_PERSON_LABEL.test(name) || PLAYER_LABEL.test(name)) return;
      found.add(name);
    };
    for (const profile of Object.values(store.profiles || {})) {
      for (const name of [profile?.name, ...(profile?.aliases || [])]) if (usable(name) && content.includes(name)) add(profile.name || name);
    }
    for (const match of content.matchAll(/(?:^|[。！？!?\n])\s*([\p{Script=Han}A-Za-z·]{2,12})\s*(?:说道|问道|答道|笑道|开口|低声说|轻声说)/gu)) add(match[1]);
    // Only the short subject immediately after a sentence boundary is hard.
    // Longer natural-language fragments remain model-owned soft evidence.
    for (const match of content.matchAll(/(?:^|[。！？!?；;\n，“”])\s*([\p{Script=Han}]{2,4})(?:微微|轻轻|缓缓|悄悄|偷偷|忽然|突然|随即|慢慢|默默)?\s*(?:把|点头|摇头|伸手|皱眉|挑眉|眨眼|开口|回答|笑着|笑道|收起|记下|写下|藏起|抬眼|垂眼)/gu)) {
      const subject = match[1];
      if (!PLAYER_PROSE_PREFIX.test(subject) && !SUBJECT_FUNCTION_SUFFIX.test(subject)) add(subject);
    }
    for (const match of content.matchAll(/\b(?:NPC|ACTOR)[-_ ]?\d+\b/giu)) add(match[0]);
    return [...found];
  }

  function suggestedCandidates(target, players) {
    const content = target?.content || '';
    const excluded = new Set(players.map((name) => name.toLocaleLowerCase()));
    const found = new Set();
    const add = (value) => {
      const name = text(value).replace(/^[【\[（(]|[】\]）)]$/g, '');
      const key = name.toLocaleLowerCase();
      if (name.length < 2 || name.length > 40 || excluded.has(key) || LABEL_BLOCKLIST.has(key)
        || NON_PERSON_LABEL.test(name) || PLAYER_LABEL.test(name)) return;
      found.add(name);
    };
    const cardName = text(ctx()?.name2);
    if (cardName && content.includes(cardName)) add(cardName);
    for (const match of content.matchAll(/(?:^|\n)\s*[【\[]?([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9_.·-]{1,31})[】\]]?\s*[：:]/gu)) add(match[1]);
    for (const match of content.matchAll(/(?:一名|一位|那名|那位|这名|这位|眼前的|柜台后的|门边的|身旁的)([\p{Script=Han}]{0,6}?(?:老妇人|少女|少年|老人|掌柜|店主|侍者|商人|旅人|男人|女人|守卫|士兵|医师|学者|店员|官员|僧人|道人))(?!时代|时期|照片|画像|雕像|模型|制度|装备|故事|传说|称号)/gu)) add(match[1]);
    return [...found];
  }

  function profileSchemaText() {
    return `{
  "detectedCharacters": ["本轮最终正文中需要持续记录的所有非玩家人物姓名或稳定称谓"],
  "noProfileReason": "只有detectedCharacters和profiles都为空时填写：具体说明为何本轮确实没有可持续记录的NPC，否则留空",
  "profiles": [{
    "name": "人物姓名或唯一称谓",
    "aliases": [],
    "identity": {"species":"物种","gender":"性别","age":"年龄或具体年龄段","occupation":"职业职责","affiliation":"所属","socialPosition":"社会位置"},
    "appearance": {"overall":"整体形象","body":"体型动作","face":"面部","hair":"头发或不适用原因","voice":"声音","physiology":"完整生理说明"},
    "personality": {"temperament":"基础气质","coreDesire":"核心欲望","values":"价值观","thinking":"思考方式","attachment":"关系模式","socialMotive":"社交动机","interest":"利益取向","conflict":"冲突方式","stress":"压力反应","moralBoundary":"道德边界","expression":"表达习惯","actionHabit":"行动习惯","weakness":"弱点与自我欺骗","humor":"幽默方式"},
    "history":"连贯经历",
    "currentState":{"location":"位置","condition":"身体处境","emotion":"当前情绪","goal":"人物自己的目标"},
    "relationships":["至少一条自然关系说明"],
    "knowledge":["人物确实知道的内容"],
    "capabilities":["能力"],
    "resources":["资源或资源有限的说明"],
    "evidence":["最终正文或权威设定中的依据"],
    "inferences":["正文未说明、由你合理创造且可被后续证据修订的补全"]
  }]
}`;
  }

  async function authorityContext(target) {
    const oracle = window.StoryOracleAPI;
    let card = '';
    let world = '';
    let mvu = null;
    try { card = oracle?.context?.buildCardSection?.(ctx()) || ''; } catch { card = ''; }
    try { world = await oracle?.context?.buildWorldInfo?.({ forceMode: 'st', extraScanText: target.content }) || ''; } catch { world = ''; }
    try { mvu = await currentMvuState(target.index); } catch { mvu = null; }
    return { card: text(card), world: text(world), mvu };
  }

  function generationPrompt(target, store, players, authority, candidates, suggestions) {
    return `你是数据库式人物档案填表器。读取最终接受正文，找出所有需要持续记录的非玩家人物，并一次返回完整JSON对象。

硬规则：
1. 玩家身份是 ${JSON.stringify(players)}，以及正文中的user、玩家、主人公、契约者本人；绝不能给玩家建立NPC档案。
2. 正文通常不会包含人物全部信息。缺失内容必须结合世界观、身份、行为和上下文进行合理创造性补全，写入inferences；禁止使用未知、待定、未登记、正文未提及等占位词。
3. 已有档案是权威旧状态。人物再次出现时返回更新后的完整档案；没有新证据的旧字段保持。
4. 不替玩家决定行动、感受、同意或关系。人物的goal必须是该人物自己的目标。
5. detectedCharacters必须与profiles按人物双向一一对应。确实无人可建档时两者都返回空数组，并在noProfileReason写清具体原因；不得用空数组逃避填表。
6. 只返回一个JSON对象，不要代码围栏、解释或分析。

唯一输出结构：
${profileSchemaText()}

已有完整档案：
${JSON.stringify(store.profiles)}

脚本从既有档案命中、明确句首发言者、句界后二至四字短动作主语和稳定NPC编号得到的高置信候选（这些人物若不是玩家就必须建档）：
${JSON.stringify(candidates)}

脚本从标题式对白或叙述称谓得到的软提示（请结合正文自行判断，不得因为误识别标题而虚构人物）：
${JSON.stringify(suggestions)}

角色卡权威材料：
${authority.card || '（宿主未提供）'}

当前激活世界书材料：
${authority.world || '（宿主未提供）'}

用户的全局自定义模型适配附加提示词（只追加，不覆盖上述权威边界）：
${settings().globalPrompt || '（未设置）'}

变量医生修复后的当前MVU状态：
${JSON.stringify(authority.mvu)}

本轮用户输入：
${previousUser(target.index)}

最近上下文：
${JSON.stringify(recentContext(target.index))}

最终接受正文：
${target.content}`;
  }

  function repairPrompt(target, store, players, authority, candidates, suggestions, candidate, errors) {
    return `你正在修复一份人物档案填表结果。保留候选中正确内容，只修复列出的格式或完整性问题。正文没有明确的信息必须合理补全，不能删字段或改成未知。只返回一个完整JSON对象。

玩家身份（不得建档）：${JSON.stringify(players)}
唯一结构：${profileSchemaText()}
校验错误：${JSON.stringify(errors)}
失败候选：${String(candidate || '').slice(0, 30000)}
已有档案：${JSON.stringify(store.profiles)}
必须核对的高置信人物候选：${JSON.stringify(candidates)}
仅供判断的软人物提示：${JSON.stringify(suggestions)}
角色卡与世界书：${authority.card}\n${authority.world}
修复后的MVU状态：${JSON.stringify(authority.mvu)}
全局自定义模型适配附加提示词：${settings().globalPrompt || '（未设置）'}
最终接受正文：${target.content}`;
  }

  function worldApiConfig() {
    const config = window.WORLD_ENGINE_API?.getSettings?.(true) || {};
    return { configured: Boolean(config.apiUrl && config.model), config };
  }

  function normalizeSharedEndpoint(value) {
    const endpoint = text(value).replace(/\/+$/u, '');
    if (!endpoint) return '';
    return /\/chat\/completions$/iu.test(endpoint) ? endpoint : `${endpoint}/chat/completions`;
  }

  function enforceManagedScheduling() {
    const context = ctx();
    const story = context?.extensionSettings?.storyOracle;
    if (story && story.autoDiagnoseEnabled !== false) {
      story.autoDiagnoseEnabled = false;
      context.saveSettingsDebounced?.();
    }
    const store = window.WORLD_ENGINE_STORE;
    if (store?.getItem && store?.setItem) {
      let current = {};
      try { current = JSON.parse(store.getItem('world_engine_settings') || '{}'); } catch { current = {}; }
      if (current.evolveMode !== 'manual') {
        store.setItem('world_engine_settings', JSON.stringify({ ...current, evolveMode: 'manual' }));
        window.WORLD_ENGINE_API?.getSettings?.(true);
      }
    }
    try {
      const memory = window.MEMORY_ENGINE_SETTINGS?.getSettings?.(true);
      if (memory && (memory.engineEnabled !== false || memory.evolveMode !== 'manual')) {
        window.MEMORY_ENGINE_SETTINGS.patchSettings({ engineEnabled: false, evolveMode: 'manual' });
      }
    } catch { /* optional original subsystem */ }
    try { disableNativeStoryPostReply(); } catch { /* Story may still be mounting */ }
  }

  async function callModel(prompt, signal) {
    const api = window.WORLD_ENGINE_API;
    if (typeof api?.callApi !== 'function') throw new Error('独立世界引擎API尚未初始化');
    const current = settings();
    return api.callApi(prompt, current.maxTokens, current.temperature, signal);
  }

  let cachedStoryInternals = null;
  function storyInternals() {
    if (cachedStoryInternals) return cachedStoryInternals;
    const evaluate = window.StoryOracleAPI?.unsafe?.eval;
    if (typeof evaluate !== 'function') throw new Error('故事神谕原版桥接接口尚未就绪');
    cachedStoryInternals = evaluate(`({
      getCtx, getSettings, getMvu, diagPickerActive, buildDiagSelectedWi,
      buildWorldInfo, wiContextMode, collectMvuUpdateRules, getMvuStatData,
      resolveAutoTargetMessage, extractUpdateBlock, buildDiagnosePromptFrom,
      beginPostReplyCall, showAutoDiagGenerating, dismissToast,
      callDirect, resolveEndpointUrl, callProfile, writeUpdateBlockToMessage,
      refreshMessageBar, notifyAutoDiagnose, cancelPostReply, getFixCfg, setFixCfg,
      awaitMvuIdle, mvuIsBusy,
      resetCancelled: () => { postReplyCancelled = false; }
    })`);
    return cachedStoryInternals;
  }

  function statDataOf(value) {
    return value && typeof value === 'object' && value.stat_data !== undefined ? value.stat_data : value;
  }

  async function mvuPayloadAt(messageId) {
    const numericId = Number(messageId);
    if (!Number.isInteger(numericId) || numericId < 0) throw new Error('缺少可固定的MVU消息楼层');
    const Mvu = await storyInternals().getMvu();
    if (!Mvu || typeof Mvu.getMvuData !== 'function') throw new Error('故事神谕没有找到MVU变量框架');
    return Promise.resolve(Mvu.getMvuData({ type: 'message', message_id: numericId }));
  }

  async function currentMvuState(messageId) {
    try { return deepClone(statDataOf(await mvuPayloadAt(messageId)) ?? null); }
    catch { return null; }
  }

  function disableNativeStoryPostReply() {
    const so = storyInternals();
    try {
      if (so.getFixCfg?.()?.autoFixEnabled !== false) so.setFixCfg?.({ autoFixEnabled: false });
    } catch { /* original UI may not have chat metadata yet */ }
    const story = ctx()?.extensionSettings?.storyOracle;
    if (story) story.autoDiagnoseEnabled = false;
  }

  // Derived directly from Story Oracle 1.35.4 runAutoDiagnose/autoApplyFix.
  // Only the host target changes: every MVU read/write is pinned to the accepted
  // message id instead of the original "latest" alias, with freshness guards
  // before and after each asynchronous boundary.
  async function runStoryDiagnosis(target, owner = null) {
    if (!settings().diagnoseEnabled) return { ok: true, status: 'disabled', raw: '', patchBlock: '' };
    requireTaskOwner(owner, target, '变量诊断开始');
    const so = storyInternals();
    disableNativeStoryPostReply();
    so.resetCancelled();
    const storyCtx = so.getCtx();
    const storySettings = so.getSettings();
    const Mvu = await so.getMvu();
    requireTaskOwner(owner, target, '读取MVU后');
    if (!Mvu) throw new Error('故事神谕没有找到MVU变量框架');
    await so.awaitMvuIdle?.(Mvu, { capMs: 120000, pollMs: 250 });
    requireTaskOwner(owner, target, '等待MVU自身更新完成后');
    if (so.mvuIsBusy?.(Mvu)) throw new Error('MVU自身的额外解析仍在运行，拒绝与它并发覆盖同一楼层');
    if (storySettings.mode === 'direct' && (!storySettings.endpoint || !storySettings.model)) throw new Error('请先在医生“连接”页填写API地址和模型');
    if (storySettings.mode === 'profile' && !storySettings.profileId) throw new Error('故事神谕没有选择连接配置');

    let wiBlock;
    if (so.diagPickerActive()) wiBlock = (await so.buildDiagSelectedWi()).block;
    else {
      wiBlock = await so.buildWorldInfo(so.wiContextMode(storySettings));
      const rules = await so.collectMvuUpdateRules(wiBlock);
      if (rules.length) wiBlock = [wiBlock, ...rules].filter(Boolean).join('\n\n');
    }
    const baselinePayload = await mvuPayloadAt(target.index);
    if (baselinePayload === null || baselinePayload === undefined) {
      throw new Error('固定楼层没有可读取的MVU快照，不能用空状态冒充变量正确');
    }
    const baselineDigest = JSON.stringify(baselinePayload);
    const stat = deepClone(statDataOf(baselinePayload));
    requireTaskOwner(owner, target, '变量诊断上下文完成');
    const statStr = stat ? JSON.stringify(stat, null, 2) : '';
    const aiIdx = target.index;
    const latestReply = target.content;
    if (!latestReply?.trim()) throw new Error('最终正文已失效，变量诊断未执行');
    if (text(storyCtx.chat?.[aiIdx]?.mes) !== latestReply) {
      throw Object.assign(new Error('宿主当前mes与活动swipe正文尚未同步，拒绝让变量医生分析或写回错误文本'), { code: STALE_TASK });
    }
    const latestBlock = so.extractUpdateBlock(latestReply);
    const baseSystemPrompt = so.buildDiagnosePromptFrom(storyCtx, storySettings, {
      wiBlock, statStr, latestBlock, latestReply, auto: true,
    });
    const systemPrompt = settings().globalPrompt
      ? `${baseSystemPrompt}\n\n【用户的全局自定义模型适配附加提示词】\n${settings().globalPrompt}`
      : baseSystemPrompt;
    const userMsg = latestBlock
      ? '【自动诊断】最新一条 AI 回复里带有 <UpdateVariable> 更新。请按本卡 MVU 规则与当前状态核验它：有错就只输出一个修正后的 <UpdateVariable> 区块（仅含需改正的字段）；完全正确则在 <JSONPatch> 里输出空数组（[]）。'
      : '【自动诊断】最新一条 AI 回复的正文里【没有】变量更新区块。请充当变量更新引擎：通读这条回复，依本卡 MVU 规则与当前状态，推导出本回合应当发生的全部变量更新，输出一个 <UpdateVariable> 区块把状态更新到位；若这条回复确实不涉及任何变量变化，则在 <JSONPatch> 里输出空数组（[]）。';
    const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }];
    const request = { systemPrompt, userMsg };
    const enrichDiagnosisError = (error) => {
      error.request ||= deepClone(request);
      if (!error.raw) error.raw = String(raw || '');
      return error;
    };
    const maxTokens = Math.max(storySettings.maxTokens, 4096);
    const call = so.beginPostReplyCall(240000);
    const toast = so.showAutoDiagGenerating();
    let raw = '';
    try {
      if (storySettings.mode === 'direct') {
        const body = { model: storySettings.model, messages, max_tokens: maxTokens };
        if (storySettings.sendTemperature) body.temperature = storySettings.temperature;
        raw = await so.callDirect(so.resolveEndpointUrl(storySettings), storySettings.apiKey, body, call.signal);
      } else {
        const override = storySettings.sendTemperature ? { temperature: storySettings.temperature } : {};
        raw = await so.callProfile(storySettings.profileId, messages, maxTokens, override, call.signal);
      }
    } catch (error) {
      throw enrichDiagnosisError(error);
    } finally {
      call.end();
      so.dismissToast(toast);
    }
    requireTaskOwner(owner, target, '变量诊断模型返回');
    const unchangedPayload = await mvuPayloadAt(target.index);
    if (JSON.stringify(unchangedPayload) !== baselineDigest) {
      throw enrichDiagnosisError(Object.assign(new Error('模型诊断期间固定楼层MVU基线已变化，本次旧诊断已废弃'), { code: STALE_TASK }));
    }

    const patchBlock = so.extractUpdateBlock(raw);
    const explicitEmpty = /<JSONPatch\b[^>]*>\s*(?:```(?:json)?\s*)?\[\s*\](?:\s*```)?\s*<\/JSONPatch>/iu
      .test(String(patchBlock || raw || ''));
    if (!patchBlock && !explicitEmpty) {
      throw enrichDiagnosisError(Object.assign(new Error('故事神谕模型返回既没有UpdateVariable补丁，也没有明确的空JSONPatch；本轮不能冒充变量正确'), {
        code: 'story_oracle_unrecognized_diagnosis', raw: String(raw || '').slice(0, 16000),
      }));
    }
    let result = { status: 'nochange' };
    if (patchBlock && !explicitEmpty) {
      const opts = { type: 'message', message_id: target.index };
      const oldData = unchangedPayload;
      const snapshot = deepClone(oldData);
      const newData = await Mvu.parseMessage(patchBlock, oldData);
      requireTaskOwner(owner, target, '变量补丁解析完成');
      if (!newData) result = { status: 'failed' };
      else if (JSON.stringify(newData) === JSON.stringify(oldData)) {
        throw enrichDiagnosisError(Object.assign(new Error('故事神谕返回了非空修复补丁，但它对固定楼层没有产生任何变量效果；已按失败保留供重试'), {
          code: 'story_oracle_nonempty_noop', raw: String(raw || '').slice(0, 16000),
        }));
      } else {
        requireTaskOwner(owner, target, '变量补丁写入前');
        await Mvu.replaceMvuData(newData, opts);
        let readback;
        try {
          requireTaskOwner(owner, target, '变量补丁写入完成');
          readback = await Promise.resolve(Mvu.getMvuData(opts));
          if (JSON.stringify(readback) !== JSON.stringify(newData)) {
            throw enrichDiagnosisError(Object.assign(new Error('MVU固定楼层写后读回与预期不一致，本轮不能宣称修复成功'), {
              code: 'host_mvu_readback_mismatch', raw: String(raw || '').slice(0, 16000),
            }));
          }
        } catch (error) {
          let current = null;
          try { current = await Promise.resolve(Mvu.getMvuData(opts)); } catch { current = null; }
          if (JSON.stringify(current) === JSON.stringify(newData)) {
            try { await Promise.resolve(Mvu.replaceMvuData(snapshot, opts)); } catch { /* best-effort rollback */ }
          }
          throw error;
        }
        result = { status: 'applied', snapshot, readback: deepClone(readback) };
      }
    }
    if (result.status === 'failed') throw enrichDiagnosisError(new Error('故事神谕返回了无法由MVU应用的变量补丁'));
    if (result.status === 'applied' && aiIdx >= 0) {
      let doctorWrittenTarget = null;
      if (!latestBlock) {
        try {
          await so.writeUpdateBlockToMessage(aiIdx, patchBlock);
          const activeMessage = ctx()?.chat?.[aiIdx];
          if (!messageText(activeMessage).includes(patchBlock)) throw new Error('变量已经写入MVU，但修复块没有落到当前活动swipe');
          doctorWrittenTarget = refreshAcceptedTarget(target);
          if (target.generationKey) doctorWrittenTarget.generationKey = target.generationKey;
          requireTaskOwner(owner, doctorWrittenTarget, '变量修复块写入正文后');
          if (typeof storyCtx.saveChat === 'function') await storyCtx.saveChat();
          requireTaskOwner(owner, doctorWrittenTarget, '变量修复正文保存后');
          if (!messageText(ctx()?.chat?.[aiIdx]).includes(patchBlock)) throw new Error('保存后当前活动swipe没有读回变量修复块');
        } catch (error) {
          if (doctorWrittenTarget) error.doctorWrittenTarget = deepClone(doctorWrittenTarget);
          throw enrichDiagnosisError(error);
        }
      }
      else so.refreshMessageBar(aiIdx);
      refreshAcceptedTarget(target);
    }
    so.notifyAutoDiagnose(result, patchBlock);
    return {
      ok: true,
      status: result.status,
      raw: String(raw),
      patchBlock: String(patchBlock || ''),
      request,
      mvu: await currentMvuState(target.index),
    };
  }

  function installWorldContextBridge() {
    const worldbook = window.WORLD_ENGINE_WORLDBOOK;
    const injector = window.WORLD_ENGINE_INJECT;
    let installed = false;
    if (worldbook?.buildPromptSection && !worldbook[WORLD_CONTEXT_BRIDGE]) {
      const original = worldbook.buildPromptSection.bind(worldbook);
      worldbook.buildPromptSection = async function(...args) {
        const base = await original(...args);
        const pinnedTarget = runtime.worldContextTarget || latestAssistant();
        if (!pinnedTarget) return base;
        requireCurrentTarget(pinnedTarget, '世界推演读取私密上下文');
        const profileStore = readStore();
        const mvu = await currentMvuState(pinnedTarget.index);
        const privateContext = `【Doctor私密权威快照｜仅供后台世界推演】
以下人物档案和MVU状态不是玩家知识，不得据此让不知情人物全知，也不得直接泄露到正文。人物必须按自己的欲望、知识、资源、阻力和行动习惯决定下一步；尝试不等于成功，结果仍由世界规则裁决。

完整人物档案：
${JSON.stringify(profileStore.profiles, null, 2)}

变量医生修复后的MVU状态：
${JSON.stringify(mvu, null, 2)}

用户的全局自定义模型适配附加提示词：
${settings().globalPrompt || '（未设置）'}`;
        return [base, privateContext].filter(Boolean).join('\n\n');
      };
      Object.defineProperty(worldbook, WORLD_CONTEXT_BRIDGE, { value: { original }, configurable: false });
      installed = true;
    } else if (worldbook?.[WORLD_CONTEXT_BRIDGE]) installed = true;

    if (injector?.buildContext && !injector[WORLD_PUBLIC_PROJECTION_BRIDGE]) {
      const originalBuildContext = injector.buildContext.bind(injector);
      injector.buildContext = function(worldState, tags) {
        const publicState = deepClone(worldState || {});
        if (publicState.blackbox && typeof publicState.blackbox === 'object') {
          publicState.blackbox.secretActions = [];
          publicState.blackbox.secretAssets = [];
        }
        return originalBuildContext(publicState, tags);
      };
      Object.defineProperty(injector, WORLD_PUBLIC_PROJECTION_BRIDGE, {
        value: { original: originalBuildContext }, configurable: false,
      });
      installed = true;
    } else if (injector?.[WORLD_PUBLIC_PROJECTION_BRIDGE]) installed = true;
    return installed;
  }

  function committedWorldReceipt(target) {
    const durable = loadWorldReceipt(target);
    if (durable?.committed === true) return deepClone(durable);
    if (durable?.status === 'pending') {
      const current = window.WORLD_ENGINE_CORE?.loadState?.() || {};
      const currentRound = Number(current.round || 0);
      const currentDigest = contentFingerprint(JSON.stringify(current));
      if (currentRound !== Number(durable.beforeRound || 0) || currentDigest !== durable.beforeStateDigest) {
        const ambiguous = {
          ...durable, committed: true, valid: false, status: 'ambiguous-after-pending',
          afterRound: currentRound, afterStateDigest: currentDigest,
          error: '世界引擎调用开始后中断，当前世界已不同于写前快照；拒绝盲目重复推进',
        };
        try { persistWorldReceipt(target, ambiguous); } catch { /* pending intent still prevents a blind retry */ }
        return ambiguous;
      }
    }
    for (const entry of runtime.runReports) {
      if (worldSourceKey(entry?.target) !== worldSourceKey(target)) continue;
      const receipt = entry?.result?.world;
      if (receipt?.committed === true && receipt?.sourceKey === worldSourceKey(target)) return deepClone(receipt);
    }
    return null;
  }

  async function runWorldEvolution(target, isReroll, owner = null) {
    if (!settings().worldEnabled) return { ok: true, status: 'disabled' };
    if (!target?.generationKey) throw new Error('世界推进缺少稳定generationKey；请先让变量医生绑定当前正文');
    requireTaskOwner(owner, target, '世界推进开始');
    const prior = committedWorldReceipt(target);
    if (prior) {
      if (prior.valid !== true) throw Object.assign(new Error('同一正文已有世界写入收据，但轮次读回异常；拒绝再次推进造成重复'), { worldReceipt: prior });
      return { ...prior, status: 'already-committed', reused: true };
    }
    const liveChat = ctx()?.chat || [];
    if (target.index !== liveChat.length - 1 || liveChat[target.index]?.is_system || liveChat[target.index]?.is_user
      || messageText(liveChat[target.index]) !== target.content) {
      throw Object.assign(new Error('原版世界引擎只读取聊天数组尾部；当前尾部不是被接受的固定正文，拒绝推进错误文本'), { code: STALE_TASK });
    }
    installWorldContextBridge();
    const before = window.WORLD_ENGINE_CORE?.loadState?.() || {};
    const mode = isReroll ? undefined : 'forward';
    const intent = {
      ok: false, status: 'pending', committed: false, valid: false, sourceKey: worldSourceKey(target),
      mode: isReroll ? 'reroll' : 'forward', beforeRound: Number(before.round || 0),
      beforeStateDigest: contentFingerprint(JSON.stringify(before)), startedAt: new Date().toISOString(),
    };
    persistWorldReceipt(target, intent);
    runtime.worldContextTarget = deepClone(target);
    let ok;
    try {
      ok = await window.WORLD_ENGINE?.manualEvolve?.(mode, isReroll ? 'reroll' : 'state');
    } catch (error) {
      const interrupted = committedWorldReceipt(target);
      if (interrupted) error.worldReceipt = deepClone(interrupted);
      throw error;
    } finally {
      runtime.worldContextTarget = null;
    }
    const after = window.WORLD_ENGINE_CORE?.loadState?.() || {};
    if (!ok) {
      // World 3.0.2 intentionally refreshes lastUpdated and can retain pending
      // dice while rolling an API failure back.  Its explicit false + unchanged
      // round is therefore the authoritative retryable failure receipt; a full
      // JSON digest comparison would permanently lock an ordinary model error.
      if (Number(after.round || 0) === intent.beforeRound) {
        try { localStorage.removeItem(worldReceiptStorageKey(target)); } catch { /* a stale pending intent is safer than a duplicate */ }
        throw new Error(window.WORLD_ENGINE_EVOLUTION?.getLastError?.() || '原版世界引擎推进失败');
      }
      const interrupted = committedWorldReceipt(target) || { ...intent, committed: true, valid: false, status: 'ambiguous-after-failed-call' };
      throw Object.assign(new Error(window.WORLD_ENGINE_EVOLUTION?.getLastError?.() || '原版世界引擎返回失败但世界状态已经变化；拒绝重复推进'), {
        worldReceipt: deepClone(interrupted),
      });
    }
    const roundValid = isReroll
      ? Number(after.round || 0) === Number(before.round || 0)
      : Number(after.round) === Number(before.round || 0) + 1;
    const receipt = {
      ok: roundValid, status: roundValid ? 'advanced' : 'committed-with-invalid-round',
      committed: true, valid: roundValid, sourceKey: worldSourceKey(target),
      mode: isReroll ? 'reroll' : 'forward', beforeRound: Number(before.round || 0), afterRound: Number(after.round || 0),
      afterStateDigest: contentFingerprint(JSON.stringify(after)),
    };
    try { persistWorldReceipt(target, receipt); }
    catch (error) {
      throw Object.assign(new Error(`世界已经提交，但持久收据写入失败；本会话已锁定为禁止重复推进：${error?.message || error}`), {
        worldReceipt: deepClone(receipt),
      });
    }
    recordRunReport({
      at: new Date().toISOString(), target: deepClone(target),
      result: { ok: true, stageReceipt: 'world', world: deepClone(receipt) },
      worldDebug: window.WORLD_ENGINE_EVOLUTION?.getLastDebug?.() || null,
    });
    if (!roundValid) {
      const message = isReroll
        ? `世界重roll返回成功但轮次发生了变化（${receipt.beforeRound}→${receipt.afterRound}）`
        : `世界推进返回成功但轮次没有恰好增加一次（${receipt.beforeRound}→${receipt.afterRound}）`;
      throw Object.assign(new Error(message), { worldReceipt: receipt });
    }
    requireTaskOwner(owner, target, '世界推进完成');
    return receipt;
  }

  const runtime = {
    phase: 'idle',
    detail: '等待下一条最终回复',
    currentTarget: null,
    lastResult: null,
    diagnostics: [],
    abortController: null,
    generationSerial: 0,
    acceptedGeneration: null,
    generationType: 'normal',
    generationBaseline: null,
    pipelineBusy: false,
    failedStep: '',
    lastAccepted: null,
    lastUserMessageAt: 0,
    pipelineEpoch: 0,
    branchRestorePromise: Promise.resolve({ ok: true }),
    worldContextTarget: null,
    runReports: [],
    reportPersistence: { ok: true, attemptedCount: 0, savedCount: 0, lastSavedAt: '', error: '' },
    diagnosticPersistence: { ok: true, count: 0, error: '' },
    generationTicketPersistence: { ok: true, status: '', error: '' },
    generationEventStack: [],
  };

  function setPhase(phase, detail, result = null) {
    runtime.phase = phase;
    runtime.detail = text(detail);
    if (result !== null) runtime.lastResult = result;
    runtime.diagnostics.unshift({ at: new Date().toISOString(), phase, detail: runtime.detail });
    persistDiagnostics();
    render();
  }

  function diagnosticStorageKey(currentChatId = chatId()) {
    return `${DIAGNOSTIC_STORAGE_PREFIX}${encodeURIComponent(currentChatId || '')}`;
  }

  function persistDiagnostics() {
    try {
      sessionStorage.setItem(diagnosticStorageKey(), JSON.stringify(runtime.diagnostics));
      runtime.diagnosticPersistence = { ok: true, count: runtime.diagnostics.length, error: '' };
    } catch (error) {
      runtime.diagnosticPersistence = { ok: false, count: runtime.diagnostics.length, error: error?.message || String(error) };
    }
  }

  function loadDiagnostics(currentChatId = chatId()) {
    if (!currentChatId) return [];
    try {
      const value = JSON.parse(sessionStorage.getItem(diagnosticStorageKey(currentChatId)) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function pipelineStorageKey(currentChatId = chatId()) {
    return `${PIPELINE_STORAGE_PREFIX}${encodeURIComponent(currentChatId || '')}`;
  }

  function persistPipelineCheckpoint(checkpoint) {
    const currentChatId = text(checkpoint?.target?.chatId);
    if (!currentChatId) throw new Error('流水线检查点缺少聊天身份');
    const safe = redactApiConfiguration({ ...deepClone(checkpoint), updatedAt: new Date().toISOString() }, currentApiSecretValues());
    const key = pipelineStorageKey(currentChatId);
    localStorage.setItem(key, JSON.stringify(safe));
    const readback = JSON.parse(localStorage.getItem(key) || 'null');
    if (!readback || readback?.target?.identity !== safe?.target?.identity
      || readback?.status !== safe?.status || readback?.nextStep !== safe?.nextStep) {
      throw new Error('流水线检查点保存后读回不一致');
    }
    return readback;
  }

  function loadPipelineCheckpoint(currentChatId = chatId()) {
    if (!currentChatId) return null;
    try { return JSON.parse(localStorage.getItem(pipelineStorageKey(currentChatId)) || 'null'); }
    catch { return null; }
  }

  function generationTicketStorageKey(currentChatId = chatId()) {
    return `${GENERATION_TICKET_PREFIX}${encodeURIComponent(currentChatId || '')}`;
  }

  function persistGenerationTicket(ticket, status) {
    const currentChatId = text(ticket?.chatId || chatId());
    if (!currentChatId || !ticket?.generationKey || !Number.isFinite(Number(ticket?.serial))) {
      throw new Error('生成票据缺少聊天、序号或唯一键');
    }
    const safe = {
      ...deepClone(ticket), chatId: currentChatId, status: text(status || ticket.status || 'started'),
      updatedAt: new Date().toISOString(),
    };
    const key = generationTicketStorageKey(currentChatId);
    localStorage.setItem(key, JSON.stringify(safe));
    const readback = JSON.parse(localStorage.getItem(key) || 'null');
    if (!readback || readback.chatId !== currentChatId || readback.generationKey !== safe.generationKey
      || Number(readback.serial) !== Number(safe.serial) || readback.status !== safe.status) {
      throw new Error('生成票据保存后读回不一致');
    }
    runtime.generationTicketPersistence = { ok: true, status: safe.status, error: '' };
    return readback;
  }

  function loadGenerationTicket(currentChatId = chatId()) {
    if (!currentChatId) return null;
    try { return JSON.parse(localStorage.getItem(generationTicketStorageKey(currentChatId)) || 'null'); }
    catch { return null; }
  }

  function clearGenerationTicket(currentChatId = chatId(), expectedGenerationKey = '') {
    if (!currentChatId) return false;
    const key = generationTicketStorageKey(currentChatId);
    const current = loadGenerationTicket(currentChatId);
    if (expectedGenerationKey && current?.generationKey && current.generationKey !== expectedGenerationKey) return false;
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null) throw new Error('生成票据删除后仍可读');
    runtime.generationTicketPersistence = { ok: true, status: 'cleared', error: '' };
    return true;
  }

  function noteGenerationTicketFailure(stage, error) {
    runtime.generationTicketPersistence = { ok: false, status: text(stage), error: error?.message || String(error) };
    runtime.diagnostics.unshift({
      at: new Date().toISOString(), phase: 'generation-ticket-failed',
      detail: `${stage}生成票据失败：${runtime.generationTicketPersistence.error}`,
    });
    persistDiagnostics();
  }

  function worldReceiptStorageKey(target) {
    return `${WORLD_RECEIPT_STORAGE_PREFIX}${encodeURIComponent(text(target?.chatId))}:${encodeURIComponent(worldSourceKey(target))}`;
  }

  function worldSourceKey(target) { return text(target?.generationKey) || text(target?.identity); }

  function persistWorldReceipt(target, receipt) {
    const key = worldReceiptStorageKey(target);
    localStorage.setItem(key, JSON.stringify(receipt));
    const readback = JSON.parse(localStorage.getItem(key) || 'null');
    if (!readback || readback.sourceKey !== worldSourceKey(target) || readback.status !== receipt.status
      || Boolean(readback.committed) !== Boolean(receipt.committed)) {
      throw new Error('世界推进收据保存后读回不一致');
    }
    return readback;
  }

  function loadWorldReceipt(target) {
    try {
      const receipt = JSON.parse(localStorage.getItem(worldReceiptStorageKey(target)) || 'null');
      return receipt?.sourceKey === worldSourceKey(target) ? receipt : null;
    } catch { return null; }
  }

  function recordRunReport(entry) {
    if (!entry?.target || text(entry.target.chatId) !== chatId()) return;
    const safeEntry = redactApiConfiguration(entry, currentApiSecretValues());
    runtime.runReports.unshift(safeEntry);
    const baseKey = `${REPORT_STORAGE_PREFIX}${encodeURIComponent(chatId())}`;
    const indexKey = `${baseKey}:index`;
    const manifestKey = `${baseKey}:manifest`;
    let storedIndex = [];
    let priorManifest = {};
    try {
      storedIndex = JSON.parse(sessionStorage.getItem(indexKey) || '[]');
      priorManifest = JSON.parse(sessionStorage.getItem(manifestKey) || '{}');
      if (!Array.isArray(storedIndex)) storedIndex = [];
      const attemptedCount = Math.max(Number(priorManifest.attemptedCount || 0), storedIndex.length) + 1;
      sessionStorage.setItem(manifestKey, JSON.stringify({
        attemptedCount, savedCount: storedIndex.length, complete: false,
        lastSavedAt: priorManifest.lastSavedAt || '', lastError: '本条运行日志尚未完整写入',
      }));
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(`${baseKey}:entry:${id}`, JSON.stringify(safeEntry));
      const nextIndex = [id, ...storedIndex];
      sessionStorage.setItem(indexKey, JSON.stringify(nextIndex));
      const lastSavedAt = new Date().toISOString();
      sessionStorage.setItem(manifestKey, JSON.stringify({
        attemptedCount, savedCount: nextIndex.length, complete: attemptedCount === nextIndex.length,
        lastSavedAt, lastError: '',
      }));
      runtime.reportPersistence = { ok: attemptedCount === nextIndex.length, attemptedCount, savedCount: nextIndex.length, lastSavedAt, error: '' };
    } catch (error) {
      const attemptedCount = Math.max(Number(priorManifest.attemptedCount || 0), storedIndex.length) + 1;
      try {
        sessionStorage.setItem(manifestKey, JSON.stringify({
          attemptedCount, savedCount: storedIndex.length, complete: false,
          lastSavedAt: priorManifest.lastSavedAt || '', lastError: error?.message || String(error),
        }));
      } catch { /* quota may also prevent the lightweight manifest update */ }
      runtime.reportPersistence = {
        ok: false, attemptedCount, savedCount: storedIndex.length,
        lastSavedAt: runtime.reportPersistence?.lastSavedAt || '', error: error?.message || String(error),
      };
      runtime.diagnostics.unshift({
        at: new Date().toISOString(), phase: 'report-persistence-failed',
        detail: `本页运行记录仍在内存，但刷新持久化失败：${error?.message || error}`,
      });
      persistDiagnostics();
    }
  }

  function loadRunReports(currentChatId = chatId()) {
    if (!currentChatId) return { reports: [], indexCount: 0, corruptIds: [], error: '' };
    try {
      const baseKey = `${REPORT_STORAGE_PREFIX}${encodeURIComponent(currentChatId)}`;
      const ids = JSON.parse(sessionStorage.getItem(`${baseKey}:index`) || '[]');
      if (!Array.isArray(ids)) return { reports: [], indexCount: 0, corruptIds: ['index'], error: '运行日志索引不是数组' };
      const reports = [];
      const corruptIds = [];
      ids.forEach((id) => {
        try {
          const entry = JSON.parse(sessionStorage.getItem(`${baseKey}:entry:${id}`) || 'null');
          if (entry) reports.push(entry);
          else corruptIds.push(String(id));
        } catch { corruptIds.push(String(id)); }
      });
      return { reports, indexCount: ids.length, corruptIds, error: '' };
    } catch (error) {
      return { reports: [], indexCount: 0, corruptIds: ['index'], error: error?.message || String(error) };
    }
  }

  function loadReportManifest(currentChatId = chatId(), load = {}) {
    if (!currentChatId) return { ok: true, attemptedCount: 0, savedCount: 0, lastSavedAt: '', error: '' };
    const loadedCount = Array.isArray(load.reports) ? load.reports.length : 0;
    const indexCount = Number(load.indexCount || 0);
    const corruptIds = Array.isArray(load.corruptIds) ? load.corruptIds : [];
    try {
      const baseKey = `${REPORT_STORAGE_PREFIX}${encodeURIComponent(currentChatId)}`;
      const manifest = JSON.parse(sessionStorage.getItem(`${baseKey}:manifest`) || '{}');
      const attemptedCount = Math.max(Number(manifest.attemptedCount || 0), loadedCount);
      const savedCount = Number(manifest.savedCount || 0);
      const countsMatch = loadedCount === indexCount && indexCount === savedCount && savedCount === attemptedCount;
      const ok = !load.error && corruptIds.length === 0 && manifest.complete !== false && countsMatch;
      const integrityError = load.error || (corruptIds.length
        ? `运行日志有${corruptIds.length}条索引对应的内容缺失或损坏`
        : (!countsMatch ? `运行日志数量不一致（清单${attemptedCount}、索引${indexCount}、可读${loadedCount}）` : ''));
      return { ok, attemptedCount, savedCount: loadedCount, lastSavedAt: text(manifest.lastSavedAt), error: integrityError || text(manifest.lastError) };
    } catch (error) {
      return { ok: false, attemptedCount: loadedCount, savedCount: loadedCount, lastSavedAt: '', error: error?.message || String(error) };
    }
  }

  async function runTarget(target, reason = 'auto', owner = null) {
    if (!settings().enabled || !settings().profileEnabled) return { ok: true, status: 'disabled' };
    if (!target?.content) return { ok: true, status: 'empty' };
    target = target.identity ? target : decorateTarget(target);
    requireTaskOwner(owner, target, '人物档案开始');
    const identity = target.identity;
    if (reason === 'auto' && runtime.lastResult?.identity === identity && runtime.lastResult?.ok) return runtime.lastResult;
    runtime.abortController?.abort();
    const controller = new AbortController();
    runtime.abortController = controller;
    runtime.currentTarget = { identity, index: target.index, swipeId: target.swipeId, reason };
    const before = readStore();
    const players = playerNames(target);
    const candidates = highConfidenceCandidates(target, before, players);
    const suggestions = suggestedCandidates(target, players);
    setPhase('running', '正在用ver5.35填表事务生成完整人物档案');
    let raw = '';
    let initialRaw = '';
    let repairRaw = '';
    let initialErrors = [];
    let repairErrors = [];
    let repaired = false;
    let requestPrompt = '';
    let repairRequestPrompt = '';
    try {
      const authority = await authorityContext(target);
      requireTaskOwner(owner, target, '人物档案权威上下文完成');
      requestPrompt = generationPrompt(target, before, players, authority, candidates, suggestions);
      raw = await callModel(requestPrompt, controller.signal);
      initialRaw = String(raw);
      requireTaskOwner(owner, target, '人物档案模型返回');
      let envelope;
      let errors;
      try {
        envelope = normalizeEnvelope(parseJsonResponse(raw));
        errors = validateEnvelope(envelope, players, candidates);
        if (errors.length === 0 && envelope.profiles.length === 0) {
          errors.push('首次返回空档案必须进行一次定向复核；只有复核后仍确认无人时才能接受空结果');
        }
      } catch (error) {
        envelope = { profiles: [], detectedCharacters: [], noProfileReason: '' };
        errors = [error.message || String(error)];
      }
      initialErrors = [...errors];
      if (errors.length > 0) {
        repaired = true;
        repairRequestPrompt = repairPrompt(target, before, players, authority, candidates, suggestions, raw, errors);
        raw = await callModel(repairRequestPrompt, controller.signal);
        repairRaw = String(raw);
        requireTaskOwner(owner, target, '人物档案单次修复返回');
        envelope = normalizeEnvelope(parseJsonResponse(raw));
        errors = validateEnvelope(envelope, players, candidates);
        repairErrors = [...errors];
      }
      if (errors.length > 0) throw new Error(`单次修复后档案仍不完整：${errors.join('；')}`);

      const nextProfiles = deepClone(before.profiles);
      const committed = [];
      for (const candidate of envelope.profiles) {
        const profile = deepClone(candidate);
        const existing = findUniqueExistingProfile(nextProfiles, profile);
        profile.profileId = text(existing?.profileId) || stableId(profile.name);
        profile.aliases = [...new Set([
          ...(existing?.aliases || []),
          ...(existing?.name && existing.name !== profile.name ? [existing.name] : []),
          ...(profile.aliases || []),
        ].map(text).filter((name) => name && name !== profile.name))];
        profile.updatedAt = new Date().toISOString();
        profile.source = 'creative-completion-with-revisable-inference';
        nextProfiles[profile.profileId] = profile;
        committed.push(profile);
      }

      const after = {
        ...before,
        schema: 2,
        revision: Number(before.revision || 0) + 1,
        profiles: nextProfiles,
        branches: pruneBranches({
          ...before.branches,
          [branchBaseKey(target.index, target.fingerprint)]: before.branches?.[branchBaseKey(target.index, target.fingerprint)] || deepClone(before.profiles),
          [branchKey(target.index, target.swipeId, target.fingerprint)]: deepClone(nextProfiles),
        }),
        history: [...before.history, {
          identity, chatId: target.chatId, messageId: target.index, swipeId: target.swipeId,
          beforeRevision: Number(before.revision || 0), afterRevision: Number(before.revision || 0) + 1,
          committedProfileIds: committed.map((profile) => profile.profileId),
          at: new Date().toISOString(),
        }].slice(-MAX_HISTORY),
      };
      requireTaskOwner(owner, target, '人物档案提交前');
      const committedStore = await commitStore(
        after,
        target.chatId,
        before.revision,
        () => requireTaskOwner(owner, target, '人物档案原子提交'),
      );
      requireTaskOwner(owner, target, '人物档案提交后');
      const readback = committedStore.store;
      const result = {
        ok: true, status: committed.length ? 'committed' : 'no-profile', identity, reason, repaired,
        count: committed.length, total: Object.keys(readback.profiles).length,
        noProfileReason: envelope.noProfileReason || '', persistence: committedStore.persistence,
        raw: String(raw), initialRaw, repairRaw, initialErrors, repairErrors, requestPrompt, repairRequestPrompt,
      };
      const persistenceText = '已完成宿主持久化调用与完整内存读回';
      if (owner === null || runtime.pipelineEpoch === owner) setPhase('done', committed.length ? `${persistenceText}：${committed.length}张完整档案` : `${persistenceText}：本轮确实没有可建档NPC`, result);
      return result;
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (owner === null || runtime.pipelineEpoch === owner) setPhase('cancelled', '人物档案任务已取消');
        return { ok: false, status: 'cancelled', identity, reason };
      }
      if (error?.code === STALE_TASK) {
        const result = { ok: false, status: 'stale', identity, reason, error: error.message || String(error) };
        if (owner === null || runtime.pipelineEpoch === owner) setPhase('discarded', result.error, result);
        return result;
      }
      const result = {
        ok: false, identity, reason, repaired, error: error?.message || String(error),
        raw: String(raw).slice(0, 16000), initialRaw, repairRaw, initialErrors, repairErrors,
        requestPrompt, repairRequestPrompt,
      };
      if (owner === null || runtime.pipelineEpoch === owner) setPhase('failed', result.error, result);
      return result;
    } finally {
      if (runtime.abortController === controller) runtime.abortController = null;
    }
  }

  function refreshAcceptedTarget(original) {
    const fresh = latestAssistant();
    if (!fresh || fresh.chatId !== original.chatId || fresh.index !== original.index || fresh.swipeId !== original.swipeId) {
      throw Object.assign(new Error('最终正文楼层或swipe已变化，本轮流水线停止'), { code: STALE_TASK });
    }
    if (original.generationKey) fresh.generationKey = original.generationKey;
    return fresh;
  }

  function cancelAll(reason = '用户取消', cancelPendingGeneration = false) {
    runtime.pipelineEpoch += 1;
    runtime.abortController?.abort();
    try { cachedStoryInternals?.cancelPostReply?.(); } catch { /* optional */ }
    try { window.WORLD_ENGINE_EVOLUTION?.abort?.(); } catch { /* optional */ }
    runtime.pipelineBusy = false;
    runtime.worldContextTarget = null;
    if (cancelPendingGeneration) {
      runtime.generationSerial += 1;
      runtime.acceptedGeneration = null;
      runtime.generationEventStack = [];
    }
    runtime.diagnostics.unshift({ at: new Date().toISOString(), phase: 'cancel-requested', detail: reason });
    persistDiagnostics();
  }

  async function runExclusiveStage(stage, target, action, onSuccess = null) {
    if (!target) throw new Error('当前没有可处理的最终AI回复');
    try { clearGenerationTicket(target.chatId || chatId()); }
    catch (error) { noteGenerationTicketFailure(`手动${stage}接管时清理`, error); }
    cancelAll(`手动${stage}接管`, true);
    const owner = ++runtime.pipelineEpoch;
    runtime.pipelineBusy = true;
    try {
      await requireBranchRestore(owner);
      requirePipelineOwner(owner, target, `手动${stage}开始`);
      const value = await action(owner);
      if (value?.ok === false) throw new Error(value.error || `手动${stage}没有完成`);
      const fresh = refreshAcceptedTarget(target);
      requirePipelineOwner(owner, fresh, `手动${stage}完成`);
      if (typeof onSuccess === 'function') await onSuccess(fresh, value, owner);
      recordRunReport({
        at: new Date().toISOString(), target: deepClone(fresh),
        result: { ok: true, manualStage: stage, value: deepClone(value) },
        worldDebug: window.WORLD_ENGINE_EVOLUTION?.getLastDebug?.() || null,
      });
      return value;
    } catch (error) {
      let reportTarget = target;
      if (error?.doctorWrittenTarget && runtime.pipelineEpoch === owner) {
        try {
          const written = deepClone(error.doctorWrittenTarget);
          const binding = knownGenerationBinding(target);
          if (binding?.generationKey) {
            written.generationKey = binding.generationKey;
            requirePipelineOwner(owner, written, `手动${stage}异常后的正文身份迁移`);
            reportTarget = migrateDoctorWrittenAcceptedTarget(target, written, binding);
          } else {
            requirePipelineOwner(owner, written, `手动${stage}异常后的正文身份绑定`);
            reportTarget = establishManualGenerationBinding(written, 'manual-doctor-write-after-error');
          }
        } catch (migrationError) {
          error.identityMigrationError = migrationError?.message || String(migrationError);
        }
      }
      recordRunReport({
        at: new Date().toISOString(), target: deepClone(reportTarget),
        result: {
          ok: false, manualStage: stage, error: error?.message || String(error), raw: String(error?.raw || ''),
          identityMigrationError: String(error?.identityMigrationError || ''),
          request: error?.request ? deepClone(error.request) : null,
          world: error?.worldReceipt ? deepClone(error.worldReceipt) : null,
        },
        worldDebug: window.WORLD_ENGINE_EVOLUTION?.getLastDebug?.() || null,
      });
      throw error;
    } finally {
      if (runtime.pipelineEpoch === owner) runtime.pipelineBusy = false;
    }
  }

  function scheduleBranchRestore(taskFactory) {
    const previous = runtime.branchRestorePromise;
    runtime.branchRestorePromise = Promise.resolve(previous).then(async () => {
      await taskFactory();
      return { ok: true };
    }).catch(
      (error) => ({ ok: false, error: error?.message || String(error) }),
    );
    return runtime.branchRestorePromise;
  }

  async function requireBranchRestore(owner) {
    const receipt = await runtime.branchRestorePromise;
    if (runtime.pipelineEpoch !== owner) throw Object.assign(new Error('人物分支恢复期间任务所有权已变化'), { code: STALE_TASK });
    if (!receipt?.ok) throw new Error(`人物档案分支恢复失败：${receipt?.error || '未知错误'}`);
  }

  function requirePipelineOwner(owner, target, stage) {
    if (runtime.pipelineEpoch !== owner) {
      throw Object.assign(new Error(`${stage}时流水线已被新任务接管`), { code: STALE_TASK });
    }
    requireCurrentTarget(target, stage);
  }

  function requireTaskOwner(owner, target, stage) {
    if (owner === null || owner === undefined) return requireCurrentTarget(target, stage);
    return requirePipelineOwner(owner, target, stage);
  }

  async function restoreProfileBranch(target, preferBase = false) {
    if (!target) return false;
    const store = readStore();
    const base = store.branches?.[branchBaseKey(target.index, target.fingerprint)];
    const selected = !preferBase ? store.branches?.[branchKey(target.index, target.swipeId, target.fingerprint)] : null;
    if (!selected && !base) {
      if (Object.keys(store.profiles || {}).length === 0) return true;
      throw new Error('当前楼层的人物档案分支已不在保留窗口内，拒绝用未来档案反向污染旧swipe');
    }
    const profiles = deepClone(selected || base);
    if (JSON.stringify(profiles) === JSON.stringify(store.profiles)) return true;
    const restored = { ...store, revision: Number(store.revision || 0) + 1, profiles };
    await commitStore(
      restored,
      target.chatId,
      store.revision,
      () => requireCurrentTarget(target, '人物档案分支原子恢复'),
    );
    setPhase('idle', selected ? `已恢复第${target.index}楼 swipe ${target.swipeId} 的人物档案` : '已恢复本楼生成前人物档案，等待新回复');
    return true;
  }

  async function runAcceptedPipeline(initialTarget, reason = 'auto', generationType = 'normal', startAt = 'diagnosis') {
    if (!initialTarget) return { ok: false, status: 'empty' };
    if (runtime.pipelineBusy) cancelAll('新的最终正文接管旧任务');
    const owner = ++runtime.pipelineEpoch;
    runtime.pipelineBusy = true;
    runtime.failedStep = '';
    const rememberAccepted = (accepted) => {
      runtime.lastAccepted = deepClone({
        chatId: accepted.chatId, index: accepted.index, swipeId: accepted.swipeId,
        fingerprint: accepted.fingerprint, identity: accepted.identity,
        generationKey: accepted.generationKey || '', generationType,
      });
    };
    rememberAccepted(initialTarget);
    let target = initialTarget;
    let step = startAt;
    const result = { ok: false, identity: target.identity, reason, generationType, diagnosis: null, profile: null, world: null };
    try {
      persistPipelineCheckpoint({ status: 'running', target: deepClone(target), generationType, nextStep: startAt, reason });
      await requireBranchRestore(owner);
      requirePipelineOwner(owner, target, '流水线开始');
      if (startAt === 'diagnosis') {
        step = 'diagnosis';
        setPhase('diagnosing', '故事神谕正在核对并修复本楼MVU变量');
        result.diagnosis = await runStoryDiagnosis(target, owner);
        target = refreshAcceptedTarget(target);
        rememberAccepted(target);
        requirePipelineOwner(owner, target, '变量阶段完成');
        persistPipelineCheckpoint({ status: 'running', target: deepClone(target), generationType, nextStep: 'profile', reason, lastCompletedStep: 'diagnosis' });
        recordRunReport({
          at: new Date().toISOString(), target: deepClone(target),
          result: { ok: true, stageReceipt: 'diagnosis', generationType, diagnosis: deepClone(result.diagnosis) },
        });
      }
      if (startAt === 'diagnosis' || startAt === 'profile') {
        step = 'profile';
        result.profile = await runTarget(target, reason, owner);
        if (!result.profile?.ok) {
          const interrupted = result.profile?.status === 'stale' || result.profile?.status === 'cancelled';
          throw Object.assign(new Error(result.profile?.error || '人物档案事务没有完成'), interrupted ? { code: STALE_TASK } : {});
        }
        target = refreshAcceptedTarget(target);
        rememberAccepted(target);
        requirePipelineOwner(owner, target, '人物阶段完成');
        persistPipelineCheckpoint({ status: 'running', target: deepClone(target), generationType, nextStep: 'world', reason, lastCompletedStep: 'profile' });
        recordRunReport({
          at: new Date().toISOString(), target: deepClone(target),
          result: { ok: true, stageReceipt: 'profile', generationType, profile: deepClone(result.profile) },
        });
      }
      step = 'world';
      setPhase('world-running', '变量与人物已确认，原版世界引擎正在推进后台世界');
      result.world = await runWorldEvolution(target, ['swipe', 'regenerate', 'continue'].includes(generationType), owner);
      requirePipelineOwner(owner, target, '世界阶段完成');
      result.ok = true;
      result.status = 'complete';
      result.identity = target.identity;
      persistPipelineCheckpoint({ status: 'complete', target: deepClone(target), generationType, nextStep: '', reason, lastCompletedStep: 'world' });
      runtime.lastResult = result;
      runtime.failedStep = '';
      recordRunReport({ at: new Date().toISOString(), target: deepClone(target), result: deepClone(result), worldDebug: window.WORLD_ENGINE_EVOLUTION?.getLastDebug?.() || null });
      setPhase('done', `本楼医生完成：变量${result.diagnosis?.status || '已保留'}；档案${result.profile?.count ?? 0}张；世界第${result.world?.afterRound ?? '—'}轮`, result);
      return result;
    } catch (error) {
      if (error?.doctorWrittenTarget && target?.generationKey && runtime.pipelineEpoch === owner) {
        try {
          const written = deepClone(error.doctorWrittenTarget);
          written.generationKey = target.generationKey;
          requirePipelineOwner(owner, written, '变量修复异常后的正文身份迁移');
          target = migrateDoctorWrittenAcceptedTarget(target, written, { generationKey: target.generationKey, generationType });
          rememberAccepted(target);
        } catch (migrationError) {
          error.identityMigrationError = migrationError?.message || String(migrationError);
        }
      }
      const stale = error?.code === STALE_TASK;
      result.status = stale ? 'stale' : 'failed';
      result.failedStep = step;
      result.error = error?.message || String(error);
      if (error?.identityMigrationError) result.error += `；受控正文身份迁移失败：${error.identityMigrationError}`;
      if (error?.raw) result.raw = String(error.raw);
      if (error?.request) result.request = deepClone(error.request);
      if (error?.worldReceipt) result.world = deepClone(error.worldReceipt);
      if (runtime.pipelineEpoch === owner) {
        try {
          persistPipelineCheckpoint({ status: stale ? 'stale' : 'failed', target: deepClone(target), generationType, nextStep: step, reason, error: result.error });
        } catch (checkpointError) {
          result.checkpointError = checkpointError?.message || String(checkpointError);
        }
        runtime.lastResult = result;
        runtime.failedStep = step;
        setPhase(stale ? 'discarded' : 'failed', stale ? result.error : `${step}失败：${result.error}`, result);
      }
      recordRunReport({ at: new Date().toISOString(), target: deepClone(target), result: deepClone(result), worldDebug: window.WORLD_ENGINE_EVOLUTION?.getLastDebug?.() || null });
      return result;
    } finally {
      if (runtime.pipelineEpoch === owner) runtime.pipelineBusy = false;
    }
  }

  async function waitForAcceptedFinal(serial) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    if (serial !== runtime.generationSerial || runtime.acceptedGeneration?.serial !== serial) return;
    const first = latestAssistant();
    if (!first) {
      setPhase('waiting', '正文结束事件已到达，尚未读到最终回复；继续等待宿主落盘');
      setTimeout(() => { void waitForAcceptedFinal(serial); }, 650);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 650));
    if (serial !== runtime.generationSerial || runtime.acceptedGeneration?.serial !== serial) return;
    const fresh = latestAssistant();
    if (!fresh || fresh.identity !== first.identity) {
      setPhase('waiting', '最终回复仍在变化；继续等待两次一致的新鲜读取');
      setTimeout(() => { void waitForAcceptedFinal(serial); }, 650);
      return;
    }
    const baseline = runtime.acceptedGeneration.baselineIdentity;
    const ticket = runtime.acceptedGeneration;
    const liveMessage = ctx()?.chat?.[ticket.expectedIndex];
    const liveSlot = activeSwipeSlot(liveMessage);
    const materializedOverswipe = ticket.slotWasUnmaterialized
      && fresh.index === ticket.expectedIndex
      && fresh.swipeId === ticket.expectedSwipeId
      && liveSlot.materialized;
    const explicitRerollCompletion = ticket.type === 'swipe' || ticket.type === 'regenerate';
    const baselineIndex = Number.isInteger(ticket.baselineIndex)
      ? ticket.baselineIndex : (Number.isInteger(ticket.expectedIndex) ? ticket.expectedIndex : -1);
    const liveChat = ctx()?.chat || [];
    const hasUserAfterBaseline = liveChat.slice(Math.max(0, baselineIndex + 1))
      .some((message) => message?.is_user === true && Boolean(messageText(message)));
    const hasTurnUser = liveChat.slice(Math.max(0, baselineIndex + 1), fresh.index)
      .some((message) => message?.is_user === true && Boolean(messageText(message)));
    const type = ticket.type || 'normal';
    if (type === 'normal' && !hasUserAfterBaseline) {
      runtime.acceptedGeneration = null;
      try { clearGenerationTicket(ticket.chatId || fresh.chatId, ticket.generationKey); }
      catch (error) { noteGenerationTicketFailure('忽略后台生成时清理', error); }
      runtime.phase = text(ticket.priorPhase || (runtime.lastResult?.ok ? 'done' : 'idle'));
      runtime.detail = ticket.priorPhase === 'idle' && !runtime.lastResult
        ? '这是没有用户行动的AI开场或后台生成；医生不会推进变量、档案或后台世界'
        : text(ticket.priorDetail || (runtime.lastResult?.ok ? '上一轮医生任务已完成' : '等待下一条最终回复'));
      runtime.diagnostics.unshift({
        at: new Date().toISOString(), phase: 'background-ignored',
        detail: '生成前锚点之后没有用户楼；已按后台生成忽略，不推进变量、档案或世界',
      });
      persistDiagnostics();
      render();
      return;
    }
    if (baseline && fresh.identity === baseline && !materializedOverswipe && !explicitRerollCompletion) {
      if (type === 'continue') {
        runtime.acceptedGeneration = null;
        try { clearGenerationTicket(ticket.chatId || fresh.chatId, ticket.generationKey); }
        catch (error) { noteGenerationTicketFailure('忽略空续写时清理', error); }
        runtime.phase = text(ticket.priorPhase || (runtime.lastResult?.ok ? 'done' : 'idle'));
        runtime.detail = text(ticket.priorDetail || '续写没有产生新的最终正文；医生未重复推进');
        runtime.diagnostics.unshift({
          at: new Date().toISOString(), phase: 'continue-empty',
          detail: '续写结束后正文指纹未变化；已清理票据，不重复推进变量、档案或世界',
        });
        persistDiagnostics();
        render();
        return;
      }
      setPhase('waiting', '尚未读到新的最终正文，继续等待对应的主聊天生成完成事件');
      setTimeout(() => { void waitForAcceptedFinal(serial); }, 650);
      return;
    }
    if (type === 'normal' && !hasTurnUser) {
      runtime.acceptedGeneration = null;
      try { clearGenerationTicket(ticket.chatId || fresh.chatId, ticket.generationKey); }
      catch (error) { noteGenerationTicketFailure('忽略无用户锚点正文时清理', error); }
      runtime.phase = text(ticket.priorPhase || (runtime.lastResult?.ok ? 'done' : 'idle'));
      runtime.detail = text(ticket.priorDetail || '检测到不属于用户回合的后台正文；医生未接管');
      runtime.diagnostics.unshift({
        at: new Date().toISOString(), phase: 'background-ignored',
        detail: '新助手正文之前没有本轮用户楼；已按后台输出忽略',
      });
      persistDiagnostics();
      render();
      return;
    }
    fresh.generationKey = ticket.generationKey;
    try {
      persistPipelineCheckpoint({
        status: 'running', target: deepClone(fresh), generationType: type,
        nextStep: 'diagnosis', reason: 'auto-generation-handoff',
      });
    } catch (error) {
      runtime.acceptedGeneration = deepClone(ticket);
      noteGenerationTicketFailure('流水线接管检查点', error);
      setPhase('failed', `正文已经确认，但流水线检查点无法持久化；完成票据仍保留，刷新后可继续：${error?.message || error}`);
      return;
    }
    runtime.acceptedGeneration = null;
    // runAcceptedPipeline writes its durable running checkpoint synchronously
    // before its first await. The explicit readback above is the handoff receipt;
    // only after that receipt may the shorter generation ticket be removed.
    const pipeline = runAcceptedPipeline(fresh, 'auto', type);
    try { clearGenerationTicket(ticket.chatId || fresh.chatId, ticket.generationKey); }
    catch (error) { noteGenerationTicketFailure('流水线接管时清理', error); }
    await pipeline;
  }

  function eventName(context, key, fallback) {
    return context?.event_types?.[key] || context?.eventTypes?.[key] || fallback;
  }

  function retryTargetForFailedStep() {
    if (!runtime.failedStep) throw new Error('当前没有失败步骤；不会重复推进同一正文');
    const latest = latestAssistant();
    if (!latest || !runtime.lastAccepted?.identity || latest.identity !== runtime.lastAccepted.identity) {
      throw new Error('失败任务属于另一条正文或swipe；拒绝把旧的跳步重试套到当前最新正文，请改用“手动复检MVU”从头检查当前楼');
    }
    if (runtime.lastAccepted.generationKey) latest.generationKey = runtime.lastAccepted.generationKey;
    return latest;
  }

  function attachKnownGeneration(target) {
    const binding = knownGenerationBinding(target);
    if (target && binding?.generationKey) target.generationKey = binding.generationKey;
    return target;
  }

  function ensureManualGenerationBinding(target) {
    if (!target) throw new Error('当前没有可处理的最终AI回复');
    const known = knownGenerationBinding(target);
    if (known?.generationKey) {
      target.generationKey = known.generationKey;
      return target;
    }
    const checkpoint = loadPipelineCheckpoint(target.chatId);
    if (checkpoint?.target?.identity && checkpoint.target.identity !== target.identity) {
      throw new Error('当前正文已不同于已保存的医生任务；请先手动复检MVU，不能为外部改写直接新开世界收据');
    }
    return establishManualGenerationBinding(target, 'manual-generation-anchor');
  }

  function establishManualGenerationBinding(target, reason = 'manual-generation-anchor') {
    if (!target) throw new Error('当前没有可绑定的最终AI回复');
    const priorCheckpoint = loadPipelineCheckpoint(target.chatId);
    const generationKey = `${target.chatId}:manual:${target.index}:${target.swipeId}:${target.fingerprint}`;
    target.generationKey = generationKey;
    runtime.lastAccepted = deepClone({
      chatId: target.chatId, index: target.index, swipeId: target.swipeId,
      fingerprint: target.fingerprint, identity: target.identity,
      generationKey, generationType: 'manual',
    });
    persistPipelineCheckpoint({
      status: 'complete', target: deepClone(target), generationType: 'manual', nextStep: '',
      reason, lastCompletedStep: '',
      supersededGenerationKey: priorCheckpoint?.target?.identity !== target.identity
        ? text(priorCheckpoint?.target?.generationKey) : '',
    });
    if (priorCheckpoint?.target?.identity && priorCheckpoint.target.identity !== target.identity) {
      runtime.diagnostics.unshift({
        at: new Date().toISOString(), phase: 'checkpoint-superseded',
        detail: '手动MVU复检已确认当前正文；不再可达的旧正文检查点已被当前手动事务替代',
      });
      persistDiagnostics();
    }
    return target;
  }

  function knownGenerationBinding(target) {
    if (!target) return null;
    if (runtime.lastAccepted?.identity === target.identity && runtime.lastAccepted.generationKey) {
      return {
        generationKey: runtime.lastAccepted.generationKey,
        generationType: text(runtime.lastAccepted.generationType || 'normal'),
      };
    }
    const checkpoint = loadPipelineCheckpoint(target.chatId);
    if (checkpoint?.target?.identity === target.identity && checkpoint?.target?.generationKey) {
      return {
        generationKey: checkpoint.target.generationKey,
        generationType: text(checkpoint.generationType || 'normal'),
      };
    }
    return null;
  }

  function migrateDoctorWrittenAcceptedTarget(original, fresh, binding) {
    if (!binding?.generationKey) return fresh;
    if (!original || !fresh || original.chatId !== fresh.chatId || original.index !== fresh.index || original.swipeId !== fresh.swipeId) {
      throw new Error('医生写回后的正文不再属于原楼层或原swipe，拒绝迁移世界收据身份');
    }
    fresh.generationKey = binding.generationKey;
    runtime.lastAccepted = deepClone({
      chatId: fresh.chatId, index: fresh.index, swipeId: fresh.swipeId,
      fingerprint: fresh.fingerprint, identity: fresh.identity,
      generationKey: binding.generationKey, generationType: binding.generationType,
    });
    const checkpoint = loadPipelineCheckpoint(fresh.chatId);
    if (checkpoint?.target?.identity === original.identity
      && (!checkpoint.target.generationKey || checkpoint.target.generationKey === binding.generationKey)) {
      persistPipelineCheckpoint({
        ...checkpoint,
        target: deepClone(fresh),
        generationType: binding.generationType,
      });
    }
    return fresh;
  }

  async function runManualDiagnosisAndResume(rawTarget) {
    const target = attachKnownGeneration(rawTarget);
    if (!target) throw new Error('当前没有可复检的最终AI回复');
    const binding = knownGenerationBinding(target);
    const checkpoint = loadPipelineCheckpoint(target.chatId);
    const resumesFailedDiagnosis = Boolean(
      binding?.generationKey
      && checkpoint?.target?.identity === target.identity
      && checkpoint?.target?.generationKey === binding.generationKey
      && checkpoint?.nextStep === 'diagnosis'
      && ['running', 'failed', 'stale'].includes(checkpoint.status),
    );
    let resumeTarget = null;
    const value = await runExclusiveStage(
      'MVU复检',
      target,
      (owner) => runStoryDiagnosis(target, owner),
      async (fresh) => {
        let migrated = migrateDoctorWrittenAcceptedTarget(target, fresh, binding);
        if (!binding?.generationKey) {
          migrated = establishManualGenerationBinding(migrated, 'manual-diagnosis-anchor');
        }
        if (!resumesFailedDiagnosis) return;
        persistPipelineCheckpoint({
          status: 'running', target: deepClone(migrated), generationType: binding.generationType,
          nextStep: 'profile', reason: 'manual-diagnosis-recovery', lastCompletedStep: 'diagnosis',
        });
        runtime.failedStep = 'profile';
        resumeTarget = deepClone(migrated);
      },
    );
    if (resumeTarget) {
      return runAcceptedPipeline(resumeTarget, 'manual-diagnosis-recovery', binding.generationType, 'profile');
    }
    return value;
  }

  function cancelCurrentTaskFromUi() {
    const currentChatId = chatId();
    const checkpoint = loadPipelineCheckpoint(currentChatId);
    const hadPendingGeneration = Boolean(runtime.acceptedGeneration || loadGenerationTicket(currentChatId));
    const cancellableCheckpoint = checkpoint && ['running', 'failed', 'stale'].includes(checkpoint.status)
      ? checkpoint : null;
    cancelAll('用户从面板取消', true);
    try { clearGenerationTicket(currentChatId); }
    catch (error) { noteGenerationTicketFailure('用户取消时清理', error); }
    if (cancellableCheckpoint?.target?.chatId === currentChatId) {
      try {
        persistPipelineCheckpoint({
          ...cancellableCheckpoint, status: 'cancelled', cancelledAt: new Date().toISOString(),
          cancelReason: '用户从面板取消',
        });
      } catch (error) {
        setPhase('failed', `任务已停止，但取消状态持久化失败：${error?.message || error}`);
        return false;
      }
    }
    runtime.failedStep = '';
    setPhase('cancelled', (cancellableCheckpoint || hadPendingGeneration)
      ? '当前医生任务已取消；刷新后不会自动恢复'
      : '当前没有运行中的医生任务');
    return true;
  }

  function restorePipelineAfterLoad() {
    const checkpoint = loadPipelineCheckpoint(chatId());
    if (!checkpoint) return false;
    const pendingTicket = loadGenerationTicket(chatId());
    const checkpointTime = Number.isFinite(Date.parse(checkpoint.updatedAt || '')) ? Date.parse(checkpoint.updatedAt) : 0;
    const ticketTime = Number.isFinite(Date.parse(pendingTicket?.updatedAt || '')) ? Date.parse(pendingTicket.updatedAt) : 0;
    if (pendingTicket?.generationKey && pendingTicket.generationKey !== checkpoint?.target?.generationKey
      && ['started', 'ended'].includes(pendingTicket.status) && ticketTime >= checkpointTime) {
      // A newer main generation supersedes an older failed/running/cancelled
      // checkpoint.  Its durable ticket owns recovery until it either creates a
      // new checkpoint or is explicitly cancelled.
      return false;
    }
    if (pendingTicket?.generationKey && pendingTicket.generationKey === checkpoint?.target?.generationKey) {
      try { clearGenerationTicket(chatId(), pendingTicket.generationKey); }
      catch (error) { noteGenerationTicketFailure('恢复检查点时清理', error); }
    }
    const latest = latestAssistant();
    const generationType = text(checkpoint.generationType || 'normal');
    if (latest?.identity === checkpoint?.target?.identity) {
      runtime.lastAccepted = deepClone({ ...checkpoint.target, generationType });
    }
    if (checkpoint.status === 'complete' || !checkpoint.nextStep) return false;
    if (checkpoint.status === 'cancelled') {
      runtime.failedStep = '';
      setPhase('cancelled', '已读回用户取消状态；本楼任务不会自动恢复');
      return true;
    }
    const nextStep = ['diagnosis', 'profile', 'world'].includes(checkpoint.nextStep) ? checkpoint.nextStep : 'diagnosis';
    runtime.lastAccepted = deepClone({ ...checkpoint.target, generationType });
    if (!latest || latest.identity !== checkpoint?.target?.identity) {
      runtime.failedStep = '';
      setPhase('failed', '检测到未完成的旧流水线，但它的正文或swipe已不是当前最终回复；已阻止跨正文跳步重试。当前楼如需处理，请点“手动复检MVU”。');
      return true;
    }
    if (checkpoint.target?.generationKey) latest.generationKey = checkpoint.target.generationKey;
    runtime.failedStep = nextStep;
    if (checkpoint.status !== 'running') {
      setPhase(checkpoint.status === 'stale' ? 'discarded' : 'failed', `已恢复本楼失败步骤：${nextStep}。点击“重试失败步骤”只会继续这一楼。`);
      return true;
    }
    setPhase('waiting', `已读回本楼中断检查点，将从${nextStep}继续，不会重做已提交阶段`);
    const expectedIdentity = latest.identity;
    const recoveryEpoch = runtime.pipelineEpoch;
    setTimeout(() => {
      const fresh = latestAssistant();
      const newerTicket = loadGenerationTicket(chatId());
      if (runtime.pipelineEpoch !== recoveryEpoch || runtime.pipelineBusy || chatId() !== checkpoint.target.chatId
        || fresh?.identity !== expectedIdentity
        || (newerTicket?.generationKey && newerTicket.generationKey !== checkpoint.target?.generationKey
          && ['started', 'ended'].includes(newerTicket.status))) return;
      if (checkpoint.target?.generationKey) fresh.generationKey = checkpoint.target.generationKey;
      void runAcceptedPipeline(fresh, 'recovery', generationType, nextStep);
    }, 350);
    return true;
  }

  function restoreGenerationTicketAfterLoad() {
    const ticket = loadGenerationTicket(chatId());
    if (!ticket || ticket.chatId !== chatId() || !ticket.generationKey || !Number.isFinite(Number(ticket.serial))) return false;
    if (!['started', 'ended'].includes(ticket.status)) {
      try { clearGenerationTicket(chatId(), ticket.generationKey); }
      catch (error) { noteGenerationTicketFailure('清理未知状态', error); }
      return false;
    }
    // CHAT_LOADED invalidates all in-memory waiters by incrementing the serial.
    // Remap the durable ticket to one new serial so an old pre-reload timer and
    // the recovered timer can never both own the same accepted reply.
    runtime.generationSerial = Math.max(runtime.generationSerial, Number(ticket.serial)) + 1;
    runtime.acceptedGeneration = deepClone({ ...ticket, serial: runtime.generationSerial });
    try { runtime.acceptedGeneration = persistGenerationTicket(runtime.acceptedGeneration, ticket.status); }
    catch (error) { noteGenerationTicketFailure('恢复后重签', error); }
    runtime.generationType = text(ticket.type || 'normal');
    runtime.generationTicketPersistence = { ok: true, status: ticket.status, error: '' };
    if (ticket.status === 'ended') {
      setPhase('waiting', '已读回正文完成票据；继续等待两次一致的新鲜读取');
      setTimeout(() => { void waitForAcceptedFinal(runtime.generationSerial); }, 0);
    } else {
      setPhase('waiting', '已读回正文生成票据；等待对应的主聊天完成事件');
    }
    return true;
  }

  function beginGenerationTicket(normalizedType, source = 'generation-started') {
    const isReroll = normalizedType === 'swipe' || normalizedType === 'regenerate';
    const baseline = latestAssistant();
    const baselineSlot = activeSwipeSlot(baseline?.message);
    const priorPhase = runtime.phase;
    const priorDetail = runtime.detail;
    cancelAll('新的主聊天生成开始');
    try { clearGenerationTicket(chatId()); }
    catch (error) { noteGenerationTicketFailure('新正文开始前清理', error); }
    runtime.generationSerial += 1;
    runtime.acceptedGeneration = {
      serial: runtime.generationSerial,
      chatId: chatId(),
      type: normalizedType,
      baselineIdentity: baseline?.identity || '',
      baselineIndex: baseline?.index ?? -1,
      generationKey: `${chatId()}:${Date.now().toString(36)}:${runtime.generationSerial}`,
      startedAt: new Date().toISOString(),
      expectedIndex: baseline?.index ?? null,
      expectedSwipeId: baselineSlot.swipeId,
      slotWasUnmaterialized: Boolean(isReroll && baseline && !baselineSlot.materialized),
      priorPhase,
      priorDetail,
      awaitingStart: source === 'message-sent',
      status: 'started',
    };
    try { runtime.acceptedGeneration = persistGenerationTicket(runtime.acceptedGeneration, 'started'); }
    catch (error) { noteGenerationTicketFailure('正文开始', error); }
    runtime.generationType = normalizedType;
    if (isReroll && baseline) scheduleBranchRestore(() => restoreProfileBranch(baseline, true));
    setPhase('waiting', '正文生成中');
    return runtime.acceptedGeneration?.serial;
  }

  function pushGenerationEvent(kind, serial = null) {
    runtime.generationEventStack.push({ kind, serial: Number.isFinite(serial) ? serial : null });
    if (runtime.generationEventStack.length > 32) runtime.generationEventStack.splice(0, runtime.generationEventStack.length - 32);
  }

  function popGenerationEvent() {
    return runtime.generationEventStack.pop() || null;
  }

  function mergeContinuationTicket(ticket) {
    runtime.generationSerial += 1;
    runtime.acceptedGeneration = {
      ...ticket,
      serial: runtime.generationSerial,
      status: 'started',
      awaitingStart: false,
      continuationCount: Number(ticket.continuationCount || 0) + 1,
    };
    try { runtime.acceptedGeneration = persistGenerationTicket(runtime.acceptedGeneration, 'started'); }
    catch (error) { noteGenerationTicketFailure('正文续写合并', error); }
    pushGenerationEvent('ticket', runtime.acceptedGeneration.serial);
    setPhase('waiting', '正文正在续写；保持同一用户回合票据');
  }

  function bindEvents() {
    const context = ctx();
    if (!context?.eventSource?.on) throw new Error('宿主事件总线不可用');
    context.eventSource.on(eventName(context, 'MESSAGE_SENT', 'message_sent'), () => {
      runtime.lastUserMessageAt = Date.now();
      const chat = ctx()?.chat || [];
      const tail = chat.at(-1);
      const activeTicket = runtime.acceptedGeneration;
      if (tail?.is_user !== true) return;
      if (activeTicket?.chatId === chatId() && activeTicket.status === 'started') return;
      const pendingEvent = runtime.generationEventStack.at(-1);
      if (pendingEvent?.kind === 'guarded-normal') {
        const serial = beginGenerationTicket('normal', 'generation-started');
        runtime.generationEventStack[runtime.generationEventStack.length - 1] = { kind: 'ticket', serial };
        return;
      }
      beginGenerationTicket('normal', 'message-sent');
    });
    context.eventSource.on(eventName(context, 'GENERATION_STARTED', 'generation_started'), (type, options, dryRun) => {
      const normalizedType = text(type || 'normal').toLocaleLowerCase();
      const hidden = dryRun === true || options?.dryRun === true || options?.quiet === true
        || options?.silent === true || options?.raw === true
        || ['quiet', 'raw', 'silent', 'impersonate'].includes(normalizedType);
      if (hidden) {
        pushGenerationEvent('ignored');
        return;
      }
      enforceManagedScheduling();
      const mainTypes = new Set(['normal', 'swipe', 'regenerate', 'continue']);
      if (!mainTypes.has(normalizedType)) {
        pushGenerationEvent('ignored');
        return;
      }
      const activeTicket = runtime.acceptedGeneration;
      if (normalizedType === 'continue' && activeTicket?.chatId === chatId()
        && ['started', 'ended'].includes(text(activeTicket.status))) {
        mergeContinuationTicket(activeTicket);
        return;
      }
      if (normalizedType === 'continue' && runtime.pipelineBusy) {
        pushGenerationEvent('ignored');
        return;
      }
      if (activeTicket?.chatId === chatId() && activeTicket.status === 'started'
        && activeTicket.awaitingStart === true && normalizedType === activeTicket.type) {
        runtime.acceptedGeneration = { ...activeTicket, awaitingStart: false };
        try { runtime.acceptedGeneration = persistGenerationTicket(runtime.acceptedGeneration, 'started'); }
        catch (error) { noteGenerationTicketFailure('用户发送后的正文开始', error); }
        pushGenerationEvent('ticket', runtime.acceptedGeneration.serial);
        return;
      }
      // A generation is only provisional until its final chat layer proves
      // that a user turn actually occurred.  While one provisional/accepted
      // ticket or its pipeline owns the chat, later extension generations may
      // finish, but they cannot replace that ticket.
      const explicitReplacement = ['swipe', 'regenerate'].includes(normalizedType);
      if (!explicitReplacement && ((activeTicket?.chatId === chatId()
        && ['started', 'ended'].includes(text(activeTicket.status))) || runtime.pipelineBusy)) {
        pushGenerationEvent('guarded-normal');
        return;
      }
      const serial = beginGenerationTicket(normalizedType, 'generation-started');
      pushGenerationEvent('ticket', serial);
    });
    context.eventSource.on(eventName(context, 'GENERATION_ENDED', 'generation_ended'), () => {
      const event = popGenerationEvent();
      if (event?.kind === 'ignored' || event?.kind === 'guarded-normal') return;
      const ticket = runtime.acceptedGeneration;
      const serial = ticket?.serial;
      if (event?.kind === 'ticket' && event.serial !== serial) return;
      if (Number.isFinite(serial)) {
        try { runtime.acceptedGeneration = persistGenerationTicket({ ...ticket, awaitingStart: false }, 'ended'); }
        catch (error) { noteGenerationTicketFailure('正文完成', error); }
        void waitForAcceptedFinal(serial);
      }
    });
    context.eventSource.on(eventName(context, 'GENERATION_STOPPED', 'generation_stopped'), () => {
      const event = popGenerationEvent();
      if (event?.kind === 'ignored' || event?.kind === 'guarded-normal') return;
      const ticket = runtime.acceptedGeneration;
      if (!ticket || (event?.kind === 'ticket' && event.serial !== ticket.serial)) return;
      cancelAll('正文生成已停止', true);
      try { clearGenerationTicket(ticket.chatId || chatId(), ticket.generationKey); }
      catch (error) { noteGenerationTicketFailure('正文停止时清理', error); }
      setPhase('cancelled', '正文生成已停止；未推进变量、人物档案或后台世界');
    });
    context.eventSource.on(eventName(context, 'MESSAGE_SWIPED', 'message_swiped'), () => {
      const activeTicket = runtime.acceptedGeneration;
      const belongsToStartedReroll = activeTicket?.chatId === chatId()
        && activeTicket.status === 'started'
        && ['swipe', 'regenerate'].includes(activeTicket.type);
      if (!belongsToStartedReroll) {
        cancelAll('swipe已变化', true);
        try { clearGenerationTicket(chatId()); }
        catch (error) { noteGenerationTicketFailure('swipe变化时清理', error); }
      }
      const scheduledChat = chatId();
      const scheduledTarget = latestAssistant();
      void scheduleBranchRestore(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        if (chatId() !== scheduledChat) return true;
        const target = latestAssistant();
        if (!target || target.index !== scheduledTarget?.index || target.swipeId !== scheduledTarget?.swipeId) {
          throw Object.assign(new Error('swipe恢复等待期间目标再次变化，旧恢复任务已丢弃'), { code: STALE_TASK });
        }
        return restoreProfileBranch(target, false);
      }).then((receipt) => {
        if (!receipt?.ok && chatId() === scheduledChat) setPhase('failed', `人物档案分支恢复失败：${receipt.error}`);
      });
    });
    context.eventSource.on(eventName(context, 'CHAT_LOADED', 'chat_loaded'), () => {
      cancelAll('聊天已切换', true);
      runtime.branchRestorePromise = Promise.resolve({ ok: true });
      runtime.generationEventStack = [];
      runtime.lastResult = null;
      runtime.currentTarget = null;
      runtime.lastAccepted = null;
      runtime.failedStep = '';
      const loadedReports = loadRunReports(chatId());
      runtime.runReports = loadedReports.reports;
      runtime.diagnostics = loadDiagnostics(chatId());
      runtime.reportPersistence = loadReportManifest(chatId(), loadedReports);
      if (!runtime.reportPersistence.ok) runtime.diagnostics.push({
        at: new Date().toISOString(), phase: 'report-incomplete',
        detail: `本聊天内部运行日志不完整：${runtime.reportPersistence.error || '持久化条数不一致'}`,
      });
      persistDiagnostics();
      if (!restorePipelineAfterLoad() && !restoreGenerationTicketAfterLoad()) {
        setPhase('idle', '已切换聊天；当前聊天档案已独立读回');
      }
    });
  }

  function redactApiConfiguration(value, secretValues, seen = new WeakSet()) {
    if (typeof value === 'string') {
      const exactRedacted = secretValues.reduce((output, secret) => secret.length >= 3
        ? output.split(secret).join('[EXCLUDED_API_VALUE]') : output, value);
      return exactRedacted
        .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/giu, 'Bearer [EXCLUDED_API_VALUE]')
        .replace(/((?:api[_ -]?key|authorization)\s*[=:]\s*)[^\s,;]+/giu, '$1[EXCLUDED_API_VALUE]');
    }
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => redactApiConfiguration(item, secretValues, seen));
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (/(?:api.?key|authorization|endpoint|api.?url|credential)/iu.test(key)) {
        output[key] = '[EXCLUDED_API_FIELD]';
      } else output[key] = redactApiConfiguration(item, secretValues, seen);
    }
    return output;
  }

  function currentApiSecretValues() {
    const worldConnection = worldApiConfig().config || {};
    const storyConnection = ctx()?.extensionSettings?.storyOracle || {};
    return [...new Set([
      worldConnection.apiKey, worldConnection.apiUrl, worldConnection.model,
      storyConnection.apiKey, storyConnection.endpoint, storyConnection.model, storyConnection.profileId,
    ].map((value) => String(value || '')).filter(Boolean))];
  }

  async function safeExport() {
    let storyLog = null;
    let storyFixConfig = null;
    try { storyLog = window.StoryOracleAPI?.unsafe?.eval?.('JSON.parse(JSON.stringify(convo))') || null; } catch { storyLog = null; }
    try { storyFixConfig = storyInternals().getFixCfg?.() || null; } catch { storyFixConfig = null; }
    const reportTarget = runtime.lastAccepted?.index ?? latestAssistant()?.index;
    const secretValues = currentApiSecretValues();
    const report = redactApiConfiguration({
      exportedAt: new Date().toISOString(),
      version: ENGINE_VERSION,
      chatId: chatId(),
      chat: deepClone(ctx()?.chat || []),
      runtime: {
        phase: runtime.phase, detail: runtime.detail,
        currentTarget: runtime.currentTarget, lastResult: runtime.lastResult,
        diagnostics: runtime.diagnostics, runs: runtime.runReports,
        reportPersistence: runtime.reportPersistence,
        diagnosticPersistence: runtime.diagnosticPersistence,
      },
      doctorSettings: settings(),
      profiles: readStore(),
      world: (() => { try { return window.WORLD_ENGINE_CORE?.loadState?.() || null; } catch { return null; } })(),
      worldDebug: (() => { try { return window.WORLD_ENGINE_EVOLUTION?.getLastDebug?.() || null; } catch { return null; } })(),
      mvu: Number.isInteger(Number(reportTarget)) ? await currentMvuState(Number(reportTarget)) : null,
      storyOracle: {
        loaded: Boolean(window.StoryOracleAPI),
        nativeAutoDisabled: ctx()?.extensionSettings?.storyOracle?.autoDiagnoseEnabled === false
          && storyFixConfig?.autoFixEnabled === false,
        settings: deepClone(ctx()?.extensionSettings?.storyOracle || {}),
        log: storyLog,
      },
      worldEngineSettings: deepClone(worldApiConfig().config || {}),
      pipelineCheckpoint: loadPipelineCheckpoint(chatId()),
      api: { configured: worldApiConfig().configured, excluded: true },
    }, secretValues);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `mvu-doctor-reference-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function saveApiForm(panel) {
    const store = window.WORLD_ENGINE_STORE;
    const api = window.WORLD_ENGINE_API;
    if (!store?.setItem || !api?.getSettings) throw new Error('世界引擎设置尚未就绪');
    let current = {};
    try { current = JSON.parse(store.getItem('world_engine_settings') || '{}'); } catch { current = {}; }
    const endpoint = normalizeSharedEndpoint(panel.querySelector('[name=api-endpoint]')?.value);
    const model = text(panel.querySelector('[name=api-model]')?.value);
    const apiKey = String(panel.querySelector('[name=api-key]')?.value || '');
    const connectionMode = panel.querySelector('[name=api-proxy]')?.checked ? 'proxy' : 'direct';
    store.setItem('world_engine_settings', JSON.stringify({
      ...current, apiUrl: endpoint, model, apiKey, connectionMode,
      engineEnabled: true, syncToChat: true, injectIntoPrompt: true, evolveMode: 'manual',
    }));
    const worldReadback = api.getSettings(true);
    const context = ctx();
    if (context?.extensionSettings) {
      const story = context.extensionSettings.storyOracle ||= {};
      story.mode = 'direct';
      story.endpoint = endpoint;
      story.model = model;
      story.apiKey = apiKey;
      story.directViaBackend = connectionMode === 'proxy';
      story.directRawUrl = true;
      story.autoDiagnoseEnabled = false;
      const doctor = context.extensionSettings['mvu-doctor-kemini-clean'] ||= {};
      doctor[SETTINGS_KEY] = {
        ...settings(),
        diagnoseEnabled: panel.querySelector('[name=stage-diagnosis]')?.checked !== false,
        profileEnabled: panel.querySelector('[name=stage-profile]')?.checked !== false,
        worldEnabled: panel.querySelector('[name=stage-world]')?.checked !== false,
        globalPrompt: text(panel.querySelector('[name=global-prompt]')?.value),
      };
      if (typeof context.saveSettings === 'function') await context.saveSettings();
      else context.saveSettingsDebounced?.();
    }
    const storyReadback = context?.extensionSettings?.storyOracle || {};
    if (normalizeSharedEndpoint(worldReadback?.apiUrl) !== endpoint || text(worldReadback?.model) !== model
      || String(worldReadback?.apiKey || '') !== apiKey || worldReadback?.connectionMode !== connectionMode
      || normalizeSharedEndpoint(storyReadback.endpoint) !== endpoint || text(storyReadback.model) !== model
      || String(storyReadback.apiKey || '') !== apiKey || storyReadback.directRawUrl !== true) {
      throw new Error('共用API保存后，Story Oracle与World Engine的内存读回不一致');
    }
    setPhase('idle', '连接与三阶段开关已保存；原件的并发自动触发保持关闭');
  }

  function panelHtml(activeTab = 'overview') {
    const store = readStore();
    const world = (() => { try { return window.WORLD_ENGINE_CORE?.loadState?.() || {}; } catch { return {}; } })();
    const apiState = worldApiConfig();
    const profiles = Object.values(store.profiles);
    const completeProfiles = profiles.filter((profile, index) => validateProfile(profile, index).length === 0);
    const invalidProfiles = profiles.filter((profile, index) => validateProfile(profile, index).length > 0);
    const diagnosticView = {
      ...runtime,
      diagnostics: runtime.diagnostics.slice(0, 40),
      runReports: runtime.runReports.slice(0, 6),
    };
    const profileCards = activeTab === 'profiles' && profiles.length ? profiles.map((profile) => `
      <details class="mvu-ref-card">
        <summary><strong>${escapeHtml(profile.name)}</strong><span>${validateProfile(profile, 0).length ? '档案异常' : '完整'} · ${escapeHtml(profile.identity?.occupation || profile.identity?.species || '')}</span></summary>
        <div class="mvu-ref-grid">
          <p><b>身份</b>${escapeHtml([profile.identity?.species, profile.identity?.gender, profile.identity?.age, profile.identity?.affiliation].filter(Boolean).join(' · '))}</p>
          <p><b>当前目标</b>${escapeHtml(profile.currentState?.goal || '')}</p>
          <p><b>性格</b>${escapeHtml([profile.personality?.temperament, profile.personality?.coreDesire, profile.personality?.values].filter(Boolean).join('；'))}</p>
          <p><b>状态</b>${escapeHtml([profile.currentState?.location, profile.currentState?.condition, profile.currentState?.emotion].filter(Boolean).join('；'))}</p>
          <p><b>经历</b>${escapeHtml(profile.history || '')}</p>
          <p><b>可修订补全</b>${escapeHtml((profile.inferences || []).join('；'))}</p>
          <details class="mvu-ref-profile-full"><summary>查看完整档案全部字段</summary><pre>${escapeHtml(JSON.stringify(profile, null, 2))}</pre></details>
        </div>
      </details>`).join('') : (activeTab === 'profiles' ? '<p class="mvu-ref-empty">当前聊天还没有人物档案。</p>' : '');
    return `
      <header><div><small>KEMINI REFERENCE · ${ENGINE_VERSION}</small><h2>人物与世界医生</h2></div><button data-action="close" aria-label="关闭">×</button></header>
      <nav><button data-tab="overview" class="active">总览</button><button data-tab="profiles">人物 ${profiles.length}</button><button data-tab="world">世界</button><button data-tab="settings">连接</button><button data-tab="diagnostics">诊断</button></nav>
      <section data-page="overview" class="active">
        <div class="mvu-ref-status ${escapeHtml(runtime.phase)}"><strong>${escapeHtml(runtime.phase)}</strong><span>${escapeHtml(runtime.detail)}</span></div>
        <div class="mvu-ref-metrics"><div><b>${completeProfiles.length}</b><span>完整档案</span></div><div><b>${invalidProfiles.length}</b><span>异常档案</span></div><div><b>${Number(world.round || 0)}</b><span>世界轮次</span></div><div><b>${apiState.configured ? '已配置' : '未配置'}</b><span>共用API</span></div></div>
        <div class="mvu-ref-actions"><button data-action="retry-failed">重试失败步骤</button><button data-action="retry-diagnosis">手动复检MVU</button><button data-action="retry-profile">重填本楼人物</button><button data-action="retry-world">重试世界推进</button><button data-action="cancel">取消当前医生任务</button><button data-action="export">导出本页会话完整报告（排除全部API配置）</button></div>
        <p class="mvu-ref-note">唯一顺序：最终正文确认 → Story Oracle原版诊断 → ver5.35填表事务 → Disnight World Engine 3.0.2。旧Doctor核心未运行。</p>
      </section>
      <section data-page="profiles">${profileCards}</section>
      <section data-page="world">${activeTab === 'world' ? `<pre>${escapeHtml(JSON.stringify(world, null, 2))}</pre>` : ''}</section>
      <section data-page="settings">
        <label>API地址<input name="api-endpoint" value="${escapeAttr(apiState.config.apiUrl || '')}" placeholder="https://host/v1/chat/completions"></label>
        <label>模型<input name="api-model" value="${escapeAttr(apiState.config.model || '')}" placeholder="model-name"></label>
        <label>API密钥<input name="api-key" type="password" value="${escapeAttr(apiState.config.apiKey || '')}" autocomplete="off"></label>
        <label class="mvu-ref-check"><input name="api-proxy" type="checkbox" ${apiState.config.connectionMode === 'proxy' ? 'checked' : ''}>经酒馆后端转发（推荐，避免CORS）</label>
        <label>全局自定义模型适配附加提示词<textarea name="global-prompt" rows="5" placeholder="同时追加给变量、人物和世界模型；留空即不追加">${escapeHtml(settings().globalPrompt)}</textarea></label>
        <fieldset><legend>医生阶段</legend>
          <label class="mvu-ref-check"><input name="stage-diagnosis" type="checkbox" ${settings().diagnoseEnabled ? 'checked' : ''}>Story Oracle变量复检</label>
          <label class="mvu-ref-check"><input name="stage-profile" type="checkbox" ${settings().profileEnabled ? 'checked' : ''}>完整人物档案填表</label>
          <label class="mvu-ref-check"><input name="stage-world" type="checkbox" ${settings().worldEnabled ? 'checked' : ''}>后台世界推进</label>
        </fieldset>
        <button data-action="save-api">保存连接与阶段设置</button>
      </section>
      <section data-page="diagnostics">${activeTab === 'diagnostics' ? `<p class="mvu-ref-note">界面只显示最近40条状态和6次运行，避免手机长会话卡顿；“导出完整报告”包含本页会话保存的全部记录。</p><pre>${escapeHtml(JSON.stringify({ runtime: diagnosticView, store: { revision: store.revision, history: store.history }, boot: window.MVUDoctorReferenceBaseline }, null, 2))}</pre>` : ''}</section>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

  function ensureUi() {
    if (!document.getElementById('mvu-ref-launcher')) {
      const launcher = document.createElement('button');
      launcher.id = 'mvu-ref-launcher';
      launcher.type = 'button';
      launcher.title = '人物与世界医生';
      launcher.textContent = '✦';
      launcher.addEventListener('click', () => {
        const panel = document.getElementById('mvu-ref-panel');
        panel.hidden = !panel.hidden;
        if (!panel.hidden) render(true);
      });
      document.body.appendChild(launcher);
    }
    if (!document.getElementById('mvu-ref-panel')) {
      const panel = document.createElement('aside');
      panel.id = 'mvu-ref-panel';
      panel.hidden = true;
      panel.addEventListener('click', async (event) => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        const tab = event.target.closest('[data-tab]')?.dataset.tab;
        if (tab) {
          panel.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
          panel.querySelectorAll('[data-page]').forEach((page) => page.classList.toggle('active', page.dataset.page === tab));
          render(true);
          return;
        }
        if (action === 'close') panel.hidden = true;
        else if (action === 'retry-failed') {
          if (!runtime.failedStep) setPhase('idle', '当前没有失败步骤；不会重复推进同一正文');
          else {
            try { await runAcceptedPipeline(retryTargetForFailedStep(), 'manual', runtime.lastAccepted?.generationType || 'normal', runtime.failedStep); }
            catch (error) { setPhase('failed', error?.message || String(error)); }
          }
        }
        else if (action === 'retry-diagnosis') {
          const target = latestAssistant();
          try {
            setPhase('diagnosing', '正在手动复检本楼MVU');
            const value = await runManualDiagnosisAndResume(target);
            if (!value?.diagnosis && !value?.profile && !value?.world) {
              setPhase('done', `MVU手动复检完成：${value.status}`, value);
            }
          }
          catch (error) { if (error?.code !== STALE_TASK) setPhase('failed', `MVU手动复检失败：${error.message || error}`); }
        }
        else if (action === 'retry-profile') {
          const target = latestAssistant();
          try { await runExclusiveStage('人物补档', target, (owner) => runTarget(target, 'manual', owner)); }
          catch (error) { if (error?.code !== STALE_TASK) setPhase('failed', `人物手动补档失败：${error.message || error}`); }
        }
        else if (action === 'retry-world') {
          try {
            const target = ensureManualGenerationBinding(latestAssistant());
            const reroll = runtime.failedStep === 'world'
              ? ['swipe', 'regenerate'].includes(runtime.lastAccepted?.generationType)
              : false;
            setPhase('world-running', '正在重试世界推进');
            const value = await runExclusiveStage('世界推进', target, (owner) => runWorldEvolution(target, reroll, owner));
            setPhase('done', `世界推进重试完成：第${value.afterRound}轮`, value);
          }
          catch (error) { if (error?.code !== STALE_TASK) setPhase('failed', `世界推进重试失败：${error.message || error}`); }
        }
        else if (action === 'cancel') cancelCurrentTaskFromUi();
        else if (action === 'export') await safeExport();
        else if (action === 'save-api') {
          try { await saveApiForm(panel); render(true); }
          catch (error) { setPhase('failed', error.message || String(error)); }
        }
      });
      document.body.appendChild(panel);
    }
  }

  function render(force = false) {
    ensureUi();
    const panel = document.getElementById('mvu-ref-panel');
    if (!panel || panel.hidden) return;
    const active = panel.querySelector('[data-tab].active')?.dataset.tab || 'overview';
    if (!force) {
      const settingsOpen = panel.querySelector('[data-tab="settings"].active');
      if (settingsOpen || panelHasActiveEditor()) return;
    }
    const currentPage = panel.querySelector(`[data-page="${active}"]`);
    const scrollTop = currentPage?.scrollTop || 0;
    const openDetails = currentPage
      ? [...currentPage.querySelectorAll('details')].map((detail, index) => detail.open ? index : -1).filter((index) => index >= 0)
      : [];
    panel.innerHTML = panelHtml(active);
    panel.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === active));
    panel.querySelectorAll('[data-page]').forEach((page) => page.classList.toggle('active', page.dataset.page === active));
    const nextPage = panel.querySelector(`[data-page="${active}"]`);
    if (nextPage) {
      const details = [...nextPage.querySelectorAll('details')];
      openDetails.forEach((index) => { if (details[index]) details[index].open = true; });
      nextPage.scrollTop = scrollTop;
    }
  }

  function panelHasActiveEditor() {
    const panel = document.getElementById('mvu-ref-panel');
    const active = document.activeElement;
    return Boolean(panel && active && panel.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/u.test(active.tagName));
  }

  function runtimeSnapshot() {
    const { abortController, branchRestorePromise, ...serializable } = runtime;
    return deepClone(serializable);
  }

  function init() {
    ensureUi();
    enforceManagedScheduling();
    bindEvents();
    const loadedReports = loadRunReports(chatId());
    runtime.runReports = loadedReports.reports;
    runtime.reportPersistence = loadReportManifest(chatId(), loadedReports);
    runtime.diagnostics = loadDiagnostics(chatId());
    if (!runtime.reportPersistence.ok) runtime.diagnostics.unshift({
      at: new Date().toISOString(), phase: 'report-incomplete',
      detail: `本聊天内部运行日志不完整：${runtime.reportPersistence.error || '持久化条数不一致'}`,
    });
    persistDiagnostics();
    if (!restorePipelineAfterLoad() && !restoreGenerationTicketAfterLoad()) {
      setPhase('idle', '参考原版运行链已加载，等待下一条最终回复');
    }
    setInterval(() => {
      if (!document.getElementById('mvu-ref-panel')?.hidden) render();
    }, 5000);
    window.MVUDoctorProfileEngine = {
      ready: true,
      version: ENGINE_VERSION,
      runCurrent: () => runtime.failedStep
        ? runAcceptedPipeline(retryTargetForFailedStep(), 'manual', runtime.lastAccepted?.generationType || 'normal', runtime.failedStep)
        : Promise.resolve({ ok: false, status: 'nothing-to-retry' }),
      runDiagnosis: () => runManualDiagnosisAndResume(latestAssistant()),
      runProfile: () => { const target = latestAssistant(); return runExclusiveStage('人物补档', target, (owner) => runTarget(target, 'manual', owner)); },
      runWorld: (redo = false) => { const target = ensureManualGenerationBinding(latestAssistant()); return runExclusiveStage('世界推进', target, (owner) => runWorldEvolution(target, Boolean(redo), owner)); },
      cancel: () => cancelCurrentTaskFromUi(),
      getStore: () => readStore(),
      getRuntime: () => runtimeSnapshot(),
      parseJsonResponse,
      installWorldContextBridge,
    };
  }

  try { init(); }
  catch (error) {
    console.error('[MVU Doctor] 人物档案填表引擎初始化失败', error);
    window.MVUDoctorProfileEngine = { ready: false, error: error.message || String(error) };
  }
})();
