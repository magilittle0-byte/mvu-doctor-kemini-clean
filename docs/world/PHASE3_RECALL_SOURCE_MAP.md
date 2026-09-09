# P3 召回适配来源映射

本文件对应 `world/recall.mjs` 的纯函数接缝；不调用宿主、模型或数据库，不声明真实酒馆验收。

|机制|来源|适配|
|---|---|---|
|公开世界投影|`profile-engine.js:1978–2097` 的 `projectObservableWorld` 与 `observableWorldDigest`|只白名单保留高等级/终局事件、公开风声、区域环境和公开经济信号；`enemies`、`blackbox`、私有动机和身份不进入 delivery。`desc` 只有在上游生成明确要求公开描述时才可视为公开字段。|
|变化检测与稳定事件 ID|`profile-engine.js:1978–2097`；`vendor/world-engine-v3.0.2/world-engine-ledger.js:15–98` 的 checkpoint 对比、同轮替换和有界账本概念|最小适配为 before/world 投影比较，并读取 `memories[].changes` 中的 `event_terminal/event_new/event_advance`；当前存活事件按实体去重。delivery id 只由 scope、kind、实体键和公开语义内容 digest 构成，不含 lineage/inputIdentity/stageRound，因此同一事实不会跨回合重播。旧 pending 同实体进入新阶段时保留 proof 并标为 `superseded`。不会复用 World typed ledger 状态机或其 round 存档。|
|生成前提示|`profiles/runtime.mjs:20–60`；成熟参考 `mvu-auto-doctor-reference-archive/01-doctor/latest/index.js:1740–1751,13880–14070`|`makeRecall` 只构造独立文本、promptHash、deliveryIds、scope/lineage；实际 set/clear、generation 生命周期由 Root runtime 负责。|
|消费绑定|`continuity-core.mjs:771–830,900–932,3089–3110`；当前 `world/runtime.mjs:61–72,203–213`|沿用 lease/proof 的字段思想：generation、`receipt.target.identity`、`target.scopeSignature/scopeKey`、index、swipeId、正文 content hash、payload digest。P1 receipt 不虚构顶层 generationId/body/index；`readback:true` 与 exact target 是必要条件。`promptObserved` 仅为必要条件，不等于语义采用。|
|正文结算|`continuity-core.mjs:3213–3252,3254–3330`|按完整 `desc/content/impact/summary` 证据词与 accepted 正文精确匹配；不使用事件名称或通用标签。匹配后标记 consumed，否则 retained；`semanticConsumptionProven` 永远由此函数置为 false，避免把字符串证据夸大为模型语义证明。|
|恢复与重复|`profile-engine.js` 的公共存档读回链、`world/store.mjs:4–45`|delivery 数组随 P3 world record 保存；调用层必须绑定当前 P1/P2 receipt 与 branch lineage 后读回。相同 digest 不重复新增；已 consumed 不再召回；失败或未匹配 retained 可后续重召回。|

## 不能直接复用的旧链

World Engine 的 `state.memories`/round ledger 只表达世界推演变化，不能代替 delivery 消费账本；但 native ledger 的 terminal/new/advance changes 是终局移除后仍可观察的输入，故召回投影会读取并白名单化这些 changes，并与仍存活事件按实体去重。旧 actor/continuity typed ledger 含更完整的 lease 与 readback，但其 namespace、权限和调度归属不同；这里只复用字段约束和证明顺序，不复用状态机。P3 不另起模型语义审核器，也不以任意单字符命中判定正文消费。

## 运行时必须提供的边界

Root 接口复核：原生 ledger 只保留事件名而非稳定 id，不能用全历史 event_new/advance 重新构造当前事件，也不能按同名合并。终局适配只读取当前 round 的 event_terminal，并优先使用本次已接受的 `lastEvolveResult.events`（首轮没有 checkpoint 时 ledger 不记录，但 native result 仍保留）。以原生 id 识别实体；ledger 仅在前态同名唯一时借用其 id，否则使用该轮该条的独立键。旧 pending/retained 只由同一 scope、kind、稳定实体的新结果替代，旧证明仍保留。这是对已全文读取的 native evolution 终局清退 → ledger.recordChanges → core 保存链的最小适配。

P3 runtime 需要等待 P1 accepted receipt、P2 当前 exact profile record 和自身 delivery record 都完成；`makeRecall` 返回值不能被视为已注入，`settleDeliveries` 只能在 generation 已绑定且请求观察为真时调用。P2 没有公开订阅接口，因此 P3 不能把一次 profile `read()` 当作本轮 ready；必须核对 receipt identity、目标 index/swipe、profile record hash 和 branch lineage。当前 native ledger 在 `world/native/ledger.mjs:14–44` 先读取并清除 `_terminalEventsThisRound`，再把该列表与当前事件一起比较，所以终局移除不会因从 `state.events` 删除而自动丢失；召回层仍只接收其最终公开白名单投影。
