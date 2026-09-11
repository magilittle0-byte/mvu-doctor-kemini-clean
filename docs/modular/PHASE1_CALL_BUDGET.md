# P1 单次完整诊断候选

2026-09-11：用户充值后明确要求控制调用数。账单中本次未完成回合已有 57 次计费请求；当前 31 组变量各做一次事实观察和一次诊断，完整 P1 本身需 62 次，且模块重试和 runtime stale 重试会继续放大。此次解除 P1 当前锁是修复可负担性所必需，不是为一次模型幻觉继续加补丁。

## 动手前来源与适配

项目全局来源审计记录在本机 `real-tauritavern-qc/run-state/modular-cost-20260911/P1_CALL_SOURCE_AUDIT.md`。本次继续完整阅读当前变量模块、提示、分组、官方解析、运行时、宿主设置和 UI，并读取历史提交 `c361dfb:modular/variables/module.mjs` 的完整单次诊断实现。

| 原机制 | 本次处理 |
| --- | --- |
| `c361dfb` 的完整 `composeDiagnosisMessages` → 一次 native call → 官方候选链 | 复用单次完整请求的控制流；不回退后来添加的保护 |
| 当前 `composeDiagnosisMessages` 全量世界、角色、历史输入、正文、前后 MVU、规则、结构声明 | 原样保留资料；原外置观察的时序与证据边界并入同一个诊断任务 |
| 当前 `planVariableGroups` / `checkGroupScope` | 保留本地完整范围规划；一次补丁可覆盖各组，范围检查对全部路径的并集执行；不再逐组调用或重复整份规则 |
| 当前 ownership / 官方命令执行回执 / `lostObjectKeys` | 保留拒绝条件；失败记录可见，未通过的候选不能写入 |
| 当前 prepared → committing → 官方替换 → MVU/存档读回 → latest | 原样保留；中断提交仍按现有恢复语义处理，不能重放 delta |
| 当前外置 observation、自动 maxAttempts、runtime stale rerun | 删除调用倍率；每次自动检查或主动修复最多一次模型请求，失败停下 |
| 当前手动 retry | 复用 fresh capture 和变量重读；点击一次只发一次新诊断，旧补丁不重放 |
| 当前状态/receipt/UI | 在原状态中记录 requestCount/requestLimit；移除多次自动重试设置，不另建调度器 |

新的成本边界：P1 每次检查最多 1 次模型请求；恢复已经提交的候选可为 0 次。调用次数是请求尝试计数，不冒充供应商计费成功次数。失败不隐式追加调用，用户可明确点击“修复本轮”再运行一次。先重新验收 P1，之后才实施 P2 批量档案优化；P3 不启用。

旧 P1 0.10.26 锁与证据保持原字节归档到 `locks/history/phase1-0.10.26/`，不能作为新候选验收。当前候选尚未完成真实门禁。真实测试先核对第一回合实际请求增量，再继续同一个全新聊天；发现额外外调先停止核查，不自动无限重跑。
