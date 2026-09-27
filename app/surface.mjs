const IDS = Object.freeze({ variables: 'mvu-modular-panel', profiles: 'mvu-profiles-panel', world: 'mvu-doctor-world-root' });
const LABELS = Object.freeze({
  idle: '等待正文', waiting: '等待正文生成', waiting_mvu: '等待变量', checking: '检查中', parsing: '解析处理中', saving: '保存中',
  applied: '已修复', recovered: '已恢复', model_nochange: '无需修改', outdated: '记录已过期',
  discovering: '发现人物', generating: '生成档案', complete: '已完成', partial: '部分完成', failed: '未完成', cancelled: '已取消',
  loading: '加载中', settled: '已结算', restored: '已恢复',
});
const MODULES = Object.freeze([
  ['variables', '变量', 'MVUDoctorModular'], ['profiles', '人物', 'MVUDoctorProfiles'], ['world', '世界', 'MVUDoctorWorld'],
]);

function moduleSnapshot(globalName) {
  const api = globalThis[globalName];
  if (!api) return { present: false, api: null, state: null };
  let state = null;
  try { state = typeof api.status === 'function' ? api.status() : null; } catch { /* status stays unavailable */ }
  return { present: true, api, state: state && typeof state === 'object' ? state : null };
}

function statusLabel(status) {
  if (!status) return '已挂载，状态待更新';
  if (status.ready === false) return status.code === 'no_lock_record' ? '已加载，尚未锁定' : '初始化未完成';
  const value = String(status.status || 'idle');
  return LABELS[value] || '状态未知';
}

function nonNegative(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function moduleMetrics(key, status) {
  const calls = nonNegative(status?.requestCount);
  const elapsed = nonNegative(status?.durationMs ?? status?.result?.durationMs);
  let count = 0;
  if (key === 'variables') count = nonNegative(status?.result?.operationCount);
  if (key === 'profiles') count = Array.isArray(status?.profiles) ? status.profiles.length : null;
  if (key === 'world') count = nonNegative(status?.round);
  const noun = key === 'profiles' ? '档案' : key === 'world' ? '回合' : '变更';
  return `${count ?? '—'} ${noun} · ${calls ?? '—'} 次调用 · ${elapsed ?? '—'} ms`;
}

function visualViewportSync() {
  const viewport = window.visualViewport;
  const height = Number(viewport?.height) > 0 ? Number(viewport.height) : Math.max(1, Number(window.innerHeight || 1));
  const top = Math.max(0, Number(viewport?.offsetTop || 0));
  document.documentElement.style.setProperty('--mvu-ref-visual-height', `${height}px`);
  document.documentElement.style.setProperty('--mvu-ref-visual-top', `${top}px`);
}

export function mountDoctorSurface() {
  if (globalThis.__mvuDoctorSurface?.panel?.isConnected) {
    globalThis.__mvuDoctorSurface.sync();
    return globalThis.__mvuDoctorSurface;
  }
  if (!document.body) return null;
  if (!document.getElementById('mvu-doctor-app-style')) {
    const style = document.createElement('link');
    style.id = 'mvu-doctor-app-style'; style.rel = 'stylesheet';
    style.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(style);
  }

  const launcher = document.getElementById('mvu-ref-launcher') || document.createElement('button');
  launcher.id = 'mvu-ref-launcher'; launcher.type = 'button'; launcher.title = '打开人物与世界医生';
  launcher.setAttribute('aria-label', '打开人物与世界医生'); launcher.setAttribute('aria-controls', 'mvu-ref-panel');
  launcher.textContent = '✦';
  const panel = document.getElementById('mvu-ref-panel') || document.createElement('aside');
  panel.id = 'mvu-ref-panel'; panel.hidden = true; panel.setAttribute('aria-label', '人物与世界医生');
  panel.innerHTML = `<header><div><small>KEMINI CLEAN · 三模块状态入口</small><h2>人物与世界医生</h2></div><button type="button" data-surface-close aria-label="关闭">×</button></header>
    <nav aria-label="医生页面">
      <button type="button" data-tab="overview" aria-selected="true">总览</button>
      <button type="button" data-tab="variables" aria-selected="false">变量</button>
      <button type="button" data-tab="profiles" aria-selected="false">人物</button>
      <button type="button" data-tab="world" aria-selected="false">世界</button>
      <button type="button" data-tab="settings" aria-selected="false">设置</button>
    </nav>
    <section data-page="overview" class="active"><h3>模块状态</h3><div data-overview class="mvu-app-overview"></div><p class="mvu-app-note">此入口组合尚未完成真实酒馆门禁；当前状态只表示模块载入与本地快照。</p></section>
    <section data-page="variables"><h3>变量</h3><div data-module="variables" class="mvu-app-module"></div></section>
    <section data-page="profiles"><h3>人物档案</h3><div data-module="profiles" class="mvu-app-module"></div></section>
    <section data-page="world"><h3>世界引擎</h3><div data-module="world" class="mvu-app-module"></div></section>
    <section data-page="settings"><h3>现有配置入口</h3><p>变量模型连接沿用 Story Oracle（故事神谕）的现有配置。请在酒馆“扩展设置”中打开“故事神谕 (Story Oracle)”查看连接；变量检查开关与附加提示词在下方的变量模块设置中。</p><button type="button" data-open-variable-settings>打开变量设置</button><p>人物档案的自动建档与后续召回开关位于“人物”页原有模块设置中。世界设置由世界模块或其宿主负责。</p><div data-settings-status class="mvu-app-modules"></div></section>`;
  if (!launcher.isConnected) document.body.appendChild(launcher);
  if (!panel.isConnected) document.body.appendChild(panel);
  const originalPositions = new Map();

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open) sync();
  }
  function setPage(name) {
    if (!panel.querySelector(`[data-page="${name}"]`)) return;
    panel.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === name;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
    });
    panel.querySelectorAll('[data-page]').forEach(page => page.classList.toggle('active', page.dataset.page === name));
  }
  function movePanels() {
    for (const [key] of MODULES) {
      const node = document.getElementById(IDS[key]);
      const destination = panel.querySelector(`[data-module="${key}"]`);
      if (node && destination && node.parentElement !== destination) {
        if (!originalPositions.has(node)) {
          const summary = node.querySelector(':scope > summary');
          const staleNote = node.querySelector('[data-lock]');
          originalPositions.set(node, {
            parent: node.parentElement, next: node.nextSibling,
            open: node instanceof HTMLDetailsElement ? node.open : undefined,
            summaryHidden: summary?.hidden, staleNoteHidden: staleNote?.hidden,
          });
        }
        destination.appendChild(node);
      }
      if (key === 'variables' && node) {
        node.open = true;
        node.querySelector(':scope > summary')?.setAttribute('hidden', '');
        node.querySelector('[data-lock]')?.setAttribute('hidden', '');
      }
      if (key === 'profiles' && node) {
        node.open = true;
        node.querySelector(':scope > summary')?.setAttribute('hidden', '');
      }
    }
  }
  function syncOverview() {
    const overview = panel.querySelector('[data-overview]');
    const settings = panel.querySelector('[data-settings-status]');
    if (!overview || !settings) return;
    const cards = [];
    const app = globalThis.MVUDoctorApp;
    const appCard = document.createElement('article'); appCard.className = 'mvu-app-module-card';
    const appTitle = document.createElement('strong');
    appTitle.textContent = app?.ready === true ? '统一入口 · 候选，尚未完成真实门禁'
      : app?.code ? `统一入口 · 初始化未完成（${String(app.code).slice(0, 48)}）` : '统一入口 · 等待初始化';
    const appMetric = document.createElement('span'); appMetric.textContent = '真实门禁：未完成';
    appCard.append(appTitle, appMetric); cards.push(appCard);
    for (const [key, label, globalName] of MODULES) {
      const { present, api, state } = moduleSnapshot(globalName);
      const nodeExists = Boolean(document.getElementById(IDS[key]));
      const stateLabel = key === 'world' && state?.status === 'generating' ? '推演中'
        : present ? statusLabel({ ...state, ready: api.ready }) : nodeExists ? '界面已挂载，状态待初始化' : '尚未载入';
      const card = document.createElement('article'); card.className = 'mvu-app-module-card';
      const title = document.createElement('strong'); title.textContent = `${label} · ${stateLabel}`;
      const metric = document.createElement('span'); metric.textContent = moduleMetrics(key, state);
      card.append(title, metric); cards.push(card);
    }
    overview.replaceChildren(...cards);
    settings.replaceChildren(...cards.map(card => card.cloneNode(true)));
  }
  let queued = false;
  function sync() { movePanels(); syncOverview(); configureObserver(); }
  function queueSync() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; sync(); });
  }
  launcher.addEventListener('click', () => setOpen(panel.hidden));
  panel.addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]');
    if (tab) { setPage(tab.dataset.tab); sync(); return; }
    if (event.target.closest('[data-surface-close]')) { setOpen(false); return; }
    if (event.target.closest('[data-open-variable-settings]')) {
      setPage('variables');
      const variablePanel = document.getElementById(IDS.variables);
      if (variablePanel) {
        variablePanel.open = true;
        const settings = [...variablePanel.querySelectorAll('details')].at(-1);
        if (settings) settings.open = true;
        settings?.scrollIntoView?.({ block: 'nearest' });
      }
    }
  });
  const onEscape = event => { if (event.key === 'Escape' && !panel.hidden) setOpen(false); };
  const onAppStatus = () => { if (panel.isConnected) syncOverview(); };
  document.addEventListener('keydown', onEscape);
  window.addEventListener('mvu-doctor-app-status', onAppStatus);
  visualViewportSync();
  window.addEventListener('resize', visualViewportSync);
  window.visualViewport?.addEventListener('resize', visualViewportSync);
  window.visualViewport?.addEventListener('scroll', visualViewportSync);
  const observer = new MutationObserver(records => {
    const relevant = records.some(record => {
      const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      const moduleNodeChanged = [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE
        && Object.values(IDS).some(id => node.id === id || node.querySelector?.(`#${id}`)));
      if (moduleNodeChanged) return true;
      if (target?.closest && MODULES.some(([key]) => target.closest(`#${IDS[key]}`))) return true;
      if (target?.closest?.('#mvu-ref-panel')) return false;
      return false;
    });
    if (relevant) queueSync();
  });
  function configureObserver() {
    observer.disconnect();
    observer.observe(document.body, { childList: true });
    for (const root of [document.querySelector('#extensions_settings2'), document.querySelector('#extensions_settings')]) {
      if (root && root !== document.body) observer.observe(root, { childList: true, subtree: true });
    }
    for (const [key] of MODULES) {
      const node = document.getElementById(IDS[key]);
      if (node) observer.observe(node, { childList: true, subtree: true });
      const container = panel.querySelector(`[data-module="${key}"]`);
      if (container) observer.observe(container, { childList: true });
    }
  }
  const surface = { launcher, panel, sync, destroy() {
    observer.disconnect(); document.removeEventListener('keydown', onEscape);
    window.removeEventListener('mvu-doctor-app-status', onAppStatus);
    window.removeEventListener('resize', visualViewportSync);
    window.visualViewport?.removeEventListener('resize', visualViewportSync);
    window.visualViewport?.removeEventListener('scroll', visualViewportSync);
    for (const [node, origin] of originalPositions) {
      if (!node.isConnected || !origin.parent?.isConnected) continue;
      const before = origin.next?.parentNode === origin.parent ? origin.next : null;
      origin.parent.insertBefore(node, before);
      if (origin.open !== undefined) node.open = origin.open;
      const summary = node.querySelector(':scope > summary');
      if (summary && origin.summaryHidden !== undefined) summary.hidden = origin.summaryHidden;
      const staleNote = node.querySelector('[data-lock]');
      if (staleNote && origin.staleNoteHidden !== undefined) staleNote.hidden = origin.staleNoteHidden;
    }
    launcher.remove(); panel.remove(); document.getElementById('mvu-doctor-app-style')?.remove();
    delete globalThis.__mvuDoctorSurface;
  } };
  globalThis.__mvuDoctorSurface = surface;
  sync();
  return surface;
}
