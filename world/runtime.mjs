import { clone, canonical, digest, fault } from '../modular/variables/core.mjs';
import { createNativeWorldEngine } from './engine.mjs';
import { worldInstruction } from './content.mjs';
import { buildDeliveries, makeRecall, settleDeliveries } from './recall.mjs';

export const WORLD_VERSION = '0.1.0-candidate.1';
const PROMPT_KEY = 'mvu_doctor_world_v1';
const INVALIDATED = new Set(['cancelled', 'stale_target', 'stale_mvu', 'variables_not_ready',
  'variable_evidence_changed', 'stale_profiles', 'profiles_pending', 'profiles_unavailable']);

// P1/P2 source map and single-branch repair semantics: PHASE3_SOURCE_MAP.md.
export function createWorldRuntime({ host, store, notify = () => {}, engineFactory = createNativeWorldEngine }) {
  let epoch = 0, refreshToken = 0, controller = null, engine = null, running = null, current = null;
  let state = { status: 'idle', stage: '等待正文', detail: '等待本轮变量和人物档案完成', busy: false, readback: false, round: 0 };
  let disposed = false, timer = null, observing = false, lastAttempt = null;
  let generation = null, recall = null, endedRecall = null;
  const listeners = [];
  const snapshot = () => clone(state);
  const attemptKey = (receipt, profiles) => receipt?.target && profiles ? canonical([
    receipt.target.scopeKey, receipt.target.identity, receipt.identity, receipt.afterHash, profiles.lineage, profiles.revision,
  ]) : null;
  function publish(values) {
    const next = { ...state, ...values };
    if (canonical(next) !== canonical(state)) { state = next; notify(snapshot()); }
  }
  function show(saved, restored = false) {
    current = clone(saved);
    publish({ status: saved ? (restored && saved.status === 'complete' ? 'restored' : saved.status === 'running' ? 'waiting' : saved.status) : 'idle',
      stage: saved?.status === 'complete' ? '世界记录已保存' : '等待修复或本轮档案',
      detail: saved ? (saved.status === 'complete' ? '世界记录及召回账本已保存并读回' : '本轮世界尚未完成，已有记录保留，可点击修复本轮') : '本聊天尚无世界记录',
      round: Number(saved?.world?.round) || 0, readback: !!saved, restored, error: saved?.failureCode || null });
    notify(snapshot());
  }
  function clearRecall() {
    host.context().setExtensionPrompt?.(PROMPT_KEY, '', 1, 0, false); recall = null;
  }
  function cancel(detail = '旧世界任务已停止，已有完整记录保留') {
    epoch++; refreshToken++; controller?.abort(); engine?.abort();
    publish({ status: 'cancelled', busy: false, detail });
  }
  async function refresh() {
    const token = ++refreshToken, saved = await store.latest(await host.branches());
    if (!disposed && token === refreshToken && !state.busy) show(saved, true);
    return snapshot();
  }
  function promptContains(payload, text) {
    const seen = new Set();
    function visit(value, depth = 0) {
      if (typeof value === 'string') return value.includes(text);
      if (!value || typeof value !== 'object' || depth > 6 || seen.has(value)) return false;
      seen.add(value); return Object.values(value).some(child => visit(child, depth + 1));
    }
    return visit(payload);
  }
  async function prepareRecall(ticket) {
    clearRecall();
    const valid = () => !disposed && generation === ticket && !ticket.ended && ticket.scope === canonical(host.scope());
    const branches = (await host.branches()).filter(branch => !['swipe', 'regenerate', 'continue'].includes(ticket.type)
      || branch.index < ticket.baselineIndex);
    const saved = await store.latest(branches);
    if (!valid() || !saved) return;
    const prepared = await makeRecall(saved);
    if (!valid() || !prepared) return;
    if (typeof host.context().setExtensionPrompt !== 'function') throw fault('world_not_ready', '宿主未提供世界召回接口');
    recall = { ...prepared, promptObserved: false, generationId: ticket.id, generationType: ticket.type,
      scope: ticket.scope, baselineIndex: ticket.baselineIndex, sourceScopeKey: saved.scopeKey };
    host.context().setExtensionPrompt(PROMPT_KEY, recall.text, 1, 0, false);
  }
  async function boundRecall(receipt) {
    const candidate = endedRecall;
    if (!candidate || !candidate.promptObserved || candidate.scope !== receipt.target.scopeSignature) return null;
    const sameIndex = ['swipe', 'regenerate', 'continue'].includes(candidate.generationType);
    if (sameIndex ? receipt.target.index !== candidate.baselineIndex : receipt.target.index <= candidate.baselineIndex) return null;
    if (!candidate.targetIdentity) return null;
    if (candidate.targetIdentity !== receipt.target.identity) return null;
    return clone(candidate);
  }
  async function execute(receipt, manual, token) {
    const ctl = new AbortController(); controller = ctl;
    const startedAt = Date.now(); let draft = null, branch = null, revision = 0, profileSnapshot = null,
      previousCompleteWorld = null, previousCompleteDeliveries = [];
    const assert = async () => {
      if (disposed || token !== epoch || ctl.signal.aborted) throw fault('cancelled', '世界任务已取消');
      await host.assertSnapshot(receipt, profileSnapshot, ctl.signal);
      if (token !== epoch || ctl.signal.aborted) throw fault('cancelled', '世界任务已取消');
    };
    const persist = async () => {
      draft.durationMs = Date.now() - startedAt;
      draft = await store.commit(branch, draft, revision, assert); revision = draft.revision;
      current = clone(draft);
    };
    try {
      publish({ status: 'loading', stage: '读取本轮完整输入', detail: '正在核对正文、变量、人物档案和世界存档', busy: true, error: null, restored: false });
      profileSnapshot = await host.captureProfiles(receipt, ctl.signal); branch = profileSnapshot.branch;
      await assert();
      lastAttempt = attemptKey(receipt, host.profilesApi()?.record?.());
      const branches = await host.branches(), exact = await store.read(branch);
      const previous = await store.latest(branches.filter(item => item.index < branch.index));
      revision = exact?.revision || 0;
      const inputIdentity = await digest({ variableIdentity: receipt.identity, mvuHash: receipt.afterHash,
        profileRecordHash: profileSnapshot.profileRecordHash });
      if (!manual && exact && !exact.tombstone && exact.version === WORLD_VERSION && exact.inputIdentity === inputIdentity) {
        await assert(); show(exact, true); return;
      }
      const input = await host.inputFor(receipt, profileSnapshot, ctl.signal);
      const baselineWorld = clone(exact?.baselineWorld || previous?.world || null);
      const baseDeliveries = clone(exact?.baseDeliveries || previous?.deliveries || []);
      const incomingRecall = await boundRecall(receipt) || clone(exact?.review?.incomingRecall || null);
      const inheritedDeliveries = await settleDeliveries(baseDeliveries, incomingRecall, receipt);
      engine = engineFactory({ world: baselineWorld, chatId: branch.scopeKey, chatLength: branch.index + 1,
        input, signal: ctl.signal, instruction: worldInstruction(input, baselineWorld || {}),
        callModel: async (prompt, signal) => {
          await assert();
          const request = { promptHash: await digest(prompt), prompt, raw: '', startedAt: Date.now() };
          draft.review.requests.push(request);
          try { request.raw = await host.callModel(receipt, profileSnapshot, prompt, signal); return request.raw; }
          finally { request.durationMs = Date.now() - request.startedAt; }
        } });
      previousCompleteWorld = clone(exact && !exact.tombstone ? exact.world : baselineWorld || engine.state());
      previousCompleteDeliveries = clone(exact && !exact.tombstone ? exact.deliveries : inheritedDeliveries);
      draft = { version: WORLD_VERSION, inputIdentity, variableIdentity: receipt.identity, mvuHash: receipt.afterHash,
        profileRecordHash: profileSnapshot.profileRecordHash, baselineWorld: baselineWorld || engine.state(),
        baseDeliveries, world: clone(previousCompleteWorld),
        deliveries: clone(previousCompleteDeliveries), heldProfiles: clone(profileSnapshot.heldProfiles), status: 'running',
        reason: manual ? 'manual' : 'auto', review: { input, incomingRecall, requests: [] }, durationMs: 0 };
      await persist();
      publish({ status: 'generating', stage: '世界推演', detail: '正在裁决人物行动与世界后果', readback: true });
      const result = await engine.evolve();
      await assert();
      if (!result.ok) throw fault('world_failed', '世界生成未完成，可再次修复');
      draft.world = clone(result.state); draft.review.native = clone(result.debug);
      draft.deliveries = await buildDeliveries({ before: draft.baselineWorld, world: draft.world,
        previous: inheritedDeliveries, source: { ...branch, inputIdentity } });
      draft.status = 'complete';
      publish({ status: 'saving', stage: '保存并读回', detail: '正在保存完整世界和本轮召回账本' });
      await persist(); show(draft);
    } catch (error) {
      if (disposed || token !== epoch) return;
      const invalidated = INVALIDATED.has(error.code) || ctl.signal.aborted;
      if (draft && !invalidated && !/^world_(?:store|revision)/.test(error.code || '')) {
        draft.status = 'failed'; draft.failureCode = 'world_failed'; draft.world = clone(previousCompleteWorld);
        draft.deliveries = clone(previousCompleteDeliveries);
        try { await persist(); } catch { /* The original complete record remains authoritative. */ }
      }
      publish({ status: invalidated ? 'cancelled' : 'failed', stage: '等待修复',
        error: invalidated ? 'world_stale' : /^world_(?:store|revision)/.test(error.code || '') ? 'world_store_read' : 'world_failed',
        detail: invalidated ? '正文、变量或档案发生变化，旧世界候选已停止'
          : '本轮世界生成或保存未完成，已有完整记录保留，可点击修复重新生成', readback: false });
    } finally {
      engine?.dispose(); engine = null;
      if (controller === ctl) controller = null;
      if (!disposed && token === epoch) publish({ busy: false });
    }
  }
  function run(receipt, manual = false) {
    if (disposed) return Promise.resolve();
    if (!receipt) { publish({ status: 'waiting', detail: '请先完成本轮变量和人物档案' }); return Promise.resolve(); }
    cancel('正在准备世界任务');
    const token = epoch, previous = running;
    running = (async () => { if (previous) await previous; if (token === epoch && !disposed) await execute(receipt, manual, token); })();
    return running;
  }
  async function observe() {
    if (disposed || observing || (generation && !generation.ended)) return;
    observing = true;
    try {
      const receipt = host.receipt(), p1 = host.doctor()?.status?.(), p2 = host.profilesApi()?.status?.();
      if (p1?.busy || p1?.inFlight || p2?.busy) {
        if (state.busy) cancel('变量或人物档案正在重新修复，旧世界候选停止');
        publish({ status: 'waiting', stage: '等待本轮变量和档案', detail: '本轮世界将在变量和人物档案保存完成后继续，已有世界记录保留' });
        return;
      }
      if (!receipt?.readback || !['applied', 'model_nochange', 'recovered'].includes(p1?.status)
        || !p2?.readback || !['complete', 'partial', 'restored'].includes(p2?.status)) {
        if (p2?.status === 'failed') publish({ status: 'waiting', stage: '等待人物档案修复',
          detail: '人物档案本轮尚未完成，请先使用人物模块的修复按钮', error: 'world_not_ready' });
        return;
      }
      const profiles = host.profilesApi()?.record?.();
      if (!profiles || profiles.index !== receipt.target.index || profiles.scopeKey !== receipt.target.scopeKey
        || profiles.variableIdentity !== receipt.identity || profiles.mvuHash !== receipt.afterHash) return;
      const key = attemptKey(receipt, profiles);
      if (lastAttempt === key || state.busy) return;
      lastAttempt = key;
      void run(receipt).catch(() => { if (!disposed) publish({ status: 'failed', error: 'world_failed', busy: false }); });
    } catch {
      if (!disposed) publish({ status: 'waiting', detail: '本轮世界输入尚未就绪，已有存档保留', error: 'world_not_ready' });
    } finally { observing = false; }
  }
  async function retry() { return run(host.receipt(), true); }
  function changed() {
    generation = null; endedRecall = null; lastAttempt = null;
    current = null; cancel('聊天或正文已变化，正在读取当前分支'); clearRecall();
    void refresh().catch(() => publish({ status: 'failed', detail: '世界存档未能读回', readback: false, error: 'world_store_read' }));
  }
  async function bind() {
    const ctx = host.context(), events = ctx.event_types || ctx.eventTypes || {};
    const on = (name, fallback, fn) => { const event = events[name] || fallback; ctx.eventSource.on(event, fn); listeners.push([event, fn, ctx.eventSource]); };
    const unsubscribe = host.doctor().subscribe('world-v1', () => { void observe(); });
    listeners.push([null, unsubscribe]);
    on('GENERATION_STARTED', 'generation_started', async (type = 'normal', options = {}, dryRun = false) => {
      type = String(type).toLowerCase();
      if (dryRun || options?.dryRun || options?.quiet || options?.silent || options?.raw
        || !['normal', 'swipe', 'regenerate', 'continue'].includes(type)) return;
      cancel('新正文开始，旧世界推演已停止'); endedRecall = null;
      const ticket = { id: crypto.randomUUID(), type, scope: canonical(host.scope()),
        baselineIndex: host.latestIndex(), ended: false, initialDeletionConsumed: false };
      generation = ticket;
      try { await prepareRecall(ticket); }
      catch { if (generation === ticket) { clearRecall(); publish({ detail: '世界资料本次未能召回，已有世界存档保留' }); } }
    });
    on('CHAT_COMPLETION_PROMPT_READY', 'chat_completion_prompt_ready', payload => {
      if (recall?.text && promptContains(payload, recall.text)) recall.promptObserved = true;
    });
    on('GENERATION_ENDED', 'generation_ended', async () => {
      const ticket = generation;
      if (!ticket || ticket.ended || ticket.scope !== canonical(host.scope())) return;
      ticket.ended = true;
      const prepared = recall ? { ...clone(recall), text: undefined } : null; clearRecall();
      // Only bind identity here; the authoritative accepted fact is still P1's later receipt.
      try {
        await host.delay(500);
        if (generation !== ticket || disposed) return;
        const target = await host.capture();
        if (generation === ticket && target && target.scopeSignature === ticket.scope)
          endedRecall = prepared ? { ...prepared, targetIdentity: target.identity } : null;
      } catch { if (generation === ticket) endedRecall = null; }
    });
    on('MESSAGE_DELETED', 'message_deleted', index => {
      const ticket = generation;
      if (ticket?.type === 'regenerate' && !ticket.ended && !ticket.initialDeletionConsumed
        && ticket.scope === canonical(host.scope()) && Number.isInteger(index)
        && index === ticket.baselineIndex && host.context().chat?.length === ticket.baselineIndex) {
        ticket.initialDeletionConsumed = true; return;
      }
      changed();
    });
    for (const [name, fallback] of [['GENERATION_STOPPED', 'generation_stopped'], ['MESSAGE_SWIPED', 'message_swiped'],
      ['MESSAGE_EDITED', 'message_edited'], ['CHAT_CHANGED', 'chat_id_changed'], ['CHAT_LOADED', 'chat_loaded']]) on(name, fallback, changed);
    await refresh();
    // Loading the module is not a new accepted turn. Existing state remains
    // readable; a new P1/P2 completion or the repair button starts new work.
    if (!disposed) {
      lastAttempt = attemptKey(host.receipt(), host.profilesApi()?.record?.());
      timer = setInterval(() => { void observe(); }, 1000);
    }
    return snapshot();
  }
  function destroy() {
    disposed = true; generation = null; endedRecall = null; clearInterval(timer); cancel(); clearRecall();
    for (const [event, fn, source] of listeners) { if (event) source.removeListener(event, fn); else fn(); }
  }
  return Object.freeze({ bind, run, retry, cancel, refresh, snapshot, destroy,
    read: async () => clone(await store.latest(await host.branches())), record: () => clone(current),
    review: () => clone(current?.review || null) });
}
