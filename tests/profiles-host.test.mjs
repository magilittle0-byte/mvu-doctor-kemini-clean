import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileHost } from '../profiles/host.mjs';
import { digest } from '../modular/variables/core.mjs';

async function apiHarness() {
  const captured = { direct: [], profile: [] };
  const settings = {
    mode: 'direct', endpoint: 'https://example.invalid/v1', model: 'synthetic-model',
    profileId: 'synthetic-profile', maxTokens: 2048, sendTemperature: false,
    diagnoseSystemPrompt: '', applyRegex: true, contextDepth: 5, includeHiddenFloors: false, worldInfoMode: 'default',
  };
  const payload = { stat_data: { checked: true } };
  const ownSettings = { globalPrompt: '' };
  const receipt = { target: { index: 1, scopeKey: 'scope-a' }, identity: 'identity-a',
    afterHash: await digest(payload), readback: true, ruleHash: await digest('world-rules'),
    schemaHash: await digest('synthetic-schema') };
  const doctor = { ready: true, locked: true, status: () => ({ busy: false, inFlight: false, status: 'applied' }), record: () => receipt };
  const updateConfigHash = async () => {
    receipt.configHash = await digest({ routeHash: 'route-hash', mode: settings.mode, model: settings.model,
      profileId: settings.profileId, maxTokens: settings.maxTokens, temperature: null,
      diagnosisPrompt: settings.diagnoseSystemPrompt || '', applyRegex: settings.applyRegex,
      contextDepth: settings.contextDepth, includeHiddenFloors: settings.includeHiddenFloors,
      worldInfoMode: settings.worldInfoMode, globalPrompt: ownSettings.globalPrompt });
  };
  const internals = {
    getSettings: () => settings,
    getMvu: async () => ({ getMvuData: async () => payload }),
    diagPickerActive: () => false,
    buildDiagSelectedWi: async () => ({}),
    buildWorldInfo: async () => 'world-rules',
    wiContextMode: () => '',
    collectMvuUpdateRules: async () => [],
    extractUpdateBlock: () => null,
    buildDiagnosePromptFrom: () => '',
    resolveModePrompt: () => '',
    buildTranscriptTurns: () => [],
    buildTranscript: () => '',
    buildCardSection: () => '',
    callDirect: async (_url, _key, body) => { captured.direct.push(structuredClone(body)); return 'direct-result'; },
    resolveEndpointUrl: () => settings.endpoint,
    callProfile: async (...args) => { captured.profile.push(structuredClone(args)); return 'profile-result'; },
    refreshMessageBar: () => {},
    mvuIsBusy: () => false,
  };
  const api = {
    isCompatible: version => version === 1,
    unsafe: { eval: source => source.includes('getSettings') ? internals : {
      messageVisibleForTranscript: () => true,
      stripMechanismBlocks: value => value,
    } },
  };
  const previous = globalThis.StoryOracleAPI;
  globalThis.StoryOracleAPI = api;
  const host = createProfileHost({
    context: () => ({}), assertTarget: () => {}, modelRouteHash: async () => 'route-hash',
    settings: () => ownSettings, variableSchemaMaterial: () => 'synthetic-schema',
  }, () => doctor);
  await updateConfigHash();
  return { host, settings, receipt, captured, updateConfigHash, restore() {
    if (previous === undefined) delete globalThis.StoryOracleAPI;
    else globalThis.StoryOracleAPI = previous;
  } };
}

test('profile host preserves P2 roles on both routes and keeps shared string callers as one user message', async t => {
  const h = await apiHarness();
  t.after(h.restore);
  const messages = [
    { role: 'system', content: 'P2 fixed profile task and strict JSON contract.' },
    { role: 'user', content: 'Separated reference data and final narrative.' },
  ];
  const signal = new AbortController().signal;

  assert.equal(await h.host.callModel(h.receipt, messages, signal), 'direct-result');
  assert.equal(h.captured.direct.length, 1);
  assert.deepEqual(h.captured.direct[0].messages, messages);

  h.settings.mode = 'profile';
  await h.updateConfigHash();
  assert.equal(await h.host.callModel(h.receipt, messages, signal), 'profile-result');
  assert.equal(h.captured.profile.length, 1);
  assert.deepEqual(h.captured.profile[0][1], messages);

  h.settings.mode = 'direct';
  await h.updateConfigHash();
  const p3Prompt = 'Native world-engine prompt remains a string.';
  assert.equal(await h.host.callModel(h.receipt, p3Prompt, signal), 'direct-result');
  assert.equal(h.captured.direct.length, 2);
  assert.deepEqual(h.captured.direct[1].messages, [{ role: 'user', content: p3Prompt }]);
});
