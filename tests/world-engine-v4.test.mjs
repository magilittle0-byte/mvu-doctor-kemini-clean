import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_SCHEMA_VERSION,
  activeWorldCount,
  applyWorldProposal,
  emptyWorldState,
  formatGenerationInjection,
  markWorldReadback,
  normalizeWorldState,
  privateProfileDigestFromData,
  prepareRecallPackage,
  prepareWorldTransaction,
  recoverLatestLegacyWorld,
  recoverPreparedWorldState,
  repairWorldProposalLinks,
  profileDigestFromData,
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
  const world = applyWorldProposal(emptyWorldState('chat-a'), { threads: [{ id: 't1', title: '药材短缺', actorIds: ['林澄'], locations: ['南街'], publicTitle: '南街药房动静', publicSurface: '南街药房门口贴出了限购告示。' }] }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const packet = prepareRecallPackage(world, '去南街找林澄', { 'actor-lin': profile }, 8, { chatId: 'chat-a', sourceKey: 'g2', at: '2026-08-23T00:00:00.000Z' });
  assert.equal(packet.items[0].recordType, 'sensory_surface');
  assert.equal(packet.items[0].publicSurface, '南街药房门口贴出了限购告示。');
  assert.equal('id' in packet.items[0], false);
  const reserved = reserveRecallPackage(world, packet);
  assert.equal(reserved.recall.pending.packageId, packet.packageId);
  const settled = settleRecallPackage(reserved, packet.packageId, 'consumed', { sourceKey: 'm2', messageId: 2 });
  assert.equal(settled.changed, true);
  assert.equal(settled.world.recall.pending, null);
  assert.equal(settled.world.recall.receipts[0].status, 'consumed');
  assert.equal(settleRecallPackage(settled.world, packet.packageId, 'consumed').changed, false);
});

test('隐藏支线只把表象和线索投影给正文，私有真相与下一步不进入注入', () => {
  const secret = '岚音在袖口遮挡下把旅人甲的名字写进小本本，并决定暗中评估他的弱点。';
  const world = applyWorldProposal(emptyWorldState('chat-a'), {
    summary: '岚音维持柔弱表象，同时在医生私有层推进自己的观察计划。',
    threads: [{
      id: 'synthetic-private', kind: 'personal', title: '岚音的秘密记录', stage: 'advancing',
      actorIds: ['actor-lan'], summary: secret, offscreenBeat: secret, nextBeat: '继续暗中记录其他成员',
      publicTitle: '新队友的谨慎表现', publicSurface: '岚音始终低着头，抱紧法杖，看起来柔弱而谨慎。',
      publicClues: ['她的袖口边缘沾着一点尚未干透的墨迹。'], knowledge: 'hidden',
    }],
  }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const packet = prepareRecallPackage(world, '观察岚音', {}, 8, { chatId: 'chat-a', sourceKey: 'g2' });
  const injection = formatGenerationInjection({ tickets: [], recall: packet.items, profileDigest: [] });
  assert.match(injection, /岚音始终低着头/);
  assert.match(injection, /袖口边缘沾着一点/);
  assert.doesNotMatch(injection, /小本本|暗中评估|秘密记录|继续暗中记录/);
  assert.equal(packet.items[0].recordType, 'sensory_surface');
  assert.equal('id' in packet.items[0], false);
  assert.equal('actorIds' in packet.items[0], false);
});

test('完全没有公开表象或可观察后果的隐藏行动不会进入正文召回', () => {
  const world = applyWorldProposal(emptyWorldState('chat-a'), {
    summary: '镜头外人物推进了一次完全隐蔽的尝试。',
    threads: [{ id: 't-secret', title: '密信', summary: '某人烧毁密信', offscreenBeat: '灰烬也被带走', knowledge: 'hidden' }],
    actorActions: [{ actorId: 'actor-lin', actorName: '林澄', threadId: 't-secret', action: '在无人处烧毁密信', visibility: 'hidden' }],
    adjudications: [{ actorId: 'actor-lin', threadId: 't-secret', status: 'success', resultSummary: '密信已销毁' }],
  }, { chatId: 'chat-a', turn: 2, sourceRef: { sourceKey: 'm2' }, profiles: [profile] });
  const packet = prepareRecallPackage(world, '询问林澄', { 'actor-lin': profile }, 8, { chatId: 'chat-a', sourceKey: 'g3' });
  assert.deepEqual(packet.items, []);
});

test('隐藏行动的可观察后果不携带行动者、目的、私有裁决或因果归属', () => {
  const world = applyWorldProposal(emptyWorldState('chat-a'), {
    summary: '药房后门出现了无法立即解释的变化。',
    threads: [{ id: 't-door', title: '后门处理', summary: '林澄换了锁', publicSurface: '药房后门换上了一把崭新的铜锁。', knowledge: 'hidden' }],
    actorActions: [{ actorId: 'actor-lin', actorName: '林澄', threadId: 't-door', goal: '阻止追查', action: '趁夜更换后门锁', visibility: 'hidden' }],
    adjudications: [{ actorId: 'actor-lin', threadId: 't-door', status: 'success', resultSummary: '旧钥匙已经失效', observableConsequence: '药房后门换上了一把崭新的铜锁。' }],
  }, { chatId: 'chat-a', turn: 3, sourceRef: { sourceKey: 'm3' }, profiles: [profile] });
  const packet = prepareRecallPackage(world, '去药房后门', { 'actor-lin': profile }, 8, { chatId: 'chat-a', sourceKey: 'g4' });
  const text = JSON.stringify(packet.items);
  assert.match(text, /崭新的铜锁/);
  assert.doesNotMatch(text, /林澄|阻止追查|趁夜更换|旧钥匙已经失效/);
  assert.equal(packet.items.some((item) => item.recordType === 'unattributed_observation'), true);
});

test('公开投影拒绝全知措辞，隐藏事实转为已揭示必须引用本轮最终正文原文', () => {
  const leaked = validateWorldProposal({
    summary: '岚音继续自己的隐秘观察。',
    threads: [{ id: 'b1', title: '观察', summary: '岚音记录队友', publicSurface: '岚音其实在伪装柔弱并暗中记仇。', knowledge: 'hidden' }],
  });
  assert.equal(leaked.ok, false);
  assert.match(leaked.errors.join('；'), /公开投影/);

  const acceptedText = '你翻开岚音遗落的本子，第一页清楚写着旅人乙的名字和当时的冲突经过。';
  const reveal = {
    summary: '岚音的记录已经被玩家亲眼发现。',
    threads: [{ id: 'b1', title: '观察', summary: '岚音记录队友', knowledge: 'observed', revealedSummary: '岚音曾记录旅人乙的冲突。', revealEvidence: '第一页清楚写着旅人乙的名字和当时的冲突经过' }],
  };
  assert.equal(validateWorldProposal(reveal, { previous: emptyWorldState('chat-a'), acceptedText }).ok, true);
  assert.equal(validateWorldProposal({ ...reveal, threads: [{ ...reveal.threads[0], revealEvidence: '正文中不存在的证据' }] }, { previous: emptyWorldState('chat-a'), acceptedText }).ok, false);
  assert.equal(validateWorldProposal({ ...reveal, threads: [{ ...reveal.threads[0], revealedSummary: '' }] }, { previous: emptyWorldState('chat-a'), acceptedText }).ok, false);
});

test('v4统一世界状态升级到v5时保留原threads、重算摘要并撤销旧版读回证明', () => {
  const world = normalizeWorldState({ schemaVersion: 4, chatId: 'chat-a', digest: 'v4-old-digest', persistence: { status: 'verified', digest: 'v4-old-digest' }, threads: [{ id: 'v4-thread', title: '旧统一支线', summary: '旧状态仍需保留' }] });
  assert.equal(world.schemaVersion, WORLD_SCHEMA_VERSION);
  assert.equal(world.threads.length, 1);
  assert.equal(world.threads[0].id, 'v4-thread');
  assert.equal(world.migration.fromSchema, 4);
  assert.notEqual(world.digest, 'v4-old-digest');
  assert.equal(world.persistence.status, 'unverified');
});

test('正文注入的人物摘要不泄漏医生补全的职业、目标与人格，私有摘要仍供医生使用', () => {
  const data = { stat_data: { 人物档案: { byActorId: { 'actor-lin': { ...profile, name: '未公开真名', aliases: ['药房来客'], narrativeKnownNames: ['药房来客'], identity: { occupation: '密探' }, personality: { coreDesire: '掌控情报' }, evidence: ['未公开真名其实是密探。'], inferences: ['真实任务尚未公开'] } } } } };
  const publicDigest = profileDigestFromData(data);
  const privateDigest = privateProfileDigestFromData(data);
  assert.deepEqual(Object.keys(publicDigest[0]).sort(), ['doNotRerandomize', 'knownNames', 'profileHandle']);
  assert.deepEqual(publicDigest[0].knownNames, ['药房来客']);
  assert.doesNotMatch(JSON.stringify(publicDigest), /未公开真名|actor-lin|密探|掌控情报|真实任务/);
  assert.match(JSON.stringify(privateDigest), /未公开真名|密探|掌控情报|真实任务/);
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
