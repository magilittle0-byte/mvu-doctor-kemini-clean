import { clone, canonical, digest, fault } from '../modular/variables/core.mjs';
import { discoveryPrompt, parseDiscovery, profilePrompt, parseJsonResponse, validateProfile } from './content.mjs';

export const PROFILE_VERSION = '0.1.0-candidate.3';
const SETTINGS_KEY = 'mvuDoctorProfilesV1';
const PROMPT_KEY = 'mvu_doctor_profiles_v1';
const INVALIDATED = new Set(['cancelled', 'stale_target', 'stale_mvu', 'variables_not_ready', 'variable_evidence_changed']);

function previousDiscoveryForRetry(exact, input, receipt) {
  if (!exact || exact.tombstone || exact.variableIdentity !== receipt.identity || exact.mvuHash !== receipt.afterHash) return null;
  const requests = Array.isArray(exact.review?.requests) ? exact.review.requests : [];
  for (let index = requests.length - 1; index >= 0; index--) {
    const request = requests[index];
    if (!['discovery', 'discovery-repair'].includes(request?.kind) || typeof request.raw !== 'string') continue;
    try { return { previousValidResult: parseDiscovery(request.raw, input) }; }
    catch { /* Revalidate old candidates against the current narrative and identities. */ }
  }
  return null;
}

export function createProfileRuntime({ host, store, notify = () => {} }) {
  let epoch = 0, controller = null, current = null, runPromise = null, refreshToken = 0;
  let state = { status: 'idle', detail: '等待本轮变量检查完成', busy: false, profiles: [], tasks: [], readback: false };
  let recall = null, acceptedRecall = null, recallGeneration = null;
  const listeners = [];
  function settings() {
    const value = host.context().extensionSettings?.[SETTINGS_KEY] || {};
    return { enabled: value.enabled !== false, recallEnabled: value.recallEnabled !== false };
  }
  const snapshot = () => ({ ...clone(state), ...settings() });
  const publish = values => { state = { ...state, ...values }; notify(snapshot()); };
  function clearRecall() {
    host.context().setExtensionPrompt?.(PROMPT_KEY, '', 1, 0, false);
    recall = null;
  }
  function cancel(detail = '人物档案检查已取消，已有完整档案保留') {
    epoch++; refreshToken++; controller?.abort(); controller = null;
    publish({ status: 'cancelled', detail, busy: false });
  }
  async function refresh() {
    const token = ++refreshToken;
    const branches = await host.branches();
    const saved = await store.latest(branches);
    if (token !== refreshToken) return;
    current = saved;
    publish({ profiles: clone(saved?.profiles || []), tasks: clone(saved?.tasks || []),
      readback: !!saved, restored: !!saved, durationMs: saved?.durationMs || 0,
      status: saved ? (saved.status === 'complete' ? 'restored' : saved.status === 'partial' ? 'partial' : 'waiting') : 'idle',
      detail: saved ? (saved.status === 'complete' ? '已读回当前聊天分支的完整人物档案' : '本轮档案尚未全部完成，可点击修复继续') : '本聊天尚无人物档案' });
  }
  async function prepareRecall(generation) {
    clearRecall();
    if (!settings().recallEnabled) return;
    const isCurrent = () => recallGeneration === generation && !generation.ended
      && generation.scope === canonical(host.scope()) && settings().recallEnabled;
    const branches = (await host.branches()).filter(branch => !['swipe', 'regenerate'].includes(generation.type)
      || branch.index < generation.baselineIndex);
    const saved = await store.latest(branches);
    if (!saved || !isCurrent()) return;
    const ctx = host.context(), recent = ctx.chat.slice(-5).map(row => host.messageText(row)).join('\n');
    const latestIndex = host.latestIndex();
    const profiles = saved.profiles.filter(profile => validateProfile(profile, []).length === 0
      && ([profile.name, ...(profile.aliases || [])].some(name => name && recent.includes(name))
        || (profile.presence === 'present' && profile.lastSeenIndex >= latestIndex - 4)));
    if (!profiles.length) return;
    const block = `【医生人物资料】\n以下是已保存的相关NPC档案，仅供塑造各自的性格、说话和行动。完整背景、私人动机和可修订补全并不代表玩家或其他NPC知道它们；每个人只依据自己的knowledge、uncertainties及实际见闻行动。正文只写可观察行为、证据和后果，不能直接倾倒秘密或他人内心；未发生的目标、推断、选项不能当作既成事件，不能替玩家选择、同意或感受。\n${JSON.stringify(profiles)}\n【医生人物资料结束】`;
    if (typeof ctx.setExtensionPrompt !== 'function') throw fault('profile_recall_unavailable', '宿主未提供人物资料召回接口');
    const promptHash = await digest(block);
    if (!isCurrent()) return;
    ctx.setExtensionPrompt(PROMPT_KEY, block, 1, 0, false);
    recall = { text: block, profileIds: profiles.map(profile => profile.profileId), promptHash,
      prepared: true, promptObserved: false, semanticConsumptionProven: false, sourceLineage: saved.lineage };
  }
  function inspectPrompt(payload) {
    if (!recall?.text) return;
    const seen = new Set();
    const contains = (value, depth = 0) => {
      if (typeof value === 'string') return value.includes(recall.text);
      if (!value || typeof value !== 'object' || depth > 6 || seen.has(value)) return false;
      seen.add(value); return Object.values(value).some(child => contains(child, depth + 1));
    };
    if (contains(payload)) recall.promptObserved = true;
  }
  function settleRecall(receipt) {
    const generation = recallGeneration, target = receipt.target;
    if (!generation || generation.ended || generation.scope !== canonical(host.scope())) return;
    if (generation.type === 'normal'
      ? target.index <= generation.baselineIndex || target.userIndex <= generation.baselineIndex
      : target.index !== generation.baselineIndex) return;
    // P1 already accepted the final body and validated this receipt. Global END
    // events also belong to auxiliary requests and cannot settle profile recall.
    generation.ended = true;
    acceptedRecall = recall ? { ...clone(recall), text: undefined,
      targetIdentity: receipt.identity, scopeKey: target.scopeKey } : null;
    clearRecall();
  }
  async function execute(receipt, manual, token) {
    const ctl = new AbortController(); controller = ctl;
    const startedAt = Date.now(); let draft = null, branch = null, revision = 0;
    const assert = async () => {
      if (token !== epoch || ctl.signal.aborted) throw fault('cancelled', '旧人物任务已取消');
      await host.assertReceipt(receipt, ctl.signal);
      if (token !== epoch) throw fault('cancelled', '旧人物任务已取消');
    };
    const show = () => {
      if (token !== epoch || !draft) return;
      current = clone(draft);
      publish({ status: draft.status, profiles: clone(draft.profiles), tasks: clone(draft.tasks),
        readback: true, restored: false, durationMs: Date.now() - startedAt });
    };
    const persist = async () => {
      draft.durationMs = Date.now() - startedAt;
      draft = await store.commit(branch, draft, revision, assert);
      revision = draft.revision; show();
    };
    const call = async (kind, prompt, row = null) => {
      const request = { kind, row: clone(row), promptHash: await digest(prompt), prompt, raw: '', startedAt: Date.now() };
      draft.review.requests.push(request);
      try { request.raw = await host.callModel(receipt, prompt, ctl.signal); return request.raw; }
      finally { request.durationMs = Date.now() - request.startedAt; }
    };
    try {
      publish({ status: 'waiting', detail: '正在读取本轮已确认变量和已有档案', busy: true, restored: false });
      await assert();
      settleRecall(receipt);
      const branches = await host.branches();
      branch = branches.find(value => value.index === receipt.target.index);
      if (!branch || branch.scopeKey !== receipt.target.scopeKey) throw fault('stale_target', '人物任务缺少当前聊天分支');
      const exact = await store.read(branch), previous = exact && !exact.tombstone ? exact : await store.latest(branches.filter(value => value.index < branch.index));
      revision = exact?.revision || 0;
      if (!manual && exact?.status === 'complete' && exact.version === PROFILE_VERSION
        && exact.variableIdentity === receipt.identity && exact.mvuHash === receipt.afterHash) {
        await assert(); current = exact;
        publish({ status: 'restored', detail: '本轮完整档案已保存，已读回现有结果', profiles: clone(exact.profiles), tasks: clone(exact.tasks), readback: true });
        return;
      }
      const profiles = clone(previous?.profiles || []);
      const input = await host.inputFor(receipt, profiles, host.settings().globalPrompt, ctl.signal);
      draft = { version: PROFILE_VERSION, variableIdentity: receipt.identity, mvuHash: receipt.afterHash,
        profiles, tasks: [], status: 'discovering', reason: manual ? 'manual' : 'auto',
        review: { input, requests: [], previousRecall: acceptedRecall?.targetIdentity === receipt.identity
          && acceptedRecall.scopeKey === receipt.target.scopeKey ? clone(acceptedRecall) : null }, durationMs: 0 };
      await persist();
      publish({ detail: '正在从正文识别人，并核对已有身份' });
      const prompt = discoveryPrompt(input, manual ? previousDiscoveryForRetry(exact, input, receipt) : null);
      let discoveryRaw = await call('discovery', prompt), discovered;
      try { discovered = parseDiscovery(discoveryRaw, input); }
      catch (error) {
        discoveryRaw = await call('discovery-repair', `${prompt}\n\n仅修复这份发现结果的格式或绑定错误，保留正确人物，不为消除错误删掉真实人物。\n错误：${String(error.message)}\n原结果：${discoveryRaw}`);
        discovered = parseDiscovery(discoveryRaw, input);
      }
      draft.noCharacterReason = discovered.noCharacterReason;
      draft.tasks = discovered.people.map((person, index) => ({ ...person, rowId: `P${index + 1}`,
        profileId: person.existingProfileId || crypto.randomUUID(), status: 'pending', code: null }));
      draft.status = 'generating'; await persist();
      for (let taskIndex = 0; taskIndex < draft.tasks.length; taskIndex++) {
        const task = draft.tasks[taskIndex];
        await assert(); task.status = 'generating';
        publish({ status: 'generating', detail: `正在填写第${taskIndex + 1}/${draft.tasks.length}位人物的完整档案` });
        const row = { rowId: task.rowId, profileId: task.profileId, sourceName: task.sourceName, evidence: task.evidence, presence: task.presence };
        const previousProfile = draft.profiles.find(profile => profile.profileId === task.profileId) || null;
        try {
          let raw = await call('profile', profilePrompt(input, row, previousProfile), row), candidate, errors;
          const parse = value => {
            const parsed = parseJsonResponse(value);
            const validation = validateProfile(parsed, input.players);
            if (parsed?.rowId !== row.rowId || parsed?.profileId !== row.profileId) validation.push('人物行或身份与本次指定对象不一致');
            return { candidate: parsed, errors: validation };
          };
          try { ({ candidate, errors } = parse(raw)); } catch (error) { errors = [String(error.message)]; }
          if (errors.length) {
            raw = await call('profile-repair', profilePrompt(input, row, previousProfile, { raw, errors }), row);
            ({ candidate, errors } = parse(raw));
          }
          if (errors.length) {
            task.errors = errors; task.candidate = clone(candidate);
            throw fault('profile_incomplete', '该人物补填后仍不完整，可再次修复');
          }
          await assert();
          const profile = { ...clone(candidate), presence: task.presence, lastSeenIndex: receipt.target.index,
            sourceEvidence: task.evidence, updatedAt: new Date().toISOString() };
          const index = draft.profiles.findIndex(value => value.profileId === task.profileId);
          if (index < 0) draft.profiles.push(profile); else draft.profiles[index] = profile;
          task.status = 'complete'; task.code = null;
          draft.status = 'saving'; await persist(); draft.status = 'generating';
        } catch (error) {
          if (INVALIDATED.has(error.code) || ctl.signal.aborted || /^profile_store|profile_revision/.test(error.code || '')) throw error;
          task.status = 'failed'; task.code = error.code === 'profile_incomplete' ? error.code : 'profile_generation_failed';
          draft.status = 'generating'; await persist();
        }
      }
      draft.status = draft.tasks.some(task => task.status !== 'complete') ? 'partial' : 'complete';
      await persist();
      publish({ detail: draft.status === 'partial' ? '部分人物未完成；已完成档案已保存，可点击修复本轮档案'
        : draft.tasks.length ? '本轮人物档案已完整填表并读回' : '模型判定本轮没有需要建档的人物，理由已保存' });
    } catch (error) {
      if (token !== epoch) return;
      if (draft && branch && !INVALIDATED.has(error.code) && !/^profile_store|profile_revision/.test(error.code || '')) {
        draft.status = 'failed'; draft.failureCode = 'profile_generation_failed';
        await persist().catch(() => {});
      }
      publish({ status: ctl.signal.aborted ? 'cancelled' : 'failed', detail: INVALIDATED.has(error.code)
        ? '正文、变量或任务已变化，旧人物候选已停止；已有完整档案保留'
        : '本轮档案检查未完成，已有完整档案保留，可重新修复', readback: false });
    } finally {
      if (controller === ctl) controller = null;
      if (token === epoch) publish({ busy: false });
    }
  }
  function run(receipt, manual = false) {
    if (!manual && !settings().enabled) return Promise.resolve();
    if (!receipt) { publish({ status: 'waiting', detail: '请先完成当前正文的变量检查' }); return Promise.resolve(); }
    cancel('准备重新读取人物资料');
    const token = epoch, previous = runPromise;
    runPromise = (async () => { if (previous) await previous; if (token === epoch) await execute(receipt, manual, token); })();
    return runPromise;
  }
  async function retry() { return run(host.receipt(), true); }
  async function updateSettings(values) {
    const ctx = host.context(); ctx.extensionSettings[SETTINGS_KEY] = { ...settings(), ...values };
    ctx.saveSettingsDebounced?.();
    if (values.enabled === false) cancel('自动建档已关闭，仍可手动修复');
    if (values.recallEnabled === false) clearRecall();
    publish({});
  }
  function bind() {
    const ctx = host.context(), events = ctx.event_types || ctx.eventTypes || {};
    const on = (name, fallback, fn) => { const event = events[name] || fallback; ctx.eventSource.on(event, fn); listeners.push([event, fn]); };
    const unsubscribe = host.doctor().subscribe('profiles-v1', receipt => run(receipt));
    listeners.push([null, unsubscribe]);
    on('GENERATION_STARTED', 'generation_started', async (type = 'normal', options = {}, dryRun = false) => {
      if (dryRun || options?.dryRun || options?.quiet || options?.silent || options?.raw
        || !['normal', 'swipe', 'regenerate', 'continue'].includes(String(type).toLowerCase())) return;
      cancel('新正文开始，旧人物检查已取消'); acceptedRecall = null;
      const generation = { type: String(type).toLowerCase(), scope: canonical(host.scope()),
        baselineIndex: host.latestIndex(), ended: false, initialDeletionConsumed: false };
      recallGeneration = generation;
      try { await prepareRecall(generation); } catch {
        if (recallGeneration === generation) { clearRecall(); publish({ detail: '人物资料本次未能召回，正文仍可继续' }); }
      }
    });
    on('CHAT_COMPLETION_PROMPT_READY', 'chat_completion_prompt_ready', inspectPrompt);
    const changed = () => { recallGeneration = null; cancel('聊天或正文发生变化，旧人物检查停止'); clearRecall(); acceptedRecall = null;
      void refresh().catch(() => publish({ status: 'failed', detail: '人物档案存档未能读回', profiles: [], tasks: [], readback: false })); };
    on('MESSAGE_DELETED', 'message_deleted', index => {
      const generation = recallGeneration;
      if (generation?.type === 'regenerate' && !generation.ended && !generation.initialDeletionConsumed
        && generation.scope === canonical(host.scope()) && Number.isInteger(index)
        && index === generation.baselineIndex && host.context().chat?.length === generation.baselineIndex) {
        generation.initialDeletionConsumed = true; return;
      }
      changed();
    });
    for (const [name, fallback] of [['GENERATION_STOPPED', 'generation_stopped'], ['MESSAGE_SWIPED', 'message_swiped'],
      ['MESSAGE_EDITED', 'message_edited'], ['CHAT_CHANGED', 'chat_id_changed'], ['CHAT_LOADED', 'chat_loaded']]) {
      on(name, fallback, changed);
    }
    return refresh();
  }
  function destroy() { recallGeneration = null; cancel(); clearRecall(); for (const [event, fn] of listeners) {
    if (event) host.context().eventSource.removeListener(event, fn); else fn();
  } }
  return Object.freeze({ bind, run, retry, cancel, refresh, updateSettings, snapshot, destroy,
    read: async () => clone(await store.latest(await host.branches())),
    record: () => clone(current), review: () => clone(current?.review || null) });
}
