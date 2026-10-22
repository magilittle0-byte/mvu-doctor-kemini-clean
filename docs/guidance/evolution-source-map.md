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

## P2 candidate.3 的数组元素类型错误：完整嵌套模板与资料区分离

2026-10-22，修改前根据主代理新提供的脱敏事实重新检索：响应整体可解析，六个顶层字段齐全，但首个 upsert 使用正文记录形状 `{identity,index,userText,content}`，缺少事项 ID；content 继续生成主剧情/变量格式。后续相等性检查为 `contentSame=false`、`copiedAccepted=false`，因此不是原样回显已接受正文。真实请求仍为两条消息；system 2650 字符、user 56053 字符，authority 48544 字符、连续新正文区 6564 字符、末尾合同字段 484 字符。响应未保存，无自动重试。本段不保存任何私有来源或原始返回，也不把格式布局认定为已证实的唯一原因。

本次按 2A 重新检索当前 profiles/world、Story Oracle、原始 MVU 和 NPC Tracker 的 `json_schema`、`response_format`、完整模板和资料投影，阅读命中函数及请求/过滤上下游。直接落实前再次完整核对 `profileTurnMessages`、其输入投影与完整模板定义，及当前指导的消息构造、解析、合并和定向测试：

| 来源 | 对本次修正的约束 |
|---|---|
| `profiles/content.mjs:111–167,192–235` | 成熟路径把完整嵌套内容模板放在来源 JSON **之外**，先结束资料，再给固定模板与任务尾锚。当前指导仅将空数组外壳塞进 JSON 的字符串字段，未等价适配这两点。本次借布局与完整类型说明，绝不恢复人物档案字段。 |
| `docs/profiles/P2_REPAIR_FEEDBACK_SOURCE_MAP_2026-09-20.md` 全文 | 布局是待真实核验的候选修正，不证明原故障唯一原因；严格解析和完整资料均保留，不携带上次错误返回供续写。 |
| 原始 MVU `src/function/function_call.ts:35–146`；`src/function/update/invoke_extra_model.ts:1–158,409–552` | schema 明确数组元素内部属性，`json_object` 只限制 JSON 外壳，不能证明事项元素正确。其 `json_schema` / tool-call / v4 路由分别有能力要求；本轮不改 host 或全局连接设置，不照搬临时写全局设置和回退请求。 |
| 原始 MVU `src/function/request/filter_entries.ts`、`filter_prompts.ts`；NPC Tracker `scripts/profile_prompt_context.js` 与 `scripts/api.js:937–948,1115–1122` | 机制过滤有明确条目元数据/职责边界；JSON 模式的兼容回退不能移植为额外调用。没有足够依据删掉当前混合世界规则，仍完整保留 authority。 |

最小修正：保持 system/user 两种角色、一次请求和原入参；user 改为“标注的只读来源 JSON 一行 → 来源结束 → 完整六字段及非空嵌套事项模板 → 固定任务尾锚”。模板给出 facts、conditions、exposure、closures、adoptionChecks、conflicts 的元素形状，用说明占位值表达字段类型，不提供可误当本局事实的剧情例子。明确占位值不是事实；没有对应变更或有效采用回执的数组必须为空。已有事项仍仅给增量，当前资料、连续正文、来源绑定及严格拒收保持原义。

定向检查保留全部真实资料投影检查，并新增“外壳正确但 upsert 是继续写正文的对象”拒收回归：整批失败、原快照不变、一次请求无重试。模板位置检查须读取独立的资料区，不能再把整条 user 当 JSON 解析。本地检查仅证明提示布局和拒收机制，不证明实际模型已改正；仍需主代理冻结候选并执行真实 P2。

本次技能路由为 `sillytavern-extension-dev`；库快照 `2026-08-18`，加载 ST-A0、ST-D5、ST-E5 的相关扩展边界，未选设计目录候选。A0 目标是修正事项输出合同，红线是完整世界规则/当前模型路由/一次调用及旧资料不变，验收是定向机制检查后重新实测；本修改不接触宿主、版本或显露筛选。

## P2 candidate.4 已保存但后果入口遗漏：F04 显露与知情边界

2026-10-22，先完成本次来源复核再修改。主代理脱敏实证：一次指导请求耗时 16.623 秒，返回 settled 且读回 durable=true；一事项含三条事实、两条未来条件，但唯一显露入口重复了正文已展示的状态，没有承接感染及取出条件的后果入口。主代理另核对首轮可见正文：正文在指导首次推演前已全知披露幕后过程，状态展示也泄露了相关风险。当前无事项时 reveal 返回空提示，首轮未提供指导自身的视角边界。格式与保存成功因此不证明因果体验、入口完整或保密通过。本映射仅记录这些脱敏结论，不保存私人正文或模型原始返回。

按 2A 重新检索当前 evolve/reveal、旧 world/content/recall/engine/runtime、隐藏原生世界注入来源和既有世界裁决/召回映射；完整阅读旧 `world/recall.mjs`、`world/content.mjs`、当前 `guide/reveal.mjs`，回读 evolve 的任务、模板、引用校验与合并全链，以及 runtime 的 preparePrompt/started/sent/promptReady、host.setPrompt 和旧世界调用/结算上下游。

| 来源 | 本次复用与差异 |
|---|---|
| `world/content.mjs:12,14–15` | 直接适配“产生有因果的新变化而非复述正文”“具体物件/行为、时间接触前提和传播渠道”“已完成结果作为后续前提”。不带回人物档案门、骰子、固定轮转或强制变化配额。 |
| `world/recall.mjs:49–99,102–121` | 保留只投送新可见或改变的后果、待呈现不等于待发生、旧动作不重演。旧等级阈值和 `settleDeliveries` 的词匹配不适用于本次；不复制。 |
| `guide/evolve.mjs:27–30,123–134`；`guide/reveal.mjs:36–40,54–80` | 当前只有入口引用依据的正向校验，没有要求未来条件反向形成入口；reveal 只投影入口引用的资料，遗漏入口就会漏掉相应因果。本次改正同一次模型任务的目标和输出合同，不通过整包注入秘密条件来补漏，不用关键词代替语义判断。 |
| `.codex-p0-reference-world/world-engine-inject.js:86–218` | 其全量黑盒/摘要注入及末尾截断会破坏本次保密与完整事项边界，明确不复用。 |
| `guide/runtime.mjs:56–69,85–100,115–125`；`guide/host.mjs:238–243` | 自有提示已在主生成前按字符串注入并观察。无事项时只需返回轻量通用约束；仍保持空 providedIds/exposureIds/items，不伪造事件投送、采用或后台结算，不改卡/固定预设/模型路由。 |

最小修正范围仍为 evolve/reveal 与定向检查：明确事实是必要的持续依据，exposure 只对应尚未在已接受正文演出的新影响或后续影响；每个仍有可感知后果的有效条件须有相应入口引用。尚无任何有据观察/传播渠道时，在现有 process/updateSummary 点明条件 ID 及仅后台原因，不新增状态平台；条件尚未满足、玩家尚未调查本身不是遗漏条件入口的理由。此项属于同次模型语义合同，局部格式检查不能证明模型真的覆盖完整，仍须真实样例核验。

知情范围同时澄清：叙述者全知说明、规划或系统调试不自动使角色知情；knownTo 只包含实际亲历、感知或有根据获告知的主体。首轮和无待投送事项时，仍在指导自有提示中提供轻量视角边界，正文、状态栏和提示框均须遵守；不写预置未来事实、不代玩家回应、不把意图当结果。资料与入口为空时仅有规则，不把观察到规则提示误报成事件采用。已有正文已经公开的内容不能由本修正倒算为曾经保密。

定向检查覆盖：零事项仍有通用边界且零入口；无关事项的秘密仍不进入提示；取出条件经实际入口引用完整带出；仅保存已展示事实不会重播动作；预算不足不截半条事项，通用边界本身装不下时明确覆盖不足。继续一次请求，无额外模型、强制等待或自动重试。真实结果须由新候选重新取得，旧 candidate.4 保存成功不作为本修正验收。

## P2 candidate.6：通用规则观察不等于提供过具体事件入口

2026-10-22 修改前按 2A 重新检索 evolve 的输入投影、完整模板、reviewAdoption、因果测试以及旧 world 的实际提供/结算边界，完整回读 `guide/evolve.mjs`、`guide/reveal.mjs` 与 `world/recall.mjs`，并核对 `world/runtime.mjs:67–121,141–150` 和 profiles 来源资料/尾部合同的调用上下游。主代理脱敏实证：candidate.6 的事项结构已返回，一条采用核对被严格拒收；首轮回执 promptObserved=true 但 exposureIds=[]，当次仅提供通用视角约束。没有保存候选、没有自动重试；本次未读取私人正文或调用真实模型。

| 来源 | 已核实问题与最小适配 |
|---|---|
| `guide/reveal.mjs:34–35,56–82`；`guide/runtime.mjs::settingsReady/bindDelivery/drain` | 首轮通用边界可被主请求实际观察，空 exposureIds 的诊断回执有价值，但不能证明任何事项入口已提供。原始运行及持久回执保留，不把它们删成“没有提示”。 |
| `guide/evolve.mjs::guideOutputContract/evolveGuide/reviewAdoption` | 模型来源原样收到所有回执，模板却无条件显示一个 adoptionChecks 元素；只说 promptObserved=true 会把规则观察与具体入口混淆。输入视图只保留 promptObserved=true、绑定本批已接受正文且 exposureIds 指向 baseline 已有入口的适用回执。没有合法入口时，模板明确采用数组为空；有合法入口才展示元素类型。新增事项的入口不能在同批倒算成此前提供。 |
| `world/recall.mjs:102–145`；`world/runtime.mjs:67–121,141–150` | 旧 makeRecall 没有 pending/retained 具体条目时返回 null，settleDeliveries 只处理 recall.deliveryIds 实际选中的条目，并要求观察与接受正文相绑定。复用“提供的是哪些具体条目”的边界；不带回其关键词匹配作为采用证明。 |
| `profiles/content.mjs:144–167,192–235` | 保持来源 JSON 之外的完整任务模板和尾锚布局，数组是否适用须按实际输入说明；不恢复人物档案职责或额外请求。 |

改动限定 evolve 的模型输入投影与条件化模板、对应因果检查。本地原始 priorDelivery 和严格 reviewAdoption 保持，不吞掉非法返回、不补造采用结果、不增加模型调用。定向检查覆盖首轮规则回执在持久诊断上保持原样但模型采用来源为空、无合法入口时模板为 []、合法批次只保留适用入口且仍给完整元素模板，以及模型仍返回非法采用时整批拒收、原快照不变、只调用一次。上述离线检查不能代替 candidate.7 的真实首轮重验。

同次主代理又提供匿名语义对照：感染条件描述经过时间后的恶化/接触风险，但引用它的入口却要求在恶化之前处理，并直接描写玩家期望的成功转化。ID 引用存在不代表因果成立。沿前节 `exposure.conditionIds → reveal.renderMatter` 的投影路径再次核对：这属于同次推演合同缺少触发/后果一致性说明，不能由格式校验或关键词裁定。本次同时明确入口 when 必须兼容其引用条件，visible 描写条件真正成立后的有据后果，不能用避免触发的行动、另一分支或玩家希望的成功结果代替。未知机制仍保持未知，不能反向硬编码失败或尸变必然成功；真实语义须候选重验。

本次实施后离线检查：因果 23/23、保存屏障 4/4、runtime 27/27，共 54/54；evolve 语法和 `git diff --check` 通过（仅既有 CRLF 提示）。没有新增真实模型请求，解析器和非法采用的拒收规则未放宽；条件/入口语义一致性仍待真实返回核验。

## P2 candidate.7：未观察采用的说明与逐字证据分开

2026-10-22，先只读重新检索 adoptionChecks/not-observed/evidence/knownTo，完整复核当前 evolve 的任务、模板、输入投影、reviewAdoption 及合并/保存返回链；回读下列成熟来源与调用上下游。主代理脱敏实证：candidate.7 首轮曾正确保存，但后续实际采用回执和目标匹配的两条 not-observed 以概述填写 evidence，因概述不在对应正文中而整批拒收。正文未完成相应动作/条件，not-observed 语义本身可合理；这不证明整个候选通过。仓库在该候选真实观察结束前始终只读，收到“可以写候选8”后才落盘本节和最小修正。

| 来源 | 本次核对与适配 |
|---|---|
| `guide/evolve.mjs:33,48–49,60–61,223–260` | reviewAdoption 已允许 not-observed 使用空 evidence，但任务只说所有 evidence 须引用正文，完整模板只示范 shown 引文。最小修正仅把已存在的空值语义写入 system 与适用时尾部合同；不改解析器。 |
| `profiles/content.mjs:154–167,302–350,360–433` | 成熟路径把逐字 evidence 与解释用的 noCharacterReason/其他说明字段分开，原文引证仍通过连续片段核对。复用“说明不是引文”的边界，不恢复人物档案或修复调用。 |
| `world/recall.mjs:102–145` | 实际提供与正文绑定后，未消费条目继续保留，且显式 semanticConsumptionProven=false。保留未观察不等于已发生的含义，不复用关键词判定。 |
| `tests/guidance-causality.test.mjs:244–257,325–369` | 既有批次示例已使用空 evidence 的 not-observed；缺少直接覆盖“空值/真实短引文允许、转述伪引文拒收”的成组测试。本次补该必要回归，不把合成返回当真实模型遵守证据。 |

本次明确：not-observed 可以 evidence:""，没有合适的正向片段时未发生/未满足的概述只放 reason；有相关短原文才逐字摘引，任何状态都不能用转述伪装引文。shown/conflict 仍要求非空原文；非法返回照常整批拒收，原快照不变，不自动修复或追加调用。

同次只读诊断：guide.fact 直接读取模型的 knownTo，mergeMatter 仅合并模型新增知情者，reveal 原样呈现，没有将 players、promptObserved 或正文出现自动转换成玩家知情的本地逻辑。若只是全知旁白/调试说明被判为玩家知情，这是未遵守既有知情合同的模型语义错误；若正文已经明确写为玩家可见通知，则先发生了主正文泄密，不能靠改 knownTo 倒算从未获知。现有并集会保留已存错误知情者，本次证据措辞修正不能修复它；不扩 facts schema、不改预设。

主代理随后又报告冻结反例中模型尝试以 retireExposureIds 撤销既有 ready 入口，现有校验按合同拒绝。该禁止已在 system 和本地引用/撤销检查中明确；此次仅记录拒收原因，不放宽规则，也不追加一次专门提示补丁。客观过程/接触入口与玩家施法计划的分离仍处于只读诊断，尚未实施。

候选8当前最小实施检查：因果测试 25/25 通过，evolve 语法与 `git diff --check` 通过（仅既有 CRLF 提示）。运行改动只有 system 采用合同和适用时尾部合同；reviewAdoption、解析器、knownTo 合并、入口撤销校验均未改。没有版本、提交、安装或真实请求操作。

## P2 candidate.8：独立客观过程与接触入口分开

主代理补充 candidate.7 的匿名因果对照：事实已记录自然侵蚀与变化，但唯一后续条件绑定“取出并施法”，没有表达不实施玩家计划时过程是否继续，以及接触现状本身是否会带来外部后果。当前提示虽然已有按时间/规则推进及尸体示例，却没有要求先独立裁定自然过程，再区分玩家干预，仍可能被玩家计划牵成唯一分支。此前只读提出的三句任务分解现已获准实施；先记录本轮已完成的 2A 来源：

| 来源与完整复核范围 | 最小复用与边界 |
|---|---|
| `world/content.mjs` 全文（特别 12–15），其 `world/runtime.mjs:141–155` 调用 | 旧任务把实际尝试、规则裁决与后果分开；环境/NPC 可以先独立行动，已完成结果成为后续前提。只借因果次序，不带回档案门、骰子或固定推进配额。 |
| `world/native/rules.mjs:8–46,129–155,653–737`；回查公开规则函数调用 | 独立运转先于玩家参与，变化幅度按实际剧情时间，时间短可以稳定，缺必要条件不可凭推进需要补足。当前指导扩展到物体等五类主体；不复制旧面板全知、固定轮数或全世界模拟。 |
| `world/recall.mjs:102–145` 完整观察/结算链；`guide/reveal.mjs` 完整投影 | 已抵达的外部影响不必等玩家调查；隐秘变化仍须实际接触或传播才进入正文。接触/传播的条件和自主过程的成立条件不能被玩家计划无依据地合并。 |
| `guide/evolve.mjs` 当前任务、示例、conditions/exposure 合同与完整尾模板 | 只补先独立过程、再接触后果、后玩家干预的任务分解，继续使用原 process/facts/conditions/exposure，不改 schema、parser、既有事实或模型次数。 |

新增合同允许保持、继续变化或完成；已经成立的结果才写 facts，尚未成立的变化保留条件；入口不得无依据额外要求施法、调查或同意。干预可另有分支，但不能代替自然分支。冻结、时间不足、能力/机制未知都可停滞或未知，不强造攻击或成败。离线测试只核对实际请求携带这份合同及完整冻结规则，不能以字符串出现证明模型真正按因果执行。

本修正与主请求中指导提示被嵌入大段 history 的接入诊断分别记录：本节只管幕后推演的任务分解，不改变主提示位置、不证明接入权重或不泄密体验。主请求接入由根任务独立诊断，需同一最终候选真实核验。

实施后因果测试仍为 25/25 通过，evolve 语法与 `git diff --check` 通过。新增断言确认实际请求的 system/尾模板包含上述顺序与冻结/未知边界，原样保留完整冻结规则来源；没有新增语义检测器或成功判定，也没有真实模型调用。当前代码能力仍须真实普通/冻结/接触回合证明。
