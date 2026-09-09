# P3 world dependencies source map

本文件是 P3 依赖加载器的实现来源映射。此次范围只新增 `world/dependencies.mjs`、其受控测试和本文件；P1/P2 锁定文件、vendor、package 和生产运行路径不改。

## 逐项来源与适配

| 依赖检查 | 直接来源 | 适配 |
| --- | --- | --- |
| P1 lock 读取、safe relative path、fetch `cache:no-store`、原始 bytes SHA-256、fail-closed | `modular/lock.mjs` 的 `loadModuleLock`、`validateModuleLock`、`validFiles` | 直接调用现有 `loadModuleLock(root, '0.10.26', {fetch, crypto})`；不复制 P1 算法 |
| P2 lock raw SHA、stage/version/fingerprint | `locks/phase2.json` | 新增浏览器适配，因为现有 loader 只固定读取 phase1；lock bytes 先与批准的 `ff97d877...b2ced` 比较，再解析 |
| P2 10 runtime 与 8 supporting 的 exact map | `locks/phase2.json` 的 `files`、`supportingFiles` | 复用同一 safe path 和 bytes digest；键和值都必须完全一致，缺失或变化失败 |
| P1 三个锁依赖文档及 P1 supporting 11 项 | `phase2.json.p1Dependencies`、`locks/phase1-supporting-files.json` | 读取三份依赖文档原始 bytes 与声明 SHA；读取 supporting 清单后逐项核对其 11 个实际文件。不会读取外部 private evidence |
| World 独立启动依赖 | `profiles/entry.js` 的 lock gate 和 owner/session 边界 | 本模块只返回 `{locked,p1,p2}`，不创建 global、UI、宿主订阅或 world 运行时 |

## 固定批准依赖

- P2 lock raw SHA-256：`ff97d877b4adc25c3d05eb6416e082c17ee93a94630e323d428dea38474b2ced`
- P2 version：`0.1.0-candidate.1`
- P2 fingerprint：`08ceb43d71877ea66693711c20a02ba87ccb49fa8851533bff69f708a786bb7d`
- P1 version：`0.10.26`
- P1 fingerprint：`c7a8af5a7f33363f06796e1b0f587ec087387dfe3cf4ac2281266145c589d595`

这些常量用于拒绝 stale 或自适应 hash；加载器不会根据当前文件重新生成批准 fingerprint，也不会把缺失 lock 当作成功。

## 浏览器边界

模块只依赖 `fetch`、`crypto.subtle`/`crypto.webcrypto.subtle`、`TextDecoder` 和 `TextEncoder`。它不导入 Node `fs`，不读取外部 evidence reader，不重新序列化 JSON 来计算 lock bytes hash，也不调用宿主或模型。Node 侧测试 fixture 只为受控验证提供 fetch 字节映射。

## 返回与失败

成功返回 `{ locked: true, p1, p2 }`。任一 P1 lock、P1 supporting、P2 lock、P2 runtime/supporting、版本、fingerprint、依赖声明、safe path 或 hash 不满足时返回 `{ locked: false, reason }`。本模块没有 P3 lock、world load 或验收语义。

## 本次实现补充

复用 `modular/lock.mjs` 的关键顺序是“读取一次原始 bytes → SHA-256 核验 → 解析这一次 bytes”。P2 的 `phase1-supporting-files.json` 也必须沿用同一份已核验 bytes，不能为解析再次 fetch，避免两次读取之间出现版本窗口。P2 supporting 和 P1 supporting 的文件变更分别由受控测试覆盖。

当前版本测试中的 version/unsafe lock case 会先因固定批准 P2 lock raw SHA 不匹配而拒绝；这证明 stale lock 不会被接受，但不等同于对修改后 lock 内部路径的独立路径解析覆盖。未知 fetch/解析异常统一映射为固定 `dependency_validation_failed`，不向浏览器调用方暴露上游异常文本。
