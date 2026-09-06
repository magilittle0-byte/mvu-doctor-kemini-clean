// Minimal adaptation through Story Oracle's native diagnoseSystemPrompt slot.
// The reference file and its context/output builders remain unchanged.
import { fault } from './core.mjs';
const OLD_AUTHORITY = '至关重要——当前状态才是事实依据，而非更新区块：';
const NEXT_SECTION = '什么才算真正的缺陷';
const AUTHORITY = `至关重要——分清“实际写入了什么”和“本轮确实发生了什么”：
- 当前stat_data证明当前存储结果；最终正文和用户明确输入证明事件及其完成条件。规则定义字段含义、结构和触发条件，不能证明触发事件已发生。
- 先逐项确认本轮已完成、仍有条件未满足和仅被建议的变化，再检查当前值。操作已经生效只代表执行成功，仍可能错写、提前兑现或遗漏配套变化。
- 字段缺失只有在其更新条件已满足时才是缺陷。初始化规则同样先核对触发条件，不得把“以后发放、完成后领取、待选择”当作已经取得。
- 容器按本卡的实际含义使用。尚未交付的物品不得为凑齐档案而放入可用背包；除非本卡明确规定该容器就是待领账册。已有错写应纠正，已真实获得的物品应完整保留或补写。
- 冗余操作不是缺陷；已存在条目的内容、归属和发生时机仍要核对。不得为了证明原更新成功而忽略它与正文的矛盾。

`;

export const EVIDENCE_INSTRUCTION = `【本轮变量核对任务】
本次是正文生成后的变量核对，不续写故事。
请审计整个当前 stat_data，而不只是最新一次更新：把当前 stat_data 与完整对话记录进行核对，修正任何偏差，但同样要保守。
先按当前卡的完整路径区分玩家操作、前端计算与正文应更新的字段；前端托管字段只读，同名字段在不同主体下可能有不同所有者。
角色卡与用户已确认的身份、天赋和设定保持不变。规则中的条件句必须保留条件，示例、规划、选项、NPC尝试和未裁决结果不能充当已完成事实。
依更新前MVU、本轮明确输入与最终正文，逐条检查本卡check规则已经触发的字段，包括原更新块完全没有提到的条目；已触发而缺失的须补齐，条件未满足的不得写入。原更新块只作为待检查的操作记录，不能限定审计范围，也不能反过来证明剧情发生。
正文未透露真名的已交互角色，按本卡允许的正文称谓定位，不编造真名，也不能因此漏掉规则要求的关系记录。已有同一人物应沿用原身份，不重复创建。
物品存在、约定归属和实际交付是不同状态。可用背包与装备栏表示已经取得、可以取用；“已为你准备/具现，完成条件后前去领取”仍未交付，不能从装备栏移到背包来保留一次提前发放。按前态保留已持有物品；正文真正取得、交付或消耗之后，才完整更新相应库存。仅当本卡明确设有待领账册时才在那里记录未交付权益。
只补足当前状态的差额，不重放原增量，不重复累加派生加成；有无内联更新块都要看当前真实状态。
同一加成只保存在它的权威来源中。前端会合算已登记的天赋、装备、职业等来源，不能为使派生总值立即匹配而把同一来源再抄入基础值或自定义加成。源字段确有独立错误时只修正那个来源。
在Analysis简短列出每个实际缺陷的当前值、对应已完成事件或尚未满足的条件、正确值；规则本身不能充当事件完成证据。尚未满足条件的字段保持未发生，已经错误兑现的字段须修正。不得为了补全字段而提前发生事件。
只输出唯一的最小UpdateVariable/JSONPatch，完整修复所有已定位问题；没有实际缺陷则返回空数组。`;

export function adaptDiagnosisPrompt(base) {
  let prompt = String(base || '');
  const start = prompt.indexOf(OLD_AUTHORITY), end = prompt.indexOf(NEXT_SECTION, start);
  if (start >= 0 && end > start) prompt = prompt.slice(0, start) + AUTHORITY + prompt.slice(end);
  // The native output contract and saved user override remain intact.
  // The per-turn evidence task is sent once in the native final user slot.
  return prompt;
}

export function currentNarrative(so, ctx, settings, target) {
  const row = ctx.chat?.[target.index];
  if (!row || row.is_user || row.is_system || String(row.mes || '').trim() !== target.content) throw fault('narrative_target', '当前正文投影没有绑定到精确助手楼层');
  // Reuse the same host regex processing that Story Oracle already applies
  // to the transcript. Raw target content stays intact for identity checks.
  const turns = so.buildTranscriptTurns({ ...ctx, chat: [row] }, { ...settings, contextDepth: 1 }, false);
  if (turns.length !== 1 || turns[0].role !== 'assistant' || !String(turns[0].text || '').trim()) throw fault('narrative_missing', '原生正文投影为空，未使用原始规划或变量块冒充正文');
  return String(turns[0].text).trim();
}
