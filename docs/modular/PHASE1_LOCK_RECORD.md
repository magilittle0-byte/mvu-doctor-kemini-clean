# P1 锁定记录读取与校验来源

本文件只记录锁定记录的读取边界；本轮不生成锁文件。锁定仍必须等当前候选完成真实十二轮验收。

## 复用来源

| 来源 | 已核对机制 | 本适配的处理 |
| --- | --- | --- |
| `scripts/modular-fingerprint.mjs:6-20` | 递归收集 `manifest.json`、`modular/` 和 Story Oracle vendor 的 JS/CSS，并计算每文件 SHA-256 与聚合指纹 | 校验器接收调用方传入的当前 fingerprint，不硬编码文件数量；锁记录逐文件比较并要求锁定文件集合与当前集合完全一致 |
| `scripts/check-modular.mjs:12-17` | 旧检查仅在 `locks/` 存在时读取 JSON、检查 `locked` 和列出的文件哈希 | 新模块提供 fail-closed 的单记录校验；无锁文件返回未锁定，有锁文件缺字段或不匹配则拒绝锁定 |
| `docs/modular/MODULE_CONTRACT.md:11-12` | 锁定范围包括源码、提示词、传递依赖和接入文件；哈希不能替代真实验收；当前没有锁定记录 | 锁记录要求版本、stage、完整文件哈希和真实完整通过证据摘要；不把快速测试或 `realAcceptance:false` 当通过 |
| `MVU_DOCTOR_MODULAR_REBUILD_PLAN_2026-09-05.md:58-60,128-136` | P1 锁定需真实正文/MVU、持久化读回、界面一致且无遗留硬失败，并保存文件/依赖指纹和锁定记录；后续模块不得改受保护包 | 记录接口只读、不改运行代码；后续接线可调用校验结果，发现差异即停止候选 |

## 记录格式与边界

锁记录包含 `locked:true`、`stage:1`、`version`、`fingerprint`、`files`（完整当前指纹文件表）和 `realAcceptance`。真实证据文件单独保存；两者都必须绑定当前聚合指纹，且 `realAcceptance.summarySha256` 必须等于单独证据文件的原始字节 SHA-256。摘要至少含 `complete:true`、`rounds:12`、`hardFailures:0`、`sourceFingerprint`；它还应记录配套预设和配置哈希、逐轮核验结果与最终读回，不能放私人正文。校验器只比较脱敏摘要，不读取正文、凭据或模型回包。

`modular/lock.mjs` 的 `readModuleLock` 对不存在文件返回 `null`；浏览器使用 `loadModuleLock(root, version, deps)` 读取固定的 `locks/phase1.json` 与独立 `locks/phase1-evidence.json`，并按锁记录文件重新读取字节计算哈希。存在但 JSON、结构、版本、stage、路径、文件集合、哈希或验收摘要不符时返回未锁定及固定原因码。它不会把候选自身的 `realAcceptance`、旧报告或单元测试结果提升为锁定证据。

根代理接线：启动时只读锁摘要，运行接口和面板据此显示源码是否锁定；锁读取失败不阻断变量诊断。Node 校验器独立扫描完整候选文件集合，防止锁记录漏列保护文件；浏览器核对记录所列文件的实际服务字节。`check-modular` 调用同一校验器，有锁但不匹配则检查失败。`.gitattributes` 对兼容配置和锁记录沿用现有运行文件的 LF 保护，避免 Windows 安装改变哈希。

本轮 P1 尚未通过，因此不创建 `locks/*.json`。锁摘要只记录独立真实验收结论，不会因模型自报成功或快速检查通过自动生成。
