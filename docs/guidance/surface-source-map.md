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

## candidate.3：关闭键冲突与窄屏避让的 2A 回查

candidate.2 真实主生成期间，在指导面板关闭按钮上按 Escape 后，宿主同时发出 GENERATION_STOPPED；指导调用数为 0，该轮作废，不能用来检验模型返回修复。再次检索当前界面、旧 app 界面、宿主键盘链、旧论坛/故事神域的捕获与清理用法及浏览器隔离检查。完整读取当前 surface/style、旧 app 的打开/关闭/清理链与宿主 `script.js` 的整个 document keydown 回调：工作区参考 `real-sillytavern-qc/app/public/script.js:12266-12288`，父代理也已只读核对当前 1.18.0 源码。宿主在冒泡阶段处理 Escape 并触发停止按钮；旧 `app/surface.mjs:176` 只有关闭面板，同样不能防止宿主先执行，不能照搬。

最小适配：指导的 document keydown 改在捕获阶段，只在本面板打开、非输入法组合的 Escape 上 preventDefault/stopPropagation 后关闭；其他键、面板关闭时和销毁后交回宿主。监听帮助函数保存相同 capture 选项用于 removeEventListener。不改变宿主键盘处理器，不关闭生成，也不新建快捷键管理器。

当前 390px 宽现场还存在约 60px 的宿主悬浮圆按钮，工具栏高约 34.5px。保留已选择的根层级 100021，窄屏面板顶部改为可见视口上沿加 72px，同时把最大高度扣除顶部空间和底部 8px；不继续抬高层级。需要根任务复核真实命中和键盘视口，隔离 DOM 回归不等于宿主视觉通过。

`tests/guidance-surface.test.mjs` 使用真实隔离 Chromium DOM、当前 surface 源码和事先注册的模拟宿主冒泡 Escape 停止处理器。覆盖打开时关闭但不停止生成、其他键传递、关闭后恢复传递、销毁后无捕获监听残留；不连接真实酒馆、不调用模型。

本次隔离 Chrome 回归已通过（1/1，约 5.7 秒），`node --check guide/surface.mjs` 通过。检查也确认输入法组合 Escape 不关闭面板且不阻止传播，正常 Escape 的默认动作被取消，390×720 下顶部留出 72px、底部至少留出 8px；销毁发生在面板仍打开时，因此不会被已隐藏状态掩盖遗留监听。它只证明独立 DOM 的事件传播与当前 CSS 几何，尚不能证明当前酒馆无遮挡或模型链恢复；真实复核由根任务在空闲时完成。

## candidate.6：准确显示存档确认阶段

真实 candidate.5 在正文已结束而原生保存尚未完成时拒收；修正后 runtime 将用 accepting 表示严格读回确认。重新检索并完整核对当前 surface 的 STATUS/render/act/retryButton、runtime notify/finish/retry 上下游，以及 app/surface 的 LABELS/statusLabel 与 world/surface 状态字典。沿用现有状态字典和按钮禁用名单，仅增加“确认正文存档”与 accepting 禁止重复重算；不新增调度器、面板或模型动作。用户仍可继续发正文或关闭自动推进。既有隔离界面回归补检查这个等待标签和重算禁用，不能把它当成真实保存完成证据。