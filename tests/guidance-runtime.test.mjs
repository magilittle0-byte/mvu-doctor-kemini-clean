import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate as nextTick } from 'node:timers/promises';
import { createGuideRuntime } from '../guide/runtime.mjs';
import { createGuideHost } from '../guide/host.mjs';
import { clone, fault } from '../guide/store.mjs';

// Offline scheduler checks: real host identity/branch code and real evolve/reveal,
// with synthetic model text, in-memory storage and no network or live Tavern.
const events = ['GENERATION_STARTED', 'MESSAGE_RECEIVED', 'GENERATION_ENDED', 'GENERATION_STOPPED',
  'CHAT_COMPLETION_PROMPT_READY', 'WORLD_INFO_ACTIVATED', 'MESSAGE_SENT', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'CHAT_LOADED'];
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
async function until(check, label = 'scheduler state') {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await nextTick();
  }
}
const noChange = input => ({ sourceRevision: input.sourceRevision, upserts: [], closures: [], adoptionChecks: [], conflicts: [], summary: 'Synthetic unchanged result.' });
function matter() {
  return { id: 'shield', title: '修盾', subjects: ['盾牌', '工匠'], process: '等待交还', status: 'active', history: [],
    facts: [{ id: 'shield-repaired', text: '工匠已经修好了盾牌', basis: ['合成测试设定'], knownTo: ['工匠'] }], conditions: [],
    exposure: [{ id: 'shield-delivery', readiness: 'ready', route: '工匠亲手交还', when: '交接时', visible: '工匠递来修好的盾牌',
      factIds: ['shield-repaired'], conditionIds: [], status: 'pending' }] };
}
function memoryStore() {
  const records = new Map(), commits = [];
  const key = (scopeKey, branchKey) => JSON.stringify([scopeKey, branchKey]);
  return { records, commits,
    read: async (scopeKey, branchKey) => clone(records.get(key(scopeKey, branchKey)) || null),
    seed: record => records.set(key(record.scopeKey, record.branchKey), clone(record)),
    async commit({ scopeKey, branchKey, expectedRevision, record, assertCurrent }) {
      await assertCurrent();
      if ((records.get(key(scopeKey, branchKey))?.revision || 0) !== expectedRevision) throw fault('guide_revision_changed', 'Synthetic competing revision');
      const saved = clone({ ...record, schemaVersion: 1, scopeKey, branchKey, revision: expectedRevision + 1 });
      records.set(key(scopeKey, branchKey), saved); commits.push(clone(saved));
      await assertCurrent();
      return clone(saved);
    },
  };
}
function harness({ response = noChange, gates = [], store = memoryStore() } = {}) {
  const eventSource = new EventEmitter(), prompts = new Map(), notifications = [], calls = [];
  const context = { eventSource, event_types: Object.fromEntries(events.map(name => [name, name])),
    chatId: 'synthetic-chat', characterId: 0, characters: [{ name: 'Synthetic NPC', avatar: 'synthetic.png', data: {} }],
    chat: [{ is_user: true, name: 'Player', mes: '抵达工坊' }, { is_user: false, name: 'Narrator', mes: '工匠在柜台后等待。' }],
    extensionSettings: {}, chatMetadata: {}, saveSettingsDebounced() {},
    setExtensionPrompt(key, value) { prompts.set(key, value); } };
  const native = createGuideHost({ getContext: () => context, getDocument: () => ({ body: { dataset: { generating: 'false' } } }) });
  let inFlight = 0, maxInFlight = 0;
  const host = { ...native, delay: async () => nextTick(), readback: async target => native.assertTarget(target),
    material: async () => ({ authority: { card: 'Synthetic local card.', world: 'Synthetic local rules.' }, players: ['Player'] }),
    requestFingerprint: async () => 'synthetic-route',
    request: async (messages, options) => {
      const [label, sourceJson] = messages.at(-1).content.split('\n');
      assert.equal(label, '【指导只读来源 JSON】');
      const input = JSON.parse(sourceJson), index = calls.length;
      calls.push({ input: clone(input), options });
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        if (gates[index]) await gates[index].promise; // Deliberately models transport that settles after abort.
        return JSON.stringify(await response(input, index));
      } finally { inFlight--; }
    } };
  const runtime = createGuideRuntime({ host, store, notify: state => notifications.push(clone(state)) });
  async function seed({ before = { matters: [], revision: 0 }, snapshot = { matters: [matter()], revision: 1 } } = {}) {
    const target = await host.capture();
    const record = { schemaVersion: 1, scopeKey: target.scopeKey, branchKey: target.lineage, revision: 1,
      target: { identity: target.identity, index: target.index, lineage: target.lineage }, baselineIndex: -1,
      beforeSnapshot: before, snapshot, coveredReplyKeys: [target.identity] };
    store.seed(record); return clone(record);
  }
  function begin(user = '看看盾牌') {
    eventSource.emit('GENERATION_STARTED', 'normal');
    const index = context.chat.push({ is_user: true, name: 'Player', mes: user }) - 1;
    eventSource.emit('MESSAGE_SENT', index);
  }
  function complete(content, duplicates = false) {
    const index = context.chat.push({ is_user: false, name: 'Narrator', mes: content }) - 1;
    eventSource.emit('MESSAGE_RECEIVED', index, 'normal');
    eventSource.emit('GENERATION_ENDED');
    if (duplicates) { eventSource.emit('MESSAGE_RECEIVED', index, 'normal'); eventSource.emit('GENERATION_ENDED'); }
    return index;
  }
  const prompt = () => [...prompts.values()].find(Boolean) || '';
  const observePrompt = () => eventSource.emit('CHAT_COMPLETION_PROMPT_READY', { chat: [{ role: 'system', content: prompt() }], dryRun: false });
  const settle = async () => {
    await until(() => !runtime.snapshot().busy && ['settled', 'conflict', 'failed'].includes(runtime.snapshot().status), 'completed guidance');
    assert.equal(runtime.snapshot().status, 'settled', runtime.snapshot().code);
  };
  return { host, context, eventSource, store, runtime, notifications, calls, seed, begin, complete, prompt, observePrompt, settle,
    maxInFlight: () => maxInFlight };
}

test('accepted B follows busy A automatically without a third user message or concurrent calls', async () => {
  const gate = deferred(), h = harness({ gates: [gate] });
  try {
    await h.seed(); await h.runtime.bind();
    h.begin('A 用户输入'); h.complete('A 正文已经接受。');
    await until(() => h.calls.length === 1, 'A request');
    h.begin('B 用户输入'); h.complete('B 正文已经接受。');
    await until(() => h.runtime.snapshot().acceptedCount === 2 && h.runtime.snapshot().pending, 'queued B');
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].options.signal.aborted, true);
    gate.resolve();
    await until(() => h.calls.length === 2, 'automatic B continuation'); await h.settle();
    assert.equal(h.maxInFlight(), 1);
    assert.equal(h.store.commits.length, 1);
    assert.deepEqual(h.calls[1].input.newlyAccepted.map(row => row.content), ['A 正文已经接受。', 'B 正文已经接受。']);
    assert.equal(h.runtime.record().coveredReplyKeys.length, 2);
    assert.equal(h.runtime.record().target.index, 5);
  } finally { gate.resolve(); h.runtime.destroy(); }
});

test('replacing queued B with C retains all accepted A B C bodies in the next batch', async () => {
  const gate = deferred(), h = harness({ gates: [gate] });
  try {
    await h.seed(); await h.runtime.bind();
    h.begin(); h.complete('A 中间变化。'); await until(() => h.calls.length === 1);
    h.begin(); h.complete('B 中间变化。'); await until(() => h.runtime.snapshot().acceptedCount === 2);
    h.begin(); h.complete('C 最新变化。'); await until(() => h.runtime.snapshot().acceptedCount === 3);
    gate.resolve(); await until(() => h.calls.length === 2); await h.settle();
    assert.deepEqual(h.calls[1].input.newlyAccepted.map(row => row.content), ['A 中间变化。', 'B 中间变化。', 'C 最新变化。']);
    assert.equal(h.calls.length, 2);
    assert.equal(h.maxInFlight(), 1);
    assert.equal(h.store.commits.length, 1);
    assert.equal(h.runtime.record().coveredReplyKeys.length, 3);
  } finally { gate.resolve(); h.runtime.destroy(); }
});

test('duplicate receive and end events neither accept twice nor repeat the request', async () => {
  const h = harness();
  try {
    await h.seed(); await h.runtime.bind();
    h.begin(); const index = h.complete('唯一一次正文。', true); await h.settle();
    h.eventSource.emit('MESSAGE_RECEIVED', index, 'normal'); h.eventSource.emit('GENERATION_ENDED');
    h.eventSource.emit('MESSAGE_RECEIVED', index, 'normal'); h.eventSource.emit('GENERATION_ENDED');
    await nextTick();
    assert.equal(h.calls.length, 1);
    assert.equal(h.runtime.snapshot().acceptedCount, 1);
    assert.equal(h.store.commits.length, 1);
  } finally { h.runtime.destroy(); }
});

test('initial restore and repeated refresh read saved records without model calls or writes', async () => {
  const h = harness();
  try {
    const seeded = await h.seed(); await h.runtime.bind();
    await h.runtime.restore(); await h.runtime.restore();
    assert.deepEqual(h.runtime.record(), seeded);
    assert.equal(h.calls.length, 0);
    assert.equal(h.store.commits.length, 0);
    h.context.chatId = 'another-synthetic-chat';
    await h.runtime.restore();
    assert.equal(h.runtime.record(), null);
    assert.equal(h.calls.length, 0);
    assert.equal(h.store.records.size, 1);
  } finally { h.runtime.destroy(); }
});

test('editing an earlier branch invalidates an in-flight result without saving it', async () => {
  const gate = deferred(), h = harness({ gates: [gate] });
  try {
    const seeded = await h.seed(); await h.runtime.bind();
    h.begin(); h.complete('旧分支候选。'); await until(() => h.calls.length === 1);
    h.context.chat[0].mes = '前文已被编辑，进入另一条分支';
    h.eventSource.emit('MESSAGE_EDITED', 0);
    gate.resolve(); await until(() => !h.runtime.snapshot().busy && h.runtime.snapshot().status !== 'loading');
    assert.equal(h.store.commits.length, 0);
    assert.equal(h.runtime.record(), null);
    assert.deepEqual(await h.store.read(seeded.scopeKey, seeded.branchKey), seeded);
    assert.equal(h.calls.length, 1);
  } finally { gate.resolve(); h.runtime.destroy(); }
});

test('promptReady records only provision and does not consume an exposure or call a model', async () => {
  const h = harness();
  try {
    const seeded = await h.seed(); await h.runtime.bind(); h.begin();
    assert.match(h.prompt(), /shield-delivery/u);
    h.observePrompt(); h.observePrompt();
    assert.equal(h.runtime.snapshot().delivery, 'provided');
    assert.equal(h.runtime.record().snapshot.matters[0].exposure[0].status, 'pending');
    assert.deepEqual(await h.store.read(seeded.scopeKey, seeded.branchKey), seeded);
    assert.equal(h.calls.length, 0);
    assert.equal(h.store.commits.length, 0);
  } finally { h.runtime.destroy(); }
});

for (const auxiliaryEnd of [false, true]) {
test(`native START ${auxiliaryEnd ? 'then auxiliary END ' : ''}then MESSAGE_SENT replaces previous-input selection before the main prompt`, async () => {
  const h = harness();
  const conditional = (id, subject) => ({ id, title: subject, subjects: [subject], process: '等待接触', status: 'active', history: [],
    facts: [], conditions: [{ id: `${id}-condition`, when: `实际到达${subject}`, change: '可以看见当地告示', basis: ['合成测试设定'] }],
    exposure: [{ id: `${id}-exposure`, readiness: 'conditional', route: '当面可见', when: `实际到达${subject}`, visible: '门旁挂着告示',
      factIds: [], conditionIds: [`${id}-condition`], status: 'pending' }] });
  try {
    h.context.chat[0].mes = '先去旧港口';
    await h.seed({ snapshot: { revision: 1, matters: [conditional('old', '旧港口'), conditional('new', '新酒馆')] } });
    await h.runtime.bind();
    h.eventSource.emit('GENERATION_STARTED', 'normal');
    if (auxiliaryEnd) h.eventSource.emit('GENERATION_ENDED');
    assert.match(h.prompt(), /old-exposure/u);
    assert.doesNotMatch(h.prompt(), /new-exposure/u);
    const index = h.context.chat.push({ is_user: true, name: 'Player', mes: '改去新酒馆' }) - 1;
    h.eventSource.emit('MESSAGE_SENT', index);
    assert.match(h.prompt(), /new-exposure/u);
    assert.doesNotMatch(h.prompt(), /old-exposure/u);
    assert.equal(h.calls.length, 0);
    assert.equal(h.store.commits.length, 0);
    h.observePrompt();
    // A duplicate after prompt assembly must not erase the observed receipt.
    h.eventSource.emit('MESSAGE_SENT', index);
    h.eventSource.emit('MESSAGE_SENT', 0);
    h.complete('队伍停在原地讨论路线。'); await h.settle();
    assert.equal(h.calls.length, 1);
    const receipt = h.calls[0].input.priorDelivery.receipts[0];
    assert.equal(receipt.promptObserved, true);
    assert.deepEqual(receipt.providedIds, ['new']);
    assert.deepEqual(receipt.exposureIds, ['new-exposure']);
  } finally { h.runtime.destroy(); }
});
}

test('a later accepted body can bind observed provision and record actual exposure with real evolve', async () => {
  const h = harness({ response: input => ({ ...noChange(input), adoptionChecks: [{ matterId: 'shield', exposureId: 'shield-delivery',
    targetIdentity: input.target.identity, status: 'shown', evidence: '工匠递来修好的盾牌', reason: '合成正文明确发生交还。' }] }) });
  try {
    await h.seed(); await h.runtime.bind(); h.begin(); h.observePrompt();
    h.complete('工匠递来修好的盾牌。'); await h.settle();
    assert.equal(h.calls.length, 1);
    assert.equal(h.runtime.record().snapshot.matters[0].exposure[0].status, 'shown');
    assert.equal(h.runtime.record().adoption[0].targetIdentity, h.runtime.record().target.identity);
  } finally { h.runtime.destroy(); }
});

test('busy merging retains A provision evidence so B can verify exposure that already occurred in A', async () => {
  const gate = deferred();
  const h = harness({ gates: [gate], response: (input, index) => index === 0 ? noChange(input) : ({ ...noChange(input),
    adoptionChecks: [{ matterId: 'shield', exposureId: 'shield-delivery', targetIdentity: input.newlyAccepted[0].identity,
      status: 'shown', evidence: '工匠递来修好的盾牌', reason: '前一段已接受正文发生交还。' }] }) });
  try {
    await h.seed(); await h.runtime.bind();
    h.begin(); h.observePrompt(); h.complete('工匠递来修好的盾牌。'); await until(() => h.calls.length === 1);
    h.begin('离开工坊'); h.observePrompt(); h.complete('队伍沿街走远。');
    await until(() => h.runtime.snapshot().acceptedCount === 2);
    gate.resolve(); await until(() => h.calls.length === 2); await h.settle();
    assert.equal(h.runtime.record().snapshot.matters[0].exposure[0].status, 'shown');
    assert.equal(h.runtime.record().adoption[0].targetIdentity, h.calls[1].input.newlyAccepted[0].identity);
    assert.equal(h.maxInFlight(), 1);
  } finally { gate.resolve(); h.runtime.destroy(); }
});

test('same-floor manual recalculation uses its fixed before snapshot rather than advancing its saved result again', async () => {
  const h = harness();
  try {
    const beforeMatter = matter(), afterMatter = matter();
    beforeMatter.process = '原始前态'; afterMatter.process = '第一次推演后的状态';
    await h.seed({ before: { matters: [beforeMatter], revision: 0 }, snapshot: { matters: [afterMatter], revision: 1 } });
    await h.runtime.bind(); await h.runtime.retry();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].input.baseline.matters[0].process, '原始前态');
    assert.equal(h.runtime.record().beforeSnapshot.matters[0].process, '原始前态');
    assert.equal(h.runtime.record().revision, 2);
  } finally { h.runtime.destroy(); }
});

test('refresh followed by manual recalculation preserves every provided receipt from the saved busy batch', async () => {
  const gate = deferred();
  const h = harness({ gates: [gate], response: (input, index) => index === 0 ? noChange(input) : ({ ...noChange(input),
    adoptionChecks: [{ matterId: 'shield', exposureId: 'shield-delivery', targetIdentity: input.newlyAccepted[0].identity,
      status: 'shown', evidence: '工匠递来修好的盾牌', reason: '同一批次的已接受正文发生交还。' }] }) });
  try {
    await h.seed(); await h.runtime.bind();
    h.begin(); h.observePrompt(); h.complete('工匠递来修好的盾牌。'); await until(() => h.calls.length === 1);
    h.begin('离开工坊'); h.observePrompt(); h.complete('队伍沿街走远。');
    await until(() => h.runtime.snapshot().acceptedCount === 2);
    gate.resolve(); await until(() => h.calls.length === 2); await h.settle();
    const original = h.runtime.record();
    await h.runtime.restore();
    assert.equal(h.calls.length, 2, 'refresh itself must remain read-only');
    await h.runtime.retry();
    assert.equal(h.runtime.snapshot().status, 'settled', h.runtime.snapshot().code);
    assert.equal(h.calls.length, 3);
    assert.equal(h.runtime.record().snapshot.matters[0].exposure[0].status, 'shown');
    assert.equal(h.runtime.record().adoption[0].targetIdentity, original.adoption[0].targetIdentity);
    assert.equal(h.runtime.record().revision, original.revision + 1);
  } finally { gate.resolve(); h.runtime.destroy(); }
});

test('destroying a runtime while a request settles does not read a disposed host or reject cleanup', async () => {
  const gate = deferred(), h = harness({ gates: [gate] });
  await h.seed(); await h.runtime.bind();
  const outcome = h.runtime.retry().then(() => null, error => error.code);
  await until(() => h.calls.length === 1);
  h.runtime.destroy(); gate.resolve();
  assert.equal(await outcome, null);
  assert.equal(h.store.commits.length, 0);
  assert.equal(h.eventSource.eventNames().length, 0);
});

for (const type of ['regenerate', 'swipe', 'continue', 'normal']) {
  test(`${type} prompt selects the fixed pre-floor state only when reusing that floor`, async () => {
    const h = harness();
    try {
      const beforeMatter = matter(), afterMatter = matter();
      beforeMatter.facts[0].text = 'FIXED_BEFORE_FACT';
      beforeMatter.exposure[0].visible = 'FIXED_BEFORE_EFFECT';
      afterMatter.facts[0].text = 'CURRENT_AFTER_FACT';
      afterMatter.exposure[0].visible = 'CURRENT_AFTER_EFFECT';
      await h.seed({ before: { matters: [beforeMatter], revision: 0 }, snapshot: { matters: [afterMatter], revision: 1 } });
      await h.runtime.bind();
      if (type === 'normal') h.begin(); else h.runtime.started(type);
      if (type !== 'normal') {
        const index = h.context.chat.push({ is_user: true, name: 'Player', mes: '独立发送事件不改变同楼前态' }) - 1;
        h.eventSource.emit('MESSAGE_SENT', index);
      }
      assert.equal(h.prompt().includes('FIXED_BEFORE_FACT'), type !== 'normal');
      assert.equal(h.prompt().includes('FIXED_BEFORE_EFFECT'), type !== 'normal');
      assert.equal(h.prompt().includes('CURRENT_AFTER_FACT'), type === 'normal');
      assert.equal(h.prompt().includes('CURRENT_AFTER_EFFECT'), type === 'normal');
      assert.equal(h.calls.length, 0);
    } finally { h.runtime.destroy(); }
  });
}

test('a delayed restore from the previous chat cannot replace the newly restored chat record', async () => {
  const gate = deferred(), started = deferred(), h = harness();
  try {
    const oldRecord = await h.seed();
    const read = h.store.read;
    let blocked = false;
    h.store.read = async (scopeKey, lineage) => {
      if (scopeKey === oldRecord.scopeKey && !blocked) {
        blocked = true; started.resolve(); await gate.promise;
      }
      return read(scopeKey, lineage);
    };
    const oldRestore = h.runtime.bind();
    await started.promise;
    h.context.chatId = 'new-synthetic-chat';
    const newRecord = await h.seed();
    await h.runtime.restore();
    assert.equal(h.runtime.record().scopeKey, newRecord.scopeKey);
    gate.resolve(); await oldRestore;
    assert.equal(h.runtime.record().scopeKey, newRecord.scopeKey);
    assert.equal(h.calls.length, 0);
    assert.equal(h.store.commits.length, 0);
  } finally { gate.resolve(); h.runtime.destroy(); }
});
