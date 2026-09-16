import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeWorldEngine } from '../world/engine.mjs';

const baseInput = {
  narrative: '正文：引导者在门外观察。',
  userText: '继续观察',
  mvu: { clock: '00:01', actors: [{ id: 'npc-1', location: '门外' }] },
  profiles: [{ profileId: 'p-1', name: 'NPC', currentState: { location: '门外' } }],
  authority: { card: 'fixture-card', world: 'fixture-world' },
};

function engineWith(callModel, options = {}) {
  return createNativeWorldEngine({
    chatId: 'fixture-chat', chatLength: 3, input: baseInput,
    callModel, rulesText: 'fixture appended rule', instruction: '仅尝试一个非玩家观察动作',
    ...options,
  });
}

test('native forward merges an event, preserves blackbox, and returns redacted debug', async () => {
  const seen = [];
  const initial = {
    round: 2,
    worldDigest: 'before',
    blackbox: { secretActions: [{ action: '旧秘密', witnesses: '无' }], secretAssets: [] },
    events: [{ id: 'event_1', name: 'old event', type: 'progress', level: 2, stage: '执行', stageRound: 1, evolveResult: '旧值' }],
    factions: [], winds: [], worldTrends: [], enemies: [], influenceChain: [],
  };
  const engine = engineWith(async (prompt) => {
    seen.push(prompt);
    return JSON.stringify({
      world_digest: 'after',
      events: [{ id: null, name: 'fixture event', type: 'progress', level: 3, stage: '执行', desc: 'observed change' }],
      blackbox: { secretActions: [{ action: '旧秘密', witnesses: '无' }, { action: '新秘密', witnesses: '仅NPC' }], secretAssets: [] },
    });
  }, { world: initial });
  const result = await engine.evolve();
  assert.equal(result.ok, true);
  assert.equal(result.state.round, 3);
  assert.equal(result.state.events.length, 2);
  assert.equal(result.state.blackbox.secretActions.length, 2);
  assert.equal(result.state.worldDigest, 'after');
  assert.equal(result.state.memories.filter(memory => memory.type === 'ledger').length, 1);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /fixture appended rule/u);
  assert.match(seen[0], /完整P2档案/u);
  assert.equal((seen[0].match(/P3完整输入/g) || []).length, 1);
  assert.equal('prompt' in result.debug, false);
  assert.equal('rawResult' in result.debug, false);
  assert.equal('evolveResult' in result.debug, false);
  assert.ok(['成功', '受挫', '保持'].includes(result.debug.localStateBeforeModel.events[0]?.evolveResult));
  assert.notEqual(result.debug.localStateBeforeModel.events[0]?.evolveResult, '旧值');
  engine.dispose();
});

test('native failure rolls state back and does not retry', async () => {
  let calls = 0;
  const engine = engineWith(async () => {
    calls += 1;
    throw new Error('fixture model failure');
  }, { world: { round: 4, worldDigest: 'stable', events: [], blackbox: { secretActions: [], secretAssets: [] } } });
  const result = await engine.evolve();
  assert.equal(result.ok, false);
  assert.equal(calls, 1);
  assert.equal(result.state.round, 4);
  assert.equal(result.state.worldDigest, 'stable');
  engine.dispose();
});

test('native request uses accepted dialogue once and keeps receipt-only text local', async () => {
  const input = {
    ...structuredClone(baseInput),
    narrative: 'FIXTURE_ACCEPTED_NARRATIVE_ONLY', userText: 'FIXTURE_ACCEPTED_USER_ONLY',
    target: { identity: 'receipt-identity', scopeKey: 'receipt-scope', index: 2,
      content: 'RAW_RECEIPT_MECHANISM_ONLY', userText: 'RAW_USER_WRAPPER_ONLY' },
    globalPrompt: 'full global instruction', heldProfiles: [{ profileId: 'held-1', reason: 'profile_incomplete' }],
  };
  const original = structuredClone(input);
  let prompt, calls = 0;
  const engine = engineWith(async value => {
    calls++; prompt = value;
    return JSON.stringify({ world_digest: 'fixture world', events: [] });
  }, { input });
  const result = await engine.evolve();
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  for (const text of [input.narrative, input.userText]) assert.equal(prompt.split(text).length - 1, 1);
  assert.ok(!prompt.includes(input.target.content));
  assert.ok(!prompt.includes(input.target.userText));
  const segments = engine.window.WORLD_ENGINE_EVOLUTION.getLastDebug().segments;
  const material = JSON.parse(segments.find(segment => segment.key === 'worldbook').content.split('\n').slice(1).join('\n'));
  for (const key of ['mvu', 'profiles', 'authority', 'globalPrompt', 'heldProfiles']) assert.deepEqual(material[key], input[key]);
  assert.deepEqual(material.target, { identity: input.target.identity, scopeKey: input.target.scopeKey, index: 2 });
  assert.equal('narrative' in material, false);
  assert.equal('userText' in material, false);
  assert.deepEqual(input, original);
  engine.dispose();
});

test('abort propagates to the one native call and releases running state', async () => {
  const controller = new AbortController();
  let calls = 0;
  const engine = engineWith((prompt, signal) => {
    calls += 1;
    return new Promise((resolve, reject) => {
      const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
  }, { signal: controller.signal });
  const pending = engine.evolve();
  controller.abort();
  const result = await pending;
  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.equal(engine.isRunning(), false);
  engine.dispose();
});

test('unserializable complete input fails before native model dispatch', () => {
  const input = {};
  input.self = input;
  assert.throws(() => createNativeWorldEngine({ input, callModel: async () => '{}' }), {
    code: 'world_input_unserializable',
  });
});
