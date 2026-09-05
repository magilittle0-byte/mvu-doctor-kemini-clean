# 模块式重建：第一阶段修改前来源映射

日期：2026-09-05。用户已授权按根目录制作计划持续实施并设立Goal。
本阶段仅变量修复，人物档案、世界引擎尚未制作，不加载旧业务链。

## 现场基线

- 工作目录：`mvu-doctor-kemini-clean`；`origin`：`https://github.com/magilittle0-byte/mvu-doctor-kemini-clean.git`；分支：`main`。
- 修改前HEAD：`2ef64011130da421bc034c79a2816c66851053ac`，完整工作树干净。
- 旧运行版本0.9.11真实首轮未通过，不能作为新模块功能基线。旧入口及其人物/世界代码保留。
- 新候选使用独立`modular/`入口；不删除历史代码，不接管2.0测试仓或正式仓。

## 已阅读的完整机制及处理

| 数据路径 | 实际来源 | 分类与边界 |
| --- | --- | --- |
| MVU读取、解析、写入 | 官方`mvu-integration/official-b428179/.../src/function/global/index.ts`的`createMvu`；`update_variables.ts`的`updateVariables/handleVariablesInMessage` | 原样调用宿主MVU。`parseMessage`会触发官方事件和schema归一化；不能另造本地更新执行器，不能只以其返回存在判成功 |
| 规则收集 | Story Oracle 1.35.4 `collectMvuRuleContents/collectMvuUpdateRules/buildDiagSelectedWi` | 原样调用；保持用户手选。取回当前规则而非硬编码某张私人卡的内容 |
| 模型连接 | 同版`callDirect/callProfile`及已有配置 | 原样调用当前真实连接；不把密钥复制到新文件、报告或日志；模块使用自己的取消信号，不继承原版240秒总超时 |
| 原生诊断提示和输出 | 同版`DIAGNOSE_SYSTEM_PROMPT/buildDiagnosePromptFrom/extractUpdateBlock` | 最小适配。保留诊断和最小修复原则；修正“有更新块就必然全部生效/无更新块就必然未更新”的假设，明确前后态与实际事件的关系 |
| 最终正文身份 | 旧`profile-engine.js`的生成事件、活动swipe、前态扫描和写前校验；当前真实协议 | 提取必要的消息、swipe、正文和作用域绑定。正文事件回调不等待模型，禁止新一轮覆盖旧目标 |
| 前端刷新 | Story Oracle `refreshMessageBar` | 原样调用消息重渲染；不重新发MESSAGE_RECEIVED，不重复执行MVU块 |
| 持久化事务 | 旧`profile-engine.js`的`openDoctorDurableDb/durableWorldStoreBatch`及World 3.0.2 `world-engine-store.js`完整实现 | 最小适配为医生独立命名空间，等待事务完成后独立读回；不加载World调度或把内存镜像当作落盘 |
| 宿主存档读回 | 真实宿主对应`public/script.js`的`getChat`及`st-context.js`的`saveChat`接口 | 最小适配为保存后调用宿主自己的`/api/chats/get`，核对精确楼层与活动swipe变量；不能以页面内存读回代替宿主存档 |
| 格式容错 | Life State ver5.35已移植到旧`profile-engine.js`的围栏、标点、平衡括号、尾逗号处理 | 提取兼容JSON数组解析；只做格式归一化，不执行模型代码，不增添丢失语义 |

## 真实错误决定的适配内容

旧0.9.11失败记录已读：变量模型写了前端托管字段，漏掉尚未发生的物品领取。当前实际角色规则已完整阅读：部分字段由前端计算，敌人的同名派生字段却明确需要AI填写。因此禁止按叶字段名全局封禁，也不能把物品出现在更新块里当作已经取得。

新增的必要部分：由当前结构化变量规则定位明确的字段权限，校验修复触及的精确路径；医生提示区分已发生事实、计划/奖励说明和前端计算；对原始漏更新与误更新检查完整当前状态。权限校验只处理明确声明的写入权限，不把自由正文变成关键词语义审查器。存在冲突时定向重试完整修复，不偷偷删掉补丁中的问题项。

新模块边界、阶段锁清单和组合注册接口在成熟来源中不存在，按本次用户需求补写。具体差异及测试证据将随实现更新；本文件不宣称实现或验收已通过。

第一阶段UI仅展示变量检查、重试/取消及一个全局附加提示入口；旧五标签面板会加载后两阶段业务，因此新写独立阶段面板，不声称复用旧完整UI。旧版manifest/package按基线Git对象原样保存，旧业务代码及测试继续保留；新版版本检查针对manifest实际选择的入口。

## 私人材料和证据

当前卡片、世界书、正文、首回合和真实连接只在本机运行/核对；本仓不复制私人规则原文、原始返回或聊天资料。受控检查只用合成样本。真实阶段验收仍要求当前完整候选的十二个连续有效回复，耗时仅记录。
