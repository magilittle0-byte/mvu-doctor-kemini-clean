const STATUS_LABELS = Object.freeze({
  idle: '等待本轮世界处理', waiting: '等待世界处理', checking: '检查中', loading: '读取中',
  generating: '推演中', saving: '保存中', complete: '已完成', partial: '部分完成',
  failed: '未完成，可重新修复', cancelled: '已取消', restored: '已恢复', settled: '已结算',
});
const SAFE_ERRORS = new Set(['world_failed', 'world_stale', 'world_not_ready', 'world_store_read', 'world_transport']);
const WORLD_FIELDS = Object.freeze([
  ['worldDigest', '世界摘要'], ['events', '事件'], ['factions', '组织'], ['winds', '传闻'], ['worldTrends', '世界趋势'],
  ['reputation', '声望'], ['economy', '经济'], ['memories', '记忆'], ['enemies', '敌对势力'], ['influenceChain', '影响链'],
  ['regionalIncident', '区域事件'], ['distantEvent', '远方事件'], ['nearEvent', '近处事件'],
]);
const STAGE_LABELS = Object.freeze({ 1: '变量阶段', 2: '人物档案阶段', 3: '世界推进阶段' });

function safeError(value) {
  const code = typeof value === 'string' ? value : value?.code;
  return SAFE_ERRORS.has(code) ? code : (code ? 'unknown_error' : '');
}

function displayValue(value) {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return '不可显示'; }
}

function append(parent, tag, text, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = String(text ?? '');
  parent.appendChild(node);
  return node;
}

function recordIsComplete(record) {
  return !!record && typeof record === 'object' && !Array.isArray(record)
    && record.world && typeof record.world === 'object' && !Array.isArray(record.world)
    && ['complete', 'settled', 'restored'].includes(String(record.status || '').toLowerCase());
}

export function createWorldSurface({ getStatus = () => ({}), getRecord = () => null, retry = () => {}, refresh = () => {} } = {}) {
  const root = document.createElement('section');
  root.id = 'mvu-doctor-world-root';
  root.className = 'mvu-world-panel';
  const title = document.createElement('h2'); title.textContent = '世界引擎模块'; root.appendChild(title);
  const body = document.createElement('div'); root.appendChild(body);
  (document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings') || document.body).appendChild(root);
  let disposed = false, lastState = {};

  function currentStatus(input) {
    try { return input && typeof input === 'object' ? input : (getStatus?.() || {}); }
    catch { return { status: 'failed', error: 'world_store_read' }; }
  }
  function currentRecord(input) {
    try { return input !== undefined ? input : (getRecord?.() || null); }
    catch { return null; }
  }
  function clear() { while (body.firstChild) body.removeChild(body.firstChild); }
  function detailOpenState() {
    const state = new Map();
    const visit = node => { for (const child of node.children || []) { if (child.tagName === 'DETAILS' && child.dataset.surfaceKey) state.set(child.dataset.surfaceKey, child.open === true); visit(child); } };
    visit(body); return state;
  }
  function render(input = undefined) {
    if (disposed) return;
    const state = currentStatus(input);
    const fetchedRecord = currentRecord(input?.record);
    const record = fetchedRecord;
    const opened = detailOpenState();
    lastState = { ...state };
    clear();
    const status = document.createElement('dl'); status.className = 'mvu-world-status'; body.appendChild(status);
    for (const [label, value] of [['模块', '世界引擎'], ['状态', STATUS_LABELS[state.status] || '未知状态'], ['阶段', STAGE_LABELS[state.stage] || state.stage || '—'], ['处理中', state.busy === true ? '是' : '否'], ['读回', state.readback === true ? '一致' : '未完成'], ['错误', safeError(state.error) || '无'], ['回合', state.round ?? '—'], ['恢复', state.restored === true ? '是' : '否']]) {
      append(status, 'dt', label); append(status, 'dd', value);
    }
    if (state.detail) append(body, 'p', state.detail, 'mvu-world-detail');
    const actions = document.createElement('div'); actions.className = 'mvu-world-actions'; body.appendChild(actions);
    const repair = append(actions, 'button', '修复本轮'); repair.type = 'button'; repair.disabled = Boolean(state.busy);
    repair.addEventListener('click', () => Promise.resolve(retry?.()).catch(() => render({ ...lastState, status: 'failed', busy: false, error: 'world_transport' })));
    const reload = append(actions, 'button', '刷新'); reload.type = 'button'; reload.addEventListener('click', () => Promise.resolve(refresh?.()).then(value => render(value)).catch(() => render({ ...lastState, status: 'failed', busy: false, error: 'world_store_read' })));
    const details = document.createElement('details'); details.className = 'mvu-world-record'; body.appendChild(details);
    details.dataset.surfaceKey = 'world-record'; details.open = opened.get('world-record') === true;
    append(details, 'summary', '世界记录（默认折叠）');
    if (!record) { append(details, 'p', '当前没有可显示的完整世界记录'); return; }
    const meta = document.createElement('dl'); details.appendChild(meta);
    for (const [label, value] of [['状态', STATUS_LABELS[record.status] || record.status], ['楼层', record.index], ['修订', record.revision], ['暂缓的人物', record.heldProfiles], ['召回与正文证据', record.deliveries]]) { append(meta, 'dt', label); append(meta, 'dd', displayValue(value)); }
    const binding = document.createElement('details'); binding.className = 'mvu-world-binding'; binding.dataset.surfaceKey = 'technical-binding'; binding.open = opened.get('technical-binding') === true; details.appendChild(binding);
    append(binding, 'summary', '技术绑定（默认折叠）');
    const bindingMeta = document.createElement('dl'); binding.appendChild(bindingMeta);
    for (const [label, value] of [['输入身份 hash', record.inputIdentity], ['变量身份 hash', record.variableIdentity], ['档案记录 hash', record.profileRecordHash]]) { append(bindingMeta, 'dt', label); append(bindingMeta, 'dd', displayValue(value)); }
    const world = record.world || {};
    const worldValues = document.createElement('dl'); details.appendChild(worldValues);
    for (const [field, label] of WORLD_FIELDS) { append(worldValues, 'dt', label); append(worldValues, 'dd', displayValue(world[field])); }
    const blackbox = document.createElement('details'); blackbox.className = 'mvu-world-blackbox'; details.appendChild(blackbox);
    blackbox.dataset.surfaceKey = 'blackbox'; blackbox.open = opened.get('blackbox') === true;
    append(blackbox, 'summary', '黑箱记录（默认折叠）'); append(blackbox, 'pre', displayValue(world.blackbox));
  }
  render();
  return { render, dispose() { disposed = true; root.remove(); } };
}
