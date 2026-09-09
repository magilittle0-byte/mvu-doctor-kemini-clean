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
