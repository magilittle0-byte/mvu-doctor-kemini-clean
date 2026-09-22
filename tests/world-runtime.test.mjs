import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldRuntime, WORLD_VERSION } from '../world/runtime.mjs';
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
function makeHarness({ existing = null, p2Busy = false, engineMode = 'success', startBranch = makeBranch(), priorBranches = [] } = {}) {
  const f = kvFixture(); const store = createWorldStore(f.kv); const events = source(); const branch = startBranch; let currentBranch = branch; let branchHistory = [...priorBranches, branch];
  const receipt = { identity: 'target-a', afterHash: 'mvu-a', configHash: 'config-a', readback: true,
    target: { index: branch.index, userIndex: branch.index - 1, scopeKey: branch.scopeKey,
      scopeSignature: scopeSignature(branch.scopeKey), identity: 'target-a', swipeId: 0, content: 'accepted body' }, content: 'accepted body' }; let currentReceipt = receipt;
  let profile = { branch, profileRecordHash: 'profile-a', heldProfiles: [],
    profiles: [{ profileId: 'p1', rowId: 'row-1', updatedAt: 'time-1', presence: 'present', lastSeenIndex: branch.index,
      sourceEvidence: ['stable evidence'], name: 'Mira', currentState: { location: '北门' }, unknownSemanticField: { fact: 'stable fact' } }],
    variableIdentity: receipt.identity, mvuHash: receipt.afterHash, index: branch.index, scopeKey: branch.scopeKey, lineage: branch.lineage, revision: 1 };
  let inputFacts = { mvu: { clock: '00:01', actors: [{ id: 'p1', location: '北门' }] },
    authority: { card: 'card facts', world: 'world facts' }, players: ['player'], globalPrompt: 'global rules' };
  let maxTokens = 4096;
  let p2 = { status: p2Busy ? 'running' : 'complete', busy: p2Busy, readback: !p2Busy }; let p1 = { status: 'applied', busy: false, readback: true }; let doctorCallback = null;
  const context = { eventSource: events, extensionSettings: {}, prompt: '', chat: [], setExtensionPrompt(_key, value) { context.prompt = value; } };
  if (existing) f.data.set(`world:v1:${existing.scopeKey}:${existing.lineage}`, structuredClone(existing));
  const counters = { factory: 0, evolve: 0, model: 0, gate: null }; let lastInstruction = '';
  const host = {
    context: () => context, scope: () => ({ scopeKey: currentBranch.scopeKey }), branches: async () => branchHistory, latestIndex: () => currentBranch.index, receipt: () => currentReceipt,
    doctor: () => ({ status: () => p1, subscribe: (_id, fn) => { doctorCallback = fn; return () => { doctorCallback = null; }; } }), profilesApi: () => ({ status: () => p2, record: () => structuredClone(profile) }),
    capture: async () => ({ scopeSignature: scopeSignature(currentBranch.scopeKey), identity: currentReceipt.target.identity, index: currentBranch.index }), delay: async () => {}, settings: () => ({ enabled: true }), captureProfiles: async () => structuredClone(profile),
    assertSnapshot: async (_receipt, snapshot) => { if (snapshot && snapshot.profileRecordHash !== profile.profileRecordHash) throw Object.assign(new Error('stale profiles'), { code: 'stale_profiles' }); if (snapshot && (snapshot.branch.scopeKey !== currentBranch.scopeKey || snapshot.branch.lineage !== currentBranch.lineage || snapshot.branch.index !== currentBranch.index)) throw Object.assign(new Error('stale target'), { code: 'stale_target' }); },
    inputFor: async (acceptedReceipt, snapshot) => ({ target: structuredClone(acceptedReceipt.target),
      narrative: 'accepted narrative', userText: 'accepted user text', ...structuredClone(inputFacts),
      profiles: structuredClone(snapshot.profiles), heldProfiles: structuredClone(snapshot.heldProfiles),
      profileRecordHash: snapshot.profileRecordHash }),
    modelContract: acceptedReceipt => ({ receiptConfigHash: String(acceptedReceipt.configHash || ''), maxTokens }),
    callModel: async () => { counters.model++; return '{"controlled":true}'; },
  };
  const engineFactory = options => { counters.factory++; lastInstruction = options.instruction; const base = structuredClone(options.world || { round: 0 }); return { state: () => structuredClone(base), abort() {}, dispose() {}, async evolve() { counters.evolve++; if (counters.gate) await counters.gate; await options.callModel('controlled engine request', options.signal); if (engineMode === 'fail') return { ok: false, state: base, debug: {} }; return { ok: true, state: { ...base, round: Number(base.round || 0) + 1, worldDigest: `round-${Number(base.round || 0) + 1}` }, debug: { controlled: true } }; } }; };
  const runtime = createWorldRuntime({ host, store, notify: () => {}, engineFactory });
  return { f, store, runtime, host, events, branch, receipt, counters, context,
    setProfiles: next => { profile = next; }, getInstruction: () => lastInstruction, setInputFacts: patch => { inputFacts = { ...inputFacts, ...patch }; },
    setMaxTokens: value => { maxTokens = value; }, setP1: next => { p1 = next; }, setP2: next => { p2 = next; },
    setBranch: next => { currentBranch = next; branchHistory = [next]; }, addBranch: next => { currentBranch = next; branchHistory = [...branchHistory, next]; },
    notifyDoctor: () => doctorCallback?.(), key: b => `world:v1:${b.scopeKey}:${b.lineage}` };
}
function recordFor(b, overrides = {}) { return { version: WORLD_VERSION, scopeKey: b.scopeKey, lineage: b.lineage, index: b.index, revision: 2, status: 'complete', world: { round: 0, worldDigest: 'baseline' }, baselineWorld: { round: 0 }, deliveries: [], baseDeliveries: [], ...overrides }; }

test('P2 readiness gates P1 and a new P2 revision callback starts exactly one run', async () => {
  const h = makeHarness({ p2Busy: true }); await h.runtime.bind(); await h.notifyDoctor(); assert.equal(h.counters.factory, 0);
  h.setProfiles({ ...h.host.profilesApi().record(), profileRecordHash: 'profile-b', revision: 2 }); h.setP2({ status: 'complete', busy: false, readback: true }); await h.notifyDoctor(); await waitFor(() => h.counters.factory === 1 && h.runtime.snapshot().status === 'complete');
  await h.notifyDoctor(); await h.notifyDoctor();
  assert.equal(h.counters.evolve, 1); h.runtime.destroy();
});
test('manual repair forces one call even when an exact complete result is reusable', async () => {
  const h = makeHarness();
  await h.runtime.run(h.receipt); const first = await h.store.read(h.branch);
  await h.runtime.run(h.receipt, true); const second = await h.store.read(h.branch);
  assert.equal(h.counters.factory, 2); assert.equal(h.counters.evolve, 2);
  assert.equal(first.world.round, 1); assert.equal(second.world.round, 1);
  assert.ok(second.review.requests.length >= 1); assert.equal(h.counters.model, 2); h.runtime.destroy();
});

test('P2 diagnostic-only changes rebind the complete result without another model call', async () => {
  const h = makeHarness();
  try {
    await h.runtime.run(h.receipt);
    const first = await h.store.read(h.branch);
    const writesBefore = h.f.calls.filter(([kind]) => kind === 'write').length;
    const profiles = h.host.profilesApi().record();
    profiles.profileRecordHash = 'profile-after-diagnostics'; profiles.revision = 2;
    profiles.profiles[0] = { ...profiles.profiles[0], rowId: 'row-2', updatedAt: 'time-2' };
    h.setProfiles(profiles);
    await h.runtime.run(h.receipt);
    const rebound = await h.store.read(h.branch);
    assert.equal(h.counters.model, 1);
    assert.equal(h.counters.evolve, 1);
    assert.equal(rebound.status, 'complete');
    assert.equal(rebound.profileRecordHash, 'profile-after-diagnostics');
    assert.equal(rebound.review.input.profiles[0].rowId, 'row-2');
    assert.equal(rebound.review.input.profiles[0].updatedAt, 'time-2');
    assert.deepEqual(rebound.world, first.world);
    assert.equal(h.f.calls.filter(([kind]) => kind === 'write').length, writesBefore + 1);
    assert.deepEqual(h.runtime.record(), rebound);
  } finally { h.runtime.destroy(); }
});

test('semantic changes to the exact input, baseline, recall, or model contract force one world call', async t => {
  const cases = [
    ['exact target', h => { h.receipt.target.content = 'new accepted body'; }],
    ['MVU facts', h => { h.setInputFacts({ mvu: { clock: '00:02', actors: [{ id: 'p1', location: '桥上' }] } }); }],
    ['complete profile facts', h => {
      const profiles = h.host.profilesApi().record(); profiles.profileRecordHash = 'profile-fact-change'; profiles.revision++;
      profiles.profiles[0] = { ...profiles.profiles[0], unknownSemanticField: { fact: 'changed fact' } }; h.setProfiles(profiles);
    }],
    ['held profile facts', h => {
      const profiles = h.host.profilesApi().record(); profiles.profileRecordHash = 'held-profile-change'; profiles.revision++;
      profiles.heldProfiles = [{ profileId: 'p2', reason: 'profile_incomplete' }]; h.setProfiles(profiles);
    }],
    ['authority facts', h => { h.setInputFacts({ authority: { card: 'changed card', world: 'world facts' } }); }],
    ['global prompt', h => { h.setInputFacts({ globalPrompt: 'changed global rules' }); }],
    ['model route and token contract', h => { h.receipt.configHash = 'config-b'; h.setMaxTokens(8192); }],
    ['world baseline', h => {
      const row = h.f.data.get(h.key(h.branch)); row.baselineWorld = { ...row.baselineWorld, worldDigest: 'changed baseline' };
      h.f.data.set(h.key(h.branch), row);
    }],
    ['effective recall proof', h => {
      const row = h.f.data.get(h.key(h.branch)); row.review.incomingRecall = {
        promptHash: 'effective-recall-hash', deliveryIds: ['delivery-1'], sourceLineage: 'prior-lineage',
        sourceScopeKey: 'prior-scope', generationId: 'generation-1', generationType: 'normal',
        scope: h.receipt.target.scopeSignature, baselineIndex: h.branch.index - 1,
        targetIdentity: h.receipt.target.identity, promptObserved: true,
      };
      h.f.data.set(h.key(h.branch), row);
    }],
  ];
  for (const [name, mutate] of cases) await t.test(name, async () => {
    const h = makeHarness();
    try {
      await h.runtime.run(h.receipt);
      assert.equal(h.counters.model, 1);
      mutate(h);
      await h.runtime.run(h.receipt);
      assert.equal(h.counters.model, 2);
      assert.equal((await h.store.read(h.branch)).status, 'complete');
    } finally { h.runtime.destroy(); }
  });
});

test('failed, running, and partial records cannot skip a new attempt', async t => {
  for (const status of ['failed', 'running', 'partial']) await t.test(status, async () => {
    const h = makeHarness();
    try {
      await h.runtime.run(h.receipt);
      const row = h.f.data.get(h.key(h.branch)); row.status = status; h.f.data.set(h.key(h.branch), row);
      await h.runtime.run(h.receipt);
      assert.equal(h.counters.model, 2);
      assert.equal(h.counters.evolve, 2);
      assert.equal((await h.store.read(h.branch)).status, 'complete');
    } finally { h.runtime.destroy(); }
  });
});

test('a new same-target generation ticket cannot reuse the old generation result', async () => {
  const h = makeHarness();
  try {
    await h.runtime.bind();
    await h.events.emit('generation_started', 'regenerate');
    await h.runtime.run(h.receipt);
    const first = await h.store.read(h.branch);
    assert.ok(first.review.targetGeneration?.generationId);
    await h.events.emit('generation_started', 'regenerate');
    await h.runtime.run(h.receipt);
    const second = await h.store.read(h.branch);
    assert.ok(second.review.targetGeneration?.generationId);
    assert.notEqual(second.review.targetGeneration.generationId, first.review.targetGeneration.generationId);
    assert.equal(h.counters.model, 2);
  } finally { h.runtime.destroy(); }
});

for (const upstream of ['variables', 'profiles']) test(`unchanged ${upstream} repair restores the saved world without another model call or write`, async () => {
  const h = makeHarness();
  try {
    await h.runtime.bind(); await h.runtime.run(h.receipt, true);
    const saved = await h.store.read(h.branch);
    const writes = h.f.calls.filter(([kind]) => kind === 'write').length;
    if (upstream === 'variables') h.setP1({ status: 'checking', busy: true, inFlight: 1 });
    else h.setP2({ status: 'generating', busy: true });
    await h.notifyDoctor(); await waitFor(() => h.runtime.snapshot().status === 'waiting');
    assert.deepEqual(h.runtime.record(), saved);
    if (upstream === 'variables') h.setP1({ status: 'model_nochange', busy: false, inFlight: 0, readback: true });
    else h.setP2({ status: 'restored', busy: false, readback: true });
    await h.notifyDoctor();
    await waitFor(() => h.runtime.snapshot().status === 'restored' && !h.runtime.snapshot().busy);
    await h.notifyDoctor(); await h.notifyDoctor();
    assert.equal(h.runtime.snapshot().readback, true);
    assert.deepEqual(h.runtime.record(), saved);
    assert.deepEqual(await h.store.read(h.branch), saved);
    assert.equal(h.counters.factory, 1); assert.equal(h.counters.evolve, 1); assert.equal(h.counters.model, 1);
    assert.equal(h.f.calls.filter(([kind]) => kind === 'write').length, writes);
  } finally { h.runtime.destroy(); }
});

test('a new upstream recovery permits one retry of a failed world and later callbacks do not loop', async () => {
  const h = makeHarness({ engineMode: 'fail' });
  try {
    await h.runtime.bind(); await h.runtime.run(h.receipt, true);
    const saved = await h.store.read(h.branch);
    const writes = h.f.calls.filter(([kind]) => kind === 'write').length;
    assert.equal(saved.status, 'failed');
    h.setP1({ status: 'checking', busy: true, inFlight: 1 });
    await h.notifyDoctor(); await waitFor(() => h.runtime.snapshot().status === 'waiting');
    h.setP1({ status: 'model_nochange', busy: false, inFlight: 0, readback: true });
    await h.notifyDoctor(); await waitFor(() => h.runtime.snapshot().status === 'failed' && !h.runtime.snapshot().busy);
    await h.notifyDoctor(); await h.notifyDoctor();
    const retried = await h.store.read(h.branch);
    assert.equal(retried.status, 'failed'); assert.equal(retried.revision, saved.revision + 2);
    assert.deepEqual(retried.world, saved.world);
    assert.equal(h.counters.model, 2);
    assert.equal(h.f.calls.filter(([kind]) => kind === 'write').length, writes + 2);
  } finally { h.runtime.destroy(); }
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

test('late chat restoration reads the saved world without rerolling dynamic authority', async () => {
  const h = makeHarness();
  try {
    await h.runtime.bind();
    await h.runtime.run(h.receipt);
    const saved = await h.store.read(h.branch);
    const writes = h.f.calls.filter(([kind]) => kind === 'write').length;
    h.receipt.restored = true;
    h.setP2({ status: 'restored', restored: true, busy: false, readback: true });
    h.setInputFacts({ authority: { card: 'card facts', world: 'same rules with a newly rendered dice pool' } });
    await h.events.emit('chat_loaded');
    await waitFor(() => h.runtime.snapshot().restored && !h.runtime.snapshot().busy);
    await h.notifyDoctor();
    await new Promise(resolve => setTimeout(resolve, 30));
    await h.notifyDoctor();
    assert.equal(h.counters.model, 1);
    assert.equal(h.runtime.snapshot().restored, true);
    assert.deepEqual(await h.store.read(h.branch), saved);
    assert.equal(h.f.calls.filter(([kind]) => kind === 'write').length, writes);

    // A real P2 repair completion still invalidates/rechecks dependent work.
    const profiles = h.host.profilesApi().record();
    h.setProfiles({ ...profiles, profileRecordHash: 'new-profile-facts', revision: profiles.revision + 1 });
    h.setP2({ status: 'complete', restored: false, busy: false, readback: true });
    await h.notifyDoctor();
    await waitFor(() => h.counters.model === 2 && !h.runtime.snapshot().busy);
    assert.equal((await h.store.read(h.branch)).world.round, saved.world.round);
    await h.runtime.retry();
    assert.equal(h.counters.model, 3);
  } finally { h.runtime.destroy(); }
});

test('restoring late upstream records does not retry an absent or incomplete world', async t => {
  for (const status of [null, 'running', 'failed', 'partial']) await t.test(String(status), async () => {
    const b = makeBranch();
    const h = makeHarness({ startBranch: b, p2Busy: true,
      existing: status ? recordFor(b, { status }) : null });
    try {
      await h.runtime.bind();
      await h.events.emit('chat_loaded');
      await h.notifyDoctor();
      h.receipt.restored = true;
      h.setP2({ status: 'restored', restored: true, busy: false, readback: true });
      await h.notifyDoctor();
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.equal(h.counters.model, 0);
      assert.equal(h.counters.factory, 0);
      assert.equal(h.f.calls.filter(([kind]) => kind === 'write').length, 0);
      assert.equal((await h.store.read(b))?.status ?? null, status);
    } finally { h.runtime.destroy(); }
  });
});
test('recall settles only for the bound target, and a different chat reads null', async () => {
  async function prepare(mismatch) {
    const b = makeBranch('chat-a', 9);
    const d = { id: 'd1', kind: 'event', content: '公开事件', status: 'pending', evidenceTerms: ['公开事件'] };
    const h = makeHarness({ startBranch: b, existing: recordFor(b, { deliveries: [d], baseDeliveries: [d] }) });
    await h.runtime.bind(); await h.events.emit('generation_started', 'normal');
    assert.match(h.context.prompt, /公开事件/u);
    await h.events.emit('chat_completion_prompt_ready', h.context.prompt);
    const next = makeBranch('chat-a', 11); h.addBranch(next);
    h.receipt.target.index = 11; h.receipt.target.userIndex = 10;
    h.receipt.target.content = '公开事件'; h.receipt.target.identity = 'accepted-target-b';
    h.receipt.identity = 'accepted-target-b';
    h.setProfiles({ ...h.host.profilesApi().record(), variableIdentity: h.receipt.identity, index: 11, branch: next, lineage: next.lineage });
    // A global END (including an auxiliary request END) is not authoritative
    // for recall. The injection remains until the accepted P1 receipt settles it.
    await h.events.emit('generation_ended');
    assert.match(h.context.prompt, /公开事件/u);
    await h.runtime.run(h.receipt, true);
    if (mismatch) {
      // The accepted B receipt has already settled the recall. A later C
      // receipt cannot borrow B's proof, even on the same branch and floor.
      h.receipt.target.identity = 'replacement-target-c'; h.receipt.identity = 'replacement-target-c';
      h.setProfiles({ ...h.host.profilesApi().record(), variableIdentity: h.receipt.identity,
        profileRecordHash: 'profile-c', revision: 2 });
      await h.runtime.run(h.receipt, true);
    }
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

for (const type of ['regenerate', 'continue', 'swipe']) test(`accepted receipt settles ${type} recall only on the same target index`, async () => {
  const b = makeBranch('chat-a', 10);
  const prior = makeBranch('chat-a', 9);
  const d = { id: `d-${type}`, kind: 'event', content: '同楼事件', status: 'pending', evidenceTerms: ['同楼事件'] };
  const h = makeHarness({ startBranch: b, priorBranches: [prior], existing: recordFor(prior, { deliveries: [d], baseDeliveries: [d] }) });
  try {
    await h.runtime.bind(); await h.events.emit('generation_started', type);
    await waitFor(() => h.context.prompt.includes('同楼事件'));
    await h.events.emit('chat_completion_prompt_ready', h.context.prompt);
    h.receipt.target.content = '同楼事件'; h.receipt.target.identity = `${type}-target`;
    await h.runtime.run(h.receipt, true);
    assert.equal((await h.store.read(b)).deliveries[0].status, 'consumed');
  } finally { h.runtime.destroy(); }
});

test('invalid accepted receipt does not settle recall', async () => {
  const b = makeBranch('chat-a', 10);
  const d = { id: 'd-invalid', kind: 'event', content: '无效回合事件', status: 'pending', evidenceTerms: ['无效回合事件'] };
  const h = makeHarness({ startBranch: b, existing: recordFor(b, { deliveries: [d], baseDeliveries: [d] }) });
  try {
    await h.runtime.bind(); await h.events.emit('generation_started', 'normal');
    await h.events.emit('chat_completion_prompt_ready', h.context.prompt);
    const prompt = h.context.prompt, next = makeBranch('chat-a', 12); h.addBranch(next);
    h.receipt.target.index = 12; h.receipt.target.userIndex = 11;
    h.receipt.target.content = '无效回合事件'; h.receipt.target.identity = 'invalid-target';
    h.host.assertSnapshot = async () => { throw Object.assign(new Error('P1 not ready'), { code: 'variables_not_ready' }); };
    await h.runtime.run(h.receipt, true);
    assert.equal((await h.store.read(b)).deliveries[0].status, 'pending');
    assert.equal(h.context.prompt, prompt);
    assert.equal(h.counters.model, 0);
  } finally { h.runtime.destroy(); }
});

test('auxiliary END and old normal receipts keep recall until validated current profiles settle once', async () => {
  const b = makeBranch('chat-a', 9);
  const d = { id: 'd-aux', kind: 'event', content: '门外信使抵达', status: 'pending', evidenceTerms: ['门外信使抵达'] };
  const h = makeHarness({ startBranch: b, existing: recordFor(b, { deliveries: [d], baseDeliveries: [d] }) });
  try {
    await h.runtime.bind(); await h.events.emit('generation_started', 'normal');
    const prompt = h.context.prompt;
    await h.events.emit('generation_ended'); await h.events.emit('generation_ended');
    await h.notifyDoctor();
    assert.equal(h.context.prompt, prompt); assert.equal(h.counters.factory, 0);
    const next = makeBranch('chat-a', 11); h.addBranch(next);
    h.receipt.target.index = 11; h.receipt.target.content = '门外信使抵达';
    h.receipt.target.identity = 'target-current'; h.receipt.identity = 'target-current';
    h.setProfiles({ ...h.host.profilesApi().record(), variableIdentity: h.receipt.identity,
      index: 11, branch: next, lineage: next.lineage, revision: 2 });
    for (const userIndex of [undefined, 9]) {
      h.receipt.target.userIndex = userIndex; await h.notifyDoctor();
      assert.equal(h.context.prompt, prompt); assert.equal(h.counters.factory, 0);
    }
    h.receipt.target.userIndex = 10;
    h.setP2({ status: 'generating', busy: true });
    await h.events.emit('chat_completion_prompt_ready', { messages: [{ content: prompt }] });
    await h.events.emit('generation_ended'); await h.notifyDoctor();
    assert.equal(h.context.prompt, prompt); assert.equal(h.counters.factory, 0);
    h.setP2({ status: 'complete', busy: false, readback: true }); await h.notifyDoctor();
    await waitFor(() => h.runtime.snapshot().status === 'complete' && !h.runtime.snapshot().busy);
    assert.equal(h.context.prompt, ''); assert.equal(h.counters.model, 1);
    const saved = await h.store.read(next), proof = saved.review.incomingRecall;
    assert.equal(proof.targetIdentity, h.receipt.target.identity);
    assert.equal(proof.promptObserved, true); assert.ok(proof.generationId);
    assert.equal(proof.sourceScopeKey, b.scopeKey); assert.equal(proof.text, undefined);
    assert.equal(saved.deliveries[0].status, 'consumed');
    assert.equal(saved.deliveries[0].semanticConsumptionProven, false);
    await h.events.emit('generation_ended'); await h.notifyDoctor(); await h.notifyDoctor();
    assert.equal(h.counters.model, 1); assert.deepEqual(await h.store.read(next), saved);
  } finally { h.runtime.destroy(); }
});
