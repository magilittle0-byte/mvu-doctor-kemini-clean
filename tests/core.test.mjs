import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessOriginalMvuReplay,
  assessVariableBaseline,
  assessVariableWriteAuthority,
  buildUpdateVariableBlock,
  buildProfilePatch,
  buildVariableAuditChecklist,
  capturePathSnapshot,
  chatCompletionText,
  diagnosticAdvice,
  discoverProfileSubjects,
  generateTicketBatch,
  openAiChatEndpoint,
  openAiModelsEndpoint,
  mergeProfileRootDirect,
  mergeProfileCandidates,
  mergeUpdateVariableBlocks,
  normalizeVariableOperations,
  normalizeProfileCandidates,
  parseProfileReceipt,
  parseUpdateVariableBlock,
  partitionVariableOperationsByApplication,
  applyWorldProposal,
  parseWorldProposal,
  prepareProfileBatch,
  profileCompletenessReport,
  profileCompletionContract,
  profileNarrativeText,
  redactDiagnostic,
  restorePathSnapshot,
  restoreTouchedData,
  removeApiFromExport,
  repairAcceptedNarrativeEnvelope,
  selectWorldRecall,
  semanticJsonEqual,
  statDataOf,
  validatePatchOperations,
  validateVariableAuditAnalysis,
  validateProfileSubjectCoverage,
  verifyCommittedProfiles,
  verifyPatchOperations,
  verifyPatchApplication,
  verifyPathSnapshot,
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
    '<gm_chain>让黑衣人下回合登场</gm_chain><content>白露低声说道：“先等等。”\n独眼守卫：谁在那里？\n当前环境：雨势渐大。少女点头后退。</content><options>询问黑衣人</options>',
    {
      excludedNames: ['白露'],
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
  const narrative = profileNarrativeText('<div class="narrative">白露：记录先放在这里。</div>');
  assert.match(narrative, /白露：记录先放在这里/);
  assert.deepEqual(discoverProfileSubjects(narrative), []);
});

test('人物发现器只把显式结构ID作为机械锚点，不把英文标签、统计缩写或散文主语当人物', () => {
  const subjects = discoverProfileSubjects('Alice: Wait here.\nNPC-7点头回应。\n白露微笑着收起纸笔。\nHP: 12\nSTR说道：这不该成为人物。');
  assert.deepEqual(subjects.map((subject) => subject.label), ['NPC-7']);
});

test('人物观察剥离Izumi的htmlcontent与隐藏摘要，但保留其后的真实正文', () => {
  const source = `<content>
<htmlcontent><div class="status-panel">白露：状态卡说明。</div></htmlcontent>
<span style="display: none;">HTML内容简述：展示玩家初始面板和选项。</span>
<span hidden>隐藏标签：不属于正文。</span>
<span aria-hidden="true">辅助说明：不属于正文。</span>
<span style='visibility : hidden'>折叠说明：不属于正文。</span>
林澄推开药房的门，对柜台后的来客点了点头。
</content>`;
  const narrative = profileNarrativeText(source);
  assert.doesNotMatch(narrative, /白露：状态卡说明|HTML内容简述|隐藏标签|辅助说明|折叠说明/);
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

test('变量医生解析无限回廊UpdateVariable并把原更新与纠错合并', () => {
  const original = '<UpdateVariable><JSONPatch>[{"op":"delta","path":"/契约者/经济/UP","value":10}]</JSONPatch></UpdateVariable>';
  const correction = '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/当前时间/地点","value":"回廊大厅"}]</JSONPatch></UpdateVariable>';
  assert.equal(parseUpdateVariableBlock(original).ok, true);
  const merged = mergeUpdateVariableBlocks(`正文\n${original}`, correction);
  assert.equal(merged.ok, true);
  assert.equal(parseUpdateVariableBlock(merged.message).operations.length, 2);
  assert.equal((merged.message.match(/<UpdateVariable/g) || []).length, 1);
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

test('变量医生从角色卡权威规则拒绝脚本托管字段但保留可直写字段', () => {
  const state = { stat_data: { 契约者: { 衍生属性: { HP_当前: 105, HP_最大: 105, 防御: 3, 负重_当前: 0, 负重_上限: 30 }, 经济: { UP: 0 } }, 当前敌人: { 守卫: { 衍生属性: { 防御: 6 } } } } };
  const rules = `契约者.衍生属性:\n- 【完全禁止修改】HP_最大、防御、负重_上限等所有计算结果均由前端自动完成。\n契约者.经济:\n- UP在获得或支付时允许直接修改。`;
  const authority = assessVariableWriteAuthority(state, rules, [
    { op: 'replace', path: '/契约者/衍生属性/HP_最大', value: 120 },
    { op: 'replace', path: '/契约者/衍生属性/HP_当前', value: 90 },
    { op: 'delta', path: '/契约者/经济/UP', value: 5 },
    { op: 'replace', path: '/当前敌人/守卫/衍生属性/防御', value: 7 },
  ]);
  assert.equal(authority.ok, false);
  assert.deepEqual(authority.allowedOperations.map((item) => item.path), ['/契约者/衍生属性/HP_当前', '/契约者/经济/UP', '/当前敌人/守卫/衍生属性/防御']);
  assert.deepEqual(authority.rejectedOperations.map((item) => item.operation.path), ['/契约者/衍生属性/HP_最大']);
  assert.ok(authority.hostManagedPaths.includes('/契约者/衍生属性/HP_最大'));
  assert.ok(authority.hostManagedPaths.includes('/契约者/衍生属性/防御'));
  assert.ok(authority.hostManagedPaths.includes('/契约者/衍生属性/负重_上限'));
  assert.ok(!authority.hostManagedPaths.includes('/契约者/衍生属性/HP_当前'));
});

test('真实MVU静默拒绝一个目标时可分离拒绝项而保留已落地修复', () => {
  const operations = [
    { op: 'replace', path: '/当前时间/地点', value: '回廊大厅' },
    { op: 'replace', path: '/契约者/衍生属性/负重_当前', value: 3 },
  ];
  const partition = partitionVariableOperationsByApplication(operations, {
    targetErrors: [{ path: '/契约者/衍生属性/负重_当前', message: '目标路径未按预期落地' }],
  });
  assert.deepEqual(partition.accepted.map((item) => item.path), ['/当前时间/地点']);
  assert.deepEqual(partition.rejected.map((item) => item.operation.path), ['/契约者/衍生属性/负重_当前']);
});

test('变量操作在脚本侧确定性修复常见MVU写法而不猜不存在路径', () => {
  const currentData = { stat_data: { 契约者: { 经济: { UP: [10, '通用点数'] }, 背包: { 旧物: '钥匙' } } } };
  const normalized = normalizeVariableOperations(currentData, [
    { op: 'set', path: '/stat_data/契约者/经济/UP/', value: [12, '通用点数'] },
    { op: 'delta', path: '/契约者/经济/UP', value: '3' },
    { op: 'move', from: '/契约者/背包/旧物', to: '/契约者/背包/钥匙' },
  ]);
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.operations, [
    { op: 'replace', path: '/契约者/经济/UP', value: 12 },
    { op: 'delta', path: '/契约者/经济/UP', value: 3 },
    { op: 'insert', path: '/契约者/背包/钥匙', value: '钥匙' },
    { op: 'remove', path: '/契约者/背包/旧物' },
  ]);
  assert.equal(normalizeVariableOperations(currentData, [{ op: 'replace', path: '/完全不存在', value: 1 }]).operations[0].path, '/完全不存在');
});

test('变量基线用真实前后状态识别死区块与已落地原更新', () => {
  const previousData = { stat_data: { 玩家: { 金钱: 10 } } };
  const unchanged = { stat_data: { 玩家: { 金钱: 10 } } };
  const suspicious = assessVariableBaseline({ narrative: '支付了三枚金币。', previousData, currentData: unchanged, original: { ok: false, error: '缺少区块' } });
  assert.equal(suspicious.requiresCorrection, true);
  const original = parseUpdateVariableBlock('<UpdateVariable><JSONPatch>[{"op":"delta","path":"/玩家/金钱","value":-3}]</JSONPatch></UpdateVariable>');
  const reflected = assessVariableBaseline({ narrative: '支付了三枚金币。', previousData, currentData: { stat_data: { 玩家: { 金钱: 7 } } }, original });
  assert.equal(reflected.code, 'original_patch_reflected');
  assert.equal(reflected.requiresCorrection, false);
});

test('变量基线服从真实MVU重放而不是JSONPatch字面值', () => {
  const previousData = {
    stat_data: {
      契约者: {
        基础属性: { 体质: 10, 敏捷: 12, 力量: 10 },
        衍生属性: { MP_最大: 100, 防御: 3, 闪避: 12, 负重_上限: 30 },
      },
    },
  };
  const original = parseUpdateVariableBlock('<UpdateVariable><JSONPatch>[{"op":"replace","path":"/契约者/基础属性/体质","value":11},{"op":"replace","path":"/契约者/衍生属性/MP_最大","value":100},{"op":"replace","path":"/契约者/衍生属性/防御","value":3},{"op":"replace","path":"/契约者/衍生属性/闪避","value":12},{"op":"replace","path":"/契约者/衍生属性/负重_上限","value":30}]</JSONPatch></UpdateVariable>');
  const officialReplay = {
    stat_data: {
      契约者: {
        基础属性: { 体质: 11, 敏捷: 12, 力量: 10 },
        衍生属性: { MP_最大: 110, 防御: 4, 闪避: 13, 负重_上限: 55 },
      },
    },
  };
  const receipt = assessOriginalMvuReplay({
    currentData: structuredClone(officialReplay),
    firstReplayData: structuredClone(officialReplay),
    secondReplayData: structuredClone(officialReplay),
  });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.deterministic, true);
  assert.equal(receipt.reflected, true);
  const baseline = assessVariableBaseline({
    narrative: '基础属性已经建立，衍生属性由前端公式计算。',
    previousData,
    currentData: officialReplay,
    original,
    originalReplay: receipt,
  });
  assert.equal(baseline.code, 'original_patch_reflected_by_real_mvu');
  assert.equal(baseline.requiresCorrection, false);
});

test('真实MVU重放缺失、报错、不确定或与当前状态不一致时保持失败关闭', () => {
  const currentData = { stat_data: { 玩家: { 金钱: 7 } } };
  const replayed = { stat_data: { 玩家: { 金钱: 7 } } };
  const changedReplay = { stat_data: { 玩家: { 金钱: 6 } } };
  assert.equal(assessOriginalMvuReplay({ currentData }).code, 'real_mvu_replay_missing');
  assert.equal(assessOriginalMvuReplay({ currentData, error: 'schema rejected' }).code, 'real_mvu_replay_failed');
  assert.equal(assessOriginalMvuReplay({ currentData, firstReplayData: replayed, secondReplayData: changedReplay }).code, 'real_mvu_replay_nondeterministic');
  assert.equal(assessOriginalMvuReplay({ currentData, firstReplayData: changedReplay, secondReplayData: changedReplay }).code, 'real_mvu_replay_not_reflected');
});

test('空补丁审计拒绝提示词模板和无证据套话，只接受具体核验依据', () => {
  assert.equal(validateVariableAuditAnalysis('正文事实、当前值、应有值的简洁对照；没有修复时说明为什么当前状态已经闭合', { emptyPatch: true }).ok, false);
  assert.equal(validateVariableAuditAnalysis('逐项核对后无需修复。', { emptyPatch: true }).ok, false);
  assert.equal(validateVariableAuditAnalysis('真实状态差异为0，原变量块31项均已落地。', { emptyPatch: true }).ok, false);
  assert.equal(validateVariableAuditAnalysis('原变量块31项经真实MVU重放后与当前stat_data一致；/契约者/衍生属性/防御由前端公式归一化，无需追加修复。', { emptyPatch: true }).ok, true);
  assert.equal(validateVariableAuditAnalysis('修复 /玩家/金钱 到正文裁决后的7。', { emptyPatch: false }).ok, true);
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
  const described = { stat_data: { 契约者: { 经济: { UP: [10, '通用点数'] } } } };
  const vwd = validatePatchOperations(described, [{ op: 'delta', path: '/契约者/经济/UP', value: 2 }]);
  assert.equal(vwd.ok, true);
  assert.deepEqual(vwd.expected.契约者.经济.UP, [12, '通用点数']);
});

test('变量补丁必须拒绝目标外旁路变化，回滚只恢复本事务触碰路径', () => {
  const state = { stat_data: { 玩家: { 生命: 10, 金钱: 5 }, 世界时钟: 7 } };
  const validation = validatePatchOperations(state, [{ op: 'delta', path: '/玩家/生命', value: -2 }]);
  assert.equal(validation.ok, true);
  const contaminated = structuredClone(validation.expected);
  contaminated.世界时钟 = 99;
  const application = verifyPatchApplication({ stat_data: contaminated }, validation);
  assert.equal(application.ok, false);
  assert.match(application.errors.join('；'), /补丁外路径/);
  const liveAfterOtherWork = { stat_data: { 玩家: { 生命: 8, 金钱: 12 }, 世界时钟: 8 } };
  const restored = restoreTouchedData(liveAfterOtherWork, state, validation.rollbackPaths);
  assert.equal(restored.ok, true);
  assert.equal(restored.data.stat_data.玩家.生命, 10);
  assert.equal(restored.data.stat_data.玩家.金钱, 12);
  assert.equal(restored.data.stat_data.世界时钟, 8);
  const snapshot = capturePathSnapshot(state, validation.rollbackPaths);
  const restoredAgain = restorePathSnapshot(liveAfterOtherWork, snapshot);
  assert.equal(verifyPathSnapshot(restoredAgain.data, snapshot), true);
});

test('MVU只调整对象键顺序时仍视为同一结构，数组顺序仍必须一致', () => {
  const state = { stat_data: { 契约者: { 背包: {} } } };
  const operation = {
    op: 'insert',
    path: '/契约者/背包/测试物品',
    value: { 名称: '测试物品', 类型: '武器', 数量: 1, 效果: { 被动: '无', 主动: '无' } },
  };
  const validation = validatePatchOperations(state, [operation]);
  assert.equal(validation.ok, true);
  const hostNormalized = {
    stat_data: {
      契约者: {
        背包: {
          测试物品: { 效果: { 主动: '无', 被动: '无' }, 数量: 1, 类型: '武器', 名称: '测试物品' },
        },
      },
    },
  };
  assert.equal(semanticJsonEqual(operation.value, hostNormalized.stat_data.契约者.背包.测试物品), true);
  assert.equal(verifyPatchOperations(hostNormalized, validation), true);
  assert.equal(verifyPatchApplication(hostNormalized, validation).ok, true);
  assert.equal(semanticJsonEqual([1, 2], [2, 1]), false);
});

test('当前角色卡存在Schema时拒绝Schema外insert，不把数据对象存在误判为可写', () => {
  const state = {
    stat_data: { 契约者: { 事件簿: {} } },
    schema: {
      type: 'object', extensible: false, properties: {
        契约者: { type: 'object', extensible: false, properties: {} },
      },
    },
  };
  const validation = validatePatchOperations(state, [{ op: 'insert', path: '/契约者/事件簿/新记录', value: { 结果: '已发生' } }]);
  assert.equal(validation.ok, false);
  assert.equal(validation.code, 'schema_incompatible');
  assert.match(validation.error, /Schema/);
});

test('Schema明确允许扩展的对象仍可执行insert并通过目标读回', () => {
  const state = {
    stat_data: { 契约者: { 事件簿: {} } },
    schema: {
      type: 'object', extensible: false, properties: {
        契约者: { type: 'object', extensible: false, properties: {
          事件簿: { type: 'object', extensible: true, properties: {} },
        } },
      },
    },
  };
  const validation = validatePatchOperations(state, [{ op: 'insert', path: '/契约者/事件簿/新记录', value: { 结果: '已发生' } }]);
  assert.equal(validation.ok, true, validation.error);
  assert.equal(verifyPatchOperations({ stat_data: validation.expected }, validation), true);
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
  merged[0].narrativeKnownNames = ['模型自行声称已公开的隐藏姓名'];
  const prepared = prepareProfileBatch(merged, [ticket], { stat_data: {} }, '林澄正在药房柜台后整理新送到的药材。');
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].relationships, firstCandidate.relationships);
  assert.deepEqual(prepared.profiles[0].narrativeKnownNames, ['林澄']);
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
  const prepared = prepareProfileBatch([profile], [ticket], { stat_data: {} }, narrative, []);
  assert.equal(prepared.ok, true, prepared.errors.join('\n'));
  assert.deepEqual(prepared.profiles[0].aliases, ['荧光绿发青年']);
  assert.deepEqual(prepared.profiles[0].narrativeKnownNames, ['荧光绿发青年']);
  assert.match(prepared.profiles[0].evidence[0], /荧光绿发青年/);
  assert.deepEqual(prepared.normalizationRepairs, [{ profileIndex: 0, code: 'unsupported_aliases_removed', count: 3 }]);
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
  {"summary":"南街出现药材短缺。","threads":[{"id":"b1","title":"药材短缺","actorIds":["林澄"],"locations":["南街"],"keywords":["药房"],"stage":"advancing","summary":"林澄暗中调查货源","publicTitle":"南街药房的限购","publicSurface":"南街药房门口贴出了限购告示。","knowledge":"hidden"},{"id":"b2","title":"北港修船","actorIds":["赵石"],"locations":["北港"],"stage":"dormant","summary":"船工等待木料","knowledge":"hidden"}]}
  \`\`\``);
  const world = applyWorldProposal({}, proposal, { chatId: 'chat-world', turn: 1 });
  const recalled = selectWorldRecall(world, '我去南街药房找林澄', {}, 1);
  assert.equal(recalled.length, 1);
  assert.equal(recalled[0].recordType, 'sensory_surface');
  assert.equal(recalled[0].publicSurface, '南街药房门口贴出了限购告示。');
  assert.equal('id' in recalled[0], false);
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
