import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_SCHEMA_VERSION,
  assignCharacterTicketsByNarrativeOrder,
  buildUpdateVariableBlock,
  buildProfilePatch,
  capturePathSnapshot,
  chatCompletionText,
  createFrozenProfileMatcher,
  diagnosticAdvice,
  discoverProfileSubjects,
  ensureWorldObserverSubject,
  generateTicketBatch,
  openAiChatEndpoint,
  openAiModelsEndpoint,
  mergeProfileRootDirect,
  mergeProfileCandidates,
  normalizeProfileCandidates,
  parseCharacterTicketReceipt,
  parseProfileDiscoveryReceipt,
  parseProfileReceipt,
  parseUpdateVariableBlock,
  applyAcceptedWorldObservations,
  applyWorldProposal,
  authorityProtectedProfileNamesFromEntries,
  parseWorldProposal,
  prepareProfileBatch,
  profileCompletenessReport,
  profileCompletionContract,
  profileNarrativeText,
  redactDiagnostic,
  restorePathSnapshot,
  restoreTouchedData,
  removeApiFromExport,
  refreshHostMessageSurface,
  repairAcceptedNarrativeEnvelope,
  seedWorldSubjectsFromProfiles,
  selectWorldRecall,
  semanticJsonEqual,
  statDataOf,
  validateProfileSubjectCoverage,
  verifyCommittedProfiles,
  verifyPathSnapshot,
  variableStateOf,
  variableChangePaths,
} from '../core.mjs';

function completeProfile(ticket) {
  return {
    profileId: '', ticketId: ticket.ticketId, name: '林澄', aliases: ['小澄'],
    identity: { species: '人类', gender: '女性', age: '二十四岁', occupation: '药剂师', affiliation: '南街药房', socialPosition: '独立雇员' },
    appearance: { overall: '衣着利落，神态亲切', body: '中等身量，动作轻快', face: '圆脸，眉眼灵活', hair: '黑色短发，便于工作', voice: '声音清楚，语速偏慢', physiology: '普通人类生理，没有特殊结构' },
    personality: { ...ticket.axes },
    history: '在南街长大，学徒期结束后留在本地工作。',
    currentState: { location: '南街药房', condition: '身体健康但略显疲惫', emotion: '对来客保持谨慎好奇', goal: '完成今日配药并查清短缺原因' },
    relationships: ['与药房老板保持互相信任的雇佣关系'],
    knowledge: ['通过职业训练掌握：常见药材辨识与南街居民基础情况'], capabilities: ['能够辨认与调配常见药剂'], resources: ['可使用药房工具和基础库存'],
    evidence: ['正文明确她正在药房工作'], inferences: ['成长经历根据地点和职业补全，可随新证据修订'],
  };
}

test('生成票据包含十四个轴且批次内不重复', () => {
  let seed = 1;
  const random = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  const tickets = generateTicketBatch(12, random, 1700000000000);
  assert.equal(tickets.length, 12);
  assert.equal(Object.keys(tickets[0].axes).length, 14);
  assert.equal(new Set(tickets.map((ticket) => JSON.stringify(ticket.axes))).size, 12);
});

test('人物档案回执可提取并拒绝缺失完成信号', () => {
  assert.equal(parseProfileReceipt('正文\n<人物档案无变化/>').kind, 'nochange');
  assert.equal(parseProfileReceipt('<人物档案更新>[{"name":"林澄",}]</人物档案更新>').kind, 'update');
  assert.equal(parseProfileReceipt('只有正文').kind, 'missing');
});

test('人物档案JSON可保守修复缺逗号的数组项和对象字段', () => {
  const array = parseProfileReceipt('<人物档案更新>[{"name":"林澄"} {"name":"周遥"}]</人物档案更新>');
  assert.equal(array.kind, 'update');
  assert.equal(array.profiles.length, 2);
  const object = parseProfileReceipt('<人物档案更新>[{"name":"林澄","identity":{"species":"人类"} "aliases":[]}]</人物档案更新>');
  assert.equal(object.kind, 'update');
  assert.deepEqual(object.profiles[0].aliases, []);
});

test('人物票据消费回执在正文生成前固定人物到票据或权威来源', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const parsed = parseCharacterTicketReceipt(
    `<CharacterTicketReceipt>[{"name":"林澄","source":"ticket","ticketId":"${ticket.ticketId}"},{"name":"引导者","source":"authority","ticketId":""}]</CharacterTicketReceipt>`,
    [ticket],
  );
  assert.equal(parsed.kind, 'complete');
  assert.deepEqual(parsed.assignments, [
    { name: '林澄', source: 'ticket', ticketId: ticket.ticketId },
    { name: '引导者', source: 'authority', ticketId: '' },
  ]);
  assert.equal(parseCharacterTicketReceipt('<CharacterTicketReceipt>[{"name":"林澄","source":"ticket","ticketId":"fake"}]</CharacterTicketReceipt>', [ticket]).kind, 'invalid');
});

test('叙事顺序分配票据时既有人物与权威人物跳过且不消费候选票', () => {
  const tickets = [
    { ticketId: 'ticket-first' },
    { ticketId: 'ticket-second' },
    { ticketId: 'ticket-unused' },
  ];
  const assignments = assignCharacterTicketsByNarrativeOrder([
    { label: '药房姑娘', names: ['药房姑娘'] },
    { label: '原创甲', names: ['原创甲'] },
    { label: '新人引导者', names: ['新人引导者'] },
    { label: '原创乙', names: ['原创乙'] },
  ], tickets, {
    'profile-lin': { name: '林澄', aliases: ['药房姑娘'] },
  }, ['新人引导者']);

  assert.deepEqual(assignments, [
    { name: '药房姑娘', source: 'existing', ticketId: '' },
    { name: '原创甲', source: 'ticket', ticketId: 'ticket-first' },
    { name: '新人引导者', source: 'authority', ticketId: '' },
    { name: '原创乙', source: 'ticket', ticketId: 'ticket-second' },
  ]);
  assert.equal(assignments.some((assignment) => assignment.ticketId === 'ticket-unused'), false);
});

test('合法JSON中的中文引号不会被修复器反向破坏', () => {
  const receipt = parseProfileReceipt('<人物档案更新>[{"name":"林澄","inferences":["她把‘草稿’收好，并说明这是‘暂定’记录。"]}]</人物档案更新>');
  assert.equal(receipt.kind, 'update');
  assert.equal(receipt.profiles[0].inferences[0], '她把‘草稿’收好，并说明这是‘暂定’记录。');
});

test('完整档案合同逐项声明所有创作补全字段', () => {
  const contract = profileCompletionContract();
  for (const field of [
    'identity', 'species', 'gender', 'age', 'occupation', 'affiliation', 'socialPosition',
    'appearance', 'overall', 'body', 'face', 'hair', 'voice', 'physiology',
    'personality', 'history', 'currentState', 'relationships', 'knowledge', 'capabilities',
    'resources', 'evidence', 'inferences',
  ]) assert.match(contract, new RegExp(`"${field}"`));
  assert.match(contract, /正文没有明说的内容不是空项/);
  assert.match(contract, /主动设计/);
});

test('人物档案只把最终叙事当作已发生事实', () => {
  const narrative = profileNarrativeText('<gm_chain>计划让甲登场</gm_chain><content>乙正在柜台后说话。</content><options>去找甲</options><UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>');
  assert.doesNotMatch(narrative, /计划让甲登场|去找甲|JSONPatch/);
  assert.match(narrative, /乙正在柜台后说话/);
  const izumiNarrative = profileNarrativeText('<konatan_planning~>计划让丙担任引导者</konatan_planning~><content>丁正在柜台后说明登记流程。</content><options>询问丙</options>');
  assert.doesNotMatch(izumiNarrative, /计划让丙|询问丙/);
  assert.equal(izumiNarrative, '丁正在柜台后说明登记流程。');
});

test('已知planning前缀从accepted正文剥离但content、选项与变量块完整保留', () => {
  const acceptedEnvelope = [
    '<content>林澄在柜台后核对登记簿。</content>',
    '<options><option>询问登记规则</option></options>',
    '<UpdateVariable><Analysis>登记簿没有改变当前变量。</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>',
  ].join('\n');
  const source = [
    '规划阶段只决定候选人物，不属于最终正文。',
    '<CharacterTicketReceipt>[{"name":"规划人物","source":"ticket","ticketId":"ticket-planning"}]</CharacterTicketReceipt>',
    '</konatan_planning~>',
    acceptedEnvelope,
  ].join('\n');

  const repaired = repairAcceptedNarrativeEnvelope(source);

  assert.equal(repaired.ok, true);
  assert.equal(repaired.changed, true);
  assert.deepEqual(repaired.repairs, ['strip_known_planning_prefix_before_content']);
  assert.equal(repaired.message, acceptedEnvelope);
  assert.doesNotMatch(repaired.message, /规划人物|CharacterTicketReceipt|konatan_planning/u);
});

test('最终正文缺少唯一content闭合时只在明确结构边界前补回', () => {
  const source = '<content>正文段落。\n<options><option>继续</option></options>\n<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>';
  const repaired = repairAcceptedNarrativeEnvelope(source);
  assert.equal(repaired.ok, true);
  assert.equal(repaired.changed, true);
  assert.match(repaired.message, /正文段落。\n<\/content>\n<options>/);
  assert.equal((repaired.message.match(/<UpdateVariable>/g) || []).length, 1);
  assert.equal(repairAcceptedNarrativeEnvelope('<content>正文。</content><options></options>').changed, false);
});

test('唯一content闭合误放在完整选项与变量块之后时只搬移闭合标签', () => {
  const source = '<konatan_planning~>计划</konatan_planning~>\n<content>正文。\n<check>检定</check>\n<options>\n>选项一：继续\n>选项二：观察\n>选项三：交谈\n>选项四：离开\n</options>\n<UpdateVariable>\n<Analysis>核对</Analysis>\n<JSONPatch>[]</JSONPatch>\n</UpdateVariable>\n</content>';
  const repaired = repairAcceptedNarrativeEnvelope(source);
  assert.equal(repaired.ok, true);
  assert.equal(repaired.changed, true);
  assert.equal(repaired.repairs[0], 'relocate_misplaced_content_close_before_structured_boundary');
  assert.match(repaired.message, /<check>检定<\/check>\n<\/content>\n<options>/);
  assert.match(repaired.message, /<\/options>\n<UpdateVariable>/);
  assert.match(repaired.message, /<\/UpdateVariable>$/);
  assert.equal((repaired.message.match(/<content>/g) || []).length, 1);
  assert.equal((repaired.message.match(/<\/content>/g) || []).length, 1);
});

test('content闭合跨界时遇到自由正文、重复块或不平衡结构继续拒绝猜测', () => {
  assert.equal(repairAcceptedNarrativeEnvelope('<content>正文<options></options>夹杂正文<UpdateVariable></UpdateVariable></content>').ok, false);
  assert.equal(repairAcceptedNarrativeEnvelope('<content>正文<options></options><options></options></content>').ok, false);
  assert.equal(repairAcceptedNarrativeEnvelope('<content>正文<options></options><UpdateVariable></content>').ok, false);
  assert.equal(repairAcceptedNarrativeEnvelope('<content><options></options></content>').ok, false);
});

test('最终正文缺少唯一content开始标签时只在首个明确检定或正文容器前补回', () => {
  const source = '规划前缀\n<check>判定</check>\n<story_body>正文段落。</story_body>\n</content>\n<options><option>继续</option></options>\n<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>';
  const repaired = repairAcceptedNarrativeEnvelope(source);
  assert.equal(repaired.ok, true);
  assert.equal(repaired.changed, true);
  assert.match(repaired.message, /规划前缀\n<content>\n<check>/);
  assert.equal((repaired.message.match(/<content>/g) || []).length, 1);
  assert.equal((repaired.message.match(/<\/content>/g) || []).length, 1);
  assert.equal(repaired.repairs[0], 'insert_missing_content_open_before_first_narrative_anchor');
});

test('正文content结构不唯一或缺少可证明边界时拒绝猜测', () => {
  assert.equal(repairAcceptedNarrativeEnvelope('<content>没有结构边界').ok, false);
  assert.equal(repairAcceptedNarrativeEnvelope('<content>甲</content><content>乙</content><options></options>').ok, false);
  assert.equal(repairAcceptedNarrativeEnvelope('<content>正文<options></options></content>').ok, true);
  assert.equal(repairAcceptedNarrativeEnvelope('自由文本</content><options></options>').ok, false);
  assert.equal(repairAcceptedNarrativeEnvelope('<check>判定</check></content>').ok, false);
  assert.deepEqual(repairAcceptedNarrativeEnvelope('没有content包装<options></options>'), {
    ok: true, changed: false, message: '没有content包装<options></options>', repairs: [],
  });
});

test('脚本不把中文说话标签冒充人物识别，完整正文发现由人物模型负责', () => {
  const subjects = discoverProfileSubjects(
    '<gm_chain>让黑衣人下回合登场</gm_chain><content>林页低声说道：“先等等。”\n独眼守卫：谁在那里？\n当前环境：雨势渐大。少女点头后退。</content><options>询问黑衣人</options>',
    {
      excludedNames: ['林页'],
      existingProfiles: { existing: { name: '药房老板', aliases: ['老周'] } },
    },
  );
  assert.deepEqual(subjects, []);
});

test('人物发现器丢弃正文内嵌面板字段、全大写属性和语法碎片，不用自由散文正则猜身份', () => {
  const subjects = discoverProfileSubjects(`<content>
<div style="border:1px solid"><span>HP: 105 / 105</span><br>名称: 暗示之种<br>品质: 白色<br>属性加成: PER + 1</div>
那温柔的声音继续说道：“先完成登记。”
引导者微微点头，随后抬手打开门扉。
这番介绍让房间安静下来。
便可将其收进系统空间。
</content>`);
  assert.deepEqual(subjects.map((subject) => subject.label), []);
});

test('人物观察保留普通可见叙事容器，但不把冒号前文本机械升级为人物', () => {
  const narrative = profileNarrativeText('<div class="narrative">林页：记录先放在这里。</div>');
  assert.match(narrative, /林页：记录先放在这里/);
  assert.deepEqual(discoverProfileSubjects(narrative), []);
});

test('人物发现器只把显式结构ID作为机械锚点，不把英文标签、统计缩写或散文主语当人物', () => {
  const subjects = discoverProfileSubjects('Alice: Wait here.\nNPC-7点头回应。\n林页微笑着收起纸笔。\nHP: 12\nSTR说道：这不该成为人物。');
  assert.deepEqual(subjects.map((subject) => subject.label), ['NPC-7']);
});

test('独立人物发现回执只接受最终正文逐字姓名与包含该姓名的逐字锚点', () => {
  const narrative = '林页在药房门口递出采购清单，并向值班药剂师询问到货日期。';
  const parsed = parseProfileDiscoveryReceipt('<人物发现>\n人物：林页\n锚点：林页在药房门口递出采购清单\n</人物发现>', narrative);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.kind, 'subjects');
  assert.equal(parsed.subjects.length, 1);
  assert.equal(parsed.subjects[0].label, '林页');
  assert.equal(parsed.subjects[0].sourceAnchor, '林页在药房门口递出采购清单');
  assert.deepEqual(parsed.subjects[0].names, ['林页']);
});

test('独立人物发现明确NONE正常闭合，幻觉姓名或改写锚点整批拒绝且不落空壳', () => {
  const narrative = '雨水沿着空荡的石阶向下流去。';
  assert.deepEqual(parseProfileDiscoveryReceipt('<人物发现>NONE</人物发现>', narrative), {
    ok: true, kind: 'none', subjects: [], error: '',
  });
  const hallucinated = parseProfileDiscoveryReceipt('<人物发现>\n人物：林页\n锚点：林页在码头检修吊灯\n</人物发现>', narrative);
  assert.equal(hallucinated.ok, false);
  assert.deepEqual(hallucinated.subjects, []);
  assert.match(hallucinated.error, /不是最终正文逐字出现/);

  const rewrittenAnchor = parseProfileDiscoveryReceipt('<人物发现>\n人物：林澄\n锚点：林澄正在整理药材\n</人物发现>', '林澄在柜台后把新送来的药材逐一归档。');
  assert.equal(rewrittenAnchor.ok, false);
  assert.deepEqual(rewrittenAnchor.subjects, []);
  assert.match(rewrittenAnchor.error, /锚点不是最终正文连续逐字原文/);
});

test('独立人物发现过滤已有完整权威身份，不把再次出现变成原创随机人物', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const existing = completeProfile(ticket);
  existing.name = '林页';
  existing.profileId = 'authority-linye';
  delete existing.ticketId;
  const parsed = parseProfileDiscoveryReceipt(
    '<人物发现>\n人物：林页\n锚点：林页在药房门口递出采购清单\n</人物发现>',
    '林页在药房门口递出采购清单。',
    { existingProfiles: { existing } },
  );
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.subjects, []);
});

test('人物观察剥离Izumi的htmlcontent与隐藏摘要，但保留其后的真实正文', () => {
  const source = `<content>
<htmlcontent><div class="status-panel">林页：状态卡说明。</div></htmlcontent>
<span style="display: none;">HTML内容简述：展示玩家初始面板和选项。</span>
<span hidden>隐藏标签：不属于正文。</span>
<span aria-hidden="true">辅助说明：不属于正文。</span>
<span style='visibility : hidden'>折叠说明：不属于正文。</span>
林澄推开药房的门，对柜台后的来客点了点头。
</content>`;
  const narrative = profileNarrativeText(source);
  assert.doesNotMatch(narrative, /林页：状态卡说明|HTML内容简述|隐藏标签|辅助说明|折叠说明/);
  assert.match(narrative, /林澄推开药房的门/);
  assert.deepEqual(discoverProfileSubjects(narrative), []);
});

test('模型在清理后的正文中发现人物后，逐字身份仍能通过完整档案原子门', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  const accepted = '<content><span style="display:none">HTML内容简述：展示人物档案。</span>林澄正在药房柜台后整理新送到的药材。</content>';
  const prepared = prepareProfileBatch([profile], [ticket], { stat_data: {} }, accepted, []);
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].narrativeKnownNames, ['林澄']);
});

test('人物发现器不把机制字段、连接词和动作片段升级为必须建档人物', () => {
  const subjects = discoverProfileSubjects('VoiceFingerprint: stable\n但每个人还是欠身回应。\n也就是继续说道：“照旧。”');
  assert.deepEqual(subjects, []);
});

test('人物档案批次必须以name或aliases逐一覆盖脚本确认的稳定出场锚点', () => {
  const required = [{ label: '独眼守卫', aliases: ['独眼守卫'], evidence: ['独眼守卫：站住。'] }];
  const missing = validateProfileSubjectCoverage([{ name: '格雷', aliases: [] }], required);
  assert.equal(missing.ok, false);
  assert.match(missing.errors[0], /独眼守卫/);
  const covered = validateProfileSubjectCoverage([{ name: '格雷', aliases: ['独眼守卫'] }], required);
  assert.equal(covered.ok, true);
});

test('同名半档案不是可用既有人物，再次出场仍必须进入补全门', () => {
  const subjects = discoverProfileSubjects('NPC-7说道：“今天照常营业。”', {
    existingProfiles: { partial: { profileId: 'partial', name: 'NPC-7', aliases: [] } },
  });
  assert.deepEqual(subjects.map((subject) => subject.label), ['NPC-7']);
  assert.equal(profileCompletenessReport({ profileId: 'partial', name: 'NPC-7', aliases: [] }).ok, false);

  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const complete = completeProfile(ticket);
  complete.name = 'NPC-7';
  complete.aliases = [];
  const excluded = discoverProfileSubjects('NPC-7说道：“今天照常营业。”', { existingProfiles: { complete } });
  assert.deepEqual(excluded, []);
});

test('消息刷新严格先重绘再发送MESSAGE_UPDATED，并把缺失或失败接口显式返回', async () => {
  const order = [];
  const host = {
    eventTypes: { MESSAGE_UPDATED: 'message_updated' },
    async updateMessageBlock(messageId, message) { order.push(['render', messageId, message.mes]); },
    eventSource: { async emit(name, messageId) { order.push(['emit', name, messageId]); } },
  };
  const success = await refreshHostMessageSurface(host, 4, { mes: '测试正文' });
  assert.deepEqual(order, [['render', 4, '测试正文'], ['emit', 'message_updated', 4]]);
  assert.deepEqual(success, { rendered: true, eventEmitted: true, errors: [] });

  const missing = await refreshHostMessageSurface({}, 4, { mes: '测试正文' });
  assert.equal(missing.rendered, false);
  assert.equal(missing.eventEmitted, false);
  assert.deepEqual(missing.errors, ['宿主未提供updateMessageBlock', '宿主未提供MESSAGE_UPDATED事件接口']);

  const failedOrder = [];
  const failed = await refreshHostMessageSurface({
    updateMessageBlock() { failedOrder.push('render'); throw new Error('render rejected'); },
    eventSource: { emit() { failedOrder.push('emit'); throw new Error('emit rejected'); } },
  }, 2, { mes: '测试正文' });
  assert.deepEqual(failedOrder, ['render', 'emit']);
  assert.equal(failed.errors.length, 2);
  assert.match(failed.errors.join('；'), /render rejected/);
  assert.match(failed.errors.join('；'), /emit rejected/);
});

test('变量区块只接受单一写入源，并保留模型分析但不要求伪证式回执', () => {
  const one = parseUpdateVariableBlock('<UpdateVariable><Analysis>逐项核对后无需修复。</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>');
  assert.equal(one.ok, true);
  assert.equal(one.analysis, '逐项核对后无需修复。');
  const two = parseUpdateVariableBlock('<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable><UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>');
  assert.equal(two.ok, false);
  assert.equal(two.code, 'multiple-blocks');
});

test('变量区块按无限回廊真实MVU的分行结构输出', () => {
  const block = buildUpdateVariableBlock([{ op: 'delta', path: '/契约者/经济/UP', value: 1 }], '只写合法直写字段。');
  assert.match(block, /^<UpdateVariable>\n<Analysis>\n只写合法直写字段。\n<\/Analysis>\n<JSONPatch>\n/u);
  assert.equal(parseUpdateVariableBlock(block).ok, true);
});

test('变量事务差异覆盖官方派生路径，并把人物档案根完全隔离', () => {
  const previous = { stat_data: { 测试主体: { 数值: 10, 派生: 20 }, 人物档案: { byActorId: {} } } };
  const final = { stat_data: { 测试主体: { 数值: 7, 派生: 14 }, 人物档案: { byActorId: { npc: { name: '测试人物' } } } } };
  const changed = variableChangePaths(previous, final);
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.paths.sort(), ['/测试主体/数值', '/测试主体/派生'].sort());
  assert.deepEqual(variableStateOf(final), { 测试主体: { 数值: 7, 派生: 14 } });
});

test('变量事务回滚只恢复本事务触碰路径', () => {
  const state = { stat_data: { 玩家: { 生命: 10, 金钱: 5 }, 世界时钟: 7 } };
  const rollbackPaths = ['/玩家/生命'];
  const liveAfterOtherWork = { stat_data: { 玩家: { 生命: 8, 金钱: 12 }, 世界时钟: 8 } };
  const restored = restoreTouchedData(liveAfterOtherWork, state, rollbackPaths);
  assert.equal(restored.ok, true);
  assert.equal(restored.data.stat_data.玩家.生命, 10);
  assert.equal(restored.data.stat_data.玩家.金钱, 12);
  assert.equal(restored.data.stat_data.世界时钟, 8);
  const snapshot = capturePathSnapshot(state, rollbackPaths);
  const restoredAgain = restorePathSnapshot(liveAfterOtherWork, snapshot);
  assert.equal(verifyPathSnapshot(restoredAgain.data, snapshot), true);
});

test('对象键顺序不影响语义相等，数组顺序仍必须一致', () => {
  const expected = { 名称: '测试物品', 类型: '武器', 数量: 1, 效果: { 被动: '无', 主动: '无' } };
  const hostNormalized = { 效果: { 主动: '无', 被动: '无' }, 数量: 1, 类型: '武器', 名称: '测试物品' };
  assert.equal(semanticJsonEqual(expected, hostNormalized), true);
  assert.equal(semanticJsonEqual([1, 2], [2, 1]), false);
});

test('独立API端点归一化、响应提取与诊断脱敏', () => {
  assert.equal(openAiChatEndpoint('https://example.com/v1'), 'https://example.com/v1/chat/completions');
  assert.equal(openAiChatEndpoint('https://example.com/v1/chat/completions'), 'https://example.com/v1/chat/completions');
  assert.equal(openAiModelsEndpoint('https://example.com/v1'), 'https://example.com/v1/models');
  assert.equal(chatCompletionText({ choices: [{ message: { content: 'OK' } }] }), 'OK');
  assert.match(redactDiagnostic('Authorization: Bearer placeholder-secret'), /已隐藏/);
  assert.doesNotMatch(redactDiagnostic('Authorization: Bearer placeholder-secret'), /secret/);
  assert.doesNotMatch(redactDiagnostic('x-api-key: private-value-123456'), /private-value/);
  assert.match(diagnosticAdvice('profile_failed', 'JSON无法解析').action, /重试失败步骤/);
  assert.equal(diagnosticAdvice('profile_failed', '整批档案校验失败').severity, 'error');
  assert.match(diagnosticAdvice('world_failed', 'JSON无法解析').summary, /世界支线/);
  assert.match(diagnosticAdvice('variable_failed', 'MVU解析失败').summary, /MVU变量/);
});

test('诊断以明确阶段码为准，完成详情中的世界字样不会被误报为失败', () => {
  const completed = diagnosticAdvice('completed', '档案变更1张；世界项2条');
  assert.equal(completed.severity, 'success');
  assert.match(completed.summary, /已经完成/);
  assert.equal(diagnosticAdvice('world_failed', '世界引擎失败').severity, 'error');
});

test('完整新档案按正文生成前消费映射绑定同一票据并编译为单根原子补丁', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const current = { stat_data: { 时间: '上午' } };
  const prepared = prepareProfileBatch([completeProfile(ticket)], [ticket], current, '', null, {
    ticketAssignments: [{ name: '林澄', source: 'ticket', ticketId: ticket.ticketId }],
  });
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].personality, ticket.axes);
  const patch = buildProfilePatch(current, prepared.profiles);
  assert.equal(patch.operations.length, 1);
  assert.equal(patch.operations[0].path, '/人物档案');
  const committed = { stat_data: { ...statDataOf(current), 人物档案: patch.expected } };
  assert.equal(verifyCommittedProfiles(committed, prepared.profiles), true);
  assert.equal(buildProfilePatch(current, prepared.profiles).operations[0].op, 'insert');
  assert.equal(verifyCommittedProfiles(mergeProfileRootDirect(current, prepared.profiles), prepared.profiles), true);
});

test('原创人物的十四个骰轴是生成前事实，模型返回不得覆盖其中任何一轴', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  profile.personality = Object.fromEntries(Object.keys(ticket.axes).map((key) => [key, `模型试图覆盖-${key}`]));

  const prepared = prepareProfileBatch([profile], [ticket], { stat_data: {} }, '', null, {
    ticketReceiptStatus: 'complete',
    ticketAssignments: [{ name: '林澄', source: 'ticket', ticketId: ticket.ticketId }],
  });

  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].personality, ticket.axes);
  assert.equal(Object.keys(prepared.profiles[0].personality).length, 14);
});

test('合法的单字物种与性别不会被误判为空字段', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  profile.identity.species = '人';
  profile.identity.gender = '女';
  const prepared = prepareProfileBatch([profile], [ticket], { stat_data: {} });
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
});

test('权威人物使用完整权威人格且绝不混入随机票据', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  profile.name = '角色卡原著人物';
  profile.personality = Object.fromEntries(Object.keys(ticket.axes).map((key) => [key, `角色卡权威-${key}`]));
  const prepared = prepareProfileBatch(
    [profile],
    [ticket],
    { stat_data: {} },
    '',
    null,
    { authorityProtectedNames: ['角色卡原著人物'] },
  );
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].personality, profile.personality);
  assert.equal(prepared.profiles[0].ticketId, undefined);
  assert.equal(prepared.profiles[0].authoritySource, 'character-card-or-worldbook');
});

test('人物修复保留最佳候选并只归一化缺项，不重新生成整张档案', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const firstCandidate = {
    ticketId: ticket.ticketId,
    name: '林澄',
    aliases: ['小澄'],
    relationships: ['与药房老板保持互相信任的雇佣关系'],
  };
  const repairedCandidate = completeProfile(ticket);
  repairedCandidate.ticketId = '模型重试时误写的票据';
  repairedCandidate.aliases = '小澄';
  repairedCandidate.inferences = ['她把‘草稿’作为可修订记录，不会冒充已经确认的事实。'];
  delete repairedCandidate.evidence;
  const merged = mergeProfileCandidates([firstCandidate], [repairedCandidate]);
  const normalized = normalizeProfileCandidates(merged, '林澄正在药房柜台后整理新送到的药材。');
  assert.deepEqual(normalized[0].aliases, ['小澄']);
  assert.equal(normalized[0].ticketId, ticket.ticketId);
  assert.equal(normalized[0].evidence.length, 1);
  merged[0].narrativeKnownNames = ['模型自行声称已公开的隐藏姓名'];
  const prepared = prepareProfileBatch(merged, [ticket], { stat_data: {} }, '林澄正在药房柜台后整理新送到的药材。');
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].relationships, firstCandidate.relationships);
  assert.deepEqual(prepared.profiles[0].narrativeKnownNames, ['林澄']);
  assert.match(prepared.profiles[0].inferences[0], /‘草稿’/);
});

test('完整新候选替换人物快照数组，只有别名与证据保留历史并集', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const previous = completeProfile(ticket);
  previous.aliases = ['旧称'];
  previous.relationships = ['旧关系快照'];
  previous.knowledge = ['旧知识快照'];
  previous.capabilities = ['旧能力快照'];
  previous.resources = ['旧资源快照'];
  previous.evidence = ['旧正文证据'];
  previous.inferences = ['旧推断快照'];

  const incoming = completeProfile(ticket);
  incoming.aliases = ['新称'];
  incoming.relationships = ['新关系快照'];
  incoming.knowledge = ['新知识快照'];
  incoming.capabilities = ['新能力快照'];
  incoming.resources = ['新资源快照'];
  incoming.evidence = ['新正文证据'];
  incoming.inferences = ['新推断快照'];

  const [merged] = mergeProfileCandidates([previous], [incoming]);
  assert.deepEqual(merged.relationships, ['新关系快照']);
  assert.deepEqual(merged.knowledge, ['新知识快照']);
  assert.deepEqual(merged.capabilities, ['新能力快照']);
  assert.deepEqual(merged.resources, ['新资源快照']);
  assert.deepEqual(merged.inferences, ['新推断快照']);
  assert.deepEqual(merged.aliases, ['旧称', '新称']);
  assert.deepEqual(merged.evidence, ['旧正文证据', '新正文证据']);
});

test('多人物候选的占位缺项可定向补全并整体通过，而不重写已有内容', () => {
  const tickets = generateTicketBatch(2, () => 0.25, 1700000000000);
  const first = completeProfile(tickets[0]);
  const second = completeProfile(tickets[1]);
  second.name = '周遥';
  first.identity.gender = '女';
  second.identity.gender = '男';
  second.identity.affiliation = '无';
  second.appearance.hair = '不详';
  const before = prepareProfileBatch([first, second], tickets, { stat_data: {} });
  assert.equal(before.ok, false);
  assert.equal(before.errors.length, 2);

  const repaired = mergeProfileCandidates([first, second], [{
    ticketId: second.ticketId,
    name: second.name,
    identity: { affiliation: '暂时独立行动，尚未加入任何组织' },
    appearance: { hair: '深棕短发，鬓角修剪整齐' },
    inferences: ['归属与发型由医生结合身份主动补全，后续权威证据出现时可修订。'],
  }]);
  const after = prepareProfileBatch(repaired, tickets, { stat_data: {} });
  assert.equal(after.ok, true, after.errors.join('\n'));
  assert.equal(after.profiles[0].identity.occupation, first.identity.occupation);
  assert.equal(after.profiles[1].identity.affiliation, '暂时独立行动，尚未加入任何组织');
});

test('旧人物的局部更新自动继承完整持久档案', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const existing = completeProfile(ticket);
  existing.profileId = 'actor-existing';
  const current = { stat_data: { 人物档案: { schemaVersion: 1, byActorId: { [existing.profileId]: existing } } } };
  const prepared = prepareProfileBatch([
    { profileId: existing.profileId, ticketId: '模型误写票据', name: existing.name, currentState: { goal: '查清今晚药材失窃的来源' } },
  ], [], current, '林澄决定查清今晚药材失窃的来源。');
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.equal(prepared.profiles[0].identity.occupation, existing.identity.occupation);
  assert.equal(prepared.profiles[0].ticketId, existing.ticketId);
  assert.equal(prepared.profiles[0].currentState.goal, '查清今晚药材失窃的来源');
});

test('partial重试不得复用已提交人物的ticket或profileId覆盖冻结档案', () => {
  const tickets = generateTicketBatch(2, () => 0.25, 1700000000000);
  const committed = completeProfile(tickets[0]);
  committed.profileId = tickets[0].ticketId;
  const current = {
    stat_data: {
      人物档案: {
        schemaVersion: 1,
        byActorId: { [committed.profileId]: committed },
      },
    },
  };
  const retryCandidate = completeProfile(tickets[1]);
  retryCandidate.name = '周遥';
  retryCandidate.aliases = ['小遥'];
  retryCandidate.profileId = committed.profileId;
  retryCandidate.ticketId = committed.ticketId;

  const retried = prepareProfileBatch(
    [retryCandidate],
    [tickets[1]],
    current,
    '周遥推门进入药房，把斗篷上的雨水抖落在门外。',
  );

  assert.equal(retried.ok, false);
  assert.equal(retried.profiles.length, 0);
  assert.match(retried.errors.join('；'), /冻结|已提交|profileId|票据|ticket/u);
  assert.equal(current.stat_data.人物档案.byActorId[committed.profileId].name, '林澄');
});

test('共享称谓命中多个既有人物时局部拒绝消歧，不按插入顺序串档', () => {
  const tickets = generateTicketBatch(3, () => 0.25, 1700000000000);
  const first = completeProfile(tickets[0]);
  first.profileId = 'actor-first-captain';
  first.name = '林澄';
  first.aliases = ['队长'];
  const second = completeProfile(tickets[1]);
  second.profileId = 'actor-second-captain';
  second.name = '周遥';
  second.aliases = ['队长'];
  const ambiguous = completeProfile(tickets[2]);
  ambiguous.profileId = '';
  ambiguous.ticketId = '';
  ambiguous.name = '队长';
  ambiguous.aliases = [];
  const current = { stat_data: { 人物档案: { schemaVersion: 1, byActorId: {
    [first.profileId]: first,
    [second.profileId]: second,
  } } } };

  const prepared = prepareProfileBatch([ambiguous], [tickets[2]], current, '队长站在门口检查了两遍名单。');

  assert.equal(prepared.ok, false);
  assert.equal(prepared.profiles.length, 0);
  assert.match(prepared.errors.join('；'), /同时命中多个既有人物|共享称谓/u);
  const mergedCandidates = mergeProfileCandidates([
    { name: '林澄', aliases: ['队长'] },
  ], [{ name: '周遥', aliases: ['队长'] }]);
  assert.equal(mergedCandidates.length, 2);
});

test('冻结人物只按精确ID、有效票据或唯一主名匹配，共享alias不能吞掉待修复候选', () => {
  const tickets = generateTicketBatch(3, () => 0.25, 1700000000000);
  const first = completeProfile(tickets[0]);
  first.profileId = tickets[0].ticketId;
  first.name = '林澄';
  first.aliases = ['队长', '药师'];
  const second = completeProfile(tickets[1]);
  second.profileId = tickets[1].ticketId;
  second.name = '周遥';
  second.aliases = ['队长'];
  const matcher = createFrozenProfileMatcher(
    [first, second],
    { [first.profileId]: first, [second.profileId]: second },
    tickets,
  );

  assert.equal(matcher({ profileId: first.profileId, name: '完全错误的名字' }), true);
  assert.equal(matcher({ ticketId: second.ticketId, name: '完全错误的名字' }), true);
  assert.equal(matcher({ name: '林澄', aliases: [] }), true);
  assert.equal(matcher({ name: '队长', aliases: [] }), false);
  assert.equal(matcher({ name: '新来的传令员', aliases: ['队长'] }), false);
  assert.equal(matcher({ name: '新来的采药人', aliases: ['药师'] }), false);
  assert.equal(matcher({ name: '', aliases: ['药师'] }), false);
  assert.equal(matcher({ ticketId: '模型伪造的票据', name: '陌生人物' }), false);
});

test('候选错票据时只服从正文生成前消费映射，不按正文顺序事后重分', () => {
  const tickets = generateTicketBatch(3, () => 0.25, 1700000000000);
  const first = completeProfile(tickets[0]);
  first.name = '林澄';
  first.aliases = [];
  const second = completeProfile(tickets[0]);
  second.name = '周遥';
  second.aliases = [];
  const reserved = completeProfile(tickets[1]);
  reserved.name = '林页';
  reserved.aliases = [];

  const merged = mergeProfileCandidates([first], [second, reserved]);
  assert.equal(merged.length, 3);
  const prepared = prepareProfileBatch(
    merged,
    tickets,
    { stat_data: {} },
    '周遥先走进药房。林页随后把伞收好。林澄最后从库房回来。',
    null,
    { ticketAssignments: [
      { name: '周遥', source: 'ticket', ticketId: tickets[0].ticketId },
      { name: '林页', source: 'ticket', ticketId: tickets[1].ticketId },
      { name: '林澄', source: 'ticket', ticketId: tickets[2].ticketId },
    ] },
  );

  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles.map((profile) => profile.name), ['周遥', '林页', '林澄']);
  assert.deepEqual(prepared.profiles.map((profile) => profile.ticketId), [
    tickets[0].ticketId,
    tickets[1].ticketId,
    tickets[2].ticketId,
  ]);
  assert.equal(prepared.normalizationRepairs.some((repair) => repair.code === 'candidate_ticket_replaced_by_generation_mapping'), true);
});

test('世界书权威只接受结构化ID、唯一精确key或label，不从正文子串和通用alias推断', () => {
  const candidates = [
    { name: '林页', aliases: ['护士'] },
    { name: '黑羽', aliases: [] },
    { name: '队长', aliases: [] },
    { name: '洛青', aliases: [], authorityEntryId: 'entry-luoqing' },
    { name: '角色卡本人', aliases: [] },
  ];
  const entries = [
    { uid: 'entry-background', keys: ['背景'], comment: '医院背景', content: '正文描述中偶然提到林页经过大厅。' },
    { uid: 'entry-linye', keys: ['林页'], comment: '林页', content: '人物设定。' },
    { uid: 'entry-heiyu-a', keys: ['黑羽'], comment: '黑羽', content: '第一份重名条目。' },
    { uid: 'entry-heiyu-b', keys: ['黑羽'], comment: '其他记录', content: '第二份重名条目。' },
    { uid: 'entry-captain', keys: ['队长'], comment: '队长', content: '通用职务称谓。' },
    { uid: 'entry-luoqing', keys: ['洛青'], comment: '洛青', content: '结构化来源选中的人物条目。' },
    { uid: 'entry-luoqing-duplicate', keys: ['洛青'], comment: '旁支洛青', content: '同名触发词的另一条记录。' },
  ];

  const protectedNames = authorityProtectedProfileNamesFromEntries(candidates, ['角色卡本人'], entries);

  assert.deepEqual(protectedNames, ['林页', '洛青', '角色卡本人']);
  assert.equal(protectedNames.includes('黑羽'), false);
  assert.equal(protectedNames.includes('队长'), false);

  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const unrelated = completeProfile(ticket);
  unrelated.name = '赵宁';
  unrelated.aliases = ['林页'];
  const prepared = prepareProfileBatch(
    [unrelated],
    [ticket],
    { stat_data: {} },
    '赵宁走进病房，有人误把她喊成林页。',
    null,
    {
      authorityProtectedNames: protectedNames,
      ticketReceiptStatus: 'complete',
      ticketAssignments: [{ name: '赵宁', source: 'ticket', ticketId: ticket.ticketId }],
    },
  );
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.equal(prepared.profiles[0].ticketId, ticket.ticketId);
  assert.equal(prepared.profiles[0].authoritySource, undefined);
});

test('既有档案回传只能更新正文支持的动态字段，不得改写身份、人格、票据或凭空覆盖现状资源', () => {
  const tickets = generateTicketBatch(2, () => 0.25, 1700000000000);
  const existing = completeProfile(tickets[0]);
  existing.profileId = 'actor-existing-immutable';
  const current = {
    stat_data: {
      人物档案: {
        schemaVersion: 1,
        byActorId: { [existing.profileId]: structuredClone(existing) },
      },
    },
  };
  const incoming = {
    profileId: existing.profileId,
    ticketId: tickets[1].ticketId,
    name: existing.name,
    identity: { species: '精灵', occupation: '王室密探', affiliation: '敌对王庭' },
    personality: Object.fromEntries(Object.keys(existing.personality).map((key) => [key, `模型覆盖-${key}`])),
    currentState: { location: '敌军地堡', condition: '毫发无损', emotion: '绝对忠诚', goal: '执行未公开密令' },
    resources: ['可调用敌军全部兵力'],
  };

  const prepared = prepareProfileBatch(
    [incoming],
    [tickets[1]],
    current,
    '林澄仍在南街药房整理常见药材。',
  );

  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  const saved = prepared.profiles[0];
  assert.equal(saved.ticketId, existing.ticketId);
  assert.deepEqual(saved.identity, existing.identity);
  assert.deepEqual(saved.personality, existing.personality);
  assert.deepEqual(saved.currentState, existing.currentState);
  assert.deepEqual(saved.resources, existing.resources);
});

test('既有人物的资源、关系和能力只按同一人物正文中的明确变化局部退休旧项', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const existing = completeProfile(ticket);
  existing.profileId = 'actor-existing-dynamic';
  existing.relationships = ['林澄与药房老板保持盟友关系'];
  existing.capabilities = ['林澄的右手可以稳定调配药剂'];
  existing.resources = ['林澄随身持有最后一瓶解毒剂'];
  const incoming = structuredClone(existing);
  incoming.relationships = ['林澄与药房老板已经决裂并转为敌对'];
  incoming.capabilities = ['林澄右手受伤后暂时无法调配药剂'];
  incoming.resources = ['林澄把最后一瓶解毒剂交给老板，当前不再持有解毒剂'];
  const current = { stat_data: { 人物档案: { schemaVersion: 1, byActorId: { [existing.profileId]: existing } } } };
  const narrative = '林澄与药房老板已经决裂并转为敌对。林澄右手受伤后暂时无法调配药剂。林澄把最后一瓶解毒剂交给老板，当前不再持有解毒剂。';

  const prepared = prepareProfileBatch([incoming], [], current, narrative);

  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].relationships, incoming.relationships);
  assert.deepEqual(prepared.profiles[0].capabilities, incoming.capabilities);
  assert.deepEqual(prepared.profiles[0].resources, incoming.resources);
});

test('既有人物动态集合被正文明确耗尽至空时保存可读空状态，不让旧项复活', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const existing = completeProfile(ticket);
  existing.profileId = 'actor-existing-empty-resource';
  existing.resources = ['林澄随身持有唯一一把库房钥匙'];
  const incoming = structuredClone(existing);
  incoming.resources = [];
  const current = { stat_data: { 人物档案: { schemaVersion: 1, byActorId: { [existing.profileId]: existing } } } };

  const prepared = prepareProfileBatch([incoming], [], current, '林澄把唯一一把库房钥匙交给守卫，当前不再持有钥匙。');

  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.equal(prepared.profiles[0].resources.length, 1);
  assert.match(prepared.profiles[0].resources[0], /没有可调用.*资源/u);
  assert.doesNotMatch(prepared.profiles[0].resources[0], /随身持有/u);
});

test('正文对白和未证实传闻只进入带可信度的观察材料，不冒充世界成功变化', () => {
  const baseline = {
    schemaVersion: WORLD_SCHEMA_VERSION,
    chatId: 'chat-observation', turn: 3, revision: 2, subjects: [{
      id: 'faction-tower', type: 'faction', name: '黑塔', anchor: '黑塔按自身组织目标运行',
      current: '黑塔仍在内部运作', goal: '维持组织活动', knowledge: [], observedFacts: [], resources: ['既有成员'],
      constraints: [], nextAction: '复核成员动向', nextCheckTurn: 4, status: 'active',
      publicEffect: '黑塔门前张贴了临时闭馆告示。', publicChannel: 'named_action',
    }], changes: [], receipts: [], failures: [],
  };
  const acceptedText = '有人说黑塔已解散，但无人证实。黑塔门前张贴了临时闭馆告示。';
  const first = applyAcceptedWorldObservations(baseline, [
    { subjectId: 'faction-tower', fact: '有人说黑塔已解散，但无人证实。', epistemic: 'rumor' },
    { subjectId: 'faction-tower', fact: '黑塔门前张贴了临时闭馆告示。', epistemic: 'confirmed_public_effect' },
  ], { chatId: 'chat-observation', turn: 4, sourceKey: 'reply-1', acceptedText });
  const tower = first.world.subjects[0];

  assert.equal(tower.current, '黑塔仍在内部运作');
  assert.deepEqual(tower.resources, ['既有成员']);
  assert.equal(tower.nextAction, '复核成员动向');
  assert.deepEqual(tower.observedFacts, ['黑塔门前张贴了临时闭馆告示。']);
  assert.deepEqual(tower.observations.map((entry) => entry.epistemic), ['rumor', 'confirmed_public_effect']);
  assert.equal(first.world.changes.length, 0);

  const repeated = applyAcceptedWorldObservations(first.world, [
    { subjectId: 'faction-tower', fact: '有人说黑塔已解散，但无人证实。', epistemic: 'rumor' },
  ], { chatId: 'chat-observation', turn: 4, sourceKey: 'reply-1', acceptedText });
  assert.equal(repeated.applied.length, 0);
  assert.equal(repeated.world.subjects[0].observations.length, 2);
});

test('人物知识以人物可达来源为边界：无来源内容降为可修订推断而不否决完整档案', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const fresh = completeProfile(ticket);
  fresh.knowledge = ['通过职业训练掌握：常见药材辨识', '仓库门锁昨晚被换过'];
  const normalizedFresh = prepareProfileBatch([fresh], [ticket], { stat_data: {} });
  assert.equal(normalizedFresh.ok, true, normalizedFresh.errors.join('\n'));
  assert.deepEqual(normalizedFresh.profiles[0].knowledge, ['通过职业训练掌握：常见药材辨识']);
  assert.match(normalizedFresh.profiles[0].inferences.join('；'), /仓库门锁昨晚被换过/);
  assert.equal(normalizedFresh.normalizationRepairs.some((repair) => repair.code === 'unreachable_knowledge_moved_to_inferences'), true);

  fresh.knowledge = ['经亲眼查看得知：仓库门锁昨晚被换过'];
  const acceptedFresh = prepareProfileBatch(
    [fresh],
    [ticket],
    { stat_data: {} },
    '林澄亲眼查看了仓库门锁，确认门锁昨晚被换过。',
  );
  assert.equal(acceptedFresh.ok, true, acceptedFresh.errors.join('\n'));

  const systemGuide = completeProfile(ticket);
  systemGuide.name = '资料终端';
  systemGuide.aliases = ['测试终端'];
  systemGuide.identity = { species: '系统单元', gender: '不适用', age: '启用后持续运行', occupation: '资料服务程序', affiliation: '测试设施', socialPosition: '经授权提供公开登记资料的服务终端' };
  systemGuide.capabilities = ['能够通过系统权限读取测试主体已公开的登记档案'];
  systemGuide.resources = ['可调用公开资料接口与基础资料库'];
  systemGuide.knowledge = ['通过系统数据库分析得知：测试主体已登记的公开字段A'];
  systemGuide.evidence = ['正文明确资料终端是拥有公开资料读取权限的系统单元'];
  const systemAccepted = prepareProfileBatch(
    [systemGuide],
    [ticket],
    { stat_data: {} },
    '资料终端通过公开资料权限读取了测试主体已经登记的字段A，并开始说明使用规则。',
  );
  assert.equal(systemAccepted.ok, true, systemAccepted.errors.join('\n'));

  const selfProvedSystem = prepareProfileBatch(
    [systemGuide],
    [ticket],
    { stat_data: {} },
    '资料终端开始说明一般使用规则，正文没有交代其数据来源。',
  );
  assert.equal(selfProvedSystem.ok, false);
  assert.match(selfProvedSystem.rejected[0].candidate.inferences.join('；'), /测试主体已登记的公开字段A/);

  const authoritySystem = prepareProfileBatch(
    [systemGuide],
    [ticket],
    { stat_data: {} },
    '资料终端开始说明使用规则。',
    null,
    {
      authorityProtectedNames: ['资料终端'],
      authorityKnowledgeEvidence: {
        资料终端: '角色卡明确资料终端是系统单元，可通过数据库权限读取测试主体已登记的公开字段A。',
      },
    },
  );
  assert.equal(authoritySystem.ok, true, authoritySystem.errors.join('\n'));
  assert.deepEqual(authoritySystem.profiles[0].knowledge, systemGuide.knowledge);

  const unverifiedAuthorityEvidence = prepareProfileBatch(
    [systemGuide],
    [ticket],
    { stat_data: {} },
    '资料终端开始说明使用规则。',
    null,
    {
      authorityKnowledgeEvidence: {
        资料终端: '候选自行声称自己是系统单元并拥有数据库读取权限。',
      },
    },
  );
  assert.equal(unverifiedAuthorityEvidence.ok, false);

  const aliasBorrower = completeProfile(ticket);
  aliasBorrower.name = '林页';
  aliasBorrower.aliases = ['资料终端'];
  aliasBorrower.knowledge = [
    '通过职业训练掌握：常见药材辨识',
    '经系统授权读取：敌对势力尚未公开的密令内容',
  ];
  const aliasBorrowRejected = prepareProfileBatch(
    [aliasBorrower],
    [ticket],
    { stat_data: {} },
    '资料终端通过数据库权限读取了敌对势力尚未公开的密令内容。林页在旁整理纸页。',
  );
  assert.equal(aliasBorrowRejected.ok, true, aliasBorrowRejected.errors.join('\n'));
  assert.deepEqual(aliasBorrowRejected.profiles[0].aliases, ['资料终端']);
  assert.deepEqual(aliasBorrowRejected.profiles[0].knowledge, ['通过职业训练掌握：常见药材辨识']);
  assert.match(aliasBorrowRejected.profiles[0].inferences.join('；'), /敌对势力尚未公开的密令内容/);

  const explicitlyBoundAlias = prepareProfileBatch(
    [aliasBorrower],
    [ticket],
    { stat_data: {} },
    '林页（资料终端）通过数据库权限读取了敌对势力尚未公开的密令内容。',
  );
  assert.equal(explicitlyBoundAlias.ok, true, explicitlyBoundAlias.errors.join('\n'));
  assert.deepEqual(explicitlyBoundAlias.profiles[0].knowledge, aliasBorrower.knowledge);

  const ordinaryImpostor = completeProfile(ticket);
  ordinaryImpostor.knowledge = ['经系统授权读取：敌对势力的未公开密令'];
  const systemRejected = prepareProfileBatch([ordinaryImpostor], [ticket], { stat_data: {} }, '林澄继续整理药材。');
  assert.equal(systemRejected.ok, false);
  assert.match(systemRejected.errors.join('；'), /knowledge|知识|来源|可达/u);

  const librarian = completeProfile(ticket);
  librarian.identity.occupation = '图书管理员';
  librarian.capabilities = ['能够读取书籍并通过接口沟通'];
  librarian.knowledge = ['经系统授权读取：未公开的测试记录'];
  const librarianRejected = prepareProfileBatch([librarian], [ticket], { stat_data: {} }, '林澄继续整理公开目录。');
  assert.equal(librarianRejected.ok, false);

  const existing = completeProfile(ticket);
  existing.profileId = 'actor-existing-knowledge';
  existing.knowledge = ['旧版档案遗留的知识快照'];
  const current = { stat_data: { 人物档案: { schemaVersion: 1, byActorId: { [existing.profileId]: existing } } } };
  const inherited = prepareProfileBatch([
    { profileId: existing.profileId, name: existing.name, currentState: { goal: '继续整理药材' } },
  ], [], current, '林澄继续整理药材。');
  assert.equal(inherited.ok, true, inherited.errors.join('\n'));
  assert.deepEqual(inherited.profiles[0].knowledge, ['旧版档案遗留的知识快照']);

  const leaked = prepareProfileBatch([
    { profileId: existing.profileId, name: existing.name, knowledge: [...existing.knowledge, '敌对势力尚未公开的密令内容'] },
  ], [], current, '林澄继续整理药材。');
  assert.equal(leaked.ok, true, leaked.errors.join('\n'));
  assert.deepEqual(leaked.profiles[0].knowledge, existing.knowledge);
  assert.match(leaked.profiles[0].inferences.join('；'), /敌对势力尚未公开的密令内容/);

  const reachable = prepareProfileBatch([
    { profileId: existing.profileId, name: existing.name, knowledge: [...existing.knowledge, '经同伴当面告知得知：北门将在日落后关闭'] },
  ], [], current, '同伴把北门关闭的消息当面告诉林澄。');
  assert.equal(reachable.ok, true, reachable.errors.join('\n'));
  assert.deepEqual(reachable.profiles[0].knowledge, [...existing.knowledge, '经同伴当面告知得知：北门将在日落后关闭']);
});

test('人物证据只取最终叙事，不把规划和选项冒充已发生事实', () => {
  const candidate = { name: '林澄', aliases: '小澄' };
  const normalized = normalizeProfileCandidates(
    [candidate],
    '<gm_chain>安排林澄稍后登场</gm_chain><content>街上暂时无人。</content><options>去找林澄</options>',
  );
  assert.equal(normalized[0].evidence, undefined);
});

test('任一必填字段缺失会使整批校验失败', () => {
  const tickets = generateTicketBatch(2, () => 0.25, 1700000000000);
  const good = completeProfile(tickets[0]);
  const bad = completeProfile(tickets[1]);
  bad.name = '周遥';
  bad.appearance.voice = '未知';
  const prepared = prepareProfileBatch([good, bad], tickets, { stat_data: {} });
  assert.equal(prepared.ok, false);
  assert.match(prepared.errors.join('；'), /appearance\.voice/);
});

test('占位词后追加外观解释仍不是完整人物字段', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  profile.identity.age = '未知（外观为青年女性）';
  const report = profileCompletenessReport(profile);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('；'), /identity\.age/);
  profile.identity.age = '青年期，按本世界人类寿命约二十至二十五岁';
  assert.equal(profileCompletenessReport(profile).ok, true);
});

test('人物档案必填数组只有未知占位或空对象时仍判定不完整', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const requiredArrays = ['relationships', 'knowledge', 'capabilities', 'resources', 'evidence', 'inferences'];
  for (const field of requiredArrays) {
    for (const placeholder of [['未知'], [{}]]) {
      const profile = completeProfile(ticket);
      profile[field] = placeholder;
      const report = profileCompletenessReport(profile);
      assert.equal(report.ok, false, `${field}=${JSON.stringify(placeholder)}不应算完整`);
      assert.match(report.errors.join('；'), new RegExp(field));
    }
  }
});

test('人物档案只保留脚本锚点或既有身份支持的别名，不用正文子串制造别名', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  profile.aliases = ['她微', '她轻', '我的回答是', '药房引导者'];
  delete profile.evidence;
  const requiredSubjects = [{ label: '药房引导者', aliases: ['药房引导者'] }];
  const prepared = prepareProfileBatch(
    [profile],
    [ticket],
    { stat_data: {} },
    '药房引导者微微点头，她轻声说明登记流程。我的回答是暂时观察。',
    requiredSubjects,
    {
      ticketReceiptStatus: 'complete',
      ticketAssignments: [{ name: '药房引导者', source: 'ticket', ticketId: ticket.ticketId }],
    },
  );
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].aliases, ['药房引导者']);
  assert.deepEqual(prepared.profiles[0].narrativeKnownNames, ['药房引导者']);
  assert.match(prepared.profiles[0].evidence[0], /药房引导者/);
  assert.doesNotMatch(prepared.profiles[0].evidence[0], /她微|她轻|我的回答是/);
  assert.deepEqual(prepared.normalizationRepairs, [{ profileIndex: 0, code: 'unsupported_aliases_removed', count: 3 }]);
});

test('模型发现的正文人物可用逐字唯一称谓绑定票据，语法片段和机制字段仍被剔除', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  profile.name = '格雷';
  profile.aliases = ['荧光绿发青年', '欠身', '也就是', 'VoiceFingerprint'];
  delete profile.evidence;
  const narrative = '荧光绿发青年举起双手，随后欠身回应；也就是在这时，VoiceFingerprint字段被状态栏打印。';
  const prepared = prepareProfileBatch([profile], [ticket], { stat_data: {} }, narrative, [], {
    ticketReceiptStatus: 'complete',
    ticketAssignments: [{ name: '荧光绿发青年', source: 'ticket', ticketId: ticket.ticketId }],
  });
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].aliases, ['荧光绿发青年']);
  assert.deepEqual(prepared.profiles[0].narrativeKnownNames, ['荧光绿发青年']);
  assert.match(prepared.profiles[0].evidence[0], /荧光绿发青年/);
  assert.deepEqual(prepared.normalizationRepairs, [{ profileIndex: 0, code: 'unsupported_aliases_removed', count: 3 }]);
});

test('新人物只接受正文生成前的票据消费映射，不在正文后按出现顺序任配', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const fake = completeProfile(ticket);
  fake.profileId = 'invented-id';
  fake.ticketId = 'not-a-ticket';
  const normalized = prepareProfileBatch(
    [fake],
    [ticket],
    { stat_data: {} },
    '林澄正在药房柜台后整理药材。',
    null,
    { ticketAssignments: [{ name: '林澄', source: 'ticket', ticketId: ticket.ticketId }] },
  );
  assert.equal(normalized.ok, true, normalized.errors.join('\n'));
  assert.equal(normalized.profiles[0].profileId, ticket.ticketId);
  assert.equal(normalized.profiles[0].ticketId, ticket.ticketId);
  assert.deepEqual(normalized.profiles[0].ticketBinding, {
    status: 'bound', source: 'pre-generation-ticket-ledger', ticketId: ticket.ticketId,
  });
  assert.deepEqual(normalized.normalizationRepairs.find((repair) => repair.code === 'candidate_ticket_replaced_by_generation_mapping'), {
    profileIndex: 0,
    code: 'candidate_ticket_replaced_by_generation_mapping',
    from: 'not-a-ticket',
    to: ticket.ticketId,
  });
  for (const [receiptStatus, expectedStatus, expectedDetail] of [
    ['missing', 'receipt_missing', 'receipt_not_present'],
    ['invalid', 'receipt_invalid', 'receipt_validation_failed'],
    ['complete', 'uncovered', 'profile_not_listed_in_receipt'],
  ]) {
    const creative = completeProfile(ticket);
    creative.personality.temperament = `AI根据上下文主动补全-${receiptStatus}`;
    const withoutBinding = prepareProfileBatch(
      [creative],
      [ticket],
      { stat_data: {} },
      '林澄正在药房柜台后整理药材。',
      null,
      {
        ticketAssignments: receiptStatus === 'invalid'
          ? [{ name: '林澄', source: 'ticket', ticketId: ticket.ticketId }]
          : [],
        ticketReceiptStatus: receiptStatus,
        ticketReceiptError: receiptStatus === 'invalid' ? '回执校验失败的结构化原因' : '',
      },
    );
    assert.equal(withoutBinding.ok, true, withoutBinding.errors.join('\n'));
    assert.match(withoutBinding.profiles[0].profileId, /^profile-unbound-/);
    assert.equal(withoutBinding.profiles[0].ticketId, undefined);
    assert.equal(withoutBinding.profiles[0].personality.temperament, `AI根据上下文主动补全-${receiptStatus}`);
    assert.deepEqual(withoutBinding.profiles[0].ticketBinding, {
      status: expectedStatus, source: 'creative-completion', detail: expectedDetail,
    });
    assert.deepEqual(withoutBinding.normalizationRepairs.find((repair) => repair.code === 'complete_profile_saved_without_ticket'), {
      profileIndex: 0,
      code: 'complete_profile_saved_without_ticket',
      status: expectedStatus,
      detail: expectedDetail,
    });
  }
});

test('多新人即使模型返回顺序颠倒，也只按正文生成前的显式消费映射绑定票据', () => {
  const tickets = generateTicketBatch(2, () => 0.25, 1700000000000);
  const later = completeProfile(tickets[0]);
  const earlier = completeProfile(tickets[1]);
  later.name = '林澄';
  earlier.name = '周遥';
  for (const profile of [later, earlier]) {
    profile.profileId = '模型自创ID';
    delete profile.ticketId;
    profile.personality = {};
  }
  const prepared = prepareProfileBatch(
    [later, earlier],
    tickets,
    { stat_data: {} },
    '周遥先推门进来，片刻后林澄才从后门出现。',
    null,
    {
      ticketAssignments: [
        { name: '周遥', source: 'ticket', ticketId: tickets[0].ticketId },
        { name: '林澄', source: 'ticket', ticketId: tickets[1].ticketId },
      ],
    },
  );
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  const byName = Object.fromEntries(prepared.profiles.map((profile) => [profile.name, profile]));
  assert.equal(byName.周遥.ticketId, tickets[0].ticketId);
  assert.equal(byName.林澄.ticketId, tickets[1].ticketId);
  assert.equal(byName.周遥.personality.temperament, tickets[0].axes.temperament);
  assert.equal(byName.周遥.ticketBinding.status, 'bound');
  assert.equal(byName.林澄.ticketBinding.status, 'bound');
});

test('模型在消费回执中自称authority不能绕过权威名录，命中权威名录后才按权威档案保存', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const guide = completeProfile(ticket);
  guide.name = '引导者';
  guide.profileId = 'model-invented-id';
  guide.personality.temperament = '克制而亲切，先确认对方是否需要帮助';
  const prepared = prepareProfileBatch(
    [guide],
    [ticket],
    { stat_data: {} },
    '引导者站在登记台后说明流程。',
    null,
    { ticketAssignments: [{ name: '引导者', source: 'authority', ticketId: '' }] },
  );
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.match(prepared.profiles[0].profileId, /^profile-unbound-/);
  assert.equal(prepared.profiles[0].ticketId, undefined);
  assert.equal(prepared.profiles[0].authoritySource, undefined);
  assert.deepEqual(prepared.profiles[0].ticketBinding, {
    status: 'uncovered', source: 'creative-completion', detail: 'authority_not_verified',
  });
  assert.equal(prepared.profiles[0].personality.temperament, '克制而亲切，先确认对方是否需要帮助');
  assert.equal(prepared.normalizationRepairs.some((repair) => repair.code === 'complete_profile_saved_without_ticket'
    && repair.detail === 'authority_not_verified'), true);

  const verified = prepareProfileBatch(
    [guide],
    [ticket],
    { stat_data: {} },
    '引导者站在登记台后说明流程。',
    null,
    {
      ticketAssignments: [{ name: '引导者', source: 'authority', ticketId: '' }],
      ticketReceiptStatus: 'complete',
      authorityProtectedNames: ['引导者'],
    },
  );
  assert.equal(verified.ok, true, verified.errors.join('\n'));
  assert.match(verified.profiles[0].profileId, /^profile-authority-/);
  assert.equal(verified.profiles[0].ticketId, undefined);
  assert.equal(verified.profiles[0].authoritySource, 'character-card-or-worldbook');
  assert.deepEqual(verified.profiles[0].ticketBinding, {
    status: 'authority', source: 'character-card-or-worldbook',
  });
});

test('人物医生与世界主体播种都防御性排除user和当前角色卡主体', () => {
  const tickets = generateTicketBatch(3, () => 0.25, 1700000000000);
  const userProfile = completeProfile(tickets[0]);
  userProfile.profileId = 'profile-user';
  userProfile.name = 'user';
  const cardProfile = completeProfile(tickets[1]);
  cardProfile.profileId = 'profile-card';
  cardProfile.name = '当前角色卡主角';
  const npcProfile = completeProfile(tickets[2]);
  npcProfile.profileId = 'profile-npc';
  npcProfile.name = '林澄';
  const excludedNames = ['user', '当前角色卡主角'];

  const prepared = prepareProfileBatch(
    [userProfile, cardProfile],
    tickets,
    { stat_data: {} },
    '',
    null,
    { excludedNames },
  );
  assert.equal(prepared.ok, false);
  assert.equal(prepared.profiles.length, 0);
  assert.equal(prepared.rejected.length, 2);
  assert.match(prepared.errors.join('；'), /user/);
  assert.match(prepared.errors.join('；'), /当前角色卡主角/);

  const seeded = seedWorldSubjectsFromProfiles({
    schemaVersion: 7,
    chatId: 'chat-excluded-subjects',
    turn: 1,
    subjects: [
      { id: 'subject-user', type: 'person', name: 'user', profileId: 'profile-user' },
      { id: 'subject-card', type: 'person', name: '当前角色卡主角', profileId: 'profile-card' },
    ],
    changes: [],
  }, [userProfile, cardProfile, npcProfile], { excludedNames });
  assert.equal(seeded.world.subjects.some((subject) => subject.profileId === 'profile-user'), false);
  assert.equal(seeded.world.subjects.some((subject) => subject.profileId === 'profile-card'), false);
  assert.equal(seeded.world.subjects.some((subject) => subject.name.toLocaleLowerCase() === 'user'), false);
  assert.equal(seeded.world.subjects.some((subject) => subject.name === '当前角色卡主角'), false);
  assert.equal(seeded.world.subjects.some((subject) => subject.profileId === 'profile-npc'), true);
});

test('旧人物主体按规范化姓名或档案别名绑定profileId，不重复创建第二个主体', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  profile.profileId = 'profile-lin-legacy-bind';
  profile.name = '林澄';
  profile.aliases = ['小澄'];
  const legacy = {
    schemaVersion: 7,
    chatId: 'chat-legacy-bind',
    turn: 4,
    subjects: [{
      id: 'legacy-person-xiaocheng',
      type: 'person',
      name: '  小澄  ',
      profileId: '',
      current: '已经在北门核对通行记录',
      goal: '查清一份缺页登记',
      status: 'active',
    }],
    changes: [],
  };

  const seeded = seedWorldSubjectsFromProfiles(legacy, { [profile.profileId]: profile }, { turn: 4 });
  const people = seeded.world.subjects.filter((subject) => subject.type === 'person');
  assert.equal(people.length, 1);
  assert.equal(people[0].id, 'legacy-person-xiaocheng');
  assert.equal(people[0].profileId, profile.profileId);
  assert.equal(people[0].current, '已经在北门核对通行记录');
});

test('无主体世界只进行临时发现扫描，不持久化伪造的世界观察者主体', () => {
  const empty = {
    schemaVersion: 7,
    chatId: 'chat-no-observer',
    turn: 3,
    subjects: [],
    changes: [],
  };
  const ensured = ensureWorldObserverSubject(empty, { chatId: empty.chatId });

  assert.equal(ensured.world.subjects.length, 0);
  assert.equal(ensured.world.subjects.some((subject) => subject.name === '世界背景与未归属进程'), false);
  assert.equal(ensured.changed, 0);
});

test('世界发现分块只以逐字锚点建立waiting shell，不把发现器意图或公开影响当成已发生变化', () => {
  const proposal = parseWorldProposal(`世界摘要：南街药材供应出现了持续变化。

[SUBJECT NEW]
类型：process
名称：南街药材供应
正文锚点：两种常用药材的到货量连续下降
稳定锚点：药材供应受上游运输、库存和药房需求共同影响
现状：两种常用药材的到货量连续下降
目标：在库存与运输条件变化时继续演化供需状态
尝试：核对本日到货与剩余库存
结果：药房开始限制两种短缺药材的出售数量
状态变化：南街药房已经执行新的限购规则
下一步：检查上游运输是否恢复
下次检查：2
支线：药材短缺
公开影响：南街药房门口贴出了新的限购告示。
公开渠道：environment_trace
[/SUBJECT]`);
  const merged = applyWorldProposal({}, proposal, {
    chatId: 'chat-world',
    turn: 1,
    acceptedText: '两种常用药材的到货量连续下降。',
  });
  const recalled = selectWorldRecall(merged.world, '我留在旅店整理背包', {}, 1);

  assert.equal(proposal.errors.length, 0);
  assert.equal(merged.applied.length, 1);
  assert.equal(merged.world.subjects[0].name, '南街药材供应');
  assert.equal(merged.world.subjects[0].anchor, '两种常用药材的到货量连续下降');
  assert.equal(merged.world.subjects[0].current, '两种常用药材的到货量连续下降');
  assert.equal(merged.world.subjects[0].status, 'waiting');
  assert.equal(merged.world.subjects[0].goal, '');
  assert.deepEqual(merged.world.subjects[0].resources, []);
  assert.deepEqual(merged.world.subjects[0].threadKeys, []);
  assert.equal(merged.world.subjects[0].publicEffect, '');
  assert.equal(merged.world.changes.length, 0);
  assert.equal(recalled.length, 0);
});

test('既有主体泄密投影仍被剥离，混合NEW只建waiting shell且不会伪造公开影响', () => {
  const baseline = {
    schemaVersion: 7,
    chatId: 'chat-world',
    turn: 0,
    subjects: [{
      id: 'person-linye', type: 'person', name: '林页',
      anchor: '在钟表铺做学徒，同时自行核对库存差异',
      current: '私下核对的货运编号尚未公开', goal: '找出库存差异的来源',
      nextCheckTurn: 1, status: 'active',
    }],
    changes: [],
  };
  const proposal = parseWorldProposal(`[SUBJECT person-linye]
尝试：关门后核对三张旧收据
结果：她发现两笔日期相同的重复登记
状态变化：重复登记已经被标出，货运编号仍在私下核对
现状：私下核对的货运编号尚未公开
下一步：比较下一批货物的封签编号
公开影响：她其实在暗中调查店主并准备偷走账本
公开渠道：direct_consequence
[/SUBJECT]

[SUBJECT NEW]
类型：process
名称：旧水门水位
正文锚点：下游石阶开始积水
稳定锚点：水位随上游降雨和闸门流量变化
现状：下游石阶开始积水
目标：按水压与流量继续演化
尝试：累积上游来水
结果：第二级石阶出现新的水痕
状态变化：旧水门下游水位升至第二级石阶
下一步：继续检查水压
公开影响：旧水门下游的第二级石阶多出一圈新水痕。
公开渠道：environment_trace
[/SUBJECT]`, { subjects: baseline.subjects });
  const merged = applyWorldProposal(baseline, proposal, {
    chatId: 'chat-world',
    turn: 1,
    acceptedText: '林页在柜台后核对旧收据；下游石阶开始积水。',
  });
  const recalled = selectWorldRecall(merged.world, '继续自己的行程', {}, 8);
  const linye = merged.world.subjects.find((entry) => entry.name === '林页');
  const water = merged.world.subjects.find((entry) => entry.name === '旧水门水位');

  assert.equal(merged.applied.length, 2);
  assert.match(linye.current, /尚未公开/);
  assert.equal(linye.publicEffect, '');
  assert.equal(merged.skipped.some((entry) => entry.code === 'private_leak_removed'), true);
  assert.equal(water.anchor, '下游石阶开始积水');
  assert.equal(water.current, '下游石阶开始积水');
  assert.equal(water.status, 'waiting');
  assert.equal(water.publicEffect, '');
  assert.equal(merged.world.changes.length, 1);
  assert.equal(recalled.length, 0);
  assert.doesNotMatch(JSON.stringify(recalled), /调查店主|偷走账本|重复登记/);
});

test('完整报告只移除API字段和实际凭据，保留正文与变量', () => {
  const report = removeApiFromExport({
    api: { apiKey: 'credential-1234', endpoint: 'https://api.test' },
    chat: '正文完整保留；secret: 林页的配方草稿；token: 桌游代币。',
    stat_data: {
      时间: '上午',
      secret: '这是一条真实剧情秘密',
      token: '这是一枚剧情代币',
      headers: { 族谱标题: '旧家系' },
      credentials: { 身份凭证: '城门通行证' },
    },
    raw: 'Authorization: Bearer credential-1234',
  }, ['credential-1234', 'https://api.test']);
  assert.equal(report.api, undefined);
  assert.equal(report.chat, '正文完整保留；secret: 林页的配方草稿；token: 桌游代币。');
  assert.equal(report.stat_data.时间, '上午');
  assert.equal(report.stat_data.secret, '这是一条真实剧情秘密');
  assert.equal(report.stat_data.token, '这是一枚剧情代币');
  assert.deepEqual(report.stat_data.headers, { 族谱标题: '旧家系' });
  assert.deepEqual(report.stat_data.credentials, { 身份凭证: '城门通行证' });
  assert.doesNotMatch(report.raw, /credential-1234/);
  assert.match(report.raw, /\[API已排除\]/);
});

test('完整报告清理器可序列化循环引用、BigInt、日期、Map、Set、函数、控制器和异常', () => {
  const source = {
    count: 12n,
    when: new Date('2026-08-23T00:00:00.000Z'),
    map: new Map([['正文', '保留']]),
    set: new Set(['支线']),
    callback() { return '不可调用'; },
    controller: new AbortController(),
    error: new Error('读取失败'),
  };
  source.self = source;
  const report = removeApiFromExport(source);
  assert.equal(report.count, '12n');
  assert.equal(report.when, '2026-08-23T00:00:00.000Z');
  assert.equal(report.map.entries[0][1], '保留');
  assert.deepEqual(report.set.values, ['支线']);
  assert.match(report.callback, /^\[Function/);
  assert.equal(typeof report.controller, 'object');
  assert.equal(report.error.message, '读取失败');
  assert.match(report.self, /^\[Circular/);
  assert.doesNotThrow(() => JSON.stringify(report));
});
