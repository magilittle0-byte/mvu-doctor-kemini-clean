import { createProfileHost } from './host.mjs';
import { createProfileStore } from './store.mjs';
import { createProfileRuntime, PROFILE_VERSION } from './runtime.mjs';
import { createProfileUi } from './ui.mjs';
import { loadModuleLock } from '../modular/lock.mjs';

const root = new URL('../', import.meta.url);
const owners = new Set();
let pending = null, session = null;
function active() {
  for (const owner of owners) if (!owner.isConnected) owners.delete(owner);
  return owners.size > 0;
}
function stopSession(value) {
  value?.runtime?.destroy(); value?.ui?.destroy(); value?.css?.remove(); value?.note?.remove();
  if (session === value) session = null;
  if (globalThis.MVUDoctorProfiles?.dispose === dispose) delete globalThis.MVUDoctorProfiles;
}
export function dispose(owner) {
  owners.delete(owner);
  if (!active()) stopSession(session);
}
function assertOwner(value) {
  if (!active() || session !== value) throw new Error('profiles_unloaded');
}
async function initialize() {
  const value = {}; session = value;
  globalThis.MVUDoctorProfiles = Object.freeze({ ready: false, version: PROFILE_VERSION, stage: 2, dispose });
  try {
    const started = Date.now();
    while (!globalThis.MVUDoctorModular?.ready) {
      assertOwner(value);
      if (Date.now() - started > 60000) throw new Error('variables_not_loaded');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const host = createProfileHost();
    const lock = await loadModuleLock(root, globalThis.MVUDoctorModular.version);
    assertOwner(value);
    if (!lock.locked || !globalThis.MVUDoctorModular.locked) throw new Error('variables_not_locked');
    value.css = document.createElement('link'); value.css.rel = 'stylesheet';
    value.css.href = new URL('profiles/style.css', root).href; document.head.appendChild(value.css);
    value.ui = createProfileUi({ host, version: PROFILE_VERSION, onRetry: () => value.runtime.retry(),
      onCancel: () => value.runtime.cancel(), onSettings: values => value.runtime.updateSettings(values) });
    value.runtime = createProfileRuntime({ host, store: createProfileStore(), notify: value.ui.render });
    await value.runtime.bind(); assertOwner(value);
    const runtime = value.runtime;
    globalThis.MVUDoctorProfiles = Object.freeze({ ready: true, version: PROFILE_VERSION, stage: 2, locked: false,
      status: runtime.snapshot, retry: runtime.retry, cancel: runtime.cancel, read: runtime.read,
      record: runtime.record, review: runtime.review, dispose });
    return globalThis.MVUDoctorProfiles;
  } catch (error) {
    stopSession(value);
    if (!active() || error.message === 'profiles_unloaded') return null;
    session = value;
    const code = ['variables_not_loaded', 'variables_not_locked'].includes(error.message) ? error.message : 'profiles_boot_failed';
    globalThis.MVUDoctorProfiles = Object.freeze({ ready: false, version: PROFILE_VERSION, stage: 2, code, dispose });
    value.note = document.createElement('p'); value.note.id = 'mvu-profiles-load-error';
    value.note.textContent = code === 'variables_not_locked' ? '人物档案模块尚未启动：请先加载已锁定的变量模块。'
      : '人物档案模块未能加载，请检查安装后重新加载。';
    (document.querySelector('#extensions_settings2') || document.body).appendChild(value.note);
    return globalThis.MVUDoctorProfiles;
  }
}
// A helper loader node owns only P2. Cached modules can be explicitly booted again.
export async function boot(owner) {
  if (!owner?.isConnected) return null;
  owners.add(owner);
  if (pending) await pending;
  if (!owner.isConnected || !owners.has(owner)) return null;
  if (globalThis.MVUDoctorProfiles?.ready) return globalThis.MVUDoctorProfiles;
  if (pending) return pending;
  if (session) stopSession(session);
  pending = initialize();
  try { return await pending; } finally { pending = null; }
}
