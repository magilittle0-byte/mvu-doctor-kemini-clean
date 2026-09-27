import { createWorldHost } from './host.mjs';
import { createWorldStore } from './store.mjs';
import { createWorldRuntime, WORLD_VERSION } from './runtime.mjs';
import { createWorldSurface } from './surface.mjs';

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
    const response = await fetch(new URL('world/manifest.json', root), { cache: 'no-store' });
    if (!response.ok) throw new Error('dependencies_incompatible');
    const manifest = await response.json();
    assertOwner(value);
    if (manifest.version !== WORLD_VERSION || manifest.stage !== 3 || manifest.requires?.length !== 2
      || manifest.requires[0]?.stage !== 1 || manifest.requires[1]?.stage !== 2
      || globalThis.MVUDoctorModular.version !== manifest.requires[0].version
      || globalThis.MVUDoctorProfiles.version !== manifest.requires[1].version)
      throw new Error('dependencies_incompatible');
    const dependencies = { compatible: true, locked: false,
      p1: { stage: 1, version: globalThis.MVUDoctorModular.version },
      p2: { stage: 2, version: globalThis.MVUDoctorProfiles.version } };
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
    const code = ['dependencies_not_loaded', 'dependencies_incompatible'].includes(error.message) ? error.message : 'world_boot_failed';
    globalThis.MVUDoctorWorld = Object.freeze({ ready: false, stage: 3, version: WORLD_VERSION, code, dispose });
    value.note = document.createElement('p'); value.note.id = 'mvu-world-load-error';
    value.note.textContent = code === 'dependencies_incompatible' ? '世界模块未启动：变量或人物模块版本与当前安装包不匹配，请完整更新医生。'
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
