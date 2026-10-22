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
