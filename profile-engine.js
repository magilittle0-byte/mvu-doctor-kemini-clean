(() => {
  'use strict';

  const ENGINE_VERSION = '0.8.8-reference-baseline';
  const METADATA_KEY = 'mvuDoctorReferenceProfiles';
  const PROFILE_STORAGE_PREFIX = 'mvuDoctorReferenceProfileStore:';
  const SETTINGS_KEY = 'mvuDoctorReferenceSettings';
  const REPORT_STORAGE_PREFIX = 'mvuDoctorReferenceReport:';
  const DIAGNOSTIC_STORAGE_PREFIX = 'mvuDoctorReferenceDiagnostics:';
  const DIAGNOSTIC_INTEGRITY_STORAGE_PREFIX = 'mvuDoctorReferenceDiagnosticIntegrity:';
  const PIPELINE_STORAGE_PREFIX = 'mvuDoctorReferencePipeline:';
  const GENERATION_TICKET_PREFIX = 'mvuDoctorReferenceGeneration:';
  const WORLD_RECEIPT_STORAGE_PREFIX = 'mvuDoctorReferenceWorldReceipt:';
  const MAX_HISTORY = 24;
  const MAX_BRANCH_MESSAGES = 8;
  // Directly retained from the mature 0.7.x completeness contract: a
  // placeholder does not become usable merely because punctuation or an
  // explanatory wrapper was appended to it.
  const EMPTY_WORDS = /^(?:(?:未知|不详|待定|待确认|未登记|未说明|暂无|尚不明确|无法确认|无法判断|不可知|unknown|null|n\/a)(?:$|[\s（(：:，,。；;])|无$)/iu;
  // The real 0.8.3 run returned placeholders as the field's actual answer: at
  // the start, or sentence-final after a generic wrapper.  Keep those invalid,
  // but do not reject a substantive role merely because it describes an
  // unknown object in the middle of the sentence.
  const PROFILE_EDGE_PLACEHOLDER = /(?:^(?:未知|不详|待定|未登记|未设定|暂无|正文未提及)(?:$|[\s（(：:，,。；;])|(?:未知|不详|待定|未登记|未设定|暂无|正文未提及)[\s）)】\]}》〉”’"'」』。；;，,:：、!?！？]*$)/iu;
  const WORLD_CONTEXT_BRIDGE = Symbol.for('mvu-doctor.reference.world-context-bridge');
  const WORLD_PUBLIC_PROJECTION_BRIDGE = Symbol.for('mvu-doctor.reference.world-public-projection-bridge');
  const STALE_TASK = 'stale_accepted_target';
  const PROFILE_BRANCH_ROLLBACK_FAILED = 'profile_branch_rollback_failed';

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

  // Direct copy of the mature 0.7.5 prompt crop: preserve both ends instead
  // of silently dropping the newest material at the tail.
  function cropForModel(value, limit = 80000) {
    const source = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    if (source.length <= limit) return source;
    const half = Math.floor(limit / 2);
    return `${source.slice(0, half)}\n……中间省略${source.length - limit}字……\n${source.slice(-half)}`;
  }

  function usable(value) {
    const valueText = text(value);
    return valueText.length > 0 && /[\p{L}\p{N}]/u.test(valueText)
      && !EMPTY_WORDS.test(valueText) && !PROFILE_EDGE_PLACEHOLDER.test(valueText);
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

  function emptyStore(currentChatId = chatId()) {
    return {
      schema: 2, chatId: currentChatId, revision: 0,
      profiles: {}, branches: {}, profileReceipts: {}, history: [], updatedAt: '',
    };
  }

  function profileStorageKey(currentChatId) {
    return `${PROFILE_STORAGE_PREFIX}${encodeURIComponent(currentChatId)}`;
  }

  function normalizeProfileStore(value, currentChatId) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyStore(currentChatId);
    const cloned = deepClone(value);
    if (text(cloned.chatId) && text(cloned.chatId) !== currentChatId) {
      throw new Error(`人物档案存储聊天身份不一致：${text(cloned.chatId)} != ${currentChatId}`);
    }
    cloned.profiles = cloned.profiles && typeof cloned.profiles === 'object' && !Array.isArray(cloned.profiles) ? cloned.profiles : {};
    cloned.branches = cloned.branches && typeof cloned.branches === 'object' && !Array.isArray(cloned.branches) ? cloned.branches : {};
    cloned.profileReceipts = cloned.profileReceipts && typeof cloned.profileReceipts === 'object' && !Array.isArray(cloned.profileReceipts)
      ? cloned.profileReceipts : {};
    cloned.history = Array.isArray(cloned.history) ? cloned.history : [];
    return { ...emptyStore(currentChatId), ...cloned, chatId: currentChatId };
  }

  function parseProfileStoreRaw(raw, currentChatId) {
    if (raw === null || raw === undefined || raw === '') return null;
    try { return normalizeProfileStore(JSON.parse(raw), currentChatId); }
    catch (error) {
      throw new Error(`人物档案持久存储损坏：${error?.message || error}`);
    }
  }

  function legacyMetadataStore(currentChatId) {
    if (!currentChatId || chatId() !== currentChatId) return null;
    const value = ctx()?.chatMetadata?.[METADATA_KEY];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return normalizeProfileStore(value, currentChatId);
  }

  function readStoreForChat(currentChatId) {
    if (!currentChatId) return emptyStore('');
    const store = doctorPersistenceStore();
    const durable = parseProfileStoreRaw(store.getItem(profileStorageKey(currentChatId)), currentChatId);
    if (durable) return durable;
    return legacyMetadataStore(currentChatId) || emptyStore(currentChatId);
  }

  function readStore() {
    return readStoreForChat(chatId());
  }

  async function confirmProfileStoreDurable(currentChatId = chatId()) {
    if (!currentChatId) throw new Error('人物档案持久化缺少聊天身份');
    const store = doctorPersistenceStore();
    if (store !== window.WORLD_ENGINE_STORE) throw new Error('世界引擎 IndexedDB 不可用，人物档案拒绝降级到易失存储');
    const key = profileStorageKey(currentChatId);
    const durable = parseProfileStoreRaw(store.getItem(key), currentChatId);
    if (durable) return { backend: 'indexedDB', durable: true, empty: false };
    const legacy = legacyMetadataStore(currentChatId);
    if (!legacy) return { backend: 'indexedDB', durable: true, empty: true };
    const receipt = await durableWorldStoreBatch(store, [[key, JSON.stringify(legacy)]]);
    if (!receipt.durable) throw new Error('旧人物档案迁移没有取得 IndexedDB 事务回执');
    return { ...receipt, empty: false, migrated: true };
  }

  function storeDigest(value) {
    return JSON.stringify({
      schema: Number(value?.schema || 0),
      chatId: text(value?.chatId),
      revision: Number(value?.revision || 0),
      profiles: value?.profiles || {},
      branches: value?.branches || {},
      profileReceipts: value?.profileReceipts || {},
      history: value?.history || [],
    });
  }

  let storeCommitTail = Promise.resolve();

  async function commitStoreNow(next, expectedChatId = chatId(), expectedRevision = null, assertCurrent = null) {
    if (typeof assertCurrent === 'function') assertCurrent();
    if (!expectedChatId || expectedChatId === 'default') throw new Error('当前聊天尚未取得稳定ID，拒绝写入人物档案');
    if (chatId() !== expectedChatId) throw Object.assign(new Error('任务目标聊天已变化，拒绝跨聊天提交'), { code: STALE_TASK });
    const store = doctorPersistenceStore();
    if (store !== window.WORLD_ENGINE_STORE) throw new Error('世界引擎 IndexedDB 不可用，人物档案原子提交已停止');
    const key = profileStorageKey(expectedChatId);
    const previous = readStoreForChat(expectedChatId);
    const snapshot = deepClone(next);
    snapshot.chatId = expectedChatId;
    snapshot.updatedAt = new Date().toISOString();
    const snapshotRaw = JSON.stringify(snapshot);
    if (expectedRevision !== null && Number(previous?.revision || 0) !== Number(expectedRevision || 0)) {
      throw Object.assign(new Error('人物档案基线版本已变化，旧任务不得覆盖新提交'), { code: STALE_TASK });
    }
    try {
      if (typeof assertCurrent === 'function') assertCurrent();
      const persistence = await durableWorldStoreBatch(store, [[key, snapshotRaw]]);
      if (!persistence.durable) throw new Error('人物档案提交没有取得 IndexedDB 事务完成回执');
      if (typeof assertCurrent === 'function') assertCurrent();
      if (chatId() !== expectedChatId) throw Object.assign(new Error('保存期间聊天已切换，拒绝确认旧任务'), { code: STALE_TASK });
      const readback = parseProfileStoreRaw(store.getItem(key), expectedChatId);
      if (!readback || readback.chatId !== snapshot.chatId || storeDigest(readback) !== storeDigest(snapshot)) {
        throw new Error('人物档案提交后的 IndexedDB 读回摘要不一致');
      }
      return { store: deepClone(readback), persistence: persistence.backend };
    } catch (error) {
      const current = parseProfileStoreRaw(store.getItem(key), expectedChatId);
      if (current && storeDigest(current) === storeDigest(snapshot)) {
        try {
          const rollback = await durableWorldStoreBatch(store, [[key, JSON.stringify(previous)]]);
          if (!rollback.durable) throw new Error('旧分支回滚没有取得 IndexedDB 事务完成回执');
          const restored = parseProfileStoreRaw(store.getItem(key), expectedChatId);
          if (!restored || storeDigest(restored) !== storeDigest(previous)) throw new Error('旧分支回滚后的读回不一致');
        }
        catch (rollbackError) {
          const rollbackMessage = rollbackError?.message || String(rollbackError);
          throw Object.assign(new Error(`人物档案旧分支未能在 IndexedDB 中原子回滚：${rollbackMessage}`), {
            code: PROFILE_BRANCH_ROLLBACK_FAILED,
            rollbackError: rollbackMessage,
            originalError: error?.message || String(error),
          });
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
      const activeSwipe = message.swipes[swipeId];
      if (typeof activeSwipe === 'string') return activeSwipe;
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
      const target = assistantAt(index);
      if (target) return target;
    }
    return null;
  }

  function assistantAt(index) {
    const messageId = Number(index);
    const message = ctx()?.chat?.[messageId];
    if (!Number.isInteger(messageId) || !message || message.is_user || message.is_system || !messageText(message)) return null;
    return decorateTarget({
      index: messageId,
      message,
      swipeId: Number(message.swipe_id) || 0,
      content: messageText(message),
    });
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
      else value.forEach((item, itemIndex) => {
        if (typeof item !== 'string' || !usable(item)) errors.push(`第${index + 1}张档案的${path}[${itemIndex}]不是可用完整内容`);
      });
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

  // The mature database templates keep the requested row identity in the
  // script/SELECT and let the model fill only the missing cells.  These rows
  // are the JSON adapter for that same ownership boundary.
  function profileTargetRows(candidateNames, store = null) {
    return candidateNames.map((candidateName, index) => {
      const sourceName = text(candidateName);
      const existing = findUniqueExistingProfile(store?.profiles || {}, { name: sourceName, aliases: [] });
      return {
        rowId: `P${index + 1}`,
        sourceName,
        canonicalName: text(existing?.name) || sourceName,
      };
    });
  }

  function bindProfilesToTargetRows(envelope, targetRows, reservedSourceNames = []) {
    const rowsById = new Map(targetRows.map((row) => [row.rowId, row]));
    const reservedNames = new Set(reservedSourceNames.map((name) => text(name).toLocaleLowerCase()).filter(Boolean));
    const claimedRows = new Set();
    const errors = [];
    const profiles = [];
    const suppliedProfiles = Array.isArray(envelope?.profiles) ? envelope.profiles : [];
    const unambiguousSingle = targetRows.length === 1 && suppliedProfiles.length === 1;

    suppliedProfiles.forEach((candidate, index) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        errors.push(`第${index + 1}张档案不是对象，无法绑定目标行`);
        return;
      }
      let rowId = text(candidate.rowId);
      if (!rowId && unambiguousSingle) rowId = targetRows[0].rowId;
      if (!rowId) {
        errors.push(`第${index + 1}张档案缺少rowId；多人物批次不得按返回顺序猜配`);
        return;
      }
      const row = rowsById.get(rowId);
      if (!row) {
        errors.push(`第${index + 1}张档案使用了未知rowId ${rowId}`);
        return;
      }
      if (claimedRows.has(rowId)) {
        errors.push(`rowId ${rowId}被重复返回`);
        return;
      }
      claimedRows.add(rowId);

      const returnedName = text(candidate.name);
      const canonicalName = text(row.canonicalName) || row.sourceName;
      let aliases = Array.isArray(candidate.aliases) ? [...candidate.aliases] : candidate.aliases;
      if (Array.isArray(aliases)) aliases = aliases
        .map((name) => typeof name === 'string' ? text(name) : name)
        .filter((name) => typeof name !== 'string'
          || (name && !reservedNames.has(name.toLocaleLowerCase())));
      if (Array.isArray(aliases)) {
        if (row.sourceName.toLocaleLowerCase() !== canonicalName.toLocaleLowerCase()) aliases.push(row.sourceName);
        if (returnedName && returnedName.toLocaleLowerCase() !== canonicalName.toLocaleLowerCase()) aliases.push(returnedName);
      }
      const { rowId: _discardedRowId, ...profile } = candidate;
      profiles.push({
        ...profile,
        name: canonicalName,
        aliases: Array.isArray(aliases) ? [...new Set(aliases.filter((name) => (
          typeof name !== 'string' || (
            name.toLocaleLowerCase() !== canonicalName.toLocaleLowerCase()
            && !reservedNames.has(name.toLocaleLowerCase())
          )
        )))] : aliases,
      });
    });

    for (const row of targetRows) {
      if (!claimedRows.has(row.rowId)) errors.push(`目标行${row.rowId}（${row.sourceName}）没有返回档案`);
    }
    return {
      envelope: {
        ...envelope,
        profiles,
        detectedCharacters: profiles.map((profile) => profile.name),
        noProfileReason: profiles.length ? '' : text(envelope?.noProfileReason),
      },
      errors,
    };
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
    '名称', '姓名', '名字', '成员', '列表',
    'content', 'details', 'summary', 'updatevariable', 'jsonpatch',
  ]);
  const NON_PERSON_LABEL = /(?:环境|地图|任务|进度|状态|档案|世界|回廊|旁白|系统|变量|更新|摘要|情报|警戒|选项|属性|数值|面板|记录|正文|总览|目标|事件|物资库)$/u;
  const PLAYER_LABEL = /^(?:user|玩家|用户|主人公|主角|契约者|我|你)$/iu;

  // Directly transplanted from the mature Actor discovery path.  These are
  // structured sources already owned by MVU/the accepted reply, not prose NER.
  const ACTOR_JSON_PATCH_CONTAINERS = new Set([
    '固有角色', '当前敌人', '其他契约者名单', '人际关系', '队友', '同伴',
    '角色', '人物', '敌人', 'npc', 'npcs', 'actor', 'actors', 'character',
    'characters', 'enemy', 'enemies',
  ]);

  function taggedTextBlocks(value, tag) {
    const source = String(value || '');
    const escaped = String(tag || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (!escaped) return [];
    return [...source.matchAll(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'giu'))]
      .map((match) => String(match[1] || ''));
  }

  function decodeJsonPointerSegment(value) {
    const decoded = String(value || '').replace(/~1/gu, '/').replace(/~0/gu, '~');
    try { return decodeURIComponent(decoded); }
    catch { return decoded; }
  }

  function jsonPatchActorNames(content) {
    const names = new Set();
    for (const block of taggedTextBlocks(content, 'JSONPatch')) {
      let operations = [];
      try {
        const source = String(block || '')
          .replace(/^\s*```(?:json)?\s*/iu, '')
          .replace(/\s*```\s*$/u, '')
          .trim();
        const parsed = JSON.parse(source);
        operations = Array.isArray(parsed) ? parsed : [];
      } catch {
        operations = [...String(block || '').matchAll(/["']path["']\s*:\s*["']([^"']+)["']/giu)]
          .map((match) => ({ path: match[1] }));
      }
      for (const operation of operations) {
        const rawPath = text(operation?.path).slice(0, 600);
        if (!rawPath.startsWith('/')) continue;
        const segments = rawPath.split('/').slice(1).map(decodeJsonPointerSegment);
        const containerIndex = segments.findIndex((segment) => (
          ACTOR_JSON_PATCH_CONTAINERS.has(segment)
          || ACTOR_JSON_PATCH_CONTAINERS.has(segment.toLocaleLowerCase('en-US'))
        ));
        if (containerIndex < 0 || containerIndex + 1 >= segments.length) continue;
        const candidate = text(segments[containerIndex + 1]).slice(0, 160);
        const fieldSegment = /^(?:名称|姓名|名字|name)$/iu.test(candidate);
        if (fieldSegment && typeof operation?.value === 'string' && text(operation.value)) {
          names.add(text(operation.value).slice(0, 160));
          continue;
        }
        if (/^[-+]?\d+$/u.test(candidate) || candidate === '-') {
          const valueName = operation?.value && typeof operation.value === 'object'
            ? text(operation.value.name || operation.value.姓名 || operation.value.名称)
            : (/^(?:名称|姓名|名字|name)$/iu.test(segments[containerIndex + 2] || '') ? text(operation?.value) : '');
          if (valueName) names.add(valueName.slice(0, 160));
          continue;
        }
        if (candidate) names.add(candidate);
      }
    }
    return [...names];
  }

  function structuredContentActorNames(content) {
    const names = new Set();
    for (const match of String(content || '').matchAll(/【(?:敌方|人物|角色|NPC)(?:档案|资料|状态)[·・:：]\s*([^】]+)】/giu)) {
      if (text(match[1])) names.add(text(match[1]).slice(0, 160));
    }
    for (const match of String(content || '').matchAll(/<(?:actor|npc)\b([^>]*)>/giu)) {
      const attributes = Object.fromEntries([...String(match[1] || '').matchAll(/([\w-]+)\s*=\s*["']([^"']+)["']/gu)]
        .map((attribute) => [attribute[1].toLocaleLowerCase(), text(attribute[2]).slice(0, 180)]));
      const name = attributes.name || attributes['display-name'] || attributes.label || attributes.title
        || attributes['actor-id'] || attributes.id;
      if (name) names.add(name);
    }
    return [...names];
  }

  // Direct transplant of actorNamesFromMvuData from the mature Doctor.  The
  // current adapter already receives stat_data itself, so no wrapper unwrap is
  // needed here.
  function actorNamesFromMvuData(mvuData) {
    if (!mvuData || typeof mvuData !== 'object') return [];
    const names = new Set();
    const containerPattern = /(?:当前敌人|当前人物|在场人物|其他契约者名单|契约者名单|队伍成员|小队成员|同伴|NPC|npc|actors?|characters?|contractors?|enemies?)/iu;
    const excludedContainer = /(?:固定角色|模板|schema|配置|历史|图鉴)/iu;
    const fieldName = /^(?:名称|姓名|名字|状态|等级|称号|阵营|职业|描述|数量|成员|列表|name|status|level|title|faction|role|description|count)$/iu;
    const add = (value) => {
      const name = String(value || '').replace(/\s+/gu, ' ').trim();
      if (!name || name.length < 2 || name.length > 80 || fieldName.test(name)) return;
      names.add(name);
    };
    const walk = (value, depth = 0) => {
      if (!value || typeof value !== 'object' || depth > 10) return;
      for (const [key, child] of Object.entries(value)) {
        if (/^(?:小队|队伍|party|team)$/iu.test(key) && child && typeof child === 'object') {
          const members = child.成员 || child.队员 || child.members || child.actors || child.characters;
          if (Array.isArray(members)) {
            for (const member of members) {
              if (typeof member === 'string') add(member);
              else if (member && typeof member === 'object') add(member.name || member.姓名 || member.名称);
            }
          } else if (members && typeof members === 'object') {
            for (const [memberKey, memberValue] of Object.entries(members)) {
              if (!fieldName.test(memberKey)) add(memberKey);
              if (memberValue && typeof memberValue === 'object') add(memberValue.name || memberValue.姓名 || memberValue.名称);
            }
          }
        }
        if (containerPattern.test(key) && !excludedContainer.test(key)) {
          if (Array.isArray(child)) {
            for (const item of child) {
              if (typeof item === 'string') add(item);
              else if (item && typeof item === 'object') add(item.name || item.姓名 || item.名称);
            }
          } else if (child && typeof child === 'object') {
            add(child.name || child.姓名 || child.名称);
            for (const [candidateKey, candidateValue] of Object.entries(child)) {
              if (!fieldName.test(candidateKey)) add(candidateKey);
              if (candidateValue && typeof candidateValue === 'object') {
                add(candidateValue.name || candidateValue.姓名 || candidateValue.名称);
              }
            }
          }
        }
        walk(child, depth + 1);
      }
    };
    walk(mvuData);
    return [...names].slice(0, 96);
  }

  function highConfidenceCandidateSources(target, store, players, currentMvu = null) {
    const content = target?.content || '';
    const excluded = new Set(players.map((name) => name.toLocaleLowerCase()));
    const currentReply = new Map();
    const mvuInventory = new Map();
    const add = (collection, value) => {
      const name = text(value).replace(/^[【\[（(]|[】\]）)]$/g, '');
      const key = name.toLocaleLowerCase();
      if (name.length < 2 || name.length > 40 || excluded.has(key) || LABEL_BLOCKLIST.has(key)
        || NON_PERSON_LABEL.test(name) || PLAYER_LABEL.test(name)) return;
      collection.set(key, name);
    };
    for (const profile of Object.values(store.profiles || {})) {
      for (const name of [profile?.name, ...(profile?.aliases || [])]) {
        if (usable(name) && content.includes(name)) add(currentReply, profile.name || name);
      }
    }
    for (const name of actorNamesFromMvuData(currentMvu)) add(mvuInventory, name);
    for (const name of jsonPatchActorNames(content)) add(currentReply, name);
    for (const name of structuredContentActorNames(content)) add(currentReply, name);
    for (const match of content.matchAll(/\b(?:NPC|ACTOR)[-_ ]?\d+\b/giu)) add(currentReply, match[0]);
    return {
      currentReplyCandidates: [...currentReply.values()],
      mvuInventoryCandidates: [...mvuInventory.values()].filter((name) => !currentReply.has(name.toLocaleLowerCase())),
    };
  }

  // Directly follows the mature completion selector: only actors without a
  // profile, or with an incomplete profile, consume a model call.  Invalid
  // stored profiles remain repair work even if they are not in this scene.
  function profileCompletionCandidates(candidateNames, store, maintenanceLimit = 8) {
    const current = new Map();
    const maintenance = new Map();
    const add = (collection, value) => {
      const name = text(value);
      if (name) collection.set(name.toLocaleLowerCase(), name);
    };
    for (const name of candidateNames) {
      const existing = findUniqueExistingProfile(store.profiles || {}, { name, aliases: [] });
      if (!existing || validateProfile(existing, 0).length > 0) add(current, existing?.name || name);
    }
    for (const profile of Object.values(store.profiles || {})) {
      const key = text(profile?.name).toLocaleLowerCase();
      if (validateProfile(profile, 0).length > 0 && !current.has(key)) add(maintenance, profile.name);
    }
    // Every actor found in the current accepted reply is transaction work for
    // this turn.  Only old maintenance debt is budgeted; otherwise actor #9
    // can disappear from the next reply and be lost forever.
    return [...current.values(), ...[...maintenance.values()].slice(0, maintenanceLimit)];
  }

  function profileBatchCapacity(maxTokens = settings().maxTokens) {
    // A complete profile has 32 required prose fields plus seven arrays.  Keep
    // enough output room for real sentences instead of letting a low but legal
    // model limit truncate one giant all-or-nothing response.
    return Math.max(1, Math.floor((Math.max(3000, Number(maxTokens) || 3000) - 1200) / 1500));
  }

  function relevantExistingProfiles(store, candidateNames) {
    const wanted = new Set(candidateNames.map((name) => text(name).toLocaleLowerCase()).filter(Boolean));
    return Object.fromEntries(Object.entries(store.profiles || {}).filter(([, profile]) => (
      [...profileNameSet(profile)].some((name) => wanted.has(name))
    )));
  }

  function dropUntargetedCompleteProfiles(envelope, store, candidateNames) {
    const required = new Set(candidateNames.map((name) => text(name).toLocaleLowerCase()).filter(Boolean));
    const retained = envelope.profiles.filter((profile) => {
      const existing = findUniqueExistingProfile(store.profiles || {}, profile);
      if (!existing || validateProfile(existing, 0).length > 0) return true;
      return [...profileNameSet(existing)].some((name) => required.has(name));
    });
    if (retained.length === envelope.profiles.length) return envelope;
    const retainedNames = new Set(retained.flatMap((profile) => [...profileNameSet(profile)]));
    return {
      ...envelope,
      profiles: retained,
      detectedCharacters: envelope.detectedCharacters.filter((name) => retainedNames.has(text(name).toLocaleLowerCase())),
    };
  }

  function dropProfilesOutsideCurrentReply(envelope, target, currentReplyCandidates) {
    const required = new Set(currentReplyCandidates.map((name) => text(name).toLocaleLowerCase()).filter(Boolean));
    const content = text(target?.content).toLocaleLowerCase();
    const retained = envelope.profiles.filter((profile) => {
      const names = profileNameSet(profile);
      if ([...names].some((name) => required.has(name))) return true;
      return [...names].some((name) => name.length >= 2 && content.includes(name));
    });
    if (retained.length === envelope.profiles.length) return envelope;
    const retainedNames = new Set(retained.flatMap((profile) => [...profileNameSet(profile)]));
    return {
      ...envelope,
      profiles: retained,
      detectedCharacters: envelope.detectedCharacters.filter((name) => retainedNames.has(text(name).toLocaleLowerCase())),
    };
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
  "profiles": [{
    "rowId": "必须原样复制目标行的rowId，例如P1",
    "name": "根据上下文补全的姓名；脚本会保留来源稳定称谓作为身份主键",
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

  async function authorityContext(target, knownMvu = undefined) {
    const oracle = window.StoryOracleAPI;
    let card = '';
    let world = '';
    let mvu = knownMvu === undefined ? null : knownMvu;
    try { card = oracle?.context?.buildCardSection?.(ctx()) || ''; } catch { card = ''; }
    try { world = await oracle?.context?.buildWorldInfo?.({ forceMode: 'st', extraScanText: target.content }) || ''; } catch { world = ''; }
    if (knownMvu === undefined) {
      try { mvu = await currentMvuState(target.index); } catch { mvu = null; }
    }
    return { card: text(card), world: text(world), mvu };
  }

  function generationPrompt(target, store, players, authority, candidates, suggestions, options = {}) {
    const existing = relevantExistingProfiles(store, candidates);
    const completeRegistry = Object.values(store.profiles || {})
      .filter((profile, index) => validateProfile(profile, index).length === 0)
      .map((profile) => ({ name: profile.name, aliases: profile.aliases || [] }));
    const deferredCandidates = Array.isArray(options.deferredCandidates) ? options.deferredCandidates : [];
    const targetRows = Array.isArray(options.targetRows) ? options.targetRows : profileTargetRows(candidates, store);
    const discoveryInstruction = `人物发现已经单独完成。你现在只为本批列出的${candidates.length}个人物逐一生成完整档案，不得遗漏，也不得返回任何未列入本批的人物。${deferredCandidates.length ? '延后批次人物由后续请求处理，本批绝不能提前返回。' : ''}`;
    return `你是数据库式人物档案填表器。${discoveryInstruction}

硬规则：
1. 玩家身份是 ${JSON.stringify(players)}，以及正文中的user、玩家、主人公、契约者本人；绝不能给玩家建立NPC档案。
2. 正文通常不会包含人物全部信息。缺失内容必须结合世界观、身份、行为和上下文进行合理创造性补全，写入inferences；禁止使用未知、待定、未登记、未设定、暂无、不详、正文未提及等占位词，也不得把占位词包进长句伪装成完整字段。
3. 已有档案是权威旧状态。待修复人物必须返回更新后的完整档案；没有新证据的旧字段保持。不要重复返回未列出的既有完整人物。
4. 不替玩家决定行动、感受、同意或关系。人物的goal必须是该人物自己的目标。
5. targetRows是脚本持有的权威来源行。每张profiles档案必须原样返回对应rowId；不得改写、遗漏、重复或自造rowId。sourceName是当前身份主键，姓名未知时不得用猜测的全名覆盖它；你补出的姓名会由脚本保存为可修订别名。
6. 只返回一个JSON对象，不要代码围栏、解释、分析或detectedCharacters平行名单。
7. 本请求不是人物发现步骤。只输出本批待处理人物；延后人物和任何其他人物都不得返回。

唯一输出结构：
${profileSchemaText()}

仅与待处理人物相符的已有档案：
${cropForModel(existing, 30000)}

已有完整档案姓名册（这些人物若不在待处理列表中就不要重复返回；用它来区分真正新人）：
${cropForModel(completeRegistry, 12000)}

脚本从修复后的MVU、正文JSONPatch/人物结构和稳定NPC/ACTOR编号建立的权威目标行（逐行完整填表）：
${JSON.stringify(targetRows)}

延后批次人物（本批不得返回）：
${JSON.stringify(deferredCandidates)}

脚本从标题式对白或叙述称谓得到的软提示（请结合正文自行判断，不得因为误识别标题而虚构人物）：
${JSON.stringify(suggestions)}

角色卡权威材料：
${authority.card ? cropForModel(authority.card, 24000) : '（宿主未提供）'}

当前激活世界书材料：
${authority.world ? cropForModel(authority.world, 42000) : '（宿主未提供）'}

用户的全局自定义模型适配附加提示词（只追加，不覆盖上述权威边界）：
${settings().globalPrompt || '（未设置）'}

变量医生修复后的当前MVU状态：
${cropForModel(authority.mvu, 42000)}

本轮用户输入：
${previousUser(target.index)}

最终接受正文：
${cropForModel(target.content, 52000)}`;
  }

  function discoveryPrompt(target, store, players, authority, structuredCandidates, inventoryHints, suggestions) {
    const completeRegistry = Object.values(store.profiles || {})
      .filter((profile, index) => validateProfile(profile, index).length === 0)
      .map((profile) => ({ name: profile.name, aliases: profile.aliases || [] }));
    return `你只执行人物发现，不写人物档案。完整阅读本轮最终正文，列出其中实际出现、需要持续记录的所有非玩家人物；正文信息不全不影响列名。姓名未知时使用正文中稳定且唯一的称谓。不要列玩家、user、主人公、读者，也不要从世界书虚构未在本轮出现的人物。

只返回一个JSON对象，不要代码围栏或解释：
{"detectedCharacters":["人物姓名或稳定称谓"],"noCharacterReason":"仅当正文确实没有非玩家人物时说明原因，否则留空"}

玩家身份（不得列入）：${JSON.stringify(players)}
脚本从本楼正文结构识别的人物线索（非空时仍须核对正文）：${JSON.stringify(structuredCandidates)}
修复后MVU中的姓名消歧提示（只帮助确认同名、别名和称谓；不能据此认定人物在本楼出现）：${JSON.stringify(inventoryHints)}
叙述称谓软提示（只用于帮助阅读，可能不是人物）：${JSON.stringify(suggestions)}
已有完整档案姓名册（本轮出现时仍可列名，后续脚本会跳过无需更新者）：${cropForModel(completeRegistry, 12000)}
角色卡权威材料：${authority.card ? cropForModel(authority.card, 12000) : '（宿主未提供）'}
当前激活世界书材料：${authority.world ? cropForModel(authority.world, 18000) : '（宿主未提供）'}
本轮用户输入：${previousUser(target.index)}
最终接受正文：${cropForModel(target.content, 52000)}`;
  }

  function normalizeDiscoveryResponse(raw, players) {
    const parsed = parseJsonResponse(raw);
    const source = Array.isArray(parsed) ? parsed : parsed?.detectedCharacters;
    if (!Array.isArray(source)) throw new Error('人物发现结果缺少detectedCharacters数组');
    const excluded = new Set(players.map((name) => text(name).toLocaleLowerCase()).filter(Boolean));
    const names = [];
    const seen = new Set();
    for (const value of source) {
      const name = text(value).replace(/^[【\[（(]|[】\]）)]$/g, '');
      const key = name.toLocaleLowerCase();
      if (!name || name.length > 40 || seen.has(key) || excluded.has(key) || PLAYER_LABEL.test(name)
        || LABEL_BLOCKLIST.has(key) || NON_PERSON_LABEL.test(name)) continue;
      seen.add(key);
      names.push(name);
    }
    const noCharacterReason = text(parsed?.noCharacterReason);
    if (names.length === 0 && !usable(noCharacterReason)) {
      throw new Error('人物发现结果为空但没有说明本轮为何确实无人可建档');
    }
    return { names, noCharacterReason };
  }

  function discoveryNamesVisibleInAcceptedReply(names, target, currentReplyCandidates) {
    const content = text(target?.content).toLocaleLowerCase();
    const structured = new Set(currentReplyCandidates.map((name) => text(name).toLocaleLowerCase()).filter(Boolean));
    return names.filter((name) => {
      const key = text(name).toLocaleLowerCase();
      return structured.has(key) || (key.length >= 2 && content.includes(key));
    });
  }

  function discoveryRepairPrompt(target, players, candidate, errors) {
    return `把下面的人物发现结果修成指定JSON。只列最终正文里实际出现的非玩家人物姓名或稳定称谓，不写档案，不列玩家，不增添正文未出现的人物。只返回JSON对象。
指定结构：{"detectedCharacters":["人物姓名或稳定称谓"],"noCharacterReason":"仅当正文确实没有非玩家人物时填写，否则留空"}
玩家身份（不得列入）：${JSON.stringify(players)}
错误：${JSON.stringify(errors)}
失败候选：${cropForModel(String(candidate || ''), 12000)}
最终接受正文：${cropForModel(target.content, 52000)}`;
  }

  function repairPrompt(target, store, players, authority, candidates, suggestions, candidate, errors, options = {}) {
    const deferredCandidates = Array.isArray(options.deferredCandidates) ? options.deferredCandidates : [];
    const targetRows = Array.isArray(options.targetRows) ? options.targetRows : profileTargetRows(candidates, store);
    return `你正在修复一份人物档案填表结果。保留候选中正确内容，只修复列出的格式或完整性问题。正文没有明确的信息必须合理补全并在inferences中标为可修订推断，不能删字段、使用占位词，或把占位词包进长句。每张档案必须原样返回权威目标行的rowId。只返回一个完整JSON对象，并且只返回本批待处理人物，不得返回延后批次或其他人物。

玩家身份（不得建档）：${JSON.stringify(players)}
唯一结构：${profileSchemaText()}
校验错误：${JSON.stringify(errors)}
失败候选：${cropForModel(String(candidate || ''), 30000)}
仅与待处理人物相符的已有档案：${cropForModel(relevantExistingProfiles(store, candidates), 30000)}
必须原样绑定的权威目标行：${JSON.stringify(targetRows)}
延后批次人物（本次修复绝不能返回）：${JSON.stringify(deferredCandidates)}
仅供判断的软人物提示：${JSON.stringify(suggestions)}
角色卡与世界书：${cropForModel(authority.card, 24000)}\n${cropForModel(authority.world, 42000)}
修复后的MVU状态：${cropForModel(authority.mvu, 24000)}
全局自定义模型适配附加提示词：${settings().globalPrompt || '（未设置）'}
最终接受正文：${cropForModel(target.content, 52000)}`;
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

  // Story Oracle's backend-forward transport normally throws request faults,
  // but some compatible relays return the fault as a successful `content`
  // string beginning with an error envelope (which may be localized) or an
  // explicit HTTP 4xx/5xx status.  The upstream auto-diagnoser treats every
  // response without an UpdateVariable block as `nochange`, which would turn
  // that transport fault into a false success.  Recognize only the relay's
  // explicit error envelope; ordinary prose remains an invalid diagnosis.
  function storyTransportErrorResponse(value) {
    const response = String(value || '').trim();
    const errorEnvelope = /^\[(?:(?:api|http|request)\s*)?(?:error|failed|failure|错误|失败)\](?:\s|$)/iu.test(response);
    const englishStatus = /\b(?:request|api|http)\b[^\r\n]{0,80}\b(?:failed|failure|error|status)\b[^\r\n]{0,40}\b[45]\d{2}\b/iu.test(response);
    const localizedStatus = /(?:请求|接口|api|http)[^\r\n]{0,80}(?:失败|错误|状态码|错误码|status|code)[^\r\n]{0,40}\b[45]\d{2}\b/iu.test(response);
    return errorEnvelope || englishStatus || localizedStatus;
  }

  // Fixed-message adapter around Story Oracle 1.35.4 diagnostic components.
  // It directly reuses the original context/prompt/transport/extraction/writeback
  // helpers, while the pinned target, ownership, retry and readback transaction
  // below are Doctor adaptations rather than the original runAutoDiagnose /
  // autoApplyFix functions running unchanged.
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
    const diagnosisAttempts = [];
    const enrichDiagnosisError = (error) => {
      error.request ||= deepClone(request);
      if (!error.raw) error.raw = String(raw || '');
      error.diagnosisAttempts ||= deepClone(diagnosisAttempts);
      return error;
    };
    const maxTokens = Math.max(storySettings.maxTokens, 4096);
    const call = so.beginPostReplyCall(240000);
    const toast = so.showAutoDiagGenerating();
    let raw = '';
    try {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (storySettings.mode === 'direct') {
          const body = { model: storySettings.model, messages, max_tokens: maxTokens };
          if (storySettings.sendTemperature) body.temperature = storySettings.temperature;
          raw = await so.callDirect(so.resolveEndpointUrl(storySettings), storySettings.apiKey, body, call.signal);
        } else {
          const override = storySettings.sendTemperature ? { temperature: storySettings.temperature } : {};
          raw = await so.callProfile(storySettings.profileId, messages, maxTokens, override, call.signal);
        }
        const transportError = storyTransportErrorResponse(raw);
        diagnosisAttempts.push({ attempt, kind: transportError ? 'transport-error-content' : 'response', raw: String(raw || '') });
        if (!transportError) break;
        requireTaskOwner(owner, target, `变量诊断运输回执第${attempt}次返回后`);
        const retryBaseline = await mvuPayloadAt(target.index);
        if (JSON.stringify(retryBaseline) !== baselineDigest) {
          throw Object.assign(new Error('变量诊断运输错误恢复期间固定楼层MVU基线已变化，本次旧诊断已废弃'), { code: STALE_TASK });
        }
        if (attempt === 1) setPhase('diagnosing', '故事神谕返回运输错误，正在按原请求自动重试一次');
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

    if (storyTransportErrorResponse(raw)) {
      throw enrichDiagnosisError(Object.assign(new Error('故事神谕后端转发连续返回运输错误内容；已按原请求自动重试一次，未把错误冒充变量正确'), {
        code: 'story_oracle_transport_error_response', raw: String(raw || '').slice(0, 16000),
      }));
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
      else if (JSON.stringify(newData) === JSON.stringify(oldData)) result = { status: 'nochange' };
      else {
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
      diagnosisAttempts: deepClone(diagnosisAttempts),
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
    const worldCore = window.WORLD_ENGINE_CORE;
    let restoredCheckpoint = false;
    if (isReroll) {
      // World Engine 3.0.2 already owns the a/b checkpoint contract.  A Doctor
      // reroll must put b back on a before asking the frozen engine to perform
      // the replacement forward; otherwise its automatic-reroll path evolves
      // the rejected swipe's b state and carries that branch into the result.
      const checkpoint = worldCore?.restoreCheckpoint?.();
      if (checkpoint) {
        worldCore.saveState(checkpoint);
        restoredCheckpoint = true;
      }
    }
    const before = worldCore?.loadState?.() || {};
    const mode = restoredCheckpoint || !isReroll ? 'forward' : undefined;
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
    const roundValid = restoredCheckpoint || !isReroll
      ? Number(after.round) === Number(before.round || 0) + 1
      : Number(after.round || 0) === Number(before.round || 0);
    const receipt = {
      ok: roundValid, status: roundValid ? 'advanced' : 'committed-with-invalid-round',
      committed: true, valid: roundValid, sourceKey: worldSourceKey(target),
      mode: isReroll ? (restoredCheckpoint ? 'checkpoint-forward' : 'reroll-without-checkpoint') : 'forward',
      beforeRound: Number(before.round || 0), afterRound: Number(after.round || 0),
      afterStateDigest: contentFingerprint(JSON.stringify(after)),
    };
    try { persistWorldReceipt(target, receipt); }
    catch (error) {
      throw Object.assign(new Error(`世界已经提交，但持久收据写入失败；本会话已锁定为禁止重复推进：${error?.message || error}`), {
        worldReceipt: deepClone(receipt),
      });
    }
    await recordRunReport({
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
    branchRestoreTail: Promise.resolve({ ok: true }),
    branchRestorePromise: Promise.resolve({ ok: true }),
    branchRestoreSerial: 0,
    worldContextTarget: null,
    runReports: [],
    reportPersistence: { ok: true, attemptedCount: 0, savedCount: 0, lastSavedAt: '', error: '' },
    diagnosticPersistence: { ok: true, blocked: false, integrityCompromised: false, count: 0, error: '' },
    generationTicketPersistence: { ok: true, status: '', error: '' },
    exportBusy: false,
    exportSerial: 0,
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
    return `${DIAGNOSTIC_STORAGE_PREFIX}${encodeURIComponent(currentChatId)}`;
  }

  function diagnosticIntegrityStorageKey(currentChatId = chatId()) {
    return `${DIAGNOSTIC_INTEGRITY_STORAGE_PREFIX}${encodeURIComponent(currentChatId)}`;
  }

  function reportStorageBaseKey(currentChatId = chatId()) {
    return `${REPORT_STORAGE_PREFIX}${encodeURIComponent(currentChatId)}`;
  }

  function loadDiagnosticIntegrityLatch(currentChatId = chatId()) {
    if (!currentChatId) return { compromised: false, error: '', at: '' };
    const raw = doctorPersistenceStore().getItem(diagnosticIntegrityStorageKey(currentChatId));
    if (raw === null || raw === undefined || raw === '') return { compromised: false, error: '', at: '' };
    try {
      const value = JSON.parse(raw);
      return value?.compromised === true
        ? { ...value, compromised: true, error: text(value.error || '历史诊断存在无法恢复的缺页'), at: text(value.at) }
        : { ...value, compromised: false, error: '', at: text(value?.at) };
    } catch (error) {
      return { compromised: true, error: `诊断完整性锁损坏：${error?.message || error}`, at: '' };
    }
  }

  async function persistDiagnosticIntegrityLatch(currentChatId, error) {
    if (!currentChatId) throw new Error('诊断完整性锁缺少聊天身份');
    const value = JSON.stringify({
      schema: 1,
      chatId: currentChatId,
      compromised: true,
      error: text(error || '历史诊断存在无法恢复的缺页'),
      at: new Date().toISOString(),
    });
    const receipt = await durableWorldStoreBatch(
      doctorPersistenceStore(),
      [[diagnosticIntegrityStorageKey(currentChatId), value]],
    );
    if (!receipt.durable) throw new Error(`诊断完整性锁仅写入${receipt.backend}，未取得IndexedDB事务回执`);
    return receipt;
  }

  // World Engine 3.0.2 already provides the mature IndexedDB-backed sync
  // mirror used for large durable state.  Reuse it for Doctor reports instead
  // of creating another database or continuing to share Web Storage's ~5 MB.
  function doctorPersistenceStore() {
    const store = window.WORLD_ENGINE_STORE;
    if (store && typeof store.getItem === 'function' && typeof store.setItem === 'function') return store;
    return sessionStorage;
  }

  function setStoredValueChecked(store, key, value) {
    store.setItem(key, value);
    if (store.getItem(key) !== value) throw new Error(`持久化后立即读回不一致：${key}`);
  }

  let doctorDbPromise = null;
  function openDoctorDurableDb() {
    if (doctorDbPromise) return doctorDbPromise;
    doctorDbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB不可用，无法确认大报告已经跨刷新落盘'));
        return;
      }
      let request;
      try { request = window.indexedDB.open('world_engine', 1); }
      catch (error) { reject(error); return; }
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('kv')) database.createObjectStore('kv');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('打开世界引擎IndexedDB失败'));
      request.onblocked = () => reject(new Error('世界引擎IndexedDB升级被其他页面阻塞'));
    }).catch((error) => {
      doctorDbPromise = null;
      throw error;
    });
    return doctorDbPromise;
  }

  async function durableWorldStoreBatch(store, entries) {
    const normalized = entries.map(([key, value]) => [String(key), String(value)]);
    normalized.forEach(([key, value]) => setStoredValueChecked(store, key, value));
    if (store !== window.WORLD_ENGINE_STORE) {
      return { backend: store === sessionStorage ? 'sessionStorage-fallback' : 'synchronous-store', durable: false };
    }
    const database = await openDoctorDurableDb();
    await new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = database.transaction('kv', 'readwrite');
        const objectStore = transaction.objectStore('kv');
        normalized.forEach(([key, value]) => objectStore.put(value, key));
      } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB写入事务失败'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB写入事务被中止'));
    });
    const readback = new Map();
    await new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = database.transaction('kv', 'readonly');
        const objectStore = transaction.objectStore('kv');
        normalized.forEach(([key]) => {
          const request = objectStore.get(key);
          request.onsuccess = () => readback.set(key, request.result);
          request.onerror = () => reject(request.error || new Error(`IndexedDB读回失败：${key}`));
        });
      } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB读回事务失败'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB读回事务被中止'));
    });
    for (const [key, value] of normalized) {
      if (readback.get(key) !== value) throw new Error(`IndexedDB事务完成后读回不一致：${key}`);
    }
    return { backend: 'indexedDB', durable: true };
  }

  function parseStoredJson(store, key, fallback) {
    const raw = store.getItem(key);
    if (raw === null || raw === undefined || raw === '') return deepClone(fallback);
    return JSON.parse(raw);
  }

  function validDiagnosticArray(raw) {
    if (raw === null || raw === undefined || raw === '') return { ok: true, items: [] };
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? { ok: true, items: parsed } : { ok: false, items: [], error: '诊断记录不是数组' };
    } catch (error) { return { ok: false, items: [], error: error?.message || String(error) }; }
  }

  function validStoredReport(raw) {
    if (raw === null || raw === undefined || raw === '') return { ok: false, value: null, error: '报告内容缺失' };
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ok: false, value: null, error: '报告内容不是对象' };
      }
      return { ok: true, value };
    } catch (error) { return { ok: false, value: null, error: error?.message || String(error) }; }
  }

  function mergeDiagnosticItems(left, right) {
    const keyed = new Map();
    for (const item of [...left, ...right]) {
      const key = JSON.stringify([text(item?.at), text(item?.phase), text(item?.detail)]);
      if (!keyed.has(key)) keyed.set(key, item);
    }
    return [...keyed.values()].sort((a, b) => text(b?.at).localeCompare(text(a?.at)));
  }

  function migrateLegacyDoctorStorage(currentChatId = chatId()) {
    if (!currentChatId) return { migrated: false, entries: 0 };
    const store = doctorPersistenceStore();
    if (store === sessionStorage) return { migrated: false, entries: 0 };
    const diagnosticKey = diagnosticStorageKey(currentChatId);
    const legacyDiagnostic = sessionStorage.getItem(diagnosticKey);
    const storedDiagnostic = store.getItem(diagnosticKey);
    const legacyDiagnosticState = validDiagnosticArray(legacyDiagnostic);
    const storedDiagnosticState = validDiagnosticArray(storedDiagnostic);
    let diagnosticError = '';
    if (!storedDiagnosticState.ok && legacyDiagnosticState.ok && legacyDiagnostic !== null) {
      setStoredValueChecked(store, `${diagnosticKey}:corrupt:${Date.now()}`, storedDiagnostic || '');
      setStoredValueChecked(store, diagnosticKey, legacyDiagnostic);
    } else if (storedDiagnosticState.ok && legacyDiagnosticState.ok && legacyDiagnostic !== null) {
      const merged = mergeDiagnosticItems(storedDiagnosticState.items, legacyDiagnosticState.items);
      setStoredValueChecked(store, diagnosticKey, JSON.stringify(merged));
    } else if (!storedDiagnosticState.ok) {
      diagnosticError = `目标诊断记录损坏且没有可恢复旧副本：${storedDiagnosticState.error}`;
    } else if (!legacyDiagnosticState.ok) {
      diagnosticError = `旧诊断副本损坏，已保留目标存储：${legacyDiagnosticState.error}`;
    }

    const baseKey = `${REPORT_STORAGE_PREFIX}${encodeURIComponent(currentChatId)}`;
    const indexKey = `${baseKey}:index`;
    const manifestKey = `${baseKey}:manifest`;
    let legacyIds = [];
    let storedIds = [];
    try { legacyIds = parseStoredJson(sessionStorage, indexKey, []); } catch { legacyIds = []; }
    try { storedIds = parseStoredJson(store, indexKey, []); } catch { storedIds = []; }
    if (!Array.isArray(legacyIds)) legacyIds = [];
    if (!Array.isArray(storedIds)) storedIds = [];
    const mergedIds = [...new Set([...storedIds, ...legacyIds].map(String))]
      .sort((left, right) => Number(right.split('-')[0] || 0) - Number(left.split('-')[0] || 0));
    const readable = [];
    const reportMigrationErrors = [];
    for (const id of mergedIds) {
      const entryKey = `${baseKey}:entry:${id}`;
      const legacyEntry = sessionStorage.getItem(entryKey);
      const storedEntry = store.getItem(entryKey);
      const storedState = validStoredReport(storedEntry);
      const legacyState = validStoredReport(legacyEntry);
      if (!storedState.ok && legacyState.ok) {
        if (storedEntry !== null) setStoredValueChecked(store, `${entryKey}:corrupt:${Date.now()}`, storedEntry);
        setStoredValueChecked(store, entryKey, legacyEntry);
        readable.push(String(id));
      } else if (storedState.ok) {
        readable.push(String(id));
      } else {
        reportMigrationErrors.push(`${id}:${storedState.error}${legacyEntry !== null ? `；旧副本${legacyState.error}` : ''}`);
      }
    }
    if (!mergedIds.length) return { migrated: legacyDiagnostic !== null, entries: 0, diagnosticError };
    let legacyManifest = {};
    let storedManifest = {};
    try { legacyManifest = parseStoredJson(sessionStorage, manifestKey, {}); } catch { legacyManifest = {}; }
    try { storedManifest = parseStoredJson(store, manifestKey, {}); } catch { storedManifest = {}; }
    const attemptedCount = Math.max(
      Number(legacyManifest.attemptedCount || 0),
      Number(storedManifest.attemptedCount || 0),
      mergedIds.length,
    );
    const lastSavedAt = [legacyManifest.lastSavedAt, storedManifest.lastSavedAt].map(text).sort().at(-1) || '';
    setStoredValueChecked(store, indexKey, JSON.stringify(mergedIds));
    setStoredValueChecked(store, manifestKey, JSON.stringify({
      attemptedCount,
      savedCount: readable.length,
      complete: readable.length === mergedIds.length && attemptedCount === mergedIds.length,
      lastSavedAt,
      lastError: readable.length === mergedIds.length && attemptedCount === mergedIds.length
        ? '' : text(reportMigrationErrors.join('；') || storedManifest.lastError || legacyManifest.lastError || '旧会话存储中已有报告缺页'),
    }));
    return { migrated: legacyIds.length > 0 || legacyDiagnostic !== null, entries: readable.length, diagnosticError };
  }

  async function confirmDoctorStorageDurable(currentChatId = chatId()) {
    if (!currentChatId) return { backend: 'none', durable: false };
    const store = doctorPersistenceStore();
    const baseKey = reportStorageBaseKey(currentChatId);
    const keys = typeof store.keys === 'function' ? store.keys() : [];
    const scoped = new Set([
      diagnosticStorageKey(currentChatId), diagnosticIntegrityStorageKey(currentChatId),
      `${baseKey}:index`, `${baseKey}:manifest`,
      ...keys.filter((key) => String(key || '').startsWith(`${baseKey}:entry:`)),
    ]);
    const entries = [...scoped].map((key) => [key, store.getItem(key)]).filter(([, value]) => value !== null && value !== undefined);
    if (!entries.length) return { backend: store === window.WORLD_ENGINE_STORE ? 'indexedDB' : 'sessionStorage-fallback', durable: store === window.WORLD_ENGINE_STORE };
    return durableWorldStoreBatch(store, entries);
  }

  let diagnosticPersistTail = Promise.resolve();
  function persistDiagnostics() {
    const targetChatId = chatId();
    const snapshot = deepClone(runtime.diagnostics);
    if (!targetChatId || runtime.diagnosticPersistence?.blocked) return Promise.resolve(false);
    diagnosticPersistTail = diagnosticPersistTail.then(async () => {
      try {
        if (chatId() !== targetChatId) return false;
        const receipt = await durableWorldStoreBatch(
          doctorPersistenceStore(),
          [[diagnosticStorageKey(targetChatId), JSON.stringify(snapshot)]],
        );
        if (!receipt.durable) throw new Error(`诊断仅写入${receipt.backend}，未取得IndexedDB事务回执`);
        if (chatId() === targetChatId) {
          const compromised = Boolean(runtime.diagnosticPersistence?.integrityCompromised);
          runtime.diagnosticPersistence = {
            ok: !compromised, blocked: false, integrityCompromised: compromised,
            count: snapshot.length, backend: receipt.backend,
            error: compromised ? text(runtime.diagnosticPersistence?.error || '历史诊断存在无法恢复的缺页') : '',
          };
        }
        return true;
      } catch (error) {
        if (chatId() === targetChatId) runtime.diagnosticPersistence = {
          ok: false, blocked: false,
          integrityCompromised: Boolean(runtime.diagnosticPersistence?.integrityCompromised),
          count: snapshot.length, backend: '', error: error?.message || String(error),
        };
        return false;
      }
    });
    return diagnosticPersistTail;
  }

  function loadDiagnostics(currentChatId = chatId()) {
    if (!currentChatId) return { items: [], error: '', source: 'none' };
    try {
      const raw = doctorPersistenceStore().getItem(diagnosticStorageKey(currentChatId));
      const parsed = validDiagnosticArray(raw);
      if (!parsed.ok) return { items: [], error: parsed.error, source: 'corrupt' };
      return { items: parsed.items, error: '', source: raw === null ? 'empty' : 'world-engine-store' };
    } catch (error) { return { items: [], error: error?.message || String(error), source: 'load-failed' }; }
  }

  function diagnosticsContainReadLoss(items) {
    return Array.isArray(items) && items.some((item) => text(item?.phase) === 'diagnostic-incomplete');
  }

  function pipelineStorageKey(currentChatId = chatId()) {
    return `${PIPELINE_STORAGE_PREFIX}${encodeURIComponent(currentChatId || '')}`;
  }

  function persistPipelineCheckpoint(checkpoint) {
    const currentChatId = text(checkpoint?.target?.chatId);
    if (!currentChatId) throw new Error('流水线检查点缺少聊天身份');
    const safe = redactApiConfiguration({
      ...deepClone(checkpoint), chatId: currentChatId, updatedAt: new Date().toISOString(),
    }, currentApiSecretValues());
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
      throw new Error('生成票据缺少聊天身份、序号或唯一键');
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
    const currentChatId = text(target?.chatId);
    if (!currentChatId) throw new Error('世界推进收据缺少聊天身份');
    return `${WORLD_RECEIPT_STORAGE_PREFIX}${encodeURIComponent(currentChatId)}:${encodeURIComponent(worldSourceKey(target))}`;
  }

  function worldSourceKey(target) { return text(target?.generationKey) || text(target?.identity); }

  function persistWorldReceipt(target, receipt) {
    const key = worldReceiptStorageKey(target);
    const safe = {
      ...deepClone(receipt), chatId: target.chatId, sourceKey: worldSourceKey(target),
    };
    localStorage.setItem(key, JSON.stringify(safe));
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

  let reportPersistTail = Promise.resolve();
  let reportMutationSerial = 0;

  async function drainReportPersistence() {
    while (true) {
      const observed = reportPersistTail;
      await observed;
      if (observed === reportPersistTail) return;
    }
  }

  function recordRunReport(entry) {
    if (!entry?.target) return Promise.resolve(false);
    const targetChatId = text(entry.target.chatId);
    if (!targetChatId) return Promise.resolve(false);
    reportMutationSerial += 1;
    const safeEntry = redactApiConfiguration({ ...deepClone(entry), chatId: targetChatId }, currentApiSecretValues());
    if (chatId() === targetChatId) runtime.runReports.unshift(safeEntry);
    const operation = reportPersistTail.then(
      () => recordRunReportNow(targetChatId, safeEntry),
      () => recordRunReportNow(targetChatId, safeEntry),
    );
    reportPersistTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async function recordRunReportNow(targetChatId, safeEntry) {
    let store = doctorPersistenceStore();
    const baseKey = reportStorageBaseKey(targetChatId);
    const indexKey = `${baseKey}:index`;
    const manifestKey = `${baseKey}:manifest`;
    let storedIndex = [];
    let priorManifest = {};
    try {
      await confirmDoctorStorageDurable(targetChatId);
      store = doctorPersistenceStore();
      storedIndex = parseStoredJson(store, indexKey, []);
      priorManifest = parseStoredJson(store, manifestKey, {});
      if (!Array.isArray(storedIndex)) throw new Error('运行报告索引不是数组');
      const attemptedCount = Math.max(Number(priorManifest.attemptedCount || 0), storedIndex.length) + 1;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const nextIndex = [id, ...storedIndex];
      const lastSavedAt = new Date().toISOString();
      const manifest = {
        attemptedCount, savedCount: nextIndex.length, complete: attemptedCount === nextIndex.length,
        lastSavedAt, lastError: '', backend: 'indexedDB',
      };
      const durableReceipt = await durableWorldStoreBatch(store, [
        [`${baseKey}:entry:${id}`, JSON.stringify(safeEntry)],
        [indexKey, JSON.stringify(nextIndex)],
        [manifestKey, JSON.stringify(manifest)],
      ]);
      if (!durableReceipt.durable) throw new Error(`运行报告仅写入${durableReceipt.backend}，未取得IndexedDB事务回执`);
      if (chatId() === targetChatId) runtime.reportPersistence = {
          ok: attemptedCount === nextIndex.length, attemptedCount, savedCount: nextIndex.length,
          lastSavedAt, backend: durableReceipt.backend, error: '',
        };
      return true;
    } catch (error) {
      const attemptedCount = Math.max(Number(priorManifest.attemptedCount || 0), storedIndex.length) + 1;
      try {
        await durableWorldStoreBatch(store, [[manifestKey, JSON.stringify({
          attemptedCount, savedCount: storedIndex.length, complete: false,
          lastSavedAt: priorManifest.lastSavedAt || '', lastError: error?.message || String(error),
          backend: runtime.reportPersistence?.backend || '',
        })]]);
      } catch { /* the mature store itself may be unavailable */ }
      if (chatId() === targetChatId) {
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
      return false;
    }
  }

  function loadRunReports(currentChatId = chatId()) {
    if (!currentChatId) return { reports: [], indexCount: 0, corruptIds: [], error: '' };
    try {
      migrateLegacyDoctorStorage(currentChatId);
      const store = doctorPersistenceStore();
      const baseKey = reportStorageBaseKey(currentChatId);
      const ids = parseStoredJson(store, `${baseKey}:index`, []);
      if (!Array.isArray(ids)) return { reports: [], indexCount: 0, corruptIds: ['index'], error: '运行日志索引不是数组' };
      const reports = [];
      const corruptIds = [];
      ids.forEach((id) => {
        try {
          const entry = parseStoredJson(store, `${baseKey}:entry:${id}`, null);
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
      migrateLegacyDoctorStorage(currentChatId);
      const store = doctorPersistenceStore();
      const baseKey = reportStorageBaseKey(currentChatId);
      const manifest = parseStoredJson(store, `${baseKey}:manifest`, {});
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

  function profileReceiptKey(target) {
    return text(target?.generationKey) || `${Number(target?.index)}:${Number(target?.swipeId) || 0}:${text(target?.fingerprint)}`;
  }

  function profileReceiptFor(store, target) {
    const receipt = store?.profileReceipts?.[profileReceiptKey(target)];
    if (!receipt || receipt.chatId !== target?.chatId || receipt.identity !== target?.identity
      || receipt.fingerprint !== target?.fingerprint || receipt.status !== 'committed') return null;
    if (receipt.profileDigest !== contentFingerprint(JSON.stringify(store?.profiles || {}))) return null;
    return receipt;
  }

  function storeAfterProfileRun(before, target, nextProfiles, committedProfileIds = []) {
    const nextRevision = Number(before.revision || 0) + 1;
    const receiptKey = profileReceiptKey(target);
    const nextReceipts = {
      ...(before.profileReceipts || {}),
      [receiptKey]: {
        status: 'committed', chatId: target.chatId, identity: target.identity,
        generationKey: text(target.generationKey), messageId: target.index, swipeId: target.swipeId,
        fingerprint: target.fingerprint, afterRevision: nextRevision,
        committedProfileIds: [...committedProfileIds],
        profileDigest: contentFingerprint(JSON.stringify(nextProfiles)), at: new Date().toISOString(),
      },
    };
    const retainedReceiptEntries = Object.entries(nextReceipts)
      .sort((left, right) => text(right[1]?.at).localeCompare(text(left[1]?.at)))
      .slice(0, MAX_HISTORY);
    return {
      ...before,
      schema: 2,
      revision: nextRevision,
      profiles: nextProfiles,
      branches: pruneBranches({
        ...before.branches,
        [branchBaseKey(target.index, target.fingerprint)]: before.branches?.[branchBaseKey(target.index, target.fingerprint)] || deepClone(before.profiles),
        [branchKey(target.index, target.swipeId, target.fingerprint)]: deepClone(nextProfiles),
      }),
      profileReceipts: Object.fromEntries(retainedReceiptEntries),
      history: [...before.history, {
        identity: target.identity, chatId: target.chatId, messageId: target.index, swipeId: target.swipeId,
        beforeRevision: Number(before.revision || 0), afterRevision: nextRevision,
        committedProfileIds: [...committedProfileIds],
        at: new Date().toISOString(),
      }].slice(-MAX_HISTORY),
    };
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
    const committedReceipt = reason !== 'manual-refill' ? profileReceiptFor(before, target) : null;
    if (committedReceipt) {
      const result = {
        ok: true, status: 'already-committed', identity, reason, repaired: false,
        count: 0, total: Object.keys(before.profiles).length, modelCalls: 0,
        discoveredCandidates: [], completionCandidates: [], receipt: deepClone(committedReceipt),
        noProfileReason: '人物档案事务已在同一正文身份下原子提交，恢复时直接复用收据',
        persistence: 'durable', raw: '', initialRaw: '', repairRaw: '', initialErrors: [], repairErrors: [],
        requestPrompt: '', repairRequestPrompt: '',
      };
      if (owner === null) setPhase('done', '已读回本楼人物事务收据；恢复不重复调用模型', result);
      if (runtime.abortController === controller) runtime.abortController = null;
      return result;
    }
    const players = playerNames(target);
    setPhase('profile-discovery', '正在从修复后的MVU与正文结构确认人物补档任务');
    const currentMvu = await currentMvuState(target.index);
    requireTaskOwner(owner, target, '人物结构化发现完成');
    const candidateSources = highConfidenceCandidateSources(target, before, players, currentMvu);
    const currentReplyCandidates = candidateSources.currentReplyCandidates;
    const mvuInventoryCandidates = candidateSources.mvuInventoryCandidates;
    let discoveredCandidates = [...currentReplyCandidates];
    const suggestions = suggestedCandidates(target, players);
    const incompleteCandidates = profileCompletionCandidates(currentReplyCandidates, before, 0);
    let candidates = reason === 'manual-refill'
      ? [...currentReplyCandidates]
      : incompleteCandidates;
    let raw = '';
    let initialRaw = '';
    let repairRaw = '';
    let initialErrors = [];
    let repairErrors = [];
    let repaired = false;
    let modelCalls = 0;
    let requestPrompt = '';
    let repairRequestPrompt = '';
    const rawParts = [];
    const initialRawParts = [];
    const repairRawParts = [];
    const requestPromptParts = [];
    const repairPromptParts = [];
    const syncProfileEvidence = () => {
      initialRaw = initialRawParts.join('\n\n');
      repairRaw = repairRawParts.join('\n\n');
      requestPrompt = requestPromptParts.join('\n\n');
      repairRequestPrompt = repairPromptParts.join('\n\n');
      raw = repairRaw || initialRaw;
    };
    try {
      setPhase('running', '正在用ver5.35宽容解析与单次定向修复模式生成完整人物档案');
      const authority = await authorityContext(target, currentMvu);
      requireTaskOwner(owner, target, '人物档案权威上下文完成');
      const aggregateProfiles = [];
      const batchCapacity = profileBatchCapacity();
      let noProfileReason = '';
      let batchNumber = 0;
      const profileCovers = (profile, candidateName) => profileNameSet(profile).has(text(candidateName).toLocaleLowerCase());
      const mergeGeneratedProfile = (profile) => {
        const primaryName = text(profile?.name).toLocaleLowerCase();
        const duplicateIndex = aggregateProfiles.findIndex((known) => text(known?.name).toLocaleLowerCase() === primaryName);
        if (duplicateIndex >= 0) aggregateProfiles[duplicateIndex] = deepClone(profile);
        else aggregateProfiles.push(deepClone(profile));
      };
      const storeWithGeneratedProfiles = () => {
        const profiles = deepClone(before.profiles);
        for (const profile of aggregateProfiles) {
          const existing = findUniqueExistingProfile(profiles, profile);
          profiles[text(existing?.profileId) || stableId(profile.name)] = deepClone(profile);
        }
        return { ...before, profiles };
      };

      const nameDiscoveryPrompt = discoveryPrompt(
        target, before, players, authority, currentReplyCandidates, mvuInventoryCandidates, suggestions,
      );
      requestPromptParts.push(`【人物发现】\n${nameDiscoveryPrompt}`);
      syncProfileEvidence();
      modelCalls += 1;
      let discoveryRaw = await callModel(nameDiscoveryPrompt, controller.signal);
      initialRawParts.push(`【人物发现】\n${String(discoveryRaw)}`);
      syncProfileEvidence();
      requireTaskOwner(owner, target, '人物姓名发现返回');
      let narrativeDiscovery;
      try {
        narrativeDiscovery = normalizeDiscoveryResponse(discoveryRaw, players);
      } catch (error) {
        repaired = true;
        initialErrors.push(`人物发现：${error.message || String(error)}`);
        const nameRepairPrompt = discoveryRepairPrompt(
          target, players, discoveryRaw, [error.message || String(error)],
        );
        repairPromptParts.push(`【人物发现修复】\n${nameRepairPrompt}`);
        syncProfileEvidence();
        modelCalls += 1;
        discoveryRaw = await callModel(nameRepairPrompt, controller.signal);
        repairRawParts.push(`【人物发现修复】\n${String(discoveryRaw)}`);
        syncProfileEvidence();
        requireTaskOwner(owner, target, '人物姓名发现单次修复返回');
        try {
          narrativeDiscovery = normalizeDiscoveryResponse(discoveryRaw, players);
        } catch (repairError) {
          repairErrors.push(`人物发现：${repairError.message || String(repairError)}`);
          throw new Error(`人物发现单次修复后仍不可用：${repairError.message || String(repairError)}`);
        }
      }
      rawParts.push(`【人物发现】\n${String(discoveryRaw)}`);
      noProfileReason = narrativeDiscovery.noCharacterReason;
      const narrativeNames = discoveryNamesVisibleInAcceptedReply(
        narrativeDiscovery.names, target, currentReplyCandidates,
      );
      const narrativeCandidates = profileCompletionCandidates(narrativeNames, before, 0);
      discoveredCandidates = [...new Set([...discoveredCandidates, ...narrativeNames])];
      candidates = [...new Set([...candidates, ...narrativeCandidates])];
      if (candidates.length === 0 && (narrativeNames.length > 0 || currentReplyCandidates.length > 0)) {
        noProfileReason = '本轮实际出现的人物均已有完整档案，无需新增或修复';
      }
      const pending = [...candidates];

      while (pending.length > 0) {
        const alreadyCovered = (name) => aggregateProfiles.some((profile) => profileCovers(profile, name));
        const outstanding = pending.filter((name) => !alreadyCovered(name));
        pending.splice(0, pending.length, ...outstanding);
        if (pending.length === 0) break;
        batchNumber += 1;
        const batchCandidates = pending.splice(0, batchCapacity);
        const deferredCandidates = [...pending];
        const batchStore = storeWithGeneratedProfiles();
        const targetRows = profileTargetRows(batchCandidates, batchStore);
        const reservedCandidates = candidates.filter((name) => !batchCandidates.includes(name));
        const batchSuggestions = batchNumber === 1 ? suggestions : [];
        const batchPrompt = generationPrompt(
          target, batchStore, players, authority, batchCandidates, batchSuggestions,
          { deferredCandidates, targetRows },
        );
        requestPromptParts.push(`【第${batchNumber}批】\n${batchPrompt}`);
        syncProfileEvidence();
        modelCalls += 1;
        let batchRaw = await callModel(batchPrompt, controller.signal);
        initialRawParts.push(`【第${batchNumber}批】\n${String(batchRaw)}`);
        syncProfileEvidence();
        requireTaskOwner(owner, target, `人物档案第${batchNumber}批模型返回`);
        let envelope;
        let errors;
        try {
          const binding = bindProfilesToTargetRows(
            normalizeEnvelope(parseJsonResponse(batchRaw)), targetRows, reservedCandidates,
          );
          envelope = dropUntargetedCompleteProfiles(binding.envelope, batchStore, batchCandidates);
          if (reason === 'manual-refill') {
            envelope = dropProfilesOutsideCurrentReply(envelope, target, currentReplyCandidates);
          }
          errors = [...binding.errors, ...validateEnvelope(envelope, players, batchCandidates)];
        } catch (error) {
          envelope = { profiles: [], detectedCharacters: [], noProfileReason: '' };
          errors = [error.message || String(error)];
        }
        initialErrors.push(...errors.map((message) => `第${batchNumber}批：${message}`));
        if (errors.length > 0) {
          repaired = true;
          const batchRepairPrompt = repairPrompt(
            target, batchStore, players, authority, batchCandidates, batchSuggestions, batchRaw, errors,
            { deferredCandidates, targetRows },
          );
          repairPromptParts.push(`【第${batchNumber}批】\n${batchRepairPrompt}`);
          syncProfileEvidence();
          modelCalls += 1;
          batchRaw = await callModel(batchRepairPrompt, controller.signal);
          repairRawParts.push(`【第${batchNumber}批】\n${String(batchRaw)}`);
          syncProfileEvidence();
          requireTaskOwner(owner, target, `人物档案第${batchNumber}批单次修复返回`);
          const binding = bindProfilesToTargetRows(
            normalizeEnvelope(parseJsonResponse(batchRaw)), targetRows, reservedCandidates,
          );
          envelope = dropUntargetedCompleteProfiles(binding.envelope, batchStore, batchCandidates);
          if (reason === 'manual-refill') {
            envelope = dropProfilesOutsideCurrentReply(envelope, target, currentReplyCandidates);
          }
          errors = [...binding.errors, ...validateEnvelope(envelope, players, batchCandidates)];
          repairErrors.push(...errors.map((message) => `第${batchNumber}批：${message}`));
        }
        if (errors.length > 0) throw new Error(`第${batchNumber}批单次修复后档案仍不完整：${errors.join('；')}`);
        envelope.profiles.forEach(mergeGeneratedProfile);
        if (envelope.profiles.length === 0) noProfileReason = envelope.noProfileReason;
        rawParts.push(`【第${batchNumber}批】\n${String(batchRaw)}`);
      }

      const envelope = {
        profiles: aggregateProfiles,
        detectedCharacters: aggregateProfiles.map((profile) => text(profile.name)).filter(Boolean),
        noProfileReason: aggregateProfiles.length ? '' : noProfileReason,
      };
      const aggregateErrors = validateEnvelope(envelope, players, candidates);
      if (aggregateErrors.length > 0) throw new Error(`人物档案分批汇总不完整：${aggregateErrors.join('；')}`);
      syncProfileEvidence();
      raw = rawParts.join('\n\n');

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

      const after = storeAfterProfileRun(before, target, nextProfiles, committed.map((profile) => profile.profileId));
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
        modelCalls, discoveredCandidates, currentReplyCandidates, mvuInventoryCandidates,
        completionCandidates: candidates, batchCount: batchNumber, batchCapacity,
        noProfileReason: envelope.noProfileReason || '', persistence: committedStore.persistence,
        raw: String(raw), initialRaw, repairRaw, initialErrors, repairErrors, requestPrompt, repairRequestPrompt,
      };
      const persistenceText = '已完成宿主持久化调用与完整内存读回';
      if (owner === null) setPhase('done', committed.length ? `${persistenceText}：${committed.length}张完整档案` : `${persistenceText}：本轮确实没有可建档NPC`, result);
      return result;
    } catch (error) {
      syncProfileEvidence();
      if (error?.name === 'AbortError') {
        if (owner === null) setPhase('cancelled', '人物档案任务已取消');
        return {
          ok: false, status: 'cancelled', identity, reason, modelCalls,
          raw: String(raw).slice(0, 16000), initialRaw, repairRaw, initialErrors, repairErrors,
          requestPrompt, repairRequestPrompt,
        };
      }
      if (error?.code === STALE_TASK) {
        const result = {
          ok: false, status: 'stale', identity, reason, modelCalls, error: error.message || String(error),
          raw: String(raw).slice(0, 16000), initialRaw, repairRaw, initialErrors, repairErrors,
          requestPrompt, repairRequestPrompt,
        };
        if (owner === null) setPhase('discarded', result.error, result);
        return result;
      }
      const result = {
        ok: false, identity, reason, repaired, modelCalls, error: error?.message || String(error),
        raw: String(raw).slice(0, 16000), initialRaw, repairRaw, initialErrors, repairErrors,
        requestPrompt, repairRequestPrompt,
      };
      if (owner === null) setPhase('failed', result.error, result);
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

  function cancelAll(reason = '用户取消', cancelPendingGeneration = false, persistCancellation = true) {
    runtime.pipelineEpoch += 1;
    const restoreSerial = ++runtime.branchRestoreSerial;
    const restoreChatId = chatId();
    runtime.branchRestorePromise = Promise.resolve(runtime.branchRestoreTail).catch((error) => ({
      ok: false, code: error?.code || '', error: error?.message || String(error),
    })).then((receipt) => {
      if (!receipt?.ok && receipt?.code === PROFILE_BRANCH_ROLLBACK_FAILED) return receipt;
      return { ok: true, stale: true, code: STALE_TASK, restoreSerial, chatId: restoreChatId };
    });
    runtime.abortController?.abort();
    try { cachedStoryInternals?.cancelPostReply?.(); } catch { /* optional */ }
    try { window.WORLD_ENGINE_EVOLUTION?.abort?.(); } catch { /* optional */ }
    runtime.pipelineBusy = false;
    runtime.worldContextTarget = null;
    if (cancelPendingGeneration) {
      runtime.generationSerial += 1;
      runtime.acceptedGeneration = null;
    }
    runtime.diagnostics.unshift({ at: new Date().toISOString(), phase: 'cancel-requested', detail: reason });
    if (persistCancellation) persistDiagnostics();
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
      await recordRunReport({
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
      await recordRunReport({
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
    const restoreSerial = ++runtime.branchRestoreSerial;
    const restoreChatId = chatId();
    const assertRestoreCurrent = () => {
      if (restoreSerial !== runtime.branchRestoreSerial || chatId() !== restoreChatId) {
        throw Object.assign(new Error('人物分支恢复已被更新的聊天或生成任务取代'), { code: STALE_TASK });
      }
    };
    const previousTail = runtime.branchRestoreTail;
    const task = Promise.resolve(previousTail).catch((error) => ({
      ok: false, code: error?.code || '', error: error?.message || String(error),
    })).then(async (previousReceipt) => {
      if (!previousReceipt?.ok && previousReceipt?.code === PROFILE_BRANCH_ROLLBACK_FAILED) {
        throw Object.assign(
          new Error(previousReceipt.error || '前一人物分支回滚没有持久化，拒绝继续读取不确定档案'),
          { code: PROFILE_BRANCH_ROLLBACK_FAILED, rollbackError: previousReceipt.rollbackError || '' },
        );
      }
      assertRestoreCurrent();
      await taskFactory(assertRestoreCurrent);
      assertRestoreCurrent();
      return { ok: true, restoreSerial, chatId: restoreChatId, code: '' };
    }).catch(
      (error) => ({
        ok: false,
        stale: error?.code === STALE_TASK,
        code: error?.code || '',
        error: error?.message || String(error),
        rollbackError: error?.rollbackError || '',
        restoreSerial,
        chatId: restoreChatId,
      }),
    );
    runtime.branchRestoreTail = task;
    runtime.branchRestorePromise = task;
    return task;
  }

  async function requireBranchRestore(owner) {
    const receipt = await runtime.branchRestorePromise;
    if (runtime.pipelineEpoch !== owner) throw Object.assign(new Error('人物分支恢复期间任务所有权已变化'), { code: STALE_TASK });
    if (!receipt?.ok) throw Object.assign(
      new Error(`人物档案分支恢复失败：${receipt?.error || '未知错误'}`),
      { code: receipt?.code || '' },
    );
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

  async function restoreProfileBranch(target, preferBase = false, assertRestoreCurrent = null) {
    if (!target) return false;
    const restoreCurrent = typeof assertRestoreCurrent === 'function'
      ? assertRestoreCurrent : () => requireCurrentTarget(target, '人物档案分支恢复');
    restoreCurrent();
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
      restoreCurrent,
    );
    restoreCurrent();
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
        await recordRunReport({
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
        await recordRunReport({
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
      await recordRunReport({ at: new Date().toISOString(), target: deepClone(target), result: deepClone(result), worldDebug: window.WORLD_ENGINE_EVOLUTION?.getLastDebug?.() || null });
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
      if (error?.code) result.errorCode = String(error.code);
      if (error?.identityMigrationError) result.error += `；受控正文身份迁移失败：${error.identityMigrationError}`;
      if (error?.raw) result.raw = String(error.raw);
      if (error?.request) result.request = deepClone(error.request);
      if (error?.diagnosisAttempts) result.diagnosisAttempts = deepClone(error.diagnosisAttempts);
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
      await recordRunReport({ at: new Date().toISOString(), target: deepClone(target), result: deepClone(result), worldDebug: window.WORLD_ENGINE_EVOLUTION?.getLastDebug?.() || null });
      return result;
    } finally {
      if (runtime.pipelineEpoch === owner) runtime.pipelineBusy = false;
    }
  }

  function ticketInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isInteger(numeric) ? numeric : null;
  }

  function interruptGenerationTicket(ticket, detail, phase = 'failed') {
    if (!ticket) return false;
    const active = runtime.acceptedGeneration;
    if (active?.serial === ticket.serial && active?.generationKey === ticket.generationKey) {
      runtime.acceptedGeneration = null;
      runtime.generationSerial += 1;
    }
    try { clearGenerationTicket(ticket.chatId || chatId(), ticket.generationKey); }
    catch (error) { noteGenerationTicketFailure('中断生成票据时清理', error); }
    setPhase(phase, detail);
    return true;
  }

  async function waitForAcceptedFinal(serial, messageId = null, swipeId = null) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    if (serial !== runtime.generationSerial || runtime.acceptedGeneration?.serial !== serial) return;
    const ticket = runtime.acceptedGeneration;
    const fixedMessageId = ticketInteger(messageId)
      ?? ticketInteger(ticket?.targetMessageId ?? ticket?.receivedMessageId);
    const fixedSwipeId = ticketInteger(swipeId ?? ticket?.targetSwipeId ?? ticket?.receivedSwipeId);
    const first = Number.isInteger(fixedMessageId) ? assistantAt(fixedMessageId) : latestAssistant();
    if (!first) {
      interruptGenerationTicket(ticket, '正文落盘收据指向的助手楼已经不存在；已中断本票据，拒绝跨楼处理');
      return;
    }
    if (fixedSwipeId !== null && first.swipeId !== fixedSwipeId) {
      interruptGenerationTicket(ticket, `正文落盘收据固定在 swipe ${fixedSwipeId}，但当前已经是 swipe ${first.swipeId}；已中断旧票据`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 650));
    if (serial !== runtime.generationSerial || runtime.acceptedGeneration?.serial !== serial) return;
    const fresh = Number.isInteger(fixedMessageId) ? assistantAt(fixedMessageId) : latestAssistant();
    if (!fresh) {
      interruptGenerationTicket(ticket, '两次新鲜读取之间，正文落盘收据指向的助手楼消失；已中断旧票据');
      return;
    }
    if (fixedSwipeId !== null && fresh.swipeId !== fixedSwipeId) {
      interruptGenerationTicket(ticket, `两次新鲜读取之间 swipe 从 ${fixedSwipeId} 漂移到 ${fresh.swipeId}；已中断旧票据`);
      return;
    }
    if (fresh.identity !== first.identity) {
      setPhase('waiting', '最终回复仍在变化；继续等待两次一致的新鲜读取');
      setTimeout(() => { void waitForAcceptedFinal(serial, fixedMessageId, fixedSwipeId); }, 650);
      return;
    }
    const baseline = ticket.baselineIdentity;
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
      discardBackgroundGeneration(ticket, '生成前锚点之后没有用户楼；已按后台生成忽略，不推进变量、档案或世界');
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
      setTimeout(() => { void waitForAcceptedFinal(serial, fixedMessageId, fixedSwipeId); }, 650);
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
    runtime.acceptedGeneration = {
      ...ticket,
      status: 'processing',
      completionScheduled: true,
      targetMessageId: fresh.index,
      targetSwipeId: fresh.swipeId,
      targetIdentity: fresh.identity,
    };
    // runAcceptedPipeline writes its durable running checkpoint synchronously
    // before its first await. The explicit readback above is the handoff receipt;
    // only after that receipt may the shorter generation ticket be removed.
    const pipeline = runAcceptedPipeline(fresh, 'auto', type);
    try { clearGenerationTicket(ticket.chatId || fresh.chatId, ticket.generationKey); }
    catch (error) { noteGenerationTicketFailure('流水线接管时清理', error); }
    await pipeline;
    if (runtime.acceptedGeneration?.serial === serial
      && runtime.acceptedGeneration?.status === 'processing') runtime.acceptedGeneration = null;
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
      chatId: target.chatId,
      index: target.index, swipeId: target.swipeId,
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
    if (!original || !fresh || original.chatId !== fresh.chatId
      || original.index !== fresh.index || original.swipeId !== fresh.swipeId) {
      throw new Error('医生写回后的正文不再属于原楼层或原swipe，拒绝迁移世界收据身份');
    }
    fresh.generationKey = binding.generationKey;
    runtime.lastAccepted = deepClone({
      chatId: fresh.chatId,
      index: fresh.index, swipeId: fresh.swipeId,
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
    if (pendingTicket?.generationKey
      && ['started', 'ended'].includes(pendingTicket.status) && ticketTime >= checkpointTime) {
      // A newer main generation supersedes an older failed/running/cancelled
      // checkpoint. This also covers a continuation revision which deliberately
      // keeps the root generationKey while advancing its serial/timestamp.
      // Its durable ticket owns recovery until it creates a newer checkpoint or
      // is explicitly cancelled.
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
    if (!ticket || ticket.chatId !== chatId()
      || !ticket.generationKey || !Number.isFinite(Number(ticket.serial))) return false;
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
    runtime.generationType = text(ticket.type || 'normal');
    runtime.generationTicketPersistence = { ok: true, status: ticket.status, error: '' };
    if (ticket.status === 'ended') {
      try { runtime.acceptedGeneration = persistGenerationTicket(runtime.acceptedGeneration, 'ended'); }
      catch (error) { noteGenerationTicketFailure('完成票据恢复后重签', error); }
      const targetMessageId = ticketInteger(ticket.targetMessageId ?? ticket.receivedMessageId);
      const targetSwipeId = ticketInteger(ticket.targetSwipeId ?? ticket.receivedSwipeId);
      if (targetMessageId === null || targetSwipeId === null) {
        interruptGenerationTicket(runtime.acceptedGeneration, '刷新读回的完成票据缺少固定楼层或swipe；已清理，拒绝猜测其他正文');
        return true;
      }
      setPhase('waiting', '已读回正文完成票据；继续等待两次一致的新鲜读取');
      setTimeout(() => { void waitForAcceptedFinal(runtime.generationSerial, targetMessageId, targetSwipeId); }, 0);
      return true;
    }
    if (ticket.awaitingStart === true) {
      interruptGenerationTicket(runtime.acceptedGeneration, '刷新时发现用户发送票据从未收到匹配的正文开始事件；已按中断清理，不会消费刷新后的其他正文', 'discarded');
      return true;
    }
    const hasReceipt = ticketInteger(ticket.receivedMessageId) !== null
      && ticketInteger(ticket.receivedSwipeId) !== null;
    const hasEnd = ticket.endObserved === true;
    if (hasReceipt && hasEnd) {
      try { runtime.acceptedGeneration = persistGenerationTicket(runtime.acceptedGeneration, 'started'); }
      catch (error) { noteGenerationTicketFailure('双收据恢复后重签', error); }
      setPhase('waiting', '已读回正文结束与落盘双收据；继续汇合本楼任务');
      setTimeout(() => { scheduleAcceptedGenerationIfReady(); }, 0);
      return true;
    }
    if (hasReceipt && !hasEnd) {
      const recovered = {
        ...runtime.acceptedGeneration,
        endObserved: true,
        endObservedAt: new Date().toISOString(),
        hadUserAtEnd: text(ticket.type || 'normal') === 'normal'
          ? hasUserAfterTicketBaseline(ticket) : true,
        reloadClosedGeneration: true,
      };
      try { runtime.acceptedGeneration = persistGenerationTicket(recovered, 'started'); }
      catch (error) {
        noteGenerationTicketFailure('落盘收据刷新闭合', error);
        interruptGenerationTicket(runtime.acceptedGeneration, `刷新已终止旧生成，但闭合票据无法持久化：${error?.message || error}`);
        return true;
      }
      setPhase('waiting', '已读回正文落盘收据；刷新终止边界已闭合旧生成，正在核对固定楼层与swipe');
      setTimeout(() => { scheduleAcceptedGenerationIfReady(); }, 0);
      return true;
    }
    if (!hasReceipt && hasEnd) {
      const target = reconstructEndedTargetWithoutReceipt(runtime.acceptedGeneration);
      if (!target) {
        if (ticket.hadUserAtEnd === false) {
          discardBackgroundGeneration(runtime.acceptedGeneration, '刷新读回的结束票据在结束当时没有用户楼；已按后台输出清理');
        } else interruptGenerationTicket(
          runtime.acceptedGeneration,
          '刷新只读回正文结束信号，无法严格重建同一楼层与swipe的落盘正文；已清理中断票据，拒绝跨正文猜测',
        );
        return true;
      }
      try {
        runtime.acceptedGeneration = persistGenerationTicket({
          ...runtime.acceptedGeneration,
          receivedMessageId: target.index,
          receivedSwipeId: target.swipeId,
          receivedMessageType: 'reload-reconstructed',
          reloadReconstructedReceipt: true,
        }, 'started');
      } catch (error) {
        noteGenerationTicketFailure('结束票据刷新重建', error);
        interruptGenerationTicket(runtime.acceptedGeneration, `刷新已严格重建正文，但落盘身份无法持久化：${error?.message || error}`);
        return true;
      }
      setPhase('waiting', '已从刷新后的稳定聊天严格重建正文落盘身份；正在核对固定楼层与swipe');
      setTimeout(() => { scheduleAcceptedGenerationIfReady(); }, 0);
      return true;
    }
    interruptGenerationTicket(runtime.acceptedGeneration, '刷新时只剩没有结束或落盘收据的正文开始票据；已按中断清理，不会等待不会重放的旧事件', 'discarded');
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
      endObserved: false,
      receivedMessageId: null,
      receivedMessageType: '',
      completionScheduled: false,
      status: 'started',
    };
    try { runtime.acceptedGeneration = persistGenerationTicket(runtime.acceptedGeneration, 'started'); }
    catch (error) { noteGenerationTicketFailure('正文开始', error); }
    runtime.generationType = normalizedType;
    if (isReroll && baseline) {
      scheduleBranchRestore((assertRestoreCurrent) => restoreProfileBranch(baseline, true, assertRestoreCurrent));
    }
    setPhase('waiting', '正文生成中');
    return runtime.acceptedGeneration?.serial;
  }

  function mergeContinuationTicket(ticket) {
    runtime.generationSerial += 1;
    runtime.acceptedGeneration = {
      ...ticket,
      serial: runtime.generationSerial,
      status: 'started',
      awaitingStart: false,
      continuationCount: Number(ticket.continuationCount || 0) + 1,
      endObserved: false,
      receivedMessageId: null,
      receivedMessageType: '',
      completionScheduled: false,
    };
    try { runtime.acceptedGeneration = persistGenerationTicket(runtime.acceptedGeneration, 'started'); }
    catch (error) { noteGenerationTicketFailure('正文续写合并', error); }
    setPhase('waiting', '正文正在续写；保持同一用户回合票据');
  }

  function receiptTargetForTicket(ticket, messageId) {
    if (messageId === null || messageId === undefined || messageId === '') return null;
    const targetIndex = Number(messageId);
    if (!Number.isInteger(targetIndex)) return null;
    const target = assistantAt(targetIndex);
    if (!target || target.chatId !== ticket?.chatId) return null;
    const baselineIndex = Number.isInteger(Number(ticket?.baselineIndex)) ? Number(ticket.baselineIndex) : -1;
    if (ticket?.type === 'normal' && targetIndex <= baselineIndex) return null;
    if (['swipe', 'regenerate', 'continue'].includes(text(ticket?.type))) {
      const expectedIndex = Number(ticket?.expectedIndex);
      if (!Number.isInteger(expectedIndex) || targetIndex !== expectedIndex) return null;
    }
    const receivedSwipeId = ticketInteger(ticket?.receivedSwipeId);
    if (receivedSwipeId !== null && target.swipeId !== receivedSwipeId) return null;
    return target;
  }

  function receiptTypeMatchesTicket(ticket, messageType) {
    const receivedType = text(messageType).toLocaleLowerCase();
    if (!receivedType) return true;
    if (['quiet', 'impersonate', 'first_message', 'command', 'extension'].includes(receivedType)) return false;
    const generationType = text(ticket?.type || 'normal').toLocaleLowerCase();
    if (generationType === 'normal') {
      return Number(ticket?.continuationCount || 0) > 0
        ? ['continue', 'append', 'appendfinal'].includes(receivedType)
        : receivedType === 'normal';
    }
    if (generationType === 'swipe') return receivedType === 'swipe';
    if (generationType === 'regenerate') return ['regenerate', 'normal'].includes(receivedType);
    if (generationType === 'continue') return ['continue', 'append', 'appendfinal'].includes(receivedType);
    return false;
  }

  function discardBackgroundGeneration(ticket, detail) {
    runtime.acceptedGeneration = null;
    try { clearGenerationTicket(ticket?.chatId || chatId(), ticket?.generationKey); }
    catch (error) { noteGenerationTicketFailure('忽略后台生成时清理', error); }
    runtime.phase = text(ticket?.priorPhase || (runtime.lastResult?.ok ? 'done' : 'idle'));
    runtime.detail = ticket?.priorPhase === 'idle' && !runtime.lastResult
      ? '这是没有用户行动的AI开场或后台生成；医生不会推进变量、档案或后台世界'
      : text(ticket?.priorDetail || (runtime.lastResult?.ok ? '上一轮医生任务已完成' : '等待下一条最终回复'));
    runtime.diagnostics.unshift({
      at: new Date().toISOString(), phase: 'background-ignored', detail,
    });
    persistDiagnostics();
    render();
  }

  function hasUserAfterTicketBaseline(ticket, sourceChat = ctx()?.chat || []) {
    const baselineIndex = ticketInteger(ticket?.baselineIndex) ?? -1;
    return sourceChat.slice(Math.max(0, baselineIndex + 1))
      .some((message) => message?.is_user === true && Boolean(messageText(message)));
  }

  function reconstructEndedTargetWithoutReceipt(ticket) {
    const sourceChat = ctx()?.chat || [];
    const generationType = text(ticket?.type || 'normal');
    if (ticket?.endObserved !== true || ticket?.awaitingStart === true) return null;
    if (generationType === 'normal') {
      if (ticket?.hadUserAtEnd === false || !hasUserAfterTicketBaseline(ticket, sourceChat)) return null;
      const baselineIndex = ticketInteger(ticket?.baselineIndex) ?? -1;
      let sawUser = false;
      const candidates = [];
      for (let index = Math.max(0, baselineIndex + 1); index < sourceChat.length; index += 1) {
        const message = sourceChat[index];
        if (!message || message.is_system) continue;
        if (message.is_user) {
          if (messageText(message)) sawUser = true;
          continue;
        }
        const target = assistantAt(index);
        if (target && sawUser) candidates.push(target);
      }
      if (candidates.length !== 1) return null;
      const target = candidates[0];
      const laterNarrative = sourceChat.slice(target.index + 1)
        .some((message) => message && !message.is_system && (message.is_user || Boolean(messageText(message))));
      return laterNarrative ? null : target;
    }
    if (!['swipe', 'regenerate', 'continue'].includes(generationType)) return null;
    // Regenerate does not emit MESSAGE_SWIPED and may materialize an unknown
    // final slot.  Without MESSAGE_RECEIVED there is no strict swipe identity
    // to reconstruct, so reload must fail closed instead of guessing.
    if (generationType === 'regenerate') return null;
    const expectedIndex = ticketInteger(ticket?.expectedIndex);
    const expectedSwipeId = ticketInteger(ticket?.expectedSwipeId);
    const target = expectedIndex === null ? null : assistantAt(expectedIndex);
    if (!target || expectedSwipeId === null || target.swipeId !== expectedSwipeId
      || target.identity === ticket?.baselineIdentity) return null;
    const laterNarrative = sourceChat.slice(target.index + 1)
      .some((message) => message && !message.is_system && (message.is_user || Boolean(messageText(message))));
    return laterNarrative ? null : target;
  }

  function scheduleAcceptedGenerationIfReady() {
    const ticket = runtime.acceptedGeneration;
    if (!ticket || ticket.chatId !== chatId()
      || ticket.completionScheduled === true
      || ticket.endObserved !== true || ticket.receivedMessageId === null) return false;
    const target = receiptTargetForTicket(ticket, ticket.receivedMessageId);
    if (!target) {
      interruptGenerationTicket(ticket, '正文完成信号已经汇合，但落盘楼层或swipe已漂移；已中断旧票据，拒绝处理其他正文');
      return false;
    }
    try {
      runtime.acceptedGeneration = persistGenerationTicket({
        ...ticket,
        awaitingStart: false,
        completionScheduled: true,
        targetMessageId: target.index,
        targetSwipeId: target.swipeId,
      }, 'ended');
    } catch (error) {
      noteGenerationTicketFailure('正文完成双信号汇合', error);
      setPhase('failed', `正文已经落盘，但完成票据无法持久化：${error?.message || error}`);
      return false;
    }
    void waitForAcceptedFinal(runtime.acceptedGeneration.serial, target.index, target.swipeId);
    return true;
  }

  function observeReceivedMessage(messageId, messageType = '') {
    const ticket = runtime.acceptedGeneration;
    if (!ticket || ticket.chatId !== chatId()
      || ticket.completionScheduled === true) return false;
    if (ticket.awaitingStart === true) return false;
    if (!receiptTypeMatchesTicket(ticket, messageType)) return false;
    const receivedMessageId = ticketInteger(ticket.receivedMessageId);
    if (receivedMessageId !== null && receivedMessageId !== ticketInteger(messageId)) return false;
    const target = receiptTargetForTicket(ticket, messageId);
    if (!target) {
      if (receivedMessageId !== null) {
        interruptGenerationTicket(ticket, '已固定的正文落盘收据在同一楼层读到了不同swipe；已中断旧票据');
      }
      return false;
    }
    try {
      runtime.acceptedGeneration = persistGenerationTicket({
        ...ticket,
        receivedMessageId: target.index,
        receivedMessageType: text(messageType).toLocaleLowerCase(),
        receivedSwipeId: target.swipeId,
      }, ticket.status || 'started');
    } catch (error) {
      noteGenerationTicketFailure('正文落盘收据', error);
      setPhase('failed', `正文已经落盘，但消息收据无法持久化：${error?.message || error}`);
      return false;
    }
    return scheduleAcceptedGenerationIfReady();
  }

  function observeGenerationEnded() {
    const ticket = runtime.acceptedGeneration;
    if (!ticket || ticket.chatId !== chatId()
      || ticket.completionScheduled === true) return false;
    // GENERATION_ENDED carries no generation identity.  Until the provisional
    // MESSAGE_SENT ticket sees its matching START, an END belongs to an older
    // or background request and must not be latched onto this user turn.
    if (ticket.awaitingStart === true) return false;
    const hadUserAtEnd = text(ticket.type || 'normal') === 'normal'
      ? hasUserAfterTicketBaseline(ticket) : true;
    try {
      runtime.acceptedGeneration = persistGenerationTicket({
        ...ticket,
        endObserved: true,
        endObservedAt: new Date().toISOString(),
        hadUserAtEnd,
      }, ticket.status || 'started');
    } catch (error) {
      noteGenerationTicketFailure('正文结束收据', error);
      setPhase('failed', `正文结束事件已经到达，但完成收据无法持久化：${error?.message || error}`);
      return false;
    }
    const scheduled = scheduleAcceptedGenerationIfReady();
    if (!scheduled) {
      const serial = runtime.acceptedGeneration?.serial;
      setTimeout(() => {
        const active = runtime.acceptedGeneration;
        if (!active || active.serial !== serial || active.receivedMessageId !== null || active.endObserved !== true) return;
        if (active.hadUserAtEnd === false) {
          discardBackgroundGeneration(active, '生成结束时没有用户楼和AI落盘收据；已按后台输出忽略，后来出现的用户输入不会被旧票据接管');
        }
      }, 900);
    }
    return scheduled;
  }

  let chatLoadSerial = 0;

  function bindEvents() {
    const context = ctx();
    if (!context?.eventSource?.on) throw new Error('宿主事件总线不可用');
    context.eventSource.on(eventName(context, 'MESSAGE_SENT', 'message_sent'), () => {
      runtime.lastUserMessageAt = Date.now();
      const chat = ctx()?.chat || [];
      const tail = chat.at(-1);
      const activeTicket = runtime.acceptedGeneration;
      if (tail?.is_user !== true) return;
      if (activeTicket?.chatId === chatId() && activeTicket.status === 'started') {
        if (activeTicket.endObserved === true && activeTicket.receivedMessageId === null) {
          interruptGenerationTicket(
            activeTicket,
            '上一条生成已经结束但始终没有正文落盘收据；新用户回合到来前已清理旧票据',
            'discarded',
          );
        } else return;
      }
      beginGenerationTicket('normal', 'message-sent');
    });
    context.eventSource.on(eventName(context, 'GENERATION_STARTED', 'generation_started'), (type, options, dryRun) => {
      const normalizedType = text(type || 'normal').toLocaleLowerCase();
      const hidden = dryRun === true || options?.dryRun === true || options?.quiet === true
        || options?.silent === true || options?.raw === true
        || ['quiet', 'raw', 'silent', 'impersonate'].includes(normalizedType);
      if (hidden) return;
      enforceManagedScheduling();
      const mainTypes = new Set(['normal', 'swipe', 'regenerate', 'continue']);
      if (!mainTypes.has(normalizedType)) return;
      const activeTicket = runtime.acceptedGeneration;
      if (normalizedType === 'continue' && activeTicket?.chatId === chatId()
        && ['started', 'ended', 'processing'].includes(text(activeTicket.status))) {
        if (activeTicket.status === 'processing') {
          const current = latestAssistant();
          const checkpoint = loadPipelineCheckpoint(activeTicket.chatId);
          const processingTarget = runtime.lastAccepted?.generationKey === activeTicket.generationKey
            ? runtime.lastAccepted
            : (checkpoint?.target?.generationKey === activeTicket.generationKey ? checkpoint.target : activeTicket);
          const sameTarget = current
            && Number(processingTarget.index ?? processingTarget.targetMessageId) === current.index
            && Number(processingTarget.swipeId ?? processingTarget.targetSwipeId) === current.swipeId
            && text(processingTarget.identity ?? processingTarget.targetIdentity) === current.identity;
          const rootWorldReceipt = loadWorldReceipt({
            chatId: activeTicket.chatId,
            generationKey: activeTicket.generationKey,
          });
          const rootWorldCommitted = rootWorldReceipt?.committed === true && rootWorldReceipt?.valid === true;
          if (!sameTarget || rootWorldCommitted) {
            cancelAll(sameTarget ? '正文续写发生在已提交世界之后，改用同楼修订票据' : '正文续写目标已变化，旧半截正文任务作废', true);
            beginGenerationTicket('continue', 'generation-started');
            return;
          }
          cancelAll('正文续写接管尚未完成的半截正文', false);
        }
        mergeContinuationTicket(activeTicket);
        return;
      }
      if (normalizedType === 'continue' && runtime.pipelineBusy) return;
      if (activeTicket?.chatId === chatId()
        && activeTicket.status === 'started'
        && activeTicket.awaitingStart === true && normalizedType === activeTicket.type) {
        runtime.acceptedGeneration = { ...activeTicket, awaitingStart: false };
        try { runtime.acceptedGeneration = persistGenerationTicket(runtime.acceptedGeneration, 'started'); }
        catch (error) { noteGenerationTicketFailure('用户发送后的正文开始', error); }
        return;
      }
      // A generation is only provisional until its final chat layer proves
      // that a user turn actually occurred.  While one provisional/accepted
      // ticket or its pipeline owns the chat, later extension generations may
      // finish, but they cannot replace that ticket.
      const explicitReplacement = ['swipe', 'regenerate'].includes(normalizedType);
      if (!explicitReplacement && ((activeTicket?.chatId === chatId()
        && ['started', 'ended'].includes(text(activeTicket.status))) || runtime.pipelineBusy)) {
        return;
      }
      beginGenerationTicket(normalizedType, 'generation-started');
    });
    // Story Oracle's mature lifecycle uses MESSAGE_RECEIVED(id) as the exact
    // accepted-row receipt.  SillyTavern emits GENERATION_ENDED separately and
    // in opposite orders for streaming/non-streaming replies, so the two
    // signals are latched independently and joined without returning a Promise
    // to the host event bus.
    context.eventSource.on(eventName(context, 'MESSAGE_RECEIVED', 'message_received'), (messageId, messageType) => {
      observeReceivedMessage(messageId, messageType);
    });
    context.eventSource.on(eventName(context, 'GENERATION_ENDED', 'generation_ended'), () => {
      observeGenerationEnded();
    });
    context.eventSource.on(eventName(context, 'GENERATION_STOPPED', 'generation_stopped'), () => {
      const ticket = runtime.acceptedGeneration;
      if (!ticket) return;
      cancelAll('正文生成已停止', true);
      try { clearGenerationTicket(ticket.chatId || chatId(), ticket.generationKey); }
      catch (error) { noteGenerationTicketFailure('正文停止时清理', error); }
      setPhase('cancelled', '正文生成已停止；未推进变量、人物档案或后台世界');
    });
    context.eventSource.on(eventName(context, 'MESSAGE_SWIPED', 'message_swiped'), (messageId) => {
      // Real SillyTavern applies swipe_id/mes first and emits MESSAGE_SWIPED
      // before starting an overswipe Generate('swipe').  Therefore any active
      // ticket still belongs to the previous selection and must be cancelled;
      // the following GENERATION_STARTED creates the new ticket from this slot.
      const activeTicket = runtime.acceptedGeneration;
      if (activeTicket) cancelAll('swipe已变化', true);
      try { clearGenerationTicket(chatId(), activeTicket?.generationKey || ''); }
      catch (error) { noteGenerationTicketFailure('swipe变化时清理', error); }
      const scheduledChat = chatId();
      const numericMessageId = ticketInteger(messageId);
      const scheduledTarget = numericMessageId === null ? latestAssistant() : assistantAt(numericMessageId);
      void scheduleBranchRestore(async (assertRestoreCurrent) => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        assertRestoreCurrent();
        if (chatId() !== scheduledChat) return true;
        const target = latestAssistant();
        if (!target || target.index !== scheduledTarget?.index || target.swipeId !== scheduledTarget?.swipeId) {
          throw Object.assign(new Error('swipe恢复等待期间目标再次变化，旧恢复任务已丢弃'), { code: STALE_TASK });
        }
        return restoreProfileBranch(target, false, assertRestoreCurrent);
      }).then((receipt) => {
        if (!receipt?.ok && receipt?.code !== STALE_TASK
          && receipt?.restoreSerial === runtime.branchRestoreSerial
          && chatId() === scheduledChat) {
          setPhase('failed', `人物档案分支恢复失败：${receipt.error}`);
        }
      });
    });
    context.eventSource.on(eventName(context, 'CHAT_LOADED', 'chat_loaded'), async () => {
      const incomingChatId = chatId();
      const loadSerial = ++chatLoadSerial;
      // The host has already changed chatId.  Cancel old workers without
      // persisting their diagnostics under the incoming chat's key.
      cancelAll('聊天已切换', true, false);
      const loadEpoch = runtime.pipelineEpoch;
      const loadRestoreSerial = runtime.branchRestoreSerial;
      const loadStillCurrent = () => loadSerial === chatLoadSerial && chatId() === incomingChatId
        && runtime.pipelineEpoch === loadEpoch && runtime.branchRestoreSerial === loadRestoreSerial;
      runtime.exportSerial += 1;
      runtime.exportBusy = false;
      runtime.lastResult = null;
      runtime.currentTarget = null;
      runtime.lastAccepted = null;
      runtime.failedStep = '';
      runtime.runReports = [];
      runtime.diagnostics = [];
      runtime.reportPersistence = { ok: true, attemptedCount: 0, savedCount: 0, lastSavedAt: '', error: '' };
      runtime.diagnosticPersistence = {
        ok: true, blocked: false, integrityCompromised: false, count: 0, error: '',
      };
      const branchReceipt = await runtime.branchRestorePromise;
      if (!loadStillCurrent()) return;
      if (!branchReceipt?.ok) {
        const detail = branchReceipt?.code === PROFILE_BRANCH_ROLLBACK_FAILED
          ? `原聊天 ${branchReceipt?.chatId || '未知'} 的人物分支回滚未能持久化：${branchReceipt?.error || '未知错误'}；已阻止把聊天切换报告为成功`
          : `人物分支恢复屏障失败：${branchReceipt?.error || '未知错误'}`;
        runtime.diagnostics.unshift({ at: new Date().toISOString(), phase: 'profile-branch-rollback-failed', detail });
        setPhase('failed', detail, { branchRestore: deepClone(branchReceipt) });
        return;
      }
      let migrationError = '';
      try {
        migrateLegacyDoctorStorage(incomingChatId);
        await confirmProfileStoreDurable(incomingChatId);
        await confirmDoctorStorageDurable(incomingChatId);
      } catch (error) { migrationError = error?.message || String(error); }
      if (!loadStillCurrent()) return;
      const loadedReports = loadRunReports(incomingChatId);
      const loadedDiagnostics = loadDiagnostics(incomingChatId);
      const integrityLatch = loadDiagnosticIntegrityLatch(incomingChatId);
      let integrityLatchWriteError = '';
      if (loadedDiagnostics.error || migrationError) {
        try {
          await persistDiagnosticIntegrityLatch(
            incomingChatId,
            [loadedDiagnostics.error, migrationError].filter(Boolean).join('；'),
          );
        } catch (error) { integrityLatchWriteError = error?.message || String(error); }
      }
      if (!loadStillCurrent()) return;
      runtime.runReports = loadedReports.reports;
      runtime.diagnostics = loadedDiagnostics.items;
      runtime.reportPersistence = loadReportManifest(incomingChatId, loadedReports);
      const integrityCompromised = Boolean(
        loadedDiagnostics.error || migrationError || integrityLatch.compromised
        || integrityLatchWriteError || diagnosticsContainReadLoss(loadedDiagnostics.items),
      );
      if (integrityCompromised) {
        runtime.diagnosticPersistence = {
          ok: false, blocked: loadedDiagnostics.source === 'corrupt', integrityCompromised: true,
          count: runtime.diagnostics.length,
          error: [loadedDiagnostics.error, migrationError, integrityLatch.error, integrityLatchWriteError,
            diagnosticsContainReadLoss(loadedDiagnostics.items)
              ? '历史诊断曾发生无法确认恢复的缺页' : ''].filter(Boolean).join('；'),
        };
        if (loadedDiagnostics.error || migrationError) runtime.diagnostics.unshift({
            at: new Date().toISOString(), phase: 'diagnostic-incomplete',
            detail: `本聊天诊断读回不完整：${runtime.diagnosticPersistence.error}`,
          });
      }
      if (!runtime.reportPersistence.ok) runtime.diagnostics.push({
        at: new Date().toISOString(), phase: 'report-incomplete',
        detail: `本聊天内部运行日志不完整：${runtime.reportPersistence.error || '持久化条数不一致'}`,
      });
      if (!loadStillCurrent()) return;
      await persistDiagnostics();
      if (!loadStillCurrent()) return;
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

  function reportCollectionsMatch(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    const normalize = (items) => items.map((item) => JSON.stringify(item)).sort();
    const leftRows = normalize(left);
    const rightRows = normalize(right);
    return leftRows.every((row, index) => row === rightRows[index]);
  }

  async function safeExport() {
    if (runtime.exportBusy) return;
    if (runtime.pipelineBusy) {
      setPhase('report-waiting', '医生任务仍在运行；本楼完成后请再次点击导出，避免把缺少最后阶段的文件误标为完整报告');
      return;
    }
    const exportSerial = ++runtime.exportSerial;
    const exportReportSerial = reportMutationSerial;
    runtime.exportBusy = true;
    render();
    const exportChatId = chatId();
    const exportEpoch = runtime.pipelineEpoch;
    const exportStillCurrent = () => runtime.exportSerial === exportSerial
      && chatId() === exportChatId
      && runtime.pipelineEpoch === exportEpoch
      && reportMutationSerial === exportReportSerial;
    let storyLog = null;
    let storyFixConfig = null;
    try {
      await drainReportPersistence();
      await diagnosticPersistTail;
      if (!exportStillCurrent()) return;
      try { storyLog = window.StoryOracleAPI?.unsafe?.eval?.('JSON.parse(JSON.stringify(convo))') || null; } catch { storyLog = null; }
      try { storyFixConfig = storyInternals().getFixCfg?.() || null; } catch { storyFixConfig = null; }
      const reportTarget = runtime.lastAccepted?.chatId === exportChatId
        ? runtime.lastAccepted?.index : latestAssistant()?.index;
      const secretValues = currentApiSecretValues();
      let mvu = null;
      let mvuError = '';
      try {
        mvu = Number.isInteger(Number(reportTarget)) ? await currentMvuState(Number(reportTarget)) : null;
      } catch (error) { mvuError = error?.message || String(error); }
      if (!exportStillCurrent()) return;
      const freshReports = loadRunReports(exportChatId);
      const freshDiagnostics = loadDiagnostics(exportChatId);
      const freshManifest = loadReportManifest(exportChatId, freshReports);
      const reportsMatchRuntime = reportCollectionsMatch(freshReports.reports, runtime.runReports);
      const complete = freshManifest.ok && reportsMatchRuntime && !freshDiagnostics.error && !mvuError
        && runtime.diagnosticPersistence.ok !== false
        && runtime.diagnosticPersistence.integrityCompromised !== true;
      const report = redactApiConfiguration({
      exportedAt: new Date().toISOString(),
      version: ENGINE_VERSION,
      chatId: exportChatId,
      exportIntegrity: {
        complete,
        label: complete ? 'complete-report' : 'incomplete-evidence-package',
        reportPersistence: freshManifest,
        reportsMatchRuntime,
        diagnosticPersistence: { ...runtime.diagnosticPersistence, loadError: freshDiagnostics.error },
        mvuError,
      },
      chat: deepClone(ctx()?.chat || []),
      runtime: {
        phase: runtime.phase, detail: runtime.detail,
        currentTarget: runtime.currentTarget, lastResult: runtime.lastResult,
        diagnostics: freshDiagnostics.items, runs: freshReports.reports,
        reportPersistence: freshManifest,
        diagnosticPersistence: runtime.diagnosticPersistence,
      },
      doctorSettings: settings(),
      profiles: readStore(),
      world: (() => { try { return window.WORLD_ENGINE_CORE?.loadState?.() || null; } catch { return null; } })(),
      worldDebug: (() => { try { return window.WORLD_ENGINE_EVOLUTION?.getLastDebug?.() || null; } catch { return null; } })(),
      mvu,
      storyOracle: {
        loaded: Boolean(window.StoryOracleAPI),
        nativeAutoDisabled: ctx()?.extensionSettings?.storyOracle?.autoDiagnoseEnabled === false
          && storyFixConfig?.autoFixEnabled === false,
        settings: deepClone(ctx()?.extensionSettings?.storyOracle || {}),
        log: storyLog,
      },
      worldEngineSettings: deepClone(worldApiConfig().config || {}),
      pipelineCheckpoint: loadPipelineCheckpoint(exportChatId),
      api: { configured: worldApiConfig().configured, excluded: true },
      }, secretValues);
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!exportStillCurrent()) return;
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = `mvu-doctor-${complete ? 'full-report' : 'incomplete-evidence'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      if (!exportStillCurrent()) return;
      setPhase(complete ? 'done' : 'report-incomplete', complete
        ? '当前聊天完整报告已导出'
        : '已导出不完整取证包；文件内明确列出报告或诊断持久化缺口');
    } catch (error) {
      if (exportStillCurrent()) setPhase('failed', `报告导出失败：${error?.message || error}`);
    } finally {
      if (runtime.exportSerial === exportSerial) {
        runtime.exportBusy = false;
        render();
      }
    }
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
    settingsDraft = null;
    settingsDraftDirty = false;
  }

  let settingsDraft = null;
  let settingsDraftDirty = false;

  function captureSettingsDraft(panel) {
    if (!panel?.querySelector('[name=api-endpoint]')) return;
    settingsDraft = {
      endpoint: panel.querySelector('[name=api-endpoint]')?.value || '',
      model: panel.querySelector('[name=api-model]')?.value || '',
      apiKey: panel.querySelector('[name=api-key]')?.value || '',
      proxy: panel.querySelector('[name=api-proxy]')?.checked === true,
      diagnoseEnabled: panel.querySelector('[name=stage-diagnosis]')?.checked !== false,
      profileEnabled: panel.querySelector('[name=stage-profile]')?.checked !== false,
      worldEnabled: panel.querySelector('[name=stage-world]')?.checked !== false,
      globalPrompt: panel.querySelector('[name=global-prompt]')?.value || '',
    };
    settingsDraftDirty = true;
  }

  function settingsFormState(apiState) {
    return settingsDraft || {
      endpoint: apiState.config.apiUrl || '', model: apiState.config.model || '',
      apiKey: apiState.config.apiKey || '', proxy: apiState.config.connectionMode === 'proxy',
      diagnoseEnabled: settings().diagnoseEnabled, profileEnabled: settings().profileEnabled,
      worldEnabled: settings().worldEnabled, globalPrompt: settings().globalPrompt,
    };
  }

  function compactResult(value) {
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => [
      'ok', 'status', 'identity', 'reason', 'generationType', 'failedStep', 'error', 'errorCode',
      'count', 'total', 'modelCalls', 'stageReceipt', 'manualStage', 'noProfileReason',
    ].includes(key)).map(([key, item]) => [key, deepClone(item)]));
  }

  function panelHtml(activeTab = 'overview') {
    const store = readStore();
    const world = (() => { try { return window.WORLD_ENGINE_CORE?.loadState?.() || {}; } catch { return {}; } })();
    const apiState = worldApiConfig();
    const form = settingsFormState(apiState);
    const profiles = Object.values(store.profiles);
    const completeProfiles = profiles.filter((profile, index) => validateProfile(profile, index).length === 0);
    const invalidProfiles = profiles.filter((profile, index) => validateProfile(profile, index).length > 0);
    const persistenceFailure = runtime.reportPersistence?.ok === false || runtime.diagnosticPersistence?.ok === false;
    const displayPhase = persistenceFailure ? 'report-incomplete' : runtime.phase;
    const displayDetail = persistenceFailure
      ? `报告或诊断没有取得完整落盘回执：${runtime.reportPersistence?.error || runtime.diagnosticPersistence?.error || '持久化状态不完整'}`
      : runtime.detail;
    const diagnosticView = {
      phase: runtime.phase, detail: runtime.detail, failedStep: runtime.failedStep,
      currentTarget: runtime.currentTarget, lastAccepted: runtime.lastAccepted,
      reportPersistence: runtime.reportPersistence, diagnosticPersistence: runtime.diagnosticPersistence,
      generationTicketPersistence: runtime.generationTicketPersistence,
      lastResult: compactResult(runtime.lastResult),
      diagnostics: runtime.diagnostics.slice(0, 40),
      runReports: runtime.runReports.slice(0, 6).map((entry) => ({
        at: entry?.at, target: entry?.target ? {
          chatId: entry.target.chatId, index: entry.target.index, swipeId: entry.target.swipeId,
          identity: entry.target.identity,
        } : null,
        result: compactResult(entry?.result),
      })),
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
          <details class="mvu-ref-profile-full" data-profile-id="${escapeAttr(profile.profileId || '')}" data-profile-name="${escapeAttr(profile.name || '')}"><summary>查看完整档案全部字段</summary><pre data-profile-json>展开后读取完整档案……</pre></details>
        </div>
      </details>`).join('') : (activeTab === 'profiles' ? '<p class="mvu-ref-empty">当前聊天还没有人物档案。</p>' : '');
    return `
      <header><div><small>KEMINI REFERENCE · ${ENGINE_VERSION}</small><h2>人物与世界医生</h2></div><button data-action="close" aria-label="关闭">×</button></header>
      <nav><button data-tab="overview" class="active">总览</button><button data-tab="profiles">人物 ${profiles.length}</button><button data-tab="world">世界</button><button data-tab="settings">连接</button><button data-tab="diagnostics">诊断</button></nav>
      <section data-page="overview" class="active">
        <div class="mvu-ref-status ${escapeHtml(displayPhase)}"><strong>${escapeHtml(displayPhase)}</strong><span>${escapeHtml(displayDetail)}</span></div>
        <div class="mvu-ref-metrics"><div><b>${completeProfiles.length}</b><span>完整档案</span></div><div><b>${invalidProfiles.length}</b><span>异常档案</span></div><div><b>${Number(world.round || 0)}</b><span>世界轮次</span></div><div><b>${apiState.configured ? '已配置' : '未配置'}</b><span>共用API</span></div></div>
        <div class="mvu-ref-actions"><button data-action="retry-failed">重试失败步骤</button><button data-action="retry-diagnosis">手动复检MVU</button><button data-action="retry-profile">重填本楼人物</button><button data-action="retry-world">重试世界推进</button><button data-action="cancel">取消当前医生任务</button><button data-action="export" ${runtime.exportBusy ? 'disabled' : ''}>${runtime.exportBusy ? '正在生成报告…' : (persistenceFailure ? '导出不完整取证包（排除API）' : '导出本页会话完整报告（排除API）')}</button></div>
        <p class="mvu-ref-note">唯一顺序：最终正文确认 → 复用Story Oracle原版诊断组件的固定楼层适配链 → 采用ver5.35宽容解析与单次定向修复模式的人物填表 → Disnight World Engine 3.0.2。旧Doctor核心未运行。</p>
      </section>
      <section data-page="profiles">${profileCards}</section>
      <section data-page="world">${activeTab === 'world' ? `<pre>${escapeHtml(JSON.stringify(world, null, 2))}</pre>` : ''}</section>
      <section data-page="settings">
        ${settingsDraftDirty ? '<p class="mvu-ref-note mvu-ref-draft-note">尚未保存的修改会在切换标签或关闭面板后保留。</p>' : ''}
        <label>API地址<input name="api-endpoint" value="${escapeAttr(form.endpoint)}" placeholder="https://host/v1/chat/completions"></label>
        <label>模型<input name="api-model" value="${escapeAttr(form.model)}" placeholder="model-name"></label>
        <label>API密钥<input name="api-key" type="password" value="${escapeAttr(form.apiKey)}" autocomplete="off"></label>
        <label class="mvu-ref-check"><input name="api-proxy" type="checkbox" ${form.proxy ? 'checked' : ''}>经酒馆后端转发（推荐，避免CORS）</label>
        <label>全局自定义模型适配附加提示词<textarea name="global-prompt" rows="5" placeholder="同时追加给变量、人物和世界模型；留空即不追加">${escapeHtml(form.globalPrompt)}</textarea></label>
        <fieldset><legend>医生阶段</legend>
          <label class="mvu-ref-check"><input name="stage-diagnosis" type="checkbox" ${form.diagnoseEnabled ? 'checked' : ''}>Story Oracle变量复检</label>
          <label class="mvu-ref-check"><input name="stage-profile" type="checkbox" ${form.profileEnabled ? 'checked' : ''}>完整人物档案填表</label>
          <label class="mvu-ref-check"><input name="stage-world" type="checkbox" ${form.worldEnabled ? 'checked' : ''}>后台世界推进</label>
        </fieldset>
        <button data-action="save-api">保存连接与阶段设置</button>
      </section>
      <section data-page="diagnostics">${activeTab === 'diagnostics' ? `<p class="mvu-ref-note">界面只显示最近40条状态和6次运行的摘要；完整提示词与模型返回只保留在持久报告中，不在手机面板反复重绘。</p><pre>${escapeHtml(JSON.stringify({ runtime: diagnosticView, store: { revision: store.revision, history: store.history }, boot: window.MVUDoctorReferenceBaseline }, null, 2))}</pre>` : ''}</section>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

  function syncVisualViewportHeight() {
    const viewport = window.visualViewport;
    const viewportHeight = Number(viewport?.height);
    const height = viewportHeight > 0 ? viewportHeight : Math.max(1, Number(window.innerHeight || 1));
    const offsetTop = Math.max(0, Number(viewport?.offsetTop || 0));
    document.documentElement.style.setProperty('--mvu-ref-visual-height', `${height}px`);
    document.documentElement.style.setProperty('--mvu-ref-visual-top', `${offsetTop}px`);
  }

  function ensureUi() {
    syncVisualViewportHeight();
    if (!window.__mvuDoctorVisualViewportBound) {
      window.__mvuDoctorVisualViewportBound = true;
      window.addEventListener?.('resize', syncVisualViewportHeight);
      window.visualViewport?.addEventListener?.('resize', syncVisualViewportHeight);
      window.visualViewport?.addEventListener?.('scroll', syncVisualViewportHeight);
    }
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
      panel.addEventListener('input', (event) => {
        if (event.target.closest('[data-page="settings"]')) captureSettingsDraft(panel);
      });
      panel.addEventListener('change', (event) => {
        if (event.target.closest('[data-page="settings"]')) captureSettingsDraft(panel);
      });
      panel.addEventListener('focusin', (event) => {
        if (window.innerWidth <= 680 && /^(INPUT|TEXTAREA|SELECT)$/u.test(event.target?.tagName || '')) {
          setTimeout(() => event.target.scrollIntoView?.({ block: 'center', inline: 'nearest' }), 0);
        }
      });
      panel.addEventListener('toggle', (event) => {
        const detail = event.target.closest?.('[data-profile-id]');
        if (!detail?.open) return;
        const output = detail.querySelector('[data-profile-json]');
        if (!output || output.dataset.loaded === 'true') return;
        const profiles = readStore().profiles || {};
        const profile = profiles[detail.dataset.profileId]
          || Object.values(profiles).find((item) => text(item?.name) === text(detail.dataset.profileName));
        output.textContent = profile ? JSON.stringify(profile, null, 2) : '档案已在展开前变化，请刷新人物页。';
        output.dataset.loaded = 'true';
      }, true);
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
          try {
            const value = await runExclusiveStage('人物补档', target, (owner) => runTarget(target, 'manual-refill', owner));
            setPhase('done', `人物手动补档完成：${value.count ?? 0}张完整档案`, value);
          }
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
    const { abortController, branchRestorePromise, branchRestoreTail, ...serializable } = runtime;
    return deepClone(serializable);
  }

  async function init() {
    ensureUi();
    enforceManagedScheduling();
    bindEvents();
    const startupChatId = chatId();
    const startupLoadSerial = ++chatLoadSerial;
    const startupEpoch = runtime.pipelineEpoch;
    const startupLoadStillCurrent = () => startupLoadSerial === chatLoadSerial && chatId() === startupChatId
      && runtime.pipelineEpoch === startupEpoch;
    let startupStorageError = '';
    try {
      migrateLegacyDoctorStorage(startupChatId);
      await confirmProfileStoreDurable(startupChatId);
      await confirmDoctorStorageDurable(startupChatId);
    } catch (error) { startupStorageError = error?.message || String(error); }
    if (startupLoadStillCurrent()) {
      const loadedReports = loadRunReports(startupChatId);
      const loadedDiagnostics = loadDiagnostics(startupChatId);
      const integrityLatch = loadDiagnosticIntegrityLatch(startupChatId);
      let integrityLatchWriteError = '';
      if (loadedDiagnostics.error || startupStorageError) {
        try {
          await persistDiagnosticIntegrityLatch(
            startupChatId,
            [loadedDiagnostics.error, startupStorageError].filter(Boolean).join('；'),
          );
        } catch (error) { integrityLatchWriteError = error?.message || String(error); }
      }
      if (startupLoadStillCurrent()) {
        runtime.runReports = loadedReports.reports;
      runtime.reportPersistence = loadReportManifest(startupChatId, loadedReports);
      runtime.diagnostics = loadedDiagnostics.items;
      const integrityCompromised = Boolean(
        loadedDiagnostics.error || startupStorageError || integrityLatch.compromised
        || integrityLatchWriteError || diagnosticsContainReadLoss(loadedDiagnostics.items),
      );
      if (integrityCompromised) {
        runtime.diagnosticPersistence = {
          ok: false, blocked: loadedDiagnostics.source === 'corrupt', integrityCompromised: true,
          count: runtime.diagnostics.length,
          error: [loadedDiagnostics.error, startupStorageError, integrityLatch.error, integrityLatchWriteError,
            diagnosticsContainReadLoss(loadedDiagnostics.items)
              ? '历史诊断曾发生无法确认恢复的缺页' : ''].filter(Boolean).join('；'),
        };
        if (loadedDiagnostics.error || startupStorageError) runtime.diagnostics.unshift({
          at: new Date().toISOString(), phase: 'diagnostic-incomplete',
          detail: `启动时诊断读回不完整：${runtime.diagnosticPersistence.error}`,
        });
      }
      if (!runtime.reportPersistence.ok) runtime.diagnostics.unshift({
        at: new Date().toISOString(), phase: 'report-incomplete',
        detail: `本聊天内部运行日志不完整：${runtime.reportPersistence.error || '持久化条数不一致'}`,
      });
      await persistDiagnostics();
        if (startupLoadStillCurrent() && !restorePipelineAfterLoad() && !restoreGenerationTicketAfterLoad()) {
          setPhase('idle', '成熟组件适配链已加载，等待下一条最终回复');
        }
      }
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
      runProfile: () => { const target = latestAssistant(); return runExclusiveStage('人物补档', target, (owner) => runTarget(target, 'manual-refill', owner)); },
      runWorld: (redo = false) => { const target = ensureManualGenerationBinding(latestAssistant()); return runExclusiveStage('世界推进', target, (owner) => runWorldEvolution(target, Boolean(redo), owner)); },
      cancel: () => cancelCurrentTaskFromUi(),
      getStore: () => readStore(),
      getRuntime: () => runtimeSnapshot(),
      parseJsonResponse,
      installWorldContextBridge,
    };
  }

  void init().catch((error) => {
    console.error('[MVU Doctor] 人物档案填表引擎初始化失败', error);
    window.MVUDoctorProfileEngine = { ready: false, error: error.message || String(error) };
  });
})();
