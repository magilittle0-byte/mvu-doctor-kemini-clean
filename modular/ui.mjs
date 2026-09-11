export function createUi({ host, version, lock = { locked: false } }) {
  const box = document.createElement('details');
  box.id = 'mvu-modular-panel';
  box.innerHTML = `<summary>模块医生 <span data-status>正在加载</span></summary>
    <div class="mvu-modular-body"><strong>第一阶段 · MVU变量修复</strong>
    <p data-detail>正在加载诊断组件</p>
    <p class="mvu-modular-muted" data-lock>人物档案、世界引擎尚未制作。当前候选尚未完成真实门禁，未锁定。</p>
    <p class="mvu-modular-muted" data-calls>本次变量诊断请求：0 / 1</p>
    <div class="mvu-modular-actions"><button type="button" data-retry>修复本轮</button><button type="button" data-cancel>取消检查</button></div>
    <details><summary>设置</summary>
      <label><input type="checkbox" data-enabled> 自动检查本轮变量</label>
      <p class="mvu-modular-muted">每次自动检查或点击修复最多调用模型一次。失败后停止，点击“修复本轮”才会重新请求。</p>
      <label>全局自定义模型适配附加提示词<textarea rows="5" data-prompt></textarea></label>
      <p class="mvu-modular-muted">模型连接沿用故事神谕的当前配置。</p>
      <button type="button" data-save>保存设置</button><span data-saved></span>
    </details><small data-version></small></div>`;
  (document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings') || document.body).appendChild(box);
  const query = key => box.querySelector(`[data-${key}]`);
  const settings = host.settings();
  query('enabled').checked = settings.enabled; query('prompt').value = settings.globalPrompt;
  query('version').textContent = `Kemini Clean ${version} · ${lock.locked ? '变量模块源码已锁定' : '变量模块候选'}`;
  if (lock.locked) query('lock').textContent = '变量模块已完成对应配置的真实阶段验收，源码已锁定。人物档案、世界引擎尚未制作。';
  else if (lock.reason && lock.reason !== 'no_lock_record') query('lock').textContent = '锁定记录未能与当前源码和验收摘要核对，当前按未锁定候选显示。人物档案、世界引擎尚未制作。';
  let runtime;
  query('retry').onclick = () => void runtime?.retry().catch(() => render({ status: 'failed', detail: '当前正文无法绑定，未执行检查' }));
  query('cancel').onclick = () => runtime?.cancel();
  query('save').onclick = () => {
    const enabled = query('enabled').checked;
    host.updateSettings({ enabled, globalPrompt: query('prompt').value });
    if (!enabled) runtime?.cancel('自动检查已关闭');
    query('saved').textContent = '已保存';
  };
  const labels = { idle: '等待正文', waiting: '正文生成中', waiting_mvu: '等待MVU', checking: '检查中', parsing: '解析修复', saving: '保存中', applied: '已修复', recovered: '已恢复', model_nochange: '模型判定无需修改', cancelled: '已取消', failed: '未完成', outdated: '记录已过期' };
  function render(state) {
    box.dataset.state = state.status;
    query('status').textContent = state.status === 'applied' && state.result?.operationCount === 0 ? '派生更新已保存' : labels[state.status] || state.status;
    query('detail').textContent = state.detail || '';
    query('calls').textContent = `本次变量诊断请求：${state.requestCount || 0} / 1`;
    query('cancel').disabled = !state.busy; query('retry').disabled = Boolean(state.busy || state.status === 'waiting');
  }
  return { render, attach: value => { runtime = value; render(runtime.snapshot()); } };
}
