# P3 输入投影及完成结果复用：修改前来源映射

2026-09-20；协议 2A；Luna 完成当次全项目与历史实现检索和完整链路阅读，主 agent 审阅后落盘。不是验收报告。原生 World 文件和 P1 原字节保持。

| 数据路径 / 问题 | 命中来源与上下游 | 原样复用 | 最小适配 / 新写原因 |
|---|---|---|---|
| `profiles/host.inputFor` → `world/host.captureProfiles/assertSnapshot/inputFor` → `world/engine` 模型段 | 当前完整 host/engine/runtime/store/recall；`docs/world/P3_INPUT_COST_SOURCE_MAP_2026-09-16.md`；r10 `WORLD_REPAIR_SOURCE_MAP.md` | 本地原始 target、严格 profileRecordHash、完整事实/权威/档案/held；已有正文副本去重 | 模型 view 移除纯 target 定位与 record hash；本地仍保留 target.index 供 worldInstruction 轮转。已去除的重复正文不再冒充此次收益 |
| revision/review 变化引起已完成 P3 重跑 | 当前 runtime `attemptKey`、`inputIdentity`、exact 分支快速恢复；store 分支键、CAS、写前写后断言 | attemptKey 仍捕捉上游变化；所有在途严格 hash 断言及 store CAS 保留；相同 baseline/baseDeliveries 重算当前轮 | 扩充既有 inputIdentity 为完整实际语义键。只 complete/current-version/exact-target 可复用；不能把 failed/running 行显示为成功。诊断元数据不进入语义键，不能漏事实/知识/关系/配置 |
| 完成态与严格目标 | hotfix `worldSovereigntyTaskAlreadyCommitted` 的 sourceKey + committed；testing Stitches P3 committed/checkpoint/readback/strict-target 来源 | durable 完成态、完整目标和读回原则 | 历史 WAL/actor/action 双域账本不兼容当前 branch KV，不能搬其状态机；全局未发现能原样替代本候选完整语义键的实现，故沿既有 inputIdentity 最小扩展 |
| 实际模型合同/世界生命周期 | 原始 `vendor/world-engine-v3.0.2/world-engine-evolution.js` → exact wrapper `world/native/evolution.mjs` → engine 一次 evolve/merge；`world/recall.mjs` boundRecall/settleDeliveries | apiAutoRetries=0，全部活动事件/离场人物，原生骰子、合并、回滚、秘密和结算召回 | 不动 native。键包含版本/指令合同、精确目标、事实输入、模型路由与实际参数、world baseline、有效召回及 base/inherited deliveries |
| 上游仅诊断变化后的复用落盘 | 原 `world/store.commit/read` 与 host.assertSnapshot | 相同分支、revision CAS、严格当前 receipt/profile hash | 用当前严格绑定重绑 complete 记录，保存后 fresh readback 验证，失败即停止；不能只显示旧成功。显式 manual 永远一次世界模型调用 |

新增反例覆盖：相同事实但 P2 revision/review/hash 变化为零调用且重绑读回；目标、变量、完整档案、暂缓名单、权威/全局约束、模型/参数、提示合同、world baseline、有效召回变化不可误复用；失败/运行中记录不能恢复 complete；在途人物变化仍阻断；模型投影保留完整事实。

P2 的 updatedAt/rowId 属于本地档案写入时间/显示行标识，若作为唯一变化也触发 P3 重跑则复用目标无法达成。仅在模型投影也剔除这些诊断字段后，可以从语义键排除；profileId、presence、lastSeenIndex、sourceEvidence 及所有内容/未知语义字段保留。不能直接把 whole profileRecordHash 换为人物数量或挑选少数字段。

版本、依赖锁、loader 由集成 agent 在真实上游门禁完成后绑定；旧 phase2 证据不得复制为新候选已通过。此映射只授权指定 world 适配层及其反例测试改动，不解除加载硬门。
