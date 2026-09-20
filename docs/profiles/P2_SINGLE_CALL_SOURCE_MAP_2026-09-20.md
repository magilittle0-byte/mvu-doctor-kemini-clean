# P2 单次请求候选：修改前来源映射

2026-09-20；对应《MVU医生_优化实施设计_v1_2026-09-20》。这是协议 2A 的实施记录，不是功能验收。P1 原字节、三个 phase1 锁及其支持文件不改。

## 当次检索与完整路径阅读

在当前项目、历史 testing/hotfix 与 reference-archive 中重新检索人物档案、批处理、数据库、Story Oracle、糖糖、Izumi、缝合怪、Z 论坛、角色卡/世界书、变量/正则、前端、跑团及诊断；对命中的相关实现继续读完整函数及调用路径。主 agent 与 Luna 的结论交叉核对，未找到可直接替换现有 44 字段合同的成熟实现。

| 问题与修改位置 | 来源与上下游 | 原样保留 | 必要适配及理由 |
|---|---|---|---|
| 发现后第二次发完整背景，且重写旧档；`profiles/content.mjs` | 当前 `parseJsonResponse` → `parseDiscovery` → 字段定义与 `validateProfile`，`host.inputFor` → runtime → store/UI；完整 content、host、runtime 和相关测试 | JSON 解析、来源证据、玩家排除、已有 ID 与重复 ID 校验、44 字段验证 | 新增一次请求的嵌套人物操作合同，复用发现校验；新建完整内容、更新精确叶路径、无变化保留旧值。身份/顶层错误整体拒绝，字段错误逐人物隔离 |
| 增量维护 | `reference-archive/02-reference-code/npc-tracker/scripts/profile.js` 的完整 `applyProfileDelta` 及 `state.js`、默认提示；旧 profile-engine 与 actor profile batch/shard 实现 | 省略保留、先副本合并后验证、独立人物错误思想 | 不移植按姓名定位、不同字段结构或逐人请求；本项目列表按完整新数组替换，永久 ID 仍由 runtime 分配 |
| 人物内容误配 | `mvu-auto-doctor-testing/actor-shard-core.mjs` 的 `parseActorShardProposalBatch`，当前 `parseProfileBatch` | 明确绑定、拒绝未知或重复 ID，不作位置回退 | 来源、操作、内容嵌套同一条目，不再把发现列表与内容列表按位置配对 |
| `profiles/runtime.mjs` 请求与保存 | 完整 execute/run/retry/recall 生命周期；`profiles/host.mjs` receipt/inputFor/callModel；完整 `profiles/store.mjs` commit/latest/revision/readback；runtime/recall 测试 | Abort/epoch、receipt 断言、作用域分支、逐人成功保存、待修旧档保留、本轮新增人物退休许可、最终退休失败补偿、召回接受规则 | discovery + batch 改为单次 profile-turn，调用硬上限 1；复用之前有效发现/错误作显式手动修复反馈，不新增自动重试 |
| 同目标成功结果复用 | 现有 runtime 的 complete/version/identity/mvuHash 短路及 host 输入/receipt 配置断言 | 手动修复强制请求、失败/partial 不复用、写入严格断言 | 如有必要补全实际输入/配置指纹；不能用更新后的输出当原输入，也不能因日志修订触发付费重跑。新增逻辑须以完整反例检查证明 |
| 安装及测试合同 | `scripts/check-profiles.mjs`、manifest/loader/install、`profiles/ui.mjs`、phase1 lock 与 world/dependencies 链 | P1 来源锁、P2/P3 上游真实证据要求、现有存储格式 | P2 版本 candidate.6、UI/安装调用上限改为 1；生成新候选指纹。旧 phase2 真实证据不得改写成新验收；新 P2 真实锁后才能重绑 P3 |

## 边界

模型视图从原始本地输入另建，剔除重复原始 target 正文副本，JSON 紧凑序列化，不截断权威资料。运行时本地原始输入仍用于安全检查与复核。模型字段只接受现有 PROFILE_FIELDS；元数据、父路径、额外 ID 不由模型修改。

本次对 `profiles/content.mjs` / `tests/profiles-content.test.mjs` 与 runtime 集成的来源映射已在修改前完成。世界模块另作来源映射。静态、合成测试只用于筛错；候选需按当前唯一真实酒馆协议验收，旧报告不能证明新字节可用。

## 后续集成澄清（实现前补充）

按设计 3 的提示投影语义，对当前 `userInput`、`target`、`currentNarrative` 做全项目复搜并完整核对上下游：`modular/host.mjs` 捕获并校验目标助手原文及相邻用户原文；`modular/transcript.mjs` 的 `userInput()` 解出数据库包装中的本轮用户动作；`profiles/host.mjs inputFor()` 将助手目标保留为本地完整 `target`，另生成已解包的顶层 `userText`；`modular/variables/prompt.mjs currentNarrative()` 只对绑定到精确目标行的助手正文调用宿主 `buildTranscriptTurns()`，并使用 AI_OUTPUT 正则投影；当前 vendored Story Oracle v1.35.4 `buildTranscriptTurns()` 明确区分 USER_INPUT / AI_OUTPUT 正则槽位且会做机制块处理。变量诊断提示将 `userText` 与 `narrative` 分栏发送，分别代表玩家本轮行动和助手最终正文。

因此模型视图只移除 `target.content` 和 `target.userText` 两个原始本地副本，保留顶层投影后的 `narrative` 与 `userText`；后者不能被误删，否则会丢失本轮玩家行动。原始本地 `target` 仍供 runtime 绑定与安全校验。投影测试应断言顶层玩家行动被保留，而原始目标字段未被发送。

集成核对还收紧了解析与逐人隔离边界：来源证据、玩家排除、显式已有 ID、重复 ID、退休许可及未知 operation 属于整份合同；`profile` / `changes` 的缺漏、冲突或具体内容路径错误属于单人物 materialization。这样一个人的内容错误不能令兄弟人物一并丢弃；materialize 错误带逐项 `errors` 供 runtime/UI 定位。该边界是静态集成设计结论，不代表真实酒馆回归验收。
