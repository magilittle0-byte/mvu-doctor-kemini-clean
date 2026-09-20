import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileRuntime, PROFILE_VERSION, PROFILE_CALL_LIMIT } from '../profiles/runtime.mjs';
import { createProfileStore } from '../profiles/store.mjs';
import { PROFILE_FIELDS, profileTurnMessages, validateProfile, parseDiscovery, parseProfileTurn } from '../profiles/content.mjs';
import { digest } from '../modular/variables/core.mjs';

function setPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] ||= {};
  cursor[parts.at(-1)] = value;
}

function profile(id, rowId, name, suffix = '事实') {
  const result = { profileId: id, rowId, name };
  for (const field of PROFILE_FIELDS.filter(field => field.path !== 'name')) {
    setPath(result, field.path, field.type === 'list'
      ? [field.label + suffix] : field.label + suffix);
  }
  if (name === '旧人物') result.aliases = [...new Set([...result.aliases, '甲'])];
  return result;
}

function profileContent(name, suffix = '新档案') {
  const result = profile('', '', name, suffix);
  delete result.profileId;
  delete result.rowId;
  return result;
}

function person({ sourceName, evidence, existingProfileId = null, operation, profile: content, changes }) {
  return {
    sourceName, evidence, existingProfileId, presence: 'present', operation,
    ...(content ? { profile: content } : {}),
    ...(changes ? { changes } : {}),
  };
}

const updateOld = (changes = { 'currentState.emotion': '谨慎观察' }) => person({
  sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', operation: 'update', changes,
});
const unchangedOld = () => person({
  sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', operation: 'unchanged',
});
const createNew = (name = '乙', evidence = '乙站在门外') => person({
  sourceName: name, evidence, operation: 'create', profile: profileContent(name),
});
function turn(people = [], { retireProfileIds, noCharacterReason } = {}) {
  return JSON.stringify({
    people,
    ...(retireProfileIds ? { retireProfileIds } : {}),
    noCharacterReason: noCharacterReason ?? (people.length ? '' : '本轮没有需要建档的人物'),
  });
}

function memoryStore(initial = null) {
  let saved = initial ? structuredClone(initial) : null;
  const writes = [];
  return {
    writes,
    async read(branch) {
      return saved && saved.scopeKey === branch.scopeKey && saved.lineage === branch.lineage
        ? structuredClone(saved) : null;
    },
    async latest(branches) {
      if (!saved || saved.tombstone) return null;
      return branches.some(branch => branch.scopeKey === saved.scopeKey && branch.lineage === saved.lineage)
        ? structuredClone(saved) : null;
    },
    async commit(branch, next, expectedRevision, assertCurrent) {
      await assertCurrent();
      assert.equal(saved?.revision || 0, expectedRevision);
      saved = structuredClone({
        ...next, scopeKey: branch.scopeKey, lineage: branch.lineage, index: branch.index,
        revision: expectedRevision + 1,
      });
      writes.push(structuredClone(saved));
      return structuredClone(saved);
    },
    current() { return structuredClone(saved); },
  };
}

function fixture({ model, assertReceipt, store: providedStore, inputSeed: seed = {}, settings: settingsSeed = {} } = {}) {
  const branch = { index: 10, scopeKey: 'scope-a', lineage: 'lineage-a' };
  const old = profile('old-person', 'P1', '旧人物', '-旧档案');
  const store = providedStore || memoryStore({
    version: '0.1.0-candidate.1', scopeKey: branch.scopeKey, lineage: branch.lineage,
    index: 10, revision: 1, status: 'complete', profiles: [old], tasks: [],
  });
  const ctx = { extensionSettings: {}, chat: [], setExtensionPrompt() {}, eventSource: { on() {}, removeListener() {} } };
  const settingsState = { globalPrompt: '', ...settingsSeed };
  const inputSeed = {
    narrative: '甲在门内，乙站在门外。', userText: '继续', target: { index: 10 },
    mvu: {}, authority: { card: 'card-a', world: 'world-a' }, players: ['玩家'], ...seed,
  };
  const receipt = {
    identity: 'identity-a', afterHash: 'mvu-a', configHash: 'config-a', ruleHash: 'rule-a',
    schemaHash: 'schema-a', readback: true, target: { index: 10, scopeKey: branch.scopeKey },
  };
  const inputCalls = [];
  const host = {
    context: () => ctx,
    settings: () => settingsState,
    branches: async () => [branch],
    latestIndex: () => branch.index,
    messageText: row => row?.mes || '',
    doctor: () => ({
      ready: true, locked: true,
      status: () => ({ busy: false, inFlight: false, status: 'applied' }),
      record: () => receipt,
    }),
    assertReceipt: assertReceipt || (async () => {}),
    inputFor: async (_receipt, profiles, globalPrompt) => {
      inputCalls.push({ profiles: structuredClone(profiles), globalPrompt });
      return structuredClone({ ...inputSeed, globalPrompt, profiles });
    },
    callModel: model || (async () => turn([unchangedOld()])),
  };
  host.receipt = () => receipt;
  return { host, store, receipt, old, inputCalls, inputSeed, settingsState };
}

function assertOneRequest(record) {
  assert.equal(record.review.requests.length, 1);
  assert.equal(record.review.requests[0].kind, 'profile-turn');
  assert.equal(record.review.requestLimit, PROFILE_CALL_LIMIT);
  assert.equal(record.review.automaticRetries, 0);
}

test('one profile-turn isolates an invalid person and saves a valid sibling by its nested identity', async () => {
  const calls = [];
  const { host, store, receipt, old } = fixture({
    model: async (_receipt, prompt) => {
      calls.push(prompt);
      // Reverse order is deliberate: every operation and payload travels together.
      return turn([
        createNew(),
        updateOld({ 'currentState.goal': '' }),
      ]);
    },
  });
  await createProfileRuntime({ host, store }).run(receipt);
  const result = store.current();
  assert.equal(calls.length, 1);
  assert.match(calls[0].find(message => message.role === 'system').content, /一次完成/);
  assert.equal(result.status, 'partial');
  assert.equal(result.profiles.find(value => value.profileId === 'old-person').name, old.name);
  assert.ok(result.profiles.some(value => value.name === '乙'));
  assert.equal(result.tasks.find(value => value.profileId === 'old-person').status, 'failed');
  assert.equal(result.tasks.find(value => value.sourceName === '乙').status, 'complete');
  assert.equal(result.tasks.find(value => value.profileId === 'old-person').code, 'profile_incomplete');
  assert.ok(result.tasks.find(value => value.profileId === 'old-person').errors.length > 0);
  assertOneRequest(result);
});

test('profile-turn persists and sends separated system/user messages in one request', async () => {
  const calls = [];
  const { host, store, receipt } = fixture({
    model: async (_receipt, messages) => { calls.push(structuredClone(messages)); return turn([unchangedOld()]); },
  });
  await createProfileRuntime({ host, store }).run(receipt);
  const result = store.current(), request = result.review.requests[0];
  assertOneRequest(result);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].map(message => message.role), ['system', 'user']);
  assert.deepEqual(request.messages, calls[0]);
  assert.equal(request.prompt, calls[0].map(message => message.content).join('\n\n'));
  assert.equal(request.promptHash, await digest(calls[0]), 'the hash binds the actual role-preserving wire payload');
  assert.deepEqual(request.messages, profileTurnMessages(result.review.input));
});

test('an empty people list saves a complete no-character result and retains all prior profiles', async () => {
  const calls = [];
  const { host, store, receipt, old } = fixture({
    model: async (_receipt, prompt) => { calls.push(prompt); return turn([], { noCharacterReason: '本轮只有玩家，没有需要建档的人物' }); },
  });
  await createProfileRuntime({ host, store }).run(receipt);
  const result = store.current();
  assert.equal(calls.length, 1);
  assert.equal(result.status, 'complete');
  assert.equal(result.noCharacterReason, '本轮只有玩家，没有需要建档的人物');
  assert.deepEqual(result.profiles.map(value => value.profileId), [old.profileId]);
  assertOneRequest(result);
});

test('update merges name, relationships, and knowledge while retaining every omitted field', async () => {
  const { host, store, receipt } = fixture({
    model: async () => turn([updateOld({
      name: '改名人物',
      relationships: ['本轮确认的新关系'],
      knowledge: ['本轮确认的新知识'],
    })]),
  });
  const before = store.current().profiles[0];
  await createProfileRuntime({ host, store }).run(receipt);
  const result = store.current();
  const updated = result.profiles.find(value => value.profileId === 'old-person');
  assert.equal(result.status, 'complete');
  assert.equal(updated.name, '改名人物');
  assert.deepEqual(updated.relationships, ['本轮确认的新关系']);
  assert.deepEqual(updated.knowledge, ['本轮确认的新知识']);
  assert.deepEqual(updated.aliases, before.aliases);
  assert.deepEqual(updated.identity, before.identity);
  assert.deepEqual(updated.personality, before.personality);
  assert.equal(updated.history, before.history);
  assert.equal(updated.currentState.goal, before.currentState.goal);
  assert.deepEqual(validateProfile(updated, []), []);
  assertOneRequest(result);
});

test('unchanged preserves a complete old profile without fabricating an update', async () => {
  const { host, store, receipt } = fixture({ model: async () => turn([unchangedOld()]) });
  const before = store.current().profiles[0];
  await createProfileRuntime({ host, store }).run(receipt);
  const result = store.current();
  const unchanged = result.profiles.find(value => value.profileId === 'old-person');
  for (const field of PROFILE_FIELDS) assert.deepEqual(
    field.path.split('.').reduce((value, key) => value?.[key], unchanged),
    field.path.split('.').reduce((value, key) => value?.[key], before),
    'unchanged must retain ' + field.path,
  );
  assert.equal(result.tasks[0].operation, 'unchanged');
  assert.equal(result.tasks[0].status, 'complete');
  assertOneRequest(result);
});

test('unknown existing profile IDs reject the whole response without saving any candidate', async () => {
  const calls = [];
  const { host, store, receipt, old } = fixture({
    model: async () => {
      calls.push('profile-turn');
      return turn([createNew(), person({
        sourceName: '甲', evidence: '甲在门内', existingProfileId: 'not-a-real-profile',
        operation: 'update', changes: { 'currentState.emotion': '新情绪' },
      })]);
    },
  });
  await createProfileRuntime({ host, store }).run(receipt);
  const result = store.current();
  assert.deepEqual(calls, ['profile-turn']);
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.profiles.map(value => value.profileId), [old.profileId]);
  assert.equal(result.tasks.length, 0);
  assertOneRequest(result);
  assert.ok(result.review.failure);
});

test('manual retry uses prior result and task errors, performs one forced call, and keeps omitted complete profiles', async () => {
  const sentMessages = [];
  let manual = false;
  const { host, store, receipt, old } = fixture({
    model: async (_receipt, messages) => {
      sentMessages.push(messages);
      if (!manual) return turn([updateOld({ 'currentState.goal': '' }), createNew()]);
      // Correct the old item and omit the already completed new profile.
      return turn([updateOld({ 'currentState.emotion': '修复后情绪' })]);
    },
  });
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  const created = store.current().profiles.find(value => value.name === '乙');
  assert.ok(created);
  assert.equal(store.current().status, 'partial');
  assertOneRequest(store.current());

  manual = true;
  await runtime.retry();
  const result = store.current();
  assert.equal(sentMessages.length, 2);
  assert.deepEqual(sentMessages[1].map(message => message.role), ['system', 'user']);
  const retryPrompt = sentMessages[1].find(message => message.role === 'user').content;
  assert.match(retryPrompt, /previousValidResult/);
  assert.match(retryPrompt, /甲在门内/);
  assert.match(retryPrompt, /errors/);
  assert.equal(result.status, 'complete');
  assert.equal(result.reason, 'manual');
  assert.equal(result.profiles.find(value => value.profileId === old.profileId).currentState.emotion, '修复后情绪');
  assert.ok(result.profiles.some(value => value.profileId === created.profileId), 'omitted profiles remain in the draft');
  assertOneRequest(result);
  assert.deepEqual(await runtime.read(), result);
  assert.equal(runtime.snapshot().readback, true);
});

test('cancel and stale receipt stop the single response before candidate persistence', async t => {
  await t.test('cancel aborts the in-flight profile-turn', async () => {
    let enteredResolve;
    const entered = new Promise(resolve => { enteredResolve = resolve; });
    const { host, store, receipt, old } = fixture({
      model: async (_receipt, _prompt, signal) => {
        enteredResolve();
        await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
        throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
      },
    });
    const runtime = createProfileRuntime({ host, store });
    const running = runtime.run(receipt);
    await entered;
    runtime.cancel();
    await running;
    assert.deepEqual(store.current().profiles.map(value => value.profileId), [old.profileId]);
    assert.equal(runtime.snapshot().status, 'cancelled');
  });

  await t.test('stale receipt after response does not save it', async () => {
    let responseReturned = false;
    const { host, store, receipt, old } = fixture({
      model: async () => { responseReturned = true; return turn([updateOld(), createNew()]); },
      assertReceipt: async () => {
        if (responseReturned) throw Object.assign(new Error('stale'), { code: 'stale_mvu' });
      },
    });
    await createProfileRuntime({ host, store }).run(receipt);
    const result = store.current();
    assert.deepEqual(result.profiles.map(value => value.profileId), [old.profileId]);
    assert.equal(result.tasks.some(value => value.status === 'complete'), false);
    assert.equal(result.status, 'discovering');
  });
});

test('completed auto result reuses zero calls after checking full input and result hashes; manual retry forces one', async () => {
  let calls = 0;
  const { host, store, receipt, inputCalls } = fixture({
    model: async () => { calls++; return turn([unchangedOld()]); },
  });
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  const first = store.current();
  assert.equal(first.status, 'complete');
  const expectedReuseInputHash = await digest({
    version: PROFILE_VERSION,
    input: first.review.input,
    configHash: receipt.configHash,
    ruleHash: receipt.ruleHash,
    schemaHash: receipt.schemaHash,
  });
  assert.equal(first.review.reuseInputHash, expectedReuseInputHash);
  assert.equal(first.review.outputHash, await digest(first.profiles));
  assertOneRequest(first);
  const inputsAfterFirst = inputCalls.length;

  await runtime.run(receipt);
  assert.equal(calls, 1);
  assert.equal(runtime.snapshot().status, 'restored');
  assert.equal(runtime.snapshot().requestCount, 0);
  assert.equal(inputCalls.length, inputsAfterFirst + 1, 'reuse rebuilds the baseline input from fresh host state');

  await runtime.retry();
  assert.equal(calls, 2, 'manual retry bypasses complete-result reuse');
  assertOneRequest(store.current());
  assert.equal(store.current().reason, 'manual');
});

for (const [label, mutate] of [
  ['authority', ({ inputSeed }) => { inputSeed.authority.card = 'card-b'; }],
  ['global prompt', ({ settingsState }) => { settingsState.globalPrompt = 'changed global instructions'; }],
  ['config', ({ receipt }) => { receipt.configHash = 'config-b'; }],
  ['rule', ({ receipt }) => { receipt.ruleHash = 'rule-b'; }],
  ['schema', ({ receipt }) => { receipt.schemaHash = 'schema-b'; }],
]) {
  test('auto reuse invalidates when ' + label + ' changes', async () => {
    let calls = 0;
    const state = fixture({ model: async () => { calls++; return turn([unchangedOld()]); } });
    const runtime = createProfileRuntime({ host: state.host, store: state.store });
    await runtime.run(state.receipt);
    assert.equal(calls, 1);
    mutate(state);
    await runtime.run(state.receipt);
    assert.equal(calls, 2, label + ' changes must not reuse stale complete output');
    assertOneRequest(state.store.current());
  });
}

test('auto reuse rejects a complete record whose saved output hash no longer matches the full result', async () => {
  let calls = 0;
  const { host, store, receipt } = fixture({ model: async () => { calls++; return turn([unchangedOld()]); } });
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  const branch = { index: 10, scopeKey: 'scope-a', lineage: 'lineage-a' };
  const altered = store.current();
  altered.review.outputHash = 'tampered-output-hash';
  await store.commit(branch, altered, altered.revision, async () => {});
  await runtime.run(receipt);
  assert.equal(calls, 2);
  assertOneRequest(store.current());
});

test('manual retry retires only an explicitly allowlisted current-round new profile', async () => {
  let manual = false;
  let retireId = '';
  const { host, store, receipt, old } = fixture({
    model: async () => {
      if (!manual) return turn([unchangedOld(), createNew()]);
      return turn([unchangedOld()], { retireProfileIds: [retireId] });
    },
  });
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  retireId = store.current().profiles.find(value => value.name === '乙').profileId;
  assert.ok(store.current().review.newProfileIds.includes(retireId));
  manual = true;
  await runtime.retry();
  const result = store.current();
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.profiles.map(value => value.profileId), [old.profileId]);
  assert.deepEqual(result.review.retiredProfileIds, [retireId]);
  assert.equal(result.review.retireProfileIds.length, 0);
  assert.equal(result.review.retiredProfileBefore[0].profileId, retireId);
  assertOneRequest(result);
  assert.deepEqual(await runtime.read(), result);
});

test('retirement rejects prior-round and unknown IDs without deleting any profile', async () => {
  let manual = false;
  let retireId = 'old-person';
  const { host, store, receipt } = fixture({
    model: async () => manual
      ? turn([], { retireProfileIds: [retireId], noCharacterReason: '本轮没有新人物' })
      : turn([unchangedOld(), createNew()]),
  });
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  const before = store.current().profiles;
  manual = true;
  await runtime.retry();
  assert.equal(store.current().status, 'failed');
  assert.deepEqual(store.current().profiles, before);
  retireId = 'unknown-profile';
  await runtime.retry();
  assert.equal(store.current().status, 'failed');
  assert.deepEqual(store.current().profiles, before);
});

test('legacy complete records without a valid round baseline cannot retire an existing profile', async () => {
  const old = profile('old-person', 'P1', '旧人物', '-旧档案');
  const store = memoryStore({
    version: '0.1.0-candidate.4', variableIdentity: 'identity-a', mvuHash: 'mvu-a',
    scopeKey: 'scope-a', lineage: 'lineage-a', index: 10, revision: 1, status: 'complete',
    profiles: [old],
    tasks: [{ rowId: 'P1', profileId: 'old-person', sourceName: '甲', evidence: '甲在门内',
      existingProfileId: 'old-person', presence: 'present', status: 'complete' }],
    review: { requests: [] },
  });
  let attempt = 0;
  const { host, receipt } = fixture({
    store,
    model: async () => {
      attempt++;
      return attempt === 1 ? turn([unchangedOld()])
        : turn([], { retireProfileIds: ['old-person'], noCharacterReason: '重新核对身份' });
    },
  });
  const runtime = createProfileRuntime({ host, store });
  await runtime.retry();
  assert.equal(store.current().status, 'complete');
  await runtime.retry();
  assert.equal(store.current().status, 'failed');
  assert.ok(store.current().profiles.some(value => value.profileId === 'old-person'));
  assert.deepEqual(store.current().review.retiredProfileIds, []);
  assert.deepEqual(store.current().review.newProfileIds, []);
});

test('a failed person defers retirement; an omitted retirement on repair keeps that profile', async () => {
  let phase = 0;
  let retireId = '';
  const { host, store, receipt } = fixture({
    model: async () => {
      if (phase === 0) return turn([unchangedOld(), createNew()]);
      if (phase === 1) return turn(
        [updateOld({ 'currentState.goal': '' })],
        { retireProfileIds: [retireId] },
      );
      return turn([updateOld({ 'currentState.emotion': '修复后' })]);
    },
  });
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  retireId = store.current().profiles.find(value => value.name === '乙').profileId;
  phase = 1;
  await runtime.retry();
  const failed = store.current();
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failureCode, 'profile_retirement_deferred');
  assert.ok(failed.profiles.some(value => value.profileId === retireId));
  assert.deepEqual(failed.review.retiredProfileIds, []);
  assert.deepEqual(failed.review.retireProfileIds, [retireId]);
  assertOneRequest(failed);

  phase = 2;
  await runtime.retry();
  const repaired = store.current();
  assert.equal(repaired.status, 'complete');
  assert.ok(repaired.profiles.some(value => value.profileId === retireId));
  assert.deepEqual(repaired.review.retiredProfileIds, []);
  assert.ok(repaired.review.newProfileIds.includes(retireId));
  assertOneRequest(repaired);
});

test('retirement conflicts with updating the same profile and does not delete it', async () => {
  let manual = false;
  let retireId = '';
  const { host, store, receipt } = fixture({
    model: async () => {
      if (!manual) return turn([unchangedOld(), createNew()]);
      return turn([person({
        sourceName: '乙', evidence: '乙站在门外', existingProfileId: retireId,
        operation: 'update', changes: { 'currentState.emotion': '不应更新' },
      })], { retireProfileIds: [retireId] });
    },
  });
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  retireId = store.current().profiles.find(value => value.name === '乙').profileId;
  manual = true;
  await runtime.retry();
  const result = store.current();
  assert.equal(result.status, 'failed');
  assert.ok(result.profiles.some(value => value.profileId === retireId));
  assert.deepEqual(result.review.retiredProfileIds, []);
});

test('failed final retirement commit restores the unfiltered profile set', async () => {
  const data = new Map();
  let failedRetirementWrite = false;
  const kv = {
    async read(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async write(key, value) {
      const candidate = structuredClone(value);
      if (!failedRetirementWrite && candidate.status === 'complete'
        && candidate.review?.retiredProfileIds?.length) {
        failedRetirementWrite = true;
        throw Object.assign(new Error('injected final retirement write failure'), { code: 'store_write' });
      }
      data.set(key, candidate);
      return structuredClone(candidate);
    },
  };
  const store = createProfileStore(kv);
  const branch = { index: 10, scopeKey: 'scope-a', lineage: 'lineage-a' };
  const old = profile('old-person', 'P1', '旧人物', '-旧档案');
  await store.commit(branch, {
    version: '0.1.0-candidate.4', scopeKey: branch.scopeKey, lineage: branch.lineage,
    index: branch.index, status: 'complete', profiles: [old], tasks: [],
  }, 0, async () => {});
  let manual = false;
  let retireId = '';
  const { host, receipt } = fixture({
    store,
    model: async () => {
      if (!manual) return turn([unchangedOld(), createNew()]);
      return turn([unchangedOld()], { retireProfileIds: [retireId] });
    },
  });
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  retireId = (await store.read(branch)).profiles.find(value => value.name === '乙').profileId;
  manual = true;
  await runtime.retry();
  const result = await store.read(branch);
  assert.equal(failedRetirementWrite, true);
  assert.equal(result.status, 'failed');
  assert.equal(result.failureCode, 'profile_retirement_deferred');
  assert.ok(result.profiles.some(value => value.profileId === retireId));
  assert.deepEqual(result.review.retiredProfileIds, []);
  assert.deepEqual(result.review.retireProfileIds, [retireId]);
  assertOneRequest(result);
});

test('malformed profile-turn and transport failure each make one request and preserve the baseline', async t => {
  await t.test('malformed response', async () => {
    let calls = 0;
    const { host, store, receipt, old } = fixture({ model: async () => { calls++; return '{}'; } });
    await createProfileRuntime({ host, store }).run(receipt);
    assert.equal(calls, 1);
    assert.deepEqual(store.current().profiles.map(value => value.profileId), [old.profileId]);
    assertOneRequest(store.current());
    assert.equal(store.current().review.automaticRetries, 0);
  });

  await t.test('transport failure', async () => {
    let calls = 0;
    const { host, store, receipt, old } = fixture({
      model: async () => { calls++; throw new Error('profile-turn transport failed'); },
    });
    await createProfileRuntime({ host, store }).run(receipt);
    assert.equal(calls, 1);
    assert.deepEqual(store.current().profiles.map(value => value.profileId), [old.profileId]);
    assertOneRequest(store.current());
    assert.equal(store.current().review.automaticRetries, 0);
  });
});

test('manual repair uses fixed global-validation diagnostics only for the bound parser context', async t => {
  const evidenceFailure = () => JSON.stringify({
    people: [{ sourceName: 'PRIVATE_SOURCE_SENTINEL', evidence: 'PRIVATE_EVIDENCE_SENTINEL',
      existingProfileId: null, presence: 'present', operation: 'create', profile: { name: 'PRIVATE_CANDIDATE_SENTINEL' } }],
    retireProfileIds: [], noCharacterReason: '',
  });
  const identityFailure = () => JSON.stringify({ people: [{ sourceName: '乙', evidence: '乙在门内。',
    existingProfileId: 'old-person', presence: 'present', operation: 'update',
    changes: { 'currentState.emotion': 'PRIVATE_IDENTITY_CANDIDATE_SENTINEL' } }],
  retireProfileIds: [], noCharacterReason: '' });

  await t.test('discovery_evidence_unbound reaches the next messages without the old response or private error message', async () => {
    const oldResponse = evidenceFailure(), sentMessages = [];
    let calls = 0;
    const { host, store, receipt, old } = fixture({
      model: async (_receipt, messages) => {
        sentMessages.push(messages);
        return calls++ === 0 ? oldResponse : turn([unchangedOld()]);
      },
    });
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    const failed = store.current();
    assert.equal(failed.review.failure.code, 'discovery_evidence_unbound');
    assert.match(failed.review.failure.message, /PRIVATE_SOURCE_SENTINEL/);
    assert.equal(failed.review.requests[0].raw, oldResponse);
    assert.throws(() => parseProfileTurn(oldResponse, failed.review.input), error => error.code === 'discovery_evidence_unbound');
    assertOneRequest(failed);

    await runtime.retry();
    const repaired = store.current();
    const retryUser = sentMessages[1].find(message => message.role === 'user').content;
    assert.match(retryUser, /discovery_evidence_unbound/);
    assert.match(retryUser, /当前完整正文中连续逐字出现的原文/);
    assert.doesNotMatch(retryUser, /PRIVATE_SOURCE_SENTINEL|PRIVATE_EVIDENCE_SENTINEL|PRIVATE_CANDIDATE_SENTINEL/);
    assert.match(retryUser, /本次允许退休的本轮新档案ID[\s\S]*?\n\[\]/);
    assert.equal(repaired.status, 'complete');
    assert.deepEqual(repaired.profiles.map(value => value.profileId), [old.profileId]);
    assertOneRequest(repaired);
  });

  await t.test('a global identity failure does not reuse the rejected raw candidate', async () => {
    const oldResponse = identityFailure();
    const sentMessages = [];
    let calls = 0;
    const { host, store, receipt } = fixture({
      inputSeed: { narrative: '乙在门内。甲在门内。' },
      model: async (_receipt, messages) => {
        sentMessages.push(messages);
        return calls++ === 0 ? oldResponse : turn([unchangedOld()]);
      },
    });
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    const failed = store.current();
    assert.equal(failed.review.failure.code, 'profile_turn_identity_reveal_required');
    assert.doesNotThrow(() => parseDiscovery(oldResponse, failed.review.input));
    assert.throws(() => parseProfileTurn(oldResponse, failed.review.input), error => error.code === 'profile_turn_identity_reveal_required');
    await runtime.retry();
    const retryUser = sentMessages[1].find(message => message.role === 'user').content;
    assert.match(retryUser, /profile_turn_identity_reveal_required/);
    assert.match(retryUser, /明确揭示身份关系/);
    assert.doesNotMatch(retryUser, /PRIVATE_IDENTITY_CANDIDATE_SENTINEL/);
    assert.equal(store.current().status, 'complete');
    assertOneRequest(store.current());
  });

  await t.test('a changed receipt suppresses a recognized old parser diagnostic', async () => {
    const sentMessages = [];
    let calls = 0;
    const { host, store, receipt } = fixture({
      model: async (_receipt, messages) => {
        sentMessages.push(messages);
        return calls++ === 0 ? evidenceFailure() : turn([unchangedOld()]);
      },
    });
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    assert.equal(store.current().review.failure.code, 'discovery_evidence_unbound');
    receipt.afterHash = 'mvu-changed';
    await runtime.retry();
    const retryUser = sentMessages[1].find(message => message.role === 'user').content;
    assert.doesNotMatch(retryUser, /discovery_evidence_unbound|PRIVATE_SOURCE_SENTINEL/);
    assert.equal(store.current().status, 'complete');
    assertOneRequest(store.current());
  });

  await t.test('authority-only change retains the fixed diagnostic but not the old raw candidate', async () => {
    const sentMessages = [];
    let calls = 0;
    const { host, store, receipt, inputSeed } = fixture({
      inputSeed: { narrative: '乙在门内。甲在门内。' },
      model: async (_receipt, messages) => {
        sentMessages.push(messages);
        return calls++ === 0 ? identityFailure() : turn([unchangedOld()]);
      },
    });
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    const failed = store.current();
    assert.equal(failed.review.failure.code, 'profile_turn_identity_reveal_required');
    assert.doesNotThrow(() => parseDiscovery(failed.review.requests[0].raw, failed.review.input));
    inputSeed.authority.card = 'changed authority card';
    await runtime.retry();
    const retryUser = sentMessages[1].find(message => message.role === 'user').content;
    assert.match(retryUser, /changed authority card/);
    assert.match(retryUser, /profile_turn_identity_reveal_required/);
    assert.match(retryUser, /明确揭示身份关系/);
    assert.doesNotMatch(retryUser, /PRIVATE_IDENTITY_CANDIDATE_SENTINEL/);
    assert.equal(store.current().status, 'complete');
    assertOneRequest(store.current());
  });

  for (const changedContext of ['narrative', 'players', 'profiles']) {
    await t.test(`changed ${changedContext} suppresses diagnostic and raw fallback`, async () => {
      const oldResponse = identityFailure(), sentMessages = [];
      let calls = 0;
      const { host, store, receipt, inputSeed, inputCalls } = fixture({
        inputSeed: { narrative: '乙在门内。甲在门内。' },
        model: async (_receipt, messages) => {
          sentMessages.push(messages);
          return calls++ === 0 ? oldResponse : turn([unchangedOld()]);
        },
      });
      const runtime = createProfileRuntime({ host, store });
      await runtime.run(receipt);
      const failed = store.current();
      assert.equal(failed.review.failure.code, 'profile_turn_identity_reveal_required');
      assert.doesNotThrow(() => parseDiscovery(oldResponse, failed.review.input));

      if (changedContext === 'narrative') inputSeed.narrative += '背景更新，但旧证据仍在。';
      if (changedContext === 'players') inputSeed.players = ['玩家', '其他玩家'];
      if (changedContext === 'profiles') {
        const current = store.current();
        const profiles = structuredClone(current.profiles);
        profiles[0].history = '本地档案内容已更新';
        await store.commit({ index: current.index, scopeKey: current.scopeKey, lineage: current.lineage },
          { ...current, profiles }, current.revision, async () => {});
      }

      await runtime.retry();
      const currentInput = { ...inputSeed, globalPrompt: host.settings().globalPrompt, profiles: store.current().profiles };
      assert.doesNotThrow(() => parseDiscovery(oldResponse, currentInput));
      const retryUser = sentMessages[1].find(message => message.role === 'user').content;
      assert.doesNotMatch(retryUser, /profile_turn_identity_reveal_required|PRIVATE_IDENTITY_CANDIDATE_SENTINEL/);
      assert.equal(store.current().status, 'complete');
      assertOneRequest(store.current());
    });
  }

  await t.test('a transport failure never enters the global validation diagnostic path', async () => {
    const sentMessages = [];
    let calls = 0;
    const { host, store, receipt } = fixture({
      model: async (_receipt, messages) => {
        sentMessages.push(messages);
        if (calls++ === 0) throw Object.assign(new Error('PRIVATE_TRANSPORT_MESSAGE'), { code: 'model_transport' });
        return turn([unchangedOld()]);
      },
    });
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    assert.equal(store.current().review.failure.code, 'model_transport');
    await runtime.retry();
    const retryUser = sentMessages[1].find(message => message.role === 'user').content;
    assert.doesNotMatch(retryUser, /model_transport|PRIVATE_TRANSPORT_MESSAGE|整体校验诊断/);
    assert.equal(store.current().status, 'complete');
    assertOneRequest(store.current());
  });
});

test('destroy aborts an in-flight profile-turn and does not commit its response', async () => {
  let enteredResolve;
  const entered = new Promise(resolve => { enteredResolve = resolve; });
  const { host, store, receipt, old } = fixture({
    model: async (_receipt, _prompt, signal) => {
      enteredResolve();
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      throw Object.assign(new Error('destroyed'), { code: 'cancelled' });
    },
  });
  const runtime = createProfileRuntime({ host, store });
  const running = runtime.run(receipt);
  await entered;
  runtime.destroy();
  await running;
  assert.deepEqual(store.current().profiles.map(value => value.profileId), [old.profileId]);
  assert.equal(runtime.snapshot().status, 'cancelled');
});
