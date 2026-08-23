import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfilePatch,
  chatCompletionText,
  diagnosticAdvice,
  generateTicketBatch,
  openAiChatEndpoint,
  openAiModelsEndpoint,
  mergeProfileRootDirect,
  mergeProfileCandidates,
  mergeUpdateVariableBlocks,
  normalizeProfileCandidates,
  parseProfileReceipt,
  parseUpdateVariableBlock,
  applyWorldProposal,
  parseWorldProposal,
  prepareProfileBatch,
  profileCompletionContract,
  profileNarrativeText,
  redactDiagnostic,
  removeApiFromExport,
  selectWorldRecall,
  statDataOf,
  validatePatchOperations,
  verifyCommittedProfiles,
  verifyPatchOperations,
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
    knowledge: ['熟悉常见药材和南街居民'], capabilities: ['能够辨认与调配常见药剂'], resources: ['可使用药房工具和基础库存'],
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
});

test('变量医生解析无限回廊UpdateVariable并把原更新与纠错合并', () => {
  const original = '<UpdateVariable><JSONPatch>[{"op":"delta","path":"/契约者/经济/UP","value":10}]</JSONPatch></UpdateVariable>';
  const correction = '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/当前时间/地点","value":"回廊大厅"}]</JSONPatch></UpdateVariable>';
  assert.equal(parseUpdateVariableBlock(original).ok, true);
  const merged = mergeUpdateVariableBlocks(`正文\n${original}`, correction);
  assert.equal(merged.ok, true);
  assert.equal(parseUpdateVariableBlock(merged.message).operations.length, 2);
  assert.equal((merged.message.match(/<UpdateVariable/g) || []).length, 1);
});

test('变量纠错在交给MVU前拒绝不存在路径与复杂节点整块覆盖', () => {
  const state = { stat_data: { 契约者: { 经济: { UP: 10 }, 背包: {} } } };
  const valid = validatePatchOperations(state, [{ op: 'delta', path: '/契约者/经济/UP', value: 5 }]);
  assert.equal(valid.ok, true);
  assert.equal(valid.expected.契约者.经济.UP, 15);
  assert.equal(verifyPatchOperations({ stat_data: valid.expected }, valid), true);
  assert.equal(validatePatchOperations(state, [{ op: 'replace', path: '/契约者/不存在', value: 1 }]).ok, false);
  assert.equal(validatePatchOperations(state, [{ op: 'replace', path: '/契约者/经济', value: {} }]).ok, false);
  const move = parseUpdateVariableBlock('<UpdateVariable><JSONPatch>[{"op":"move","from":"/契约者/经济/UP","to":"/契约者/经济/余额"}]</JSONPatch></UpdateVariable>');
  assert.equal(move.ok, true);
});

test('独立API端点归一化、响应提取与诊断脱敏', () => {
  assert.equal(openAiChatEndpoint('https://example.com/v1'), 'https://example.com/v1/chat/completions');
  assert.equal(openAiChatEndpoint('https://example.com/v1/chat/completions'), 'https://example.com/v1/chat/completions');
  assert.equal(openAiModelsEndpoint('https://example.com/v1'), 'https://example.com/v1/models');
  assert.equal(chatCompletionText({ choices: [{ message: { content: 'OK' } }] }), 'OK');
  assert.match(redactDiagnostic('Authorization: Bearer sk-example-secret-123456'), /已隐藏/);
  assert.doesNotMatch(redactDiagnostic('Authorization: Bearer sk-example-secret-123456'), /secret/);
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

test('完整新档案绑定同一票据并编译为单根原子补丁', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const current = { stat_data: { 时间: '上午' } };
  const prepared = prepareProfileBatch([completeProfile(ticket)], [ticket], current);
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

test('合法的单字物种与性别不会被误判为空字段', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  profile.identity.species = '人';
  profile.identity.gender = '女';
  const prepared = prepareProfileBatch([profile], [ticket], { stat_data: {} });
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
});

test('权威人物设定覆盖冲突骰轴，骰票只补尚未给出的轴', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const profile = completeProfile(ticket);
  profile.personality = { temperament: '角色卡明确设定为热情直率' };
  const prepared = prepareProfileBatch([profile], [ticket], { stat_data: {} });
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.equal(prepared.profiles[0].personality.temperament, '角色卡明确设定为热情直率');
  assert.equal(prepared.profiles[0].personality.coreDesire, ticket.axes.coreDesire);
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
  const prepared = prepareProfileBatch(merged, [ticket], { stat_data: {} }, '林澄正在药房柜台后整理新送到的药材。');
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].relationships, firstCandidate.relationships);
  assert.match(prepared.profiles[0].inferences[0], /‘草稿’/);
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

test('新人自创ID或漏票据时按正文首次出现顺序绑定骰票，仍禁止复用票据', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const fake = completeProfile(ticket);
  fake.profileId = 'invented-id';
  fake.ticketId = 'not-a-ticket';
  const normalized = prepareProfileBatch([fake], [ticket], { stat_data: {} }, '林澄正在药房柜台后整理药材。');
  assert.equal(normalized.ok, true, normalized.errors.join('\n'));
  assert.equal(normalized.profiles[0].profileId, ticket.ticketId);
  assert.equal(normalized.profiles[0].ticketId, ticket.ticketId);
  const first = completeProfile(ticket);
  const second = completeProfile(ticket);
  second.name = '周遥';
  second.profileId = 'second-id';
  assert.match(prepareProfileBatch([first, second], [ticket], { stat_data: {} }).errors.join('；'), /重复使用/);
});

test('多新人即使模型返回顺序颠倒，也按最终正文首次出现次序依次绑定骰票', () => {
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
  );
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  const byName = Object.fromEntries(prepared.profiles.map((profile) => [profile.name, profile]));
  assert.equal(byName.周遥.ticketId, tickets[0].ticketId);
  assert.equal(byName.林澄.ticketId, tickets[1].ticketId);
  assert.equal(byName.周遥.personality.temperament, tickets[0].axes.temperament);
});

test('世界引擎JSON归一化且召回当前相关人物', () => {
  const proposal = parseWorldProposal(`\`\`\`json
  {"summary":"南街出现药材短缺。","branches":[{"id":"b1","title":"药材短缺","actor":"林澄","location":"南街","keywords":["药房"],"status":"active","intent":"调查货源"},{"id":"b2","title":"北港修船","actor":"赵石","location":"北港","status":"waiting"}],"npcIntents":[],"agreements":[],"hostilePlans":[]}
  \`\`\``);
  const world = applyWorldProposal({}, proposal, { chatId: 'chat-world', turn: 1 });
  const recalled = selectWorldRecall(world, '我去南街药房找林澄', {}, 1);
  assert.equal(recalled.length, 1);
  assert.equal(recalled[0].id, 'b1');
  assert.equal(recalled[0].stage, 'advancing');
});

test('世界引擎可修复裸键、单引号、缺逗号和尾逗号', () => {
  const proposal = parseWorldProposal("{summary:'继续推进', branches:[{id:'b1', title:'线索'}] npcIntents:[], agreements:[], hostilePlans:[],}");
  assert.equal(proposal.summary, '继续推进');
  assert.equal(proposal.threads[0].id, 'b1');
});

test('完整报告只移除API字段和实际凭据，保留正文与变量', () => {
  const report = removeApiFromExport({ api: { apiKey: 'secret-1234', endpoint: 'https://api.test' }, chat: '正文完整保留', stat_data: { 时间: '上午' }, raw: 'Bearer secret-1234' }, ['secret-1234']);
  assert.equal(report.api, undefined);
  assert.equal(report.chat, '正文完整保留');
  assert.equal(report.stat_data.时间, '上午');
  assert.doesNotMatch(report.raw, /secret-1234/);
});

test('完整报告清理器可序列化循环引用、BigInt、日期、Map、Set和异常', () => {
  const source = { count: 12n, when: new Date('2026-08-23T00:00:00.000Z'), map: new Map([['正文', '保留']]), set: new Set(['支线']), error: new Error('读取失败') };
  source.self = source;
  const report = removeApiFromExport(source);
  assert.equal(report.count, '12n');
  assert.equal(report.when, '2026-08-23T00:00:00.000Z');
  assert.equal(report.map.entries[0][1], '保留');
  assert.deepEqual(report.set.values, ['支线']);
  assert.equal(report.error.message, '读取失败');
  assert.match(report.self, /^\[Circular/);
  assert.doesNotThrow(() => JSON.stringify(report));
});
