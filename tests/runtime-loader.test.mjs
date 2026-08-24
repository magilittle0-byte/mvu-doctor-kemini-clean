import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('currentScript为空时自包含运行时仍能初始化并注册事件', async () => {
  const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /document\.currentScript/);
  assert.doesNotMatch(source, /import\s*\(\s*new URL\(['"]\.\/core\.mjs/);
  assert.match(source, /MVU_KEMINI_EMBEDDED_CORE_START/);

  const handlers = [];
  const info = [];
  const errors = [];
  const uiRoot = {
    dataset: {},
    querySelector() { return { textContent: '', addEventListener() {}, checked: false, value: '' }; },
  };
  const context = {
    chatId: 'loader-test-chat', chat: [], chatMetadata: {}, extensionSettings: {},
    eventTypes: {
      GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended',
      GENERATION_STOPPED: 'generation_stopped', CHAT_CHANGED: 'chat_changed', CHAT_LOADED: 'chat_loaded',
    },
    eventSource: { on(name, handler) { handlers.push([name, handler]); } },
    setExtensionPrompt() {}, saveSettingsDebounced() {},
  };
  const sandbox = {
    window: { SillyTavern: { getContext: () => context }, crypto: globalThis.crypto },
    document: {
      currentScript: null,
      getElementById: () => uiRoot,
      createElement: () => { throw new Error('UI should already be mounted in loader test'); },
      body: { appendChild() {} },
    },
    console: { info: (...args) => info.push(args), error: (...args) => errors.push(args), warn() {} },
    setTimeout, clearTimeout, structuredClone,
  };
  vm.runInNewContext(source, sandbox, { filename: 'index.js' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(errors, []);
  assert.equal(handlers.some(([name]) => name === 'generation_started'), true);
  assert.equal(handlers.some(([name]) => name === 'generation_ended'), true);
  assert.equal(info.some((args) => String(args[0]).includes('initialized')), true);
});

test('聊天切换恢复完成后清除旧busy表象并回到当前聊天就绪态', async () => {
  const source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const nodes = new Map();
  const makeNode = () => ({
    textContent: '', className: '', value: '', checked: false, dataset: {},
    addEventListener() {}, appendChild() {}, append() {}, replaceChildren() {},
    setAttribute() {}, removeAttribute() {}, remove() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { toggle() {}, add() {}, remove() {} },
  });
  const nodeFor = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, makeNode());
    return nodes.get(selector);
  };
  const uiRoot = {
    dataset: {},
    querySelector: nodeFor,
    querySelectorAll() { return []; },
  };
  const context = {
    chatId: 'fresh-chat', chat: [], chatMetadata: {}, extensionSettings: {},
    eventTypes: {
      GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended',
      GENERATION_STOPPED: 'generation_stopped', CHAT_CHANGED: 'chat_changed', CHAT_LOADED: 'chat_loaded',
    },
    eventSource: { on(name, handler) { handlers.set(name, handler); } },
    setExtensionPrompt() {}, saveSettingsDebounced() {}, async saveMetadata() {},
  };
  const sandbox = {
    window: { SillyTavern: { getContext: () => context }, crypto: globalThis.crypto },
    document: {
      currentScript: null,
      getElementById: () => uiRoot,
      createElement: makeNode,
      body: { appendChild() {} },
      addEventListener() {},
    },
    console: { info() {}, error() {}, warn() {} },
    Option: function Option(text = '', value = '') { return { ...makeNode(), textContent: text, value }; },
    setTimeout, clearTimeout, structuredClone,
  };
  vm.runInNewContext(source, sandbox, { filename: 'index.js' });
  await new Promise((resolve) => setTimeout(resolve, 20));

  handlers.get('chat_changed')();
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(uiRoot.dataset.state, 'ready', JSON.stringify({
    phase: nodeFor('[data-role="phase"]').textContent,
    detail: nodeFor('[data-role="detail"]').textContent,
  }));
  assert.equal(nodeFor('[data-role="phase"]').textContent, '医生已就绪');
  assert.equal(nodeFor('[data-role="detail"]').textContent, '当前聊天状态已重新载入');
});
