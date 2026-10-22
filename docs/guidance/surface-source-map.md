# 指导最小入口与界面来源

日期：2026-10-22。按当前真实协议 2A 重新检索后，先记录来源再实现。目标是从正常聊天界面能够找到唯一的“指导”入口，查看真实状态、开关和幕后进展。红线是不启动旧三模块、不改其他设置，不把查看/刷新变成模型请求。P1 只做可验证的最小界面；布局检查不能替代真实酒馆或手机验收。

## 本次来源核对

重新检索当前及历史医生、数据库/世界/论坛界面、前端退化复盘和相关运行记录。完整读取 `app/surface.mjs`、`app/entry.js`、`app/style.css`、`world/surface.mjs`、`world/entry.js`、`modular/entry.js`，并核对当前指导 `runtime/host/store/evolve` 的公开契约；旧论坛展开函数及上下文只作为触控问题来源。普通预设、糖糖/Izumi、缝合怪、卡和 K3 没有适合此次独立扩展入口的界面实现，不复制其业务内容。

| 本次路径 | 来源 | 复用与边界 |
|---|---|---|
| 明确可见的入口与关闭 | `app/surface.mjs:52-91,176-183,209-230`；工作区 `deliverables/doctor-retrospective-2026-09-28/前端退化与交付缺口对账.md` | 最小适配 body 上的入口、独立面板、Escape 与清理。不移动旧面板，不使用三模块标签，不把扩展抽屉内节点存在当可达证明。 |
| 小屏与键盘视口 | `app/surface.mjs:44-50,180-183,212-214` | 保留 visualViewport 高度/偏移与 resize/scroll 配对；CSS 变量只设在指导根节点，不写旧医生或文档全局样式。 |
| 安全展示及折叠 | `world/surface.mjs:19-30,55-60,79-96`；历史 `tauritavern-system-knowledge-archive/current/mvu-auto-doctor/index.js:7057-7087` | 复用 createElement/textContent、原生 details。幕后内容与诊断默认折叠；简单 summary 不复制旧论坛块预览的额外点击切换。按事项展示事实/条件/显露，避免原始 JSON 把用户淹没。 |
| 生命周期 | `app/entry.js:6-44`；`world/entry.js:13-18,43-59` | 仅复用单实例、pagehide 和成对销毁的机制。entry 只导入 guide 文件；不等待 P1/P2，不加载 StoryOracle，也不自动停用检测到的旧医生。 |
| 真实状态与动作 | `guide/runtime.mjs` 的 bind/destroy/retry/setEnabled/snapshot/record；`guide/host.mjs` 的独立设置/提示 | notify 驱动显示，不新增轮询或调度。开面板和展开详情均零请求；重算按钮明确额外调用，运行/正文生成期间禁用。 |

接口与版本以 `host-source-map.md` 为准：当前能力探针为 Tavern 1.18.0 / Helper 4.9.3。界面本身不依赖 Helper API；入口需要 document/body、宿主 context/eventSource、IndexedDB 及 guide host 已列出的能力。visualViewport 不存在时使用 innerHeight 回退，不声明手机兼容已通过。

## 单实例与失败边界

`globalThis.MVUGuidance` 只公开指导版本、就绪/失败状态、只读 snapshot/record、明确动作及销毁；加载时仅 bind 恢复已有记录。旧 `MVUDoctorApp/Modular/Profiles/World`、旧 ReferenceBaseline/ProfileEngine 的已挂载实例构成冲突：显示未启动，保留旧实例原状，不调用其关闭、修复或设置接口。界面缺能力或初始化失败时，入口仍显示可读失败说明和安全错误码，不回显异常原文。

默认界面不显示幕后摘要、私密事实或诊断细节；用户展开幕后区才读取展示这些产品记录。诊断只列安全状态/计数/读回标记，不显示凭据、连接配置、完整提示或原始模型返回。模型认为“已在正文出现”的条目仍标为模型核对，不伪装成人工验收。

## 验证边界

本地可检查语法、单实例、零启动请求、按钮/折叠/转义、关闭与销毁、窄屏布局。真实入口可见、主生成中状态更新、存档恢复和实际重算仍需根任务在当前候选中验证。此文件不宣称通过 P1 或 P2 真实门。

本轮 `node --check guide/entry.js`、`node --check guide/surface.mjs` 已通过。隔离 headless Edge 的浏览器检查在 Windows 沙箱临时 profile 初始化时退出，尚未载入指导，因此没有 UI 通过证据，也没有模型调用。未将环境启动失败算成产品失败或通过，后续仍需当前目标宿主检查。
# 真实宿主遮挡修正

P1 在真实宿主截图中发现面板顶部被工具栏盖住。只读测得宿主 #top-bar 的 z-index 为 3005，而指导根为1500；原几何检查不能覆盖遮挡。重新搜索并完整阅读旧 style.css 的 mvu-ref-launcher/panel/header/viewport 链，沿用旧面板100021层级，仅提高本扩展根，不改宿主工具栏。复核须加入标题实际命中检查与面板截图，不只检查矩形在视口内。
