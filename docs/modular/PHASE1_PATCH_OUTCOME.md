# 第一阶段：部分补丁未生效的修复依据

2026-09-07，0.10.12 的真实同聊第4轮已拒绝。四项补丁中一个标量替换未落地，另三项改变了状态；医生却报告 applied。官方候选、存档和实际卡片前端一致，只能证明错误结果被保存，不能证明全部修复生效。

## 修改前来源核对

已重新检索项目历史中的官方 MVU、旧 Doctor 事务、数据库分组提交与当前模块源码；完整阅读以下相关实现及调用段。

| 来源 | 实际机制 | 本次使用 |
| --- | --- | --- |
| `tauritavern-system-knowledge-archive/current/mvu-auto-doctor/core.mjs` 的 pointerGet/parentInfo/deepSubset、simulateOps、preparePatch、validatePatchResult | 克隆生成预期结果，再逐路径比较官方候选的存在性和值 | 最小适配为只读预期验证；预期对象绝不用于写入，唯一执行和持久化仍经官方 MVU |
| `mvu-integration/official-b428179/MagVarUpdate-b42817925d0391c15fa242a8238d2bbe28eb6319/src/function/update_variables.ts` 的 extractJsonPatch/updateVariables | 先发 COMMAND_PARSED 的 Zod hooks，后执行剩余命令；单条失效不保证整批失败 | 保留官方执行，不替换其 Schema 或事件 |
| 本机既有取证 `real-tauritavern-qc/run-state/modular-p1/loaded-mvu-zod.js` 的 registerMvuSchema 完整实现 | Zod hook 按顺序处理 set/add/insert/delete/move，每条 safeParse；清空剩余命令。move 是 delete 后 set，insert 对象键覆盖，数组 splice；delta 只接受数字 | 校准预期验证与当前宿主方言；不能从旧 bundle 缺少 move switch 推断当前不支持 move |
| 当前 `modular/variables/module.mjs` 与 `groups.mjs` | 各组互斥、完整返回缓存、统一 parse 后提交、写入前版本检查与真实保存读回 | 保留此事务和重试；未落地路径通过现有失败反馈重新生成，失败候选不写入 |

旧 simulateOps 的 insert 已有键拒绝、move 数组插入与当前 Zod 方言不同，因此不能原样使用。旧全量未触碰字段不变断言也不移植：本卡前端会合法重算派生字段。只比较补丁要求的最终目标及删除结果，允许 Schema 增补未请求的默认字段；不把此结构验证声称为正文语义验收。

以上只读预期投影草稿已撤回，未提交、未安装、未当作验收：复核 README 的0.9.7历史后确认，Schema可合法把标量归一化为对象；仅比较模型原值会重引此前假失败。其57项受控检查不证明这一方案合格。

最终采用官方执行收据。已完整读取原宿主实际 eventSource 的 on/makeFirst/makeLast/removeListener/emit，以及当前 TavernHelper 包装监听器；emit按注册顺序await，包装器原样传递参数与返回Promise。官方parseMessage克隆输入，依次await COMMAND_PARSED_for_zod和COMMAND_PARSED_ended_for_zod。当前Zod在前者移除已产生效果的命令，后者清空剩余命令。

最小适配是在前者最前记录本次命令引用，在后者最前复制官方剩余命令；一次性nonce精确绑定原始patch字符串，双事件同一数据/命令引用，每次parse的finally移除自己的监听。没有收到完整同次收据就不提交。官方对合法Schema归一化后的结果拥有全部解释权，不再生成本地预期状态。未执行项走现有重试反馈，仍只提交全部成功后的唯一官方候选。

新增部分仅为官方事件收据与模块错误对象的接缝及相关回归；不新增调度器、状态写入器、人物模块、世界模块或正文审查器。任何新候选均须从新聊天重新进行当前源码对应的真实验收。

同轮另确认日期占位不符合卡片字段的format声明。主智能体再次完整阅读对应规则段：format与check是同级字段，而现有分组任务明确要求逐项说明check但没有明确覆盖同级格式。模型实际收到完整格式声明（输入存在，未被截断），仍漏报。最小提示适配仅把原字段合同中的type/format/允许值列入同一核对项，不新增日期规则、硬编码场景或本地格式解释器；其效果仍待新候选实测。

本机克隆诊断已实际运行当前生产parseOfficialCandidate函数：原被拒绝回合的4条补丁中官方收据保留1条副本类型命令，准确复现遗漏。真实活变量未改变，监听数恢复，未调用模型或保存，不计入12轮验收。
