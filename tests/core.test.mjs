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
  mergeUpdateVariableBlocks,
  parseProfileReceipt,
  parseUpdateVariableBlock,
  parseWorldState,
  prepareProfileBatch,
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

test('新人物不能伪造profileId绕过票据，也不能复用同一票据', () => {
  const [ticket] = generateTicketBatch(1, () => 0.25, 1700000000000);
  const fake = completeProfile(ticket);
  fake.profileId = 'invented-id';
  fake.ticketId = 'not-a-ticket';
  assert.equal(prepareProfileBatch([fake], [ticket], { stat_data: {} }).ok, false);
  const first = completeProfile(ticket);
  const second = completeProfile(ticket);
  second.name = '周遥';
  second.profileId = 'second-id';
  assert.match(prepareProfileBatch([first, second], [ticket], { stat_data: {} }).errors.join('；'), /重复使用/);
});

test('世界引擎JSON归一化且召回当前相关人物', () => {
  const world = parseWorldState(`\`\`\`json
  {"summary":"南街出现药材短缺。","branches":[{"id":"b1","title":"药材短缺","actor":"林澄","location":"南街","keywords":["药房"],"status":"active","intent":"调查货源"},{"id":"b2","title":"北港修船","actor":"赵石","location":"北港","status":"waiting"}],"npcIntents":[],"agreements":[],"hostilePlans":[]}
  \`\`\``);
  const recalled = selectWorldRecall(world, '我去南街药房找林澄', {}, 1);
  assert.equal(recalled.length, 1);
  assert.equal(recalled[0].id, 'b1');
  assert.equal(recalled[0].status, 'active');
});

test('世界引擎可修复裸键、单引号、缺逗号和尾逗号', () => {
  const world = parseWorldState("{summary:'继续推进', branches:[{id:'b1', title:'线索'}] npcIntents:[], agreements:[], hostilePlans:[],}");
  assert.equal(world.summary, '继续推进');
  assert.equal(world.branches[0].id, 'b1');
});

test('完整报告只移除API字段和实际凭据，保留正文与变量', () => {
  const report = removeApiFromExport({ api: { apiKey: 'secret-1234', endpoint: 'https://api.test' }, chat: '正文完整保留', stat_data: { 时间: '上午' }, raw: 'Bearer secret-1234' }, ['secret-1234']);
  assert.equal(report.api, undefined);
  assert.equal(report.chat, '正文完整保留');
  assert.equal(report.stat_data.时间, '上午');
  assert.doesNotMatch(report.raw, /secret-1234/);
});
