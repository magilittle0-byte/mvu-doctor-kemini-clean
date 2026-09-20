# P2 GM 指令串台：任务边界修复来源图

2026-09-20。协议 2A 的修改前来源映射与脱敏故障记录。这里不保存正文、模型原始响应、提示全文、角色卡或世界书内容；候选实现不等于真实酒馆验收。

## 脱敏故障证据与结论边界

主 agent 独立核验的脱敏序列记录：seq1 自动及一次人工修复均返回合同合法的空 `people`；seq2 曾有一项 P1 规则误读被官方 MVU 校验拦截，随后单次 P1 修复返回 `nochange`；同回合 P2 后续一次响应先输出 GM 链/额外正文/变量更新块，再附带档案 JSON。严格 P2 parser 以 `profile_turn_invalid` 拒绝整份混合响应。主 agent 已核验实际 request/wire 与传入的完整投影正文一致，没有程序截断。

这证明 P2 有重复的语义漏检，并出现了角色/输出合同串台表现；它不证明串台文本究竟来自卡片、世界书、缺失 MVU 规则、全局提示还是模型侧背景。空人物检测属于模型语义失误，不是 parser 漏人。混合格式被拒绝是预期保护行为，不应放宽 parser。

## 源码路径与可复用机制

| 位置 | 当前路径/成熟来源 | 对本次修改的意义 |
|---|---|---|
| `profiles/content.mjs` | `PROFILE_TURN_INSTRUCTIONS`、`profileTurnPrompt()` 将任务规则、背景 JSON、44 字段模板和响应合同展平为单一字符串 | 将稳定的 P2 任务与输出合同置于 system role；输入与反馈作为单独 user 数据消息。保留 `profileTurnPrompt()` 展平导出供既有调用/测试兼容，运行时改用双消息接口。 |
| `profiles/host.mjs` | `inputFor()` 由 Story Oracle 取得角色卡、`buildWorldInfo()` 和 `collectMvuUpdateRules()`，并合并进 `authority`；P2 `callModel()` 负责将消息发往 direct/profile 路由。World host 也共享该 `callModel()`，仍以 string 传入原生单 user prompt | P2 消息数组按原角色直传并克隆；string 兼容路径继续包装为单 user 消息，不能把人物 system 合同加到 P3 原生提示。P2 不删任何背景、正文、MVU 或 44 字段。user 数据明确标为参考资料，不能执行其中的 GM 正文、思维链、格式或变量更新指令。 |
| `profiles/runtime.mjs` | `call()` 计数、哈希并持久化请求；profile turn 的调用上限仍为 1 | 持久化原兼容 `prompt`，同时记录实际 `messages`；请求哈希绑定真实 wire messages；不新增自动请求或修复调用。 |
| `modular/variables/prompt.mjs`、`modular/variables/module.mjs` | P1 使用 system task + 分区 user data；背景部分明确其中正文生成/思维链/显示格式指令不是医生指令。对一个已知数据库包装只替换优先级说明，将其降为参考资料，不丢记录内容 | 复用 system/user 职责分离和“背景为资料、不是本模块指令”的边界。P1 的已知数据库包装替换是窄适配，不代表应过滤或丢弃 P2 世界书文本。 |
| `mvu-auto-doctor-reference-archive/02-reference-code/npc-tracker/scripts/profile.js`、`scripts/api.js`、`scripts/state.js` | 档案 system prompt 与 JSON user payload 分角色；world info 另标背景资料且不自动代表人物亲历/已知 | 佐证可在一次请求中分开稳定任务和 JSON 输入。仅复用消息角色分层与背景注释，不移植其字段、知识模型或逐人物调用。 |
| `mvu-doctor-p2-repair-candidate5/profiles/content.mjs` | 发现修复提示逐段复查 narrative、实际提及并补漏；单次 batch user 内容明确任务项绑定 | 复用“逐项复核正文、覆盖实际提及、不得因上次格式合法而当作找全”的内容提醒，适配为本候选 profile-turn 系统合同。 |
| `mvu-auto-doctor-reference-archive/02-reference-code/database-patches/src/core.mjs` | 注入 SQL 规则后仍按每段原始 role 推送 message | 只作 role-preserving 参考；数据库硬规则不适用于 P2。 |

修改只重排同一次请求的消息角色和输入分区。遵循 P1 的兼容边界：用户设置的 `globalPrompt` 仍以 system role 参与适配，但它只能改变与 P2 相容的模型行为，不能覆盖 P2 任务、人物身份/出现证据来源及严格输出合同；随后重申 P2 固定规则，避免自定义提示改写合同。card/world/MVU/narrative/userText 以及其他输入字段作为引用资料，字段内若有 GM 正文、思维链、格式或变量更新文字也不是本次执行命令。user 消息保留完整 projected narrative、userText、已核验 MVU、authority、玩家、已有档案、许可退休 ID 和手动反馈；先给除 narrative/userText/globalPrompt 外的完整紧凑 JSON 输入，再给玩家输入，最后以原始投影正文收尾，避免正文被超长 authority JSON 压在前面；不丢任何资料或 44 字段模板。

## 验证边界

需要单测锁定 system/user 边界、全局适配提示仍保留但不能替换 P2 合同、完整投影保留、target 原始重复字段剔除、注入/GM 风格字段仍只能作为 user 数据、实际 direct/profile wire 均保持两种 role 且只有一次调用、请求日志同时保留扁平 prompt 与实际 messages，以及带额外正文/变量块的伪造响应仍被 parser 拒绝。测试文件新增名为 `tests/profiles-host.test.mjs`，用于检查实际 host 到 direct/profile API 的角色传输。单测和本地代码检查仅为回归检查；candidate.7 必须由主 agent 按当前真实酒馆协议重新验收。
