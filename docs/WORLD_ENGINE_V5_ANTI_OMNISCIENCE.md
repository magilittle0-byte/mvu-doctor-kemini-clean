# 世界连续性引擎 v5：私有世界与防全知投影

本文件是 `0.6.0` 的实现边界与来源映射，不是正式酒馆验收报告。

## 根因

v4 已经给 thread 和 actor action 标注 `hidden / rumor / observed`，但正文召回仍把完整对象序列化注入。于是 `offscreenBeat`、真实意图、隐藏行动、私有裁决和人物档案里的 `currentGoal` 会越过标签直接进入正文模型。问题不在于缺少一句“不要全知”，而在于私有状态与叙事输入共用同一个数据对象。

## v5 所有权

| 数据 | 所有者 | 正文是否可读 |
|---|---|---|
| thread 的 `summary / offscreenBeat / nextBeat / stakes` | Doctor 私有世界状态 | 否 |
| actor action 的 `goal / intent / action / knowledgeBasis / capabilityBasis / risk` | Doctor 私有世界状态 | 否 |
| adjudication 的 `resultSummary / costs / stateChanges / revealPath` | Doctor 私有世界状态 | 否 |
| `publicSurface` | 当前视角可直接观察的表象 | 是 |
| `publicClues / observableConsequence` | 不说明隐藏原因的可观察线索或后果 | 是 |
| `rumors` | 世界中真实存在但未证实的传闻 | 是，必须保持不确定语气 |
| `revealedSummary` | 已经由最终接受正文证据揭示的部分 | 是，仅在证据门通过后 |

Doctor 控制台和完整报告可以显示私有层，方便用户检查世界是否真实推进；正文预注入只能读取脚本生成的公开投影。

## 揭示门

- `knowledge=hidden` 是默认状态。
- `knowledge=rumor` 只能公开 `rumors`、表象和线索，不能公开真相。
- 首次进入 `knowledge=observed` 时，模型必须把本轮最终接受正文中 4 至 180 字的原文逐字放入 `revealEvidence`。
- 脚本确认原文确实存在后，才允许 `revealedSummary` 进入下一回合召回。
- 公开字段出现典型全知措辞时，候选被拒绝并进入原有定向重试，不提交半套世界状态。

## 召回投影

召回相关性仍可在 Doctor 私有数据上计算，以便找到真正相关的暗线；完成排序后才做不可逆裁剪：

1. 完全没有公开表象、线索或后果的隐藏事项不进入正文召回。
2. 隐藏 thread 不携带私有标题、actorIds、地点、关键词、真相摘要、下一步或代价。
3. 隐藏 action 不携带行动者、目标、具体尝试、裁决状态或成败。
4. 可观察后果可以进入正文，但标记 `causeWithheld`，正文不得据此反推出行动者与原因。
5. 一次性预约、消费和 reroll 恢复语义保持不变。

## 人物摘要隔离

- 正文只收到不可逆哈希 `profileHandle`、脚本曾在最终接受正文中逐字确认并持久化的 `knownNames` 与 `doNotRerandomize`，用于避免重复随机；模型自行填写的 evidence、原始 profileId、未公开真名和推断别名都不能提升公开权限。
- Doctor 的人物修复和世界引擎使用独立的私有摘要，保留身份、人格、目标、关系、知识、能力、资源与可修订推断。
- 两类摘要由不同函数生成，避免以后再次因复用同一摘要而泄漏。

## 来源与新写范围

| 机制 | 来源 | 处理方式 |
|---|---|---|
| 单一世界权威、稳定 ID、两阶段提交、读回、一次性召回回执 | 本仓 v4 当前实现 | 原样保留并兼容迁移 |
| `hidden / rumor / observed` 标记 | 本仓 v4 当前实现 | 保留标签，补上真实隔离语义 |
| 私有层与公开投影分离 | 本次用户提出的功能目标与 7.0.2 跑团证据 | 新写；没有复制或读取旧 Doctor 代码 |
| 精确正文证据揭示门 | 本次根因修复 | 新写 |
| 人物公开摘要与 Doctor 私有摘要分离 | 本次根因修复 | 新写 |
| IZUMI0825 预设适配 | 用户指定的完整本地预设 | 原文件逐项保留，只追加一个可审计模块与一个启用顺序项；预设不进入仓库 |

数据库、MVU、预设与 Doctor 的所有权没有变化：数据库独立填表，MVU维护实时变量，预设生成正文，Doctor在最终正文后维护档案和私有世界连续性。
