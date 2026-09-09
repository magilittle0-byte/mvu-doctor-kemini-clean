import { PROFILE_FIELDS } from './content.mjs';

const STATUS_LABELS = {
  idle: '等待正文', waiting: '等待正文', discovering: '发现人物', generating: '生成档案',
  saving: '保存中', complete: '已完成', partial: '部分完成', failed: '未完成',
  cancelled: '已取消', restored: '已恢复',
};

const TASK_STATUS_LABELS = {
  pending: '等待处理', generating: '生成中', discovering: '发现中', saving: '保存中',
  complete: '已完成', completed: '已完成', failed: '未完成，可重新修复',
  partial: '部分完成，可重新修复', cancelled: '已取消', restored: '已恢复',
};

function valueAt(profile, path) {
  return String(String(path || '').split(/[./]/u).filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], profile) ?? '');
}

function appendText(parent, text, className) {
  const node = document.createElement('span');
  if (className) node.className = className;
  node.textContent = String(text ?? '');
  parent.appendChild(node);
  return node;
}

export function createProfileUi({ host, version, onRetry, onCancel, onSettings }) {
  const box = document.createElement('details');
  box.id = 'mvu-profiles-panel';
  box.className = 'mvu-profiles-panel';
  box.innerHTML = '<summary>人物档案 <span class="mvu-profiles-status" data-status></span></summary>';
  const body = document.createElement('div');
  body.className = 'mvu-profiles-body';
  box.appendChild(body);
  (host.context?.()?.document?.querySelector?.('#extensions_settings2')
    || document.querySelector('#extensions_settings2')
    || document.querySelector('#extensions_settings')
    || document.body).appendChild(box);

  let disposed = false;
  let currentState = { status: 'idle', profiles: [], tasks: [], busy: false, enabled: false, recallEnabled: false };
  const clear = () => { while (body.firstChild) body.removeChild(body.firstChild); };
  const section = (title, className = '') => {
    const node = document.createElement('section');
    node.className = `mvu-profiles-section ${className}`.trim();
    const heading = document.createElement('h3');
    heading.textContent = title;
    node.appendChild(heading);
    body.appendChild(node);
    return node;
  };

  function render(state = {}) {
    if (disposed) return;
    currentState = state;
    box.dataset.state = state.status || 'idle';
    const status = box.querySelector('[data-status]');
    status.textContent = STATUS_LABELS[state.status] || state.status || '等待正文';
    clear();

    const detail = document.createElement('p');
    detail.className = 'mvu-profiles-detail';
    detail.textContent = state.detail || (state.status === 'idle' ? '等待本轮已接受正文' : '');
    body.appendChild(detail);

    const actions = document.createElement('div');
    actions.className = 'mvu-profiles-actions';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = '修复本轮档案';
    retry.disabled = Boolean(state.busy);
    retry.addEventListener('click', () => Promise.resolve(onRetry?.()).catch(() => render({ ...currentState, status: 'failed', busy: false, detail: '本轮档案处理未完成' })));
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = '取消'; cancel.disabled = !state.busy;
    cancel.addEventListener('click', () => { try { onCancel?.(); } catch { render({ ...currentState, status: 'failed', busy: false, detail: '无法取消本轮档案处理' }); } });
    actions.append(retry, cancel);
    body.appendChild(actions);

    const settings = section('设置', 'mvu-profiles-settings');
    const enabledLabel = document.createElement('label');
    const enabled = document.createElement('input');
    enabled.type = 'checkbox'; enabled.checked = Boolean(state.enabled);
    enabled.addEventListener('change', () => Promise.resolve(onSettings?.({ enabled: enabled.checked })).catch(() => {
      enabled.checked = !enabled.checked;
      appendText(settings, '设置保存失败，请稍后重试。', 'mvu-profiles-error');
    }));
    enabledLabel.append(enabled, document.createTextNode(' 自动建档'));
    const recallLabel = document.createElement('label');
    const recall = document.createElement('input');
    recall.type = 'checkbox'; recall.checked = Boolean(state.recallEnabled);
    recall.addEventListener('change', () => Promise.resolve(onSettings?.({ recallEnabled: recall.checked })).catch(() => {
      recall.checked = !recall.checked;
      appendText(settings, '设置保存失败，请稍后重试。', 'mvu-profiles-error');
    }));
    recallLabel.append(recall, document.createTextNode(' 让后续正文读取相关档案'));
    settings.append(enabledLabel, recallLabel);

    const profiles = Array.isArray(state.profiles) ? state.profiles : [];
    const profileSection = section('人物档案', profiles.length ? '' : 'mvu-profiles-empty');
    if (!profiles.length) appendText(profileSection, '当前没有可展示的完整档案。', 'mvu-profiles-muted');
    if (profiles.length) {
      const indexWrap = document.createElement('div');
      indexWrap.className = 'mvu-profiles-index-wrap';
      const table = document.createElement('table');
      table.className = 'mvu-profiles-index';
      const head = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (const label of ['姓名', '职业/身份', '地点', '在场说明', '查看详情']) {
        const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; headRow.appendChild(th);
      }
      head.appendChild(headRow); table.appendChild(head);
      const tbody = document.createElement('tbody');
      indexWrap.appendChild(table); table.appendChild(tbody); profileSection.appendChild(indexWrap);
      for (const profile of profiles) {
        const profileId = String(profile?.profileId ?? profile?.id ?? '');
        const row = document.createElement('tr');
        const cells = [
          profile?.name || profile?.displayName || '未命名人物',
          valueAt(profile, 'identity.occupation') || '未填写',
          valueAt(profile, 'currentState.location') || '未知',
          valueAt(profile, 'currentState.presence') || '未知',
        ];
        for (const value of cells) { const td = document.createElement('td'); td.textContent = String(value); row.appendChild(td); }
        const action = document.createElement('td');
        const jump = document.createElement('button'); jump.type = 'button'; jump.className = 'mvu-profiles-detail-button'; jump.textContent = '查看详情';
        jump.addEventListener('click', () => {
          const target = Array.from(profileSection.querySelectorAll('[data-profile-id]')).find(node => node.dataset.profileId === profileId);
          if (target) { target.open = true; target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        });
        action.appendChild(jump); row.appendChild(action); tbody.appendChild(row);
      }
    }
    for (const profile of profiles) {
      const card = document.createElement('details');
      card.className = 'mvu-profiles-card';
      card.dataset.profileId = String(profile?.profileId ?? profile?.id ?? '');
      card.open = false;
      const summary = document.createElement('summary');
      const title = document.createElement('h4');
      title.textContent = String(profile?.name || profile?.displayName || '未命名人物');
      summary.appendChild(title); card.appendChild(summary);
      const fields = document.createElement('dl');
      fields.className = 'mvu-profiles-fields';
      for (const field of PROFILE_FIELDS || []) {
        const dt = document.createElement('dt'); dt.textContent = String(field.label || field.path || '字段');
        const dd = document.createElement('dd');
        const value = valueAt(profile, field.path);
        if (field.type === 'list' && Array.isArray(profile?.[field.path])) {
          const list = document.createElement('ul');
          for (const item of profile[field.path]) { const li = document.createElement('li'); li.textContent = String(item ?? ''); list.appendChild(li); }
          dd.appendChild(list);
        } else dd.textContent = value;
        fields.append(dt, dd);
      }
      card.appendChild(fields); profileSection.appendChild(card);
    }

    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const taskSection = section('本轮处理', tasks.length ? '' : 'mvu-profiles-empty');
    if (!tasks.length) appendText(taskSection, '本轮尚未产生档案任务。', 'mvu-profiles-muted');
    for (const task of tasks) {
      const row = document.createElement('p'); row.className = 'mvu-profiles-task';
      appendText(row, task.sourceName || task.profileId || '人物');
      const taskStatus = TASK_STATUS_LABELS[task.status] || '未完成';
      appendText(row, `：${taskStatus}`, 'mvu-profiles-task-status');
      taskSection.appendChild(row);
    }
    const readback = section('恢复与读回');
    appendText(readback, state.restored ? '已有档案已恢复并可读。' : (state.readback ? '已完成档案读回。' : '尚未完成档案读回。'), 'mvu-profiles-detail');
    if (state.status === 'failed' || state.status === 'partial') appendText(readback, '本轮存在未完成项目；旧的完整档案仍保留展示。', 'mvu-profiles-muted');
    const versionNote = document.createElement('small'); versionNote.className = 'mvu-profiles-muted'; versionNote.textContent = `人物档案模块 ${version}`; body.appendChild(versionNote);
  }

  render(currentState);
  return {
    render,
    destroy() { disposed = true; box.remove(); },
  };
}
