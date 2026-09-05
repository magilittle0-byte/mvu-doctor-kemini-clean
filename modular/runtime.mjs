import { clone, canonical, digest, fault } from './variables/core.mjs';

export function createRuntime({ host, store, variables, disableNative = () => {}, notify = () => {} }) {
  let epoch = 0, ticket = null, controller = null, result = null;
  let state = { status: 'idle', detail: '等待本轮正文完成', busy: false, stage: 1, locked: false };
  const inFlight = new Set(), consumers = new Map();
  const snapshot = () => ({ ...clone(state), inFlight: inFlight.size, modules: { variables: 'candidate', profiles: 'not_implemented', world: 'not_implemented' }, result: result ? { status: result.status, durationMs: result.durationMs, operationCount: result.operationCount, changedPaths: result.changedPaths, readback: result.readback, semanticProof: false, restored: result.restored === true } : null });
  const publish = () => notify(snapshot());
  function setState(values) { state = { ...state, ...values }; publish(); }
  function cancel(detail = '本次检查已取消') {
    epoch++; ticket = null; controller?.abort(); controller = null;
    setState({ status: 'cancelled', detail, busy: false });
  }
  async function run(target, reason = 'auto', token = epoch, staleRetries = 0) {
    if (!target || token !== epoch || !host.settings().enabled) return;
    const ctl = new AbortController(); controller = ctl;
    const job = {}; inFlight.add(job);
    setState({ status: 'checking', detail: '正在检查本轮变量', busy: true });
    try {
      const receipt = await variables.run(target, { signal: ctl.signal, reason,
        onStatus: values => { if (token === epoch) setState(values); },
      });
      if (token !== epoch) return;
      result = receipt;
      await store.write(`pending:variables:${target.scopeKey}`, { status: 'settled', target, moduleVersion: variables.version });
      if (token !== epoch) return;
      setState({ status: receipt.status, detail: receipt.status === 'model_nochange'
        ? '模型未提出需要修改的变量；已核对存档读回。尚不代表已完成独立真实验收。'
        : '变量修复已写入，宿主存档读回一致。', busy: false });
      for (const consumer of consumers.values()) {
        // Future modules receive isolated copies; their failure cannot rewrite
        // the variable result. No profile/world consumer is registered in P1.
        void Promise.resolve().then(() => consumer(clone(receipt))).catch(() => {});
      }
    } catch (error) {
      if (token !== epoch) return;
      if (['stale_mvu', 'stale_previous_mvu'].includes(error.code) && staleRetries < host.settings().maxAttempts - 1) {
        setState({ status: 'waiting_mvu', detail: '变量证据发生变化，正在读取当前快照重新检查', busy: true });
        try { await host.delay(500, ctl.signal); } catch { return; }
        if (token === epoch) return await run(await host.capture(target.index), 'auto', token, staleRetries + 1);
        return;
      }
      const code = error.code || (ctl.signal.aborted ? 'cancelled' : 'model_transport');
      // Transport exception messages may include endpoint details. Expose only
      // a known code and a user-facing explanation, never upstream raw errors.
      const detail = code === 'cancelled' || code === 'stale_target'
        ? '输入已变化或任务已取消，旧检查不能作为本轮结果。'
        : `本轮变量检查未完成（${code}）。已保留恢复记录，可重试本轮；未将失败算作成功。`;
      setState({ status: 'failed', code, detail, busy: false });
      await store.write(`pending:variables:${target.scopeKey}`, { status: 'failed', code, target, moduleVersion: variables.version }).catch(() => {});
    } finally {
      inFlight.delete(job); if (controller === ctl) controller = null; publish();
    }
  }
  async function finish(scheduled) {
    try {
      await host.delay(500);
      if (ticket !== scheduled || scheduled.epoch !== epoch || !scheduled.ended) return;
      let target = await host.capture(scheduled.received);
      if (ticket !== scheduled) return;
      if (!target) { ticket = null; setState({ status: 'idle', detail: '没有可绑定的用户回合正文，未启动检查', busy: false }); return; }
      if (scheduled.type === 'normal' && (target.index <= scheduled.baselineIndex || target.userIndex <= scheduled.baselineIndex)) {
        ticket = null; setState({ status: 'idle', detail: '开场或后台输出不触发变量检查', busy: false }); return;
      }
      if (scheduled.type !== 'normal' && target.index !== scheduled.baselineIndex) throw fault('stale_target', '续写或重生成的目标楼层不匹配');
      await host.delay(150);
      const fresh = await host.capture(target.index);
      if (!fresh || fresh.identity !== target.identity) {
        if (ticket === scheduled) return void finish(scheduled);
        return;
      }
      target = fresh;
      if (ticket !== scheduled || scheduled.epoch !== epoch) return;
      if (/^\[(?:(?:api|http|request)\s*)?(?:error|failed|failure|错误|失败)\]/iu.test(target.content)) {
        ticket = null; setState({ status: 'failed', code: 'host_generation_error', detail: '正文模型返回错误提示，没有生成有效剧情。', busy: false }); return;
      }
      await store.write(`pending:variables:${target.scopeKey}`, { status: 'accepted', target, moduleVersion: variables.version });
      if (ticket !== scheduled || scheduled.epoch !== epoch) return;
      ticket = null;
      void run(target, 'auto', scheduled.epoch);
    } catch (error) {
      if (scheduled.epoch === epoch) setState({ status: 'failed', detail: '最终正文尚未能绑定，未执行变量修复', code: error.code || 'accepted_final_failed', busy: false });
    }
  }
  function started(type = 'normal', options = {}, dryRun = false) {
    type = String(type || 'normal').toLowerCase();
    if (dryRun === true || options?.dryRun || options?.quiet || options?.silent || options?.raw || !['normal', 'swipe', 'regenerate', 'continue'].includes(type)) return;
    cancel('新正文生成开始，旧检查停止写入');
    disableNative();
    ticket = { epoch, type, scope: canonical(host.scope()), baselineIndex: host.latestIndex(), received: null, ended: false };
    result = null;
    setState({ status: 'waiting', detail: '正文正在生成，完成后再检查变量', busy: false });
  }
  function received(index, type = '') {
    if (!ticket || canonical(host.scope()) !== ticket.scope || ['quiet', 'impersonate', 'first_message', 'command', 'extension'].includes(String(type))) return;
    const acceptedTypes = ticket.type === 'continue' ? ['continue', 'append', 'appendfinal'] : ticket.type === 'regenerate' ? ['regenerate', 'normal'] : [ticket.type];
    if (type && !acceptedTypes.includes(String(type).toLowerCase())) return;
    if (index !== null && index !== '' && Number.isInteger(Number(index))) ticket.received = Number(index);
    scheduleFinal();
  }
  function scheduleFinal() {
    if (!ticket?.ended || ticket.received === null || ticket.finishing) return;
    ticket.finishing = true; void finish(ticket);
  }
  function ended() {
    if (!ticket || ticket.ended || canonical(host.scope()) !== ticket.scope) return;
    ticket.ended = true; scheduleFinal();
  }
  async function restore() {
    cancel('正在读取当前聊天的模块记录'); result = null;
    const token = epoch, currentScope = host.scope();
    if (!currentScope) { setState({ status: 'idle', detail: '请选择一个聊天', busy: false }); return; }
    const scopeKey = await digest(currentScope);
    const pending = await store.read(`pending:variables:${scopeKey}`);
    if (token !== epoch) return;
    const saved = await store.read(`latest:variables:${scopeKey}`);
    if (token !== epoch) return;
    const target = await host.capture().catch(() => null);
    if (token !== epoch) return;
    if (pending?.status === 'accepted' && target?.identity === pending.target.identity) return void run(target, 'auto', token);
    if (saved && target?.identity === saved.identity) {
      const valid = await variables.validateReceipt(target, saved);
      if (token !== epoch) return;
      result = valid ? { ...saved, restored: true } : null;
      setState({ status: valid ? saved.status : 'outdated', detail: valid ? '本聊天的变量记录与当前状态、规则、模型配置及宿主存档一致；模块尚未锁定。' : '旧记录与当前状态或版本不一致，可重新检查本轮。', busy: false });
    } else setState({ status: pending?.status === 'failed' && target?.identity === pending.target.identity ? 'failed' : 'idle', detail: pending?.status === 'failed' && target?.identity === pending.target.identity ? '本轮上次检查失败，可重试本轮。' : '等待本轮正文完成', busy: false });
  }
  async function retry() {
    cancel('重新检查当前正文'); const token = epoch;
    const target = await host.capture();
    if (!target) { setState({ status: 'idle', detail: '没有可检查的用户回合正文', busy: false }); return; }
    void run(target, 'manual', token);
  }
  function bind() {
    const ctx = host.context(), events = ctx.event_types || ctx.eventTypes || {};
    const on = (name, fallback, listener) => ctx.eventSource.on(events[name] || fallback, listener);
    on('GENERATION_STARTED', 'generation_started', started);
    on('MESSAGE_RECEIVED', 'message_received', received);
    on('GENERATION_ENDED', 'generation_ended', ended);
    on('GENERATION_STOPPED', 'generation_stopped', () => cancel('用户停止了正文生成，本轮未验收'));
    on('MESSAGE_SENT', 'message_sent', () => { if (!ticket) cancel('新用户输入到达，旧检查停止写入'); });
    on('MESSAGE_SWIPED', 'message_swiped', () => { cancel('swipe已切换，旧检查停止写入'); void restore(); });
    on('MESSAGE_EDITED', 'message_edited', () => cancel('正文已编辑，旧检查停止写入'));
    on('MESSAGE_DELETED', 'message_deleted', () => { cancel('消息已删除，旧检查停止写入'); void restore(); });
    on('CHAT_CHANGED', 'chat_id_changed', () => { cancel('聊天已切换'); void restore(); });
    on('CHAT_LOADED', 'chat_loaded', () => { disableNative(); void restore().catch(() => setState({ status: 'failed', detail: '本聊天的医生存档读回失败', busy: false })); });
    void restore().catch(() => setState({ status: 'failed', detail: '医生存档读回失败', busy: false }));
  }
  return Object.freeze({ bind, started, received, ended, retry, cancel, restore, snapshot,
    record: () => clone(result),
    subscribe: (id, consumer) => { if (consumers.has(id)) throw fault('duplicate_module', '模块已注册'); consumers.set(id, consumer); return () => consumers.delete(id); },
  });
}
