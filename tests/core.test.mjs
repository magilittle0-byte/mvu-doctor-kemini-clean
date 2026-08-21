import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfilePatch,
  generateTicketBatch,
  parseProfileReceipt,
  parseWorldState,
  prepareProfileBatch,
  selectWorldRecall,
  statDataOf,
  verifyCommittedProfiles,
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
