import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileRuntime } from '../profiles/runtime.mjs';

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
