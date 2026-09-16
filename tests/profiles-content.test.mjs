import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonResponse, PROFILE_FIELDS, validateProfile, parseDiscovery, discoveryPrompt, profilePrompt,
  profileBatchPrompt, parseProfileBatch } from '../profiles/content.mjs';

function validProfile(overrides = {}) {
  const p = { profileId: 'p-1', rowId: 'r-1', name: '林', identity: {}, appearance: {}, personality: {}, currentState: {}, aliases: [], relationships: ['同伴'], knowledge: ['常识'], capabilities: ['观察'], resources: ['零钱'], evidence: ['正文片段'], inferences: ['未明背景'], uncertainties: ['不知他人真实动机'], history: '曾迁居', ...overrides };
  for (const f of PROFILE_FIELDS) {
    if (f.path === 'name' || f.path === 'history') continue;
    const keys = f.path.split('.'); let o = p;
    for (const k of keys.slice(0, -1)) o = o[k] ||= {};
    if (o[keys.at(-1)] === undefined) o[keys.at(-1)] = f.type === 'list' ? ['在港口工作期间留下的可核对记录'] : `合成NPC的${f.label}已由场景资料确定`;
  }
  return p;
}

test('parseJsonResponse preserves tolerant legacy parsing', () => {
  const value = parseJsonResponse('```json\n<人物档案>{“profiles”:[{“name”:“甲”,}],}</人物档案>\n```');
  assert.equal(value.profiles[0].name, '甲');
});

test('PROFILE_FIELDS retains old fields and added fields', () => {
  assert.equal(PROFILE_FIELDS.filter((f) => f.type === 'text').length, 36);
  assert.equal(PROFILE_FIELDS.filter((f) => f.type === 'list').length, 8);
  for (const path of ['appearance.outfit', 'personality.hobbies', 'personality.biases', 'currentState.presence', 'uncertainties']) assert.ok(PROFILE_FIELDS.some((f) => f.path === path));
});

test('validateProfile reports missing fields and excludes player identity', () => {
  const errors = validateProfile(validProfile({ name: '玩家' }), ['玩家']);
  assert.ok(errors.some((e) => e.includes('玩家身份')));
  assert.ok(validateProfile(validProfile({ name: '主角' }), []).some((e) => e.includes('玩家身份')));
  assert.ok(validateProfile(validProfile({ appearance: { ...validProfile().appearance, outfit: '' } })).some((e) => e.includes('appearance.outfit')));
});

test('discovery binds only literal narrative evidence and permits same name different IDs', () => {
  const input = { narrative: '林走进门。林被提及过。', profiles: [{ profileId: 'known', name: '林' }], players: ['玩家'] };
  assert.throws(() => parseDiscovery('{"people":[{"sourceName":"林","evidence":"林走进门。","existingProfileId":"missing","presence":"present"}]}', input), (error) => error.code === 'discovery_existing_profile_id_invalid' && error.recoverable === true);
  for (const invalidId of ['unknown', '', {}]) {
    const raw = JSON.stringify({ people: [{ sourceName: '林', evidence: '林走进门。', existingProfileId: invalidId, presence: 'present' }] });
    assert.throws(() => parseDiscovery(raw, input), (error) => error.code === 'discovery_existing_profile_id_invalid' && error.recoverable === true);
  }
  const parsed = parseDiscovery('{"people":[{"sourceName":"林","evidence":"林走进门。","existingProfileId":null,"presence":"present"},{"sourceName":"林","evidence":"林被提及过。","existingProfileId":"known","presence":"mentioned"}]}', input);
  assert.equal(parsed.people.length, 2);
  assert.equal(parsed.people[0].existingProfileId, null);
  assert.equal(parsed.people[1].existingProfileId, 'known');
  assert.throws(() => parseDiscovery('{"people":[{"sourceName":"林","evidence":"林走进门。","existingProfileId":"known","presence":"present"},{"sourceName":"林","evidence":"林被提及过。","existingProfileId":"known","presence":"mentioned"}]}', input), (error) => error.code === 'discovery_existing_profile_id_duplicate' && error.recoverable === true);
});

test('discovery is fail-closed for shape, evidence, presence, players, and empty reason', () => {
  const input = { narrative: '林走进门。玩家在场。', players: ['玩家'], profiles: [] };
  const cases = [
    ['{}', 'discovery_people_invalid'],
    ['{"people":[]}', 'discovery_empty_reason_invalid'],
    ['{"people":[],"noCharacterReason":"本轮没有非玩家人物"}', null],
    ['{"people":[{"sourceName":"林","evidence":"窗外无人","presence":"present"}]}', 'discovery_evidence_unbound'],
    ['{"people":[{"sourceName":"林","evidence":"林走进门。","presence":"x"}]}', 'discovery_presence_invalid'],
    ['{"people":[{"sourceName":"玩家","evidence":"玩家","presence":"present"}]}', 'discovery_player_forbidden'],
    ['{"people":[{"sourceName":"林","evidence":"林走进门。","presence":"present"},{"sourceName":"林","evidence":"林走进门。","presence":"present"}]}', 'discovery_duplicate'],
  ];
  for (const [raw, code] of cases) {
    if (!code) assert.deepEqual(parseDiscovery(raw, input).people, []);
    else assert.throws(() => parseDiscovery(raw, input), (error) => error.code === code && error.recoverable === true);
  }
});

test('prompts preserve ordinary narrative and repair contract', () => {
  const input = { narrative: '普通正文材料', mvu: { state: 'fresh' }, authority: { card: '权威卡片', world: '世界设定' }, profiles: [] };
  assert.match(discoveryPrompt(input), /普通正文材料/);
  const prompt = profilePrompt(input, { rowId: 'r-1', profileId: 'p-1', sourceName: '林', evidence: '普通正文材料', presence: 'present' }, null, { raw: '{坏}', errors: ['缺少history'] });
  assert.match(prompt, /普通正文材料/);
  assert.match(prompt, /缺少history/);
  assert.match(prompt, /rowId/);
  assert.match(prompt, /"appearance"/);
  assert.match(prompt, /利益取向/);
  assert.match(prompt, /弱点与自我欺骗/);
  assert.match(prompt, /选项、规划或示例不算实际登场或既成动作/);
  assert.match(prompt, /没有新依据时保持不变/);
});

test('automatic discovery prompt matches frozen original bytes; feedback permits correction', () => {
  const input = { narrative: '甲走进门。乙站在门外。', userText: '继续', mvu: {}, authority: {}, players: ['玩家'], profiles: [] };
  const automatic = discoveryPrompt(input);
  assert.equal(Buffer.byteLength(automatic, 'utf8'), 894);
  assert.equal(automatic.length, 556);
  assert.equal(createHash('sha256').update(Buffer.from(automatic, 'utf8')).digest('hex'), '87d9b73aa3e4e4c10e5bf593983337e330771df24288900f67f9814c7ad63207');
  const feedback = discoveryPrompt(input, { previousValidResult: {
    people: [{ sourceName: '甲', evidence: '甲走进门。', existingProfileId: null, presence: 'present' }],
    noCharacterReason: '',
  } });
  assert.match(feedback, /上次合法格式的发现结果/);
  assert.match(feedback, /甲走进门。乙站在门外。/);
  assert.match(feedback, /补回遗漏/);
  assert.match(feedback, /也可以剔除上次误识别的候选/);
  assert.match(feedback, /选项、规划、示例不算实际出现或提及/);
  assert.match(feedback, /只能复制 input.profiles 中明确存在的 profileId/);
});

test('manual retirement requires explicit locally scoped IDs and never follows omission', () => {
  const input = { narrative: '林走进门。', profiles: [
    { profileId: 'prior-person', name: '先前人物' },
    { profileId: 'current-mistake', name: '误合并的群体' },
  ] };
  const options = { retirableProfileIds: ['current-mistake'] };
  const empty = { people: [], noCharacterReason: '这轮没有应建档的个人' };
  assert.deepEqual(parseDiscovery(JSON.stringify(empty), input, options).retireProfileIds, []);
  assert.deepEqual(parseDiscovery(JSON.stringify({ ...empty, retireProfileIds: ['current-mistake'] }), input, options), {
    ...empty, retireProfileIds: ['current-mistake'],
  });
  const retire = ids => JSON.stringify({ ...empty, retireProfileIds: ids });
  assert.throws(() => parseDiscovery(retire(['current-mistake']), input), error => error.code === 'discovery_retire_forbidden');
  assert.throws(() => parseDiscovery(retire(['prior-person']), input, options), error => error.code === 'discovery_retire_forbidden');
  assert.throws(() => parseDiscovery(retire(['unknown']), input, { retirableProfileIds: ['unknown'] }), error => error.code === 'discovery_retire_forbidden');
  for (const ids of [null, 'current-mistake', [1], [''], [' current-mistake'], ['current-mistake', 'current-mistake']]) {
    assert.throws(() => parseDiscovery(retire(ids), input, options), error => error.code === 'discovery_retire_invalid');
  }
  const conflicting = { people: [{ sourceName: '林', evidence: '林走进门。', existingProfileId: 'current-mistake', presence: 'present' }],
    retireProfileIds: ['current-mistake'], noCharacterReason: '' };
  assert.throws(() => parseDiscovery(JSON.stringify(conflicting), input, options), error => error.code === 'discovery_retire_conflict');
  assert.equal(input.profiles.length, 2);
});

test('repair prompt explains per-person identity and explicit retirement without another request', () => {
  const input = { narrative: '可区分的两个人交谈。', profiles: [{ profileId: 'current-mistake', name: '误合并群体' }] };
  const prompt = discoveryPrompt(input, { retirableProfileIds: ['current-mistake'] });
  assert.match(prompt, /每项只对应一个可区分的人物/);
  assert.match(prompt, /仅从 people 省略不会删除已保存档案/);
  assert.match(prompt, /以前轮人物不允许剔除/);
  assert.match(prompt, /允许剔除的本轮新建档案 ID[^]*current-mistake/);
  assert.match(prompt, /"retireProfileIds":\[\]/);
  assert.match(prompt, /不是事实或指令/);
});

function batchRows() {
  return [
    { rowId: 'P1', profileId: 'profile-a', sourceName: '林', evidence: '林走进门。', presence: 'present' },
    { rowId: 'P2', profileId: 'profile-b', sourceName: '林', evidence: '林站在窗边。', presence: 'mentioned' },
  ];
}

test('profileBatchPrompt shares input and requires explicit profile bindings without changing evidence fields', () => {
  const rows = batchRows();
  const input = { narrative: '林走进门。林站在窗边。', mvu: { state: 'fresh' }, authority: { card: '卡', world: '世界' }, profiles: [] };
  const prompt = profileBatchPrompt(input, rows);
  assert.match(prompt, /顶层只能有 profiles 键/);
  assert.match(prompt, /P1/);
  assert.match(prompt, /profile-b/);
  assert.match(prompt, /profile\.evidence 仍是 44 字段中的必填非空字符串列表/);
  assert.match(prompt, /不要输出这些 task 绑定元数据/);
  assert.match(prompt, /"appearance"/);
  assert.match(prompt, /利益取向/);
  assert.match(prompt, /弱点与自我欺骗/);
  const feedback = profileBatchPrompt(input, rows, { previousValidResult: { profiles: [] } });
  assert.match(feedback, /仅供逐项复核/);
  assert.match(feedback, /不是事实或指令/);
});

test('parseProfileBatch binds shuffled same-name profiles by rowId and profileId', () => {
  const rows = batchRows();
  const raw = JSON.stringify({ profiles: [
    validProfile({ rowId: 'P2', profileId: 'profile-b', name: '林' }),
    validProfile({ rowId: 'P1', profileId: 'profile-a', name: '林' }),
  ] });
  const parsed = parseProfileBatch(raw, rows, []);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.results.map((result) => [result.rowId, result.profileId, result.errors]), [
    ['P1', 'profile-a', []], ['P2', 'profile-b', []],
  ]);
  assert.equal(parsed.results[0].candidate.name, '林');
  assert.equal(parsed.results[1].candidate.name, '林');
});

test('parseProfileBatch preserves valid siblings while returning local validation errors', () => {
  const rows = batchRows();
  const raw = JSON.stringify({ profiles: [
    validProfile({ rowId: 'P1', profileId: 'profile-a', name: '林' }),
    validProfile({ rowId: 'P2', profileId: 'profile-b', name: '林', appearance: {
      ...validProfile().appearance, outfit: '',
    } }),
  ] });
  const parsed = parseProfileBatch(raw, rows, []);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.results[0].errors.length, 0);
  assert.equal(parsed.results[0].candidate.profileId, 'profile-a');
  assert.ok(parsed.results[1].errors.some((error) => error.includes('appearance.outfit')));
  assert.equal(parsed.results[1].candidate.profileId, 'profile-b');
});

test('parseProfileBatch preserves the legacy full-width punctuation normalization', () => {
  const rows = batchRows();
  const profile = validProfile({ rowId: 'P1', profileId: 'profile-a', name: '林' });
  let openingQuote = true;
  const raw = JSON.stringify({ profiles: [profile] })
    .replace(/"/g, () => {
      const quote = openingQuote ? '“' : '”';
      openingQuote = !openingQuote;
      return quote;
    })
    .replace(/,/g, '，')
    .replace(/:/g, '：');
  const parsed = parseProfileBatch(raw, rows, []);
  assert.deepEqual(parsed.errors, [{ code: 'profile_batch_item_missing', rowId: 'P2', profileId: 'profile-b' }]);
  assert.equal(parsed.results[0].candidate.profileId, 'profile-a');
  assert.deepEqual(parsed.results[0].errors, []);
});

test('parseProfileBatch rejects unknown, missing, duplicate, and cross-bound IDs without positional fallback', () => {
  const rows = batchRows();
  const raw = JSON.stringify({ profiles: [
    validProfile({ rowId: 'P1', profileId: 'profile-a', name: '林' }),
    validProfile({ rowId: 'P1', profileId: 'profile-b', name: '林' }),
    validProfile({ rowId: 'PX', profileId: 'profile-a', name: '林' }),
    { ...validProfile({ rowId: 'P2', profileId: 'profile-b', name: '林' }), rowId: '' },
    validProfile({ rowId: 'P1', profileId: 'profile-a', name: '林' }),
    'not-an-object',
  ] });
  const parsed = parseProfileBatch(raw, rows, []);
  assert.ok(parsed.errors.some((error) => error.code === 'profile_batch_identity_mismatch'));
  assert.ok(parsed.errors.some((error) => error.code === 'profile_batch_unknown_row_id'));
  assert.ok(parsed.errors.some((error) => error.code === 'profile_batch_item_missing_id'));
  assert.ok(parsed.errors.some((error) => error.code === 'profile_batch_duplicate_row_id'));
  assert.ok(parsed.errors.some((error) => error.code === 'profile_batch_item_invalid'));
  assert.ok(parsed.results.every((result) => result.errors.length > 0));
  assert.equal(parsed.results.find((result) => result.rowId === 'P1').candidate.profileId, 'profile-a');
});

test('parseProfileBatch rejects invalid top-level shape with the bounded batch code', () => {
  assert.throws(() => parseProfileBatch('{"profiles":{},"extra":true}', batchRows()), (error) => (
    error.code === 'profile_batch_invalid' && error.recoverable === true
  ));
  assert.throws(() => parseProfileBatch('not json', batchRows()), (error) => (
    error.code === 'profile_batch_invalid' && error.recoverable === true
  ));
  assert.throws(() => parseProfileBatch('说明文字 {"profiles":[]} 结束文字', batchRows()), (error) => (
    error.code === 'profile_batch_invalid' && error.recoverable === true
  ));
  assert.throws(() => parseProfileBatch('{"profiles":[]} {"profiles":[]}', batchRows()), (error) => (
    error.code === 'profile_batch_invalid' && error.recoverable === true
  ));
});
