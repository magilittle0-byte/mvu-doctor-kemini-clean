# MVU 人物与世界医生（Kemini Clean 0.8.5）

0.8.5 延续从运行入口重建的 0.8.0 基线，保留 0.8.1—0.8.4 已验证的生命周期、Story Oracle no-op、人物发现和完整档案补填边界；新增 Story Oracle 后端转发错误回执识别：只有明确的运输错误信封或 HTTP 4xx/5xx 状态回执才按原请求自动重试一次，普通无补丁文本仍然失败，绝不冒充变量正确。旧 Doctor 不再参与运行，只以快照保存在 `legacy/0.7.5/`；当前 `manifest.json` 只加载 `index.js` 与 `style.css`，`index.js` 不导入旧核心。

## 当前唯一主链

每条主聊天最终回复在 `GENERATION_ENDED` 后经过两次新鲜读取并确认聊天、楼层、swipe 与正文身份，再严格串行执行：

1. Story Oracle v1.35.4 复检并按需修复本楼 MVU；
2. ver5.35 式宽容填表事务生成或更新完整人物档案；
3. Disnight World Engine v3.0.2 推进一次私密后台世界。

任一阶段失败都会停止后续阶段并保存精确重试点。刷新会恢复已完成事件票据或未完成检查点；用户取消会保存取消墓碑，不会刷新后复活。Doctor 自己修复正文中的变量块时会保留同一世界推进收据，手动复检不会让同一楼重复推进世界。

## 成熟原件与适配边界

- `vendor/story-oracle-v1.35.4/`：固定上游提交的逐字节快照。复用原提示、调用、补丁提取、MVU 解析/写入和原生界面；适配层只关闭重复自动调度并把目标钉到本次接受楼层。
- `vendor/world-engine-v3.0.2/`：固定上游 45 个文件的逐字节快照。世界状态、提示、推演、重 roll、存档、诊断和原生界面保持原件所有权；适配层只改为串行手动触发、追加 Doctor 私密人物/MVU 上下文，并在正文注入边界删除 `blackbox` 私密行为与资产。
- `vendor/life-state-v5.35/`：保留用户提供的两份原始 JSON 与逐字提取脚本。人物档案复用其宽容 JSON 提取和“原结果一次、定向修复最多一次”方式。
- `profile-engine.js`：只实现三套原件之间确实不存在的宿主胶水，包括最终回复身份、串行顺序、人物档案 Schema/原子提交、恢复收据、共用连接页、完整报告与响应式控制台。

逐文件来源、哈希和改动类型见 [`docs/0.8.0-REFERENCE-TRANSPLANT-SOURCE-MAP.md`](docs/0.8.0-REFERENCE-TRANSPLANT-SOURCE-MAP.md)。冻结原件可分别运行：

0.8.1 的真实宿主生命周期根修及直接复用边界见 [`docs/0.8.1-LIFECYCLE-SOURCE-MAP.md`](docs/0.8.1-LIFECYCLE-SOURCE-MAP.md)；0.8.2 的 Story Oracle no-op 语义回归见 [`docs/0.8.2-STORY-NOOP-SOURCE-MAP.md`](docs/0.8.2-STORY-NOOP-SOURCE-MAP.md)；0.8.3 的人物发现边界见 [`docs/0.8.3-PROFILE-DISCOVERY-SOURCE-MAP.md`](docs/0.8.3-PROFILE-DISCOVERY-SOURCE-MAP.md)；0.8.4 的档案占位词补填修复见 [`docs/0.8.4-PROFILE-PLACEHOLDER-SOURCE-MAP.md`](docs/0.8.4-PROFILE-PLACEHOLDER-SOURCE-MAP.md)；0.8.5 的 Story Oracle 运输错误恢复见 [`docs/0.8.5-STORY-TRANSPORT-RECOVERY-SOURCE-MAP.md`](docs/0.8.5-STORY-TRANSPORT-RECOVERY-SOURCE-MAP.md)。

```bash
npm run verify:vendor
```

## 人物档案

正文只负责提供本轮可见事实，不要求两千字正文写齐档案。角色卡、世界书、已有档案、MVU 与正文确定不能冲突的事实；缺失的外貌、经历、欲望、习惯、关系方式、弱点和生理信息由模型合理补全，并记录为后续可修订推断。

明确姓名、对白标签、行动主体、角色卡名和稳定称谓都会进入必覆盖候选。空档案至少经过一次定向复核；整张档案完整解析、宿主持久化并完整读回后才算提交，失败不留下半张档案。

人物性格随机、多样性、篇幅、文风、视角和玩家边界仍由配对的 Izumi 预设在正文生成前负责，Doctor 不在正文后重新掷人格。用户的私有预设没有进入本仓库。

## 世界后台与防全知

World Engine 接收完整人物档案、修复后的 MVU 和原件世界上下文，在后台记录和推进人物、势力、环境、社会过程与事件。后台保留完整 `blackbox`，但正文注入只读取其公开投影，`secretActions` 与 `secretAssets` 在调用原件注入器前被清空；私密动机与镜头外行动不会仅靠一句提示词留给正文模型自行保密。

世界状态仍只属于 World Engine。数据库继续由数据库本体独立填表，MVU 继续拥有实时变量，预设继续负责正文生成，Doctor 人物档案只存于当前聊天 metadata；四者没有合并或互相冒充成功。

## 控制台

右下角 `✦` 打开统一控制台：

- 总览：阶段、完整/异常档案数、世界轮次与连接状态；
- 人物：自动刷新并展示完整档案；
- 世界：自动刷新原件世界状态；
- 连接：共用 API、全局模型适配附加提示词与三个阶段开关；
- 诊断：最近状态与运行结果；
- 操作：精确失败重试、手动 MVU 复检、人物补档、世界重试、真正取消，以及排除全部 API 配置的当前聊天完整报告。

桌面面板限制在视口内；手机使用动态视口、四边安全区、横向标签和不小于 44px 的触控目标。设置输入期间后台刷新不会覆盖未保存内容。

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
