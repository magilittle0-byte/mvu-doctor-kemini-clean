import { clone, canonical, fault } from './store.mjs';
import { evolveGuide } from './evolve.mjs';
import { buildGuideReveal, currentGuideInput } from './reveal.mjs';

// One owner for acceptance, background work, storage and prompt lifetime.
export function createGuideRuntime({ host, store, evolve = evolveGuide, reveal = buildGuideReveal, notify = () => {} }) {
  let epoch = 0, ticket = null, pending = null, active = null, saved = null, disposed = false;
  let restoredScope = '', lastDelivery = null;
  const listeners = [], attempted = new Set(), deliveries = new Map();
  let state = { status: 'idle', busy: false, requestCount: 0, acceptedCount: 0,
    detail: '等待新正文，恢复存档不会发起推演', readback: false, latestApplied: true };
  const snapshot = () => clone({ ...state, enabled: !disposed && host.settings().enabled !== false,
    pending: !!pending, revision: saved?.snapshot?.revision || 0, matters: saved?.snapshot?.matters?.length || 0 });
  const publish = values => { if (disposed) return; state = { ...state, ...values, busy: !!active }; notify(snapshot()); };
  const valid = token => !disposed && token === epoch;
  function invalidate() {
    epoch++;
    active?.controller.abort();
  }
  function guard(target, token) {
    if (!valid(token)) throw fault('guide_stale', '本次依据已过期');
    host.assertTarget(target);
  }
  async function locate(target, includeCurrent = true) {
    if (includeCurrent) {
      const exact = await store.read(target.scopeKey, target.lineage);
      if (exact) return exact;
    }
    const branches = await host.branches();
    for (const branch of branches.filter(row => row.index < target.index).sort((a, b) => b.index - a.index)) {
      if (branch.scopeKey !== target.scopeKey) continue;
      const record = await store.read(branch.scopeKey, branch.lineage);
      if (record) return record;
    }
    return null;
  }
  async function restore() {
    if (disposed) return;
    invalidate(); ticket = null; pending = null; lastDelivery = null; deliveries.clear(); host.clearPrompt();
    const token = epoch;
    saved = null; restoredScope = '';
    publish({ status: 'loading', detail: '读取当前分支的指导记录', readback: false, code: null });
    try {
      const target = await host.capture();
      if (!valid(token)) return;
      const loaded = target ? await locate(target) : null;
      if (!valid(token)) return;
      saved = loaded;
      restoredScope = canonical(host.scope());
      publish({ status: saved ? 'restored' : 'idle', readback: !!saved,
        detail: saved ? '已读回本分支的幕后记录；没有额外推进' : '等待新正文；不会自动补跑历史', code: null });
    } catch (error) {
      if (valid(token)) publish({ status: 'failed', code: safeCode(error), detail: '指导存档读取失败，未用空结果覆盖旧记录' });
    }
  }
  function preparePrompt() {
    host.clearPrompt();
    if (host.settings().enabled === false || restoredScope !== canonical(host.scope())) return null;
    const chat = host.context().chat || [];
    const user = [...chat].reverse().find(message => message?.is_user);
    const userInput = String(user?.mes || '');
    const sameFloor = ticket && ticket.type !== 'normal' && saved?.target?.index === ticket.baselineIndex;
    const record = (sameFloor ? saved?.beforeSnapshot : saved?.snapshot) || { matters: [] };
    const recentText = chat.filter(row => row && !row.is_user && !row.is_system).slice(-2)
      .map(row => String(row.mes || '')).join('\n');
    const selected = reveal({ snapshot: record, userInput,
      scene: { text: userInput, recentText }, budgetChars: host.settings().promptBudgetChars || 4800 });
    if (selected.text) host.setPrompt(selected.text);
    return { ...selected, promptObserved: false, sourceRevision: record.revision || 0 };
  }
  function started(type = 'normal', options = {}, dryRun = false) {
    type = String(type || 'normal').toLowerCase();
    if (disposed || dryRun || options?.dryRun || options?.quiet || options?.silent || options?.raw
      || !['normal', 'swipe', 'regenerate', 'continue'].includes(type)) return;
    const missed = !!active || !!pending;
    invalidate();
    ticket = { token: epoch, type, scope: canonical(host.scope()), baselineIndex: host.latestIndex(),
      received: null, ended: false, finishing: false, delivery: null, worldEntries: [], worldObserved: false };
    let preparationFailed = false;
    try { ticket.delivery = preparePrompt(); }
    catch (error) { preparationFailed = true; host.clearPrompt(); publish({ code: safeCode(error) }); }
    publish({ status: 'waiting', latestApplied: !missed, coverageLimited: preparationFailed || ticket.delivery?.coverageLimited === true,
      detail: missed ? '本轮未应用最新指导，正文继续；后台将在接受新正文后续接' : '正文生成中；按已有幕后事实与条件准备提示' });
  }
  function received(index, type = '') {
    if (!ticket || ticket.scope !== canonical(host.scope())) return;
    const actual = String(type || '').toLowerCase();
    const allowed = ticket.type === 'continue' ? ['continue', 'append', 'appendfinal']
      : ticket.type === 'regenerate' ? ['regenerate', 'normal'] : [ticket.type];
    if (actual && !allowed.includes(actual)) return;
    if (Number.isInteger(index) && index >= 0) ticket.received = index;
    scheduleFinish();
  }
  function ended() {
    if (!ticket || ticket.scope !== canonical(host.scope())) return;
    ticket.ended = true; scheduleFinish();
  }
  function promptReady(data) {
    if (!ticket || data?.dryRun || !Array.isArray(data?.chat)) return;
    ticket.worldObserved = true;
    if (!ticket.delivery?.text) return;
    const text = ticket.delivery.text;
    const present = data.chat.some(message => typeof message?.content === 'string' && message.content.includes(text));
    if (present) {
      ticket.delivery.promptObserved = true;
      publish({ delivery: 'provided', detail: '本轮主提示已包含指导内容；正文是否采用仍待核对' });
    }
  }
  function scheduleFinish() {
    if (!ticket?.ended || ticket.received === null || ticket.finishing) return;
    ticket.finishing = true;
    void finish(ticket);
  }
  async function finish(current) {
    try {
      await host.delay(500);
      while (valid(current.token) && ticket === current && host.isGenerating?.()) await host.delay(150);
      if (!valid(current.token) || ticket !== current) return;
      let target = await host.capture(current.received);
      if (!target) throw fault('guide_target_missing', '没有可绑定的完整正文');
      if (current.type === 'normal' && (target.index <= current.baselineIndex || target.userIndex <= current.baselineIndex)) {
        ticket = null; publish({ status: 'idle', detail: '开场或辅助输出不触发指导' }); return;
      }
      if (current.type !== 'normal' && target.index !== current.baselineIndex) throw fault('guide_stale', '同楼目标已改变');
      await host.delay(150);
      const fresh = await host.capture(target.index);
      if (!valid(current.token) || ticket !== current) return;
      if (!fresh || fresh.identity !== target.identity || fresh.lineage !== target.lineage) {
        current.finishing = false; scheduleFinish(); return;
      }
      target = fresh; guard(target, current.token);
      if (/^\[(?:(?:api|http|request)\s*)?(?:error|failed|failure|错误|失败)\]/iu.test(target.content))
        throw fault('guide_main_failed', '主正文返回错误');
      await host.readback(target);
      guard(target, current.token);
      lastDelivery = current.delivery ? { ...current.delivery, targetIdentity: target.identity } : null;
      if (lastDelivery) deliveries.set(target.identity, {
        targetIdentity: target.identity, providedIds: lastDelivery.providedIds, exposureIds: lastDelivery.exposureIds,
        promptObserved: lastDelivery.promptObserved === true, sourceRevision: lastDelivery.sourceRevision,
      });
      ticket = null;
      pending = { target, token: current.token, delivery: lastDelivery, manual: false,
        worldEntries: current.worldEntries, worldObserved: current.worldObserved };
      publish({ acceptedCount: state.acceptedCount + 1, status: 'queued', detail: '正文已接受，等待单次幕后推演' });
      void drain();
    } catch (error) {
      if (valid(current.token)) {
        ticket = null;
        publish({ status: 'failed', code: safeCode(error), detail: '未确认本轮完整正文，指导未推进；可在正文恢复后重算本次' });
      }
    }
  }
  async function drain() {
    if (disposed || active || ticket || !pending) return;
    const job = pending; pending = null;
    const { target, token } = job;
    if (!valid(token) || host.settings().enabled === false) return;
    const key = `${target.scopeKey}:${target.lineage}`;
    if (!job.manual && attempted.has(key)) return;
    const controller = new AbortController(); active = { controller, job };
    const startedAt = Date.now();
    publish({ status: 'loading', code: null, detail: '读取本次之前的幕后状态', readback: false });
    try {
      guard(target, token);
      const exact = await store.read(target.scopeKey, target.lineage);
      guard(target, token);
      if (exact && !job.manual) {
        saved = exact; restoredScope = canonical(host.scope());
        publish({ status: 'restored', readback: true, detail: '该正文已有指导记录，没有重复推进' }); return;
      }
      const previous = await locate(target, false);
      guard(target, token);
      const baseline = clone(exact?.beforeSnapshot || previous?.snapshot || { matters: [], revision: 0 });
      const afterIndex = exact?.baselineIndex ?? previous?.target?.index ?? -1;
      const newlyAccepted = (await host.captureHistory(target, afterIndex)).map(row => ({
        identity: row.identity, index: row.index, userText: currentGuideInput(row.userText), content: row.content,
      }));
      guard(target, token);
      const priorReceipts = new Map((exact?.receipts || []).map(receipt => [receipt.targetIdentity, receipt]));
      const receipts = newlyAccepted.map(row => deliveries.get(row.identity) || priorReceipts.get(row.identity)).filter(Boolean);
      const worldObservation = job.worldObserved === true
        ? { activatedEntries: job.worldEntries || [], observed: true }
        : exact?.worldObservation || { activatedEntries: [], observed: false };
      const material = await host.material(target, baseline, { ...worldObservation, afterIndex });
      guard(target, token);
      const routeFingerprint = await host.requestFingerprint();
      guard(target, token);
      let calls = 0;
      const request = async (messages, options = {}) => {
        guard(target, token);
        if (++calls > 1) throw fault('guide_call_limit', '本轮不能自动追加调用');
        attempted.add(key);
        publish({ status: 'generating', requestCount: state.requestCount + 1, detail: '正在幕后推演，正文可以继续' });
        return host.request(messages, { ...options, signal: controller.signal, target });
      };
      const result = await evolve({ request, target, material, baseline,
        priorDelivery: { receipts },
        newlyAccepted, signal: controller.signal });
      guard(target, token);
      if (routeFingerprint !== await host.requestFingerprint()) throw fault('guide_route_changed', '模型连接已变化');
      guard(target, token);
      const coveredReplyKeys = [...new Set(newlyAccepted.map(row => row.identity).filter(Boolean))];
      if (!coveredReplyKeys.includes(target.identity)) throw fault('guide_coverage', '本次正文未包含在推演输入中');
      const record = {
        target: { identity: target.identity, index: target.index, lineage: target.lineage,
          userIndex: target.userIndex, swipeId: target.swipeId },
        baselineIndex: afterIndex, beforeSnapshot: baseline,
        snapshot: { ...result.snapshot, revision: (baseline.revision || 0) + 1 },
        coveredReplyKeys, receipts: clone(receipts), worldObservation: clone(worldObservation),
        summary: result.summary, conflicts: result.conflicts, adoption: result.adoption,
        delivery: job.delivery ? { providedIds: job.delivery.providedIds, exposureIds: job.delivery.exposureIds,
          promptObserved: job.delivery.promptObserved === true, targetIdentity: target.identity,
          sourceRevision: job.delivery.sourceRevision } : null,
        durationMs: Date.now() - startedAt, requestCount: calls, routeFingerprint,
      };
      publish({ status: 'saving', detail: '保存幕后结果并独立读回' });
      saved = await store.commit({ scopeKey: target.scopeKey, branchKey: target.lineage,
        expectedRevision: exact?.revision || 0, record, assertCurrent: () => guard(target, token) });
      guard(target, token); restoredScope = canonical(host.scope());
      for (const key of coveredReplyKeys) if (key !== target.identity) deliveries.delete(key);
      publish({ status: result.conflicts?.length ? 'conflict' : 'settled', readback: true, latestApplied: true,
        durationMs: Date.now() - startedAt, detail: result.conflicts?.length
          ? '幕后结果已保存；部分事项与正文有冲突，已保留待核对' : '幕后结果已保存，等待合适的时机影响正文', code: null });
    } catch (error) {
      if (valid(token)) publish({ status: 'failed', code: safeCode(error), readback: false,
        detail: '本轮指导未完成，保留上次完整记录；未自动追加请求', durationMs: Date.now() - startedAt });
    } finally {
      if (active?.job === job) active = null;
      publish({});
      if (pending && !ticket) void drain();
    }
  }
  async function retry() {
    if (active || ticket || disposed) return;
    invalidate(); const token = epoch;
    try {
      const target = await host.capture();
      if (!target) throw fault('guide_target_missing', '没有可重算的正文');
      await host.readback(target); guard(target, token);
      pending = { target, token, manual: true, delivery: lastDelivery };
      return drain();
    } catch (error) { if (valid(token)) publish({ status: 'failed', code: safeCode(error), detail: '无法确认当前正文，未启动重算' }); }
  }
  function cancelled() {
    invalidate(); ticket = null; pending = null; host.clearPrompt();
    publish({ status: 'cancelled', detail: '正文已停止，旧推演不能继续写入' });
  }
  function deleted(index) {
    if (ticket?.type === 'regenerate' && !ticket.ended && ticket.received === null && !ticket.initialDeletion
      && Number(index) === ticket.baselineIndex && host.context().chat.length === ticket.baselineIndex) {
      ticket.initialDeletion = true; return;
    }
    void restore();
  }
  function bind() {
    const ctx = host.context(), events = ctx.event_types || ctx.eventTypes;
    const on = (name, callback) => {
      if (!events?.[name]) throw fault('guide_capability', '宿主缺少指导需要的事件');
      ctx.eventSource.on(events[name], callback);
      listeners.push(() => ctx.eventSource.removeListener(events[name], callback));
    };
    on('GENERATION_STARTED', started); on('MESSAGE_RECEIVED', received); on('GENERATION_ENDED', ended);
    on('GENERATION_STOPPED', cancelled); on('CHAT_COMPLETION_PROMPT_READY', promptReady);
    on('WORLD_INFO_ACTIVATED', entries => {
      if (ticket && Array.isArray(entries) && ticket.scope === canonical(host.scope())) ticket.worldEntries = clone(entries);
    });
    on('MESSAGE_SENT', () => { if (!ticket) invalidate(); });
    on('MESSAGE_SWIPED', () => { if (!ticket) void restore(); });
    on('MESSAGE_EDITED', () => void restore()); on('MESSAGE_DELETED', deleted);
    on('CHAT_CHANGED', () => void restore()); on('CHAT_LOADED', () => void restore());
    return restore();
  }
  function setEnabled(enabled) {
    host.updateSettings({ enabled: enabled === true });
    if (!enabled) cancelled(); else void restore();
    publish({});
  }
  function destroy() {
    if (disposed) return;
    disposed = true; invalidate(); ticket = null; pending = null;
    for (const remove of listeners.splice(0)) remove();
    host.clearPrompt(); host.destroy?.();
  }
  return Object.freeze({ bind, destroy, restore, retry, setEnabled, snapshot,
    record: () => clone(saved), started, received, ended, promptReady });
}

function safeCode(error) {
  const code = String(error?.code || 'guide_failed');
  return /^[a-z][a-z0-9_]{0,64}$/u.test(code) ? code : 'guide_failed';
}
