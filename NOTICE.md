# 来源与适配说明

0.8.0 是“先完整移植、再最小适配”的重建基线，不再把旧 Doctor 描述为成熟实现。

- `vendor/story-oracle-v1.35.4/`：Story Oracle v1.35.4 的完整运行文件，固定上游提交 `661f9f89446de473ace70a590897ca5065bc2efe`。`verify-copy.sh` 会逐文件验证其原始字节。
- `vendor/world-engine-v3.0.2/`：World Engine v3.0.2 的完整上游快照，固定提交 `154de4b590378cd0bd851cfffcefd3d96741cf3f`。来源哈希与比对报告随快照保存。
- `vendor/life-state-v5.35/`：用户提供的角色生理状态引擎 ver5.35 脚本 JSON、双正则 JSON及逐字节提取的脚本内容；`PROVENANCE.json` 和验证脚本记录三份 SHA-256。
- `legacy/0.7.5/`：重建前旧 Doctor 的只读历史快照。根目录 0.9.1 运行时不会导入或调用它；0.9.1 仅按来源图移植其中已验证的变量证据分栏语义。
- `index.js`、`profile-engine.js`、`style.css`：仅承担 Story变量复检、精确楼层/swipe身份、人物档案原子持久化、World 对话机制块清理、变量诊断终态屏障、首次世界书选择、正文 `buildContext` 与 World→Memory 联动的可观察投影、统一报告与控制台。两处投影都只改交给原函数的副本，不删改完整持久 World 或原生推演输入；Memory 原生 `replace` 回滚和空摘要跳过语义保持不变。World 3.0.2 的原生 scheduler、`evolve`、存档、重roll、设置和UI不由Doctor接管；诊断屏障只等待本楼变量诊断结束，失败仍放行，人物阶段不阻断 World。
- MVU 对话过滤是启动时验证的适配合同：先移除项目两条规则的精确重复项，再只用剩余用户规则运行同时包含 JSONPatch 内外 payload 的闭合/截断探针。两项都精确通过就不重复项目规则；任一不完整就把闭合、截断两条规则按固定顺序作为前缀，再接回用户规则，防止宽泛删标签规则先破坏定界且不让设置膨胀。迁移后在快照外包装原生 `WORLD_ENGINE_CORE.filterDialogue`，原函数前后都用同两条规则清理，所以普通自动推进、手动推进和批量回填均受保护，用户其余过滤仍由原函数执行。同会话删除持久规则时运行期保护仍在；`evolve` 入口对 `aiMsg/dialogueText` 的内存清理只是覆盖绕开 Core 的直接 API 防线。两层都不改持久设置、vendor 字节或原生调度。
- World 与 Memory 使用独立迁移键。Memory 在改变旧 World 签名前先写 `mvu_doctor_native_memory_owner_v1=pending` 保存来源证明，接口暂不可用时下次继续；只有恢复后读回 `true/auto`，或确认当前值不是精确 `false/manual`，才写 `done`。用户偏差不被覆盖。
- 世界书预热和首次 `evolve` 的二次重试都按 chatId single-flight；等待、已就绪、缺失或错误状态显示在 World 页并进入完整报告。手动 MVU 复检以 `manualDiagnosisBinding` 绑定同一 generationKey，并使用单调 token 保证旧复检的 `finally` 不能清掉更新的绑定。

第三方文件保留其原作者信息和原许可证状态；具体来源、哈希、复用等级和不得不新写的原因见 `docs/0.8.0-REFERENCE-TRANSPLANT-SOURCE-MAP.md` 至 `docs/0.9.1-VARIABLE-EVIDENCE-SOURCE-MAP.md`。

用户的私有 Izumi 预设、角色卡、跑团记录、首回合文本、API 配置和凭据不属于本仓库，也不得进入 Git 历史或测试报告。
