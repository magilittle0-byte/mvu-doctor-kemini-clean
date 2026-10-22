// Pure prompt projection: no world settlement, player-intent execution, or adoption judgement.
const activeExposure = entry => !['shown', 'retired'].includes(entry.status);
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';

export function currentGuideInput(value = '') {
  const input = text(value);
  // Chinese tags do not have a JavaScript word boundary before `>`.
  const matches = [...input.matchAll(/<(user_input|本轮用户输入|current_user_input|input)(?=[\s>])[^>]*>([\s\S]*?)<\/\1\s*>/gi)];
  if (!matches.length) return input;
  const last = matches.at(-1), before = input.slice(0, last.index).trim(), after = input.slice(last.index + last[0].length).trim();
  const standalone = !before && !after;
  const database = input.trimStart().startsWith('以下是用户的本轮输入：') && last[1] === '本轮用户输入';
  const stitches = last[1].toLowerCase() === 'user_input'
    && /^<story(?=[\s>])[^>]*>[\s\S]*<\/story>\s*(?:═══ 故事信息结束，下接user_input ═══)?$/u.test(before)
    && (!after || after === 'DM爱德华：好，user_input我看到了，我会寻找相关记忆。');
  // A quoted tag inside an ordinary sentence is not a producer envelope.
  return standalone || database || stitches ? last[2].trim() : input;
}

function sceneText(scene) {
  if (typeof scene === 'string') return scene;
  return [scene?.text, scene?.recentText, scene?.location, ...list(scene?.subjects), ...list(scene?.inventory)]
    .filter(value => typeof value === 'string').join('\n');
}

function relevant(matter, input, scene) {
  if (list(scene?.relatedMatterIds).includes(matter.id)) return true;
  const context = `${input}\n${sceneText(scene)}`.toLocaleLowerCase();
  // Entity selection only, never a semantic claim that a condition or adoption occurred.
  return list(matter.subjects).some(subject => text(subject).trim().length >= 2 && context.includes(subject.toLocaleLowerCase()));
}

const VIEW_BOUNDARY = `[指导 · 叙事边界]\n正文、状态栏、任务框和系统提示展示都只呈现世界规则与当前视角实际感知、亲历或获告知渠道支持的信息；不得换用展示框或全知旁白提前泄露幕后过程、身份、动机和未被获知的风险。叙述者全知说明、规划或系统调试不自动成为角色知识。获知手段须有现有世界规则、该主体已具备的能力和实际使用条件支持；不得仅凭职业、计划或解释需要，临时编造穿透封闭容器、远距全知等获知能力。已设定的合法探测能力与实际可感知迹象仍按设定生效，不能由有限迹象直接得出未知全貌。客观风险或未知结果不能仅为顺从玩家计划直接改判成安全、收益或必然成功，须按既有规则与真实条件裁定。各主体按自己的已知信息、动机和能力自主行动，不替玩家决定、答应、查看、理解或产生感受。玩家输入是意图，只有正文实际完成的行动、经过的时间及满足的条件才算发生。没有依据的变化保持未知或潜伏，不强造转折。这些是叙事边界，不是未来事实，不要把本段规则抄给玩家。`;
const HEADER = `${VIEW_BOUNDARY}\n\n[指导 · 私下因果约束]\n以下只用于当前场景的因果连续性，不能整段抄给玩家。已成立事实具有约束力，不能因为此前正文没写就抹除。条件项只是分支：只有本轮正文实际经历对应时间、接触或传播才发生；不满足则继续潜伏。已显露入口不重复演出；若已接受正文已演出此动作，即使指导还在等待核对，也只延续后果，不重演同一攻击或行动。遇到已接受正文与既成事实的矛盾，不倒改事实或补造前因，保留未解边界。`;

function renderMatter(matter, entries, shown = []) {
  const factIds = new Set([...entries, ...shown].flatMap(entry => list(entry.factIds)));
  const conditionIds = new Set(entries.flatMap(entry => list(entry.conditionIds)));
  const facts = list(matter.facts).filter(item => factIds.has(item.id));
  const conditions = list(matter.conditions).filter(item => conditionIds.has(item.id));
  const pieces = [`事项 ${matter.id} · ${matter.title}`];
  if (facts.length) pieces.push(`【已成立，知情范围不等于玩家知道】\n${facts.map(item => `- ${item.text}（当前知情：${list(item.knownTo).join('、') || '无主体获知'}）`).join('\n')}`);
  if (conditions.length) pieces.push(`【未来条件，尚未自动结算】\n${conditions.map(item => `- 若 ${item.when}，则 ${item.change}`).join('\n')}`);
  const ready = entries.filter(entry => entry.readiness === 'ready');
  const conditional = entries.filter(entry => entry.readiness === 'conditional');
  const render = entry => `- [${entry.id}] 渠道：${entry.route}；适用：${entry.when}；可感知：${entry.visible}${entry.status === 'conflict' ? '（上次正文存在冲突，不能无声覆写或重复旧动作）' : ''}`;
  if (ready.length) pieces.push(`【影响已经抵达，可按当前场景自主演出】\n${ready.map(render).join('\n')}`);
  if (conditional.length) pieces.push(`【仅在本轮实际触发时展开】\n${conditional.map(render).join('\n')}`);
  if (shown.length) pieces.push('【连续性】此处包含之前已显露入口的必要事实，仅保持其后续影响；不得重演原动作。');
  return pieces.join('\n');
}

/** Entire relevant matters fit or are omitted with coverageLimited; no half-entry truncation. */
export function buildGuideReveal({ snapshot = { matters: [] }, userInput = '', scene = {}, budgetChars = Infinity } = {}) {
  const input = currentGuideInput(userInput);
  const limit = Number.isFinite(budgetChars) ? Math.max(0, Math.floor(budgetChars)) : Infinity;
  const boundaryFits = VIEW_BOUNDARY.length <= limit;
  const candidates = [];
  for (const matter of list(snapshot.matters)) {
    const isRelevant = relevant(matter, input, scene);
    const entries = list(matter.exposure).filter(entry => activeExposure(entry)
      && (entry.readiness === 'ready' || isRelevant));
    const shown = isRelevant ? list(matter.exposure).filter(entry => entry.status === 'shown') : [];
    if (entries.length || shown.length) candidates.push({ matter, entries, block: renderMatter(matter, entries, shown) });
  }
  // Ready effects are not gated on the player naming them. Remaining order stays stable.
  candidates.sort((a, b) => Number(b.entries.some(item => item.readiness === 'ready'))
    - Number(a.entries.some(item => item.readiness === 'ready')));
  const blocks = [], items = [], omittedIds = [];
  let length = HEADER.length;
  for (const candidate of candidates) {
    if (length + candidate.block.length + 2 > limit) { omittedIds.push(candidate.matter.id); continue; }
    blocks.push(candidate.block);
    length += candidate.block.length + 2;
    items.push({ matterId: candidate.matter.id, exposureIds: candidate.entries.map(item => item.id),
      readiness: candidate.entries.map(item => ({ exposureId: item.id, readiness: item.readiness })) });
  }
  return { text: blocks.length ? `${HEADER}\n\n${blocks.join('\n\n')}` : boundaryFits ? VIEW_BOUNDARY : '',
    providedIds: items.map(item => item.matterId), exposureIds: items.flatMap(item => item.exposureIds), items,
    sourceRevision: Number.isSafeInteger(snapshot.revision) ? snapshot.revision : 0,
    coverageLimited: !boundaryFits || omittedIds.length > 0, omittedIds };
}
