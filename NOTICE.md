# 来源与适配说明

0.8.0 是“先完整移植、再最小适配”的重建基线，不再把旧 Doctor 描述为成熟实现。

- `vendor/story-oracle-v1.35.4/`：Story Oracle v1.35.4 的完整运行文件，固定上游提交 `661f9f89446de473ace70a590897ca5065bc2efe`。`verify-copy.sh` 会逐文件验证其原始字节。
- `vendor/world-engine-v3.0.2/`：World Engine v3.0.2 的完整上游快照，固定提交 `154de4b590378cd0bd851cfffcefd3d96741cf3f`。来源哈希与比对报告随快照保存。
- `vendor/life-state-v5.35/`：用户提供的角色生理状态引擎 ver5.35 脚本 JSON、双正则 JSON及逐字节提取的脚本内容；`PROVENANCE.json` 和验证脚本记录三份 SHA-256。
- `legacy/0.7.5/`：重建前旧 Doctor 的只读历史快照。根目录 0.8.9 运行时不会导入或调用它。
- `index.js`、`profile-engine.js`、`style.css`：仅承担 SillyTavern 生命周期、精确楼层/swipe身份、三原件串行调度、人物档案原子持久化、统一报告与控制台。没有把这些新胶水冒充为第三方原件。

第三方文件保留其原作者信息和原许可证状态；具体来源、哈希、复用等级和不得不新写的原因见 `docs/0.8.0-REFERENCE-TRANSPLANT-SOURCE-MAP.md`、`docs/0.8.1-LIFECYCLE-SOURCE-MAP.md`、`docs/0.8.2-STORY-NOOP-SOURCE-MAP.md`、`docs/0.8.3-PROFILE-DISCOVERY-SOURCE-MAP.md`、`docs/0.8.4-PROFILE-PLACEHOLDER-SOURCE-MAP.md`、`docs/0.8.5-STORY-TRANSPORT-RECOVERY-SOURCE-MAP.md`、`docs/0.8.6-PROFILE-DISCOVERY-AND-DURABLE-REPORTS-SOURCE-MAP.md`、`docs/0.8.7-DATABASE-ROW-BINDING-SOURCE-MAP.md`、`docs/0.8.8-PROFILE-PLACEHOLDER-BOUNDARY-SOURCE-MAP.md` 与 `docs/0.8.9-PROFILE-DISCOVERY-BINDING-SOURCE-MAP.md`。

用户的私有 Izumi 预设、角色卡、跑团记录、首回合文本、API 配置和凭据不属于本仓库，也不得进入 Git 历史或测试报告。
