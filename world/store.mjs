import { createStore } from '../modular/store.mjs';
import { clone, equal, fault } from '../modular/variables/core.mjs';

// Minimal namespace/shape adaptation of profiles/store.mjs; same KV backend.
export function createWorldStore(kv = createStore()) {
  const key = branch => `world:v1:${branch.scopeKey}:${branch.lineage}`;
  let tail = Promise.resolve();
  async function read(branch) {
    const saved = await kv.read(key(branch));
    if (saved && (saved.scopeKey !== branch.scopeKey || saved.lineage !== branch.lineage
      || !Number.isInteger(saved.revision) || (!saved.tombstone && (!saved.world || typeof saved.world !== 'object'
        || Array.isArray(saved.world) || !Array.isArray(saved.deliveries)))))
      throw fault('world_store_corrupt', '世界存档不完整，未用空记录替代');
    return saved;
  }
  async function commitNow(branch, next, expectedRevision, assertCurrent) {
    await assertCurrent();
    const before = await read(branch);
    if ((before?.revision || 0) !== expectedRevision) throw fault('world_revision_changed', '世界记录已变化，请重新读取');
    const candidate = clone({ ...next, scopeKey: branch.scopeKey, lineage: branch.lineage,
      index: branch.index, revision: expectedRevision + 1 });
    await assertCurrent();
    try {
      const saved = await kv.write(key(branch), candidate);
      await assertCurrent();
      return saved;
    } catch (error) {
      const current = await read(branch);
      if (equal(current, before)) throw error;
      if (!equal(current, candidate)) throw fault('world_store_uncertain', '世界保存结果不确定，已停止本次写入');
      await kv.write(key(branch), before || { scopeKey: branch.scopeKey, lineage: branch.lineage,
        index: branch.index, revision: 0, tombstone: true });
      throw error;
    }
  }
  return Object.freeze({ read, latest: async branches => {
    for (const branch of [...branches].reverse()) { const saved = await read(branch); if (saved && !saved.tombstone) return saved; }
    return null;
  }, commit: (branch, next, expectedRevision, assertCurrent) => {
    const pending = tail.then(() => commitNow(branch, next, expectedRevision, assertCurrent));
    tail = pending.catch(() => {}); return pending;
  } });
}
