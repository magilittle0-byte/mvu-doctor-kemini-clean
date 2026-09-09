// TavernHelper owns this independent P3 module through its loader node.
const hostWindow = window.parent;
const owner = hostWindow.document.createElement('script');
owner.type = 'module';
owner.id = `mvu-world-loader-${crypto.randomUUID()}`;
owner.textContent = `import { boot } from '/scripts/extensions/third-party/mvu-doctor-kemini-clean/world/entry.js';
const owner = document.getElementById(${JSON.stringify(owner.id)});
if (owner?.isConnected) void boot(owner);`;
const unload = () => {
  owner.remove();
  hostWindow.MVUDoctorWorld?.dispose?.(owner);
};
window.addEventListener('pagehide', unload, { once: true });
window.addEventListener('unload', unload, { once: true });
hostWindow.document.head.appendChild(owner);
