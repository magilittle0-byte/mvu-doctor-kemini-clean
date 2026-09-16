# P3 请求资料去重：修改前证据与边界

日期：2026-09-16（Asia/Shanghai）。基线 HEAD：831ad65efcd91748b0cccfdfa3fd7548b4a0eece。
用户明确授权 Agent 自行修改和测试；只修改有源码证据的必要部分。此记录不代表新候选已经通过真实验收。

## 本次确定的问题

`profiles/host.mjs:50-61` 同时返回存档校验所需的完整 `target`、经原生正则投影的 `narrative` 和经用户输入适配的 `userText`。
P3 `world/engine.mjs` 将整份 input 序列化到世界资料段，原生 `world/native/evolution.mjs` 又在独立近期对话段发送 `narrative/userText`。
因此原始 `target.content/target.userText` 被当作模型资料再次发送，处理后的对话也重复一次。原始消息可能含正文投影有意排除的机制块；它应该保留在本地校验记录，而不是绕过既有投影再次进入推演。

本次对原宿主做一次只读统计，未生成模型请求、未修改宿主：

- 三模块 idle，版本分别为 0.10.30 / P2 candidate.4 / P3 candidate.2，聊天 27 条，native 最新请求编号仍 8285。
- P3 已存实际请求 144389 字符；完整 input 的紧凑 JSON 为 92224 字符。
- 从模型资料投影排除 `target.content/target.userText` 与由原生对话段提供的 `narrative/userText` 后，紧凑 JSON 为 82397 字符，差额 9827 字符。
- P2 同类原始 target 文本副本占 6548 个序列化字符；P1 源码还存在规则双份发送。它们属于另外两个已锁定模块，本候选不同时修改。后续优化必须另行处理其依赖与真实验收，不能借 P3 适配暗改。

上述是字符统计，不是 tokens、人民币费用或新候选实际节省比例。私人正文、姓名、设定、请求和凭据均未写入本文件。

## 来源与最小适配

本次重新检索了当前模块、旧医生、参考归档和原版 World / Story Oracle 的相关路径，并阅读选定机制及输入、请求和保存调用链。

| 已读来源 | 使用方式 |
| --- | --- |
| 原版 `DlSNlGHT/World`，154de4b590378cd0bd851cfffcefd3d96741cf3f，`world-engine-evolution.js:918-1032` | 原样保留独立世界资料段、当前世界状态段、近期对话段及一次模型调用。四个 native 工厂不修改。 |
| 当前 `modular/variables/prompt.mjs:currentNarrative`、`modular/transcript.mjs:userInput`、`profiles/host.mjs:inputFor` | 复用已经存在的正文和用户输入投影；不新增正则、摘要器或语义筛选器。 |
| 当前 `world/runtime.mjs:execute`、`world/host.mjs:assertSnapshot` | 完整原始 input、receipt 和 profileRecordHash 留在本地 review / 作用域校验中。仅 engine 的模型资料投影去重。 |
| 本轮参考学习的 GroupWorld provider 按槽位避免重复注入、NPC Tracker 紧凑模型视图 | 作为比较依据；不冒称移植其代码。实际复用的是上述已有原生分段与当前投影。 |

必要新增逻辑仅为一个非持久化的 input 资料投影：target 保留其身份和作用域元数据；本轮对话只由原生近期对话段提供；MVU、全部完整档案、权威卡/世界资料、玩家边界、heldProfiles 及全局附加提示词继续完整提供。JSON 去掉排版空白，字符串值不裁剪。

## 排除的改动

- 不改 P1/P2 文件、依赖锁、44 字段合同、模型路由、预设、数据库或宿主 UI。
- 不改变世界事件概率、结果合并、秘密与公开边界、召回完成判断、手动修复或自动重试策略。
- `evolveResult` 的原生值是成功/受挫/保持等阶段结果，不是被丢弃的完整剧情后果；不把 `desc || evolveResult` 擅自判成世界语义缺陷。
- P1/P2 完整同证据恢复已能避免下游请求，保留。P2 partial 恢复及 P3 按新档案版本重推另记为费用行为，不在本轮加入新状态机。

## 验证与预算

快速检查只证明：最终请求中投影对话各一份、原始机制块不通过 target 旁路进入、完整模型事实不丢、本地输入不变、一次调用及原生失败/取消/保存边界仍成立。
修改后新建 P3 candidate.3，并按唯一协议进行同一新聊天十二个有效普通回合及必要压力覆盖，P1/P2 原锁保持。正常医生上限仍为 1+2+1，无自动重试。按实际请求记录调用与 usage，不用字符数冒充 token 收费。
正文中的真实世界影响仍需独立核验；本次成本修复不能把旧的“已注入但未证实消费”改写为通过。
