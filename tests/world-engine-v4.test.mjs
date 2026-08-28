import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_SCHEMA_VERSION,
  activeWorldCount,
  assessRecallConsumption,
  applyWorldProposal,
  emptyWorldState,
  formatGenerationInjection,
  markWorldReadback,
  normalizeWorldState,
  privateProfileDigestFromData,
  prepareRecallPackage,
  prepareWorldTransaction,
  recallSelectionInput,
  recoverLatestLegacyWorld,
  recoverPreparedWorldState,
  repairWorldProposalLinks,
  restoreWorldBaselineForCancelledCandidate,
  sanitizeWorldProposalPublicProjection,
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

test('取消只撤销当前世界候选的prepared或同一提交，不覆盖无关的新世界状态', () => {
  const baseline = emptyWorldState('chat-a');
  const candidate = applyWorldProposal(baseline, {
    summary: '当前候选推进了一条世界事项。',
    threads: [{ id: 'candidate-thread', title: '候选事项', summary: '候选私有进展。' }],
  }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const prepared = prepareWorldTransaction(baseline, candidate);
  const fromPrepared = restoreWorldBaselineForCancelledCandidate(prepared, baseline, candidate);
  assert.equal(fromPrepared.restored, true);
  assert.equal(fromPrepared.reason, 'discarded_prepared_candidate');
  assert.equal(fromPrepared.world.revision, baseline.revision);
  assert.equal(fromPrepared.world.checkpoint.state, 'world_committed');

  const fromCommitted = restoreWorldBaselineForCancelledCandidate(candidate, baseline, candidate);
  assert.equal(fromCommitted.restored, true);
  assert.equal(fromCommitted.reason, 'rolled_back_cancelled_commit');
  assert.equal(fromCommitted.world.digest, baseline.digest);

  const unrelated = applyWorldProposal(baseline, {
    summary: '另一任务已经提交自己的权威状态。',
    threads: [{ id: 'other-thread', title: '其他事项', summary: '其他任务的进展。' }],
  }, { chatId: 'chat-a', turn: 2, sourceRef: { sourceKey: 'm2' } });
  const refused = restoreWorldBaselineForCancelledCandidate(unrelated, baseline, candidate);
  assert.equal(refused.restored, false);
  assert.equal(refused.reason, 'no_owned_candidate');
  assert.equal(refused.world.digest, unrelated.digest);
});

test('召回包有单回合预约和消费回执，不会重复消费', () => {
  const world = applyWorldProposal(emptyWorldState('chat-a'), { threads: [{ id: 't1', title: '药材短缺', actorIds: ['林澄'], locations: ['南街'], publicTitle: '南街药房动静', publicSurface: '南街药房门口贴出了限购告示。' }] }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const packet = prepareRecallPackage(world, '去南街找林澄', { 'actor-lin': profile }, 8, { chatId: 'chat-a', sourceKey: 'g2', at: '2026-08-23T00:00:00.000Z' });
  assert.equal(packet.items[0].recordType, 'sensory_surface');
  assert.equal(packet.items[0].usage, 'required_once');
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

test('缝合输入只用最后一个当前行动包做召回相关性，不让历史包装反向命中', () => {
  const stitched = '<history>北港旧事和南街药房都在历史里。</history>\n<本轮用户输入>转身前往东门排队。</本轮用户输入>\n<user_input>去北港检查木料。</user_input>';
  assert.equal(recallSelectionInput(stitched), '去北港检查木料。');
  assert.equal(recallSelectionInput('<user_input>观察柜台。</user_input>'), '观察柜台。');
  assert.equal(recallSelectionInput('直接输入的行动'), '直接输入的行动');
});

test('召回只有被最终正文可核对地采用才算消费，忽略的注入明确释放', () => {
  const packet = {
    packageId: 'recall-proof',
    items: [{ recordType: 'sensory_surface', publicSurface: '南街药房门口贴出了限购告示。', publicClues: [] }],
  };
  const adopted = assessRecallConsumption('走到南街药房门口，门板上果然挂着限购告示。', packet);
  assert.equal(adopted.consumed, true);
  assert.equal(adopted.consumedItemCount, 1);
  const ignored = assessRecallConsumption('你转身去了北港，潮水正在石阶下起伏。', packet);
  assert.equal(ignored.consumed, false);
  assert.match(ignored.reason, /不能记为已消费/);

  const reserved = reserveRecallPackage(emptyWorldState('chat-a'), packet);
  const settled = settleRecallPackage(reserved, packet.packageId, ignored.consumed ? 'consumed' : 'released', ignored);
  assert.equal(settled.world.recall.receipts[0].status, 'released');
  assert.equal(settled.world.recall.receipts[0].totalItemCount, 1);
});

test('required_once未采用时optional命中不能冒充整包消费', () => {
  const packet = {
    packageId: 'recall-required-proof',
    items: [
      { usage: 'required_once', recordType: 'observable_actor_action', visibleAction: '柜台后的店员把账册合上。' },
      { usage: 'optional', recordType: 'sensory_surface', publicSurface: '门外传来一阵短促的铃声。' },
    ],
  };
  const optionalOnly = assessRecallConsumption('门外响起一阵短促铃声，你仍看向货架。', packet);
  assert.equal(optionalOnly.consumedItemCount, 1);
  assert.equal(optionalOnly.requiredItemCount, 1);
  assert.equal(optionalOnly.consumedRequiredItemCount, 0);
  assert.equal(optionalOnly.consumed, false);
  assert.match(optionalOnly.reason, /required_once/);
});

test('accepted-final前释放保留真实召回条目数且不伪造消息号', () => {
  const packet = {
    packageId: 'recall-preaccepted-release',
    items: [
      { recordType: 'sensory_surface', publicSurface: '门外传来一阵短促的铃声。' },
      { recordType: 'observable_actor_action', visibleAction: '柜台后的店员把账册合上。' },
    ],
  };
  const reserved = reserveRecallPackage(emptyWorldState('chat-a'), packet);
  const settled = settleRecallPackage(reserved, packet.packageId, 'released', {
    sourceKey: 'chat-a:released-before-accepted-processing',
    messageId: null,
    consumedItemCount: 0,
    totalItemCount: packet.items.length,
    reason: '正文结构缺少开始标签',
  });
  const receipt = settled.world.recall.receipts[0];
  assert.equal(receipt.status, 'released');
  assert.equal(receipt.messageId, null);
  assert.equal(receipt.consumedItemCount, 0);
  assert.equal(receipt.totalItemCount, 2);
  assert.equal(receipt.reason, '正文结构缺少开始标签');
});

test('空字符串消息号也保持为空，合法的零号消息不被误删', () => {
  const emptyPacket = { packageId: 'recall-empty-message', items: [] };
  const emptySettled = settleRecallPackage(
    reserveRecallPackage(emptyWorldState('chat-a'), emptyPacket),
    emptyPacket.packageId,
    'released',
    { messageId: '' },
  );
  assert.equal(emptySettled.world.recall.receipts[0].messageId, null);

  const zeroPacket = { packageId: 'recall-zero-message', items: [] };
  const zeroSettled = settleRecallPackage(
    reserveRecallPackage(emptyWorldState('chat-a'), zeroPacket),
    zeroPacket.packageId,
    'consumed',
    { messageId: 0 },
  );
  assert.equal(zeroSettled.world.recall.receipts[0].messageId, 0);
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
  const injection = formatGenerationInjection({ tickets: [], recall: packet.items, profileDigest: [], currentAction: '<user_input>观察岚音。</user_input>' });
  assert.match(injection, /岚音始终低着头/);
  assert.match(injection, /袖口边缘沾着一点/);
  assert.match(injection, /本轮玩家明确动作/);
  assert.match(injection, /观察岚音/);
  assert.match(injection, /required_once/);
  assert.match(injection, /自然写入当前因果波且只出现一次/);
  assert.match(injection, /不补写输入外动机/);
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

test('召回相关性只看公开投影，不用私密摘要命中，也不拿无关项凑满上限', () => {
  const world = applyWorldProposal(emptyWorldState('chat-a'), {
    summary: '两地都在继续变化。',
    threads: [
      { id: 'south', title: '隐藏的南街计划', summary: '秘密关键词只存在私密摘要', publicSurface: '南街药房挂出了限购告示。', knowledge: 'hidden' },
      { id: 'north', title: '北港修船', summary: '船工等待木料', publicSurface: '北港船坞堆着新到的木料。', knowledge: 'hidden', urgency: 5 },
      { id: 'east', title: '东门排队', summary: '旅客入城', publicSurface: '东门外排起了入城长队。', knowledge: 'hidden', urgency: 4 },
    ],
  }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const north = prepareRecallPackage(world, '去北港看看木料', {}, 8, { chatId: 'chat-a', sourceKey: 'g2' });
  assert.equal(north.items.length, 1);
  assert.match(JSON.stringify(north.items), /北港船坞/);
  assert.doesNotMatch(JSON.stringify(north.items), /南街药房|东门外/);

  const hiddenNeedle = prepareRecallPackage(world, '秘密关键词', {}, 8, { chatId: 'chat-a', sourceKey: 'g3' });
  assert.equal(hiddenNeedle.items.length, 0);
  assert.doesNotMatch(JSON.stringify(hiddenNeedle.items), /秘密关键词|隐藏的南街计划/);
});

test('低信息继续只选当前最高优先公开事项一次，普通无关输入不硬塞召回', () => {
  const world = applyWorldProposal(emptyWorldState('chat-a'), {
    summary: '两条公开连续性都在发展。',
    threads: [
      { id: 'urgent', title: '钟楼警报', publicSurface: '钟楼的警报灯仍在闪烁。', urgency: 8 },
      { id: 'minor', title: '市场收摊', publicSurface: '市场摊贩开始收起棚布。', urgency: 2 },
    ],
  }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const continuation = prepareRecallPackage(world, '继续', {}, 8, { chatId: 'chat-a', sourceKey: 'g2' });
  assert.equal(continuation.items.length, 1);
  assert.equal(continuation.items[0].usage, 'required_once');
  assert.match(JSON.stringify(continuation.items), /警报灯/);
  const unrelated = prepareRecallPackage(world, '整理自己的背包', {}, 8, { chatId: 'chat-a', sourceKey: 'g3' });
  assert.deepEqual(unrelated.items, []);
  const describedAction = prepareRecallPackage(world, '观察柜台上的物品', {}, 8, { chatId: 'chat-a', sourceKey: 'g4' });
  assert.deepEqual(describedAction.items, []);
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

test('公开投影局部泄漏由本地确定性清除，医生私有世界与行动裁决完整保留', () => {
  const repaired = sanitizeWorldProposalPublicProjection(emptyWorldState('chat-a'), {
    summary: '医生私有世界继续推进人物的独立计划。',
    threads: [{
      id: 'thread-private', title: '私有观察线', summary: '人物在私下评估目标的行动价值。',
      offscreenBeat: '人物完成了一次不公开的资料整理。', nextBeat: '继续验证下一条线索。',
      publicSurface: '她其实正在评估你的价值。', publicClues: ['她暗中记录了名单。', '桌边留下了一小滴墨迹。'], knowledge: 'hidden',
    }],
    actorActions: [{
      actorId: 'actor-lin', threadId: 'thread-private', action: '私下整理观察记录',
      publicSurface: '她正在伪装无害。', publicClues: ['纸页边缘有一道新折痕。'],
    }],
    adjudications: [{
      actorId: 'actor-lin', threadId: 'thread-private', status: 'partial', resultSummary: '记录已整理但仍缺一项证据。',
      observableConsequence: '无人察觉她已经完成记录。', publicClues: ['桌边留下了一小滴墨迹。'],
    }],
  }, { acceptedText: '她把纸页压回桌面，桌边留下了一小滴墨迹。' });

  assert.equal(repaired.proposal.threads[0].summary, '人物在私下评估目标的行动价值。');
  assert.equal(repaired.proposal.threads[0].offscreenBeat, '人物完成了一次不公开的资料整理。');
  assert.equal(repaired.proposal.threads[0].publicSurface, '');
  assert.deepEqual(repaired.proposal.threads[0].publicClues, ['桌边留下了一小滴墨迹。']);
  assert.equal(repaired.proposal.actorActions[0].action, '私下整理观察记录');
  assert.equal(repaired.proposal.actorActions[0].publicSurface, '');
  assert.equal(repaired.proposal.adjudications[0].resultSummary, '记录已整理但仍缺一项证据。');
  assert.equal(repaired.proposal.adjudications[0].observableConsequence, '');
  assert.ok(repaired.repairs.length >= 4);
  assert.equal(validateWorldProposal(repaired.proposal, { previous: emptyWorldState('chat-a') }).ok, true);
});

test('没有正文精确证据的新揭示降为隐藏，已有揭示则恢复旧证据边界', () => {
  const fresh = sanitizeWorldProposalPublicProjection(emptyWorldState('chat-a'), {
    summary: '模型误把尚未公开的事实标成已揭示。',
    threads: [{ id: 'new', title: '隐藏事项', summary: '私有事实继续存在。', knowledge: 'observed', revealedSummary: '玩家已经知道真相。', revealEvidence: '正文没有这句话' }],
  }, { acceptedText: '玩家只看见门边有一道浅痕。' });
  assert.equal(fresh.proposal.threads[0].knowledge, 'hidden');
  assert.equal(fresh.proposal.threads[0].revealedSummary, '');
  assert.equal(fresh.proposal.threads[0].revealEvidence, '');
  assert.equal(validateWorldProposal(fresh.proposal, { previous: emptyWorldState('chat-a'), acceptedText: '玩家只看见门边有一道浅痕。' }).ok, true);

  const previous = applyWorldProposal(emptyWorldState('chat-a'), {
    summary: '旧事实已经由正文合法揭示。',
    threads: [{ id: 'old', title: '旧事项', summary: '真相已公开。', knowledge: 'observed', revealedSummary: '旧事实已经公开。', revealEvidence: '玩家亲眼看见了旧事实' }],
  }, { chatId: 'chat-a', turn: 1, sourceRef: { sourceKey: 'm1' } });
  const changedWithoutEvidence = sanitizeWorldProposalPublicProjection(previous, {
    summary: '模型试图扩大旧揭示的公开范围。',
    threads: [{ id: 'old', title: '旧事项', summary: '私有层新增了更多信息。', knowledge: 'observed', revealedSummary: '旧事实与新增秘密都公开。', revealEvidence: '正文没有新增证据' }],
  }, { acceptedText: '本轮没有重新展示那份证据。' });
  assert.equal(changedWithoutEvidence.proposal.threads[0].knowledge, 'observed');
  assert.equal(changedWithoutEvidence.proposal.threads[0].revealedSummary, '旧事实已经公开。');
  assert.equal(changedWithoutEvidence.proposal.threads[0].revealEvidence, '玩家亲眼看见了旧事实');
});

test('公开投影按知情语义而非裸秘密字样裁决，公开言行可保留但秘密身份断言仍拒绝', () => {
  const observable = validateWorldProposal({
    summary: '广场上的公开对峙继续发展。',
    actorActions: [{
      actorId: 'actor-public', threadId: 'thread-public', action: '当众解释已公开的见闻',
      visibility: 'observable', publicSurface: '那名青年举着双手，当众说出关于副本入口的秘密，并请求对方把武器挪开。',
    }],
  });
  assert.equal(observable.ok, true, observable.errors.join('\n'));

  const leakedIdentity = validateWorldProposal({
    summary: '医生私有层保留了未公开身份。',
    threads: [{
      id: 'thread-secret', title: '身份追查', summary: '未公开身份仍在调查',
      publicSurface: '她的秘密身份是幕后联络人。', knowledge: 'hidden',
    }],
  });
  assert.equal(leakedIdentity.ok, false);
  assert.match(leakedIdentity.errors.join('；'), /公开投影/);
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
