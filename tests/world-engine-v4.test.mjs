import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_SCHEMA_VERSION,
  activeWorldCount,
  applyWorldProposal,
  emptyWorldState,
  markWorldReadback,
  normalizeWorldState,
  prepareRecallPackage,
  prepareWorldTransaction,
  recoverLatestLegacyWorld,
  recoverPreparedWorldState,
  repairWorldProposalLinks,
  reserveRecallPackage,
  settleRecallPackage,
  validateWorldProposal,
  verifyWorldReadback,
  worldConsistencyReport,
} from '../core.mjs';

const profile = { profileId: 'actor-lin', name: '林澄', aliases: ['小澄'], currentState: { goal: '查清药材来源' } };

test('旧四数组存档一次迁移为统一连续性状态', () => {
  const world = normalizeWorldState({
    summary: '旧摘要',
    branches: [{ id: 'b1', title: '药材短缺', actor: '林澄', location: '南街', status: 'active', intent: '调查货源' }],
    npcIntents: [{ id: 'n1', title: '暗中询价', actor: '林澄', status: 'waiting' }],
    agreements: [], hostilePlans: [],
  }, { chatId: 'chat-a' });
  assert.equal(world.schemaVersion, WORLD_SCHEMA_VERSION);
  assert.equal(world.chatId, 'chat-a');
  assert.equal(world.threads.length, 2);
  assert.equal('branches' in world, false);
});

test('空壳或只有标题的世界返回不会被当作成功推进', () => {
  assert.equal(validateWorldProposal({ summary: '', threads: [] }).ok, false);
  const sparse = validateWorldProposal({ summary: '世界局势继续发生变化。', threads: [{ title: '空标题支线' }] });
  assert.equal(sparse.ok, false);
  assert.match(sparse.errors.join('；'), /没有可用的进展/);
});

test('唯一可确定的缺失支线关联由本地补齐，不要求整段世界模型重试', () => {
  const repaired = repairWorldProposalLinks(emptyWorldState('chat-a'), {
    summary: '林澄追查药材来源并得到了部分结果。',
    threads: [{ id: 't1', title: '药材短缺', actorIds: ['actor-lin'], summary: '货源线索出现变化' }],
    actorActions: [{ actorId: 'actor-lin', action: '询问三家药商' }],
    adjudications: [{ actorId: 'actor-lin', status: 'partial', resultSummary: '找到一条可疑转运线' }],
  });
  assert.equal(repaired.proposal.actorActions[0].threadId, 't1');
  assert.equal(repaired.proposal.adjudications[0].threadId, 't1');
  assert.equal(validateWorldProposal(repaired.proposal).ok, true);
  assert.deepEqual(repaired.repairs.map((item) => item.kind), ['actorAction.threadId', 'adjudication.threadId']);
});

test('多个支线都可能匹配时不猜测关联，严格校验继续要求定向重试', () => {
  const repaired = repairWorldProposalLinks(emptyWorldState('chat-a'), {
    summary: '两条支线都与林澄有关，但模型没有说明行动属于哪一条。',
    threads: [
      { id: 't1', title: '药材短缺', actorIds: ['actor-lin'], summary: '货源变化' },
      { id: 't2', title: '港口追踪', actorIds: ['actor-lin'], summary: '码头出现线索' },
    ],
    actorActions: [{ actorId: 'actor-lin', action: '继续追查' }],
  });
  assert.equal(repaired.proposal.actorActions[0].threadId, undefined);
  assert.equal(repaired.repairs.length, 0);
  assert.match(validateWorldProposal(repaired.proposal).errors.join('；'), /缺少threadId/);
});

test('完整人物行动没有任何候选支线时派生稳定个人支线，不丢弃行动或乱绑旧线', () => {
  const baseline = applyWorldProposal(emptyWorldState('chat-a'), {
    summary: '旧世界有两条无关支线。',
    threads: [
      { id: 't1', title: '北港修船', actorIds: ['actor-bo'], summary: '船工等待木料' },
      { id: 't2', title: '城门盘查', actorIds: ['actor-qiu'], summary: '守卫加强检查' },
    ],
  }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const input = {
    summary: '林澄开始独立调查货源。',
    threads: [
      { id: 't1', title: '北港修船', actorIds: ['actor-bo'], summary: '木料仍未送达' },
      { id: 't2', title: '城门盘查', actorIds: ['actor-qiu'], summary: '检查仍在继续' },
    ],
    actorActions: [{ actorId: 'actor-lin', goal: '查清药材来源', action: '询问三家药商', risk: '可能惊动中间人' }],
  };
  const first = repairWorldProposalLinks(baseline, input);
  const second = repairWorldProposalLinks(baseline, input);
  assert.equal(first.proposal.threads.length, 3);
  assert.equal(first.proposal.actorActions[0].threadId, first.proposal.threads[2].id);
  assert.equal(first.proposal.threads[2].actorIds[0], 'actor-lin');
  assert.equal(first.proposal.actorActions[0].threadId, second.proposal.actorActions[0].threadId);
  assert.equal(validateWorldProposal(first.proposal).ok, true);
  assert.deepEqual(first.repairs.map((item) => item.kind), ['thread.created', 'actorAction.threadId']);
});

test('模型遗漏不会删除旧支线，明确解决才进入历史档案', () => {
  const first = applyWorldProposal(emptyWorldState('chat-a'), {
    summary: '两条线并行',
    threads: [
      { id: 't1', title: '药材短缺', kind: 'resource', summary: '货源减少' },
      { id: 't2', title: '北港修船', kind: 'parallel', summary: '船工等待木料' },
    ],
  }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const second = applyWorldProposal(first, {
    summary: '只更新南街',
    threads: [{ id: 't1', title: '药材短缺', kind: 'resource', summary: '已经找到替代货源' }],
  }, { chatId: 'chat-a', turn: 2, sourceRef: { sourceKey: 'm2' } });
  assert.deepEqual(second.threads.map((item) => item.id).sort(), ['t1', 't2']);
  const third = applyWorldProposal(second, { resolvedThreadIds: ['t1'] }, { chatId: 'chat-a', turn: 3, sourceRef: { sourceKey: 'm3' } });
  assert.deepEqual(third.threads.map((item) => item.id), ['t2']);
  assert.equal(third.resolvedArchive.some((item) => item.id === 't1'), true);
});

test('人物尝试与世界裁决分离，未建档人物不能越权行动', () => {
  const world = applyWorldProposal(emptyWorldState('chat-a'), {
    threads: [{ id: 't1', title: '药材短缺', kind: 'resource' }],
    actorActions: [
      { actorId: 'actor-lin', actorName: '林澄', threadId: 't1', intent: '追查货源', action: '询问三家药商', resourceCosts: ['半天时间'] },
      { actorId: 'actor-ghost', actorName: '未建档者', threadId: 't1', action: '夺走全部药材' },
    ],
    adjudications: [{ actorId: 'actor-lin', threadId: 't1', status: 'partial', resultSummary: '找到一条可疑转运线', actualCosts: ['支付两枚银币'], observableConsequence: '药商开始议论陌生买家' }],
  }, { chatId: 'chat-a', turn: 4, sourceRef: { sourceKey: 'm4' }, profiles: [profile] });
  assert.equal(world.attempts.length, 1);
  assert.equal(world.attempts[0].status, 'settled');
  assert.equal(world.adjudications.length, 1);
  assert.equal(world.adjudications[0].status, 'partial');
  assert.equal(world.lanes.actors.find((item) => item.actorId === 'actor-ghost').status, 'blocked_unready');
});

test('两阶段世界事务只有提交号、版本与摘要读回一致才通过', () => {
  const old = emptyWorldState('chat-a');
  const candidate = applyWorldProposal(old, { threads: [{ id: 't1', title: '药材短缺' }] }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const prepared = prepareWorldTransaction(old, candidate, '2026-08-23T00:00:00.000Z');
  assert.equal(prepared.revision, 0);
  assert.equal(prepared.checkpoint.state, 'world_candidate_prepared');
  const recovered = recoverPreparedWorldState(prepared, '2026-08-23T00:00:01.000Z');
  assert.equal(recovered.recovered, true);
  assert.equal(verifyWorldReadback(recovered.world, candidate), true);
  const verified = markWorldReadback(recovered.world, '2026-08-23T00:00:02.000Z');
  assert.equal(verified.persistence.status, 'verified');
  assert.equal(verifyWorldReadback({ ...verified, commitId: 'wrong' }, candidate), false);
});

test('召回包有单回合预约和消费回执，不会重复消费', () => {
  const world = applyWorldProposal(emptyWorldState('chat-a'), { threads: [{ id: 't1', title: '药材短缺', actorIds: ['林澄'], locations: ['南街'] }] }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const packet = prepareRecallPackage(world, '去南街找林澄', { 'actor-lin': profile }, 8, { chatId: 'chat-a', sourceKey: 'g2', at: '2026-08-23T00:00:00.000Z' });
  assert.equal(packet.items[0].id, 't1');
  const reserved = reserveRecallPackage(world, packet);
  assert.equal(reserved.recall.pending.packageId, packet.packageId);
  const settled = settleRecallPackage(reserved, packet.packageId, 'consumed', { sourceKey: 'm2', messageId: 2 });
  assert.equal(settled.changed, true);
  assert.equal(settled.world.recall.pending, null);
  assert.equal(settled.world.recall.receipts[0].status, 'consumed');
  assert.equal(settleRecallPackage(settled.world, packet.packageId, 'consumed').changed, false);
});

test('迁移时可从同一聊天完整运行记录恢复比旧存档更多的世界项', () => {
  const current = normalizeWorldState({ branches: [{ id: 'b1', title: '旧支线' }], npcIntents: [], agreements: [], hostilePlans: [] }, { chatId: 'chat-a' });
  const recovered = recoverLatestLegacyWorld(current, [{
    runId: 'run-new', chatId: 'chat-a', finishedAt: '2026-08-23T01:00:00.000Z',
    outcome: { world: { world: { summary: '模型实际生成了两条', branches: [{ id: 'b1', title: '旧支线' }, { id: 'b2', title: '遗漏的新支线' }], npcIntents: [], agreements: [], hostilePlans: [], updatedAt: '2026-08-23T01:00:00.000Z' } } },
  }], { chatId: 'chat-a' });
  assert.equal(recovered.changed, true);
  assert.equal(recovered.world.threads.length, 2);
  assert.equal(activeWorldCount(recovered.world), 2);
});

test('面板可识别完整报告与权威存档分叉，而不把报告当权威', () => {
  const old = emptyWorldState('chat-a');
  const committed = applyWorldProposal(old, { summary: '第一轮已经推进。', threads: [{ id: 't1', title: '第一条', summary: '产生变化' }] }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const reportAhead = applyWorldProposal(committed, { summary: '第二轮报告声称推进。', threads: [{ id: 't2', title: '第二条', summary: '只存在于报告' }] }, { chatId: 'chat-a', turn: 2, sourceRef: { sourceKey: 'm2' } });
  const consistency = worldConsistencyReport(committed, [{ runId: 'r2', chatId: 'chat-a', outcome: { world: { world: reportAhead } } }], { chatId: 'chat-a' });
  assert.equal(consistency.ok, false);
  assert.equal(consistency.status, 'split_brain');
  assert.equal(committed.threads.length, 1);
});
