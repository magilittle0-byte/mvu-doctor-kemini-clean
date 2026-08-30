# MVU 人物与世界医生（Kemini Clean 0.8.9）

0.8.9 保留 0.8.8 的数据库来源行绑定、人物发现、分批完整填表和原子存储链，只修复真实酒馆功能试跑第 2 回合暴露的人物发现绑定缺口：发现模型若把正文称谓擅自改成正文没有出现的真名，不再静默丢弃后直接失败，而是复用 ver5.35 的“候选结果 + 校验错误 + 单次修复”流程，要求模型改回正文逐字出现的稳定称谓，再进入原有来源行填表。修复仍失败时保持原子失败，不写半张档案，也不推进世界。

## 当前唯一主链

每条主聊天最终回复在 `GENERATION_ENDED` 后经过两次新鲜读取并确认聊天、楼层、swipe 与正文身份，再严格串行执行：

1. 复用 Story Oracle v1.35.4 诊断组件的固定楼层适配链复检并按需修复本楼 MVU；
2. 采用 ver5.35 宽容解析与单次定向修复模式的人物填表生成或更新完整档案；
3. Disnight World Engine v3.0.2 推进一次私密后台世界。

任一阶段失败都会停止后续阶段并保存精确重试点。刷新会恢复已完成事件票据或未完成检查点；用户取消会保存取消墓碑，不会刷新后复活。Doctor 自己修复正文中的变量块时会保留同一世界推进收据，手动复检不会让同一楼重复推进世界。

## 成熟原件与适配边界

- `vendor/story-oracle-v1.35.4/`：固定上游提交的逐字节快照。复用原提示、调用、补丁提取、MVU 解析/写入和原生界面；适配层只关闭重复自动调度并把目标钉到本次接受楼层。
- `vendor/world-engine-v3.0.2/`：固定上游 45 个文件的逐字节快照。世界状态、提示、推演、重 roll、存档、诊断和原生界面保持原件所有权；适配层只改为串行手动触发、追加 Doctor 私密人物/MVU 上下文，并在正文注入边界删除 `blackbox` 私密行为与资产。
- `vendor/life-state-v5.35/`：保留用户提供的两份原始 JSON 与逐字提取脚本。人物档案复用其宽容 JSON 提取和“原结果一次、定向修复最多一次”方式。
- `profile-engine.js`：只实现三套原件之间确实不存在的宿主胶水，包括最终回复身份、串行顺序、人物档案 Schema/原子提交、恢复收据、共用连接页、完整报告与响应式控制台。

逐文件来源、哈希和改动类型见 [`docs/0.8.0-REFERENCE-TRANSPLANT-SOURCE-MAP.md`](docs/0.8.0-REFERENCE-TRANSPLANT-SOURCE-MAP.md)。冻结原件可分别运行：

0.8.1 的真实宿主生命周期根修及直接复用边界见 [`docs/0.8.1-LIFECYCLE-SOURCE-MAP.md`](docs/0.8.1-LIFECYCLE-SOURCE-MAP.md)；0.8.2 的 Story Oracle no-op 语义回归见 [`docs/0.8.2-STORY-NOOP-SOURCE-MAP.md`](docs/0.8.2-STORY-NOOP-SOURCE-MAP.md)；0.8.3 的人物发现边界见 [`docs/0.8.3-PROFILE-DISCOVERY-SOURCE-MAP.md`](docs/0.8.3-PROFILE-DISCOVERY-SOURCE-MAP.md)；0.8.4 的档案占位词补填修复见 [`docs/0.8.4-PROFILE-PLACEHOLDER-SOURCE-MAP.md`](docs/0.8.4-PROFILE-PLACEHOLDER-SOURCE-MAP.md)；0.8.5 的 Story Oracle 运输错误恢复见 [`docs/0.8.5-STORY-TRANSPORT-RECOVERY-SOURCE-MAP.md`](docs/0.8.5-STORY-TRANSPORT-RECOVERY-SOURCE-MAP.md)；0.8.6 的人物发现、恢复收据与报告真实落盘见 [`docs/0.8.6-PROFILE-DISCOVERY-AND-DURABLE-REPORTS-SOURCE-MAP.md`](docs/0.8.6-PROFILE-DISCOVERY-AND-DURABLE-REPORTS-SOURCE-MAP.md)；0.8.7 的数据库来源行绑定与失败证据修复见 [`docs/0.8.7-DATABASE-ROW-BINDING-SOURCE-MAP.md`](docs/0.8.7-DATABASE-ROW-BINDING-SOURCE-MAP.md)；0.8.8 的占位词边界根修见 [`docs/0.8.8-PROFILE-PLACEHOLDER-BOUNDARY-SOURCE-MAP.md`](docs/0.8.8-PROFILE-PLACEHOLDER-BOUNDARY-SOURCE-MAP.md)；0.8.9 的人物发现称谓绑定修复见 [`docs/0.8.9-PROFILE-DISCOVERY-BINDING-SOURCE-MAP.md`](docs/0.8.9-PROFILE-DISCOVERY-BINDING-SOURCE-MAP.md)。

```bash
npm run verify:vendor
```

## 人物档案

正文只负责提供本轮可见事实，不要求两千字正文写齐档案。角色卡、世界书、已有档案、MVU 与正文确定不能冲突的事实；缺失的外貌、经历、欲望、习惯、关系方式、弱点和生理信息由模型合理补全，并记录为后续可修订推断。

修复后的 MVU 人物容器、正文 `JSONPatch` 人物路径、结构化人物标签、既有档案命中和稳定 NPC/ACTOR 编号组成必覆盖候选。每个最终正文先执行一次只返回姓名/稳定称谓的轻量发现；发现名必须能在本楼正文或本楼结构证据中落地，不能把整份 MVU 的远方库存人物带进当前补档。完整填表使用数据库式目标行：脚本固定 `rowId/sourceName`，AI补齐档案内容；正文只给出“引导者”一类稳定称谓时，称谓继续作为身份主键，AI创造的姓名保存为可修订别名。多人物只按行键绑定，不按返回顺序或相似名字猜配。待处理人数超过当前输出上限的安全容量时会分批填表；初答与单次格式修复都不得夹带延后人物或用别名吞掉后续批次。全部批次在内存汇总，最后仍只做一次原子提交；任一批失败都不留下半张档案。刷新命中同一精确提交收据时才会 0 次模型调用直接恢复到世界阶段。

人物性格随机、多样性、篇幅、文风、视角和玩家边界仍由配对的 Izumi 预设在正文生成前负责，Doctor 不在正文后重新掷人格。用户的私有预设没有进入本仓库。

## 世界后台与防全知

World Engine 接收完整人物档案、修复后的 MVU 和原件世界上下文，在后台记录和推进人物、势力、环境、社会过程与事件。后台保留完整 `blackbox`，但正文注入只读取其公开投影，`secretActions` 与 `secretAssets` 在调用原件注入器前被清空；私密动机与镜头外行动不会仅靠一句提示词留给正文模型自行保密。

世界状态仍只属于 World Engine。数据库继续由数据库本体独立填表，MVU 继续拥有实时变量，预设继续负责正文生成；Doctor 人物档案使用 World Engine 3.0.2 已有的 IndexedDB 存储层，但按 chatId 独立键保存，不写入世界状态，也不与数据库表格竞争。旧聊天 metadata 只作一次迁移来源；四者没有合并或互相冒充成功。

## 控制台

右下角 `✦` 打开统一控制台：

- 总览：阶段、完整/异常档案数、世界轮次与连接状态；
- 人物：自动刷新并展示完整档案；
- 世界：自动刷新原件世界状态；
- 连接：共用 API、全局模型适配附加提示词与三个阶段开关；
- 诊断：最近状态与运行结果；
- 操作：精确失败重试、手动 MVU 复检、人物补档、世界重试、真正取消，以及排除全部 API 配置的当前聊天完整报告。

人物档案、完整报告和诊断统一复用 World Engine 3.0.2 的大容量存储层，并等待 IndexedDB 写事务完成及只读事务读回后才显示完整；酒馆自身 `saveMetadata` 会吞掉保存错误且只能操作当前全局聊天，因此不再作为人物档案成功依据。旧版人物 metadata 与当前聊天的 `sessionStorage` 报告会完整复制迁移，原副本暂留作兼容回退，不裁剪字段或历史。医生仍在运行时会拒绝本次导出并明确要求任务结束后再次点击，不会下载半份“完整报告”；缺页时总览、按钮和导出文件都会明确显示“不完整”，不会用内存镜像冒充落盘成功。

桌面面板限制在视口内；手机直接使用 `visualViewport` 的真实动态高度与顶部偏移（包括键盘后不足 240px 的狭小可视区）、四边安全区、横向标签和不小于 44px 的触控目标。设置草稿在标签切换、关闭重开和聊天切换时保留；人物完整 JSON 仅在展开时生成，诊断页只重绘摘要。

## 安装与更新

在 SillyTavern/TauriTavern 的扩展安装器中填写：

```text
https://github.com/magilittle0-byte/mvu-doctor-kemini-clean
```

安装后在控制台“连接”页填写 API 地址、模型和密钥；API 配置不会写入仓库或完整报告。扩展 manifest 已启用自动更新。

## 验证状态

快速验证命令：

```bash
npm run check
```

它会检查语法、三套冻结原件哈希、静态合同及无头浏览器中的桌面/手机、变量修复、完整补档、世界幂等、刷新恢复、取消和报告脱敏路径。

这些检查不是正式酒馆验收。任何运行代码或提示变化都会使旧真实证据失效；只有当前源码指纹在真实 TauriTavern/SillyTavern、当前模型、当前角色卡、当前 Izumi 预设、内嵌世界书、数据库、缝合怪与 MVU 同时启用的连续十二个有效回合全部通过后，才能声称正式可用。
