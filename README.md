# MVU 人物与世界医生（Kemini Clean 0.9.3）

0.9.3 针对真实试跑中“原版 World 单独稳定、接入 Doctor 后却少展示或互相超时”的根因做减法：冻结的 World Engine 3.0.2 仍保持逐字节不变；没有助手尾楼的原生 forward、redo 与手动时间推进不再被不存在的变量诊断拦住；事件和风声重新交给原版等级规则筛选，高等级进行中事件不再被 Doctor 错删，风声的主题与传播来源也会保留；人物填表与 World/Memory 共用的 API 只增加一个 FIFO 请求通道，避免两个引擎同时抢同一连接，但不接管任一引擎的调度、失败或存档。

0.9.2 修复真实 390×844 酒馆视口暴露的控制台裁切：五个标签在手机上改为 3+2 响应式网格，保留不小于 44px 的触控目标并消除标签栏横向滚动；验收脚本也只检查 Doctor 自己的面板，并实际滚动到总览末端确认操作可达，不再把宿主页面宽度或隐藏页按钮误判成 Doctor 失败。变量、人物和原生 World 运行逻辑均未改动。

0.9.1 修复真实首回合暴露的变量漏判：Story Oracle 原件的 post-state 诊断只看“当前结果是否已出现”，无法稳定识别“正确增量应用在错误旧默认值上”。Doctor 现在最小移植旧 Clean 0.7.5 与正式医生的成熟取证顺序，把上一有效 MVU、当前 post-state、原更新块、触发用户输入和最终接受正文作为紧邻任务的闭环材料；仍由 Story Oracle 原件负责规则、模型调用与区块提取，由官方 MVU 负责解析、写入和同楼读回。空补丁只显示为“模型未提出有效修复”，不再冒充脚本已经证明变量绝对正确。

0.9.0 修正 0.8.x 最根本的整合错误：仓库虽然逐字节内置了 World Engine 3.0.2，却在外层关闭原生自动生命周期，再另造世界调度、重 roll、提交收据和全量上下文桥。现在这些接管已经删除，World 的事件监听、节拍、提示、宽容解析、重试、存档、checkpoint、重 roll、注入、设置和完整界面重新由原件拥有。Doctor 只在原生 `evolve` 真正开始前等待同楼变量诊断进入终态；诊断失败不会拦截 World，人物阶段也完全不是 World 的前置条件。

## 当前运行关系

每条主聊天最终回复仍由 Doctor 经过两次新鲜读取并确认聊天、楼层、swipe 与正文身份，然后只执行自己拥有的两步：

1. 复用 Story Oracle v1.35.4 诊断组件的固定楼层适配链复检并按需修复本楼 MVU；
2. 采用 ver5.35 宽容解析与单次定向修复模式的人物填表生成或更新完整档案。

Disnight World Engine v3.0.2 仍由自己的宿主事件、scheduler 和原生 `evolve` 推进。有真实助手正文时，适配层只让这次原生 `evolve` 等到同楼变量诊断成功或失败的终态，随后立即交回原件；用户尾楼或手动时间推进没有助手诊断对象时则直接沿用原生行为。人物补档不是 World 的前置条件，二者只在共享的 API 网络边界按请求 FIFO 串行，任何一方失败都不成为另一方的结果。World 失败不会被 Doctor 伪装成变量或档案失败。刷新会恢复 Doctor 已完成的人物票据或未完成检查点；用户取消只取消 Doctor 自己的任务，不误杀原版 World。

## 成熟原件与适配边界

- `vendor/story-oracle-v1.35.4/`：固定上游提交的逐字节快照。复用原提示、调用、补丁提取、MVU 解析/写入和原生界面；适配层只关闭重复自动调度并把目标钉到本次接受楼层。
- `vendor/world-engine-v3.0.2/`：固定上游 45 个文件的逐字节快照。世界状态、提示、推演、重 roll、存档、诊断、API、设置与原生界面保持原件所有权。快照外的适配层只维护两条 Story Oracle `UpdateVariable` 对话清理合同、让原生 `evolve` 等待同楼变量诊断终态、以每聊天单 Promise 完成首次世界书选择，并在传给原生 `buildContext` 与 `MEMORY_ENGINE.ingestWorldEvolution` 的副本中建立可观察投影；后台持久状态和下一轮世界推演始终保留完整 World。
- `vendor/life-state-v5.35/`：保留用户提供的两份原始 JSON 与逐字提取脚本。人物档案复用其宽容 JSON 提取和“原结果一次、定向修复最多一次”方式。
- `profile-engine.js`：只实现 Story 变量复检与人物档案之间确实不存在的宿主胶水，包括最终回复身份、人物档案 Schema/原子提交、恢复收据、完整报告与响应式控制台；World 页只读显示原件状态并可打开原版完整面板。

逐文件来源、哈希和改动类型见 [`docs/0.8.0-REFERENCE-TRANSPLANT-SOURCE-MAP.md`](docs/0.8.0-REFERENCE-TRANSPLANT-SOURCE-MAP.md)。0.9.0 恢复原生 World 所有权的逐项删除与最小适配见 [`docs/0.9.0-NATIVE-WORLD-OWNERSHIP-SOURCE-MAP.md`](docs/0.9.0-NATIVE-WORLD-OWNERSHIP-SOURCE-MAP.md)；0.9.1 变量闭环取证见 [`docs/0.9.1-VARIABLE-EVIDENCE-SOURCE-MAP.md`](docs/0.9.1-VARIABLE-EVIDENCE-SOURCE-MAP.md)；0.9.2 移动端布局与验收边界见 [`docs/0.9.2-MOBILE-LAYOUT-SOURCE-MAP.md`](docs/0.9.2-MOBILE-LAYOUT-SOURCE-MAP.md)；0.9.3 的原生手动路径、公开等级筛选和共享 API 顺序点见 [`docs/0.9.3-MATURE-WORLD-ADAPTER-SOURCE-MAP.md`](docs/0.9.3-MATURE-WORLD-ADAPTER-SOURCE-MAP.md)。冻结原件可分别运行：

0.8.1 的真实宿主生命周期根修及直接复用边界见 [`docs/0.8.1-LIFECYCLE-SOURCE-MAP.md`](docs/0.8.1-LIFECYCLE-SOURCE-MAP.md)；0.8.2 的 Story Oracle no-op 语义回归见 [`docs/0.8.2-STORY-NOOP-SOURCE-MAP.md`](docs/0.8.2-STORY-NOOP-SOURCE-MAP.md)；0.8.3 的人物发现边界见 [`docs/0.8.3-PROFILE-DISCOVERY-SOURCE-MAP.md`](docs/0.8.3-PROFILE-DISCOVERY-SOURCE-MAP.md)；0.8.4 的档案占位词补填修复见 [`docs/0.8.4-PROFILE-PLACEHOLDER-SOURCE-MAP.md`](docs/0.8.4-PROFILE-PLACEHOLDER-SOURCE-MAP.md)；0.8.5 的 Story Oracle 运输错误恢复见 [`docs/0.8.5-STORY-TRANSPORT-RECOVERY-SOURCE-MAP.md`](docs/0.8.5-STORY-TRANSPORT-RECOVERY-SOURCE-MAP.md)；0.8.6 的人物发现、恢复收据与报告真实落盘见 [`docs/0.8.6-PROFILE-DISCOVERY-AND-DURABLE-REPORTS-SOURCE-MAP.md`](docs/0.8.6-PROFILE-DISCOVERY-AND-DURABLE-REPORTS-SOURCE-MAP.md)；0.8.7 的数据库来源行绑定与失败证据修复见 [`docs/0.8.7-DATABASE-ROW-BINDING-SOURCE-MAP.md`](docs/0.8.7-DATABASE-ROW-BINDING-SOURCE-MAP.md)；0.8.8 的占位词边界根修见 [`docs/0.8.8-PROFILE-PLACEHOLDER-BOUNDARY-SOURCE-MAP.md`](docs/0.8.8-PROFILE-PLACEHOLDER-BOUNDARY-SOURCE-MAP.md)；0.8.9 的人物发现称谓绑定修复见 [`docs/0.8.9-PROFILE-DISCOVERY-BINDING-SOURCE-MAP.md`](docs/0.8.9-PROFILE-DISCOVERY-BINDING-SOURCE-MAP.md)。

```bash
npm run verify:vendor
```

## 人物档案

正文只负责提供本轮可见事实，不要求两千字正文写齐档案。角色卡、世界书、已有档案、MVU 与正文确定不能冲突的事实；缺失的外貌、经历、欲望、习惯、关系方式、弱点和生理信息由模型合理补全，并记录为后续可修订推断。

修复后的 MVU 人物容器、正文 `JSONPatch` 人物路径、结构化人物标签、既有档案命中和稳定 NPC/ACTOR 编号组成必覆盖候选。每个最终正文先执行一次只返回姓名/稳定称谓的轻量发现；发现名必须能在本楼正文或本楼结构证据中落地，不能把整份 MVU 的远方库存人物带进当前补档。完整填表使用数据库式目标行：脚本固定 `rowId/sourceName`，AI补齐档案内容；正文只给出“引导者”一类稳定称谓时，称谓继续作为身份主键，AI创造的姓名保存为可修订别名。多人物只按行键绑定，不按返回顺序或相似名字猜配。待处理人数超过当前输出上限的安全容量时会分批填表；初答与单次格式修复都不得夹带延后人物或用别名吞掉后续批次。全部批次在内存汇总，最后仍只做一次原子提交；任一批失败都不留下半张档案。刷新命中同一精确提交收据时才会 0 次模型调用直接恢复人物阶段。

人物性格随机、多样性、篇幅、文风、视角和玩家边界仍由配对的 Izumi 预设在正文生成前负责，Doctor 不在正文后重新掷人格。用户的私有预设没有进入本仓库。

## 世界后台与防全知

World Engine 的持久状态和原生推演始终保留完整数据，并继续接收原件自己的世界状态、相关世界书、原生 Memory Engine 有界上下文、最近对话和原生 `tonePrompt`；Doctor 不再强塞全部人物档案或整份 MVU。最近对话进入原生世界提示前，World 自己的 `evolveFilterRegex` 必须完整清理闭合和被截断的 Story Oracle `<UpdateVariable>` 机制块。适配层每次启动先移除两条项目规则的精确重复项，再只用剩余用户规则运行含 JSONPatch 内外唯一 payload 的完整探针：闭合块必须只剩“前文后文”，截断块必须只剩“前文”。两项都精确通过就保留用户规则且不重复项目规则；任一不完整就把“闭合后截断”两条项目规则按固定顺序置于最前，再接回全部用户规则。这样既防止宽泛的删标签规则先破坏块边界，也不会在反复启动后膨胀规则列表。

迁移完成后，适配层在快照之外包装原生 `WORLD_ENGINE_CORE.filterDialogue`：进入原函数前先用同两条成熟规则清理一次，原函数继续按原顺序执行用户其余过滤规则，返回后再无条件清理一次。因而原生普通自动推进、手动推进与批量回填只要经过 `filterDialogue` 都受同一完整块合同保护；即使用户在同一次会话里通过原版 UI 删除持久 `evolveFilterRegex`，当前运行期也不会重新把 MVU 机制块送进 World。这个包装不改持久设置、vendor 字节、原生 scheduler、模式或时序。

`WORLD_ENGINE_EVOLUTION.evolve` 入口另保留直接 API 防线：在等待诊断和调用原函数前，只清理本次 `aiMsg` 与 `opts.dialogueText` 的内存副本，覆盖绕开 Core 对话过滤器的直接调用；它不是第二个调度器。只有原始 `aiMsg` 确有助手正文时才等待变量诊断；原始 `aiMsg` 为空说明原生手动路径没有可诊断助手楼，直接交还原件。判断使用过滤前的原文，因此“只有 MVU 机制块的助手回复”仍会进入身份门。原生 `evolve` 不等待人物阶段；并发手动复检会建立同 generationKey 的 `manualDiagnosisBinding` 与单调 token，只有仍持有当前 token 的复检才能在 `finally` 清理绑定，旧复检结束不能误删后来开始的新绑定。

World、Memory 与人物档案都会调用同一个 `WORLD_ENGINE_API.callApi`，但原版 World 的内部互斥并不知道外部人物任务。0.9.3 只在这个共享网络函数上包一条 FIFO 请求通道：参数和返回值原样透传、开始前尊重 AbortSignal、失败或取消后继续下一项。它不决定 World 与人物谁先入队，不复制 World 的 1500ms、auto/time/manual 判定，也不串联整个档案事务，因此没有第二套世界调度器。

旧设置迁移只处理 Doctor 0.8.x 的精确签名。World 使用 `mvu_doctor_native_world_owner_v1`：尚未完成且同时命中 `manual/engineEnabled=true/injectIntoPrompt=true/syncToChat=true/autoBackup=true` 五字段时，才恢复为 `auto/syncToChat=false/autoBackup=false`。Memory 使用独立的 `mvu_doctor_native_memory_owner_v1`：在改变 World 签名前先写入 `pending` 保存旧 Doctor 来源证明；即使当时 Memory 接口未就绪，后续启动仍会重试。只有精确 `engineEnabled=false/evolveMode=manual` 成功恢复并读回上游 `true/auto`，或确认当前 Memory 已经不是这对旧强制值时，Memory 标记才写成 `done`。用户偏差不会被覆盖。

内嵌世界书也有可见的首次运行状态：聊天加载先以每 chat 单 Promise 预热；如果它在世界书可读取前以未就绪结束，首次原生 `evolve` 会清掉该已完成 Promise，再执行第二次 single-flight 重试。预热期间显示等待，首次推演后明确为已就绪、缺失或错误；当前状态显示在 Doctor 世界页并写入完整报告。缺失/错误时 World 按原生空选择语义继续，但不会把它伪装成已经加载成功。

发送给下一轮正文模型的原生 `buildContext` 使用深拷贝的可观察投影：隐藏 `worldDigest` 后台摘要、势力的 `currentGoal`/`core_person`/`powerPillars`、整个 `enemies`、`influenceChain` 与完整 `blackbox`；事件和风声则不再由 Doctor 自创门槛，而由 World 3.0.2 的原生规则筛选——默认保留 Lv3/4 进行中事件及所有已爆发/已完成事件，风声默认保留 Lv3/4，并尊重用户的“全部等级”设置。公开风声保留 `topic/source`，便于维持真实传播链。趋势、经济、声誉和区域事件继续使用可观察字段。仅存在于黑盒、敌人状态、势力秘密目标或影响链中的内容仍不能被正文模型提前知道。

同一防全知边界也覆盖原生 World→Memory 联动。适配层包装 `MEMORY_ENGINE.ingestWorldEvolution`，只把上述公开字段副本和由这些字段按固定顺序生成的确定性 `worldDigest` 交给原函数；事件与风声逐字复用原版同一等级判断，`layer`、`worldRound`、`replace`、`force` 等原生参数保持原样。若本轮只有后台秘密而没有公开变化，摘要保持为空：原生 Memory 在 `replace: true` 时仍先回滚同楼旧联动，再按 `empty_digest` 跳过，不会新增一条伪造的“无变化”纪要。完整 World、checkpoint 和下一轮推演输入均不被删改。

世界状态仍只属于 World Engine。数据库继续由数据库本体独立填表，MVU 继续拥有实时变量，预设继续负责正文生成；Doctor 人物档案使用 World Engine 3.0.2 已有的 IndexedDB 存储层，但按 chatId 独立键保存，不写入世界状态，也不与数据库表格竞争。旧聊天 metadata 只作一次迁移来源；四者没有合并或互相冒充成功。

## 控制台

右下角 `✦` 打开统一控制台：

- 总览：阶段、完整/异常档案数、世界轮次与连接状态；
- 人物：自动刷新并展示完整档案；
- 世界：自动刷新原件世界状态，并显示本聊天世界书桥接的等待/已就绪/缺失/错误状态；
- 连接：人物档案/World API、全局模型适配附加提示词与 Doctor 两个阶段开关；Story Oracle 保留自己的独立连接；
- 诊断：最近状态与运行结果；
- 操作：精确失败重试、手动 MVU 复检、人物补档、打开原版 World 面板、取消 Doctor 任务，以及排除全部 API 配置的当前聊天完整报告。

人物档案、完整报告和诊断统一复用 World Engine 3.0.2 的大容量存储层，并等待 IndexedDB 写事务完成及只读事务读回后才显示完整；酒馆自身 `saveMetadata` 会吞掉保存错误且只能操作当前全局聊天，因此不再作为人物档案成功依据。旧版人物 metadata 与当前聊天的 `sessionStorage` 报告会完整复制迁移，原副本暂留作兼容回退，不裁剪字段或历史。完整报告同时记录导出时的 `worldbookBridge` 状态，便于区分“仍在等待”“World 使用空世界书选择”和真正已加载。医生仍在运行时会拒绝本次导出并明确要求任务结束后再次点击，不会下载半份“完整报告”；缺页时总览、按钮和导出文件都会明确显示“不完整”，不会用内存镜像冒充落盘成功。

桌面面板限制在视口内；手机直接使用 `visualViewport` 的真实动态高度与顶部偏移（包括键盘后不足 240px 的狭小可视区）、四边安全区、3+2 标签网格和不小于 44px 的触控目标。设置草稿在标签切换、关闭重开和聊天切换时保留；人物完整 JSON 仅在展开时生成，诊断页只重绘摘要。

## 安装与更新

在 SillyTavern/TauriTavern 的扩展安装器中填写：

```text
https://github.com/magilittle0-byte/mvu-doctor-kemini-clean
```

安装后在控制台“连接”页填写人物档案/World 使用的 API 地址、模型和密钥；变量医生的连接在 Story Oracle 原版设置中管理。API 配置不会写入仓库或完整报告。扩展 manifest 已启用自动更新。

## 验证状态

快速验证命令：

```bash
npm run check
```

它会检查语法、三套冻结原件哈希、静态合同及无头浏览器中的桌面/手机、变量修复、完整补档、World 原生所有权、刷新恢复、取消和报告脱敏路径。

这些检查不是正式酒馆验收。任何运行代码或提示变化都会使旧真实证据失效；只有当前源码指纹在真实 TauriTavern/SillyTavern、当前模型、当前角色卡、当前 Izumi 预设、内嵌世界书、数据库、缝合怪与 MVU 同时启用的连续十二个有效回合全部通过后，才能声称正式可用。
