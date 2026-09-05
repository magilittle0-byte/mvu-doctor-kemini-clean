// Controlled checks of production functions; not real Tavern acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clone, digest, fault, parsePatch, compileOwnership, checkOwnership } from '../modular/variables/core.mjs';
import { createVariableModule } from '../modular/variables/module.mjs';
import { createHost } from '../modular/host.mjs';
import { createRuntime } from '../modular/runtime.mjs';

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
test('format recovery keeps a unique patch; errors and conflicting blocks fail', () => {
  assert.equal(parsePatch('说明\n```json\n[{"op":"delta","path":"/coins","value":5,},]\n```').operations[0].value, 5);
  assert.throws(() => parsePatch('[HTTP Error] connection failed'), { code: 'model_transport' });
  assert.throws(() => parsePatch('<JSONPatch>[]</JSONPatch><JSONPatch>[]</JSONPatch>'), { code: 'patch_ambiguous' });
  assert.throws(() => parsePatch('[{"op":"run","path":"/x"}]'), { code: 'patch_operation' });
});

function harness(overrides = {}) {
  let current = { stat_data: { coins: 7 } }, stale = false, saveFailure = false;
  const values = new Map(), calls = [], parsed = [], writes = [], saves = [];
  const target = { scopeKey: 'chat-a', identity: 'reply-a', index: 2, swipeId: 0, content: '获奖7枚金币。', userText: '领取奖励。' };
  const host = {
    assertTarget() { if (stale) throw fault('stale_target', 'changed'); },
    previousMvu: async () => ({ index: 0, payload: { stat_data: { coins: 5 } } }),
    contextSnapshot: () => ({ chat: [{ mes: target.content }] }),
    settings: () => ({ maxAttempts: 3, globalPrompt: '' }),
    async saveChat(_target, candidate) { saves.push(clone(candidate)); if (saveFailure) throw fault('host_mvu_durable_mismatch', 'failed'); },
    async readback() { if (saveFailure) throw fault('host_mvu_durable_mismatch', 'failed'); },
    delay: async () => {},
  };
  const mvu = {
    getMvuData: async () => clone(current),
    parseMessage: async (block, input) => { parsed.push({ block, input: clone(input) }); return { ...input, stat_data: { coins: 12 } }; },
    replaceMvuData: async (value, options) => { writes.push({ value: clone(value), options }); current = clone(value); },
  };
  const settings = { mode: 'profile', profileId: 'synthetic-model', maxTokens: 4096 };
  const so = { getMvu: async () => mvu, mvuIsBusy: () => false, getSettings: () => settings,
    diagPickerActive: () => false, collectMvuUpdateRules: async () => ['coins tracks actual acquired money'],
    extractUpdateBlock: () => '', buildDiagnosePromptFrom: (_ctx, _s, args) => { assert.equal(args.auto, false); return 'native'; },
    callProfile: async (...args) => { calls.push(args); return overrides.reply?.() ?? '[{"op":"delta","path":"/coins","value":5}]'; },
    refreshMessageBar: () => {},
  };
  const store = { read: async key => clone(values.get(key) ?? null), write: async (key, value) => { values.set(key, clone(value)); await overrides.onStore?.(key, value); } };
  const module = createVariableModule({ host, store, story: () => so });
  return { module, host, store, so, mvu, target, values, calls, parsed, writes, saves, settings,
    change: value => { current = value; }, stale: () => { stale = true; }, failSave: value => { saveFailure = value; }, current: () => clone(current) };
}
test('uses current7 and prior5 evidence; delegates residual+5 once to official MVU for final12', async () => {
  const h = harness(); const receipt = await h.module.run(h.target);
  assert.equal(receipt.status, 'applied'); assert.equal(receipt.readback, true); assert.equal(receipt.semanticProof, false);
  assert.equal(h.parsed.length, 1); assert.equal(h.parsed[0].input.stat_data.coins, 7);
  assert.equal(parsePatch(h.parsed[0].block).operations[0].value, 5);
  assert.deepEqual(h.writes[0].options, { type: 'message', message_id: 2 }); assert.equal(h.saves[0].stat_data.coins, 12);
  assert.match(h.calls[0][1][0].content, /"coins":5/); assert.match(h.calls[0][1][0].content, /领取奖励/);
  await h.module.run(h.target); assert.equal(h.calls.length, 1, 'valid settled receipt prevents duplicate work');
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
test('prewrite drift abandons prepared intent and does not create a false recovery conflict', async () => {
  let changed = false;
  const h = harness({ onStore(_key, value) { if (value.status === 'committing' && !changed) { changed = true; h.change({ stat_data: { coins: 9 } }); } } });
  await assert.rejects(h.module.run(h.target), { code: 'stale_mvu' }); assert.equal(h.writes.length, 0);
  assert.equal(h.values.get('variables:chat-a:reply-a').status, 'abandoned');
  await h.module.run(h.target); assert.equal(h.writes.length, 1);
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
  assert.equal(await h.module.validateReceipt(h.target, receipt), true);
  h.change({ stat_data: { coins: 99 } }); assert.equal(await h.module.validateReceipt(h.target, receipt), false);
});
test('unexecutable patch retries without converting a parser no-op into success', async () => {
  const h = harness(); h.mvu.parseMessage = async (_block, input) => input;
  await assert.rejects(h.module.run(h.target), { code: 'patch_no_effect' }); assert.equal(h.calls.length, 3); assert.equal(h.writes.length, 0);
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
