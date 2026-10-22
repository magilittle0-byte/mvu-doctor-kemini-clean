// Minimal independent adaptation; see docs/guidance/surface-source-map.md.
const STATUS = Object.freeze({ idle: '等待正文', loading: '读取记录', waiting: '正文生成中', queued: '等待幕后处理',
  generating: '幕后推演中', saving: '保存中', settled: '已保存', restored: '已恢复', conflict: '有待核对事项',
  failed: '本次未完成', cancelled: '已停止', disabled: '已关闭' });
const finite = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
const safeCode = value => /^[a-z][a-z0-9_]{0,64}$/u.test(String(value || '')) ? String(value) : '';

export function createGuideSurface({ getStatus = () => ({}), getRecord = () => null,
  retry = () => {}, setEnabled = () => {}, document = globalThis.document, window = globalThis.window } = {}) {
  if (!document?.body) throw new Error('guide_document_missing');
  if (document.getElementById('mvu-guidance-root')) throw new Error('guide_surface_duplicate');
  const listen = [];
  const on = (node, name, fn, options) => { node.addEventListener(name, fn, options); listen.push(() => node.removeEventListener(name, fn, options)); };
  const node = (parent, tag, text = '', className = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== '') element.textContent = String(text);
    parent?.appendChild(element);
    return element;
  };
  const root = node(document.body, 'div'); root.id = 'mvu-guidance-root';
  const launcher = node(root, 'button', '指导', 'guide-launcher'); launcher.type = 'button';
  launcher.setAttribute('aria-label', '打开指导'); launcher.setAttribute('aria-controls', 'mvu-guidance-panel');
  launcher.setAttribute('aria-expanded', 'false');
  const panel = node(root, 'aside', '', 'guide-panel'); panel.id = 'mvu-guidance-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'mvu-guidance-title');
  const header = node(panel, 'header', '', 'guide-header');
  const heading = node(header, 'div'); node(heading, 'p', '幕后推进与演变', 'guide-eyebrow');
  const title = node(heading, 'h2', '指导'); title.id = 'mvu-guidance-title';
  const close = node(header, 'button', '关闭', 'guide-close'); close.type = 'button'; close.setAttribute('aria-label', '关闭指导');
  const body = node(panel, 'div', '', 'guide-body');
  const statusLine = node(body, 'p', '', 'guide-status'); statusLine.setAttribute('role', 'status'); statusLine.setAttribute('aria-live', 'polite');
  const detail = node(body, 'p', '', 'guide-detail');
  const metrics = node(body, 'p', '', 'guide-muted');
  const controls = node(body, 'div', '', 'guide-controls');
  const toggleLabel = node(controls, 'label', '', 'guide-toggle');
  const toggle = node(toggleLabel, 'input'); toggle.type = 'checkbox'; toggle.setAttribute('aria-label', '启用指导自动推进');
  node(toggleLabel, 'span', '自动推进');
  const retryButton = node(controls, 'button', '重算本次', 'guide-retry'); retryButton.type = 'button';
  const cost = node(body, 'p', '“重算本次”会额外调用一次当前模型，并替换本次指导结果。', 'guide-muted');
  cost.id = 'mvu-guidance-retry-note'; retryButton.setAttribute('aria-describedby', cost.id);
  const feedback = node(body, 'p', '', 'guide-feedback'); feedback.setAttribute('role', 'alert'); feedback.hidden = true;
  const backstage = node(body, 'details', '', 'guide-details');
  node(backstage, 'summary', '幕后进展（含未公开内容）');
  node(backstage, 'p', '这里展示幕后发生的事，不代表玩家或人物已经知道。', 'guide-muted');
  const mattersBody = node(backstage, 'div', '', 'guide-matters');
  const diagnostics = node(body, 'details', '', 'guide-details');
  node(diagnostics, 'summary', '诊断');
  const diagnosticBody = node(diagnostics, 'dl', '', 'guide-diagnostics');
  node(body, 'p', '当前为制作候选，尚未完成真实酒馆验收。', 'guide-candidate');
  let disposed = false, actionBusy = false, lastState = {}, lastRecord = null, lastRecordKey = null;

  function viewport() {
    const visual = window?.visualViewport;
    const height = Math.max(120, Number(visual?.height || window?.innerHeight || 640));
    const top = Math.max(0, Number(visual?.offsetTop || 0));
    root.style.setProperty('--guide-visual-height', `${height}px`);
    root.style.setProperty('--guide-visual-top', `${top}px`);
  }
  function setOpen(open) {
    if (disposed) return;
    panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open));
    if (open) { viewport(); render(); close.focus?.(); }
    else launcher.focus?.();
  }
  function appendLines(parent, label, values) {
    if (!values?.length) return;
    node(parent, 'h4', label);
    const list = node(parent, 'ul');
    for (const value of values) node(list, 'li', value);
  }
  function renderMatters(record) {
    const key = JSON.stringify(record?.snapshot || null) + String(record?.summary || '');
    if (key === lastRecordKey) return;
    lastRecordKey = key; mattersBody.replaceChildren();
    if (!record) { node(mattersBody, 'p', '当前分支还没有已保存的幕后记录。', 'guide-muted'); return; }
    if (record.summary) node(mattersBody, 'p', record.summary, 'guide-record-summary');
    const matters = Array.isArray(record.snapshot?.matters) ? record.snapshot.matters : [];
    if (!matters.length) node(mattersBody, 'p', '当前没有需要持续推进的事项。', 'guide-muted');
    for (const matter of matters) {
      const article = node(mattersBody, 'article', '', 'guide-matter');
      node(article, 'h3', matter.title || '未命名事项');
      node(article, 'p', matter.status === 'closed' ? '已结束' : '持续推进中', 'guide-muted');
      if (matter.process) node(article, 'p', matter.process);
      if (Array.isArray(matter.subjects) && matter.subjects.length) node(article, 'p', `相关主体：${matter.subjects.join('、')}`, 'guide-muted');
      appendLines(article, '已成立的事', (matter.facts || []).map(fact => fact.text));
      appendLines(article, '还要满足的条件', (matter.conditions || []).map(item => `${item.when} → ${item.change}`));
      appendLines(article, '可在正文显露的后果', (matter.exposure || []).filter(item => item.status !== 'retired').map(item => {
        const label = item.status === 'shown' ? '模型核对已出现' : item.status === 'conflict' ? '与正文有冲突' : item.readiness === 'ready' ? '等待合适场景' : '仍需条件满足';
        return `${label}：${item.visible}${item.route ? `（${item.route}）` : ''}`;
      }));
    }
  }
  function renderDiagnostics(state, record) {
    diagnosticBody.replaceChildren();
    const data = [['状态码', safeCode(state.code) || '无'], ['已接受正文', finite(state.acceptedCount)],
      ['本次加载后调用', finite(state.requestCount)], ['有待处理正文', state.pending ? '是' : '否'],
      ['存档读回', state.readback ? '已核对' : '尚未确认'], ['本轮已赶上最新指导', state.latestApplied === false ? '未赶上' : '未报告遗漏'],
      ['资料覆盖受限', state.coverageLimited ? '是' : '未报告'], ['最近处理耗时', `${Math.round(finite(state.durationMs ?? record?.durationMs))} ms`]];
    for (const [label, value] of data) { node(diagnosticBody, 'dt', label); node(diagnosticBody, 'dd', value); }
  }
  function render(input, record) {
    if (disposed) return;
    try { lastState = input || getStatus() || {}; } catch { lastState = { status: 'failed', ready: false, detail: '指导状态暂时不可读' }; }
    try { lastRecord = record === undefined ? getRecord() : record; } catch { lastRecord = null; }
    const state = lastState, enabled = state.enabled !== false;
    const label = !enabled && state.ready !== false ? '已关闭' : STATUS[state.status] || '初始化中';
    statusLine.textContent = `指导 · ${label}`;
    detail.textContent = String(state.detail || '等待指导初始化');
    metrics.textContent = `${finite(state.matters)} 个事项 · 修订 ${finite(state.revision)}`;
    // Turning guidance off must stay available while a manual request is active.
    toggle.checked = enabled; toggle.disabled = state.ready === false;
    retryButton.disabled = actionBusy || state.ready === false || !enabled || !!state.busy || ['waiting', 'loading', 'saving', 'queued'].includes(state.status);
    launcher.dataset.state = state.status || 'idle';
    launcher.title = `指导：${label}`;
    renderDiagnostics(state, lastRecord);
    if (backstage.open) renderMatters(lastRecord);
  }
  async function act(callback) {
    if (actionBusy || disposed) return;
    actionBusy = true; feedback.hidden = true; render(lastState, lastRecord);
    try { await callback(); }
    catch { feedback.textContent = '操作未完成，请查看当前状态；没有自动追加调用。'; feedback.hidden = false; }
    finally { actionBusy = false; render(); }
  }
  on(launcher, 'click', () => setOpen(panel.hidden));
  on(close, 'click', () => setOpen(false));
  on(toggle, 'change', () => {
    const enabled = toggle.checked;
    feedback.hidden = true;
    try { Promise.resolve(setEnabled(enabled)).then(() => render()).catch(() => {
      feedback.textContent = '开关未能更新，请查看当前状态。'; feedback.hidden = false; render();
    }); }
    catch { feedback.textContent = '开关未能更新，请查看当前状态。'; feedback.hidden = false; render(); }
  });
  on(retryButton, 'click', () => { if (!retryButton.disabled) void act(retry); });
  on(backstage, 'toggle', () => { if (backstage.open) renderMatters(lastRecord); });
  // The host's document bubble handler uses Escape to stop generation. Capture
  // only this open panel's close gesture before it can reach that handler.
  on(document, 'keydown', event => {
    if (event.key !== 'Escape' || panel.hidden || event.isComposing) return;
    event.preventDefault(); event.stopPropagation(); setOpen(false);
  }, true);
  if (window?.addEventListener) on(window, 'resize', viewport);
  if (window?.visualViewport?.addEventListener) { on(window.visualViewport, 'resize', viewport); on(window.visualViewport, 'scroll', viewport); }
  viewport(); render();
  return Object.freeze({ root, launcher, panel, render, open: () => setOpen(true), close: () => setOpen(false),
    destroy() { if (disposed) return; disposed = true; for (const remove of listen.splice(0)) remove(); root.remove(); } });
}
