# 世界连续性引擎 v4 来源映射

本文件记录 `0.4.0` 世界引擎的机制来源、适配方式和所有权边界。它是实现审计表，不是正式酒馆验收报告。

| 机制 | 成熟来源 | 本项目实现 | 复用级别 | 适配原因 |
|---|---|---|---|---|
| 单一世界权威状态、稳定修订与摘要 | `mvu-auto-doctor-testing/continuity-core.mjs` 的 `ContinuityState`、digest 与 revision 合同 | `core.mjs` 的 `normalizeWorldState`、`worldDigest` | 最小结构适配 | Clean 医生不带旧医生的大型任务编排器，只保留状态所有权和证据合同 |
| actor / faction / environment 三类世界通道 | `continuity-core.mjs` 的 actor/faction/environment lane | `world.lanes` | 最小结构适配 | 保留镜头外推进语义，删去与 Clean 宿主无关的调度字段 |
| 人物行动尝试与世界裁决分离 | `ACTOR_ACTION_WORLD_ADJUDICATION_SOURCE_MAP.md` 的 ActionAttempt / WorldAdjudicationResult | `world.attempts` / `world.adjudications` | 机制移植、字段精简 | 防止 NPC 的计划或尝试被当作既成成功，同时避免接管玩家决定 |
| 准备态、提交态与持久化读回 | 成熟医生的 prepared -> committed、CAS/readback 合同 | `prepareWorldTransaction`、`recoverPreparedWorldState`、`verifyWorldReadback`、`markWorldReadback` | 机制移植、宿主胶水新写 | SillyTavern chat metadata 没有独立事务 API，因此使用两阶段检查点和宿主保存后读回 |
| 稳定合并、解决历史与墓碑游标 | `continuity-core.mjs` 的 stable-ID merge、resolved history/tombstone | `applyWorldProposal`、`resolvedArchive`、`tombstoneThroughTurn` | 最小结构适配 | 模型只返回变化项，脚本保护未提及旧支线，避免每轮随机删档 |
| 一回合召回与消费回执 | `prompt-context-core.mjs` / continuity injection 的 P4 consumer receipt | `prepareRecallPackage`、`reserveRecallPackage`、`settleRecallPackage` | 最小结构适配 | Clean 运行时只有一个正文预注入入口，因此收束为单个 pending 包和 consumed/released 回执 |
| 老四数组存档迁移 | 当前 Clean `0.3.4` 的 branches/npcIntents/agreements/hostilePlans | `normalizeWorldState`、`recoverLatestLegacyWorld` | 新写兼容层 | 旧结构只用于一次迁移；新运行时不再双写旧数组 |
| 当前 MVU 作为只读事实 | 项目所有权规约与成熟医生 prompt context | `advanceWorld` prompt 中的 `statDataOf(data)` | 最小适配 | 世界医生读取当前事实但不输出 MVU 补丁，也不接管数据库 |
| 世界控制台 | 用户要求重新编写的 Clean UI | `renderWorld` 与 `style.css` | 新写 | 不复制旧医生前端；用现有 Clean 组件展示新状态、行动/裁决和持久化证明 |

## 明确没有引入的重复系统

- 没有新建第二套 world store；唯一权威仍是当前聊天 `chatMetadata[mvu-doctor-kemini-clean].world`。
- `fullRuns` 只是报告与一次性旧档恢复材料，不能覆盖版本相同或更新的权威世界。
- MVU、数据库、预设和医生继续各自独立。世界引擎只读 MVU，不写数据库，不改预设。
- 模型输出是候选，不是提交成功证明。只有版本、提交号和摘要保存后读回一致，面板才标记“已验证”。
