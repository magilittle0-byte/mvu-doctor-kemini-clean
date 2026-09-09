import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldStore } from '../world/store.mjs';

const branch = lineage => ({ scopeKey: 'synthetic', lineage, index: 4 });
const state = text => ({ world: { worldDigest: text, events: [] }, deliveries: [] });
function fixture() {
  const data = new Map(), writes = [];
  const kv = { read: async key => structuredClone(data.get(key) ?? null),
    write: async (key, value) => { data.set(key, structuredClone(value)); writes.push([key, value]); return structuredClone(value); } };
  return { data, writes, kv, store: createWorldStore(kv) };
}

test('world writes only its namespace and separates alternate branches', async () => {
  const f = fixture(); f.data.set('profiles:v1:synthetic:a', { untouched: true });
  await f.store.commit(branch('a'), state('a'), 0, async () => {});
  await f.store.commit(branch('b'), state('b'), 0, async () => {});
  assert.equal((await f.store.read(branch('a'))).world.worldDigest, 'a');
  assert.equal((await f.store.read(branch('b'))).world.worldDigest, 'b');
  assert.deepEqual(f.data.get('profiles:v1:synthetic:a'), { untouched: true });
  assert.ok(f.writes.every(([key]) => key.startsWith('world:v1:')));
  await assert.rejects(f.store.commit(branch('a'), state('overwrite'), 0, async () => {}), { code: 'world_revision_changed' });
});

test('a target changing after the actual write restores the exact prior record', async () => {
  const f = fixture(), b = branch('a');
  const old = await f.store.commit(b, state('old'), 0, async () => {});
  let stale = false; const write = f.kv.write;
  f.kv.write = async (key, value) => { const saved = await write(key, value); if (value.world?.worldDigest === 'new') stale = true; return saved; };
  await assert.rejects(f.store.commit(b, state('new'), 1, async () => { if (stale) throw Error('changed after write'); }), /changed after write/);
  assert.ok(f.writes.some(([, value]) => value.world?.worldDigest === 'new'));
  assert.deepEqual(await f.store.read(b), old);
});

test('uncertain concurrent data is never overwritten by compensation', async () => {
  const f = fixture(), b = branch('a');
  f.kv.write = async (key, value) => { f.data.set(key, { ...value, world: { worldDigest: 'foreign' } }); throw Error('readback failed'); };
  await assert.rejects(f.store.commit(b, state('new'), 0, async () => {}), { code: 'world_store_uncertain' });
  assert.equal((await f.store.read(b)).world.worldDigest, 'foreign');
});
