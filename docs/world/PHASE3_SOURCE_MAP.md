# 第三阶段接口适配来源

P1 与 P2 已分别锁定。P3 独立新增代码，不修改两个模块或其配套文件。本文记录已经选定并完整阅读的接入机制；世界推演与召回的详细映射随其实现补充，不能以本文宣称阶段验收。

| 数据路径 | 完整读取的来源 | 采用方式和适配边界 |
| --- | --- | --- |
| 读取已确认的正文、MVU、权威设定与模型路由 | `profiles/host.mjs` 全文及 `modular/host.mjs` 的 capture/assertTarget/contextSnapshot/readback；`modular/runtime.mjs` 收据发布链 | 直接调用 `createProfileHost` 已公开的只读方法；不改其提示、凭据或 MVU 写入路径。 |
| 读取当前完整档案 | `profiles/entry.js`、`profiles/runtime.mjs`、`profiles/store.mjs` 全文 | 读取 P2 的 `read/record/status`，检查 exact scope/lineage/index、P1 identity/MVU hash、终态及完整字段。P2 未完成时等待；部分失败只排除受影响人物，完整人物仍可用。不把前一回合快照误认成本回合完成。 |
| 避免档案修复期间使用过期副本 | 同上 P2 `execute/retry/refresh` 与 P1 独立异步 consumer 发布 | 新增最小只读快照绑定：保存 P2 整记录 digest；模型返回及写入前重新检查。P2 没有公开 subscribe，后续 P3 生命周期接缝必须独立观察其终态，不能修改 P2 事件或封装其内部函数。 |
| P3 持久化 | `modular/store.mjs` 和 `profiles/store.mjs` 全文 | 原样复用实际 IndexedDB 事务和独立读回；最小复制 branch/revision/补偿提交机制，替换为 P3 自有 `world:v1` 命名空间和世界记录形状。世界记录与世界模型结果在同一事务，不写 profile 或 MVU key。 |
| 过期提交与恢复 | `profiles/store.mjs` 的 commitNow/latest 及其上下游 runtime | 保留提交前后断言、仅补偿本次 exact candidate、revision 冲突拒绝、空分支 tombstone 与历史分支选择。受控回归实际在 write 后使断言失败，避免把写前失败当作写后补偿证据。 |

原生 World 的 memory-first store 不直接替换上述持久化；其工作区只可作为单次候选的内存组成，正式记录由 P3 的同一个持久事务保存。未创建另一套世界调度器。旧 typed actor ledger 仅为历史参考，不作为本次新增前置门。

## 生命周期与修复的实施约定

已完整读取 `profiles/runtime.mjs`、`profiles/entry.js`、`profiles/host.mjs`、`profiles/store.mjs` 及 P1 capture/subscribe 上下游。新增 runtime 最小适配同样的 epoch、AbortController、串行 promise、独立 extension prompt、generation scope、regenerate 初次删除例外与 exact branch 回读。P2 没有订阅，P3 用自己的短周期只读观察检查 P1/P2 终态；只有新的收据或档案 revision 才申请一次任务，重入或一次模型失败不能构成无限自动重试。

每一分支世界记录同时包含 `baselineWorld`（本轮推进前）、`world`（最后完整结果）、`baseDeliveries` 与 `deliveries`（召回收据），以及当前变量和完整档案的指纹。手动修复重新读取当前正文、MVU、档案，始终以同一分支的 baseline 运行 native forward，替换本轮结果而不叠加轮数和成本。运行中/失败状态保留已有完整 world；失败不清空世界记录。原生内部 STORE 的变化只留在候选内存；成功后一次提交整份世界及召回账本，提交前后再次验证全部输入。进程中断留下的 running 记录显示为可修复，不在刷新后默默连续调用。

世界行动提示沿用 `profile-engine.js:703-735` 的 native actor hook，但读取完整 P2 profile，不再使用旧 seed 摘要或 2200 字截断。按稳定 profileId 和世界轮次轮转完整人物；已经离场的完整人物优先推进，禁止将档案缺失人物再造一份。世界裁决与人物尝试在 native 同一次模型调用中完成，通过原有事件描述、私密 blackbox 和世界数据保存；脚本不据自由文本判断成败，不成为第二 MVU writer。

召回字段与消费绑定来源另见 `PHASE3_RECALL_SOURCE_MAP.md`。生成结束只封存请求观察，P1 的稳定 accepted target 才能绑定正文证据。有限字面匹配与真实语义消费分开记录；主模型看见提示本身不算事件已经发生。生成取消、分支变化或不匹配目标丢弃旧租约。P3 自有 UI/entry/loader 独立装卸，不读取旧 P1 的 modules.world 显示字段。

## 上游修复结束后的同输入恢复

真实第三轮曾出现：P1 手动修复返回 `model_nochange`，P2 自动恢复完全相同的档案，P3 的完整存档和输入身份均未改变，但界面一直等待。原因是 observer 在上游忙碌时更新了展示状态，随后又因旧 `lastAttempt` 相同而跳过恢复。

本次重新检索并完整核对 P2 的 exact 恢复、P3 的 observe/run/execute/show、host 快照断言、store 读回和 surface 通知链。最小适配仅在上游忙碌分支清除 attempt 标记，使结束后重新走既有 `captureProfiles -> assertSnapshot -> store.read -> inputIdentity -> show(exact, true)`。不新增模型调用或写入，不修改已锁定 P1/P2。原生 world chatcache 的同内容恢复仅作来源参考，不移植其独立存储机制。

定向回归覆盖变量与档案两种上游修复后的状态恢复，并核对存档不变、世界轮数不变、模型调用与写入不增加；已有世界失败仍等待人工修复。受控回归不能替代真实门禁，旧指纹第三轮在此问题处被拒绝，新指纹重新进行完整真实验收。
