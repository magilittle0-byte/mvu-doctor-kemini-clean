import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileStore } from '../profiles/store.mjs';

const branch = (lineage, index = 4) => ({ scopeKey: 'chat-synthetic', lineage, index });
const snapshot = (label, revision = 0) => ({ profiles: [{ profileId: label, rowId: `row-${label}`, name: `NPC-${label}` }], tasks: [], revision });
function kvFixture() {
  const data = new Map(); const calls = [];
  return { data, calls, kv: {
    async read(key) { calls.push(['read', key]); return data.has(key) ? structuredClone(data.get(key)) : null; },
    async write(key, value) { calls.push(['write', key, structuredClone(value)]); data.set(key, structuredClone(value)); return structuredClone(value); },
  } };
}

test('store uses KV write/readback path and isolates swipe branches', async () => {
  const f = kvFixture(); const store = createProfileStore(f.kv);
  const a = branch('swipe-a'); const b = branch('swipe-b');
  await store.commit(a, snapshot('a'), 0, async () => {});
  await store.commit(b, snapshot('b'), 0, async () => {});
  assert.equal((await store.read(a)).profiles[0].profileId, 'a');
  assert.equal((await store.read(b)).profiles[0].profileId, 'b');
  assert.ok(f.calls.some(([kind]) => kind === 'write'));
  assert.ok(f.calls.filter(([kind]) => kind === 'read').length >= 4);
});

test('store rejects stale revision without writing', async () => {
  const f = kvFixture(); const store = createProfileStore(f.kv); const a = branch('same');
  await store.commit(a, snapshot('old'), 0, async () => {});
  await assert.rejects(() => store.commit(a, snapshot('new'), 0, async () => {}), (e) => e.code === 'profile_revision_changed');
  assert.equal((await store.read(a)).profiles[0].profileId, 'old');
});

test('failed post-write assertion restores the previous complete snapshot', async () => {
  const f = kvFixture(); const store = createProfileStore(f.kv); const a = branch('same');
  await store.commit(a, snapshot('old'), 0, async () => {});
  let calls = 0;
  await assert.rejects(() => store.commit(a, snapshot('new'), 1, async () => { if (++calls > 1) throw new Error('stale'); }), /stale/);
  assert.equal((await store.read(a)).profiles[0].profileId, 'old');
});

test('new-branch tombstone does not hide the previous visible branch', async () => {
  const f = kvFixture(); const store = createProfileStore(f.kv); const oldBranch = branch('old'); const newBranch = branch('new');
  await store.commit(oldBranch, snapshot('old'), 0, async () => {});
  let calls = 0;
  await assert.rejects(() => store.commit(newBranch, snapshot('new'), 0, async () => { if (++calls > 1) throw new Error('stale'); }), /stale/);
  assert.equal((await store.latest([oldBranch, newBranch])).profiles[0].profileId, 'old');
});

test('uncertain write result is surfaced and never reported as success', async () => {
  const f = kvFixture();
  let writes = 0;
  f.kv.write = async (key, value) => { writes += 1; f.calls.push(['write', key, structuredClone(value)]); f.data.set(key, { ...structuredClone(value), profiles: [{ profileId: 'unexpected' }] }); throw new Error('readback unavailable'); };
  const store = createProfileStore(f.kv);
  await assert.rejects(() => store.commit(branch('uncertain'), snapshot('new'), 0, async () => {}), (e) => e.code === 'profile_store_uncertain');
  assert.ok(writes >= 1);
});
