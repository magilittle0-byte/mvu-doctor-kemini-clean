# 第一阶段：将实际连接配置纳入旧候选校验

2026-09-06，修改前来源映射。0.10.7 第一轮已拒绝，0/12，三个模块未锁定。

受控复现：模型请求开始后只更改同一 profile ID 下的 model，原实现仍接受空补丁并报告 model_nochange。旧指纹只含 profileId 和 Doctor 表单中的 model，遗漏原生请求实际读取的配置。本项不是此前语义漏检的根因证明。

已重新检索项目及历史源码的 configHash、modelFingerprint、routeFingerprint 和 profile/extra_model；相关成熟来源为已安装宿主的 ConnectionManagerRequestService，以及 ChatCompletionService 和 Story Oracle。旧 v2 transaction/fingerprint 处理消息身份，不能移植成连接快照。

- 原样复用 Story Oracle 1.35.4 的 callProfile（15663 起）、callDirect、resolveEndpointUrl，继续由原生 ConnectionManagerRequestService 发请求；不复制请求构造器。
- 完整阅读当前宿主 getProfile、validateProfile、sendRequest，以及 ChatCompletionService.createRequestData、processRequest、presetToGeneratePayload。实际请求读取 profile 的 API、模型、地址、secret-id、preset、proxy、后处理；预设又继承当前 completion settings。
- 最小适配：通过同一原生 getProfile/validateProfile/getPresetManager 读取实际配置。当前 openai.js 的公开 proxies 导出用于定位所选代理；不读出凭据值到日志、报告或模型输入。配置只在内存中散列，持久记录仅保留摘要。直连把 endpoint、directRawUrl、directViaBackend 和密钥变更纳入摘要。
- 新写必要的 host.modelRouteHash，把当前配置摘要接入现有 configHash、请求前后检查、已完成记录复核。官方发送、MVU 解析、提交与恢复状态机不变。原参考没有 Doctor 的在途候选收据，因此该接线不能原样移植。
- 配置无法读取时停止本次旧候选，不能以 profile ID 代替实际配置。原始异常不外露。受控检查覆盖同 ID 模型/地址/预设/默认采样/代理变化、直连地址/模式变化以及已完成收据失效；它们不是酒馆验收。

本次只修连接失效边界，不声称解决关系记录和区域时间漏检，不开始人物或世界模块。
