import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('runtime loads only pinned reference engines and the new profile adapter', () => {
  const source = read('index.js');
  assert.match(source, /vendor\/story-oracle-v1\.35\.4\/index\.js/);
  assert.match(source, /vendor\/world-engine-v3\.0\.2\/world-engine\.js/);
  assert.match(source, /profile-engine\.js/);
  assert.match(source, /initializeWorldbookSelectionOnce/);
  assert.match(source, /installWorldbookSelectionInitializer/);
  assert.doesNotMatch(source, /synchronizeSharedApiSettings|evolveMode:\s*'manual'|engineEnabled:\s*true,\s*injectIntoPrompt/);
  assert.match(source, /autoDiagnoseEnabled !== false/);
  assert.doesNotMatch(source, /legacy\/0\.7\.5|embeddedCore|advanceWorld|applyWorldProposal|auditVariables/);
});

test('native World bridge installs only the MVU filter, diagnosis barrier, and single-flight worldbook initializer', () => {
  const index = read('index.js');
  assert.match(index, /function filterMvuMechanismBlocks\(value\)/);
  assert.match(index, /function installWorldDialogueFilterBridge\(\)/);
  assert.match(index, /function publishWorldbookBridgeStatus\(status, detail = '', expectedChatId = ''\)/);
  assert.match(index, /window\.MVUDoctorWorldbookBridgeStatus = \{/);
  const boot = index.slice(index.indexOf('async function boot'), index.lastIndexOf('boot().catch'));
  assert.ok(boot.indexOf('migrateWorldSettings(') < boot.indexOf('installWorldDialogueFilterBridge()'));
  const migration = index.slice(index.indexOf('function migrateWorldSettings'), index.indexOf('async function initializeWorldbookSelectionOnce'));
  assert.match(migration, /forced08Signature/);
  assert.match(migration, /worldCore\?\.\[WORLD_DIALOGUE_FILTER_BRIDGE\]\?\.original \|\| worldCore\?\.filterDialogue/);
  assert.match(migration, /filterDialogue\(probe\.sample, \{ \.\.\.current, evolveFilterRegex: customFilterRegex \}\)/);
  assert.match(migration, /filtered !== probe\.expected/);
  assert.match(migration, /MVU_DOCTOR_CLOSED_OUTER_090/);
  assert.match(migration, /MVU_DOCTOR_CLOSED_INNER_090/);
  assert.match(migration, /MVU_DOCTOR_OPEN_OUTER_090/);
  assert.match(migration, /MVU_DOCTOR_OPEN_INNER_090/);
  assert.match(migration, /\.\.\.\(requiresMandatoryPrefix \? MVU_DIALOGUE_FILTERS : \[\]\)/);
  assert.match(migration, /\.\.\.nonMandatoryLines/);
  assert.ok(index.includes("'/<UpdateVariable>[\\\\s\\\\S]*?<\\\\/UpdateVariable>/gi'"));
  assert.ok(index.includes("'/<UpdateVariable>[\\\\s\\\\S]*$/i'"));

  const worldbook = index.slice(index.indexOf('function ensureWorldbookSelectionForCurrentChat'), index.indexOf('function installWorldbookSelectionInitializer'));
  assert.match(worldbook, /worldbookInitialization\.chatId === currentChatId && worldbookInitialization\.promise/);
  assert.match(worldbook, /return worldbookInitialization\.promise/);
  assert.match(worldbook, /worldbookInitialization = \{ chatId: currentChatId, promise, attempt \}/);
  assert.match(worldbook, /worldbookInitialization\.attempt === attempt/);
  assert.match(worldbook, /if \(!ready && worldbookInitialization\.chatId === currentChatId/);
  assert.match(worldbook, /worldbookInitialization\.promise = null/);

  const barrier = index.slice(index.indexOf('function installWorldEvolutionDiagnosisBarrier'), index.indexOf('function assertWorldContract'));
  assert.match(barrier, /const original = evolution\.evolve\.bind\(evolution\)/);
  assert.match(barrier, /let ready = await ensureWorldbookSelectionForCurrentChat\(2\)/);
  assert.match(barrier, /worldbookInitialization\.promise = null/);
  assert.match(barrier, /ready = await ensureWorldbookSelectionForCurrentChat\(3\)/);
  assert.match(barrier, /const stillEvolutionChat = \(\) =>/);
  assert.match(barrier, /if \(!stillEvolutionChat\(\)\) return false/);
  assert.match(barrier, /publishWorldbookBridgeStatus\(/);
  assert.match(barrier, /const safeAiMsg = filterMvuMechanismBlocks\(aiMsg\)/);
  assert.match(barrier, /dialogueText: filterMvuMechanismBlocks\(opts\.dialogueText\)/);
  assert.match(barrier, /await window\.MVUDoctorProfileEngine\?\.waitForWorldDiagnosis\?\./);
  assert.match(barrier, /if \(receipt\?\.status === 'stale'\) return false/);
  assert.match(barrier, /return original\(state, userMsg, safeAiMsg, safeOpts\)/);

  const profile = read('profile-engine.js');
  const gate = profile.slice(profile.indexOf('function diagnosisCheckpointSettled'), profile.indexOf('const runtime ='));
  const fixedFilter = profile.slice(profile.indexOf('function worldFilteredDialogue'), profile.indexOf('function worldGateTargetMatches'));
  assert.match(fixedFilter, /replace\(\/<UpdateVariable>/);
  assert.match(fixedFilter, /<\\\/UpdateVariable>\/gi, ''\)/);
  assert.match(fixedFilter, /<UpdateVariable>\[\\s\\S\]\*\$\/i, ''\)/);
  assert.match(gate, /\['failed', 'stale', 'cancelled', 'complete'\]/);
  assert.match(gate, /text\(checkpoint\.nextStep\) !== 'diagnosis'/);
  assert.match(gate, /if \(!worldGateTargetMatches\(live, expected\)\) return \{ ok: false, status: 'stale' \}/);
  assert.match(gate, /status: checkpoint\.status === 'failed' \? 'diagnosis-failed' : 'diagnosis-complete'/);
  assert.match(gate, /let bindingGenerationKey = ''/);
  assert.match(gate, /checkpointGenerationKey === bindingGenerationKey/);
  assert.match(gate, /activeGenerationKey !== bindingGenerationKey/);
  assert.match(gate, /active\?\.status === 'processing'/);
  assert.match(gate, /missingHandoffPolls >= 20/);
  assert.match(gate, /status: 'diagnosis-handoff-missing'/);
  assert.match(gate, /setTimeout\(resolve, 100\)/);
  assert.match(gate, /worldGateScopeMatches\(runtime\.manualDiagnosisBinding, expected\)/);
  assert.match(gate, /manualDiagnosisOwns/);
  const manual = profile.slice(profile.indexOf('async function runManualDiagnosisAndResume'), profile.indexOf('function cancelCurrentTaskFromUi'));
  assert.match(manual, /token: \+\+runtime\.manualDiagnosisSerial/);
  assert.match(manual, /runtime\.manualDiagnosisBinding = deepClone\(manualBinding\)/);
  assert.match(manual, /runtime\.manualDiagnosisBinding\?\.token === manualBinding\.token/);
  assert.match(profile, /waitForWorldDiagnosis,\s*\n/);
});

test('native core filtering keeps user filters while stripping MVU blocks before and after backfill filtering', () => {
  const index = read('index.js');
  const filter = index.slice(index.indexOf('function filterMvuMechanismBlocks'), index.indexOf('function installWorldDialogueFilterBridge'));
  const bridge = index.slice(index.indexOf('function installWorldDialogueFilterBridge'), index.indexOf('function publishWorldbookBridgeStatus'));
  const calls = [];
  const sandbox = {
    window: {
      WORLD_ENGINE_CORE: {
        filterDialogue(value, settings) {
          calls.push({ value: String(value), settings: structuredClone(settings) });
          const userFiltered = String(value).replace(/USER_FILTER_SENTINEL/gu, '');
          // The post-filter strip also protects against a native/custom filter
          // accidentally reintroducing a mechanism block in its return value.
          return `${userFiltered}<UpdateVariable><JSONPatch>REINTRODUCED</JSONPatch></UpdateVariable>`;
        },
      },
    },
  };
  vm.runInNewContext(`
    const WORLD_DIALOGUE_FILTER_BRIDGE = Symbol.for('mvu-doctor.native-world-dialogue-filter');
    ${filter}
    ${bridge}
    this.installWorldDialogueFilterBridge = installWorldDialogueFilterBridge;
  `, sandbox);
  assert.equal(sandbox.installWorldDialogueFilterBridge(), true);
  assert.equal(sandbox.installWorldDialogueFilterBridge(), true, 'bridge installation is idempotent');
  const settings = { evolveFilterRegex: '/USER_FILTER_SENTINEL/gu' };
  const output = sandbox.window.WORLD_ENGINE_CORE.filterDialogue(
    '公开A<UpdateVariable><JSONPatch>PRIVATE</JSONPatch></UpdateVariable>USER_FILTER_SENTINEL公开B',
    settings,
  );
  assert.equal(output, '公开A公开B');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].value, '公开AUSER_FILTER_SENTINEL公开B');
  assert.deepEqual(calls[0].settings, settings);
});

test('native World retries a false prewarm once per chat and filters MVU mechanism blocks in memory', async () => {
  const index = read('index.js');
  const filter = index.slice(index.indexOf('function filterMvuMechanismBlocks'), index.indexOf('function publishWorldbookBridgeStatus'));
  const status = index.slice(index.indexOf('function publishWorldbookBridgeStatus'), index.indexOf('function context'));
  const worldbook = index.slice(index.indexOf('async function initializeWorldbookSelectionOnce'), index.indexOf('function installWorldbookSelectionInitializer'));
  const barrier = index.slice(index.indexOf('function installWorldEvolutionDiagnosisBarrier'), index.indexOf('function assertWorldContract'));

  const makeHarness = (availableAt, options = {}) => {
    const calls = { loads: 0, saves: 0, waits: [], originals: [] };
    let selected = false;
    let activeChat = 'chat-a';
    const sandbox = {
      console,
      setTimeout: (resolve) => { resolve(); return 0; },
      window: {
        WORLD_ENGINE_WORLDBOOK: {
          getChatId: () => activeChat,
          hasSelection: () => selected,
          loadCurrentEntries: async () => {
            calls.loads += 1;
            if (typeof options.loadCurrentEntries === 'function') {
              return options.loadCurrentEntries(calls.loads);
            }
            return calls.loads >= availableAt ? [{ id: 'embedded-1', disabled: false }] : [];
          },
          saveSelectedIds: (ids, scope) => {
            calls.saves += 1;
            calls.selected = { ids: [...ids], scope };
            selected = true;
          },
        },
        WORLD_ENGINE_API: {
          // Simulate the user deleting the persistent filter in the same session.
          getSettings: () => ({ evolveFilterRegex: '' }),
        },
        MVUDoctorProfileEngine: {
          waitForWorldDiagnosis: async (input) => {
            calls.waits.push(structuredClone(input));
            if (typeof options.waitForWorldDiagnosis === 'function') {
              return options.waitForWorldDiagnosis(input);
            }
            return { ok: true, status: 'diagnosis-complete' };
          },
        },
        WORLD_ENGINE_EVOLUTION: {
          async evolve(...args) {
            calls.originals.push(structuredClone(args));
            return 'native-evolved';
          },
        },
      },
    };
    vm.runInNewContext(`
      const WORLD_EVOLUTION_BARRIER = Symbol.for('mvu-doctor.native-world-diagnosis-barrier');
      let worldbookInitialization = { chatId: '', promise: null, attempt: 0 };
      let worldbookAttemptSerial = 0;
      ${filter}
      ${status}
      ${worldbook}
      ${barrier}
      this.ensureWorldbookSelectionForCurrentChat = ensureWorldbookSelectionForCurrentChat;
      this.installWorldEvolutionDiagnosisBarrier = installWorldEvolutionDiagnosisBarrier;
    `, sandbox);
    return {
      sandbox,
      calls,
      setChat(nextChat) { activeChat = String(nextChat); },
    };
  };

  const ready = makeHarness(7);
  const prewarmA = ready.sandbox.ensureWorldbookSelectionForCurrentChat(2);
  const prewarmB = ready.sandbox.ensureWorldbookSelectionForCurrentChat(2);
  assert.equal(prewarmA, prewarmB, 'same-chat prewarm must share one Promise');
  assert.equal(await prewarmA, false);
  assert.equal(ready.calls.loads, 3);
  assert.equal(ready.sandbox.installWorldEvolutionDiagnosisBarrier(), true);
  const result = await ready.sandbox.window.WORLD_ENGINE_EVOLUTION.evolve(
    { round: 1 },
    '用户行动保持原样',
    '前文<UpdateVariable><JSONPatch>SECRET_AI_PATCH</JSONPatch></UpdateVariable>后文',
    { dialogueText: '上下文<UpdateVariable><JSONPatch>SECRET_DIALOGUE_PATCH</JSONPatch>', keep: 'native-option' },
  );
  assert.equal(result, 'native-evolved');
  assert.equal(ready.calls.loads, 7, 'a resolved false prewarm must be retried by the first evolve gate');
  assert.deepEqual(ready.calls.selected, { ids: ['embedded-1'], scope: 'world' });
  assert.equal(ready.sandbox.window.MVUDoctorWorldbookBridgeStatus.status, 'ready');
  assert.equal(ready.calls.waits[0].aiMsg, '前文后文');
  assert.equal(ready.calls.waits[0].dialogueText, '上下文');
  assert.equal(ready.calls.originals[0][1], '用户行动保持原样');
  assert.equal(ready.calls.originals[0][2], '前文后文');
  assert.equal(ready.calls.originals[0][3].dialogueText, '上下文');
  assert.equal(ready.calls.originals[0][3].keep, 'native-option');

  const missing = makeHarness(Number.POSITIVE_INFINITY);
  assert.equal(await missing.sandbox.ensureWorldbookSelectionForCurrentChat(2), false);
  missing.sandbox.installWorldEvolutionDiagnosisBarrier();
  await missing.sandbox.window.WORLD_ENGINE_EVOLUTION.evolve({}, '', '可见正文', {});
  assert.equal(missing.sandbox.window.MVUDoctorWorldbookBridgeStatus.status, 'missing');
  assert.equal(missing.sandbox.window.MVUDoctorWorldbookBridgeStatus.ready, false);
  assert.match(missing.sandbox.window.MVUDoctorWorldbookBridgeStatus.detail, /未读取到内嵌世界书/u);

  let releaseSecondEnsure;
  let markSecondEnsureStarted;
  const secondEnsureStarted = new Promise((resolve) => { markSecondEnsureStarted = resolve; });
  const switchedDuringRetry = makeHarness(Number.POSITIVE_INFINITY, {
    loadCurrentEntries: async (loadNumber) => {
      if (loadNumber !== 4) return [];
      markSecondEnsureStarted();
      return new Promise((resolve) => { releaseSecondEnsure = resolve; });
    },
  });
  switchedDuringRetry.sandbox.installWorldEvolutionDiagnosisBarrier();
  const retryEvolution = switchedDuringRetry.sandbox.window.WORLD_ENGINE_EVOLUTION.evolve({}, '', '旧聊天正文', {});
  await secondEnsureStarted;
  switchedDuringRetry.setChat('chat-b');
  releaseSecondEnsure([]);
  assert.equal(await retryEvolution, false);
  assert.equal(switchedDuringRetry.calls.waits.length, 0);
  assert.equal(switchedDuringRetry.calls.originals.length, 0, 'a chat switch during the second worldbook ensure must discard the old evolve');

  let releaseDiagnosis;
  let markDiagnosisStarted;
  const diagnosisStarted = new Promise((resolve) => { markDiagnosisStarted = resolve; });
  const switchedDuringDiagnosis = makeHarness(1, {
    waitForWorldDiagnosis: async () => {
      markDiagnosisStarted();
      return new Promise((resolve) => { releaseDiagnosis = resolve; });
    },
  });
  switchedDuringDiagnosis.sandbox.installWorldEvolutionDiagnosisBarrier();
  const diagnosisEvolution = switchedDuringDiagnosis.sandbox.window.WORLD_ENGINE_EVOLUTION.evolve({}, '', '旧聊天正文', {});
  await diagnosisStarted;
  switchedDuringDiagnosis.setChat('chat-b');
  releaseDiagnosis({ ok: true, status: 'diagnosis-complete' });
  assert.equal(await diagnosisEvolution, false);
  assert.equal(switchedDuringDiagnosis.calls.originals.length, 0, 'a chat switch during diagnosis wait must discard the old evolve');
});

test('legacy settings migration repairs only the exact old Doctor signature and rejects tag-only filters', () => {
  const index = read('index.js');
  const functions = index.slice(index.indexOf('function oldDoctorSettings'), index.indexOf('async function initializeWorldbookSelectionOnce'));
  const script = `
    const PLUGIN_ID = 'mvu-doctor-kemini-clean';
    const WORLD_SETTINGS_KEY = 'world_engine_settings';
    const WORLD_DIALOGUE_FILTER_BRIDGE = Symbol.for('mvu-doctor.native-world-dialogue-filter');
    const MVU_DIALOGUE_FILTERS = [
      '/<UpdateVariable>[\\\\s\\\\S]*?<\\\\/UpdateVariable>/gi',
      '/<UpdateVariable>[\\\\s\\\\S]*$/i',
    ];
    ${functions}
    this.migrateWorldSettings = migrateWorldSettings;
  `;
  const makeHarness = ({ world = {}, marker = '', memory = { engineEnabled: false, evolveMode: 'manual' }, bridged = false } = {}) => {
    const exactWorld = {
      evolveMode: 'manual', engineEnabled: true, injectIntoPrompt: true,
      syncToChat: true, autoBackup: true,
      evolveFilterRegex: '/<\\/?UpdateVariable>/gi',
      ...world,
    };
    const values = new Map([['world_engine_settings', JSON.stringify(exactWorld)]]);
    if (marker) values.set('mvu_doctor_native_world_owner_v1', marker);
    const memoryPatches = [];
    let memoryState = { ...memory };
    const applyFilters = (value, settings) => String(settings.evolveFilterRegex || '').split(/\r?\n/u).filter(Boolean)
      .reduce((output, line) => {
        const match = line.match(/^\/(.*)\/([a-z]*)$/u);
        if (!match) return output;
        try { return output.replace(new RegExp(match[1], match[2]), ''); }
        catch { return output; }
      }, String(value));
    const worldCore = { filterDialogue: applyFilters };
    if (bridged) {
      const original = worldCore.filterDialogue.bind(worldCore);
      const stripMvu = (value) => String(value)
        .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '')
        .replace(/<UpdateVariable>[\s\S]*$/i, '');
      worldCore.filterDialogue = (value, settings) => stripMvu(original(stripMvu(value), settings));
      Object.defineProperty(worldCore, Symbol.for('mvu-doctor.native-world-dialogue-filter'), {
        value: { original }, configurable: false,
      });
    }
    const sandbox = {
      console,
      window: {
        WORLD_ENGINE_STORE: {
          getItem: (key) => values.has(key) ? values.get(key) : null,
          setItem: (key, value) => values.set(key, String(value)),
        },
        WORLD_ENGINE_API: { getSettings: () => JSON.parse(values.get('world_engine_settings') || '{}') },
        WORLD_ENGINE_CORE: worldCore,
        MEMORY_ENGINE_SETTINGS: {
          getSettings: () => ({ ...memoryState }),
          patchSettings: (patch) => {
            memoryPatches.push({ ...patch });
            memoryState = { ...memoryState, ...patch };
          },
        },
      },
    };
    vm.runInNewContext(script, sandbox);
    return { sandbox, values, memoryPatches };
  };

  const legacy = makeHarness();
  legacy.sandbox.migrateWorldSettings({ extensionSettings: {} });
  const migrated = JSON.parse(legacy.values.get('world_engine_settings'));
  assert.equal(migrated.evolveMode, 'auto');
  assert.equal(migrated.syncToChat, false);
  assert.equal(migrated.autoBackup, false);
  assert.ok(migrated.evolveFilterRegex.includes('[\\s\\S]*?<\\/UpdateVariable>'));
  assert.ok(migrated.evolveFilterRegex.includes('[\\s\\S]*$'));
  assert.deepEqual(legacy.memoryPatches, [{ engineEnabled: true, evolveMode: 'auto' }]);
  assert.equal(legacy.values.get('mvu_doctor_native_world_owner_v1'), 'done');
  assert.equal(legacy.values.get('mvu_doctor_native_memory_owner_v1'), 'done');

  const matureFilters = [
    '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gi',
    '/<UpdateVariable>[\\s\\S]*$/i',
  ].join('\n');
  const alreadyFiltered = makeHarness({ world: { evolveFilterRegex: matureFilters } });
  alreadyFiltered.sandbox.migrateWorldSettings({ extensionSettings: {} });
  const retainedFilters = JSON.parse(alreadyFiltered.values.get('world_engine_settings')).evolveFilterRegex.split('\n');
  assert.equal(retainedFilters.filter((line) => line === matureFilters.split('\n')[0]).length, 1);
  assert.equal(retainedFilters.filter((line) => line === matureFilters.split('\n')[1]).length, 1);

  const hotReload = makeHarness({ world: { evolveFilterRegex: matureFilters }, marker: 'done', bridged: true });
  hotReload.sandbox.migrateWorldSettings({ extensionSettings: {} });
  const hotReloadFilters = JSON.parse(hotReload.values.get('world_engine_settings')).evolveFilterRegex.split('\n');
  assert.equal(hotReloadFilters.filter((line) => line === matureFilters.split('\n')[0]).length, 1);
  assert.equal(hotReloadFilters.filter((line) => line === matureFilters.split('\n')[1]).length, 1);

  const worldDeviation = makeHarness({ world: { syncToChat: false } });
  worldDeviation.sandbox.migrateWorldSettings({ extensionSettings: {} });
  assert.equal(JSON.parse(worldDeviation.values.get('world_engine_settings')).evolveMode, 'manual');
  assert.deepEqual(worldDeviation.memoryPatches, []);

  const memoryDeviation = makeHarness({ memory: { engineEnabled: false, evolveMode: 'auto' } });
  memoryDeviation.sandbox.migrateWorldSettings({ extensionSettings: {} });
  assert.deepEqual(memoryDeviation.memoryPatches, []);

  const alreadyMigrated = makeHarness({ marker: 'done' });
  alreadyMigrated.sandbox.migrateWorldSettings({ extensionSettings: {} });
  assert.equal(JSON.parse(alreadyMigrated.values.get('world_engine_settings')).evolveMode, 'manual');
  assert.deepEqual(alreadyMigrated.memoryPatches, []);

  const pendingMemory = makeHarness({ marker: 'done' });
  pendingMemory.values.set('mvu_doctor_native_memory_owner_v1', 'pending');
  pendingMemory.sandbox.migrateWorldSettings({ extensionSettings: {} });
  assert.deepEqual(pendingMemory.memoryPatches, [{ engineEnabled: true, evolveMode: 'auto' }]);
  assert.equal(pendingMemory.values.get('mvu_doctor_native_memory_owner_v1'), 'done');
});

test('manifest and package expose the same reference-baseline version', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version, '0.9.2');
  assert.equal(pkg.version, manifest.version);
  assert.equal(manifest.js, 'index.js');
  assert.equal(manifest.generate_interceptor, 'mvuDoctorKeminiGenerateInterceptor');
});

test('profile engine retains ver5.35 tolerant parser and exactly one repair branch', () => {
  const source = read('profile-engine.js');
  for (const symbol of ['stripCodeFence', 'normalizeJsonPunctuation', 'removeJsonTrailingCommas', 'balancedJsonCandidates', 'parseJsonCandidate']) {
    assert.match(source, new RegExp(`function ${symbol}\\(`));
  }
  assert.equal((source.match(/batchRaw = await callModel\(/g) || []).length, 2, 'each bounded batch has one initial generation and one repair call site');
  assert.equal((source.match(/discoveryRaw = await callModel\(/g) || []).length, 2, 'name discovery has one initial call and one repair call site');
  assert.match(source, /single|单次修复/u);
  assert.match(source, /function profileBatchCapacity\(/);
  assert.match(source, /function discoveryPrompt\(/);
  assert.match(source, /function discoveryRepairPrompt\(/);
  assert.match(source, /while \(pending\.length > 0\)/);
  assert.match(source, /function profileTargetRows\(/);
  assert.match(source, /function bindProfilesToTargetRows\(/);
  assert.equal((source.match(/bindProfilesToTargetRows\(/g) || []).length, 3, 'initial and repair paths use the same target-row binder');
  assert.doesNotMatch(source, /dropProfilesOutsideBatch/);
  assert.match(source, /const syncProfileEvidence = \(\) =>/);
  assert.match(source, /dropProfilesOutsideCurrentReply\(envelope, target, currentReplyCandidates\)/);
  assert.match(source, /commitStore\(\s*after,\s*target\.chatId,\s*before\.revision,/u);
  assert.match(source, /pruneBranches/);
  assert.doesNotMatch(source, /beforeProfiles:\s*before\.profiles/);
});

test('accepted-final orchestrator runs diagnosis then profile while native World remains independent', () => {
  const source = read('profile-engine.js');
  const block = source.slice(source.indexOf('async function runAcceptedPipeline'), source.indexOf('async function waitForAcceptedFinal'));
  const diagnosis = block.indexOf('await runStoryDiagnosis(target, owner)');
  const profile = block.indexOf('await runTarget(target, reason, owner)');
  assert.ok(diagnosis >= 0 && profile > diagnosis);
  assert.doesNotMatch(block, /runWorldEvolution|manualEvolve|restoreCheckpoint|saveState/);
  assert.match(source, /message_id: target\.index/);
  assert.match(source, /requireTaskOwner\(owner, target, '变量补丁写入完成'\)/);
  assert.match(source, /installWorldPublicProjection/);
  assert.doesNotMatch(source, /WORLD_ENGINE_WORLDBOOK\.buildPromptSection\s*=/);
});

test('host glue pins MVU reads while World keeps original scheduling and reroll ownership', () => {
  const source = read('profile-engine.js');
  assert.match(source, /Mvu\.getMvuData\(\{ type: 'message', message_id: numericId \}\)/);
  assert.match(source, /host_mvu_readback_mismatch/);
  assert.doesNotMatch(source, /story_oracle_nonempty_noop/);
  const candidateBlock = source.slice(source.indexOf('function highConfidenceCandidateSources'), source.indexOf('function suggestedCandidates'));
  assert.doesNotMatch(candidateBlock, /说道|问道|点头|摇头|伸手|SUBJECT_FUNCTION_SUFFIX|PLAYER_PROSE_PREFIX/u);
  assert.match(candidateBlock, /profile\?\.name/);
  assert.match(candidateBlock, /NPC\|ACTOR/);
  assert.match(source, /function actorNamesFromMvuData\(/);
  assert.match(source, /function jsonPatchActorNames\(/);
  assert.match(source, /function profileCompletionCandidates\(/);
  assert.match(source, /status: 'already-committed'/);
  assert.match(source, /modelCalls: 0/);
  assert.match(source, /你只执行人物发现，不写人物档案/u);
  assert.match(source, /人物发现已经单独完成/u);
  assert.match(source, /setFixCfg\?\.\(\{ autoFixEnabled: false \}\)/);
  assert.match(source, /pipelineEpoch/);
  assert.match(source, /requireBranchRestore\(owner\)/);
  assert.match(source, /branchRestoreSerial: 0/);
  assert.match(source, /const restoreSerial = \+\+runtime\.branchRestoreSerial/);
  assert.match(source, /restoreSerial !== runtime\.branchRestoreSerial \|\| chatId\(\) !== restoreChatId/);
  assert.match(source, /restoreProfileBranch\(baseline, true, assertRestoreCurrent\)/);
  assert.doesNotMatch(source, /runWorldEvolution|WORLD_RECEIPT_STORAGE_PREFIX|worldReceiptStorageKey/);
  assert.doesNotMatch(source, /WORLD_ENGINE_EVOLUTION\?\.abort|WORLD_ENGINE_CORE\?\.restoreCheckpoint|\.saveState\(checkpoint\)/);
  assert.doesNotMatch(source, /runWorld:\s*/);
  assert.doesNotMatch(source, /Date\.now\(\) - runtime\.lastUserMessageAt/);
  assert.match(source, /\['quiet', 'raw', 'silent', 'impersonate'\]/);
  assert.match(source, /GENERATION_TICKET_PREFIX/);
  assert.match(source, /persistGenerationTicket\(runtime\.acceptedGeneration, 'started'\)/);
  const receivedStart = source.indexOf("context.eventSource.on(eventName(context, 'MESSAGE_RECEIVED'");
  const endStart = source.indexOf("context.eventSource.on(eventName(context, 'GENERATION_ENDED'");
  const stopStart = source.indexOf("context.eventSource.on(eventName(context, 'GENERATION_STOPPED'", endStart);
  assert.ok(receivedStart >= 0 && endStart > receivedStart && stopStart > endStart);
  const received = source.slice(receivedStart, endStart);
  assert.match(received, /observeReceivedMessage\(messageId, messageType\)/);
  const ended = source.slice(endStart, stopStart);
  assert.match(ended, /observeGenerationEnded\(\)/);

  assert.match(source, /function receiptTargetForTicket\(/);
  assert.match(source, /function receiptTypeMatchesTicket\(/);
  assert.match(source, /function observeReceivedMessage\(/);
  assert.match(source, /function observeGenerationEnded\(/);
  assert.match(source, /function scheduleAcceptedGenerationIfReady\(/);
  assert.match(source, /ticket\.completionScheduled === true\s*\|\| ticket\.endObserved !== true \|\| ticket\.receivedMessageId === null/);
  assert.match(source, /completionScheduled:\s*true/);
  assert.match(source, /'quiet', 'impersonate', 'first_message', 'command', 'extension'/);
  assert.match(source, /persistGenerationTicket\([\s\S]*?\}, 'ended'\);[\s\S]*?waitForAcceptedFinal\(runtime\.acceptedGeneration\.serial, target\.index, target\.swipeId\)/);
  assert.match(source, /receivedSwipeId !== null && target\.swipeId !== receivedSwipeId/);
  assert.match(source, /if \(ticket\.awaitingStart === true\) return false/);
  assert.doesNotMatch(source, /generationEventStack|pushGenerationEvent|popGenerationEvent/);

  const swipeStart = source.indexOf("context.eventSource.on(eventName(context, 'MESSAGE_SWIPED'", stopStart);
  assert.ok(swipeStart > stopStart);
  const stopped = source.slice(stopStart, swipeStart);
  assert.match(stopped, /clearGenerationTicket\(ticket\.chatId \|\| chatId\(\), ticket\.generationKey\)/);

  assert.match(source, /const explicitReplacement = \['swipe', 'regenerate'\]\.includes\(normalizedType\)/);
  assert.match(source, /const hasUserAfterBaseline = liveChat\.slice/);
  assert.match(source, /const hasTurnUser = liveChat\.slice/);
  assert.match(source, /if \(activeTicket\) cancelAll\('swipe已变化', true\)/);
  assert.match(source, /slotWasUnmaterialized/);
  assert.match(source, /explicitRerollCompletion/);

  const continueStart = source.indexOf('function mergeContinuationTicket');
  const bindStart = source.indexOf('function bindEvents', continueStart);
  assert.ok(continueStart >= 0 && bindStart > continueStart);
  const continuation = source.slice(continueStart, bindStart);
  assert.match(continuation, /runtime\.generationSerial \+= 1/);
  assert.match(continuation, /\.\.\.ticket,\s*serial: runtime\.generationSerial/s);
  assert.match(continuation, /continuationCount: Number\(ticket\.continuationCount \|\| 0\) \+ 1/);
  assert.match(continuation, /persistGenerationTicket\(runtime\.acceptedGeneration, 'started'\)/);
  const startHandler = source.slice(bindStart, endStart);
  assert.match(startHandler, /normalizedType === 'continue'.*\['started', 'ended', 'processing'\].*mergeContinuationTicket\(activeTicket\)/s);
  assert.match(startHandler, /activeTicket\.status === 'processing'.*cancelAll\('正文续写接管尚未完成的半截正文', false\)/s);
  assert.match(startHandler, /normalizedType === 'continue' && runtime\.pipelineBusy\) return/);
  assert.match(source, /checkpoint\.status === 'cancelled'/);
  assert.match(source, /migrateDoctorWrittenAcceptedTarget/);
  assert.match(source, /ensureManualGenerationBinding/);
  assert.match(source, /cancel:\s*\(\)\s*=>\s*cancelCurrentTaskFromUi\(\)/u);
  assert.match(source, /ticketTime >= checkpointTime/);
  assert.doesNotMatch(source, /pendingTicket\.generationKey !== checkpoint\?\.target\?\.generationKey/);
  assert.match(source, /runtime\.pipelineEpoch !== recoveryEpoch/);
  assert.match(source, /const loadSerial = \+\+chatLoadSerial/);
  assert.match(source, /const loadEpoch = runtime\.pipelineEpoch/);
  assert.match(source, /runtime\.pipelineEpoch === loadEpoch/);
  assert.match(source, /const startupEpoch = runtime\.pipelineEpoch/);
  assert.match(source, /runtime\.pipelineEpoch === startupEpoch/);
});

test('metadata commit is revision guarded and settings editing is not rerendered', () => {
  const source = read('profile-engine.js');
  assert.match(source, /expectedRevision/);
  assert.match(source, /storeDigest\(readback\) !== storeDigest\(snapshot\)/);
  assert.match(source, /panel\.querySelector\('\[data-tab="settings"\]\.active'\)/);
  assert.match(source, /runtime\.runReports/);
  assert.match(source, /function doctorPersistenceStore\(/);
  assert.match(source, /window\.WORLD_ENGINE_STORE/);
  assert.match(source, /let reportPersistTail = Promise\.resolve\(\)/);
  assert.match(source, /let reportMutationSerial = 0/);
  assert.match(source, /reportMutationSerial \+= 1/);
  assert.match(source, /await drainReportPersistence\(\)/);
  assert.match(source, /if \(runtime\.pipelineBusy\)[\s\S]*?医生任务仍在运行/u);
  assert.match(source, /DIAGNOSTIC_INTEGRITY_STORAGE_PREFIX/);
  assert.match(source, /persistDiagnosticIntegrityLatch/);
  const reportBlock = source.slice(source.indexOf('function recordRunReport'), source.indexOf('function storeAfterProfileRun'));
  assert.doesNotMatch(reportBlock, /sessionStorage\.setItem/);
});

test('empty profile output cannot pass without a reason or against stable candidates', () => {
  const source = read('profile-engine.js');
  assert.match(source, /noProfileReason/);
  assert.match(source, /空档案结果必须说明本轮为何确实没有可持续记录的NPC/);
  assert.match(source, /正文存在必须核对的人物候选/);
  assert.match(source, /detectedCharacters中的.*没有对应完整档案/);
});

test('profile runtime accepts recoverable fenced JSON without executing browser boot', () => {
  const source = read('profile-engine.js');
  const start = source.indexOf('function stripCodeFence');
  const end = source.indexOf('\n\n  function ctx()', start);
  assert.ok(start > 0 && end > start);
  const parserSource = `${source.slice(start, end)}\nthis.parseJsonResponse = parseJsonResponse;`;
  const sandbox = {};
  vm.runInNewContext(parserSource, sandbox);
  const parsed = sandbox.parseJsonResponse('```json\n前言 {“profiles”：[{“name”：“甲”，}],} 后记\n```');
  assert.equal(parsed.profiles[0].name, '甲');
});

test('UI has bounded desktop and full mobile viewport layouts', () => {
  const css = read('style.css');
  const mobileCss = css.slice(css.indexOf('@media (max-width: 680px)'), css.indexOf('@media (prefers-reduced-motion'));
  assert.match(css, /width:\s*min\(780px,\s*calc\(100vw - 32px\)\)/);
  assert.match(css, /max-height:\s*calc\(var\(--mvu-ref-visual-height, 100dvh\) - 96px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /overflow:\s*auto/);
  assert.match(mobileCss, /#mvu-ref-panel nav\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[\s\S]*?overflow-x:\s*hidden;/u);
  assert.match(mobileCss, /#mvu-ref-panel nav button\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?text-overflow:\s*clip;[\s\S]*?white-space:\s*normal;/u);
  assert.doesNotMatch(mobileCss, /#mvu-ref-panel nav\s*\{[^}]*display:\s*flex/u);
  assert.match(read('profile-engine.js'), /window\.visualViewport\?\.addEventListener/);
  assert.match(read('profile-engine.js'), /addEventListener\?\.\('resize', syncVisualViewportHeight\)/);
  assert.match(read('profile-engine.js'), /visualViewport\?\.addEventListener\?\.\('scroll', syncVisualViewportHeight\)/);
});

test('full report export omits API key', () => {
  const source = read('profile-engine.js');
  const reportBlock = source.slice(source.indexOf('function safeExport'), source.indexOf('function saveApiForm'));
  assert.match(reportBlock, /excluded: true/);
  assert.match(source, /function redactApiConfiguration/);
  assert.match(reportBlock, /chat: deepClone\(ctx\(\)\?\.chat \|\| \[\]\)/);
  assert.match(reportBlock, /redactApiConfiguration\(/);
  assert.doesNotMatch(reportBlock, /apiKey:\s*worldConnection|endpoint:\s*storyConnection|model:\s*worldConnection/);
});
