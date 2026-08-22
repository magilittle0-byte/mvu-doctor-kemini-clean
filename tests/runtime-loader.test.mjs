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
