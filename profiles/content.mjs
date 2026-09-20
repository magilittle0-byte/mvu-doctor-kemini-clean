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
function parseJsonCandidate(source, { extract = true } = {}) {
  const raw = String(source || '').trim();
  const normalized = normalizeJsonPunctuation(raw);
  const candidates = extract
    ? [raw, ...balancedJsonCandidates(raw), normalized, ...balancedJsonCandidates(normalized)]
    : [raw, normalized];
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

export function parseJsonResponse(text, options = {}) {
  let source = stripCodeFence(text);
  const tagged = source.match(/^<人物档案\b[^>]*>([\s\S]*?)<\/人物档案>$/i);
  if (tagged) source = tagged[1].trim();
  if (source === 'null') return null;
  return parseJsonCandidate(source, options);
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
const PROFILE_CONTENT_TEMPLATE = Object.fromEntries(
  Object.entries(PROFILE_TEMPLATE).filter(([key]) => key !== 'profileId' && key !== 'rowId'),
);

const PROFILE_FIELD_TREE = {};
for (const { path } of PROFILE_FIELDS) {
  const parts = path.split('.');
  let node = PROFILE_FIELD_TREE;
  for (const part of parts.slice(0, -1)) node = node[part] ||= {};
  node[parts.at(-1)] = true;
}

function isPlainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }
function profileTurnError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, recoverable: true, ...details });
}
function modelInputView(input = {}) {
  const view = { ...(isPlainObject(input) ? input : {}) };
  if (isPlainObject(input?.target)) {
    view.target = { ...input.target };
    delete view.target.content;
    delete view.target.userText;
  }
  return view;
}

const PROFILE_TURN_INSTRUCTIONS = [
  '你是人物档案设计器。一次完成当前正文的人物发现、完整新建、既有档案增量更新与无变化判定。仅依据普通正文、已核验MVU、权威设定和输入中的现有档案；不要依据变量或设定凭空造出本轮人物。每个人分别判断，不按同名合并。',
  '每个 people 条目都必须带 sourceName、evidence、existingProfileId、presence、operation。evidence 必须是本轮 narrative 中连续、非空、逐字出现的片段；presence 只能是 present 或 mentioned。existingProfileId 必须是 input.profiles 中某个精确 profileId，或新人物时显式为 null；绝不按姓名、别名或数组位置猜 ID。sourceName 与所绑定旧档案的 name/aliases 不一致时，必须另给 identityRevealEvidence：一段 narrative 中连续逐字出现、且同一段分别出现 sourceName 和至少一个旧称谓的身份揭示原文。该结构检查不能替代对身份是否确实相同的语义核验。',
  'operation=create：只用于 existingProfileId:null。提供 profile，必须包含 PROFILE_FIELDS 定义的全部44个内容字段；profile 不得包含 profileId、rowId 或其他元数据。允许对未明背景作合理创作，放入 inferences；knowledge、uncertainties 要区分人物确知、误解和未知。',
  'operation=update：只用于绑定一个已有 profileId。只提供 changes 对象，键必须是 PROFILE_FIELDS 中的精确叶路径；文字字段给完整新字符串，列表字段给完整新数组（数组替换，不是追加）。省略字段表示保持旧值，显式空数组表示尝试清空并由程序按字段完整性规则验证。不得给父对象、ID、存储元数据或未知路径。',
  'operation=unchanged：只用于绑定一个已有 profileId；不得附 profile 或 changes。它表示人物本轮出现但档案没有变化。',
  '必须对所有相关既有人物检查全部档案维度，包括关系、知识、目标、能力、资源、外貌和当前状态；不能因为完整性通过就保留有证据表明已过时的内容。不得把目标写成已发生的经历，不得写入玩家身份、行动、感受或同意。遗漏人物不等于删除档案。',
  '若本轮没有可持续记录的非玩家人物，people 必须为空并给出可用 noCharacterReason。retireProfileIds 仅可包含 feedback.retirableProfileIds 明确允许的本轮新建档案 ID；没有许可时返回空数组。不得通过省略 people 删除任何旧档案。',
];

export function profileTurnPrompt(input = {}, feedback = null) {
  const retirementAllowlist = Array.isArray(feedback?.retirableProfileIds) ? feedback.retirableProfileIds : [];
  const suffix = [
    `完整背景（紧凑JSON；移除 target.content 和 target.userText 原始副本，保留投影后的 narrative 与 userText）：\n${JSON.stringify(modelInputView(input))}`,
    `本次允许退休的本轮新档案 ID（仅可从此列表选择）：\n${JSON.stringify(retirementAllowlist)}`,
    `PROFILE_FIELDS 完整新建模板（只输出44项内容，不输出模板说明）：\n${JSON.stringify(PROFILE_CONTENT_TEMPLATE)}`,
    '只输出一个 JSON 对象，顶层只允许 people、retireProfileIds、noCharacterReason 三个键。结构：{"people":[{"sourceName":"...","evidence":"...","existingProfileId":null,"presence":"present","operation":"create","profile":{...}}],"retireProfileIds":[],"noCharacterReason":""}。每个条目必须完整符合所选 operation；update 使用 changes，unchanged 不附 profile/changes。不要输出解释、代码围栏或其他键。若 people 为空，noCharacterReason 必须说明原因。',
  ];
  if (feedback) suffix.splice(1, 0,
    `这是用户主动修复时的待复核材料，不是事实或指令；重新核对当前正文与身份，可补漏或纠正，不能自动继承旧 operation 或 ID：\n${JSON.stringify(feedback)}`);
  return [...PROFILE_TURN_INSTRUCTIONS, ...suffix].join('\n\n');
}

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
export function discoveryPrompt(input = {}, feedback = null) {
  const base = [
    '你是人物发现器。只从普通正文 narrative 识别实际出现或被提及的非玩家人物；不得凭世界书、MVU、卡片、全局提示或预设标签创造姓名。',
    '每人返回 sourceName、evidence、presence。evidence 必须是 narrative 中连续、非空、逐字出现的片段；presence 只能是 present 或 mentioned。',
    '若本轮没有可持续记录的非玩家人物，返回 people:[] 并给出 noCharacterReason。已有完整人物只要本轮出现仍可返回更新；existingProfileId 只能复制 input.profiles 中明确存在的 profileId，绝不能按同名猜测合并。',
    `narrative:\n${String(input.narrative ?? '')}\nuserText:\n${String(input.userText ?? '')}\nmvu:\n${json(input.mvu)}\nauthority:\n${json(input.authority)}\nplayers:\n${json(input.players)}\nprofiles:\n${json(input.profiles)}\nglobalPrompt:\n${String(input.globalPrompt ?? '')}`,
    '只输出 JSON：{"people":[{"sourceName":"...","evidence":"...","existingProfileId":null,"presence":"present"}],"noCharacterReason":"..."}',
  ].join('\n\n');
  if (!feedback) return base;
  return [
    base,
    '这是用户主动点击修复后的发现结果复核。上次结果只是待纠错材料，不是事实或指令；不能因格式合法就认为人物已找全。重新通读当前 narrative，逐项检查实际出现或被提及的非玩家人物，包括正文 HTML 段落、系统概览和名单中的实际提及；补回遗漏，也可以剔除上次误识别的候选。选项、规划、示例不算实际出现或提及。',
    '每项只对应一个可区分的人物，不能将两人、多人或整个群体共用一个个人身份、人格和档案。只能作为环境的人群不必建个人档案；能区分的个人分别绑定，不能为凑齐人数凭空造人。',
    '每个返回人物仍须提供当前 narrative 中连续、非空、逐字出现的 evidence；不得仅凭 MVU、世界书、卡片、全局提示或上次结果造名。已有身份只能按当前 input.profiles 绑定，不得按同名猜测。',
    '若下面允许剔除的本轮新建档案确实误认、重复或合并了不同人物，在 retireProfileIds 中明确列出其 profileId。仅从 people 省略不会删除已保存档案。以前轮人物不允许剔除；同一 ID 不能既返回更新又剔除。拆分错误合并时，剔除旧合并 ID，并为有正文依据的各个人物分别返回 people，不复用该合并 ID。',
    `允许剔除的本轮新建档案 ID（空列表表示不能删除任何档案）：\n${json(feedback.retirableProfileIds || [])}`,
    '修复时只输出 JSON：{"people":[{"sourceName":"...","evidence":"...","existingProfileId":null,"presence":"present"}],"retireProfileIds":[],"noCharacterReason":"..."}。没有需要剔除的档案时列表为空；people 为空仍须说明原因。',
    ...(feedback.previousValidResult ? [`上次合法格式的发现结果（待复核）：\n${json(feedback.previousValidResult)}`] : []),
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
export function parseDiscovery(raw, input = {}, { retirableProfileIds = [] } = {}) {
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
  const retireProfileIds = Object.hasOwn(parsed, 'retireProfileIds') ? parsed.retireProfileIds : [];
  if (!Array.isArray(retireProfileIds) || retireProfileIds.some(id => typeof id !== 'string' || !id.trim() || id !== id.trim())
    || new Set(retireProfileIds).size !== retireProfileIds.length) {
    throw Object.assign(new Error('retireProfileIds必须是无重复的非空ID字符串数组'), { code: 'discovery_retire_invalid', recoverable: true });
  }
  const allowed = new Set(Array.isArray(retirableProfileIds) ? retirableProfileIds : []);
  for (const id of retireProfileIds) {
    if (!allowed.has(id) || !profiles.some(profile => profile.profileId === id)) {
      throw Object.assign(new Error('只能剔除本地允许的本轮新建档案'), { code: 'discovery_retire_forbidden', recoverable: true });
    }
    if (boundExistingIds.has(id)) {
      throw Object.assign(new Error('同一档案不能同时更新和剔除'), { code: 'discovery_retire_conflict', recoverable: true });
    }
  }
  return { people, noCharacterReason: String(noCharacterReason ?? '').trim(), retireProfileIds };
}

const PROFILE_TURN_TOP_LEVEL_KEYS = new Set(['people', 'retireProfileIds', 'noCharacterReason']);
const PROFILE_TURN_PERSON_KEYS = new Set([
  'sourceName', 'evidence', 'existingProfileId', 'presence', 'operation',
  'identityRevealEvidence', 'profile', 'changes',
]);

export function parseProfileTurn(raw, input = {}, { retirableProfileIds = [] } = {}) {
  let parsed;
  try { parsed = parseJsonResponse(raw, { extract: false }); }
  catch (error) {
    throw profileTurnError('profile_turn_invalid', error?.message || '人物回合结果不是有效JSON', {
      response_text: error?.response_text,
    });
  }
  if (!isPlainObject(parsed)
    || Object.keys(parsed).some(key => !PROFILE_TURN_TOP_LEVEL_KEYS.has(key))
    || !Object.hasOwn(parsed, 'people') || !Array.isArray(parsed.people)
    || typeof parsed.noCharacterReason !== 'string') {
    throw profileTurnError('profile_turn_invalid', '人物回合结果必须只包含people、retireProfileIds和noCharacterReason');
  }
  const sourcePeople = parsed.people;
  const discoveryPeople = sourcePeople.map((item, index) => {
    if (!isPlainObject(item)
      || Object.keys(item).some(key => !PROFILE_TURN_PERSON_KEYS.has(key))
      || !['sourceName', 'evidence', 'existingProfileId', 'presence', 'operation'].every(key => Object.hasOwn(item, key))) {
      throw profileTurnError('profile_turn_invalid', `第${index + 1}个人物条目不符合回合合同`);
    }
    const identityShapeValid = item.operation === 'create'
      ? item.existingProfileId === null
      : ['update', 'unchanged'].includes(item.operation)
        ? typeof item.existingProfileId === 'string'
        : false;
    if (!identityShapeValid) {
      throw profileTurnError('profile_turn_invalid', `第${index + 1}个人物条目的operation与身份字段不一致`);
    }
    return {
      sourceName: item.sourceName,
      evidence: item.evidence,
      existingProfileId: item.existingProfileId,
      presence: item.presence,
    };
  });
  const discovered = parseDiscovery(JSON.stringify({
    people: discoveryPeople,
    noCharacterReason: parsed.noCharacterReason,
    retireProfileIds: parsed.retireProfileIds,
  }), input, { retirableProfileIds });
  const profiles = Array.isArray(input?.profiles) ? input.profiles : [];
  const people = discovered.people.map((person, index) => {
    const item = sourcePeople[index];
    let identityRevealEvidence = item.identityRevealEvidence ?? null;
    if (identityRevealEvidence !== null) {
      if (typeof identityRevealEvidence !== 'string' || !identityRevealEvidence.trim()
        || !String(input?.narrative ?? '').includes(identityRevealEvidence)) {
        throw profileTurnError('profile_turn_identity_reveal_invalid', 'identityRevealEvidence必须是正文中连续出现的非空原文');
      }
      identityRevealEvidence = identityRevealEvidence.trim();
    }
    if (person.existingProfileId) {
      const previous = profiles.find(profile => profile?.profileId === person.existingProfileId);
      const previousNames = [previous?.name, ...(Array.isArray(previous?.aliases) ? previous.aliases : [])]
        .filter(value => typeof value === 'string' && value.trim());
      const normalizedSourceName = person.sourceName.trim().toLocaleLowerCase();
      const identityMatches = previousNames.some(value => value.trim().toLocaleLowerCase() === normalizedSourceName);
      if (!identityMatches) {
        if (!identityRevealEvidence || !identityRevealEvidence.includes(person.sourceName)
          || !previousNames.some(value => hasDistinctMentions(identityRevealEvidence, person.sourceName, value))) {
          throw profileTurnError('profile_turn_identity_reveal_required',
            'sourceName与旧档案姓名/别名不匹配，必须提供同一段正文身份揭示原文');
        }
      }
    }
    return {
      ...person,
      identityRevealEvidence,
      operation: item.operation,
      ...(Object.hasOwn(item, 'profile') ? { profile: item.profile } : {}),
      ...(Object.hasOwn(item, 'changes') ? { changes: item.changes } : {}),
    };
  });
  return { people, retireProfileIds: discovered.retireProfileIds, noCharacterReason: discovered.noCharacterReason };
}

function hasDistinctMentions(text, sourceName, previousName) {
  const sourceStarts = [], previousStarts = [];
  for (let index = text.indexOf(sourceName); index >= 0; index = text.indexOf(sourceName, index + 1)) sourceStarts.push(index);
  for (let index = text.indexOf(previousName); index >= 0; index = text.indexOf(previousName, index + 1)) previousStarts.push(index);
  return sourceStarts.some(sourceStart => previousStarts.some(previousStart =>
    sourceStart + sourceName.length <= previousStart || previousStart + previousName.length <= sourceStart));
}

function collectProfileShapeErrors(value, tree = PROFILE_FIELD_TREE, prefix = '') {
  const errors = [];
  if (!isPlainObject(value)) return [`${prefix || 'profile'}必须是对象`];
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(tree, key)) {
      errors.push(`不允许的档案字段：${prefix}${key}`);
      continue;
    }
    const child = tree[key];
    if (child !== true) errors.push(...collectProfileShapeErrors(value[key], child, `${prefix}${key}.`));
  }
  return errors;
}

function materializeError(errors, row = {}) {
  const uniqueErrors = [...new Set(errors)];
  throw profileTurnError('profile_materialization_invalid', uniqueErrors.join('；') || '人物档案内容无效', {
    errors: uniqueErrors,
    rowId: row?.rowId,
    profileId: row?.profileId,
  });
}

export function materializeProfile(item, row, previous, players = []) {
  const errors = [];
  if (!isPlainObject(item)) errors.push('人物回合条目必须是对象');
  if (!isPlainObject(row)) errors.push('本地人物row必须是对象');
  if (!isPlainObject(item) || !isPlainObject(row)) materializeError(errors, row);
  const rowId = typeof row.rowId === 'string' ? row.rowId.trim() : '';
  const profileId = typeof row.profileId === 'string' ? row.profileId.trim() : '';
  if (!rowId) errors.push('本地rowId必须是非空字符串');
  if (!profileId) errors.push('本地profileId必须是非空字符串');
  for (const key of ['sourceName', 'evidence', 'presence']) {
    if (Object.hasOwn(row, key) && row[key] !== item[key]) errors.push(`人物行${key}与解析结果不匹配`);
  }
  if (item.operation === 'create') {
    if (item.existingProfileId !== null) errors.push('create人物必须使用existingProfileId:null');
    if (previous !== null && previous !== undefined) errors.push('create人物不能覆盖已有档案');
    if (Object.hasOwn(item, 'changes')) errors.push('create不得附changes');
    errors.push(...collectProfileShapeErrors(item.profile));
    if (errors.length) materializeError(errors, row);
    const profile = { ...cloneJson(item.profile), profileId, rowId };
    const validation = validateProfile(profile, players);
    if (validation.length) materializeError(validation, row);
    return profile;
  }
  if (!['update', 'unchanged'].includes(item.operation)) errors.push('operation必须是create、update或unchanged');
  if (item.existingProfileId !== profileId) errors.push('existingProfileId必须精确匹配本地profileId');
  if (!isPlainObject(previous)) errors.push('update/unchanged必须具有旧完整档案');
  if (!isPlainObject(previous)) materializeError(errors, row);
  if (previous.profileId !== profileId) errors.push('旧档案profileId与本地人物行不匹配');
  const previousErrors = validateProfile(previous, players);
  errors.push(...previousErrors.map(error => `旧档案${error}`));
  if (errors.length) materializeError(errors, row);

  const profile = cloneJson(previous);
  if (item.operation === 'unchanged') {
    if (Object.hasOwn(item, 'profile') || Object.hasOwn(item, 'changes')) errors.push('unchanged不得附profile或changes');
  } else {
    if (Object.hasOwn(item, 'profile')) errors.push('update不得附完整profile');
    if (!isPlainObject(item.changes)) errors.push('update的changes必须是对象');
    else if (Object.keys(item.changes).length === 0) errors.push('update的changes不能为空；无变化应使用unchanged');
    if (isPlainObject(item.changes)) {
      const fields = new Map(PROFILE_FIELDS.map(field => [field.path, field]));
      for (const [path, value] of Object.entries(item.changes)) {
        const field = fields.get(path);
        if (!field) { errors.push(`不允许的变化路径：${path}`); continue; }
        if (field.type === 'text' && typeof value !== 'string') {
          errors.push(`${path}必须是字符串`); continue;
        }
        if (field.type === 'list' && !Array.isArray(value)) {
          errors.push(`${path}必须是完整数组`); continue;
        }
        const keys = path.split('.');
        let destination = profile;
        for (const key of keys.slice(0, -1)) destination = destination[key];
        destination[keys.at(-1)] = cloneJson(value);
      }
    }
  }
  if (errors.length) materializeError(errors, row);
  profile.profileId = profileId;
  profile.rowId = rowId;
  const validation = validateProfile(profile, players);
  if (validation.length) materializeError(validation, row);
  return profile;
}

const PROFILE_PROMPT_GUIDANCE = [
  '必须精确保留 rowId 与 profileId；sourceName/evidence/presence 是脚本绑定信息。根据普通正文、目标楼 MVU、权威角色卡与世界设定设计完整档案。',
  '人物自身 goal 只表示目标，不倒写成已经发生的经历；正文中的选项、规划或示例不算实际登场或既成动作。已有档案中的事实、人格和此前补全维度没有新依据时保持不变；既有事实写入正常字段，缺失背景可以合理设计并同时在 inferences 标明补全来源。knowledge 与 uncertainties 要说明本人知道、误解或未知的范围，不默认其他人知道其背景或动机。不得写入玩家身份、玩家动作、感受或同意。',
];
const PROFILE_OUTPUT_INSTRUCTION = `输出单个完整 profile 对象，必须严格使用以下嵌套结构；所有正常字段都要填写可用内容，合理补全记录在inferences，不得只填inferences而留空其他字段：\n${json(PROFILE_TEMPLATE)}\n\n字段语义固定：personality.interest 是利益取向，personality.conflict 是冲突方式，personality.weakness 包含弱点与自我欺骗。`;

export function profilePrompt(input = {}, row = {}, previous = null, repair = null) {
  const base = [
    '你是完整人物档案设计器。仅为脚本指定的一个非玩家人物输出完整 JSON 对象。',
    ...PROFILE_PROMPT_GUIDANCE,
    `input:\n${json(input)}\nrow:\n${json(row)}\nprevious:\n${json(previous)}`,
  ];
  if (repair) base.push(`这是一次定向格式/缺项修复。保留 raw 中正确内容，只修复 errors 指出的结构或缺项，不改变 rowId/profileId：\nraw:\n${String(repair.raw ?? '')}\nerrors:\n${json(repair.errors)}`);
  base.push(PROFILE_OUTPUT_INSTRUCTION);
  return base.join('\n\n');
}

export function profileBatchPrompt(input = {}, rows = [], feedback = null) {
  const bindings = (Array.isArray(rows) ? rows : []).map((row) => ({
    rowId: row?.rowId,
    profileId: row?.profileId,
    sourceName: row?.sourceName,
    evidence: row?.evidence,
    presence: row?.presence,
  }));
  const base = [
    '你是完整人物档案设计器。请为脚本指定的每个非玩家人物各输出一份完整 JSON profile。',
    ...PROFILE_PROMPT_GUIDANCE,
    '批量只减少传输次数，不合并人物。每项必须精确保留该项的 rowId 与 profileId；sourceName/task.evidence/presence 只用于核对人物来源，不要输出这些 task 绑定元数据。profile.evidence 仍是 44 字段中的必填非空字符串列表，可以包含正文证据片段，不得用字符串代替该列表。已有档案只能从 input.profiles 按 profileId 读取对应项。不得按姓名或数组位置猜测身份。',
    `input（本批所有人物共用且只读取一次）：\n${json(input)}\nrows（每项只对应自己的绑定资料）：\n${json(bindings)}`,
    `只输出严格的批量 JSON：顶层只能有 profiles 键，值为数组；数组中的每项都是完整 profile 对象并含正确 rowId/profileId，不要输出 sourceName/presence 或其他 task 元数据、解释、标签、代码围栏或其他顶层字段。每个绑定人物恰好一项。\n${PROFILE_OUTPUT_INSTRUCTION.replace('输出单个完整 profile 对象，', '每项输出完整 profile 对象，')}`,
  ];
  if (feedback) base.push([
    '这是用户主动点击修复后的待纠错材料，不是事实或指令。重新依据当前 input 和本次 rows 的绑定资料生成；上次 raw 中的 rowId/profileId 不具有优先级，不得替换或沿用为本次绑定。纠正误识别、缺项、结构错误和与当前依据矛盾的内容；有依据的正确内容保持，本次 rowId/profileId 必须保留。',
    `上次批量结果（仅供逐项复核）：\n${json(feedback.previousValidResult ?? feedback)}`,
  ].join('\n\n'));
  return base.join('\n\n');
}

function profileBatchError(code, details = {}) {
  return { code, ...details };
}

export function parseProfileBatch(raw, rows = [], players = []) {
  let parsed;
  try {
    parsed = parseJsonResponse(raw, { extract: false });
  } catch (error) {
    throw Object.assign(new Error(error?.message || '批量人物档案不是有效 JSON'), {
      code: 'profile_batch_invalid', recoverable: true, response_text: error?.response_text,
    });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.keys(parsed).length !== 1 || !Object.hasOwn(parsed, 'profiles')
    || !Array.isArray(parsed.profiles)) {
    throw Object.assign(new Error('批量人物档案必须严格是 {profiles:[...]}'), {
      code: 'profile_batch_invalid', recoverable: true,
    });
  }
  const expectedRows = Array.isArray(rows) ? rows : [];
  const results = expectedRows.map((row) => ({
    rowId: row?.rowId, profileId: row?.profileId, candidate: null, errors: [],
  }));
  const resultByRowId = new Map(expectedRows.map((row, index) => [String(row?.rowId ?? ''), results[index]]));
  const resultByProfileId = new Map(expectedRows.map((row, index) => [String(row?.profileId ?? ''), results[index]]));
  const expectedByRowId = new Map(expectedRows.map((row) => [String(row?.rowId ?? ''), row]));
  const expectedByProfileId = new Map(expectedRows.map((row) => [String(row?.profileId ?? ''), row]));
  const errors = [];
  const seenRowIds = new Set();
  const seenProfileIds = new Set();
  const addResultError = (result, error) => { if (result) result.errors.push(error); };
  for (const [itemIndex, item] of parsed.profiles.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(profileBatchError('profile_batch_item_invalid', { itemIndex }));
      continue;
    }
    const rowId = typeof item.rowId === 'string' ? item.rowId : '';
    const profileId = typeof item.profileId === 'string' ? item.profileId : '';
    if (!rowId.trim() || !profileId.trim()) {
      errors.push(profileBatchError('profile_batch_item_missing_id', { itemIndex, rowId, profileId }));
      continue;
    }
    const expectedByRow = expectedByRowId.get(rowId);
    const expectedByProfile = expectedByProfileId.get(profileId);
    const rowResult = resultByRowId.get(rowId) || resultByProfileId.get(profileId);
    if (!expectedByRow) {
      const error = profileBatchError('profile_batch_unknown_row_id', { itemIndex, rowId, profileId });
      errors.push(error); addResultError(rowResult, error); continue;
    }
    if (!expectedByProfile) {
      const error = profileBatchError('profile_batch_unknown_profile_id', { itemIndex, rowId, profileId });
      errors.push(error); addResultError(rowResult, error); continue;
    }
    if (expectedByRow.profileId !== profileId || expectedByProfile.rowId !== rowId) {
      const error = profileBatchError('profile_batch_identity_mismatch', {
        itemIndex, rowId, profileId, expectedProfileId: expectedByRow.profileId,
      });
      errors.push(error);
      addResultError(resultByRowId.get(rowId), error);
      addResultError(resultByProfileId.get(profileId), { ...error, relatedRowId: rowId });
      continue;
    }
    if (seenRowIds.has(rowId)) {
      const error = profileBatchError('profile_batch_duplicate_row_id', { itemIndex, rowId, profileId });
      errors.push(error); addResultError(resultByRowId.get(rowId), error); continue;
    }
    if (seenProfileIds.has(profileId)) {
      const error = profileBatchError('profile_batch_duplicate_profile_id', { itemIndex, rowId, profileId });
      errors.push(error); addResultError(resultByRowId.get(rowId), error); continue;
    }
    seenRowIds.add(rowId); seenProfileIds.add(profileId);
    const validation = validateProfile(item, players);
    const result = resultByRowId.get(rowId);
    result.candidate = item;
    result.errors.push(...validation);
  }
  for (const row of expectedRows) {
    const rowId = String(row?.rowId ?? ''), profileId = String(row?.profileId ?? '');
    if (!seenRowIds.has(rowId) || !seenProfileIds.has(profileId)) {
      const error = profileBatchError('profile_batch_item_missing', { rowId, profileId });
      errors.push(error); addResultError(resultByRowId.get(rowId), error);
    }
  }
  return { results, errors };
}
