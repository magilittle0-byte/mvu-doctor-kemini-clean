import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('0.2.0控制台包含连接、人物、世界、诊断与恢复入口', () => {
  for (const tab of ['overview', 'connection', 'profiles', 'world', 'diagnostics']) {
    assert.match(source, new RegExp(`data-tab=["']${tab}["']`));
    assert.match(source, new RegExp(`data-panel=["']${tab}["']`));
  }
  for (const role of ['apiEndpoint', 'apiKey', 'apiModel', 'additionalPrompt', 'models', 'testApi', 'profile-select', 'world-list', 'diagnostic-list', 'retry', 'cancel']) {
    assert.match(source, new RegExp(`data-role=["']${role}["']`));
  }
  assert.match(source, /openAiChatEndpoint/);
  assert.match(source, /fetchApiModels/);
  assert.match(source, /retryLastFailure/);
  assert.equal(manifest.version, '0.2.0');
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
