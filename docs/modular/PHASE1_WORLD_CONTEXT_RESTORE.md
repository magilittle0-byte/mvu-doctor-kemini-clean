# 第一阶段：恢复原版诊断的世界规则取材

2026-09-06，修改前核对。0.10.2（ffbc53b）真实首轮仍失败，医生26.948秒、4项操作；独立宿主读回确认待领装备被写入可用背包，同一天赋又进入基础属性。已拒绝，批准0轮，停止继续生成。原生当前正文投影1921字，无规划标记，证据合同确实进入请求；不能再将本次失败归因于规划没有过滤。

## 完整来源与调用链

本次重新检索整个项目中的旧医生、参考归档、数据库模板、糖糖、Izumi、缝合怪、Z论坛及实际变量材料。完整阅读Story Oracle 1.35.4的runAutoDiagnose及maybePostReply调用、buildDiagnosePromptFrom、buildCardSection、buildTranscriptTurns、wiContextMode、buildWorldInfo、buildWorldInfoSplit、collectMvuRuleContents/collectMvuUpdateRules、getWiScanBudget和callDirect/callProfile；同时对照旧profile-engine.js的runStoryDiagnosis规则取材及当前模块、宿主绑定链。实际本轮完整更新规则、原更新、正文、医生返回及变化已本机分页核对，私人内容不提交。

原版runAutoDiagnose先调用buildWorldInfo(wiContextMode(s))，再调用collectMvuUpdateRules(wiBlock)补回扫描可能剥掉的变量机制条目；手选模式保留用户精选。旧Doctor后来将这一组合改成“找到mvu_update就只用它”，当前模块继承了这处改动。因此它不是原版完整规则取材的等价复用。

现场元数据证明，当前模块只取得13558字变量条目，原版同作用域扫描另有约66742字世界规则，其中包含物品取得和天赋设定。没有证据证明仅恢复它便能消除所有语义错误；本候选必须新聊天实测。

## 最小适配边界

- 原样复用：诊断世界上下文恢复buildWorldInfo + collectMvuUpdateRules(existingBlock)的原版组合及去重，沿用wiContextMode和手选分支，不新增语义筛选器，不另开世界引擎。
- 保留：现有稳定的原始MVU更新条目仍用于精确字段权限及ruleHash；本次现场连续两次真实世界扫描的展开结果不同，因此不把动态展开全文冒充稳定权限规则或刷新时的源码哈希。
- 最小适配：记录实际发送上下文的hash用于本次证据绑定；worldInfoMode加入已有配置变更校验。原有最终正文、前态、当前态、原更新和独立存档读回仍保留。
- 本次不改诊断提示合同，不更换模型、温度、预设或角色卡，不添加第二模型、派生值计算器或自动语义通过。
- 快速检查只验证完整上下文取材、不丢变量条目、保留精选分支；不能证明变量正确。真实首轮失败记录及旧快速检查不计入新指纹验收。

未锁定变量模块；人物档案和世界模块仍未制作。
