# 指导持久化来源映射（2026-10-22）

本轮按根 `MVU_REAL_TAVERN_TEST_PROTOCOL.md` 第 2A 节先检索，再完整读取相关存储、分支、提交与恢复函数。目标只有指导自有事项的保存与读回；不迁移或删除医生、人物档案、变量和世界引擎旧数据，不调用模型，不启动真实酒馆验收。

## 来源与取舍

| 数据路径 | 已核对来源 | 原样复用/最小适配 | 不复用的部分及原因 |
|---|---|---|---|
| JSON 快照与内容标识 | `modular/variables/core.mjs` 的 `clone/canonical/equal/digest/fault` | 摘取无副作用的 `clone/canonical/digest/fault`，不加载变量运行链 | 不带入 MVU 补丁解析、字段所有权或变量修复 |
| 持久化及独立读回 | `modular/store.mjs` 全文件；`profile-engine.js` 的 `openDoctorDurableDb/durableWorldStoreBatch` 完整函数及提交调用 | 复用 IndexedDB `kv`、事务完成后另开只读事务读回、打开失败可重试机制；沿用现有 `mvu_doctor_modular` 数据库，仅使用 `guide:v1:` 键 | 不复用内存镜像、sessionStorage 回退或旧存档迁移；镜像读回不证明落盘 |
| 分支键、版本和补偿 | `world/store.mjs`、`profiles/store.mjs` 全文件；`profile-engine.js:254-383` 的提交/补偿链 | 分支独立键；保留写前快照；仅在当前值仍等于本次候选时补偿；第三个版本不覆盖 | 原 KV 的先读 revision 再另开写事务只有单实例串行保证，因此最小增加同一 readwrite 事务内的 get/比较/put；补偿亦在同一事务比较后写入 |
| 当前聊天前缀及同楼前态 | `profiles/host.mjs` 的完整 `branches()`；`modular/host.mjs` 的 scope/capture/assertTarget；`world/runtime.mjs` 全文件 | 宿主按当前正文前缀计算 lineage；调用方按当前 lineage 找最近有效前态；每个目标保留固定 `beforeSnapshot` | 不导入这些模块的启动链，不依赖 P1/P2 人物档案或变量回执；不把该楼已经演变后的结果再次当同楼基线 |
| 主回复身份及刷新 | `modular/runtime.mjs` 全文件、`world/runtime.mjs` 全文件 | 来源核验和取消令牌由新 runtime 使用；store 接收 `assertCurrent` 并在写前/读回后核验 | 旧 modular.restore 会恢复 accepted pending 并发请求，指导刷新须只读，故不复用该入口；旧 world.observe 的 busy 跳过也不能代替待处理正文续接 |
| 其他成熟作品比对 | 项目及参考归档中的数据库补丁 `core.mjs` 快照/删除恢复函数与 runtime 调用；npc-tracker `state.js` 的保存/恢复/迁移完整区段；world-engine `world-engine-store.js` 全文件；旧 V2 `transaction/branch.mjs` 全文件 | 保留“不要覆盖后继分支”“稳定聊天身份”“旧数据保留”的边界 | 数据库补丁只恢复表格；NPC tracker 当前快照继承已移除；世界引擎自动迁移删除 localStorage 且异步镜像先成功；旧 V2 全领域分支状态机超出单功能范围，均不整体移植 |

## 最小契约

- `createGuideStore({ indexedDB })` 返回 `read(scopeKey, branchKey)` 和 `commit({ scopeKey, branchKey, expectedRevision, record, assertCurrent })`。
- `branchKey` 为目标 `lineage`。记录含 `schemaVersion: 1`、`scopeKey/branchKey/revision`、`target.identity/index/lineage`、`beforeSnapshot.matters`、`snapshot.matters`、`coveredReplyKeys`。额外指导自有字段保持原样。
- 运行中候选与错误状态由 runtime 管理；此存储只接收完整快照。同楼重算仍从该楼固定的 `beforeSnapshot` 开始。自动去重与忙碌合并属于 runtime；不能只覆盖最新任务指针而遗漏最后已覆盖正文之后的中间变化。
- 写前执行来源核验；同一 IndexedDB 事务读取旧值、核对 revision、写入候选；另开事务完整读回；再次核验来源。出错时仅条件补偿自己的候选。无前态时写指导自有空墓碑，读取表现为不存在；不调用删除/全库清空。
- 读回失败或第三方竞争版本不伪称保存成功。返回已知错误码；不把原始私人正文、模型请求或密钥复制到来源映射和测试报告。
- 没有 latest 全局指针，没有旧数据迁移，没有自动重试模型或刷新时调用。当前分支的前态选择、accepted 去重、忙碌续接由调用方完成。

## 检查边界

针对性测试只使用独立浏览器上下文中的合成 IndexedDB 数据，验证命名空间、并发版本比较、过期补偿、第三方版本保留、读回失败和恢复读回。该检查不是 SillyTavern/TauriTavern 实测，不证明剧情推演或真实验收通过。

2026-10-22 执行 `node --test tests/guidance-store.test.mjs`：12 项通过、0 项失败。实际使用隔离无头浏览器的 IndexedDB；所有页面与模块请求均由本地测试内容响应。覆盖双实例同版本提交竞争、原数据保留、过期前后拒绝及补偿、首次失败空墓碑、第三版本保留、独立读回失败、损坏数据拒绝、刷新只读、同楼前态保留、分隔符不碰撞及输入契约。没有发模型请求，没有连接真实酒馆，没有取得用户验收。
