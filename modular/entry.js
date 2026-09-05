import { createHost } from './host.mjs';
import { createStore } from './store.mjs';
import { createVariableModule } from './variables/module.mjs';
import { createRuntime } from './runtime.mjs';
import { loadStory, disableNativeDiagnosis } from './story-adapter.mjs';
import { createUi } from './ui.mjs';

export const VERSION = '0.10.0';
const root = new URL('../', import.meta.url);
async function boot() {
  if (globalThis.MVUDoctorModular) return;
  const host = createHost();
  while (!globalThis.SillyTavern?.getContext?.()?.eventSource) await host.delay(100);
  const ui = createUi({ host, version: VERSION });
  try {
    const internals = await loadStory(root, host);
    const store = createStore();
    const variables = createVariableModule({ host, store, story: () => internals });
    const runtime = createRuntime({ host, store, variables, disableNative: () => disableNativeDiagnosis(host.context()), notify: ui.render });
    globalThis.MVUDoctorModular = Object.freeze({ version: VERSION, ready: true, stage: 1, locked: false,
      status: runtime.snapshot, retry: runtime.retry, cancel: runtime.cancel, subscribe: runtime.subscribe,
      // Local inspector access only; these records are never auto-uploaded.
      record: runtime.record, review: variables.review,
    });
    ui.attach(runtime); runtime.bind();
  } catch (error) {
    globalThis.MVUDoctorModular = Object.freeze({ version: VERSION, ready: false, code: error.code || 'boot_failed' });
    ui.render({ status: 'failed', detail: `第一阶段初始化未完成（${error.code || 'boot_failed'}），未启动任何修复。`, busy: false });
  }
}
void boot();
