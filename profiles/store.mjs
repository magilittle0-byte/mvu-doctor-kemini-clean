import { createStore } from '../modular/store.mjs';
import { clone, equal, fault } from '../modular/variables/core.mjs';

// The existing durable KV transaction/readback remains the only storage backend.
// Branch-qualified keys keep alternate swipes separate without overwriting P1.
export function createProfileStore(kv = createStore()) {
  const key = branch => `profiles:v1:${branch.scopeKey}:${branch.lineage}`;
  let tail = Promise.resolve();
  async function read(branch) {
    const saved = await kv.read(key(branch));
    if (saved && (saved.scopeKey !== branch.scopeKey || saved.lineage !== branch.lineage || !Array.isArray(saved.profiles)
      || !Array.isArray(saved.tasks) || !Number.isInteger(saved.revision))) throw fault('profile_store_corrupt', '人物档案存档不完整');
    return saved;
  }
  async function commitNow(branch, next, expectedRevision, assertCurrent) {
    await assertCurrent();
    const before = await read(branch);
    if ((before?.revision || 0) !== expectedRevision) throw fault('profile_revision_changed', '人物档案已更新，请重新读取');
    const candidate = clone({ ...next, scopeKey: branch.scopeKey, lineage: branch.lineage,
      index: branch.index, revision: expectedRevision + 1 });
    await assertCurrent();
    // A late old-branch write cannot become another branch's selected snapshot.
    // If the same branch becomes stale during the transaction, compensate only
    // our exact candidate, following the mature commitStore rollback boundary.
    try {
      const saved = await kv.write(key(branch), candidate);
      await assertCurrent();
      return saved;
    } catch (error) {
      const current = await read(branch);
      if (equal(current, before)) throw error;
      if (!equal(current, candidate)) throw fault('profile_store_uncertain', '人物档案保存结果不确定，已停止本次写入');
      // A tombstone preserves the previous visible snapshot when no branch row
      // existed. It is not a completed profile and is ignored by latest().
      await kv.write(key(branch), before || { scopeKey: branch.scopeKey, lineage: branch.lineage,
        index: branch.index, revision: 0, profiles: [], tasks: [], tombstone: true });
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
