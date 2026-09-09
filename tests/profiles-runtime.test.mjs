import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileRuntime } from '../profiles/runtime.mjs';
import { PROFILE_FIELDS } from '../profiles/content.mjs';

function setPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] ||= {};
  cursor[parts.at(-1)] = value;
}

function profile(id, rowId, name, suffix = '') {
  const result = { profileId: id, rowId, name };
  for (const field of PROFILE_FIELDS.filter(field => field.path !== 'name')) setPath(result, field.path,
    field.type === 'list' ? [`${field.label}${suffix || '事实'}`] : `${field.label}${suffix || '事实'}`);
  return result;
}

function memoryStore(initial = null) {
  let saved = initial ? structuredClone(initial) : null;
  const writes = [];
  return {
    writes,
    async read(branch) { return saved && saved.scopeKey === branch.scopeKey && saved.lineage === branch.lineage ? structuredClone(saved) : null; },
    async latest(branches) {
      if (!saved || saved.tombstone) return null;
      return branches.some(branch => branch.scopeKey === saved.scopeKey && branch.lineage === saved.lineage) ? structuredClone(saved) : null;
    },
    async commit(branch, next, expectedRevision, assertCurrent) {
      await assertCurrent();
      assert.equal(saved?.revision || 0, expectedRevision);
      saved = structuredClone({ ...next, scopeKey: branch.scopeKey, lineage: branch.lineage, index: branch.index, revision: expectedRevision + 1 });
      writes.push(structuredClone(saved));
      return structuredClone(saved);
    },
    current() { return structuredClone(saved); },
  };
}

function fixture({ model, assertReceipt } = {}) {
  const branch = { index: 10, scopeKey: 'scope-a', lineage: 'lineage-a' };
  const old = profile('old-person', 'P1', '旧人物', '-旧档案');
  const store = memoryStore({ version: '0.1.0-candidate.1', scopeKey: branch.scopeKey, lineage: branch.lineage, index: 10, revision: 1, status: 'complete', profiles: [old], tasks: [] });
  const ctx = { extensionSettings: {}, chat: [], setExtensionPrompt() {}, eventSource: { on() {}, removeListener() {} } };
  const host = {
    context: () => ctx,
    settings: () => ({ globalPrompt: '' }),
    branches: async () => [branch],
    latestIndex: () => branch.index,
    messageText: row => row?.mes || '',
    doctor: () => ({ ready: true, locked: true, status: () => ({ busy: false, inFlight: false, status: 'applied' }), record: () => receipt }),
    assertReceipt: assertReceipt || (async () => {}),
    inputFor: async (_receipt, profiles) => ({ narrative: '甲在门内，乙站在门外。', userText: '继续', mvu: {}, authority: { card: 'card', world: 'world' }, players: ['玩家'], profiles }),
    callModel: model,
  };
  const receipt = { identity: 'identity-a', afterHash: 'mvu-a', readback: true, target: { index: 10, scopeKey: branch.scopeKey } };
  return { host, store, receipt, old };
}

function discoveryRaw() {
  return JSON.stringify({ people: [
    { sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', presence: 'present' },
    { sourceName: '乙', evidence: '乙站在门外', existingProfileId: null, presence: 'present' },
  ], noCharacterReason: '' });
}

function candidateFromPrompt(prompt, name, suffix = '') {
  const source = String(prompt);
  const start = source.indexOf('\nrow:\n') + '\nrow:\n'.length;
  const end = source.indexOf('\n\nprevious:', start);
  const row = source.slice(start, end < 0 ? source.length : end);
  const value = key => row.match(new RegExp(`\\"${key}\\"\\s*:\\s*\\"([^\\"]+)\\"`))?.[1];
  return JSON.stringify(profile(value('profileId'), value('rowId'), name, suffix));
}

test('一次发现中第一人补填失败仍保留旧完整档案，第二人成功独立保存', async () => {
  const calls = [];
  let firstProfileCall = true;
  const { host, store, receipt, old } = fixture({ model: async (_r, prompt) => {
    if (prompt.includes('人物发现器')) { calls.push('discovery'); return discoveryRaw(); }
    if (prompt.includes('定向格式/缺项修复')) { calls.push('repair'); return '{}'; }
    calls.push('profile');
    if (firstProfileCall) { firstProfileCall = false; return '{}'; }
    return candidateFromPrompt(prompt, '乙', '-新档案');
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  const result = store.current();
  assert.deepEqual(calls, ['discovery', 'profile', 'repair', 'profile']);
  assert.equal(result.status, 'partial');
  assert.equal(result.profiles.find(p => p.profileId === 'old-person').name, old.name);
  assert.equal(result.profiles.find(p => p.name === '乙').name, '乙');
  assert.equal(result.tasks.find(t => t.profileId === 'old-person').status, 'failed');
  assert.equal(result.tasks.find(t => t.sourceName === '乙').status, 'complete');
});

test('手动修复产生新发现/新档案调用，旧档案在新候选成功前保留', async () => {
  const calls = [];
  let round = 0;
  const { host, store, receipt } = fixture({ model: async (_r, prompt) => {
    if (prompt.includes('人物发现器')) { calls.push(`discovery-${round}`); return discoveryRaw(); }
    calls.push(`profile-${round}`);
    if (round === 0) return '{}';
    return candidateFromPrompt(prompt, '甲', '-修订档案');
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  assert.equal(store.current().profiles.find(p => p.profileId === 'old-person').name, '旧人物');
  round = 1;
  await runtime.run(receipt, true);
  assert.deepEqual(calls, ['discovery-0', 'profile-0', 'profile-0', 'profile-0', 'profile-0',
    'discovery-1', 'profile-1', 'profile-1']);
  assert.equal(store.current().profiles.find(p => p.profileId === 'old-person').name, '甲');
});

test('取消或 stale_mvu 不保存新完整档案', async t => {
  await t.test('cancel', async () => {
    let enteredResolve;
    const entered = new Promise(resolve => { enteredResolve = resolve; });
    const { host, store, receipt, old } = fixture({ model: async (_r, prompt, signal) => {
      if (prompt.includes('人物发现器')) {
        if (signal.aborted) throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
        enteredResolve();
        await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
        throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
      }
      return discoveryRaw();
    }});
    const runtime = createProfileRuntime({ host, store });
    const running = runtime.run(receipt);
    await entered;
    runtime.cancel();
    await running;
    assert.deepEqual(store.current().profiles.map(p => p.name), [old.name]);
  });
  await t.test('stale_mvu', async () => {
    let checks = 0;
    const { host, store, receipt, old } = fixture({
      model: async (_r, prompt) => prompt.includes('人物发现器') ? discoveryRaw() : JSON.stringify(profile('new-person', 'P2', '乙')),
      assertReceipt: async () => { checks += 1; if (checks > 1) throw Object.assign(new Error('stale'), { code: 'stale_mvu' }); },
    });
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    assert.deepEqual(store.current().profiles.map(p => p.name), [old.name]);
    assert.equal(store.current().tasks.some(task => task.status === 'complete'), false);
  });
});
