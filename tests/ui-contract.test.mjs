import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('控制台包含变量、连接、人物、世界、诊断与两个互不串线的手动复检入口', () => {
  for (const tab of ['overview', 'connection', 'profiles', 'world', 'diagnostics']) {
    assert.match(source, new RegExp(`data-tab=["']${tab}["']`));
    assert.match(source, new RegExp(`data-panel=["']${tab}["']`));
  }
  for (const role of ['variableDoctor', 'variableTokens', 'apiEndpoint', 'apiKey', 'apiModel', 'additionalPrompt', 'models', 'testApi', 'profile-select', 'world-list', 'world-persistence', 'diagnostic-list', 'retry', 'manualVariableAudit', 'manualVariableHint', 'manualWorldAdvance', 'undoVariableRepair', 'cancel', 'exportFullReport']) {
    assert.match(source, new RegExp(`data-role=["']${role}["']`));
  }
  assert.match(source, /openAiChatEndpoint/);
  assert.match(source, /fetchApiModels/);
  assert.match(source, /retryLastFailure/);
  assert.match(source, /auditVariables/);
  assert.match(source, /removeApiFromExport/);
  assert.match(source, /正文只确定谁实际出场以及哪些事实不能违背，不是档案信息上限/);
  assert.match(source, /脚本只校验结构、身份、票据映射和原子提交/);
  assert.match(source, /不会再用第二套散文规则删除你已填好的knowledge/);
  assert.match(source, /profileCompletionContract/);
  assert.match(source, /profileRecovery/);
  assert.match(source, /const attempts = 2/);
  assert.doesNotMatch(source, /<AuditReceipt>/);
  assert.match(source, /一次聚焦模型诊断/);
  assert.match(source, /当前post-update非人物stat_data/);
  assert.match(source, /补丁直接应用在当前post-update stat_data上，不从上一楼层重建整回合/);
  assert.match(source, /appendVariableBlockIfMissing/);
  assert.doesNotMatch(source, /prepareReplacement|本回合完整正确的替换块|只修复上次输出的机械错误/);
  assert.doesNotMatch(source, /parseVariableDoctorOutput|replaceUpdateVariableBlock/);
  assert.doesNotMatch(source, /mergeUpdateVariableBlocks|buildReplayVariableOperations/);
  assert.doesNotMatch(source, /assessVariableBaseline|buildVariableAuditChecklist|extractExplicitVariableClaims/);
  assert.match(source, /MVU事务未闭合；世界不会消费未确认状态/);
  assert.doesNotMatch(source, /schemaRejected:\s*true/);
  assert.match(source, /manualVariableRecheck/);
  assert.match(source, /本次只处理变量；人物档案与世界引擎未运行/);
  assert.match(source, /store\.fullRuns = store\.fullRuns\.slice\(0, 24\)/);
  assert.match(source, /discoverProfileSubjects/);
  assert.match(source, /高置信人物锚点只是必须覆盖的下限/);
  assert.match(source, /没有最终正文逐字出现的稳定name或alias身份锚点/);
  assert.doesNotMatch(source, /const PROFILE_ACTION_VERB/);
  assert.match(source, /stripNarrativeHtmlWidgets/);
  assert.match(source, /validateProfileSubjectCoverage/);
  assert.match(source, /profile:nochange-rejected/);
  assert.match(source, /saveAcceptedStructureRepair/);
  assert.match(source, /accepted-structure:repaired/);
  assert.match(source, /stage: 'accepted-structure'/);
  assert.match(source, /hasMainGenerationEvidence/);
  assert.doesNotMatch(source, /visibleMainStop/);
  assert.doesNotMatch(source, /releaseSessionRecall|reserveRecallPackage|settleRecallPackage/);
  assert.match(source, /insert_missing_content_open_before_first_narrative_anchor/);
  assert.match(source, /正文结构无法安全修复\|正文结构修复未能持久化/);
  assert.match(source, /未知（外观像青年）/);
  assert.match(source, /unsupported_aliases_removed/);
  assert.doesNotMatch(source, /assessRecallConsumption|consumptionAnchors|required_once/);
  assert.match(source, /未采用项冷却后可再次召回/);
  assert.match(source, /只有最终接受正文确实包含同一公开文本时才记为已呈现/);
  assert.match(source, /recallSelectionInput/);
  const generationInjection = source.slice(source.indexOf('function formatGenerationInjection'), source.indexOf('function profileDigestFromData'));
  assert.match(generationInjection, /玩家输入已由宿主和预设提供，这里不再复述/);
  assert.doesNotMatch(generationInjection, /本轮玩家明确动作|CharacterTicketReceipt/);
  assert.match(generationInjection, /不要替玩家决定任何行动、感受、同意或结果/);
  const manualWorld = source.slice(source.indexOf('async function manualWorldRecheck'), source.indexOf('async function undoLastVariableRepair'));
  assert.match(manualWorld, /advanceWorld/);
  assert.doesNotMatch(manualWorld, /auditVariables|commitProfiles/);
  assert.match(manualWorld, /不运行MVU变量或人物生成/);
});

test('仍有阶段待处理时运行态优先于完成措辞且恢复与手动入口共用同一忙碌门', () => {
  const helper = source.slice(source.indexOf('function runtimeHasPendingWork'), source.indexOf('function statusPresentation'));
  assert.match(helper, /\['pending', 'ready', 'running'\]/);
  for (const busySignal of [
    'runtime.preparation',
    'runtime.active',
    'runtime.processingSession',
    'runtime.timer',
    'runtime.requestControllers.size',
    'runtime.requestController',
    'runtime.retrying',
    'runtime.internalGenerationDepth > 0',
    'progressBusy',
  ]) assert.ok(helper.includes(busySignal), `忙碌门遗漏 ${busySignal}`);
  assert.match(helper, /return Boolean\([\s\S]*runtime\.preparation[\s\S]*runtime\.internalGenerationDepth > 0[\s\S]*progressBusy\)/);

  const presentation = source.slice(source.indexOf('function statusPresentation'), source.indexOf('function setStatus'));
  assert.ok(presentation.indexOf('runtimeHasPendingWork()') < presentation.indexOf('/完成|就绪|已确认|已恢复|已撤销|处理完成/'));
  assert.match(source, /root\.dataset\.state = advice\?\.severity === 'error'[\s\S]*advice\?\.severity === 'success' \? 'ready' : 'busy'/);
  assert.match(source, /const busy = runtimeHasPendingWork\(\)/);
  const idleReloadStart = source.indexOf('if (!runtimeHasPendingWork())');
  const idleReload = source.slice(idleReloadStart, source.indexOf('})().catch', idleReloadStart));
  assert.ok(idleReloadStart >= 0);
  assert.ok(idleReload.indexOf('doctorStateQuarantine') < idleReload.indexOf('runtime.retry'));
  assert.ok(idleReload.indexOf('runtime.retry') < idleReload.indexOf("setStatus('医生已就绪'"));
  const progress = source.slice(source.indexOf('function progressForPhase'), source.indexOf('function runtimeHasPendingWork'));
  assert.match(progress, /\['pending', 'ready', 'running'\]\.includes\(value\) \? 'cancelled'/);
});

test('重试、手动变量和手动世界入口同时服从新生成busy与持久隔离状态', () => {
  const render = source.slice(source.indexOf('function renderRetryControl'), source.indexOf('function showTab'));
  assert.match(render, /doctorStateQuarantine/);
  assert.match(render, /\[data-role=["']manualWorldAdvance["']\]/);
  assert.match(render, /button\.disabled = [^;]*(?:busy|quarantin)/i);
  assert.match(render, /manualVariableAudit[\s\S]*(?:busy|quarantin)/i);
  assert.match(render, /manualWorldAdvance[\s\S]*(?:busy|quarantin)/i);

  const retry = source.slice(source.indexOf('async function retryLastFailure'), source.indexOf('function endGeneration'));
  const busyGate = retry.indexOf('runtimeHasPendingWork()');
  const startsRetry = retry.indexOf('runtime.retrying = true');
  assert.ok(busyGate >= 0 && busyGate < startsRetry);
});

test('人物提交屏障后重新校验完整候选集合，不会把未达标人物从重试材料中消失', () => {
  const commit = source.slice(source.indexOf('async function commitProfiles'), source.indexOf('async function commitWorldState'));
  assert.match(commit, /const prepareCandidates = \(profiles, sourceData = oldData\)/);
  assert.match(commit, /if \(candidateProfiles\.length\) \{\s*prepared = prepareCandidates\(candidateProfiles, oldData\)/);
  assert.doesNotMatch(commit, /prepareProfileBatch\(prepared\.profiles/);
});

test('运行中的修复详情可以列出缺项但不会冒充红色终态失败', () => {
  const presentation = source.slice(source.indexOf('function statusPresentation'), source.indexOf('function setStatus'));
  const pendingGate = presentation.indexOf('if (pending && !terminalFailurePhase)');
  const textFailureGate = presentation.indexOf("if (/失败|无法|缺少|错误|不一致|未确认|回滚失败/.test(text))");
  assert.ok(pendingGate >= 0 && pendingGate < textFailureGate);
  assert.match(presentation, /terminalFailurePhase = \/失败\|无法\|错误\|不一致\|未确认\|回滚失败\/\.test\(phase\)/);
  assert.match(presentation, /pending && !terminalFailurePhase[\s\S]*severity: 'info'/);
  assert.match(presentation, /test\(text\)[\s\S]*severity: 'error'/);
});

test('变量医生等价改写故事神谕：一次独立推导整组变化，再用官方MVU应用最小补丁', () => {
  const audit = source.slice(source.indexOf('async function auditVariables'), source.indexOf('async function repairProfileReceipt'));
  assert.match(audit, /buildVariableAuditEvidence/);
  assert.match(audit, /evidence\.triggeringUser/);
  assert.match(audit, /evidence\.transcript/);
  assert.match(audit, /collectMvuReference/);
  assert.match(audit, /当前post-update非人物stat_data/);
  assert.match(audit, /本回复生成前最近可用的非人物stat_data/);
  assert.match(audit, /当前回合适用的初始化或字段配套规则/);
  assert.match(audit, /本楼层原UpdateVariable区块/);
  assert.match(audit, /本楼层最终接受正文/);
  assert.match(audit, /先独立列出本回合每一组明确发生的状态变化/);
  assert.match(audit, /逐项核对每组变化的目标字段与配套字段/);
  assert.match(audit, /原UpdateVariable完全漏写了配套字段也必须检查/);
  assert.match(audit, /未分配点数或余额也必须相应减少/);
  assert.match(audit, /当前值若已经正确扣减或更新，不得重复操作/);
  assert.match(audit, /补丁直接应用在当前post-update stat_data上，不从上一楼层重建整回合/);
  assert.match(audit, /raw = await generateDoctorRaw/);
  assert.equal((audit.match(/await generateDoctorRaw\(/g) || []).length, 1);
  assert.match(audit, /returnedBlocks/);
  assert.match(audit, /candidate = await Mvu\.parseMessage\(block, runtime\.core\.deepClone\(freshData\)\)/);
  assert.equal((audit.match(/Mvu\.parseMessage\(/g) || []).length, 1);
  assert.match(audit, /messageMode = originalBlock \? 'preserve-existing' : 'append-missing'/);
  assert.match(audit, /appendVariableBlockIfMissing/);
  assert.doesNotMatch(audit, /previousMvuData|prepareReplacement|verifyVariablePreservation|normalizeVariableOperations|validatePatchOperations/);
  assert.doesNotMatch(audit, /buildReplayCompleteBlock|mergeUpdateVariableBlocks|完整替换块/);
  assert.match(audit, /model_reported_nochange/);
  assert.match(audit, /不把它冒充语义证明/);
  assert.match(audit, /用户明确填写的姓名、身份、点数和资源分配优先/);
  assert.match(audit, /NPC的引导、邀请或要求不等于玩家已经照做/);
  assert.match(audit, /不得把派生字段当来源字段直接改写/);
  assert.match(audit, /assertVariableTarget\(session, messageId, target\)[\s\S]*generateDoctorRaw[\s\S]*assertVariableTarget\(session, messageId, target\)/);
  assert.doesNotMatch(audit, /assessVariableBaseline|buildVariableAuditChecklist|extractExplicitVariableClaims|partial-repair|authority-rejected/);
  assert.doesNotMatch(audit, /二次语义审核|第二次模型复检|配套字段门禁/);
});

test('正文只接收公开影响，主体锚点、私密现状和有限知识只供Doctor后台推进', () => {
  const injection = source.slice(source.indexOf('function formatGenerationInjection'), source.indexOf('function profileDigestFromData'));
  assert.match(injection, /publicEffect/);
  assert.match(injection, /publicChannel/);
  assert.match(injection, /不要求逐字照抄，也不要求全部出现/);
  assert.match(injection, /不得从公开影响反推出行动者的私密动机/);
  assert.doesNotMatch(injection, /entry\.(?:anchor|current|goal|knowledge|resources|constraints|nextAction)|consumptionAnchors|required_once/);

  const worldAdvance = source.slice(source.indexOf('async function advanceWorld'), source.indexOf('async function acceptFinal'));
  assert.match(worldAdvance, /const privateSubjectViews/);
  assert.match(worldAdvance, /anchor: subject\.anchor/);
  assert.match(worldAdvance, /current: subject\.current/);
  assert.match(worldAdvance, /knowledge: subject\.knowledge/);
  assert.match(worldAdvance, /resources: subject\.resources/);
  assert.match(worldAdvance, /constraints: subject\.constraints/);
  assert.match(worldAdvance, /subjectHistories/);
  assert.match(worldAdvance, /publicWorldSurface/);
  assert.doesNotMatch(worldAdvance, /privateProfileDigestFromData\(/);
  assert.match(worldAdvance, /私密行动、隐藏状态和完整真相只写入主体私密字段/);
  assert.match(worldAdvance, /只有存在目击、环境痕迹或真实传播链时才写公开影响/);
  assert.doesNotMatch(worldAdvance, /generateIsolatedActorPlan|bootstrapPlans|nextPlans/);
  assert.match(source, /private_leak_removed/);
  assert.match(source, /只忽略公开字段，私密推进仍保留/);
});

test('accepted-final并行生成变量与人物候选，只有变量或人物持久化事务未闭合才阻断世界', () => {
  const accepted = source.slice(source.indexOf('async function acceptFinal'), source.indexOf('function latestUndoableVariableRepair'));
  const variableStart = accepted.indexOf('const variableTask = auditVariables');
  const profileStart = accepted.indexOf('const profileTask = commitProfiles');
  const jointWait = accepted.indexOf('await Promise.all([variableTask, profileTask])');
  const variableIntegrityGate = accepted.indexOf('const worldBlockedByVariableIntegrity = !variableResult.ok');
  const worldIntegrityGate = accepted.indexOf('const worldBlockedByProfileIntegrity = Boolean(profileResult.blocksWorld)');
  const worldResultStart = accepted.indexOf('const worldResult = worldBlocked');
  const worldStart = accepted.indexOf('await advanceWorld(session, finalAcceptedText, workingData)', worldResultStart);
  assert.ok(variableStart >= 0 && profileStart > variableStart && jointWait > profileStart);
  assert.ok(variableIntegrityGate > jointWait && worldIntegrityGate > variableIntegrityGate && worldResultStart > worldIntegrityGate && worldStart > worldResultStart);
  assert.match(accepted, /commitBarrier: variableTask/);
  assert.doesNotMatch(accepted, /profileBarrier/);
  assert.match(accepted, /MVU事务未闭合；世界不会消费未确认状态/);
  assert.match(accepted, /人物档案本轮失败；已有档案与非人物主体仍可推进/);
  const worldDispatch = accepted.slice(worldResultStart, accepted.indexOf('if (!sessionIsCurrent(session) || worldResult.cancelled)', worldResultStart));
  assert.match(worldDispatch, /const worldResult = worldBlocked\s*\?[\s\S]*blockedByVariableIntegrity:[\s\S]*blockedByProfileIntegrity:[\s\S]*:\s*await advanceWorld\(session, finalAcceptedText, workingData\)/);
  assert.equal((worldDispatch.match(/skipped: true/g) || []).length, 1);
  assert.match(worldDispatch, /worldBlockedByVariableIntegrity/);

  const profiles = source.slice(source.indexOf('async function commitProfiles'), source.indexOf('async function commitWorldState'));
  assert.ok(profiles.indexOf('await execution.commitBarrier') < profiles.indexOf('await Mvu.replaceMvuData(candidate'));
  assert.match(source, /requestControllers: new Set\(\)/);
  assert.match(source, /internalGenerationDepth/);
  const profileContentFailure = profiles.slice(profiles.indexOf('if (!prepared.ok && !prepared.profiles?.length)'), profiles.indexOf('if (!hasMvu)'));
  assert.match(profileContentFailure, /blocksWorld: false/);
  assert.doesNotMatch(profiles, /discoverAcceptedProfileSubjects|if \(!discovery\.ok\)/);
  assert.match(profiles, /profile:single-pass-started/);
});

test('世界在一次主体批次中完成发现、裁决与局部合并，取消会话不写入迟到结果', () => {
  const worldAdvance = source.slice(source.indexOf('async function advanceWorld'), source.indexOf('async function acceptFinal'));
  assert.match(worldAdvance, /selectDueWorldSubjects/);
  assert.match(worldAdvance, /createWorldAdvanceTickets/);
  assert.match(worldAdvance, /parseWorldProposal\(raw, \{ subjects: dueSubjects \}\)/);
  assert.match(worldAdvance, /applyWorldProposal\(workingWorld, proposalForMerge/);
  assert.equal((worldAdvance.match(/await generateDoctorRaw\(/g) || []).length, 1);
  assert.match(worldAdvance, /一次主体批次/);
  assert.match(worldAdvance, /NEW必须在创建本回合立即完成第一次尝试、裁决、状态变化和下一步/);
  assert.doesNotMatch(worldAdvance, /generateIsolatedActorPlan|bootstrapPlans|nextPlans|sanitizeWorldAdjudication/);
  assert.match(worldAdvance, /if \(isSessionCancellation\(error, session\)\)/);
  assert.match(worldAdvance, /cancelled: true/);
  assert.doesNotMatch(worldAdvance, /repairAttempts|retryable-failure|restoreCancelledWorldAttempt/);
  assert.match(worldAdvance, /const sourceKey = String\(session\.worldSourceKey \|\| acceptedReplySourceKey\(context, messageId, acceptedText\)\)/);
  assert.match(worldAdvance, /world:idempotent-skip/);
  assert.match(worldAdvance, /session\.worldAdvancePlan = \{/);
  assert.match(worldAdvance, /sameTurn: targetTurn <= baseline\.turn/);

  const sourceKeyBuilder = source.slice(source.indexOf('function acceptedReplySourceKey'), source.indexOf('async function captureSwipeOutcome'));
  assert.match(sourceKeyBuilder, /const swipeId = Number\(message\?\.swipe_id\) \|\| 0/);
  assert.match(sourceKeyBuilder, /const narrativeFingerprint = textFingerprint\(runtime\.core\.profileNarrativeText\(source\)\)/);
  assert.match(sourceKeyBuilder, /return `\$\{chatId\}:message:\$\{Number\(messageId\)\}:swipe:\$\{swipeId\}:narrative:\$\{narrativeFingerprint\}`/);

  const accepted = source.slice(source.indexOf('async function acceptFinal'), source.indexOf('function latestUndoableVariableRepair'));
  assert.match(accepted, /runtime\.processingSession = session/);
  assert.match(accepted, /session\.worldSourceKey = acceptedReplySourceKey\(context, latestAi\.index, acceptedText\)/);
  assert.match(accepted, /if \(!sessionIsCurrent\(session\) \|\| worldResult\.cancelled\) return/);
  assert.ok(accepted.indexOf('if (!sessionIsCurrent(session) || worldResult.cancelled) return') < accepted.indexOf("addDiagnostic('world_failed'"));

  const cancel = source.slice(source.indexOf('function cancelCurrent'), source.indexOf('function renderRetryControl'));
  assert.match(cancel, /if \(processing\) processing\.cancelled = true/);
  assert.match(cancel, /runtime\.processingSession = null/);
  assert.match(cancel, /不会伪造档案或世界推进进度/);
});

test('待重试队列按回复身份逐项结算，prepare不会静默丢弃任务', () => {
  const retry = source.slice(source.indexOf('function setRetry'), source.indexOf('function restorePendingRetry'));
  assert.match(retry, /if \(options\.clearAll\) \{\s*queue = \[\]/);
  assert.match(retry, /else if \(runtime\.retry\) \{[\s\S]*retryDescriptorKey\(retryDescriptor\(runtime\.retry, context\)\)[\s\S]*queue = queue\.filter\(\(entry\) => retryDescriptorKey\(entry\) !== key\)/);
  assert.match(retry, /store\.pendingRetries = queue\.slice\(-24\)/);
  assert.match(retry, /runtime\.retry = store\.pendingRetries\.map\(\(entry\) => retryValueFromDescriptor\(entry, context\)\)\.find\(Boolean\) \|\| null/);

  const prepare = source.slice(source.indexOf('async function prepareGeneration'), source.indexOf('async function auditVariables'));
  const ordinaryPrepareEntry = prepare.slice(0, prepare.indexOf('const persistentQuarantine'));
  assert.doesNotMatch(ordinaryPrepareEntry, /runtime\.retry\s*=|setRetry\(|pendingRetries\s*=\s*\[\]|clearAll/);
  const quarantineBranch = prepare.slice(prepare.indexOf('const persistentQuarantine'), prepare.indexOf('const target = generationTarget'));
  assert.match(quarantineBranch, /if \(persistentQuarantine\)[\s\S]*setRetry\(null, \{ clearAll: true \}\)/);

  const accepted = source.slice(source.indexOf('async function acceptFinal'), source.indexOf('function latestUndoableVariableRepair'));
  const completed = accepted.indexOf('const variableNeedsManualConfirmation');
  const success = accepted.slice(completed, accepted.indexOf('await refreshUiData()', completed));
  assert.match(success, /clearRetryForAcceptedSession\(session, context\)/);
  assert.doesNotMatch(success, /setRetry\(null\)/);
  assert.doesNotMatch(success, /clearAll|pendingRetries\s*=\s*\[\]/);
});

test('GENERATION_STARTED只闭合状态所有权并抢占后台Doctor，不在正文前自动调用模型或等待重试', () => {
  assert.equal(manifest.generate_interceptor, 'mvuDoctorKeminiGenerateInterceptor');
  assert.match(source, /globalThis\.mvuDoctorKeminiGenerateInterceptor = mvuDoctorKeminiGenerateInterceptor/);

  const barrier = source.slice(source.indexOf('async function waitForGenerationStartBarrier'), source.indexOf('function interruptedProcessingRetry'));
  assert.match(barrier, /while \(runtime\.timer \|\| runtime\.recovering \|\| runtime\.swipeRestoring\)/);
  assert.doesNotMatch(barrier, /processingSession|requestControllers|retrying|internalGenerationDepth/);

  const preempt = source.slice(source.indexOf('async function preemptBackgroundDoctorForForeground'), source.indexOf('function generationPreparationCurrent'));
  assert.match(preempt, /mvuadBackgroundModelTask === true/);
  assert.match(preempt, /setRetry\(recovery, \{ context \}\)/);
  assert.match(preempt, /processing\.cancelled = true/);
  assert.match(preempt, /FOREGROUND_PREEMPTED/);
  assert.match(preempt, /runtime\.internalQuietGenerationStop = true[\s\S]*eventSource\?\.emit[\s\S]*runtime\.internalQuietGenerationStop = false/);
  assert.doesNotMatch(preempt, /cancelCurrent\(|runtime\.timer|runtime\.recovering|runtime\.swipeRestoring/);

  const lifecycle = source.slice(
    source.indexOf("context.eventSource.on(types.GENERATION_STARTED || 'generation_started'"),
    source.indexOf("context.eventSource.on(types.GENERATION_ENDED || 'generation_ended'"),
  );
  const barrierCall = lifecycle.indexOf('await waitForGenerationStartBarrier(startToken)');
  const preemptCall = lifecycle.indexOf('await preemptBackgroundDoctorForForeground(startContext)');
  const prepareStart = lifecycle.indexOf('preparation = beginGenerationPreparation', preemptCall);
  assert.ok(barrierCall >= 0 && preemptCall > barrierCall && prepareStart > preemptCall);
  assert.match(lifecycle, /const startToken = beginGenerationStart\(kind, startContext\)/);
  assert.equal((lifecycle.match(/beginGenerationStart\(kind, startContext\)/g) || []).length, 1);
  assert.doesNotMatch(lifecycle, /recoverPendingBeforeMainGeneration|await retryLastFailure/);
  assert.match(lifecycle, /if \(!isRerollGeneration\(kind\) && runtime\.retry\) \{[\s\S]*不会在正文请求前自动调用模型或暂停生成/);
  assert.match(lifecycle, /if \(!settings\(startContext\)\.enabled\) \{[\s\S]*clearInjection\(startContext\)[\s\S]*return;/);
  assert.doesNotMatch(lifecycle.slice(preemptCall, prepareStart), /runtime\.active\s*=/);
  assert.match(lifecycle.slice(prepareStart), /await prepareGeneration\(kind, preparation\)/);

  const interceptor = source.slice(source.indexOf('async function mvuDoctorKeminiGenerateInterceptor'), source.indexOf('globalThis.mvuDoctorKeminiGenerateInterceptor'));
  assert.match(interceptor, /const blocked = runtime\.blockedGeneration/);
  assert.match(interceptor, /if \(!runtime\.retry \|\| \(blocked\.retryKey && pendingKey !== blocked\.retryKey\)\)/);
  assert.match(interceptor, /if \(generationKind\(type\) !== blocked\.kind\) return/);
  assert.ok(interceptor.indexOf('clearInjection(context)') < interceptor.indexOf("if (typeof abort === 'function') abort(true)"));
  assert.match(interceptor, /if \(typeof abort === 'function'\) abort\(true\)/);
});

test('人物票据谱系按message、swipe和叙事指纹持久化，手动入口精确继承而不读fullRuns', () => {
  const ledger = source.slice(source.indexOf('function findTicketLedgerEntry'), source.indexOf('async function captureSwipeOutcome'));
  assert.match(ledger, /acceptedReplySourceKey\(context, messageId, acceptedText\)/);
  assert.match(ledger, /entry\?\.chatId === identity\?\.chatId/);
  assert.match(ledger, /Number\(entry\?\.messageId\) === Number\(identity\?\.messageId\)/);
  assert.match(ledger, /Number\(entry\?\.swipeId\) === Number\(identity\?\.swipeId\)/);
  assert.match(ledger, /if \(existing\) \{[\s\S]*semanticJsonEqual\(existing\.tickets \|\| \[\], session\.tickets \|\| \[\]\)[\s\S]*拒绝事后重掷或覆盖[\s\S]*return existing/);
  assert.match(ledger, /parseCharacterTicketReceipt\(session\.acceptedModelText \|\| acceptedText, session\.tickets \|\| \[\]\)/);
  assert.match(ledger, /semanticJsonEqual\(existing\.assignments \|\| \[\], assignments\)/);
  assert.match(ledger, /tickets: runtime\.core\.deepClone\(Array\.isArray\(session\.tickets\) \? session\.tickets : \[\]\)/);
  assert.match(ledger, /assignments: runtime\.core\.deepClone\(assignments\)/);

  const accepted = source.slice(source.indexOf('async function acceptFinal'), source.indexOf('function latestUndoableVariableRepair'));
  assert.match(accepted, /session\.acceptedModelText = acceptedText/);
  const ledgerCommit = accepted.indexOf('recordTicketLedger(session, context, latestAi.index, acceptedText)');
  const taskStart = accepted.indexOf('const variableTask = auditVariables');
  assert.ok(ledgerCommit >= 0 && ledgerCommit < taskStart);
  assert.match(accepted.slice(ledgerCommit, taskStart), /await saveMetadata\(context\)[\s\S]*assertAcceptedReplyTarget\(session, latestAi\.index\)/);

  const manualVariable = source.slice(source.indexOf('async function manualVariableRecheck'), source.indexOf('async function manualWorldRecheck'));
  const manualWorld = source.slice(source.indexOf('async function manualWorldRecheck'), source.indexOf('async function undoLastVariableRepair'));
  for (const manual of [manualVariable, manualWorld]) {
    assert.match(manual, /const ticketEntry = findTicketLedgerEntry\(context, latestAi\.index, latestAi\.message\.mes\)/);
    assert.match(manual, /tickets: runtime\.core\.deepClone\(ticketEntry\?\.tickets \|\| \[\]\)/);
    assert.doesNotMatch(manual, /fullRuns|sourceRuns|tickets:\s*\[\]/);
  }
  assert.match(manualWorld, /worldSourceKey: String\(ticketEntry\?\.sourceKey \|\| acceptedReplySourceKey/);
});

test('人物补档只使用正文生成时真实消费映射，缺回执仍补全但不事后绑票', () => {
  const profilePrompt = source.slice(
    source.indexOf('async function repairProfileReceipt'),
    source.indexOf('async function commitProfiles'),
  );
  assert.match(profilePrompt, /正文生成时实际返回的人物票据消费映射/u);
  assert.match(profilePrompt, /没有生成时消费回执或映射未覆盖的人物仍须被发现并完整补档/u);
  assert.match(profilePrompt, /不得绑定任何剩余票据/u);
  assert.doesNotMatch(profilePrompt, /按最终叙事首次出场顺序绑定|narrative-order/u);
  assert.doesNotMatch(profilePrompt, /receiptSafetyAppendix|票据回执的容错边界|回执缺失、损坏/u);
  assert.match(profilePrompt, /prompt: `\$\{prompt\}\$\{followupAppendix\}`/u);
});

test('同一message与swipe更新重试时保留最初worldSourceKey，完整正文指纹仍拒绝过期重试', () => {
  const descriptor = source.slice(source.indexOf('function retryDescriptor'), source.indexOf('function setRetry'));
  assert.match(descriptor, /worldSourceKey: String\(value\.session\?\.worldSourceKey \|\| ''\)/);
  assert.match(descriptor, /session: \{ \.\.\.compactRetrySession\(descriptor\.session\), chatId: descriptor\.chatId, worldSourceKey: descriptor\.worldSourceKey \|\| descriptor\.session\?\.worldSourceKey \|\| '' \}/);
  const lineageKey = descriptor.slice(descriptor.indexOf('function retryLineageKey'), descriptor.indexOf('function retryValueFromDescriptor'));
  assert.match(lineageKey, /chatId/);
  assert.match(lineageKey, /messageId/);
  assert.match(lineageKey, /swipeId/);
  assert.doesNotMatch(lineageKey, /messageFingerprint|textFingerprint/);
  const restore = descriptor.slice(descriptor.indexOf('function retryValueFromDescriptor'));
  assert.match(restore, /textFingerprint\(message\.mes \|\| ''\) !== descriptor\.messageFingerprint/);

  const setRetry = source.slice(source.indexOf('function setRetry'), source.indexOf('function restorePendingRetry'));
  assert.match(setRetry, /const lineageKey = retryLineageKey\(descriptor\)/);
  assert.match(setRetry, /const existingIndex = queue\.findIndex\(\(entry\) => retryLineageKey\(entry\) === lineageKey\)/);
  assert.match(setRetry, /descriptor\.worldSourceKey = String\(existing\.worldSourceKey \|\| descriptor\.worldSourceKey \|\| ''\)/);
  assert.match(setRetry, /descriptor\.session\.worldSourceKey = descriptor\.worldSourceKey/);

  const accepted = source.slice(source.indexOf('async function acceptFinal'), source.indexOf('function latestUndoableVariableRepair'));
  const sourceKey = accepted.indexOf('session.worldSourceKey = acceptedReplySourceKey(context, latestAi.index, acceptedText)');
  const variableTask = accepted.indexOf('const variableTask = auditVariables');
  assert.ok(sourceKey >= 0 && sourceKey < variableTask);
  assert.equal((accepted.match(/session\.worldSourceKey\s*=/g) || []).length, 1);
});

test('swipe恢复按递增epoch串行化并在每个异步边界复核身份，旧恢复不能覆盖新swipe', () => {
  const runtimeBlock = source.slice(source.indexOf('const runtime ='), source.indexOf('const getContext'));
  assert.match(runtimeBlock, /swipeRestoreEpoch: 0/);
  assert.match(runtimeBlock, /swipeRestoreChain: Promise\.resolve\(\)/);
  assert.match(runtimeBlock, /swipeRestoring: false/);

  const savedRestore = source.slice(source.indexOf('async function restoreSavedSwipeOutcome'), source.indexOf('async function restoreLatestSwipe'));
  assert.match(savedRestore, /restoreEpoch = runtime\.swipeRestoreEpoch/);
  assert.match(savedRestore, /const identity = swipeIdentity\(context, messageId\)/);
  assert.match(savedRestore, /const restoreCurrent = \(\) => restoreEpoch === runtime\.swipeRestoreEpoch\s*&& sameSwipeIdentity\(identity, swipeIdentity\(getContext\(\), messageId\)\)/);
  assert.ok((savedRestore.match(/if \(!restoreCurrent\(\)\)/g) || []).length >= 5);
  assert.match(savedRestore, /sameSwipeIdentity\(identity, outcome\)/);

  const latestRestore = source.slice(source.indexOf('async function restoreLatestSwipe'), source.indexOf('function queueLatestSwipeRestore'));
  assert.match(latestRestore, /let restoreIdentity = null/);
  assert.match(latestRestore, /restoreIdentity = swipeIdentity\(context, latestAi\.index\)/);
  assert.match(latestRestore, /const restoreCurrent = \(\) => restoreEpoch === runtime\.swipeRestoreEpoch\s*&& \(!restoreIdentity \|\| sameSwipeIdentity\(restoreIdentity, swipeIdentity\(getContext\(\), restoreIdentity\.messageId\)\)\)/);
  assert.ok((latestRestore.match(/if \(!restoreCurrent\(\)\)/g) || []).length >= 5);
  assert.match(latestRestore, /if \(!restoreCurrent\(\) \|\| selected\.stale\) return false/);

  const queue = source.slice(source.indexOf('function queueLatestSwipeRestore'), source.indexOf('function uiRoot'));
  assert.match(queue, /const restoreEpoch = \+\+runtime\.swipeRestoreEpoch/);
  assert.match(queue, /const queuedIdentity = queuedLatest \? swipeIdentity\(queuedContext, queuedLatest\.index\) : null/);
  assert.match(queue, /runtime\.swipeRestoreChain = runtime\.swipeRestoreChain\.catch\(\(\) => undefined\)[\s\S]*sameSwipeIdentity\(queuedIdentity, swipeIdentity\(getContext\(\), queuedIdentity\.messageId\)\)[\s\S]*restoreLatestSwipe\(value, restoreEpoch, queuedIdentity\)/);
  assert.match(queue, /if \(restoreEpoch === runtime\.swipeRestoreEpoch\) runtime\.swipeRestoring = false/);

  const lifecycle = source.slice(source.indexOf('async function init'), source.lastIndexOf('init().catch'));
  assert.match(lifecycle, /MESSAGE_SWIPED[\s\S]*queueLatestSwipeRestore\(value\)/);
  assert.doesNotMatch(lifecycle, /MESSAGE_SWIPED[\s\S]{0,180}restoreLatestSwipe\(value\)/);
});

test('取消accepted-final时按已完成阶段保留精确重试，而不是把处理中任务静默丢失', () => {
  const interruptedRetry = source.slice(source.indexOf('function interruptedProcessingRetry'), source.indexOf('async function preemptBackgroundDoctorForForeground'));
  assert.match(interruptedRetry, /String\(processing\.chatId \|\| ''\) !== String\(context\?\.chatId \|\| ''\)/);
  assert.match(interruptedRetry, /processing\.finalMessageId/);
  assert.match(interruptedRetry, /processing\.acceptedText/);
  assert.match(interruptedRetry, /const stages = \{ variable: false, profile: false, world: false, \.\.\.\(processing\.completedStages \|\| \{\}\) \}/);
  assert.match(interruptedRetry, /const kind = !stages\.variable \? \(processing\.manualVariableAudit \? 'variable-manual' : 'variable'\)[\s\S]*!stages\.profile \? 'profile'[\s\S]*!stages\.world \? 'world'/);
  assert.match(interruptedRetry, /return kind \? \{[\s\S]*session: processing[\s\S]*messageId: Number\(processing\.finalMessageId\)[\s\S]*profileRecovery: processing\.profileRecovery \|\| null[\s\S]*completedStages: stages/);

  const cancel = source.slice(source.indexOf('function cancelCurrent'), source.indexOf('async function restoreSavedSwipeOutcome'));
  assert.match(cancel, /const processing = runtime\.processingSession/);
  assert.match(cancel, /recovery = interruptedProcessingRetry\(processing, liveContext\)/);
  assert.ok(cancel.indexOf('if (processing) processing.cancelled = true') < cancel.indexOf('setRetry(recovery, { context: liveContext })'));
  assert.match(cancel, /else if \(recovery\) \{\s*setRetry\(recovery, \{ context: liveContext \}\);\s*persistence = saveMetadata\(liveContext\)\.catch/);
  assert.match(cancel, /return Promise\.all\(\[persistence, fallbackRestore\]\)/);
  assert.match(cancel, /未完成阶段已绑定当前最终正文保留/);
  const chatSwitch = cancel.slice(cancel.indexOf("if (/聊天已切换/u.test"), cancel.indexOf('setStatus(reason'));
  assert.match(chatSwitch, /聊天已切换[\s\S]*runtime\.retry = null/);
  assert.doesNotMatch(chatSwitch.slice(0, chatSwitch.indexOf('else if (recovery)')), /setRetry\(recovery/);
});

test('聊天恢复持有身份令牌并计入busy，只有同一恢复完成后才允许显示就绪', () => {
  const runtimeBlock = source.slice(source.indexOf('const runtime ='), source.indexOf('const getContext'));
  assert.match(runtimeBlock, /recoveryEpoch: 0/);
  assert.match(runtimeBlock, /recovering: null/);

  const busy = source.slice(source.indexOf('function runtimeHasPendingWork'), source.indexOf('function statusPresentation'));
  assert.match(busy, /runtime\.recovering/);

  const recovery = source.slice(source.indexOf('function recoveryTokenCurrent'), source.indexOf('async function retryLastFailure'));
  assert.match(recovery, /runtime\.recovering === token/);
  assert.match(recovery, /token\.epoch === runtime\.recoveryEpoch/);
  assert.match(recovery, /String\(getContext\(\)\?\.chatId \|\| ''\) === token\.chatId/);
  assert.match(recovery, /epoch: \+\+runtime\.recoveryEpoch/);
  assert.match(recovery, /runtime\.recovering = token/);
  assert.ok((recovery.match(/assertRecoveryCurrent\(token\)/g) || []).length >= 3);
  assert.match(recovery, /finally \{\s*if \(runtime\.recovering === token\) runtime\.recovering = null/);

  const lifecycle = source.slice(source.indexOf('async function init'), source.lastIndexOf('init().catch'));
  const chatRestore = lifecycle.slice(lifecycle.indexOf("for (const event of [types.CHAT_CHANGED"), lifecycle.indexOf('const store = await restoreDoctorStateForChat'));
  const restoreCall = chatRestore.indexOf('await restoreDoctorStateForChat(liveContext)');
  const refreshCall = chatRestore.indexOf('await refreshUiData()', restoreCall);
  const readyGate = chatRestore.indexOf('if (!runtimeHasPendingWork())', refreshCall);
  assert.ok(restoreCall >= 0 && refreshCall > restoreCall && readyGate > refreshCall);
  assert.match(chatRestore, /const lifecycleChatId = String\(getContext\(\)\?\.chatId \|\| ''\)/);
  assert.ok((chatRestore.match(/String\(getContext\(\)\?\.chatId \|\| ''\) !== lifecycleChatId/g) || []).length >= 2);
});

test('世界正常只保存一次；同目标失败至多补偿一次，跨目标不回写旧世界', () => {
  const commit = source.slice(source.indexOf('async function commitWorldState'), source.indexOf('async function advanceWorld'));
  const tryStart = commit.indexOf('try {');
  const catchStart = commit.indexOf('} catch (error) {', tryStart);
  const traceStart = commit.indexOf("traceRun(session, 'world:saved-unverified'", catchStart);
  const normalSave = commit.slice(tryStart, catchStart);
  const failedSave = commit.slice(catchStart, traceStart);
  assert.equal((normalSave.match(/await saveMetadata\(context\)/g) || []).length, 1);
  assert.equal((failedSave.match(/await saveMetadata\(context\)/g) || []).length, 1);
  assert.match(commit, /const worldTarget = worldMessageId === null \? null : assertAcceptedReplyTarget\(session, worldMessageId\)/);
  assert.match(failedSave, /if \(!worldTarget \|\| transactionTargetCurrent\(worldTarget\)\) \{[\s\S]*store\.world = baseline;[\s\S]*await saveMetadata\(context\)/);
  const crossTargetBranch = failedSave.slice(failedSave.indexOf('await quarantineUnsafeTransaction'));
  assert.match(crossTargetBranch, /旧世界快照未回写当前目标/);
  assert.doesNotMatch(crossTargetBranch, /store\.world = baseline|saveMetadata\(context\)/);
  assert.match(commit, /status: 'saved_unverified'/);
  assert.match(commit, /world:saved-unverified/);
  assert.doesNotMatch(commit, /metadata\(getContext\(\)\)\.world|readback_ok|saved-readback/);
  const load = source.slice(source.indexOf('async function loadWorldAuthority'), source.indexOf('function latestMessage'));
  assert.match(load, /status: beforeSchema[\s\S]*: 'loaded'/);
  assert.match(load, /readbackAt: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(source, /prepareWorldTransaction|world_candidate_prepared|markWorldReadback|verifyWorldReadback|recoverPreparedWorldState/);
  const refresh = source.match(/async function refreshUiData\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.ok(refresh.indexOf('renderWorld();') >= 0);
  assert.ok(refresh.indexOf('renderWorld();') < refresh.indexOf('await getMvu();'));
  assert.match(refresh, /catch \(error\)[\s\S]*世界面板仍已刷新/);
});

test('acceptedTarget绑定楼层、swipe与正文，变量和人物回滚都拒绝跨目标写入', () => {
  const accepted = source.slice(source.indexOf('async function acceptFinal'), source.indexOf('function latestUndoableVariableRepair'));
  const targetStart = accepted.indexOf('session.acceptedTarget = variableTarget(context, latestAi.index)');
  const targetFailure = accepted.indexOf('if (!session.acceptedTarget)', targetStart);
  const taskStart = accepted.indexOf('const variableTask = auditVariables');
  assert.ok(targetStart >= 0 && targetFailure > targetStart && taskStart > targetFailure);
  assert.match(accepted, /adoptControlledAcceptedTarget\(session, latestAi\.index, variableResult\.afterTarget\)/);

  const targetIdentity = source.slice(source.indexOf('function variableTarget'), source.indexOf('function sameVariableTarget'));
  assert.match(targetIdentity, /chatId:/);
  assert.match(targetIdentity, /messageId:/);
  assert.match(targetIdentity, /swipeId:/);
  assert.match(targetIdentity, /textFingerprint:/);

  for (const [name, rollback, writeNeedle] of [
    ['变量', source.slice(source.indexOf('async function rollbackMvuTouched'), source.indexOf('async function restoreRerollProfileAuthority')), 'await Mvu.replaceMvuData(restored.data'],
    ['人物', source.slice(source.indexOf('async function rollbackProfileRoot'), source.indexOf('function traceRun')), 'await Mvu.replaceMvuData(candidate'],
  ]) {
    assert.match(rollback, /if \(!transactionTargetCurrent\(expectedTarget\)\) return \{ ok: false, unsafeTargetChange: true/);
    assert.ok((rollback.match(/transactionTargetCurrent\(expectedTarget\)/g) || []).length >= 3, `${name}回滚必须在读取、写入和读回阶段持续核对目标`);
    assert.ok(rollback.indexOf('transactionTargetCurrent(expectedTarget)') < rollback.indexOf(writeNeedle), `${name}回滚必须先核对目标再写入`);
    assert.match(rollback, /目标变化|新目标|当前聊天必须隔离/);
  }
});

test('人物提交以最新MVU为拼接基线，写入与读回都隔离非人物状态', () => {
  const profiles = source.slice(source.indexOf('async function commitProfiles'), source.indexOf('async function commitWorldState'));
  const target = profiles.indexOf('const commitTarget = assertAcceptedReplyTarget(session, messageId)');
  const freshRead = profiles.indexOf('const freshBaseline = await mvuDataAt(Mvu, messageId)', target);
  const freshSplice = profiles.indexOf('mergeProfileRootDirect(freshBaseline, prepared.profiles)', freshRead);
  const preWriteIsolation = profiles.indexOf('if (!sameNonProfileStat(candidate, freshBaseline))', freshSplice);
  const write = profiles.indexOf('await Mvu.replaceMvuData(candidate', preWriteIsolation);
  const readbackIsolation = profiles.indexOf('!sameNonProfileStat(readback, freshBaseline)', write);
  assert.ok(target >= 0 && freshRead > target && freshSplice > freshRead && preWriteIsolation > freshSplice);
  assert.ok(write > preWriteIsolation && readbackIsolation > write);
  assert.match(profiles, /rollbackProfileRoot\(Mvu, freshBaseline, messageId, commitTarget\)/);
  assert.match(profiles, /if \(transactionTargetCurrent\(commitTarget\)\)[\s\S]*旧metadata快照未回写新目标/);
});

test('metadata保持同一权威对象身份，不在每次读取时重建命名空间', () => {
  const body = source.match(/function metadata\([\s\S]*?\n  function combinedProfiles/)?.[0] || '';
  assert.match(body, /let current = context\.chatMetadata\[PLUGIN_ID\]/);
  assert.match(body, /current\.schemaVersion = 7/);
  assert.doesNotMatch(body, /context\.chatMetadata\[PLUGIN_ID\] = \{\s*\.\.\.current/);
  const load = source.slice(source.indexOf('async function loadWorldAuthority'), source.indexOf('function latestMessage'));
  assert.match(load, /normalizeWorldState/);
  assert.match(load, /诊断报告未参与恢复/);
  assert.doesNotMatch(load, /fullRuns|recoverLatestLegacyWorld/);
});

test('世界面板从单一v7主体权威派生支线和变化，不再渲染旧多表世界', () => {
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  const worldUi = source.slice(source.indexOf('function renderWorld'), source.indexOf('function renderDiagnostics'));
  assert.match(worldUi, /normalizeWorldState\(store\.world/);
  assert.match(worldUi, /world\.subjects/);
  assert.match(worldUi, /deriveWorldBranches\(world\)/);
  assert.match(worldUi, /world\.changes/);
  assert.match(worldUi, /这里是唯一权威状态/);
  assert.match(worldUi, /支线只把主体已经造成的变化按主题归档/);
  assert.match(worldUi, /诊断报告不会反向覆盖/);
  assert.doesNotMatch(worldUi, /world\.threads|world\.attempts|world\.adjudications|world\.lanes|resolvedArchive/);
});

test('正文结构未确认时在任何变量、人物或世界任务创建前立即终止', () => {
  const accepted = source.slice(source.indexOf('async function acceptFinal'), source.indexOf('function latestUndoableVariableRepair'));
  const structureGate = accepted.indexOf('if (!structure.ok)');
  const variableStart = accepted.indexOf('auditVariables(session');
  const profileStart = accepted.indexOf('commitProfiles(session');
  const worldStart = accepted.indexOf('advanceWorld(session');
  assert.ok(structureGate >= 0 && structureGate < variableStart && structureGate < profileStart && structureGate < worldStart);
  const failedBranch = accepted.slice(structureGate, accepted.indexOf('if (structure.changed)'));
  assert.match(failedBranch, /stage: 'accepted-structure'/);
  assert.match(failedBranch, /return;/);
  assert.doesNotMatch(failedBranch, /auditVariables|commitProfiles|advanceWorld/);
});

test('完整报告在用户点击阶段先取得文件句柄且MVU读取失败不阻断导出', () => {
  const exporter = source.match(/async function exportFullReport\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(exporter, /showSaveFilePicker/);
  assert.ok(exporter.indexOf('showSaveFilePicker') < exporter.indexOf('await getMvu();'));
  assert.match(exporter, /currentMvuReadError/);
  assert.match(exporter, /createWritable/);
  assert.match(exporter, /JSON\.stringify\(report, null, 2\)/);
  assert.match(exporter, /runtimeSessions:\s*runtimeReportSnapshot\(context\)/);
  const snapshot = source.match(/function runtimeReportSnapshot\(context = getContext\(\)\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(snapshot, /active:\s*runtime\.active/);
  assert.match(snapshot, /processingSession:\s*runtime\.processingSession/);
  assert.match(snapshot, /preparation:\s*runtime\.preparation/);
  assert.match(snapshot, /lastFailedFinalizeOrSave:\s*runtime\.lastFailedReportSnapshot/);
  assert.match(snapshot, /requestControllers:\s*runtime\.requestControllers/);
  assert.match(snapshot, /redactReportSecrets/);
  const finalizer = source.slice(source.indexOf('async function finalizeRun'), source.indexOf('async function saveMetadata'));
  assert.match(finalizer, /lastFailedReportSnapshot\s*=\s*redactReportSecrets/);
  assert.match(finalizer, /trace:\s*session\.trace/);
});

test('手动变量复检不串行触发人物或世界，最小纠正按准备、写入、读回、必要补块排序', () => {
  const manual = source.slice(source.indexOf('async function manualVariableRecheck'), source.indexOf('async function manualWorldRecheck'));
  assert.match(manual, /auditVariables/);
  assert.match(manual, /mode:\s*'manual'/);
  assert.match(manual, /const hint = manualVariableHint\(\)/);
  assert.match(manual, /manualHint:\s*hint/);
  assert.doesNotMatch(manual, /commitProfiles|advanceWorld/);
  assert.match(manual, /人物与世界未运行/);
  assert.match(manual, /const downstreamRetry = runtime\.retry/);
  assert.match(manual, /if \(downstreamRetry\) setRetry\(downstreamRetry/);

  const audit = source.slice(source.indexOf('async function auditVariables'), source.indexOf('async function repairProfileReceipt'));
  const prepared = audit.indexOf("status: 'prepared'");
  const write = audit.indexOf('await Mvu.replaceMvuData(candidate');
  const readback = audit.indexOf('const readback = await mvuDataAt', write);
  const saveMessage = audit.indexOf('await appendVariableBlockIfMissing', readback);
  assert.ok(prepared >= 0 && prepared < write);
  assert.ok(write < readback && readback < saveMessage);
  assert.match(audit, /官方MVU无法解析模型纠正块/);
  assert.match(audit, /actualChanges\.paths/);
  assert.match(audit, /人物档案根不变/);
  assert.match(audit, /refreshMessageSurface/);
  assert.match(audit, /；零写入/);
});

test('人物和世界内容使用textContent节点渲染且控制台服从真实视口与手机触控合同', () => {
  assert.match(source, /function node\([\s\S]*textContent = text/);
  assert.match(source, /profileSection\(/);
  assert.match(source, /renderWorld\(/);
  assert.match(source, /redactDiagnostic/);
  assert.match(css, /@media \(max-width: 760px\), \(max-height: 600px\), \(pointer: coarse\)/);
  assert.match(css, /\.mvu-kc-console \{[\s\S]*?top: var\(--kc-viewport-top[\s\S]*?height: var\(--kc-viewport-height/);
  assert.match(css, /env\(safe-area-inset-(?:top|right|bottom|left)\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /\.mvu-kc-live \{[\s\S]*?max-height: 88px;[\s\S]*?overflow: hidden/);
  assert.match(css, /-webkit-line-clamp: 2/);
  assert.match(css, /\.mvu-kc-main \{[^}]*overflow-y: auto/);
  assert.match(source, /window\.visualViewport/);
  assert.match(source, /trapConsoleFocus/);
  assert.match(source, /mvu-kc-modal-open/);
  assert.match(css, /prefers-reduced-motion/);
});
