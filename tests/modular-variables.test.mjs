// Controlled checks of production functions; not real Tavern acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { clone, digest, fault, parsePatch, compileOwnership, checkOwnership } from '../modular/variables/core.mjs';
import { createVariableModule } from '../modular/variables/module.mjs';
import { createHost, parseOfficialCandidate } from '../modular/host.mjs';
import { createRuntime } from '../modular/runtime.mjs';
import { adaptDiagnosisPrompt, EVIDENCE_INSTRUCTION } from '../modular/variables/prompt.mjs';
import { planVariableGroups, checkGroupScope } from '../modular/variables/groups.mjs';
import { diagnosisTranscript, userInput } from '../modular/transcript.mjs';

const nativeSource = fs.readFileSync(new URL('../vendor/story-oracle-v1.35.4/index.js', import.meta.url), 'utf8');
const nativePrompt = vm.runInNewContext(nativeSource.slice(nativeSource.indexOf('const DIAGNOSE_SYSTEM_PROMPT ='), nativeSource.indexOf('const LOREBOOK_SYSTEM_PROMPT =')) + '\nDIAGNOSE_SYSTEM_PROMPT');

test('history retains original user facts when host prompt regex deletes older user messages', () => {
  const calls = [];
  const regexEngine = {
    regex_placement: { USER_INPUT: 1, AI_OUTPUT: 2 },
    getRegexedString(text, placement, options) {
      calls.push({ placement, depth: options.depth });
      if (placement === 1 && options.depth > 0) return '';
      return text.replace(/<plan>[\s\S]*?<\/plan>/gu, '');
    },
  };
  const source = nativeSource.slice(nativeSource.indexOf('function messageVisibleForTranscript('), nativeSource.indexOf('const REASONING_TAGS ='));
  const helpers = vm.runInNewContext(source + '\n({ messageVisibleForTranscript, stripMechanismBlocks, regexEngine, buildTranscriptTurns })', { regexEngine, diagnoseMode: false });
  const ctx = { name1: '玩家', name2: '叙述者', chat: [
    { is_user: true, mes: '我的通行证是蓝色。<UpdateVariable>历史操作</UpdateVariable>' },
    { is_user: false, mes: '<plan>不要传入的规划</plan>蓝色通行证已经登记。' },
    { is_user: true, is_system: true, mes: '隐藏输入不应复活。' },
    { is_user: false, mes: '那张红色通行证仍在桌上。' },
    { is_user: true, mes: '收起通行证。' },
  ] };
  const settings = { applyRegex: true, contextDepth: 30, includeHiddenFloors: false };
  assert.equal(helpers.buildTranscriptTurns(ctx, settings, false).some(turn => turn.text.includes('我的通行证是蓝色')), false, 'native projection reproduces the real loss mechanism');
  calls.length = 0;
  const result = diagnosisTranscript(ctx, settings, helpers);
  assert.equal(result, '[用户输入] 玩家: 我的通行证是蓝色。\n\n[助手正文] 叙述者: 蓝色通行证已经登记。\n\n[助手正文] 叙述者: 那张红色通行证仍在桌上。\n\n[用户输入] 玩家: 收起通行证。');
  assert.deepEqual(calls, [{ placement: 2, depth: 2 }, { placement: 2, depth: 1 }]);
  assert.doesNotMatch(result, /隐藏输入|规划|历史操作/);
  assert.equal(diagnosisTranscript(ctx, { ...settings, contextDepth: 0 }, helpers), '');
  assert.equal(diagnosisTranscript(ctx, { ...settings, contextDepth: 2 }, helpers), '[助手正文] 叙述者: 那张红色通行证仍在桌上。\n\n[用户输入] 玩家: 收起通行证。');
  calls.length = 0;
  assert.match(diagnosisTranscript(ctx, { ...settings, includeHiddenFloors: true, contextDepth: -1 }, helpers), /隐藏输入不应复活/);
  assert.deepEqual(calls, [{ placement: 2, depth: 3 }, { placement: 2, depth: 1 }]);
  calls.length = 0;
  assert.match(diagnosisTranscript(ctx, { ...settings, applyRegex: false }, helpers), /<plan>/);
  assert.equal(calls.length, 0);
});

test('database input wrapper keeps actual user text separate from recalled instructions', async () => {
  const text = '只询问通行证的用途。';
  const wrapped = `以下是用户的本轮输入：\n<本轮用户输入>\n${text}\n</本轮用户输入>\n旧召回指令：展示回忆。<recall>过去的事件</recall>`;
  assert.equal(userInput(wrapped), text);
  assert.equal(userInput(text), text);
  assert.equal(userInput('<本轮用户输入>这是用户自己写的标签</本轮用户输入>'), '<本轮用户输入>这是用户自己写的标签</本轮用户输入>');
  const incomplete = '以下是用户的本轮输入：<本轮用户输入>未闭合内容';
  assert.equal(userInput(incomplete), incomplete);
  const h = harness({ reply: () => '[]' });
  h.target.userText = wrapped;
  await h.module.run(h.target);
  const prompt = h.module.review().baseMessages[1].content;
  assert.ok(prompt.includes(`【本轮用户输入】\n${text}\n\n【最终接受`));
  assert.doesNotMatch(prompt, /旧召回指令|<recall>/);
  assert.equal(h.module.review().target.userText, wrapped, 'identity and recovery still bind the raw saved message');
});

test('paired database regex retains historical player input while trimming only its recall wrapper', () => {
  const script = JSON.parse(fs.readFileSync(new URL('../compatibility/database-user-history.regex.json', import.meta.url), 'utf8'));
  const compiled = new RegExp(script.findRegex.slice(1, -1));
  const input = '我的通行证是蓝色。\n只询问用途，不主动离开。';
  const wrapped = `以下是用户的本轮输入：\n<本轮用户输入>\n${input}\n</本轮用户输入>\n旧召回指令<recall>已发生的事件</recall>`;
  assert.equal(wrapped.replace(compiled, script.replaceString), input);
  const plain = '原始输入中提到：以下是用户的建议，不是数据库包装。';
  assert.equal(plain.replace(compiled, script.replaceString), plain);
  const broken = '以下是用户的本轮输入：<本轮用户输入>缺失结束标签';
  assert.equal(broken.replace(compiled, script.replaceString), broken);
  assert.deepEqual(script.placement, [1]);
  assert.equal(script.minDepth, 2);
  assert.equal(script.promptOnly, true);
  assert.equal(script.disabled, false);
});

const rules = `rules:
  玩家.头部.\${等级|EXP_当前|EXP_升级所需}:
    check:
      - 【完全禁止修改】等级、EXP_升级所需由前端托管，严禁修改。
  玩家.职业.\${PEXP_当前|PEXP_升级所需}:
    check:
      - PEXP_升级所需前端托管。
  玩家.当前敌人:
    check:
      - 敌人的最大值前端不代算！AI必须写入绝对数值。
  系统日志:
    check:
      - 禁止手动写入、修改或清空此变量，必须完全交由前端掌控。`;
const state = { 玩家: { 头部: { 等级: 1, EXP_当前: 7, EXP_升级所需: 10 }, 职业: { PEXP_当前: 0, PEXP_升级所需: 10 }, 当前敌人: { 等级: 2, HP_最大: 20 } }, 系统日志: [] };
test('ownership follows exact declared paths, Chinese adjacency and ancestor writes', () => {
  const policy = compileOwnership(rules, state);
  assert.deepEqual(policy.protected.map(v => v.path).sort(), ['/玩家/头部/等级', '/玩家/头部/EXP_升级所需', '/玩家/职业/PEXP_升级所需', '/系统日志'].sort());
  assert.equal(checkOwnership([{ op: 'replace', path: '/玩家/头部', value: {} }], policy).length, 2);
  assert.equal(checkOwnership([{ op: 'insert', path: '/玩家', value: { 头部: { EXP_升级所需: 20 } } }], policy).length, 1);
  assert.equal(checkOwnership([{ op: 'replace', path: '/玩家/当前敌人/等级', value: 3 }], policy).length, 0);
  assert.equal(checkOwnership([{ op: 'delta', path: '/玩家/头部/EXP_当前', value: 5 }], policy).length, 0);
});
test('ownership protects declared outputs without freezing calculation inputs or AI clauses', () => {
  const scoped = `rules:
  玩家.头部.信誉:
    check:
      - 【禁止修改】态度（如冷淡、友好等）由前端脚本根据信誉值自动计算更新，AI无需修改态度。
  玩家.职业.\${名称|品质|职业等级}:
    check:
      - 转职时更新名称、品质，职业等级重置由前端处理。
  玩家.属性.加成.\${STR|AGI}:
    check:
      - 【禁止修改】由前端根据装备、职业等自动计算。实际值也由前端自动合成。`;
  const input = { 玩家: { 头部: { 信誉: 3, 态度: '中立' }, 职业: { 名称: '', 品质: '', 职业等级: 1 }, 属性: { 加成: { STR: 0, AGI: 0 }, 实际: { STR: 5, AGI: 5 } }, 敌人: { 态度: '中立', 职业等级: 2, 实际: { STR: 8 } } } };
  const policy = compileOwnership(scoped, input);
  assert.deepEqual(policy.protected.map(v => v.path).sort(), ['/玩家/头部/态度', '/玩家/职业/职业等级', '/玩家/属性/加成/STR', '/玩家/属性/加成/AGI', '/玩家/属性/实际'].sort());
  for (const path of ['/玩家/头部/信誉', '/玩家/职业/名称', '/玩家/职业/品质', '/玩家/敌人/态度', '/玩家/敌人/职业等级', '/玩家/敌人/实际/STR']) assert.equal(checkOwnership([{ op: 'replace', path, value: 4 }], policy).length, 0, path);
  assert.ok(checkOwnership([{ op: 'replace', path: '/玩家/属性/实际/STR', value: 6 }], policy).length);
});
test('ownership protects missing declared leaves without blocking undeclared same-name fields', () => {
  const rules = `rules:
  玩家.属性.实际.\${STR|AGI}:
    check:
      - 由前端根据装备和职业自动合成，禁止修改。
  玩家.关系.\${亲密度|信任}:
    check:
      - 此变量由前端脚本托管，禁止修改。`;
  const state = { 玩家: { 属性: { 实际: { STR: 5 } }, 关系: {} }, 敌人: { 属性: { 实际: { AGI: 4 } } } };
  const policy = compileOwnership(rules, state);
  assert.ok(policy.protected.some(v => v.path === '/玩家/属性/实际/STR'));
  assert.ok(policy.protected.some(v => v.path === '/玩家/属性/实际/AGI'));
  assert.ok(policy.protected.some(v => v.path === '/玩家/关系/亲密度'));
  assert.ok(policy.protected.some(v => v.path === '/玩家/关系/信任'));
  assert.ok(checkOwnership([{ op: 'replace', path: '/玩家/属性/实际', value: { AGI: 9 } }], policy).length);
  assert.ok(checkOwnership([{ op: 'insert', path: '/玩家', value: { 属性: { 实际: { AGI: 9 } } } }], policy).length);
  assert.ok(checkOwnership([{ op: 'move', from: '/玩家/关系/亲密度', to: '/玩家/关系/信任' }], policy).length);
  assert.equal(checkOwnership([{ op: 'replace', path: '/敌人/属性/实际/AGI', value: 9 }], policy).length, 0);
});
test('named ownership protects a missing expanded leaf and an entirely missing declaration root', () => {
  const rules = `rules:
  玩家.属性.实际.\${STR|AGI}:
    check:
      - AGI由前端自动合成，禁止修改。
  玩家.装备.槽位:
    check:
      - 槽位由前端脚本托管，禁止修改。`;
  const state = { 玩家: { 属性: { 实际: { STR: 5 } } } };
  const policy = compileOwnership(rules, state);
  assert.equal(policy.protected.some(v => v.path === '/玩家/属性/实际/AGI'), true);
  assert.equal(policy.protected.some(v => v.path === '/玩家/装备/槽位'), true);

  const protectedToWritable = checkOwnership([{ op: 'move', from: '/玩家/属性/实际/AGI', to: '/敌人/属性/实际/AGI' }], policy);
  assert.deepEqual(protectedToWritable.map(v => v.ownerPath), ['/玩家/属性/实际/AGI']);
  const writableToProtected = checkOwnership([{ op: 'move', from: '/敌人/装备/槽位', to: '/玩家/装备/槽位' }], policy);
  assert.deepEqual(writableToProtected.map(v => v.ownerPath), ['/玩家/装备/槽位']);
});
test('format recovery keeps a unique patch; errors and conflicting blocks fail', () => {
  assert.equal(parsePatch('说明\n```json\n[{"op":"delta","path":"/coins","value":5,},]\n```').operations[0].value, 5);
  assert.throws(() => parsePatch('[HTTP Error] connection failed'), { code: 'model_transport' });
  assert.throws(() => parsePatch('<JSONPatch>[]</JSONPatch><JSONPatch>[]</JSONPatch>'), { code: 'patch_ambiguous' });
  assert.throws(() => parsePatch('[{"op":"run","path":"/x"}]'), { code: 'patch_operation' });
});

function receiptEvents() {
  const listeners = new Map();
  return {
    listeners,
    makeFirst(event, listener) { const items = listeners.get(event) || []; listeners.set(event, [listener, ...items.filter(item => item !== listener)]); },
    removeListener(event, listener) { listeners.set(event, (listeners.get(event) || []).filter(item => item !== listener)); },
    async emit(event, ...args) { for (const listener of [...(listeners.get(event) || [])]) await listener(...args); },
  };
}
test('official receipts retain normalized results without interpreting model values', async () => {
  const h = harness({ reply: () => '[{"op":"replace","path":"/effects","value":"normalized by schema"}]',
    officialResult: (_block, input) => ({ ...input, stat_data: { effects: { canonical: 'schema value', defaultField: 1 } } }),
  });
  h.change({ stat_data: { effects: 'old' } });
  const record = await h.module.run(h.target);
  assert.equal(record.status, 'applied'); assert.equal(h.calls.length, 1);
  assert.deepEqual(h.current().stat_data.effects, { canonical: 'schema value', defaultField: 1 });
  assert.deepEqual(record.executionReceipt, { parsedCount: 1, unexecuted: [] });
});
test('official receipt binds both event identities and removes only its listeners on every exit', async () => {
  for (const mode of ['valid', 'missing', 'replaced-array', 'duplicate', 'not-cleaned', 'throw']) {
    const events = receiptEvents(), unrelated = () => {};
    events.makeFirst('commands_for_zod', unrelated);
    const mvu = { events: { COMMAND_PARSED: 'commands' }, async parseMessage(message, data) {
      const commands = [{ type: 'set', full_match: 'synthetic command' }];
      await events.emit('commands_for_zod', {}, [], 'foreign request');
      await events.emit('commands_ended_for_zod', {}, [], 'foreign request');
      await events.emit('commands_for_zod', data, commands, message);
      if (mode === 'throw') throw fault('parse_failure', 'synthetic');
      commands.length = 0;
      if (mode === 'not-cleaned') commands.push({ type: 'set' });
      if (mode !== 'missing') await events.emit('commands_ended_for_zod', data, mode === 'replaced-array' ? [] : commands, message);
      if (mode === 'duplicate') await events.emit('commands_ended_for_zod', data, commands, message);
      return { stat_data: { value: 2 } };
    } };
    const run = () => parseOfficialCandidate({ mvu, eventSource: events, before: { stat_data: { value: 1 } }, block: 'synthetic patch' });
    if (mode === 'valid') assert.deepEqual((await run()).receipt, { parsedCount: 1, unexecuted: [] });
    else await assert.rejects(run(), { code: mode === 'throw' ? 'parse_failure' : 'official_receipt_unavailable' });
    assert.deepEqual(events.listeners.get('commands_for_zod'), [unrelated], mode);
    assert.deepEqual(events.listeners.get('commands_ended_for_zod'), [], mode);
  }
});
function harness(overrides = {}) {
  let current = { stat_data: { coins: 7 } }, stale = false, saveFailure = false;
  const profile = { id: 'synthetic-model', api: 'custom', model: 'original', preset: 'synthetic-preset', proxy: 'synthetic-proxy', 'api-url': 'https://synthetic.invalid' };
  const preset = { temperature: 0.7 }, defaults = { top_p: 0.9 }, proxies = [{ name: 'synthetic-proxy', url: 'https://proxy.invalid', password: 'synthetic-password' }];
  const routeContext = { chatCompletionSettings: defaults, getPresetManager: () => ({ getCompletionPresetByName: () => preset }),
    ConnectionManagerRequestService: { getProfile(id) { if (profile.id !== id) throw Error('missing'); return profile; }, validateProfile: () => ({ selected: 'openai', source: 'custom' }) } };
  const routeHost = createHost(() => routeContext, async () => proxies);
  const values = new Map(), calls = [], parsed = [], writes = [], saves = [], eventSource = receiptEvents();
  const target = { scopeKey: 'chat-a', identity: 'reply-a', index: 2, swipeId: 0, content: '获奖7枚金币。', userText: '领取奖励。' };
  const host = {
    modelRouteHash: routeHost.modelRouteHash,
    assertTarget() { if (stale) throw fault('stale_target', 'changed'); },
    previousMvu: async () => ({ index: 0, payload: { stat_data: { coins: 5 } } }),
    contextSnapshot: () => ({ chat: [{ mes: '开场' }, { is_user: true, mes: target.userText }, { is_user: false, mes: target.content }] }),
    settings: () => ({ maxAttempts: 3, globalPrompt: '' }),
    async saveChat(_target, candidate) { saves.push(clone(candidate)); if (saveFailure) throw fault('host_mvu_durable_mismatch', 'failed'); },
    async readback() { if (saveFailure) throw fault('host_mvu_durable_mismatch', 'failed'); },
    delay: async () => {},
    parseMvuCandidate: (_target, mvu, block, before) => parseOfficialCandidate({ mvu, block, before, eventSource, assertCurrent: () => host.assertTarget() }),
  };
  const mvu = {
    events: { COMMAND_PARSED: 'synthetic_commands' },
    getMvuData: async () => clone(current),
    parseMessage: async (block, input) => {
      parsed.push({ block, input: clone(input) });
      const operations = parsePatch(block).operations, commands = operations.map(op => ({ type: op.op, full_match: JSON.stringify(op) }));
      await eventSource.emit('synthetic_commands_for_zod', input, commands, block);
      const result = overrides.officialResult ? overrides.officialResult(block, input) : operations.length ? { ...input, stat_data: { coins: 12 } } : clone(input);
      const remaining = overrides.unexecuted?.(operations) || [];
      commands.splice(0, commands.length, ...remaining.map(op => ({ type: op.op, full_match: JSON.stringify(op) })));
      await eventSource.emit('synthetic_commands_ended_for_zod', input, commands, block);
      commands.length = 0;
      return result;
    },
    replaceMvuData: async (value, options) => { writes.push({ value: clone(value), options }); current = clone(value); },
  };
  const settings = { mode: 'profile', profileId: 'synthetic-model', maxTokens: 4096 };
  const so = { getMvu: async () => mvu, mvuIsBusy: () => false, getSettings: () => settings,
    diagPickerActive: () => false, collectMvuUpdateRules: async () => ['coins tracks actual acquired money'],
    wiContextMode: () => 'st', buildWorldInfo: async () => 'Synthetic world rules',
    resolveModePrompt: settings => settings.diagnoseSystemPrompt || nativePrompt,
    buildTranscriptTurns: (ctx, settings, keepMechanism) => { assert.equal(settings.contextDepth, 1); assert.equal(keepMechanism, false); assert.equal(ctx.chat.length, 1); return [{ role: 'assistant', text: ctx.chat[0].mes }]; },
    extractUpdateBlock: () => '', buildCardSection: () => 'Synthetic card facts',
    diagnosisTranscript: (ctx, s) => { assert.equal(ctx.chat.length, target.index); assert.equal(ctx.chat.some(row => row.mes === target.content), false); return 'Synthetic prior story'; },
    callProfile: async (...args) => { calls.push(args); return overrides.reply?.() ?? '[{"op":"delta","path":"/coins","value":5}]'; },
    refreshMessageBar: () => {},
  };
  const store = { read: async key => clone(values.get(key) ?? null), write: async (key, value) => { values.set(key, clone(value)); await overrides.onStore?.(key, value); } };
  const module = createVariableModule({ host, store, story: () => so });
  return { module, host, store, so, mvu, target, values, calls, parsed, writes, saves, settings, profile, preset, defaults, proxies, routeContext,
    change: value => { current = value; }, stale: () => { stale = true; }, failSave: value => { saveFailure = value; }, current: () => clone(current) };
}
test('native prompt override removes conflicting stored-equals-correct instructions and keeps output contract', async () => {
  const h = harness({ reply: () => '[]' }); const originalSettings = clone(h.settings);
  await h.module.run(h.target);
  const sent = h.calls[0][1][0].content;
  assert.doesNotMatch(sent, /只要该条目已存在于状态中，就绝不要把它判为错误/);
  assert.doesNotMatch(sent, /如果效果已经在那里，那么该操作就是成功的/);
  const normalization = nativePrompt.split('\n').find(line => line.startsWith('- 当前状态已经反映了最新更新实际造成的一切结果。'));
  assert.ok(sent.includes(normalization), 'native schema completion and merge semantics are retained verbatim');
  assert.doesNotMatch(sent, /1\. 诊断。逐项核对最新更新在当前状态中体现出的效果/);
  assert.match(sent, /逐项阅读本卡全部字段的check规则/);
  const messages = h.calls[0][1];
  assert.deepEqual(messages.map(message => message.role), ['system', 'user']);
  const baseMessages = h.module.review().baseMessages;
  assert.ok(baseMessages[1].content.endsWith(EVIDENCE_INSTRUCTION));
  assert.ok(messages[1].content.startsWith(baseMessages[1].content), 'group scope does not replace or truncate frozen context');
  assert.match(messages[1].content.slice(baseMessages[1].content.length), /\/coins/);
  assert.equal(messages.map(message => message.content).join('\n').split('【本轮变量核对任务】').length - 1, 1);
  assert.doesNotMatch(sent, /【本轮变量核对任务】/);
  assert.match(messages[1].content, /物品存在、约定归属和实际交付是不同状态/);
  assert.match(messages[1].content, /正文真正取得、交付或消耗之后，才完整更新相应库存/);
  assert.match(messages[1].content, /请审计整个当前 stat_data，而不只是最新一次更新/);
  assert.match(messages[1].content, /包括原更新块完全没有提到的条目/);
  assert.match(messages[1].content, /按本卡允许的正文称谓定位，不编造真名/);
  const nativeOutput = nativePrompt.slice(nativePrompt.indexOf('输出规则：'));
  const factsOnly = nativeOutput.split('\n').find(line => line.startsWith('- 不要编造剧情事实。'));
  assert.ok(factsOnly);
  assert.doesNotMatch(sent, /不要添加文本里没有的细节/);
  assert.match(sent, /不得编造已经发生的剧情事实、玩家行动、情绪、承诺或成功结果/);
  assert.match(sent, /本卡check若明确要求在某个已发生的前提下自动生成、设定或初始化条目/);
  assert.match(sent, /定义任务不等于已经完成任务，登记条件不等于已经兑现条件/);
  assert.match(sent, /没有这种初始化规则的字段仍只登记有事实依据的变化/);
  for (const unchangedPart of nativeOutput.split(factsOnly)) assert.ok(sent.includes(unchangedPart), 'every other native output rule and format is retained verbatim');
  assert.match(sent, /尚未交付的物品不得.*放入可用背包/);
  assert.deepEqual(h.settings, originalSettings, 'per-call override does not mutate saved user configuration');
  const custom = '使用本卡专用字段格式。';
  assert.ok(adaptDiagnosisPrompt(custom).startsWith(custom), 'native custom prompt is retained');
});
test('uses current7 and prior5 evidence; delegates residual+5 once to official MVU for final12', async () => {
  const h = harness(); const receipt = await h.module.run(h.target);
  assert.equal(receipt.status, 'applied'); assert.equal(receipt.readback, true); assert.equal(receipt.semanticProof, false);
  assert.equal(h.parsed.length, 1); assert.equal(h.parsed[0].input.stat_data.coins, 7);
  assert.equal(parsePatch(h.parsed[0].block).operations[0].value, 5);
  assert.deepEqual(h.writes[0].options, { type: 'message', message_id: 2 }); assert.equal(h.saves[0].stat_data.coins, 12);
  assert.match(h.calls[0][1][1].content, /"coins":\s*5/); assert.match(h.calls[0][1][1].content, /领取奖励/);
  await h.module.run(h.target); assert.equal(h.calls.length, 1, 'valid settled receipt prevents duplicate work');
});
test('uses native current-reply projection without changing raw target or saved context depth', async () => {
  const h = harness({ reply: () => '[]' });
  h.settings.contextDepth = 30;
  h.target.content = '<plan>RAW_FUTURE_PLAN</plan>已经到达车站。<UpdateVariable>raw patch</UpdateVariable>';
  const raw = h.target.content;
  h.so.buildTranscriptTurns = (ctx, settings, keepMechanism) => {
    assert.equal(ctx.chat.length, 1); assert.equal(ctx.chat[0].mes, raw);
    assert.equal(settings.contextDepth, 1); assert.equal(keepMechanism, false);
    return [{ role: 'assistant', text: '已经到达车站。' }];
  };
  await h.module.run(h.target);
  assert.match(h.calls[0][1][1].content, /已经到达车站/);
  assert.doesNotMatch(h.calls[0][1][1].content, /RAW_FUTURE_PLAN|raw patch/);
  assert.equal(h.target.content, raw); assert.equal(h.settings.contextDepth, 30);
});
test('empty native current-reply projection stops before any model request or write', async () => {
  const h = harness(); h.so.buildTranscriptTurns = () => [];
  await assert.rejects(h.module.run(h.target), { code: 'narrative_missing' });
  assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
});
test('native world context is retained alongside recovered MVU rules and dynamic expansion is separate from rule hash', async () => {
  const h = harness({ reply: () => '[]' }); let scans = 0;
  h.so.buildWorldInfo = async mode => { assert.equal(mode, 'st'); return `World acquisition conditions; dynamic scan ${++scans}`; };
  h.so.collectMvuUpdateRules = async existing => { assert.ok(existing === '' || existing.startsWith('World acquisition')); return ['coins tracks actual acquired money']; };
  const record = await h.module.run(h.target);
  assert.match(h.calls[0][1][1].content, /World acquisition conditions; dynamic scan 1/);
  assert.match(h.calls[0][1][1].content, /coins tracks actual acquired money/);
  assert.match(record.contextHash, /^[a-f0-9]{64}$/);
  assert.equal(await h.module.validateReceipt(h.target, record), true);
  assert.equal(scans, 1, 'receipt validation does not substitute a new dynamic scan for the recorded request');
});
test('native selected world entries remain authoritative without automatic scan or rule additions', async () => {
  const h = harness({ reply: () => '[]' });
  h.so.diagPickerActive = () => true;
  h.so.buildDiagSelectedWi = async () => ({ block: 'Explicit selected field and world rules' });
  h.so.buildWorldInfo = async () => assert.fail('selected mode must not scan');
  h.so.collectMvuUpdateRules = async () => assert.fail('selected mode must not add entries');
  await h.module.run(h.target);
  assert.match(h.calls[0][1][1].content, /Explicit selected field and world rules/);
});
test('world background and field rules stay distinct; current structured state ends data and global override stays system', async () => {
  const h = harness({ reply: () => '[]' });
  h.host.settings = () => ({ maxAttempts: 3, globalPrompt: 'GLOBAL_SYNTHETIC_OVERRIDE' });
  await h.module.run(h.target);
  const messages = h.calls[0][1], system = messages[0].content, data = messages[1].content;
  assert.match(system, /GLOBAL_SYNTHETIC_OVERRIDE/);
  assert.doesNotMatch(system, /Synthetic world rules|Synthetic card facts/);
  assert.doesNotMatch(data, /GLOBAL_SYNTHETIC_OVERRIDE/);
  assert.match(data, /<背景设定>[\s\S]*Synthetic world rules[\s\S]*Synthetic card facts[\s\S]*<\/背景设定>/);
  assert.ok(data.indexOf('=== 本卡MVU字段规则') > data.indexOf('</背景设定>'));
  assert.ok(data.indexOf('【本轮MVU处理状态】') >= 0);
  assert.ok(data.indexOf('=== 当前变量状态') > data.indexOf('【本轮MVU处理状态】'));
  assert.ok(data.indexOf('=== 当前变量状态') > data.indexOf('【更新前MVU'));
  assert.ok(data.includes(JSON.stringify({ coins: 7 }, null, 2)));
  assert.equal(data.split(h.target.content).length - 1, 1, 'current narrative is not duplicated in history');
  assert.deepEqual(h.module.review().messages, messages, 'review retains the actual sent role boundary');
});
test('the model reads official object state while the original pre-normalization operation remains reviewable', async () => {
  const h = harness({ reply: () => '[]' });
  const original = '<UpdateVariable><JSONPatch>[{"op":"insert","path":"/effects","value":"PRE_NORMALIZED_RECORD"}]</JSONPatch></UpdateVariable>';
  const raw = `获得实际效果。${original}`;
  h.target.content = raw;
  h.so.extractUpdateBlock = () => original;
  h.so.buildTranscriptTurns = () => [{ role: 'assistant', text: '获得实际效果。' }];
  h.change({ stat_data: { effects: { 稳定: '已由官方框架归一化。' } } });
  await h.module.run(h.target);
  const sent = h.calls[0][1].map(message => message.content).join('\n');
  assert.doesNotMatch(sent, /PRE_NORMALIZED_RECORD/);
  assert.match(sent, /"effects":\s*\{\s*"稳定"/);
  assert.match(sent, /本轮含内联更新记录/);
  assert.match(sent, /不能仅凭存在更新块认定成功/);
  assert.doesNotMatch(sent, /内联更新已由官方MVU处理/);
  assert.equal(h.module.review().originalBlock, original);
  assert.equal(h.target.content, raw);
  assert.equal(h.parsed.length, 1);
});
test('a partially dropped official patch cannot write or claim success', async () => {
  const h = harness({
    reply: () => JSON.stringify([{ op: 'delta', path: '/coins', value: 5 }, { op: 'replace', path: '/mode', value: 'mixed-invalid' }]),
    officialResult: (_block, input) => ({ ...input, stat_data: { coins: 12, mode: 'unset' } }),
    unexecuted: operations => [operations[1]],
  });
  h.change({ stat_data: { coins: 7, mode: 'unset' } });
  await assert.rejects(h.module.run(h.target), { code: 'patch_outcome' });
  assert.equal(h.calls.length, 3); assert.equal(h.writes.length, 0); assert.equal(h.saves.length, 0);
  assert.deepEqual(h.current().stat_data, { coins: 7, mode: 'unset' });
  assert.match(h.calls[1][1].at(-1).content, /\/mode/);
  assert.match(h.calls[1][1].at(-1).content, /mixed-invalid/);
  assert.equal([...h.values.values()].some(value => value.readback === true), false);
});

test('outcome retry starts from unchanged baseline and persists only the repaired official candidate', async () => {
  let responses = 0;
  const h = harness({
    reply: () => JSON.stringify([{ op: 'delta', path: '/coins', value: 5 }, { op: 'replace', path: '/mode', value: ++responses === 1 ? 'mixed-invalid' : 'allowed' }]),
    officialResult: (block, input) => ({ ...input, stat_data: { coins: 12, mode: parsePatch(block).operations[1].value === 'allowed' ? 'allowed' : 'unset', derived: 24 } }),
    unexecuted: operations => operations[1].value === 'allowed' ? [] : [operations[1]],
  });
  h.change({ stat_data: { coins: 7, mode: 'unset' } });
  const record = await h.module.run(h.target);
  assert.equal(h.calls.length, 2); assert.equal(h.writes.length, 1); assert.equal(h.saves.length, 1);
  assert.ok(h.parsed.every(entry => entry.input.stat_data.coins === 7));
  assert.deepEqual(h.current().stat_data, { coins: 12, mode: 'allowed', derived: 24 });
  assert.equal(record.status, 'applied'); assert.equal(record.readback, true);
});

test('late model response after variable edit is discarded without parse or write', async () => {
  const h = harness({ reply() { h.change({ stat_data: { coins: 8 } }); return '[]'; } });
  await assert.rejects(h.module.run(h.target), { code: 'stale_mvu' });
  assert.equal(h.writes.length, 0); assert.equal(h.parsed.length, 0);
});
test('late model response after chat switch is discarded', async () => {
  const h = harness({ reply() { h.stale(); return '[]'; } });
  await assert.rejects(h.module.run(h.target), { code: 'stale_target' }); assert.equal(h.writes.length, 0);
});
test('a changed model configuration cannot reuse an in-flight candidate', async () => {
  const h = harness({ reply() { h.settings.profileId = 'changed'; return '[]'; } });
  await assert.rejects(h.module.run(h.target), { code: 'model_config_changed' }); assert.equal(h.writes.length, 0);
});

test('group planning covers declared missing fields, empty records and unmentioned stored data without overlap', () => {
  const rules = `rules:
  actor.relations:
    check:
      - Register newly encountered people.
  actor.relations.known:
    check:
      - Existing record.
  actor.\${time|missing}:
    check:
      - Maintain current scene.
  actor.items.0:
    check:
      - Item.`;
  const groups = planVariableGroups(rules, { actor: { time: 1, relations: {}, items: ['a', 'b'], extra: 4 }, 'a/b~c': {} }, { history: { old: true } }, 2);
  const paths = groups.flatMap(group => group.paths);
  assert.deepEqual(new Set(paths), new Set(['/actor/relations', '/actor/time', '/actor/missing', '/actor/items', '/actor/extra', '/a~1b~0c', '/history']));
  assert.ok(groups.every(group => group.paths.length <= 2));
  for (const a of paths) for (const b of paths) if (a !== b) assert.equal(a.startsWith(b + '/'), false);
});
test('group scope rejects ancestor replacement and cross-group move but accepts bounded merge inserts', () => {
  const group = { paths: ['/actor/coins', '/actor/items'] };
  assert.equal(checkGroupScope([{ op: 'insert', path: '/actor', value: { coins: 9, items: [] } }], group).length, 0);
  assert.equal(checkGroupScope([{ op: 'replace', path: '/actor', value: { coins: 9 } }], group).length, 1);
  assert.equal(checkGroupScope([{ op: 'insert', path: '/actor', value: { relations: {} } }], group).length, 1);
  assert.equal(checkGroupScope([{ op: 'move', from: '/other/items/0', to: '/actor/items/-' }], group).length, 1);
  assert.equal(checkGroupScope([{ op: 'replace', path: '/actor/coinship', value: 8 }], group).length, 1);
});

test('declared missing roots and malformed parent containers remain repairable within one group', () => {
  const rules = `rules:
  absent:
    check:
      - Register the required root.
  actor.stats.hp:
    check:
      - Maintain hit points.
  actor.stats.mp:
    check:
      - Maintain magic points.`;
  const groups = planVariableGroups(rules, { actor: { stats: 'wrong shape', coins: 1 } }, {}, 1, [{ type: 'object', properties: { absent: { type: 'object', properties: {} } } }]);
  const paths = groups.flatMap(group => group.paths);
  assert.deepEqual(new Set(paths), new Set(['/absent', '/actor/stats', '/actor/coins']));
  assert.equal(checkGroupScope([{ op: 'replace', path: '/actor/stats', value: { hp: 10, mp: 5 } }], groups.find(group => group.paths.includes('/actor/stats'))).length, 0);
});

test('general check instructions never become top-level variables without structural authority', () => {
  const rules = `rules:
  operation_rules:
    check:
      - Use precise paths.
  absent:
    check:
      - Maintain required data.
  actor.coins:
    check:
      - Track acquired money.`;
  const paths = planVariableGroups(rules, { actor: { coins: 1 } }, {}, 8, [{ type: 'object', properties: { absent: { type: 'number' } } }]).flatMap(group => group.paths);
  assert.deepEqual(new Set(paths), new Set(['/absent', '/actor/coins']));
  assert.deepEqual(planVariableGroups(rules, { actor: { coins: 1 } }, {}, 8, ['zod-owned']).flatMap(group => group.paths), ['/actor/coins']);
});

test('rule changes during a response or immediately before write discard all old results', async () => {
  for (const stage of ['response', 'committing']) {
    let rules = 'coins tracks actual acquired money';
    const h = harness({
      reply() { if (stage === 'response') rules += ' Changed rule.'; return '[{"op":"delta","path":"/coins","value":5}]'; },
      onStore(_key, value) { if (stage === 'committing' && value.status === 'committing') rules += ' Changed rule.'; },
    });
    h.so.collectMvuUpdateRules = async () => [rules];
    await assert.rejects(h.module.run(h.target), { code: 'variable_rules_changed' });
    assert.equal(h.calls.length, 1); assert.equal(h.writes.length, 0); assert.equal(h.saves.length, 0);
    if (stage === 'response') assert.equal(h.parsed.length, 0);
    else assert.equal(h.values.get('variables:chat-a:reply-a').status, 'abandoned');
  }
});
test('same profile ID cannot hide model, endpoint, preset, fallback sampler or proxy changes', async () => {
  for (const change of [h => { h.profile.model = 'changed'; }, h => { h.profile['api-url'] += '/changed'; }, h => { h.preset.temperature = 0.2; }, h => { h.defaults.top_p = 0.5; }, h => { h.proxies[0].url += '/changed'; }, h => { h.proxies[0].password += '-changed'; }]) {
    const h = harness({ reply() { change(h); return '[]'; } });
    await assert.rejects(h.module.run(h.target), { code: 'model_config_changed' });
    assert.equal(h.calls.length, 1); assert.equal(h.parsed.length, 0); assert.equal(h.writes.length, 0);
  }
});
test('resolved connection changes invalidate a settled receipt and force a new model request', async () => {
  const h = harness({ reply: () => '[]' }); const receipt = await h.module.run(h.target);
  h.profile.model = 'new-model';
  assert.equal(await h.module.validateReceipt(h.target, receipt), false);
  const next = await h.module.run(h.target);
  assert.equal(h.calls.length, 2); assert.notEqual(next.configHash, receipt.configHash);
  assert.doesNotMatch(JSON.stringify(next), /synthetic-password|synthetic\.invalid|proxy\.invalid/);
});
test('unreadable native connection stops before transport or MVU parsing', async () => {
  const h = harness(); h.routeContext.ConnectionManagerRequestService.getProfile = () => { throw Error('synthetic secret must not escape'); };
  await assert.rejects(h.module.run(h.target), error => error.code === 'model_config_unavailable' && !error.message.includes('synthetic secret'));
  assert.equal(h.calls.length, 0); assert.equal(h.parsed.length, 0); assert.equal(h.writes.length, 0);
});
test('direct endpoint, raw URL mode, backend forwarding and credentials change the route digest', async () => {
  const host = createHost(() => ({})); const base = { mode: 'direct', endpoint: 'https://synthetic.invalid', directRawUrl: false, directViaBackend: false, apiKey: 'synthetic-token' };
  const initial = await host.modelRouteHash(base);
  for (const update of [{ endpoint: 'https://changed.invalid' }, { directRawUrl: true }, { directViaBackend: true }, { apiKey: 'changed-token' }]) assert.notEqual(await host.modelRouteHash({ ...base, ...update }), initial);
  assert.match(initial, /^[a-f0-9]{64}$/);
});
test('prewrite drift abandons prepared intent and does not create a false recovery conflict', async () => {
  let changed = false;
  const h = harness({
    // The fresh diagnosis must target12 from9; the prior fixture repeated+5
    // while its fake official parser returned12, hiding a wrong postcondition.
    reply: () => JSON.stringify([{ op: 'delta', path: '/coins', value: changed ? 3 : 5 }]),
    onStore(_key, value) { if (value.status === 'committing' && !changed) { changed = true; h.change({ stat_data: { coins: 9 } }); } },
  });
  await assert.rejects(h.module.run(h.target), { code: 'stale_mvu' }); assert.equal(h.writes.length, 0);
  assert.equal(h.values.get('variables:chat-a:reply-a').status, 'abandoned');
  await h.module.run(h.target); assert.equal(h.writes.length, 1);
  assert.equal(h.parsed.at(-1).input.stat_data.coins, 9);
  assert.equal(parsePatch(h.parsed.at(-1).block).operations[0].value, 3);
  assert.equal(h.current().stat_data.coins, 12);
});
test('failed durable save never reports success; retry verifies pending candidate without replay', async () => {
  const h = harness(); h.failSave(true);
  await assert.rejects(h.module.run(h.target), { code: 'host_mvu_durable_mismatch' });
  assert.equal(h.values.get('variables:chat-a:reply-a').status, 'committing'); assert.equal(h.calls.length, 1);
  await assert.rejects(h.module.run(h.target), { code: 'host_mvu_durable_mismatch' });
  h.failSave(false); const receipt = await h.module.run(h.target);
  assert.equal(receipt.status, 'recovered'); assert.equal(h.writes.length, 1); assert.equal(h.calls.length, 1);
});
test('no-change is a model conclusion with real save check, not semantic acceptance', async () => {
  const h = harness({ reply: () => '[]' }); const receipt = await h.module.run(h.target);
  assert.equal(receipt.status, 'model_nochange'); assert.equal(receipt.semanticProof, false); assert.equal(h.writes.length, 0); assert.equal(h.saves.length, 1);
  assert.equal(h.parsed.length, 1); assert.equal(receipt.officialStateChanged, false);
  assert.equal(await h.module.validateReceipt(h.target, receipt), true);
  h.change({ stat_data: { coins: 99 } }); assert.equal(await h.module.validateReceipt(h.target, receipt), false);
});
test('empty model patch still persists official derived-state updates once without altering source fields', async () => {
  const h = harness({ reply: () => '[]', officialResult: (_block, input) => ({ ...input, stat_data: { ...input.stat_data, derivedTotal: 14 } }) });
  h.change({ stat_data: { coins: 7, derivedTotal: 0 } });
  const receipt = await h.module.run(h.target);
  assert.equal(receipt.status, 'applied'); assert.equal(receipt.operationCount, 0); assert.equal(receipt.officialStateChanged, true);
  assert.equal(h.parsed.length, 1); assert.equal(h.calls.length, 1); assert.equal(h.writes.length, 1); assert.equal(h.saves.length, 1);
  assert.deepEqual(h.current().stat_data, { coins: 7, derivedTotal: 14 });
  assert.deepEqual(h.saves[0], h.current()); assert.equal(receipt.afterHash, await digest(h.current()));
  assert.equal(receipt.readback, true); assert.equal(receipt.semanticProof, false);
  await h.module.run(h.target); assert.equal(h.parsed.length, 1, 'settled receipt does not replay official handlers');
});
test('official metadata-only changes are saved without claiming a state repair', async () => {
  const h = harness({ reply: () => '[]', officialResult: (_block, input) => ({ ...input, display_data: clone(input.stat_data) }) });
  const receipt = await h.module.run(h.target);
  assert.equal(receipt.status, 'model_nochange'); assert.equal(receipt.officialStateChanged, false);
  assert.equal(h.writes.length, 1); assert.equal(h.parsed.length, 1);
  assert.deepEqual(h.current().stat_data, { coins: 7 }); assert.deepEqual(h.saves[0], h.current());
});
test('unexecutable patch retries without converting a parser no-op into success', async () => {
  const h = harness({ officialResult: (_block, input) => input, unexecuted: operations => operations });
  await assert.rejects(h.module.run(h.target), { code: 'patch_no_effect' }); assert.equal(h.calls.length, 3); assert.equal(h.writes.length, 0);
});

test('multiple groups finish against one baseline before one official parse and durable save', async () => {
  let h;
  const source = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`v${i}`, i]));
  h = harness({ reply() {
    assert.equal(h.parsed.length, 0); assert.equal(h.writes.length, 0);
    return JSON.stringify([{ op: 'replace', path: h.calls.length === 1 ? '/v0' : '/v8', value: 20 }]);
  }, officialResult: (_block, input) => ({ ...input, stat_data: { ...input.stat_data, v0: 20, v8: 20 } }) });
  h.change({ stat_data: source }); const receipt = await h.module.run(h.target);
  assert.equal(receipt.groupCount, 2); assert.equal(receipt.groups.length, 2); assert.equal(h.calls.length, 2);
  assert.equal(h.parsed.length, 1); assert.equal(h.writes.length, 1); assert.equal(h.saves.length, 1);
  assert.equal(parsePatch(h.parsed[0].block).operations.length, 2);
  assert.deepEqual(h.current().stat_data, { ...source, v0: 20, v8: 20 });
  assert.ok(receipt.groups.every(group => !Object.hasOwn(group, 'messages')), 'do not persist the whole context again for each group');
});
test('later group failure retains earlier response in memory but never partially applies it', async () => {
  const h = harness({ reply: () => h.calls.length === 1 ? '[{"op":"replace","path":"/v0","value":20}]' : '[HTTP Error] synthetic failure' });
  const source = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`v${i}`, i])); h.change({ stat_data: source });
  await assert.rejects(h.module.run(h.target), { code: 'model_transport' });
  assert.equal(h.calls.length, 4, 'one successful group plus three attempts for the failing group');
  assert.equal(h.parsed.length, 0); assert.equal(h.writes.length, 0); assert.equal(h.saves.length, 0);
  assert.deepEqual(h.current().stat_data, source);
});
test('cross-group write is retried within the same group and cannot reach official MVU', async () => {
  const h = harness({ reply: () => '[{"op":"replace","path":"/unassigned","value":9}]' });
  await assert.rejects(h.module.run(h.target), { code: 'field_group_scope' });
  assert.equal(h.calls.length, 3); assert.equal(h.parsed.length, 0); assert.equal(h.writes.length, 0);
});
test('a model change between groups discards all earlier group results', async () => {
  const h = harness({ reply() { if (h.calls.length === 2) h.profile.model = 'changed'; return '[]'; } });
  h.change({ stat_data: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`v${i}`, i])) });
  await assert.rejects(h.module.run(h.target), { code: 'model_config_changed' });
  assert.equal(h.calls.length, 2); assert.equal(h.parsed.length, 0); assert.equal(h.writes.length, 0);
});

test('host binds scope, active swipe and preceding user, rejects later input', async () => {
  const ctx = { chatId: 'test', characterId: 0, characters: [{ avatar: 'fake.png' }], chat: [{ is_user: false, mes: '开场' }, { is_user: true, mes: '行动' }, { is_user: false, mes: '结果', swipe_id: 1, swipes: ['旧', '结果'] }], extensionSettings: {} };
  const host = createHost(() => ctx); const target = await host.capture();
  assert.equal(target.swipeId, 1); assert.equal(target.userText, '行动');
  ctx.chat[2].swipe_id = 0; assert.throws(() => host.assertTarget(target), { code: 'stale_target' });
  ctx.chat[2].swipe_id = 1; ctx.chat.push({ is_user: true, mes: '新行动' }); assert.throws(() => host.assertTarget(target), { code: 'stale_target' });
});
test('runtime requires generation end, waits500ms, uses fresh final and ignores dry runs', async () => {
  const scope = { chatId: 'synthetic' }, scopeKey = await digest(scope), calls = [], delays = [], storeValues = new Map();
  let target = null, baseline = 0;
  const host = { settings: () => ({ enabled: true, maxAttempts: 3 }), scope: () => scope, latestIndex: () => baseline,
    capture: async () => clone(target), delay: async ms => { delays.push(ms); } };
  const store = { read: async key => storeValues.get(key), write: async (key, value) => { storeValues.set(key, value); } };
  const variables = { version: 'candidate', run: async value => { calls.push(value); return { status: 'model_nochange', readback: true }; } };
  const runtime = createRuntime({ host, store, variables });
  const settle = () => new Promise(resolve => setTimeout(resolve, 15));
  runtime.started('normal', {}, true); runtime.ended(); await settle(); assert.equal(calls.length, 0);
  runtime.started('normal'); target = { scopeKey, identity: 'accepted', index: 2, userIndex: 1, content: '最终正文' }; baseline = 2;
  runtime.received(2); await settle(); assert.equal(calls.length, 0);
  runtime.ended(); runtime.ended(); await settle();
  assert.equal(calls.length, 1); assert.equal(calls[0].content, '最终正文'); assert.deepEqual(delays.slice(0, 2), [500, 150]);
  assert.equal(runtime.snapshot().modules.profiles, 'not_implemented'); assert.equal(runtime.snapshot().modules.world, 'not_implemented');
});

async function boundRuntimeHarness() {
  const listeners = new Map(), calls = [], delays = [], writes = [];
  const ctx = { chatId: 'synthetic-regenerate', characterId: 0, characters: [{ avatar: 'synthetic.png' }], extensionSettings: {},
    chat: [{ mes: '开场' }, { is_user: true, mes: '行动' }, { mes: '旧正文' }],
    eventSource: { on: (name, listener) => listeners.set(name, listener) } };
  const host = { ...createHost(() => ctx), delay: async ms => { delays.push(ms); } };
  const store = { read: async () => null, write: async (key, value) => { writes.push({ key, value: clone(value) }); } };
  const variables = { version: 'controlled', run: async value => { calls.push(clone(value)); return { status: 'model_nochange', readback: true }; } };
  const runtime = createRuntime({ host, store, variables });
  const settle = () => new Promise(resolve => setTimeout(resolve, 15));
  runtime.bind(); await settle();
  return { runtime, calls, delays, writes, settle,
    emit: (name, ...args) => { assert.ok(listeners.has(name)); listeners.get(name)(...args); },
    truncate: (index = 2) => { ctx.chat.length = index; },
    replace: () => { ctx.chat[2] = { mes: '新正文' }; },
    changeScope: () => { ctx.chatId = 'another-chat'; },
  };
}

test('bound regenerate events preserve the native initial deletion and accept the replacement once', async t => {
  for (const replyType of ['regenerate', 'normal']) await t.test(replyType, async () => {
    const h = await boundRuntimeHarness();
    h.emit('generation_started', 'regenerate'); h.truncate(); h.emit('message_deleted', 2);
    await h.settle();
    assert.equal(h.runtime.snapshot().status, 'waiting'); assert.equal(h.calls.length, 0);
    h.replace(); h.emit('message_received', 2, replyType); await h.settle();
    assert.equal(h.calls.length, 0, 'a received replacement without end is not accepted');
    h.emit('generation_ended'); h.emit('generation_ended'); await h.settle();
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].content, '新正文'); assert.equal(h.calls[0].index, 2);
    assert.deepEqual(h.delays, [500, 150]);
    assert.deepEqual(h.writes.map(v => v.value.status), ['accepted', 'settled']);
    assert.ok(h.writes.every(v => v.value.target.identity === h.calls[0].identity));
  });
});

test('bound deletion cancels every event outside the one initial regenerate boundary', async t => {
  const scenarios = [
    ['normal', h => h.emit('generation_started', 'normal'), h => { h.truncate(); h.emit('message_deleted', 2); }],
    ['continue', h => h.emit('generation_started', 'continue'), h => { h.truncate(); h.emit('message_deleted', 2); }],
    ['wrong index', h => h.emit('generation_started', 'regenerate'), h => { h.truncate(1); h.emit('message_deleted', 1); }],
    ['host not truncated', h => h.emit('generation_started', 'regenerate'), h => h.emit('message_deleted', 2)],
    ['missing index', h => h.emit('generation_started', 'regenerate'), h => { h.truncate(); h.emit('message_deleted'); }],
    ['second deletion', h => { h.emit('generation_started', 'regenerate'); h.truncate(); h.emit('message_deleted', 2); }, h => h.emit('message_deleted', 2)],
    ['replacement already received', h => { h.emit('generation_started', 'regenerate'); h.replace(); h.emit('message_received', 2, 'regenerate'); }, h => { h.truncate(); h.emit('message_deleted', 2); }],
    ['generation already ended', h => { h.emit('generation_started', 'regenerate'); h.emit('generation_ended'); }, h => { h.truncate(); h.emit('message_deleted', 2); }],
    ['scope changed', h => { h.emit('generation_started', 'regenerate'); h.changeScope(); }, h => { h.truncate(); h.emit('message_deleted', 2); }],
    ['no generation', () => {}, h => { h.truncate(); h.emit('message_deleted', 2); }],
  ];
  for (const [name, start, remove] of scenarios) await t.test(name, async () => {
    const h = await boundRuntimeHarness(); start(h); remove(h); await h.settle();
    h.replace(); h.emit('message_received', 2, 'regenerate'); h.emit('generation_ended'); await h.settle();
    assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
  });
});

test('bound stop cancels an exempted regeneration and native swipe ordering still runs once', async () => {
  const h = await boundRuntimeHarness();
  h.emit('generation_started', 'regenerate'); h.truncate(); h.emit('message_deleted', 2);
  h.emit('generation_stopped'); h.replace(); h.emit('message_received', 2, 'regenerate'); h.emit('generation_ended'); await h.settle();
  assert.equal(h.calls.length, 0); assert.equal(h.writes.length, 0);
  h.emit('message_swiped', 2); h.emit('generation_started', 'swipe'); h.replace();
  h.emit('message_received', 2, 'swipe'); h.emit('generation_ended'); await h.settle();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].content, '新正文');
  assert.deepEqual(h.writes.map(v => v.value.status), ['accepted', 'settled']);
});
