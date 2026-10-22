import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { canonical, clone, digest } from '../guide/store.mjs';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../guide/store.mjs', import.meta.url), 'utf8');
function playwright() {
  try { return require('playwright'); }
  catch {
    return require(path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright'));
  }
}
function executablePath() {
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate));
}

let browser;
before(async () => { browser = await playwright().chromium.launch({ headless: true, executablePath: executablePath() }); });
after(async () => { await browser?.close(); });

// This browser owns an empty, disposable context. Every request is fulfilled locally.
async function withPage(run) {
  const context = await browser.newContext();
  try {
    await context.route('**/*', route => route.fulfill({ status: 200,
      contentType: route.request().url().endsWith('/store.mjs') ? 'text/javascript' : 'text/html',
      body: route.request().url().endsWith('/store.mjs') ? source : '<!doctype html><title>Guidance store checks</title>' }));
    const page = await context.newPage();
    await page.goto('https://guidance-store.test/');
    await page.evaluate(async () => {
      window.guide = await import('/store.mjs');
      window.fixture = (lineage = 'branch-a', identity = 'reply-a', index = 1) => ({
        target: { lineage, identity, index }, beforeSnapshot: { matters: [] },
        snapshot: { matters: [{ id: 'shield', state: 'waiting', note: 'Synthetic shield repair choice.' }] },
        coveredReplyKeys: [identity], custom: { kept: true },
      });
      window.keyFor = (scope, branch) => `guide:v1:${encodeURIComponent(scope)}:${encodeURIComponent(branch)}`;
      window.raw = async (key, ...write) => {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('mvu_doctor_modular', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('kv');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          return await new Promise((resolve, reject) => {
            const transaction = db.transaction('kv', write.length ? 'readwrite' : 'readonly');
            const request = write.length ? transaction.objectStore('kv').put(write[0], key) : transaction.objectStore('kv').get(key);
            let value;
            request.onsuccess = () => { value = request.result; };
            transaction.oncomplete = () => resolve(value);
            transaction.onerror = transaction.onabort = () => reject(transaction.error);
          });
        } finally { db.close(); }
      };
      window.codeOf = async operation => { try { await operation(); return 'unexpected_success'; } catch (error) { return error.code; } };
    });
    return await run(page);
  } finally { await context.close(); }
}

test('pure JSON helpers provide stable identities and independent copies', async () => {
  assert.equal(canonical({ b: 2, a: [3, { z: 1, c: 0 }] }), '{"a":[3,{"c":0,"z":1}],"b":2}');
  assert.equal(await digest({ b: 2, a: 1 }), await digest({ a: 1, b: 2 }));
  assert.equal(await digest('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const original = { matters: [{ state: 'waiting' }] }, copied = clone(original);
  copied.matters[0].state = 'changed';
  assert.equal(original.matters[0].state, 'waiting');
});

test('durable snapshots isolate chats and lineages and leave legacy values untouched', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore();
    await raw('world:v1:scope:branch-a', 'legacy-world-sentinel');
    await raw('profiles:v1:scope:branch-a', 'legacy-profile-sentinel');
    const input = fixture();
    const saved = await store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: input });
    input.snapshot.matters[0].state = 'input-mutated';
    saved.snapshot.matters[0].state = 'result-mutated';
    const restored = await guide.createGuideStore().read('scope', 'branch-a');
    return { restored, otherScope: await store.read('elsewhere', 'branch-a'), otherBranch: await store.read('scope', 'branch-b'),
      oldWorld: await raw('world:v1:scope:branch-a'), oldProfiles: await raw('profiles:v1:scope:branch-a') };
  }));
  assert.equal(result.restored.revision, 1);
  assert.equal(result.restored.schemaVersion, 1);
  assert.equal(result.restored.snapshot.matters[0].state, 'waiting');
  assert.equal(result.restored.custom.kept, true);
  assert.equal(result.otherScope, null);
  assert.equal(result.otherBranch, null);
  assert.equal(result.oldWorld, 'legacy-world-sentinel');
  assert.equal(result.oldProfiles, 'legacy-profile-sentinel');
});

test('independent store instances cannot both commit the same expected revision', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const stores = [guide.createGuideStore(), guide.createGuideStore()];
    const attempts = await Promise.allSettled(stores.map((store, index) => store.commit({ scopeKey: 'scope', branchKey: 'branch-a',
      expectedRevision: 0, record: fixture('branch-a', `reply-${index}`) })));
    return { results: attempts.map(result => result.status === 'fulfilled' ? 'saved' : result.reason.code),
      saved: await stores[0].read('scope', 'branch-a') };
  }));
  assert.deepEqual(result.results.sort(), ['guide_revision_changed', 'saved']);
  assert.equal(result.saved.revision, 1);
  assert.ok(['reply-0', 'reply-1'].includes(result.saved.target.identity));
});

test('stale source before the write creates no snapshot', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore();
    const code = await codeOf(() => store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: fixture(),
      assertCurrent: () => { throw guide.fault('stale_reply', 'Synthetic stale reply'); } }));
    return { code, saved: await store.read('scope', 'branch-a'), raw: await raw(keyFor('scope', 'branch-a')) };
  }));
  assert.equal(result.code, 'stale_reply');
  assert.equal(result.saved, null);
  assert.equal(result.raw, undefined);
});

test('stale source after write restores the exact previous complete record', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore(), key = keyFor('scope', 'branch-a');
    await store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: fixture() });
    const before = await raw(key);
    let checks = 0;
    const code = await codeOf(() => store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 1,
      record: fixture('branch-a', 'recomputed-reply'), assertCurrent: () => {
        if (++checks === 3) throw guide.fault('stale_reply', 'Synthetic source changed while saving');
      } }));
    return { code, before, after: await raw(key), saved: await store.read('scope', 'branch-a') };
  }));
  assert.equal(result.code, 'stale_reply');
  assert.equal(result.after, result.before);
  assert.equal(result.saved.revision, 1);
  assert.equal(result.saved.target.identity, 'reply-a');
});

test('stale first write becomes an owned empty tombstone and can be retried from revision zero', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore();
    let checks = 0;
    const code = await codeOf(() => store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: fixture(),
      assertCurrent: () => { if (++checks === 3) throw guide.fault('stale_reply', 'Synthetic stale first result'); } }));
    const restored = await store.read('scope', 'branch-a'), tombstone = JSON.parse(await raw(keyFor('scope', 'branch-a')));
    const retried = await store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: fixture() });
    return { code, restored, tombstone, retried };
  }));
  assert.equal(result.code, 'stale_reply');
  assert.equal(result.restored, null);
  assert.equal(result.tombstone.tombstone, true);
  assert.equal(result.tombstone.revision, 0);
  assert.equal(result.retried.revision, 1);
});

test('compensation refuses to overwrite a newer third-party version', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore(), key = keyFor('scope', 'branch-a');
    let checks = 0, newerRaw;
    const code = await codeOf(() => store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: fixture(),
      assertCurrent: async () => {
        if (++checks !== 3) return;
        const newer = JSON.parse(await raw(key));
        newer.revision = 2;
        newer.target.identity = 'newer-reply';
        newerRaw = guide.canonical(newer);
        await raw(key, newerRaw);
        throw guide.fault('stale_reply', 'Synthetic concurrent result');
      } }));
    return { code, newerRaw, after: await raw(key), saved: await store.read('scope', 'branch-a') };
  }));
  assert.equal(result.code, 'guide_store_uncertain');
  assert.equal(result.after, result.newerRaw);
  assert.equal(result.saved.revision, 2);
  assert.equal(result.saved.target.identity, 'newer-reply');
});

test('failure of the independent readback restores the previously confirmed record', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore(), key = keyFor('scope', 'branch-a');
    await store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: fixture() });
    const before = await raw(key), original = IDBDatabase.prototype.transaction;
    let failReadback = true, code;
    IDBDatabase.prototype.transaction = function (stores, mode, ...options) {
      if (mode === 'readonly' && failReadback) { failReadback = false; throw new Error('Synthetic readback failure'); }
      return original.call(this, stores, mode, ...options);
    };
    try {
      code = await codeOf(() => store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 1,
        record: fixture('branch-a', 'new-result') }));
    } finally { IDBDatabase.prototype.transaction = original; }
    return { code, before, after: await raw(key) };
  }));
  assert.equal(result.code, 'guide_store_read');
  assert.equal(result.after, result.before);
});

test('corrupt data fails closed without replacing it with an empty state', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore(), key = keyFor('scope', 'branch-a');
    await raw(key, '{broken');
    const readCode = await codeOf(() => store.read('scope', 'branch-a'));
    const commitCode = await codeOf(() => store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: fixture() }));
    return { readCode, commitCode, after: await raw(key) };
  }));
  assert.equal(result.readCode, 'guide_store_corrupt');
  assert.equal(result.commitCode, 'guide_store_corrupt');
  assert.equal(result.after, '{broken');
});

test('refresh reads only and retains the fixed same-floor before snapshot', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore(), record = fixture();
    record.beforeSnapshot.matters = [{ id: 'shield', state: 'damaged' }];
    await store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record });
    const original = IDBDatabase.prototype.transaction, modes = [];
    IDBDatabase.prototype.transaction = function (stores, mode, ...options) {
      modes.push(mode);
      return original.call(this, stores, mode, ...options);
    };
    let restored, absent;
    try {
      const refreshed = guide.createGuideStore();
      restored = await refreshed.read('scope', 'branch-a');
      absent = await refreshed.read('scope', 'missing-branch');
    } finally { IDBDatabase.prototype.transaction = original; }
    return { restored, absent, modes };
  }));
  assert.deepEqual(result.modes, ['readonly', 'readonly']);
  assert.equal(result.absent, null);
  assert.equal(result.restored.beforeSnapshot.matters[0].state, 'damaged');
  assert.equal(result.restored.snapshot.matters[0].state, 'waiting');
});

test('chat and branch separators cannot collide', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore();
    await store.commit({ scopeKey: 'a:b', branchKey: 'c', expectedRevision: 0, record: fixture('c', 'one') });
    await store.commit({ scopeKey: 'a', branchKey: 'b:c', expectedRevision: 0, record: fixture('b:c', 'two') });
    return [(await store.read('a:b', 'c')).target.identity, (await store.read('a', 'b:c')).target.identity];
  }));
  assert.deepEqual(result, ['one', 'two']);
});

test('invalid lineage and duplicate coverage keys cannot enter storage', async () => {
  const result = await withPage(page => page.evaluate(async () => {
    const store = guide.createGuideStore(), duplicate = fixture();
    duplicate.coveredReplyKeys.push('reply-a');
    const wrongLineage = await codeOf(() => store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: fixture('other') }));
    const duplicateCoverage = await codeOf(() => store.commit({ scopeKey: 'scope', branchKey: 'branch-a', expectedRevision: 0, record: duplicate }));
    return { wrongLineage, duplicateCoverage, saved: await store.read('scope', 'branch-a') };
  }));
  assert.equal(result.wrongLineage, 'guide_store_corrupt');
  assert.equal(result.duplicateCoverage, 'guide_store_corrupt');
  assert.equal(result.saved, null);
});
