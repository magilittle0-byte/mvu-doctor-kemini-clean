import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate as nextTick } from 'node:timers/promises';
import { createGuideHost } from '../guide/host.mjs';
import { createGuideRuntime } from '../guide/runtime.mjs';
import { clone, fault } from '../guide/store.mjs';

// Synthetic disk and model transport. Real host capture/readback and guide
// evolve/reveal run here, but these checks are not real Tavern acceptance.
const events = ['GENERATION_STARTED', 'MESSAGE_RECEIVED', 'GENERATION_ENDED', 'GENERATION_STOPPED',
  'CHAT_COMPLETION_SETTINGS_READY', 'WORLD_INFO_ACTIVATED', 'MESSAGE_SENT', 'MESSAGE_SWIPED',
  'MESSAGE_EDITED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'CHAT_LOADED'];
async function until(check, label = 'save state') {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await nextTick();
  }
}
const noChange = input => ({ sourceRevision: input.sourceRevision, upserts: [], closures: [],
  adoptionChecks: [], conflicts: [], summary: 'Synthetic unchanged result.' });
function fixture({ response = noChange } = {}) {
  const eventSource = new EventEmitter(), prompts = new Map(), records = new Map();
  const calls = [], probes = [], delays = [], commits = [];
  let readMode = 'disk', saves = 0;
  const context = { eventSource, event_types: Object.fromEntries(events.map(name => [name, name])),
    chatId: 'save-fixture', characterId: 0, characters: [{ name: 'Synthetic', avatar: 'synthetic.png', data: {} }],
    chat: [{ is_user: true, name: 'Player', mes: '抵达工坊' }, { is_user: false, mes: '工匠正在柜台后等候。' }],
    extensionSettings: {}, chatMetadata: {}, name1: 'Player', saveSettingsDebounced() {},
    getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    getCharacterCardFields: () => ({ description: '合成世界设定。' }),
    saveChat() { saves++; throw new Error('Runtime must never save host chat.'); },
    setExtensionPrompt(key, value) { prompts.set(key, value); } };
  let disk = clone(context.chat);
  const native = createGuideHost({ getContext: () => context,
    getDocument: () => ({ body: { dataset: { generating: 'false' } } }),
    fetchImpl: async (url, options) => {
      assert.equal(url, '/api/chats/get'); assert.equal(options.cache, 'no-store');
      probes.push({ mode: readMode, rows: disk.length });
      if (readMode === 'transport') throw new Error('Synthetic read failure');
      return { ok: true, json: async () => readMode === 'format' ? { invalid: true } : clone(disk) };
    } });
  const host = { ...native,
    delay: async milliseconds => { delays.push(milliseconds); await nextTick(); },
    requestFingerprint: async () => 'synthetic-route',
    request: async (messages, options) => {
      const [label, json] = messages.at(-1).content.split('\n');
      assert.equal(label, '【指导只读来源 JSON】');
      const input = JSON.parse(json); calls.push({ input: clone(input), options });
      return JSON.stringify(response(input));
    } };
  const key = (scope, branch) => JSON.stringify([scope, branch]);
  const store = { read: async (scope, branch) => clone(records.get(key(scope, branch)) || null),
    async commit({ scopeKey, branchKey, expectedRevision, record, assertCurrent }) {
      assertCurrent();
      if ((records.get(key(scopeKey, branchKey))?.revision || 0) !== expectedRevision)
        throw fault('guide_revision_changed', 'Synthetic competing revision');
      const saved = clone({ ...record, schemaVersion: 1, scopeKey, branchKey, revision: expectedRevision + 1 });
      records.set(key(scopeKey, branchKey), saved); commits.push(saved); assertCurrent(); return clone(saved);
    } };
  const runtime = createGuideRuntime({ host, store });
  async function bind() {
    const target = await host.capture();
    records.set(key(target.scopeKey, target.lineage), {
      scopeKey: target.scopeKey, branchKey: target.lineage, revision: 1,
      target: { identity: target.identity, index: target.index, lineage: target.lineage }, baselineIndex: -1,
      snapshot: { revision: 1, matters: [{ id: 'shield', title: '修盾', subjects: ['盾牌', '工匠'],
        process: '等候交还', status: 'active', history: [],
        facts: [{ id: 'repaired', text: '盾牌已经修好', basis: ['合成设定'], knownTo: ['工匠'] }], conditions: [],
        exposure: [{ id: 'handover', readiness: 'ready', route: '工匠当面交还', when: '见面时',
          visible: '工匠递来修好的盾牌', factIds: ['repaired'], conditionIds: [], status: 'pending' }] }] },
    });
    await runtime.bind();
  }
  function begin(user = '看看盾牌') {
    eventSource.emit('GENERATION_STARTED', 'normal');
    const index = context.chat.push({ is_user: true, name: 'Player', mes: user }) - 1;
    eventSource.emit('MESSAGE_SENT', index);
  }
  function observe(entries = [{ uid: 'rule', content: '合成规则：铁盾可用工具修复。' }]) {
    eventSource.emit('WORLD_INFO_ACTIVATED', entries);
    eventSource.emit('CHAT_COMPLETION_SETTINGS_READY', { type: 'normal',
      messages: [{ role: 'system', content: [...prompts.values()].find(Boolean) || '' }] });
  }
  function complete(content = '工匠递来修好的盾牌。') {
    const index = context.chat.push({ is_user: false, mes: content }) - 1;
    eventSource.emit('MESSAGE_RECEIVED', index, 'normal');
    eventSource.emit('GENERATION_ENDED');
    return index;
  }
  async function settled() {
    await until(() => runtime.snapshot().status === 'settled' && !runtime.snapshot().busy, 'settled guidance');
  }
  return { context, host, runtime, calls, probes, delays, commits, bind, begin, observe, complete, settled,
    saveNaturally: () => { disk = clone(context.chat); }, setMode: mode => { readMode = mode; }, saves: () => saves };
}

test('delayed natural save is conditionally rechecked without model calls or a fixed attempt cutoff', async () => {
  const h = fixture();
  try {
    await h.bind(); h.begin(); h.observe(); h.complete();
    await until(() => h.probes.length >= 9);
    assert.equal(h.runtime.snapshot().status, 'accepting');
    assert.equal(h.runtime.snapshot().acceptedCount, 0);
    assert.equal(h.calls.length, 0); assert.equal(h.commits.length, 0); assert.equal(h.saves(), 0);
    assert.deepEqual(h.delays.slice(0, 5), [500, 150, 250, 500, 1000]);
    assert.ok(h.delays.slice(4).every(value => value === 1000));
    h.saveNaturally(); await h.settled();
    assert.equal(h.runtime.snapshot().acceptedCount, 1);
    assert.equal(h.calls.length, 1); assert.equal(h.commits.length, 1); assert.equal(h.saves(), 0);
  } finally { h.runtime.destroy(); }
});

test('next body supersedes save waiting and later full-prefix proof retains the earlier observed provision', async () => {
  const h = fixture({ response: input => ({ ...noChange(input), adoptionChecks: [{ matterId: 'shield',
    exposureId: 'handover', targetIdentity: input.newlyAccepted[0].identity, status: 'shown',
    evidence: '工匠递来修好的盾牌', reason: '合成前一段正文明确发生交还。' }] }) });
  try {
    await h.bind(); h.begin(); h.observe(); h.complete();
    await until(() => h.probes.length >= 2);
    assert.equal(h.runtime.snapshot().acceptedCount, 0);
    h.begin('离开工坊');
    assert.equal(h.runtime.snapshot().latestApplied, false);
    h.observe(); h.complete('队伍走出工坊。');
    h.saveNaturally(); await h.settled();
    assert.equal(h.calls.length, 1); assert.equal(h.commits.length, 1);
    assert.equal(h.runtime.snapshot().acceptedCount, 1);
    const input = h.calls[0].input;
    assert.deepEqual(input.newlyAccepted.map(row => row.content), ['工匠递来修好的盾牌。', '队伍走出工坊。']);
    assert.equal(input.priorDelivery.receipts.length, 2);
    assert.ok(input.priorDelivery.receipts.every(receipt => receipt.promptObserved === true));
    assert.deepEqual(input.priorDelivery.receipts.map(receipt => receipt.targetIdentity), input.newlyAccepted.map(row => row.identity));
    assert.ok(input.priorDelivery.receipts.every(receipt => !Object.hasOwn(receipt, 'scopeKey') && !Object.hasOwn(receipt, 'lineage')));
    assert.equal(h.runtime.record().snapshot.matters[0].exposure[0].status, 'shown');
  } finally { h.runtime.destroy(); }
});

test('hard read failures do not loop and repeated explicit retry retains exact-target world and provision observations', async () => {
  const h = fixture(), entries = [{ uid: 'frozen', content: '合成规则：背包内时间冻结。' }];
  try {
    await h.bind(); h.begin(); h.observe(entries); h.setMode('transport'); h.complete();
    await until(() => h.runtime.snapshot().status === 'failed');
    assert.equal(h.runtime.snapshot().code, 'host_readback_transport');
    assert.equal(h.probes.length, 1); assert.equal(h.calls.length, 0); assert.equal(h.runtime.snapshot().acceptedCount, 0);
    h.setMode('format'); await h.runtime.retry();
    assert.equal(h.runtime.snapshot().code, 'host_readback_format');
    assert.equal(h.probes.length, 2); assert.equal(h.calls.length, 0);
    h.setMode('disk'); h.saveNaturally(); await h.runtime.retry(); await h.settled();
    assert.equal(h.calls.length, 1); assert.equal(h.saves(), 0);
    assert.deepEqual(h.runtime.record().worldObservation, { observed: true, activatedEntries: entries });
    assert.equal(h.calls[0].input.material.authority.world, entries[0].content);
    assert.equal(h.calls[0].input.priorDelivery.receipts[0].promptObserved, true);
    assert.deepEqual(h.calls[0].input.priorDelivery.receipts[0].exposureIds, ['handover']);
  } finally { h.runtime.destroy(); }
});

test('same identity on an edited prefix cannot reuse an earlier in-memory provision', async () => {
  const h = fixture();
  try {
    await h.bind(); h.begin(); h.observe(); const oldIndex = h.complete();
    await until(() => h.probes.length >= 2);
    const old = await h.host.capture(oldIndex);
    h.context.chat[0].mes = '此前分支已改变';
    const changed = await h.host.capture(oldIndex);
    assert.equal(changed.identity, old.identity); assert.notEqual(changed.lineage, old.lineage);
    h.begin('继续走'); h.observe(); h.complete('队伍继续沿街走。'); h.saveNaturally(); await h.settled();
    const receipts = h.calls[0].input.priorDelivery.receipts;
    assert.equal(receipts.some(receipt => receipt.targetIdentity === old.identity), false);
    assert.equal(h.calls.length, 1); assert.equal(h.saves(), 0);
  } finally { h.runtime.destroy(); }
});
