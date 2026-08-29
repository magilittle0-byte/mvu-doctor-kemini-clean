import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  WORLD_SCHEMA_VERSION,
  activeWorldCount,
  applyWorldProposal,
  createWorldAdvanceTickets,
  emptyWorldState,
  formatGenerationInjection,
  markWorldEffectsShown,
  normalizeWorldState,
  parseWorldProposal,
  privateProfileDigestFromData,
  profileDigestFromData,
  recallSelectionInput,
  seedWorldSubjectsFromProfiles,
  selectDueWorldSubjects,
  selectWorldRecall,
  worldConsistencyReport,
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

test('既有主体无需actor plan法庭即可宽容合并，旧字段未返回时保持不变', () => {
  const original = subject({ id: 'person-lin', name: '林澄', knowledge: ['亲历旧水门关闭'] });
  const proposal = parseWorldProposal(`[SUBJECT person-lin]
尝试：检查旧水门外侧石阶
结果类型：partial
结果：发现新的水痕但尚未确认来源
代价：经过一段观察时间
状态变化：第二级石阶出现新水痕
现状：已记录新水痕，来源仍待确认
下一步：对照上一时段记录
下次检查：3
[/SUBJECT]`, { subjects: [original] });
  const merged = applyWorldProposal(worldWith([original]), proposal, {
    turn: 2,
    sourceKey: 'existing-single-batch',
    scheduledSubjects: [original],
  });

  assert.deepEqual(merged.applied, ['person-lin']);
  assert.deepEqual(merged.world.subjects[0].knowledge, original.knowledge);
  assert.equal(merged.world.changes.length, 1);
  assert.match(merged.world.subjects[0].current, /新水痕/);
  assert.match(merged.world.subjects[0].nextAction, /对照/);
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

test('NEW以世界规则来源建立完整主体并在同轮推进，不要求正文逐字锚点', () => {
  const proposal = parseWorldProposal(`[SUBJECT NEW]
类型：process
名称：城南地下水位
来源依据：季节降雨与地下排水规则会持续改变水位
稳定锚点：城南地下水位随降雨和排水持续变化
现状：地下水位已接近旧排水口
目标：按降雨和排水条件持续演化
已知：本季降雨仍在继续
资源：地下蓄水空间
约束：旧排水口流量有限
尝试：结算本时段来水与排水
结果类型：partial
结果：水位继续上升
代价：经过一个世界时段
状态变化：水位已到达旧排水口下沿
下一步：下一时段复核排水口压力
下次检查：2
状态：active
支线：城南地下水位
[/SUBJECT]`);
  const merged = applyWorldProposal(emptyWorldState('chat-a'), proposal, {
    turn: 1,
    sourceKey: 'world-rule-source',
    acceptedText: '玩家仍在城北，与城南无直接交集。',
  });

  assert.equal(merged.applied.length, 1);
  assert.equal(merged.world.subjects.length, 1);
  assert.equal(merged.world.changes.length, 1);
  assert.equal(merged.world.subjects[0].status, 'active');
  assert.match(merged.world.subjects[0].anchor, /地下水位/);
});

test('不完整NEW整块拒绝且不计活跃世界，完整主体才进入面板计数', () => {
  const incomplete = applyWorldProposal(emptyWorldState('chat-a'), parseWorldProposal(`[SUBJECT NEW]
类型：process
名称：只有名字的过程
现状：正文里出现过一次
[/SUBJECT]`), {
    turn: 1,
    sourceKey: 'incomplete-new',
  });
  assert.equal(incomplete.world.subjects.length, 0);
  assert.equal(incomplete.world.changes.length, 0);
  assert.equal(activeWorldCount(incomplete.world), 0);
  assert.equal(incomplete.skipped.some((entry) => entry.code === 'new_subject_incomplete'), true);

  const legacyShell = subject({ status: 'waiting', goal: '', nextAction: '' });
  const ready = subject({ id: 'ready-process', name: '完整过程' });
  assert.equal(activeWorldCount(worldWith([legacyShell, ready])), 1);
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


test('具体的等待与受阻是合法世界结果，并安排下一次检查而非把整轮判失败', () => {
  const baseline = worldWith([
    subject({ id: 'faction-gate', type: 'faction', name: '东门守备队', current: '等待新的通行令', nextCheckTurn: 2 }),
  ]);
  const proposal = parseWorldProposal(`[SUBJECT faction-gate]
尝试：派人核验新的通行令是否已经送达
结果类型：delayed
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
      if (system.includes('主体驱动的世界后台引擎')) {
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
  assert.equal(harness.actorRequests.length, 0);
  assert.equal(world.revision, 1);
  assert.equal(world.changes.length, 1);
  assert.equal(world.subjects[0].status, 'active');
  assert.equal(world.subjects[0].current, '水门仍关闭，但下游承压正在增加');
  assert.ok(world.subjects[0].goal);
  assert.ok(world.subjects[0].nextAction);
  assert.equal(harness.worldSaveTransitions.filter((entry) => entry.revision === 1).length, 1);
});

test('世界批次不可解析时只请求一次且零写入，不造主体、变化或空壳', async () => {
  const harness = runtimeHarness('这不是可解析的世界主体批次。');

  await finishOneRuntimeReply(harness);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const world = store.world;

  assert.equal(harness.worldRequests.length, 1);
  assert.equal(harness.actorRequests.length, 0);
  assert.equal(world.revision, 0);
  assert.equal(world.subjects.length, 0);
  assert.equal(world.changes.length, 0);
  assert.equal(harness.worldSaveTransitions.some((entry) => entry.revision > 0), false);
  assert.equal((store.pendingRetries || []).some((entry) => entry.stage === 'world' || entry.kind === 'world'), true);
});
