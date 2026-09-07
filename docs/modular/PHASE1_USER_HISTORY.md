# 历史玩家设定输入修复来源（0.10.14 候选）

状态：修改前来源映射。0.10.13 的真实第三轮已拒绝；没有模块锁定，旧轮次不能累计。

## 实际故障路径

首条用户消息明确物品类型 → 首轮正文沿用该类型 → 后续正文改写类型 → Doctor 补全库存时沿用错误类型和另一套属性规则。没有玩家更改指令或剧情转换事件。官方解析、保存和界面读回一致，只能证明错误结果实际落地。

Doctor 的历史调用为 `module.mjs → Story Oracle buildTranscript → buildTranscriptTurns → 宿主 USER_INPUT 正则`。原用户定义在原始聊天中完整存在，但在基础诊断消息及全部八个分组中缺失。把上下文深度从 30 改为无限后仍缺失，因此不是长度截断；世界书包含原类型的通用规则也不能证明用户的具体设定传入。

## 已完整阅读的相关实现及上下游

| 来源 | 实际机制 | 处理方式 |
| --- | --- | --- |
| `vendor/story-oracle-v1.35.4/index.js` 的 `messageVisibleForTranscript`、`buildTranscriptTurns`、`buildTranscript`、`stripMechanismBlocks` 及诊断组装调用 | 隐藏楼层过滤、完整可见聊天的相对深度、逐消息正则、机制块剥离、空消息过滤、最后 N 条及顺序 | 原样保留流程。作者原件保持字节不变，在独立适配文件中移植该函数 |
| `vendor/life-state-v5.35/life-state-v5.35.js` 的 `getUserMessageBefore`、`stripExternalContextState`、`filterExternalAssistantContent`、`getRecentExternalContext`，以及预览和正式 `translationInput` 组装调用 | 用户输入与助手正文分流；正文过滤只应用于 assistant，用户消息保持其输入语义 | 最小适配：Doctor 历史中仅 assistant 执行宿主正文正则；用户仍通过原生机制块剥离。不会加载 LifeState 业务模块，也不移植其领域专用状态清理 |
| `real-sillytavern-qc/app/public/scripts/extensions/regex/engine.js` 的 `getRegexScripts`、`getScriptsByType`、`getRegexedString`、`runRegexScript` | global/preset/card 来源、USER_INPUT/AI_OUTPUT、prompt/display 和深度条件 | 原样调用助手路径；不更改用户宿主正则配置，不改正文显示规则 |
| 当前 `modular/variables/prompt.mjs`、`module.mjs` | 当前正文单独绑定，历史与本轮输入/规则/前后 MVU 分开提供，八组共用相同基础证据 | 改用上述历史适配入口；历史行显式标记用户或助手来源；不增设事实存储、语义审查器或模型请求 |

全局检索同时覆盖旧医生、数据库与模板、糖糖、Izumi、缝合怪、Z论坛、故事神域和既有诊断/权威数据流资料。数据库的填表或旧权威优先级不能直接修复此处消息投影丢失；其业务调度不移植。原世界规则和角色卡不修改。

新增部分限于适配接线和合成回归：重现历史用户清空正则，验证原用户定义保留、助手规划仍过滤、原深度/隐藏设置和顺序不变。快速检查只能证明这些结构性质，不能代替当前配套候选的真实新聊天十二轮。

## 同根的数据库包装与正文输入缺口（补充修改前映射）

现场确认生效的是全局 `【必开】数据库默认正则2`，UUID `39e30e73-5798-4ead-86e4-d77fcc232701`：USER_INPUT、promptOnly、minDepth=2，`/以下是用户[\s\S]*$/m` 替换为空。当前三条用户消息均以数据库包装开头，含唯一完整的 `<本轮用户输入>`；原玩家文本完整保存在该标签内。因此较早玩家消息被整体清空，正文与 Doctor 都失去来源。

已完整阅读数据库 spv8.4 历史源码中的 `finalSystemDirective`、`buildFinalPlotInjectionMessage_ACU`、`performReplacements`、`extractContextTags_ACU` / `extractTagsFromLine` / `extractLastTagContent`，以及外置数据库补丁 README 的配套正则说明。数据库以 `$8` 填入玩家输入，其后追加召回；提取器按完整标签提取，未命中时保留原文。对应资料位于项目归档 `checkpoints/2026-07-23_database-history-v4/database-patches-v4/shujuku-spv8.4-index.test-fixture.js` 与 `current/database-patches/README.md`。

- 最小配置适配：保留同一正则 UUID、作用位置、提示词用途、启用状态和深度，只将替换规则限定到完整数据库包装并保留 `<本轮用户输入>` 内容。旧召回尾段仍被裁掉，普通用户文本不匹配时保持原样。该配套配置不是删除预设原文，也不修改数据库本体或表格。
- Doctor 用户输入：移植数据库 `extractLastTagContent` 的完整标签提取，限定在明确的数据库包装前缀内；用于历史用户行和本轮用户输入。助手正文仍走 Story Oracle 原正则。原始消息不改，身份和存档核对继续使用原始内容。
- 安装复用宿主原生 `getScriptsByType / saveScriptsByType`，只替换命中的一个 UUID，并验证其余配置逐项不变；保留原条目备份和配套候选哈希。当前真实验收须绑定该兼容条目。
- 新写仅为单条配置的精确安装与读回检查、合成包装回归，不增加状态机、记忆表或模型调用。此次不能声称修复了所有可能的模型语义错误。
