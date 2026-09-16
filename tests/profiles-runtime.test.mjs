import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileRuntime } from '../profiles/runtime.mjs';
import { createProfileStore } from '../profiles/store.mjs';
import { PROFILE_FIELDS, validateProfile } from '../profiles/content.mjs';

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

function fixture({ model, assertReceipt, store: providedStore } = {}) {
  const branch = { index: 10, scopeKey: 'scope-a', lineage: 'lineage-a' };
  const old = profile('old-person', 'P1', '旧人物', '-旧档案');
  const store = providedStore || memoryStore({ version: '0.1.0-candidate.1', scopeKey: branch.scopeKey, lineage: branch.lineage, index: 10, revision: 1, status: 'complete', profiles: [old], tasks: [] });
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
  host.receipt = () => receipt;
  return { host, store, receipt, old };
}

function discoveryRaw() {
  return JSON.stringify({ people: [
    { sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', presence: 'present' },
    { sourceName: '乙', evidence: '乙站在门外', existingProfileId: null, presence: 'present' },
  ], noCharacterReason: '' });
}

function jsonArrayAfter(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing prompt marker: ${marker}`);
  const open = source.indexOf('[', start + marker.length);
  let depth = 0, quoted = false, escaped = false;
  for (let index = open; index < source.length; index++) {
    const char = source[index];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') { quoted = true; continue; }
    if (char === '[') depth++;
    if (char === ']' && --depth === 0) return JSON.parse(source.slice(open, index + 1));
  }
  throw new Error('unterminated prompt rows');
}

function batchFromPrompt(prompt, { invalid = [], suffix = '', extra = false } = {}) {
  const rows = jsonArrayAfter(String(prompt), 'rows（每项只对应自己的绑定资料）：\n')
    .map(row => ({ rowId: row.rowId, profileId: row.profileId }));
  const profiles = rows.reverse().map(row => invalid.includes(row.profileId)
    ? { ...row }
    : profile(row.profileId, row.rowId, row.profileId === 'old-person' ? '甲' : '乙', suffix));
  if (extra) profiles.push(profile('unknown-profile', 'P99', '额外人物', suffix));
  return JSON.stringify({ profiles });
}

test('一次发现中第一人批量补全失败仍保留旧完整档案，第二人成功独立保存', async () => {
  const calls = [];
  const { host, store, receipt, old } = fixture({ model: async (_r, prompt) => {
    if (prompt.includes('人物发现器')) { calls.push('discovery'); return discoveryRaw(); }
    calls.push('profile-batch');
    return batchFromPrompt(prompt, { invalid: ['old-person'], suffix: '-新档案' });
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  const result = store.current();
  assert.deepEqual(calls, ['discovery', 'profile-batch']);
  assert.equal(result.status, 'partial');
  assert.equal(result.profiles.find(p => p.profileId === 'old-person').name, old.name);
  assert.equal(result.profiles.find(p => p.name === '乙').name, '乙');
  assert.equal(result.tasks.find(t => t.profileId === 'old-person').status, 'failed');
  assert.equal(result.tasks.find(t => t.sourceName === '乙').status, 'complete');
  assert.equal(runtime.snapshot().requestCount, 2);
  assert.equal(result.review.requests.length, 2);
});

test('无人发现时只发送一次 discovery 请求并保存完成态', async () => {
  const calls = [];
  const { host, store, receipt } = fixture({ model: async (_r, prompt) => {
    calls.push('discovery');
    assert.match(prompt, /人物发现器/);
    assert.doesNotMatch(prompt, /retirableProfileIds/);
    return JSON.stringify({ people: [], noCharacterReason: '本轮没有需要建档的人物' });
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  assert.deepEqual(calls, ['discovery']);
  assert.equal(store.current().status, 'complete');
  assert.equal(store.current().review.requests.length, 1);
  assert.equal(runtime.snapshot().requestCount, 1);
});

test('unknown batch item leaves valid sibling saved but keeps the round partial', async () => {
  const { host, store, receipt } = fixture({ model: async (_r, prompt) =>
    prompt.includes('人物发现器') ? discoveryRaw() : batchFromPrompt(prompt, { extra: true }) });
  await createProfileRuntime({ host, store }).run(receipt);
  const result = store.current();
  assert.equal(result.status, 'partial');
  assert.ok(result.profiles.some(value => value.name === '乙'));
  assert.equal(result.profiles.some(value => value.profileId === 'unknown-profile'), false);
  assert.ok(result.review.batchErrors.some(error => error.code === 'profile_batch_unknown_row_id'
    || error.code === 'profile_batch_unknown_profile_id'));
  assert.equal(result.tasks.filter(task => task.status === 'complete').length, 2);
});

test('手动修复产生新发现/新档案调用，旧档案在新候选成功前保留', async () => {
  const calls = [];
  let round = 0;
  const { host, store, receipt } = fixture({ model: async (_r, prompt) => {
    if (prompt.includes('人物发现器')) { calls.push(`discovery-${round}`); return discoveryRaw(); }
    calls.push(`profile-batch-${round}`);
    return round === 0 ? batchFromPrompt(prompt, { invalid: ['old-person'] })
      : batchFromPrompt(prompt, { suffix: '-修订档案' });
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  assert.equal(store.current().profiles.find(p => p.profileId === 'old-person').name, '旧人物');
  round = 1;
  await runtime.run(receipt, true);
  assert.deepEqual(calls, ['discovery-0', 'profile-batch-0', 'discovery-1', 'profile-batch-1']);
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
      model: async (_r, prompt) => prompt.includes('人物发现器') ? discoveryRaw() : batchFromPrompt(prompt),
      assertReceipt: async () => { checks += 1; if (checks > 1) throw Object.assign(new Error('stale'), { code: 'stale_mvu' }); },
    });
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    assert.deepEqual(store.current().profiles.map(p => p.name), [old.name]);
    assert.equal(store.current().tasks.some(task => task.status === 'complete'), false);
  });
});

function onlyOldDiscovery() {
  return JSON.stringify({ people: [
    { sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', presence: 'present' },
  ], noCharacterReason: '' });
}

function onlyNewDiscovery() {
  return JSON.stringify({ people: [
    { sourceName: '乙', evidence: '乙站在门外', existingProfileId: null, presence: 'present' },
  ], noCharacterReason: '' });
}

test('manual retry corrects an omitted person, preserves the complete old profile, and reads back both', async () => {
  const discoveryPrompts = [];
  let manual = false;
  const { host, store, receipt, old } = fixture({ model: async (_r, prompt) => {
    if (prompt.includes('人物发现器')) {
      discoveryPrompts.push(prompt);
      return manual ? onlyNewDiscovery() : onlyOldDiscovery();
    }
    return manual ? batchFromPrompt(prompt, { suffix: '-manual' }) : batchFromPrompt(prompt, { invalid: ['old-person'] });
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  manual = true;
  await runtime.retry();
  const result = store.current();
  assert.equal(discoveryPrompts.length, 2);
  assert.match(discoveryPrompts[1], /上次合法格式的发现结果/);
  assert.match(discoveryPrompts[1], /甲在门内/);
  assert.deepEqual(result.profiles.find(p => p.profileId === 'old-person'), old);
  const added = result.profiles.find(p => p.name === '乙');
  assert.ok(added);
  assert.notEqual(added.profileId, 'old-person');
  assert.equal(result.profiles.length, 2);
  assert.equal(result.tasks.length, 1);
  assert.deepEqual(validateProfile(added, []), []);
  assert.equal(result.tasks.find(task => task.sourceName === '乙')?.status, 'complete');
  assert.deepEqual(await runtime.read(), result);
  assert.equal(runtime.snapshot().readback, true);
});

test('manual retry explicitly retires a current-round new profile while preserving prior and valid sibling profiles', async () => {
  let manual = false;
  let retiredProfileId = '';
  const { host, store, receipt, old } = fixture({ model: async (_r, prompt) => {
    if (prompt.includes('人物发现器')) {
      if (!manual) return discoveryRaw();
      return JSON.stringify({ people: [
        { sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', presence: 'present' },
      ], retireProfileIds: [retiredProfileId], noCharacterReason: '' });
    }
    if (manual) {
      const rows = jsonArrayAfter(String(prompt), 'rows（每项只对应自己的绑定资料）：\n')
        .map(row => ({ rowId: row.rowId, profileId: row.profileId }));
      return JSON.stringify({ profiles: rows.map(row => profile(row.profileId, row.rowId, '旧人物', '-保留')) });
    }
    return batchFromPrompt(prompt, { suffix: '-初次' });
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  retiredProfileId = store.current().profiles.find(profile => profile.name === '乙').profileId;
  assert.ok(store.current().review.newProfileIds.includes(retiredProfileId));
  manual = true;
  await runtime.retry();
  const result = store.current();
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.profiles.map(profile => profile.profileId), ['old-person']);
  assert.equal(result.profiles.find(profile => profile.profileId === 'old-person').name, old.name);
  assert.deepEqual(result.review.retiredProfileIds, [retiredProfileId]);
  assert.equal(result.review.retiredProfileBefore[0].profileId, retiredProfileId);
  assert.equal(result.review.retireProfileIds.length, 0);
  assert.deepEqual(await runtime.read(), result);
});

test('manual retirement rejects prior-round or unknown IDs without changing profiles', async () => {
  let manual = false;
  let invalidId = 'old-person';
  const { host, store, receipt } = fixture({ model: async (_r, prompt) => {
    if (prompt.includes('人物发现器')) {
      if (!manual) return discoveryRaw();
      return JSON.stringify({ people: [], retireProfileIds: [invalidId], noCharacterReason: '没有新的可建档人物' });
    }
    return batchFromPrompt(prompt);
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  const before = store.current();
  manual = true;
  await runtime.retry();
  assert.equal(store.current().status, 'failed');
  assert.deepEqual(store.current().profiles, before.profiles);
  invalidId = 'unknown-profile';
  await runtime.retry();
  assert.equal(store.current().status, 'failed');
  assert.deepEqual(store.current().profiles, before.profiles);
});

test('legacy records without a baseline cannot retire an existing profile across repeated retries or changed evidence', async t => {
  const makeLegacyStore = () => {
    const old = profile('old-person', 'P1', '旧人物', '-旧档案');
    return memoryStore({ version: '0.1.0-candidate.4', variableIdentity: 'identity-a', mvuHash: 'mvu-a',
      scopeKey: 'scope-a', lineage: 'lineage-a', index: 10, revision: 1, status: 'complete', profiles: [old],
      tasks: [{ rowId: 'P1', profileId: 'old-person', sourceName: '甲', evidence: '甲在门内',
        existingProfileId: 'old-person', presence: 'present', status: 'complete' }], review: { requests: [] } });
  };
  const makeModel = () => {
    let discoveries = 0;
    return async (_r, prompt) => {
      if (!prompt.includes('人物发现器')) return batchFromPrompt(prompt);
      return JSON.stringify(++discoveries === 1
        ? { people: [{ sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', presence: 'present' }], noCharacterReason: '' }
        : { people: [], retireProfileIds: ['old-person'], noCharacterReason: '重新核对身份' });
    };
  };
  await t.test('same receipt twice', async () => {
    const store = makeLegacyStore();
    const { host, receipt } = fixture({ store, model: makeModel() });
    const runtime = createProfileRuntime({ host, store });
    await runtime.retry();
    assert.equal(store.current().status, 'complete');
    await runtime.retry();
    assert.equal(store.current().review.failure.code, 'discovery_retire_forbidden');
    assert.equal(store.current().profiles.some(value => value.profileId === 'old-person'), true);
    assert.deepEqual(store.current().review.retiredProfileIds, []);
    assert.deepEqual(store.current().review.newProfileIds, []);
  });
  await t.test('changed receipt twice', async () => {
    const store = makeLegacyStore();
    const branch = { index: 10, scopeKey: 'scope-a', lineage: 'lineage-a' };
    const saved = store.current();
    saved.review.baselineProfileIds = [];
    saved.review.newProfileIds = ['old-person'];
    await store.commit(branch, saved, saved.revision, async () => {});
    const { host, receipt } = fixture({ store, model: makeModel() });
    receipt.identity = 'identity-b'; receipt.afterHash = 'mvu-b';
    const runtime = createProfileRuntime({ host, store });
    await runtime.retry();
    assert.equal(store.current().status, 'complete');
    await runtime.retry();
    assert.equal(store.current().review.failure.code, 'discovery_retire_forbidden');
    assert.equal(store.current().profiles.some(value => value.profileId === 'old-person'), true);
    assert.deepEqual(store.current().review.retiredProfileIds, []);
    assert.deepEqual(store.current().review.newProfileIds, []);
  });
});

test('partial or transport failure keeps an explicit retirement pending and retains its profile', async t => {
  await t.test('partial batch', async () => {
    let manual = false;
    let manualAttempt = 0;
    let retiredProfileId = '';
    const discoveryPrompts = [];
    const { host, store, receipt } = fixture({ model: async (_r, prompt) => {
      if (prompt.includes('人物发现器')) {
        if (!manual) return discoveryRaw();
        manualAttempt += 1;
        discoveryPrompts.push(prompt);
        if (manualAttempt === 2) return JSON.stringify({ people: [
          { sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', presence: 'present' },
        ], noCharacterReason: '' });
        return JSON.stringify({ people: [
          { sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', presence: 'present' },
        ], retireProfileIds: [retiredProfileId], noCharacterReason: '' });
      }
      return manualAttempt === 1 ? batchFromPrompt(prompt, { invalid: ['old-person'] }) : batchFromPrompt(prompt);
    }});
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    retiredProfileId = store.current().profiles.find(profile => profile.name === '乙').profileId;
    manual = true;
    await runtime.retry();
    const result = store.current();
    assert.equal(result.status, 'failed');
    assert.equal(result.failureCode, 'profile_retirement_deferred');
    assert.ok(result.profiles.some(profile => profile.profileId === retiredProfileId));
    assert.deepEqual(result.review.retiredProfileIds, []);
    assert.deepEqual(result.review.retireProfileIds, [retiredProfileId]);
    await runtime.retry();
    const omitted = store.current();
    assert.equal(omitted.status, 'complete');
    assert.ok(omitted.profiles.some(profile => profile.profileId === retiredProfileId));
    assert.deepEqual(omitted.review.retiredProfileIds, []);
    assert.ok(omitted.review.newProfileIds.includes(retiredProfileId));
    assert.match(discoveryPrompts[1], /上次合法格式的发现结果/);
    assert.match(discoveryPrompts[1], /允许剔除的本轮新建档案 ID/);
    assert.match(discoveryPrompts[1], new RegExp(retiredProfileId));
    await runtime.retry();
    const recovered = store.current();
    assert.equal(recovered.status, 'complete');
    assert.equal(recovered.profiles.some(profile => profile.profileId === retiredProfileId), false);
    assert.deepEqual(recovered.review.retiredProfileIds, [retiredProfileId]);
    assert.match(discoveryPrompts[2], new RegExp(retiredProfileId));
  });
  await t.test('transport failure', async () => {
    let manual = false;
    let retiredProfileId = '';
    const { host, store, receipt } = fixture({ model: async (_r, prompt) => {
      if (prompt.includes('人物发现器')) {
        if (!manual) return discoveryRaw();
        return JSON.stringify({ people: [
          { sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', presence: 'present' },
        ], retireProfileIds: [retiredProfileId], noCharacterReason: '' });
      }
      if (manual) throw new Error('batch transport failed');
      return batchFromPrompt(prompt);
    }});
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    retiredProfileId = store.current().profiles.find(profile => profile.name === '乙').profileId;
    manual = true;
    await runtime.retry();
    const result = store.current();
    assert.equal(result.status, 'failed');
    assert.ok(result.profiles.some(profile => profile.profileId === retiredProfileId));
    assert.deepEqual(result.review.retiredProfileIds, []);
    assert.deepEqual(result.review.retireProfileIds, [retiredProfileId]);
  });
});

test('manual retirement conflicts with updating the same profile and does not delete it', async () => {
  let manual = false;
  let retiredProfileId = '';
  const { host, store, receipt } = fixture({ model: async (_r, prompt) => {
    if (prompt.includes('人物发现器')) {
      if (!manual) return discoveryRaw();
      return JSON.stringify({ people: [
        { sourceName: '乙', evidence: '乙站在门外', existingProfileId: retiredProfileId, presence: 'present' },
      ], retireProfileIds: [retiredProfileId], noCharacterReason: '' });
    }
    return batchFromPrompt(prompt);
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  retiredProfileId = store.current().profiles.find(profile => profile.name === '乙').profileId;
  manual = true;
  await runtime.retry();
  const result = store.current();
  assert.equal(result.status, 'failed');
  assert.ok(result.profiles.some(profile => profile.profileId === retiredProfileId));
  assert.deepEqual(result.review.retiredProfileIds, []);
});

test('failed final retirement commit restores the unfiltered draft and leaves the profile available', async () => {
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
  await store.commit(branch, { version: '0.1.0-candidate.4', scopeKey: branch.scopeKey,
    lineage: branch.lineage, index: branch.index, status: 'complete', profiles: [old], tasks: [],
  }, 0, async () => {});
  let manual = false;
  let retiredProfileId = '';
  const { host, receipt } = fixture({ store, model: async (_r, prompt) => {
    if (prompt.includes('人物发现器')) {
      if (!manual) return discoveryRaw();
      return JSON.stringify({ people: [
        { sourceName: '甲', evidence: '甲在门内', existingProfileId: 'old-person', presence: 'present' },
      ], retireProfileIds: [retiredProfileId], noCharacterReason: '' });
    }
    if (manual) {
      const rows = jsonArrayAfter(String(prompt), 'rows（每项只对应自己的绑定资料）：\n')
        .map(row => ({ rowId: row.rowId, profileId: row.profileId }));
      return JSON.stringify({ profiles: rows.map(row => profile(row.profileId, row.rowId, '旧人物', '-保留')) });
    }
    return batchFromPrompt(prompt, { suffix: '-初次' });
  }});
  const runtime = createProfileRuntime({ host, store });
  await runtime.run(receipt);
  retiredProfileId = (await store.read(branch)).profiles.find(value => value.name === '乙').profileId;
  manual = true;
  await runtime.retry();
  const result = await store.read(branch);
  assert.equal(failedRetirementWrite, true);
  assert.equal(result.status, 'failed');
  assert.equal(result.failureCode, 'profile_retirement_deferred');
  assert.ok(result.profiles.some(value => value.profileId === retiredProfileId));
  assert.deepEqual(result.review.retiredProfileIds, []);
  assert.deepEqual(result.review.retireProfileIds, [retiredProfileId]);
});

test('malformed discovery and batch transport failure do not trigger automatic retries', async t => {
  await t.test('malformed discovery', async () => {
    const calls = [];
    const { host, store, receipt, old } = fixture({ model: async (_r, prompt) => {
      calls.push(prompt.includes('人物发现器') ? 'discovery' : 'profile-batch'); return '{}';
    }});
    await createProfileRuntime({ host, store }).run(receipt);
    assert.deepEqual(calls, ['discovery']);
    assert.deepEqual(store.current().profiles.map(value => value.name), [old.name]);
  });
  await t.test('batch transport failure', async () => {
    const calls = [];
    const { host, store, receipt, old } = fixture({ model: async (_r, prompt) => {
      if (prompt.includes('人物发现器')) { calls.push('discovery'); return discoveryRaw(); }
      calls.push('profile-batch'); throw new Error('transport');
    }});
    await createProfileRuntime({ host, store }).run(receipt);
    assert.deepEqual(calls, ['discovery', 'profile-batch']);
    assert.deepEqual(store.current().profiles.map(value => value.name), [old.name]);
  });
});

test('batch result rejected after stale receipt is not committed', async () => {
  let stale = false;
  const calls = [];
  const { host, store, receipt, old } = fixture({
    model: async (_r, prompt) => {
      if (prompt.includes('人物发现器')) { calls.push('discovery'); return discoveryRaw(); }
      calls.push('profile-batch'); stale = true; return batchFromPrompt(prompt);
    },
    assertReceipt: async () => { if (stale) throw Object.assign(new Error('stale'), { code: 'stale_mvu' }); },
  });
  await createProfileRuntime({ host, store }).run(receipt);
  assert.deepEqual(calls, ['discovery', 'profile-batch']);
  assert.deepEqual(store.current().profiles.map(value => value.name), [old.name]);
  assert.equal(store.current().tasks.some(task => task.status === 'complete'), false);
});

for (const [label, mutate] of [
  ['identity', receipt => { receipt.identity = 'different-receipt'; }],
  ['mvu', receipt => { receipt.afterHash = 'different-mvu'; }],
]) {
  test(`manual retry does not inject old discovery feedback after ${label} changes`, async () => {
    const discoveryPrompts = [];
    let manual = false;
    const { host, store, receipt } = fixture({ model: async (_r, prompt) => {
      if (prompt.includes('人物发现器')) {
        discoveryPrompts.push(prompt);
        return manual ? onlyNewDiscovery() : onlyOldDiscovery();
      }
      return '{}';
    }});
    const runtime = createProfileRuntime({ host, store });
    await runtime.run(receipt);
    manual = true;
    mutate(receipt);
    await runtime.retry();
    assert.equal(discoveryPrompts.length, 2);
    assert.doesNotMatch(discoveryPrompts[1], /上次合法格式的发现结果/);
    assert.match(discoveryPrompts[1], /允许剔除的本轮新建档案 ID[\s\S]*?\[\]/);
    assert.ok(store.current().profiles.some(p => p.profileId === 'old-person'));
  });
}
