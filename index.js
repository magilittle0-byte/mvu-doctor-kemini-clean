(() => {
  'use strict';

  const PLUGIN_ID = 'mvu-doctor-kemini-clean';
  const PROMPT_KEY = 'mvu-doctor-kemini-clean-runtime';
  const DEFAULT_API = Object.freeze({ mode: 'tavern', endpoint: '', apiKey: '', model: '' });
  const DEFAULTS = Object.freeze({
    enabled: true,
    ticketCount: 8,
    recallLimit: 8,
    worldEngine: true,
    repairAttempts: 2,
    profileMaxTokens: 6000,
    worldMaxTokens: 3000,
    additionalPrompt: '',
    api: DEFAULT_API,
  });
  /* MVU_KEMINI_EMBEDDED_CORE_START */
  // Generated from core.mjs. The Tavern runtime is deliberately self-contained:
  // some extension loaders execute index.js without an active script element.
  const embeddedCore = (() => {
    const PROFILE_ROOT = '/人物档案';

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

    function deepClone(value) {
      if (typeof structuredClone === 'function') return structuredClone(value);
      return JSON.parse(JSON.stringify(value));
    }

    function randomIndex(length, random) {
      return Math.min(length - 1, Math.floor(Math.max(0, Math.min(0.999999999, random())) * length));
    }

    function generateTicketBatch(count = 8, random = Math.random, now = Date.now()) {
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

    function statDataOf(data) {
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
        .replace(/}\s*{/g, '},{')
        .replace(/]\s*\[/g, '],[')
        .replace(/([}\]])(\s*)"(?=[^"\r\n]+"\s*:)/g, '$1,$2"')
        .trim();
    }

    function parseJsonWithLocalRepair(text) {
      let candidate = repairJsonText(text);
      let lastError;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          return JSON.parse(candidate);
        } catch (error) {
          lastError = error;
          const position = Number(String(error?.message || '').match(/position\s+(\d+)/i)?.[1]);
          const commaExpected = /Expected\s+['"]?,['"]?\s+or|expected comma|array element|object property/i.test(String(error?.message || ''));
          if (!Number.isInteger(position) || !commaExpected) break;
          let insertAt = position;
          while (/\s/.test(candidate[insertAt] || '')) insertAt += 1;
          if (!insertAt || candidate[insertAt - 1] === ',' || candidate[insertAt] === ',') break;
          candidate = `${candidate.slice(0, insertAt)},${candidate.slice(insertAt)}`;
        }
      }
      throw lastError || new Error('JSON无法解析');
    }

    function parseProfileReceipt(message) {
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

    function stripProfileReceipt(message) {
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

    function prepareProfileBatch(rawProfiles, tickets, currentData) {
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

    function buildProfilePatch(currentData, profiles) {
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

    function verifyCommittedProfiles(data, profiles) {
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

    function openAiChatEndpoint(rawEndpoint) {
      const raw = String(rawEndpoint || '').trim();
      if (!raw) throw new Error('请填写API地址');
      const url = new URL(raw);
      const path = url.pathname.replace(/\/+$/, '');
      if (/\/chat\/completions$/i.test(path)) url.pathname = path;
      else if (/\/v\d+$/i.test(path)) url.pathname = `${path}/chat/completions`;
      else url.pathname = `${path}/v1/chat/completions`;
      return url.toString();
    }

    function openAiModelsEndpoint(rawEndpoint) {
      const url = new URL(openAiChatEndpoint(rawEndpoint));
      url.pathname = url.pathname.replace(/\/chat\/completions$/i, '/models');
      return url.toString();
    }

    function chatCompletionText(payload) {
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) return content;
      if (Array.isArray(content)) {
        const joined = content.map((part) => part?.text || part?.content || '').join('').trim();
        if (joined) return joined;
      }
      if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
      throw new Error('API响应缺少choices[0].message.content');
    }

    function redactDiagnostic(value) {
      return String(value || '')
        .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[已隐藏]')
        .replace(/((?:x-)?api[-_ ]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[已隐藏]')
        .replace(/\b(sk|key|token)-[A-Za-z0-9._-]{8,}\b/gi, '[已隐藏密钥]')
        .replace(/([?&](?:key|token|api_key)=)[^&#\s]+/gi, '$1[已隐藏]');
    }

    function diagnosticAdvice(kind, detail) {
      const text = `${kind || ''} ${detail || ''}`;
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
      if (/world|世界|支线/i.test(text)) {
        return { severity: 'error', summary: '人物档案阶段已结束，但世界支线没有完成推进。', action: '检查连接后点击“重试失败步骤”；已有世界记录会保留。' };
      }
      if (/completed|完成/i.test(text)) {
        return { severity: 'success', summary: '本轮人物档案和世界状态已经完成。', action: '无需处理。' };
      }
      return { severity: 'info', summary: '医生记录了一条运行信息。', action: '展开详情核对；若影响当前回合，可在修正配置后重试失败步骤。' };
    }

    function parseWorldState(raw, previous = {}) {
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

    function selectWorldRecall(world, userInput, profiles = {}, limit = 8) {
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

    function formatGenerationInjection({ tickets, recall, profileDigest = [] }) {
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

    function profileDigestFromData(data, limit = 60) {
      return Object.values(existingProfilesFromData(data)).slice(0, limit).map((profile) => ({
        profileId: profile.profileId,
        name: profile.name,
        aliases: profile.aliases || [],
        occupation: profile.identity?.occupation || '',
        currentGoal: profile.currentState?.goal || '',
      }));
    }

    function profilesFromData(data) {
      return deepClone(existingProfilesFromData(data));
    }

    return Object.freeze({ PROFILE_ROOT, deepClone, generateTicketBatch, statDataOf, parseProfileReceipt, stripProfileReceipt, prepareProfileBatch, buildProfilePatch, verifyCommittedProfiles, openAiChatEndpoint, openAiModelsEndpoint, chatCompletionText, redactDiagnostic, diagnosticAdvice, parseWorldState, selectWorldRecall, formatGenerationInjection, profileDigestFromData, profilesFromData });
  })();
  /* MVU_KEMINI_EMBEDDED_CORE_END */
  const runtime = {
    core: null,
    active: null,
    timer: null,
    internalGeneration: false,
    requestController: null,
    retry: null,
    retrying: false,
    uiProfiles: {},
    epoch: 0,
    status: { phase: '正在初始化', detail: '', profiles: 0, branches: 0, durationMs: 0 },
  };

  const getContext = () => window.SillyTavern?.getContext?.();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function randomUnit() {
    if (window.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0] / 0x100000000;
    }
    return Math.random();
  }

  function settings(context = getContext()) {
    context.extensionSettings ||= {};
    const saved = context.extensionSettings[PLUGIN_ID] || {};
    context.extensionSettings[PLUGIN_ID] = {
      ...DEFAULTS,
      ...saved,
      api: { ...DEFAULT_API, ...(saved.api || {}) },
    };
    return context.extensionSettings[PLUGIN_ID];
  }

  function saveSettings(context = getContext()) {
    if (typeof context?.saveSettingsDebounced === 'function') context.saveSettingsDebounced();
  }

  function metadata(context = getContext()) {
    context.chatMetadata ||= {};
    const current = context.chatMetadata[PLUGIN_ID] || {};
    const world = current.world || {};
    context.chatMetadata[PLUGIN_ID] = {
      ...current,
      schemaVersion: 2,
      world: {
        branches: Array.isArray(world.branches) ? world.branches : [],
        npcIntents: Array.isArray(world.npcIntents) ? world.npcIntents : [],
        agreements: Array.isArray(world.agreements) ? world.agreements : [],
        hostilePlans: Array.isArray(world.hostilePlans) ? world.hostilePlans : [],
        summary: String(world.summary || ''),
        ...(world.updatedAt ? { updatedAt: world.updatedAt } : {}),
      },
      diagnostics: Array.isArray(current.diagnostics) ? current.diagnostics : [],
    };
    return context.chatMetadata[PLUGIN_ID];
  }

  async function saveMetadata(context = getContext()) {
    if (typeof context?.saveMetadata === 'function') await context.saveMetadata();
    else if (typeof context?.saveChat === 'function') await context.saveChat();
  }

  function latestMessage(context, user) {
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    for (let index = chat.length - 1; index >= 0; index -= 1) {
      if (Boolean(chat[index]?.is_user) === user && typeof chat[index]?.mes === 'string') return { index, message: chat[index] };
    }
    return null;
  }

  function clearInjection(context = getContext()) {
    try { context?.setExtensionPrompt?.(PROMPT_KEY, '', 1, 1, false, 0); } catch { /* host unavailable */ }
  }

  function setStatus(phase, detail = '', extra = {}) {
    runtime.status = { ...runtime.status, phase, detail, ...extra };
    const root = document.getElementById(`${PLUGIN_ID}-root`);
    if (!root) return;
    const phaseNode = root.querySelector('[data-role="phase"]');
    const detailNode = root.querySelector('[data-role="detail"]');
    const metricsNode = root.querySelector('[data-role="metrics"]');
    if (phaseNode) phaseNode.textContent = runtime.status.phase;
    if (detailNode) detailNode.textContent = runtime.status.detail;
    if (metricsNode) metricsNode.textContent = `档案 ${runtime.status.profiles} · 活跃世界项 ${runtime.status.branches} · ${Math.round(runtime.status.durationMs / 100) / 10}s`;
    root.dataset.state = /失败|缺少|不可用|无法/.test(`${phase}${detail}`) ? 'error' : /完成|就绪|恢复/.test(phase) ? 'ready' : 'busy';
    renderStatusSurface(root);
  }

  function addDiagnostic(kind, detail, context = getContext()) {
    const store = metadata(context);
    store.diagnostics.unshift({ at: new Date().toISOString(), kind, detail: runtime.core.redactDiagnostic(detail) });
    store.diagnostics = store.diagnostics.slice(0, 30);
    renderDiagnostics();
  }

  async function getMvu() {
    if (window.Mvu) return window.Mvu;
    try {
      if (window.TavernHelper?.waitGlobalInitialized) await window.TavernHelper.waitGlobalInitialized('Mvu');
    } catch { /* fall through */ }
    return window.Mvu || null;
  }

  async function mvuDataAt(Mvu, messageId) {
    if (!Mvu?.getMvuData || !Number.isInteger(Number(messageId))) return null;
    try { return await Promise.resolve(Mvu.getMvuData({ type: 'message', message_id: Number(messageId) })); }
    catch { return null; }
  }

  async function waitForMvuIdle(Mvu, session) {
    while (typeof Mvu?.isDuringExtraAnalysis === 'function' && Mvu.isDuringExtraAnalysis()) {
      if (session.cancelled || runtime.epoch !== session.epoch) throw new Error('任务已被新回合或聊天切换取消');
      await sleep(250);
    }
  }

  function activeWorldCount(world) {
    return ['branches', 'npcIntents', 'agreements', 'hostilePlans']
      .flatMap((key) => world?.[key] || []).filter((entry) => entry.status !== 'resolved').length;
  }

  function setRetry(value) {
    runtime.retry = value;
    renderRetryControl();
  }

  function apiHeaders(api) {
    return {
      'Content-Type': 'application/json',
      ...(String(api.apiKey || '').trim() ? { Authorization: `Bearer ${String(api.apiKey).trim()}` } : {}),
    };
  }

  async function fetchJson(url, options = {}) {
    const fetcher = window.fetch?.bind(window) || globalThis.fetch;
    if (typeof fetcher !== 'function') throw new Error('当前宿主不支持fetch，无法使用自定义API');
    const response = await fetcher(url, options);
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}：${runtime.core.redactDiagnostic(raw).slice(0, 240) || response.statusText}`);
    }
    try { return JSON.parse(raw); }
    catch { throw new Error('API返回的不是JSON'); }
  }

  async function customCompletion({ systemPrompt, prompt, responseLength }) {
    const config = settings();
    const api = config.api;
    if (!String(api.model || '').trim()) throw new Error('请先在连接页填写模型名称');
    if (runtime.requestController) throw new Error('医生已有模型请求正在运行，请等待或先取消当前任务');
    const controller = new AbortController();
    runtime.requestController = controller;
    try {
      const payload = await fetchJson(runtime.core.openAiChatEndpoint(api.endpoint), {
        method: 'POST',
        headers: apiHeaders(api),
        signal: controller.signal,
        body: JSON.stringify({
          model: String(api.model).trim(),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: Math.max(256, Math.min(32768, Number(responseLength) || 3000)),
          stream: false,
        }),
      });
      return runtime.core.chatCompletionText(payload);
    } finally {
      if (runtime.requestController === controller) runtime.requestController = null;
    }
  }

  async function generateDoctorRaw({ systemPrompt, prompt, responseLength }) {
    const context = getContext();
    const config = settings(context);
    const extra = String(config.additionalPrompt || '').trim();
    const finalSystemPrompt = extra ? `${systemPrompt}\n\n【用户全局模型适配附加提示词】\n${extra}` : systemPrompt;
    runtime.internalGeneration = true;
    try {
      if (config.api.mode === 'custom') return await customCompletion({ systemPrompt: finalSystemPrompt, prompt, responseLength });
      if (typeof context?.generateRaw !== 'function') throw new Error('酒馆generateRaw不可用；请改用自定义API或检查酒馆模型连接');
      return await context.generateRaw({ systemPrompt: finalSystemPrompt, prompt, trimNames: false, responseLength });
    } finally {
      runtime.internalGeneration = false;
    }
  }

  async function fetchApiModels() {
    const api = settings().api;
    const payload = await fetchJson(runtime.core.openAiModelsEndpoint(api.endpoint), { headers: apiHeaders(api) });
    const models = Array.isArray(payload?.data) ? payload.data.map((item) => String(item?.id || '')).filter(Boolean) : [];
    if (!models.length) throw new Error('端点没有返回可用模型列表');
    return [...new Set(models)].sort((a, b) => a.localeCompare(b));
  }

  async function testApiConnection() {
    const api = settings().api;
    const text = await generateDoctorRaw({
      systemPrompt: '只返回OK。',
      prompt: '连接测试',
      responseLength: 32,
    });
    if (!String(text || '').trim()) throw new Error('模型连接成功但返回空内容');
    return api.mode === 'custom' ? '自定义API连接与模型响应正常' : '酒馆当前模型连接与响应正常';
  }

  async function prepareGeneration() {
    const context = getContext();
    const config = settings(context);
    if (!config.enabled || !runtime.core || runtime.internalGeneration) return;
    if (runtime.active) return;
    const chatId = String(context?.chatId || '');
    const latestAi = latestMessage(context, false);
    const latestUser = latestMessage(context, true);
    const session = {
      id: `gen-${Date.now().toString(36)}-${Math.floor(randomUnit() * 0xffffff).toString(36)}`,
      epoch: ++runtime.epoch,
      chatId,
      baselineIndex: latestAi?.index ?? -1,
      baselineText: latestAi?.message?.mes || '',
      startedAt: Date.now(),
      cancelled: false,
      tickets: runtime.core.generateTicketBatch(config.ticketCount, randomUnit),
    };
    runtime.active = session;
    let data = null;
    const Mvu = await getMvu();
    if (Mvu && latestAi) data = await mvuDataAt(Mvu, latestAi.index);
    const profiles = runtime.core.profilesFromData(data);
    const recall = runtime.core.selectWorldRecall(metadata(context).world, latestUser?.message?.mes || '', profiles, config.recallLimit);
    const injection = runtime.core.formatGenerationInjection({
      tickets: session.tickets,
      recall,
      profileDigest: runtime.core.profileDigestFromData(data),
    });
    try {
      context.setExtensionPrompt(PROMPT_KEY, injection, 1, 1, false, 0);
      setStatus('正文生成中', `已注入 ${session.tickets.length} 张候选票据和 ${recall.length} 条相关世界记录`);
    } catch (error) {
      session.cancelled = true;
      runtime.active = null;
      setStatus('生成前注入失败', error.message || String(error));
    }
  }

  async function rollbackMvu(Mvu, oldData, messageId) {
    try {
      await Mvu.replaceMvuData(runtime.core.deepClone(oldData), { type: 'message', message_id: messageId });
      return true;
    } catch { return false; }
  }

  function assertSessionCurrent(session) {
    if (session.cancelled || runtime.epoch !== session.epoch || String(getContext()?.chatId || '') !== session.chatId) {
      throw new Error('任务已被新回合、取消或聊天切换作废');
    }
  }

  async function repairProfileReceipt(session, message, reason, data) {
    const systemPrompt = `你是MVU人物档案格式修复器，不重写正文，不重新随机人格。根据最终正文、本轮既定characterCreationTicket和已有档案摘要，输出且只输出<人物档案更新>[完整JSON档案对象...]</人物档案更新>或<人物档案无变化/>。新人物必须使用一个未重复的本轮ticketId，personality必须保持该票据十四轴。所有规定字段和列表完整；正文缺失信息可以做不冲突推断并写入inferences；禁止未知、待定、未登记。旧人物回传合并后的完整档案。`;
    const prompt = `修复原因：${reason}\n本轮票据：${JSON.stringify(session.tickets)}\n已有档案摘要：${JSON.stringify(runtime.core.profileDigestFromData(data))}\n最终正文：${runtime.core.stripProfileReceipt(message)}`;
    const response = await generateDoctorRaw({ systemPrompt, prompt, responseLength: settings().profileMaxTokens });
    assertSessionCurrent(session);
    return response;
  }

  async function commitProfiles(session, messageId, message) {
    assertSessionCurrent(session);
    const Mvu = await getMvu();
    const hasMvu = Mvu?.getMvuData && Mvu?.parseMessage && Mvu?.replaceMvuData;
    if (hasMvu) await waitForMvuIdle(Mvu, session);
    const oldData = hasMvu ? await mvuDataAt(Mvu, messageId) : null;
    let receiptText = message;
    let receipt = runtime.core.parseProfileReceipt(receiptText);
    if (receipt.kind === 'nochange') return { ok: true, changed: 0, data: oldData };
    let prepared = receipt.kind === 'update'
      ? runtime.core.prepareProfileBatch(receipt.profiles, session.tickets, oldData)
      : { ok: false, errors: [receipt.error || '人物档案回执无效'] };
    const attempts = Math.max(0, Math.min(3, Number(settings().repairAttempts) || 0));
    for (let attempt = 0; !prepared.ok && attempt < attempts; attempt += 1) {
      try {
        setStatus('正在修复人物档案', `第 ${attempt + 1}/${attempts} 次：${prepared.errors.slice(0, 3).join('；')}`);
        receiptText = await repairProfileReceipt(session, message, prepared.errors.join('；'), oldData);
        receipt = runtime.core.parseProfileReceipt(receiptText);
        if (receipt.kind === 'nochange') return { ok: true, changed: 0, data: oldData };
        prepared = receipt.kind === 'update'
          ? runtime.core.prepareProfileBatch(receipt.profiles, session.tickets, oldData)
          : { ok: false, errors: [receipt.error || '修复模型没有返回有效档案回执'] };
      } catch (error) {
        prepared = { ok: false, errors: [`修复请求失败：${error.message || error}`] };
      }
    }
    assertSessionCurrent(session);
    if (!prepared.ok) return { ok: false, error: `整批档案校验失败，零写入：${prepared.errors.slice(0, 8).join('；')}` };
    if (!hasMvu) return { ok: false, error: 'MVU接口不可用，完整档案已生成但未写入任何状态' };
    if (!oldData) return { ok: false, error: '无法读取最终正文对应的MVU状态' };
    const patch = runtime.core.buildProfilePatch(oldData, prepared.profiles);
    let candidate;
    try { candidate = await Mvu.parseMessage(patch.block, runtime.core.deepClone(oldData)); }
    catch (error) { return { ok: false, error: `MVU无法解析人物档案补丁，零写入：${error.message || error}` }; }
    if (!runtime.core.verifyCommittedProfiles(candidate, prepared.profiles)) return { ok: false, error: 'MVU解析结果没有完整包含全部档案，零写入' };
    try {
      assertSessionCurrent(session);
      await Mvu.replaceMvuData(candidate, { type: 'message', message_id: messageId });
      const readback = await mvuDataAt(Mvu, messageId);
      if (!runtime.core.verifyCommittedProfiles(readback, prepared.profiles)) {
        const rolledBack = await rollbackMvu(Mvu, oldData, messageId);
        return { ok: false, error: `档案写入后读回不一致；${rolledBack ? '已回滚原状态' : '回滚失败，请勿继续本聊天'}` };
      }
      return { ok: true, changed: prepared.profiles.length, data: readback };
    } catch (error) {
      const rolledBack = await rollbackMvu(Mvu, oldData, messageId);
      return { ok: false, error: `档案提交失败；${rolledBack ? '已回滚原状态' : '回滚也失败'}：${error.message || error}` };
    }
  }

  async function advanceWorld(session, acceptedText, data) {
    const context = getContext();
    if (!settings(context).worldEngine) return { ok: true, skipped: true };
    const store = metadata(context);
    const systemPrompt = `你是独立世界推进器。根据已接受正文、已有世界状态和人物档案摘要，更新未决支线与NPC自主行动倾向。NPC的intent只能记录准备或尝试，不能把未在正文中裁决的尝试写成成功结果。不得替玩家决定行动、感受、同意或关系。只输出一个JSON对象，不要代码围栏：{"summary":"","branches":[],"npcIntents":[],"agreements":[],"hostilePlans":[]}。每项字段：id,title,actor,location,keywords,status(active|waiting|resolved|failed),intent,consequence。保留仍有效的旧项，合并重复项，已解决项标resolved。`;
    const prompt = `已有世界状态：\n${JSON.stringify(store.world)}\n人物档案摘要：\n${JSON.stringify(runtime.core.profileDigestFromData(data))}\n最终接受正文：\n${runtime.core.stripProfileReceipt(acceptedText)}`;
    try {
      const raw = await generateDoctorRaw({ systemPrompt, prompt, responseLength: settings(context).worldMaxTokens });
      assertSessionCurrent(session);
      store.world = runtime.core.parseWorldState(raw, store.world);
      await saveMetadata(context);
      return { ok: true, world: store.world };
    } catch (error) {
      return { ok: false, error: `世界引擎失败：${error.message || error}` };
    } finally { /* generateDoctorRaw owns request lifecycle */ }
  }

  async function acceptFinal(session) {
    const context = getContext();
    if (session.cancelled || runtime.epoch !== session.epoch || String(context?.chatId || '') !== session.chatId) return;
    const latestAi = latestMessage(context, false);
    if (!latestAi || (latestAi.index === session.baselineIndex && latestAi.message.mes === session.baselineText)) {
      setStatus('最终正文未确认', '500ms后没有读到新的最终助手消息');
      return;
    }
    setStatus('医生处理中', '正在校验整批人物档案');
    const profileResult = await commitProfiles(session, latestAi.index, latestAi.message.mes);
    if (!profileResult.ok) {
      addDiagnostic('profile_failed', profileResult.error, context);
      await saveMetadata(context);
      setRetry({ kind: 'profile', session, messageId: latestAi.index, message: latestAi.message.mes });
      setStatus('人物档案失败', profileResult.error, { durationMs: Date.now() - session.startedAt });
      return;
    }
    setStatus('人物档案已完成', profileResult.changed ? `原子提交 ${profileResult.changed} 张完整档案` : '本轮明确无档案变化');
    const worldResult = await advanceWorld(session, latestAi.message.mes, profileResult.data);
    const world = metadata(context).world;
    const profileCount = Object.keys(runtime.core.profilesFromData(profileResult.data)).length;
    if (!worldResult.ok) {
      addDiagnostic('world_failed', worldResult.error, context);
      await saveMetadata(context);
      setRetry({ kind: 'world', session, messageId: latestAi.index, message: latestAi.message.mes, data: profileResult.data });
      setStatus('档案完成，世界引擎失败', worldResult.error, { profiles: profileCount, branches: activeWorldCount(world), durationMs: Date.now() - session.startedAt });
      return;
    }
    addDiagnostic('completed', `档案变更${profileResult.changed}张；世界项${activeWorldCount(world)}条`, context);
    await saveMetadata(context);
    setRetry(null);
    setStatus('本轮医生完成', `档案与世界状态均已落定`, { profiles: profileCount, branches: activeWorldCount(world), durationMs: Date.now() - session.startedAt });
    void refreshUiData();
  }

  async function retryLastFailure() {
    const item = runtime.retry;
    if (!item || runtime.retrying) return;
    const context = getContext();
    const latestAi = latestMessage(context, false);
    if (!latestAi || latestAi.index !== item.messageId || latestAi.message.mes !== item.message || String(context?.chatId || '') !== item.session.chatId) {
      setRetry(null);
      setStatus('无法重试旧任务', '当前聊天或最终正文已经变化；旧结果不会写入新目标');
      return;
    }
    runtime.retrying = true;
    renderRetryControl();
    try {
      const session = { ...item.session, epoch: runtime.epoch, cancelled: false };
      setStatus('正在重试', item.kind === 'profile' ? '重新修复并提交当前人物档案' : '重新推进当前世界支线');
      if (item.kind === 'profile') {
        const profileResult = await commitProfiles(session, item.messageId, item.message);
        if (!profileResult.ok) {
          addDiagnostic('profile_failed', profileResult.error, context);
          await saveMetadata(context);
          setRetry({ ...item, session });
          setStatus('人物档案重试失败', profileResult.error);
          return;
        }
        const worldResult = await advanceWorld(session, item.message, profileResult.data);
        const profileCount = Object.keys(runtime.core.profilesFromData(profileResult.data)).length;
        if (!worldResult.ok) {
          addDiagnostic('world_failed', worldResult.error, context);
          await saveMetadata(context);
          setRetry({ kind: 'world', session, messageId: item.messageId, message: item.message, data: profileResult.data });
          setStatus('档案完成，世界重试失败', worldResult.error, { profiles: profileCount });
          return;
        }
      } else {
        const worldResult = await advanceWorld(session, item.message, item.data);
        if (!worldResult.ok) {
          addDiagnostic('world_failed', worldResult.error, context);
          await saveMetadata(context);
          setRetry({ ...item, session });
          setStatus('世界支线重试失败', worldResult.error);
          return;
        }
      }
      const world = metadata(context).world;
      const Mvu = await getMvu();
      const data = Mvu ? await mvuDataAt(Mvu, item.messageId) : item.data;
      const profileCount = Object.keys(runtime.core.profilesFromData(data)).length;
      addDiagnostic('completed', `手动重试完成；档案${profileCount}张；世界项${activeWorldCount(world)}条`, context);
      await saveMetadata(context);
      setRetry(null);
      setStatus('失败步骤已恢复', '当前人物档案与世界状态已经重新核对', { profiles: profileCount, branches: activeWorldCount(world) });
      await refreshUiData();
    } finally {
      runtime.retrying = false;
      renderRetryControl();
    }
  }

  function endGeneration() {
    if (runtime.internalGeneration) return;
    const session = runtime.active;
    runtime.active = null;
    clearInjection();
    if (!session || session.cancelled) return;
    if (runtime.timer) clearTimeout(runtime.timer);
    runtime.timer = setTimeout(() => {
      runtime.timer = null;
      void acceptFinal(session);
    }, 500);
  }

  function cancelCurrent(reason = '已取消') {
    runtime.epoch += 1;
    runtime.requestController?.abort();
    runtime.requestController = null;
    if (runtime.active) runtime.active.cancelled = true;
    runtime.active = null;
    if (runtime.timer) clearTimeout(runtime.timer);
    runtime.timer = null;
    clearInjection();
    setRetry(null);
    setStatus(reason, '不会伪造档案或世界推进进度');
  }

  function uiRoot() {
    return document.getElementById(`${PLUGIN_ID}-root`);
  }

  function node(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function replaceChildren(element, children = []) {
    if (!element) return;
    element.textContent = '';
    for (const child of children) element.appendChild(child);
  }

  function fieldLabel(key) {
    const labels = {
      species: '物种', gender: '性别', age: '年龄', occupation: '职业', affiliation: '归属', socialPosition: '社会位置',
      overall: '整体形象', body: '体态', face: '面部', hair: '发型', voice: '声音', physiology: '生理档案',
      temperament: '基础气质', coreDesire: '核心欲望', values: '价值观', thinking: '思考方式', attachment: '关系模式',
      socialMotive: '社交动机', interest: '利益取向', conflict: '冲突方式', stress: '压力反应', moralBoundary: '道德边界',
      expression: '表达习惯', actionHabit: '行动习惯', weakness: '弱点与自欺', humor: '幽默感',
      location: '当前位置', condition: '身体状态', emotion: '当前情绪', goal: '当前目标',
    };
    return labels[key] || key;
  }

  function readableValue(value) {
    if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('；');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return String(value ?? '');
  }

  function profileSection(title, value) {
    const section = node('section', 'mvu-kc-profile-section');
    section.appendChild(node('h3', '', title));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const list = node('dl', 'mvu-kc-data-list');
      for (const [key, field] of Object.entries(value)) {
        list.appendChild(node('dt', '', fieldLabel(key)));
        list.appendChild(node('dd', '', readableValue(field) || '—'));
      }
      section.appendChild(list);
    } else {
      section.appendChild(node('p', '', readableValue(value) || '—'));
    }
    return section;
  }

  function renderProfiles() {
    const root = uiRoot();
    if (!root) return;
    const select = root.querySelector('[data-role="profile-select"]');
    const content = root.querySelector('[data-role="profile-content"]');
    const count = root.querySelector('[data-role="profile-count"]');
    if (!select || !content) return;
    const previous = select.value;
    const entries = Object.entries(runtime.uiProfiles || {}).sort(([, a], [, b]) => String(a?.name || '').localeCompare(String(b?.name || '')));
    select.textContent = '';
    if (count) count.textContent = `${entries.length} 人`;
    if (!entries.length) {
      select.appendChild(new Option('暂无完整人物档案', ''));
      replaceChildren(content, [node('div', 'mvu-kc-empty', '当前聊天尚未成功写入完整人物档案。若刚出现人物失败，请到“诊断”页查看原因并重试。')]);
      return;
    }
    for (const [id, profile] of entries) select.appendChild(new Option(profile?.name || id, id));
    if (entries.some(([id]) => id === previous)) select.value = previous;
    const profile = runtime.uiProfiles[select.value] || entries[0][1];
    const parts = [];
    const heading = node('div', 'mvu-kc-profile-heading');
    heading.appendChild(node('h2', '', profile.name || '未命名人物'));
    heading.appendChild(node('p', '', [profile.identity?.occupation, profile.identity?.affiliation, ...(Array.isArray(profile.aliases) ? profile.aliases : [])].filter(Boolean).join(' · ')));
    parts.push(heading);
    parts.push(profileSection('身份', profile.identity));
    parts.push(profileSection('外观与生理', profile.appearance));
    parts.push(profileSection('人格与行为', profile.personality));
    parts.push(profileSection('经历', profile.history));
    parts.push(profileSection('当前状态', profile.currentState));
    for (const [title, key] of [['关系', 'relationships'], ['知识', 'knowledge'], ['能力', 'capabilities'], ['资源', 'resources'], ['正文证据', 'evidence'], ['可修订推断', 'inferences']]) {
      parts.push(profileSection(title, profile[key]));
    }
    replaceChildren(content, parts);
  }

  function renderWorld() {
    const root = uiRoot();
    if (!root) return;
    const store = metadata();
    const summary = root.querySelector('[data-role="world-summary"]');
    const list = root.querySelector('[data-role="world-list"]');
    if (summary) summary.textContent = store.world.summary || '当前聊天还没有世界推进摘要。';
    if (!list) return;
    const labels = { branches: '支线', npcIntents: 'NPC行动倾向', agreements: '约定', hostilePlans: '敌对计划' };
    const cards = [];
    for (const key of ['branches', 'npcIntents', 'agreements', 'hostilePlans']) {
      for (const entry of store.world[key] || []) {
        const card = node('article', 'mvu-kc-world-card');
        card.dataset.status = entry.status || 'active';
        const head = node('div', 'mvu-kc-card-head');
        head.appendChild(node('span', 'mvu-kc-kind', labels[key]));
        head.appendChild(node('span', 'mvu-kc-status', entry.status || 'active'));
        card.appendChild(head);
        card.appendChild(node('h3', '', entry.title || entry.actor || '未命名事项'));
        const meta = [entry.actor, entry.location].filter(Boolean).join(' · ');
        if (meta) card.appendChild(node('p', 'mvu-kc-muted', meta));
        if (entry.intent) card.appendChild(node('p', '', `倾向/尝试：${entry.intent}`));
        if (entry.consequence) card.appendChild(node('p', '', `已知后果：${entry.consequence}`));
        if (entry.keywords?.length) card.appendChild(node('p', 'mvu-kc-tags', entry.keywords.join(' · ')));
        cards.push(card);
      }
    }
    replaceChildren(list, cards.length ? cards : [node('div', 'mvu-kc-empty', '当前聊天没有支线、NPC倾向、约定或敌对计划。')]);
  }

  function renderDiagnostics() {
    const root = uiRoot();
    if (!root) return;
    const list = root.querySelector('[data-role="diagnostic-list"]');
    if (!list) return;
    const diagnostics = metadata().diagnostics || [];
    const cards = diagnostics.map((entry) => {
      const advice = runtime.core.diagnosticAdvice(entry.kind, entry.detail);
      const card = node('article', 'mvu-kc-diagnostic');
      card.dataset.severity = advice.severity;
      const head = node('div', 'mvu-kc-card-head');
      head.appendChild(node('strong', '', advice.summary));
      head.appendChild(node('time', '', new Date(entry.at).toLocaleString()));
      card.appendChild(head);
      card.appendChild(node('p', 'mvu-kc-diagnostic-detail', runtime.core.redactDiagnostic(entry.detail)));
      card.appendChild(node('p', 'mvu-kc-action', `怎么解决：${advice.action}`));
      return card;
    });
    replaceChildren(list, cards.length ? cards : [node('div', 'mvu-kc-empty', '当前聊天还没有诊断记录。')]);
  }

  function renderStatusSurface(root = uiRoot()) {
    if (!root?.querySelector) return;
    const advice = runtime.core?.diagnosticAdvice?.(runtime.status.phase, runtime.status.detail);
    const summary = root.querySelector('[data-role="status-summary"]');
    const action = root.querySelector('[data-role="status-action"]');
    const badge = root.querySelector('[data-role="status-badge"]');
    const actionable = advice && ['error', 'warning'].includes(advice.severity);
    if (summary) summary.textContent = actionable ? advice.summary : runtime.status.phase;
    if (action) action.textContent = actionable ? advice.action : runtime.status.detail;
    if (badge) badge.textContent = runtime.status.profiles + runtime.status.branches > 0 ? String(runtime.status.profiles + runtime.status.branches) : '';
  }

  function renderRetryControl() {
    const root = uiRoot();
    const buttons = root?.querySelectorAll?.('[data-role="retry"]') || [];
    for (const button of buttons) {
      button.disabled = !runtime.retry || runtime.retrying;
      button.textContent = runtime.retrying ? '正在重试失败步骤…' : runtime.retry ? `重试${runtime.retry.kind === 'profile' ? '人物档案' : '世界支线'}失败步骤` : '当前没有可重试任务';
    }
  }

  function showTab(name) {
    const root = uiRoot();
    if (!root?.querySelectorAll) return;
    for (const button of root.querySelectorAll('[data-tab]')) button.setAttribute('aria-selected', String(button.dataset.tab === name));
    for (const panel of root.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== name;
  }

  async function refreshUiData() {
    const context = getContext();
    const latestAi = latestMessage(context, false);
    const Mvu = await getMvu();
    const data = Mvu && latestAi ? await mvuDataAt(Mvu, latestAi.index) : null;
    runtime.uiProfiles = runtime.core.profilesFromData(data);
    const world = metadata(context).world;
    runtime.status = { ...runtime.status, profiles: Object.keys(runtime.uiProfiles).length, branches: activeWorldCount(world) };
    renderProfiles();
    renderWorld();
    renderDiagnostics();
    renderStatusSurface();
  }

  function setConnectionMessage(message, severity = 'info') {
    const target = uiRoot()?.querySelector?.('[data-role="api-status"]');
    if (!target) return;
    target.textContent = runtime.core.redactDiagnostic(message);
    target.dataset.severity = severity;
  }

  function applySettingsToUi() {
    const root = uiRoot();
    if (!root) return;
    const config = settings();
    const values = {
      enabled: config.enabled,
      world: config.worldEngine,
      tickets: config.ticketCount,
      recall: config.recallLimit,
      repairs: config.repairAttempts,
      profileTokens: config.profileMaxTokens,
      worldTokens: config.worldMaxTokens,
      additionalPrompt: config.additionalPrompt,
      apiMode: config.api.mode,
      apiEndpoint: config.api.endpoint,
      apiKey: config.api.apiKey,
      apiModel: config.api.model,
    };
    for (const [role, value] of Object.entries(values)) {
      const input = root.querySelector(`[data-role="${role}"]`);
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value;
    }
    const custom = config.api.mode === 'custom';
    for (const field of root.querySelectorAll?.('[data-custom-api]') || []) field.disabled = !custom;
  }

  function saveUiSettings() {
    const root = uiRoot();
    const config = settings();
    const number = (role, min, max, fallback) => Math.max(min, Math.min(max, Number(root.querySelector(`[data-role="${role}"]`)?.value) || fallback));
    config.enabled = Boolean(root.querySelector('[data-role="enabled"]')?.checked);
    config.worldEngine = Boolean(root.querySelector('[data-role="world"]')?.checked);
    config.ticketCount = number('tickets', 1, 24, 8);
    config.recallLimit = number('recall', 1, 16, 8);
    config.repairAttempts = number('repairs', 0, 3, 2);
    config.profileMaxTokens = number('profileTokens', 1000, 32768, 6000);
    config.worldMaxTokens = number('worldTokens', 512, 16384, 3000);
    config.additionalPrompt = String(root.querySelector('[data-role="additionalPrompt"]')?.value || '');
    config.api = {
      mode: root.querySelector('[data-role="apiMode"]')?.value === 'custom' ? 'custom' : 'tavern',
      endpoint: String(root.querySelector('[data-role="apiEndpoint"]')?.value || '').trim(),
      apiKey: String(root.querySelector('[data-role="apiKey"]')?.value || '').trim(),
      model: String(root.querySelector('[data-role="apiModel"]')?.value || '').trim(),
    };
    saveSettings();
    applySettingsToUi();
    setConnectionMessage('设置已保存在医生扩展设置中；密钥不会写入聊天诊断。', 'success');
  }

  async function copyDiagnostics() {
    const lines = (metadata().diagnostics || []).map((entry) => {
      const advice = runtime.core.diagnosticAdvice(entry.kind, entry.detail);
      return `${entry.at} | ${entry.kind} | ${runtime.core.redactDiagnostic(entry.detail)} | ${advice.action}`;
    }).join('\n');
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(lines || '当前聊天没有诊断记录');
    else throw new Error('当前宿主不支持剪贴板API');
  }

  function mountSettingsShortcut() {
    if (document.getElementById(`${PLUGIN_ID}-settings-entry`)) return;
    const host = document.querySelector?.('#extensions_settings2') || document.querySelector?.('#extensions_settings');
    if (!host) return;
    const section = node('section', 'mvu-kc-settings-entry');
    section.id = `${PLUGIN_ID}-settings-entry`;
    section.appendChild(node('div', 'mvu-kc-settings-copy', 'MVU 人物与世界医生'));
    const button = node('button', 'menu_button', '打开医生控制台');
    button.type = 'button';
    button.addEventListener('click', () => {
      const root = uiRoot();
      if (root) setConsoleOpen(root, true, 'connection');
    });
    section.appendChild(button);
    host.appendChild(section);
  }

  function setConsoleOpen(root, open, tab = 'overview') {
    root.classList.toggle('open', open);
    const consoleNode = root.querySelector('.mvu-kc-console');
    if (consoleNode) {
      consoleNode.inert = !open;
      consoleNode.setAttribute('aria-hidden', String(!open));
    }
    if (open) {
      showTab(tab);
      void refreshUiData();
    }
  }

  function mountUi() {
    if (document.getElementById(`${PLUGIN_ID}-root`)) return;
    const root = document.createElement('section');
    root.id = `${PLUGIN_ID}-root`;
    root.dataset.state = 'busy';
    root.innerHTML = `
      <button class="mvu-kc-toggle" type="button" aria-label="打开MVU人物与世界医生">
        <span aria-hidden="true">🩺</span><span class="mvu-kc-toggle-label">医生</span><span data-role="status-badge" class="mvu-kc-badge"></span>
      </button>
      <button class="mvu-kc-scrim" data-role="close" type="button" aria-label="关闭医生控制台"></button>
      <section class="mvu-kc-console" role="dialog" aria-modal="true" aria-hidden="true" aria-label="MVU人物与世界医生控制台" inert>
        <header class="mvu-kc-header">
          <div><div class="mvu-kc-eyebrow">KEMINI CLEAN</div><h1>人物与世界医生</h1></div>
          <button data-role="close" class="mvu-kc-icon-button" type="button" aria-label="关闭">×</button>
        </header>
        <section class="mvu-kc-live">
          <div><strong data-role="phase">正在初始化</strong><p data-role="detail"></p></div>
          <div data-role="metrics" class="mvu-kc-metrics">档案 0 · 活跃世界项 0 · 0s</div>
        </section>
        <nav class="mvu-kc-tabs" aria-label="医生页面">
          <button data-tab="overview" aria-selected="true" type="button">总览</button>
          <button data-tab="connection" aria-selected="false" type="button">连接</button>
          <button data-tab="profiles" aria-selected="false" type="button">人物</button>
          <button data-tab="world" aria-selected="false" type="button">世界</button>
          <button data-tab="diagnostics" aria-selected="false" type="button">诊断</button>
        </nav>
        <main class="mvu-kc-main">
          <section data-panel="overview">
            <div class="mvu-kc-status-card"><span class="mvu-kc-status-dot"></span><div><h2 data-role="status-summary">医生正在初始化</h2><p data-role="status-action">请稍候。</p></div></div>
            <div class="mvu-kc-card"><h2>基础运行</h2><div class="mvu-kc-form-grid">
              <label><span>启用医生</span><input data-role="enabled" type="checkbox"></label>
              <label><span>正文后推进世界</span><input data-role="world" type="checkbox"></label>
              <label><span>候选人物票据</span><input data-role="tickets" type="number" min="1" max="24"></label>
              <label><span>召回世界项上限</span><input data-role="recall" type="number" min="1" max="16"></label>
              <label><span>档案修复次数</span><input data-role="repairs" type="number" min="0" max="3"></label>
            </div><button data-role="save" class="mvu-kc-primary" type="button">保存基础设置</button></div>
            <div class="mvu-kc-actions"><button data-role="retry" type="button" disabled>当前没有可重试任务</button><button data-role="cancel" class="mvu-kc-danger" type="button">取消当前任务</button></div>
          </section>
          <section data-panel="connection" hidden>
            <div class="mvu-kc-card"><h2>医生模型连接</h2><p class="mvu-kc-muted">可以继承酒馆当前模型，也可以使用独立的OpenAI兼容API。人物修复与世界推进共用此连接。</p>
              <label class="mvu-kc-field"><span>连接方式</span><select data-role="apiMode"><option value="tavern">继承酒馆当前模型</option><option value="custom">自定义OpenAI兼容API</option></select></label>
              <label class="mvu-kc-field"><span>API地址</span><input data-role="apiEndpoint" data-custom-api type="url" placeholder="https://example.com/v1"></label>
              <label class="mvu-kc-field"><span>API密钥</span><input data-role="apiKey" data-custom-api type="password" autocomplete="off" placeholder="可留空用于本地服务"></label>
              <label class="mvu-kc-reveal"><input data-role="revealKey" type="checkbox"><span>显示密钥</span></label>
              <label class="mvu-kc-field"><span>模型</span><input data-role="apiModel" data-custom-api list="mvu-kc-models" type="text" placeholder="model-name"><datalist id="mvu-kc-models"></datalist></label>
              <div class="mvu-kc-form-grid"><label><span>人物输出上限</span><input data-role="profileTokens" type="number" min="1000" max="32768"></label><label><span>世界输出上限</span><input data-role="worldTokens" type="number" min="512" max="16384"></label></div>
              <label class="mvu-kc-field"><span>全局模型适配附加提示词</span><textarea data-role="additionalPrompt" rows="5" placeholder="可留空。人物档案修复与世界推进都会追加这段提示词。"></textarea></label>
              <p class="mvu-kc-muted">只有这一个全局入口；不会写入预设、世界书或聊天诊断。</p>
              <div class="mvu-kc-actions"><button data-role="save" class="mvu-kc-primary" type="button">保存连接</button><button data-role="models" data-custom-api type="button">获取模型</button><button data-role="testApi" type="button">测试连接</button></div>
              <p data-role="api-status" class="mvu-kc-api-status">尚未测试连接。</p>
            </div>
          </section>
          <section data-panel="profiles" hidden>
            <div class="mvu-kc-toolbar"><div><h2>人物档案</h2><span data-role="profile-count">0 人</span></div><button data-role="refresh" type="button">刷新读取</button></div>
            <label class="mvu-kc-field"><span>选择人物</span><select data-role="profile-select"></select></label>
            <div data-role="profile-content" class="mvu-kc-profile-content"></div>
          </section>
          <section data-panel="world" hidden>
            <div class="mvu-kc-toolbar"><div><h2>世界与支线</h2><span>只读当前聊天状态</span></div><button data-role="refresh" type="button">刷新显示</button></div>
            <div class="mvu-kc-card"><h3>世界摘要</h3><p data-role="world-summary"></p></div>
            <div data-role="world-list" class="mvu-kc-world-list"></div>
          </section>
          <section data-panel="diagnostics" hidden>
            <div class="mvu-kc-toolbar"><div><h2>诊断与恢复</h2><span>只保存当前聊天最近30条</span></div><button data-role="refresh" type="button">刷新</button></div>
            <div class="mvu-kc-actions"><button data-role="retry" type="button" disabled>当前没有可重试任务</button><button data-role="copyDiagnostics" type="button">复制脱敏诊断</button><button data-role="clearDiagnostics" class="mvu-kc-danger" type="button">清空诊断</button></div>
            <div data-role="diagnostic-list" class="mvu-kc-diagnostic-list"></div>
          </section>
        </main>
      </section>`;
    document.body.appendChild(root);
    applySettingsToUi();
    root.querySelector('.mvu-kc-toggle').addEventListener('click', () => setConsoleOpen(root, true, 'overview'));
    for (const close of root.querySelectorAll('[data-role="close"]')) close.addEventListener('click', () => setConsoleOpen(root, false));
    for (const tab of root.querySelectorAll('[data-tab]')) tab.addEventListener('click', () => showTab(tab.dataset.tab));
    for (const save of root.querySelectorAll('[data-role="save"]')) save.addEventListener('click', saveUiSettings);
    for (const refresh of root.querySelectorAll('[data-role="refresh"]')) refresh.addEventListener('click', () => void refreshUiData());
    for (const retry of root.querySelectorAll('[data-role="retry"]')) retry.addEventListener('click', () => void retryLastFailure().catch((error) => setStatus('重试失败', error.message || String(error))));
    root.querySelector('[data-role="cancel"]').addEventListener('click', () => cancelCurrent('用户已取消'));
    root.querySelector('[data-role="profile-select"]').addEventListener('change', renderProfiles);
    root.querySelector('[data-role="apiMode"]').addEventListener('change', () => { saveUiSettings(); applySettingsToUi(); });
    root.querySelector('[data-role="revealKey"]').addEventListener('change', (event) => { root.querySelector('[data-role="apiKey"]').type = event.target.checked ? 'text' : 'password'; });
    root.querySelector('[data-role="models"]').addEventListener('click', async () => {
      try {
        saveUiSettings();
        setConnectionMessage('正在读取模型列表…');
        const models = await fetchApiModels();
        const datalist = root.querySelector('#mvu-kc-models');
        replaceChildren(datalist, models.map((model) => { const option = node('option'); option.value = model; return option; }));
        setConnectionMessage(`已读取 ${models.length} 个模型，可以在模型框中选择。`, 'success');
      } catch (error) { setConnectionMessage(error.message || String(error), 'error'); }
    });
    root.querySelector('[data-role="testApi"]').addEventListener('click', async () => {
      try {
        saveUiSettings();
        setConnectionMessage('正在测试连接…');
        setConnectionMessage(await testApiConnection(), 'success');
      } catch (error) { setConnectionMessage(error.message || String(error), 'error'); }
    });
    root.querySelector('[data-role="copyDiagnostics"]').addEventListener('click', () => void copyDiagnostics().then(() => setConnectionMessage('脱敏诊断已复制。', 'success')).catch((error) => setStatus('复制诊断失败', error.message || String(error))));
    root.querySelector('[data-role="clearDiagnostics"]').addEventListener('click', async () => {
      if (!window.confirm?.('只清空当前聊天的医生诊断记录？人物档案和世界状态不会删除。')) return;
      metadata().diagnostics = [];
      await saveMetadata();
      renderDiagnostics();
    });
    document.addEventListener?.('keydown', (event) => { if (event.key === 'Escape') setConsoleOpen(root, false); });
    renderRetryControl();
    renderStatusSurface(root);
    mountSettingsShortcut();
  }

  async function init() {
    runtime.core = embeddedCore;
    let context = getContext();
    for (let attempt = 0; !context?.eventSource?.on && attempt < 120; attempt += 1) {
      await sleep(250);
      context = getContext();
    }
    if (!context?.eventSource?.on) throw new Error('SillyTavern事件接口不可用');
    settings(context);
    mountUi();
    const types = context.eventTypes || context.event_types || {};
    context.eventSource.on(types.GENERATION_STARTED || 'generation_started', async (_type, params = {}, dryRun) => {
      if (dryRun === true || params?.dryRun === true || params?.quiet === true || runtime.internalGeneration) return;
      await prepareGeneration();
    });
    context.eventSource.on(types.GENERATION_ENDED || 'generation_ended', endGeneration);
    context.eventSource.on(types.GENERATION_STOPPED || 'generation_stopped', () => cancelCurrent('生成已停止'));
    for (const event of [types.CHAT_CHANGED || 'chat_changed', types.CHAT_LOADED || 'chat_loaded']) {
      context.eventSource.on(event, () => cancelCurrent('聊天已切换'));
    }
    const store = metadata(context);
    setStatus('医生已就绪', '等待下一次正文生成', { branches: activeWorldCount(store.world) });
    console.info('[MVU Kemini Clean] initialized');
  }

  init().catch((error) => {
    console.error('[MVU Kemini Clean] init failed', error);
    mountUi();
    setStatus('医生初始化失败', error.message || String(error));
  });
})();
