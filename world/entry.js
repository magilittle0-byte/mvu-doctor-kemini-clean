import { createWorldHost } from './host.mjs';
import { createWorldStore } from './store.mjs';
import { createWorldRuntime, WORLD_VERSION } from './runtime.mjs';
import { createWorldSurface } from './surface.mjs';
import { loadWorldDependencies } from './dependencies.mjs';

// Minimal independent-owner adaptation of the locked profiles/entry.js.
const root = new URL('../', import.meta.url), owners = new Set();
let pending = null, session = null;
function active() {
  for (const owner of owners) if (!owner.isConnected) owners.delete(owner);
  return owners.size > 0;
}
function stopSession(value) {
  value?.runtime?.destroy(); value?.surface?.dispose(); value?.css?.remove(); value?.note?.remove();
  if (session === value) session = null;
  if (globalThis.MVUDoctorWorld?.dispose === dispose) delete globalThis.MVUDoctorWorld;
}
export function dispose(owner) { owners.delete(owner); if (!active()) stopSession(session); }
function assertOwner(value) { if (!active() || session !== value) throw new Error('world_unloaded'); }
async function initialize() {
  const value = {}; session = value;
  globalThis.MVUDoctorWorld = Object.freeze({ ready: false, version: WORLD_VERSION, stage: 3, dispose });
  try {
    const started = Date.now();
    while (!globalThis.MVUDoctorModular?.ready || !globalThis.MVUDoctorProfiles?.ready) {
      assertOwner(value);
      if (Date.now() - started > 60000) throw new Error('dependencies_not_loaded');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const dependencies = await loadWorldDependencies(root);
    assertOwner(value);
    if (!dependencies.locked || !globalThis.MVUDoctorModular.locked
      || globalThis.MVUDoctorModular.version !== dependencies.p1.version
      || globalThis.MVUDoctorProfiles.version !== dependencies.p2.version) throw new Error('dependencies_not_locked');
    value.css = document.createElement('link'); value.css.rel = 'stylesheet';
    value.css.href = new URL('world/style.css', root).href; document.head.appendChild(value.css);
    value.surface = createWorldSurface({ getStatus: () => value.runtime?.snapshot(), getRecord: () => value.runtime?.record(),
      retry: () => value.runtime.retry(), refresh: () => value.runtime.refresh() });
    value.runtime = createWorldRuntime({ host: createWorldHost(), store: createWorldStore(), notify: value.surface.render });
    await value.runtime.bind(); assertOwner(value);
    const runtime = value.runtime;
    globalThis.MVUDoctorWorld = Object.freeze({ ready: true, stage: 3, version: WORLD_VERSION, locked: false,
      dependencies, status: runtime.snapshot, retry: runtime.retry, cancel: runtime.cancel, refresh: runtime.refresh,
      read: runtime.read, record: runtime.record, review: runtime.review, dispose });
    return globalThis.MVUDoctorWorld;
  } catch (error) {
    stopSession(value);
    if (!active() || error.message === 'world_unloaded') return null;
    session = value;
    const code = ['dependencies_not_loaded', 'dependencies_not_locked'].includes(error.message) ? error.message : 'world_boot_failed';
    globalThis.MVUDoctorWorld = Object.freeze({ ready: false, stage: 3, version: WORLD_VERSION, code, dispose });
    value.note = document.createElement('p'); value.note.id = 'mvu-world-load-error';
    value.note.textContent = code === 'dependencies_not_locked' ? '世界模块未启动：已锁定的变量或人物模块文件与锁定记录不一致。'
      : '世界模块未能加载，请检查三个模块的安装后重新加载。';
    (document.querySelector('#extensions_settings2') || document.body).appendChild(value.note);
    return globalThis.MVUDoctorWorld;
  }
}
export async function boot(owner) {
  if (!owner?.isConnected) return null;
  owners.add(owner);
  if (pending) await pending;
  if (!owner.isConnected || !owners.has(owner)) return null;
  if (globalThis.MVUDoctorWorld?.ready) return globalThis.MVUDoctorWorld;
  if (pending) return pending;
  if (session) stopSession(session);
  pending = initialize();
  try { return await pending; } finally { pending = null; }
}
