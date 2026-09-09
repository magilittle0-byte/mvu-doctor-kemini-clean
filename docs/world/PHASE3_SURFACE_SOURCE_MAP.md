# P3 world surface source map

本次只新增 world surface、其受控测试和本文件，不修改 P1/P2 或 vendor。surface 只负责状态与已保存 world record 的本地展示和按钮转发，不调用宿主、模型或审批流程。

## 复用与适配

| 机制 | 来源 | 本次适配 |
| --- | --- | --- |
| 独立模块面板、`render`/销毁生命周期、按钮 `textContent` | `profiles/ui.mjs` 的 `createProfileUi`、`appendText`、`render`、`destroy` | 建立独立 `#mvu-doctor-world-root`；不复制 profiles、不依赖旧 `modules.world` 字段 |
| 状态公开形状 | `profiles/runtime.mjs` 的 `snapshot`、`record`、`review` | surface 接受 `getStatus/getRecord/retry/refresh`，显示 world 专属 status/record 计划字段 |
| 失败后重试与旧完整结果保留 | `profiles/ui.mjs` retry catch 与 failed/partial 旧档案提示 | 只显示安全错误 code，retry rejection 转为 known failed 状态并保留最近完整 world record |
| 详情折叠 | `profiles/ui.mjs` 使用 `<details>` 展开完整档案 | world 主记录和 blackbox 使用独立折叠区；blackbox 不进入任何模型 prompt API |

## 公开接口

`createWorldSurface({ getStatus, getRecord, retry, refresh })` 返回 `{ render, dispose }`。`render(state?)` 可使用传入快照，也可读取 getter；按钮只调用传入的 `retry` 或 `refresh`。状态字段为 `status/stage/busy/readback/error/round/restored`。计划 record 字段为 `world/deliveries/heldProfiles/inputIdentity/variableIdentity/profileRecordHash/index/revision/status`。

world 中展示 `worldDigest/events/factions/winds/worldTrends/reputation/economy/memories/enemies/influenceChain/regionalIncident/distantEvent/nearEvent`，每项写入独立节点的 `textContent`。`blackbox` 单独放在默认关闭的 `<details>` 内；`heldProfiles` 只显示绑定数量或摘要计数，不复制完整 profile 内容。

## 安全边界

错误只允许有限安全 code（如 `world_store_read`、`world_stale`、`world_transport`、`world_failed`、`world_retry_failed`、`world_refresh_failed`）；未知错误显示 `unknown_error`，不显示原始异常、endpoint、prompt 或模型返回。surface 没有 confirm/approve 控件，不把“完整记录已读回”转化为语义验收。

复核确认仓库中没有 `profiles/surface.mjs`；实际复用来源是 `profiles/ui.mjs` 和 `profiles/style.css`。本 surface 不导入旧 P1/P2 UI，也不修改其样式文件。

## 窄修来源补充

surface 只显示当前 `getRecord()` 快照；跨聊天或空快照不由 UI 缓存旧记录，失败保留由 world runtime 负责。中文字段标签、`detail`、阶段说明和安全错误码沿用现有状态面板的本地展示边界。详情节点在重绘前保存 `open`，重绘后按同一 section key 恢复；技术身份 hash 放在独立折叠区，完整 `heldProfiles` 与 deliveries/正文证据按 textContent 展示。
