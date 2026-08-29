import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  WORLD_SCHEMA_VERSION,
  applyWorldProposal,
  createWorldAdvanceTickets,
  emptyWorldState,
  formatGenerationInjection,
  markWorldEffectsShown,
  normalizeWorldState,
  parseActorPlan,
  parseWorldProposal,
  privateProfileDigestFromData,
  profileDigestFromData,
  recallSelectionInput,
  seedWorldSubjectsFromProfiles,
  selectDueWorldSubjects,
  selectWorldRecall,
  sanitizeWorldAdjudication,
  validateWorldAdjudication,
  worldConsistencyReport,
  worldAdjudicationDigest,
} from '../core.mjs';

const sourceAt = '2026-08-29T00:00:00.000Z';

function subject(overrides = {}) {
  return {
    id: 'subject-default',
    type: 'process',
    name: '默认进程',
    anchor: '依据既有条件持续运行',
    current: '进程仍在运作',
    goal: '按条件继续演化',
    knowledge: ['已确认条件'],
    resources: ['既有资源'],
    constraints: ['受时间与资源限制'],
    nextAction: '检查下一阶段条件',
    nextCheckTurn: 2,
    status: 'active',
    lastAdvancedTurn: 1,
    createdTurn: 1,
    updatedTurn: 1,
    source: { chatId: 'chat-a', at: sourceAt },
    ...overrides,
  };
}

function worldWith(subjects, overrides = {}) {
  return normalizeWorldState({
    schemaVersion: WORLD_SCHEMA_VERSION,
    chatId: 'chat-a',
    revision: 0,
    turn: 1,
    summary: '多个主体按各自条件继续运作。',
    subjects,
    changes: [],
    failures: [],
    persistence: { status: 'loaded' },
    updatedAt: sourceAt,
    ...overrides,
  }, { chatId: overrides.chatId || 'chat-a' });
}

function ticket(subjectId, overrides = {}) {
  return {
    ticketId: `ticket-${subjectId}`,
    subjectId,
    advanceMode: 'act',
    intensity: 'medium',
    resultEnvelope: 'partial',
    userRelation: 'unrelated',
    publicChannel: 'none',
    ...overrides,
  };
}

function nextPlan(subjectId, boundTicket, overrides = {}, adjudication = {}) {
  return {
    planId: `next-plan-${subjectId}`,
    subjectId,
    phase: 'next',
    goal: '',
    knowledge: [],
    nextAction: '检查结算后的新条件',
    nextCheckTurn: 3,
    basedOnTicketId: boundTicket.ticketId,
    basedOnAttempt: boundTicket.attemptDirective,
    basedOnAdjudicationDigest: worldAdjudicationDigest(adjudication),
    plannedTurn: 2,
    sourceKey: 'chat-a:message:2',
    ...overrides,
  };
}

test('到期人物、势力和环境过程都会被调度，玩家没有关注也不会令世界停摆', () => {
  const world = worldWith([
    subject({ id: 'person-lin', type: 'person', name: '林澄', nextCheckTurn: 2 }),
    subject({ id: 'faction-port', type: 'faction', name: '北港行会', nextCheckTurn: 2 }),
    subject({ id: 'process-rain', type: 'process', name: '雨季水位', nextCheckTurn: 2 }),
    subject({ id: 'done-old', type: 'process', name: '已经结束的事项', status: 'done', nextCheckTurn: 0 }),
  ]);

  const selected = selectDueWorldSubjects(world, {
    turn: 2,
    limit: 3,
    userInput: '我留在房间整理自己的背包。',
  });

  assert.deepEqual(new Set(selected.map((entry) => entry.id)), new Set(['person-lin', 'faction-port', 'process-rain']));
  assert.equal(selected.some((entry) => entry.id === 'done-old'), false);
});

test('人物档案只为世界主体补空值，不会把档案旧快照覆盖已经推进的动态状态', () => {
  const baseline = worldWith([
    subject({
      id: 'person-lin',
      type: 'person',
      name: '林澄',
      profileId: 'profile-lin',
      anchor: '旧锚点',
      current: '已经离开药房前往北港',
      goal: '核验北港失踪的货单',
      knowledge: ['已经确认第三号货箱被调包'],
      resources: ['随身携带的原始货单'],
      constraints: ['只能在夜间接触北港仓库'],
      nextAction: '等待夜间换岗后核对原始货单',
    }),
  ]);
  const profile = {
    profileId: 'profile-lin',
    name: '林澄',
    identity: { species: '人类', occupation: '药剂师', affiliation: '南街药房' },
    personality: { temperament: '谨慎', coreDesire: '维持药房运转', values: '守信', thinking: '先核对证据', moralBoundary: '不伤及无辜' },
    currentState: { location: '南街药房', condition: '疲惫', emotion: '平静', goal: '完成今日配药' },
    knowledge: ['熟悉常见药材'],
    resources: ['药房账册'],
  };

  const seeded = seedWorldSubjectsFromProfiles(baseline, { 'profile-lin': profile }, {
    turn: 2,
    at: sourceAt,
    changedProfileIds: ['profile-lin'],
    acceptedText: '本回合正文没有改写林澄的世界私密状态。',
  });
  const lin = seeded.world.subjects[0];

  assert.equal(lin.anchor, '旧锚点');
  assert.equal(lin.current, '已经离开药房前往北港');
  assert.equal(lin.goal, '核验北港失踪的货单');
  assert.deepEqual(lin.knowledge, ['已经确认第三号货箱被调包']);
  assert.deepEqual(lin.resources, ['随身携带的原始货单']);
  assert.deepEqual(lin.constraints, ['只能在夜间接触北港仓库']);
  assert.equal(lin.nextAction, '等待夜间换岗后核对原始货单');
  assert.equal(seeded.changed, 0);
});

test('重复完整档案提交不会把已经耗尽的世界资源或动态计划从旧档案复活', () => {
  const baseline = worldWith([subject({
    id: 'person-lin', type: 'person', name: '林澄', profileId: 'profile-lin',
    current: '已经抵达北港仓库', goal: '核验被调包的第三号货箱',
    knowledge: [], resources: [], constraints: ['仓库已经封门'],
    nextAction: '等待守卫换岗', lastAdvancedTurn: 4, recentModes: ['act'],
  })], {
    turn: 4,
    changes: [{
      id: 'world-progress-lin', subjectIds: ['person-lin'], turn: 4, mode: 'act',
      attempt: '消耗原始货单换取入库记录', outcome: '货单已经交出', stateChange: '随身原始货单已耗尽',
    }],
  });
  const profile = {
    profileId: 'profile-lin', name: '林澄',
    identity: { occupation: '药剂师' }, personality: { coreDesire: '经营药房' },
    currentState: { location: '南街药房', condition: '平静', goal: '完成今日配药' },
    knowledge: ['旧档案知识'], resources: ['已经交出的原始货单'],
  };

  const seeded = seedWorldSubjectsFromProfiles(baseline, { 'profile-lin': profile }, {
    turn: 4,
    changedProfileIds: ['profile-lin'],
    acceptedText: '本回合没有出现林澄。',
  });
  const lin = seeded.world.subjects[0];
  assert.equal(lin.current, '已经抵达北港仓库');
  assert.equal(lin.goal, '核验被调包的第三号货箱');
  assert.deepEqual(lin.knowledge, []);
  assert.deepEqual(lin.resources, []);
  assert.deepEqual(lin.constraints, ['仓库已经封门']);
  assert.equal(lin.nextAction, '等待守卫换岗');
  assert.equal(seeded.changed, 0);
});

test('同一seed和主体得到稳定裁决票，主体子集或排列顺序不会改变其票据', () => {
  const lin = subject({ id: 'person-lin', type: 'person', name: '林澄' });
  const port = subject({ id: 'faction-port', type: 'faction', name: '北港行会' });
  const rain = subject({ id: 'process-rain', type: 'process', name: '雨季水位' });
  const options = { seed: 'chat-a:message:8', turn: 8 };

  const full = createWorldAdvanceTickets([lin, port, rain], options);
  const reordered = createWorldAdvanceTickets([rain, lin], options);
  const subset = createWorldAdvanceTickets([lin], options);
  const fullLin = full.find((entry) => entry.subjectId === lin.id);

  assert.deepEqual(reordered.find((entry) => entry.subjectId === lin.id), fullLin);
  assert.deepEqual(subset[0], fullLin);
});

test('隔离主体计划使用自然语言绑定稳定ID，冻结attempt后才生成裁决ticket', () => {
  const lin = subject({ id: 'person-lin', type: 'person', name: '林澄', nextAction: '旧的未签名行动' });
  const parsed = parseActorPlan(`[ACTOR_PLAN person-lin]
尝试：只检查自己保管的原始收据
[/ACTOR_PLAN]`, {
    subjectId: 'person-lin',
    phase: 'bootstrap',
    turn: 2,
    sourceKey: 'chat-a:message:2',
  });

  assert.equal(parsed.ok, true);
  const [frozen] = createWorldAdvanceTickets([lin], {
    seed: 'chat-a:message:2',
    turn: 2,
    actorPlans: [parsed.plan],
  });
  assert.equal(frozen.actorPlanId, parsed.plan.planId);
  assert.equal(frozen.attemptDirective, '只检查自己保管的原始收据');
  assert.notEqual(frozen.attemptDirective, lin.nextAction);
});

test('严格世界提交只接受ticket逐字attempt，规划字段只归绑定主体plan所有且局部失败不拖累其他主体', () => {
  const baseline = worldWith([
    subject({ id: 'person-lin', type: 'person', name: '林澄', goal: '旧目标甲', knowledge: ['旧知识甲'], nextAction: '旧行动甲' }),
    subject({ id: 'faction-port', type: 'faction', name: '北港行会', goal: '旧目标乙', knowledge: ['旧知识乙'], nextAction: '旧行动乙' }),
  ]);
  const linTicket = ticket('person-lin', { actorPlanId: 'bootstrap-lin', attemptDirective: '逐字行动甲' });
  const portTicket = ticket('faction-port', { actorPlanId: 'bootstrap-port', attemptDirective: '逐字行动乙' });
  const proposal = parseWorldProposal(`[SUBJECT person-lin]
尝试：逐字行动甲
结果：完成了可核验的小步
状态变化：甲的客观状态已经改变
现状：甲正在收好刚取得的凭据
目标：GLOBAL_GOAL_SENTINEL
已知：GLOBAL_KNOWLEDGE_SENTINEL
下一步：GLOBAL_NEXT_SENTINEL
下次检查：99
[/SUBJECT]

[SUBJECT faction-port]
尝试：近义改写后的行动乙
结果：声称已经完成
状态变化：乙声称发生变化
现状：乙声称已推进
[/SUBJECT]`, { subjects: baseline.subjects });
  const adjudicationBySubject = new Map(proposal.updates.map((update) => [update.subjectId, update]));
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    sourceKey: 'chat-a:message:2',
    tickets: [linTicket, portTicket],
    actorPlans: [
      nextPlan('person-lin', linTicket, { goal: '甲自己的新目标', nextAction: '甲根据结果检查下一张凭据', nextCheckTurn: 4 }, adjudicationBySubject.get('person-lin')),
      nextPlan('faction-port', portTicket, { goal: '乙自己的新目标', nextAction: '乙检查下一批货', nextCheckTurn: 4 }, adjudicationBySubject.get('faction-port')),
    ],
    scheduledSubjects: baseline.subjects,
    requireActorPlans: true,
  });

  const lin = merged.world.subjects.find((entry) => entry.id === 'person-lin');
  const port = merged.world.subjects.find((entry) => entry.id === 'faction-port');
  assert.deepEqual(merged.applied, ['person-lin']);
  assert.equal(lin.goal, '甲自己的新目标');
  assert.deepEqual(lin.knowledge, ['旧知识甲']);
  assert.equal(lin.nextAction, '甲根据结果检查下一张凭据');
  assert.equal(lin.nextCheckTurn, 4);
  assert.equal(lin.planReceipt.planId, 'next-plan-person-lin');
  assert.doesNotMatch(JSON.stringify(lin), /GLOBAL_/u);
  assert.equal(port.current, '进程仍在运作');
  assert.equal(merged.skipped.some((entry) => entry.subjectId === 'faction-port' && entry.code === 'attempt_exact_mismatch'), true);
});

test('缺少绑定后续plan时只拒绝该主体，另一个主体仍能在同一世界revision提交', () => {
  const baseline = worldWith([
    subject({ id: 'person-lin', type: 'person', name: '林澄' }),
    subject({ id: 'faction-port', type: 'faction', name: '北港行会' }),
  ]);
  const linTicket = ticket('person-lin', { actorPlanId: 'bootstrap-lin', attemptDirective: '行动甲' });
  const portTicket = ticket('faction-port', { actorPlanId: 'bootstrap-port', attemptDirective: '行动乙' });
  const proposal = parseWorldProposal(`[SUBJECT person-lin]
尝试：行动甲
结果：取得一项局部进展
状态变化：甲的状态发生具体变化
现状：甲完成本轮步骤
[/SUBJECT]
[SUBJECT faction-port]
尝试：行动乙
结果：取得一项局部进展
状态变化：乙的状态发生具体变化
现状：乙完成本轮步骤
[/SUBJECT]`, { subjects: baseline.subjects });
  const linAdjudication = proposal.updates.find((update) => update.subjectId === 'person-lin');
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    sourceKey: 'chat-a:message:2',
    tickets: [linTicket, portTicket],
    actorPlans: [nextPlan('person-lin', linTicket, {}, linAdjudication)],
    scheduledSubjects: baseline.subjects,
    requireActorPlans: true,
  });

  assert.deepEqual(merged.applied, ['person-lin']);
  assert.deepEqual(merged.unresolvedSubjectIds, ['faction-port']);
  assert.equal(merged.world.revision, 1);
  assert.equal(merged.skipped.some((entry) => entry.subjectId === 'faction-port' && entry.code === 'actor_plan_missing'), true);
});

test('局部重试的裁决内容变化时不得复用旧next plan，必须按新adjudication重新规划', () => {
  const baseline = worldWith([subject({ id: 'person-lin', type: 'person', name: '林澄' })]);
  const boundTicket = ticket('person-lin', { actorPlanId: 'bootstrap-lin', attemptDirective: '检查原始收据' });
  const staleAdjudication = {
    subjectId: 'person-lin', attempt: '检查原始收据', outcome: '旧返回声称找到编号', cost: '一个时段',
    stateChange: '旧返回声称掌握编号', current: '旧返回现状',
  };
  const proposal = parseWorldProposal(`[SUBJECT person-lin]
尝试：检查原始收据
结果：重试后确认收据已经被水浸毁
代价：耗费一个时段且失去原件
状态变化：可用证据从原始收据变成残留编号拓印
现状：林澄只保留了一份模糊拓印
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    sourceKey: 'chat-a:message:2',
    tickets: [boundTicket],
    actorPlans: [nextPlan('person-lin', boundTicket, { nextAction: '依据旧成功结果追查编号' }, staleAdjudication)],
    scheduledSubjects: baseline.subjects,
    requireActorPlans: true,
  });

  assert.deepEqual(merged.applied, []);
  assert.equal(merged.skipped.some((entry) => entry.code === 'actor_plan_adjudication_mismatch'), true);
  assert.equal(merged.world.subjects[0].nextAction, '检查下一阶段条件');
});

test('自然语言回复逐块解析，坏块只跳过自身，其他主体仍局部提交', () => {
  const baseline = worldWith([
    subject({ id: 'person-lin', type: 'person', name: '林澄', current: '正在核对药材账目' }),
    subject({ id: 'faction-port', type: 'faction', name: '北港行会', current: '仍在等待木料' }),
    subject({ id: 'process-rain', type: 'process', name: '雨季水位', current: '河水缓慢上涨' }),
  ]);
  const scheduled = baseline.subjects;
  const proposal = parseWorldProposal(`世界摘要：两项形成了具体变化，一项返回损坏。

[SUBJECT person-lin]
尝试：核对三家药商的交货账目
结果：找到一笔重复登记的转运记录
状态变化：林澄掌握了一条可继续核验的货运编号
现状：正在比对货运编号与仓库收据
下一步：去仓库核对原始收据
下次检查：3
[/SUBJECT]

[SUBJECT faction-port]
备注：这一块没有任何受支持字段
[/SUBJECT]

[SUBJECT process-rain]
尝试：依据上游降雨与闸门流量重新计算水位
结果：低洼河岸开始积水
状态变化：南岸低洼处出现连续积水
现状：水位已越过第一道警戒刻度
下一步：检查旧水门能否承受持续水压
下次检查：3
[/SUBJECT]`, { subjects: scheduled });

  assert.equal(proposal.updates.length, 2);
  assert.equal(proposal.errors.length, 1);
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    sourceKey: 'chat-a:message:2',
    tickets: [
      ticket('person-lin', { attemptDirective: '核对三家药商的交货账目' }),
      ticket('faction-port', { attemptDirective: '核验木料车队是否已经通过东门' }),
      ticket('process-rain', { advanceMode: 'evolve', attemptDirective: '依据上游降雨与闸门流量重新计算水位' }),
    ],
    scheduledSubjects: scheduled,
  });

  assert.deepEqual(new Set(merged.applied), new Set(['person-lin', 'process-rain']));
  assert.equal(merged.world.subjects.find((entry) => entry.id === 'faction-port').current, '仍在等待木料');
  assert.equal(merged.world.subjects.find((entry) => entry.id === 'faction-port').silenceTurns, 1);
  assert.match(merged.world.subjects.find((entry) => entry.id === 'process-rain').current, /第一道警戒刻度/);
  assert.equal(merged.world.changes.length, 2);
  assert.equal(merged.world.failures.some((entry) => entry.code === 'empty_subject_block'), true);
});

test('到期主体必须执行ticket绑定的attemptDirective，擅自换行动只局部跳过', () => {
  const baseline = worldWith([
    subject({ id: 'person-lin', type: 'person', name: '林澄', current: '正在药房核对账册', nextAction: '去仓库核对原始收据' }),
    subject({ id: 'faction-port', type: 'faction', name: '北港行会', current: '正在清点三号货箱', nextAction: '检查三号货箱封条' }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT person-lin]
尝试：去仓库核对原始收据
结果：找到一张编号重复的收据
状态变化：林澄确认同一批货被重复登记
现状：正在比对重复编号
下一步：询问仓库登记员
下次检查：3
[/SUBJECT]

[SUBJECT faction-port]
尝试：召集人手突袭东门商队
结果：商队被迫停下
状态变化：东门交通受到干扰
现状：行会成员控制了东门
下一步：扣押商队货物
下次检查：3
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    sourceKey: 'chat-a:message:2',
    tickets: [
      ticket('person-lin', { attemptDirective: '去仓库核对原始收据' }),
      ticket('faction-port', { attemptDirective: '检查三号货箱封条' }),
    ],
    scheduledSubjects: baseline.subjects,
  });

  assert.deepEqual(merged.applied, ['person-lin']);
  assert.equal(merged.world.subjects.find((entry) => entry.id === 'faction-port').current, '正在清点三号货箱');
  assert.equal(merged.world.changes.some((entry) => entry.subjectIds.includes('faction-port')), false);
  assert.equal(merged.skipped.some((entry) => entry.subjectId === 'faction-port' && entry.code === 'attempt_directive_mismatch'), true);
  assert.deepEqual(merged.unresolvedSubjectIds, ['faction-port']);
});

test('拼错的主体ID只形成局部错误，绝不会按返回位置串写到另一个主体', () => {
  const baseline = worldWith([
    subject({ id: 'person-lin', type: 'person', name: '林澄', current: '仍在药房清点库存' }),
    subject({ id: 'faction-port', type: 'faction', name: '北港行会', current: '仍在等待木料' }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT person-lni]
尝试：离开药房前往北港
结果：已经抵达北港仓库
状态变化：人物位置已经改变
现状：正在北港仓库调查
下一步：打开第三号货箱
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    sourceKey: 'chat-a:message:2',
    tickets: [ticket('person-lin'), ticket('faction-port')],
    scheduledSubjects: baseline.subjects,
  });

  assert.equal(proposal.updates.length, 0);
  assert.equal(proposal.errors[0].code, 'unknown_subject_id');
  assert.deepEqual(merged.applied, []);
  assert.equal(merged.world.subjects.find((entry) => entry.id === 'person-lin').current, '仍在药房清点库存');
  assert.equal(merged.world.subjects.find((entry) => entry.id === 'faction-port').current, '仍在等待木料');
  assert.deepEqual(new Set(merged.unresolvedSubjectIds), new Set(['person-lin', 'faction-port']));
});

test('稳定ID以subject开头时只剥一次块标记，并允许显式耗尽资源与解除约束', () => {
  const baseline = worldWith([subject({
    id: 'subject-iubypg',
    name: '北港临时封锁',
    resources: ['最后一队巡逻员'],
    constraints: ['旧通行令仍然有效'],
    nextAction: '完成最后一轮路口核验',
    nextCheckTurn: 2,
  })]);
  const proposal = parseWorldProposal(`[SUBJECT subject-iubypg]
尝试：完成最后一轮路口核验
结果：巡逻员完成核验后离开，旧通行令同时失效
状态变化：临时封锁不再占用巡逻员，也不再受旧通行令限制
现状：路口恢复普通通行
资源：无
约束：无
下一步：下一时段复核普通通行是否稳定
下次检查：3
[/SUBJECT]`, { subjects: baseline.subjects });

  assert.equal(proposal.errors.length, 0);
  assert.equal(proposal.updates[0].subjectId, 'subject-iubypg');
  assert.deepEqual(proposal.updates[0].resources, []);
  assert.deepEqual(proposal.updates[0].constraints, []);
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    tickets: [ticket('subject-iubypg', { attemptDirective: '完成最后一轮路口核验' })],
    scheduledSubjects: baseline.subjects,
  });
  assert.deepEqual(merged.applied, ['subject-iubypg']);
  assert.deepEqual(merged.world.subjects[0].resources, []);
  assert.deepEqual(merged.world.subjects[0].constraints, []);
});

test('NEW主体必须显式声明类型，缺失type不能静默默认为process', () => {
  const baseline = worldWith([
    subject({ id: 'process-rain', type: 'process', name: '雨季水位' }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT NEW]
名称：港区货运压力
稳定锚点：随车队、仓容和道路条件变化
现状：两条主要道路同时拥堵
目标：按运输条件持续演化
尝试：核对当前排队车队
结果：等待时间延长到两个时段
状态变化：港区货运出现持续积压
下一步：检查东门是否恢复通行
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, { turn: 2, scheduledSubjects: [] });

  assert.deepEqual(merged.applied, []);
  assert.equal(merged.world.subjects.length, 1);
  assert.equal(merged.world.subjects[0].id, 'process-rain');
  assert.equal(merged.skipped.some((entry) => entry.code === 'new_subject_type_required'), true);
});

test('NEW不得用现有主体同名再造第二份权威，也不得借NEW覆盖现有主体', () => {
  const baseline = worldWith([
    subject({ id: 'process-rain', type: 'process', name: '雨季水位', current: '水位缓慢上涨' }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT NEW]
类型：process
名称：雨季水位
正文锚点：雨季水位仍在缓慢上涨
稳定锚点：另一份重复锚点
现状：模型试图重置为水位已经下降
目标：覆盖旧主体
尝试：创建重名主体
结果：声称旧状态已经失效
状态变化：模型试图覆盖既有世界权威
下一步：继续覆盖
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    acceptedText: '雨季水位仍在缓慢上涨。',
    scheduledSubjects: [],
  });

  assert.deepEqual(merged.applied, []);
  assert.equal(merged.world.subjects.length, 1);
  assert.equal(merged.world.subjects[0].current, '水位缓慢上涨');
  assert.equal(merged.skipped.some((entry) => entry.code === 'duplicate_new_subject'), true);
});

test('NEW可用正文逐字sourceAnchor命名推断过程，名称和锚点都无正文依据时拒绝', () => {
  const baseline = worldWith([], { turn: 0, summary: '' });
  const acceptedText = '石阶上的水痕比刚才高了一层，旧水门本身仍然关闭。';
  const anchoredProposal = parseWorldProposal(`[SUBJECT NEW]
类型：process
名称：旧水门水位变化
正文锚点：石阶上的水痕比刚才高了一层
稳定锚点：水位随上游来水、闸门流量与地势持续变化
现状：下游石阶水痕已经升高一层
目标：按来水与排水条件继续演化
尝试：记录本时段水痕高度
结果：确认水痕高于上一时段
状态变化：旧水门下游水位出现持续上升迹象
下一步：下一时段复核水痕
[/SUBJECT]`, { subjects: [] });
  const anchored = applyWorldProposal(baseline, anchoredProposal, {
    turn: 1,
    acceptedText,
    scheduledSubjects: [],
  });
  assert.deepEqual(anchored.applied.length, 1);
  assert.equal(anchored.world.subjects[0].name, '旧水门水位变化');

  const unsupportedProposal = parseWorldProposal(`[SUBJECT NEW]
类型：process
名称：北港秘密金融危机
稳定锚点：由后台模型自行推断的长期经济过程
现状：危机正在暗中扩大
目标：继续扩大
尝试：计算债务
结果：债务增加
状态变化：危机进一步扩大
下一步：继续计算
[/SUBJECT]`, { subjects: [] });
  const unsupported = applyWorldProposal(baseline, unsupportedProposal, {
    turn: 1,
    acceptedText,
    scheduledSubjects: [],
  });
  assert.deepEqual(unsupported.applied, []);
  assert.equal(unsupported.world.subjects.length, 0);
  assert.equal(unsupported.skipped.some((entry) => entry.code === 'new_subject_missing_accepted_anchor'), true);
});

test('发现扫描返回的新主体意图不会直接成为可信计划，必须等待单主体隔离bootstrap', () => {
  const baseline = worldWith([], { turn: 1 });
  const proposal = parseWorldProposal(`[SUBJECT NEW]
类型：process
名称：旧水门水压
正文锚点：旧水门的铰链正在渗水
稳定锚点：水压随上游来水与闸门状态变化
现状：旧水门的铰链正在渗水
目标：GLOBAL_DISCOVERY_GOAL
已知：GLOBAL_DISCOVERY_KNOWLEDGE
下一步：GLOBAL_DISCOVERY_NEXT
尝试：GLOBAL_DISCOVERY_ATTEMPT
结果：正文已经证明渗水
状态变化：铰链处存在稳定渗水
[/SUBJECT]`, { subjects: [] });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    acceptedText: '远处，旧水门的铰链正在渗水。',
    sourceKey: 'chat-a:message:2',
    scheduledSubjects: [],
    requireActorPlans: true,
  });
  const discovered = merged.world.subjects[0];

  assert.equal(merged.applied.length, 1);
  assert.equal(discovered.goal, '');
  assert.deepEqual(discovered.knowledge, []);
  assert.equal(discovered.nextAction, '');
  assert.equal(discovered.nextCheckTurn, 3);
  assert.equal(discovered.planReceipt, null);
  assert.equal(discovered.status, 'waiting');
  assert.equal(discovered.current, '旧水门的铰链正在渗水');
  assert.equal(discovered.anchor, '旧水门的铰链正在渗水');
  assert.deepEqual(discovered.resources, []);
  assert.deepEqual(discovered.constraints, []);
  assert.deepEqual(discovered.threadKeys, []);
  assert.equal(merged.world.changes.length, 0);
});

test('partial票据拒绝整体完成与纯失败零进展，只接受真实阶段性变化', () => {
  const baseline = worldWith([
    subject({ id: 'partial-total', name: '整体完成样本' }),
    subject({ id: 'partial-none', name: '零进展样本' }),
    subject({ id: 'partial-staged', name: '阶段进展样本' }),
  ]);
  const tickets = baseline.subjects.map((entry) => ticket(entry.id, {
    actorPlanId: `plan-${entry.id}`,
    attemptDirective: `执行-${entry.id}`,
    resultEnvelope: 'partial',
  }));
  const proposal = parseWorldProposal(`[SUBJECT partial-total]
尝试：执行-partial-total
结果：整个任务已经全部完成
状态变化：全部阶段彻底完成，整体目标已经达成
现状：任务完全结束
下一步：检查记录
下次检查：3
[/SUBJECT]

[SUBJECT partial-none]
尝试：执行-partial-none
结果：行动完全失败，没有任何进展
状态变化：完全失败，保持原状且没有变化
现状：一切仍旧不变
下一步：更换条件后再试
下次检查：3
[/SUBJECT]

[SUBJECT partial-staged]
尝试：执行-partial-staged
结果：完成第一阶段，但后续阶段尚未开始
状态变化：第一批凭据已经核对并封存，余下凭据仍待处理
现状：核对工作进入第二阶段
下一步：核对余下凭据
下次检查：3
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    tickets,
    scheduledSubjects: baseline.subjects,
  });

  assert.deepEqual(merged.applied, ['partial-staged']);
  assert.equal(merged.skipped.some((entry) => entry.subjectId === 'partial-total' && entry.code === 'result_envelope_conflict'), true);
  assert.equal(merged.skipped.some((entry) => entry.subjectId === 'partial-none' && entry.code === 'result_envelope_conflict'), true);
  assert.equal(validateWorldAdjudication(proposal.updates[2], tickets[2]).ok, true);
});

test('全局裁决的跨主体私密片段局部拒绝，既有threadKeys冻结且新键必须有本主体证据', () => {
  const baseline = worldWith([
    subject({
      id: 'subject-a', name: '甲', current: 'A_PRIVATE_CURRENT_SENTINEL',
      resources: ['A_PRIVATE_RESOURCE_SENTINEL'], constraints: ['A_PRIVATE_CONSTRAINT_SENTINEL'],
      threadKeys: ['A_PRIVATE_THREAD_SENTINEL'],
    }),
    subject({ id: 'subject-b', name: '乙', current: '乙保持自己的旧状态', resources: ['乙方资源'], constraints: ['乙方限制'], threadKeys: ['乙方既有主题'] }),
  ]);
  const tickets = [
    ticket('subject-a', { actorPlanId: 'plan-a', attemptDirective: '甲执行自己的冻结尝试' }),
    ticket('subject-b', { actorPlanId: 'plan-b', attemptDirective: '乙执行自己的冻结尝试' }),
  ];
  const proposal = parseWorldProposal(`[SUBJECT subject-a]
尝试：甲执行自己的冻结尝试
结果：甲完成第一阶段并建立A_SELF_PROVEN_THREAD
状态变化：第一阶段已经推进，A_SELF_PROVEN_THREAD形成可追踪记录
现状：甲进入下一阶段
支线：A_PRIVATE_THREAD_SENTINEL；A_SELF_PROVEN_THREAD；A_UNPROVEN_THREAD
[/SUBJECT]

[SUBJECT subject-b]
尝试：乙执行自己的冻结尝试
结果：乙错误取得A_PRIVATE_RESOURCE_SENTINEL
状态变化：A_PRIVATE_CURRENT_SENTINEL
现状：A_PRIVATE_CURRENT_SENTINEL
资源：A_PRIVATE_RESOURCE_SENTINEL
约束：A_PRIVATE_CONSTRAINT_SENTINEL
支线：A_PRIVATE_THREAD_SENTINEL
[/SUBJECT]`, { subjects: baseline.subjects });
  const cleanA = sanitizeWorldAdjudication(proposal.updates[0], baseline.subjects[0], { subjects: baseline.subjects });
  const blockedB = sanitizeWorldAdjudication(proposal.updates[1], baseline.subjects[1], { subjects: baseline.subjects });
  assert.equal(cleanA.ok, true);
  assert.deepEqual(cleanA.update.threadKeys, ['A_PRIVATE_THREAD_SENTINEL', 'A_SELF_PROVEN_THREAD']);
  assert.equal(blockedB.ok, false);
  assert.equal(blockedB.code, 'cross_subject_private_leak');

  const plans = [
    nextPlan('subject-a', tickets[0], { nextAction: '甲检查第二阶段条件' }, proposal.updates[0]),
    nextPlan('subject-b', tickets[1], { nextAction: '乙检查自己的条件' }, proposal.updates[1]),
  ];
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    sourceKey: 'chat-a:message:2',
    tickets,
    scheduledSubjects: baseline.subjects,
    actorPlans: plans,
    requireActorPlans: true,
  });
  const a = merged.world.subjects.find((entry) => entry.id === 'subject-a');
  const b = merged.world.subjects.find((entry) => entry.id === 'subject-b');
  assert.deepEqual(merged.applied, ['subject-a']);
  assert.deepEqual(merged.unresolvedSubjectIds, ['subject-b']);
  assert.deepEqual(a.threadKeys, ['A_PRIVATE_THREAD_SENTINEL', 'A_SELF_PROVEN_THREAD']);
  assert.equal(b.current, '乙保持自己的旧状态');
  assert.deepEqual(b.resources, ['乙方资源']);
  assert.deepEqual(b.constraints, ['乙方限制']);
  assert.deepEqual(b.threadKeys, ['乙方既有主题']);
  assert.equal(merged.skipped.some((entry) => entry.subjectId === 'subject-b' && entry.code === 'cross_subject_private_leak'), true);
});

test('跨主体旧裁决私密字段进入禁用片段，本主体自己的历史仍可用于连续结算', () => {
  const baseline = worldWith([
    subject({ id: 'subject-a', name: '甲', current: '甲维持自己的当前状态' }),
    subject({ id: 'subject-b', name: '乙', current: '乙维持自己的当前状态' }),
  ]);
  const subjectHistories = {
    'subject-a': [{
      attempt: 'A_PRIVATE_HISTORY_ATTEMPT_SENTINEL',
      outcome: 'A_PRIVATE_HISTORY_OUTCOME_SENTINEL',
      cost: 'A_PRIVATE_HISTORY_COST_SENTINEL',
      stateChange: 'A_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL',
    }],
    'subject-b': [{
      attempt: 'B_PRIVATE_HISTORY_ATTEMPT_SENTINEL',
      outcome: 'B_PRIVATE_HISTORY_OUTCOME_SENTINEL',
      cost: 'B_PRIVATE_HISTORY_COST_SENTINEL',
      stateChange: 'B_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL',
    }, {
      attempt: 'SHARED_VALID_ATTEMPT_SENTINEL',
      outcome: '乙过去执行同名动作时留下的私密结果',
      cost: '乙过去执行同名动作时承担的私密代价',
      stateChange: '乙过去执行同名动作时形成的私密变化',
    }],
  };
  const leakedIntoA = sanitizeWorldAdjudication({
    subjectId: 'subject-a',
    outcome: '甲错误沿用了B_PRIVATE_HISTORY_OUTCOME_SENTINEL',
    stateChange: 'B_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL',
  }, baseline.subjects[0], { subjects: baseline.subjects, subjectHistories });
  assert.equal(leakedIntoA.ok, false);
  assert.equal(leakedIntoA.code, 'cross_subject_private_leak');

  const sharedAttemptForA = sanitizeWorldAdjudication({
    subjectId: 'subject-a',
    attempt: 'SHARED_VALID_ATTEMPT_SENTINEL',
    outcome: '甲执行SHARED_VALID_ATTEMPT_SENTINEL后取得阶段性进展',
    stateChange: '甲执行SHARED_VALID_ATTEMPT_SENTINEL后完成自己的第一步',
  }, baseline.subjects[0], { subjects: baseline.subjects, subjectHistories });
  assert.equal(sharedAttemptForA.ok, true);
  assert.equal(validateWorldAdjudication(sharedAttemptForA.update, ticket('subject-a', {
    attemptDirective: 'SHARED_VALID_ATTEMPT_SENTINEL',
    resultEnvelope: 'partial',
  })).ok, true);

  const ownHistoryForB = sanitizeWorldAdjudication({
    subjectId: 'subject-b',
    outcome: 'B_PRIVATE_HISTORY_OUTCOME_SENTINEL之后完成本轮核验',
    cost: '继续承担B_PRIVATE_HISTORY_COST_SENTINEL',
    stateChange: 'B_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL之后形成新的核验记录',
  }, baseline.subjects[1], { subjects: baseline.subjects, subjectHistories });
  assert.equal(ownHistoryForB.ok, true);
});

test('discovery前缀的既有主体即使产生字段剥离告警，也不会被回执误判成NEW发现失败', () => {
  const baseline = worldWith([subject({
    id: 'discovery-existing-actor',
    name: '既有巡检主体',
    current: '正在核对旧仓库封条',
    threadKeys: ['既有巡检主题'],
  })]);
  const boundTicket = ticket('discovery-existing-actor', {
    actorPlanId: 'bootstrap-existing-actor',
    attemptDirective: '核对旧仓库封条上的划痕',
    resultEnvelope: 'partial',
  });
  const proposal = parseWorldProposal(`[SUBJECT discovery-existing-actor]
尝试：核对旧仓库封条上的划痕
结果：部分完成第一阶段并确认一处新划痕
代价：耗费一个巡检时段
状态变化：新划痕已经记录，但封条来源仍待后续核验
现状：主体已经保存本轮划痕记录
支线：UNPROVEN_ADVISORY_THREAD
状态：active
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    sourceKey: 'chat-a:message:2',
    tickets: [boundTicket],
    scheduledSubjects: baseline.subjects,
    actorPlans: [nextPlan('discovery-existing-actor', boundTicket, {
      nextAction: '核对新划痕与既有封条样本',
    }, proposal.updates[0])],
    requireActorPlans: true,
  });
  const receipt = merged.world.receipts.find((entry) => entry.sourceKey === 'chat-a:message:2');

  assert.deepEqual(merged.applied, ['discovery-existing-actor']);
  assert.deepEqual(merged.unresolvedSubjectIds, []);
  assert.deepEqual(merged.unresolvedDiscoveries, []);
  assert.equal(receipt.status, 'applied');
  assert.equal(receipt.unresolvedDiscoveries.length, 0);
  assert.equal(merged.skipped.some((entry) => entry.subjectId === 'discovery-existing-actor'
    && entry.code === 'unproven_thread_key_removed'), true);
});

test('NEW发现只建立逐字锚点waiting shell，混合失败用稳定签名局部补齐且成功项幂等', () => {
  const baseline = worldWith([], { turn: 0, summary: '' });
  const acceptedText = '旧水门的铰链正在渗水。南岸的临时渡口出现排队。正文也提到了名字命中但无锚点的北塔。';
  const firstProposal = parseWorldProposal(`[SUBJECT NEW]
类型：process
名称：旧水门渗水过程
正文锚点：旧水门的铰链正在渗水
稳定锚点：模型编造的稳定条件
现状：模型编造的隐藏现状
资源：模型编造的资源
约束：模型编造的约束
支线：模型编造的支线
尝试：模型编造的行动
结果：模型声称已经推进
状态变化：模型声称产生变化
公开影响：模型编造的公开结果
[/SUBJECT]

[SUBJECT NEW]
名称：南岸渡口排队过程
正文锚点：南岸的临时渡口出现排队
现状：模型试图在缺类型时写入
[/SUBJECT]`, { subjects: [] });
  const first = applyWorldProposal(baseline, firstProposal, {
    turn: 1,
    sourceKey: 'chat-a:message:1',
    acceptedText,
    scheduledSubjects: [],
    requireActorPlans: true,
  });
  const water = first.world.subjects.find((entry) => entry.name === '旧水门渗水过程');
  const failed = first.skipped.find((entry) => entry.code === 'new_subject_type_required');
  const firstReceipt = first.world.receipts.find((entry) => entry.sourceKey === 'chat-a:message:1');
  assert.equal(water.current, '旧水门的铰链正在渗水');
  assert.equal(water.anchor, '旧水门的铰链正在渗水');
  assert.deepEqual(water.resources, []);
  assert.deepEqual(water.constraints, []);
  assert.deepEqual(water.threadKeys, []);
  assert.equal(water.goal, '');
  assert.equal(water.nextAction, '');
  assert.equal(water.status, 'waiting');
  assert.equal(water.publicEffect, '');
  assert.equal(first.world.changes.length, 0);
  assert.ok(failed.discoverySignature);
  assert.equal(Object.hasOwn(failed, 'discoverySignature'), true);
  assert.equal(firstReceipt.status, 'partial');
  assert.equal(firstReceipt.unresolvedDiscoveries.includes(failed.discoverySignature), true);
  assert.equal(first.world.failures.some((entry) => entry.discoverySignature === failed.discoverySignature), true);

  const retryProposal = parseWorldProposal(`[SUBJECT NEW]
类型：process
名称：旧水门渗水过程
正文锚点：旧水门的铰链正在渗水
[/SUBJECT]

[SUBJECT NEW]
类型：process
名称：南岸渡口排队过程
正文锚点：南岸的临时渡口出现排队
[/SUBJECT]`, { subjects: first.world.subjects });
  const retry = applyWorldProposal(first.world, retryProposal, {
    turn: 1,
    sameTurn: true,
    sourceKey: 'chat-a:message:1',
    acceptedText,
    scheduledSubjects: [],
    requireActorPlans: true,
  });
  const finalReceipt = retry.world.receipts.find((entry) => entry.sourceKey === 'chat-a:message:1');
  assert.equal(retry.world.subjects.filter((entry) => entry.name === '旧水门渗水过程').length, 1);
  assert.equal(retry.world.subjects.filter((entry) => entry.name === '南岸渡口排队过程').length, 1);
  assert.equal(retry.world.subjects.find((entry) => entry.name === '旧水门渗水过程').id, water.id);
  assert.equal(retry.world.subjects.find((entry) => entry.name === '南岸渡口排队过程').discoverySignature, failed.discoverySignature);
  assert.equal(finalReceipt.status, 'applied');
  assert.deepEqual(finalReceipt.unresolvedDiscoveries, []);
  assert.equal(retry.world.failures.some((entry) => entry.discoverySignature === failed.discoverySignature), false);
  assert.equal(retry.world.changes.length, 0);

  const noAnchorProposal = parseWorldProposal(`[SUBJECT NEW]
类型：process
名称：北塔
现状：名称虽在正文但没有逐字正文锚点
[/SUBJECT]`, { subjects: [] });
  const noAnchor = applyWorldProposal(baseline, noAnchorProposal, {
    turn: 1,
    sourceKey: 'chat-a:message:no-anchor',
    acceptedText,
    scheduledSubjects: [],
    requireActorPlans: true,
  });
  assert.equal(noAnchor.skipped.some((entry) => entry.code === 'new_subject_missing_accepted_anchor'), true);
  assert.equal(noAnchor.world.subjects.length, 0);
});

test('局部提交明确返回未解决主体，sameTurn重试只修失败主体且不重放已成功变化', () => {
  const baseline = worldWith([
    subject({ id: 'person-lin', type: 'person', name: '林澄', current: '正在核对药材账目' }),
    subject({ id: 'faction-port', type: 'faction', name: '北港行会', current: '仍在等待木料' }),
  ]);
  const tickets = [
    ticket('person-lin', { attemptDirective: '核对三家药商的交货账目' }),
    ticket('faction-port', { resultEnvelope: 'blocked', attemptDirective: '派人核验木料车队是否已经通过东门' }),
  ];
  const firstProposal = parseWorldProposal(`[SUBJECT person-lin]
尝试：核对三家药商的交货账目
结果：找到一笔重复登记的转运记录
状态变化：林澄掌握了一条货运编号
现状：正在比对编号与仓库收据
下一步：去仓库核对原始收据
下次检查：3
[/SUBJECT]

[SUBJECT faction-port]
备注：本块损坏，没有形成可结算尝试
[/SUBJECT]`, { subjects: baseline.subjects });
  const first = applyWorldProposal(baseline, firstProposal, {
    turn: 2,
    sourceKey: 'chat-a:message:2',
    tickets,
    scheduledSubjects: baseline.subjects,
  });

  assert.equal(first.partial, true);
  assert.deepEqual(first.applied, ['person-lin']);
  assert.deepEqual(first.unresolvedSubjectIds, ['faction-port']);
  assert.equal(first.world.turn, 2);
  assert.equal(first.world.changes.filter((entry) => entry.subjectIds.includes('person-lin')).length, 1);

  const retrySubject = first.world.subjects.find((entry) => entry.id === 'faction-port');
  const retryProposal = parseWorldProposal(`[SUBJECT faction-port]
尝试：派人核验木料车队是否已经通过东门
结果：东门封锁仍未解除，车队被迫停在城外
状态变化：行会确认木料延误源于东门封锁
现状：木料仍在城外等待通行
下一步：道路解封后再次联系车队
下次检查：3
状态：waiting
[/SUBJECT]`, { subjects: [retrySubject] });
  const retried = applyWorldProposal(first.world, retryProposal, {
    turn: 2,
    sameTurn: true,
    sourceKey: 'chat-a:message:2',
    tickets: [tickets[1]],
    scheduledSubjects: [retrySubject],
  });

  assert.equal(retried.partial, false);
  assert.deepEqual(retried.unresolvedSubjectIds, []);
  assert.deepEqual(retried.applied, ['faction-port']);
  assert.equal(retried.world.turn, 2);
  assert.equal(retried.world.revision, first.world.revision + 1);
  assert.equal(retried.world.changes.filter((entry) => entry.subjectIds.includes('person-lin')).length, 1);
  assert.equal(retried.world.changes.filter((entry) => entry.subjectIds.includes('faction-port')).length, 1);
});

test('模型省略的旧字段与未提到的主体都会保留，不会被空值或整批覆盖删除', () => {
  const baseline = worldWith([
    subject({
      id: 'person-lin', type: 'person', name: '林澄', anchor: '谨慎务实的药剂师',
      goal: '查清短缺来源', knowledge: ['熟悉南街药商'], resources: ['药房账册'], threadKeys: ['药材短缺'],
    }),
    subject({ id: 'faction-port', type: 'faction', name: '北港行会', current: '继续筹集修船木料' }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT person-lin]
尝试：询问负责入库的两名伙计
结果：确认短缺发生在货物进入药房之前
状态变化：调查范围缩小到上游运输环节
下一步：核对上游运输单
下次检查：3
[/SUBJECT]`, { subjects: [baseline.subjects[0]] });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    tickets: [ticket('person-lin', { attemptDirective: '询问负责入库的两名伙计' })],
    scheduledSubjects: [baseline.subjects[0]],
  });
  const lin = merged.world.subjects.find((entry) => entry.id === 'person-lin');

  assert.deepEqual(merged.applied, ['person-lin']);
  assert.equal(lin.anchor, '谨慎务实的药剂师');
  assert.equal(lin.goal, '查清短缺来源');
  assert.deepEqual(lin.knowledge, ['熟悉南街药商']);
  assert.deepEqual(lin.resources, ['药房账册']);
  assert.deepEqual(lin.threadKeys, ['药材短缺']);
  assert.equal(merged.world.subjects.some((entry) => entry.id === 'faction-port'), true);
});

test('局部准备与否定句不得把主体提前结案，只有明确完成总目标才能done', () => {
  const baseline = worldWith([
    subject({
      id: 'process-bridge',
      type: 'process',
      name: '旧桥修复工程',
      current: '工人正在清理桥面',
      goal: '完成整座旧桥修复并恢复通行',
      nextCheckTurn: 2,
    }),
  ]);
  const incompleteProposal = parseWorldProposal(`[SUBJECT process-bridge]
尝试：清点木料并搭设施工围栏
结果：任务尚未完成，只完成准备
状态变化：围栏已经搭好，但桥面修复尚未开始
现状：工程仍处于施工准备阶段
下一步：更换断裂的桥面木板
下次检查：3
状态：done
[/SUBJECT]`, { subjects: baseline.subjects });
  const incomplete = applyWorldProposal(baseline, incompleteProposal, {
    turn: 2,
    tickets: [ticket('process-bridge', { resultEnvelope: 'success', attemptDirective: '清点木料并搭设施工围栏' })],
    scheduledSubjects: baseline.subjects,
  });
  assert.deepEqual(incomplete.applied, ['process-bridge']);
  assert.equal(incomplete.world.subjects[0].status, 'active');

  const completedProposal = parseWorldProposal(`[SUBJECT process-bridge]
尝试：完成最后一段桥面并通过承重检查
结果：整座旧桥修复任务已经全部完成
状态变化：旧桥恢复双向通行，施工围栏已经撤除
现状：总目标已经达成，桥梁正式恢复使用
下一步：无需继续推进
状态：done
[/SUBJECT]`, { subjects: baseline.subjects });
  const completed = applyWorldProposal(baseline, completedProposal, {
    turn: 2,
    tickets: [ticket('process-bridge', { resultEnvelope: 'success', attemptDirective: '完成最后一段桥面并通过承重检查' })],
    scheduledSubjects: baseline.subjects,
  });
  assert.equal(completed.world.subjects[0].status, 'done');
});

test('具体的等待与受阻是合法世界结果，并安排下一次检查而非把整轮判失败', () => {
  const baseline = worldWith([
    subject({ id: 'faction-gate', type: 'faction', name: '东门守备队', current: '等待新的通行令', nextCheckTurn: 2 }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT faction-gate]
尝试：派人核验新的通行令是否已经送达
结果：信使因外城道路封锁尚未抵达，守备队只能维持旧流程
状态变化：通行令核验仍受道路封锁阻碍，已确认信使没有失踪
现状：守备队继续执行旧通行规则
下一步：道路解封后再次联系外城驿站
下次检查：6
状态：waiting
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    tickets: [ticket('faction-gate', { advanceMode: 'wait_condition', resultEnvelope: 'delayed' })],
    scheduledSubjects: baseline.subjects,
  });
  const gate = merged.world.subjects[0];

  assert.deepEqual(merged.applied, ['faction-gate']);
  assert.equal(gate.status, 'waiting');
  assert.equal(gate.nextCheckTurn, 6);
  assert.equal(merged.world.changes[0].resultType, 'delayed');
  assert.match(merged.world.changes[0].stateChange, /道路封锁/);
});

test('私下推进会保存为真实变化，没有公开影响时不会进入正文注入', () => {
  const baseline = worldWith([
    subject({ id: 'person-bailu', type: 'person', name: '白露', current: '维持柔弱伪装', nextCheckTurn: 2 }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT person-bailu]
尝试：在无人注意时补记同行者的习惯
结果：记录新增了两条可供以后比对的观察
状态变化：白露的私人记录多了两条未公开信息
现状：记录仍藏在贴身口袋中
下一步：等待出现可以验证记录的机会
下次检查：3
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    tickets: [ticket('person-bailu', { publicChannel: 'none', attemptDirective: '在无人注意时补记同行者的习惯' })],
    scheduledSubjects: baseline.subjects,
  });
  const recalled = selectWorldRecall(merged.world, '询问白露要不要休息', {}, 8);
  const injection = formatGenerationInjection({ tickets: [], recall: recalled, currentAction: '询问白露要不要休息' });

  assert.equal(merged.world.changes.length, 1);
  assert.match(merged.world.changes[0].stateChange, /私人记录/);
  assert.deepEqual(recalled, []);
  assert.doesNotMatch(injection, /贴身口袋|两条未公开信息|补记同行者/);
});

test('正文注入不复述玩家输入或要求票据回执，只提供压缩人物塑形轴与公开影响', () => {
  const allAxes = {
    temperament: '压缩轴-气质',
    coreDesire: '压缩轴-欲望',
    values: '后台轴-价值观',
    thinking: '后台轴-思考方式',
    attachment: '后台轴-依恋',
    socialMotive: '压缩轴-社交动机',
    interest: '后台轴-利益取向',
    conflict: '后台轴-冲突方式',
    stress: '后台轴-压力反应',
    moralBoundary: '后台轴-道德边界',
    expression: '压缩轴-表达方式',
    actionHabit: '压缩轴-行动习惯',
    weakness: '后台轴-弱点',
    humor: '后台轴-幽默感',
  };
  const injection = formatGenerationInjection({
    tickets: [{ ticketId: 'ticket-compact', ordinal: 1, axes: allAxes }],
    recall: [{
      effectId: 'effect-public',
      publicEffect: '公开影响_SENTINEL',
      publicChannel: 'environment_trace',
      relatedToCurrentAction: true,
    }],
    currentAction: '玩家原文_SENTINEL\n插件后缀_SENTINEL',
  });

  assert.doesNotMatch(injection, /玩家原文_SENTINEL|插件后缀_SENTINEL/u);
  assert.doesNotMatch(injection, /CharacterTicketReceipt|正文生成前必须/u);
  assert.match(injection, /公开影响_SENTINEL/u);

  const lines = injection.split('\n');
  const projectionLabel = lines.indexOf('原创空白NPC候选（玩家输入已由宿主和预设提供，这里不再复述）：');
  assert.ok(projectionLabel >= 0);
  const projection = JSON.parse(lines[projectionLabel + 1]);
  assert.deepEqual(Object.keys(projection[0].shaping), [
    'temperament', 'coreDesire', 'socialMotive', 'expression', 'actionHabit',
  ]);
  assert.deepEqual(projection[0].shaping, {
    temperament: allAxes.temperament,
    coreDesire: allAxes.coreDesire,
    socialMotive: allAxes.socialMotive,
    expression: allAxes.expression,
    actionHabit: allAxes.actionHabit,
  });
  for (const hiddenValue of [
    allAxes.values,
    allAxes.thinking,
    allAxes.attachment,
    allAxes.interest,
    allAxes.conflict,
    allAxes.stress,
    allAxes.moralBoundary,
    allAxes.weakness,
    allAxes.humor,
  ]) assert.doesNotMatch(injection, new RegExp(hiddenValue, 'u'));
});

test('公开字段泄密时只清空公开投影，私密结算和主体状态不会被回滚', () => {
  const baseline = worldWith([
    subject({ id: 'person-bailu', type: 'person', name: '白露', current: '在队伍中保持低调', nextCheckTurn: 2 }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT person-bailu]
尝试：整理此前收集的同行者信息
结果：她完成了第一轮分类
状态变化：私人记录已经按风险高低完成分类
现状：分类后的记录仍未被任何人发现
下一步：验证其中一条判断
下次检查：3
公开影响：她其实一直在伪装柔弱并暗中评估所有人的弱点
公开渠道：direct_consequence
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    tickets: [ticket('person-bailu', { publicChannel: 'direct_consequence', attemptDirective: '整理此前收集的同行者信息' })],
    scheduledSubjects: baseline.subjects,
  });
  const bailu = merged.world.subjects[0];

  assert.match(bailu.current, /未被任何人发现/);
  assert.match(merged.world.changes[0].stateChange, /完成分类/);
  assert.equal(bailu.publicEffect, '');
  assert.equal(merged.world.changes[0].publicEffect, '');
  assert.equal(merged.skipped.some((entry) => entry.code === 'private_leak_removed'), true);
});

test('公开渠道按可观察性约束投影，违规投影被清除但三个私密推进仍全部提交', () => {
  const baseline = worldWith([
    subject({ id: 'person-lin', type: 'person', name: '林澄', current: '仍在药房工作', nextCheckTurn: 2 }),
    subject({ id: 'faction-port', type: 'faction', name: '北港行会', current: '正在核对仓单', nextCheckTurn: 2 }),
    subject({ id: 'process-rain', type: 'process', name: '雨季水位', current: '水位缓慢上涨', nextCheckTurn: 2 }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT person-lin]
尝试：核对缺货记录
结果：确认运输环节存在缺口
状态变化：林澄掌握了新的货运编号
现状：继续核对编号
下一步：查看仓库收据
下次检查：3
公开影响：林澄为了查清短缺而故意在门口留下新的记号。
公开渠道：environment_trace
[/SUBJECT]

[SUBJECT faction-port]
尝试：内部复核第三号仓单
结果：确认一项登记与实物不符
状态变化：行会内部开始复核第三号货箱
现状：复核仍在内部进行
下一步：检查货箱封条
下次检查：3
公开影响：北港行会已经确认第三号货箱被调包。
公开渠道：rumor
[/SUBJECT]

[SUBJECT process-rain]
尝试：复核上游降雨和石阶水痕
结果：水痕比上一时段高出一层
状态变化：下游水位升到第二级石阶
现状：水位仍在缓慢上涨
下一步：下一时段再次复核
下次检查：3
公开影响：据说旧水门下游的石阶又少露出了一层，原因尚未证实。
公开渠道：rumor
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    tickets: [
      ticket('person-lin', { publicChannel: 'environment_trace', attemptDirective: '核对缺货记录' }),
      ticket('faction-port', { publicChannel: 'rumor', attemptDirective: '内部复核第三号仓单' }),
      ticket('process-rain', { advanceMode: 'evolve', publicChannel: 'rumor', attemptDirective: '复核上游降雨和石阶水痕' }),
    ],
    scheduledSubjects: baseline.subjects,
  });

  assert.deepEqual(new Set(merged.applied), new Set(['person-lin', 'faction-port', 'process-rain']));
  assert.equal(merged.world.changes.length, 3);
  assert.match(merged.world.subjects.find((entry) => entry.id === 'person-lin').current, /继续核对编号/);
  assert.match(merged.world.subjects.find((entry) => entry.id === 'faction-port').current, /内部进行/);
  assert.equal(merged.world.subjects.find((entry) => entry.id === 'person-lin').publicEffect, '');
  assert.equal(merged.world.subjects.find((entry) => entry.id === 'faction-port').publicEffect, '');
  assert.match(merged.world.subjects.find((entry) => entry.id === 'process-rain').publicEffect, /据说/);
  assert.equal(merged.skipped.filter((entry) => entry.code === 'private_leak_removed').length, 2);
});

test('environment_trace拒绝用泛称泄露幕后记录成果，私密人物状态仍照常推进', () => {
  const baseline = worldWith([
    subject({ id: 'person-bailu', type: 'person', name: '白露', current: '继续维持普通同行者形象', nextCheckTurn: 2 }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT person-bailu]
尝试：整理此前观察到的同行者习惯
结果：完成第一轮风险分类
状态变化：私人记录已形成可供以后核验的弱点分类
现状：记录仍未被同行者发现
下一步：等待新的可验证细节
下次检查：3
公开影响：记录者已整理完众人的弱点清单。
公开渠道：environment_trace
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    turn: 2,
    tickets: [ticket('person-bailu', { publicChannel: 'environment_trace', attemptDirective: '整理此前观察到的同行者习惯' })],
    scheduledSubjects: baseline.subjects,
  });

  assert.deepEqual(merged.applied, ['person-bailu']);
  assert.match(merged.world.subjects[0].current, /仍未被同行者发现/);
  assert.match(merged.world.changes[0].stateChange, /弱点分类/);
  assert.equal(merged.world.subjects[0].publicEffect, '');
  assert.equal(merged.world.changes[0].publicEffect, '');
  assert.equal(merged.skipped.some((entry) => entry.code === 'private_leak_removed'), true);
});

test('公开影响不以玩家关键词为开关；仅提供不算展示，冷却后可再召回，正文逐字出现才算shown', () => {
  const world = worldWith([
    subject({
      id: 'person-lin', type: 'person', name: '林澄', threadKeys: ['南街药房'],
      publicEffect: '南街药房门口贴出了新的限购告示。', publicChannel: 'direct_consequence', lastAdvancedTurn: 4,
    }),
    subject({
      id: 'process-rain', type: 'process', name: '雨季水位', threadKeys: ['旧水门'],
      publicEffect: '旧水门下游的石阶多出一圈新水痕。', publicChannel: 'environment_trace', lastAdvancedTurn: 4,
    }),
  ], { turn: 5 });

  const unrelated = selectWorldRecall(world, '我在室内整理自己的背包。', {}, 8);
  assert.equal(unrelated.length, 2);
  assert.equal(unrelated.every((entry) => entry.relatedToCurrentAction === false), true);

  const related = selectWorldRecall(world, '我去南街药房找林澄。', {}, 8);
  assert.equal(related[0].effectId, 'subject:person-lin');
  assert.equal(related[0].relatedToCurrentAction, true);

  const offered = markWorldEffectsShown(world, [related[0]], 5, '正文没有采用那条公开影响。');
  const offeredLin = offered.world.subjects.find((entry) => entry.id === 'person-lin');
  assert.equal(offered.changed, 1);
  assert.equal(offeredLin.offeredTurn, 5);
  assert.equal(offeredLin.shownTurn, 0);
  assert.equal(selectWorldRecall(offered.world, '我去南街药房找林澄。', {}, 8).some((entry) => entry.effectId === related[0].effectId), false);

  const afterCooldown = normalizeWorldState({ ...offered.world, turn: 7 }, { chatId: 'chat-a' });
  const recalledAgain = selectWorldRecall(afterCooldown, '我去南街药房找林澄。', {}, 8);
  assert.equal(recalledAgain.some((entry) => entry.effectId === related[0].effectId), true);

  const accepted = markWorldEffectsShown(afterCooldown, [related[0]], 7, related[0].publicEffect);
  const acceptedLin = accepted.world.subjects.find((entry) => entry.id === 'person-lin');
  assert.equal(acceptedLin.shownTurn, 7);
  assert.equal(selectWorldRecall(accepted.world, '我去南街药房找林澄。', {}, 8).some((entry) => entry.effectId === related[0].effectId), false);
});

test('同一source与turn重复标记公开影响保持幂等，不重复累计offerCount', () => {
  const world = worldWith([
    subject({
      id: 'process-bell',
      type: 'process',
      name: '钟楼警报',
      publicEffect: '钟楼的警报灯仍在闪烁。',
      publicChannel: 'environment_trace',
      publicEffectTurn: 4,
      lastAdvancedTurn: 4,
      offerCount: 0,
      lastOfferedTurn: 0,
    }),
  ], { turn: 5 });
  const effects = selectWorldRecall(world, '继续观察四周', {}, 8);
  assert.equal(effects.length, 1);

  const first = markWorldEffectsShown(world, effects, 5, '正文没有采用警报灯。');
  const firstDigest = first.world.digest;
  const second = markWorldEffectsShown(first.world, effects, 5, '正文没有采用警报灯。');
  const marked = second.world.subjects.find((entry) => entry.id === 'process-bell');

  assert.equal(marked.offerCount, 1);
  assert.equal(marked.lastOfferedTurn, 5);
  assert.equal(second.changed, 0);
  assert.equal(second.world.digest, firstDigest);
});

test('重 roll 恢复生成前世界快照后，旧回复标记的公开影响会重新正确提供', () => {
  const checkpoint = worldWith([
    subject({
      id: 'process-bell', type: 'process', name: '钟楼警报',
      publicEffect: '钟楼的警报灯仍在闪烁。', publicChannel: 'environment_trace', lastAdvancedTurn: 3, shownTurn: 0,
    }),
  ], { turn: 3 });
  const offered = selectWorldRecall(checkpoint, '继续观察四周', {}, 8);
  const rejectedReplyState = markWorldEffectsShown(checkpoint, offered, 4).world;

  assert.equal(selectWorldRecall(rejectedReplyState, '继续观察四周', {}, 8).length, 0);
  assert.equal(checkpoint.subjects[0].shownTurn, 0);
  assert.equal(selectWorldRecall(checkpoint, '重 roll 后继续观察四周', {}, 8)[0].publicEffect, '钟楼的警报灯仍在闪烁。');
});

test('旧存档只迁移一次为主体与变化，诊断报告不能反向覆盖唯一权威或污染其他聊天', () => {
  const migrated = normalizeWorldState({
    schemaVersion: 5,
    chatId: 'chat-a',
    summary: '旧世界摘要',
    threads: [{ id: 'old-thread', title: '旧水门压力', summary: '水压仍在增加', nextBeat: '检查闸门' }],
  }, { chatId: 'chat-a' });
  const otherChat = emptyWorldState('chat-b');
  const before = structuredClone(migrated);
  const report = worldConsistencyReport(migrated, [{ outcome: { world: { summary: '报告声称已经覆盖权威' } } }]);

  assert.equal(migrated.schemaVersion, WORLD_SCHEMA_VERSION);
  assert.equal(migrated.subjects.length, 1);
  assert.equal('threads' in migrated, false);
  assert.equal('recall' in migrated, false);
  assert.equal(report.status, 'single_authority');
  assert.deepEqual(migrated, before);
  assert.equal(otherChat.chatId, 'chat-b');
  assert.deepEqual(otherChat.subjects, []);
});

test('公开人物句柄和医生私有人物摘要维持严格分区', () => {
  const profile = {
    profileId: 'actor-lin',
    name: '未公开真名',
    aliases: ['药房来客'],
    narrativeKnownNames: ['药房来客'],
    identity: { occupation: '密探' },
    personality: { coreDesire: '掌控情报' },
    evidence: ['未公开真名其实是密探。'],
    inferences: ['真实任务尚未公开'],
  };
  const data = { stat_data: { 人物档案: { byActorId: { 'actor-lin': profile } } } };
  const publicDigest = profileDigestFromData(data);
  const privateDigest = privateProfileDigestFromData(data);

  assert.deepEqual(Object.keys(publicDigest[0]).sort(), ['doNotRerandomize', 'knownNames', 'profileHandle']);
  assert.deepEqual(publicDigest[0].knownNames, ['药房来客']);
  assert.doesNotMatch(JSON.stringify(publicDigest), /未公开真名|actor-lin|密探|掌控情报|真实任务/);
  assert.match(JSON.stringify(privateDigest), /未公开真名|密探|掌控情报|真实任务/);
});

test('旧人物档案缺少narrativeKnownNames时不回退私密真名或aliases，但仍明确禁止重随机', () => {
  const data = {
    stat_data: {
      人物档案: {
        byActorId: {
          'legacy-lin': {
            profileId: 'legacy-lin',
            name: '林澄',
            aliases: ['小澄', '药房姑娘'],
          },
        },
      },
    },
  };
  const [digest] = profileDigestFromData(data);

  assert.equal(digest.doNotRerandomize, true);
  assert.deepEqual(digest.knownNames, []);
  assert.doesNotMatch(JSON.stringify(digest), /林澄|小澄|药房姑娘/u);
  assert.equal(typeof digest.profileHandle, 'string');
  assert.ok(digest.profileHandle.length > 0);
});

test('缝合输入仍只取最后一个真实当前行动包，不让历史包装决定世界相关性', () => {
  const stitched = '<history>北港旧事和南街药房都在历史里。</history>\n<本轮用户输入>转身前往东门排队。</本轮用户输入>\n<user_input>去北港检查木料。</user_input>';
  assert.equal(recallSelectionInput(stitched), '去北港检查木料。');
  assert.equal(recallSelectionInput('<user_input>观察柜台。</user_input>'), '观察柜台。');
  assert.equal(recallSelectionInput('直接输入的行动'), '直接输入的行动');
});

test('中文本轮用户输入单独存在时只提取标签内玩家段并丢弃插件后缀', () => {
  const processed = [
    '以下是用户的本轮输入：',
    '<本轮用户输入>',
    '真正玩家动作_SENTINEL',
    '</本轮用户输入>',
    '以下输入的代码为既定事实记忆的对应索引编码。',
    '插件后缀_MUST_NOT_BECOME_ACTION',
  ].join('\n');

  assert.equal(recallSelectionInput(processed), '真正玩家动作_SENTINEL');
});

function runtimeHarness(worldResponse, actorResponse = null) {
  const runtimeSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8')
    .replace('\n  init().catch((error) => {', '\n  window.__doctorTestHooks = { retryLastFailure, manualWorldRecheck, runtime };\n\n  init().catch((error) => {');
  const handlers = new Map();
  const worldRequests = [];
  const actorRequests = [];
  const worldSaveTransitions = [];
  let lastSavedWorldDigest = '';
  const makeNode = () => ({
    textContent: '', className: '', value: '', checked: false, disabled: false, dataset: {}, style: {},
    addEventListener() {}, appendChild() {}, append() {}, replaceChildren() {}, remove() {},
    setAttribute() {}, removeAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { toggle() {}, add() {}, remove() {} },
  });
  const nodes = new Map();
  const nodeFor = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, makeNode());
    return nodes.get(selector);
  };
  const uiRoot = { dataset: {}, querySelector: nodeFor, querySelectorAll() { return []; } };
  const context = {
    chatId: 'runtime-world-chat',
    chat: [{ is_user: true, is_system: false, mes: '留在室内检查旧水门的记录。' }],
    chatMetadata: {},
    extensionSettings: {
      'mvu-doctor-kemini-clean': {
        enabled: true,
        variableDoctor: false,
        worldEngine: true,
        repairAttempts: 0,
        worldSubjectLimit: 3,
      },
    },
    eventTypes: {
      GENERATION_STARTED: 'generation_started',
      GENERATION_ENDED: 'generation_ended',
      GENERATION_STOPPED: 'generation_stopped',
      MESSAGE_SWIPED: 'message_swiped',
      CHAT_CHANGED: 'chat_changed',
      CHAT_LOADED: 'chat_loaded',
    },
    eventSource: { on(name, handler) { handlers.set(name, handler); } },
    setExtensionPrompt() {},
    saveSettingsDebounced() {},
    async generateRaw({ systemPrompt, prompt }) {
      const system = String(systemPrompt || '');
      if (system.includes('最终正文的人物发现器')) return '<人物发现>NONE</人物发现>';
      if (system.includes('单一世界主体的私密行动规划器') || system.includes('单一世界主体的私密后续规划器')) {
        const phase = system.includes('私密行动规划器') ? 'bootstrap' : 'next';
        const subjectId = String(prompt || '').match(/只属于\s+([^】]+)】/u)?.[1]?.trim() || 'subject-unknown';
        const request = { phase, subjectId, systemPrompt: system, prompt: String(prompt || '') };
        actorRequests.push(request);
        if (typeof actorResponse === 'function') return actorResponse({ ...request, requestNumber: actorRequests.length });
        const oldNext = request.prompt.match(/"nextAction"\s*:\s*"([^"]+)"/u)?.[1] || '检查当前条件';
        return phase === 'bootstrap'
          ? `[ACTOR_PLAN ${subjectId}]\n尝试：${oldNext}\n[/ACTOR_PLAN]`
          : `[ACTOR_PLAN ${subjectId}]\n目标：\n新增已知：\n下一步：根据本轮裁决复核后续条件\n下次检查：99\n[/ACTOR_PLAN]`;
      }
      if (system.includes('全局世界裁决器') || system.includes('世界长期主体发现器')) {
        worldRequests.push(`${systemPrompt}\n${prompt || ''}`);
        return typeof worldResponse === 'function'
          ? worldResponse(worldRequests.length, systemPrompt, String(prompt || ''))
          : worldResponse;
      }
      return '<人物档案无变化/>';
    },
    async saveMetadata() {
      const world = context.chatMetadata['mvu-doctor-kemini-clean']?.world;
      if (world?.digest && world.digest !== lastSavedWorldDigest) {
        lastSavedWorldDigest = world.digest;
        worldSaveTransitions.push({ revision: world.revision, digest: world.digest });
      }
    },
  };
  const sandbox = {
    window: { SillyTavern: { getContext: () => context }, crypto: globalThis.crypto },
    document: {
      currentScript: null,
      querySelector(selector) { return selector === '#send_textarea' ? { value: '' } : null; },
      getElementById: () => uiRoot,
      createElement: makeNode,
      body: { appendChild() {} },
      addEventListener() {},
    },
    console: { info() {}, error() {}, warn() {} },
    Option: function Option(text = '', value = '') { return { ...makeNode(), textContent: text, value }; },
    setTimeout,
    clearTimeout,
    structuredClone,
    AbortController,
  };
  vm.runInNewContext(runtimeSource, sandbox, { filename: 'index.js' });
  return { context, handlers, worldRequests, actorRequests, worldSaveTransitions, hooks: sandbox.window.__doctorTestHooks };
}

async function finishOneRuntimeReply(harness, assistantMes = '<content>风沿废弃水渠掠过，远处的旧水门仍旧关闭。</content><options><option>继续观察</option></options>') {
  const completedBefore = harness.context.chatMetadata['mvu-doctor-kemini-clean']?.fullRuns?.length || 0;
  await new Promise((resolve) => setTimeout(resolve, 20));
  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: assistantMes,
  });
  harness.handlers.get('generation_ended')();
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const runs = harness.context.chatMetadata['mvu-doctor-kemini-clean']?.fullRuns;
    if (Array.isArray(runs) && runs.length > completedBefore) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('运行时医生没有在时限内结束本轮处理');
}

test('运行时每个接受回合只请求一次世界模型，并只产生一次权威世界修订', async () => {
  const harness = runtimeHarness(`世界摘要：旧水门周边出现了一项新的可核验变化。

[SUBJECT NEW]
类型：process
名称：旧水门持续水压
正文锚点：远处的旧水门仍旧关闭
稳定锚点：水位随上游来水与旧水门承压条件持续变化
现状：旧水门仍关闭，下游石阶水痕正在升高
目标：按来水与闸门状态持续演化下游水位
尝试：核对上游来水与旧水门当前承压情况
结果：下游石阶出现了比上一时段更高的水痕
代价：经过一个观察时段
状态变化：旧水门下游水位已经上升到第二级石阶
现状：水门仍关闭，但下游承压正在增加
下一步：下一时段复核水痕是否继续上升
下次检查：2
状态：active
支线：旧水门水位
公开影响：旧水门下游的第二级石阶留下了一圈新水痕。
公开渠道：environment_trace
[/SUBJECT]`);

  await finishOneRuntimeReply(harness);
  const world = harness.context.chatMetadata['mvu-doctor-kemini-clean'].world;

  assert.equal(harness.worldRequests.length, 1);
  assert.equal(world.revision, 1);
  assert.equal(world.changes.length, 0);
  assert.equal(world.subjects[0].status, 'waiting');
  assert.equal(world.subjects[0].current, '远处的旧水门仍旧关闭');
  assert.equal(harness.worldSaveTransitions.filter((entry) => entry.revision === 1).length, 1);
});

test('运行时既有discovery前缀主体的剥离告警不冒充NEW失败，成功回执后手动复检零模型调用', async () => {
  const harness = runtimeHarness((requestNumber, systemPrompt, prompt) => {
    assert.equal(requestNumber, 1);
    assert.match(systemPrompt, /全局世界裁决器/u);
    const attempt = prompt.match(/"attemptDirective"\s*:\s*"([^"]+)"/u)?.[1] || '';
    const envelope = prompt.match(/"resultEnvelope"\s*:\s*"([^"]+)"/u)?.[1] || 'partial';
    const settlement = {
      success: ['行动成功并完成预定步骤', '预定步骤已经完成'],
      partial: ['行动部分完成并取得阶段性进展', '第一阶段结果已经记录，后续仍待核验'],
      blocked: ['行动受阻，尚未完成预定步骤', '已有阻碍已经确认，主体需要等待条件变化'],
      delayed: ['行动延后，等待条件成熟', '延后原因已经记录，主体暂时等待'],
      failure: ['行动失败且没有完成预定步骤', '失败结果已经记录，主体需要更换条件'],
    }[envelope] || ['行动部分完成并取得阶段性进展', '第一阶段结果已经记录，后续仍待核验'];
    return `世界摘要：既有巡检主体完成本轮裁决。

[SUBJECT discovery-existing-actor]
尝试：${attempt}
结果：${settlement[0]}
代价：耗费一个巡检时段
状态变化：${settlement[1]}
现状：主体已经保存本轮巡检记录
支线：UNPROVEN_ADVISORY_THREAD
状态：active
[/SUBJECT]`;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.world = worldWith([subject({
    id: 'discovery-existing-actor',
    name: '既有巡检主体',
    current: '正在核对旧仓库封条',
    nextAction: '核对旧仓库封条上的划痕',
    nextCheckTurn: 2,
    threadKeys: ['既有巡检主题'],
  })], { chatId: harness.context.chatId, turn: 1, revision: 0 });

  await finishOneRuntimeReply(harness);
  const receipt = store.world.receipts.find((entry) => entry.subjectIds.includes('discovery-existing-actor'));
  assert.equal(receipt.status, 'applied');
  assert.equal(receipt.unresolvedDiscoveries.length, 0);
  assert.equal(store.world.failures.some((entry) => entry.subjectId === 'discovery-existing-actor'
    && entry.code === 'unproven_thread_key_removed'), true);

  const modelCallsBefore = harness.worldRequests.length + harness.actorRequests.length;
  const manual = await harness.hooks.manualWorldRecheck();
  assert.equal(manual.alreadyCommitted, true);
  assert.equal(harness.worldRequests.length + harness.actorRequests.length, modelCallsBefore);
});

test('运行时物理隔离主体私密规划，全局请求只看冻结attempt且最终仍一次commit', async () => {
  let actorInFlight = 0;
  let maxActorInFlight = 0;
  const harness = runtimeHarness(`世界摘要：两个主体的冻结尝试分别完成裁决。

[SUBJECT person-a]
尝试：ATTEMPT_A_SENTINEL
结果：甲取得一项可核验的局部进展
代价：经过一个时段
状态变化：甲的客观状态已经更新
现状：甲完成本轮步骤
状态：active
[/SUBJECT]

[SUBJECT faction-b]
尝试：ATTEMPT_B_SENTINEL
结果：乙受到既有条件限制但仍完成准备
代价：消耗一个时段
状态变化：乙完成下一阶段所需的准备
现状：乙正在等待条件成熟
状态：active
[/SUBJECT]`, async ({ phase, subjectId }) => {
    assert.equal(phase, 'next');
    actorInFlight += 1;
    maxActorInFlight = Math.max(maxActorInFlight, actorInFlight);
    await new Promise((resolve) => setTimeout(resolve, 15));
    actorInFlight -= 1;
    return `[ACTOR_PLAN ${subjectId}]
目标：${subjectId === 'person-a' ? 'PLAN_GOAL_A' : 'PLAN_GOAL_B'}
新增已知：
下一步：${subjectId === 'person-a' ? '甲检查新取得的凭据' : '乙核对准备条件'}
下次检查：4
[/ACTOR_PLAN]`;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.world = worldWith([
    subject({
      id: 'person-a', type: 'person', name: '甲', goal: 'PRIVATE_GOAL_A_SENTINEL', knowledge: ['PRIVATE_KNOWLEDGE_A_SENTINEL'],
      nextAction: 'ATTEMPT_A_SENTINEL', nextCheckTurn: 2, threadKeys: ['remote-thread'],
      planReceipt: { planId: 'stored-plan-a', subjectId: 'person-a', phase: 'next', nextAction: 'ATTEMPT_A_SENTINEL', nextCheckTurn: 2, plannedTurn: 1 },
    }),
    subject({
      id: 'faction-b', type: 'faction', name: '乙', goal: 'PRIVATE_GOAL_B_SENTINEL', knowledge: ['PRIVATE_KNOWLEDGE_B_SENTINEL'],
      current: '乙驻扎在远港码头', nextAction: 'ATTEMPT_B_SENTINEL', nextCheckTurn: 2, threadKeys: ['remote-thread'],
      planReceipt: { planId: 'stored-plan-b', subjectId: 'faction-b', phase: 'next', nextAction: 'ATTEMPT_B_SENTINEL', nextCheckTurn: 2, plannedTurn: 1 },
    }),
    subject({
      id: 'process-remote', type: 'process', name: '远港潮位', status: 'done', threadKeys: ['remote-thread'],
      current: '远港码头水位标尺已经留下新水痕', nextCheckTurn: 99,
    }),
  ], {
    chatId: harness.context.chatId,
    turn: 1,
    revision: 0,
    changes: [{
      id: 'change-remote-public', subjectIds: ['process-remote'], threadKeys: ['remote-thread'], turn: 1,
      attempt: '远处过程自行变化', outcome: '远处留下公开痕迹', stateChange: '远处表面已改变',
      publicEffect: '远港码头的水位标尺留下新水痕（REMOTE_PUBLIC_SURFACE_SENTINEL）。', publicChannel: 'environment_trace',
    }],
  });

  await finishOneRuntimeReply(harness);

  assert.equal(harness.worldRequests.length, 1);
  assert.equal(harness.actorRequests.length, 2);
  assert.equal(maxActorInFlight, 2);
  const globalRequest = harness.worldRequests[0];
  assert.match(globalRequest, /ATTEMPT_A_SENTINEL/u);
  assert.match(globalRequest, /ATTEMPT_B_SENTINEL/u);
  assert.doesNotMatch(globalRequest, /PRIVATE_GOAL_[AB]_SENTINEL|PRIVATE_KNOWLEDGE_[AB]_SENTINEL/u);
  assert.match(globalRequest, /REMOTE_PUBLIC_SURFACE_SENTINEL/u);
  const actorA = harness.actorRequests.find((entry) => entry.subjectId === 'person-a');
  const actorB = harness.actorRequests.find((entry) => entry.subjectId === 'faction-b');
  assert.match(actorA.prompt, /PRIVATE_GOAL_A_SENTINEL|PRIVATE_KNOWLEDGE_A_SENTINEL/u);
  assert.doesNotMatch(actorA.prompt, /PRIVATE_GOAL_B_SENTINEL|PRIVATE_KNOWLEDGE_B_SENTINEL/u);
  assert.doesNotMatch(actorA.prompt, /REMOTE_PUBLIC_SURFACE_SENTINEL/u);
  assert.match(actorB.prompt, /PRIVATE_GOAL_B_SENTINEL|PRIVATE_KNOWLEDGE_B_SENTINEL/u);
  assert.doesNotMatch(actorB.prompt, /PRIVATE_GOAL_A_SENTINEL|PRIVATE_KNOWLEDGE_A_SENTINEL/u);
  assert.match(actorB.prompt, /REMOTE_PUBLIC_SURFACE_SENTINEL/u);
  assert.equal(store.world.revision, 1);
  assert.equal(store.world.subjects.find((entry) => entry.id === 'person-a').goal, 'PLAN_GOAL_A');
  assert.equal(store.world.subjects.find((entry) => entry.id === 'faction-b').goal, 'PLAN_GOAL_B');
  assert.equal(harness.worldSaveTransitions.filter((entry) => entry.revision === 1).length, 1);
});

test('有效裁决冻结后next planner技术失败只重跑失败主体，不增加全局裁决调用', async () => {
  const actorCalls = new Map();
  const harness = runtimeHarness(`世界摘要：两个冻结尝试均形成有效裁决。

[SUBJECT person-a]
尝试：ATTEMPT_A_SENTINEL
结果：A_FROZEN_OUTCOME_SENTINEL
代价：经过一个时段
状态变化：甲完成第一阶段并取得凭据
现状：甲进入下一阶段
状态：active
[/SUBJECT]

[SUBJECT faction-b]
尝试：ATTEMPT_B_SENTINEL
结果：B_FROZEN_OUTCOME_SENTINEL
代价：经过一个时段
状态变化：乙完成第一阶段并整理好材料
现状：乙进入下一阶段
状态：active
[/SUBJECT]`, ({ phase, subjectId }) => {
    assert.equal(phase, 'next');
    const count = (actorCalls.get(subjectId) || 0) + 1;
    actorCalls.set(subjectId, count);
    if (subjectId === 'faction-b' && count === 1) throw new Error('B_NEXT_TECHNICAL_FAILURE');
    return `[ACTOR_PLAN ${subjectId}]
目标：
新增已知：
下一步：${subjectId === 'person-a' ? '甲核验取得的凭据' : '乙核验整理好的材料'}
下次检查：4
[/ACTOR_PLAN]`;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.world = worldWith([
    subject({
      id: 'person-a', type: 'person', name: '甲', nextAction: 'ATTEMPT_A_SENTINEL', nextCheckTurn: 2,
      planReceipt: { planId: 'stored-plan-a', subjectId: 'person-a', phase: 'next', nextAction: 'ATTEMPT_A_SENTINEL', nextCheckTurn: 2, plannedTurn: 1 },
    }),
    subject({
      id: 'faction-b', type: 'faction', name: '乙', nextAction: 'ATTEMPT_B_SENTINEL', nextCheckTurn: 2,
      planReceipt: { planId: 'stored-plan-b', subjectId: 'faction-b', phase: 'next', nextAction: 'ATTEMPT_B_SENTINEL', nextCheckTurn: 2, plannedTurn: 1 },
    }),
  ], { chatId: harness.context.chatId, turn: 1, revision: 0 });

  await finishOneRuntimeReply(harness);
  assert.equal(harness.worldRequests.length, 1);
  assert.equal(actorCalls.get('person-a'), 1);
  assert.equal(actorCalls.get('faction-b'), 1);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('person-a')).length, 1);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('faction-b')).length, 0);

  await harness.hooks.retryLastFailure();
  assert.equal(harness.worldRequests.length, 1);
  assert.equal(actorCalls.get('person-a'), 1);
  assert.equal(actorCalls.get('faction-b'), 2);
  const secondB = harness.actorRequests.filter((entry) => entry.subjectId === 'faction-b')[1];
  assert.match(secondB.prompt, /B_FROZEN_OUTCOME_SENTINEL/u);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('person-a')).length, 1);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('faction-b')).length, 1);
});

test('污染裁决不进入主体next planner；有效A提交后只重裁失败B且不重提A', async () => {
  const harness = runtimeHarness((requestNumber) => requestNumber === 1
    ? `世界摘要：甲有效，乙块错误串入甲私密状态。

[SUBJECT person-a]
尝试：ATTEMPT_A_SENTINEL
结果：甲完成第一阶段
代价：经过一个时段
状态变化：甲完成第一阶段并取得自己的凭据
现状：甲进入下一阶段
状态：active
[/SUBJECT]

[SUBJECT faction-b]
尝试：ATTEMPT_B_SENTINEL
结果：乙错误获得A_PRIVATE_CURRENT_SENTINEL
代价：经过一个时段
状态变化：A_PRIVATE_CURRENT_SENTINEL
现状：A_PRIVATE_CURRENT_SENTINEL
状态：active
[/SUBJECT]`
    : `世界摘要：只修正乙的裁决。

[SUBJECT faction-b]
尝试：ATTEMPT_B_SENTINEL
结果：乙完成自己的第一阶段
代价：经过一个时段
状态变化：乙整理好自己的核验材料
现状：乙进入下一阶段
状态：active
[/SUBJECT]`, ({ phase, subjectId }) => {
    assert.equal(phase, 'next');
    return `[ACTOR_PLAN ${subjectId}]
目标：
新增已知：
下一步：${subjectId === 'person-a' ? '甲检查自己的凭据' : '乙检查自己的材料'}
下次检查：4
[/ACTOR_PLAN]`;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.world = worldWith([
    subject({
      id: 'person-a', type: 'person', name: '甲', current: 'A_PRIVATE_CURRENT_SENTINEL', nextAction: 'ATTEMPT_A_SENTINEL', nextCheckTurn: 2,
      planReceipt: { planId: 'stored-plan-a', subjectId: 'person-a', phase: 'next', nextAction: 'ATTEMPT_A_SENTINEL', nextCheckTurn: 2, plannedTurn: 1 },
    }),
    subject({
      id: 'faction-b', type: 'faction', name: '乙', current: '乙保持自己的状态', nextAction: 'ATTEMPT_B_SENTINEL', nextCheckTurn: 2,
      planReceipt: { planId: 'stored-plan-b', subjectId: 'faction-b', phase: 'next', nextAction: 'ATTEMPT_B_SENTINEL', nextCheckTurn: 2, plannedTurn: 1 },
    }),
  ], { chatId: harness.context.chatId, turn: 1, revision: 0 });

  await finishOneRuntimeReply(harness);
  assert.equal(harness.worldRequests.length, 1);
  assert.equal(harness.actorRequests.filter((entry) => entry.subjectId === 'person-a').length, 1);
  assert.equal(harness.actorRequests.filter((entry) => entry.subjectId === 'faction-b').length, 0);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('person-a')).length, 1);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('faction-b')).length, 0);

  await harness.hooks.retryLastFailure();
  assert.equal(harness.worldRequests.length, 2);
  assert.match(harness.worldRequests[1], /ATTEMPT_B_SENTINEL/u);
  assert.doesNotMatch(harness.worldRequests[1], /ATTEMPT_A_SENTINEL|A_PRIVATE_CURRENT_SENTINEL/u);
  assert.equal(harness.actorRequests.filter((entry) => entry.subjectId === 'person-a').length, 1);
  assert.equal(harness.actorRequests.filter((entry) => entry.subjectId === 'faction-b').length, 1);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('person-a')).length, 1);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('faction-b')).length, 1);
});

test('B的私密旧裁决复制进A会在next planner前拒绝，B仍可沿自己的历史独立推进', async () => {
  const harness = runtimeHarness(`世界摘要：甲的裁决串入乙的私密历史，乙自己的裁决保持连续。

[SUBJECT person-a]
尝试：ATTEMPT_A_SENTINEL
结果：甲错误沿用了B_PRIVATE_HISTORY_OUTCOME_SENTINEL
代价：经过一个时段
状态变化：B_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL
现状：甲错误吸收了乙的旧结果
状态：active
[/SUBJECT]

[SUBJECT faction-b]
尝试：ATTEMPT_B_SENTINEL
结果：B_PRIVATE_HISTORY_OUTCOME_SENTINEL之后完成本轮核验
代价：继续承担B_PRIVATE_HISTORY_COST_SENTINEL
状态变化：B_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL之后形成新的核验记录
现状：乙已经保存自己的新核验记录
状态：active
[/SUBJECT]`, ({ phase, subjectId, prompt }) => {
    assert.equal(phase, 'next');
    assert.equal(subjectId, 'faction-b');
    assert.match(prompt, /B_PRIVATE_HISTORY_OUTCOME_SENTINEL/u);
    assert.match(prompt, /B_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL/u);
    return `[ACTOR_PLAN ${subjectId}]
目标：
新增已知：
下一步：乙检查自己的新核验记录
下次检查：4
[/ACTOR_PLAN]`;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.world = worldWith([
    subject({
      id: 'person-a', type: 'person', name: '甲', current: '甲保持自己的状态', nextAction: 'ATTEMPT_A_SENTINEL', nextCheckTurn: 2,
      planReceipt: { planId: 'stored-plan-a', subjectId: 'person-a', phase: 'next', nextAction: 'ATTEMPT_A_SENTINEL', nextCheckTurn: 2, plannedTurn: 1 },
    }),
    subject({
      id: 'faction-b', type: 'faction', name: '乙', current: '乙保持自己的状态', nextAction: 'ATTEMPT_B_SENTINEL', nextCheckTurn: 2,
      planReceipt: { planId: 'stored-plan-b', subjectId: 'faction-b', phase: 'next', nextAction: 'ATTEMPT_B_SENTINEL', nextCheckTurn: 2, plannedTurn: 1 },
    }),
  ], {
    chatId: harness.context.chatId,
    turn: 1,
    revision: 0,
    changes: [
      {
        id: 'change-a-private-history', subjectIds: ['person-a'], threadKeys: [], turn: 1,
        attempt: 'A_PRIVATE_HISTORY_ATTEMPT_SENTINEL', outcome: 'A_PRIVATE_HISTORY_OUTCOME_SENTINEL',
        cost: 'A_PRIVATE_HISTORY_COST_SENTINEL', stateChange: 'A_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL',
        publicEffect: '', publicChannel: 'none',
      },
      {
        id: 'change-b-private-history', subjectIds: ['faction-b'], threadKeys: [], turn: 1,
        attempt: 'B_PRIVATE_HISTORY_ATTEMPT_SENTINEL', outcome: 'B_PRIVATE_HISTORY_OUTCOME_SENTINEL',
        cost: 'B_PRIVATE_HISTORY_COST_SENTINEL', stateChange: 'B_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL',
        publicEffect: '', publicChannel: 'none',
      },
    ],
  });

  await finishOneRuntimeReply(harness);

  assert.equal(harness.worldRequests.length, 1);
  assert.match(harness.worldRequests[0], /B_PRIVATE_HISTORY_OUTCOME_SENTINEL/u);
  assert.match(harness.worldRequests[0], /B_PRIVATE_HISTORY_STATE_CHANGE_SENTINEL/u);
  assert.equal(harness.actorRequests.some((entry) => entry.subjectId === 'person-a'), false);
  assert.equal(harness.actorRequests.filter((entry) => entry.subjectId === 'faction-b').length, 1);
  assert.equal(store.world.failures.some((entry) => entry.subjectId === 'person-a' && entry.code === 'cross_subject_private_leak'), true);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('person-a')).length, 1);
  assert.equal(store.world.changes.filter((entry) => entry.subjectIds.includes('faction-b')).length, 2);
  assert.equal(store.world.subjects.find((entry) => entry.id === 'faction-b').nextAction, '乙检查自己的新核验记录');
});

test('发现扫描无新主体仍提交一次幂等world tick，使下一回合主体能按nextCheckTurn到期', async () => {
  const harness = runtimeHarness((requestNumber) => requestNumber === 1
    ? '世界摘要：本回合没有发现新的长期主体。'
    : `世界摘要：北港潮汐完成一次到期复核。

[SUBJECT process-water]
尝试：复核北港码头潮位标尺
结果：潮位标尺维持在上一时段的高度
代价：经过一个观察时段
状态变化：确认本时段潮位没有继续上涨
现状：北港潮位暂时稳定
下一步：下一时段再次复核潮位标尺
下次检查：3
状态：active
[/SUBJECT]`);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.world = normalizeWorldState({
    schemaVersion: WORLD_SCHEMA_VERSION,
    chatId: harness.context.chatId,
    turn: 0,
    revision: 0,
    summary: '北港潮汐尚待下一回合检查。',
    subjects: [{
      id: 'process-water',
      type: 'process',
      name: '北港潮汐',
      anchor: '潮位随天文周期、风向和港湾地形变化',
      current: '潮位暂时稳定',
      goal: '按潮汐条件持续演化',
      nextAction: '复核北港码头潮位标尺',
      nextCheckTurn: 2,
      status: 'active',
    }],
    changes: [],
  }, { chatId: harness.context.chatId });

  await finishOneRuntimeReply(harness);
  assert.equal(store.world.turn, 1);
  assert.equal(store.world.revision, 1);
  assert.equal(store.world.changes.length, 0);
  assert.equal(harness.worldSaveTransitions.filter((entry) => entry.revision === 1).length, 1);

  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 650));
  assert.equal(store.world.turn, 1);
  assert.equal(store.world.revision, 1);
  assert.equal(harness.worldSaveTransitions.filter((entry) => entry.revision === 1).length, 1);

  harness.context.chat.push({ is_user: true, is_system: false, mes: '继续整理自己的记录。' });
  await finishOneRuntimeReply(harness);
  assert.match(harness.worldRequests[1], /process-water|复核北港码头潮位标尺/u);
  assert.equal(store.world.turn, 2);
  assert.equal(store.world.revision, 2);
  assert.equal(store.world.changes.some((entry) => entry.subjectIds.includes('process-water')), true);
});

test('世界模型返回不可解析文本时只保存一次可重试失败票据，不造主体、变化或自动二次请求', async () => {
  const harness = runtimeHarness('我无法按要求返回主体分块。');

  await finishOneRuntimeReply(harness);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];

  assert.equal(harness.worldRequests.length, 1);
  assert.equal(store.world.revision, 1);
  assert.equal(store.world.turn, 1);
  assert.equal(store.world.subjects.length, 0);
  assert.equal(store.world.changes.length, 0);
  assert.equal(store.world.failures.some((entry) => entry.code === 'no_subject_blocks'), true);
  assert.equal(store.world.receipts[0].status, 'partial');
  assert.equal(harness.worldSaveTransitions.filter((entry) => entry.revision === 1).length, 1);
  assert.equal(store.fullRuns[0].outcome.stage, 'world');
});

test('运行时混合NEW持久化失败签名，重试只补失败项且成功发现不重复创建', async () => {
  const harness = runtimeHarness((requestNumber) => requestNumber === 1
    ? `世界摘要：发现两个长期过程，其中一项缺少类型。

[SUBJECT NEW]
类型：process
名称：旧水门渗水过程
正文锚点：旧水门的铰链正在渗水
资源：不应进入waiting shell的资源
尝试：不应在发现阶段执行
结果：不应在发现阶段裁决
状态变化：不应产生change
[/SUBJECT]

[SUBJECT NEW]
名称：南岸渡口排队过程
正文锚点：南岸的临时渡口出现排队
[/SUBJECT]`
    : `世界摘要：只补正缺少类型的发现。

[SUBJECT NEW]
类型：process
名称：旧水门渗水过程
正文锚点：旧水门的铰链正在渗水
[/SUBJECT]

[SUBJECT NEW]
类型：process
名称：南岸渡口排队过程
正文锚点：南岸的临时渡口出现排队
[/SUBJECT]`);
  const narrative = '<content>旧水门的铰链正在渗水。南岸的临时渡口出现排队。</content><options><option>继续观察</option></options>';
  await finishOneRuntimeReply(harness, narrative);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const firstReceipt = store.world.receipts[0];
  const firstA = store.world.subjects.find((entry) => entry.name === '旧水门渗水过程');
  assert.equal(harness.worldRequests.length, 1);
  assert.equal(store.world.subjects.length, 1);
  assert.equal(store.world.changes.length, 0);
  assert.equal(firstA.status, 'waiting');
  assert.equal(firstA.current, '旧水门的铰链正在渗水');
  assert.equal(firstReceipt.status, 'partial');
  assert.equal(firstReceipt.unresolvedDiscoveries.length, 1);
  const failedSignature = firstReceipt.unresolvedDiscoveries[0];
  assert.equal(store.world.failures.some((entry) => entry.discoverySignature === failedSignature), true);

  await harness.hooks.retryLastFailure();
  const finalReceipt = store.world.receipts[0];
  assert.equal(harness.worldRequests.length, 2);
  assert.match(harness.worldRequests[1], new RegExp(`${failedSignature}|南岸的临时渡口出现排队`, 'u'));
  assert.equal(store.world.subjects.filter((entry) => entry.name === '旧水门渗水过程').length, 1);
  assert.equal(store.world.subjects.filter((entry) => entry.name === '南岸渡口排队过程').length, 1);
  assert.equal(store.world.subjects.find((entry) => entry.name === '旧水门渗水过程').id, firstA.id);
  assert.equal(store.world.subjects.find((entry) => entry.name === '南岸渡口排队过程').discoverySignature, failedSignature);
  assert.equal(finalReceipt.unresolvedDiscoveries.length, 0);
  assert.equal(finalReceipt.status, 'applied');
  assert.equal(store.world.failures.some((entry) => entry.discoverySignature === failedSignature), false);
  assert.equal(store.world.changes.length, 0);
});

test('正文传闻已保存时发现扫描解析失败仍保持同源可重试，不把观察材料误判为推进完成', async () => {
  const harness = runtimeHarness((requestNumber) => requestNumber === 1
    ? '有人说后台也许没有任何变化。'
    : '世界摘要：本轮没有发现新的长期主体。');
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.world = worldWith([subject({
    id: 'faction-tower', type: 'faction', name: '黑塔', current: '黑塔仍在内部运作',
    nextAction: '复核成员动向', nextCheckTurn: 9, publicEffect: '', publicChannel: 'none',
  })], { chatId: harness.context.chatId, turn: 1, revision: 0 });

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>有人说黑塔已解散，但无人证实。</content><options><option>继续观察</option></options>',
  });
  harness.handlers.get('generation_ended')();
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline && !(store.fullRuns?.length)) await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(harness.worldRequests.length, 1);
  assert.equal(store.fullRuns[0].outcome.stage, 'world');
  assert.equal(store.world.subjects[0].observations[0].epistemic, 'unverified');
  assert.equal(store.world.subjects[0].observedFacts.length, 0);
  assert.equal(store.world.changes.length, 0);

  await harness.hooks.retryLastFailure();

  assert.equal(harness.worldRequests.length, 2);
  assert.equal(store.fullRuns[0].outcome.ok, true);
  assert.equal(store.world.subjects[0].observations.length, 1);
  assert.equal(store.world.changes.length, 0);
});
