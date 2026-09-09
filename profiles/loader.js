// TavernHelper script content: execute in its iframe, load P2 in the host page.
const hostWindow = window.parent;
const owner = hostWindow.document.createElement('script');
owner.type = 'module';
owner.id = `mvu-profiles-loader-${crypto.randomUUID()}`;
owner.textContent = `import { boot } from '/scripts/extensions/third-party/mvu-doctor-kemini-clean/profiles/entry.js';
const owner = document.getElementById(${JSON.stringify(owner.id)});
if (owner?.isConnected) void boot(owner);`;
const unload = () => {
  owner.remove();
  hostWindow.MVUDoctorProfiles?.dispose?.(owner);
};
window.addEventListener('pagehide', unload, { once: true });
window.addEventListener('unload', unload, { once: true });
hostWindow.document.head.appendChild(owner);
