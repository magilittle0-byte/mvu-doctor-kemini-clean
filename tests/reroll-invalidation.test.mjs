import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtimeHarness(initialChat = [{ is_user: true, is_system: false, mes: '进入场景' }]) {
  const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const prompts = [];
  const uiRoot = {
    dataset: {},
    querySelector() {
      return {
        textContent: '', addEventListener() {}, checked: false, value: '',
        classList: { toggle() {} }, setAttribute() {}, removeAttribute() {},
        appendChild() {},
      };
    },
    querySelectorAll() { return []; },
    classList: { toggle() {} },
  };
  const context = {
    chatId: 'reroll-chat',
    chat: structuredClone(initialChat),
    chatMetadata: {},
    extensionSettings: {},
    eventTypes: {
      GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended',
      GENERATION_STOPPED: 'generation_stopped', MESSAGE_SWIPED: 'message_swiped',
      CHAT_CHANGED: 'chat_changed', CHAT_LOADED: 'chat_loaded',
    },
    eventSource: { on(name, handler) { handlers.set(name, handler); } },
    setExtensionPrompt(_key, value) { prompts.push(String(value || '')); },
    saveSettingsDebounced() {},
    async saveMetadata() {},
  };
  const mvuByMessage = new Map([
    [1, { stat_data: { 人物档案: { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } } } }],
  ]);
  const Mvu = {
    async getMvuData({ message_id: messageId }) {
      return structuredClone(mvuByMessage.get(messageId) || { stat_data: {} });
    },
    async replaceMvuData(data, { message_id: messageId }) {
      mvuByMessage.set(messageId, structuredClone(data));
    },
  };
  const sandbox = {
    window: { SillyTavern: { getContext: () => context }, Mvu, crypto: globalThis.crypto },
    document: {
      currentScript: null,
      getElementById: () => uiRoot,
      createElement: () => ({
        textContent: '', className: '', dataset: {}, style: {}, value: '', checked: false,
        classList: { toggle() {}, add() {}, remove() {} },
        appendChild() {}, append() {}, remove() {}, addEventListener() {}, setAttribute() {},
      }),
      body: { appendChild() {} },
      addEventListener() {},
    },
    console: { info() {}, error() {}, warn() {} },
    setTimeout, clearTimeout, structuredClone,
  };
  vm.runInNewContext(source, sandbox, { filename: 'index.js' });
  return { context, handlers, prompts, mvuByMessage };
}

test('regenerate restores the logical floor checkpoint before building the new injection', async () => {
  const harness = runtimeHarness();
  await new Promise((resolve) => setTimeout(resolve, 20));

  const start = harness.handlers.get('generation_started');
  const stop = harness.handlers.get('generation_stopped');
  assert.equal(typeof start, 'function');
  assert.equal(typeof stop, 'function');
  assert.equal(typeof harness.handlers.get('message_swiped'), 'function');

  await start('normal', {}, false);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.replyCheckpoint.targetIndex, 1);
  assert.deepEqual(store.replyCheckpoint.state.profiles, {});
  stop();

  harness.context.chat.push({ is_user: false, is_system: false, mes: '被放弃的旧回复', swipe_id: 0 });
  store.profiles = { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } };
  store.world.summary = 'REJECTED_WORLD';
  store.diagnostics = [{ messageId: 1, kind: 'completed', detail: 'REJECTED_DIAGNOSTIC' }];
  store.fullRuns = [{ messageId: 1, acceptedText: 'REJECTED_RUN' }];

  await start('regenerate', {}, false);

  assert.deepEqual(store.profiles, {});
  assert.notEqual(store.world.summary, 'REJECTED_WORLD');
  assert.deepEqual(store.diagnostics, []);
  assert.deepEqual(store.fullRuns, []);
  const finalInjection = harness.prompts.filter(Boolean).at(-1);
  assert.ok(finalInjection);
  assert.doesNotMatch(finalInjection, /REJECTED_PROFILE|REJECTED_WORLD|被放弃的旧回复/);
});

test('real Tavern timing checkpoints the future assistant floor before the user message is appended', async () => {
  const harness = runtimeHarness([{ is_user: false, is_system: false, mes: '默认开场' }]);
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.replyCheckpoint.targetIndex, 2);
  assert.equal(store.replyCheckpoint.priorAssistantIndex, 0);
  harness.handlers.get('generation_stopped')();

  harness.context.chat.push({ is_user: true, is_system: false, mes: '进入场景' });
  harness.context.chat.push({ is_user: false, is_system: false, mes: '被放弃的旧回复', swipe_id: 0 });
  harness.mvuByMessage.set(2, { stat_data: { 人物档案: { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } } } });
  store.profiles = { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } };
  store.world.summary = 'REJECTED_WORLD';

  await harness.handlers.get('generation_started')('regenerate', {}, false);

  assert.deepEqual(store.profiles, {});
  assert.notEqual(store.world.summary, 'REJECTED_WORLD');
  assert.doesNotMatch(harness.prompts.filter(Boolean).at(-1), /REJECTED_PROFILE|REJECTED_WORLD|被放弃的旧回复/);
});

test('manual latest-message swipe restores the same pre-generation authority state', async () => {
  const harness = runtimeHarness();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.handlers.get('generation_stopped')();

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  harness.context.chat.push({ is_user: false, is_system: false, mes: '旧 swipe', swipe_id: 1 });
  store.profiles = { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } };
  store.world.summary = 'REJECTED_WORLD';

  harness.handlers.get('message_swiped')(1);
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(store.profiles, {});
  assert.notEqual(store.world.summary, 'REJECTED_WORLD');
  assert.equal(harness.prompts.at(-1), '');
});

test('the accepted reroll restores only the Doctor-owned profile root before post-processing', async () => {
  const harness = runtimeHarness();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.handlers.get('generation_stopped')();

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  harness.context.chat.push({ is_user: false, is_system: false, mes: '被放弃的旧回复', swipe_id: 0 });
  store.profiles = { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } };
  await harness.handlers.get('generation_started')('regenerate', {}, false);

  const rerolledMvu = harness.mvuByMessage.get(1);
  rerolledMvu.stat_data.其他系统字段 = { preserved: true };
  harness.mvuByMessage.set(1, rerolledMvu);
  harness.context.chat[1] = { is_user: false, is_system: false, mes: '新的重 roll 回复', swipe_id: 1 };
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 560));

  const settled = harness.mvuByMessage.get(1);
  assert.deepEqual(settled.stat_data.人物档案, {});
  assert.deepEqual(settled.stat_data.其他系统字段, { preserved: true });
});
