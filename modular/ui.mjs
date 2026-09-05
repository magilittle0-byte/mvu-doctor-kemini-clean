export function createUi({ host, version }) {
  const box = document.createElement('details');
  box.id = 'mvu-modular-panel';
  box.innerHTML = `<summary>模块医生 <span data-status>正在加载</span></summary>
    <div class="mvu-modular-body"><strong>第一阶段 · MVU变量修复</strong>
    <p data-detail>正在加载诊断组件</p>
    <p class="mvu-modular-muted">人物档案、世界引擎尚未制作。当前候选尚未完成真实门禁，未锁定。</p>
    <div class="mvu-modular-actions"><button type="button" data-retry>重试本轮</button><button type="button" data-cancel>取消检查</button></div>
    <details><summary>设置</summary>
      <label><input type="checkbox" data-enabled> 自动检查本轮变量</label>
      <label>最多尝试次数 <input type="number" min="1" max="6" data-attempts></label>
      <label>全局自定义模型适配附加提示词<textarea rows="5" data-prompt></textarea></label>
      <p class="mvu-modular-muted">模型连接沿用故事神谕的当前配置。</p>
      <button type="button" data-save>保存设置</button><span data-saved></span>
    </details><small data-version></small></div>`;
  (document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings') || document.body).appendChild(box);
  const query = key => box.querySelector(`[data-${key}]`);
  const settings = host.settings();
  query('enabled').checked = settings.enabled; query('attempts').value = settings.maxAttempts; query('prompt').value = settings.globalPrompt;
  query('version').textContent = `Kemini Clean ${version} · 变量模块候选`;
  let runtime;
  query('retry').onclick = () => void runtime?.retry().catch(() => render({ status: 'failed', detail: '当前正文无法绑定，未执行检查' }));
  query('cancel').onclick = () => runtime?.cancel();
  query('save').onclick = () => {
    const enabled = query('enabled').checked;
    host.updateSettings({ enabled, maxAttempts: Math.max(1, Math.min(6, Math.floor(Number(query('attempts').value) || 3))), globalPrompt: query('prompt').value });
    if (!enabled) runtime?.cancel('自动检查已关闭');
    query('saved').textContent = '已保存';
  };
  const labels = { idle: '等待正文', waiting: '正文生成中', waiting_mvu: '等待MVU', checking: '检查中', parsing: '解析修复', saving: '保存中', applied: '已修复', recovered: '已恢复', model_nochange: '模型判定无需修改', cancelled: '已取消', failed: '未完成', outdated: '记录已过期' };
  function render(state) {
    box.dataset.state = state.status; query('status').textContent = labels[state.status] || state.status;
    query('detail').textContent = state.detail || '';
    query('cancel').disabled = !state.busy; query('retry').disabled = Boolean(state.busy || state.status === 'waiting');
  }
  return { render, attach: value => { runtime = value; render(runtime.snapshot()); } };
}
