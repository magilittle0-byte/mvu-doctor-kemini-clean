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

## candidate.6：Helper 的 normal 辅助请求与真实用户入库屏障

candidate.5 的真实事件元数据证实：START 后、MESSAGE_SENT 前已有 type=normal 的 SETTINGS_READY，MESSAGE_SENT 后又出现主请求的 normal SETTINGS_READY。因此前节的类型匹配只能排除显式 quiet，不能证明主请求身份。本次重新检索 Helper、数据库公开源码、既有模块与公开宿主事件，沿 Helper 的公开导出到实际发送及清理完整核对；只读来源如下。

| 来源 | 核对到的实际链 | 适配结论 |
|---|---|---|
| 仓外公开快照 `real-tauritavern-qc/run-state/modular-p1/loaded-tavern-helper.js` | 658 行标示 4.9.3；752 行 generate→AK / generateRaw→jK；659 行 AK/jK→kK→JG，当前连接直接 sendOpenAIRequest('normal')，自定义连接 GG/KG 也以 normal 构造参数并触发 SETTINGS_READY | 这是与宿主原生 generateRawData('quiet') 不同的成熟路径，不能把函数名称等同为同一实现；不改 Helper 或数据库 |
| 同一 Helper 快照 659 行 | kK 也发 GENERATION_AFTER_COMMANDS 与 GENERATE_AFTER_DATA；JG 发带 ID 的 js_generation_started，成功路径发 js_generation_ended，但异常 finally 不保证后者 | 不用这些阶段事件冒充主请求证明；不增加可能在错误后永不归零的辅助开始/结束计数器 |
| `real-tauritavern-qc/public-reference-shujuku-spv8.9.2.js` | 63180–63185 调用 TavernHelper.generateRaw；102442 起的主 AFTER_COMMANDS 监听会 await 辅助工作，完成后宿主才继续发送用户消息 | 与已观察的辅助 normal→辅助 END→MESSAGE_SENT→主 normal 顺序相符；不将旧公开源码当当前配置已启用证明 |
| 当前公开 `host-script-public-source.js` | START 5070，AFTER_COMMANDS 5092，普通非 automatic 输入经 5231/5235→6942 包装→6930 push / 6933 MESSAGE_SENT，主参数发送更晚 | 原样复用确切的用户入库事件；不读 DOM、不发请求、不新增模型或调度系统 |
| `guide/runtime.mjs` 的 started/sent/settingsReady/bind | 普通 normal、非 automatic 且 START 时基准正文之后还没有用户消息时，尚不能把任何参数准备事件认作本轮正文 | 仅在同一 ticket 增加 waitingForUser 标记：等待时清空旧提示，忽略 SETTINGS_READY 与世界条目；合法新尾部用户 MESSAGE_SENT 解除等待并准备本轮提示。已有新 user、automatic、swipe/regenerate/continue 不强制等待新的 SENT。同楼前态、finish、retry、持久化与调用数量不变 |

此修复只覆盖已证实的“新用户尚未入库前的 normal 辅助请求”。在 MESSAGE_SENT 之后发生的同类型辅助，以及本来不产生新 SENT 的入口，当前 API 仍无主请求 ID；类型和精确指导文本只是约束，不能凭此宣称已排除任意同类型辅助。保留真实验收边界，不用未观察的事件序号、阶段或请求材料形状补造身份。离线检查用实际顺序复现辅助 normal 早到，验证其不能锁住新用户筛选或冻结辅助世界条目，并保持 existing-user/automatic/同楼与忙碌续接检查。

## candidate.5：最终正文的只读保存屏障

2026-10-22，修改前重新执行 2A 源码检索。主代理提供的脱敏实证：主正文收到且宿主已不在生成，指导零模型调用即报 `host_readback_target`；稍后独立只读 capture/readback 已成功，内存与落盘的目标、活动 swipe 及三行前缀一致，未点重算、未补调用。该证据支持最初检查早于自然保存完成，不能把稍后成功倒算成当次指导已运行。未读取凭据、聊天文件或模型原始正文。

检索范围为当前 guide/modular/profiles/world 的 capture、finish、readback、save 与绑定路径，旧医生 accepted-final/持久化复核函数，当前公开宿主保存队列、防抖、流式/非流式完成路径。当前宿主权威来源是 `real-tauritavern-qc/run-state/guidance-20261022/host-script-public-source.js`（主代理从当前宿主取回的公开源码）；旧报告仅作导航。完整阅读相关函数及下列上下游：

| 来源 | 已核实事实 / 本次取舍 |
|---|---|
| 当前公开 script `markUIGenStopped` 4264–4266、`finalizeIntermediaryMessage` 4440–4474、`onFinishStreaming` 4476–4488；`activateSendButtons` 8131–8137 | 流式路径先解锁生成状态，await `MESSAGE_RECEIVED` 与渲染监听，再调用并 await 聊天保存。UI 不忙和 RECEIVED 均早于持久化完成，固定 500ms+150ms 不是落盘证据。 |
| 同文件 `finishGenerating` 的 6380–6425、`saveChatConditional` 10666–10687 | 非流式正常结束路径 await 保存后再 unblock；与流式时序不同。conditional 同时排正文保存、token cache 与提示缓存保存并等待，不能只凭 END 推断这几项完成。 |
| 同文件 `enqueueChatSave` 571–610、`saveChatDebounced`/`flushDebouncedChatSave` 8418–8458、`saveChat`/`saveChatUnsafe` 8472–8574 | 当前宿主有串行保存队列；`isChatSaving` 只表示已经入队的任务，防抖待办尚未入队时或 RECEIVED 监听未返回时可能为 false。单次排空队列不能覆盖未来才入队的本次保存。未找到可绑定本次目标的公开 CHAT_SAVED 事件。本轮不调用 save/flush、不改保存队列、不替用户保存或改写正文。 |
| 当前 `guide/runtime.mjs::finish/retry/drain` 与 `guide/host.mjs::capture/assertTarget/readback` | 当前 finish 稳定读取正文后仅读盘一次，失败立即清票；只有成功之后才转交 delivery/worldObservation。readback 已严格核对整段前缀与目标，保留该判断；仅对 `host_readback_target` 等待自然保存后复查，transport/format/unsupported/stale 错误不自动重试。 |
| `modular/runtime.mjs::finish`、`modular/host.mjs::saveChat/readback`；旧医生 `mvu-auto-doctor-reference-archive/01-doctor/latest/index.js:855–935,5830–5838,5896–5926` | 旧链区分可等待保存和读回证明；旧 verifyPersistedChatNamespace 有有限次数、退避、准确匹配后才 verified 的条件复查。仅适配条件复查与失败语义，不复制写宿主、元数据事务、错误重存或其固定等待数字。 |
| `world/runtime.mjs::settleRecall/boundTargetGeneration/boundRecall` 96–121；当前 guide 的 exact.receipts/worldObservation 读取路径 | 保留观察证据与精确 target 绑定的办法。未通过保存屏障的正文不能写成 accepted/settled；如等待最终失败，重算所需的观测上下文应独立留在内存，并只允许相同 scope/identity/lineage 使用，不借上一轮或别分支的回执补齐。 |

已认可的最小实施方向是在原 finish 的当前 ticket 中做临时、可失效的读回循环：只在精确 target 尚未落盘时等待并复查；每次 await 前后均核对 ticket/epoch 和 target，严格读回成功后才增加 acceptedCount、转交后续工作。**不设置按经过时长淘汰的保存等待上限**：RECEIVED 的其他监听可能等待真实辅助模型，当前没有可证明的最大自然保存时长。退避间隔只用于节流，间隔可封顶；时间过去和保存队列为空都不是成功或失败证据。界面保持“等待正文自然保存确认”，transport/format/unsupported 等真实错误才失败。新正文、换聊天、编辑/删除、停止或销毁使旧等待失效。没有常驻轮询器、额外模型调用或强制重 roll。

当前 `received/ended → scheduleFinish` 同步返回，scheduleFinish 用 `void finish(ticket)` 启动异步工作，故该等待不被宿主 eventSource 监听链 await，也不会禁止下一正文 START。现有 await 后 guard 可阻止过期任务提交；若实现要求 token 变化立即释放在途只读 fetch/计时器，可给当前 ticket 一个仅负责接受阶段的 AbortController，并为原 readback 增加可选 signal，失效/销毁时一并 abort。它不能与已在运行的模型控制器混用。

真实读盘错误后最小上下文保留提案（本段记录时尚未改 runtime/tests）：捕获稳定 target 后，冻结一份 `target + delivery + worldEntries + worldObserved` 的内存重算上下文；该对象明确不是接受收据，不进入存档、不增加 acceptedCount。失败时保留给用户主动重算；重算先重新 capture 并严格读回，只有 scopeKey/identity/lineage 均匹配才使用其中观测资料，并在成功接受后照常移交。换分支、换聊天、停止/销毁或新主票据时清理旧上下文；跨刷新不恢复，也不伪造已丢失的世界观察。已有完整 exact 记录仍沿当前持久 receipts/worldObservation 路径，不被该临时对象覆盖。

本次仅追加来源与方案记录，没有修改 runtime、host 或测试，也没有访问宿主、调用模型或执行新真实回合。后续定向检查应覆盖任意延迟自然保存后仅调用一次指导、等待中分支失效及下一正文不被等待阻塞、读盘硬错误零调用，以及真实读盘错误后同目标主动重算能取回正确观测材料；这些检查不替代真实候选重新验收。

实施前最终取舍：主代理已批准只修改原 finish/retry 接缝与独立 `tests/guidance-host-save.test.mjs`，事件区、host 和其他测试由其余工作保持。等待状态采用 `accepting`，说明正在确认正文存档；复查间隔从 250ms 退避至 1000ms 封顶，不设置总时长淘汰。此次不新增接受阶段 AbortController：原只读网络请求不能被 token 变化立即中断，须等返回后核对并丢弃旧结果；计时器最多在当前封顶间隔后发现失效。这是资源回收的边界，不允许旧结果提交，也不阻塞下一正文。临时观察上下文通过原 epoch 失效，并在再次捕获目标时替换；仅同一 epoch 且 scopeKey/identity/lineage 全部一致可交给主动重算。观察上下文保留到该来源被新票据/恢复/停止等动作失效，因此接受后首次模型失败或主动重算的读盘错误也不会丢失原世界观察。仍只在严格读回后转交 accepted 工作。

本轮保存等待分支同时沿用 started/restore 的现有状态发布：前一票据已收到正文但仍在确认落盘时，下一主请求应标记未应用最新指导；不能只看模型 active/pending。新的票据和分支恢复清空上一票据的 provided 外显状态，实际采用依据仍由精确目标绑定的内存/持久回执判断。复核 preparePrompt、publish、snapshot 与 surface 的读取确认，该修正不新增调用或事实。

保存确认中被新 START 取代的正文，之后仍可能包含于新目标的完整前缀。因此重新核对 `host.captureHistory`（保留每段 scopeKey/lineage）、`readback`（核对完整前缀）以及 `drain` 的合批采用路径：稳定目标捕获后可先将真实提示观察放进已有内存 deliveries，但这不增加 acceptedCount、不存档、不等同正文已采用。内存条目额外绑定 scopeKey/lineage；后继目标通过完整前缀读回后，drain 在投影正文前逐段核对这两个绑定，仅把匹配的最小 receipt 送给模型。旧分支即使目标 identity 相同，也不能借用观察。现有 exact 记录的 receipts 仍由外层已保存分支约束，不另改持久 schema。手动重算的保存确认票据同样标记 finishing，防止新 START 把尚未处理的正文误报为已应用。

以上最小修复已实施；定向离线检查 `guidance-host-save` 4 项、原 runtime 27 项和 host 7 项共 38/38 通过，runtime/新增测试语法与 `git diff --check` 通过（仅既有 CRLF 提示）。新增检查使用真实 capture/readback/evolve/reveal，存档读取与模型输出均为合成输入：连续九次未匹配仍保持零模型调用、自然保存后一次推演；下一正文不等待旧保存且 latestApplied=false，完整前缀证明后合批核对旧提示；transport/format 立即失败且连续主动重算保留同目标世界规则；相同 identity 的不同前缀不得复用旧回执。没有访问真实宿主或调用真实模型，候选仍待根任务统一冻结与真实重验。

## candidate.9 后：当前场景来源与未覆盖正文状态（实施前 2A）

2026-10-22 按新观测重新检索 `scene.text/recentText/currentGuideInput`、`baselineIndex/beforeSnapshot`、`latestApplied/restore/failed` 及旧模块的召回、生成和恢复路径。完整复读当前 guide runtime、reveal 的筛选与渲染、host 的 capture/assertTarget/captureHistory/branches，以及本轮命中的旧 prepareRecall、生成删除和公开宿主上下游。仅使用当前代码和公开宿主源码，未读取私人正文、连接宿主或请求模型。根任务提供的 candidate.9 脱敏观测是：新正文已接受、指导返回 `guide_response_invalid`，旧记录仍留在前一目标，但界面 `latestApplied=true`；本节修状态机制，不把该失败转记为通过。

| 来源 | 已确认的原因 | 最小适配与边界 |
|---|---|---|
| `guide/runtime.mjs::preparePrompt`；`guide/reveal.mjs::currentGuideInput/sceneText/relevant/buildGuideReveal` | reveal 会解包 userInput，但 runtime 另把同一原始包装放进 scene.text；缝合怪 story 或数据库历史里的旧主体可由这个旁路重新选中条件事项 | runtime 先调用已有 currentGuideInput，再把同一当前输入给 userInput 和 scene.text。只识别已有明确生产者包装，不新增删正文规则；近期有效正文仍可提供场景依据 |
| 公开 `host-script-public-source.js` 的 GenerateInternal（5061 起、START 5070、删除 5171–5185、coreChat 的 swipe 排除 5278–5280）；`modular/runtime.mjs::started/deleted`；`world/runtime.mjs::prepareRecall`；`profiles/runtime.mjs::prepareRecall` | START 时旧正文尚在 chat；regenerate 后续删除，swipe 只从主提示用的 coreChat 排除。旧模块已有按 baselineIndex 排除替换楼层来源的办法，但 profiles 的近期文本筛选并没有解决新指导的 scene 上下文旁路 | 原样保留固定 beforeSnapshot；仅 regenerate/swipe 的 recentText 排除 index >= baselineIndex 的助手正文，且不依赖 saved 是否恰好位于该楼。continue 保留当前正文前缀，normal 保留近期有效正文。不得把旧模块排除 continue 存档的做法扩张为删除续写文本 |
| `guide/runtime.mjs::restore/locate/started/finish/drain/retry`；`guide/host.mjs::capture/assertTarget/latestIndex`；`guide/surface.mjs` 的 latestApplied 显示 | failed 路径未清已追平标志；空闲 START 仅看 active/pending/finishing；restore 可读到祖先记录却不比对当前目标。队列为空或找到旧记录均不能证明已覆盖最新正文 | 不加新字段：失败保持 latestApplied=false；START 保留已知遗漏；restore 用当前 capture 与记录的 identity/index/lineage 精确匹配校准；当前目标成功保存或精确读回才恢复 true。有真实目标但无记录则显示未追平，仍不自动补跑 |

本轮计划只修改 `guide/runtime.mjs`、其既有调度测试和本来源表。新增离线场景覆盖两种明确输入包装、替换/续写的场景区别、旧记录恢复、无记录真实目标、纯开场、失败后空闲 START 与后继合批追平；不改变提示词、模型、schema、后台调用次数或宿主设置。离线检查只证明分区和状态机制，实际叙事采用仍需根任务冻结后验证。

独立审查补充：完整复核 host.capture 的全部 null 返回原因，发现其还包括无有效作用域、活动 swipe 与 mes 未对齐及空用户输入，不能用 null 本身证明纯开场。只有作用域有效、没有任何非系统用户消息且助手展示与活动 swipe 一致时，才按纯开场保持零调用和无遗漏；其余未确认目标显示未追平。restore 在 await locate 后须再次 guard 精确前缀，并核对 target.index 仍是当前 latestIndex，才能把命中的存档称作最新覆盖；host.assertTarget 允许后追加正文，单独该守卫不够。这个补充只加强恢复显示，不增加自动补跑、状态字段或持久 schema。

实施结果：以上三处机制修复及恢复边界已落盘。定向离线检查 `node --test tests/guidance-runtime.test.mjs tests/guidance-host-save.test.mjs` 共 **41/41** 通过（runtime 37 项、保存屏障 4 项）。新增测试使用真实 host.capture 和真实 evolve/reveal，模型返回与存储均为合成输入；包含包装历史不再回流、重生成排除旧正文而续写保留、失败后不误报追平、旧记录与未确认 swipe/空用户/无效作用域的恢复，以及异步读回期间追加新正文不能误报最新。未连接真实宿主、未调用模型；根任务仍需统一冻结并验证当前候选，不能把离线通过当作实际叙事已采用。
