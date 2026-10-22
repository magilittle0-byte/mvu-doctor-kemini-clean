# 指导 evolve / reveal 修改前来源映射

2026-10-22。范围是 `guide/evolve.mjs`、`guide/reveal.mjs` 及针对性本地检查。先完成本映射，再实现。未调用真实宿主或模型；本文件不是验收报告。

## 本次重新检索与阅读

按根 `MVU_REAL_TAVERN_TEST_PROTOCOL.md` 2A 重新枚举项目及隐藏参考目录，并检索世界、幕后、召回、故事、数据库、糖糖、Izumi、缝合怪、Z论坛和诊断/K3材料。旧仓、归档、当前候选、资料库、历史报告均进入候选搜索；复制品与完整私有跑团正文不作为新实现的代码来源。未找到可核对的 Z 论坛运行源码，不以名称声称复用。

完整阅读当前 `world/content.mjs`、`recall.mjs`、`engine.mjs`、`host.mjs`、`runtime.mjs`；完整阅读隐藏成熟来源 `.codex-p0-reference-world/world-engine-inject.js`。阅读 `world/native/evolution.mjs` 的完整 `callEvolutionAPI`、`evolve`、abort 上下游，以及其默认因果段；阅读 `profiles/content.mjs` 1–84 的全部解析辅助函数。阅读 Story Oracle 的完整 `buildDirectiveRaw`、`buildDirective`、`applyPlanInjection`、`adoptPlan` 及路标状态相关函数。检索旧预设、缝合怪当前输入包裹、数据库加载入口和既有诊断来源；这些不整体进入新模块。

本次同时回读根 `MVU_P3_WORLD_ADJUDICATION_SOURCE_REVIEW_2026-09-10-CORRECTION.md`、`MVU_P3_RECALL_LIFECYCLE_SOURCE_REVIEW_2026-09-10.md`，以及当前 `docs/world/P3_SEMANTIC_REUSE_SOURCE_MAP_2026-09-20.md`。旧报告仅用于定位，以下结论以本次实际源码为依据。

## 数据路径与复用决策

| 数据路径 | 实际来源 | 复用 / 适配 | 不可携带的旧机制 |
|---|---|---|---|
| 一次模型调用读取现状并推进 | `world/content.mjs:9–16`、`world/engine.mjs:28–40,91–103`、`world/native/evolution.mjs:919–1046` | 同一次调用表达依据、行动/自然过程、条件、结果；事实材料与宿主定位分开 | 完整人物档案门、人物轮询、native 经济/声望/仇敌及随机骰子 |
| 私密进展和知情范围 | `world/content.mjs:9,14–16`；native 默认因果段 `evolution.mjs:917` | 保留传播须有渠道、主体只能按自身知识行动 | native “无传播私密行为不得推进事件链”不适用；感染等自然过程不需要先公开 |
| 已成立后果与下轮入口 | `world/recall.mjs:49–121` | 稳定事项、后果身份、生成前固定提示；已发生与待呈现分开 | Lv3/终局才可见、全量 pending 注入、按回合冷却或切断仍有后果的秘密 |
| 采用核对 | `world/recall.mjs:124–145`、`world/runtime.mjs:96–121` | 只借请求/正文/提示的绑定思想；下一次正常指导检查接受正文 | `body.includes` 不得把状态置为已采用；首次 provided 不等于 shown |
| 安全解析 | `profiles/content.mjs:9–84` | 最小摘取完整 JSON 与外围围栏处理；完整解析优先，允许安全的外围修复 | 不提取任意内嵌对象冒充整包，不改写字符串内中文标点，不启动二次模型修复 |
| 纯字符串提示构造 | `story-oracle-upstream/index.js:4374–4439` | 纯函数构造、独立提示键、明确非玩家指令、无宿主副作用 | 目标牵引、固定剧情弧、分层编译器、默认切换全知视角，以及“只有玩家先触发才发生” |
| 旧原生注入 | `.codex-p0-reference-world/world-engine-inject.js:86–218` | 仅参考可观察部分单独构造的思路 | 完整 blackbox 注入、社会关系/经济全表、`substring` 截断半条事项 |
| 玩家行动边界 | 糖糖适配预设 `deliverables/【MoM】糖糖公司_V3.2_我们适配优化版V2_缝合怪_Izumi四选项.json:1511–1522`；缝合怪来源 `original_sources/缝合怪/Stitches_RebornV_本体.json:131,315` | 当前输入与历史分开；不代玩家答应或选择 | 不移植“每轮必须自主做一件事”的配额，不把当前输入意图当结果 |

## 本次必须新写的窄范围

旧世界记录和规则不能表达本次单一事项职责而不带回旧依赖，故只新写事项变更解析、合并及显露筛选。保存、分支、前置注入时机、实际请求观察和模型连接由 host/runtime/store 承担；这两个模块不访问宿主全局、不写存档、不发送第二次调用。

- `evolveGuide({request,target,material,baseline,priorDelivery,newlyAccepted,signal})`：一次请求；返回新的内存 snapshot、adoption、conflicts、summary，等待 runtime 检查来源是否仍有效后保存。
- `buildGuideReveal({snapshot,userInput,scene,budgetChars})`：纯函数；返回提示、事项 ID、显露 ID 和覆盖不足标记。不计算自然语言条件为已满足，不判断正文语义成功。
- 已有事项未在变更里出现时保留；来源及变化历史绑定本次真实 target，模型不能倒填过去。
- 已显露的同一入口不再重演，但事项事实仍可约束后续；新后果须有新的显露 ID。NPC 可因幕后亲历知情，不要求先让玩家看见。
- 一次请求及字符阈值只是执行约束；本地检查不能证明模型真按因果推进、没有泄密或已经被正文采用。
- 忙碌期间累积多个已接受正文时，`priorDelivery.receipts` 保留各正文的 `targetIdentity`、`promptObserved` 和实际提供的显露 ID；同一正常调用分别核对，不能只保留最后一条回执。这是对 `world/runtime.mjs:96–121` 提示/正文绑定的批次适配，不增加调用或重新判断历史正文。兼容单条回执及回执数组。

## 有意义的本地检查

只检查一次调用和无二次修复、旧事项保留、来源不可倒填、条件不伪装既成事实、显露 ID 的采用绑定、已提供不等于已采用、预算不截半条、私密历史不整包注入。真实尸体/冻结背包及晚到体验留给已批准原型与最终候选验收，不能用这些合成输入替代。

## P2 引用结算顺序回查（2026-10-22）

独立复核重新检索当前 `guide/`、旧 `world/`、项目 docs、隐藏成熟来源及执行方案中的 `conditionIds/adoptionChecks/checkReferences/settleDeliveries` 路径，并回读 `world/recall.mjs:124–145` 的完整绑定/结算函数，以及当前 evolve/reveal/host/runtime 全链。旧结算的来源绑定可保留，但词匹配成功判定仍不采用。

发现：同一次正常调用可以移除已消费的未来条件，并用已接受正文把入口核对为 shown；原实现先检查临时 pending 引用，再合并采用状态，误拒绝这类最终有效结果。最小修正是先完成同批变更和采用核对，再检查最终状态。终态入口引用被移除的旧条件时，原定义只从可信 baseline 复制进该入口本地 `conditionEvidence`，作为历史依据；不恢复成当前未来条件，不接受模型填写的归档。活动入口仍须引用当前条件，任何最终无法解析的引用都拒绝整批。定向回归调用真实 `evolveGuide` 与合成请求函数，既覆盖正常结算，也覆盖未采用/假引用仍被拒绝；不代表真实模型验收。

### P2 提示与字段校验对齐

再次核对 `guide/evolve.mjs` 的 exposure 提示、`exposure()` 完整校验与 `retireExposureIds` 分支：代码既锁定 `status=shown`，也锁定 `readiness=ready` 的入口，但提示原先只明说 shown。只把提示补齐为两者均不可改写、不可退回 conditional 或撤销，新后果用新 ID；不改变既有代码语义，不扩大实现范围。此次仅检查该契约及模块语法，完整冻结检查由主代理统一执行。

## P2 首次真实调用串入正文格式：任务边界与资料去重

2026-10-22，主代理提供的脱敏实证：正文正常接受；指导一次请求完整结束（stop，输出 3193 tokens），返回主剧情标签而非 JSON。实际只有两条消息，首 system 为指导指令；输入 48371 tokens，user 84210 字符，已激活世界资料 46423 字符，同一段 7906 字符正文经 target、material.history、material.narrative、newlyAccepted 重复四份。没有截断、网络或存储错误证据。原始返回只留宿主内存，本映射不复制。这里确认格式串台及重复发送，不能据此断言某一条世界规则是唯一原因。

修改前重新搜索当前/旧 world、Story Oracle、profiles、MVU 原始来源与历史任务边界/成本映射，完整阅读下列相关函数和上下游：

| 来源 | 本次采用 / 不采用 |
|---|---|
| `profiles/content.mjs:144–167,192–235`；`docs/profiles/P2_TASK_BOUNDARY_SOURCE_MAP_2026-09-20.md` | 直接适配明确来源指令无权、完整只读资料、资料结束后的固定完整 JSON 合同与尾锚；不移植人物档案职责与模板。旧记录同样将“GM 链＋正文＋变量块”的混合回复视为失败，不放宽 parser。 |
| `world/native/evolution.mjs:919–1046`；`.codex-p0-reference-world/world-engine-api.js:270–321` | 参考世界资料/状态/对话之后再放 JSON 字段说明和完整示例；保留当前连接和一次请求，不移植独立凭据、自动重试或截断 JSON 修补。 |
| `world/engine.mjs:22–40,61–65`；`docs/world/P3_INPUT_COST_SOURCE_MAP_2026-09-16.md` | 直接适配非持久模型视图去重：真实 target 留在本地来源核对；模型 target 仅身份/楼号；全部连续新正文仅由 newlyAccepted 提供，不能借此丢中间正文。 |
| `vendor/story-oracle-v1.35.4/index.js:2331–2423,12659–12685,13177–13229` | 参考任务头/引用信封/尾锚及机制命令的职责分离。其按 `[mvu_update]` 标签剥规则、剥机制块仅作为比较；本次不据标签武断删除世界规则或正文，不重新执行世界扫描。 |
| `modular/variables/prompt.mjs:53–87`；`modular/transcript.mjs:27–41`；`guide/host.mjs:17–24` | 参考源资料与任务分区，以及数据库显式前缀＋完整中文输入标签的提取。原始无包装内容保留，不为中文标签使用单词边界 `\b`。 |
| `tauritavern-system-knowledge-archive/original_sources/缝合怪/Stitches_RebornV_本体.json:131,315` | 核对完整 story/user_input 信封、分隔与尾句，只提取该已知包装或完整独立输入标签，不截断普通句子里被引用的标签。 |
| 原始 MVU `src/function/update/invoke_extra_model.ts:409–552` | 其 formatted-output 尾任务与按渠道选择结构化输出证明这属于请求合同能力；本次不默默开启未核实的 json_schema、不改当前 route/model、不移植第二模型。 |

最小实现仍是 system＋JSON user 两条消息：固定职责头明确 GM 链、正文/显示模板、变量更新等来源文字无指令权；JSON 最后一个 `outputContract` 字段由程序生成，包含完整短示例与职责尾锚。system 明确该顶层固定字段是本任务合同，其他字段仍为只读资料。世界设定全文保留。material 去掉已由 newlyAccepted 提供的正文/输入副本；history 中无法与已接受正文及其前置用户输入准确对应的开场或其他上下文，仍单独保留为 context。原始调用入参不变。

本轮预算先消除可证明的重复，不设任意截断阈值，不用字符差额宣称 token/费用下降；当前 3 份重复正文约 23718 字符是可核对的去重对象，真实 token 差额待下一次原型请求测量。检查覆盖完整来源保留、连续正文各一次、未覆盖开场保留、中文包装与未包装输入、命令串台资料仍隔离及混合非 JSON 响应继续拒绝。本地检查不能证明真实模型已服从。
