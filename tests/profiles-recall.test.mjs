import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileRuntime } from '../profiles/runtime.mjs';
import { createHost } from '../modular/host.mjs';
import { createProfileHost } from '../profiles/host.mjs';

function harness() {
  const handlers = new Map();
  const context = {
    chat: [{ is_user: false, mes: 'NPC站在门边。' }],
    extensionSettings: { mvuDoctorProfilesV1: { enabled: true, recallEnabled: true } },
    event_types: { GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended', MESSAGE_SWIPED: 'message_swiped', CHAT_CHANGED: 'chat_changed', CHAT_LOADED: 'chat_loaded', MESSAGE_EDITED: 'message_edited', MESSAGE_DELETED: 'message_deleted', GENERATION_STOPPED: 'generation_stopped' },
    eventSource: { on(name, fn) { handlers.set(name, fn); }, removeListener() {} },
    setExtensionPrompt(key, text) { calls.push({ key, text }); },
  };
  const calls = [];
  let scope = { chatId: 'chat-a' };
  const host = {
    context: () => context, scope: () => scope, latestIndex: () => 0,
    branches: async () => [{ index: 0, scopeKey: scope.chatId === 'chat-a' ? 'scope-a' : 'scope-b', lineage: scope.chatId === 'chat-a' ? 'line-a' : 'line-b' }],
    messageText: row => String(row?.mes || ''),
    doctor: () => ({ subscribe(_id, fn) { subscriber = fn; return () => {}; } }),
    assertReceipt: async () => {}, inputFor: async () => ({}), callModel: async () => '', settings: () => ({ globalPrompt: '' }),
  };
  let subscriber = null;
  async function emit(name, ...args) { const fn = handlers.get(name); if (fn) await fn(...args); }
  return { context, calls, host, emit, getSubscriber: () => subscriber, setScope(value) { scope = value; } };
}
function saved() { return { status: 'complete', lineage: 'line-a', profiles: [{ profileId: 'p1', rowId: 'r1', name: 'NPC', presence: 'present', lastSeenIndex: 0, aliases: [], identity: { species: '人', gender: '女', age: '30', occupation: '医师', affiliation: '港区', socialPosition: '居民' }, appearance: { overall: '短发', body: '修长', face: '清秀', hair: '黑发', voice: '低沉', physiology: '健康', outfit: '外套' }, personality: { temperament: '沉着', coreDesire: '救人', values: '守信', thinking: '分析', attachment: '谨慎', socialMotive: '互助', interest: '资源', hobbies: '读书', conflict: '协商', stress: '沉默', moralBoundary: '不伤无辜', expression: '简洁', actionHabit: '先观察', weakness: '自责', humor: '冷幽默', biases: '不信陌生人' }, history: '曾在港区工作', currentState: { location: '港区', condition: '良好', emotion: '平静', goal: '寻找线索', presence: 'present' }, relationships: ['与邻里合作'], knowledge: ['港区路线'], capabilities: ['急救'], resources: ['药箱'], evidence: ['正文'], inferences: ['补全'], uncertainties: ['未知敌意'] }], tasks: [] }; }

test('eligible current branch profile is actually injected during baseline recall', async () => {
  const h = harness(); const seen = [];
  const store = { latest: async branches => { seen.push(branches); return saved(); } };
  const runtime = createProfileRuntime({ host: h.host, store }); const binding = runtime.bind();
  await h.emit('generation_started', 'normal', {}, false);
  assert.ok(h.calls.some(call => call.text.includes('医生人物资料') && call.text.includes('NPC')));
  assert.ok(seen.some(branches => branches.some(branch => branch.scopeKey === 'scope-a' && branch.lineage === 'line-a')));
  await h.emit('generation_ended'); await binding;
});

test('delayed recall from an old chat cannot inject after scope change', async () => {
  const h = harness(); let release; const pending = new Promise(resolve => { release = resolve; });
  const store = { latest: async () => { await pending; return saved(); } };
  const runtime = createProfileRuntime({ host: h.host, store }); const binding = runtime.bind();
  const started = h.emit('generation_started', 'normal', {}, false);
  h.setScope({ chatId: 'chat-b' }); await h.emit('chat_changed'); release(); await started; await binding;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.some(call => call.text.includes('医生人物资料')), false);
});

test('swipe replacement cancels recall for the replaced generation', async () => {
  const h = harness(); let release; const pending = new Promise(resolve => { release = resolve; });
  const store = { latest: async () => { await pending; return saved(); } };
  const runtime = createProfileRuntime({ host: h.host, store }); const binding = runtime.bind();
  const started = h.emit('generation_started', 'regenerate', {}, false);
  await h.emit('message_swiped'); release(); await started; await binding;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.some(call => call.text.includes('医生人物资料')), false);
});

async function receiptHarness() {
  const h = harness(), ctx = h.context;
  Object.assign(ctx, { chatId: 'chat-a', characterId: 0, characters: [{ avatar: 'synthetic.png' }],
    chat: [{ mes: 'NPC站在门边。' }, { is_user: true, mes: '等候回应。' }, { mes: 'NPC打开房门。' }] });
  const base = createHost(() => ctx);
  const branches = createProfileHost(base).branches;
  Object.assign(h.host, base, { branches });
  let rejected = false;
  h.host.assertReceipt = async receipt => {
    base.assertTarget(receipt.target);
    if (rejected) throw Object.assign(new Error('not settled'), { code: 'variables_not_ready' });
  };
  h.host.inputFor = async (receipt, profiles) => ({ narrative: receipt.target.content,
    userText: receipt.target.userText, mvu: {}, players: [], profiles,
    authority: { card: '合成角色', world: '合成背景' } });
  // These controlled calls exercise receipt/record plumbing, not model quality.
  h.host.callModel = async () => JSON.stringify({ people: [], noCharacterReason: '本次没有需要更新的档案' });
  const records = new Map(), initial = (await branches())[0];
  records.set(initial.lineage, { ...saved(), ...initial, revision: 1 });
  const store = {
    async read(branch) { return structuredClone(records.get(branch.lineage) || null); },
    async latest(values) {
      for (const branch of [...values].reverse()) {
        const value = records.get(branch.lineage);
        if (value && value.scopeKey === branch.scopeKey) return structuredClone(value);
      }
      return null;
    },
    async commit(branch, next, revision, assertCurrent) {
      await assertCurrent();
      assert.equal(records.get(branch.lineage)?.revision || 0, revision);
      const value = structuredClone({ ...next, ...branch, revision: revision + 1 });
      records.set(branch.lineage, value); return structuredClone(value);
    },
  };
  const runtime = createProfileRuntime({ host: h.host, store });
  await runtime.bind();
  return { ...h, runtime, setRejected(value) { rejected = value; },
    prompt: () => h.calls.at(-1)?.text || '',
    async receipt() {
      const target = await base.capture();
      return { target, identity: target.identity, afterHash: 'synthetic-mvu', readback: true };
    },
    append() { ctx.chat.push({ is_user: true, mes: '走进门内。' }, { mes: 'NPC让开门口。' }); },
  };
}

test('auxiliary END preserves the main prompt; only a validated P1 receipt settles recall once', async () => {
  const h = await receiptHarness();
  await h.emit('generation_started', 'normal');
  const prompt = h.prompt();
  assert.ok(prompt.includes('【医生人物资料】'));
  await h.emit('generation_ended'); await h.emit('generation_ended');
  assert.equal(h.prompt(), prompt);
  h.append();
  await h.emit('chat_completion_prompt_ready', { messages: [{ content: prompt }] });
  await h.emit('message_received', 4, 'normal'); await h.emit('generation_ended');
  assert.equal(h.prompt(), prompt);
  const receipt = await h.receipt();
  await h.getSubscriber()(receipt);
  assert.equal(h.runtime.snapshot().status, 'complete');
  assert.equal(h.prompt(), '');
  const recalled = h.runtime.review().previousRecall;
  assert.equal(recalled.targetIdentity, receipt.identity);
  assert.equal(recalled.scopeKey, receipt.target.scopeKey);
  assert.equal(recalled.promptObserved, true);
  assert.equal(recalled.semanticConsumptionProven, false);
  assert.equal(recalled.text, undefined);
  const calls = h.calls.length;
  await h.getSubscriber()(receipt); await h.emit('generation_ended');
  assert.equal(h.calls.length, calls);
  assert.deepEqual(h.runtime.review().previousRecall, recalled);
});

test('failed P1 receipt retains recall for the existing retry without fabricating prompt observation', async () => {
  const h = await receiptHarness();
  await h.emit('generation_started', 'normal'); const prompt = h.prompt(); h.append();
  const receipt = await h.receipt(); h.setRejected(true);
  await h.getSubscriber()(receipt);
  assert.equal(h.prompt(), prompt);
  assert.equal(h.runtime.review(), null);
  h.setRejected(false); await h.getSubscriber()(receipt);
  assert.equal(h.prompt(), '');
  assert.equal(h.runtime.review().previousRecall.promptObserved, false);
  assert.equal(h.runtime.review().previousRecall.targetIdentity, receipt.identity);
});

test('normal generation cannot settle recall against its old baseline receipt', async () => {
  const h = await receiptHarness();
  await h.emit('generation_started', 'normal'); const prompt = h.prompt();
  await h.getSubscriber()(await h.receipt());
  assert.equal(h.prompt(), prompt);
  assert.equal(h.runtime.review().previousRecall, null);
  h.append(); await h.getSubscriber()(await h.receipt());
  assert.equal(h.prompt(), '');
  assert.ok(h.runtime.review().previousRecall?.targetIdentity);
});

test('regenerate keeps its one native deletion and binds the replacement receipt', async () => {
  const h = await receiptHarness();
  await h.emit('generation_started', 'regenerate'); const prompt = h.prompt();
  h.context.chat.length = 2; await h.emit('message_deleted', 2);
  await h.emit('generation_ended');
  assert.equal(h.prompt(), prompt);
  h.context.chat.push({ mes: 'NPC走向窗边。' });
  const receipt = await h.receipt(); await h.getSubscriber()(receipt);
  assert.equal(h.prompt(), '');
  assert.equal(h.runtime.review().previousRecall.targetIdentity, receipt.identity);
});

test('continue and swipe bind the same floor as the frozen P1 receipt', async () => {
  for (const type of ['continue', 'swipe']) {
    const h = await receiptHarness();
    await h.emit('generation_started', type);
    h.context.chat[2] = { mes: 'NPC站在窗边。', swipe_id: type === 'swipe' ? 1 : 0 };
    const receipt = await h.receipt(); await h.getSubscriber()(receipt);
    assert.equal(h.runtime.review().previousRecall.targetIdentity, receipt.identity, type);
    assert.equal(h.prompt(), '', type);
  }
});

test('stopped or replaced generations cannot attach their recall to a later valid receipt', async () => {
  for (const event of ['generation_stopped', 'message_swiped', 'message_edited', 'chat_changed', 'chat_loaded', 'message_deleted']) {
    const h = await receiptHarness();
    await h.emit('generation_started', 'normal');
    await h.emit(event, 0); h.append();
    await h.getSubscriber()(await h.receipt());
    assert.equal(h.prompt(), '', event);
    assert.equal(h.runtime.review().previousRecall, null, event);
  }
});

test('settled recall metadata cannot cross a body identity or a chat scope', async () => {
  for (const change of ['body', 'scope']) {
    const h = await receiptHarness();
    await h.emit('generation_started', 'normal'); h.append();
    await h.getSubscriber()(await h.receipt());
    assert.ok(h.runtime.review().previousRecall);
    if (change === 'body') h.context.chat[4].mes = 'NPC转身走开。';
    else h.context.chatId = 'chat-b';
    await h.getSubscriber()(await h.receipt());
    assert.equal(h.runtime.review().previousRecall, null, change);
  }
});
