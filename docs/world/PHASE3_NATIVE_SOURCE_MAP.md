# P3 native World 工厂来源映射

本文件只记录 P3 native wrapper 的来源和 exact-byte 规则。生成文件将当前 vendor 的四个闭包工厂化，统一 CRLF 为 LF；正文函数、提示词、骰子、合并、回滚和导出对象保持原样。没有加载 `world-engine.js`、没有使用 `eval`/`Function`，也没有宿主、模型或网络调用。

| 生成文件 | 当前来源 | 读取范围 | 入口/返回 |
|---|---|---|---|
| `world/native/core.mjs` | `vendor/world-engine-v3.0.2/world-engine-core.js` | 全文件 822 行 | `installNativeCore(window, SillyTavern, console)`；来源 `window.WORLD_ENGINE_CORE = (function(){...})();` 的闭包正文原样嵌入并返回 facade |
| `world/native/evolution.mjs` | `vendor/world-engine-v3.0.2/world-engine-evolution.js` | 全文件 1546 行 | `installNativeEvolution(window, SillyTavern, console)`；保留 `evolve`、本地骰子、API signal、extraInstructions、blackbox、caps、rollback 与 debug 导出 |
| `world/native/rules.mjs` | `vendor/world-engine-v3.0.2/world-engine-rules-loader.js` | 全文件 737 行 | `installNativeRules(window, SillyTavern, console)`；保留完整 `RULES`、`loadRules`、`getAllRulesText`、`getCoreRulesSummary`、`getRuleCount` |
| `world/native/ledger.mjs` | `vendor/world-engine-v3.0.2/world-engine-ledger.js` | 全文件 125 行 | `installNativeLedger(window, SillyTavern, console)`；保留 checkpoint 对比、重大事件/风声记录与 native core 保存 |

## 生成约定

每个输出文件只有 ESM 工厂导出、局部依赖参数和对应 vendor 闭包正文。原始 `window.X = (function(){` 改为工厂内部的局部安装，原始尾部 facade `return { ... }` 保留；除此之外只做闭包外壳适配和 CRLF→LF。`SillyTavern`、`console` 均来自调用方参数，不读取宿主全局。

`world/native/.gitattributes` 固定四个 `.mjs` 为 LF，以免平台换行破坏 exact source comparison。`scripts/check-world-native.mjs` 从实际 vendor bytes 按同一 wrapper 规则构造四份期望内容，比较 exact UTF-8 bytes，打印 source/generated SHA-256 和行数；它是离线源一致性检查，不是宿主验收。

## 兼容边界

`core.saveStateWithLayer` 继续从当前 native context 读取 chat id/layer；`evolution` 继续调用现有 API 的 `parseJSON`、`callApi(..., signal)`，使用原生 local roll 与 `blackbox` 全量替换/cap 语义。ledger 只调用 native core；本阶段不加入 P2 KV、actor facade、第二调度器或第二 MVU writer。后续 facade 由 Root 负责。

本映射不声明 P3 已实现、已运行或已通过真实酒馆验收。
