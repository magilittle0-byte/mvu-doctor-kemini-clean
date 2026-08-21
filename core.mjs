export const PROFILE_ROOT = '/人物档案';

const AXIS_POOLS = Object.freeze({
  temperament: ['外热内稳，愿意先接住别人的情绪', '慢热敏锐，熟悉后才显露活泼', '爽朗务实，不把小摩擦升级', '安静好奇，习惯先观察再参与', '精力旺盛，喜欢用行动打开局面', '温吞坚韧，在压力下反而更有耐心', '谨慎亲切，会给彼此留下余地', '自信随和，能承认自己判断失误'],
  coreDesire: ['希望建立一个真正能长期归属的地方', '希望凭可靠本领换来自主生活', '希望保护自己珍视的人与日常', '希望理解陌生事物并留下成果', '希望获得被平等看待的尊严', '希望修复一段仍有可能的关系', '希望证明普通人的选择也有分量', '希望在现实限制中争取更多自由'],
  values: ['看重守信，但允许人在说明原因后改约', '重视公平交换，也愿意为弱者多承担一点', '认为诚实应当兼顾时机与他人承受力', '珍惜具体的人胜过抽象口号', '尊重专业和证据，不迷信身份权威', '相信善意要有边界，帮助不等于控制', '重视共同体，但不要求个人无条件牺牲', '认为结果与过程都应接受检验'],
  thinking: ['先搜集细节，再用小规模尝试验证判断', '善于从人的利益与顾虑反推局势', '习惯把复杂问题拆成能立刻处理的小步', '依靠经验类比，但会主动寻找反例', '直觉很快，之后会用事实补做校正', '擅长发现流程漏洞，不擅长宏大空谈', '会同时准备乐观与保守两套方案', '喜欢追问事情为何在此刻发生'],
  attachment: ['亲近时稳定可靠，需要独处会提前说明', '渴望亲密却怕添麻烦，常用实际帮助表达', '信任建立较慢，一旦确认便愿意分享脆弱', '喜欢并肩做事胜过长篇倾诉', '容易照顾别人，正在学习直接说出自己的需要', '关系紧张时先短暂退开，冷静后会主动修复', '重视自由和边界，但不把疏离冒充独立', '会用玩笑试探安全感，得到回应后更坦率'],
  socialMotive: ['想交换信息并确认彼此是否可靠', '想找到能合作又不必讨好的人', '想让紧张场面恢复到可以谈事的程度', '想在群体中争取实际的话语权', '想照顾新来者，避免对方重复自己的窘境', '想拓展人脉，但会认真维护已有关系', '想获得专业认可，而非单纯被喜欢', '想理解对方立场后寻找双赢入口'],
  interest: ['愿意短期吃亏换取长期稳定，但会记账', '先保护基本生计，再谈理想选择', '重视互惠，不把每次帮助都算成立即债务', '面对稀缺资源时偏向透明分配', '会争取合理报酬，也愿意分享关键知识', '不拒绝利益，但厌恶用信息差坑害熟人', '偏爱可持续的小收益而非孤注一掷', '关键时刻愿意放弃利益守住信誉'],
  conflict: ['先确认误会，再明确提出自己的底线', '表面平和，关键点会用简短事实顶住压力', '倾向私下沟通，避免让对方当众难堪', '会用幽默降温，但不会拿弱点取乐', '愿意谈条件，若遭欺骗会立即收紧合作', '冲突时专注解决当前问题，不翻无关旧账', '敢于直接拒绝，同时给出可接受的替代方案', '初时回避争执，被逼到边界会异常坚定'],
  stress: ['压力下变得话少而高效，事后才感到疲惫', '会反复检查细节，需要同伴提醒适时停手', '先照顾最急迫的人，再独自消化后怕', '容易用忙碌逃避情绪，但仍能履行承诺', '短暂急躁后会道歉，并重新整理优先级', '会寻找熟悉的小仪式维持稳定', '倾向预想最坏情况，同时保留一条撤退路线', '越危险越冷静，安全后反而会明显发抖'],
  moralBoundary: ['不主动伤害无辜，也不拿无辜者作筹码', '可以说策略性的谎，但拒绝伪造他人同意', '愿意违法救急，却不会借机谋取额外伤害', '不会出卖托付给自己的隐私', '反对羞辱俘虏或失败者', '可以自卫反击，但不把报复扩展到家属朋友', '拒绝用亲密关系操控利益决定', '不替别人擅自作出不可逆的人生选择'],
  expression: ['说话简洁，偶尔用生活化比喻解释难题', '语速偏慢，会复述要点确认没有误解', '措辞礼貌但不绕弯，拒绝时尤其清楚', '情绪高涨时话很多，意识到后会自嘲收住', '习惯先问一个具体问题再给意见', '常用轻微反问表达亲近，而非敌意', '不爱说漂亮话，赞赏时会指出具体细节', '紧张时会说得过于正式，放松后明显口语化'],
  actionHabit: ['随手记录承诺和待办，完成后当面交代', '进入陌生地点先确认出口、价格和基本规矩', '思考时会整理眼前物品，让秩序帮助判断', '答应前先估算成本，答应后很少失约', '遇到新人会自然留一个参与谈话的位置', '喜欢先做一个能验证方向的小样', '重要谈话前会准备热饮或简单食物', '发现别人尴尬时会悄悄转移注意力'],
  weakness: ['害怕被视为累赘，因此常把求助拖得太晚', '过度相信只要解释清楚就能消除利益冲突', '对熟人的承诺容易给予超出证据的信任', '厌恶浪费，偶尔因此舍不得放弃沉没成本', '太想维持体面，会错过及时表达不满的机会', '擅长处理别人的麻烦，却低估自己的疲惫', '把准备充分当成安全感，偶尔行动得太迟', '不愿承认嫉妒，会把它包装成挑剔'],
  humor: ['喜欢一本正经地说小冷笑话', '会温和模仿熟人的口头禅活跃气氛', '擅长自嘲，但不拿自己的伤口讨同情', '喜欢发现日常规则里荒谬的小漏洞', '笑点很低，努力忍笑时尤其明显', '不常开玩笑，偶尔一句却非常精准', '会用夸张比喻化解自己的窘迫', '偏爱只有熟人听得懂的旧梗'],
});

const REQUIRED_TEXT_PATHS = [
  'name', 'identity.species', 'identity.gender', 'identity.age', 'identity.occupation',
  'identity.affiliation', 'identity.socialPosition', 'appearance.overall', 'appearance.body',
  'appearance.face', 'appearance.hair', 'appearance.voice', 'appearance.physiology',
  'personality.temperament', 'personality.coreDesire', 'personality.values',
  'personality.thinking', 'personality.attachment', 'personality.socialMotive',
  'personality.interest', 'personality.conflict', 'personality.stress',
  'personality.moralBoundary', 'personality.expression', 'personality.actionHabit',
  'personality.weakness', 'personality.humor', 'history', 'currentState.location',
  'currentState.condition', 'currentState.emotion', 'currentState.goal',
];
const REQUIRED_ARRAYS = ['relationships', 'knowledge', 'capabilities', 'resources', 'evidence', 'inferences'];
const EMPTY_WORDS = /^(未知|不详|待定|待确认|未登记|暂无|无|unknown|null|n\/a)$/i;

export function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function randomIndex(length, random) {
  return Math.min(length - 1, Math.floor(Math.max(0, Math.min(0.999999999, random())) * length));
}

export function generateTicketBatch(count = 8, random = Math.random, now = Date.now()) {
  const size = Math.max(1, Math.min(24, Number(count) || 8));
  const tickets = [];
  const seen = new Set();
  for (let index = 0; index < size; index += 1) {
    let axes;
    let signature;
    let collision = 0;
    do {
      let radix = 1;
      axes = Object.fromEntries(Object.entries(AXIS_POOLS).map(([key, pool]) => {
        const base = randomIndex(pool.length, random);
        const offset = Math.floor(collision / radix) % pool.length;
        radix *= pool.length;
        return [key, pool[(base + offset) % pool.length]];
      }));
      signature = JSON.stringify(axes);
      collision += 1;
    } while (seen.has(signature));
    seen.add(signature);
    tickets.push({
      ticketId: `ct-${Number(now).toString(36)}-${String(index + 1).padStart(2, '0')}-${Math.floor(random() * 0xffffff).toString(36).padStart(5, '0')}`,
      ordinal: index + 1,
      axes,
    });
  }
  return tickets;
}

export function statDataOf(data) {
  if (!data || typeof data !== 'object') return {};
  return data.stat_data && typeof data.stat_data === 'object' ? data.stat_data : data;
}

function at(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function isNonEmptyText(value) {
  const text = String(value ?? '').trim();
  return text.length >= 2 && !EMPTY_WORDS.test(text);
}

function repairJsonText(text) {
  return String(text || '')
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

export function parseProfileReceipt(message) {
  const raw = String(message || '');
  if (/<人物档案无变化\s*\/>/i.test(raw)) return { kind: 'nochange', profiles: [] };
  const match = raw.match(/<人物档案更新>([\s\S]*?)<\/人物档案更新>/i);
  if (!match) return { kind: 'missing', profiles: [], error: '正文缺少人物档案完成信号' };
  try {
    const parsed = JSON.parse(repairJsonText(match[1]));
    if (!Array.isArray(parsed)) throw new Error('人物档案回执必须是数组');
    return { kind: 'update', profiles: parsed };
  } catch (error) {
    return { kind: 'invalid', profiles: [], error: `人物档案JSON无法解析：${error.message}` };
  }
}

export function stripProfileReceipt(message) {
  return String(message || '')
    .replace(/<人物档案更新>[\s\S]*?<\/人物档案更新>/gi, '')
    .replace(/<人物档案无变化\s*\/>/gi, '')
    .trim();
}

function existingProfilesFromData(data) {
  const root = statDataOf(data)?.人物档案;
  return root?.byActorId && typeof root.byActorId === 'object' ? root.byActorId : {};
}

function normalizedNames(profile) {
  return [profile?.name, ...(Array.isArray(profile?.aliases) ? profile.aliases : [])]
    .map((value) => String(value || '').trim().toLocaleLowerCase())
    .filter(Boolean);
}

export function prepareProfileBatch(rawProfiles, tickets, currentData) {
  if (!Array.isArray(rawProfiles) || rawProfiles.length < 1) {
    return { ok: false, errors: ['人物档案批次为空'], profiles: [] };
  }
  const existing = existingProfilesFromData(currentData);
  const ticketMap = new Map((tickets || []).map((ticket) => [String(ticket.ticketId), ticket]));
  const usedTickets = new Set();
  const nameIndex = new Map();
  for (const [id, profile] of Object.entries(existing)) {
    for (const name of normalizedNames(profile)) nameIndex.set(name, id);
  }
  const ids = new Set();
  const prepared = [];
  const errors = [];

  for (const [index, input] of rawProfiles.entries()) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      errors.push(`第${index + 1}张档案不是对象`);
      continue;
    }
    const profile = deepClone(input);
    const matchedId = normalizedNames(profile).map((name) => nameIndex.get(name)).find(Boolean);
    let profileId = String(profile.profileId || matchedId || '').trim();
    const isExisting = Boolean(profileId && existing[profileId]);
    const ticket = ticketMap.get(String(profile.ticketId || ''));
    if (!profileId) {
      if (!ticket) {
        errors.push(`第${index + 1}张新档案没有匹配本轮characterCreationTicket`);
        continue;
      }
      profileId = ticket.ticketId;
      profile.ticketId = ticket.ticketId;
      profile.personality = deepClone(ticket.axes);
    } else if (!isExisting) {
      if (!ticket) {
        errors.push(`第${index + 1}张新档案的profileId不属于旧档案，且没有本轮票据`);
        continue;
      }
      profile.personality = deepClone(ticket.axes);
    }
    if (!isExisting && ticket) {
      if (usedTickets.has(ticket.ticketId)) errors.push(`同一票据被多名新人物重复使用：${ticket.ticketId}`);
      usedTickets.add(ticket.ticketId);
    }
    profile.profileId = profileId;
    if (ids.has(profileId)) errors.push(`档案批次内profileId重复：${profileId}`);
    ids.add(profileId);

    for (const path of REQUIRED_TEXT_PATHS) {
      if (!isNonEmptyText(at(profile, path))) errors.push(`${profile.name || `第${index + 1}张档案`}缺少可用字段：${path}`);
    }
    if (!Array.isArray(profile.aliases)) errors.push(`${profile.name || profileId}的aliases不是数组`);
    for (const path of REQUIRED_ARRAYS) {
      const value = at(profile, path);
      if (!Array.isArray(value) || value.length < 1) errors.push(`${profile.name || profileId}缺少完整列表：${path}`);
    }
    prepared.push(profile);
  }
  return { ok: errors.length === 0, errors, profiles: prepared };
}

export function buildProfilePatch(currentData, profiles) {
  const stat = statDataOf(currentData);
  const existingRoot = stat?.人物档案 && typeof stat.人物档案 === 'object' ? deepClone(stat.人物档案) : {};
  const byActorId = existingRoot.byActorId && typeof existingRoot.byActorId === 'object' ? existingRoot.byActorId : {};
  for (const profile of profiles) byActorId[profile.profileId] = deepClone(profile);
  const nextRoot = { ...existingRoot, byActorId };
  const operation = { op: stat?.人物档案 ? 'replace' : 'add', path: PROFILE_ROOT, value: nextRoot };
  return {
    operations: [operation],
    block: `<UpdateVariable><Analysis>人物档案批次已经完整校验；以单个根对象原子提交，不修改数据库表格。</Analysis><JSONPatch>${JSON.stringify([operation])}</JSONPatch></UpdateVariable>`,
    expected: nextRoot,
  };
}

export function verifyCommittedProfiles(data, profiles) {
  const committed = existingProfilesFromData(data);
  for (const profile of profiles) {
    if (JSON.stringify(committed[profile.profileId]) !== JSON.stringify(profile)) return false;
  }
  return true;
}

function extractJsonObject(raw) {
  const cleaned = repairJsonText(raw);
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('没有找到JSON对象');
  return JSON.parse(cleaned.slice(first, last + 1));
}

export function parseWorldState(raw, previous = {}) {
  const parsed = extractJsonObject(raw);
  const arrays = ['branches', 'npcIntents', 'agreements', 'hostilePlans'];
  for (const key of arrays) if (!Array.isArray(parsed[key])) parsed[key] = [];
  parsed.summary = isNonEmptyText(parsed.summary) ? String(parsed.summary).trim() : String(previous.summary || '世界已推进，暂无额外摘要。');
  parsed.updatedAt = new Date().toISOString();
  for (const key of arrays) {
    parsed[key] = parsed[key].slice(0, 80).map((entry, index) => ({
      id: String(entry?.id || `${key}-${Date.now().toString(36)}-${index}`),
      title: String(entry?.title || entry?.actor || '未命名事项'),
      actor: String(entry?.actor || ''),
      location: String(entry?.location || ''),
      keywords: Array.isArray(entry?.keywords) ? entry.keywords.map(String).slice(0, 12) : [],
      status: ['active', 'waiting', 'resolved', 'failed'].includes(entry?.status) ? entry.status : 'active',
      intent: String(entry?.intent || entry?.content || ''),
      consequence: String(entry?.consequence || ''),
      updatedAt: String(entry?.updatedAt || parsed.updatedAt),
    }));
  }
  return parsed;
}

function tokens(text) {
  return [...new Set(String(text || '').toLocaleLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) || [])];
}

export function selectWorldRecall(world, userInput, profiles = {}, limit = 8) {
  const needle = new Set(tokens(userInput));
  for (const profile of Object.values(profiles || {})) {
    if (String(userInput || '').includes(profile?.name || '\0')) {
      for (const token of normalizedNames(profile)) needle.add(token);
    }
  }
  const records = ['branches', 'npcIntents', 'agreements', 'hostilePlans']
    .flatMap((kind) => (Array.isArray(world?.[kind]) ? world[kind].map((entry) => ({ ...entry, kind })) : []))
    .filter((entry) => entry.status !== 'resolved')
    .map((entry) => {
      const haystack = tokens([entry.title, entry.actor, entry.location, entry.intent, ...(entry.keywords || [])].join(' '));
      let score = entry.status === 'active' ? 2 : 1;
      for (const token of haystack) {
        if (needle.has(token)) score += 5;
        else if ([...needle].some((part) => token.includes(part) || part.includes(token))) score += 2;
      }
      return { ...entry, score };
    })
    .sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return records.slice(0, Math.max(1, Math.min(16, Number(limit) || 8)));
}

export function formatGenerationInjection({ tickets, recall, profileDigest = [] }) {
  return [
    '<MVUDoctorRuntime>',
    'characterCreationTicket（按首次出现顺序使用；有权威设定或已有档案者跳过）：',
    JSON.stringify(tickets || []),
    'worldRecallPackage（仅相关连续性素材；NPC intent是尝试，不是既成结果）：',
    JSON.stringify(recall || []),
    '已有人物档案摘要（不得重复随机）：',
    JSON.stringify(profileDigest || []),
    '</MVUDoctorRuntime>',
  ].join('\n');
}

export function profileDigestFromData(data, limit = 60) {
  return Object.values(existingProfilesFromData(data)).slice(0, limit).map((profile) => ({
    profileId: profile.profileId,
    name: profile.name,
    aliases: profile.aliases || [],
    occupation: profile.identity?.occupation || '',
    currentGoal: profile.currentState?.goal || '',
  }));
}

export function profilesFromData(data) {
  return deepClone(existingProfilesFromData(data));
}
