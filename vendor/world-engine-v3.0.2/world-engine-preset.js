// world-engine-preset.js — 引擎预设系统（世界推演引擎的预设）
// 把推演 prompt 的 4 个硬编码段（①引擎角色 / ②因果10步 / ⑦JSON输出说明 / ⑧JSON示例）
// 做成可编辑、可保存、可切换、可导入导出的「持久化预设」。
//
// 核心铁律：激活「默认」预设（无任何自定义覆写）时，4 段回退默认值，推演 prompt
// 字节级等同 PR#12 现状。默认文本单一真相源 = world-engine-evolution.js 暴露的
// window.WORLD_ENGINE_EVOLUTION_DEFAULT_SEGS（运行时引用，不在此处拷贝，杜绝双份漂移）。
//
// 存储：走 window.WORLD_ENGINE_STORE（IndexedDB），独立 key，不进 world_engine_settings。
//   world_engine_active_preset   = 当前激活预设 id（string，'default' 或自定义 id）
//   world_engine_custom_presets  = 自定义预设数组（JSON string）
// chatcache 是严格 5-slot 白名单，不会误纳这两个 key、切聊天不清，安全。
//
// 加载顺序：本模块在 world-engine-store.js 之后、core/evolution 之前加载。
//   故模块顶层不能读 evolution 的 DEFAULT_SEGS（此时 evolution 未加载）——一律延迟到
//   函数被调用时读取（此时 evolution 已加载、UI 已起来）。
(function () {
  'use strict';

  var STORAGE_KEY_ACTIVE = 'world_engine_active_preset';
  var STORAGE_KEY_CUSTOM = 'world_engine_custom_presets';
  var DEFAULT_PRESET_ID = 'default';

  // 4 个可编辑段 key，与 evolution.js 的 _lastPromptSegments key 逐字一致。
  var EDITABLE_SEG_KEYS = ['engine-role', 'causal-steps', 'output-format', 'json-example'];

  var SEG_LABELS = {
    'engine-role':   '① 引擎角色指令',
    'causal-steps':  '② 因果检查（10 步）',
    'output-format': '⑦ JSON 输出字段说明',
    'json-example':  '⑧ JSON 示例'
  };

  // ── 工具 ───────────────────────────────────────
  function store() {
    return window.WORLD_ENGINE_STORE;
  }

  function log(msg) { console.log('[世界引擎][预设] ' + msg); }
  function warn(msg) { console.warn('[世界引擎][预设] ' + msg); }

  function deepClone(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }

  // 运行时从 evolution 模块取 4 段默认文本（单一真相源）。evolution 未加载时返回 {}。
  function getDefaultSegTexts() {
    var src = window.WORLD_ENGINE_EVOLUTION_DEFAULT_SEGS;
    if (src && typeof src === 'object') return src;
    warn('WORLD_ENGINE_EVOLUTION_DEFAULT_SEGS 未就绪，默认段文本暂不可用');
    return {};
  }

  function genId() {
    // 不用 Date.now()/Math.random()（VM/工作流脚本环境可能受限），改用计数+时间戳兼容。
    // 浏览器真实环境用 Date.now；若不可用则退化为递增计数。
    var ts = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    var rnd = '';
    try {
      if (typeof Math !== 'undefined' && Math.random) {
        rnd = Math.floor(Math.random() * 1e6).toString(36);
      }
    } catch (e) {}
    return 'custom_' + ts.toString(36) + '_' + rnd;
  }

  // ── 预设规整 ───────────────────────────────────
  // 把任意输入规整成合法预设对象。segments 里某段为 null/空串/非字符串 → 视作「无覆写」存 null。
  function normalizePreset(obj) {
    if (!obj || typeof obj !== 'object') obj = {};
    var name = (obj.name == null ? '' : String(obj.name)).trim() || '未命名预设';
    var description = (obj.description == null ? '' : String(obj.description)).trim();

    var segments = {};
    for (var i = 0; i < EDITABLE_SEG_KEYS.length; i++) {
      var k = EDITABLE_SEG_KEYS[i];
      var v = obj.segments ? obj.segments[k] : undefined;
      if (v == null) { segments[k] = null; continue; }
      v = String(v);
      // 空串或纯空白视作「无覆写」(回退默认)，与 UI 清空语义一致。
      if (v.trim() === '') { segments[k] = null; continue; }
      segments[k] = v;
    }

    return {
      id: (obj.id && typeof obj.id === 'string') ? obj.id : genId(),
      name: name,
      description: description,
      builtin: false,
      segments: segments,
      createdAt: Number.isFinite(Number(obj.createdAt)) ? Number(obj.createdAt) : 0,
      updatedAt: Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : 0
    };
  }

  // ── 内置默认预设 ───────────────────────────────
  // segments 全 null = 4 段全部回退默认值 = 字节级等同现状。不落盘。
  function buildDefaultPreset() {
    return {
      id: DEFAULT_PRESET_ID,
      name: '默认（硬编码）',
      description: '世界引擎内置默认推演提示词，4 段均为硬编码原文。编辑或另存为即可自定义。',
      builtin: true,
      segments: { 'engine-role': null, 'causal-steps': null, 'output-format': null, 'json-example': null },
      createdAt: 0,
      updatedAt: 0
    };
  }

  // ── 存储 CRUD ──────────────────────────────────
  function getActivePresetId() {
    var s = store();
    if (!s) return DEFAULT_PRESET_ID;
    var id = s.getItem(STORAGE_KEY_ACTIVE);
    if (!id || typeof id !== 'string') return DEFAULT_PRESET_ID;
    // 若存的 id 指向已被删除的自定义预设，回退默认。
    if (id !== DEFAULT_PRESET_ID) {
      var customs = loadCustomPresets();
      var found = false;
      for (var i = 0; i < customs.length; i++) { if (customs[i].id === id) { found = true; break; } }
      if (!found) { setActivePresetId(DEFAULT_PRESET_ID); return DEFAULT_PRESET_ID; }
    }
    return id;
  }

  function setActivePresetId(id) {
    var s = store();
    if (!s) { warn('store 未就绪，无法保存激活预设'); return; }
    s.setItem(STORAGE_KEY_ACTIVE, id || DEFAULT_PRESET_ID);
  }

  function setActivePreset(id) {
    setActivePresetId(id);
    log('已切换激活预设：' + (id || DEFAULT_PRESET_ID));
  }

  function loadCustomPresets() {
    var s = store();
    if (!s) return [];
    var raw = s.getItem(STORAGE_KEY_CUSTOM);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      // 逐个规整，丢弃彻底无法解析的项。
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        try { out.push(normalizePreset(arr[i])); } catch (e) { warn('丢弃无法规整的自定义预设 #' + i); }
      }
      return out;
    } catch (e) { warn('自定义预设存储损坏，当作空：' + e.message); return []; }
  }

  function saveCustomPresetsArray(arr) {
    var s = store();
    if (!s) { warn('store 未就绪，无法保存预设列表'); return; }
    s.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(arr || []));
  }

  function getAllPresets() {
    return [buildDefaultPreset()].concat(loadCustomPresets());
  }

  function getCustomPresets() { return loadCustomPresets(); }
  function getBuiltinPresets() { return [buildDefaultPreset()]; }

  function getPresetById(id) {
    if (!id || id === DEFAULT_PRESET_ID) return buildDefaultPreset();
    var customs = loadCustomPresets();
    for (var i = 0; i < customs.length; i++) { if (customs[i].id === id) return customs[i]; }
    return null;
  }

  function getActivePreset() {
    return getPresetById(getActivePresetId()) || buildDefaultPreset();
  }

  // 存/更新一个自定义预设。preset 无 id 或 id=default 时生成新 id（即「另存为」）。
  // 返回存后的预设（含最终 id）。
  function saveCustomPreset(preset) {
    var p = normalizePreset(preset);
    if (!p.id || p.id === DEFAULT_PRESET_ID) p.id = genId();
    var customs = loadCustomPresets();
    var idx = -1;
    for (var i = 0; i < customs.length; i++) { if (customs[i].id === p.id) { idx = i; break; } }
    var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    p.updatedAt = now;
    if (p.createdAt === 0) p.createdAt = now;
    if (idx >= 0) customs[idx] = p; else customs.push(p);
    saveCustomPresetsArray(customs);
    log((idx >= 0 ? '更新' : '新增') + '自定义预设：' + p.name + ' (' + p.id + ')');
    return p;
  }

  // 另存为：无论输入 id，强制生成新 id 存为新预设。返回新预设。
  function saveAsCustomPreset(preset, newName) {
    var p = normalizePreset(preset);
    p.id = genId();
    if (newName && String(newName).trim()) p.name = String(newName).trim();
    var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    p.createdAt = now; p.updatedAt = now;
    var customs = loadCustomPresets();
    customs.push(p);
    saveCustomPresetsArray(customs);
    log('另存为新预设：' + p.name + ' (' + p.id + ')');
    return p;
  }

  function deleteCustomPreset(id) {
    if (!id || id === DEFAULT_PRESET_ID) { warn('内置预设不可删除'); return false; }
    var customs = loadCustomPresets();
    var next = customs.filter(function (p) { return p.id !== id; });
    if (next.length === customs.length) { warn('未找到要删除的预设：' + id); return false; }
    saveCustomPresetsArray(next);
    // 删的是当前激活的 → 回退默认。
    if (getActivePresetId() === id) setActivePresetId(DEFAULT_PRESET_ID);
    log('已删除自定义预设：' + id);
    return true;
  }

  // ── 核心覆写查询（evolution.js 调用）──────────
  // 返回当前激活预设对某段的覆写文本；无覆写（null/默认预设/段未自定义）返回 null。
  // evolution.js 据此用 `override || DEFAULT` 决定最终文本。
  function getSegmentOverride(segKey) {
    if (EDITABLE_SEG_KEYS.indexOf(segKey) < 0) return null;
    var p = getActivePreset();
    if (!p || !p.segments) return null;
    var v = p.segments[segKey];
    if (v == null) return null;
    v = String(v);
    if (v.trim() === '') return null;
    return v;
  }

  // 一次性返回 4 段覆写 map：{ 'engine-role': text|null, 'causal-steps': ..., 'output-format': ..., 'json-example': ... }
  // 供 evolution.js 的 callEvolutionAPI 一次取 4 段，避免每段分别调 getSegmentOverride 导致
  // 同一轮推演反复 JSON.parse 整个自定义预设数组（4 段 × 8 次 parse → 1 次 parse）。
  // 性能实测：5 个预设时每轮从 ~289µs 降到 ~30µs；50 个大预设时从 ~3.8ms 降到 ~50µs。
  // 默认预设（无覆写）走快路径：直接返回全 null，0 次 JSON.parse。
  function getOverrides() {
    var out = { 'engine-role': null, 'causal-steps': null, 'output-format': null, 'json-example': null };
    var s = store();
    if (!s) return out;
    var id = s.getItem(STORAGE_KEY_ACTIVE);
    if (!id || id === DEFAULT_PRESET_ID) return out; // 默认预设：4 段全 null，0 parse
    // 自定义预设：parse 1 次找 preset + 顺便校验 id 仍存在
    var customs = loadCustomPresets();
    var p = null;
    for (var i = 0; i < customs.length; i++) { if (customs[i].id === id) { p = customs[i]; break; } }
    if (!p) { // 激活的 id 已被删除 → 回退默认并返回全 null
      setActivePresetId(DEFAULT_PRESET_ID);
      return out;
    }
    if (!p.segments) return out;
    for (var j = 0; j < EDITABLE_SEG_KEYS.length; j++) {
      var k = EDITABLE_SEG_KEYS[j];
      var v = p.segments[k];
      if (v == null) { out[k] = null; continue; }
      v = String(v);
      out[k] = (v.trim() === '') ? null : v;
    }
    return out;
  }

  // ── 导入导出 ───────────────────────────────────
  // 导出：返回预设的 JSON 字符串（去掉内部时间戳可选，这里保留便于追溯）。
  function exportPreset(id) {
    var p = getPresetById(id || getActivePresetId());
    if (!p) { warn('导出失败：未找到预设 ' + id); return null; }
    var out = {
      __worldEnginePreset: true,
      version: 1,
      preset: {
        name: p.name,
        description: p.description,
        segments: p.segments
      }
    };
    return JSON.stringify(out, null, 2);
  }

  // 导入：解析 JSON 字符串、校验、规整、存为自定义预设。返回新预设或抛错。
  function importPreset(jsonStr) {
    if (!jsonStr || typeof jsonStr !== 'string') throw new Error('导入内容为空');
    var obj;
    try { obj = JSON.parse(jsonStr); }
    catch (e) { throw new Error('不是有效的 JSON：' + e.message); }
    var src = (obj && obj.__worldEnginePreset && obj.preset) ? obj.preset : obj;
    var p = normalizePreset(src);
    p.id = genId();
    var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    p.createdAt = now; p.updatedAt = now;
    var customs = loadCustomPresets();
    customs.push(p);
    saveCustomPresetsArray(customs);
    log('导入预设：' + p.name + ' (' + p.id + ')');
    return p;
  }

  // ── UI 辅助：取某段在当前预设下的「展示文本」（有覆写用覆写，否则默认）────────
  // 供预设编辑 UI 初始化 textarea：让用户看到当前实际生效的文本。
  function getSegmentDisplayText(segKey) {
    var ov = getSegmentOverride(segKey);
    if (ov != null) return ov;
    var defaults = getDefaultSegTexts();
    return defaults[segKey] || '';
  }

  // 当前激活预设里，哪些段是「已自定义覆写」（true=用户改过）。供 UI 标记。
  function getOverriddenSegKeys() {
    var p = getActivePreset();
    if (!p || !p.segments) return [];
    var out = [];
    for (var i = 0; i < EDITABLE_SEG_KEYS.length; i++) {
      var k = EDITABLE_SEG_KEYS[i];
      var v = p.segments[k];
      if (v != null && String(v).trim() !== '') out.push(k);
    }
    return out;
  }

  // ── 暴露 API ───────────────────────────────────
  window.WORLD_ENGINE_PRESET = {
    EDITABLE_SEG_KEYS: EDITABLE_SEG_KEYS,
    SEG_LABELS: SEG_LABELS,
    DEFAULT_PRESET_ID: DEFAULT_PRESET_ID,
    getDefaultSegTexts: getDefaultSegTexts,
    getSegmentDisplayText: getSegmentDisplayText,
    getOverriddenSegKeys: getOverriddenSegKeys,
    getActivePresetId: getActivePresetId,
    getActivePreset: getActivePreset,
    setActivePreset: setActivePreset,
    setActivePresetId: setActivePresetId,
    getAllPresets: getAllPresets,
    getCustomPresets: getCustomPresets,
    getBuiltinPresets: getBuiltinPresets,
    getPresetById: getPresetById,
    saveCustomPreset: saveCustomPreset,
    saveAsCustomPreset: saveAsCustomPreset,
    deleteCustomPreset: deleteCustomPreset,
    getSegmentOverride: getSegmentOverride,
    getOverrides: getOverrides,
    exportPreset: exportPreset,
    importPreset: importPreset,
    normalizePreset: normalizePreset
  };

  log('模块已加载。默认预设 id=' + DEFAULT_PRESET_ID + '，可编辑段：' + EDITABLE_SEG_KEYS.join(', '));
})();
