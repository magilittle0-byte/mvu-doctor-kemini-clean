import { createGuideHost } from './host.mjs';
import { createGuideStore } from './store.mjs';
import { createGuideRuntime } from './runtime.mjs';
import { createGuideSurface } from './surface.mjs';

export const VERSION = '0.12.0-candidate.8';
const INSTANCE = Symbol.for('mvu-guidance.instance.v1');
const LEGACY = ['MVUDoctorApp', 'MVUDoctorModular', 'MVUDoctorProfiles', 'MVUDoctorWorld',
  'MVUDoctorReferenceBaseline', 'MVUDoctorProfileEngine'];
let domListener = null;

export function boot() {
  if (globalThis[INSTANCE]) return globalThis[INSTANCE].promise;
  if (!globalThis.document?.body) return Promise.resolve(null);
  const state = { disposed: false, ready: false, failure: null, runtime: null, host: null, surface: null, css: null, promise: null };
  globalThis[INSTANCE] = state;
  const safeState = () => {
    if (state.disposed) return { ready: false, status: 'disabled', enabled: false, busy: false, detail: '指导已停用' };
    if (state.failure) return { ready: false, status: 'failed', enabled: false, busy: false, code: state.failure,
      detail: state.failure === 'guide_legacy_conflict'
        ? '检测到旧医生已挂载，指导未启动。请先停用旧医生，再重新加载酒馆。'
        : '指导初始化未完成。请检查当前安装与宿主能力后重新加载，已有记录未被覆盖。' };
    return { ...(state.runtime?.snapshot() || { status: 'loading', detail: '正在读取指导记录', enabled: true }), ready: state.ready };
  };
  const render = () => state.surface?.render(safeState());
  const api = Object.freeze({ version: VERSION, realAcceptance: false,
    get ready() { return state.ready && !state.disposed; },
    get code() { return state.failure; },
    status: safeState, snapshot: safeState,
    record: () => state.runtime?.record() || null,
    retry: () => state.ready && !state.disposed ? state.runtime.retry() : Promise.resolve(),
    setEnabled: enabled => { if (state.ready && !state.disposed) state.runtime.setEnabled(enabled); },
    open: () => state.surface?.open(),
    destroy: () => dispose(),
  });
  globalThis.MVUGuidance = api;
  function dispose() {
    if (state.disposed) return;
    state.disposed = true; state.ready = false;
    globalThis.window?.removeEventListener('pagehide', dispose);
    try { if (state.runtime) state.runtime.destroy(); else state.host?.destroy(); }
    finally {
      state.surface?.destroy(); state.css?.remove();
      if (globalThis.MVUGuidance === api) delete globalThis.MVUGuidance;
      if (globalThis[INSTANCE] === state) delete globalThis[INSTANCE];
    }
  }
  globalThis.window?.addEventListener('pagehide', dispose, { once: true });
  state.promise = (async () => {
    try {
      const styleUrl = new URL('./style.css', import.meta.url).href;
      if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === styleUrl)) {
        state.css = document.createElement('link'); state.css.rel = 'stylesheet'; state.css.dataset.guidanceOwned = 'true';
        state.css.href = styleUrl; document.head.appendChild(state.css);
      }
      state.surface = createGuideSurface({ getStatus: safeState, getRecord: api.record, retry: api.retry, setEnabled: api.setEnabled });
      if (LEGACY.some(name => globalThis[name] != null)) throw Object.assign(new Error(), { code: 'guide_legacy_conflict' });
      const ctx = globalThis.SillyTavern?.getContext?.();
      if (!ctx?.eventSource?.on || !ctx?.eventSource?.removeListener || !ctx?.setExtensionPrompt || !globalThis.indexedDB)
        throw Object.assign(new Error(), { code: 'guide_capability_missing' });
      state.host = createGuideHost();
      state.runtime = createGuideRuntime({ host: state.host, store: createGuideStore(), notify: render });
      await state.runtime.bind();
      if (state.disposed) return null;
      state.ready = true; render();
      return api;
    } catch (error) {
      if (state.disposed) return null;
      state.failure = ['guide_legacy_conflict', 'guide_capability_missing'].includes(error?.code) ? error.code : 'guide_boot_failed';
      try { if (state.runtime) state.runtime.destroy(); else state.host?.destroy(); } catch { /* Keep the visible, sanitized boot failure. */ }
      state.runtime = null; state.host = null;
      render();
      return api;
    }
  })();
  return state.promise;
}

export function disable() {
  if (domListener) { document.removeEventListener('DOMContentLoaded', domListener); domListener = null; }
  globalThis.MVUGuidance?.destroy?.();
}
export const enable = () => boot();

if (globalThis.document?.body) void boot();
else if (globalThis.document?.addEventListener) {
  domListener = () => { domListener = null; void boot(); };
  document.addEventListener('DOMContentLoaded', domListener, { once: true });
}
