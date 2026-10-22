# 指导运行与入口来源映射

2026-10-22，针对新指导的有效正文、串行推演、待处理续接、只读恢复和独立入口完成实现前核对。此表只记录源码与当前接口事实，不是运行验收。

## 来源与适配

| 路径 | 完整核对范围 | 复用与边界 |
|---|---|---|
| `modular/runtime.mjs` | 全文件，尤其 started/received/ended/finish/run/restore/bind | 复用START→RECEIVED→END后500ms及150ms再次读取、楼层/类型守卫；移除disableNative和变量消费者。其restore恢复pending会自动调用，因此不能直接搬 |
| `modular/host.mjs` | scope/capture/assertTarget及上下文、存档读回上下游 | 适配精确正文身份；不带MVU解析/写回。新宿主桥由独立来源记录约束 |
| `world/runtime.mjs` | 由存储/推演复核代理完整阅读调用链 | 保留同楼前态、epoch失效、旧结果不可覆盖；拒绝P1/P2等待，busy直接return改为待处理最新接受正文且保留中间变化 |
| `profiles/host.mjs` | 前缀lineage及调用链 | 按当前分支前缀寻找有效前态，恢复只读不补发模型请求 |
| `app/entry.js`、`app/surface.mjs`、`app/style.css` | 完整入口、面板渲染和销毁链 | 复用单实例、可达按钮、视口CSS及成对清理；不搬三模块五页面板、不移动其他插件DOM |
| `world/surface.mjs` | 完整渲染与dispose | 复用textContent安全显示和折叠幕后详情；不引入档案/经济/声望编辑器 |
| 当前真实宿主 `/script.js` | 只读核对Generate/START、RECEIVED与hideStopButton发END路径 | END无请求ID；必须结合匹配主RECEIVED、稳定正文、宿主生成标记和独立存档读回，不能只看END |
| 当前真实宿主 `/scripts/openai.js` | 只读核对CHAT_COMPLETION_PROMPT_READY发送点 | 事件参数 `{chat,dryRun}`；只有主票据有效且实际chat含本扩展精确提示才记“已提供”，不直接记“采用成功” |

## 必须新写的缺口

旧模块缺少“忙碌期间连续正文在后台结束后自动续接”的单点调度；旧世界必须等完整人物档案；旧restore会重新启动模型；旧召回用关键词判consumed。因此新增窄的指导runtime，让同一个队列负责有效接受、过期拒绝和保存。不能并行挂第二条世界链补救。

新文件限于指导主链及必要测试。事件清理、定时等待失效、提示清空和面板销毁必须成对；无需额外常驻轮询服务或事件总线。

## 首轮接缝复核

完整对照新 evolve 的 reviewAdoption 与旧 world 的 settleRecall/boundRecall 后，确认提示回执必须在正文接受时绑定 targetIdentity、promptObserved；忙碌合并需要保留每段正文的回执，不能只留最新一个。runtime 以当前分支内存映射保留回执，在同一次正常指导中核对覆盖范围。

当前宿主 world-info.js 的 dry-run 仍会改写 Author Note，因此不从 runtime/host 调用该扫描。改为记录主 ticket 的 WORLD_INFO_ACTIVATED，并在本轮主提示 ready 后确认观察；没有捕获时明确缺规则覆盖，不擅自写其他提示。

对照 host 的 destroy 后禁止 context 访问与旧 runtime 清理链，dispose 后不得继续 publish/读设置。传给模型的增量正文只保留 identity/index/userText/content；不把宿主身份校验用的完整前缀签名反复送进模型。

## 刷新后同楼重算的实测缺口

定向调度检查复现：忙碌 A/B 合并保存后刷新，重算该批次因 A 的提示提供回执只在内存而失败。重新检索 incomingRecall/priorDelivery/receipts，并完整阅读旧 world execute/boundRecall 上下游；旧 world/runtime 的同楼 exact.review.incomingRecall 恢复机制可最小适配。新记录须保存整批 receipts，在同一 lineage 重算时按 newlyAccepted 身份恢复；不把恢复变成自动调用，也不借新回执伪造旧正文的提示提供。世界规则观察同样绑定当前精确记录，避免重算凭空丢失已观察的规则材料。提示筛选失败必须保留覆盖不足状态，不能被后续默认 false 覆盖。

## 重生成主提示的分支污染

最终只读复核实际复现：旧楼 beforeSnapshot 为空，但 snapshot 有旧楼专属事实，regenerate START 时该事实被送入新主提示。重新检索并完整核对旧 world/runtime 的 prepareRecall、boundTargetGeneration 及 started 上下游，旧机制排除同楼来源；新指导最小适配为 swipe/regenerate/continue 在 saved.target.index 等于基准楼时只投影固定 beforeSnapshot。普通追加回合仍投影当前 snapshot。实际生成后以新分支重新选存档；不把旧候选后态灌进前置提示。

同次核对旧 refresh 的 token-before-show 顺序，发现新 restore 在 await 后校验前赋值 saved，旧异步读取可能覆盖新聊天的内存快照。按旧机制先保存局部 loaded，token 仍有效时才同时更新 saved/restoredScope；不改持久库内容。

## candidate.4：本轮用户输入入库后的提示筛选

2026-10-22 重新检索项目源码、参考作品及历史来源表中的 MESSAGE_SENT、GENERATION_STARTED、prepareRecall；私人材料、凭据、依赖目录和重复证据副本未作为内容来源。完整核对当前公开宿主 GenerateInternal 的 START→发送用户消息→提示组装路径、sendMessageAsUser 及包装函数，旧 modular/runtime 全文件、world/profiles 的 prepareRecall 和事件绑定上下游，以及新指导 preparePrompt/started/bind 与离线测试入口。

| 来源 | 核对位置与事实 | 原样复用 / 最小适配 / 不采用 |
|---|---|---|
| 当前 TauriTavern 1.18 公开源码 `real-tauritavern-qc/run-state/guidance-20261022/host-script-public-source.js`（仓外本地参考） | 5070 先 await GENERATION_STARTED；5231/5235 await sendMessageAsUserAtProviderBarrier；6942–6951 包装原 sendMessageAsUser；6930 push 用户消息、6933 await MESSAGE_SENT；6076–6102 随后读取扩展提示并组装主提示 | 原样使用已有 MESSAGE_SENT 事件，不读取输入框、不调用主生成、不增加网络请求。此处只证明源码时序，不替代真实回合验收 |
| `modular/runtime.mjs`、`world/runtime.mjs`、`profiles/runtime.mjs` | modular 的 MESSAGE_SENT 在无主票据时使旧工作失效；world/profiles 在 START 准备提示并维护同楼前态 | 继续使用同一票据与失效机制；旧准备逻辑没有“依据本轮用户输入筛选条件事项”的完整机制，不能直接复制解决新问题 |
| `guide/runtime.mjs`、`guide/reveal.mjs` | started 的 preparePrompt 读取 chat 最后 user，正常发送此时仍是上轮输入；reveal 需要当前输入判断相关条件入口 | 仅在当前 normal 票据、同作用域、新用户楼层入库且主提示尚未组装时，同步重算既有 preparePrompt，覆盖本轮 delivery；swipe/regenerate/continue 的固定 beforeSnapshot 不改变；旧楼、提示已提供或正文已收到后的事件不刷新 |
| `tests/guidance-runtime.test.mjs` | 原 begin 先 push user 再 START，顺序与实际宿主相反 | 改为 START→push user→MESSAGE_SENT，增加旧输入移除/新输入选中、迟到事件不覆盖提供回执、同楼前态保持的离线回归；请求桩配合新来源 JSON 段读取，不把测试桩当模型证据 |

新增部分只有现有 MESSAGE_SENT 监听的窄处理函数；原因是指导新增了当前输入相关性筛选，而旧模块没有这条入库后刷新路径。没有第二调度器、定时轮询、存储迁移或自动重试。后台 JSON schema 的渠道支持本轮未启用，宿主请求桥保持原样。

同轮复核补充：当前公开宿主 hideStopButton（4175–4184）发送的 GENERATION_ENDED 只有 chat.length，没有请求 ID；根任务提供的真实事件元数据也出现辅助 END 早于主 RECEIVED。重新核对 guide/modular 的 ended→scheduleFinish 和旧 world 的 receipt 绑定：不能用单独 ended 阻止入库后准备。这里的锁点改用本票据的 promptReady、received 或 finishing；START→辅助 END→用户入库→MESSAGE_SENT 仍须准备正确本轮提示，未收到正文时不发指导请求。此事实另加离线回归，不把早到 END 当主正文已完成。

## candidate.5：区分辅助提示准备与主请求参数准备

candidate.4 的新真实事件元数据出现 START→辅助 CHAT_COMPLETION_PROMPT_READY→辅助 END→MESSAGE_SENT→主 CHAT_COMPLETION_PROMPT_READY。前一节的 promptReady 锁点因此不成立；本节取代它，不能把“第一个 READY”当正文。此次重新检索公开宿主、旧模块、原始 MVU 请求监听、数据库公开参考及成熟后台调用路径，并读到下列实际发送边界；没有读取私人请求正文。

| 来源 | 完整核对范围 / 事实 | 复用与适配边界 |
|---|---|---|
| 当前 `host-script-public-source.js`（与前节同一仓外目录） | generateRawData 4679–4799、主 GenerateInternal 的发送路径及 sendGenerationRequest/sendStreamingRequest；4715–4716 的辅助 READY 只有 `{chat,dryRun:false}`，4756 固定使用 quiet 发送 | 无类型 READY 不能记主请求已观察，也不能锁住 MESSAGE_SENT 后的筛选。辅助 raw 不需要发 START 也能触发这个事件 |
| 当前 `host-openai-public-source.js`（同目录） | prepareOpenAIMessages 2374–2488、createGenerationParameters 的 type/messages 构造与 sendOpenAIRequest 4592–4726 | 主 READY 2479–2480 同样无 type；请求参数 4264–4266 保留实际 type/messages；4599–4608 在真实 fetch 前 await CHAT_COMPLETION_SETTINGS_READY。直接复用这个现有事件，只读取 type 与 messages，不记录其中连接或凭据信息 |
| 当前 `host-script-public-source.js` | 6213/6271 到 7150–7188 的流式/非流式发送；5231→6942–6951→6930–6933 的入库屏障 | 主调用透传 normal、regenerate、swipe、continue 类型；quiet 辅助走 quiet。普通用户入库仍同步刷新，已有用户/自动 normal 和同楼重生成不强制等待新增 MESSAGE_SENT |
| 原始 MVU `src/function/request/index.ts`、数据库公开参考 `public-reference-shujuku-spv8.9.2.js` 69696–69772、102172–102182 | SETTINGS_READY 的既有消息处理监听、messages 形状与清理方式 | 只复用既有事件和消息形状；不搬变量修正、数据库模板处理、全局宏或对消息的改写 |
| `guide/runtime.mjs` / 既有 ticket、sent 与 receipt | 无类型 READY 过早把 worldObserved 置 true，导致 sent 被挡；provided 回执可能归错辅助请求 | 最小改为 SETTINGS_READY 观察：有效票据、同作用域、显式 type 字段且归一化类型等于本票据、messages 为数组时才记录观察；其中精确包含本次指导文本才记“已提供”。不改变模型调用、保存、忙碌续接、同楼前态或暴露成功判断 |

不新增阶段总线或请求 ID。GENERATION_AFTER_COMMANDS / AFTER_COMBINE 也可能被辅助流程触发，不能作为主请求的唯一身份。当前复用的是宿主实际发送类型，不宣称它能识别任意第三方伪造的同类型事件；真实宿主/最终上游消息仍由本轮验收核对。离线回归覆盖主请求前后 quiet、无类型 READY、normal 已有用户和自动入口、同楼类型匹配/不匹配以及原串行续接，均不新增模型调用。

同一链上的世界书资料只在主请求参数确认前收集：当前公开 script 5418 await getWorldInfoPrompt，之后才于 6076–6102 组装主提示、发送 typed SETTINGS_READY。WORLD_INFO_ACTIVATED 本身不带类型；主请求参数一经确认，冻结 ticket 已捕获条目，后来的 quiet 扫描不得覆盖它。此处只保护已捕获资料，不主动扫描、不声称无类型世界事件能够独立证明任意并发扫描的身份。

类型匹配遵从当前源码的字符串参数：只将自有 type 字段值为 undefined 的原生普通调用归为 normal；null、布尔值、数字和空串不冒充 normal。其他类型必须与本票据精确相等。
