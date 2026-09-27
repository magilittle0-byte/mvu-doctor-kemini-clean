import { mountDoctorSurface } from './surface.mjs';

export const VERSION = '0.11.0-candidate.1';
const root = new URL('../', import.meta.url);

async function boot() {
  if (globalThis.MVUDoctorApp) return;
  globalThis.MVUDoctorApp = { version: VERSION, ready: false, realAcceptance: false };
  mountDoctorSurface();
  const owner = document.createElement('span');
  owner.id = 'mvu-doctor-app-owner'; owner.hidden = true; document.body.appendChild(owner);
  const dispose = () => {
    owner.remove();
    globalThis.MVUDoctorWorld?.dispose?.(owner);
    globalThis.MVUDoctorProfiles?.dispose?.(owner);
  };
  window.addEventListener('pagehide', dispose, { once: true });
  try {
    await import(new URL('modular/entry.js', root).href);
    const started = Date.now();
    while (!globalThis.MVUDoctorModular?.ready) {
      if (!owner.isConnected) return;
      if (globalThis.MVUDoctorModular?.code || Date.now() - started > 90000) throw new Error('variables_unavailable');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const profiles = await import(new URL('profiles/entry.js', root).href);
    if (!(await profiles.boot(owner))?.ready) throw new Error('profiles_unavailable');
    if (!owner.isConnected) return;
    const world = await import(new URL('world/entry.js', root).href);
    if (!(await world.boot(owner))?.ready) throw new Error('world_unavailable');
    if (owner.isConnected) {
      globalThis.MVUDoctorApp = { version: VERSION, ready: true, realAcceptance: false };
      window.dispatchEvent(new Event('mvu-doctor-app-status'));
    }
  } catch (error) {
    globalThis.MVUDoctorApp = { version: VERSION, ready: false, realAcceptance: false,
      code: ['variables_unavailable', 'profiles_unavailable', 'world_unavailable'].includes(error.message)
        ? error.message : 'app_boot_failed' };
    window.dispatchEvent(new Event('mvu-doctor-app-status'));
  }
}

if (document.body) void boot();
else document.addEventListener('DOMContentLoaded', () => void boot(), { once: true });
