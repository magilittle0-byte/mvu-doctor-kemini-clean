# P2 candidate.4 调用成本修复来源映射

2026-09-14：P1 0.10.30 已锁定并安装，运行指纹 `39deb6d8427e79742292d7fbf60b4e6fd9acaf7376a128770b5055c2966acb5e`。本次仅制作独立 P2 候选；P1 运行文件、支持文件和 P3 不变。尚未完成当前 P2 真实门禁。

## 已确认路径和必要性

原 P2 candidate.3 是一次 discovery，失败自动 discovery-repair，再对每个人分别 profile，失败自动 profile-repair。有 N 人时通常 1+N 次，最多 2+2N 次。用户要求控制每回合调用，故本次改为一次 discovery 加一次包含所有发现人物的 profile-batch；无人时只请求一次。自动补发为零，用户主动修复开始新的当前资料读取，每次上限仍为两次。

来源核对先于运行代码和测试修改：重新检索项目历史的 batch、profile、人物、数据库表格、故事神域、糖糖、Izumi、缝合怪、Z论坛、角色卡/世界书、前端、诊断和 K3 相关文件，阅读当前 profiles 输入、生命周期、存储、提示、UI、加载器和测试，以及下列命中实现。历史机制仅作为来源，不作为当前验收证据。

## 逐项复用

| 数据路径 | 来源与具体机制 | 本次适配边界 |
| --- | --- | --- |
| 批量请求 | `mvu-auto-doctor-testing/actor-profile-batch-core.mjs` 的 callGroup、prepareGroupApply、commitGroupApply；`actor-shard-core.mjs` 的 buildActorShardBatchMessages | 复用一次传输、逐项归属和局部合并的控制流，适配为 P2 的完整 profiles 数组。不要移植旧 ActorRef、分字段组、ledger 或重试调度器。 |
| 显式身份解析 | `actor-shard-core.mjs` 的 parseActorShardProposalBatch | 按明确 ID 建索引，记录缺失、重复、未知和交叉绑定；每人继续使用 P2 validateProfile。额外未知项不得建档，合法兄弟可保存，但有错误不能宣布整轮完成。 |
| 完整字段与生成边界 | `profiles/content.mjs` 的 PROFILE_FIELDS、PROFILE_TEMPLATE、profilePrompt、parseJsonResponse、validateProfile、parseDiscovery | 保留 36 文本加 8 列表字段、完整 JSON 修复器、正文证据、玩家排除、既有事实保护和合理补全。仅加批量外壳；profile.evidence 仍为原来的证据列表，不能与 task.evidence 的正文片段混用。task 的 sourceName/evidence/presence 仍由脚本绑定。 |
| 当前输入与模型路由 | `profiles/host.mjs` 的 inputFor、callModel、assertReceipt | 原样复用同一 receipt、当前正文/MVU、完整权威材料和现有路由。批量共享一次输入；每次请求前后断言有效性，不增加并行请求或路由。 |
| 持久化与失败 | `profiles/runtime.mjs` execute/persist；`profiles/store.mjs` commitNow | 保留完整旧档案 working clone、逐人物完整提交、revision CAS、写后读回和失效补偿。一次 batch 后逐项校验并提交，失败只保留任务/候选，不以半档案覆盖旧完整档案。整批格式或传输失败停下，按钮重新请求。 |
| 召回与宿主生命周期 | `profiles/runtime.mjs` prepareRecall/settleRecall/bind；`profiles/entry.js`、loader.js | 原样保留 P1 成功收据结算召回、切聊/新正文取消、swipe 隔离、独立加载器。禁止以辅助模型 END 结算召回。 |
| 调用上限与界面 | 现有 runtime call()、review.requests、UI render | 在唯一 call 接缝限制每次运行最多两次，并显示当前次数；不另建计数/调度系统。旧批次解析不提供这个 P2 限额，需在当前接缝补齐。 |

## 检查和证据边界

安装字节补充：当前 Git `core.autocrlf=true`，P2 的脚本、测试和说明会在 Windows checkout 转为 CRLF，导致已验证的支持文件与宿主服务字节不一致。再次核对已锁定根 `.gitattributes`、P3 安装换行复现记录和 `world/native/.gitattributes` 后，复用其局部 LF 属性方式：仅为 P2 支持文件添加目录内属性，不改 P1 的根属性或任何 P1 文件。

受控检查保留完整字段、同名不同 ID、乱序、遗漏/重复/未知/错配 ID、合法兄弟保存、旧完整档案保留、失败不自动重试、手动重新读取、失效不提交、召回收据和存储补偿。旧逐人调用次数断言按新的预算契约替换，语义正确性断言不放宽。

旧 candidate.2 的 phase2 锁及证据按原字节归档；新候选明确未锁定。通过快速检查后按授权推送 Kemini Clean 测试 main，并安装到原宿主，以当前指纹进行新的 P2 十二回合验收。模型偶发错误使用按钮修复并诚实保留失败记录，不无限改代码或无限付费重试。
