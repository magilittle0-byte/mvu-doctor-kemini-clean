# 第一阶段：原生连接配置的真实模型候选

2026-09-06，配置调整与0.10.7版本修改前记录。当前0.10.6真实首轮已拒绝；更换消息结构、恢复后态说明和隔离原操作仍未使原医生路线完成全部修复。一次使用当前正文真实模型/路线的只读比较，在同一冻结messages上正确给出已分配点数、未交付装备和关系记录三项修复，没有类型误报；完整返回已本机阅读。角色卡前端330–455行再次核对，当前负重由装备总重量计算，因此不应额外手写差额。此次没有执行补丁，74.389秒，聊天、MVU、模型设置均不变。它不是十二轮验收，也不能单独证明模型或提供方某一因素是根因。

已重新检索完整项目的连接配置、原生模型路由与旧医生调用方式；读取当前宿主公开connection-manager/index.js、shared中的ConnectionManagerRequestService，以及custom-request.js的ChatCompletionService和openai.js的createGenerationParameters。完整读取原生getProfiles/refreshProfiles/callProfile、配置命令读取/快照/创建、profile-create调用与持久化、sendRequest/validateProfile/presetToGeneratePayload。

复用边界：
- 原样使用Story Oracle已有profile模式和callProfile，不增加第三种模型客户端，不复制API密钥。
- 当前正文真实模型为Gemini 3.1 Pro，现有已保存profile却指向旧Gemini 3 Pro，不能冒充相同配置。使用酒馆原生profile-create将当前实际设置另存为独立验收连接，不覆盖旧配置。
- 凭据由原生secret-id引用及后端管理；不导出、打印或写入脚本/仓库。Doctor选择这个原生profile，输出预算取当前正文配置，采样继承同一预设；正文持久模型参数不改。
- 采用这个连接的是下一候选的变量验收，明确报告实际目标模型；不把原医生路线或0.10.6结果改名为通过。仍须全新聊天十二轮与存档/UI独立核对。

最小适配仅测试环境中的连接选择和版本/说明。运行模块已支持profile调用，不新增路由代码。已有持续真实测试/修复授权覆盖此处两条现有路线；调整已向用户说明，未新增外发目的地或更改预设内容。对照的一次成功不能取代新候选实际运行证据。
