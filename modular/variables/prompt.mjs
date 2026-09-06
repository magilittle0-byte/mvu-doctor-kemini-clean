// Minimal adaptation through Story Oracle's native diagnoseSystemPrompt slot.
// The reference file and its context/output builders remain unchanged.
const OLD_AUTHORITY = '至关重要——当前状态才是事实依据，而非更新区块：';
const NEXT_SECTION = '什么才算真正的缺陷';
const AUTHORITY = `至关重要——分清“实际写入了什么”和“本轮确实发生了什么”：
- 当前stat_data证明当前存储结果；最终正文和用户明确输入证明事件及其完成条件。规则定义字段含义、结构和触发条件，不能证明触发事件已发生。
- 先逐项确认本轮已完成、仍有条件未满足和仅被建议的变化，再检查当前值。操作已经生效只代表执行成功，仍可能错写、提前兑现或遗漏配套变化。
- 字段缺失只有在其更新条件已满足时才是缺陷。初始化规则同样先核对触发条件，不得把“以后发放、完成后领取、待选择”当作已经取得。
- 容器按本卡的实际含义使用。尚未交付的物品不得为凑齐档案而放入可用背包；除非本卡明确规定该容器就是待领账册。已有错写应纠正，已真实获得的物品应完整保留或补写。
- 冗余操作不是缺陷；已存在条目的内容、归属和发生时机仍要核对。不得为了证明原更新成功而忽略它与正文的矛盾。

`;

export const EVIDENCE_INSTRUCTION = `本次是正文生成后的变量核对，不续写故事。
先按当前卡的完整路径区分玩家操作、前端计算与正文应更新的字段；前端托管字段只读，同名字段在不同主体下可能有不同所有者。
角色卡与用户已确认的身份、天赋和设定保持不变。规则中的条件句必须保留条件，示例、规划、选项、NPC尝试和未裁决结果不能充当已完成事实。
依更新前MVU、本轮明确输入与最终正文逐项判断本轮应有状态，再与当前MVU比较；原更新块只作为待检查的操作记录，不能反过来证明剧情发生。
只补足当前状态的差额，不重放原增量，不重复累加派生加成；有无内联更新块都要看当前真实状态。
在Analysis简短列出每个实际缺陷的当前值、已满足的事件条件或规则依据、正确值；尚未满足条件的字段保持未发生，已经错误兑现的字段须修正。不得为了补全字段而提前发生事件。
只输出唯一的最小UpdateVariable/JSONPatch，完整修复所有已定位问题；没有实际缺陷则返回空数组。`;

export function adaptDiagnosisPrompt(base) {
  let prompt = String(base || '');
  const start = prompt.indexOf(OLD_AUTHORITY), end = prompt.indexOf(NEXT_SECTION, start);
  if (start >= 0 && end > start) prompt = prompt.slice(0, start) + AUTHORITY + prompt.slice(end);
  // Native user overrides remain present; the module's evidence contract has
  // one location, instead of appending contradictory rules after the story.
  return `${prompt}\n\n【变量模块证据合同】\n${EVIDENCE_INSTRUCTION}`;
}
