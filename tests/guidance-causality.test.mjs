// Synthetic mechanism checks only. They do not prove real model causality or Tavern acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evolveGuide } from '../guide/evolve.mjs';
import { buildGuideReveal, currentGuideInput } from '../guide/reveal.mjs';

const target = { identity: 'reply-2', index: 4, content: '过了一夜。我打开背包，尸体扑向我。',
  userText: '过夜后取出尸体', lineage: 'branch-a', scopeKey: 'chat-a' };
const baseSource = { targetIdentity: 'reply-1', index: 2, lineage: 'branch-a', scopeKey: 'chat-a' };
const corpse = () => ({
  id: 'corpse', title: '背包中的感染尸体', subjects: ['尸体', '背包'], status: 'active',
  source: { ...baseSource }, process: '感染尚在进展，等待实际时间或检查。',
  facts: [{ id: 'infected', text: '尸体已感染；普通背包内时间正常流逝。', basis: ['已接受的收尸正文和背包规则'], knownTo: [] },
    { id: 'private-origin', text: 'UNRELATED_SECRET_MARKER', basis: ['仅供后台延续的来源'], knownTo: ['幕后团体'] }],
  conditions: [{ id: 'overnight', when: '背包内实际经过一夜，随后打开并取出尸体', change: '感染完成并出现尸变后的直接接触危险', basis: ['感染规则及正常流逝的内部时间'] }],
  exposure: [{ id: 'corpse-contact', readiness: 'conditional', route: '打开背包后的直接接触',
    when: '正文实际经过一夜并取出尸体', visible: '尸变的身体突然扑来；玩家回应由玩家决定',
    factIds: ['infected'], conditionIds: ['overnight'], status: 'pending' }],
  history: [{ targetIdentity: 'reply-1', summary: 'PRIVATE_HISTORY_MARKER' }],
});
const response = extra => ({ sourceRevision: 0, upserts: [], closures: [], adoptionChecks: [], conflicts: [], summary: '本批无额外变化', ...extra });
const run = (value, args = {}) => evolveGuide({ target, request: async () => JSON.stringify(response(value)), ...args });
const delivery = (extra = {}) => ({ promptObserved: true, targetIdentity: target.identity, providedIds: ['corpse'],
  exposureIds: ['corpse-contact'], ...extra });
const shown = (extra = {}) => ({ matterId: 'corpse', exposureId: 'corpse-contact', targetIdentity: target.identity,
  status: 'shown', evidence: '尸体扑向我', reason: '正文已经出现与取出接触对应的袭击，而非仅有意图', ...extra });

test('one request receives all covered accepted replies; unchanged matters and model-independent source survive', async () => {
  const baseline = { revision: 7, matters: [corpse()], owned: 'preserve' };
  const before = structuredClone(baseline);
  const covered = [{ identity: 'reply-middle', index: 3, content: '营地度过了夜晚。', userText: '休息' }, target];
  let calls = 0;
  const result = await evolveGuide({ baseline, target, newlyAccepted: covered, material: { coverage: { limited: false } },
    request: async messages => {
      calls++;
      const payload = JSON.parse(messages[1].content);
      assert.deepEqual(payload.newlyAccepted, covered);
      assert.equal(payload.sourceRevision, 7);
      return JSON.stringify(response({ sourceRevision: 7, upserts: [{ id: 'shield', title: '修盾', subjects: ['队友 A', '盾牌'],
        process: '队友自行找到了铁匠，但尚未完成修理。', source: { targetIdentity: 'FAKE_PAST' },
        history: [{ targetIdentity: 'FAKE_PAST', summary: '伪造前置记录' }] }] }));
    } });
  assert.equal(calls, 1);
  assert.deepEqual(baseline, before);
  assert.deepEqual(result.snapshot.matters[0], before.matters[0]);
  assert.equal(result.snapshot.owned, 'preserve');
  assert.equal(result.snapshot.matters[1].source.targetIdentity, target.identity);
  assert.equal(result.snapshot.matters[1].history[0].targetIdentity, target.identity);
  assert.equal(JSON.stringify(result.snapshot).includes('FAKE_PAST'), false);
});

test('corrupt response does not retry, extract nested JSON, or mutate a committed baseline', async () => {
  const baseline = { matters: [corpse()] }, before = structuredClone(baseline);
  let calls = 0;
  await assert.rejects(evolveGuide({ target, baseline, request: async () => { calls++; return `说明文字 ${JSON.stringify(response())}`; } }),
    { code: 'guide_response_invalid' });
  assert.equal(calls, 1);
  assert.deepEqual(baseline, before);
});

test('outer fence parsing preserves quoted punctuation and rejects revision mismatch', async () => {
  const result = await evolveGuide({ target, request: async () => `\`\`\`json\n${JSON.stringify(response({ summary: '“未知”：仍未知，不能硬改。' }))}\n\`\`\`` });
  assert.equal(result.summary, '“未知”：仍未知，不能硬改。');
  await assert.rejects(run({ sourceRevision: 99 }), { code: 'guide_response_invalid' });
});

test('existing backstage facts cannot be erased or rewritten; NPC knowledge does not depend on player observation', async () => {
  const baseline = { matters: [corpse()] };
  const original = baseline.matters[0].facts[0];
  const result = await run({ upserts: [{ id: 'corpse', facts: [{ ...original, knownTo: ['独自检查过的队友 A'] }],
    process: '队友检查后已知道危险，玩家还不知道。' }] }, { baseline });
  assert.deepEqual(result.snapshot.matters[0].facts[0].knownTo, ['独自检查过的队友 A']);
  assert.equal(result.snapshot.matters[0].facts.length, 2);
  await assert.rejects(run({ upserts: [{ id: 'corpse', facts: [{ ...original, text: '其实从未感染。' }] }] }, { baseline }),
    { code: 'guide_response_invalid' });
  assert.deepEqual(baseline.matters[0].facts[0].knownTo, []);
});

test('future contact is exposed as a condition, not executed from input; unrelated secret and history stay out', () => {
  const snapshot = { matters: [corpse()] }, before = structuredClone(snapshot);
  const reveal = buildGuideReveal({ snapshot, userInput: '过夜后取出尸体' });
  assert.deepEqual(reveal.exposureIds, ['corpse-contact']);
  assert.match(reveal.text, /未来条件，尚未自动结算/);
  assert.equal(reveal.text.includes('UNRELATED_SECRET_MARKER'), false);
  assert.equal(reveal.text.includes('PRIVATE_HISTORY_MARKER'), false);
  assert.deepEqual(snapshot, before);
  assert.equal(snapshot.matters[0].exposure[0].status, 'pending');
  assert.equal(buildGuideReveal({ snapshot, userInput: '谈天气', scene: { text: '在隔壁城镇' } }).text, '');
});

test('arrived consequences do not depend on player keywords; pronoun contact can use current scene context', () => {
  const matter = corpse();
  matter.exposure[0].readiness = 'ready';
  const ready = buildGuideReveal({ snapshot: { matters: [matter] }, userInput: '继续散步' });
  assert.deepEqual(ready.exposureIds, ['corpse-contact']);
  const pronoun = buildGuideReveal({ snapshot: { matters: [corpse()] }, userInput: '把它拿出来', scene: { inventory: ['背包'] } });
  assert.deepEqual(pronoun.exposureIds, ['corpse-contact']);
  assert.equal(currentGuideInput('<story>打开背包的旧历史</story><user_input>询问天气</user_input>'), '询问天气');
});

test('closed process keeps pending contact consequences; provided does not become shown', () => {
  const matter = corpse();
  matter.status = 'closed';
  const reveal = buildGuideReveal({ snapshot: { matters: [matter] }, userInput: '取出尸体' });
  assert.deepEqual(reveal.exposureIds, ['corpse-contact']);
  assert.equal(matter.exposure[0].status, 'pending');
});

test('whole matter projection reports coverage limit rather than truncating causal context', () => {
  const snapshot = { matters: [corpse()] };
  const whole = buildGuideReveal({ snapshot, userInput: '取出尸体' });
  const limited = buildGuideReveal({ snapshot, userInput: '取出尸体', budgetChars: whole.text.length - 1 });
  assert.equal(limited.text, '');
  assert.equal(limited.coverageLimited, true);
  assert.deepEqual(limited.omittedIds, ['corpse']);
  assert.deepEqual(limited.exposureIds, []);
});

test('adoption is bound to observed exposure plus actual accepted target, never keyword presence alone', async () => {
  const baseline = { matters: [corpse()] };
  const unchanged = await run({}, { baseline, priorDelivery: delivery() });
  assert.equal(unchanged.snapshot.matters[0].exposure[0].status, 'pending');
  for (const bad of [delivery({ promptObserved: false }), delivery({ targetIdentity: 'wrong' }), delivery({ exposureIds: ['other'] })])
    await assert.rejects(run({ adoptionChecks: [shown()] }, { baseline, priorDelivery: bad }), { code: 'guide_response_invalid' });
  const result = await run({ adoptionChecks: [shown()] }, { baseline, priorDelivery: delivery() });
  assert.equal(result.snapshot.matters[0].exposure[0].status, 'shown');
  assert.equal(result.adoption[0].verification, 'model-review');
  assert.equal(result.adoption[0].recordedAtTargetIdentity, target.identity);
  await assert.rejects(run({ adoptionChecks: [shown({ evidence: '正文中不存在的袭击' })] }, { baseline, priorDelivery: delivery() }),
    { code: 'guide_response_invalid' });
});

test('shown exposure is not replayed; necessary world facts remain and a new consequence uses a new ID', async () => {
  const result = await run({ adoptionChecks: [shown()] }, { baseline: { matters: [corpse()] }, priorDelivery: delivery() });
  const reveal = buildGuideReveal({ snapshot: result.snapshot, userInput: '检查尸体' });
  assert.deepEqual(reveal.exposureIds, []);
  assert.match(reveal.text, /尸体已感染/);
  assert.equal(reveal.text.includes('突然扑来'), false);
  const oldEntry = result.snapshot.matters[0].exposure[0];
  await assert.rejects(run({ upserts: [{ id: 'corpse', exposure: [{ ...oldEntry, visible: '再次偷袭' }] }] }, { baseline: result.snapshot }),
    { code: 'guide_response_invalid' });
  const updated = await run({ upserts: [{ id: 'corpse', exposure: [{ ...oldEntry, id: 'corpse-noise', visible: '挣扎声引来了旁人' }] }] },
    { baseline: result.snapshot });
  assert.equal(updated.snapshot.matters[0].exposure.find(item => item.id === 'corpse-noise').status, 'pending');
});

test('conflicting accepted text is recorded without deleting facts or starting repair calls', async () => {
  const baseline = { matters: [corpse()] };
  const contradicted = { ...target, content: '打开背包后确认尸体从未感染。' };
  const result = await run({ adoptionChecks: [shown({ status: 'conflict', evidence: '尸体从未感染', reason: '接受正文否定了已成立的感染事实' })] },
    { target: contradicted, baseline, priorDelivery: delivery() });
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.snapshot.matters[0].facts[0].text, baseline.matters[0].facts[0].text);
  assert.equal(result.snapshot.matters[0].exposure[0].status, 'conflict');
});

test('busy batch reviews every bound receipt in accepted order; later omission cannot revoke an occurrence', async () => {
  const first = { ...target, identity: 'reply-first', index: 3 };
  const last = { ...target, content: '我离开仓库去了城镇。' };
  const checks = [shown({ targetIdentity: last.identity, status: 'not-observed', evidence: '', reason: '后续场景没有再演一次袭击' }),
    shown({ targetIdentity: first.identity })];
  let calls = 0;
  const result = await evolveGuide({ target: last, baseline: { matters: [corpse()] }, newlyAccepted: [first, last],
    priorDelivery: { receipts: [delivery({ targetIdentity: first.identity }), delivery({ targetIdentity: last.identity })] },
    request: async () => { calls++; return JSON.stringify(response({ adoptionChecks: checks })); } });
  assert.equal(calls, 1);
  assert.deepEqual(result.adoption.map(item => item.targetIdentity), [first.identity, last.identity]);
  assert.equal(result.snapshot.matters[0].exposure[0].status, 'shown');
  assert.equal(result.snapshot.matters[0].exposure[0].review.targetIdentity, first.identity);
  assert.equal(result.snapshot.matters[0].history.filter(item => item.summary.startsWith('正文 ')).length, 2);
});

test('same batch can consume a condition and prove its exposure without losing historical causal evidence', async () => {
  const baseline = { matters: [corpse()] };
  const result = await run({ upserts: [{ id: 'corpse', conditions: [] }], adoptionChecks: [shown()] },
    { baseline, priorDelivery: delivery() });
  const matter = result.snapshot.matters[0], entry = matter.exposure[0];
  assert.deepEqual(matter.conditions, []);
  assert.equal(entry.status, 'shown');
  assert.deepEqual(entry.conditionEvidence, baseline.matters[0].conditions);
  assert.equal(baseline.matters[0].exposure[0].status, 'pending');
  const reveal = buildGuideReveal({ snapshot: result.snapshot, userInput: '检查尸体' });
  assert.deepEqual(reveal.exposureIds, []);
  assert.equal(reveal.text.includes('【未来条件，尚未自动结算】'), false);
  assert.equal(reveal.text.includes(baseline.matters[0].conditions[0].when), false);
});

test('final reference checks still reject a consumed condition when its exposure remains unresolved', async () => {
  const baseline = { matters: [corpse()] };
  for (const adoptionChecks of [[], [shown({ status: 'not-observed', evidence: '', reason: '尚未出现攻击' })]]) {
    await assert.rejects(run({ upserts: [{ id: 'corpse', conditions: [] }], adoptionChecks },
      { baseline, priorDelivery: delivery() }), { code: 'guide_response_invalid' });
  }
  const entry = baseline.matters[0].exposure[0];
  await assert.rejects(run({ upserts: [{ id: 'corpse', conditions: [], exposure: [{ ...entry, conditionIds: ['invented'],
    conditionEvidence: [{ id: 'invented', when: '伪造', change: '伪造', basis: ['伪造'] }] }] }], adoptionChecks: [shown()] },
    { baseline, priorDelivery: delivery() }), { code: 'guide_response_invalid' });
});

test('future frozen-container fixture stays dormant, while established ready effects cannot be silently retired', async () => {
  const frozen = corpse();
  frozen.facts[0].text = '尸体已感染；背包内部时间冻结。';
  frozen.conditions[0] = { id: 'thaw', when: '先解除冻结且实际经过足够感染时间', change: '感染才可能继续发展', basis: ['明示冻结规则'] };
  frozen.exposure[0].conditionIds = ['thaw'];
  const reveal = buildGuideReveal({ snapshot: { matters: [frozen] }, userInput: '外面过夜后取出尸体' });
  assert.match(reveal.text, /背包内部时间冻结/);
  assert.match(reveal.text, /先解除冻结且实际经过足够感染时间/);
  assert.equal(frozen.exposure[0].status, 'pending');
  const arrived = corpse();
  arrived.exposure[0].readiness = 'ready';
  await assert.rejects(run({ upserts: [{ id: 'corpse', retireExposureIds: ['corpse-contact'] }] }, { baseline: { matters: [arrived] } }),
    { code: 'guide_response_invalid' });
});
