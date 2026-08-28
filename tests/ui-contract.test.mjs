import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('控制台包含变量、连接、人物、世界、诊断与独立手动复检入口', () => {
  for (const tab of ['overview', 'connection', 'profiles', 'world', 'diagnostics']) {
    assert.match(source, new RegExp(`data-tab=["']${tab}["']`));
    assert.match(source, new RegExp(`data-panel=["']${tab}["']`));
  }
  for (const role of ['variableDoctor', 'variableTokens', 'apiEndpoint', 'apiKey', 'apiModel', 'additionalPrompt', 'models', 'testApi', 'profile-select', 'world-list', 'world-persistence', 'diagnostic-list', 'retry', 'manualVariableAudit', 'undoVariableRepair', 'cancel', 'exportFullReport']) {
    assert.match(source, new RegExp(`data-role=["']${role}["']`));
  }
  assert.match(source, /openAiChatEndpoint/);
  assert.match(source, /fetchApiModels/);
  assert.match(source, /retryLastFailure/);
  assert.match(source, /auditVariables/);
  assert.match(source, /removeApiFromExport/);
  assert.match(source, /正文只负责确认谁实际出场以及哪些事实不能违背，不是档案信息上限/);
  assert.match(source, /profileCompletionContract/);
  assert.match(source, /profileRecovery/);
  assert.match(source, /Number\(settings\(\)\.repairAttempts\) \+ 1/);
  assert.match(source, /normalizeVariableOperations/);
  assert.match(source, /assessVariableBaseline/);
  assert.doesNotMatch(source, /<AuditReceipt>/);
  assert.match(source, /variable:dry-run-failed/);
  assert.match(source, /variable:authority-rejected/);
  assert.match(source, /variable:dry-run-rejected-operations-separated/);
  assert.match(source, /authority_rejected_nochange/);
  assert.match(source, /人物档案与世界不会在变量未闭合时继续/);
  assert.doesNotMatch(source, /schemaRejected:\s*true/);
  assert.match(source, /manualVariableRecheck/);
  assert.match(source, /本次只处理变量；人物档案与世界引擎未运行/);
  assert.match(source, /store\.fullRuns = store\.fullRuns\.slice\(0, 24\)/);
  assert.match(source, /discoverProfileSubjects/);
  assert.match(source, /高置信标签和编号作为必须覆盖的下限/);
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
  assert.match(source, /releaseSessionRecall/);
  const release = source.slice(source.indexOf('function releaseSessionRecall'), source.indexOf('async function acceptFinal'));
  assert.match(release, /totalItemCount = Array\.isArray\(session\.recallPackage\.items\)/);
  assert.match(release, /consumedItemCount: 0/);
  assert.match(release, /totalItemCount,/);
  assert.match(source, /insert_missing_content_open_before_first_narrative_anchor/);
  assert.match(source, /正文结构无法安全修复\|正文结构修复未能持久化/);
  assert.match(source, /未知（外观像青年）/);
  assert.match(source, /unsupported_aliases_removed/);
  assert.match(source, /assessRecallConsumption/);
  assert.match(source, /正文未采用/);
  assert.match(source, /recallSelectionInput/);
  assert.match(source, /required_once/);
  assert.match(source, /本轮玩家明确动作/);
  assert.match(source, /不补写输入外动机/);
});

test('仍有阶段待处理时运行态优先于完成措辞且恢复与手动入口共用同一忙碌门', () => {
  const helper = source.slice(source.indexOf('function runtimeHasPendingWork'), source.indexOf('function statusPresentation'));
  assert.match(helper, /\['pending', 'ready', 'running'\]/);
  assert.match(helper, /runtime\.active \|\| runtime\.timer \|\| runtime\.requestController \|\| runtime\.retrying \|\| progressBusy/);

  const presentation = source.slice(source.indexOf('function statusPresentation'), source.indexOf('function setStatus'));
  assert.ok(presentation.indexOf('runtimeHasPendingWork()') < presentation.indexOf('/完成|就绪|已确认|已恢复|已撤销|处理完成/'));
  assert.match(source, /root\.dataset\.state = advice\?\.severity === 'error'[\s\S]*advice\?\.severity === 'success' \? 'ready' : 'busy'/);
  assert.match(source, /const busy = runtimeHasPendingWork\(\)/);
  assert.match(source, /if \(!runtimeHasPendingWork\(\)\) \{\s*setStatus\('医生已就绪'/);
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

test('原变量块先经真实MVU确定性重放再判定落地，空补丁套话不能冒充核验', () => {
  const audit = source.slice(source.indexOf('async function auditVariables'), source.indexOf('async function repairProfileReceipt'));
  assert.match(audit, /Mvu\.parseMessage\(original\.rawBlock, runtime\.core\.deepClone\(previousData\)\)/);
  assert.equal((audit.match(/Mvu\.parseMessage\(original\.rawBlock/g) || []).length, 2);
  assert.match(audit, /assessOriginalMvuReplay\(\{ currentData, firstReplayData, secondReplayData \}\)/);
  assert.match(audit, /originalReplay,/);
  assert.match(audit, /validateVariableAuditAnalysis\(parsed\.analysis, \{ emptyPatch: !parsed\.operations\.length \}\)/);
  assert.match(audit, /variable:analysis-unsubstantiated/);
  assert.match(audit, /JSON Pointer路径/);
  assert.match(audit, /差异为0.*不能单独作为依据/);
});

test('正文只接收世界公开投影，人物私有摘要只供Doctor内部阶段使用', () => {
  assert.match(source, /worldRecallPackage_publicProjection/);
  assert.match(source, /只能使用每项的publicSurface、publicClues、rumors、revealedSummary、visibleAction与observableConsequence/);
  assert.match(source, /privateProfileDigestFromData\(dataWithRecoveredProfiles/);
  assert.match(source, /privateProfileDigestFromData\(data\), 30000/);
  assert.match(source, /validateWorldProposal\(proposal, \{ previous: baseline, acceptedText:/);
  assert.match(source, /正文只接收公开投影/);
  assert.match(source, /医生私有推进/);
});

test('世界公开字段先局部净化再校验，取消会话不再进入重试、失败诊断或迟到终结', () => {
  const worldAdvance = source.slice(source.indexOf('async function advanceWorld'), source.indexOf('function releaseSessionRecall'));
  assert.ok(worldAdvance.indexOf('sanitizeWorldProposalPublicProjection') < worldAdvance.indexOf('validateWorldProposal'));
  assert.match(worldAdvance, /world:public-projection-repaired/);
  assert.match(worldAdvance, /if \(isSessionCancellation\(error, session\)\)/);
  assert.ok(worldAdvance.indexOf('if (isSessionCancellation(error, session))') < worldAdvance.indexOf("traceRun(session, 'world:retryable-failure'"));
  assert.match(worldAdvance, /restoreCancelledWorldAttempt/);
  assert.match(worldAdvance, /cancelled: true/);

  const accepted = source.slice(source.indexOf('async function acceptFinal'), source.indexOf('function latestUndoableVariableRepair'));
  assert.match(accepted, /runtime\.processingSession = session/);
  assert.match(accepted, /if \(!sessionIsCurrent\(session\) \|\| worldResult\.cancelled\) return/);
  assert.ok(accepted.indexOf('if (!sessionIsCurrent(session) || worldResult.cancelled) return') < accepted.indexOf("addDiagnostic('world_failed'"));

  const cancel = source.slice(source.indexOf('function cancelCurrent'), source.indexOf('function renderRetryControl'));
  assert.match(cancel, /if \(processing\) processing\.cancelled = true/);
  assert.match(cancel, /runtime\.processingSession = null/);
  assert.match(cancel, /不会伪造档案或世界推进进度/);
});

test('世界提交使用准备、提交、读回三段证明且MVU读取不能阻塞面板刷新', () => {
  assert.match(source, /prepareWorldTransaction/);
  assert.match(source, /world_candidate_prepared/);
  assert.match(source, /verifyWorldReadback/);
  assert.match(source, /markWorldReadback/);
  assert.match(source, /不得把模型返回冒充为已保存状态/);
  const refresh = source.match(/async function refreshUiData\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.ok(refresh.indexOf('renderWorld();') >= 0);
  assert.ok(refresh.indexOf('renderWorld();') < refresh.indexOf('await getMvu();'));
  assert.match(refresh, /catch \(error\)[\s\S]*世界面板仍已刷新/);
});

test('metadata保持同一权威对象身份，不在每次读取时重建命名空间', () => {
  const body = source.match(/function metadata\([\s\S]*?\n  function combinedProfiles/)?.[0] || '';
  assert.match(body, /let current = context\.chatMetadata\[PLUGIN_ID\]/);
  assert.match(body, /current\.schemaVersion = 5/);
  assert.doesNotMatch(body, /context\.chatMetadata\[PLUGIN_ID\] = \{\s*\.\.\.current/);
});

test('完整报告在用户点击阶段先取得文件句柄且MVU读取失败不阻断导出', () => {
  const exporter = source.match(/async function exportFullReport\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(exporter, /showSaveFilePicker/);
  assert.ok(exporter.indexOf('showSaveFilePicker') < exporter.indexOf('await getMvu();'));
  assert.match(exporter, /currentMvuReadError/);
  assert.match(exporter, /createWritable/);
  assert.match(exporter, /JSON\.stringify\(report, null, 2\)/);
});

test('手动变量复检不串行触发人物或世界，变量提交按准备、写入、读回、正文保存排序', () => {
  const manual = source.slice(source.indexOf('async function manualVariableRecheck'), source.indexOf('async function undoLastVariableRepair'));
  assert.match(manual, /auditVariables/);
  assert.match(manual, /force:\s*true/);
  assert.doesNotMatch(manual, /commitProfiles|advanceWorld/);
  assert.match(manual, /人物与世界未运行/);

  const audit = source.slice(source.indexOf('async function auditVariables'), source.indexOf('async function repairProfileReceipt'));
  const prepared = audit.indexOf("status: 'prepared'");
  const write = audit.indexOf('await Mvu.replaceMvuData(candidate');
  const readback = audit.indexOf('const readback = await mvuDataAt', write);
  const saveMessage = audit.indexOf('await saveMergedVariableBlock', readback);
  assert.ok(prepared >= 0 && prepared < write);
  assert.ok(write < readback && readback < saveMessage);
  assert.match(audit, /Schema.*失败|本地补丁安全校验失败/);
  assert.match(audit, /return \{ ok: false, error: `\$\{reason\}；零写入` \}/);
});

test('人物和世界内容使用textContent节点渲染且移动端为全屏控制台', () => {
  assert.match(source, /function node\([\s\S]*textContent = text/);
  assert.match(source, /profileSection\(/);
  assert.match(source, /renderWorld\(/);
  assert.match(source, /redactDiagnostic/);
  assert.match(css, /@media \(max-width: \d+px\)[\s\S]*?\.mvu-kc-console \{ inset: 0; width: 100vw; height: 100vh; height: 100dvh;/);
  assert.match(css, /prefers-reduced-motion/);
});
