// Pure JSON helpers adapted from modular/variables/core.mjs. No legacy runtime imports.
export const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function digest(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonical(value));
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}
export function fault(code, message) { return Object.assign(new Error(message), { code }); }

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const snapshot = value => object(value) && Array.isArray(value.matters);
const keyFor = (scopeKey, branchKey) => {
  if (!text(scopeKey) || !text(branchKey)) throw fault('guide_store_input', '指导存档缺少聊天或分支标识');
  return `guide:v1:${encodeURIComponent(scopeKey)}:${encodeURIComponent(branchKey)}`;
};

function validate(saved, scopeKey, branchKey) {
  const validBase = object(saved) && saved.schemaVersion === 1 && saved.scopeKey === scopeKey
    && saved.branchKey === branchKey && Number.isSafeInteger(saved.revision) && saved.revision >= 0;
  if (validBase && saved.tombstone === true && saved.revision === 0) return null;
  if (!validBase || saved.tombstone !== undefined || saved.revision < 1
    || !object(saved.target) || !text(saved.target.identity) || !Number.isSafeInteger(saved.target.index)
    || saved.target.index < 0 || saved.target.lineage !== branchKey
    || !snapshot(saved.beforeSnapshot) || !snapshot(saved.snapshot)
    || !Array.isArray(saved.coveredReplyKeys) || !saved.coveredReplyKeys.every(text)
    || new Set(saved.coveredReplyKeys).size !== saved.coveredReplyKeys.length)
    throw fault('guide_store_corrupt', '指导存档不完整，未用空记录替代');
  return saved;
}

function decode(raw, scopeKey, branchKey) {
  if (raw === undefined) return null;
  let saved;
  try { saved = JSON.parse(raw); }
  catch { throw fault('guide_store_corrupt', '指导存档内容损坏，未用空记录替代'); }
  return validate(saved, scopeKey, branchKey);
}

// Existing durable KV database, independent owned namespace. No mirrors or migration.
export function createGuideStore({ indexedDB = globalThis.indexedDB } = {}) {
  let opening;
  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!indexedDB) return reject(fault('guide_store_unavailable', '浏览器持久化不可用'));
      let request, failed = false;
      const fail = code => { failed = true; reject(fault(code, '指导存档打开失败')); };
      try { request = indexedDB.open('mvu_doctor_modular', 1); }
      catch { return fail('guide_store_open'); }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('kv')) request.result.createObjectStore('kv');
      };
      request.onsuccess = () => {
        if (failed) { request.result.close(); return; }
        request.result.onversionchange = () => { request.result.close(); opening = null; };
        resolve(request.result);
      };
      request.onerror = () => fail('guide_store_open');
      request.onblocked = () => fail('guide_store_blocked');
    }).catch(error => { opening = null; throw error; });
    return opening;
  }

  function readRaw(db, key) {
    return new Promise((resolve, reject) => {
      let transaction, raw;
      try {
        transaction = db.transaction('kv', 'readonly');
        const request = transaction.objectStore('kv').get(key);
        request.onsuccess = () => { raw = request.result; };
      } catch { return reject(fault('guide_store_read', '指导存档读回失败')); }
      transaction.oncomplete = () => resolve(raw);
      transaction.onerror = transaction.onabort = () => reject(fault('guide_store_read', '指导存档读回失败'));
    });
  }

  // The read, comparison, and optional write share one transaction across tabs/instances.
  function compareAndWrite(db, key, decide) {
    return new Promise((resolve, reject) => {
      let transaction, result, failure;
      try {
        transaction = db.transaction('kv', 'readwrite');
        const store = transaction.objectStore('kv');
        const request = store.get(key);
        request.onsuccess = () => {
          try {
            const decision = decide(request.result);
            result = decision.result;
            if (Object.hasOwn(decision, 'write')) store.put(decision.write, key);
          } catch (error) { failure = error; transaction.abort(); }
        };
      } catch { return reject(fault('guide_store_write', '指导存档写入失败')); }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = transaction.onabort = () => reject(failure || fault('guide_store_write', '指导存档写入失败'));
    });
  }

  async function read(scopeKey, branchKey) {
    const key = keyFor(scopeKey, branchKey);
    return decode(await readRaw(await open(), key), scopeKey, branchKey);
  }

  async function commit({ scopeKey, branchKey, expectedRevision, record, assertCurrent = () => {} }) {
    const key = keyFor(scopeKey, branchKey);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER
      || typeof assertCurrent !== 'function') throw fault('guide_store_input', '指导保存版本或来源核验无效');
    let candidate;
    try { candidate = clone({ ...record, schemaVersion: 1, scopeKey, branchKey, revision: expectedRevision + 1 }); }
    catch { throw fault('guide_store_input', '指导快照无法保存为 JSON'); }
    validate(candidate, scopeKey, branchKey);
    const proposedRaw = canonical(candidate);
    await assertCurrent();
    const db = await open();
    await assertCurrent();
    const beforeRaw = await compareAndWrite(db, key, raw => {
      const before = decode(raw, scopeKey, branchKey);
      if ((before?.revision || 0) !== expectedRevision) throw fault('guide_revision_changed', '指导记录已变化，请重新读取');
      return { write: proposedRaw, result: raw };
    });
    try {
      if (await readRaw(db, key) !== proposedRaw) throw fault('guide_store_readback', '指导存档写后读回不一致');
      await assertCurrent();
      return clone(candidate);
    } catch (error) {
      const restoredRaw = beforeRaw === undefined
        ? canonical({ schemaVersion: 1, scopeKey, branchKey, revision: 0, tombstone: true }) : beforeRaw;
      try {
        const expectedRaw = await compareAndWrite(db, key, raw => {
          if (raw === beforeRaw) return { result: beforeRaw };
          if (raw !== proposedRaw) throw fault('guide_store_uncertain', '指导保存遇到更新的记录，已保留该记录');
          return { write: restoredRaw, result: restoredRaw };
        });
        if (await readRaw(db, key) !== expectedRaw) throw fault('guide_store_uncertain', '指导保存恢复结果无法确认');
      } catch { throw fault('guide_store_uncertain', '指导保存结果不确定，未覆盖其他版本'); }
      throw error;
    }
  }
  return Object.freeze({ read, commit });
}
