# P2 candidate.11 接续已锁 P1 0.10.33

2026-09-21。此候选尚未完成真实门禁。

1. 数据路径：P2 manifest 仍要求旧 P1 0.10.30；当前 0.10.33 在 R15 已完成十二有效普通回合、额外压力和最终读回，以保留模型例外的机制标准锁定。旧依赖无法代表当前版本。
2. 来源：本轮重新搜索全项目模块锁、人物 manifest、生成 loader 与真实 QC 接入。完整读取 `scripts/check-profiles.mjs`、`modular/lock.mjs`、P1 三个锁文件及 supporting、`profiles/manifest.json`，并由 Luna 复核当前 P2 content/runtime/host/store 与 R11 host-control/round/repair/snapshot/release。锁格式及校验来自成熟 P1.30 实现。旧医生、数据库表模板、故事神域、卡片前端属于内容和持久化设计来源，本次不改其接口。
3. 原样复用：P2 candidate.11 的一次 profile-turn 请求、完整44字段验证、旧人物增量、逐人物失败隔离、事务读回和独立修复；全部 P1 运行文件、P2 内容提示及业务源码保持不变。
4. 最小适配：仅将 `profiles/manifest.json.requires` 改为当前锁的版本/指纹，由 `check-profiles.mjs --write-loader` 生成对应 `install.json`。运行检查与现有人物测试；旧 P2/P3 锁不能证明当前候选通过。P2 candidate 版本仍为 .11，完整文件指纹因依赖和安装描述改变而重新计算。
5. 新写边界：本次无需新业务逻辑。真实测试控制器在新的本地 run-state 目录适配当前指纹和 P2 阶段空闲条件，不能调用要求 P2 禁用的 P1 单模块 fresh 守卫。必须重新核验 P2 当前指纹下的真实内容、持久化、UI 与下一轮消费，不将 P1 的 R15 成绩计入 P2。
