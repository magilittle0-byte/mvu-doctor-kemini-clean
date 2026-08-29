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
const EMPTY_WORDS = /^(?:(?:未知|不详|待定|待确认|未登记|未说明|暂无|尚不明确|无法确认|无法判断|不可知|unknown|null|n\/a)(?:$|[\s（(：:，,。；;])|无$)/i;

export function profileCompletionContract() {
  return `每个人物必须按以下唯一结构输出完整对象；正文没有明说的内容不是空项，而是结合权威材料、世界观、人物身份和同一张骰票主动设计，并在inferences中说明为可修订补全：
{
  "profileId": "旧人物沿用既有ID；原创新人留空由脚本绑定票据；角色卡或世界书已有权威身份者留空由脚本建立稳定权威ID",
  "ticketId": "原创新人使用分配的本轮ticketId；权威人物不得冒领随机票据；旧人物保持原值",
  "name": "正文中可稳定单指的姓名、编号或唯一称谓",
  "aliases": ["仅填写最终正文逐字出现的稳定别名或既有档案已确认的别名；不要把代词、动作片段或句子残片当别名；没有可用空数组"],
  "identity": {
    "species": "物种",
    "gender": "性别或该物种适用的性别说明",
    "age": "明确年龄或符合世界观的具体年龄段；不得写未知（外观……）一类伪补全",
    "occupation": "职业或实际职责",
    "affiliation": "所属组织、社区或独立状态",
    "socialPosition": "在当前社会与关系网络中的位置"
  },
  "appearance": {
    "overall": "整体形象",
    "body": "体型与动作特征",
    "face": "面部特征",
    "hair": "头发或不适用时的物种原因",
    "voice": "声音与说话听感",
    "physiology": "符合物种与世界观的完整生理说明"
  },
  "personality": {
    "temperament": "基础气质", "coreDesire": "核心欲望", "values": "价值观",
    "thinking": "思考方式", "attachment": "关系模式", "socialMotive": "社交动机",
    "interest": "利益取向", "conflict": "冲突方式", "stress": "压力反应",
    "moralBoundary": "道德边界", "expression": "表达习惯", "actionHabit": "行动习惯",
    "weakness": "弱点与自我欺骗", "humor": "幽默方式"
  },
  "history": "连贯经历；正文未交代部分应合理设计",
  "currentState": {
    "location": "当前位置", "condition": "身体与处境", "emotion": "当前情绪",
    "goal": "人物自己的当前目标，不替玩家决定"
  },
  "relationships": ["至少一条当前关系、关系距离或暂时独立状态的自然说明"],
  "knowledge": ["至少一条人物实际掌握的知识"],
  "capabilities": ["至少一条可执行能力"],
  "resources": ["至少一条可调用资源；资源有限也要自然说明"],
  "evidence": ["至少一条来自最终叙事或权威材料的直接依据"],
  "inferences": ["至少一条医生主动设计且可被后续证据修订的补全说明"]
}
禁止用未知、待定、未登记、正文未提及或空字符串逃避补全；在这些占位词后加括号解释仍然不算完成。不适用字段必须写明不适用的世界观原因。所有列表字段必须是数组。`;
}

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

// Variable auditing and profile persistence share stat_data, but the profile
// root belongs exclusively to the profile doctor.  Mechanical replay and
// variable diffs must never interpret a concurrently committed profile as a
// narrative variable change.
export function variableStateOf(data) {
  const stat = deepClone(statDataOf(data));
  if (stat && typeof stat === 'object' && !Array.isArray(stat)) delete stat.人物档案;
  return stat;
}

function at(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function isNonEmptyText(value) {
  const text = String(value ?? '').trim();
  return text.length >= 1 && /[\p{L}\p{N}]/u.test(text) && !EMPTY_WORDS.test(text);
}

function stripJsonFence(text) {
  return String(text || '')
    .replace(/^\s*```(?:json|json5)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function readQuotedToken(source, start, opener, closer) {
  let value = '';
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\' && index + 1 < source.length) {
      const next = source[index + 1];
      if (next === opener || next === closer || next === '\\' || next === '"' || next === "'") {
        value += next;
        index += 1;
        continue;
      }
      value += char + next;
      index += 1;
      continue;
    }
    if (char === closer) return { end: index + 1, literal: JSON.stringify(value) };
    value += char;
  }
  return null;
}

function shieldJsonLikeStrings(source) {
  const literals = [];
  let structural = '';
  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    if (char === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index + 2);
      index = end < 0 ? source.length : end;
      continue;
    }
    let token = null;
    if (char === '"') {
      let end = index + 1;
      for (; end < source.length; end += 1) {
        if (source[end] === '\\') { end += 1; continue; }
        if (source[end] === '"') { end += 1; break; }
      }
      if (end <= source.length && source[end - 1] === '"') token = { end, literal: source.slice(index, end) };
    } else if (char === "'") token = readQuotedToken(source, index, "'", "'");
    else if (char === '“') token = readQuotedToken(source, index, '“', '”');
    else if (char === '‘') token = readQuotedToken(source, index, '‘', '’');
    if (token) {
      const placeholder = `\uE000${literals.length}\uE001`;
      literals.push(token.literal);
      structural += placeholder;
      index = token.end;
      continue;
    }
    structural += char;
    index += 1;
  }
  return { structural, literals };
}

function repairJsonText(text) {
  const source = stripJsonFence(text);
  const { structural, literals } = shieldJsonLikeStrings(source);
  const repaired = structural
    .replace(/([{,]\s*)([A-Za-z_$\u3400-\u9fff][A-Za-z0-9_$\u3400-\u9fff-]*)(\s*:)/g, '$1"$2"$3')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*{/g, '},{')
    .replace(/]\s*\[/g, '],[')
    .replace(/([}\]])(\s*)([A-Za-z_$\u3400-\u9fff][A-Za-z0-9_$\u3400-\u9fff-]*)(\s*:)/g, '$1,$2"$3"$4')
    .replace(/([}\]])(\s*)(?=\uE000\d+\uE001\s*:)/g, '$1,$2');
  return repaired.replace(/\uE000(\d+)\uE001/g, (_match, index) => literals[Number(index)]).trim();
}

function parseJsonWithLocalRepair(text) {
  const original = stripJsonFence(text);
  try { return JSON.parse(original); }
  catch { /* repair only after strict JSON has actually failed */ }
  let candidate = repairJsonText(original);
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    candidate = candidate
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([}\]])(\s*)([A-Za-z_$\u3400-\u9fff][A-Za-z0-9_$\u3400-\u9fff-]*)(\s*:)/g, '$1,$2"$3"$4')
      .replace(/([}\]])(\s*)(?="[^"\r\n]+"\s*:)/g, '$1,$2');
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
      const position = Number(String(error?.message || '').match(/position\s+(\d+)/i)?.[1]);
      const commaExpected = /Expected\s+['"]?,['"]?\s+or|expected comma|array element|object property|property name/i.test(String(error?.message || ''));
      if (!Number.isInteger(position) || !commaExpected) break;
      let insertAt = position;
      while (/\s/.test(candidate[insertAt] || '')) insertAt += 1;
      if (!insertAt || candidate[insertAt] === ',') break;
      if (candidate[insertAt - 1] === ',') {
        if (/[}\]]/.test(candidate[insertAt] || '')) {
          candidate = `${candidate.slice(0, insertAt - 1)}${candidate.slice(insertAt)}`;
          continue;
        }
        break;
      }
      candidate = `${candidate.slice(0, insertAt)},${candidate.slice(insertAt)}`;
    }
  }
  throw lastError || new Error('JSON无法解析');
}

const PATCH_OPERATIONS = new Set(['replace', 'delta', 'insert', 'remove', 'move']);
const PATCH_OPERATION_ALIASES = Object.freeze({
  add: 'insert', set: 'replace', update: 'replace', change: 'replace', modify: 'replace', 修改: 'replace',
});
export function parseUpdateVariableBlock(message) {
  const source = String(message || '');
  const blocks = [...source.matchAll(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable\s*>/gi)];
  if (blocks.length > 1) return { ok: false, code: 'multiple-blocks', error: `检测到${blocks.length}个<UpdateVariable>区块，拒绝选择或合并`, operations: [] };
  let rawBlock = blocks[0]?.[0] || '';
  let sourceRawBlock = rawBlock;
  let sourceStart = Number(blocks[0]?.index ?? -1);
  let sourceEnd = sourceStart >= 0 ? sourceStart + sourceRawBlock.length : -1;
  let recoveredEnvelope = false;
  if (!rawBlock) {
    const opens = [...source.matchAll(/<UpdateVariable\b[^>]*>/gi)];
    const closes = [...source.matchAll(/<\/UpdateVariable\s*>/gi)];
    if (opens.length === 1 && closes.length === 0) {
      sourceStart = Number(opens[0].index);
      const tail = source.slice(sourceStart);
      const patchClose = tail.match(/<JSONPatch\b[^>]*>[\s\S]*?<\/JSONPatch\s*>/i);
      if (patchClose) {
        sourceEnd = sourceStart + Number(patchClose.index) + patchClose[0].length;
        const suffix = source.slice(sourceEnd);
        if (/^(?:\s|```)*$/u.test(suffix)) {
          sourceRawBlock = source.slice(sourceStart, sourceEnd);
          rawBlock = `${sourceRawBlock}\n</UpdateVariable>`;
          recoveredEnvelope = true;
        }
      }
    }
  }
  if (!rawBlock) return { ok: false, error: '缺少完整的<UpdateVariable>区块', operations: [] };
  const patch = rawBlock.match(/<JSONPatch\b[^>]*>([\s\S]*?)<\/JSONPatch\s*>/i)?.[1];
  if (patch == null) return { ok: false, error: 'UpdateVariable缺少完整的JSONPatch区块', operations: [] };
  let parsed;
  try { parsed = parseJsonWithLocalRepair(patch); }
  catch (error) { return { ok: false, error: `JSONPatch无法解析：${error.message || error}`, operations: [] }; }
  if (!Array.isArray(parsed)) return { ok: false, error: 'JSONPatch根节点必须是数组', operations: [] };
  const operations = [];
  for (const [index, raw] of parsed.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: `第${index + 1}个变量操作不是对象`, operations: [] };
    const rawVerb = String(raw.op || '').toLowerCase();
    const operation = { ...raw, op: PATCH_OPERATION_ALIASES[rawVerb] || rawVerb };
    if (!PATCH_OPERATIONS.has(operation.op)) return { ok: false, error: `第${index + 1}个变量操作不受支持：${operation.op || '空'}`, operations: [] };
    if (['replace', 'delta', 'insert'].includes(operation.op) && !Object.prototype.hasOwnProperty.call(operation, 'value')) return { ok: false, error: `第${index + 1}个${operation.op}操作缺少value`, operations: [] };
    if (operation.op === 'move') {
      operation.to ||= operation.path;
      delete operation.path;
      if (typeof operation.from !== 'string' || !operation.from.startsWith('/') || typeof operation.to !== 'string' || !operation.to.startsWith('/')) return { ok: false, error: `第${index + 1}个move操作缺少from/to路径`, operations: [] };
      if ([operation.from, operation.to].some((path) => path.split('/').slice(1).some((part) => part.startsWith('_')))) return { ok: false, error: `第${index + 1}个move操作触碰只读路径`, operations: [] };
    } else {
      if (typeof operation.path !== 'string' || !operation.path.startsWith('/')) return { ok: false, error: `第${index + 1}个变量操作缺少JSON Pointer路径`, operations: [] };
      if (operation.path.split('/').slice(1).some((part) => part.startsWith('_'))) return { ok: false, error: `第${index + 1}个变量操作触碰只读路径：${operation.path}`, operations: [] };
    }
    operations.push(operation);
  }
  const analysis = rawBlock.match(/<Analysis\b[^>]*>([\s\S]*?)<\/Analysis\s*>/i)?.[1]?.trim() || '';
  const block = buildUpdateVariableBlock(operations, '变量医生仅提交经MVU解析验证的纠错补丁。');
  return { ok: true, operations, block, rawBlock, sourceRawBlock, sourceStart, sourceEnd, recoveredEnvelope, analysis };
}

function balancedJsonArrays(source, limit = 2) {
  const text = String(source || '');
  const output = [];
  let start = -1;
  let stack = [];
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (start < 0) {
      if (character !== '[') continue;
      start = index;
      stack = [']'];
      continue;
    }
    if (character === '[') stack.push(']');
    else if (character === '{') stack.push('}');
    else if (character === ']' || character === '}') {
      if (stack.at(-1) !== character) {
        start = -1;
        stack = [];
        continue;
      }
      stack.pop();
      if (!stack.length) {
        output.push(text.slice(start, index + 1));
        if (output.length >= Math.max(1, Number(limit) || 2)) break;
        start = -1;
      }
    }
  }
  return output;
}

export function parseVariableDoctorOutput(message) {
  const direct = parseUpdateVariableBlock(message);
  if (direct.ok) return { ...direct, recovery: direct.recoveredEnvelope ? 'missing-update-close' : '' };
  const source = String(message || '');
  const taggedPatches = [...source.matchAll(/<JSONPatch\b[^>]*>([\s\S]*?)<\/JSONPatch\s*>/gi)];
  let candidates = taggedPatches.map((match) => match[1]);
  if (!candidates.length) candidates = balancedJsonArrays(source, 3);
  const parsedCandidates = [];
  for (const candidate of candidates) {
    try {
      const value = parseJsonWithLocalRepair(candidate);
      if (Array.isArray(value) && value.every((item) => item && typeof item === 'object' && !Array.isArray(item) && item.op)) parsedCandidates.push(value);
    } catch { /* try the next uniquely bounded candidate */ }
  }
  if (parsedCandidates.length !== 1) return { ...direct, recovery: '', error: `${direct.error}；宽容提取找到${parsedCandidates.length}个可用JSONPatch数组` };
  const analysis = source.match(/<Analysis\b[^>]*>([\s\S]*?)<\/Analysis\s*>/i)?.[1]?.trim()
    || '格式由本地宽容解析器恢复；变量判断仍来自同一次模型核验。';
  const recovered = parseUpdateVariableBlock(buildUpdateVariableBlock(parsedCandidates[0], analysis));
  return recovered.ok ? { ...recovered, recovery: taggedPatches.length ? 'jsonpatch-without-envelope' : 'balanced-json-array' } : recovered;
}

export function buildUpdateVariableBlock(operations, analysis = '变量更新。') {
  return [
    '<UpdateVariable>',
    '<Analysis>',
    String(analysis || '变量更新。').replace(/[<>]/g, ''),
    '</Analysis>',
    '<JSONPatch>',
    JSON.stringify(Array.isArray(operations) ? operations : [], null, 2),
    '</JSONPatch>',
    '</UpdateVariable>',
  ].join('\n');
}

/**
 * Repairs only accepted-envelope defects with a deterministic structural boundary:
 * a missing close before options/variables, a single misplaced close after complete
 * options/variable blocks, or a missing open immediately before the first explicit
 * narrative/check container that is already closed before those blocks. Everything
 * else fails closed instead of guessing where free prose begins or ends.
 */
export function repairAcceptedNarrativeEnvelope(message) {
  const source = String(message || '');
  const opens = [...source.matchAll(/<content\b[^>]*>/gi)];
  const closes = [...source.matchAll(/<\/content\s*>/gi)];
  if (opens.length === 0 && closes.length === 0) {
    return { ok: true, changed: false, message: source, repairs: [] };
  }
  if (opens.length === 1 && closes.length === 1) {
    const openIndex = Number(opens[0].index);
    const openEnd = openIndex + opens[0][0].length;
    const closeIndex = Number(closes[0].index);
    const closeEnd = closeIndex + closes[0][0].length;
    const firstBoundary = [...source.matchAll(/<(?:options|UpdateVariable)\b[^>]*>/gi)]
      .map((match) => Number(match.index))
      .filter((index) => index > openIndex)
      .sort((left, right) => left - right)[0];
    if (openIndex < closeIndex && (firstBoundary === undefined || closeIndex < firstBoundary)) {
      return { ok: true, changed: false, message: source, repairs: [] };
    }

    if (openIndex < firstBoundary && firstBoundary < closeIndex && source.slice(closeEnd).trim() === '') {
      const blocks = ['options', 'UpdateVariable'].flatMap((tag) => {
        const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
        return [...source.matchAll(pattern)].map((match) => ({
          tag: tag.toLowerCase(),
          start: Number(match.index),
          end: Number(match.index) + match[0].length,
        }));
      }).filter((block) => block.start >= firstBoundary && block.end <= closeIndex)
        .sort((left, right) => left.start - right.start);
      const zone = source.slice(firstBoundary, closeIndex);
      const openerCount = [...zone.matchAll(/<(?:options|UpdateVariable)\b[^>]*>/gi)].length;
      const closerCount = [...zone.matchAll(/<\/(?:options|UpdateVariable)\s*>/gi)].length;
      const uniqueTagCount = new Set(blocks.map((block) => block.tag)).size;
      const boundariesAreComplete = blocks.length > 0
        && blocks.length === openerCount
        && blocks.length === closerCount
        && blocks.length === uniqueTagCount
        && blocks[0].start === firstBoundary
        && source.slice(openEnd, firstBoundary).trim().length > 0
        && blocks.every((block, index) => {
          const previousEnd = index === 0 ? firstBoundary : blocks[index - 1].end;
          return block.start >= previousEnd && source.slice(previousEnd, block.start).trim() === '';
        })
        && source.slice(blocks.at(-1).end, closeIndex).trim() === '';
      if (boundariesAreComplete) {
        const before = source.slice(0, firstBoundary).replace(/[ \t]+$/u, '').replace(/\n*$/u, '');
        const structured = source.slice(firstBoundary, closeIndex).trim();
        return {
          ok: true,
          changed: true,
          message: `${before}\n</content>\n${structured}${source.slice(closeEnd)}`,
          repairs: ['relocate_misplaced_content_close_before_structured_boundary'],
        };
      }
    }
    return { ok: false, changed: false, message: source, error: '正文content闭合标签顺序错误或跨入了选项/变量边界' };
  }
  if (opens.length === 1 && closes.length === 0) {
    const openEnd = Number(opens[0].index) + opens[0][0].length;
    const boundaries = [...source.matchAll(/<(?:options?|UpdateVariable)\b[^>]*>/gi)]
      .map((match) => Number(match.index))
      .filter((index) => index > openEnd)
      .sort((left, right) => left - right);
    if (boundaries.length < 1) {
      return { ok: false, changed: false, message: source, error: '正文缺少content闭合标签，且没有可证明的选项或变量边界' };
    }
    const boundary = boundaries[0];
    const narrative = source.slice(openEnd, boundary).trim();
    if (!narrative) {
      return { ok: false, changed: false, message: source, error: '正文content为空，不能自动补闭合标签' };
    }
    const before = source.slice(0, boundary).replace(/[ \t]+$/u, '').replace(/\n*$/u, '');
    const after = source.slice(boundary).replace(/^\s*/u, '');
    return {
      ok: true,
      changed: true,
      message: `${before}\n</content>\n${after}`,
      repairs: ['insert_missing_content_close_before_structured_boundary'],
    };
  }
  if (opens.length === 0 && closes.length === 1) {
    const closeIndex = Number(closes[0].index);
    const firstBoundary = [...source.matchAll(/<(?:options?|UpdateVariable)\b[^>]*>/gi)]
      .map((match) => Number(match.index))
      .filter((index) => index > closeIndex)
      .sort((left, right) => left - right)[0];
    const anchors = [...source.matchAll(/<(?:check|story_body)\b[^>]*>/gi)]
      .map((match) => Number(match.index))
      .filter((index) => index < closeIndex)
      .sort((left, right) => left - right);
    if (firstBoundary === undefined || anchors.length < 1) {
      return { ok: false, changed: false, message: source, error: '正文缺少content开始标签，且没有可证明的检定/正文容器与选项或变量边界' };
    }
    const anchor = anchors[0];
    const narrative = source.slice(anchor, closeIndex).trim();
    if (!narrative) {
      return { ok: false, changed: false, message: source, error: '正文content闭合前没有可用内容，不能自动补开始标签' };
    }
    const before = source.slice(0, anchor).replace(/[ \t]+$/u, '').replace(/\n*$/u, '');
    const after = source.slice(anchor).replace(/^\s*/u, '');
    return {
      ok: true,
      changed: true,
      message: `${before}${before ? '\n' : ''}<content>\n${after}`,
      repairs: ['insert_missing_content_open_before_first_narrative_anchor'],
    };
  }
  return {
    ok: false,
    changed: false,
    message: source,
    error: `正文content结构不唯一：开始标签${opens.length}个，闭合标签${closes.length}个`,
  };
}

function pointerParts(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || /~(?![01])/.test(path)) return null;
  return path.slice(1).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function pointerValue(root, path) {
  const parts = pointerParts(path);
  if (!parts) return { found: false };
  let value = root;
  for (const part of parts) {
    if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) return { found: false };
    value = value[part];
  }
  return { found: true, value };
}

function pointerParent(root, path) {
  const parts = pointerParts(path);
  if (!parts?.length) return null;
  const key = parts.pop();
  let parent = root;
  for (const part of parts) {
    if (!parent || typeof parent !== 'object' || !Object.prototype.hasOwnProperty.call(parent, part)) return null;
    parent = parent[part];
  }
  return parent && typeof parent === 'object' ? { parent, key } : null;
}

function pointerPath(parts) {
  return `/${(parts || []).map((part) => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;
}

function parentPointer(path) {
  const parts = pointerParts(path);
  return parts?.length > 1 ? pointerPath(parts.slice(0, -1)) : '/';
}

function doctorOwnedProfilePath(path) {
  const parts = pointerParts(path);
  if (!parts?.length) return false;
  const canonical = parts[0] === 'stat_data' ? parts.slice(1) : parts;
  return canonical[0] === PROFILE_ROOT.slice(1);
}

function setPointerValue(root, path, found, value) {
  const parts = pointerParts(path);
  if (!parts) return false;
  if (!parts.length) return false;
  const key = parts.pop();
  let parent = root;
  for (const part of parts) {
    if (!parent || typeof parent !== 'object' || !Object.prototype.hasOwnProperty.call(parent, part)) return false;
    parent = parent[part];
  }
  if (!parent || typeof parent !== 'object') return false;
  if (!found) {
    if (Array.isArray(parent)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= parent.length) return true;
      parent.splice(index, 1);
    } else delete parent[key];
    return true;
  }
  if (Array.isArray(parent)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index > parent.length) return false;
    if (index === parent.length) parent.push(deepClone(value));
    else parent[index] = deepClone(value);
  } else parent[key] = deepClone(value);
  return true;
}

export function semanticJsonEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => semanticJsonEqual(item, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index]
      && semanticJsonEqual(left[key], right[key]));
}

function pathOverlaps(left, right) {
  if (left === '/' || right === '/') return true;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function leafChanges(before, after, base = '', output = [], limit = 240) {
  if (output.length >= limit || semanticJsonEqual(before, after)) return output;
  const beforeObject = before && typeof before === 'object';
  const afterObject = after && typeof after === 'object';
  if (!beforeObject || !afterObject || Array.isArray(before) || Array.isArray(after)) {
    output.push({ path: base || '/', before: deepClone(before), after: deepClone(after) });
    return output;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (output.length >= limit) break;
    const path = `${base}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
    if (!Object.prototype.hasOwnProperty.call(before, key)) output.push({ path, beforeMissing: true, after: deepClone(after[key]) });
    else if (!Object.prototype.hasOwnProperty.call(after, key)) output.push({ path, before: deepClone(before[key]), afterMissing: true });
    else leafChanges(before[key], after[key], path, output, limit);
  }
  return output;
}

export function diffStatData(previousData, currentData, limit = 240) {
  return leafChanges(variableStateOf(previousData), variableStateOf(currentData), '', [], Math.max(1, Number(limit) || 240));
}

export function variableChangePaths(previousData, currentData, limit = 1200) {
  const maximum = Math.max(1, Number(limit) || 1200);
  const changes = leafChanges(variableStateOf(previousData), variableStateOf(currentData), '', [], maximum + 1);
  if (changes.length > maximum) return { ok: false, paths: [], changes: [], error: `变量实际变化超过事务上限${maximum}项` };
  const paths = [...new Set(changes.map((change) => change?.path).filter((path) => typeof path === 'string' && path !== '/'))];
  return { ok: true, paths, changes };
}

export function verifyVariablePreservation(currentData, proposedData, allowedPaths = [], limit = 1200) {
  const changed = variableChangePaths(currentData, proposedData, limit);
  if (!changed.ok) return { ok: false, unexpected: [], error: changed.error };
  const allowed = [...new Set((allowedPaths || []).filter((path) => typeof path === 'string' && path.startsWith('/')))];
  const unexpected = changed.changes.filter((change) => !allowed.some((path) => pathOverlaps(change.path, path)));
  return {
    ok: unexpected.length === 0,
    unexpected,
    error: unexpected.length ? `完整替换块会改写${unexpected.length}个未声明路径：${unexpected.slice(0, 8).map((item) => item.path).join('、')}` : '',
  };
}

function isValueWithDescription(value) {
  return Array.isArray(value) && value.length === 2 && typeof value[1] === 'string' && !Array.isArray(value[0]);
}

function operationPathExists(stat, operation, path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return false;
  if (operation === 'insert') {
    const parent = parentPointer(path);
    return parent === '/' ? Boolean(stat && typeof stat === 'object') : pointerValue(stat, parent).found;
  }
  return pointerValue(stat, path).found;
}

function repairOperationPath(stat, operation, path) {
  if (typeof path !== 'string' || !path.startsWith('/') || operationPathExists(stat, operation, path)) return { path, repair: '' };
  const parts = pointerParts(path);
  if (!parts) return { path, repair: '' };
  const candidates = [];
  if (parts[0] === 'stat_data' && !Object.prototype.hasOwnProperty.call(stat || {}, 'stat_data')) candidates.push(pointerPath(parts.slice(1)));
  if (parts.some((part) => part === '')) candidates.push(pointerPath(parts.filter((part) => part !== '')));
  if (parts[0] === 'stat_data' && parts.slice(1).some((part) => part === '') && !Object.prototype.hasOwnProperty.call(stat || {}, 'stat_data')) {
    candidates.push(pointerPath(parts.slice(1).filter((part) => part !== '')));
  }
  const fixed = candidates.find((candidate, index, all) => candidate !== path
    && all.indexOf(candidate) === index
    && operationPathExists(stat, operation, candidate));
  return fixed ? { path: fixed, repair: `${path} → ${fixed}` } : { path, repair: '' };
}

export function normalizeVariableOperations(currentData, operations = []) {
  const stat = statDataOf(currentData);
  const normalized = [];
  const repairs = [];
  for (const [index, raw] of operations.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: `第${index + 1}个变量操作不是对象`, operations: [], repairs };
    const alias = PATCH_OPERATION_ALIASES[String(raw.op || '').toLowerCase()] || String(raw.op || '').toLowerCase();
    const operation = { ...deepClone(raw), op: alias };
    if (!PATCH_OPERATIONS.has(operation.op)) return { ok: false, error: `第${index + 1}个变量操作不受支持：${operation.op || '空'}`, operations: [], repairs };
    for (const key of operation.op === 'move' ? ['from', 'to'] : ['path']) {
      if (doctorOwnedProfilePath(operation[key])) return { ok: false, code: 'profile-root-owned-by-profile-doctor', error: `第${index + 1}个变量操作越权触碰${PROFILE_ROOT}；人物档案只允许人物医生原子提交`, operations: [], repairs };
      const fixed = repairOperationPath(stat, operation.op === 'move' && key === 'to' ? 'insert' : operation.op, operation[key]);
      if (fixed.repair) repairs.push({ index, kind: 'path', detail: fixed.repair });
      operation[key] = fixed.path;
      if (doctorOwnedProfilePath(operation[key])) return { ok: false, code: 'profile-root-owned-by-profile-doctor', error: `第${index + 1}个变量操作经路径归一化后越权触碰${PROFILE_ROOT}；人物档案只允许人物医生原子提交`, operations: [], repairs };
    }
    if (operation.op === 'delta' && typeof operation.value === 'string' && operation.value.trim() !== '' && Number.isFinite(Number(operation.value))) {
      operation.value = Number(operation.value);
      repairs.push({ index, kind: 'delta-number', detail: '已把数字字符串转换为数值' });
    }
    if (operation.op === 'move') {
      const source = pointerValue(stat, operation.from);
      const destination = pointerValue(stat, operation.to);
      const destinationParent = parentPointer(operation.to);
      const parentExists = destinationParent === '/' || pointerValue(stat, destinationParent).found;
      if (!source.found || destination.found || !parentExists) {
        return { ok: false, error: `第${index + 1}个move无法安全拆解：来源必须存在、目标必须不存在且目标父路径必须存在`, operations: [], repairs };
      }
      normalized.push({ op: 'insert', path: operation.to, value: deepClone(source.value) }, { op: 'remove', path: operation.from });
      repairs.push({ index, kind: 'move', detail: '已按MVU实际支持的语义拆成insert + remove' });
      continue;
    }
    normalized.push(operation);
  }
  return { ok: true, operations: normalized, repairs };
}

export function validatePatchOperations(currentData, operations) {
  const before = deepClone(statDataOf(currentData));
  const expected = deepClone(before);
  if (!expected || typeof expected !== 'object') return { ok: false, error: '当前MVU没有可验证的stat_data' };
  const touched = [];
  const rollbackPaths = [];
  for (const [index, operation] of (operations || []).entries()) {
    const number = index + 1;
    const operationPaths = operation.op === 'move' ? [operation.from, operation.to] : [operation.path];
    if (operationPaths.some(doctorOwnedProfilePath)) {
      return { ok: false, code: 'profile-root-owned-by-profile-doctor', error: `第${number}个操作越权触碰${PROFILE_ROOT}；变量医生不得与人物档案提交竞争` };
    }
    if (operation.op === 'move') {
      const source = pointerParent(expected, operation.from);
      const destination = pointerParent(expected, operation.to);
      const hit = pointerValue(expected, operation.from);
      if (!source || !destination || !hit.found) return { ok: false, error: `第${number}个move的来源或目标父路径不存在` };
      if (Array.isArray(source.parent)) {
        const sourceIndex = Number(source.key);
        if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= source.parent.length) return { ok: false, error: `第${number}个move来源数组位置无效` };
        source.parent.splice(sourceIndex, 1);
      } else delete source.parent[source.key];
      if (Array.isArray(destination.parent)) {
        const destinationIndex = destination.key === '-' ? destination.parent.length : Number(destination.key);
        if (!Number.isInteger(destinationIndex) || destinationIndex < 0 || destinationIndex > destination.parent.length) return { ok: false, error: `第${number}个move目标数组位置无效` };
        destination.parent.splice(destinationIndex, 0, deepClone(hit.value));
      } else destination.parent[destination.key] = deepClone(hit.value);
      touched.push(operation.from, operation.to);
      rollbackPaths.push(parentPointer(operation.from) === '/' ? operation.from : parentPointer(operation.from));
      rollbackPaths.push(parentPointer(operation.to) === '/' ? operation.to : parentPointer(operation.to));
      continue;
    }
    const parent = pointerParent(expected, operation.path);
    const hit = pointerValue(expected, operation.path);
    let touchedPath = operation.path;
    if (!parent) return { ok: false, error: `第${number}个操作的父路径不存在：${operation.path}` };
    if (operation.op === 'insert') {
      if (hit.found) return { ok: false, error: `第${number}个insert目标已经存在：${operation.path}` };
      if (Array.isArray(parent.parent)) {
        const arrayIndex = parent.key === '-' ? parent.parent.length : Number(parent.key);
        if (!Number.isInteger(arrayIndex) || arrayIndex < 0 || arrayIndex > parent.parent.length) return { ok: false, error: `第${number}个insert数组位置无效：${operation.path}` };
        parent.parent.splice(arrayIndex, 0, deepClone(operation.value));
        touchedPath = `${parentPointer(operation.path).replace(/\/$/, '')}/${arrayIndex}`;
      } else parent.parent[parent.key] = deepClone(operation.value);
    } else if (operation.op === 'replace') {
      if (!hit.found) return { ok: false, error: `第${number}个replace目标不存在：${operation.path}` };
      if (isValueWithDescription(hit.value) && (!operation.value || typeof operation.value !== 'object')) {
        parent.parent[parent.key][0] = deepClone(operation.value);
      } else {
        parent.parent[parent.key] = deepClone(operation.value);
      }
    } else if (operation.op === 'delta') {
      const currentNumber = isValueWithDescription(hit.value) ? hit.value[0] : hit.value;
      if (!hit.found || typeof currentNumber !== 'number' || typeof operation.value !== 'number' || !Number.isFinite(operation.value)) return { ok: false, error: `第${number}个delta目标或增量不是有效数字：${operation.path}` };
      if (isValueWithDescription(hit.value)) parent.parent[parent.key][0] = currentNumber + operation.value;
      else parent.parent[parent.key] = currentNumber + operation.value;
    } else if (operation.op === 'remove') {
      if (!hit.found) return { ok: false, error: `第${number}个remove目标不存在：${operation.path}` };
      if (Array.isArray(parent.parent)) {
        const arrayIndex = Number(parent.key);
        if (!Number.isInteger(arrayIndex) || arrayIndex < 0 || arrayIndex >= parent.parent.length) return { ok: false, error: `第${number}个remove数组位置无效：${operation.path}` };
        parent.parent.splice(arrayIndex, 1);
      }
      else delete parent.parent[parent.key];
    }
    touched.push(touchedPath);
    const rollbackPath = (Array.isArray(parent.parent) && ['insert', 'remove'].includes(operation.op)) ? parentPointer(operation.path) : operation.path;
    rollbackPaths.push(rollbackPath === '/' ? operation.path : rollbackPath);
  }
  return { ok: true, before, expected, touched: [...new Set(touched)], rollbackPaths: [...new Set(rollbackPaths)] };
}

export function verifyPatchOperations(data, validation) {
  const stat = statDataOf(data);
  if (!validation?.ok || !stat) return false;
  return validation.touched.every((path) => {
    const expected = pointerValue(validation.expected, path);
    const actual = pointerValue(stat, path);
    return expected.found === actual.found && (!expected.found || semanticJsonEqual(expected.value, actual.value));
  });
}

export function verifyPatchApplication(data, validation, allowPaths = []) {
  if (!validation?.ok) return { ok: false, errors: ['缺少有效的补丁校验结果'] };
  const stat = statDataOf(data);
  const targetErrors = [];
  for (const path of validation.touched || []) {
    const expected = pointerValue(validation.expected, path);
    const actual = pointerValue(stat, path);
    if (expected.found !== actual.found || (expected.found && !semanticJsonEqual(expected.value, actual.value))) targetErrors.push({ path, message: `目标路径未按预期落地：${path}` });
  }
  const permitted = [...(validation.touched || []), ...(allowPaths || [])];
  const unexpected = leafChanges(validation.before, stat).filter((change) => {
    if (change.path.split('/').some((part) => part.startsWith('_'))) return false;
    return !permitted.some((path) => pathOverlaps(change.path, path));
  });
  const errors = [...targetErrors.map((item) => item.message), ...unexpected.slice(0, 12).map((change) => `补丁外路径发生变化：${change.path}`)];
  return { ok: errors.length === 0, errors, targetErrors, unexpected };
}

export function restoreTouchedData(currentData, beforeData, rollbackPaths = []) {
  const restored = deepClone(currentData);
  const stat = statDataOf(restored);
  const before = statDataOf(beforeData);
  const paths = [...new Set((rollbackPaths || []).filter((path) => typeof path === 'string' && path !== '/'))]
    .sort((left, right) => pointerParts(left).length - pointerParts(right).length)
    .filter((path, index, all) => !all.slice(0, index).some((parent) => pathOverlaps(path, parent)));
  for (const path of paths) {
    const old = pointerValue(before, path);
    if (!setPointerValue(stat, path, old.found, old.value)) return { ok: false, error: `无法恢复变量路径：${path}` };
  }
  return { ok: true, data: restored, paths };
}

export function verifyRestoredPaths(data, beforeData, paths = []) {
  const stat = statDataOf(data);
  const before = statDataOf(beforeData);
  return (paths || []).every((path) => {
    const expected = pointerValue(before, path);
    const actual = pointerValue(stat, path);
    return expected.found === actual.found && (!expected.found || semanticJsonEqual(expected.value, actual.value));
  });
}

export function capturePathSnapshot(data, paths = []) {
  const stat = statDataOf(data);
  return [...new Set(paths || [])].filter((path) => typeof path === 'string' && path !== '/').map((path) => {
    const hit = pointerValue(stat, path);
    return { path, found: hit.found, ...(hit.found ? { value: deepClone(hit.value) } : {}) };
  });
}

export function restorePathSnapshot(currentData, snapshot = []) {
  const restored = deepClone(currentData);
  const stat = statDataOf(restored);
  for (const item of snapshot || []) {
    if (!item || typeof item.path !== 'string' || item.path === '/') return { ok: false, error: '变量快照包含无效路径' };
    if (!setPointerValue(stat, item.path, Boolean(item.found), item.value)) return { ok: false, error: `无法恢复变量快照：${item.path}` };
  }
  return { ok: true, data: restored, paths: (snapshot || []).map((item) => item.path) };
}

export function verifyPathSnapshot(data, snapshot = []) {
  const stat = statDataOf(data);
  return (snapshot || []).every((item) => {
    const actual = pointerValue(stat, item.path);
    return actual.found === Boolean(item.found) && (!actual.found || semanticJsonEqual(actual.value, item.value));
  });
}

export function replaceUpdateVariableBlock(originalMessage, replacementMessage) {
  const replacement = parseUpdateVariableBlock(replacementMessage);
  if (!replacement.ok) return replacement;
  const source = String(originalMessage || '');
  const completeBlocks = [...source.matchAll(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable\s*>/gi)];
  const openTags = [...source.matchAll(/<UpdateVariable\b[^>]*>/gi)];
  const closeTags = [...source.matchAll(/<\/UpdateVariable\s*>/gi)];
  const parsedOriginal = parseUpdateVariableBlock(source);
  const recoveredOriginal = parsedOriginal.ok && parsedOriginal.recoveredEnvelope
    && Number.isInteger(parsedOriginal.sourceStart) && parsedOriginal.sourceStart >= 0
    && Number.isInteger(parsedOriginal.sourceEnd) && parsedOriginal.sourceEnd > parsedOriginal.sourceStart;
  if (openTags.length > 1 || closeTags.length > 1 || completeBlocks.length > 1
    || (!recoveredOriginal && openTags.length !== closeTags.length)) {
    return {
      ok: false,
      code: 'ambiguous-original-envelope',
      error: `原正文的UpdateVariable边界不可唯一证明（开始${openTags.length}个、结束${closeTags.length}个、完整${completeBlocks.length}个）`,
      operations: [],
    };
  }
  const block = buildUpdateVariableBlock(replacement.operations, replacement.analysis || '变量医生提交本回合完整替换块。');
  let message;
  let mode;
  if (recoveredOriginal) {
    message = `${source.slice(0, parsedOriginal.sourceStart)}${block}${source.slice(parsedOriginal.sourceEnd)}`;
    mode = 'replace-recovered-envelope';
  } else if (completeBlocks.length === 1) {
    const match = completeBlocks[0];
    message = `${source.slice(0, Number(match.index))}${block}${source.slice(Number(match.index) + match[0].length)}`;
    mode = parsedOriginal.ok ? 'replace-valid' : 'replace-invalid-bounded';
  } else {
    message = `${source.trim()}\n\n${block}`;
    mode = 'append-missing';
  }
  message = message.replace(/\n{3,}/g, '\n\n').trim();
  const verified = parseUpdateVariableBlock(message);
  if (!verified.ok || !semanticJsonEqual(verified.operations, replacement.operations)) {
    return { ok: false, code: 'replacement-block-verification-failed', error: `完整替换块写回后无法唯一读回：${verified.error || '操作不一致'}`, operations: [] };
  }
  return { ok: true, operations: replacement.operations, block, message, mode };
}

export async function refreshHostMessageSurface(host, messageId, message) {
  const result = { rendered: false, eventEmitted: false, errors: [] };
  if (typeof host?.updateMessageBlock === 'function') {
    try {
      await Promise.resolve(host.updateMessageBlock(messageId, message));
      result.rendered = true;
    } catch (error) {
      result.errors.push(`updateMessageBlock失败：${error?.message || error}`);
    }
  } else result.errors.push('宿主未提供updateMessageBlock');
  const eventName = host?.eventTypes?.MESSAGE_UPDATED || host?.event_types?.MESSAGE_UPDATED || 'message_updated';
  if (typeof host?.eventSource?.emit === 'function') {
    try {
      await Promise.resolve(host.eventSource.emit(eventName, messageId));
      result.eventEmitted = true;
    } catch (error) {
      result.errors.push(`MESSAGE_UPDATED发送失败：${error?.message || error}`);
    }
  } else result.errors.push('宿主未提供MESSAGE_UPDATED事件接口');
  return result;
}

export function parseProfileReceipt(message) {
  const raw = String(message || '');
  if (/<人物档案无变化\s*\/>/i.test(raw)) return { kind: 'nochange', profiles: [] };
  const match = raw.match(/<人物档案更新>([\s\S]*?)<\/人物档案更新>/i);
  if (!match) return { kind: 'missing', profiles: [], error: '正文缺少人物档案完成信号' };
  try {
    const parsed = parseJsonWithLocalRepair(match[1]);
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

function usableScalar(value) {
  if (value == null) return false;
  if (typeof value === 'string') return isNonEmptyText(value);
  return true;
}

function asList(value) {
  if (Array.isArray(value)) return value.filter(usableScalar);
  return usableScalar(value) ? [value] : [];
}

function meaningfulProfileListItem(value) {
  if (typeof value === 'string') return isNonEmptyText(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(meaningfulProfileListItem);
  return Object.values(value).some(meaningfulProfileListItem);
}

export function profileCompletenessReport(profile, fallbackLabel = '人物档案') {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return { ok: false, errors: [`${fallbackLabel}不是对象`] };
  }
  const label = String(profile.name || fallbackLabel);
  const errors = [];
  for (const path of REQUIRED_TEXT_PATHS) {
    if (!isNonEmptyText(at(profile, path))) errors.push(`${label}缺少可用字段：${path}`);
  }
  if (!Array.isArray(profile.aliases)) errors.push(`${label}的aliases不是数组`);
  for (const path of REQUIRED_ARRAYS) {
    const value = at(profile, path);
    if (!Array.isArray(value) || !value.some(meaningfulProfileListItem)) errors.push(`${label}缺少可用内容的完整列表：${path}`);
  }
  return { ok: errors.length === 0, errors };
}

function stripNarrativeHtmlWidgets(text) {
  const source = String(text || '');
  const unconditionalDropTags = new Set(['htmlcontent', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'style', 'script', 'svg']);
  const hiddenElement = (raw) => (
    /\shidden(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?>)/iu.test(raw)
    || /\baria-hidden\s*=\s*(?:["']?\s*true\s*["']?)/iu.test(raw)
    || /\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*["']/iu.test(raw)
  );
  const widgetContainer = (tag, raw) => unconditionalDropTags.has(tag) || hiddenElement(raw) || (
    ['div', 'section', 'aside', 'details', 'summary'].includes(tag)
    && /(?:\b(?:class|id)\s*=\s*["'][^"']*(?:status|card|panel|hud|inventory|profile|attribute|equipment|item|mvu)[^"']*["']|\bstyle\s*=\s*["'][^"']*(?:background|border|box-shadow|display\s*:\s*(?:flex|grid)|font-family)[^"']*["'])/i.test(raw)
  );
  const token = /<\/?([A-Za-z][\w:-]*)\b[^>]*>/g;
  const stack = [];
  let output = '';
  let cursor = 0;
  for (const match of source.matchAll(token)) {
    const raw = match[0];
    const tag = String(match[1] || '').toLowerCase();
    const closing = /^<\//.test(raw);
    const selfClosing = /\/\s*>$/.test(raw) || ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tag);
    const dropping = stack.some((entry) => entry.drop);
    if (!dropping) output += source.slice(cursor, match.index);
    if (closing) {
      const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (index >= 0) stack.splice(index);
      else if (!dropping) output += raw;
    } else if (!selfClosing) {
      const drop = dropping || widgetContainer(tag, raw);
      stack.push({ tag, drop });
      if (!drop) output += raw;
    } else if (!dropping && !widgetContainer(tag, raw)) output += raw;
    cursor = Number(match.index) + raw.length;
  }
  if (!stack.some((entry) => entry.drop)) output += source.slice(cursor);
  return output;
}

export function profileNarrativeText(text) {
  return stripNarrativeHtmlWidgets(String(text || '')
    .replace(/<gm_chain\b[^>]*>[\s\S]*?<\/gm_chain\s*>/gi, '')
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking\s*>/gi, '')
    .replace(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable\s*>/gi, '')
    .replace(/<options?\b[^>]*>[\s\S]*?<\/options?\s*>/gi, '')
    .replace(/<人物档案(?:更新|无变化)\b[^>]*>[\s\S]*?<\/人物档案(?:更新|无变化)\s*>/gi, '')
    .replace(/<人物档案无变化\s*\/>/gi, ''));
}

const PROFILE_SUBJECT_BLOCKLIST = new Set([
  '系统', '旁白', '正文', '选项', '玩家', '用户', '助手', '角色', '人物', '众人', '人群',
  '大家', '所有人', '其他人', '对方', '来人', '声音', '脚步声', '当前环境', '核心状态总览',
  '战力与物资库', '人际与过往记录', '副本情报', '敌情警戒', '回廊地图', '职业树', '状态档案',
  '时间', '地点', '状态', '任务', '目标', '说明', '注意', '提示', '分析', '结果', '回合', '场景', '环境',
  '当前时间', '当前地点', '继续', '这番', '名称', '品质', '属性加成', '效果', '描述', '类型', '数量',
  'HP', 'MP', 'STR', 'AGI', 'CON', 'PER', 'EXP', 'UP',
]);
const PROFILE_IDENTITY_GRAMMAR_BLOCKLIST = new Set([
  '还是', '也就是', '就是', '但每个人', '每个人', '那么', '所以', '因此', '因为', '如果', '虽然', '然而',
  '于是', '随后', '接着', '然后', '这时', '此时', '与此同时', '已经', '正在', '开始', '结束', '继续',
  '欠身', '点头', '摇头', '抬手', '伸手', '转身', '走来', '走进', '推开', '递出', '取出', '收起',
  '挡住', '看向', '望向', '站起', '坐下', '微笑', '轻笑', '皱眉', '说道', '说', '问道', '问', '回答',
  '喊道', '喊', '开口', '回应', '解释', '提醒', '补充', '嘀咕', '咕哝',
]);
const PROFILE_MECHANISM_LABEL = /(?:fingerprint|digest|schema|jsonpatch|json|analysis|prompt|ticket|receipt|profile|status|state|version|count|updatevariable)$/iu;

function normalizedSubjectLabel(value) {
  let label = String(value || '')
    .replace(/^[\s\[【(（“”"'‘’《》<>]+|[\s\]】)）“”"'‘’《》<>，,。.!！?？:：;；]+$/gu, '')
    .replace(/^(?:这时|随后|忽然|只见|接着|于是|然后|此时|而后|片刻后|与此同时)+/u, '')
    .replace(/^(?:那名|那位|那个|这名|这位|这个|一名|一位|一名看起来|一位看起来)/u, '')
    .replace(/^.{1,10}(?:里的|中的|旁的|后的)/u, '')
    .replace(/^(?:你|我|他|她|它)(?:继续|又|再|随即|立刻|忽然|缓缓|轻轻|微微)+/u, '')
    .replace(/(?:微微|轻轻|稍稍|慢慢|再度|再次|继续|忽然|立刻|随即|缓缓)$/u, '')
    .replace(/(?:轻声|低声|高声|缓缓|忽然|立刻|随即|平静地|认真地|小声地|冷冷地)?(?:说道|说|问道|问|答道|回答|喊道|喊|叫道|叫|开口|回应|解释|提醒|补充|嘀咕|咕哝|笑道)$/u, '')
    .trim();
  if (label.endsWith('们')) label = '';
  return label;
}

function profileIdentitySurface(value) {
  const label = normalizedSubjectLabel(value);
  if (!label || label.length > 40 || PROFILE_SUBJECT_BLOCKLIST.has(label) || PROFILE_IDENTITY_GRAMMAR_BLOCKLIST.has(label)) return false;
  if (/^(?:你|我|他|她|它|我们|你们|他们|她们|它们)(?:的|又|再|正|正在|继续|轻|微|慢|缓|忽然|立刻|随即|回答|说|问|想|觉得|认为|决定|同意|拒绝|感到|看向|望向)/u.test(label)) return false;
  if (/^(?:有人|某人|一个人|那人|此人|对方|别人|其他人|大家|众人)$/u.test(label)) return false;
  if (label.endsWith('们') || label.endsWith('的')) return false;
  if (/^[A-Za-z][A-Za-z0-9_.-]{1,39}$/u.test(label) && PROFILE_MECHANISM_LABEL.test(label)) return false;
  return /[\p{L}\p{N}]/u.test(label);
}

function usableObservedSubject(label, source) {
  if (!profileIdentitySurface(label) || label.length > 24) return false;
  return source === 'stable-id' && /^(?:NPC|ACTOR)[-_ ]?\d+$/iu.test(label);
}

function profileNamesFromInput(profiles) {
  const values = Array.isArray(profiles) ? profiles : Object.values(profiles || {});
  return new Set(values
    .filter((profile) => profileCompletenessReport(profile).ok)
    .flatMap((profile) => normalizedNames(profile)));
}

/**
 * Conservatively discovers stable, directly participating subjects from the accepted narrative.
 * This is an identity/coverage gate only: it never infers profile facts from free text.
 */
export function discoverProfileSubjects(text, options = {}) {
  const narrative = profileNarrativeText(text).replace(/<[^>]+>/g, '\n');
  const excluded = new Set([
    ...profileNamesFromInput(options.existingProfiles),
    ...(options.excludedNames || []).map((value) => String(value || '').trim().toLocaleLowerCase()),
  ].filter(Boolean));
  const found = new Map();
  const record = (rawLabel, source, index) => {
    const label = normalizedSubjectLabel(rawLabel);
    const normalized = label.toLocaleLowerCase();
    if (!usableObservedSubject(label, source) || excluded.has(normalized)) return;
    const start = Math.max(0, Number(index) - 28);
    const evidence = narrative.slice(start, Math.min(narrative.length, Number(index) + String(rawLabel || '').length + 48)).replace(/\s+/g, ' ').trim();
    const current = found.get(normalized);
    if (current) {
      if (evidence && !current.evidence.includes(evidence)) current.evidence.push(evidence);
      if (!current.sources.includes(source)) current.sources.push(source);
      return;
    }
    found.set(normalized, { label, aliases: [label], evidence: evidence ? [evidence] : [], sources: [source], firstIndex: Number(index) || 0 });
  };

  const stableIds = /\b(?:NPC|ACTOR)[-_ ]?\d+\b(?=\s*(?:[：:]|说|问|答|喊|开口|回应|点头|摇头|抬手|伸手|转身|走进|推开|看向))/giu;
  for (const match of narrative.matchAll(stableIds)) record(match[0], 'stable-id', match.index || 0);

  // Free prose, including "label: value" lines, is not a deterministic NER
  // surface. The profile model owns whole-narrative discovery; the script only
  // supplies explicitly structural numeric IDs as a mechanical lower bound and
  // validates every returned name/alias against the sanitized narrative below.
  return [...found.values()].sort((left, right) => left.firstIndex - right.firstIndex);
}

/**
 * Parses the deliberately small, natural-language receipt produced by the
 * independent accepted-narrative person discovery pass.  This receipt is not
 * a profile store: it only proves which literal identities the existing
 * profile completion transaction must cover.
 */
export function parseProfileDiscoveryReceipt(raw, acceptedText, options = {}) {
  const text = String(raw || '');
  const narrative = profileNarrativeText(acceptedText);
  const blocks = [...text.matchAll(/<人物发现(?:\s[^>]*)?>([\s\S]*?)<\/人物发现\s*>/giu)];
  if (blocks.length !== 1) {
    return { ok: false, kind: 'invalid', subjects: [], error: '人物发现回执必须且只能包含一个<人物发现>块' };
  }
  const body = String(blocks[0][1] || '').trim();
  if (/^NONE$/iu.test(body)) return { ok: true, kind: 'none', subjects: [], error: '' };
  if (!body) return { ok: false, kind: 'invalid', subjects: [], error: '人物发现回执为空；无人物时必须明确返回NONE' };

  const records = [];
  let pending = null;
  const unwrap = (value) => {
    const cleaned = String(value || '').trim();
    const pairs = [['“', '”'], ['「', '」'], ['『', '』'], ['"', '"'], ["'", "'"], ['`', '`']];
    const pair = pairs.find(([left, right]) => cleaned.startsWith(left) && cleaned.endsWith(right) && cleaned.length > left.length + right.length);
    return pair ? cleaned.slice(pair[0].length, -pair[1].length).trim() : cleaned;
  };
  for (const rawLine of body.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const person = line.match(/^(?:(?:[-*]|\d+[.、])\s*)?人物[：:]\s*(.+)$/u);
    if (person) {
      if (pending) return { ok: false, kind: 'invalid', subjects: [], error: `人物“${pending.label}”缺少逐字锚点` };
      pending = { label: unwrap(person[1]), anchor: '' };
      continue;
    }
    const anchor = line.match(/^(?:(?:[-*]|\d+[.、])\s*)?锚点[：:]\s*(.+)$/u);
    if (anchor) {
      if (!pending) return { ok: false, kind: 'invalid', subjects: [], error: '人物发现回执先出现了锚点，缺少对应人物' };
      pending.anchor = unwrap(anchor[1]);
      records.push(pending);
      pending = null;
      continue;
    }
    return { ok: false, kind: 'invalid', subjects: [], error: `人物发现回执含无法识别的行：${line.slice(0, 80)}` };
  }
  if (pending) return { ok: false, kind: 'invalid', subjects: [], error: `人物“${pending.label}”缺少逐字锚点` };
  if (!records.length) return { ok: false, kind: 'invalid', subjects: [], error: '人物发现回执没有人物记录；无人物时必须明确返回NONE' };

  const excluded = new Set([
    ...profileNamesFromInput(options.existingProfiles),
    ...(options.excludedNames || []).map((value) => String(value || '').trim().toLocaleLowerCase()),
  ].filter(Boolean));
  const found = new Map();
  for (const record of records) {
    const label = record.label;
    const anchor = record.anchor;
    if (!label || label.length > 40 || !profileIdentitySurface(label)) {
      return { ok: false, kind: 'invalid', subjects: [], error: `人物发现返回了不可用身份：${label || '空值'}` };
    }
    if (!narrative.includes(label)) {
      return { ok: false, kind: 'invalid', subjects: [], error: `人物“${label}”不是最终正文逐字出现的姓名或唯一称谓` };
    }
    if (!anchor || anchor.length > 280 || !narrative.includes(anchor)) {
      return { ok: false, kind: 'invalid', subjects: [], error: `人物“${label}”的锚点不是最终正文连续逐字原文` };
    }
    if (!anchor.includes(label)) {
      return { ok: false, kind: 'invalid', subjects: [], error: `人物“${label}”的逐字锚点没有包含该身份，无法证明锚点归属` };
    }
    const normalized = label.toLocaleLowerCase();
    if (excluded.has(normalized)) continue;
    const existing = found.get(normalized);
    if (existing) {
      if (!existing.evidence.includes(anchor)) existing.evidence.push(anchor);
      continue;
    }
    found.set(normalized, {
      label,
      names: [label],
      aliases: [label],
      evidence: [anchor],
      sourceAnchor: anchor,
      sources: ['accepted-final-person-discovery'],
      firstIndex: narrative.indexOf(anchor),
    });
  }
  return {
    ok: true,
    kind: 'subjects',
    subjects: [...found.values()].sort((left, right) => left.firstIndex - right.firstIndex),
    error: '',
  };
}

export function validateProfileSubjectCoverage(profiles, requiredSubjects = []) {
  const coveredNames = new Set((Array.isArray(profiles) ? profiles : []).flatMap((profile) => normalizedNames(profile)));
  const missing = (requiredSubjects || []).filter((subject) => {
    const anchors = [subject?.label, ...(Array.isArray(subject?.aliases) ? subject.aliases : [])]
      .map((value) => String(value || '').trim().toLocaleLowerCase()).filter(Boolean);
    return !anchors.some((anchor) => coveredNames.has(anchor));
  });
  return {
    ok: missing.length === 0,
    missing,
    errors: missing.map((subject) => `最终正文中的稳定出场人物“${subject.label}”没有被任何档案name或aliases覆盖`),
  };
}

export function normalizeProfileCandidates(rawProfiles, acceptedText = '', requiredSubjects = null) {
  if (!Array.isArray(rawProfiles)) return [];
  const source = profileNarrativeText(acceptedText);
  const normalizedSource = source.toLocaleLowerCase();
  return rawProfiles.map((input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
    let profile = deepClone(input);
    profile.aliases = asList(profile.aliases).map((value) => String(value).trim()).filter(Boolean);
    for (const path of REQUIRED_ARRAYS) {
      const value = at(profile, path);
      if (value !== undefined && !Array.isArray(value)) profile[path] = asList(value);
    }
    if (!Array.isArray(profile.evidence) || profile.evidence.length < 1) {
      const label = [profile.name, ...profile.aliases]
        .map((value) => String(value || '').trim())
        .find((value) => value && profileIdentitySurface(value) && normalizedSource.includes(value.toLocaleLowerCase()));
      if (label) profile.evidence = [`最终已接受正文明确出现“${label}”；该人物的可观察出场与互动是本档案的直接依据。`];
    }
    return profile;
  });
}

const PROFILE_APPEND_ONLY_ARRAYS = new Set(['aliases', 'evidence', 'narrativeKnownNames']);

function mergeCandidateValue(previous, incoming, path = '') {
  if (Array.isArray(incoming)) {
    const combined = PROFILE_APPEND_ONLY_ARRAYS.has(path)
      ? [...(Array.isArray(previous) ? previous : []), ...incoming].filter(usableScalar)
      : incoming.filter(usableScalar);
    const seen = new Set();
    return combined.filter((value) => {
      const signature = JSON.stringify(value);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    }).map(deepClone);
  }
  if (incoming && typeof incoming === 'object') {
    const base = previous && typeof previous === 'object' && !Array.isArray(previous) ? deepClone(previous) : {};
    for (const [key, value] of Object.entries(incoming)) base[key] = mergeCandidateValue(base[key], value, path ? `${path}.${key}` : key);
    return base;
  }
  return usableScalar(incoming) ? incoming : deepClone(previous);
}

function sameCandidate(left, right) {
  const leftProfileId = cleanText(left?.profileId);
  const rightProfileId = cleanText(right?.profileId);
  if (leftProfileId && rightProfileId && leftProfileId === rightProfileId) return true;
  const leftPrimary = cleanText(left?.name).toLocaleLowerCase();
  const rightPrimary = cleanText(right?.name).toLocaleLowerCase();
  return Boolean(leftPrimary && rightPrimary && leftPrimary === rightPrimary);
}

function validTicketIdSet(validTickets) {
  return new Set((Array.isArray(validTickets) ? validTickets : [])
    .map((ticket) => cleanText(typeof ticket === 'string' ? ticket : ticket?.ticketId))
    .filter(Boolean));
}

export function createFrozenProfileMatcher(frozenProfiles = [], knownProfiles = [], validTickets = []) {
  const frozen = Array.isArray(frozenProfiles) ? frozenProfiles.filter((profile) => profile && typeof profile === 'object') : [];
  const known = Array.isArray(knownProfiles)
    ? knownProfiles.filter((profile) => profile && typeof profile === 'object')
    : Object.entries(knownProfiles && typeof knownProfiles === 'object' ? knownProfiles : {})
      .map(([profileId, profile]) => profile && typeof profile === 'object' ? { ...profile, profileId: profile.profileId || profileId } : null)
      .filter(Boolean);
  const validTicketIds = validTicketIdSet(validTickets);
  const ownerKey = (profile, fallback) => {
    const profileId = cleanText(profile?.profileId);
    if (profileId) return `profile:${profileId}`;
    const ticketId = cleanText(profile?.ticketId);
    if (ticketId && validTicketIds.has(ticketId)) return `ticket:${ticketId}`;
    return fallback;
  };
  const frozenOwnerKeys = new Set();
  const frozenProfileIds = new Set();
  const ticketOwners = new Map();
  const nameOwners = new Map();
  const addNameOwner = (name, owner) => {
    const normalized = cleanText(name).toLocaleLowerCase();
    if (!normalized) return;
    if (!nameOwners.has(normalized)) nameOwners.set(normalized, new Set());
    nameOwners.get(normalized).add(owner);
  };
  const allProfiles = [
    ...known.map((profile, index) => ({ profile, owner: ownerKey(profile, `known:${index}`) })),
    ...frozen.map((profile, index) => ({ profile, owner: ownerKey(profile, `frozen:${index}`), frozen: true })),
  ];
  for (const { profile, owner, frozen: isFrozen } of allProfiles) {
    for (const name of normalizedNames(profile)) addNameOwner(name, owner);
    const ticketId = cleanText(profile.ticketId);
    if (ticketId && validTicketIds.has(ticketId)) {
      if (!ticketOwners.has(ticketId)) ticketOwners.set(ticketId, new Set());
      ticketOwners.get(ticketId).add(owner);
    }
    if (!isFrozen) continue;
    frozenOwnerKeys.add(owner);
    const profileId = cleanText(profile.profileId);
    if (profileId) frozenProfileIds.add(profileId);
  }
  return (profile) => {
    const profileId = cleanText(profile?.profileId);
    if (profileId && frozenProfileIds.has(profileId)) return true;
    const ticketId = cleanText(profile?.ticketId);
    const ownersForTicket = ticketId && validTicketIds.has(ticketId) ? ticketOwners.get(ticketId) : null;
    if (ownersForTicket?.size === 1 && frozenOwnerKeys.has([...ownersForTicket][0])) return true;
    const primaryName = cleanText(profile?.name).toLocaleLowerCase();
    if (primaryName) {
      const owners = nameOwners.get(primaryName);
      return Boolean(owners?.size === 1 && frozenOwnerKeys.has([...owners][0]));
    }
    return false;
  };
}

const GENERIC_AUTHORITY_SUBJECT = /^(?:人物|角色|npc|主角|配角|路人|陌生人|男人|女人|男子|女子|少女|少年|老人|孩子|队长|领队|老板|店主|医生|护士|老师|同学|朋友|敌人|守卫|士兵|侍卫|服务员|工作人员|管理员|导师|首领|会长|部长|局长|校长|经理|主管|前台|后勤|司机|乘客|顾客|客人)$/iu;

export function authorityProtectedProfileNamesFromEntries(candidateProfiles = [], canonicalCardNames = [], entries = []) {
  const candidates = (Array.isArray(candidateProfiles) ? candidateProfiles : [])
    .filter((profile) => profile && typeof profile === 'object');
  const canonicalNames = new Set((Array.isArray(canonicalCardNames) ? canonicalCardNames : [canonicalCardNames])
    .map((name) => cleanText(name).toLocaleLowerCase()).filter(Boolean));
  const enabledEntries = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === 'object' && entry.enabled !== false && !entry.disable);
  const tokenOwners = new Map();
  const idOwners = new Map();
  const entrySubjects = new Map();
  const addOwner = (map, value, owner) => {
    const normalized = cleanText(value).toLocaleLowerCase();
    if (!normalized) return;
    if (!map.has(normalized)) map.set(normalized, new Set());
    map.get(normalized).add(owner);
  };
  enabledEntries.forEach((entry, index) => {
    const owner = `entry:${index}`;
    for (const value of [entry.uid, entry.id, entry.entryId, entry.worldbookEntryId]) addOwner(idOwners, value, owner);
    const labels = [entry.comment, entry.name];
    const keys = [entry.keys, entry.key, entry.keysecondary]
      .flatMap((value) => Array.isArray(value) ? value : String(value || '').split(','));
    const subjects = [...labels, ...keys, entry.subject, entry.subjectName, entry.characterName]
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => cleanText(value).toLocaleLowerCase()).filter(Boolean);
    entrySubjects.set(owner, new Set(subjects));
    for (const value of subjects) addOwner(tokenOwners, value, owner);
  });
  const protectedNames = [];
  for (const profile of candidates) {
    const primary = cleanText(profile.name);
    const normalizedPrimary = primary.toLocaleLowerCase();
    if (!primary) continue;
    if (canonicalNames.has(normalizedPrimary)) {
      protectedNames.push(primary);
      continue;
    }
    const structuredIds = [
      profile.authorityEntryId,
      profile.worldbookEntryId,
      profile.sourceEntryId,
      profile.authoritySource?.entryId,
      profile.sourceRef?.entryId,
    ].map((value) => cleanText(value).toLocaleLowerCase()).filter(Boolean);
    const explicitPrimary = profileIdentitySurface(primary) && !GENERIC_AUTHORITY_SUBJECT.test(primary);
    const exactStructuredOwner = explicitPrimary && structuredIds.some((id) => {
      const owners = idOwners.get(id);
      if (owners?.size !== 1) return false;
      return entrySubjects.get([...owners][0])?.has(normalizedPrimary);
    });
    const exactUniqueToken = explicitPrimary && tokenOwners.get(normalizedPrimary)?.size === 1;
    if (exactStructuredOwner || exactUniqueToken) protectedNames.push(primary);
  }
  return [...new Set(protectedNames)];
}

function actorNarrativeSurface(profile, narrative) {
  const names = normalizedNames(profile);
  if (!names.length) return '';
  return String(narrative || '').split(/(?<=[。！？!?\n])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      const normalized = sentence.toLocaleLowerCase();
      return names.some((name) => normalized.includes(name));
    })
    .join('\n');
}

function profileValueSupportedByNarrative(value, profile, narrative, exact = false) {
  const text = cleanText(typeof value === 'string' ? value : value?.content || value?.fact || value?.text);
  if (!text) return false;
  const surface = actorNarrativeSurface(profile, narrative);
  if (!surface) return false;
  return surface.includes(text) || (!exact && sharedCjkBigrams(text, surface) >= 2);
}

function appendOwnedProfileItems(previous, incoming, profile, narrative, allowInference = false, limit = 48) {
  const combined = asList(previous).map(deepClone);
  const seen = new Set(combined.map((value) => JSON.stringify(value)));
  for (const value of asList(incoming)) {
    const signature = JSON.stringify(value);
    if (seen.has(signature)) continue;
    if (!allowInference && combined.length && !profileValueSupportedByNarrative(value, profile, narrative)) continue;
    combined.push(deepClone(value));
    seen.add(signature);
  }
  return combined.slice(0, Math.max(1, Number(limit || 48)));
}

const PROFILE_DYNAMIC_TRANSITION_MARKERS = {
  relationships: /(?:决裂|反目|敌对|结盟|和解|分手|断绝|解除|终止|背叛|由.{0,12}(?:变为|转为)|不再是|成为(?:盟友|敌人|同伴|上下级|恋人|朋友))/u,
  capabilities: /(?:失去|丧失|无法|不能再|不再能|恢复|学会|掌握|获得.{0,8}(?:能力|技巧|技能)|废除|被封印|被禁用|受伤.{0,8}(?:无法|不能))/u,
  resources: /(?:用掉|用尽|耗尽|花完|喝完|吃完|交给|移交|归还|丢失|遗失|损毁|破坏|被夺|被偷|不再持有|只剩|获得|得到|买到|拾取|补充|增加|减少|消耗)/u,
};

function mergeOwnedDynamicItems(previous, incoming, profile, narrative, field, limit = 48) {
  const oldItems = asList(previous).map(deepClone);
  const explicitlyEmpty = Array.isArray(incoming) && incoming.length === 0;
  const surface = actorNarrativeSurface(profile, narrative);
  const transition = PROFILE_DYNAMIC_TRANSITION_MARKERS[field];
  const canRetire = Boolean(surface && transition?.test(surface));
  const mentionedDuringTransition = (value) => {
    const text = cleanText(typeof value === 'string' ? value : value?.content || value?.fact || value?.text);
    return Boolean(text && surface && sharedCjkBigrams(text, surface) >= 1);
  };
  const newItems = asList(incoming).filter((value) => profileValueSupportedByNarrative(value, profile, narrative)
    || (canRetire && mentionedDuringTransition(value)));
  if (oldItems.length && canRetire && explicitlyEmpty) {
    const emptyState = field === 'relationships'
      ? '当前没有仍然成立的持续关系（最终正文明确原关系已经终止）'
      : field === 'capabilities'
        ? '当前没有可用的相关能力（最终正文明确原能力已经失去或停用）'
        : '当前没有可调用的相关资源（最终正文明确原资源已经耗尽、移交或失去）';
    return [emptyState];
  }
  if (!oldItems.length) return (newItems.length ? newItems : asList(incoming)).map(deepClone).slice(0, limit);
  if (!newItems.length) return oldItems.slice(0, limit);
  const retained = canRetire
    ? oldItems.filter((value) => !mentionedDuringTransition(value))
    : oldItems;
  return appendOwnedProfileItems(retained, newItems, profile, narrative, false, limit);
}

function mergeExistingProfileOwned(previous, incoming, narrative) {
  const merged = deepClone(previous);
  merged.aliases = appendOwnedProfileItems(previous.aliases, incoming.aliases, previous, narrative, true, 24);
  merged.narrativeKnownNames = appendOwnedProfileItems(previous.narrativeKnownNames, incoming.narrativeKnownNames, previous, narrative, true, 24);
  for (const root of ['identity', 'appearance', 'personality']) {
    merged[root] = merged[root] && typeof merged[root] === 'object' ? merged[root] : {};
    for (const [key, value] of Object.entries(incoming?.[root] || {})) {
      if (!usableScalar(merged[root][key])) merged[root][key] = deepClone(value);
    }
  }
  if (!usableScalar(merged.history) && usableScalar(incoming.history)) merged.history = deepClone(incoming.history);
  merged.currentState = merged.currentState && typeof merged.currentState === 'object' ? merged.currentState : {};
  for (const [key, value] of Object.entries(incoming?.currentState || {})) {
    if (!usableScalar(merged.currentState[key]) || profileValueSupportedByNarrative(value, previous, narrative)) {
      merged.currentState[key] = deepClone(value);
    }
  }
  merged.relationships = mergeOwnedDynamicItems(previous.relationships, incoming.relationships, previous, narrative, 'relationships', 48);
  merged.capabilities = mergeOwnedDynamicItems(previous.capabilities, incoming.capabilities, previous, narrative, 'capabilities', 48);
  merged.resources = mergeOwnedDynamicItems(previous.resources, incoming.resources, previous, narrative, 'resources', 48);
  merged.knowledge = appendOwnedProfileItems(previous.knowledge, incoming.knowledge, previous, narrative, true, 48);
  merged.evidence = appendOwnedProfileItems(previous.evidence, incoming.evidence, previous, narrative, false, 64);
  merged.inferences = appendOwnedProfileItems(previous.inferences, incoming.inferences, previous, narrative, true, 48);
  merged.profileId = previous.profileId;
  if (usableScalar(previous.ticketId)) merged.ticketId = previous.ticketId;
  else delete merged.ticketId;
  merged.name = previous.name;
  return merged;
}

export function mergeProfileCandidates(previousProfiles, incomingProfiles) {
  const merged = Array.isArray(previousProfiles) ? deepClone(previousProfiles) : [];
  for (const incoming of Array.isArray(incomingProfiles) ? incomingProfiles : []) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      merged.push(incoming);
      continue;
    }
    const index = merged.findIndex((previous) => sameCandidate(previous, incoming));
    if (index < 0) merged.push(deepClone(incoming));
    else {
      const previous = merged[index];
      merged[index] = mergeCandidateValue(previous, incoming);
      for (const key of ['profileId', 'ticketId']) {
        if (usableScalar(previous?.[key])) merged[index][key] = previous[key];
      }
    }
  }
  return merged;
}

const SYSTEM_KNOWLEDGE_SOURCE = /(?:经|通过|由)?(?:系统|程序|资料库|数据库)(?:授权|权限|读取|检索|提供|同步|告知|记录)|(?:系统|程序)(?:权限|接口)|权限(?:读取|检索|获知|掌握)/u;
const SYSTEM_ACTOR_IDENTITY = /(?:系统(?:单元|终端|代理|程序|助手|引导)|程序(?:实体|代理|单元)|人工智能|\bAI\b|构装(?:体|单元)|资料库终端|数据库终端|后台代理)/iu;
const SYSTEM_ACCESS_CAPABILITY = /(?:(?:系统|程序|资料库|数据库).{0,16}(?:授权|权限|读取|检索|接口)|(?:授权|权限).{0,12}(?:系统|程序|资料库|数据库).{0,12}(?:读取|检索|接口))/u;
const REACHABLE_KNOWLEDGE_SOURCE = /(?:亲历|亲眼|目睹|观察|听见|听到|告诉|当面(?:告知|说明|交谈|告诉)|获(?:得)?告知|被告知|调查|查证|侦察|查阅|阅读|公开资料|公告|广播|传闻|报告|书信|记录|证据|职业训练|训练所学|学习所得|自身记忆|根据[^：:]{0,24}(?:推断|判断)|来源[：:]|(?:经|通过|由)?(?:系统|程序|资料库|数据库)(?:授权|权限|读取|检索|提供|同步|告知|记录)|权限(?:读取|检索|获知|掌握))/u;

function sharedCjkBigrams(left, right) {
  const grams = (value) => {
    const chars = String(value || '').replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, '');
    const output = new Set();
    for (let index = 0; index + 1 < chars.length; index += 1) output.add(chars.slice(index, index + 2));
    return output;
  };
  const leftGrams = grams(left);
  const rightGrams = grams(right);
  let count = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) count += 1;
  return count;
}

function actorReachableNarrative(profile, narrative) {
  const names = normalizedNames(profile);
  if (!names.length) return '';
  const sourceAction = /(?:亲眼|目睹|看见|观察|听见|听到|告诉|告知|说明|交谈|收到|获知|被告知|调查|查证|侦察|查阅|阅读|学习|回忆|记得|发现)/u;
  return String(narrative || '').split(/(?<=[。！？!?\n])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      const normalized = sentence.toLocaleLowerCase();
      if (!sourceAction.test(sentence)) return false;
      return names.some((name) => {
        const at = normalized.indexOf(name);
        if (at < 0) return false;
        const window = sentence.slice(Math.max(0, at - 28), at + name.length + 28);
        return sourceAction.test(window);
      });
    })
    .join('\n');
}

function profileSupportsSystemKnowledge(profile, narrative = '') {
  const identitySurface = [
    profile?.name,
    profile?.identity?.species,
    profile?.identity?.occupation,
    profile?.identity?.affiliation,
    profile?.identity?.socialPosition,
    profile?.history,
  ].map(cleanText).filter(Boolean).join('\n');
  const accessSurface = [
    ...(asList(profile?.capabilities)),
    ...(asList(profile?.resources)),
    ...(asList(profile?.evidence)),
    String(narrative || '').split(/(?<=[。！？!?\n])/u)
      .filter((sentence) => normalizedNames(profile).some((name) => sentence.toLocaleLowerCase().includes(name)))
      .slice(0, 12),
  ].map(cleanText).filter(Boolean).join('\n');
  return SYSTEM_ACTOR_IDENTITY.test(identitySurface) && SYSTEM_ACCESS_CAPABILITY.test(`${identitySurface}\n${accessSurface}`);
}

function knowledgeEntryHasReachableSource(value, profile = {}, narrative = '') {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!REACHABLE_KNOWLEDGE_SOURCE.test(text)) return false;
    if (SYSTEM_KNOWLEDGE_SOURCE.test(text)) return profileSupportsSystemKnowledge(profile, narrative);
    if (/(?:职业训练|训练所学|学习所得|自身记忆)/u.test(text)) {
      return Boolean(cleanText(profile?.identity?.occupation) || cleanText(profile?.history));
    }
    if (!String(narrative || '').trim()) return false;
    const reachableNarrative = actorReachableNarrative(profile, narrative);
    const quoted = text.match(/[“"]([^”"]{3,120})[”"]/u)?.[1];
    if (quoted && reachableNarrative.includes(quoted)) return true;
    if (!reachableNarrative || !REACHABLE_KNOWLEDGE_SOURCE.test(reachableNarrative)) return false;
    const fact = text.split(/[：:]/u).slice(1).join('：') || text;
    return sharedCjkBigrams(fact, reachableNarrative) >= 2;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = cleanText(value.source || value.origin || value.learnedFrom || value.evidence);
  const content = cleanText(value.content || value.fact || value.knowledge || value.text);
  if (!source || !content || !REACHABLE_KNOWLEDGE_SOURCE.test(`来源：${source}`)) return false;
  if (SYSTEM_KNOWLEDGE_SOURCE.test(source)) return profileSupportsSystemKnowledge(profile, narrative);
  if (!String(narrative || '').trim()) return true;
  return knowledgeEntryHasReachableSource(`${source}：${content}`, profile, narrative);
}

export function prepareProfileBatch(rawProfiles, tickets, currentData, acceptedText = '', requiredSubjects = null, options = {}) {
  const normalizedProfiles = normalizeProfileCandidates(rawProfiles, acceptedText, requiredSubjects);
  if (normalizedProfiles.length < 1) {
    return { ok: false, partial: false, errors: ['人物档案批次为空'], profiles: [], rejected: [], normalizationRepairs: [] };
  }
  const existing = existingProfilesFromData(currentData);
  const ticketMap = new Map((tickets || []).map((ticket) => [String(ticket.ticketId), ticket]));
  const authorityProtectedNames = new Set(cleanStringArray(options.authorityProtectedNames, 240).map((name) => name.toLocaleLowerCase()));
  const excludedNames = new Set(cleanStringArray(options.excludedNames, 240).map((name) => name.toLocaleLowerCase()));
  const authorityProtected = (profile) => authorityProtectedNames.has(cleanText(profile?.name).toLocaleLowerCase());
  const ticketClaimCounts = new Map();
  for (const profile of normalizedProfiles.filter((candidate) => !authorityProtected(candidate))) {
    const ticketId = String(profile?.ticketId || '');
    if (ticketMap.has(ticketId)) ticketClaimCounts.set(ticketId, (ticketClaimCounts.get(ticketId) || 0) + 1);
  }
  const uniquelyClaimedTickets = new Set([...ticketClaimCounts]
    .filter(([, count]) => count === 1).map(([ticketId]) => ticketId));
  const availableTickets = [...ticketMap.values()].sort((left, right) => Number(left.ordinal || 0) - Number(right.ordinal || 0));
  const usedTickets = new Set(Object.entries(existing).flatMap(([profileId, profile]) => [profileId, String(profile?.ticketId || '')])
    .filter((ticketId) => ticketMap.has(ticketId)));
  const usedIds = new Set();
  const nameIndex = new Map();
  for (const [id, profile] of Object.entries(existing)) {
    for (const name of normalizedNames(profile)) {
      if (!nameIndex.has(name)) nameIndex.set(name, new Set());
      nameIndex.get(name).add(id);
    }
  }
  const prepared = [];
  const rejected = [];
  const errors = [];
  const normalizationRepairs = [];
  const narrative = profileNarrativeText(acceptedText).toLocaleLowerCase();
  const enforceNarrativeIdentity = Boolean(narrative.trim());
  const orderedProfiles = normalizedProfiles.map((profile, originalIndex) => {
    const positions = normalizedNames(profile)
      .filter((name) => profileIdentitySurface(name))
      .map((name) => narrative.indexOf(name)).filter((position) => position >= 0);
    return { profile, originalIndex, position: positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER };
  }).sort((left, right) => left.position - right.position || left.originalIndex - right.originalIndex);

  for (const { profile: input, originalIndex: index } of orderedProfiles) {
    const localErrors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      localErrors.push(`第${index + 1}张档案不是对象`);
      rejected.push({ index, name: '', errors: localErrors, candidate: deepClone(input) });
      errors.push(...localErrors);
      continue;
    }
    let profile = deepClone(input);
    const excludedIdentity = normalizedNames(profile).find((name) => excludedNames.has(name));
    if (excludedIdentity) {
      localErrors.push(`第${index + 1}张候选命中玩家或当前角色卡扮演主体“${excludedIdentity}”，人物医生不得为其建档或建立自主世界主体`);
      rejected.push({ index, name: cleanText(profile.name), errors: localErrors, candidate: profile });
      errors.push(...localErrors);
      continue;
    }
    const rawAliases = asList(profile.aliases).map((value) => String(value).trim()).filter(Boolean);
    const retainedAliases = rawAliases.filter((alias) => {
      const normalized = alias.toLocaleLowerCase();
      return nameIndex.has(normalized) || (profileIdentitySurface(alias) && narrative.includes(normalized));
    });
    const rejectedAliases = rawAliases.filter((alias) => !retainedAliases.includes(alias));
    if (rejectedAliases.length) normalizationRepairs.push({ profileIndex: index, code: 'unsupported_aliases_removed', count: rejectedAliases.length });
    profile.aliases = retainedAliases;
    const requestedId = String(profile.profileId || '').trim();
    const candidateNames = normalizedNames(profile);
    const primaryName = cleanText(profile.name).toLocaleLowerCase();
    const primaryMatches = nameIndex.get(primaryName) || new Set();
    const allMatches = new Set(candidateNames.flatMap((name) => [...(nameIndex.get(name) || [])]));
    let matchedId = primaryMatches.size === 1 ? [...primaryMatches][0] : allMatches.size === 1 ? [...allMatches][0] : '';
    if (!matchedId && allMatches.size > 1) {
      localErrors.push(`第${index + 1}张档案的姓名或称谓同时命中多个既有人物（${[...allMatches].join('、')}）；共享称谓不能用于静默串档，请返回唯一姓名或一致的profileId与唯一姓名锚点`);
    }
    if (requestedId && existing[requestedId]) {
      const requestedPrimary = cleanText(existing[requestedId]?.name).toLocaleLowerCase();
      const uniquelySupportsRequested = primaryName === requestedPrimary
        || candidateNames.some((name) => (nameIndex.get(name)?.size === 1) && nameIndex.get(name).has(requestedId));
      if (!uniquelySupportsRequested) {
        localErrors.push(`第${index + 1}张档案请求profileId ${requestedId}，但只提供了共享或不一致称谓，无法证明属于该既有人物`);
      } else matchedId = requestedId;
    }
    let profileId = String(matchedId || '').trim();
    const isExisting = Boolean(profileId && existing[profileId]);
    if (requestedId && existing[requestedId] && matchedId && matchedId !== requestedId) {
      localErrors.push(`第${index + 1}张档案试图以profileId ${requestedId} 覆盖另一个既有人物身份`);
    }
    const submittedKnowledge = Object.prototype.hasOwnProperty.call(input, 'knowledge')
      ? asList(input.knowledge).filter(meaningfulProfileListItem)
      : [];
    const persistedKnowledgeSignatures = new Set((isExisting ? asList(existing[profileId]?.knowledge) : [])
      .map((entry) => JSON.stringify(entry)));
    const persistedNarrativeKnownNames = isExisting ? cleanStringArray(existing[profileId]?.narrativeKnownNames, 24) : [];
    if (isExisting) profile = mergeExistingProfileOwned(existing[profileId], profile, profileNarrativeText(acceptedText));
    const namesSeenInNarrative = [profile?.name, ...(Array.isArray(profile?.aliases) ? profile.aliases : [])]
      .map((item) => cleanText(item))
      .filter((item) => item && profileIdentitySurface(item) && narrative.includes(item.toLocaleLowerCase()));
    profile.narrativeKnownNames = cleanStringArray([...persistedNarrativeKnownNames, ...namesSeenInNarrative], 24);
    const submittedTicketId = String(profile.ticketId || '');
    let ticket = ticketMap.get(submittedTicketId);
    if (!isExisting) {
      if (enforceNarrativeIdentity && !namesSeenInNarrative.length) localErrors.push(`第${index + 1}张新档案没有最终正文逐字出现的稳定name或alias身份锚点`);
      const authorityName = cleanText(profile.name).toLocaleLowerCase();
      const hasAuthorityIdentity = authorityProtectedNames.has(authorityName);
        if (hasAuthorityIdentity) {
          profileId = stableWorldId('profile-authority', authorityName);
          profile.authoritySource = 'character-card-or-worldbook';
          delete profile.ticketId;
          ticket = null;
        } else {
        const submittedClaimIsUnique = Boolean(ticket && ticketClaimCounts.get(submittedTicketId) === 1);
        if (!submittedClaimIsUnique || usedTickets.has(submittedTicketId)) {
          const previousTicketId = submittedTicketId;
          ticket = availableTickets.find((candidate) => !usedTickets.has(candidate.ticketId)
            && !uniquelyClaimedTickets.has(candidate.ticketId));
          if (ticket && previousTicketId && previousTicketId !== ticket.ticketId) {
            normalizationRepairs.push({
              profileIndex: index,
              code: 'uncommitted_ticket_reassigned',
              from: previousTicketId,
              to: ticket.ticketId,
            });
          }
        }
        if (!ticket) {
          if (ticketClaimCounts.get(submittedTicketId) > 1) {
            localErrors.push(`第${index + 1}张原创人物重复使用票据 ${submittedTicketId}，且已经没有未占用票据可供重分`);
          } else localErrors.push(`第${index + 1}张原创人物档案没有匹配本轮characterCreationTicket`);
        }
      }
      if (ticket && !hasAuthorityIdentity) {
        profileId = ticket.ticketId;
        profile.ticketId = ticket.ticketId;
        profile.personality = mergeCandidateValue(profile.personality || {}, ticket.axes, 'personality');
        if (usedTickets.has(ticket.ticketId)) localErrors.push(`同一票据被多名新人物重复使用：${ticket.ticketId}`);
      }
    }
    profile.profileId = profileId;
    if (isExisting && usableScalar(existing[profileId]?.ticketId)) profile.ticketId = existing[profileId].ticketId;
    if (!isExisting && profileId && existing[profileId]) localErrors.push(`第${index + 1}张新档案生成的profileId已属于既有人物，拒绝覆盖：${profileId}`);
    const knowledgeToValidate = isExisting
      ? submittedKnowledge.filter((entry) => !persistedKnowledgeSignatures.has(JSON.stringify(entry)))
      : asList(profile.knowledge).filter(meaningfulProfileListItem);
    const unreachableKnowledge = knowledgeToValidate.filter((entry) => !knowledgeEntryHasReachableSource(entry, profile, profileNarrativeText(acceptedText)));
    if (unreachableKnowledge.length) {
      localErrors.push(`第${index + 1}张档案新增knowledge缺少人物可达来源（亲历、获告知、调查、查阅、公开资料、职业训练，或有身份/能力依据的系统授权读取）：${unreachableKnowledge.map((entry) => cleanText(typeof entry === 'string' ? entry : entry?.content || entry?.fact || '未说明内容')).slice(0, 3).join('；')}`);
    }
    if (profileId && usedIds.has(profileId)) localErrors.push(`档案批次内profileId重复：${profileId}`);
    localErrors.push(...profileCompletenessReport(profile, `第${index + 1}张档案`).errors);
    if (localErrors.length) {
      rejected.push({ index, name: cleanText(profile.name), errors: localErrors, candidate: profile });
      errors.push(...localErrors);
      continue;
    }
    prepared.push(profile);
    usedIds.add(profileId);
    if (!isExisting && ticket && profile.ticketId) usedTickets.add(ticket.ticketId);
  }
  return {
    ok: errors.length === 0 && prepared.length > 0,
    partial: prepared.length > 0 && errors.length > 0,
    errors,
    profiles: prepared,
    rejected,
    normalizationRepairs,
  };
}

export function buildProfilePatch(currentData, profiles) {
  const stat = statDataOf(currentData);
  const existingRoot = stat?.人物档案 && typeof stat.人物档案 === 'object' ? deepClone(stat.人物档案) : {};
  const byActorId = existingRoot.byActorId && typeof existingRoot.byActorId === 'object' ? existingRoot.byActorId : {};
  for (const profile of profiles) byActorId[profile.profileId] = deepClone(profile);
  const nextRoot = { schemaVersion: 1, ...existingRoot, byActorId };
  const operation = { op: stat?.人物档案 ? 'replace' : 'insert', path: PROFILE_ROOT, value: nextRoot };
  return {
    operations: [operation],
    block: `<UpdateVariable><Analysis>人物档案批次已经完整校验；以单个根对象原子提交，不修改数据库表格。</Analysis><JSONPatch>${JSON.stringify([operation])}</JSONPatch></UpdateVariable>`,
    expected: nextRoot,
  };
}

export function mergeProfileRootDirect(currentData, profiles) {
  const next = deepClone(currentData || {});
  const stat = next.stat_data && typeof next.stat_data === 'object' ? next.stat_data : next;
  const current = stat.人物档案 && typeof stat.人物档案 === 'object' ? stat.人物档案 : {};
  const byActorId = current.byActorId && typeof current.byActorId === 'object' ? deepClone(current.byActorId) : {};
  for (const profile of profiles || []) byActorId[profile.profileId] = deepClone(profile);
  stat.人物档案 = { schemaVersion: 1, ...current, byActorId };
  return next;
}

export function verifyCommittedProfiles(data, profiles) {
  const committed = existingProfilesFromData(data);
  for (const profile of profiles) {
    if (!semanticJsonEqual(committed[profile.profileId], profile)) return false;
  }
  return true;
}

function extractJsonObject(raw) {
  const cleaned = repairJsonText(raw);
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('没有找到JSON对象');
  return parseJsonWithLocalRepair(cleaned.slice(first, last + 1));
}

export function openAiChatEndpoint(rawEndpoint) {
  const raw = String(rawEndpoint || '').trim();
  if (!raw) throw new Error('请填写API地址');
  const url = new URL(raw);
  const path = url.pathname.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(path)) url.pathname = path;
  else if (/\/v\d+$/i.test(path)) url.pathname = `${path}/chat/completions`;
  else url.pathname = `${path}/v1/chat/completions`;
  return url.toString();
}

export function openAiModelsEndpoint(rawEndpoint) {
  const url = new URL(openAiChatEndpoint(rawEndpoint));
  url.pathname = url.pathname.replace(/\/chat\/completions$/i, '/models');
  return url.toString();
}

export function chatCompletionText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const joined = content.map((part) => part?.text || part?.content || '').join('').trim();
    if (joined) return joined;
  }
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  throw new Error('API响应缺少choices[0].message.content');
}

export function redactDiagnostic(value) {
  return String(value || '')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[已隐藏]')
    .replace(/((?:x-)?api[-_ ]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[已隐藏]')
    .replace(/\b(sk|key|token)-[A-Za-z0-9._-]{8,}\b/gi, '[已隐藏密钥]')
    .replace(/([?&](?:key|token|api_key)=)[^&#\s]+/gi, '$1[已隐藏]');
}

export function diagnosticAdvice(kind, detail) {
  const code = String(kind || '').trim().toLocaleLowerCase();
  const detailText = String(detail || '');
  if (code === 'completed') {
    return { severity: 'success', summary: '本轮MVU完整替换块、人物档案和世界状态已经完成。', action: '无需处理。' };
  }
  if (code === 'variable_nochange_unproven') {
    return { severity: 'warning', summary: '变量模型没有提出本回合变化，但脚本不会把模型判断冒充绝对正确。', action: '若你在正文或面板发现具体疑点，请填写后点击“重新检查当前MVU变量”。' };
  }
  if (code === 'surface_refresh_failed') {
    return { severity: 'warning', summary: '数据已经持久化，但酒馆消息面板没有完整自动刷新。', action: '请手动刷新当前聊天；完整详情保留在本条诊断中，已确认数据不会因此回滚。' };
  }
  if (code === 'world_recovered') {
    return { severity: 'success', summary: '上次中断的世界候选已经从持久检查点恢复并完成读回。', action: '无需重复推进；可在“世界”页核对修订号和提交摘要。' };
  }
  if (['variable_manual_completed', 'variable_recovered', 'variable_undo_completed'].includes(code)) {
    return { severity: 'success', summary: 'MVU变量事务已经完成并取得读回证据。', action: '无需处理；可在完整报告中查看检查回执和路径快照。' };
  }
  if (code === 'accepted_structure_repaired') {
    return { severity: 'success', summary: '最终正文缺失的唯一闭合标签已在明确边界前补回并持久化。', action: '正文内容、选项与变量块未被改写；无需处理。' };
  }
  if (code === 'accepted_structure_failed') {
    return { severity: 'error', summary: '最终正文的结构不唯一，医生没有猜测或继续写入。', action: '请重roll本条正文；变量、人物档案与世界推进均未开始。' };
  }
  if (code === 'variable_recovery_failed') {
    return { severity: 'error', summary: '中断的MVU变量事务与当前正文或状态发生分叉。', action: '医生没有自动覆盖；请导出完整报告并先手动复检当前MVU变量。' };
  }
  if (code === 'variable_failed') {
    return { severity: 'error', summary: 'MVU变量没有完成检查或修复，人物档案和世界推进尚未开始。', action: '保留当前正文，检查MVU/变量结构与模型连接后点击“重试MVU变量失败步骤”。' };
  }
  if (code === 'variable_schema_rejected') {
    return { severity: 'error', summary: '变量医生提出了当前角色卡Schema不允许的补丁，本轮变量阶段失败。', action: '修正补丁或角色卡Schema后重试；人物档案与世界不会在变量未闭合时继续。' };
  }
  if (code === 'world_failed') {
    return { severity: 'error', summary: '人物档案阶段已结束，但世界支线没有完成推进。', action: '点击“重试世界支线失败步骤”；旧世界记录会保留，格式错误会自动定向修复。' };
  }
  if (code === 'profile_failed' && /JSON|解析|array element|object property/i.test(detailText)) {
    return { severity: 'error', summary: '模型返回的结构化档案格式损坏，本轮保持零写入。', action: '先点击“重试失败步骤”；若再次失败，提高人物输出上限或更换格式遵从性更好的模型。' };
  }
  if (code === 'profile_failed') {
    return { severity: 'error', summary: '人物档案没有达到完整可用标准，本轮保持零写入。', action: '展开详情查看具体缺项；修正连接或输出上限后点击“重试人物档案失败步骤”。' };
  }
  const text = `${code} ${detailText}`;
  if (/variable|MVU变量|变量修复/i.test(text)) {
    return { severity: 'error', summary: 'MVU变量没有完成检查或修复，人物档案和世界推进尚未开始。', action: '保留当前正文，检查MVU/变量结构与模型连接后点击“重试MVU变量失败步骤”。' };
  }
  if (/world[_ -]?failed|世界.*失败|支线.*失败/i.test(text)) {
    return { severity: 'error', summary: '人物档案阶段已结束，但世界支线没有完成推进。', action: '点击“重试世界支线失败步骤”；旧世界记录会保留，格式错误会自动定向修复。' };
  }
  if (/JSON|解析|array element|object property/i.test(text)) {
    return { severity: 'error', summary: '模型返回的结构化档案格式损坏，本轮保持零写入。', action: '先点击“重试失败步骤”；若再次失败，提高人物输出上限或更换格式遵从性更好的模型。' };
  }
  if (/401|403|鉴权|unauthorized|forbidden|密钥/i.test(text)) {
    return { severity: 'error', summary: '医生API鉴权失败，没有向人物或世界状态写入结果。', action: '打开“连接”页，核对API地址、密钥和模型后重新测试。' };
  }
  if (/429|限流|rate limit/i.test(text)) {
    return { severity: 'warning', summary: '模型服务正在限流，本轮任务没有伪造成功。', action: '稍后重试，或换用限额充足的连接。' };
  }
  if (/MVU.*不可用|无法读取.*MVU|MVU接口/i.test(text)) {
    return { severity: 'error', summary: '医生没有取得当前楼层的MVU接口或状态。', action: '确认MagVarUpdate已启用并完成本轮变量处理，再重试当前失败步骤。' };
  }
  if (/profile[_ -]?failed|人物档案.*失败|整批.*失败/i.test(text)) {
    return { severity: 'error', summary: '人物档案没有达到完整可用标准，本轮保持零写入。', action: '展开详情查看具体缺项；修正连接或输出上限后点击“重试人物档案失败步骤”。' };
  }
  if (/读回|回滚|提交失败|写入/i.test(text)) {
    return { severity: 'error', summary: '档案提交或读回验证失败，医生没有把半张档案算作成功。', action: '不要继续覆盖当前状态；先刷新查看档案是否存在，再使用诊断中的失败步骤重试。' };
  }
  if (/HTTP 5\d\d|failed to fetch|network|连接.*失败/i.test(text)) {
    return { severity: 'error', summary: '医生模型服务没有正常响应，本轮没有伪造档案或世界进度。', action: '到“连接”页重新测试；若持续失败，核对端点状态、跨域限制或改用酒馆当前模型。' };
  }
  if (/stale|过期|切换|取消/i.test(text)) {
    return { severity: 'warning', summary: '任务因聊天、楼层或生成目标改变而作废。', action: '回到对应聊天和最新回复后重新生成；旧结果不会写入新目标。' };
  }
  return { severity: 'info', summary: '医生记录了一条运行信息。', action: '展开详情核对；若影响当前回合，可在修正配置后重试失败步骤。' };
}

export const WORLD_SCHEMA_VERSION = 7;

const PUBLIC_PROJECTION_LEAK_MARKERS = /(?:内心|真实(?:想法|目的|身份)|暗中|私下|偷偷|无人(?:看见|察觉|知道)|其实|伪装|装作|盘算|谋划|背地里|不为人知|秘密(?:身份|目的|计划|行动|记录|档案|弱点|真相|情报)?\s*(?:是|为|在于|包括|涉及|指向)|秘密(?:地|进行|策划|记录|收集|评估|跟踪|监视))/u;
const PUBLIC_INTENT_MARKERS = /(?:为了|打算|计划|决定|意图|企图|故意|想要|试图|目的|动机)/u;
const PUBLIC_CAUSAL_ATTRIBUTION_MARKERS = /(?:因为|由于|因此|从而|由.{0,18}(?:造成|导致|引起|留下))/u;
const RUMOR_UNCERTAINTY_MARKERS = /(?:传闻|据说|听说|有人说|风声|未经证实|据称|似乎|可能|或许|坊间)/u;
const PUBLIC_OBSERVABLE_SURFACE_MARKERS = /(?:看见|看到|听见|听到|闻到|发现|出现|消失|打开|关闭|破损|损坏|移动|到达|离开|进入|走出|前往|穿过|张贴|宣布|递交|搬运|交付|袭击|拦截|封锁|公开|露面|痕迹|脚印|足迹|划痕|血迹|水痕|残留|碎片|告示|封条|价格|缺货|库存|人群|车辆|灯光?|声音|响声|气味|烟雾?|温度|天气|雨|雪|风|雾|雷|火|水|门|窗|道路|地面|墙面?|货架|建筑|伤口|增加|减少|上升|下降|改变|变化|倒塌|停电|断水|震动|摇晃|腐蚀|生锈|染色|湿润|干燥|拥堵|空缺|排队)/u;
const PUBLIC_HIDDEN_AGENT_ACTION_MARKERS = /(?:(?:记录者|行动者|某人|有人|幕后(?:人物|势力)?).{0,18}(?:整理|记录|收集|调查|监视|分析|跟踪|完成)|(?:已|已经)(?:整理完?|收集完?|调查完?|监视|分析完?|记录完?))/u;

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function cleanStringArray(value, limit = 24) {
  const source = Array.isArray(value) ? value : value == null ? [] : String(value).split(/[，,、；;\n]/u);
  return [...new Set(source.map((item) => cleanText(item)).filter(Boolean))].slice(0, limit);
}

function publicProjectionLeak(value) {
  const texts = Array.isArray(value) ? value : [value];
  return texts.map((item) => cleanText(item)).find((item) => item && PUBLIC_PROJECTION_LEAK_MARKERS.test(item)) || '';
}

export function publicProjectionIssue(value, channel, subject = {}) {
  const text = cleanText(value);
  const normalizedChannel = normalizePublicChannel(channel);
  if (!text || normalizedChannel === 'none') return text ? 'public_channel_none' : '';
  if (publicProjectionLeak(text)) return 'private_truth_or_hidden_intent';
  const subjectName = cleanText(subject?.name);
  if (normalizedChannel === 'environment_trace') {
    if (subject?.type !== 'process' && subjectName.length >= 2 && text.includes(subjectName)) return 'environment_trace_names_subject';
    if (!PUBLIC_OBSERVABLE_SURFACE_MARKERS.test(text)) return 'environment_trace_not_observable';
    if (PUBLIC_HIDDEN_AGENT_ACTION_MARKERS.test(text)) return 'environment_trace_contains_agentive_hidden_action';
    if (PUBLIC_INTENT_MARKERS.test(text) || PUBLIC_CAUSAL_ATTRIBUTION_MARKERS.test(text)) return 'environment_trace_explains_cause';
  }
  if (normalizedChannel === 'rumor' && !RUMOR_UNCERTAINTY_MARKERS.test(text)) return 'rumor_missing_uncertainty';
  if (normalizedChannel === 'named_action') {
    if (subjectName.length < 2 || !text.includes(subjectName)) return 'named_action_missing_subject_name';
    if (!PUBLIC_OBSERVABLE_SURFACE_MARKERS.test(text)) return 'named_action_not_observable';
  }
  if (normalizedChannel === 'direct_consequence' && !PUBLIC_OBSERVABLE_SURFACE_MARKERS.test(text)) return 'direct_consequence_not_observable';
  if (['named_action', 'direct_consequence'].includes(normalizedChannel) && (PUBLIC_INTENT_MARKERS.test(text) || PUBLIC_HIDDEN_AGENT_ACTION_MARKERS.test(text))) return 'public_projection_explains_private_intent';
  return '';
}

function stableWorldId(prefix, ...parts) {
  const source = parts.flat().map((item) => cleanText(item).toLocaleLowerCase()).filter(Boolean).join('|') || `${prefix}|empty`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function optionalInteger(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

function explicitSubjectType(value) {
  const text = cleanText(value).toLocaleLowerCase();
  if (['person', 'actor', 'npc', '人物', '角色'].includes(text)) return 'person';
  if (['faction', 'group', '势力', '组织', '阵营'].includes(text)) return 'faction';
  if (['process', 'environment', 'event', '过程', '环境', '事件', '任务'].includes(text)) return 'process';
  return '';
}

function normalizeSubjectType(value) {
  return explicitSubjectType(value) || 'process';
}

function normalizeSubjectStatus(value) {
  const text = cleanText(value).toLocaleLowerCase();
  if (['done', 'resolved', 'complete', '完成', '结束', '已解决'].includes(text)) return 'done';
  if (['waiting', 'blocked', 'paused', '等待', '受阻', '暂停'].includes(text)) return 'waiting';
  return 'active';
}

function normalizePublicChannel(value) {
  const text = cleanText(value).toLocaleLowerCase();
  if (['environment', 'trace', 'environment_trace', '环境痕迹', '痕迹'].includes(text)) return 'environment_trace';
  if (['rumor', '传闻', '风声'].includes(text)) return 'rumor';
  if (['named_action', 'observable_action', '具名行动', '公开行动'].includes(text)) return 'named_action';
  if (['direct_consequence', 'observable', '直接后果', '可见后果'].includes(text)) return 'direct_consequence';
  return 'none';
}

function normalizeResultType(value) {
  const text = cleanText(value).toLocaleLowerCase();
  if (['success', '成功', '达成'].includes(text)) return 'success';
  if (['partial', '部分', '有限成功'].includes(text)) return 'partial';
  if (['blocked', 'failure', '受阻', '失败'].includes(text)) return 'blocked';
  if (['waiting', '等待'].includes(text)) return 'waiting';
  return 'delayed';
}

function normalizeWorldSource(value = {}, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    chatId: cleanText(source.chatId, cleanText(fallback.chatId)),
    messageId: optionalInteger(source.messageId) ?? optionalInteger(fallback.messageId),
    sourceKey: cleanText(source.sourceKey, cleanText(fallback.sourceKey)),
    excerpt: cleanText(source.excerpt, cleanText(fallback.excerpt)).slice(0, 500),
    at: cleanText(source.at, cleanText(fallback.at, new Date().toISOString())),
  };
}

function normalizeWorldReceipt(entry = {}, fallback = {}) {
  return {
    sourceKey: cleanText(entry.sourceKey, cleanText(fallback.sourceKey)),
    messageId: optionalInteger(entry.messageId) ?? optionalInteger(fallback.messageId),
    turn: Math.max(0, Number(entry.turn || fallback.turn || 0)),
    status: ['applied', 'partial', 'noop'].includes(cleanText(entry.status)) ? cleanText(entry.status) : 'noop',
    subjectIds: cleanStringArray(entry.subjectIds, 32),
    unresolvedSubjectIds: cleanStringArray(entry.unresolvedSubjectIds, 32),
    unresolvedDiscoveries: cleanStringArray(entry.unresolvedDiscoveries, 32),
    at: cleanText(entry.at, cleanText(fallback.at, new Date().toISOString())),
  };
}

function normalizeObservationEpistemic(value) {
  const text = cleanText(value).toLocaleLowerCase();
  if (['confirmed_public_effect', 'confirmed', '已确认公开影响'].includes(text)) return 'confirmed_public_effect';
  if (['direct', 'direct_observation', '直接观察'].includes(text)) return 'direct';
  if (['claim', 'statement', '说法', '声称'].includes(text)) return 'claim';
  if (['rumor', '传闻', '风声'].includes(text)) return 'rumor';
  return 'unverified';
}

function normalizeSubjectObservation(entry = {}, fallback = {}) {
  const source = entry && typeof entry === 'object' ? entry : { fact: entry };
  const fact = cleanText(source.fact, cleanText(source.text));
  if (!fact) return null;
  return {
    fact,
    epistemic: normalizeObservationEpistemic(source.epistemic || source.kind),
    turn: Math.max(0, Number(source.turn || fallback.turn || 0)),
    source: normalizeWorldSource(source.source, fallback),
  };
}

function normalizeActorPlanReceipt(entry = {}, fallback = {}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const subjectId = cleanText(entry.subjectId, cleanText(fallback.subjectId));
  const planId = cleanText(entry.planId);
  if (!subjectId || !planId) return null;
  const phase = cleanText(entry.phase) === 'bootstrap' ? 'bootstrap' : 'next';
  return {
    planId,
    subjectId,
    phase,
    attempt: cleanText(entry.attempt),
    goal: cleanText(entry.goal),
    knowledge: cleanStringArray(entry.knowledge, 32),
    nextAction: cleanText(entry.nextAction),
    nextCheckTurn: Math.max(0, optionalInteger(entry.nextCheckTurn) ?? 0),
    basedOnTicketId: cleanText(entry.basedOnTicketId),
    basedOnAttempt: cleanText(entry.basedOnAttempt),
    basedOnAdjudicationDigest: cleanText(entry.basedOnAdjudicationDigest),
    plannedTurn: Math.max(0, Number(entry.plannedTurn || fallback.turn || 0)),
    sourceKey: cleanText(entry.sourceKey, cleanText(fallback.sourceKey)),
    at: cleanText(entry.at, cleanText(fallback.at, new Date().toISOString())),
  };
}

function normalizeSubject(entry = {}, index = 0, fallback = {}) {
  const type = normalizeSubjectType(entry.type || entry.kind);
  const name = cleanText(entry.name, cleanText(entry.title, `${type === 'person' ? '人物' : type === 'faction' ? '势力' : '过程'}${index + 1}`));
  const id = cleanText(entry.id, stableWorldId('subject', type, entry.profileId, name));
  const publicEffect = cleanText(entry.publicEffect);
  const requestedPublicChannel = normalizePublicChannel(entry.publicChannel);
  const publicChannel = publicEffect && !publicProjectionIssue(publicEffect, requestedPublicChannel, { name, type })
    ? requestedPublicChannel
    : 'none';
  return {
    id,
    type,
    name,
    profileId: cleanText(entry.profileId),
    anchor: cleanText(entry.anchor, cleanText(entry.identityAnchor)),
    current: cleanText(entry.current, cleanText(entry.summary)),
    goal: cleanText(entry.goal, cleanText(entry.driver)),
    knowledge: cleanStringArray(entry.knowledge, 32),
    observedFacts: cleanStringArray(entry.observedFacts, 32),
    observations: (Array.isArray(entry.observations) ? entry.observations : [])
      .map((observation) => normalizeSubjectObservation(observation, fallback)).filter(Boolean).slice(-48),
    resources: cleanStringArray(entry.resources, 24),
    constraints: cleanStringArray(entry.constraints, 24),
    nextAction: cleanText(entry.nextAction, cleanText(entry.nextBeat)),
    nextCheckTurn: Math.max(0, optionalInteger(entry.nextCheckTurn ?? entry.nextActionTurn) ?? Number(fallback.turn || 0)),
    planReceipt: normalizeActorPlanReceipt(entry.planReceipt, { subjectId: id, turn: fallback.turn, sourceKey: fallback.sourceKey, at: fallback.at }),
    status: normalizeSubjectStatus(entry.status),
    lastAdvancedTurn: Math.max(0, Number(entry.lastAdvancedTurn || entry.updatedTurn || 0)),
    silenceTurns: Math.max(0, Number(entry.silenceTurns || 0)),
    threadKeys: cleanStringArray(entry.threadKeys ?? entry.sourceThreadIds, 16),
    discoverySignature: cleanText(entry.discoverySignature),
    recentModes: cleanStringArray(entry.recentModes, 8).slice(-8),
    publicEffect: publicChannel === 'none' ? '' : publicEffect,
    publicChannel,
    publicEffectTurn: publicChannel === 'none' ? 0 : Math.max(0, Number(entry.publicEffectTurn || entry.lastAdvancedTurn || entry.updatedTurn || fallback.turn || 0)),
    publicEffectSourceChangeId: publicChannel === 'none' ? '' : cleanText(entry.publicEffectSourceChangeId),
    offeredTurn: Math.max(0, Number(entry.offeredTurn || 0)),
    lastOfferedTurn: Math.max(0, Number(entry.lastOfferedTurn || entry.offeredTurn || 0)),
    lastOfferedSourceKey: cleanText(entry.lastOfferedSourceKey),
    offerCount: Math.max(0, Number(entry.offerCount || 0)),
    shownTurn: Math.max(0, Number(entry.shownTurn || 0)),
    createdTurn: Math.max(0, Number(entry.createdTurn || fallback.turn || 0)),
    updatedTurn: Math.max(0, Number(entry.updatedTurn || entry.lastAdvancedTurn || fallback.turn || 0)),
    source: normalizeWorldSource(entry.source || entry.sourceRef, fallback),
  };
}

function normalizeChange(entry = {}, index = 0, fallback = {}) {
  const turn = Math.max(0, Number(entry.turn || fallback.turn || 0));
  const subjectIds = cleanStringArray(entry.subjectIds ?? entry.actorId ?? entry.subjectId, 16);
  const publicEffect = cleanText(entry.publicEffect, cleanText(entry.observableConsequence));
  const requestedPublicChannel = normalizePublicChannel(entry.publicChannel || (entry.visibility === 'observable' ? 'direct_consequence' : 'none'));
  const publicChannel = publicEffect && !publicProjectionIssue(publicEffect, requestedPublicChannel, fallback.subject || {})
    ? requestedPublicChannel
    : 'none';
  return {
    id: cleanText(entry.id, stableWorldId('change', subjectIds, turn, entry.stateChange, entry.outcome, index)),
    subjectIds,
    threadKeys: cleanStringArray(entry.threadKeys ?? entry.threadId, 16),
    turn,
    mode: cleanText(entry.mode),
    resultType: normalizeResultType(entry.resultType || entry.status),
    attempt: cleanText(entry.attempt, cleanText(entry.action, cleanText(entry.intent))),
    outcome: cleanText(entry.outcome, cleanText(entry.resultSummary, cleanText(entry.consequence))),
    cost: cleanText(entry.cost, cleanStringArray(entry.actualCosts ?? entry.resourceCosts, 12).join('；')),
    stateChange: cleanText(entry.stateChange, cleanStringArray(entry.appliedStateChanges, 12).join('；')),
    visibility: publicChannel === 'none' ? 'private' : publicChannel === 'rumor' ? 'trace' : 'public',
    publicEffect: publicChannel === 'none' ? '' : publicEffect,
    publicChannel,
    offeredTurn: Math.max(0, Number(entry.offeredTurn || 0)),
    lastOfferedTurn: Math.max(0, Number(entry.lastOfferedTurn || entry.offeredTurn || 0)),
    lastOfferedSourceKey: cleanText(entry.lastOfferedSourceKey),
    offerCount: Math.max(0, Number(entry.offerCount || 0)),
    shownTurn: Math.max(0, Number(entry.shownTurn || 0)),
    source: normalizeWorldSource(entry.source || entry.sourceRef, fallback),
    at: cleanText(entry.at, fallback.at || new Date().toISOString()),
  };
}

function worldDigestPayload(world) {
  const copy = deepClone(world || {});
  delete copy.digest;
  delete copy.persistence;
  delete copy.migration;
  return copy;
}

export function worldDigest(world) {
  return stableWorldId('wd', JSON.stringify(worldDigestPayload(world)));
}

export function emptyWorldState(chatId = '') {
  const now = new Date().toISOString();
  const world = {
    schemaVersion: WORLD_SCHEMA_VERSION,
    chatId: cleanText(chatId),
    revision: 0,
    turn: 0,
    summary: '',
    subjects: [],
    changes: [],
    receipts: [],
    failures: [],
    persistence: { status: 'loaded', savedAt: '', readbackAt: now, error: '' },
    migration: null,
    updatedAt: now,
    digest: '',
  };
  world.digest = worldDigest(world);
  return world;
}

function legacyThreadRecords(input = {}) {
  const records = Array.isArray(input.threads) ? input.threads : [];
  const oldLists = [
    ['branches', '平行事项'], ['npcIntents', '人物事项'], ['agreements', '约定'], ['hostilePlans', '敌对事项'],
  ];
  for (const [key, label] of oldLists) {
    for (const entry of Array.isArray(input[key]) ? input[key] : []) {
      records.push({
        id: entry?.id,
        title: entry?.title || entry?.actor || label,
        summary: entry?.consequence || entry?.intent,
        nextBeat: entry?.intent,
        actorIds: cleanStringArray(entry?.actor),
        stage: entry?.status,
        kind: key,
      });
    }
  }
  return records;
}

function migrateLegacyWorld(input, options = {}) {
  const chatId = cleanText(options.chatId, cleanText(input?.chatId));
  const turn = Math.max(0, Number(input?.simulatedThrough?.turn || input?.observedThrough?.turn || input?.turn || 0));
  const now = cleanText(input?.updatedAt, new Date().toISOString());
  const subjects = [];
  const changes = [];
  const byIdentity = new Map();
  const addSubject = (raw) => {
    const subject = normalizeSubject(raw, subjects.length, { chatId, turn, at: now });
    const key = cleanText(subject.profileId || subject.name).toLocaleLowerCase();
    if (key && byIdentity.has(key)) {
      const existing = subjects[byIdentity.get(key)];
      existing.threadKeys = cleanStringArray([...existing.threadKeys, ...subject.threadKeys], 16);
      if (!existing.current) existing.current = subject.current;
      if (!existing.goal) existing.goal = subject.goal;
      if (!existing.nextAction) existing.nextAction = subject.nextAction;
      return existing;
    }
    byIdentity.set(key || subject.id, subjects.length);
    subjects.push(subject);
    return subject;
  };

  for (const actor of Array.isArray(input?.lanes?.actors) ? input.lanes.actors : []) {
    addSubject({
      id: actor.actorId && `subject-${actor.actorId}`,
      type: 'person', name: actor.name || actor.actorId, profileId: actor.actorId,
      anchor: actor.goal, current: actor.lastAction, goal: actor.goal,
      nextAction: actor.planSteps?.[0], nextCheckTurn: actor.nextActionTurn,
      lastAdvancedTurn: actor.lastActionTurn, silenceTurns: actor.silenceTurns,
      status: actor.status, threadKeys: actor.sourceThreadIds,
    });
  }
  for (const faction of Array.isArray(input?.lanes?.factions) ? input.lanes.factions : []) {
    addSubject({
      id: faction.factionId && `subject-${faction.factionId}`,
      type: 'faction', name: faction.name || faction.factionId,
      anchor: faction.summary, current: faction.condition || faction.summary, goal: faction.goal,
      nextCheckTurn: turn, status: faction.status, threadKeys: faction.sourceThreadIds,
    });
  }
  const environment = input?.lanes?.environment || input?.environment;
  if (environment && typeof environment === 'object'
    && [environment.summary, environment.economy, ...(environment.incidents || []), ...(environment.trends || []), ...(environment.winds || [])].some(Boolean)) {
    addSubject({
      type: 'process', name: '区域环境与社会过程', anchor: '依据已确认的环境、经济、事件与趋势按自身惯性演化',
      current: [environment.summary, environment.economy, ...(environment.incidents || []), ...(environment.trends || []), ...(environment.winds || [])].filter(Boolean).join('；'),
      goal: '按既有条件、惯性、阈值与外力继续演化', nextCheckTurn: turn, status: 'active', threadKeys: ['环境与社会变化'],
    });
  }

  for (const thread of legacyThreadRecords(deepClone(input || {}))) {
    const actorKeys = cleanStringArray(thread.actorIds).map((item) => item.toLocaleLowerCase());
    let subject = subjects.find((entry) => actorKeys.includes(entry.profileId.toLocaleLowerCase()) || actorKeys.includes(entry.name.toLocaleLowerCase()));
    if (!subject) {
      subject = addSubject({
        type: thread.kind === 'hostilePlans' ? 'faction' : 'process',
        name: cleanText(thread.title, '迁移中的世界事项'),
        anchor: cleanText(thread.summary, '由旧世界记录迁移，后续按实际主体与条件继续核实'),
        current: cleanText(thread.summary), goal: cleanText(thread.summary), nextAction: cleanText(thread.nextBeat),
        nextCheckTurn: turn, status: thread.stage, threadKeys: [thread.id || thread.title],
      });
    } else {
      subject.threadKeys = cleanStringArray([...subject.threadKeys, thread.id || thread.title], 16);
      if (!subject.current) subject.current = cleanText(thread.summary);
      if (!subject.nextAction) subject.nextAction = cleanText(thread.nextBeat);
    }
  }

  const adjudications = new Map((Array.isArray(input?.adjudications) ? input.adjudications : []).map((entry) => [entry.attemptId, entry]));
  for (const attempt of Array.isArray(input?.attempts) ? input.attempts : []) {
    const result = adjudications.get(attempt.attemptId) || {};
    const identity = cleanText(attempt.actorId || attempt.actorName).toLocaleLowerCase();
    const subject = subjects.find((entry) => entry.profileId.toLocaleLowerCase() === identity || entry.name.toLocaleLowerCase() === identity);
    changes.push(normalizeChange({
      id: result.resultId || attempt.attemptId,
      subjectIds: subject ? [subject.id] : [],
      threadKeys: [attempt.threadId].filter(Boolean),
      turn: result.sourceRef?.turn || attempt.sourceRef?.turn || turn,
      mode: 'legacy_action', resultType: result.status,
      attempt: attempt.action || attempt.intent, outcome: result.resultSummary,
      cost: result.actualCosts, stateChange: result.appliedStateChanges,
      publicEffect: result.observableConsequence || attempt.publicSurface,
      publicChannel: attempt.visibility === 'observable' ? 'direct_consequence' : attempt.visibility === 'rumor' ? 'rumor' : 'none',
      source: result.sourceRef || attempt.sourceRef,
    }, changes.length, { chatId, turn, at: now, subject: subject || {} }));
  }

  return {
    schemaVersion: WORLD_SCHEMA_VERSION,
    chatId,
    revision: Math.max(0, Number(input?.revision || 0)),
    turn,
    summary: cleanText(input?.summary),
    subjects,
    changes,
    receipts: [],
    failures: [],
    persistence: { status: 'migrated', savedAt: '', readbackAt: now, error: '' },
    migration: { fromSchema: Number(input?.schemaVersion || 0), at: now, subjectCount: subjects.length, changeCount: changes.length },
    updatedAt: now,
    digest: '',
  };
}

export function normalizeWorldState(input = {}, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return emptyWorldState(options.chatId);
  const source = Number(input.schemaVersion) === WORLD_SCHEMA_VERSION && Array.isArray(input.subjects)
    ? deepClone(input)
    : migrateLegacyWorld(input, options);
  const chatId = cleanText(options.chatId, cleanText(source.chatId));
  const turn = Math.max(0, Number(source.turn || 0));
  const now = cleanText(source.updatedAt, new Date().toISOString());
  const subjects = (Array.isArray(source.subjects) ? source.subjects : []).map((entry, index) => normalizeSubject(entry, index, { chatId, turn, at: now }));
  const ids = new Set();
  const uniqueSubjects = subjects.filter((entry) => {
    if (ids.has(entry.id)) return false;
    ids.add(entry.id);
    return true;
  }).slice(-240);
  const subjectById = new Map(uniqueSubjects.map((entry) => [entry.id, entry]));
  const changes = (Array.isArray(source.changes) ? source.changes : []).map((entry, index) => {
    const subjectIds = cleanStringArray(entry?.subjectIds ?? entry?.actorId ?? entry?.subjectId, 16);
    const projectionSubject = subjectIds.map((id) => subjectById.get(id)).find(Boolean) || {};
    return normalizeChange(entry, index, { chatId, turn, at: now, subject: projectionSubject });
  }).slice(-480);
  const world = {
    schemaVersion: WORLD_SCHEMA_VERSION,
    chatId,
    revision: Math.max(0, Number(source.revision || 0)),
    turn,
    summary: cleanText(source.summary),
    subjects: uniqueSubjects,
    changes,
    receipts: (Array.isArray(source.receipts) ? source.receipts : [])
      .map((entry) => normalizeWorldReceipt(entry, { chatId, turn, at: now }))
      .filter((entry) => entry.sourceKey)
      .slice(-240),
    failures: (Array.isArray(source.failures) ? source.failures : []).map((entry) => ({
      subjectId: cleanText(entry?.subjectId), code: cleanText(entry?.code, 'world_update_skipped'),
      detail: cleanText(entry?.detail), turn: Math.max(0, Number(entry?.turn || turn)), at: cleanText(entry?.at, now),
      sourceKey: cleanText(entry?.sourceKey),
      discoverySignature: cleanText(entry?.discoverySignature),
      discoveryAnchor: cleanText(entry?.discoveryAnchor),
      discoveryName: cleanText(entry?.discoveryName),
    })).slice(-80),
    persistence: {
      status: cleanText(source.persistence?.status, 'loaded'),
      savedAt: cleanText(source.persistence?.savedAt),
      readbackAt: cleanText(source.persistence?.readbackAt),
      error: cleanText(source.persistence?.error),
    },
    migration: source.migration && typeof source.migration === 'object' ? deepClone(source.migration) : null,
    updatedAt: now,
    digest: '',
  };
  world.digest = worldDigest(world);
  return world;
}

export function seedWorldSubjectsFromProfiles(worldInput, profiles = {}, options = {}) {
  const world = normalizeWorldState(worldInput, { chatId: options.chatId || worldInput?.chatId });
  const turn = Math.max(world.turn, Number(options.turn || world.turn));
  const excludedNames = new Set(cleanStringArray(options.excludedNames, 240).map((value) => value.toLocaleLowerCase()));
  const profileList = Array.isArray(profiles) ? profiles : Object.values(profiles || {});
  const excludedProfileIds = new Set(profileList
    .filter((profile) => normalizedNames(profile).some((value) => excludedNames.has(value)))
    .map((profile) => cleanText(profile?.profileId)).filter(Boolean));
  const retainedSubjects = world.subjects.filter((subject) => !(subject.type === 'person'
    && (excludedProfileIds.has(subject.profileId) || excludedNames.has(subject.name.toLocaleLowerCase()))));
  let changed = world.subjects.length - retainedSubjects.length;
  world.subjects = retainedSubjects;
  const byProfile = new Map(world.subjects.filter((entry) => entry.profileId).map((entry) => [entry.profileId, entry]));
  const peopleByName = new Map();
  for (const subject of world.subjects.filter((entry) => entry.type === 'person')) {
    const normalized = cleanText(subject.name).trim().toLocaleLowerCase();
    if (!normalized) continue;
    const matches = peopleByName.get(normalized) || [];
    matches.push(subject);
    peopleByName.set(normalized, matches);
  }
  for (const profile of profileList) {
    const profileId = cleanText(profile?.profileId);
    const name = cleanText(profile?.name);
    if (!profileId || !name || normalizedNames(profile).some((value) => excludedNames.has(value))) continue;
    const personality = profile.personality || {};
    const identity = profile.identity || {};
    const currentState = profile.currentState || {};
    const anchor = [
      [identity.species, identity.occupation, identity.affiliation].filter(Boolean).join(' / '),
      [personality.temperament, personality.coreDesire, personality.values, personality.thinking, personality.moralBoundary].filter(Boolean).join('；'),
    ].filter(Boolean).join('。');
    const current = [currentState.location, currentState.condition, currentState.emotion].filter(Boolean).join('；');
    const legacyMatches = [...new Map(normalizedNames(profile)
      .flatMap((normalized) => peopleByName.get(normalized) || [])
      .map((subject) => [subject.id, subject])).values()];
    const existing = byProfile.get(profileId) || (legacyMatches.length === 1 ? legacyMatches[0] : null);
    if (!byProfile.has(profileId) && legacyMatches.length > 1) {
      world.failures.push({
        subjectId: '', code: 'legacy_person_identity_ambiguous',
        detail: `人物档案“${name}”同时匹配多个旧人物主体，已拒绝重复建主体并等待身份消歧`,
        turn, at: cleanText(options.at, new Date().toISOString()), sourceKey: '',
      });
      changed += 1;
      continue;
    }
    if (existing) {
      let touched = false;
      const hasWorldHistory = Math.max(0, Number(existing.lastAdvancedTurn || 0)) > 0
        || (existing.recentModes || []).length > 0
        || world.changes.some((change) => (change.subjectIds || []).includes(existing.id));
      if (!existing.profileId) {
        existing.profileId = profileId;
        byProfile.set(profileId, existing);
        touched = true;
      }
      if (anchor && !existing.anchor) {
        existing.anchor = anchor;
        touched = true;
      }
      if (current && !existing.current && !hasWorldHistory) {
        existing.current = current;
        touched = true;
      }
      const profileGoal = cleanText(currentState.goal);
      if (profileGoal && !existing.goal && !hasWorldHistory) {
        existing.goal = profileGoal;
        touched = true;
      }
      const profileKnowledge = cleanStringArray(profile.knowledge, 32);
      if (!existing.knowledge?.length && !hasWorldHistory && profileKnowledge.length) {
        existing.knowledge = profileKnowledge;
        touched = true;
      }
      const profileResources = cleanStringArray(profile.resources, 24);
      if (!existing.resources?.length && !hasWorldHistory && profileResources.length) {
        existing.resources = profileResources;
        touched = true;
      }
      if (touched) {
        existing.updatedTurn = turn;
        existing.source = normalizeWorldSource(options.source, {
          chatId: world.chatId,
          messageId: options.messageId,
          sourceKey: options.sourceKey,
          excerpt: options.acceptedText,
          at: options.at,
        });
        changed += 1;
      }
      continue;
    }
    const subject = normalizeSubject({
      id: stableWorldId('subject-person', profileId), type: 'person', name, profileId,
      anchor, current, goal: currentState.goal,
      knowledge: profile.knowledge, resources: profile.resources,
      constraints: ['只能依据本人已知信息、实际能力、当前位置和可调用资源行动', '不得替玩家决定行动、感受、同意或结果'],
      nextAction: currentState.goal, nextCheckTurn: turn, status: 'active', createdTurn: turn, updatedTurn: turn,
      source: normalizeWorldSource(options.source, {
        chatId: world.chatId, messageId: options.messageId, sourceKey: options.sourceKey,
        excerpt: options.acceptedText, at: options.at,
      }),
    }, world.subjects.length, { chatId: world.chatId, turn, at: options.at });
    world.subjects.push(subject);
    byProfile.set(profileId, subject);
    peopleByName.set(name.toLocaleLowerCase(), [subject]);
    changed += 1;
  }
  if (changed) {
    world.updatedAt = cleanText(options.at, new Date().toISOString());
    world.digest = worldDigest(world);
  }
  return { world, changed };
}

export function applyAcceptedWorldObservations(worldInput, observations = [], options = {}) {
  const world = normalizeWorldState(worldInput, { chatId: options.chatId || worldInput?.chatId });
  const turn = Math.max(world.turn, Number(options.turn || world.turn));
  const at = cleanText(options.at, new Date().toISOString());
  const acceptedText = cleanText(options.acceptedText);
  const source = normalizeWorldSource(options.source, {
    chatId: world.chatId,
    messageId: options.messageId,
    sourceKey: options.sourceKey,
    excerpt: acceptedText,
    at,
  });
  const applied = [];
  const confirmed = [];
  for (const observation of Array.isArray(observations) ? observations : []) {
    const subject = world.subjects.find((entry) => entry.id === cleanText(observation?.subjectId));
    const fact = cleanText(observation?.fact);
    if (!subject || !fact || fact.length < 3 || !acceptedText.includes(fact)) continue;
    const provenPublicEffect = subject.publicEffect === fact || world.changes.some((change) =>
      (change.subjectIds || []).includes(subject.id) && change.publicChannel !== 'none' && change.publicEffect === fact);
    const requestedEpistemic = normalizeObservationEpistemic(observation?.epistemic);
    const epistemic = requestedEpistemic === 'confirmed_public_effect' && provenPublicEffect
      ? 'confirmed_public_effect'
      : requestedEpistemic === 'confirmed_public_effect' ? 'unverified' : requestedEpistemic;
    const duplicate = (subject.observations || []).some((entry) => entry?.source?.sourceKey === source.sourceKey
      && entry.fact === fact && entry.epistemic === epistemic);
    if (duplicate) continue;
    subject.observations = [
      ...(subject.observations || []),
      normalizeSubjectObservation({ fact, epistemic, turn, source }, { chatId: world.chatId, turn, at }),
    ].filter(Boolean).slice(-48);
    if (epistemic === 'confirmed_public_effect') {
      subject.observedFacts = cleanStringArray([...(subject.observedFacts || []), fact], 32).slice(-32);
      confirmed.push(subject.id);
    }
    applied.push(subject.id);
  }
  if (applied.length) {
    world.changes = world.changes.slice(-480);
    world.updatedAt = at;
    world.digest = worldDigest(world);
  }
  return { world, applied, confirmed };
}

export function ensureWorldObserverSubject(worldInput, options = {}) {
  const world = normalizeWorldState(worldInput, { chatId: options.chatId || worldInput?.chatId });
  const id = stableWorldId('subject-process', world.chatId, 'world-observer');
  const observerIds = new Set(world.subjects
    .filter((entry) => entry.id === id || cleanText(entry.name) === '世界背景与未归属进程')
    .map((entry) => entry.id));
  if (!observerIds.size) return { world, changed: 0 };
  const beforeSubjects = world.subjects.length;
  const beforeChanges = world.changes.length;
  const beforeFailures = world.failures.length;
  world.subjects = world.subjects.filter((entry) => !observerIds.has(entry.id));
  world.changes = world.changes.filter((entry) => !(entry.subjectIds || []).some((subjectId) => observerIds.has(subjectId)));
  world.failures = world.failures.filter((entry) => !observerIds.has(entry.subjectId));
  const changed = (beforeSubjects - world.subjects.length) + (beforeChanges - world.changes.length) + (beforeFailures - world.failures.length);
  world.updatedAt = cleanText(options.at, new Date().toISOString());
  world.digest = worldDigest(world);
  return { world, changed };
}

function subjectRelevance(subject, userInput) {
  const source = recallSelectionInput(userInput).toLocaleLowerCase();
  if (!source) return 0;
  const values = [subject.name, subject.goal, subject.current, subject.nextAction, ...subject.threadKeys]
    .map((item) => cleanText(item).toLocaleLowerCase()).filter(Boolean);
  return values.some((item) => source.includes(item) || item.includes(source)) ? 4 : 0;
}

export function selectDueWorldSubjects(worldInput, options = {}) {
  const world = normalizeWorldState(worldInput, { chatId: options.chatId || worldInput?.chatId });
  const turn = Math.max(world.turn + 1, Number(options.turn || 0));
  const budget = Math.max(1, Math.min(12, Number(options.limit || 6)));
  const active = world.subjects.filter((entry) => entry.status !== 'done');
  const due = active.filter((entry) => entry.nextCheckTurn <= turn || entry.silenceTurns >= 2);
  const pool = due.length ? due : active.filter((entry) => entry.silenceTurns > 0);
  const scored = pool.map((subject) => ({
    subject,
    score: Math.max(0, turn - subject.nextCheckTurn) * 5 + subject.silenceTurns * 3 + subjectRelevance(subject, options.userInput),
  })).sort((left, right) => right.score - left.score || left.subject.lastAdvancedTurn - right.subject.lastAdvancedTurn || left.subject.id.localeCompare(right.subject.id));
  const queues = new Map(['person', 'faction', 'process'].map((type) => [type, scored.filter((entry) => entry.subject.type === type)]));
  const order = ['person', 'faction', 'process'];
  const rotated = order.slice(turn % order.length).concat(order.slice(0, turn % order.length));
  const selected = [];
  while (selected.length < budget && rotated.some((type) => queues.get(type).length)) {
    for (const type of rotated) {
      const item = queues.get(type).shift();
      if (item) selected.push(item.subject);
      if (selected.length >= budget) break;
    }
  }
  return selected.map(deepClone);
}

function choose(pool, random) {
  const value = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
  return pool[Math.floor(value * pool.length)];
}

function deterministicRandom(seed) {
  const source = cleanText(seed, 'mvu-world-ticket');
  let state = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    state ^= source.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function feasibleWorldResults(subject, advanceMode, intensity) {
  const resources = cleanStringArray(subject?.resources, 24);
  const constraints = cleanStringArray(subject?.constraints, 24);
  const status = normalizeSubjectStatus(subject?.status);
  const reasons = [];
  let results;
  if (advanceMode === 'wait_condition') {
    results = ['delayed', 'blocked', 'partial'];
    reasons.push('本轮只等待或核对条件，不能在条件尚未被世界事实证明满足时直接宣告成功');
  } else if (status === 'waiting' && ['act', 'evolve', 'threshold_check'].includes(advanceMode)) {
    results = ['partial', 'blocked', 'delayed'];
    reasons.push('主体仍处于等待或受阻状态，直接行动只能形成有限进展、继续受阻或延迟');
  } else if (!resources.length && constraints.length && ['act', 'evolve', 'threshold_check'].includes(advanceMode)) {
    results = ['partial', 'blocked', 'delayed'];
    reasons.push('主体有明确约束却没有已记录可调用资源，不能凭空完整成功');
  } else if (constraints.length > Math.max(1, resources.length) && intensity === 'high') {
    results = ['partial', 'blocked', 'delayed'];
    reasons.push('高强度推进面对的已知约束多于可用资源，完整成功不在本轮合理范围');
  } else if (['prepare', 'observe', 'change_plan', 'accumulate'].includes(advanceMode)) {
    results = ['success', 'partial', 'delayed'];
    reasons.push('本轮目标是可验证的小步准备、观察、改案或积累；成功只表示这一步落地，不代表总目标完成');
  } else {
    results = ['success', 'partial', 'blocked', 'delayed'];
    reasons.push('现有事实没有排除任何常规结算方向；随机只在这些同样可解释的范围内破同分');
  }
  return { results, reasons };
}

function advanceModeFromCommittedNextAction(subject) {
  const action = cleanText(subject?.nextAction);
  if (/(?:等待|等候|等到|待.+(?:出现|完成|到达)|条件满足|时机成熟|冷却)/u.test(action)) return 'wait_condition';
  if (/(?:观察|监视|侦察|调查|核对|查阅|确认|打听|搜集情报|记录)/u.test(action)) return 'observe';
  if (/(?:准备|筹备|布置|采购|召集|搭建|预备|安排)/u.test(action)) return 'prepare';
  if (/(?:改换|调整|重拟|重新计划|改变计划|另寻|转而)/u.test(action)) return 'change_plan';
  if (subject?.type === 'process' && /(?:积累|增长|扩散|蔓延|沉积|酝酿|恢复|消退)/u.test(action)) return 'accumulate';
  if (subject?.type === 'process') return 'evolve';
  return 'act';
}

function trustedCommittedActorPlan(subject) {
  const receipt = normalizeActorPlanReceipt(subject?.planReceipt, { subjectId: subject?.id, turn: subject?.updatedTurn });
  if (!receipt || receipt.phase !== 'next' || receipt.subjectId !== cleanText(subject?.id)) return null;
  if (!receipt.nextAction || receipt.nextAction !== cleanText(subject?.nextAction)) return null;
  if (!receipt.nextCheckTurn || receipt.nextCheckTurn !== Math.max(0, Number(subject?.nextCheckTurn || 0))) return null;
  return receipt;
}

export function createWorldAdvanceTickets(subjects, options = {}) {
  const random = typeof options.random === 'function'
    ? options.random
    : cleanText(options.seed) ? deterministicRandom(options.seed) : Math.random;
  const turn = Math.max(0, Number(options.turn || 0));
  const actorPlanMap = new Map((Array.isArray(options.actorPlans) ? options.actorPlans : [])
    .filter((entry) => entry?.subjectId).map((entry) => [cleanText(entry.subjectId), normalizeActorPlanReceipt(entry, { turn })]));
  return (Array.isArray(subjects) ? subjects : []).map((subject, index) => {
    const subjectRandom = cleanText(options.seed) ? deterministicRandom(`${options.seed}|${subject.id}`) : random;
    const suppliedPlan = actorPlanMap.get(cleanText(subject.id));
    const committedPlan = suppliedPlan?.phase === 'bootstrap' && suppliedPlan.subjectId === cleanText(subject.id)
      ? suppliedPlan
      : trustedCommittedActorPlan(subject);
    const frozenAttempt = cleanText(committedPlan?.attempt, cleanText(committedPlan?.nextAction));
    const actionSubject = frozenAttempt ? { ...subject, nextAction: frozenAttempt } : subject;
    const advanceMode = advanceModeFromCommittedNextAction(actionSubject);
    const intensity = choose(['low', 'low', 'medium', 'medium', 'medium', 'high'], subjectRandom);
    const feasibility = feasibleWorldResults(subject, advanceMode, intensity);
    const weightedResults = feasibility.results.flatMap((result) => result === 'partial' ? [result, result] : [result]);
    const resultEnvelope = choose(weightedResults, subjectRandom);
    const reachability = options.publicReachability?.[subject.id];
    const reachabilityEvidence = cleanText(reachability?.evidence);
    const requestedChannel = normalizePublicChannel(reachability?.publicChannel);
    const publicChannel = reachabilityEvidence ? requestedChannel : 'none';
    const userRelation = publicChannel === 'none'
      ? 'unrelated'
      : ['named_action', 'direct_consequence'].includes(publicChannel) ? 'observable_now' : 'possible_intersection';
    return {
      ticketId: cleanText(options.seed)
        ? stableWorldId('advance', options.seed, subject.id, turn)
        : stableWorldId('advance', subject.id, turn, index, Math.floor(subjectRandom() * 0xffffff)),
      subjectId: subject.id,
      actorPlanId: cleanText(committedPlan?.planId),
      attemptDirective: frozenAttempt || cleanText(subject.nextAction, cleanText(subject.goal)),
      advanceMode,
      intensity,
      feasibleResults: feasibility.results,
      feasibilityReasons: feasibility.reasons,
      resultEnvelope,
      userRelation,
      publicChannel,
      publicEvidence: publicChannel === 'none' ? '' : reachabilityEvidence,
      biasGuard: [
        '不得无因黑化、极端化、灾难化或制造不可逆升级',
        '不得无因信任玩家、免费让利、主动服务玩家或把世界重新围绕玩家运转',
        '必须服从角色卡、世界书、已接受事实、有限知识、资源、地点和时间成本',
      ],
    };
  });
}

const WORLD_FIELD_ALIASES = new Map([
  ['类型', 'type'], ['type', 'type'], ['名称', 'name'], ['名字', 'name'], ['name', 'name'],
  ['正文称谓', 'aliases'], ['称谓', 'aliases'], ['别名', 'aliases'], ['aliases', 'aliases'],
  ['稳定锚点', 'anchor'], ['锚点', 'anchor'], ['anchor', 'anchor'], ['现状', 'current'], ['当前状态', 'current'], ['current', 'current'],
  ['目标', 'goal'], ['驱动', 'goal'], ['goal', 'goal'], ['已知', 'knowledge'], ['新增已知', 'knowledge'], ['认知', 'knowledge'], ['新增认知', 'knowledge'], ['knowledge', 'knowledge'],
  ['资源', 'resources'], ['resources', 'resources'], ['约束', 'constraints'], ['限制', 'constraints'], ['constraints', 'constraints'],
  ['尝试', 'attempt'], ['行动', 'attempt'], ['attempt', 'attempt'], ['结果', 'outcome'], ['结算', 'outcome'], ['outcome', 'outcome'],
  ['代价', 'cost'], ['成本', 'cost'], ['cost', 'cost'], ['状态变化', 'stateChange'], ['真实变化', 'stateChange'], ['statechange', 'stateChange'],
  ['下一步', 'nextAction'], ['后续', 'nextAction'], ['nextaction', 'nextAction'], ['下次检查', 'nextCheckTurn'], ['再检查回合', 'nextCheckTurn'], ['nextcheckturn', 'nextCheckTurn'],
  ['状态', 'status'], ['status', 'status'], ['支线', 'threadKeys'], ['主题', 'threadKeys'], ['threadkeys', 'threadKeys'],
  ['公开影响', 'publicEffect'], ['可见影响', 'publicEffect'], ['publiceffect', 'publicEffect'], ['公开渠道', 'publicChannel'], ['publicchannel', 'publicChannel'],
  ['正文锚点', 'sourceAnchor'], ['来源锚点', 'sourceAnchor'], ['sourceanchor', 'sourceAnchor'],
]);

function worldFieldKey(value) {
  return WORLD_FIELD_ALIASES.get(cleanText(value).replace(/[\s_-]+/gu, '').toLocaleLowerCase()) || '';
}

function cleanWorldList(value, limit) {
  const rawItems = Array.isArray(value) ? value : [value];
  const nonempty = rawItems.map((entry) => cleanText(entry)).filter(Boolean);
  if (!nonempty.length || nonempty.every((entry) => /^(?:无|没有|已耗尽|已用尽|已解除|不适用|none|null|\[\])$/iu.test(entry))) return [];
  return cleanStringArray(value, limit);
}

function parseWorldBlock(body) {
  const fields = {};
  let currentKey = '';
  for (const rawLine of String(body || '').replace(/\r\n?/gu, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || /^\[\/(?:SUBJECT|主体)\]$/iu.test(line)) continue;
    const match = line.match(/^([^：:]{1,20})\s*[：:]\s*(.*)$/u);
    if (match) {
      const key = worldFieldKey(match[1]);
      if (key) {
        fields[key] = cleanText(match[2]);
        currentKey = key;
        continue;
      }
    }
    if (currentKey) fields[currentKey] = cleanText(`${fields[currentKey]}\n${line}`);
  }
  for (const key of ['aliases', 'knowledge', 'resources', 'constraints', 'threadKeys']) {
    if (fields[key] !== undefined) fields[key] = cleanWorldList(fields[key], key === 'threadKeys' ? 16 : 32);
  }
  if (fields.nextCheckTurn !== undefined) fields.nextCheckTurn = optionalInteger(String(fields.nextCheckTurn).match(/\d+/u)?.[0]);
  return fields;
}

export function parseWorldProposal(raw, options = {}) {
  const source = String(raw || '').replace(/^\s*```(?:text|markdown|md)?\s*/iu, '').replace(/\s*```\s*$/u, '').trim();
  const scheduled = Array.isArray(options.subjects) ? options.subjects : [];
  const scheduledByName = new Map();
  for (const subject of scheduled) {
    const key = cleanText(subject?.name).toLocaleLowerCase();
    if (!key) continue;
    const matches = scheduledByName.get(key) || [];
    matches.push(subject);
    scheduledByName.set(key, matches);
  }
  const markerPattern = /^\s*\[(?:(?:SUBJECT|主体)\s*[:#]?\s*)?([^\]\r\n]+)\]\s*$/gimu;
  const markers = [...source.matchAll(markerPattern)].filter((match) => {
    const id = cleanText(match[1]);
    return id && !/^\//u.test(id) && !/^(?:WORLD|世界|SUMMARY|摘要)$/iu.test(id);
  });
  const updates = [];
  const errors = [];
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const bodyStart = Number(marker.index || 0) + marker[0].length;
    const bodyEnd = index + 1 < markers.length ? Number(markers[index + 1].index || source.length) : source.length;
    const fields = parseWorldBlock(source.slice(bodyStart, bodyEnd));
    const markerId = cleanText(marker[1]).trim();
    const wantsNew = /^NEW(?:$|[-_:：#\s])/iu.test(markerId);
    const rawExcerpt = source.slice(Number(marker.index || 0), bodyEnd).slice(0, 2000);
    const discoverySignature = wantsNew
      ? stableWorldId('discovery', cleanText(fields.sourceAnchor) || cleanText(fields.name) || `${markerId}:${index}`)
      : '';
    const exactSubject = wantsNew ? null : scheduled.find((entry) => entry.id === markerId);
    const nameMatches = wantsNew || exactSubject ? [] : scheduledByName.get(markerId.toLocaleLowerCase()) || [];
    if (!wantsNew && !exactSubject && nameMatches.length > 1) {
      errors.push({ subjectId: markerId, code: 'ambiguous_subject_id', detail: `主体名称“${markerId}”同时对应多个到期主体；必须使用稳定ID，已拒绝按顺序猜测` });
      continue;
    }
    const scheduledSubject = exactSubject || (nameMatches.length === 1 ? nameMatches[0] : null);
    const subjectId = scheduledSubject?.id || (wantsNew ? discoverySignature : markerId);
    if (!wantsNew && !scheduledSubject) {
      errors.push({ subjectId, code: 'unknown_subject_id', detail: `主体块 ${markerId || index + 1} 未匹配本轮任何到期主体，已局部跳过，绝不按位置串写` });
      continue;
    }
    const meaningful = ['name', 'current', 'goal', 'attempt', 'outcome', 'stateChange', 'nextAction', 'publicEffect'].some((key) => cleanText(fields[key]));
    if (!meaningful) {
      errors.push({
        subjectId,
        discoverySignature: wantsNew && (cleanText(fields.sourceAnchor) || cleanText(fields.name)) ? discoverySignature : '',
        discoveryAnchor: wantsNew ? cleanText(fields.sourceAnchor) : '',
        discoveryName: wantsNew ? cleanText(fields.name) : '',
        code: 'empty_subject_block',
        detail: `主体块 ${markerId || index + 1} 没有可用内容`,
      });
      continue;
    }
    updates.push({ subjectId, ...fields, isNewDiscovery: wantsNew, discoverySignature, rawExcerpt });
  }
  const summary = cleanText(source.match(/^\s*(?:世界摘要|本轮摘要|summary)\s*[：:]\s*(.+)$/imu)?.[1]);
  if (!markers.length) errors.push({ subjectId: '', code: 'no_subject_blocks', detail: '模型回复中没有找到主体分块' });
  return { summary, updates, errors, raw: source };
}

export function parseActorPlan(raw, options = {}) {
  const source = String(raw || '').replace(/^\s*```(?:text|markdown|md)?\s*/iu, '').replace(/\s*```\s*$/u, '').trim();
  const subjectId = cleanText(options.subjectId, cleanText(options.subject?.id));
  const phase = cleanText(options.phase) === 'bootstrap' ? 'bootstrap' : 'next';
  const turn = Math.max(0, Number(options.turn || 0));
  const marker = source.match(/^\s*\[(?:ACTOR_PLAN|主体计划)\s*[:#]?\s*([^\]\r\n]+)\]\s*$/imu);
  if (!marker) return { ok: false, error: 'actor_plan_marker_missing', detail: '隔离主体规划没有返回绑定主体标记' };
  const returnedId = cleanText(marker[1]);
  if (!subjectId || returnedId !== subjectId) {
    return { ok: false, error: 'actor_plan_subject_mismatch', detail: `隔离主体规划返回了 ${returnedId || '空ID'}，预期 ${subjectId || '空ID'}` };
  }
  const bodyStart = Number(marker.index || 0) + marker[0].length;
  const closePattern = new RegExp(`^\\s*\\[\\/(?:ACTOR_PLAN|主体计划)\\]\\s*$`, 'imu');
  const tail = source.slice(bodyStart);
  const close = tail.match(closePattern);
  const fields = parseWorldBlock(close ? tail.slice(0, Number(close.index || 0)) : tail);
  const attempt = cleanText(fields.attempt);
  const nextAction = cleanText(fields.nextAction);
  const nextCheckTurn = Math.max(0, optionalInteger(fields.nextCheckTurn) ?? 0);
  if (phase === 'bootstrap' && !attempt) {
    return { ok: false, error: 'actor_plan_attempt_missing', detail: '隔离主体bootstrap没有形成具体本轮尝试' };
  }
  if (phase === 'next' && (!nextAction || nextCheckTurn <= turn)) {
    return { ok: false, error: 'actor_plan_next_missing', detail: '隔离主体没有形成具体下一步或大于本轮的检查回合' };
  }
  const ticketId = cleanText(options.ticketId);
  const basedOnAttempt = cleanText(options.basedOnAttempt);
  const plan = normalizeActorPlanReceipt({
    planId: stableWorldId('actor-plan', cleanText(options.sourceKey), subjectId, phase, ticketId, basedOnAttempt, attempt, nextAction, nextCheckTurn),
    subjectId,
    phase,
    attempt,
    goal: cleanText(fields.goal),
    knowledge: cleanStringArray(fields.knowledge, 32),
    nextAction,
    nextCheckTurn,
      basedOnTicketId: ticketId,
      basedOnAttempt,
      basedOnAdjudicationDigest: cleanText(options.adjudicationDigest),
    plannedTurn: turn,
    sourceKey: cleanText(options.sourceKey),
    at: cleanText(options.at, new Date().toISOString()),
  }, { subjectId, turn, sourceKey: options.sourceKey, at: options.at });
  return { ok: true, plan, raw: source };
}

function mergeExplicitText(previous, update, key) {
  return Object.prototype.hasOwnProperty.call(update, key) && cleanText(update[key]) ? cleanText(update[key]) : previous;
}

function mergeExplicitList(previous, update, key, limit) {
  return Object.prototype.hasOwnProperty.call(update, key)
    ? cleanWorldList(update[key], limit)
    : previous;
}

function concreteWorldUpdate(update, ticket) {
  const attempt = cleanText(update.attempt);
  const outcome = cleanText(update.outcome);
  let stateChange = cleanText(update.stateChange);
  const resultType = normalizeResultType(ticket?.resultEnvelope || update.resultType || update.status);
  if (!stateChange && outcome) stateChange = ['blocked', 'delayed', 'waiting'].includes(resultType) ? `尚未完成：${outcome}` : outcome;
  const concrete = Boolean(attempt && (outcome || stateChange));
  return { concrete, attempt, outcome, stateChange, resultType };
}

export function worldAdjudicationDigest(update = {}) {
  return stableWorldId('adjudication', JSON.stringify({
    attempt: cleanText(update.attempt),
    outcome: cleanText(update.outcome),
    cost: cleanText(update.cost),
    stateChange: cleanText(update.stateChange),
    current: cleanText(update.current),
    resources: cleanWorldList(update.resources, 24),
    constraints: cleanWorldList(update.constraints, 24),
  }));
}

function completionClaimSupported(update, settlement) {
  if (settlement.resultType !== 'success') return false;
  const evidence = `${cleanText(update.outcome)}\n${cleanText(update.stateChange)}\n${cleanText(update.current)}`;
  if (/(?:尚未|仍未|还未|没有|并未|未能|无法|不能|尚不能).{0,20}(?:完成|达成|解决|终结|关闭|兑现)|(?:只|仅|只是|仅仅).{0,16}(?:完成|达成|解决).{0,16}(?:准备|前置|局部|部分|阶段|一步)|(?:完成|达成).{0,12}(?:准备|前置工作|阶段性工作)/u.test(evidence)) return false;
  return /(?:总目标|整体目标|全部目标|整个任务|全部任务|整项计划|整个过程|整座工程).{0,24}(?:已经|已|彻底|全部|正式)?(?:完成|达成|解决|终结|关闭|兑现)|(?:彻底|全部|整体|正式).{0,12}(?:完成|达成|解决|终结|关闭|兑现).{0,20}(?:目标|任务|计划|过程|危机|工程|调查|交易|谈判|行动)|(?:目标|任务|计划|过程|危机|工程|调查|交易|谈判|行动).{0,20}(?:已经|已)(?:全部|彻底|正式)?(?:完成|达成|解决|终结|关闭|兑现)/u.test(evidence);
}

function actionFollowsDirective(attempt, directive) {
  const actual = cleanText(attempt);
  const expected = cleanText(directive);
  if (!expected) return true;
  if (!actual) return false;
  if (actual.includes(expected) || expected.includes(actual)) return true;
  const meaningfulLength = expected.replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, '').length;
  const required = Math.max(2, Math.min(10, Math.ceil(Math.max(1, meaningfulLength - 1) * 0.55)));
  return sharedCjkBigrams(actual, expected) >= required;
}

function settlementEnvelopeConflict(settlement, update) {
  const evidence = [update.outcome, update.stateChange, update.current].map((value) => cleanText(value)).filter(Boolean).join('；');
  if (settlement.resultType === 'success') {
    return /^(?:未能|无法|失败|受阻|没有成功)|(?:本轮|本次|这一步|该行动|尝试|行动).{0,18}(?:未能|无法|失败|受阻|没有成功)/u.test(evidence);
  }
  if (settlement.resultType === 'partial') {
    const wholeCompletion = /(?:总目标|整体目标|全部目标|整个任务|全部任务|整项计划|整个过程|整座工程|所有阶段).{0,24}(?:已经|已|彻底|全部|完全|正式)?(?:完成|达成|解决|终结|关闭|兑现)|(?:彻底|全部|整体|完全).{0,12}(?:完成|达成|解决|终结|关闭|兑现).{0,20}(?:目标|任务|计划|过程|危机|工程|调查|交易|谈判|行动|阶段)/u.test(evidence);
    if (wholeCompletion) return true;
    const stateChange = cleanText(update.stateChange);
    const noProgress = !stateChange
      || /^(?:尚未完成[:：]?|未能|无法|失败|受阻|没有成功|没有变化|毫无进展|零进展|保持原状|仍然原样|依旧原样)/u.test(stateChange)
      || /(?:没有|未|毫无|零).{0,8}(?:实际|有效|任何)?(?:推进|进展|变化|成果)/u.test(stateChange)
      || /(?:完全|彻底)?(?:失败|受阻).{0,16}(?:保持原状|没有变化|毫无进展|零进展)/u.test(stateChange);
    if (noProgress) return true;
  }
  if (['blocked', 'delayed', 'waiting'].includes(settlement.resultType)) {
    return /(?:本轮|本次|这一步|该行动|尝试|行动).{0,18}(?:已经|已|彻底|完全)?(?:成功完成|全部完成|达成目标|彻底成功)|(?:总目标|整体目标|全部目标).{0,16}(?:已经|已)?(?:完成|达成)/u.test(evidence);
  }
  return false;
}

function privateWorldFragments(subject = {}) {
  const fragments = [];
  const add = (field, value) => {
    for (const item of (Array.isArray(value) ? value : [value])) {
      const text = cleanText(item);
      if (!text) continue;
      const candidates = [text, ...text.split(/[；;。！!？?，,、\n]/u).map((entry) => cleanText(entry))];
      for (const candidate of candidates) {
        if (candidate.length < 5 || /^(?:正常|稳定|活跃|等待|未知|无|没有|进行中|已完成|受阻)$/u.test(candidate)) continue;
        fragments.push({ field, text: candidate });
      }
    }
  };
  add('current', subject.current);
  add('resources', subject.resources);
  add('constraints', subject.constraints);
  add('threadKeys', subject.threadKeys);
  return fragments;
}

function privateWorldHistoryFragments(history = []) {
  const fragments = [];
  const add = (field, value) => {
    const text = cleanText(value);
    if (!text) return;
    const candidates = [text, ...text.split(/[；;。！!？?，,、\n]/u).map((entry) => cleanText(entry))];
    for (const candidate of candidates) {
      if (candidate.length < 5 || /^(?:正常|稳定|活跃|等待|未知|无|没有|进行中|已完成|受阻)$/u.test(candidate)) continue;
      fragments.push({ field, text: candidate });
    }
  };
  for (const entry of Array.isArray(history) ? history : []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const field of ['attempt', 'outcome', 'cost', 'stateChange']) add(`history.${field}`, entry[field]);
  }
  return fragments;
}

export function sanitizeWorldAdjudication(updateInput = {}, subject = {}, options = {}) {
  const update = deepClone(updateInput && typeof updateInput === 'object' ? updateInput : {});
  const subjectId = cleanText(subject.id);
  const subjects = Array.isArray(options.subjects) ? options.subjects : [];
  const publicEvidence = [options.acceptedText, options.publicEvidence, options.knowledgeEvidence]
    .map((value) => typeof value === 'string' ? value : JSON.stringify(value || ''))
    .join('\n');
  const subjectHistories = options.subjectHistories && typeof options.subjectHistories === 'object'
    ? options.subjectHistories
    : {};
  const historyFor = (id) => Object.prototype.hasOwnProperty.call(subjectHistories, id) && Array.isArray(subjectHistories[id])
    ? subjectHistories[id]
    : [];
  const ownPrivate = [
    cleanText(update.attempt),
    subject.current,
    ...(subject.resources || []),
    ...(subject.constraints || []),
    ...(subject.threadKeys || []),
    ...privateWorldHistoryFragments(historyFor(subjectId)).map((fragment) => fragment.text),
  ]
    .map((value) => cleanText(value)).filter(Boolean).join('\n');
  const forbidden = [];
  for (const other of subjects) {
    if (!other || cleanText(other.id) === subjectId) continue;
    const otherFragments = [
      ...privateWorldFragments(other),
      ...privateWorldHistoryFragments(historyFor(cleanText(other.id))),
    ];
    for (const fragment of otherFragments) {
      if (ownPrivate.includes(fragment.text) || publicEvidence.includes(fragment.text)) continue;
      forbidden.push({ ownerId: cleanText(other.id), ...fragment });
    }
  }
  const contaminatedFields = [];
  for (const field of ['outcome', 'cost', 'stateChange', 'current', 'publicEffect']) {
    const text = cleanText(update[field]);
    const leak = text && forbidden.find((fragment) => text.includes(fragment.text));
    if (leak) contaminatedFields.push({ field, ...leak });
  }
  for (const field of ['resources', 'constraints']) {
    for (const item of cleanWorldList(update[field], field === 'resources' ? 24 : 24)) {
      const leak = forbidden.find((fragment) => item.includes(fragment.text));
      if (leak) contaminatedFields.push({ field, ...leak });
    }
  }
  if (contaminatedFields.length) {
    return {
      ok: false,
      code: 'cross_subject_private_leak',
      detail: `全局裁决块把其他主体的私密片段写入 ${[...new Set(contaminatedFields.map((entry) => entry.field))].join('、')}；该主体块已局部拒绝，未交给后续规划器`,
      update: null,
      stripped: [],
    };
  }
  const stripped = [];
  for (const field of ['goal', 'knowledge', 'nextAction', 'nextCheckTurn']) {
    if (!Object.prototype.hasOwnProperty.call(update, field)) continue;
    delete update[field];
    stripped.push({ code: 'adjudicator_owned_field_removed', field });
  }
  const existingThreadKeys = cleanStringArray(subject.threadKeys, 16);
  const proposedThreadKeys = cleanWorldList(update.threadKeys, 16);
  const ownResultEvidence = [update.outcome, update.stateChange, update.current, update.publicEffect].map((value) => cleanText(value)).join('\n');
  const acceptedThreadKeys = [];
  for (const key of proposedThreadKeys) {
    if (existingThreadKeys.includes(key)) continue;
    const privateLeak = forbidden.find((fragment) => fragment.field === 'threadKeys' && (key.includes(fragment.text) || fragment.text.includes(key)));
    const exactEvidence = `${publicEvidence}\n${ownResultEvidence}`.includes(key);
    if (privateLeak || !exactEvidence) {
      stripped.push({ code: privateLeak ? 'cross_subject_thread_key_removed' : 'unproven_thread_key_removed', field: 'threadKeys', value: key });
      continue;
    }
    acceptedThreadKeys.push(key);
  }
  update.threadKeys = cleanStringArray([...existingThreadKeys, ...acceptedThreadKeys], 16);
  update.subjectId = subjectId || cleanText(update.subjectId);
  return { ok: true, update, stripped };
}

export function validateWorldAdjudication(update = {}, ticket = {}, options = {}) {
  const settlement = concreteWorldUpdate(update, ticket);
  if (!settlement.concrete) return { ok: false, code: 'no_concrete_settlement', detail: '主体块没有同时说明具体尝试与结果/变化' };
  if (cleanText(ticket.attemptDirective) && settlement.attempt !== cleanText(ticket.attemptDirective)) {
    return { ok: false, code: 'attempt_exact_mismatch', detail: '全局裁决器改写了脚本冻结的主体attempt' };
  }
  if (cleanText(ticket.attemptDirective) && !actionFollowsDirective(settlement.attempt, ticket.attemptDirective)) {
    return { ok: false, code: 'attempt_directive_mismatch', detail: '主体尝试没有执行本轮冻结行动' };
  }
  if (!options.observationOnly && settlementEnvelopeConflict(settlement, update)) {
    return { ok: false, code: 'result_envelope_conflict', detail: `主体文字结算与本地票据的${settlement.resultType}方向明确冲突` };
  }
  return { ok: true, settlement };
}

function boundNextActorPlan(planInput, ticket, subject, turn, adjudication) {
  const plan = normalizeActorPlanReceipt(planInput, { subjectId: subject?.id, turn });
  if (!plan) return { ok: false, code: 'actor_plan_missing', detail: '世界裁决后没有收到该主体自己的隔离下一计划' };
  if (plan.phase !== 'next' || plan.subjectId !== subject.id) {
    return { ok: false, code: 'actor_plan_subject_mismatch', detail: '隔离下一计划没有绑定到当前稳定主体' };
  }
  if (!ticket?.ticketId || !ticket?.actorPlanId || plan.basedOnTicketId !== ticket.ticketId
    || plan.basedOnAttempt !== cleanText(ticket.attemptDirective)) {
    return { ok: false, code: 'actor_plan_receipt_mismatch', detail: '隔离下一计划没有绑定本轮冻结ticket与逐字attempt' };
  }
  if (!plan.basedOnAdjudicationDigest || plan.basedOnAdjudicationDigest !== worldAdjudicationDigest(adjudication)) {
    return { ok: false, code: 'actor_plan_adjudication_mismatch', detail: '隔离下一计划没有绑定本轮实际裁决内容，不能复用其他结果生成的旧计划' };
  }
  if (!plan.nextAction || plan.nextCheckTurn <= turn) {
    return { ok: false, code: 'actor_plan_next_missing', detail: '隔离下一计划缺少具体下一步或大于本轮的检查回合' };
  }
  return { ok: true, plan };
}

export function applyWorldProposal(previousInput, proposalInput, options = {}) {
  const previous = normalizeWorldState(previousInput, { chatId: options.chatId || previousInput?.chatId });
  const proposal = proposalInput && typeof proposalInput === 'object' ? proposalInput : { updates: [], errors: [] };
  const requestedTurn = Number(options.turn || 0);
  const turn = options.sameTurn
    ? Math.max(previous.turn, requestedTurn)
    : Math.max(previous.turn + 1, requestedTurn);
  const now = cleanText(options.at, new Date().toISOString());
  const source = normalizeWorldSource(options.source, { chatId: previous.chatId, messageId: options.messageId, sourceKey: options.sourceKey, excerpt: options.acceptedText, at: now });
  const ticketMap = new Map((Array.isArray(options.tickets) ? options.tickets : []).map((entry) => [entry.subjectId, entry]));
  const actorPlanMap = new Map((Array.isArray(options.actorPlans) ? options.actorPlans : [])
    .filter((entry) => entry?.subjectId).map((entry) => [cleanText(entry.subjectId), entry]));
  const requireActorPlans = Boolean(options.requireActorPlans);
  const scheduledIds = new Set((Array.isArray(options.scheduledSubjects) ? options.scheduledSubjects : []).map((entry) => entry.id));
  const world = deepClone(previous);
  const subjectIndex = new Map(world.subjects.map((entry, index) => [entry.id, index]));
  const byName = new Map();
  for (const [index, entry] of world.subjects.entries()) {
    const key = entry.name.toLocaleLowerCase();
    const indexes = byName.get(key) || [];
    indexes.push(index);
    byName.set(key, indexes);
  }
  const applied = [];
  const appliedSet = new Set();
  const skipped = [];
  const profileDiscoveries = [];
  const resolvedDiscoverySignatures = new Set();

  for (const proposalUpdate of Array.isArray(proposal.updates) ? proposal.updates : []) {
    let rawUpdate = proposalUpdate;
    const requestedId = cleanText(rawUpdate.subjectId);
    const discoverySignature = cleanText(rawUpdate.discoverySignature);
    const discoveryFailure = (code, detail) => ({
      subjectId: discoverySignature || requestedId,
      discoverySignature,
      discoveryAnchor: cleanText(rawUpdate.sourceAnchor),
      discoveryName: cleanText(rawUpdate.name),
      code,
      detail,
    });
    let index = subjectIndex.get(requestedId);
    if (index === undefined && requestedId) {
      const matches = byName.get(requestedId.toLocaleLowerCase()) || [];
      if (matches.length > 1) {
        skipped.push({ subjectId: requestedId, code: 'ambiguous_subject_id', detail: `主体名称“${requestedId}”对应多个稳定主体；必须使用稳定ID，未写入任何一个主体` });
        continue;
      }
      if (matches.length === 1) index = matches[0];
    }
    let subject = index === undefined ? null : world.subjects[index];
    let subjectWasNew = false;
    if (subject && rawUpdate.isNewDiscovery) {
      const sameDiscovery = discoverySignature && subject.discoverySignature === discoverySignature;
      if (sameDiscovery) {
        resolvedDiscoverySignatures.add(discoverySignature);
        continue;
      }
      skipped.push(discoveryFailure('duplicate_new_subject', `NEW主体稳定ID“${subject.id}”已经存在且不属于本次发现签名；未重复创建或覆盖`));
      continue;
    }
    if (!subject) {
      const newType = explicitSubjectType(rawUpdate.type);
      if (!newType) {
        skipped.push(discoveryFailure('new_subject_type_required', 'NEW主体必须显式填写有效类型（faction或process；人物需转交人物医师），该块未写入世界权威'));
        continue;
      }
      if (newType === 'person') {
        const discoveryName = cleanText(rawUpdate.name);
        const acceptedNarrative = cleanText(options.acceptedText);
        const sourceAnchor = cleanText(rawUpdate.sourceAnchor);
        if (sourceAnchor.length < 3 || !acceptedNarrative.includes(sourceAnchor)) {
          skipped.push(discoveryFailure('new_subject_missing_accepted_anchor', 'NEW人物发现也必须提供最终接受正文中的逐字“正文锚点”；仅名称命中不能触发人物补档'));
          continue;
        }
        const exactNarrativeNames = cleanStringArray([discoveryName, ...(Array.isArray(rawUpdate.aliases) ? rawUpdate.aliases : [])], 12)
          .filter((name) => name.length >= 2 && acceptedNarrative.includes(name));
        if (!exactNarrativeNames.length && sourceAnchor.length >= 2 && sourceAnchor.length <= 32
          && !/[。！？!?，,；;：:\n]/u.test(sourceAnchor) && acceptedNarrative.includes(sourceAnchor)) exactNarrativeNames.push(sourceAnchor);
        if (discoveryName && exactNarrativeNames.length) {
          profileDiscoveries.push({
            label: discoveryName,
            names: cleanStringArray([discoveryName, ...exactNarrativeNames], 12),
            evidence: sourceAnchor.slice(0, 1200),
            code: 'new_person_requires_profile',
          });
        }
        skipped.push(discoveryFailure(
          'new_person_requires_profile',
          exactNarrativeNames.length
            ? '世界引擎不能创建没有完整人物档案的新人物；正文逐字称谓已转交人物医师'
            : '世界引擎提出了新人物，但没有提供正文逐字名称、正文称谓或稳定短锚点；已拒绝并等待定向重试',
        ));
        continue;
      }
      const discoveryName = cleanText(rawUpdate.name);
      const acceptedNarrative = cleanText(options.acceptedText);
      const sourceAnchor = cleanText(rawUpdate.sourceAnchor);
      const quotedSourceAnchor = sourceAnchor.length >= 3 && acceptedNarrative.includes(sourceAnchor);
      if (!discoveryName || !quotedSourceAnchor) {
        skipped.push(discoveryFailure(
          'new_subject_missing_accepted_anchor',
          'NEW势力或过程必须提供最终接受正文中的逐字“正文锚点”；名称命中不能替代正文证据，已拒绝无因增殖',
        ));
        continue;
      }
      if (!cleanText(rawUpdate.name)) {
        skipped.push(discoveryFailure('new_subject_incomplete', '新主体缺少名称，已跳过该块'));
        continue;
      }
      const duplicateIndexes = byName.get(cleanText(rawUpdate.name).toLocaleLowerCase()) || [];
      if (duplicateIndexes.length) {
        const duplicate = world.subjects[duplicateIndexes[0]];
        const sameDiscovery = discoverySignature && duplicate.discoverySignature === discoverySignature;
        if (sameDiscovery) {
          resolvedDiscoverySignatures.add(discoverySignature);
          continue;
        }
        skipped.push(discoveryFailure('duplicate_new_subject', `NEW主体名称“${duplicate.name}”已经存在；请使用现有稳定ID更新，未重复创建或伪造变化`));
        continue;
      }
      const discoveryShell = Boolean(rawUpdate.isNewDiscovery || requireActorPlans);
      const discoveredFields = discoveryShell
        ? {
          type: newType,
          name: discoveryName,
          anchor: sourceAnchor,
          current: sourceAnchor,
          goal: '',
          knowledge: [],
          resources: [],
          constraints: [],
          threadKeys: [],
          publicEffect: '',
          publicChannel: 'none',
          nextAction: '',
          nextCheckTurn: turn + 1,
          status: 'waiting',
          planReceipt: null,
          discoverySignature,
        }
        : rawUpdate;
      subject = normalizeSubject({ ...discoveredFields, type: newType, id: requestedId || undefined, createdTurn: turn, updatedTurn: turn, nextCheckTurn: turn + 1, source }, world.subjects.length, { chatId: previous.chatId, turn, at: now });
      subjectWasNew = true;
      if (subjectIndex.has(subject.id)) {
        skipped.push(discoveryFailure('duplicate_new_subject', `NEW主体稳定ID“${subject.id}”已经存在；请使用现有稳定ID更新，未重复创建或伪造变化`));
        continue;
      }
      index = world.subjects.length;
      world.subjects.push(subject);
      subjectIndex.set(subject.id, index);
      const nameIndexes = byName.get(subject.name.toLocaleLowerCase()) || [];
      nameIndexes.push(index);
      byName.set(subject.name.toLocaleLowerCase(), nameIndexes);
      if (discoveryShell) {
        applied.push(subject.id);
        appliedSet.add(subject.id);
        if (discoverySignature) resolvedDiscoverySignatures.add(discoverySignature);
        continue;
      }
    }
    const ticket = ticketMap.get(subject.id);
    const observationOnly = Boolean(ticket?.observationOnly || ticket?.advanceMode === 'accepted_observation');
    if (scheduledIds.has(subject.id) && requireActorPlans && !observationOnly) {
      const sanitized = sanitizeWorldAdjudication(rawUpdate, subject, {
        subjects: previous.subjects,
        subjectHistories: options.subjectHistories,
        acceptedText: options.acceptedText,
        publicEvidence: options.publicEvidence?.[subject.id],
        knowledgeEvidence: options.knowledgeEvidence?.[subject.id],
      });
      if (!sanitized.ok) {
        skipped.push({ subjectId: subject.id, code: sanitized.code, detail: sanitized.detail });
        continue;
      }
      rawUpdate = sanitized.update;
      for (const item of sanitized.stripped || []) {
        skipped.push({
          subjectId: subject.id,
          code: item.code,
          detail: item.field === 'threadKeys'
            ? `全局裁决返回的支线键“${cleanText(item.value)}”没有本主体或公开证据；已局部剥离，既有支线键保持不变`
            : `全局裁决无权写入 ${item.field}；该字段已剥离并由主体隔离规划器独占`,
        });
      }
    }
    const settlement = concreteWorldUpdate(rawUpdate, ticket);
    let boundPlan = null;
    if (scheduledIds.has(subject.id) && !settlement.concrete) {
      skipped.push({ subjectId: subject.id, code: 'no_concrete_settlement', detail: '主体块没有同时说明具体尝试与结果/变化，旧状态已保留并等待重试' });
      continue;
    }
    if (scheduledIds.has(subject.id) && !observationOnly && requireActorPlans) {
      if (!ticket?.actorPlanId || !cleanText(ticket?.attemptDirective)) {
        skipped.push({ subjectId: subject.id, code: 'actor_plan_missing', detail: '本轮没有该主体独立生成并冻结的行动计划；该主体保持原状，其他主体仍可提交' });
        continue;
      }
      if (settlement.attempt !== cleanText(ticket.attemptDirective)) {
        skipped.push({ subjectId: subject.id, code: 'attempt_exact_mismatch', detail: '全局裁决器改写了脚本冻结的主体attempt；该主体局部拒绝，不能用近义词匹配放行' });
        continue;
      }
      const binding = boundNextActorPlan(actorPlanMap.get(subject.id), ticket, subject, turn, rawUpdate);
      if (!binding.ok) {
        skipped.push({ subjectId: subject.id, code: binding.code, detail: `${binding.detail}；该主体保持原状，其他主体仍可提交` });
        continue;
      }
      boundPlan = binding.plan;
    }
    if (scheduledIds.has(subject.id) && !(ticket?.observationOnly || ticket?.advanceMode === 'accepted_observation')
      && settlementEnvelopeConflict(settlement, rawUpdate)) {
      skipped.push({
        subjectId: subject.id,
        code: 'result_envelope_conflict',
        detail: `主体文字结算与本地票据的${settlement.resultType}方向明确冲突；旧状态已保留，只重试该主体`,
      });
      continue;
    }
    const observationAnchor = cleanText(rawUpdate.sourceAnchor, cleanText(ticket?.acceptedAnchor));
    const observationEvidence = [rawUpdate.current, rawUpdate.outcome, rawUpdate.stateChange]
      .map((value) => cleanText(value)).filter(Boolean).join('；');
    if (scheduledIds.has(subject.id) && observationOnly
      && (!observationAnchor || !cleanText(options.acceptedText).includes(observationAnchor)
        || sharedCjkBigrams(observationAnchor, observationEvidence) < 2)) {
      skipped.push({
        subjectId: subject.id,
        code: 'accepted_observation_unproven',
        detail: '既有主体的正文事实调和缺少逐字正文锚点，或锚点与状态变化不是同一事实；旧状态保留并只重试该主体',
      });
      continue;
    }
    if (scheduledIds.has(subject.id) && !observationOnly && !actionFollowsDirective(settlement.attempt, ticket?.attemptDirective)) {
      skipped.push({
        subjectId: subject.id,
        code: 'attempt_directive_mismatch',
        detail: `主体尝试没有执行本轮已绑定的下一步“${cleanText(ticket?.attemptDirective)}”；旧状态已保留，只重试该主体，结算票据没有被反编行动消费`,
      });
      continue;
    }
    const proposedNextAction = boundPlan ? cleanText(boundPlan.nextAction) : cleanText(rawUpdate.nextAction);
    const proposedNextTurn = boundPlan ? optionalInteger(boundPlan.nextCheckTurn) : optionalInteger(rawUpdate.nextCheckTurn);
    const requestedStatus = rawUpdate.status ? normalizeSubjectStatus(rawUpdate.status) : subject.status;
    const supportedCompletion = requestedStatus === 'done' && completionClaimSupported(rawUpdate, settlement);
    if (scheduledIds.has(subject.id) && !observationOnly && !supportedCompletion
      && (!proposedNextAction || !proposedNextTurn || proposedNextTurn <= turn)) {
      skipped.push({
        subjectId: subject.id,
        code: 'next_action_missing',
        detail: '主体推进没有给出结算后的具体下一步和大于本轮的检查回合；旧状态已保留，只重试该主体',
      });
      continue;
    }
    if (scheduledIds.has(subject.id) && !observationOnly && !supportedCompletion && ['success', 'partial'].includes(settlement.resultType)
      && actionFollowsDirective(proposedNextAction, ticket?.attemptDirective)) {
      skipped.push({
        subjectId: subject.id,
        code: 'next_action_repeats_completed_step',
        detail: '主体本轮已成功或部分完成行动，但下一步仍重复同一行动；旧状态已保留，需给出基于结算的新一步',
      });
      continue;
    }
    const merged = deepClone(subject);
    // Stable identity belongs to the profile/subject creation chain. A single
    // world proposal may change state, knowledge and resources, never identity.
    merged.type = subject.type;
    merged.name = subject.name;
    merged.profileId = subject.profileId;
    merged.anchor = subject.anchor;
    merged.goal = observationOnly || (requireActorPlans && subjectWasNew)
      ? subject.goal
      : boundPlan ? cleanText(boundPlan.goal, subject.goal) : mergeExplicitText(merged.goal, rawUpdate, 'goal');
    const priorKnowledge = subjectWasNew ? [] : cleanStringArray(subject.knowledge, 32);
    const proposedKnowledge = boundPlan
      ? cleanStringArray(boundPlan.knowledge, 32)
      : requireActorPlans && subjectWasNew ? []
        : Object.prototype.hasOwnProperty.call(rawUpdate, 'knowledge')
          ? cleanStringArray(rawUpdate.knowledge, 32)
          : [];
    if (proposedKnowledge.length) {
      const priorKnowledgeSet = new Set(priorKnowledge.map((entry) => JSON.stringify(entry)));
      const observedThisTurn = ticket?.advanceMode === 'observe'
        && ['success', 'partial'].includes(settlement.resultType)
        ? `${subject.name}经本轮调查亲历记录得知：${cleanText(rawUpdate.outcome)}；${cleanText(rawUpdate.stateChange)}`
        : '';
      const ownEvidence = [
        `${subject.name}经自身既有记录得知：${cleanText(subject.current)}；${priorKnowledge.join('；')}`,
        cleanText(options.knowledgeEvidence?.[subject.id]),
        observedThisTurn,
      ].filter(Boolean).join('。');
      const acceptedEvidence = boundPlan ? '' : cleanText(options.acceptedText);
      const newKnowledge = proposedKnowledge.filter((entry) => !priorKnowledgeSet.has(JSON.stringify(entry)));
      const reachable = newKnowledge.filter((entry) => knowledgeEntryHasReachableSource(entry, { name: subject.name, aliases: [] }, `${ownEvidence}；${acceptedEvidence}`));
      const rejectedKnowledge = newKnowledge.filter((entry) => !reachable.includes(entry));
      merged.knowledge = cleanStringArray([...priorKnowledge, ...reachable], 32);
      if (rejectedKnowledge.length) {
        skipped.push({
          subjectId: subject.id,
          code: 'knowledge_source_unreachable',
          detail: `主体新增知识缺少可核对的亲历、获告知、调查、公开资料或自身行动结果来源；已只拒绝知识字段并保留其他有效推进：${rejectedKnowledge.slice(0, 3).join('；')}`,
        });
      }
    } else merged.knowledge = priorKnowledge;
    merged.resources = mergeExplicitList(merged.resources, rawUpdate, 'resources', 24);
    merged.constraints = mergeExplicitList(merged.constraints, rawUpdate, 'constraints', 24);
    merged.threadKeys = observationOnly ? subject.threadKeys : mergeExplicitList(merged.threadKeys, rawUpdate, 'threadKeys', 16);
    merged.current = cleanText(rawUpdate.current, settlement.stateChange || merged.current);
    merged.nextAction = observationOnly || (requireActorPlans && subjectWasNew)
      ? subject.nextAction
      : boundPlan ? boundPlan.nextAction : mergeExplicitText(merged.nextAction, rawUpdate, 'nextAction');
    merged.status = observationOnly ? subject.status : requireActorPlans && subjectWasNew ? 'waiting' : ['blocked', 'delayed', 'waiting'].includes(settlement.resultType)
      ? 'waiting'
      : supportedCompletion ? 'done' : 'active';
    const interval = ticket?.advanceMode === 'wait_condition' ? 2 : ticket?.intensity === 'high' ? 2 : 1;
    const requestedNext = boundPlan ? optionalInteger(boundPlan.nextCheckTurn) : optionalInteger(rawUpdate.nextCheckTurn);
    merged.nextCheckTurn = observationOnly ? subject.nextCheckTurn : requireActorPlans && subjectWasNew
      ? turn + 1
      : Math.max(turn + 1, Math.min(turn + 12, requestedNext && requestedNext > turn ? requestedNext : turn + interval));
    merged.lastAdvancedTurn = observationOnly ? subject.lastAdvancedTurn : turn;
    merged.updatedTurn = turn;
    merged.silenceTurns = 0;
    merged.recentModes = cleanStringArray([...(merged.recentModes || []), ticket?.advanceMode || 'model_update'], 8).slice(-8);
    merged.planReceipt = boundPlan || (requireActorPlans && subjectWasNew ? null : merged.planReceipt);
    const proposedPublic = observationOnly ? '' : cleanText(rawUpdate.publicEffect);
    const ticketChannel = normalizePublicChannel(ticket?.publicChannel || rawUpdate.publicChannel);
    const projectionIssue = publicProjectionIssue(proposedPublic, ticketChannel, subject);
    let changePublicEffect = '';
    let changePublicChannel = 'none';
    const changeId = settlement.concrete
      ? stableWorldId('change', subject.id, turn, source.sourceKey, settlement.attempt, settlement.stateChange)
      : '';
    if (proposedPublic && ticketChannel !== 'none' && !projectionIssue) {
      merged.publicEffect = proposedPublic;
      merged.publicChannel = ticketChannel;
      merged.publicEffectTurn = turn;
      merged.publicEffectSourceChangeId = changeId;
      merged.offeredTurn = 0;
      merged.lastOfferedTurn = 0;
      merged.lastOfferedSourceKey = '';
      merged.offerCount = 0;
      merged.shownTurn = subjectWasNew && publicEffectAppears(proposedPublic, cleanText(options.acceptedText), { ...merged, publicChannel: ticketChannel }) ? turn : 0;
      changePublicEffect = proposedPublic;
      changePublicChannel = ticketChannel;
    } else {
      if (proposedPublic) skipped.push({ subjectId: subject.id, code: 'private_leak_removed', detail: `公开影响不符合 ${ticketChannel} 渠道（${projectionIssue || 'ticket未允许公开'}）；只清空公开字段，私密推进仍已保留` });
      merged.publicEffect = '';
      merged.publicChannel = 'none';
      merged.publicEffectTurn = 0;
      merged.publicEffectSourceChangeId = '';
      merged.offeredTurn = 0;
      merged.lastOfferedTurn = 0;
      merged.lastOfferedSourceKey = '';
      merged.offerCount = 0;
      merged.shownTurn = 0;
    }
    merged.source = source;
    world.subjects[index] = normalizeSubject(merged, index, { chatId: previous.chatId, turn, at: now });

    if (settlement.concrete) {
      const change = normalizeChange({
        id: changeId,
        subjectIds: [subject.id], threadKeys: world.subjects[index].threadKeys,
        turn, mode: observationOnly ? 'accepted_observation' : ticket?.advanceMode || 'model_update', resultType: settlement.resultType,
        attempt: settlement.attempt, outcome: settlement.outcome, cost: rawUpdate.cost,
        stateChange: settlement.stateChange,
        publicEffect: changePublicEffect,
        publicChannel: changePublicChannel,
        shownTurn: subjectWasNew && changePublicEffect && publicEffectAppears(changePublicEffect, cleanText(options.acceptedText), { ...merged, publicChannel: changePublicChannel }) ? turn : 0,
        source, at: now,
      }, world.changes.length, { chatId: previous.chatId, turn, at: now, subject: world.subjects[index] });
      world.changes.push(change);
    }
    applied.push(subject.id);
    appliedSet.add(subject.id);
  }

  for (const subject of world.subjects) {
    if (scheduledIds.has(subject.id) && !appliedSet.has(subject.id)) subject.silenceTurns = Math.max(0, subject.silenceTurns) + 1;
  }
  const parserErrors = (Array.isArray(proposal.errors) ? proposal.errors : []).map((entry) => ({
    subjectId: cleanText(entry.subjectId), code: cleanText(entry.code, 'parse_error'), detail: cleanText(entry.detail), turn, at: now, sourceKey: source.sourceKey,
    discoverySignature: cleanText(entry.discoverySignature),
    discoveryAnchor: cleanText(entry.discoveryAnchor),
    discoveryName: cleanText(entry.discoveryName),
  }));
  const failedSubjectIds = new Set([...parserErrors, ...skipped].map((entry) => cleanText(entry.subjectId)).filter(Boolean));
  for (const subjectId of scheduledIds) {
    if (!appliedSet.has(subjectId) && !failedSubjectIds.has(subjectId)) {
      skipped.push({ subjectId, code: 'missing_subject_block', detail: '本轮到期主体没有收到对应分块，旧状态已保留并等待只重试该主体' });
    }
  }
  const previousReceipt = (previous.receipts || []).find((entry) => entry.sourceKey === source.sourceKey);
  const discoveryFailures = [...parserErrors, ...skipped]
    .map((entry) => cleanText(entry.discoverySignature))
    .filter(Boolean);
  const unresolvedDiscoveries = [...new Set([
    ...(previousReceipt?.unresolvedDiscoveries || []),
    ...discoveryFailures,
  ])].filter((signature) => !resolvedDiscoverySignatures.has(signature));
  const clearDiscoverySourceFailures = scheduledIds.size === 0 && parserErrors.length === 0 && skipped.length === 0
    && unresolvedDiscoveries.length === 0;
  const retainedFailures = world.failures.filter((entry) => !(entry.sourceKey === source.sourceKey
    && (appliedSet.has(entry.subjectId) || resolvedDiscoverySignatures.has(cleanText(entry.discoverySignature)) || clearDiscoverySourceFailures)));
  world.failures = [
    ...retainedFailures,
    ...parserErrors,
    ...skipped.map((entry) => ({ ...entry, turn, at: now, sourceKey: source.sourceKey })),
  ].slice(-80);
  world.turn = turn;
  world.revision = previous.revision + 1;
  world.summary = cleanText(proposal.summary, applied.length ? `本轮有 ${applied.length} 个世界主体完成了具体推进。` : previous.summary);
  world.changes = world.changes.slice(-480);
  world.updatedAt = now;
  world.persistence = { status: 'pending_save', savedAt: '', readbackAt: '', error: '' };
  const unresolvedSubjectIds = [...scheduledIds].filter((subjectId) => !appliedSet.has(subjectId));
  if (source.sourceKey) {
    const receiptSubjectIds = cleanStringArray([...(previousReceipt?.subjectIds || []), ...applied], 32);
    const receipt = normalizeWorldReceipt({
      sourceKey: source.sourceKey,
      messageId: source.messageId,
      turn,
      status: unresolvedSubjectIds.length || unresolvedDiscoveries.length ? 'partial' : receiptSubjectIds.length ? 'applied' : 'noop',
      subjectIds: receiptSubjectIds,
      unresolvedSubjectIds,
      unresolvedDiscoveries,
      at: now,
    });
    world.receipts = [
      ...(Array.isArray(world.receipts) ? world.receipts : []).filter((entry) => entry.sourceKey !== source.sourceKey),
      receipt,
    ].slice(-240);
  }
  world.digest = worldDigest(world);
  return {
    world: normalizeWorldState(world, { chatId: previous.chatId }),
    applied,
    skipped: [...parserErrors, ...skipped],
    unresolvedSubjectIds,
    unresolvedDiscoveries,
    discoveryRetry: unresolvedDiscoveries.length > 0,
    partial: (applied.length > 0 || (previousReceipt?.subjectIds || []).length > 0)
      && (unresolvedSubjectIds.length > 0 || unresolvedDiscoveries.length > 0),
    profileDiscoveries,
  };
}

function publicEffectAppears(effect, narrative, subject = null) {
  const expected = cleanText(effect);
  const actual = String(narrative || '');
  if (!expected || !actual) return false;
  if (actual.includes(expected)) return true;
  if (subject?.publicChannel === 'named_action' && cleanText(subject.name) && !actual.includes(cleanText(subject.name))) return false;
  const meaningfulLength = expected.replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, '').length;
  const required = Math.max(3, Math.min(8, Math.floor(meaningfulLength / 4)));
  return sharedCjkBigrams(expected, actual) >= required;
}

export function markWorldEffectsShown(worldInput, effects = [], turn = 0, acceptedText = '', sourceKey = '') {
  const world = normalizeWorldState(worldInput, { chatId: worldInput?.chatId });
  const offeredTurn = Math.max(world.turn, Number(turn || world.turn));
  const narrative = String(acceptedText || '');
  const ids = new Set((Array.isArray(effects) ? effects : []).map((entry) => cleanText(entry.effectId || entry.id)).filter(Boolean));
  const texts = new Set((Array.isArray(effects) ? effects : []).map((entry) => cleanText(entry.publicEffect)).filter(Boolean));
  let changed = 0;
  for (const subject of world.subjects) {
    if (ids.has(`subject:${subject.id}`) || (subject.publicEffect && texts.has(subject.publicEffect))) {
      if (!subject.offeredTurn) subject.offeredTurn = offeredTurn;
      subject.lastOfferedTurn = offeredTurn;
      const offerIdentity = cleanText(sourceKey, `turn:${offeredTurn}`);
      if (subject.lastOfferedSourceKey !== offerIdentity) {
        subject.lastOfferedSourceKey = offerIdentity;
        subject.offerCount = Math.max(0, Number(subject.offerCount || 0)) + 1;
        changed += 1;
      }
      if (publicEffectAppears(subject.publicEffect, narrative, subject) && subject.shownTurn < subject.publicEffectTurn) {
        subject.shownTurn = offeredTurn;
        changed += 1;
      }
    }
  }
  for (const change of world.changes) {
    if (ids.has(`change:${change.id}`) || (change.publicEffect && texts.has(change.publicEffect))) {
      if (!change.offeredTurn) change.offeredTurn = offeredTurn;
      change.lastOfferedTurn = offeredTurn;
      const offerIdentity = cleanText(sourceKey, `turn:${offeredTurn}`);
      if (change.lastOfferedSourceKey !== offerIdentity) {
        change.lastOfferedSourceKey = offerIdentity;
        change.offerCount = Math.max(0, Number(change.offerCount || 0)) + 1;
        changed += 1;
      }
      const changeSubject = world.subjects.find((entry) => (change.subjectIds || []).includes(entry.id));
      const projectionSnapshot = { ...change, name: changeSubject?.name || '', type: changeSubject?.type || '' };
      if (publicEffectAppears(change.publicEffect, narrative, projectionSnapshot) && change.shownTurn < change.turn) {
        change.shownTurn = offeredTurn;
        changed += 1;
      }
    }
  }
  if (changed) world.digest = worldDigest(world);
  return { world, changed };
}

export function deriveWorldBranches(worldInput) {
  const world = normalizeWorldState(worldInput, { chatId: worldInput?.chatId });
  const groups = new Map();
  for (const change of world.changes) {
    const keys = change.threadKeys.length ? change.threadKeys : change.subjectIds.map((id) => world.subjects.find((entry) => entry.id === id)?.name || id);
    for (const key of keys.length ? keys : ['未归类变化']) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(change);
    }
  }
  return [...groups.entries()].map(([key, changes]) => {
    const ordered = [...changes].sort((left, right) => left.turn - right.turn);
    const subjectIds = cleanStringArray(ordered.flatMap((entry) => entry.subjectIds), 24);
    const latest = ordered.at(-1);
    const subjects = subjectIds.map((id) => world.subjects.find((entry) => entry.id === id)).filter(Boolean);
    return {
      id: stableWorldId('branch', key),
      title: key,
      subjectIds,
      subjectNames: subjects.map((entry) => entry.name),
      status: subjects.length && subjects.every((entry) => entry.status === 'done') ? 'done' : 'active',
      changeCount: ordered.length,
      lastTurn: latest?.turn || 0,
      summary: latest?.stateChange || latest?.outcome || '',
      latestChange: deepClone(latest),
    };
  }).sort((left, right) => right.lastTurn - left.lastTurn || left.title.localeCompare(right.title));
}

export function activeWorldCount(worldInput) {
  return normalizeWorldState(worldInput, { chatId: worldInput?.chatId }).subjects.filter((entry) => entry.status !== 'done').length;
}

export function worldConsistencyReport(worldInput) {
  const world = normalizeWorldState(worldInput, { chatId: worldInput?.chatId });
  return {
    ok: true,
    status: 'single_authority',
    detail: `当前聊天只有一份世界权威：${world.subjects.length} 个主体、${world.changes.length} 条真实变化；诊断报告不会反向覆盖。`,
  };
}

export function recallSelectionInput(value) {
  const source = String(value || '').trim();
  const wrappers = [
    /<本轮用户输入\b[^>]*>([\s\S]*?)<\/本轮用户输入>/giu,
    /<user_input\b[^>]*>([\s\S]*?)<\/user_input>/giu,
    /<current_user_input\b[^>]*>([\s\S]*?)<\/current_user_input>/giu,
    /<input\b[^>]*>([\s\S]*?)<\/input>/giu,
  ];
  const matches = [];
  for (const wrapper of wrappers) {
    for (const match of source.matchAll(wrapper)) {
      const text = cleanText(match[1]);
      if (text) matches.push({ index: match.index ?? -1, text });
    }
  }
  return matches.length ? matches.sort((left, right) => left.index - right.index).at(-1).text : source;
}

function publicEffectCandidates(world, userInput) {
  const action = recallSelectionInput(userInput).toLocaleLowerCase();
  const candidates = [];
  for (const subject of world.subjects) {
    if (!subject.publicEffect || subject.publicChannel === 'none' || subject.shownTurn >= subject.publicEffectTurn) continue;
    if (Number(subject.offerCount || 0) >= 3) continue;
    if (subject.lastOfferedTurn > 0 && world.turn - subject.lastOfferedTurn < 2) continue;
    const related = [subject.name, ...subject.threadKeys].some((value) => cleanText(value).toLocaleLowerCase() && action.includes(cleanText(value).toLocaleLowerCase()));
    candidates.push({
      effectId: `subject:${subject.id}`,
      publicEffect: subject.publicEffect,
      publicChannel: subject.publicChannel,
      sourceTurn: subject.publicEffectTurn,
      relatedToCurrentAction: related,
      score: (related ? 8 : 0) + Math.max(1, world.turn - subject.shownTurn) + (subject.publicChannel === 'direct_consequence' ? 4 : 0),
    });
  }
  for (const change of world.changes) {
    if (!change.publicEffect || change.publicChannel === 'none' || change.shownTurn >= change.turn) continue;
    if (Number(change.offerCount || 0) >= 3) continue;
    if (change.lastOfferedTurn > 0 && world.turn - change.lastOfferedTurn < 2) continue;
    const subjectNames = change.subjectIds.map((id) => world.subjects.find((entry) => entry.id === id)?.name).filter(Boolean);
    const related = [...subjectNames, ...change.threadKeys].some((value) => cleanText(value).toLocaleLowerCase() && action.includes(cleanText(value).toLocaleLowerCase()));
    candidates.push({
      effectId: `change:${change.id}`,
      publicEffect: change.publicEffect,
      publicChannel: change.publicChannel,
      sourceTurn: change.turn,
      relatedToCurrentAction: related,
      score: (related ? 8 : 0) + Math.max(1, world.turn - change.shownTurn) + (change.publicChannel === 'direct_consequence' ? 4 : 0),
    });
  }
  const seen = new Set();
  return candidates.filter((entry) => {
    const signature = `${entry.publicChannel}|${entry.publicEffect}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function selectWorldRecall(worldInput, userInput, _profiles = {}, limit = 8) {
  const world = normalizeWorldState(worldInput, { chatId: worldInput?.chatId });
  return publicEffectCandidates(world, userInput)
    .sort((left, right) => right.score - left.score || left.sourceTurn - right.sourceTurn)
    .slice(0, Math.max(1, Math.min(16, Number(limit) || 8)))
    .map(({ score, ...entry }) => entry);
}

export function formatGenerationInjection({ tickets, recall, profileDigest = [], currentAction = '' }) {
  const publicEffects = (Array.isArray(recall) ? recall : []).map((entry) => ({
    effectId: entry.effectId,
    publicEffect: entry.publicEffect,
    publicChannel: entry.publicChannel,
    relatedToCurrentAction: Boolean(entry.relatedToCurrentAction),
  }));
  return [
    '<MVUDoctorRuntime>',
    '本轮玩家明确动作（这是玩家侧唯一授权边界；只执行其字面动作，不补写输入外动机、对白、同意、感受或下一步）：',
    JSON.stringify(recallSelectionInput(currentAction)),
    'characterCreationTicket（按首次出现顺序使用；有权威设定或已有档案者跳过）：',
    JSON.stringify(tickets || []),
    '世界后台已经造成、现在可能进入正文的公开影响：',
    JSON.stringify(publicEffects),
    '公开影响不要求逐字照抄，也不要求全部出现。先服从玩家当前动作；在时间、地点和因果上自然到达时，才通过相应渠道写成环境痕迹、未证实传闻、具名公开行动或直接可见后果。',
    '不得从公开影响反推出行动者的私密动机、未公开身份、镜头外步骤、知识来源或完整真相；没有公开影响时，不得自行泄露后台世界。',
    '世界后台可能推进与玩家完全无关的事项；不要为了让玩家成为中心而强行把所有影响送到玩家面前，也不要替玩家决定任何行动、感受、同意或结果。',
    '已有人物档案公开身份句柄（只表示不得重复随机，不代表叙事者知道私密档案）：',
    JSON.stringify(profileDigest || []),
    '</MVUDoctorRuntime>',
  ].join('\n');
}

export function profileDigestFromData(data, limit = 60) {
  return Object.values(existingProfilesFromData(data)).slice(0, limit).map((profile) => {
    const explicitNarrativeNames = cleanStringArray(profile?.narrativeKnownNames, 24);
    return {
      profileHandle: stableWorldId('profile-public', profile?.profileId, profile?.name),
      knownNames: explicitNarrativeNames,
      doNotRerandomize: true,
    };
  });
}

export function privateProfileDigestFromData(data, limit = 60) {
  return Object.values(existingProfilesFromData(data)).slice(0, limit).map((profile) => ({
    profileId: profile.profileId,
    name: profile.name,
    aliases: profile.aliases || [],
    identity: profile.identity || {},
    personality: profile.personality || {},
    currentState: profile.currentState || {},
    relationships: profile.relationships || [],
    knowledge: profile.knowledge || [],
    capabilities: profile.capabilities || [],
    resources: profile.resources || [],
    inferences: profile.inferences || [],
  }));
}

export function profilesFromData(data) {
  return deepClone(existingProfilesFromData(data));
}

export function removeApiFromExport(value, secrets = []) {
  const blocked = /^(?:api|apiKey|endpoint|authorization|headers|requestHeaders|credentials|accessToken|refreshToken|secret)$/i;
  const secretValues = (secrets || []).map((item) => String(item || '')).filter((item) => item.length >= 4);
  const active = new WeakMap();
  const visit = (item, path = '$') => {
    if (typeof item === 'string') {
      let text = redactDiagnostic(item);
      for (const secret of secretValues) text = text.split(secret).join('[API已排除]');
      return text;
    }
    if (item === null || typeof item === 'boolean' || typeof item === 'number') return item;
    if (typeof item === 'bigint') return `${item}n`;
    if (typeof item === 'undefined') return '[undefined]';
    if (typeof item === 'function') return `[Function${item.name ? `: ${item.name}` : ''}]`;
    if (typeof item === 'symbol') return String(item);
    if (!item || typeof item !== 'object') return item;
    if (active.has(item)) return `[Circular -> ${active.get(item)}]`;
    if (item instanceof Date) return Number.isNaN(item.getTime()) ? 'Invalid Date' : item.toISOString();
    if (item instanceof Error) {
      return visit({ name: item.name, message: item.message, stack: item.stack }, `${path}.error`);
    }
    if (item instanceof ArrayBuffer) return { type: 'ArrayBuffer', byteLength: item.byteLength };
    if (ArrayBuffer.isView(item)) return { type: item.constructor?.name || 'TypedArray', values: Array.from(item) };

    active.set(item, path);
    try {
      if (Array.isArray(item)) return item.map((child, index) => visit(child, `${path}[${index}]`));
      if (item instanceof Map) {
        return { type: 'Map', entries: Array.from(item.entries(), ([key, child], index) => [visit(key, `${path}.mapKey${index}`), visit(child, `${path}.mapValue${index}`)]) };
      }
      if (item instanceof Set) return { type: 'Set', values: Array.from(item, (child, index) => visit(child, `${path}.set${index}`)) };
      const result = {};
      for (const key of Object.keys(item)) {
        if (blocked.test(key)) continue;
        try {
          result[key] = visit(item[key], `${path}.${key}`);
        } catch (error) {
          result[key] = `[读取失败: ${error?.message || String(error)}]`;
        }
      }
      return result;
    } finally {
      active.delete(item);
    }
  };
  return visit(value);
}
