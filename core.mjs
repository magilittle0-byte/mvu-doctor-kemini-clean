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

export function profileCompletionContract() {
  return `每个人物必须按以下唯一结构输出完整对象；正文没有明说的内容不是空项，而是结合权威材料、世界观、人物身份和同一张骰票主动设计，并在inferences中说明为可修订补全：
{
  "profileId": "旧人物沿用既有ID；新人留空字符串",
  "ticketId": "新人使用分配的本轮ticketId；旧人物保持原值",
  "name": "正文中可稳定单指的姓名、编号或唯一称谓",
  "aliases": ["正文已经出现的别名；没有可用空数组"],
  "identity": {
    "species": "物种",
    "gender": "性别或该物种适用的性别说明",
    "age": "明确年龄或符合世界观的年龄段",
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
禁止用未知、待定、未登记、正文未提及或空字符串逃避补全。不适用字段必须写明不适用的世界观原因。所有列表字段必须是数组。`;
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
export const VARIABLE_AUDIT_CATEGORIES = Object.freeze([
  'opening_and_initialization',
  'numeric_and_derived',
  'inventory_and_transfer',
  'dynamic_collections',
  'relationship_and_mental_causality',
  'time_location_and_cost',
  'player_agency',
]);

export function parseUpdateVariableBlock(message) {
  const source = String(message || '');
  const blocks = [...source.matchAll(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable\s*>/gi)];
  if (blocks.length > 1) return { ok: false, code: 'multiple-blocks', error: `检测到${blocks.length}个<UpdateVariable>区块，拒绝选择或合并`, operations: [] };
  const rawBlock = blocks[0]?.[0] || '';
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
  return { ok: true, operations, block, rawBlock, analysis };
}

export function buildUpdateVariableBlock(operations, analysis = '变量更新。') {
  return `<UpdateVariable>\n<Analysis>${String(analysis || '变量更新。').replace(/[<>]/g, '')}</Analysis>\n<JSONPatch>\n${JSON.stringify(Array.isArray(operations) ? operations : [], null, 2)}\n</JSONPatch>\n</UpdateVariable>`;
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

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pathOverlaps(left, right) {
  if (left === '/' || right === '/') return true;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function leafChanges(before, after, base = '', output = [], limit = 240) {
  if (output.length >= limit || jsonEqual(before, after)) return output;
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
  return leafChanges(statDataOf(previousData), statDataOf(currentData), '', [], Math.max(1, Number(limit) || 240));
}

function matchingStatePaths(data, pattern, limit = 12) {
  const paths = [];
  const walk = (value, base = '') => {
    if (paths.length >= limit || !value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const path = `${base}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
      if (pattern.test(String(key))) paths.push(path);
      if (child && typeof child === 'object') walk(child, path);
      if (paths.length >= limit) break;
    }
  };
  walk(statDataOf(data));
  return [...new Set(paths)];
}

function changedStatePaths(previousData, currentData, originalOperations = []) {
  const hasPrevious = Object.keys(statDataOf(previousData) || {}).length > 0;
  if (hasPrevious) return diffStatData(previousData, currentData, 1200).map((item) => String(item.path || '')).filter(Boolean);
  return originalOperations.flatMap((item) => [item?.path, item?.from, item?.to]).map(String).filter((path) => path.startsWith('/'));
}

function pathsMatching(paths, pattern, limit = 12) {
  return [...new Set((paths || []).filter((path) => pattern.test(String(path))))].slice(0, limit);
}

export function buildVariableAuditChecklist({ narrative = '', previousData = null, currentData = null, originalOperations = [] } = {}) {
  const text = String(narrative || '');
  const hasPrevious = Object.keys(statDataOf(previousData) || {}).length > 0;
  const changedPaths = changedStatePaths(previousData, currentData, originalOperations);
  const rules = {
    opening_and_initialization: {
      risk: !hasPrevious,
      reason: !hasPrevious ? '这是首个可用状态，必须核对初始化、基础值与派生值闭包' : '核对初始化字段是否被后续正文合法改变',
      paths: matchingStatePaths(currentData, /初始|基础|属性|能力|等级|生命|法力|体力|力量|敏捷|智力|精神|魅力|幸运/u),
      changedPaths: pathsMatching(changedPaths, /初始|基础|属性|能力|等级|生命|法力|体力|力量|敏捷|智力|精神|魅力|幸运/u),
    },
    numeric_and_derived: {
      risk: /\d|增加|减少|提升|下降|获得|消耗|恢复|损失|结算/u.test(text) || originalOperations.some((item) => item?.op === 'delta' || typeof item?.value === 'number'),
      reason: '核对数值变化及由其决定的派生值，禁止只改来源不改结果或反向重复delta',
      paths: matchingStatePaths(currentData, /数值|属性|生命|法力|体力|经验|等级|点数|上限|当前|余额|金钱|货币|UP|积分|负重/u),
      changedPaths: pathsMatching(changedPaths, /数值|属性|生命|法力|体力|经验|等级|点数|上限|当前|余额|金钱|货币|UP|积分|负重/u),
    },
    inventory_and_transfer: {
      risk: /获得|拿到|捡起|拾取|购买|装备|卸下|丢弃|扔下|放下|交给|递给|归还|失去|消耗|背包|物品|武器|护甲/u.test(text),
      reason: '核对物品所有权、装备槽、数量、负重和交易双方，动作描述不能代替实际转移',
      paths: matchingStatePaths(currentData, /背包|物品|装备|武器|护甲|道具|库存|数量|负重|持有|货币|金钱/u),
      changedPaths: pathsMatching(changedPaths, /背包|物品|装备|武器|护甲|道具|库存|数量|负重|持有|货币|金钱/u),
    },
    dynamic_collections: {
      risk: /加入|离开|创建|解散|接受任务|完成任务|契约|队伍|成员|技能|状态|效果|事件|记录/u.test(text),
      reason: '核对动态对象的新增、删除、成员关系和状态生命周期',
      paths: matchingStatePaths(currentData, /任务|事件|队伍|成员|契约|技能|状态|效果|记录|列表/u),
      changedPaths: pathsMatching(changedPaths, /任务|事件|队伍|成员|契约|技能|状态|效果|记录|列表/u),
    },
    relationship_and_mental_causality: {
      risk: /好感|信任|亲密|关系|恐惧|敬畏|畏惧|盲信|崇拜|操纵|洗脑|控制|胁迫|威慑|催眠/u.test(text),
      reason: '区分自愿关系变化、恐惧敬畏、强制操纵与暂时情绪；不得把控制结果伪装成好感提升',
      paths: matchingStatePaths(currentData, /关系|好感|信任|亲密|恐惧|敬畏|服从|控制|精神|情绪|态度|印象/u),
      changedPaths: pathsMatching(changedPaths, /关系|好感|信任|亲密|恐惧|敬畏|服从|控制|精神|情绪|态度|印象/u),
    },
    time_location_and_cost: {
      risk: /前往|抵达|离开|过去了|小时|分钟|天|夜|清晨|中午|傍晚|花费|支付|代价|受伤/u.test(text),
      reason: '核对地点、时间、成本、伤势与已裁决后果，计划和尝试不能提前结算',
      paths: matchingStatePaths(currentData, /时间|日期|地点|位置|场景|伤势|健康|状态|消耗|代价/u),
      changedPaths: pathsMatching(changedPaths, /时间|日期|地点|位置|场景|伤势|健康|状态|消耗|代价/u),
    },
    player_agency: {
      risk: false,
      reason: '确认补丁只记录玩家明确行动与已接受裁决，不替玩家补写同意、感受、动机或选择',
      paths: [],
      changedPaths: [],
    },
  };
  return VARIABLE_AUDIT_CATEGORIES.map((id) => ({ id, ...rules[id] }));
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
      const fixed = repairOperationPath(stat, operation.op === 'move' && key === 'to' ? 'insert' : operation.op, operation[key]);
      if (fixed.repair) repairs.push({ index, kind: 'path', detail: fixed.repair });
      operation[key] = fixed.path;
    }
    if (operation.op === 'delta' && typeof operation.value === 'string' && operation.value.trim() !== '' && Number.isFinite(Number(operation.value))) {
      operation.value = Number(operation.value);
      repairs.push({ index, kind: 'delta-number', detail: '已把数字字符串转换为数值' });
    }
    if (operation.op === 'replace') {
      const current = pointerValue(stat, operation.path);
      if (current.found && isValueWithDescription(current.value) && isValueWithDescription(operation.value)) {
        operation.value = deepClone(operation.value[0]);
        repairs.push({ index, kind: 'value-with-description', detail: '已保留说明槽，只写入第一格真实值' });
      }
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

export function assessVariableBaseline({ narrative = '', previousData = null, currentData = null, original = null } = {}) {
  const hasPrevious = Object.keys(statDataOf(previousData) || {}).length > 0;
  const diff = hasPrevious ? diffStatData(previousData, currentData, 1200) : [];
  const checklist = buildVariableAuditChecklist({
    narrative,
    previousData,
    currentData,
    originalOperations: original?.ok ? original.operations : [],
  });
  const highRisk = checklist.filter((item) => item.risk).map((item) => item.id);
  if (!hasPrevious) return { code: 'opening', requiresCorrection: false, diffCount: diff.length, highRisk, checklist };
  if (!original?.ok) {
    return {
      code: diff.length ? 'unreadable_block_with_state_change' : 'missing_or_dead_block',
      requiresCorrection: highRisk.length > 0 && diff.length === 0,
      diffCount: diff.length,
      highRisk,
      checklist,
      detail: original?.error || '正文没有可读取的变量更新区块',
    };
  }
  const normalized = normalizeVariableOperations(previousData, original.operations);
  if (!normalized.ok) return { code: 'original_patch_unsafe', requiresCorrection: true, diffCount: diff.length, highRisk, checklist, detail: normalized.error };
  if (!normalized.operations.length) {
    return {
      code: diff.length ? 'empty_patch_with_state_change' : 'empty_patch',
      requiresCorrection: highRisk.length > 0 && diff.length === 0,
      diffCount: diff.length,
      highRisk,
      checklist,
    };
  }
  const validation = validatePatchOperations(previousData, normalized.operations);
  if (!validation.ok) return { code: 'original_patch_invalid', requiresCorrection: true, diffCount: diff.length, highRisk, checklist, detail: validation.error };
  const reflected = verifyPatchOperations(currentData, validation);
  return {
    code: reflected ? 'original_patch_reflected' : 'original_patch_not_reflected',
    requiresCorrection: !reflected,
    diffCount: diff.length,
    highRisk,
    checklist,
    repairs: normalized.repairs,
  };
}

function schemaNodeAt(schema, parts) {
  let node = schema;
  for (const part of parts || []) {
    if (!node || typeof node !== 'object') return null;
    if (/^\d+$/.test(part) && node.type === 'array') node = node.elementType;
    else if (node.type === 'object' && node.properties && Object.prototype.hasOwnProperty.call(node.properties, part)) node = node.properties[part];
    else return null;
  }
  return node && typeof node === 'object' ? node : null;
}

function validateOperationSchema(currentData, operation, number) {
  const schema = currentData?.schema;
  if (!schema || typeof schema !== 'object') return null;
  const operationPaths = operation.op === 'move' ? [operation.from, operation.to] : [operation.path];
  for (const path of operationPaths) {
    const parts = pointerParts(path);
    if (!parts?.length) return `第${number}个操作没有可核对的Schema路径`;
    if (operation.op !== 'insert' && !(operation.op === 'move' && path === operation.to)) {
      if (!schemaNodeAt(schema, parts)) return `第${number}个操作的目标不在当前角色卡Schema中`;
      continue;
    }
    const leaf = parts.at(-1);
    const parentSchema = schemaNodeAt(schema, parts.slice(0, -1));
    if (!parentSchema) return `第${number}个insert的父路径不在当前角色卡Schema中`;
    if (parentSchema.type === 'object') {
      const declared = parentSchema.properties && Object.prototype.hasOwnProperty.call(parentSchema.properties, leaf);
      if (parentSchema.extensible === false && !declared) return `第${number}个insert试图扩展不可扩展的Schema对象`;
    } else if (parentSchema.type === 'array') {
      if (parentSchema.extensible !== true) return `第${number}个insert试图扩展不可扩展的Schema数组`;
    } else return `第${number}个insert的父Schema不是集合`;
  }
  return null;
}

export function validatePatchOperations(currentData, operations) {
  const before = deepClone(statDataOf(currentData));
  const expected = deepClone(before);
  if (!expected || typeof expected !== 'object') return { ok: false, error: '当前MVU没有可验证的stat_data' };
  const touched = [];
  const rollbackPaths = [];
  for (const [index, operation] of (operations || []).entries()) {
    const number = index + 1;
    const schemaError = validateOperationSchema(currentData, operation, number);
    if (schemaError) return { ok: false, code: 'schema_incompatible', error: schemaError };
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
      if (isValueWithDescription(hit.value)) {
        if (operation.value && typeof operation.value === 'object') return { ok: false, error: `第${number}个replace必须只写值与说明结构的第一格：${operation.path}` };
        parent.parent[parent.key][0] = deepClone(operation.value);
      } else {
        if (hit.value && typeof hit.value === 'object') return { ok: false, error: `第${number}个replace试图整体覆盖复杂节点：${operation.path}` };
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
    return expected.found === actual.found && (!expected.found || JSON.stringify(expected.value) === JSON.stringify(actual.value));
  });
}

export function verifyPatchApplication(data, validation, allowPaths = []) {
  if (!validation?.ok) return { ok: false, errors: ['缺少有效的补丁校验结果'] };
  const stat = statDataOf(data);
  const targetErrors = [];
  for (const path of validation.touched || []) {
    const expected = pointerValue(validation.expected, path);
    const actual = pointerValue(stat, path);
    if (expected.found !== actual.found || (expected.found && !jsonEqual(expected.value, actual.value))) targetErrors.push(`目标路径未按预期落地：${path}`);
  }
  const permitted = [...(validation.touched || []), ...(allowPaths || [])];
  const unexpected = leafChanges(validation.before, stat).filter((change) => {
    if (change.path.split('/').some((part) => part.startsWith('_'))) return false;
    return !permitted.some((path) => pathOverlaps(change.path, path));
  });
  const errors = [...targetErrors, ...unexpected.slice(0, 12).map((change) => `补丁外路径发生变化：${change.path}`)];
  return { ok: errors.length === 0, errors, unexpected };
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
    return expected.found === actual.found && (!expected.found || jsonEqual(expected.value, actual.value));
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
    return actual.found === Boolean(item.found) && (!actual.found || jsonEqual(actual.value, item.value));
  });
}

export function mergeUpdateVariableBlocks(originalMessage, correctionMessage) {
  const original = parseUpdateVariableBlock(originalMessage);
  const correction = parseUpdateVariableBlock(correctionMessage);
  if (!correction.ok) return correction;
  const operations = [...(original.ok ? original.operations : []), ...correction.operations];
  const block = buildUpdateVariableBlock(operations, '保留原变量更新，并追加医生已验证的纠错。');
  const source = String(originalMessage || '');
  const replaced = original.ok
    ? source.replace(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable\s*>/gi, (match, offset) => (
      offset === source.search(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable\s*>/i) ? block : ''
    )).replace(/\n{3,}/g, '\n\n').trim()
    : `${source.trim()}\n\n${block}`.trim();
  return { ok: true, operations, block, message: replaced };
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

export function profileNarrativeText(text) {
  return String(text || '')
    .replace(/<gm_chain\b[^>]*>[\s\S]*?<\/gm_chain\s*>/gi, '')
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking\s*>/gi, '')
    .replace(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable\s*>/gi, '')
    .replace(/<options?\b[^>]*>[\s\S]*?<\/options?\s*>/gi, '')
    .replace(/<人物档案(?:更新|无变化)\b[^>]*>[\s\S]*?<\/人物档案(?:更新|无变化)\s*>/gi, '')
    .replace(/<人物档案无变化\s*\/>/gi, '');
}

export function normalizeProfileCandidates(rawProfiles, acceptedText = '') {
  if (!Array.isArray(rawProfiles)) return [];
  const source = profileNarrativeText(acceptedText);
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
        .find((value) => value && source.includes(value));
      if (label) profile.evidence = [`最终已接受正文明确出现“${label}”；该人物的可观察出场与互动是本档案的直接依据。`];
    }
    return profile;
  });
}

function mergeCandidateValue(previous, incoming) {
  if (Array.isArray(incoming)) {
    const combined = [...(Array.isArray(previous) ? previous : []), ...incoming].filter(usableScalar);
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
    for (const [key, value] of Object.entries(incoming)) base[key] = mergeCandidateValue(base[key], value);
    return base;
  }
  return usableScalar(incoming) ? incoming : deepClone(previous);
}

function sameCandidate(left, right) {
  const exactKeys = ['profileId', 'ticketId'];
  if (exactKeys.some((key) => left?.[key] && right?.[key] && String(left[key]) === String(right[key]))) return true;
  const leftNames = new Set(normalizedNames(left));
  return normalizedNames(right).some((name) => leftNames.has(name));
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

export function prepareProfileBatch(rawProfiles, tickets, currentData, acceptedText = '') {
  const normalizedProfiles = normalizeProfileCandidates(rawProfiles, acceptedText);
  if (normalizedProfiles.length < 1) {
    return { ok: false, errors: ['人物档案批次为空'], profiles: [] };
  }
  const existing = existingProfilesFromData(currentData);
  const ticketMap = new Map((tickets || []).map((ticket) => [String(ticket.ticketId), ticket]));
  const claimedTickets = new Set(normalizedProfiles
    .map((profile) => String(profile?.ticketId || ''))
    .filter((ticketId) => ticketMap.has(ticketId)));
  const availableTickets = [...ticketMap.values()].sort((left, right) => Number(left.ordinal || 0) - Number(right.ordinal || 0));
  const usedTickets = new Set();
  const nameIndex = new Map();
  for (const [id, profile] of Object.entries(existing)) {
    for (const name of normalizedNames(profile)) nameIndex.set(name, id);
  }
  const ids = new Set();
  const prepared = [];
  const errors = [];
  const narrative = profileNarrativeText(acceptedText).toLocaleLowerCase();
  const orderedProfiles = normalizedProfiles.map((profile, originalIndex) => {
    const positions = normalizedNames(profile).map((name) => narrative.indexOf(name)).filter((position) => position >= 0);
    return { profile, originalIndex, position: positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER };
  }).sort((left, right) => left.position - right.position || left.originalIndex - right.originalIndex);

  for (const { profile: input, originalIndex: index } of orderedProfiles) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      errors.push(`第${index + 1}张档案不是对象`);
      continue;
    }
    let profile = deepClone(input);
    const matchedId = normalizedNames(profile).map((name) => nameIndex.get(name)).find(Boolean);
    const requestedId = String(profile.profileId || '').trim();
    let profileId = String(matchedId || (requestedId && existing[requestedId] ? requestedId : '')).trim();
    const isExisting = Boolean(profileId && existing[profileId]);
    const persistedNarrativeKnownNames = isExisting
      ? cleanStringArray(existing[profileId]?.narrativeKnownNames, 24)
      : [];
    if (isExisting) profile = mergeCandidateValue(existing[profileId], profile);
    const namesSeenInNarrative = [profile?.name, ...(Array.isArray(profile?.aliases) ? profile.aliases : [])]
      .map((item) => cleanText(item))
      .filter((item) => item && narrative.includes(item.toLocaleLowerCase()));
    profile.narrativeKnownNames = cleanStringArray([...persistedNarrativeKnownNames, ...namesSeenInNarrative], 24);
    let ticket = ticketMap.get(String(profile.ticketId || ''));
    if (!isExisting) {
      if (!ticket) {
        ticket = availableTickets.find((candidate) => !usedTickets.has(candidate.ticketId) && !claimedTickets.has(candidate.ticketId));
      }
      if (!ticket) {
        errors.push(`第${index + 1}张新档案没有匹配本轮characterCreationTicket`);
        continue;
      }
      profileId = ticket.ticketId;
      profile.ticketId = ticket.ticketId;
      profile.personality = mergeCandidateValue(ticket.axes, profile.personality || {});
      if (usedTickets.has(ticket.ticketId)) errors.push(`同一票据被多名新人物重复使用：${ticket.ticketId}`);
      usedTickets.add(ticket.ticketId);
    }
    profile.profileId = profileId;
    if (isExisting && usableScalar(existing[profileId]?.ticketId)) profile.ticketId = existing[profileId].ticketId;
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
    if (JSON.stringify(committed[profile.profileId]) !== JSON.stringify(profile)) return false;
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
    return { severity: 'success', summary: '本轮人物档案和世界状态已经完成。', action: '无需处理。' };
  }
  if (code === 'world_recovered') {
    return { severity: 'success', summary: '上次中断的世界候选已经从持久检查点恢复并完成读回。', action: '无需重复推进；可在“世界”页核对修订号和提交摘要。' };
  }
  if (['variable_manual_completed', 'variable_recovered', 'variable_undo_completed'].includes(code)) {
    return { severity: 'success', summary: 'MVU变量事务已经完成并取得读回证据。', action: '无需处理；可在完整报告中查看检查回执和路径快照。' };
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

export const WORLD_SCHEMA_VERSION = 5;

const PUBLIC_PROJECTION_LEAK_MARKERS = /(?:内心|真实(?:想法|目的|身份)|暗中|私下|偷偷|无人(?:看见|察觉|知道)|其实|伪装|装作|盘算|谋划|记仇|秘密|小本本|悄无声息地(?:写|记|记录)|背地里|不为人知|(?:袖中|袖口|背后|暗处).{0,16}(?:写|记录|记下)|(?:写下|记下|记录).{0,16}(?:名字|名单|信息|弱点)|评估.{0,12}(?:价值|弱点|威胁))/u;

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function cleanStringArray(value, limit = 24) {
  return [...new Set((Array.isArray(value) ? value : value == null ? [] : [value])
    .map((item) => cleanText(item)).filter(Boolean))].slice(0, limit);
}

function publicProjectionLeak(value) {
  const texts = Array.isArray(value) ? value : [value];
  return texts.map((item) => cleanText(item)).find((item) => item && PUBLIC_PROJECTION_LEAK_MARKERS.test(item)) || '';
}

function exactNarrativeEvidence(acceptedText, evidence) {
  const source = String(acceptedText || '');
  const quote = cleanText(evidence);
  return quote.length >= 4 && quote.length <= 180 && source.includes(quote);
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

function worldDigestPayload(world) {
  const copy = deepClone(world || {});
  delete copy.digest;
  delete copy.persistence;
  delete copy.checkpoint;
  delete copy.migration;
  if (copy.recall) delete copy.recall.pending;
  return copy;
}

export function worldDigest(world) {
  return stableWorldId('wd', JSON.stringify(worldDigestPayload(world)));
}

function normalizeSourceRef(value = {}, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    chatId: cleanText(source.chatId, cleanText(fallback.chatId)),
    messageId: Number.isInteger(Number(source.messageId)) ? Number(source.messageId) : (Number.isInteger(Number(fallback.messageId)) ? Number(fallback.messageId) : null),
    turn: Math.max(0, Number(source.turn ?? fallback.turn) || 0),
    sourceKey: cleanText(source.sourceKey, cleanText(fallback.sourceKey)),
    excerpt: cleanText(source.excerpt, cleanText(fallback.excerpt)).slice(0, 500),
    at: cleanText(source.at, cleanText(fallback.at, new Date().toISOString())),
  };
}

function emptyRecall() {
  return { pending: null, receipts: [] };
}

export function emptyWorldState(chatId = '') {
  const now = new Date().toISOString();
  const world = {
    schemaVersion: WORLD_SCHEMA_VERSION,
    chatId: cleanText(chatId),
    revision: 0,
    commitId: '',
    digest: '',
    observedThrough: { turn: 0, sourceKey: '', at: now },
    simulatedThrough: { turn: 0, sourceKey: '', at: now },
    summary: '',
    threads: [],
    lanes: { actors: [], factions: [], environment: { summary: '', economy: '', incidents: [], trends: [], winds: [] } },
    attempts: [],
    adjudications: [],
    resolvedArchive: [],
    tombstoneThroughTurn: 0,
    recall: emptyRecall(),
    failures: [],
    checkpoint: { state: 'world_committed', candidate: null, candidateDigest: '', preparedAt: '', committedAt: '' },
    persistence: { status: 'unverified', revision: 0, commitId: '', digest: '', readbackAt: '', error: '' },
    migration: null,
    updatedAt: now,
  };
  world.digest = worldDigest(world);
  return world;
}

function legacyWorldRecords(world = {}) {
  const map = [
    ['branches', 'parallel'], ['npcIntents', 'personal'], ['agreements', 'promise'], ['hostilePlans', 'enemy'],
  ];
  return map.flatMap(([key, kind]) => (Array.isArray(world?.[key]) ? world[key] : []).map((entry, index) => ({
    id: cleanText(entry?.id, stableWorldId('thread', kind, entry?.title, entry?.actor, entry?.location, index)),
    kind,
    title: cleanText(entry?.title, cleanText(entry?.actor, '未命名连续性事项')),
    stage: entry?.status === 'resolved' ? 'resolved' : entry?.status === 'waiting' ? 'dormant' : 'advancing',
    actorIds: cleanStringArray(entry?.actor),
    factionIds: [],
    locations: cleanStringArray(entry?.location),
    keywords: cleanStringArray(entry?.keywords, 16),
    summary: cleanText(entry?.consequence, cleanText(entry?.intent)),
    offscreenBeat: cleanText(entry?.intent),
    publicTitle: '',
    publicSurface: '',
    publicClues: [],
    trigger: '',
    nextBeat: cleanText(entry?.intent),
    stakes: cleanText(entry?.consequence),
    urgency: key === 'hostilePlans' ? 4 : 2,
    knowledge: 'hidden',
    causedBy: [], effects: [], rumors: [],
    revealedSummary: '', revealEvidence: '', knownByActorIds: [],
    createdTurn: 0, lastAdvancedTurn: 0,
    sourceRef: normalizeSourceRef({}, { at: entry?.updatedAt }),
    updatedAt: cleanText(entry?.updatedAt, world?.updatedAt || new Date().toISOString()),
  })));
}

function normalizeThread(entry, index = 0, fallbackSource = {}) {
  const kind = ['parallel', 'personal', 'promise', 'enemy', 'mystery', 'social', 'resource', 'environment'].includes(entry?.kind) ? entry.kind : 'parallel';
  const title = cleanText(entry?.title, cleanText(entry?.summary, '未命名连续性事项'));
  const actorIds = cleanStringArray(entry?.actorIds ?? entry?.actors ?? entry?.actor);
  const locations = cleanStringArray(entry?.locations ?? entry?.location);
  return {
    id: cleanText(entry?.id, stableWorldId('thread', kind, title, actorIds, locations, index)),
    kind,
    title,
    stage: ['seeded', 'advancing', 'manifested', 'dormant', 'resolved', 'failed'].includes(entry?.stage) ? entry.stage : (entry?.status === 'resolved' ? 'resolved' : 'advancing'),
    actorIds,
    factionIds: cleanStringArray(entry?.factionIds ?? entry?.factions),
    locations,
    keywords: cleanStringArray(entry?.keywords, 16),
    summary: cleanText(entry?.summary, cleanText(entry?.consequence, cleanText(entry?.intent))),
    offscreenBeat: cleanText(entry?.offscreenBeat, cleanText(entry?.intent)),
    publicTitle: cleanText(entry?.publicTitle),
    publicSurface: cleanText(entry?.publicSurface),
    publicClues: cleanStringArray(entry?.publicClues, 16),
    trigger: cleanText(entry?.trigger),
    nextBeat: cleanText(entry?.nextBeat, cleanText(entry?.intent)),
    stakes: cleanText(entry?.stakes, cleanText(entry?.consequence)),
    urgency: Math.max(0, Math.min(5, Number(entry?.urgency) || 0)),
    knowledge: ['hidden', 'rumor', 'observed'].includes(entry?.knowledge) ? entry.knowledge : 'hidden',
    causedBy: cleanStringArray(entry?.causedBy),
    effects: cleanStringArray(entry?.effects),
    rumors: cleanStringArray(entry?.rumors),
    revealedSummary: cleanText(entry?.revealedSummary),
    revealEvidence: cleanText(entry?.revealEvidence).slice(0, 180),
    knownByActorIds: cleanStringArray(entry?.knownByActorIds, 40),
    createdTurn: Math.max(0, Number(entry?.createdTurn) || Number(fallbackSource.turn) || 0),
    lastAdvancedTurn: Math.max(0, Number(entry?.lastAdvancedTurn) || Number(fallbackSource.turn) || 0),
    sourceRef: normalizeSourceRef(entry?.sourceRef, fallbackSource),
    updatedAt: cleanText(entry?.updatedAt, fallbackSource.at || new Date().toISOString()),
  };
}

function normalizeActorLane(entry, index = 0) {
  const actorId = cleanText(entry?.actorId, cleanText(entry?.name, `actor-${index + 1}`));
  return {
    actorId,
    name: cleanText(entry?.name, actorId),
    goal: cleanText(entry?.goal),
    planSteps: cleanStringArray(entry?.planSteps, 12),
    nextActionTurn: Math.max(0, Number(entry?.nextActionTurn) || 0),
    lastActionTurn: Math.max(0, Number(entry?.lastActionTurn) || 0),
    silenceTurns: Math.max(0, Number(entry?.silenceTurns) || 0),
    status: ['ready', 'waiting', 'blocked_unready', 'inactive'].includes(entry?.status) ? entry.status : 'waiting',
    lastAction: cleanText(entry?.lastAction),
    sourceThreadIds: cleanStringArray(entry?.sourceThreadIds ?? entry?.threadIds),
  };
}

function normalizeFactionLane(entry, index = 0) {
  const name = cleanText(entry?.name, `未命名阵营${index + 1}`);
  return {
    id: cleanText(entry?.id, stableWorldId('faction', name)),
    name,
    goal: cleanText(entry?.goal),
    status: cleanText(entry?.status, 'active'),
    relation: cleanText(entry?.relation),
    condition: cleanText(entry?.condition),
    summary: cleanText(entry?.summary),
    sourceThreadIds: cleanStringArray(entry?.sourceThreadIds ?? entry?.threadIds),
  };
}

function normalizeAttempt(entry, index = 0, fallbackSource = {}) {
  const actorId = cleanText(entry?.actorId, cleanText(entry?.actor));
  const threadId = cleanText(entry?.threadId);
  const action = cleanText(entry?.action, cleanText(entry?.intent));
  return {
    attemptId: cleanText(entry?.attemptId, stableWorldId('attempt', actorId, threadId, action, fallbackSource.sourceKey, index)),
    actorId,
    actorName: cleanText(entry?.actorName, cleanText(entry?.actor, actorId)),
    threadId,
    intent: cleanText(entry?.intent, action),
    action,
    knowledgeBasis: cleanStringArray(entry?.knowledgeBasis),
    capabilityBasis: cleanStringArray(entry?.capabilityBasis),
    resourceCosts: cleanStringArray(entry?.resourceCosts),
    expectedDuration: cleanText(entry?.expectedDuration),
    risk: cleanText(entry?.risk),
    visibility: ['hidden', 'rumor', 'observable'].includes(entry?.visibility) ? entry.visibility : 'hidden',
    publicSurface: cleanText(entry?.publicSurface),
    publicClues: cleanStringArray(entry?.publicClues, 12),
    playerDecisionRequired: Boolean(entry?.playerDecisionRequired),
    status: ['pending_world', 'settled', 'blocked_unready', 'cancelled'].includes(entry?.status) ? entry.status : 'pending_world',
    sourceRef: normalizeSourceRef(entry?.sourceRef, fallbackSource),
    createdTurn: Math.max(0, Number(entry?.createdTurn) || Number(fallbackSource.turn) || 0),
  };
}

function normalizeAdjudication(entry, index = 0, fallbackSource = {}) {
  const attemptId = cleanText(entry?.attemptId);
  return {
    resultId: cleanText(entry?.resultId, stableWorldId('result', attemptId, entry?.resultSummary, fallbackSource.sourceKey, index)),
    attemptId,
    actorId: cleanText(entry?.actorId, cleanText(entry?.actor)),
    status: ['success', 'partial', 'failure', 'delayed', 'blocked'].includes(entry?.status) ? entry.status : 'delayed',
    resultSummary: cleanText(entry?.resultSummary, cleanText(entry?.consequence)),
    actualCosts: cleanStringArray(entry?.actualCosts),
    actualDuration: cleanText(entry?.actualDuration),
    observableConsequence: cleanText(entry?.observableConsequence, cleanText(entry?.consequence)),
    publicClues: cleanStringArray(entry?.publicClues, 12),
    appliedStateChanges: cleanStringArray(entry?.appliedStateChanges),
    revealPath: cleanText(entry?.revealPath),
    sourceRef: normalizeSourceRef(entry?.sourceRef, fallbackSource),
    settledTurn: Math.max(0, Number(entry?.settledTurn) || Number(fallbackSource.turn) || 0),
  };
}

export function normalizeWorldState(input = {}, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const base = emptyWorldState(options.chatId || source.chatId || '');
  const fromSchema = Number(source.schemaVersion) || 3;
  const hasLegacyArrays = ['branches', 'npcIntents', 'agreements', 'hostilePlans'].some((key) => Array.isArray(source?.[key]));
  const needsMigration = fromSchema !== WORLD_SCHEMA_VERSION;
  const threads = Array.isArray(source.threads) ? source.threads : (hasLegacyArrays ? legacyWorldRecords(source) : []);
  const fallbackSource = normalizeSourceRef({}, { chatId: options.chatId || source.chatId, at: source.updatedAt });
  const world = {
    ...base,
    ...source,
    schemaVersion: WORLD_SCHEMA_VERSION,
    chatId: cleanText(options.chatId, cleanText(source.chatId)),
    revision: Math.max(0, Number(source.revision) || 0),
    commitId: cleanText(source.commitId),
    observedThrough: { ...base.observedThrough, ...(source.observedThrough || {}) },
    simulatedThrough: { ...base.simulatedThrough, ...(source.simulatedThrough || {}) },
    summary: cleanText(source.summary),
    threads: threads.slice(0, 160).map((entry, index) => normalizeThread(entry, index, fallbackSource)),
    lanes: {
      actors: (Array.isArray(source?.lanes?.actors) ? source.lanes.actors : []).slice(0, 120).map(normalizeActorLane),
      factions: (Array.isArray(source?.lanes?.factions) ? source.lanes.factions : []).slice(0, 80).map(normalizeFactionLane),
      environment: {
        summary: cleanText(source?.lanes?.environment?.summary),
        economy: cleanText(source?.lanes?.environment?.economy),
        incidents: cleanStringArray(source?.lanes?.environment?.incidents, 40),
        trends: cleanStringArray(source?.lanes?.environment?.trends, 40),
        winds: cleanStringArray(source?.lanes?.environment?.winds, 40),
      },
    },
    attempts: (Array.isArray(source.attempts) ? source.attempts : []).slice(-160).map((entry, index) => normalizeAttempt(entry, index, fallbackSource)),
    adjudications: (Array.isArray(source.adjudications) ? source.adjudications : []).slice(-160).map((entry, index) => normalizeAdjudication(entry, index, fallbackSource)),
    resolvedArchive: (Array.isArray(source.resolvedArchive) ? source.resolvedArchive : []).slice(-160).map((entry, index) => normalizeThread(entry, index, fallbackSource)),
    tombstoneThroughTurn: Math.max(0, Number(source.tombstoneThroughTurn) || 0),
    recall: {
      pending: source?.recall?.pending && typeof source.recall.pending === 'object' ? deepClone(source.recall.pending) : null,
      receipts: (Array.isArray(source?.recall?.receipts) ? source.recall.receipts : []).slice(-80).map((entry) => ({ ...entry })),
    },
    failures: (Array.isArray(source.failures) ? source.failures : []).slice(-40).map((entry) => ({ ...entry })),
    checkpoint: source.checkpoint && typeof source.checkpoint === 'object' ? { ...base.checkpoint, ...deepClone(source.checkpoint) } : base.checkpoint,
    persistence: source.persistence && typeof source.persistence === 'object' ? { ...base.persistence, ...source.persistence } : base.persistence,
    migration: source.migration || (needsMigration ? { fromSchema, at: new Date().toISOString(), legacyItems: hasLegacyArrays ? threads.length : 0, unifiedItems: Array.isArray(source.threads) ? threads.length : 0 } : null),
    updatedAt: cleanText(source.updatedAt, base.updatedAt),
  };
  for (const legacyKey of ['branches', 'npcIntents', 'agreements', 'hostilePlans']) delete world[legacyKey];
  if (needsMigration) {
    world.persistence = {
      status: 'unverified', revision: world.revision, commitId: world.commitId,
      digest: '', readbackAt: '', error: `世界状态已从v${fromSchema}升级到v${WORLD_SCHEMA_VERSION}，等待下一次保存读回证明`,
    };
  }
  world.digest = needsMigration ? worldDigest(world) : cleanText(source.digest, worldDigest(world));
  if (needsMigration) world.persistence.digest = world.digest;
  return world;
}

function mergeByStableId(previous, updates, normalizer, keyName = 'id') {
  const result = new Map((previous || []).map((entry) => [entry[keyName], deepClone(entry)]));
  for (let index = 0; index < (updates || []).length; index += 1) {
    const normalized = normalizer(updates[index], index);
    const prior = result.get(normalized[keyName]);
    result.set(normalized[keyName], prior ? { ...prior, ...normalized } : normalized);
  }
  return [...result.values()];
}

export function parseWorldProposal(raw) {
  const parsed = extractJsonObject(raw);
  const legacy = ['branches', 'npcIntents', 'agreements', 'hostilePlans'].some((key) => Array.isArray(parsed?.[key]));
  const threads = legacy ? legacyWorldRecords(parsed) : (Array.isArray(parsed.threads) ? parsed.threads : []);
  return {
    summary: cleanText(parsed.summary),
    threads,
    actorActions: Array.isArray(parsed.actorActions) ? parsed.actorActions : (Array.isArray(parsed.attempts) ? parsed.attempts : []),
    adjudications: Array.isArray(parsed.adjudications) ? parsed.adjudications : [],
    factions: Array.isArray(parsed.factions) ? parsed.factions : (Array.isArray(parsed?.lanes?.factions) ? parsed.lanes.factions : []),
    environment: parsed.environment && typeof parsed.environment === 'object' ? parsed.environment : (parsed?.lanes?.environment || {}),
    resolvedThreadIds: cleanStringArray(parsed.resolvedThreadIds),
  };
}

function worldLinkKey(value) {
  return cleanText(value).toLocaleLowerCase();
}

function proposalThreadCandidates(previousInput, proposal) {
  const previous = normalizeWorldState(previousInput, { chatId: previousInput?.chatId });
  const proposed = (proposal.threads || []).map((entry, index) => normalizeThread(entry, index));
  const byId = new Map(previous.threads.map((thread) => [thread.id, thread]));
  for (const thread of proposed) byId.set(thread.id, thread);
  return { proposed, all: [...byId.values()] };
}

function exactThreadCandidates(threads, action) {
  const explicitTitle = worldLinkKey(action?.threadTitle || action?.thread || action?.sourceThreadTitle);
  if (explicitTitle) {
    const titleMatches = threads.filter((thread) => worldLinkKey(thread.title) === explicitTitle);
    if (titleMatches.length) return { matches: titleMatches, method: 'exact_title' };
  }
  const actor = worldLinkKey(action?.actorId || action?.actor || action?.actorName);
  if (actor) {
    const actorMatches = threads.filter((thread) => cleanStringArray(thread.actorIds).some((id) => worldLinkKey(id) === actor));
    if (actorMatches.length) return { matches: actorMatches, method: 'unique_actor_thread' };
  }
  return { matches: [], method: '' };
}

/**
 * Repair only referential omissions that have one provable target. This is a
 * format-normalization step, not semantic guessing: ambiguous links remain
 * empty so strict validation can request a corrected model response.
 */
export function repairWorldProposalLinks(previousInput = {}, proposalInput = {}) {
  const proposal = deepClone(proposalInput && typeof proposalInput === 'object' ? proposalInput : {});
  proposal.threads = Array.isArray(proposal.threads) ? proposal.threads : [];
  proposal.actorActions = Array.isArray(proposal.actorActions) ? proposal.actorActions : [];
  proposal.adjudications = Array.isArray(proposal.adjudications) ? proposal.adjudications : [];
  const candidates = proposalThreadCandidates(previousInput, proposal);
  const repairs = [];

  proposal.actorActions = proposal.actorActions.map((entry, index) => {
    const action = { ...(entry || {}) };
    if (cleanText(action.threadId)) return action;
    let inferred = exactThreadCandidates(candidates.proposed, action);
    if (inferred.matches.length !== 1 && candidates.proposed.length === 1) {
      inferred = { matches: candidates.proposed, method: 'only_proposed_thread' };
    }
    if (inferred.matches.length === 0) inferred = exactThreadCandidates(candidates.all, action);
    if (inferred.matches.length === 1) {
      action.threadId = inferred.matches[0].id;
      repairs.push({ kind: 'actorAction.threadId', index, method: inferred.method });
    } else if (inferred.matches.length === 0 && cleanText(action.actorId || action.actor || action.actorName) && cleanText(action.action || action.intent)) {
      const actorId = cleanText(action.actorId || action.actor || action.actorName);
      const actionText = cleanText(action.action, cleanText(action.intent));
      const title = cleanText(action.goal, cleanText(action.intent, actionText));
      const derived = normalizeThread({
        kind: 'personal',
        title,
        stage: 'advancing',
        actorIds: [actorId],
        locations: action.locations || action.location,
        keywords: action.keywords,
        summary: actionText,
        offscreenBeat: actionText,
        publicTitle: cleanText(action.publicTitle),
        publicSurface: cleanText(action.publicSurface),
        publicClues: cleanStringArray(action.publicClues, 16),
        nextBeat: actionText,
        stakes: cleanText(action.risk, cleanStringArray(action.resourceCosts).join('；')),
        knowledge: ['hidden', 'rumor', 'observed'].includes(action.threadKnowledge) ? action.threadKnowledge : 'hidden',
      }, proposal.threads.length);
      proposal.threads.push(derived);
      candidates.proposed.push(derived);
      candidates.all.push(derived);
      action.threadId = derived.id;
      repairs.push({ kind: 'thread.created', index: proposal.threads.length - 1, method: 'derived_from_unlinked_action' });
      repairs.push({ kind: 'actorAction.threadId', index, method: 'derived_action_thread' });
    }
    return action;
  });

  proposal.adjudications = proposal.adjudications.map((entry, index) => {
    const result = { ...(entry || {}) };
    const actor = worldLinkKey(result.actorId || result.actor || result.actorName);
    const threadId = cleanText(result.threadId);
    const attemptId = cleanText(result.attemptId);
    let actions = proposal.actorActions.filter((action) => {
      if (actor && worldLinkKey(action.actorId || action.actor || action.actorName) !== actor) return false;
      if (threadId && cleanText(action.threadId) !== threadId) return false;
      if (attemptId && cleanText(action.attemptId) && cleanText(action.attemptId) !== attemptId) return false;
      return Boolean(cleanText(action.threadId));
    });
    if (!actor && !threadId && !attemptId) actions = [];
    if (!threadId && actions.length === 1) {
      result.threadId = actions[0].threadId;
      repairs.push({ kind: 'adjudication.threadId', index, method: 'unique_matching_action' });
    }
    if (!actor && actions.length === 1) {
      result.actorId = cleanText(actions[0].actorId || actions[0].actor || actions[0].actorName);
      repairs.push({ kind: 'adjudication.actorId', index, method: 'unique_matching_action' });
    }
    if (!attemptId && actions.length === 1 && cleanText(actions[0].attemptId)) {
      result.attemptId = actions[0].attemptId;
      repairs.push({ kind: 'adjudication.attemptId', index, method: 'unique_matching_action' });
    }
    return result;
  });

  return { proposal, repairs };
}

export function validateWorldProposal(proposal = {}, options = {}) {
  const errors = [];
  if (cleanText(proposal.summary).length < 6) errors.push('summary需要用完整句说明本轮世界总体变化');
  const threads = Array.isArray(proposal.threads) ? proposal.threads : [];
  const actions = Array.isArray(proposal.actorActions) ? proposal.actorActions : [];
  const adjudications = Array.isArray(proposal.adjudications) ? proposal.adjudications : [];
  const factions = Array.isArray(proposal.factions) ? proposal.factions : [];
  const environment = proposal.environment && typeof proposal.environment === 'object' ? proposal.environment : {};
  const previousWorld = normalizeWorldState(options.previous || {}, { chatId: options.previous?.chatId });
  const environmentHasContent = [environment.summary, environment.economy, ...(environment.incidents || []), ...(environment.trends || []), ...(environment.winds || [])].some((item) => cleanText(item));
  if (!threads.length && !actions.length && !adjudications.length && !factions.length && !environmentHasContent && !(proposal.resolvedThreadIds || []).length) {
    errors.push('本轮没有任何连续性、人物、阵营、环境或解决历史变化');
  }
  threads.forEach((entry, index) => {
    const old = previousWorld.threads.find((thread) => cleanText(thread.id) === cleanText(entry?.id));
    const merged = old ? { ...old, ...entry } : entry;
    if (!cleanText(entry?.title)) errors.push(`threads[${index}]缺少title`);
    if (![entry?.summary, entry?.offscreenBeat, entry?.nextBeat, entry?.stakes, entry?.intent, entry?.consequence].some((item) => cleanText(item))) {
      errors.push(`threads[${index}]没有可用的进展、下一步或代价`);
    }
    const publicLeak = publicProjectionLeak([merged?.publicTitle, merged?.publicSurface, ...(Array.isArray(merged?.publicClues) ? merged.publicClues : [])]);
    if (publicLeak) errors.push(`threads[${index}]公开投影含有不可直接公开的隐秘叙述：${publicLeak.slice(0, 80)}`);
    if (merged?.knowledge === 'rumor' && publicProjectionLeak(merged?.rumors)) {
      errors.push(`threads[${index}]传闻字段写成了确定的隐秘事实`);
    }
    if (merged?.knowledge === 'observed') {
      const alreadyObserved = old?.knowledge === 'observed' && cleanText(old?.revealedSummary) === cleanText(merged?.revealedSummary);
      if (!alreadyObserved && !exactNarrativeEvidence(options.acceptedText, merged?.revealEvidence)) {
        errors.push(`threads[${index}]声明已揭示但revealEvidence不是本轮最终正文的精确原文`);
      }
      if (!cleanText(merged?.revealedSummary)) errors.push(`threads[${index}]已揭示但缺少只覆盖已公开范围的revealedSummary`);
    }
  });
  actions.forEach((entry, index) => {
    if (!cleanText(entry?.actorId || entry?.actor || entry?.actorName)) errors.push(`actorActions[${index}]缺少人物标识`);
    if (!cleanText(entry?.threadId)) errors.push(`actorActions[${index}]缺少threadId`);
    if (!cleanText(entry?.action || entry?.intent)) errors.push(`actorActions[${index}]缺少具体行动尝试`);
    const publicLeak = publicProjectionLeak([entry?.publicSurface, ...(Array.isArray(entry?.publicClues) ? entry.publicClues : [])]);
    if (publicLeak) errors.push(`actorActions[${index}]公开投影含有不可直接公开的隐秘叙述：${publicLeak.slice(0, 80)}`);
  });
  adjudications.forEach((entry, index) => {
    if (!cleanText(entry?.threadId) && !cleanText(entry?.attemptId)) errors.push(`adjudications[${index}]缺少threadId或attemptId`);
    if (!cleanText(entry?.resultSummary || entry?.observableConsequence || entry?.consequence)) errors.push(`adjudications[${index}]缺少裁决结果`);
    const publicLeak = publicProjectionLeak([entry?.observableConsequence, ...(Array.isArray(entry?.publicClues) ? entry.publicClues : [])]);
    if (publicLeak) errors.push(`adjudications[${index}]可观察后果泄露了隐秘原因：${publicLeak.slice(0, 80)}`);
  });
  return { ok: errors.length === 0, errors };
}

function profileIdentityMap(profiles = []) {
  const map = new Map();
  for (const profile of Array.isArray(profiles) ? profiles : Object.values(profiles || {})) {
    const id = cleanText(profile?.profileId);
    const name = cleanText(profile?.name);
    if (id) map.set(id.toLocaleLowerCase(), profile);
    if (name) map.set(name.toLocaleLowerCase(), profile);
    for (const alias of cleanStringArray(profile?.aliases)) map.set(alias.toLocaleLowerCase(), profile);
  }
  return map;
}

export function applyWorldProposal(previousInput, proposalInput, options = {}) {
  const previous = normalizeWorldState(previousInput, { chatId: options.chatId });
  const proposal = proposalInput && typeof proposalInput === 'object' ? proposalInput : {};
  const now = cleanText(options.at, new Date().toISOString());
  const turn = Math.max(Number(previous.observedThrough?.turn) + 1, Number(options.turn) || 0);
  const sourceRef = normalizeSourceRef(options.sourceRef, { chatId: options.chatId || previous.chatId, turn, at: now });
  const priorThreads = new Map(previous.threads.map((thread) => [cleanText(thread.id), thread]));
  const normalizedUpdates = (proposal.threads || []).map((entry, index) => {
    const prior = priorThreads.get(cleanText(entry?.id));
    return normalizeThread(prior ? { ...prior, ...entry } : entry, index, sourceRef);
  });
  const resolvedIds = new Set(cleanStringArray(proposal.resolvedThreadIds));
  for (const thread of normalizedUpdates) if (thread.stage === 'resolved') resolvedIds.add(thread.id);
  const mergedThreads = mergeByStableId(previous.threads, normalizedUpdates, (entry, index) => normalizeThread(entry, index, sourceRef));
  const activeThreads = [];
  const archive = new Map((previous.resolvedArchive || []).map((entry) => [entry.id, entry]));
  for (const thread of mergedThreads) {
    if (resolvedIds.has(thread.id) || thread.stage === 'resolved') archive.set(thread.id, { ...thread, stage: 'resolved', updatedAt: now });
    else activeThreads.push(thread);
  }

  const identities = profileIdentityMap(options.profiles);
  const newAttempts = [];
  const newResults = [];
  const actorLaneUpdates = [];
  for (let index = 0; index < (proposal.actorActions || []).length; index += 1) {
    const raw = proposal.actorActions[index] || {};
    const identity = identities.get(cleanText(raw.actorId || raw.actor || raw.actorName).toLocaleLowerCase());
    const actorId = cleanText(identity?.profileId, cleanText(raw.actorId, cleanText(raw.actor)));
    const attempt = normalizeAttempt({ ...raw, actorId, actorName: identity?.name || raw.actorName || raw.actor }, index, sourceRef);
    if (!identity) {
      actorLaneUpdates.push(normalizeActorLane({ actorId: attempt.actorId || `unready-${index + 1}`, name: attempt.actorName, goal: raw.goal || raw.intent, status: 'blocked_unready', sourceThreadIds: [attempt.threadId] }, index));
      continue;
    }
    attempt.status = 'pending_world';
    newAttempts.push(attempt);
    const rawResult = (proposal.adjudications || []).find((item) => cleanText(item?.attemptId) === attempt.attemptId || (cleanText(item?.actorId || item?.actor) === cleanText(raw.actorId || raw.actor) && cleanText(item?.threadId) === attempt.threadId));
    if (rawResult) {
      const result = normalizeAdjudication({ ...rawResult, attemptId: attempt.attemptId, actorId }, index, sourceRef);
      if (result.resultSummary || result.observableConsequence) {
        newResults.push(result);
        attempt.status = 'settled';
      }
    }
    actorLaneUpdates.push(normalizeActorLane({ actorId, name: identity.name, goal: raw.goal || identity?.currentState?.goal, planSteps: raw.planSteps, nextActionTurn: Number(raw.nextActionTurn) || turn + 1, lastActionTurn: turn, silenceTurns: 0, status: 'ready', lastAction: attempt.action, sourceThreadIds: [attempt.threadId] }, index));
  }

  const actors = mergeByStableId(previous.lanes.actors, actorLaneUpdates, normalizeActorLane, 'actorId').slice(-120);
  const acted = new Set(actorLaneUpdates.map((entry) => entry.actorId));
  for (const lane of actors) if (!acted.has(lane.actorId)) lane.silenceTurns = Math.max(0, Number(lane.silenceTurns) || 0) + 1;
  const factions = mergeByStableId(previous.lanes.factions, proposal.factions || [], normalizeFactionLane).slice(-80);
  const environment = {
    summary: cleanText(proposal?.environment?.summary, previous.lanes.environment.summary),
    economy: cleanText(proposal?.environment?.economy, previous.lanes.environment.economy),
    incidents: cleanStringArray([...(previous.lanes.environment.incidents || []), ...(proposal?.environment?.incidents || [])], 40),
    trends: cleanStringArray([...(previous.lanes.environment.trends || []), ...(proposal?.environment?.trends || [])], 40),
    winds: cleanStringArray([...(previous.lanes.environment.winds || []), ...(proposal?.environment?.winds || [])], 40),
  };
  const revision = previous.revision + 1;
  const commitId = stableWorldId('commit', previous.chatId, revision, sourceRef.sourceKey, now);
  const candidate = normalizeWorldState({
    ...previous,
    revision,
    commitId,
    observedThrough: { turn, sourceKey: sourceRef.sourceKey, at: now },
    simulatedThrough: { turn, sourceKey: sourceRef.sourceKey, at: now },
    summary: cleanText(proposal.summary, previous.summary || '世界连续性已推进。'),
    threads: activeThreads,
    lanes: { actors, factions, environment },
    attempts: [...previous.attempts, ...newAttempts].slice(-160),
    adjudications: [...previous.adjudications, ...newResults].slice(-160),
    resolvedArchive: [...archive.values()].slice(-160),
    tombstoneThroughTurn: resolvedIds.size ? turn : previous.tombstoneThroughTurn,
    checkpoint: { state: 'world_committed', candidate: null, candidateDigest: '', preparedAt: '', committedAt: now },
    persistence: { status: 'unverified', revision, commitId, digest: '', readbackAt: '', error: '' },
    updatedAt: now,
  }, { chatId: options.chatId || previous.chatId });
  candidate.digest = worldDigest(candidate);
  candidate.persistence.digest = candidate.digest;
  return candidate;
}

export function prepareWorldTransaction(previousInput, candidateInput, at = new Date().toISOString()) {
  const previous = normalizeWorldState(previousInput, { chatId: previousInput?.chatId });
  const candidate = normalizeWorldState(candidateInput, { chatId: previous.chatId });
  if (candidate.revision !== previous.revision + 1) throw new Error(`世界候选版本不连续：当前${previous.revision}，候选${candidate.revision}`);
  const prepared = deepClone(previous);
  prepared.checkpoint = { state: 'world_candidate_prepared', candidate, candidateDigest: candidate.digest, preparedAt: at, committedAt: '' };
  prepared.persistence = { ...prepared.persistence, status: 'prepared', error: '' };
  prepared.updatedAt = at;
  return prepared;
}

export function recoverPreparedWorldState(input, at = new Date().toISOString()) {
  const prepared = normalizeWorldState(input, { chatId: input?.chatId });
  if (prepared.checkpoint?.state !== 'world_candidate_prepared' || !prepared.checkpoint?.candidate) return { recovered: false, world: prepared };
  const candidate = normalizeWorldState(prepared.checkpoint.candidate, { chatId: prepared.chatId });
  if (candidate.digest !== prepared.checkpoint.candidateDigest || candidate.revision !== prepared.revision + 1) {
    prepared.checkpoint = { state: 'world_committed', candidate: null, candidateDigest: '', preparedAt: '', committedAt: '' };
    prepared.persistence = { ...prepared.persistence, status: 'error', error: '待提交世界候选校验失败，已保留旧权威状态' };
    return { recovered: false, world: prepared, error: prepared.persistence.error };
  }
  candidate.checkpoint = { state: 'world_committed', candidate: null, candidateDigest: '', preparedAt: prepared.checkpoint.preparedAt, committedAt: at };
  candidate.persistence = { status: 'unverified', revision: candidate.revision, commitId: candidate.commitId, digest: candidate.digest, readbackAt: '', error: '' };
  candidate.updatedAt = at;
  return { recovered: true, world: candidate };
}

export function markWorldReadback(input, at = new Date().toISOString()) {
  const world = normalizeWorldState(input, { chatId: input?.chatId });
  world.persistence = { status: 'verified', revision: world.revision, commitId: world.commitId, digest: world.digest, readbackAt: at, error: '' };
  return world;
}

export function verifyWorldReadback(readbackInput, candidateInput) {
  const readback = normalizeWorldState(readbackInput, { chatId: candidateInput?.chatId });
  const candidate = normalizeWorldState(candidateInput, { chatId: candidateInput?.chatId });
  return readback.revision === candidate.revision && readback.commitId === candidate.commitId && readback.digest === candidate.digest && readback.checkpoint?.state === 'world_committed';
}

export function activeWorldCount(worldInput) {
  const world = normalizeWorldState(worldInput, { chatId: worldInput?.chatId });
  const environment = world.lanes.environment;
  const environmentActive = environment.summary || environment.economy || environment.incidents.length || environment.trends.length || environment.winds.length ? 1 : 0;
  return world.threads.length
    + world.lanes.actors.filter((entry) => entry.status !== 'inactive').length
    + world.lanes.factions.filter((entry) => entry.status !== 'resolved' && entry.status !== 'inactive').length
    + world.attempts.filter((entry) => entry.status === 'pending_world').length
    + environmentActive;
}

export function recoverLatestLegacyWorld(currentInput, fullRuns = [], options = {}) {
  let world = normalizeWorldState(currentInput, { chatId: options.chatId });
  let best = null;
  for (const run of Array.isArray(fullRuns) ? fullRuns : []) {
    if (options.chatId && cleanText(run?.chatId) !== cleanText(options.chatId)) continue;
    const candidates = [run?.outcome?.world?.world, ...(Array.isArray(run?.trace) ? run.trace.filter((item) => item?.stage === 'world:committed').map((item) => item.world) : [])];
    for (const candidate of candidates) {
      if (!candidate || Number(candidate.schemaVersion) === WORLD_SCHEMA_VERSION) continue;
      const time = Date.parse(candidate.updatedAt || run.finishedAt || 0) || 0;
      if (!best || time > best.time) best = { candidate, time, runId: run.runId || '' };
    }
  }
  if (!best) return { changed: false, world };
  const recoveredThreads = Array.isArray(best.candidate?.threads)
    ? normalizeWorldState(best.candidate, { chatId: options.chatId }).threads
    : legacyWorldRecords(best.candidate);
  const merged = mergeByStableId(world.threads, recoveredThreads, (entry, index) => normalizeThread(entry, index, { chatId: options.chatId }));
  if (merged.length <= world.threads.length) return { changed: false, world };
  const recoveredItems = merged.length - world.threads.length;
  world.threads = merged;
  world.summary = cleanText(best.candidate.summary, world.summary);
  world.migration = { ...(world.migration || {}), recoveredFromRunId: best.runId, recoveredItems, at: new Date().toISOString() };
  world.digest = worldDigest(world);
  return { changed: true, world };
}

export function worldConsistencyReport(worldInput, fullRuns = [], options = {}) {
  const world = normalizeWorldState(worldInput, { chatId: options.chatId || worldInput?.chatId });
  let latest = null;
  for (const run of Array.isArray(fullRuns) ? fullRuns : []) {
    if (options.chatId && cleanText(run?.chatId) !== cleanText(options.chatId)) continue;
    const records = [run?.outcome?.world?.world, ...(Array.isArray(run?.trace) ? run.trace.filter((entry) => entry?.stage === 'world:committed').map((entry) => entry.world) : [])];
    for (const candidate of records) {
      if (!candidate) continue;
      const at = Date.parse(candidate.updatedAt || run.finishedAt || 0) || 0;
      if (!latest || at > latest.at) latest = { candidate, at, runId: run.runId || '' };
    }
  }
  if (!latest) return { ok: true, status: 'no_report', detail: '当前聊天还没有可比较的世界提交报告。' };
  if (Number(latest.candidate.schemaVersion) >= 4 || Array.isArray(latest.candidate?.threads)) {
    const candidate = normalizeWorldState(latest.candidate, { chatId: world.chatId });
    const ok = candidate.revision < world.revision || (candidate.revision === world.revision && candidate.digest === world.digest && candidate.commitId === world.commitId);
    return ok
      ? { ok: true, status: 'matched', detail: `权威状态与最近报告 ${latest.runId || '未命名运行'} 一致。` }
      : { ok: false, status: 'split_brain', detail: `最近报告是修订${candidate.revision}/${candidate.digest}，权威存档是修订${world.revision}/${world.digest}` };
  }
  const reportIds = new Set(legacyWorldRecords(latest.candidate).map((entry) => entry.id));
  const worldIds = new Set(world.threads.map((entry) => entry.id));
  const missing = [...reportIds].filter((id) => !worldIds.has(id));
  return missing.length
    ? { ok: false, status: 'legacy_report_ahead', detail: `旧完整报告仍有 ${missing.length} 条世界项未进入权威存档。` }
    : { ok: true, status: 'legacy_covered', detail: '旧完整报告中的世界项已被当前统一状态覆盖。' };
}

// Compatibility wrapper for older callers and reports. New runtime uses parseWorldProposal + applyWorldProposal.
export function parseWorldState(raw, previous = {}) {
  return applyWorldProposal(previous, parseWorldProposal(raw), { chatId: previous?.chatId });
}

function tokens(text) {
  return [...new Set(String(text || '').toLocaleLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) || [])];
}

function safePublicText(value) {
  const text = cleanText(value);
  return publicProjectionLeak(text) ? '' : text;
}

function safePublicArray(value, limit = 16) {
  return cleanStringArray(value, limit).filter((item) => !publicProjectionLeak(item));
}

function narrativeThreadProjection(entry) {
  const knowledge = ['hidden', 'rumor', 'observed'].includes(entry?.knowledge) ? entry.knowledge : 'hidden';
  const publicSurface = safePublicText(entry?.publicSurface);
  const publicClues = safePublicArray(entry?.publicClues, 16);
  const rumors = knowledge === 'rumor' ? safePublicArray(entry?.rumors, 12) : [];
  const revealedSummary = knowledge === 'observed' ? cleanText(entry?.revealedSummary) : '';
  if (!publicSurface && !publicClues.length && !rumors.length && !revealedSummary) return null;
  const projection = {
    recordType: knowledge === 'observed' ? 'revealed_continuity' : knowledge === 'rumor' ? 'unverified_rumor' : 'sensory_surface',
    title: safePublicText(entry?.publicTitle) || (knowledge === 'observed' ? '已揭示事项' : ''),
    publicSurface,
    publicClues,
    rumors,
    revealedSummary,
    instruction: knowledge === 'observed'
      ? '这是已由正文证据揭示的事实。'
      : knowledge === 'rumor'
        ? '只能写成不确定传闻或可见线索，不得写成真相。'
        : '只可使用表象与线索；隐藏原因、真实意图和镜头外行动不得出现在回复中。',
  };
  return projection;
}

function narrativeAttemptProjection(entry, adjudication) {
  const visibility = ['hidden', 'rumor', 'observable'].includes(entry?.visibility) ? entry.visibility : 'hidden';
  const publicSurface = safePublicText(entry?.publicSurface);
  const publicClues = safePublicArray([...(entry?.publicClues || []), ...(adjudication?.publicClues || [])], 16);
  const observableConsequence = safePublicText(adjudication?.observableConsequence);
  const visibleAction = visibility === 'observable' ? safePublicText(entry?.action) : '';
  if (!publicSurface && !publicClues.length && !observableConsequence && !visibleAction) return null;
  const projection = {
    recordType: visibility === 'observable' ? 'observable_actor_action' : visibility === 'rumor' ? 'unverified_action_rumor' : 'unattributed_observation',
    visibleAction,
    publicSurface,
    publicClues,
    observableConsequence,
    instruction: visibility === 'observable'
      ? '只写已经可观察的行动和后果。'
      : '只写表象或无因果归属的可见后果；不得猜出行动者、目的、行动内容或成败。',
  };
  if (visibility === 'observable') {
    projection.actorId = entry.actorId;
    projection.actorName = entry.actorName;
    projection.adjudicationStatus = cleanText(adjudication?.status);
  }
  return projection;
}

export function selectWorldRecall(world, userInput, profiles = {}, limit = 8) {
  if (Number(world?.schemaVersion) === WORLD_SCHEMA_VERSION || Array.isArray(world?.threads)) {
    const normalized = normalizeWorldState(world, { chatId: world?.chatId });
    const needle = new Set(tokens(userInput));
    for (const profile of Object.values(profiles || {})) {
      if (String(userInput || '').includes(profile?.name || '\0')) for (const token of normalizedNames(profile)) needle.add(token);
    }
    const resultsByAttempt = new Map(normalized.adjudications.map((entry) => [entry.attemptId, entry]));
    const records = [
      ...normalized.threads.map((entry) => ({ ...entry, recordType: 'thread' })),
      ...normalized.attempts.slice(-40).map((entry) => ({ ...entry, recordType: 'attempt', adjudication: resultsByAttempt.get(entry.attemptId) || null })),
    ].map((entry) => {
      const haystack = tokens(JSON.stringify(entry));
      let score = Number(entry.urgency) || (entry.recordType === 'attempt' ? 3 : 2);
      for (const token of haystack) {
        if (needle.has(token)) score += 5;
        else if ([...needle].some((part) => token.includes(part) || part.includes(token))) score += 2;
      }
      return { ...entry, score };
    }).sort((a, b) => b.score - a.score || String(b.updatedAt || b.sourceRef?.at || '').localeCompare(String(a.updatedAt || a.sourceRef?.at || '')));
    return records
      .map((entry) => {
        const projected = entry.recordType === 'thread'
          ? narrativeThreadProjection(entry)
          : narrativeAttemptProjection(entry, entry.adjudication);
        return projected ? { ...projected, score: entry.score } : null;
      })
      .filter(Boolean)
      .slice(0, Math.max(1, Math.min(16, Number(limit) || 8)));
  }
  return selectWorldRecall(normalizeWorldState(world, { chatId: world?.chatId }), userInput, profiles, limit);
}

export function prepareRecallPackage(worldInput, userInput, profiles = {}, limit = 8, options = {}) {
  const world = normalizeWorldState(worldInput, { chatId: options.chatId || worldInput?.chatId });
  const items = selectWorldRecall(world, userInput, profiles, limit).map(({ score, ...entry }) => entry);
  const packageId = stableWorldId('recall', world.chatId, world.revision, options.sourceKey, userInput, options.at || new Date().toISOString());
  return { packageId, worldRevision: world.revision, worldCommitId: world.commitId, items, preparedAt: options.at || new Date().toISOString(), sourceKey: cleanText(options.sourceKey) };
}

export function reserveRecallPackage(worldInput, recallPackage) {
  const world = normalizeWorldState(worldInput, { chatId: worldInput?.chatId });
  world.recall.pending = { ...deepClone(recallPackage), itemsDigest: stableWorldId('items', JSON.stringify(recallPackage?.items || [])) };
  return world;
}

export function settleRecallPackage(worldInput, packageId, status, options = {}) {
  const world = normalizeWorldState(worldInput, { chatId: worldInput?.chatId });
  const pending = world.recall.pending;
  if (!pending || pending.packageId !== packageId) return { changed: false, world };
  world.recall.receipts.push({ packageId, status: ['consumed', 'released'].includes(status) ? status : 'released', sourceKey: cleanText(options.sourceKey), messageId: Number.isInteger(Number(options.messageId)) ? Number(options.messageId) : null, at: options.at || new Date().toISOString() });
  world.recall.receipts = world.recall.receipts.slice(-80);
  world.recall.pending = null;
  world.digest = worldDigest(world);
  return { changed: true, world };
}

export function formatGenerationInjection({ tickets, recall, profileDigest = [] }) {
  return [
    '<MVUDoctorRuntime>',
    'characterCreationTicket（按首次出现顺序使用；有权威设定或已有档案者跳过）：',
    JSON.stringify(tickets || []),
    'worldRecallPackage_publicProjection（仅供本次生成消费一次；这是医生私有世界状态生成的公开投影，不含可直接公开的隐藏真相）：',
    JSON.stringify(recall || []),
    '只能使用每项的publicSurface、publicClues、rumors、revealedSummary、visibleAction与observableConsequence。不得从recordType、空白字段、标签或线索反推出隐藏动机、真实身份、镜头外行动及其成败；传闻不得写成事实。',
    '召回包不得覆盖玩家当前指令、角色卡、世界书、已接受事实或MVU当前状态。任何平行事件详情、NPC私密心理与未揭示真相都由医生继续在私有世界状态中推进，主回复不得输出。',
    '已有人物档案公开身份句柄（只表示不得重复随机，不代表其档案中的隐藏资料可被叙事者知道）：',
    JSON.stringify(profileDigest || []),
    '</MVUDoctorRuntime>',
  ].join('\n');
}

export function profileDigestFromData(data, limit = 60) {
  return Object.values(existingProfilesFromData(data)).slice(0, limit).map((profile) => {
    const knownNames = cleanStringArray(profile?.narrativeKnownNames, 24);
    return {
      profileHandle: stableWorldId('profile-public', profile?.profileId, profile?.name),
      knownNames,
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
