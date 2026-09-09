import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeliveries, makeRecall, settleDeliveries } from '../world/recall.mjs';

const source = { scopeKey: 'scope', lineage: 'lineage', index: 4, inputIdentity: 'input' };

test('projects only new or changed public consequences with stable digest ids', async () => {
  const before = { events: [{ id: 'quiet', level: 1, stage: '进行中', name: 'hidden-ish' }], winds: [{ id: 'low', level: 2, topic: 'private' }] };
  const world = { events: [{ id: 'public', level: 3, stage: '进行中', name: 'storm', desc: '公开后果' }], winds: [{ id: 'low', level: 2, topic: 'private' }], enemies: [{ id: 'secret' }] };
  const first = await buildDeliveries({ before, world, source });
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'event');
  assert.equal(first[0].status, 'pending');
  assert.equal(Object.hasOwn(first[0], 'enemies'), false);
  const second = await buildDeliveries({ before, world, previous: first, source });
  assert.deepEqual(second, first);
  const movedCounter = await buildDeliveries({ before, world: { ...world, events: [{ ...world.events[0], stageRound: 99 }] }, source });
  assert.deepEqual(movedCounter, first);
  const unchangedConsequence = await buildDeliveries({ before: world,
    world: { ...world, events: [{ ...world.events[0], evolveResult: '保持' }] }, previous: first, source });
  assert.deepEqual(unchangedConsequence, first);
});

test('projects a removed terminal event from the native ledger and supersedes its pending prior stage', async () => {
  const before = { events: [{ id: 'e', name: 'flare', level: 3, stage: '进行中', desc: '此前公开影响' }] };
  const world = { round: 3, events: [], memories: [{ type: 'ledger', round: 3, changes: [{ type: 'event_terminal', name: 'flare', level: 3, stage: '已完成', desc: '终局公开影响' }] }] };
  const prior = await buildDeliveries({ before: {}, world: before, source });
  const next = await buildDeliveries({ before, world, previous: prior, source });
  assert.equal(next.some(item => item.status === 'superseded'), true);
  assert.equal(next.some(item => item.content.includes('终局公开影响')), true);
});

test('same-name entities stay separate and old ledger entries do not revive cleared events', async () => {
  const world = { round: 3, events: [
    { id: 'e1', name: '同名事件', level: 3, stage: '执行', desc: '第一处公开结果' },
    { id: 'e2', name: '同名事件', level: 3, stage: '执行', desc: '第二处公开结果' },
  ], memories: [{ type: 'ledger', round: 1, changes: [{ type: 'event_new', name: '历史事件', level: 3, desc: '不应再次呈现' }] }] };
  const rows = await buildDeliveries({ world, source });
  assert.equal(rows.length, 2);
  assert.equal(rows.every(row => row.status === 'pending'), true);
  const ended = await buildDeliveries({ before: world, world: { round: 4, events: [world.events[1]],
    lastEvolveResult: { events: [{ ...world.events[0], stage: '已失败', desc: '第一处失败后果' }] } }, previous: rows, source });
  assert.equal(ended.find(row => row.public.id === 'e2').status, 'pending');
  assert.equal(ended.filter(row => row.public.id === 'e1' && row.status === 'pending').length, 1);
});

test('recall excludes consumed rows and settles only a bound prompt with evidence', async () => {
  const deliveries = await buildDeliveries({ world: { events: [{ id: 'e', level: 3, stage: '进行中', name: 'signal', desc: '公开结果' }] }, source });
  const recall = await makeRecall({ deliveries, lineage: source.lineage, scopeKey: source.scopeKey });
  assert.equal(recall.deliveryIds.length, 1);
  const receipt = { generationId: 'g1', identity: 'receipt', readback: true, target: { identity: 'target', scopeSignature: 'scope-signature', scopeKey: 'scope', index: 4, swipeId: 0, content: '正文提到公开结果' } };
  const unbound = await settleDeliveries(deliveries, recall, receipt);
  assert.equal(unbound[0].status, 'pending');
  const settled = await settleDeliveries(deliveries, { ...recall, generationId: 'g1', targetIdentity: 'target', scope: 'scope-signature', promptObserved: true }, receipt);
  assert.equal(settled[0].status, 'consumed');
  assert.equal(settled[0].narrativeEvidenceMatched, true);
  assert.equal(settled[0].semanticConsumptionProven, false);
  const next = await makeRecall({ deliveries: settled });
  assert.equal(next, null);
});

test('without an evidence term the delivery remains retained', async () => {
  const row = { id: 'id', content: '长文本公开后果', evidenceTerms: ['不存在的完整词'], status: 'pending' };
  const settled = await settleDeliveries([row], { generationId: 'g', targetIdentity: 't', scope: 'scope-signature', sourceScopeKey: 'scope', promptObserved: true, deliveryIds: ['id'] }, { generationId: 'g', identity: 'r', readback: true, target: { identity: 't', scopeSignature: 'scope-signature', scopeKey: 'scope', index: 1, swipeId: 0, content: '普通正文' } });
  assert.equal(settled[0].status, 'retained');
  assert.equal(settled[0].narrativeEvidenceMatched, false);
});
