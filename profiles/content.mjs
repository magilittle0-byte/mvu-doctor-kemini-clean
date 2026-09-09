const EMPTY = /^(?:n\/a|na|none|null|unknown|未填写|未知|暂无|无)$/i;
const PLACEHOLDER = /^(?:tbd|todo|placeholder|待定|待补|某人|某角色)$/i;

function usable(value) {
  const s = String(value ?? '').trim();
  return s.length > 0 && /[\p{L}\p{N}]/u.test(s) && !EMPTY.test(s) && !PLACEHOLDER.test(s);
}
function at(obj, path) { return path.split('.').reduce((v, k) => v?.[k], obj); }
function stripCodeFence(text) {
  const source = String(text || '').trim();
  const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : source;
}
function normalizeJsonPunctuation(text) {
  return String(text || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/，/g, ',')
    .replace(/：/g, ':');
}
function removeJsonTrailingCommas(text) {
  return String(text || '').replace(/,\s*([}\]])/g, '$1');
}
function balancedJsonCandidates(text) {
  const source = String(text || '').trim();
  const candidates = [];
  for (let start = 0; start < source.length; start += 1) {
    if (source[start] !== '{' && source[start] !== '[') continue;
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') { inString = true; continue; }
      if (character === '{' || character === '[') stack.push(character);
      else if (character === '}' || character === ']') {
        const opener = stack.pop();
        if ((opener === '{' && character !== '}') || (opener === '[' && character !== ']')) break;
        if (stack.length === 0) { candidates.push(source.slice(start, index + 1)); start = index; break; }
      }
    }
  }
  return candidates;
}
function parseJsonCandidate(source) {
  const raw = String(source || '').trim();
  const normalized = normalizeJsonPunctuation(raw);
  const candidates = [raw, ...balancedJsonCandidates(raw), normalized, ...balancedJsonCandidates(normalized)];
  const attempts = candidates.flatMap((value) => [value, removeJsonTrailingCommas(value)])
    .filter((value, index, values) => value && values.indexOf(value) === index);
  let lastError = null;
  for (const attempt of attempts) {
    try { return JSON.parse(attempt); } catch (error) { lastError = error; }
  }
  const error = Object.assign(new Error(`外接模型没有返回可修复的 JSON：${lastError?.message || '未知格式错误'}`), {
    code: 'external_json_invalid',
    response_text: String(source || '').slice(0, 6000),
  });
  throw error;
}

export function parseJsonResponse(text) {
  let source = stripCodeFence(text);
  const tagged = source.match(/^<人物档案\b[^>]*>([\s\S]*?)<\/人物档案>$/i);
  if (tagged) source = tagged[1].trim();
  if (source === 'null') return null;
  return parseJsonCandidate(source);
}

const textFields = [
  ['name', '姓名'], ['identity.species', '身份·种族'], ['identity.gender', '身份·性别'],
  ['identity.age', '身份·年龄'], ['identity.occupation', '身份·职业'], ['identity.affiliation', '身份·归属'],
  ['identity.socialPosition', '身份·社会位置'], ['appearance.overall', '外貌·总体'],
  ['appearance.body', '外貌·体态'], ['appearance.face', '外貌·面容'], ['appearance.hair', '外貌·发式'],
  ['appearance.voice', '外貌·声音'], ['appearance.physiology', '外貌·生理特征'],
  ['appearance.outfit', '外貌·衣着'], ['personality.temperament', '人格·气质'],
  ['personality.coreDesire', '人格·核心欲望'], ['personality.values', '人格·价值观'],
  ['personality.thinking', '人格·思维方式'], ['personality.attachment', '人格·依恋方式'],
  ['personality.socialMotive', '人格·社交动机'], ['personality.interest', '人格·利益取向'],
  ['personality.hobbies', '人格·爱好'], ['personality.conflict', '人格·冲突方式'],
  ['personality.stress', '人格·压力反应'], ['personality.moralBoundary', '人格·道德边界'],
  ['personality.expression', '人格·表达方式'], ['personality.actionHabit', '人格·行动习惯'],
  ['personality.weakness', '人格·弱点与自我欺骗'], ['personality.humor', '人格·幽默'],
  ['personality.biases', '人格·偏见'], ['history', '经历'], ['currentState.location', '当前·位置'],
  ['currentState.condition', '当前·状态'], ['currentState.emotion', '当前·情绪'],
  ['currentState.goal', '当前·目标'], ['currentState.presence', '当前·在场状态'],
];
const listFields = [
  ['aliases', '别名'], ['relationships', '关系'], ['knowledge', '知识'], ['capabilities', '能力'],
  ['resources', '资源'], ['evidence', '证据'], ['inferences', '可修订推断'], ['uncertainties', '未知与误解范围'],
];
export const PROFILE_FIELDS = [
  ...textFields.map(([path, label]) => ({ path, label, type: 'text' })),
  ...listFields.map(([path, label]) => ({ path, label, type: 'list' })),
];
const PROFILE_TEMPLATE = {
  profileId: '精确复制row.profileId；新人由运行时提供', rowId: '精确复制row.rowId', name: '稳定称谓或有依据的姓名',
  aliases: ['正文中的其他稳定称谓'],
  identity: { species: '物种', gender: '性别', age: '年龄或年龄段', occupation: '职业职责', affiliation: '所属', socialPosition: '社会位置' },
  appearance: { overall: '整体形象', body: '体态', face: '面容', hair: '发式', voice: '声音', physiology: '生理特征', outfit: '衣着' },
  personality: {
    temperament: '基础气质', coreDesire: '核心欲望', values: '价值观', thinking: '思考方式', attachment: '关系模式',
    socialMotive: '社交动机', interest: '利益取向', hobbies: '爱好', conflict: '冲突方式', stress: '压力反应',
    moralBoundary: '道德边界', expression: '表达习惯', actionHabit: '行动习惯', weakness: '弱点与自我欺骗', humor: '幽默方式', biases: '偏见',
  },
  history: '连贯经历', currentState: { location: '位置', condition: '身体处境', emotion: '当前情绪', goal: '人物自己的目标', presence: '本轮在场或被提及状态' },
  relationships: ['自然关系说明'], knowledge: ['本人确实知道的内容'], capabilities: ['能力'], resources: ['资源或资源限制'],
  evidence: ['正文或权威设定中的依据'], inferences: ['正文未说明而合理创造、可被修订的补全'], uncertainties: ['本人不知道、误解或无法确认的范围'],
};

export function validateProfile(profile, players = []) {
  const errors = [];
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return ['档案不是对象'];
  if (!usable(profile.profileId)) errors.push('缺少profileId');
  if (!usable(profile.rowId)) errors.push('缺少rowId');
  for (const field of PROFILE_FIELDS) {
    const value = at(profile, field.path);
    if (field.type === 'text') {
      if (typeof value !== 'string' || !usable(value)) errors.push(`缺少${field.path}`);
    } else if (!Array.isArray(value)) errors.push(`${field.path}必须是数组`);
    else if (field.path !== 'aliases' && value.length < 1) errors.push(`${field.path}不能为空`);
    else value.forEach((item, i) => { if (typeof item !== 'string' || !usable(item)) errors.push(`${field.path}[${i}]不是可用内容`); });
  }
  const playerSet = new Set((Array.isArray(players) ? players : [players]).map((v) => String(v ?? '').trim().toLocaleLowerCase()).filter(Boolean));
  const playerLabel = /^(?:user|玩家|用户|主人公|主角|契约者|我|你)$/iu;
  const identities = [profile.name, ...(Array.isArray(profile.aliases) ? profile.aliases : [])];
  for (const value of identities) if (playerSet.has(String(value).trim().toLocaleLowerCase()) || playerLabel.test(String(value).trim())) errors.push('玩家身份不得写入NPC档案姓名或别名');
  return errors;
}

function json(value) { return JSON.stringify(value ?? null, null, 2); }
export function discoveryPrompt(input = {}) {
  return [
    '你是人物发现器。只从普通正文 narrative 识别实际出现或被提及的非玩家人物；不得凭世界书、MVU、卡片、全局提示或预设标签创造姓名。',
    '每人返回 sourceName、evidence、presence。evidence 必须是 narrative 中连续、非空、逐字出现的片段；presence 只能是 present 或 mentioned。',
    '若本轮没有可持续记录的非玩家人物，返回 people:[] 并给出 noCharacterReason。已有完整人物只要本轮出现仍可返回更新；existingProfileId 只能复制 input.profiles 中明确存在的 profileId，绝不能按同名猜测合并。',
    `narrative:\n${String(input.narrative ?? '')}\nuserText:\n${String(input.userText ?? '')}\nmvu:\n${json(input.mvu)}\nauthority:\n${json(input.authority)}\nplayers:\n${json(input.players)}\nprofiles:\n${json(input.profiles)}\nglobalPrompt:\n${String(input.globalPrompt ?? '')}`,
    '只输出 JSON：{"people":[{"sourceName":"...","evidence":"...","existingProfileId":null,"presence":"present"}],"noCharacterReason":"..."}',
  ].join('\n\n');
}
function normalizeProfileId(value, profiles) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !value.trim()) {
    throw Object.assign(new Error('existingProfileId必须为已存在的非空字符串或显式null'), {
      code: 'discovery_existing_profile_id_invalid', recoverable: true,
    });
  }
  const id = value.trim();
  if (!(profiles || []).some((p) => String(p?.profileId ?? '') === id)) {
    throw Object.assign(new Error(`existingProfileId不存在：${id}`), {
      code: 'discovery_existing_profile_id_invalid',
      recoverable: true,
    });
  }
  return id;
}
export function parseDiscovery(raw, input = {}) {
  const parsed = parseJsonResponse(raw) || {};
  if (!Array.isArray(parsed.people)) throw Object.assign(new Error('people必须是数组'), { code: 'discovery_people_invalid', recoverable: true });
  const source = String(input.narrative ?? '');
  const players = new Set((Array.isArray(input.players) ? input.players : [input.players]).map((v) => String(v ?? '').trim().toLocaleLowerCase()).filter(Boolean));
  const profiles = Array.isArray(input.profiles) ? input.profiles : [];
  const people = [];
  const boundExistingIds = new Set();
  const seenEvidence = new Set();
  const playerLabel = /^(?:user|玩家|用户|主人公|主角|契约者|我|你)$/iu;
  for (const item of Array.isArray(parsed.people) ? parsed.people : []) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Object.assign(new Error('人物条目必须是对象'), { code: 'discovery_person_invalid', recoverable: true });
    if (typeof item.sourceName !== 'string' || !item.sourceName.trim()) throw Object.assign(new Error('sourceName必须是非空字符串'), { code: 'discovery_source_name_invalid', recoverable: true });
    if (typeof item.evidence !== 'string' || !item.evidence.trim()) throw Object.assign(new Error('evidence必须是非空字符串'), { code: 'discovery_evidence_invalid', recoverable: true });
    const sourceName = item.sourceName.trim();
    const evidence = item.evidence.trim();
    if (!source.includes(evidence)) throw Object.assign(new Error(`evidence未逐字出现在正文：${sourceName}`), { code: 'discovery_evidence_unbound', recoverable: true });
    if (item.presence !== 'present' && item.presence !== 'mentioned') throw Object.assign(new Error('presence必须为present或mentioned'), { code: 'discovery_presence_invalid', recoverable: true });
    if (players.has(sourceName.toLocaleLowerCase()) || playerLabel.test(sourceName)) throw Object.assign(new Error(`玩家身份不得作为人物：${sourceName}`), { code: 'discovery_player_forbidden', recoverable: true });
    const evidenceKey = `${sourceName.toLocaleLowerCase()}\u0000${evidence}`;
    if (seenEvidence.has(evidenceKey)) throw Object.assign(new Error(`人物证据重复：${sourceName}`), { code: 'discovery_duplicate', recoverable: true });
    seenEvidence.add(evidenceKey);
    const existingProfileId = normalizeProfileId(item?.existingProfileId, profiles);
    if (existingProfileId && boundExistingIds.has(existingProfileId)) {
      throw Object.assign(new Error(`existingProfileId重复绑定：${existingProfileId}`), {
        code: 'discovery_existing_profile_id_duplicate',
        recoverable: true,
      });
    }
    if (existingProfileId) boundExistingIds.add(existingProfileId);
    people.push({ sourceName, evidence, existingProfileId, presence: item.presence });
  }
  const noCharacterReason = parsed.noCharacterReason;
  if (!people.length && (typeof noCharacterReason !== 'string' || !usable(noCharacterReason))) throw Object.assign(new Error('空people必须提供可用noCharacterReason'), { code: 'discovery_empty_reason_invalid', recoverable: true });
  return { people, noCharacterReason: String(noCharacterReason ?? '').trim() };
}

export function profilePrompt(input = {}, row = {}, previous = null, repair = null) {
  const base = [
    '你是完整人物档案设计器。仅为脚本指定的一个非玩家人物输出完整 JSON 对象。',
    '必须精确保留 rowId 与 profileId；sourceName/evidence/presence 是脚本绑定信息。根据普通正文、目标楼 MVU、权威角色卡与世界设定设计完整档案。',
    '人物自身 goal 只表示目标，不倒写成已经发生的经历；正文中的选项、规划或示例不算实际登场或既成动作。已有档案中的事实、人格和此前补全维度没有新依据时保持不变；既有事实写入正常字段，缺失背景可以合理设计并同时在 inferences 标明补全来源。knowledge 与 uncertainties 要说明本人知道、误解或未知的范围，不默认其他人知道其背景或动机。不得写入玩家身份、玩家动作、感受或同意。',
    `input:\n${json(input)}\nrow:\n${json(row)}\nprevious:\n${json(previous)}`,
  ];
  if (repair) base.push(`这是一次定向格式/缺项修复。保留 raw 中正确内容，只修复 errors 指出的结构或缺项，不改变 rowId/profileId：\nraw:\n${String(repair.raw ?? '')}\nerrors:\n${json(repair.errors)}`);
  base.push(`输出单个完整 profile 对象，必须严格使用以下嵌套结构；所有正常字段都要填写可用内容，合理补全记录在inferences，不得只填inferences而留空其他字段：\n${json(PROFILE_TEMPLATE)}\n\n字段语义固定：personality.interest 是利益取向，personality.conflict 是冲突方式，personality.weakness 包含弱点与自我欺骗。`);
  return base.join('\n\n');
}
