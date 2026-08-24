import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('0.4.4控制台包含变量、连接、人物、世界、诊断与恢复入口', () => {
  for (const tab of ['overview', 'connection', 'profiles', 'world', 'diagnostics']) {
    assert.match(source, new RegExp(`data-tab=["']${tab}["']`));
    assert.match(source, new RegExp(`data-panel=["']${tab}["']`));
  }
  for (const role of ['variableDoctor', 'variableTokens', 'apiEndpoint', 'apiKey', 'apiModel', 'additionalPrompt', 'models', 'testApi', 'profile-select', 'world-list', 'world-persistence', 'diagnostic-list', 'retry', 'cancel', 'exportFullReport']) {
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
  assert.equal(manifest.version, '0.4.4');
  assert.match(source, /variable:schema-rejected/);
  assert.match(source, /localValidation\.code === 'schema_incompatible'/);
  assert.match(source, /真实MVU干运行拒绝了变量建议/);
  assert.doesNotMatch(source, /没有按补丁落地全部目标路径';\s*if \(attempt < attempts\) continue/u);
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
  assert.match(body, /current\.schemaVersion = 4/);
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

test('人物和世界内容使用textContent节点渲染且移动端为全屏控制台', () => {
  assert.match(source, /function node\([\s\S]*textContent = text/);
  assert.match(source, /profileSection\(/);
  assert.match(source, /renderWorld\(/);
  assert.match(source, /redactDiagnostic/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /width: 100vw/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /prefers-reduced-motion/);
});
