# 指导宿主接缝来源与边界

日期：2026-10-22。执行当前唯一真实协议 2A 后记录；这份文件只描述宿主适配，不替代总设计、NEXT 或真实产品验收。

目标：指导独立读取准确正文、当前卡与有效世界规则，通过宿主当前连接发出自己的单次辅助请求，并只管理自己的前置提示。红线：不启动旧三模块，不写 MVU、数据库、角色卡、世界书、预设或其他扩展设置，不保存凭据。验收：定向离线检查只证明隔离和身份保护；主/辅助事件、真实提示位置、真实模型与存档闭环仍按当前协议验证。

本表是初始接缝来源。后续真实宿主发现及当前候选修正见 runtime-source-map.md：Helper 的辅助请求也可报告 normal；普通新输入按 MESSAGE_SENT 建立门，类型仅为附加约束；500ms+150ms只检查内存稳定，严格存档尚未对应时继续只读确认，不能把固定延迟当作保存完成。

## 2A 搜索与复用账本

已重新检索项目与历史资料中的旧医生、故事神域、数据库及模板、糖糖/Izumi/缝合怪、Z 论坛、角色卡/世界书、K3 和宿主检查记录。当前路径的可执行机制集中在下列文件；预设/卡文本不是宿主 API 的实现来源，不复制私人设定。

| 数据路径 | 已完整读取的相关实现及上下游 | 采用方式与限制 |
|---|---|---|
| 正文与聊天身份 | `modular/host.mjs:53-116`；`modular/runtime.mjs:56-120` | 最小移植 scope、真实助手/用户、swipe 一致性与异步后再核对；增加整段前缀签名。保留中间已接受正文读取，是否允许提交由唯一 runtime 的 epoch 决定。 |
| 分支与历史 | `profiles/host.mjs:88-100`；`modular/transcript.mjs:1-41` | 移植按当前前缀生成 lineage；用户原输入只解数据库明确包裹，不给用户套助手正则；不加载 profile host。 |
| 只读存档核验 | `modular/host.mjs:166-187` | 只请求宿主现有 `/api/chats/get`，比对前缀和目标；不调用 saveChat，不比较或写变量。群聊读回未验证，显式失败。 |
| 实际卡与世界规则 | `vendor/story-oracle-v1.35.4/index.js:2085-2110,2166-2266,13154-13165`；`profiles/host.mjs:50-61`；当前宿主 `world-info.js` 的 getWorldInfoPrompt/checkWorldInfo | 卡字段读取最小移植。**不移植 dry-run 扫描**：当前源码即使 dryRun 仍可能写作者注提示和外部扫描效果。改由唯一 runtime 捕获主 ticket 的 WORLD_INFO_ACTIVATED，并在主 prompt-ready 后把原条目传给 material；host 不重新扫描、不执行宏。未捕获则明确规则缺失，只能做有依据的有限推演。 |
| 当前连接 | `real-tauritavern-qc/run-state/modular-cost-0129/current-host-customRequest.js:420-608`；`modular-p3-r6/host-source-shared.js:423-527`；`docs/modular/PHASE1_NATIVE_MODEL_PROFILE.md` | 不把保存的 profile 当当前连接。调用当前 getChatCompletionModel(settings)，用 native presetToGeneratePayload({}, {}, overrides) 建当前 payload，再 native sendRequest(payload,true,signal)。processRequest 无 preset 时不会自动补当前模型，因此不裸调它。所有 payload 和凭据只留内存；只返回路由哈希与模型正文。 |
| 前置提示与销毁 | `world/runtime.mjs:56-86,297-340` | 只保留自有 key 的 set/clear；runtime 负责主生成绑定与实际 promptObserved，不在 host 建事件状态机。销毁只清指导 key、取消自己的真实 AbortController。 |
| 主/辅助 END 风险 | `docs/world/PHASE3_SOURCE_MAP.md:3-11`；`modular/runtime.mjs` 全文 | 全局 END 没有可信请求身份，旧现场已发生辅助 END 早到。必须由 runtime 配对主 START/RECEIVED、等待主生成结束、500ms+150ms fresh read 与存档读回。不得清除提示或接受旧楼来兜底。 |

主工程 Skill 为 `sillytavern-extension-dev`，接口核对使用 `sillytavern-api-reference`；库路由 `sillytavern-extension-dev`、快照 `2026-08-18`，读取 ST-A0、ST-D5、ST-E5 和宿主/iframe 分层参考。设计候选未引入新的 UI 或 iframe 架构。

## 当前宿主能力证据

本任务父代理于 2026-10-22 通过已登记回环 CDP 的 Playwright 只读核对：TauriTavern 报告 Tavern 1.18.0，Tavern Helper 4.9.3；context、事件 on/removeListener/makeFirst、卡字段、世界扫描、前置提示、保存/请求头、原生连接服务和 ChatCompletionService 可用。已核当前 `presetToGeneratePayload`、`sendRequest` 源结构；`/scripts/openai.js` 的 `getChatCompletionModel` 与 `/script.js` 的 `getMaxPromptTokens` 导出可用。没有通过此探针调用模型。

`setExtensionPrompt(key,value,position,depth,scan=false,role=SYSTEM,filter=null)`；世界扫描虽有 `getWorldInfoPrompt(chat,maxContext,isDryRun,globalScanData)`，指导不调用它。提示采用指导独立 key，position=1、depth=0、scan=false；不清他人的 key。

`CHAT_COMPLETION_PROMPT_READY` 的当前形状为 `{chat,dryRun}`。`GENERATION_ENDED` 来自 hideStopButton，并携带 chat.length，而非生成请求 ID。context 未暴露 `is_send_press`；不能把 undefined 当成空闲证明。当前源码的宿主忙闲标记为 `document.body.dataset.generating`，host 仅作版本绑定读取；runtime 仍须主事件配对和最终目标读回。

### 本轮代码完成前发现的扫描副作用及 2A 回查

再次沿世界读取链核对成熟实现与当前宿主：参考快照 `real-sillytavern-qc/app/public/scripts/world-info.js:5149-5157` 在 `shouldWIAddPrompt` 时直接写 `NOTE_MODULE_NAME`，随后 resetExternalEffects/cleanUp；父代理当前 1.18.0 源码探针确认仍无 `!isDryRun` 保护。旧 Story Oracle 只保证 dry-run 不发激活事件、不推进部分计时效果，不能推出整次只读。此发现否定最初 dry-run 方案；改用主请求已经产生的激活事件快照，避免复制并补偿他人提示状态。捕获到的条目是宿主报告的激活来源，未自行执行其中宏，也不声称每个输出位置都被主模型实际消费。

## 待真实闭环关闭的边界

- 主/辅助并存下的接受顺序、前置提示是否真正进入正确主请求，不能由函数存在或离线返回证明。
- 当前连接的真实传输、取消完成时点与模型输出尚需真实调用；失败不自动重试，不更换 profile 或模型。
- 世界规则取主 ticket 捕获的实际激活条目，原文宏不再次运行；不声称覆盖全部世界书或保证模型实际消费。不主动扫描、不执行世界书中的脚本，也不读写 MVU/数据库。
- 群聊存档读回、手机真机和其他版本不在当前能力证据内，失败必须显式显示。
- product store 可以保存自己的世界记录；本文件和测试只使用虚构样例，不保存私人原文、完整提示、模型原始返回或凭据。
