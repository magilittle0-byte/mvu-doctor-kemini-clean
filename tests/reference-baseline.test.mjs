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
  assert.match(source, /window\.WORLD_ENGINE\?\.manualEvolve/);
  assert.match(source, /autoDiagnoseEnabled !== false/);
  assert.doesNotMatch(source, /legacy\/0\.7\.5|embeddedCore|advanceWorld|applyWorldProposal|auditVariables/);
});

test('manifest and package expose the same reference-baseline version', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(manifest.version, '0.8.0');
  assert.equal(pkg.version, manifest.version);
  assert.equal(manifest.js, 'index.js');
  assert.equal(manifest.generate_interceptor, 'mvuDoctorKeminiGenerateInterceptor');
});

test('profile engine retains ver5.35 tolerant parser and exactly one repair branch', () => {
  const source = read('profile-engine.js');
  for (const symbol of ['stripCodeFence', 'normalizeJsonPunctuation', 'removeJsonTrailingCommas', 'balancedJsonCandidates', 'parseJsonCandidate']) {
    assert.match(source, new RegExp(`function ${symbol}\\(`));
  }
  assert.equal((source.match(/raw = await callModel\(/g) || []).length, 2, 'one initial generation and one repair call');
  assert.match(source, /single|单次修复/u);
  assert.match(source, /commitStore\(\s*after,\s*target\.chatId,\s*before\.revision,/u);
  assert.match(source, /pruneBranches/);
  assert.doesNotMatch(source, /beforeProfiles:\s*before\.profiles/);
});

test('accepted-final orchestrator runs diagnosis then profile then world', () => {
  const source = read('profile-engine.js');
  const block = source.slice(source.indexOf('async function runAcceptedPipeline'), source.indexOf('async function waitForAcceptedFinal'));
  const diagnosis = block.indexOf('await runStoryDiagnosis(target, owner)');
  const profile = block.indexOf('await runTarget(target, reason, owner)');
  const world = block.indexOf('await runWorldEvolution(target');
  assert.ok(diagnosis >= 0 && profile > diagnosis && world > profile);
  assert.match(source, /message_id: target\.index/);
  assert.match(source, /requireTaskOwner\(owner, target, '变量补丁写入完成'\)/);
  assert.match(source, /installWorldContextBridge/);
});

test('host glue pins MVU reads, owns the pipeline and preserves original reroll semantics', () => {
  const source = read('profile-engine.js');
  assert.match(source, /Mvu\.getMvuData\(\{ type: 'message', message_id: numericId \}\)/);
  assert.match(source, /host_mvu_readback_mismatch/);
  assert.match(source, /story_oracle_nonempty_noop/);
  assert.match(source, /setFixCfg\?\.\(\{ autoFixEnabled: false \}\)/);
  assert.match(source, /pipelineEpoch/);
  assert.match(source, /requireBranchRestore\(owner\)/);
  assert.match(source, /const mode = isReroll \? undefined : 'forward'/);
  assert.doesNotMatch(source, /Date\.now\(\) - runtime\.lastUserMessageAt/);
  assert.match(source, /\['quiet', 'raw', 'silent', 'impersonate'\]/);
  assert.match(source, /GENERATION_TICKET_PREFIX/);
  assert.match(source, /persistGenerationTicket\(runtime\.acceptedGeneration, 'started'\)/);
  const endStart = source.indexOf("context.eventSource.on(eventName(context, 'GENERATION_ENDED'");
  const stopStart = source.indexOf("context.eventSource.on(eventName(context, 'GENERATION_STOPPED'", endStart);
  assert.ok(endStart >= 0 && stopStart > endStart);
  const ended = source.slice(endStart, stopStart);
  assert.match(ended, /const event = popGenerationEvent\(\)/);
  assert.match(ended, /event\?\.kind === 'ignored'.*event\?\.kind === 'guarded-normal'/s);
  assert.match(ended, /event\?\.kind === 'ticket' && event\.serial !== serial/);
  assert.match(ended, /persistGenerationTicket\(\{\s*\.\.\.ticket,\s*awaitingStart:\s*false\s*\},\s*'ended'\)/);
  assert.match(ended, /waitForAcceptedFinal\(serial\)/);
  assert.ok(ended.indexOf('persistGenerationTicket') < ended.indexOf('waitForAcceptedFinal(serial)'));

  const swipeStart = source.indexOf("context.eventSource.on(eventName(context, 'MESSAGE_SWIPED'", stopStart);
  assert.ok(swipeStart > stopStart);
  const stopped = source.slice(stopStart, swipeStart);
  assert.match(stopped, /const event = popGenerationEvent\(\)/);
  assert.match(stopped, /event\?\.kind === 'ignored'.*event\?\.kind === 'guarded-normal'/s);
  assert.match(stopped, /event\?\.kind === 'ticket' && event\.serial !== ticket\.serial/);
  assert.match(stopped, /clearGenerationTicket\(ticket\.chatId \|\| chatId\(\), ticket\.generationKey\)/);

  assert.match(source, /generationEventStack\.push\(\{ kind, serial:/);
  assert.match(source, /const explicitReplacement = \['swipe', 'regenerate'\]\.includes\(normalizedType\)/);
  assert.match(source, /pushGenerationEvent\('guarded-normal'\)/);
  assert.match(source, /const hasUserAfterBaseline = liveChat\.slice/);
  assert.match(source, /const hasTurnUser = liveChat\.slice/);
  assert.match(source, /const belongsToStartedReroll = activeTicket\?\.chatId === chatId\(\)/);
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
  assert.match(continuation, /pushGenerationEvent\('ticket', runtime\.acceptedGeneration\.serial\)/);
  const startHandler = source.slice(bindStart, endStart);
  assert.match(startHandler, /normalizedType === 'continue'.*\['started', 'ended'\].*mergeContinuationTicket\(activeTicket\)/s);
  assert.match(startHandler, /normalizedType === 'continue' && runtime\.pipelineBusy.*pushGenerationEvent\('ignored'\)/s);
  assert.match(source, /checkpoint\.status === 'cancelled'/);
  assert.match(source, /migrateDoctorWrittenAcceptedTarget/);
  assert.match(source, /ensureManualGenerationBinding/);
  assert.match(source, /cancel:\s*\(\)\s*=>\s*cancelCurrentTaskFromUi\(\)/u);
  assert.match(source, /ticketTime >= checkpointTime/);
  assert.match(source, /runtime\.pipelineEpoch !== recoveryEpoch/);
});

test('metadata commit is revision guarded and settings editing is not rerendered', () => {
  const source = read('profile-engine.js');
  assert.match(source, /expectedRevision/);
  assert.match(source, /storeDigest\(readback\) !== storeDigest\(snapshot\)/);
  assert.match(source, /panel\.querySelector\('\[data-tab="settings"\]\.active'\)/);
  assert.match(source, /runtime\.runReports/);
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
  assert.match(css, /width:\s*min\(780px,\s*calc\(100vw - 32px\)\)/);
  assert.match(css, /max-height:\s*calc\(100dvh - 96px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /overflow:\s*auto/);
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
