import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldRuntime } from '../world/runtime.mjs';
import { createWorldStore } from '../world/store.mjs';
import { canonical } from '../modular/variables/core.mjs';

const scopeSignature = scopeKey => canonical({ scopeKey });
const waitFor = async (predicate, timeout = 1200) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail('bounded wait timed out');
};
function kvFixture() {
  const data = new Map(); const calls = [];
  return { data, calls, kv: {
    async read(key) { calls.push(['read', key]); return data.has(key) ? structuredClone(data.get(key)) : null; },
    async write(key, value) { calls.push(['write', key]); data.set(key, structuredClone(value)); return structuredClone(value); },
  } };
}
function source() { const listeners = new Map(); return { on: (n, f) => listeners.set(n, f), removeListener: (n, f) => { if (listeners.get(n) === f) listeners.delete(n); }, emit: async (n, ...a) => listeners.get(n)?.(...a) }; }
const makeBranch = (scopeKey = 'chat-a', index = 10) => ({ scopeKey, lineage: `${scopeKey}-lineage-${index}`, index });
function makeHarness({ existing = null, p2Busy = false, engineMode = 'success', startBranch = makeBranch() } = {}) {
  const f = kvFixture(); const store = createWorldStore(f.kv); const events = source(); const branch = startBranch; let currentBranch = branch; let branchHistory = [branch];
  const receipt = { identity: 'target-a', afterHash: 'mvu-a', readback: true, target: { index: branch.index, scopeKey: branch.scopeKey, scopeSignature: scopeSignature(branch.scopeKey), identity: 'target-a', swipeId: 0, content: 'accepted body' }, content: 'accepted body' }; let currentReceipt = receipt;
  let profile = { branch, profileRecordHash: 'profile-a', heldProfiles: [], profiles: [{ profileId: 'p1' }], variableIdentity: receipt.identity, mvuHash: receipt.afterHash, index: branch.index, scopeKey: branch.scopeKey, lineage: branch.lineage, revision: 1 };
  let p2 = { status: p2Busy ? 'running' : 'complete', busy: p2Busy, readback: !p2Busy }; let p1 = { status: 'applied', busy: false, readback: true }; let doctorCallback = null;
  const context = { eventSource: events, extensionSettings: {}, prompt: '', chat: [], setExtensionPrompt(_key, value) { context.prompt = value; } };
  if (existing) f.data.set(`world:v1:${existing.scopeKey}:${existing.lineage}`, structuredClone(existing));
  const counters = { factory: 0, evolve: 0, model: 0, gate: null };
  const host = {
    context: () => context, scope: () => ({ scopeKey: currentBranch.scopeKey }), branches: async () => branchHistory, latestIndex: () => currentBranch.index, receipt: () => currentReceipt,
    doctor: () => ({ status: () => p1, subscribe: (_id, fn) => { doctorCallback = fn; return () => { doctorCallback = null; }; } }), profilesApi: () => ({ status: () => p2, record: () => structuredClone(profile) }),
    capture: async () => ({ scopeSignature: scopeSignature(currentBranch.scopeKey), identity: currentReceipt.target.identity, index: currentBranch.index }), delay: async () => {}, settings: () => ({ enabled: true }), captureProfiles: async () => structuredClone(profile),
    assertSnapshot: async (_receipt, snapshot) => { if (snapshot && snapshot.profileRecordHash !== profile.profileRecordHash) throw Object.assign(new Error('stale profiles'), { code: 'stale_profiles' }); if (snapshot && (snapshot.branch.scopeKey !== currentBranch.scopeKey || snapshot.branch.lineage !== currentBranch.lineage || snapshot.branch.index !== currentBranch.index)) throw Object.assign(new Error('stale target'), { code: 'stale_target' }); },
    inputFor: async () => ({ narrative: 'bounded input' }), callModel: async () => { counters.model++; return '{"controlled":true}'; },
  };
  const engineFactory = options => { counters.factory++; const base = structuredClone(options.world || { round: 0 }); return { state: () => structuredClone(base), abort() {}, dispose() {}, async evolve() { counters.evolve++; if (counters.gate) await counters.gate; await options.callModel('controlled engine request', options.signal); if (engineMode === 'fail') return { ok: false, state: base, debug: {} }; return { ok: true, state: { ...base, round: Number(base.round || 0) + 1, worldDigest: `round-${Number(base.round || 0) + 1}` }, debug: { controlled: true } }; } }; };
  const runtime = createWorldRuntime({ host, store, notify: () => {}, engineFactory });
  return { f, store, runtime, host, events, branch, receipt, counters, context, setProfiles: next => { profile = next; }, setP2: next => { p2 = next; }, setBranch: next => { currentBranch = next; branchHistory = [next]; }, addBranch: next => { currentBranch = next; branchHistory = [...branchHistory, next]; }, notifyDoctor: () => doctorCallback?.(), key: b => `world:v1:${b.scopeKey}:${b.lineage}` };
}
function recordFor(b, overrides = {}) { return { version: '0.1.0-candidate.1', scopeKey: b.scopeKey, lineage: b.lineage, index: b.index, revision: 2, status: 'complete', world: { round: 0, worldDigest: 'baseline' }, baselineWorld: { round: 0 }, deliveries: [], baseDeliveries: [], ...overrides }; }

test('P2 readiness gates P1 and a new P2 revision callback starts exactly one run', async () => {
  const h = makeHarness({ p2Busy: true }); await h.runtime.bind(); await h.notifyDoctor(); assert.equal(h.counters.factory, 0);
  h.setProfiles({ ...h.host.profilesApi().record(), profileRecordHash: 'profile-b', revision: 2 }); h.setP2({ status: 'complete', busy: false, readback: true }); await h.notifyDoctor(); await waitFor(() => h.counters.factory === 1 && h.runtime.snapshot().status === 'complete');
  await h.notifyDoctor(); await h.notifyDoctor();
  assert.equal(h.counters.evolve, 1); h.runtime.destroy();
});
test('manual retries use the same stored baseline and persist the engine request', async () => {
  const h = makeHarness({ existing: recordFor(makeBranch()) }); await h.runtime.run(h.receipt, true); const first = await h.store.read(h.branch); await h.runtime.run(h.receipt, true); const second = await h.store.read(h.branch);
  assert.equal(h.counters.factory, 2); assert.equal(h.counters.evolve, 2); assert.equal(first.world.round, 1); assert.equal(second.world.round, 1); assert.ok(second.review.requests.length >= 1); assert.equal(h.counters.model, 2); h.runtime.destroy();
});
test('failed generation keeps the complete world and delivery ledger', async () => {
  const b = makeBranch(); const d = { id: 'd1', status: 'pending', kind: 'event', content: 'held' }; const h = makeHarness({ engineMode: 'fail', existing: recordFor(b, { world: { round: 4, worldDigest: 'complete' }, baselineWorld: { round: 4 }, deliveries: [d], baseDeliveries: [d] }) });
  await h.runtime.run(h.receipt, true); const saved = await h.store.read(b); assert.equal(saved.status, 'failed'); assert.equal(saved.world.worldDigest, 'complete'); assert.equal(saved.deliveries[0].status, 'pending'); h.runtime.destroy();
});
test('profile change invalidates a running candidate before complete commit', async () => {
  const h = makeHarness(); let release; h.counters.gate = new Promise(resolve => { release = resolve; }); const run = h.runtime.run(h.receipt, true); await waitFor(() => h.counters.evolve === 1); h.setProfiles({ ...h.host.profilesApi().record(), profileRecordHash: 'profile-new', revision: 2 }); release(); await run;
  assert.equal(h.runtime.snapshot().status, 'cancelled'); assert.equal(h.f.data.get(h.key(h.branch)).status, 'running'); assert.equal(h.f.calls.filter(([kind]) => kind === 'write').length, 1); h.runtime.destroy();
});
test('a fresh runtime bind reads running state without replaying the old receipt', async () => {
  const b = makeBranch(); const h = makeHarness({ existing: recordFor(b, { status: 'running' }) });
  await h.runtime.bind(); await h.notifyDoctor();
  assert.equal(h.counters.factory, 0); assert.equal((await h.store.read(b)).status, 'running'); h.runtime.destroy();
});
test('recall settles only for the bound target, and a different chat reads null', async () => {
  async function prepare(mismatch) {
    const b = makeBranch('chat-a', 9);
    const d = { id: 'd1', kind: 'event', content: '公开事件', status: 'pending', evidenceTerms: ['公开事件'] };
    const h = makeHarness({ startBranch: b, existing: recordFor(b, { deliveries: [d], baseDeliveries: [d] }) });
    await h.runtime.bind(); await h.events.emit('generation_started', 'normal');
    assert.match(h.context.prompt, /公开事件/u);
    await h.events.emit('chat_completion_prompt_ready', h.context.prompt);
    const next = makeBranch('chat-a', 10); h.addBranch(next);
    h.receipt.target.index = 10; h.receipt.target.content = '公开事件'; h.receipt.target.identity = 'accepted-target-b';
    h.setProfiles({ ...h.host.profilesApi().record(), index: 10, branch: next, lineage: next.lineage });
    await h.events.emit('generation_ended');
    if (mismatch) h.receipt.target.identity = 'replacement-target-c';
    await h.runtime.run(h.receipt, true);
    return { h, saved: await h.store.read(next) };
  }
  const valid = await prepare(false);
  try { assert.equal(valid.saved.deliveries[0].status, 'consumed'); }
  finally { valid.h.runtime.destroy(); }
  const wrong = await prepare(true);
  try {
    assert.equal(wrong.saved.deliveries[0].status, 'pending');
    wrong.h.setBranch(makeBranch('chat-b', 20)); await wrong.h.runtime.refresh();
    assert.equal(wrong.h.runtime.record(), null);
  } finally { wrong.h.runtime.destroy(); }
});
