import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideHost, GUIDE_PROMPT_KEY, GUIDE_SETTINGS_KEY } from '../guide/host.mjs';

// Synthetic source and transport only: these checks are not real-host acceptance.
function fixture() {
  const prompts = new Map([['foreign', 'keep']]);
  const calls = [];
  const ctx = {
    chatId: 'fixture-chat', characterId: 0, groupId: null, name1: 'Player', name2: 'Guide', mainApi: 'openai',
    characters: [{ name: 'Fiction', avatar: 'fixture.png', data: { extensions: { world: 'fixture-book' } } }],
    chatMetadata: {}, chat: [{ mes: 'Opening', is_user: false }, { mes: 'Wait', is_user: true }, { mes: 'A shield breaks.', is_user: false, swipe_id: 0, swipes: ['A shield breaks.'] }],
    extensionSettings: { foreign: { enabled: true }, connectionManager: { selectedProfile: 'obsolete' } },
    chatCompletionSettings: { model: 'current-model', chat_completion_source: 'fixture-source', stream_openai: true },
    getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    setExtensionPrompt: (key, value) => prompts.set(key, value), saveSettingsDebounced: () => calls.push('settings'),
    getCharacterCardFields: () => ({ description: 'Fictional rules.', personality: 'Careful.' }),
    getWorldInfoPrompt: async (chat, budget, dryRun) => {
      calls.push({ scan: true, chat, budget, dryRun });
      return { worldInfoBefore: 'before', worldInfoAfter: 'after', anBefore: ['an before'], anAfter: ['an after'],
        worldInfoDepth: [{ entries: ['depth'] }], worldInfoExamples: [{ content: 'example' }], outletEntries: { item: ['outlet'] } };
    },
  };
  ctx.ChatCompletionService = {
    presetToGeneratePayload: async (preset, overrides, payload) => ({ chat_completion_source: ctx.chatCompletionSettings.chat_completion_source,
      credential_slot: 'synthetic-slot', ...payload }),
    sendRequest: async (payload, extract, signal) => { calls.push({ payload, extract, signal }); return { content: '{"ok":true}' }; },
  };
  const dependencies = { getContext: () => ctx, getCore: async () => ({ getMaxPromptTokens: () => 16000 }),
    getOpenAI: async () => ({ getChatCompletionModel: settings => settings.model }),
    getDocument: () => ({ body: { dataset: { generating: 'false' } } }),
    fetchImpl: async () => ({ ok: true, json: async () => [{ chat_metadata: {} }, ...structuredClone(ctx.chat)] }),
  };
  return { ctx, prompts, calls, dependencies, host: createGuideHost(dependencies) };
}

test('exact prefix protects current target when an earlier floor changes', async () => {
  const { host, ctx } = fixture();
  const target = await host.capture();
  assert.equal(target.index, 2);
  assert.equal((await host.branches()).at(-1).lineage, target.lineage);
  ctx.chat[0].mes = 'An edited opening';
  assert.throws(() => host.assertTarget(target), { code: 'stale_target' });
  const changed = await host.capture();
  assert.equal(changed.identity, target.identity);
  assert.notEqual(changed.lineage, target.lineage);
  ctx.chat[2].swipes[0] = 'Partial new swipe';
  assert.equal(await host.capture(), null);
});

test('history keeps every intermediate assistant target and rejects cross-chat results', async () => {
  const { host, ctx } = fixture();
  const old = await host.capture();
  ctx.chat.push({ is_user: true, mes: 'Visit the smith.' }, { is_user: false, mes: 'The workshop is closed.' },
    { is_user: true, mes: 'Come back tomorrow.' }, { is_user: false, mes: 'The workshop opens.' });
  assert.equal(host.assertTarget(old), true);
  const latest = await host.capture();
  const history = await host.captureHistory(latest, old.index);
  assert.deepEqual(history.map(row => row.index), [4, 6]);
  assert.deepEqual(history.map(row => row.userText), ['Visit the smith.', 'Come back tomorrow.']);
  ctx.chatId = 'other-chat';
  assert.throws(() => host.assertTarget(latest), { code: 'stale_target' });
});

test('persisted target readback checks the whole prefix without saving host data', async () => {
  const f = fixture();
  let saveCalls = 0;
  f.ctx.saveChat = () => { saveCalls++; };
  assert.equal(await f.host.readback(await f.host.capture()), true);
  const host = createGuideHost({ ...f.dependencies, fetchImpl: async () => ({ ok: true, json: async () => [
    { chat_metadata: {} }, { mes: 'Wrong old floor', is_user: false }, ...structuredClone(f.ctx.chat.slice(1)),
  ] }) });
  await assert.rejects(host.readback(await host.capture()), { code: 'host_readback_target' });
  assert.equal(saveCalls, 0);
});

test('settings and prompt changes remain in the guidance namespace', () => {
  const { host, ctx, prompts } = fixture();
  host.updateSettings({ enabled: false, detailsOpen: true, foreign: 'overwrite', apiKey: 'not-allowed' });
  assert.deepEqual(ctx.extensionSettings.foreign, { enabled: true });
  assert.deepEqual(Object.keys(ctx.extensionSettings[GUIDE_SETTINGS_KEY]).sort(), ['detailsOpen', 'enabled', 'maxTokens']);
  host.setPrompt('Visible clue only');
  assert.equal(prompts.get(GUIDE_PROMPT_KEY), 'Visible clue only');
  host.destroy(); host.destroy();
  assert.equal(prompts.get(GUIDE_PROMPT_KEY), '');
  assert.equal(prompts.get('foreign'), 'keep');
  assert.throws(() => host.scope(), { code: 'host_disposed' });
});

test('material uses only observed main activation and never invokes a world scan', async () => {
  const { host, ctx } = fixture();
  let scans = 0;
  ctx.getWorldInfoPrompt = () => { scans++; throw new Error('would mutate another prompt'); };
  const target = await host.capture();
  const entries = [{ content: 'Iron can be repaired with tools.' }, { disable: true, content: 'Disabled rule.' }];
  const unknown = await host.material(target, 0, { activatedEntries: entries, observed: false });
  assert.equal(unknown.authority.world, '');
  assert.equal(unknown.worldMode, 'unavailable');
  assert.ok(unknown.limitations.length);
  const observed = await host.material(target, 0, { activatedEntries: entries, observed: true });
  assert.equal(observed.authority.world, 'Iron can be repaired with tools.');
  assert.equal(observed.worldMode, 'observed-main-activation');
  assert.deepEqual(observed.history.map(row => row.role), ['user', 'assistant']);
  assert.equal(scans, 0);
});

test('request uses the current native model and one actual abort signal', async () => {
  const { host, ctx, calls } = fixture();
  await host.request([{ role: 'user', content: 'Synthetic check' }]);
  const call = calls.find(row => row.payload);
  assert.equal(call.payload.model, 'current-model');
  assert.equal(call.payload.stream, false);
  assert.equal(call.extract, true);
  assert.equal(ctx.extensionSettings.connectionManager.selectedProfile, 'obsolete');
  let resolveStarted, rejectTransport, receivedSignal;
  const started = new Promise(resolve => { resolveStarted = resolve; });
  ctx.ChatCompletionService.sendRequest = (payload, extract, signal) => {
    receivedSignal = signal;
    resolveStarted();
    return new Promise((resolve, reject) => { rejectTransport = reject; });
  };
  const ctl = new AbortController();
  const pending = host.request([{ role: 'user', content: 'Synthetic check' }], { signal: ctl.signal });
  await started;
  ctl.abort();
  assert.equal(receivedSignal.aborted, true);
  // Cancellation cannot free the slot before the underlying call settles.
  await assert.rejects(host.request([{ role: 'user', content: 'another' }]), { code: 'request_in_progress' });
  rejectTransport(new Error('synthetic transport ended'));
  await assert.rejects(pending, { code: 'cancelled' });
});

test('connection drift and raw transport errors cannot become accepted results', async () => {
  const { host, ctx } = fixture();
  ctx.ChatCompletionService.sendRequest = async () => { ctx.chatCompletionSettings.model = 'different-model'; return { content: 'late result' }; };
  await assert.rejects(host.request([{ role: 'user', content: 'test' }]), { code: 'model_route_changed' });
  ctx.ChatCompletionService.sendRequest = async () => { throw new Error('sensitive-provider-detail'); };
  await assert.rejects(host.request([{ role: 'user', content: 'test' }]), error => error.code === 'model_transport' && !error.message.includes('sensitive-provider-detail'));
});
