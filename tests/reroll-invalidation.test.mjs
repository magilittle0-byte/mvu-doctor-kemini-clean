import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtimeHarness(initialChat = [{ is_user: true, is_system: false, mes: '进入场景' }], pendingInput = '', stopVisible = false, options = {}) {
  let source = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8')
    .replace('\n  init().catch((error) => {', '\n  window.__doctorTestHooks = { retryLastFailure, manualVariableRecheck, manualWorldRecheck, cancelFromDoctorUi, restoreDoctorStateForChat, runtimeHasPendingWork, runtimeHasPendingWorkForAutoRetry, renderRetryControl, redactReportSecrets, runtimeReportSnapshot, runtime };\n\n  init().catch((error) => {');
  source = source.replace(
    '          swipeCaptureOk = await captureSwipeOutcome(session, context);',
    "          if (window.__forceCaptureSwipeOutcomeFailure) throw new Error('forced swipe outcome capture failure');\n          swipeCaptureOk = await captureSwipeOutcome(session, context);",
  );
  const handlers = new Map();
  const prompts = [];
  const doctorCalls = [];
  const mvuWrites = [];
  let saveMetadataCalls = 0;
  let saveChatCalls = 0;
  let mvuReadCalls = 0;
  let mvuReplaceCalls = 0;
  let mvuParseCalls = 0;
  const uiNodes = new Map();
  const makeUiNode = () => ({
    textContent: '', disabled: false, hidden: false, checked: false, value: '', type: '', dataset: {}, style: {},
    addEventListener() {}, appendChild() {}, append() {}, replaceChildren() {}, remove() {}, setAttribute() {}, removeAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
  });
  const uiNode = (role) => {
    if (!uiNodes.has(role)) uiNodes.set(role, makeUiNode());
    return uiNodes.get(role);
  };
  const uiRoot = {
    dataset: {},
    querySelector(selector) {
      const role = String(selector || '').match(/^\[data-role=["']([^"']+)["']\]$/)?.[1];
      return role ? uiNode(role) : makeUiNode();
    },
    querySelectorAll(selector) {
      const role = String(selector || '').match(/^\[data-role=["']([^"']+)["']\]$/)?.[1];
      return role ? [uiNode(role)] : [];
    },
    classList: { toggle() {} },
  };
  const context = {
    chatId: 'reroll-chat',
    chat: structuredClone(initialChat),
    chatMetadata: {},
    extensionSettings: options.extensionSettings || {},
    ...(options.context || {}),
    eventTypes: {
      GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended',
      GENERATION_STOPPED: 'generation_stopped', MESSAGE_SWIPED: 'message_swiped',
      CHAT_CHANGED: 'chat_changed', CHAT_LOADED: 'chat_loaded',
    },
    eventSource: { on(name, handler) { handlers.set(name, handler); } },
    setExtensionPrompt(_key, value) {
      prompts.push(String(value || ''));
      if (typeof options.setExtensionPrompt === 'function') return options.setExtensionPrompt({ value: String(value || ''), context, prompts });
    },
    saveSettingsDebounced() {},
    async saveChat() {
      saveChatCalls += 1;
      if (typeof options.saveChat === 'function') return options.saveChat({ call: saveChatCalls, context });
    },
    async saveMetadata() {
      saveMetadataCalls += 1;
      if (typeof options.saveMetadata === 'function') return options.saveMetadata({ call: saveMetadataCalls, context });
    },
    async generateRaw(request) {
      doctorCalls.push(structuredClone(request));
      if (String(request?.systemPrompt || '').includes('最终正文的人物发现器')) {
        if (typeof options.generateDiscovery === 'function') return options.generateDiscovery(request, doctorCalls);
        return '<人物发现>NONE</人物发现>';
      }
      if (/单一世界主体的私密(?:行动|后续)规划器/u.test(String(request?.systemPrompt || ''))) {
        const system = String(request.systemPrompt || '');
        const prompt = String(request.prompt || '');
        const subjectId = prompt.match(/只属于\s+([^】]+)】/u)?.[1]?.trim() || 'subject-unknown';
        if (system.includes('私密行动规划器')) {
          const storedNext = prompt.match(/"nextAction"\s*:\s*"([^"]+)"/u)?.[1] || '检查当前锚点与既有条件';
          return `[ACTOR_PLAN ${subjectId}]\n尝试：${storedNext}\n[/ACTOR_PLAN]`;
        }
        return `[ACTOR_PLAN ${subjectId}]\n目标：\n新增已知：\n下一步：根据本轮裁决复核下一项具体条件\n下次检查：99\n[/ACTOR_PLAN]`;
      }
      if (typeof options.generateRaw === 'function') return options.generateRaw(request, doctorCalls);
      return '';
    },
  };
  const mvuByMessage = new Map(options.mvuByMessage || [
    [1, { stat_data: { 人物档案: { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } } } }],
  ]);
  const Mvu = {
    async getMvuData({ message_id: messageId }) {
      mvuReadCalls += 1;
      const defaultRead = () => structuredClone(mvuByMessage.get(messageId) || { stat_data: {} });
      if (typeof options.getMvuData === 'function') {
        const result = await options.getMvuData({ call: mvuReadCalls, messageId, mvuByMessage, defaultRead });
        return structuredClone(result);
      }
      return defaultRead();
    },
    async replaceMvuData(data, { message_id: messageId }) {
      mvuReplaceCalls += 1;
      mvuWrites.push({ messageId, data: structuredClone(data) });
      const defaultReplace = () => mvuByMessage.set(messageId, structuredClone(data));
      if (typeof options.replaceMvuData === 'function') {
        const result = await options.replaceMvuData({ call: mvuReplaceCalls, data: structuredClone(data), messageId, mvuByMessage, defaultReplace });
        if (result?.handled) return result.value;
      }
      defaultReplace();
    },
    ...(options.completeMvu ? {
      isDuringExtraAnalysis() { return false; },
      async parseMessage(block, data) {
        mvuParseCalls += 1;
        if (typeof options.parseMessage === 'function') {
          return structuredClone(await options.parseMessage({ call: mvuParseCalls, block, data: structuredClone(data) }));
        }
        return structuredClone(data);
      },
    } : {}),
  };
  const sandbox = {
    window: {
      SillyTavern: { getContext: () => context },
      Mvu,
      crypto: globalThis.crypto,
      __forceCaptureSwipeOutcomeFailure: Boolean(options.forceCaptureSwipeOutcomeFailure),
    },
    document: {
      currentScript: null,
      querySelector: (selector) => {
        if (selector === '#send_textarea') return { value: pendingInput };
        if (selector === '#mes_stop' && stopVisible) return { getBoundingClientRect: () => ({ width: 48, height: 24 }) };
        return null;
      },
      getElementById: () => uiRoot,
      createElement: () => makeUiNode(),
      body: { appendChild() {} },
      addEventListener() {},
    },
    console: { info() {}, error() {}, warn() {} },
    Option: function Option(text = '', value = '') { this.text = text; this.value = value; },
    setTimeout, clearTimeout, structuredClone,
  };
  vm.runInNewContext(source, sandbox, { filename: 'index.js' });
  return {
    context, handlers, prompts, doctorCalls, mvuWrites, mvuByMessage, uiRoot, uiNodes, window: sandbox.window, hooks: sandbox.window.__doctorTestHooks,
    generationInterceptor: sandbox.mvuDoctorKeminiGenerateInterceptor,
    counters: {
      get saveMetadata() { return saveMetadataCalls; },
      get saveChat() { return saveChatCalls; },
      get mvuRead() { return mvuReadCalls; },
      get mvuReplace() { return mvuReplaceCalls; },
      get mvuParse() { return mvuParseCalls; },
    },
  };
}

function completeAuthorityProfile(name = '林页') {
  return {
    name,
    aliases: [],
    identity: { species: '人类', gender: '女性', age: '二十四岁', occupation: '记录员', affiliation: '远行队伍', socialPosition: '普通同行者' },
    appearance: { overall: '衣着朴素而整洁', body: '中等身量，动作轻缓', face: '眉眼柔和，神情克制', hair: '黑色长发束在脑后', voice: '声音偏轻，吐字清楚', physiology: '普通人类生理结构' },
    personality: {
      temperament: '角色卡明确设定的热情直率', coreDesire: '忠实记录沿途见闻', values: '尊重事实与承诺', thinking: '先观察再核对',
      attachment: '慢热但重视长期信任', socialMotive: '交换可靠信息', interest: '维护自身与队伍的基本利益', conflict: '先澄清分歧再表态',
      stress: '压力下会反复核对细节', moralBoundary: '不伪造证据伤害无辜', expression: '说话简洁直接', actionHabit: '随手记录可验证细节',
      weakness: '过度相信书面记录', humor: '偶尔用一本正经的冷笑话缓和气氛',
    },
    history: '曾在城镇档案室工作，离开后加入远行队伍记录沿途见闻。',
    currentState: { location: '旅店柜台前', condition: '身体健康', emotion: '对陌生环境保持好奇', goal: '完成今日见闻记录' },
    relationships: ['与队伍成员保持礼貌而尚在建立中的合作关系'],
    knowledge: ['通过档案室职业训练掌握：基础文书整理与地方档案检索'],
    capabilities: ['能够快速整理和交叉核对记录'],
    resources: ['随身携带纸笔与旧档案索引'],
    evidence: [`最终正文明确${name}在柜台前与店员交谈`],
    inferences: ['具体经历由角色卡权威人格与当前职业合理补全，后续证据可修订'],
  };
}

function withCharacterTicketReceipt(text, assignments = []) {
  return `<konatan_planning~><CharacterTicketReceipt>${JSON.stringify(assignments)}</CharacterTicketReceipt></konatan_planning~>${text}`;
}

function currentTicketAssignment(harness, name, ordinal = 0) {
  const ticket = harness.hooks.runtime.active?.tickets?.[ordinal];
  assert.ok(ticket?.ticketId, `本轮第${ordinal + 1}张人物票据必须已在正文生成前创建`);
  return { name, source: 'ticket', ticketId: ticket.ticketId };
}

function worldTicketsFromPrompt(prompt) {
  const match = String(prompt || '').match(/【本地worldAdvanceTicket；每张只绑定同ID主体】\s*([\s\S]*?)\s*【全局裁决视图/u);
  if (!match) return [];
  try {
    const value = JSON.parse(match[1]);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function scheduledWorldBlocks(prompt, label = '既有主体') {
  const turn = Number(String(prompt || '').match(/【本轮世界回合】(\d+)/u)?.[1] || 1);
  return worldTicketsFromPrompt(prompt).map((ticket, index) => {
    const blocked = ['blocked', 'delayed', 'waiting'].includes(String(ticket.resultEnvelope || ''));
    return `[SUBJECT ${ticket.subjectId}]
尝试：${ticket.attemptDirective}
结果：${blocked ? `${label}受当前条件限制，本轮只确认了一项具体阻碍` : `${label}按票据要求留下了一项可核对的新记录`}
代价：消耗了本回合的核对时间
状态变化：${blocked ? `${label}的当前阻碍已被明确记录` : `${label}已取得一项可用于下次判断的新记录`}
现状：${blocked ? `${label}暂时等待条件变化` : `${label}正依据新记录调整后续安排`}
下一步：检查相关地点是否出现不同于本轮的新迹象
下次检查：${turn + 1}
状态：${blocked ? 'waiting' : 'active'}
支线：${label}连续性
[/SUBJECT]`;
  });
}

function newProcessWorldBlock({ name, sourceAnchor, anchor, current, goal, attempt, outcome, stateChange, nextAction, nextCheckTurn = 2, thread }) {
  return `[SUBJECT NEW]
类型：process
名称：${name}
正文锚点：${sourceAnchor}
稳定锚点：${anchor}
目标：${goal}
已知：经观察记录得知：“${sourceAnchor}”
资源：正文已确认的现场条件与后续可观察痕迹
约束：只能按已确认条件继续演化，不得凭空增加隐藏行动者或极端结果
尝试：${attempt}
结果：${outcome}
代价：消耗了本时段的自然演化与观察时间
状态变化：${stateChange}
现状：${current}
下一步：${nextAction}
下次检查：${nextCheckTurn}
状态：active
支线：${thread}
[/SUBJECT]`;
}

async function acceptInitialSwipe(harness, textOrFactory) {
  await harness.handlers.get('generation_started')('normal', {}, false);
  const text = typeof textOrFactory === 'function'
    ? textOrFactory(harness)
    : textOrFactory;
  const messageId = harness.context.chat.length;
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [text], mes: text });
  harness.handlers.get('generation_ended')();
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  for (let attempt = 0; attempt < 60 && store.pendingAcceptedFinal; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return { store, messageId };
}

async function acceptNextSwipe(harness, userText, textOrFactory) {
  harness.context.chat.push({ is_user: true, is_system: false, mes: userText });
  await harness.handlers.get('generation_started')('normal', {}, false);
  const text = typeof textOrFactory === 'function'
    ? textOrFactory(harness)
    : textOrFactory;
  const messageId = harness.context.chat.length;
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [text], mes: text });
  harness.handlers.get('generation_ended')();
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  for (let attempt = 0; attempt < 60 && store.pendingAcceptedFinal; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return { store, messageId };
}

test('运行中完整报告快照保留active、processing、preparation与原始模型trace，同时排除API和不可序列化值', () => {
  const apiKey = 'report-secret-key-1234';
  const endpoint = 'https://private.example.test/v1';
  const harness = runtimeHarness(undefined, '', false, {
    extensionSettings: {
      'mvu-doctor-kemini-clean': {
        api: { mode: 'custom', apiKey, endpoint, model: 'private-model' },
      },
    },
  });
  harness.hooks.runtime.active = {
    id: 'active-run',
    trace: [{ stage: '人物发现:response', output: `林页原始返回；${apiKey}` }],
    callback() {},
  };
  harness.hooks.runtime.processingSession = {
    id: 'processing-run',
    trace: [{ stage: '人物档案审计与修复:response', output: `完整档案；${endpoint}` }],
  };
  harness.hooks.runtime.preparation = {
    id: 'preparing-run',
    controller: { abort() {} },
  };
  const snapshot = harness.hooks.runtimeReportSnapshot();
  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.active.id, 'active-run');
  assert.equal(snapshot.processingSession.id, 'processing-run');
  assert.equal(snapshot.preparation.id, 'preparing-run');
  assert.match(snapshot.active.trace[0].output, /林页原始返回/);
  assert.match(snapshot.active.callback, /^\[Function/);
  assert.match(snapshot.preparation.controller.abort, /^\[Function/);
  assert.doesNotMatch(serialized, /report-secret-key-1234|private\.example\.test|private-model/);
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});

test('finalize保存失败后processing可释放，但完整报告仍能从内存快照导出trace与原始模型返回', async () => {
  const apiKey = 'finalize-secret-key-5678';
  const endpoint = 'https://finalize-private.example.test/v1';
  let failedFinalSave = false;
  const harness = runtimeHarness(undefined, '', false, {
    extensionSettings: {
      'mvu-doctor-kemini-clean': {
        enabled: true,
        variableDoctor: false,
        worldEngine: false,
        repairAttempts: 0,
        additionalPrompt: `适配内容 ${apiKey}`,
        api: { mode: 'tavern', apiKey, endpoint, model: '' },
      },
    },
    generateRaw({ systemPrompt }) {
      return String(systemPrompt || '').includes('MVU人物档案医师') ? '<人物档案无变化/>' : '';
    },
    saveMetadata({ context }) {
      const store = context.chatMetadata['mvu-doctor-kemini-clean'];
      if (!failedFinalSave && store?.fullRuns?.length) {
        failedFinalSave = true;
        throw new Error('forced final report save failure');
      }
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await acceptInitialSwipe(harness, '<content>空屋里的钟摆完整摆动了一次。</content><options><option>继续观察</option></options>');
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(failedFinalSave, true);
  assert.equal(harness.hooks.runtime.processingSession, null);
  const snapshot = harness.hooks.runtimeReportSnapshot();
  assert.equal(snapshot.lastFailedFinalizeOrSave.runId.length > 0, true);
  const serialized = JSON.stringify(snapshot);
  assert.match(serialized, /人物发现:response|人物档案审计与修复:response/);
  assert.match(serialized, /人物发现&gt;NONE|人物档案无变化|人物发现>NONE/);
  assert.doesNotMatch(serialized, /finalize-secret-key-5678|finalize-private\.example\.test/);
});

test('普通中文名由独立发现回执锁定，主档案模型第一次无变化也必须继续生成完整档案', async () => {
  let profileCalls = 0;
  let discoveryCalls = 0;
  const profile = completeAuthorityProfile('林页');
  const harness = runtimeHarness(undefined, '', false, {
    extensionSettings: {
      'mvu-doctor-kemini-clean': {
        enabled: true,
        variableDoctor: false,
        worldEngine: false,
        repairAttempts: 1,
        ticketCount: 2,
      },
    },
    generateDiscovery() {
      discoveryCalls += 1;
      return '<人物发现>\n人物：林页\n锚点：林页在药房门口递出采购清单\n</人物发现>';
    },
    generateRaw({ systemPrompt }) {
      const system = String(systemPrompt || '');
      if (!system.includes('MVU人物档案医师')) return '';
      profileCalls += 1;
      if (profileCalls === 1) return '<人物档案无变化/>';
      return `<人物档案更新>${JSON.stringify([profile])}</人物档案更新>`;
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const accepted = '<content>林页在药房门口递出采购清单，并向值班药剂师询问到货日期。</content><options><option>询问清单内容</option></options>';
  const { store } = await acceptInitialSwipe(harness, (activeHarness) => withCharacterTicketReceipt(
    accepted,
    [currentTicketAssignment(activeHarness, '林页')],
  ));
  assert.equal(discoveryCalls, 1);
  assert.equal(profileCalls, 2);
  const saved = Object.values(store.profiles).find((entry) => entry?.name === '林页');
  assert.ok(saved);
  assert.equal(saved.profileId, saved.ticketId);
  assert.equal(typeof saved.personality?.temperament, 'string');
  assert.equal(store.ticketLedger[0].assignmentReceiptStatus, 'complete');
  assert.deepEqual(store.ticketLedger[0].assignments.map(({ name, source, ticketId }) => ({ name, source, ticketId })), [
    { name: '林页', source: 'ticket', ticketId: saved.ticketId },
  ]);
  assert.equal(store.fullRuns[0].outcome.profiles.ok, true);
  assert.equal(store.fullRuns[0].outcome.profiles.changed, 1);
  assert.equal(store.fullRuns[0].trace.some((entry) => entry.stage === 'profile:nochange-rejected'), true);
});

test('正文漏写人物票据回执时仍按数据库方式完整补档，但绝不事后配票', async () => {
  const profile = completeAuthorityProfile('林页');
  const harness = runtimeHarness(undefined, '', false, {
    extensionSettings: {
      'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false, repairAttempts: 0, ticketCount: 2 },
    },
    generateDiscovery() {
      return '<人物发现>\n人物：林页\n锚点：林页在药房门口递出采购清单\n</人物发现>';
    },
    generateRaw({ systemPrompt }) {
      return String(systemPrompt || '').includes('MVU人物档案医师')
        ? `<人物档案更新>${JSON.stringify([profile])}</人物档案更新>`
        : '';
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const { store } = await acceptInitialSwipe(
    harness,
    '<content>林页在药房门口递出采购清单，并向值班药剂师核对短缺品种。</content><options><option>询问缺货日期</option></options>',
  );
  const saved = Object.values(store.profiles).find((entry) => entry?.name === '林页');
  assert.ok(saved);
  assert.match(saved.profileId, /^profile-unbound-/u);
  assert.equal(saved.ticketId, undefined);
  assert.deepEqual(structuredClone(saved.ticketBinding), {
    status: 'receipt_missing',
    source: 'creative-completion',
    detail: 'receipt_not_present',
  });
  assert.equal(store.ticketLedger[0].assignmentReceiptStatus, 'missing');
  assert.equal(store.fullRuns[0].outcome.profiles.ok, true);
  assert.equal(store.fullRuns[0].outcome.profiles.changed, 1);
});

test('无人物NONE允许人物档案无变化；幻觉发现失败只重试人物、不落空壳也不阻塞世界', async (t) => {
  await t.test('NONE', async () => {
    const harness = runtimeHarness(undefined, '', false, {
      extensionSettings: {
        'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false, repairAttempts: 0 },
      },
      generateRaw({ systemPrompt }) {
        return String(systemPrompt || '').includes('MVU人物档案医师') ? '<人物档案无变化/>' : '';
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const { store } = await acceptInitialSwipe(harness, withCharacterTicketReceipt(
      '<content>雨水沿着空荡的石阶向下流去。</content><options><option>继续观察</option></options>',
      [],
    ));
    assert.equal(Object.keys(store.profiles).length, 0);
    assert.equal(store.fullRuns[0].outcome.profiles.ok, true);
    assert.equal(store.ticketLedger[0].assignmentReceiptStatus, 'complete');
    assert.deepEqual(store.ticketLedger[0].assignments, []);
  });

  await t.test('幻觉锚点', async () => {
    let worldCalls = 0;
    const harness = runtimeHarness(undefined, '', false, {
      extensionSettings: {
        'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: true, repairAttempts: 0 },
      },
      generateDiscovery() {
        return '<人物发现>\n人物：林页\n锚点：林页在码头检修吊灯\n</人物发现>';
      },
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt || '');
        if (!system.includes('全局世界裁决器') && !system.includes('世界长期主体发现器')) return '';
        worldCalls += 1;
        return `世界摘要：石阶积水继续按天气条件变化。\n\n${newProcessWorldBlock({
          name: '石阶积水',
          sourceAnchor: '雨水沿着空荡的石阶向下流去',
          anchor: '石阶积水会随降雨与排水条件继续变化',
          current: '雨水正沿空荡石阶向下流动',
          goal: '记录积水如何随降雨与排水变化',
          attempt: '核对本时段雨势与石阶排水情况',
          outcome: '本时段雨水仍沿石阶持续向下流动',
          stateChange: '石阶积水成为可在下一时段复核的环境进程',
          nextAction: '下一时段复核雨势与积水深度是否变化',
          thread: '石阶降雨进程',
        })}`;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const { store } = await acceptInitialSwipe(harness, withCharacterTicketReceipt(
      '<content>雨水沿着空荡的石阶向下流去。</content><options><option>继续观察</option></options>',
      [],
    ));
    assert.equal(Object.keys(store.profiles).length, 0);
    assert.equal(store.pendingRetry?.kind, 'profile');
    assert.match(store.fullRuns[0].outcome.profiles.error, /不是最终正文逐字出现|锚点不是最终正文连续逐字原文/);
    assert.equal(worldCalls > 0, true);
    assert.equal(store.world.subjects.some((subject) => subject.name === '石阶积水'), true);
  });
});

test('人物内容失败不阻塞下一回合，历史补档只合入当前人物根且不重放旧世界', async () => {
  let r1ProfileCalls = 0;
  let worldCalls = 0;
  let historicalProfilePrompt = '';
  const completeProfile = completeAuthorityProfile('林页');
  const harness = runtimeHarness(undefined, '', false, {
    completeMvu: true,
    extensionSettings: {
      'mvu-doctor-kemini-clean': {
        enabled: true,
        variableDoctor: false,
        worldEngine: true,
        repairAttempts: 0,
        ticketCount: 2,
      },
    },
    generateDiscovery({ prompt }) {
      return String(prompt || '').includes('林页在药房门口递出采购清单')
        ? '<人物发现>\n人物：林页\n锚点：林页在药房门口递出采购清单\n</人物发现>'
        : '<人物发现>NONE</人物发现>';
    },
    generateRaw({ systemPrompt, prompt }) {
      const system = String(systemPrompt || '');
      if (system.includes('MVU人物档案医师')) {
        if (!String(prompt || '').includes('林页在药房门口递出采购清单')) return '<人物档案无变化/>';
        r1ProfileCalls += 1;
        if (r1ProfileCalls === 1) return '<人物档案更新>[{"name":"林页"}]</人物档案更新>';
        historicalProfilePrompt = String(prompt || '');
        return `<人物档案更新>${JSON.stringify([completeProfile])}</人物档案更新>`;
      }
      if (system.includes('世界长期主体发现器')) {
        worldCalls += 1;
        return `世界摘要：石阶积水成为独立环境进程。\n\n${newProcessWorldBlock({
          name: '石阶积水',
          sourceAnchor: '雨水沿着空荡的石阶向下流去',
          anchor: '石阶积水会随降雨与排水条件继续变化',
          current: '雨水正沿空荡石阶向下流动',
          goal: '记录积水如何随降雨与排水变化',
          attempt: '核对本时段雨势与石阶排水情况',
          outcome: '本时段雨水仍沿石阶持续向下流动',
          stateChange: '石阶积水成为可在下一时段复核的环境进程',
          nextAction: '下一时段复核雨势与积水深度是否变化',
          thread: '石阶降雨进程',
        })}`;
      }
      if (system.includes('全局世界裁决器')) {
        worldCalls += 1;
        return `世界摘要：既有石阶积水按本轮票据继续演化。\n\n${scheduledWorldBlocks(prompt, '石阶积水').join('\n\n')}`;
      }
      return '';
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const r1Accepted = '<content>林页在药房门口递出采购清单，并向值班药剂师询问到货日期。雨水沿着空荡的石阶向下流去。</content><options><option>继续观察</option></options>';
  const first = await acceptInitialSwipe(harness, (activeHarness) => withCharacterTicketReceipt(
    r1Accepted,
    [currentTicketAssignment(activeHarness, '林页')],
  ));
  assert.equal(first.store.pendingRetry?.kind, 'profile');
  assert.equal(first.store.pendingRetry?.messageId, first.messageId);
  const r1TicketId = first.store.pendingRetry?.session?.tickets?.[0]?.ticketId;
  assert.ok(r1TicketId);
  assert.equal(first.store.world.subjects.some((subject) => subject.name === '石阶积水'), true);
  assert.equal(first.store.fullRuns[0].outcome.world.ok, true);

  const second = await acceptNextSwipe(
    harness,
    '再等一会儿，观察积水变化。',
    withCharacterTicketReceipt(
      '<content>雨势稍缓，石阶积水仍沿排水槽缓慢下泄。</content><options><option>继续观察</option></options>',
      [],
    ),
  );
  assert.equal(second.store.pendingRetries.some((entry) => entry.messageId === first.messageId && entry.kind === 'profile'), true);
  assert.equal(harness.hooks.runtime.retry?.messageId, first.messageId);
  const worldBeforeCatchup = structuredClone(second.store.world);
  const r1MvuBeforeCatchup = structuredClone(harness.mvuByMessage.get(first.messageId) || { stat_data: {} });
  const r2MvuBeforeCatchup = structuredClone(harness.mvuByMessage.get(second.messageId) || { stat_data: {} });
  const r2Ledger = structuredClone(second.store.ticketLedger.find((entry) => entry.messageId === second.messageId));
  second.store.ticketLedger = second.store.ticketLedger.filter((entry) => entry.messageId !== first.messageId);
  const worldCallsBeforeCatchup = worldCalls;
  const outcomeWorldsBeforeCatchup = new Map(second.store.swipeOutcomes.map((entry) => [
    `${entry.messageId}:${entry.swipeId}:${entry.fingerprint}`,
    structuredClone(entry.world),
  ]));

  const activeMvu = harness.window.Mvu;
  const profileCallsBeforeUnavailableMvu = r1ProfileCalls;
  const mvuWritesBeforeUnavailableMvu = harness.mvuWrites.length;
  harness.window.Mvu = null;
  await harness.hooks.retryLastFailure();
  assert.equal(second.store.pendingRetries.some((entry) => entry.messageId === first.messageId && entry.kind === 'profile'), true);
  assert.equal(harness.hooks.runtime.retry?.messageId, first.messageId);
  assert.equal(r1ProfileCalls, profileCallsBeforeUnavailableMvu);
  assert.equal(harness.mvuWrites.length, mvuWritesBeforeUnavailableMvu);
  assert.equal(worldCalls, worldCallsBeforeCatchup);
  assert.deepEqual(harness.mvuByMessage.get(second.messageId) || { stat_data: {} }, r2MvuBeforeCatchup);
  harness.window.Mvu = activeMvu;

  await harness.hooks.retryLastFailure();

  const r2MvuAfterCatchup = structuredClone(harness.mvuByMessage.get(second.messageId) || { stat_data: {} });
  const savedProfiles = Object.values(r2MvuAfterCatchup.stat_data?.人物档案?.byActorId || {});
  assert.equal(savedProfiles.some((profile) => profile.name === '林页'), true);
  assert.equal(savedProfiles.find((profile) => profile.name === '林页')?.ticketId, r1TicketId);
  assert.deepEqual(harness.mvuByMessage.get(first.messageId) || { stat_data: {} }, r1MvuBeforeCatchup);
  const withoutProfiles = (data) => {
    const clone = structuredClone(data || { stat_data: {} });
    if (clone.stat_data) delete clone.stat_data.人物档案;
    return clone;
  };
  assert.deepEqual(withoutProfiles(r2MvuAfterCatchup), withoutProfiles(r2MvuBeforeCatchup));
  assert.deepEqual(structuredClone({
    revision: second.store.world.revision,
    turn: second.store.world.turn,
    subjects: second.store.world.subjects,
    changes: second.store.world.changes,
    receipts: second.store.world.receipts,
  }), {
    revision: worldBeforeCatchup.revision,
    turn: worldBeforeCatchup.turn,
    subjects: worldBeforeCatchup.subjects,
    changes: worldBeforeCatchup.changes,
    receipts: worldBeforeCatchup.receipts,
  });
  assert.equal(second.store.pendingRetries.some((entry) => entry.messageId === first.messageId), false);
  assert.equal(worldCalls, worldCallsBeforeCatchup);
  assert.match(historicalProfilePrompt, /建档证据之后、当前写入点之前的已接受公开正文/);
  assert.match(historicalProfilePrompt, /雨势稍缓/);
  const r2Outcome = second.store.swipeOutcomes.find((entry) => entry.messageId === second.messageId && entry.swipeId === 0);
  assert.deepEqual(r2Outcome?.tickets || [], r2Ledger?.tickets || []);
  const r1Outcome = second.store.swipeOutcomes.find((entry) => entry.messageId === first.messageId && entry.swipeId === 0);
  assert.equal(Object.values(r1Outcome?.profileRoot?.byActorId || {}).some((profile) => profile.name === '林页'), true);
  assert.equal((r1Outcome?.pendingRetries || []).some((entry) => entry.messageId === first.messageId), false);
  for (const outcome of second.store.swipeOutcomes) {
    const key = `${outcome.messageId}:${outcome.swipeId}:${outcome.fingerprint}`;
    if (outcomeWorldsBeforeCatchup.has(key)) assert.deepEqual(structuredClone(outcome.world), outcomeWorldsBeforeCatchup.get(key));
  }
});

test('重试目标正文变化时会持久化清理旧任务，刷新后不再复活', async () => {
  const harness = runtimeHarness(undefined, '', false, {
    extensionSettings: {
      'mvu-doctor-kemini-clean': {
        enabled: true,
        variableDoctor: false,
        worldEngine: false,
        repairAttempts: 0,
      },
    },
    generateDiscovery() {
      return '<人物发现>\n人物：林页\n锚点：林页把纸页压在掌下\n</人物发现>';
    },
    generateRaw({ systemPrompt }) {
      return String(systemPrompt || '').includes('MVU人物档案医师')
        ? '<人物档案更新>[{"name":"林页"}]</人物档案更新>'
        : '';
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const first = await acceptInitialSwipe(harness, (activeHarness) => withCharacterTicketReceipt(
    '<content>林页把纸页压在掌下，开始核对柜台记录。</content><options><option>继续观察</option></options>',
    [currentTicketAssignment(activeHarness, '林页')],
  ));
  assert.equal(first.store.pendingRetry?.kind, 'profile');
  const saveCallsBeforeCleanup = harness.counters.saveMetadata;
  harness.context.chat[first.messageId].mes = '<content>这一楼层已经换成另一段正文。</content>';

  await harness.hooks.retryLastFailure();

  assert.equal(harness.counters.saveMetadata > saveCallsBeforeCleanup, true);
  assert.equal(first.store.pendingRetries.some((entry) => entry.messageId === first.messageId), false);
  assert.equal(first.store.pendingRetry, null);
  assert.equal(harness.hooks.runtime.retry, null);
});

test('disabled initialization preserves every lifecycle WAL without model, MVU or metadata writes', async () => {
  const pendingAcceptedFinal = {
    schemaVersion: 2,
    transactionId: 'final-disabled',
    chatId: 'reroll-chat',
    stage: 'generating',
    endedAt: null,
    acceptedIdentity: null,
    session: { id: 'disabled-generation', chatId: 'reroll-chat', targetIndex: 1, expectedFinalSwipeId: 0 },
  };
  const preparedReroll = {
    schemaVersion: 2,
    transactionId: 'reroll-disabled',
    chatId: 'reroll-chat',
    target: { chatId: 'reroll-chat', messageId: 1, swipeId: 1, fingerprint: '1:00000000' },
    fallbackIdentity: { chatId: 'reroll-chat', messageId: 1, swipeId: 0, fingerprint: '1:00000000' },
    fallback: { chatId: 'reroll-chat', messageId: 1, swipeId: 0, fingerprint: '1:00000000' },
    observedEmptySlot: true,
    stage: 'generation_started',
  };
  const variableRepairs = [{ repairId: 'repair-disabled', status: 'prepared', messageId: 1 }];
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '禁用状态。' }],
    '',
    false,
    {
      extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: false } },
      context: {
        chatMetadata: {
          'mvu-doctor-kemini-clean': {
            pendingAcceptedFinal: structuredClone(pendingAcceptedFinal),
            preparedReroll: structuredClone(preparedReroll),
            variableRepairs: structuredClone(variableRepairs),
          },
        },
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 40));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.deepEqual(store.pendingAcceptedFinal, pendingAcceptedFinal);
  assert.deepEqual(store.preparedReroll, preparedReroll);
  assert.deepEqual(store.variableRepairs, variableRepairs);
  assert.equal(harness.doctorCalls.length, 0);
  assert.equal(harness.counters.mvuRead, 0);
  assert.equal(harness.counters.mvuReplace, 0);
  assert.equal(harness.counters.saveMetadata, 0);
});

test('refresh never consumes a generating accepted-final receipt', async () => {
  const generating = {
    schemaVersion: 2,
    transactionId: 'final-generating-refresh',
    chatId: 'reroll-chat',
    stage: 'generating',
    endedAt: null,
    acceptedIdentity: null,
    session: {
      id: 'generation-before-refresh', chatId: 'reroll-chat', startedAt: Date.now() - 1000,
      generationKind: 'normal', targetIndex: 1, expectedFinalSwipeId: 0,
      baselineIndex: -1, baselineIdentity: null, baselineText: '', tickets: [],
    },
  };
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '刷新前正在生成。' }],
    '',
    false,
    {
      extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false } },
      context: { chatMetadata: { 'mvu-doctor-kemini-clean': { pendingAcceptedFinal: structuredClone(generating) } } },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 60));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.pendingAcceptedFinal.transactionId, generating.transactionId);
  assert.equal(store.pendingAcceptedFinal.stage, 'generating');
  assert.equal(store.pendingAcceptedFinal.endedAt, null);
  assert.equal(store.fullRuns.length, 0);
  assert.equal(store.ticketLedger.length, 0);
  assert.equal(harness.doctorCalls.length, 0);
  assert.equal(harness.counters.mvuReplace, 0);
});

test('generationStart is UI-busy while its own automatic retry predicate ignores only that exact token', async () => {
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '检查忙碌判定。' }],
    '',
    false,
    { extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true } } },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const token = { epoch: 999, chatId: harness.context.chatId, kind: 'normal', cancelled: false };
  harness.hooks.runtime.generationStart = token;
  harness.hooks.renderRetryControl();

  assert.equal(harness.hooks.runtimeHasPendingWork(), true);
  assert.equal(harness.hooks.runtimeHasPendingWorkForAutoRetry(token), false);
  assert.equal(harness.hooks.runtimeHasPendingWorkForAutoRetry({ ...token }), true);
  assert.equal(harness.uiNodes.get('retry').disabled, true);
  assert.equal(harness.uiNodes.get('manualVariableAudit').disabled, true);
  assert.equal(harness.uiNodes.get('manualWorldAdvance').disabled, true);

  harness.hooks.runtime.generationStart = null;
  harness.hooks.renderRetryControl();
});

test('refresh promotes only an ended exact target to durable accepted before Doctor consumption', async () => {
  const acceptedText = '<content>门外的风铃轻响了一次。</content><options><option>查看门外</option></options>';
  const stages = [];
  const harness = runtimeHarness(
    [
      { is_user: true, is_system: false, mes: '听门外的声音。' },
      { is_user: false, is_system: false, swipe_id: 0, swipes: [acceptedText], mes: acceptedText },
    ],
    '',
    false,
    {
      extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false, repairAttempts: 0 } },
      context: {
        chatMetadata: {
          'mvu-doctor-kemini-clean': {
            pendingAcceptedFinal: {
              schemaVersion: 2,
              transactionId: 'final-ended-refresh',
              chatId: 'reroll-chat',
              stage: 'ended',
              endedAt: Date.now() - 1000,
              acceptedIdentity: null,
              session: {
                id: 'ended-before-refresh', chatId: 'reroll-chat', startedAt: Date.now() - 1500,
                generationKind: 'normal', targetIndex: 1, expectedFinalSwipeId: 0,
                baselineIndex: -1, baselineIdentity: null, baselineText: '', tickets: [],
              },
            },
          },
        },
      },
      saveMetadata({ context }) {
        stages.push(context.chatMetadata['mvu-doctor-kemini-clean']?.pendingAcceptedFinal?.stage || 'closed');
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 120));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(stages.includes('accepted'), true);
  assert.equal(store.pendingAcceptedFinal, null);
  assert.equal(store.fullRuns.length, 1);
  assert.equal(store.fullRuns[0].messageId, 1);
  assert.equal(store.fullRuns[0].finalSwipeId, 0);
});

test('regenerate restores the v7 subject-world checkpoint before building the new injection', async () => {
  const harness = runtimeHarness();
  await new Promise((resolve) => setTimeout(resolve, 20));

  const start = harness.handlers.get('generation_started');
  const stop = harness.handlers.get('generation_stopped');
  assert.equal(typeof start, 'function');
  assert.equal(typeof stop, 'function');
  assert.equal(typeof harness.handlers.get('message_swiped'), 'function');

  await start('normal', {}, false);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.replyCheckpoint.targetIndex, 1);
  assert.deepEqual(store.replyCheckpoint.state.profiles, {});
  assert.equal(store.replyCheckpoint.state.world.schemaVersion, 7);
  assert.ok(Array.isArray(store.replyCheckpoint.state.world.subjects));
  assert.ok(Array.isArray(store.replyCheckpoint.state.world.changes));
  const checkpointWorld = structuredClone(store.replyCheckpoint.state.world);
  stop();

  harness.context.chat.push({ is_user: false, is_system: false, mes: '被放弃的旧回复', swipe_id: 0 });
  store.profiles = { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } };
  store.world.summary = 'REJECTED_WORLD';
  store.world.subjects.push({
    id: 'subject-rejected', type: 'person', name: 'REJECTED_SUBJECT', status: 'active',
    current: '被放弃回复产生的私密状态', publicEffect: 'REJECTED_PUBLIC_EFFECT', publicChannel: 'direct_consequence',
    lastAdvancedTurn: 1, shownTurn: 0,
  });
  store.world.changes.push({
    id: 'change-rejected', subjectIds: ['subject-rejected'], turn: 1,
    attempt: '被放弃的尝试', outcome: '被放弃的结果', stateChange: 'REJECTED_CHANGE',
  });
  store.diagnostics = [{ messageId: 1, kind: 'completed', detail: 'REJECTED_DIAGNOSTIC' }];
  store.fullRuns = [{ messageId: 1, acceptedText: 'REJECTED_RUN' }];

  await start('regenerate', {}, false);

  assert.deepEqual(store.profiles, {});
  assert.equal(store.world.schemaVersion, 7);
  assert.deepEqual(store.world.subjects, checkpointWorld.subjects);
  assert.deepEqual(store.world.changes, checkpointWorld.changes);
  assert.equal(store.world.summary, checkpointWorld.summary);
  assert.deepEqual(store.diagnostics, []);
  const finalInjection = harness.prompts.filter(Boolean).at(-1);
  assert.ok(finalInjection);
  assert.doesNotMatch(finalInjection, /REJECTED_PROFILE|REJECTED_WORLD|REJECTED_SUBJECT|REJECTED_PUBLIC_EFFECT|REJECTED_CHANGE|被放弃的旧回复/);
});

test('real Tavern timing checkpoints the future assistant floor before the user message is appended', async () => {
  const harness = runtimeHarness([{ is_user: false, is_system: false, mes: '默认开场' }], '进入场景');
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.replyCheckpoint.targetIndex, 2);
  assert.equal(store.replyCheckpoint.priorAssistantIndex, 0);
  assert.equal(store.replyCheckpoint.state.world.schemaVersion, 7);
  const checkpointWorld = structuredClone(store.replyCheckpoint.state.world);
  harness.handlers.get('generation_stopped')();

  harness.context.chat.push({ is_user: true, is_system: false, mes: '进入场景' });
  harness.context.chat.push({ is_user: false, is_system: false, mes: '被放弃的旧回复', swipe_id: 0 });
  harness.mvuByMessage.set(2, { stat_data: { 人物档案: { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } } } });
  store.profiles = { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } };
  store.world.summary = 'REJECTED_WORLD';
  store.world.subjects.push({
    id: 'subject-rejected', type: 'process', name: 'REJECTED_PROCESS', status: 'active',
    current: '旧回复产生的后台过程', publicEffect: 'REJECTED_VISIBLE_TRACE', publicChannel: 'environment_trace',
    lastAdvancedTurn: 1, shownTurn: 0,
  });

  await harness.handlers.get('generation_started')('regenerate', {}, false);

  assert.deepEqual(store.profiles, {});
  assert.equal(store.world.schemaVersion, 7);
  assert.deepEqual(store.world.subjects, checkpointWorld.subjects);
  assert.deepEqual(store.world.changes, checkpointWorld.changes);
  assert.equal(store.world.summary, checkpointWorld.summary);
  assert.doesNotMatch(harness.prompts.filter(Boolean).at(-1), /REJECTED_PROFILE|REJECTED_WORLD|REJECTED_PROCESS|REJECTED_VISIBLE_TRACE|被放弃的旧回复/);
});

test('关闭世界引擎时prepareGeneration不召回或注入任何旧世界公开影响', async () => {
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '留在室内整理背包。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.world = {
    schemaVersion: 7,
    chatId: harness.context.chatId,
    turn: 4,
    summary: '旧后台状态',
    subjects: [{
      id: 'subject-disabled-world',
      type: 'process',
      name: '远处港口封锁',
      anchor: '港口按守备规则持续运作',
      current: '港门已经关闭',
      goal: '维持封锁',
      nextAction: '继续检查通行证',
      nextCheckTurn: 5,
      status: 'active',
      publicEffect: 'WORLD_ENGINE_DISABLED_MUST_NOT_LEAK',
      publicChannel: 'environment_trace',
      publicEffectTurn: 4,
      shownTurn: 0,
      offeredTurn: 0,
    }],
    changes: [],
    failures: [],
  };

  await harness.handlers.get('generation_started')('normal', {}, false);
  const injection = harness.prompts.filter(Boolean).at(-1);
  assert.ok(injection);
  assert.doesNotMatch(injection, /WORLD_ENGINE_DISABLED_MUST_NOT_LEAK/);
  assert.match(injection, /世界后台已经造成、现在可能进入正文的公开影响：\n\[\]/u);
  harness.handlers.get('generation_stopped')();
});

test('accepted assistant之后无新用户、无输入的下游事件即使全局停止控件可见也不会重新启动Doctor', async () => {
  const harness = runtimeHarness([
    { is_user: false, is_system: false, mes: '默认开场' },
    { is_user: true, is_system: false, mes: '进入场景' },
    { is_user: false, is_system: false, mes: '已接受正文', swipe_id: 0 },
  ], '', true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const promptsBefore = harness.prompts.length;
  await harness.handlers.get('generation_started')('normal', {}, false);
  assert.equal(harness.prompts.length, promptsBefore);
  assert.equal(store.replyCheckpoint, null);
});

test('accepted正文结构失败不创建变量、人物或世界任务，也不改动v7世界权威', async () => {
  const harness = runtimeHarness([{ is_user: true, is_system: false, mes: '进入场景' }]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await harness.handlers.get('generation_started')('normal', {}, false);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.world.schemaVersion, 7);
  assert.equal('recall' in store.world, false);
  const worldBefore = structuredClone(store.world);
  const doctorCallsBefore = harness.doctorCalls.length;
  const mvuWritesBefore = harness.mvuWrites.length;
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    mes: '<content>第一段</content><content>第二段</content><options></options>',
    swipe_id: 0,
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 650));
  assert.equal(harness.doctorCalls.length, doctorCallsBefore);
  assert.equal(harness.mvuWrites.length, mvuWritesBefore);
  assert.equal(store.world.revision, worldBefore.revision);
  assert.deepEqual(store.world.subjects, worldBefore.subjects);
  assert.deepEqual(store.world.changes, worldBefore.changes);
  assert.equal(store.fullRuns.length, 1);
  assert.equal(store.fullRuns[0].outcome.stage, 'accepted-structure');
  assert.equal(store.fullRuns[0].trace.some((entry) => /变量|profile|world:/u.test(String(entry.stage || ''))), false);
  assert.equal(store.profiles && Object.keys(store.profiles).length, 0);
  assert.equal(harness.uiRoot.dataset.state, 'error');
});

test('worldbook entry with a unique exact structured character key protects the profile from random-ticket takeover', async () => {
  const authorityProfile = completeAuthorityProfile('林页');
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '走到旅店柜台前。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      context: {
        characterId: 0,
        characters: [{
          data: {
            name: '当前角色卡主体',
            character_book: {
              entries: [{
                comment: '林页',
                keys: ['林页'],
                enabled: true,
                content: '林页是合成设定中的既有人物；她务实健谈，并以药材采购员身份工作。',
              }],
            },
          },
        }],
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 场景: { 位置: '旅店柜台前' } } }]],
      generateRaw({ systemPrompt }) {
        if (String(systemPrompt).includes('MVU人物档案医师')) {
          return `<人物档案更新>${JSON.stringify([authorityProfile])}</人物档案更新>`;
        }
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: withCharacterTicketReceipt(
      '<content>林页走进药房，把补货清单交给值班药剂师。</content><options><option>向她询问记录</option></options>',
      [{ name: '林页', source: 'authority' }],
    ),
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 700));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const root = harness.mvuByMessage.get(1).stat_data.人物档案.byActorId;
  const saved = Object.values(root)[0];
  assert.equal(Object.keys(root).length, 1);
  assert.equal(saved.name, '林页');
  assert.equal(saved.authoritySource, 'character-card-or-worldbook');
  assert.equal(saved.ticketId, undefined);
  assert.equal(saved.personality.temperament, '角色卡明确设定的热情直率');
  assert.deepEqual(store.ticketLedger[0].assignments.map(({ name, source, ticketId }) => ({ name, source, ticketId })), [
    { name: '林页', source: 'authority', ticketId: '' },
  ]);
  assert.equal(harness.doctorCalls.filter((request) => String(request.systemPrompt).includes('MVU人物档案医师')).length, 1);
});

test('retrying a variable failure reuses the already successful profile result instead of calling the profile model again', async () => {
  let variableCalls = 0;
  let profileCalls = 0;
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '留在室内观察。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: true,
          worldEngine: true,
          repairAttempts: 0,
          worldSubjectLimit: 3,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '室内' } } }]],
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU变量核验与修复器')) {
          variableCalls += 1;
          if (variableCalls === 1) return '第一次变量回复无法解析';
          return '<UpdateVariable><Analysis>最终正文没有改变场景；当前 /状态/场景 仍为室内，与正文事实一致。</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';
        }
        if (system.includes('MVU人物档案医师')) {
          profileCalls += 1;
          return '<人物档案无变化/>';
        }
        if (system.includes('全局世界裁决器') || system.includes('世界长期主体发现器')) {
          return `世界摘要：正文中的持续风声建立了可追踪的天气进程。\n\n${newProcessWorldBlock({
            name: '窗外的风声',
            sourceAnchor: '听见窗外的风声持续了一阵',
            anchor: '窗外的风声会随时段与天气条件持续变化',
            current: '窗外风声已经持续一阵，尚未出现其他可观察影响',
            goal: '按后续天气条件记录风况如何演化',
            attempt: '根据本时段风声核对风况是否持续',
            outcome: '风声在本时段内持续，但没有造成额外公开影响',
            stateChange: '窗外风况由短暂现象变为可在下个时段复核的持续进程',
            nextAction: '下一时段复核风声强弱与方向是否改变',
            thread: '室外天气变化',
          })}`;
        }
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: withCharacterTicketReceipt(
      '<content>室内没有发生新的变化，可以听见窗外的风声持续了一阵。</content><options><option>继续观察</option></options>',
      [],
    ),
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.fullRuns[0].outcome.stage, 'variable');
  assert.equal(store.ticketLedger[0].assignmentReceiptStatus, 'complete');
  assert.deepEqual(store.ticketLedger[0].assignments, []);
  assert.equal(profileCalls, 1);
  assert.equal(variableCalls, 1);
  assert.equal(typeof harness.hooks.retryLastFailure, 'function');

  await harness.hooks.retryLastFailure();

  assert.equal(variableCalls, 2);
  assert.equal(profileCalls, 1);
  assert.equal(harness.hooks.runtime.retry, null);
  assert.equal(store.world.subjects.some((subject) => subject.name === '窗外的风声'), true);
});

test('GENERATION_STARTED自动恢复失败时不创建新session，manifest拦截器只取消本次主生成', async () => {
  let variableCalls = 0;
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '检查室内状态。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: true,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '室内' } } }]],
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU变量核验与修复器')) {
          variableCalls += 1;
          return `第${variableCalls}次变量回复仍无法解析`;
        }
        if (system.includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>室内状态没有改变。</content><options><option>继续检查</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));
  assert.ok(harness.hooks.runtime.retry);
  assert.equal(variableCalls, 1);

  harness.context.chat.push({ is_user: true, is_system: false, mes: '开始下一回合。' });
  await harness.handlers.get('generation_started')('normal', {}, false);

  assert.equal(variableCalls, 2);
  assert.ok(harness.hooks.runtime.retry);
  assert.equal(harness.hooks.runtime.active, null);
  assert.equal(harness.hooks.runtime.preparation, null);
  assert.ok(harness.hooks.runtime.blockedGeneration);
  assert.equal(typeof harness.generationInterceptor, 'function');

  const abortCalls = [];
  await harness.generationInterceptor([], 0, (immediately) => abortCalls.push(immediately), 'normal');

  assert.deepEqual(abortCalls, [true]);
  assert.equal(harness.hooks.runtime.active, null);
  assert.equal(harness.hooks.runtime.blockedGeneration, null);
  assert.equal(harness.prompts.at(-1), '');
});

test('GENERATION_STARTED逐项恢复成功后才为新用户回合准备session与注入', async () => {
  let variableCalls = 0;
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '检查室内状态。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: true,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '室内' } } }]],
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU变量核验与修复器')) {
          variableCalls += 1;
          if (variableCalls === 1) return '首次变量回复无法解析';
          return '<UpdateVariable><Analysis>最终正文没有改变场景；当前 /状态/场景 仍为室内，与正文事实一致。</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';
        }
        if (system.includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>室内状态没有改变。</content><options><option>继续检查</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));
  assert.ok(harness.hooks.runtime.retry);

  harness.context.chat.push({ is_user: true, is_system: false, mes: '开始下一回合。' });
  const started = harness.handlers.get('generation_started')('normal', {}, false);
  const preparationCompleted = await Promise.race([
    started.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 1200)),
  ]);
  if (!preparationCompleted) {
    harness.handlers.get('generation_stopped')();
    await started;
  }
  assert.equal(preparationCompleted, true, '成功恢复后仍被旧processingSession占用，新回合prepare没有完成');

  assert.equal(variableCalls, 2);
  assert.equal(harness.hooks.runtime.retry, null);
  assert.equal(harness.hooks.runtime.blockedGeneration, null);
  assert.ok(harness.hooks.runtime.active);
  assert.equal(harness.hooks.runtime.active.generationKind, 'normal');
  assert.equal(harness.hooks.runtime.active.targetIndex, 3);
  assert.equal(harness.hooks.runtime.preparation, null);
  assert.ok(harness.prompts.filter(Boolean).at(-1));
  harness.handlers.get('generation_stopped')();
});

test('自动恢复失败并拦截主生成后，原重试任务与手动恢复入口仍可继续使用', async () => {
  const harness = runtimeHarness([{ is_user: true, is_system: false, mes: '先观察房间。' }]);
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>房间里暂时没有新的变化。</content><options><option>继续</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 700));

  const retry = harness.uiNodes.get('retry');
  assert.match(retry.textContent, /重试MVU变量失败步骤/);
  assert.equal(retry.disabled, false);

  harness.context.chat.push({ is_user: true, is_system: false, mes: '开始下一次行动。' });
  await harness.handlers.get('generation_started')('normal', {}, false);

  assert.match(retry.textContent, /重试MVU变量失败步骤/);
  assert.equal(harness.hooks.runtime.active, null);
  assert.ok(harness.hooks.runtime.blockedGeneration);

  const abortCalls = [];
  await harness.generationInterceptor([], 0, (immediately) => abortCalls.push(immediately), 'normal');

  assert.deepEqual(abortCalls, [true]);
  assert.equal(harness.hooks.runtime.blockedGeneration, null);
  assert.equal(retry.disabled, false);
  assert.equal(harness.uiNodes.get('manualVariableAudit').disabled, false);
  assert.equal(harness.uiNodes.get('manualWorldAdvance').disabled, false);
});

test('manual latest-message swipe restores the same pre-generation v7 subject authority', async () => {
  const harness = runtimeHarness();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.handlers.get('generation_stopped')();

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const checkpointWorld = structuredClone(store.replyCheckpoint.state.world);
  harness.context.chat.push({ is_user: false, is_system: false, mes: '旧 swipe', swipe_id: 1 });
  store.profiles = { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } };
  store.world.summary = 'REJECTED_WORLD';
  store.world.subjects.push({
    id: 'subject-old-swipe', type: 'faction', name: 'REJECTED_FACTION', status: 'active',
    current: '旧swipe状态', publicEffect: 'REJECTED_FACTION_EFFECT', publicChannel: 'named_action',
    lastAdvancedTurn: 1, shownTurn: 0,
  });

  harness.handlers.get('message_swiped')(1);
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(store.profiles, {});
  assert.equal(store.world.schemaVersion, 7);
  assert.deepEqual(store.world.subjects, checkpointWorld.subjects);
  assert.deepEqual(store.world.changes, checkpointWorld.changes);
  assert.equal(store.world.summary, checkpointWorld.summary);
  assert.equal(harness.prompts.at(-1), '');
});

test('MESSAGE_SWIPED先指向未生成空槽时只交接旧swipe，随后START接受同文本新身份并闭合', async () => {
  const accepted = '<content>雨声仍落在同一扇窗上。</content><options><option>继续听雨</option></options>';
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '听一会儿雨。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      generateRaw() { return '<人物档案无变化/>'; },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [accepted], mes: accepted });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 700));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.swipeOutcomes.some((entry) => entry.messageId === 1 && entry.swipeId === 0), true);

  // Real SillyTavern overswipe: swipe_id points one past swipes while mes can still be the old text.
  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [accepted], mes: accepted };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(store.doctorStateQuarantined, null);
  assert.ok(store.preparedReroll);
  assert.equal(store.preparedReroll.stage, 'slot_observed');
  assert.equal(store.preparedReroll.observedEmptySlot, true);
  assert.equal(store.preparedReroll.target.swipeId, 1);
  assert.equal(store.preparedReroll.fallbackIdentity.swipeId, 0);
  assert.equal(store.preparedReroll.fallback.swipeId, 0);

  await harness.handlers.get('generation_started')('swipe', {}, false);
  assert.equal(store.doctorStateQuarantined, null);
  assert.equal(store.preparedReroll.stage, 'generation_started');
  assert.equal(harness.hooks.runtime.active.baselineIdentity.swipeId, 0);
  assert.equal(harness.hooks.runtime.active.targetIndex, 1);

  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [accepted, accepted], mes: accepted };
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 700));

  assert.equal(store.doctorStateQuarantined, null);
  assert.equal(store.preparedReroll, null);
  assert.equal(store.swipeOutcomes.some((entry) => entry.messageId === 1 && entry.swipeId === 1), true);
  assert.equal(store.fullRuns.length, 2);

  const callsBeforeHistoricalRestore = harness.doctorCalls.length;
  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 0, swipes: [accepted, accepted], mes: accepted };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 0 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(harness.doctorCalls.length, callsBeforeHistoricalRestore);
  assert.equal(store.doctorStateQuarantined, null);
  assert.match(harness.hooks.runtime.status.phase, /已恢复选中 swipe/);
});

test('空开场swipe是合法空权威，不建立伪fallback也不隔离', async () => {
  const harness = runtimeHarness([
    { is_user: false, is_system: false, swipe_id: 0, swipes: [''], mes: '' },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];

  harness.handlers.get('message_swiped')({ messageId: 0, swipeId: 0 });
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(store.doctorStateQuarantined, null);
  assert.equal(store.preparedReroll, null);
  assert.equal(harness.mvuWrites.length, 0);
  assert.match(harness.hooks.runtime.status.phase, /开场白/);
});

test('新空槽只认紧邻空字符串来源，不向前跳到更早的已保存swipe', async () => {
  const harness = runtimeHarness([
    { is_user: false, is_system: false, swipe_id: 2, swipes: ['更早的已验收swipe', ''], mes: '' },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.swipeOutcomes = [{
    schemaVersion: 1,
    chatId: harness.context.chatId,
    messageId: 0,
    swipeId: 0,
    fingerprint: '22:00000000',
    profiles: {},
    profileRoot: { schemaVersion: 1, byActorId: {} },
    world: structuredClone(store.world),
  }];

  harness.handlers.get('message_swiped')({ messageId: 0, swipeId: 2 });
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(store.doctorStateQuarantined, null);
  assert.equal(store.preparedReroll.stage, 'slot_observed');
  assert.equal(store.preparedReroll.fallbackIdentity.swipeId, 1);
  assert.equal(store.preparedReroll.fallbackIdentity.fingerprint, '0:811c9dc5');
  assert.equal(store.preparedReroll.fallback, null);
});

test('新空槽START后立即STOP会恢复来源swipe与完整Doctor权威并清空唯一WAL', async () => {
  const oldText = '<content>旧swipe已经被接受。</content><options><option>继续</option></options>';
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '生成一条可重roll的回复。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      mvuByMessage: [[1, { stat_data: {} }]],
      generateRaw() { return '<人物档案无变化/>'; },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [oldText], mes: oldText });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 700));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const sourceOutcome = store.swipeOutcomes.find((entry) => entry.messageId === 1 && entry.swipeId === 0);
  assert.ok(sourceOutcome);
  const sourceProfile = { profileId: 'source-profile', name: '来源swipe人物' };
  sourceOutcome.profiles = { [sourceProfile.profileId]: structuredClone(sourceProfile) };
  sourceOutcome.profileRoot = { schemaVersion: 1, byActorId: structuredClone(sourceOutcome.profiles) };
  sourceOutcome.world.summary = '来源swipe完整世界权威';
  store.profiles = structuredClone(sourceOutcome.profiles);
  store.world = structuredClone(sourceOutcome.world);
  harness.mvuByMessage.set(1, { stat_data: { 人物档案: structuredClone(sourceOutcome.profileRoot) } });

  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [oldText], mes: oldText };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(store.preparedReroll.stage, 'slot_observed');
  assert.equal(store.preparedReroll.fallback.swipeId, 0);

  await harness.handlers.get('generation_started')('swipe', {}, false);
  assert.equal(store.preparedReroll.stage, 'generation_started');
  assert.deepEqual(store.profiles, {});
  const writesBeforeStop = harness.mvuWrites.length;
  harness.handlers.get('generation_stopped')();
  for (let attempt = 0; attempt < 40 && store.preparedReroll; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  assert.equal(store.doctorStateQuarantined, null);
  assert.equal(store.preparedReroll, null);
  assert.equal(store.pendingAcceptedFinal, null);
  assert.equal(harness.context.chat[1].swipe_id, 0);
  assert.equal(harness.context.chat[1].mes, oldText);
  assert.deepEqual(store.profiles, sourceOutcome.profiles);
  assert.equal(store.world.summary, '来源swipe完整世界权威');
  assert.deepEqual(harness.mvuByMessage.get(1).stat_data.人物档案.byActorId, sourceOutcome.profiles);
  assert.ok(harness.mvuWrites.length > writesBeforeStop);
  assert.ok(harness.counters.saveChat > 0);
});

test('新空槽生成中刷新会从唯一WAL回到来源swipe，不把占位正文当accepted-final', async () => {
  const oldText = '<content>刷新前的来源swipe。</content><options><option>继续</option></options>';
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '生成后再重roll。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false, repairAttempts: 0 },
      },
      mvuByMessage: [[1, { stat_data: {} }]],
      generateRaw() { return '<人物档案无变化/>'; },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [oldText], mes: oldText });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 700));

  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [oldText], mes: oldText };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 70));
  await harness.handlers.get('generation_started')('swipe', {}, false);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.preparedReroll.stage, 'generation_started');
  assert.equal(store.pendingAcceptedFinal.stage, 'generating');

  harness.handlers.get('chat_loaded')();
  for (let attempt = 0; attempt < 50 && store.preparedReroll; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  assert.equal(store.doctorStateQuarantined, null);
  assert.equal(store.pendingAcceptedFinal, null);
  assert.equal(store.preparedReroll, null);
  assert.equal(harness.context.chat[1].swipe_id, 0);
  assert.equal(harness.context.chat[1].mes, oldText);
  assert.equal(store.fullRuns.length, 1);
});

test('新空槽生成中切换聊天只清瞬时引用，不向新聊天写来源fallback', async () => {
  const oldText = '<content>旧聊天来源swipe。</content><options><option>继续</option></options>';
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '准备跨聊天测试。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false, repairAttempts: 0 },
      },
      mvuByMessage: [[1, { stat_data: {} }]],
      generateRaw() { return '<人物档案无变化/>'; },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [oldText], mes: oldText });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 700));
  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [oldText], mes: oldText };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 70));
  await harness.handlers.get('generation_started')('swipe', {}, false);
  const oldStore = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const writesBeforeSwitch = harness.mvuWrites.length;

  harness.context.chatId = 'other-chat';
  harness.context.chat = [{ is_user: true, is_system: false, mes: '新聊天输入' }];
  harness.context.chatMetadata = {};
  harness.handlers.get('chat_changed')();
  await new Promise((resolve) => setTimeout(resolve, 120));

  const newStore = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.ok(oldStore.preparedReroll);
  assert.equal(newStore.preparedReroll, null);
  assert.equal(newStore.doctorStateQuarantined, null);
  assert.equal(Object.keys(newStore.profiles).length, 0);
  assert.equal(harness.mvuWrites.length, writesBeforeSwitch);
  assert.equal(harness.hooks.runtime.swipeGenerationHandoff, null);
});

test('legacy regenerate with a valid checkpoint accepts the fresh swipe and restores only the Doctor-owned profile root', async () => {
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '进入场景' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.profiles = { keeper: { profileId: 'keeper', name: 'KEEPER_PROFILE' } };
  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.handlers.get('generation_stopped')();

  harness.context.chat.push({ is_user: false, is_system: false, mes: '被放弃的旧回复', swipe_id: 0 });
  store.profiles = { rejected: { profileId: 'rejected', name: 'REJECTED_PROFILE' } };
  await harness.handlers.get('generation_started')('regenerate', {}, false);
  assert.equal(harness.hooks.runtime.active?.expectedFinalSwipeId, null);

  const rerolledMvu = harness.mvuByMessage.get(1);
  rerolledMvu.stat_data.其他系统字段 = { preserved: true };
  harness.mvuByMessage.set(1, rerolledMvu);
  harness.context.chat[1] = { is_user: false, is_system: false, mes: '新的重 roll 回复', swipe_id: 1 };
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 560));

  const settled = harness.mvuByMessage.get(1);
  assert.deepEqual(settled.stat_data.人物档案, {
    schemaVersion: 1,
    byActorId: { keeper: { profileId: 'keeper', name: 'KEEPER_PROFILE' } },
  });
  assert.deepEqual(settled.stat_data.其他系统字段, { preserved: true });
  assert.equal(harness.context.chat[1].mes, '新的重 roll 回复');
  assert.equal(store.pendingAcceptedFinal, null);
  assert.equal(store.preparedReroll, null);
  assert.equal(store.doctorStateQuarantined, null);
  assert.equal(store.fullRuns.length, 1);
  assert.notEqual(store.fullRuns[0].outcome.stage, 'reroll-quarantine');
  assert.equal(store.fullRuns[0].finalSwipeId, 1);
  assert.equal(store.swipeOutcomes.some((entry) => entry.messageId === 1 && entry.swipeId === 1), true);
});

test('a legacy reroll without a matching checkpoint quarantines before structure, ticket or Doctor writes', async () => {
  const harness = runtimeHarness([
    { is_user: true, is_system: false, mes: '进入场景' },
    { is_user: false, is_system: false, mes: '旧回复', swipe_id: 0 },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.profiles = { old: { profileId: 'old', name: 'OLD_PROFILE' } };
  store.world.summary = 'OLD_WORLD';
  store.ticketLedger = [{ ticketId: 'old-ticket', status: 'accepted-before-reroll' }];
  const beforeWorld = structuredClone(store.world);
  const beforeProfiles = structuredClone(store.profiles);
  const beforeTicketLedger = structuredClone(store.ticketLedger);
  const beforeMvu = structuredClone(harness.mvuByMessage.get(1));
  const quarantinedText = '<content>第一段</content><content>第二段</content><options></options>';

  await harness.handlers.get('generation_started')('regenerate', {}, false);
  assert.equal(harness.hooks.runtime.active?.expectedFinalSwipeId, null);
  assert.equal(harness.hooks.runtime.active?.rerollQuarantined, true);
  assert.equal(harness.hooks.runtime.active?.checkpointRestored, false);
  assert.equal(harness.hooks.runtime.active?.injection, '');
  assert.equal(harness.prompts.filter(Boolean).length, 0);
  harness.context.chat[1] = { is_user: false, is_system: false, mes: quarantinedText, swipe_id: 1 };
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 650));

  assert.equal(harness.doctorCalls.length, 0);
  assert.equal(harness.mvuWrites.length, 0);
  assert.equal(harness.counters.mvuParse, 0);
  assert.equal(harness.counters.mvuReplace, 0);
  assert.equal(harness.counters.saveChat, 0);
  assert.deepEqual(harness.mvuByMessage.get(1), beforeMvu);
  assert.deepEqual(store.profiles, beforeProfiles);
  assert.equal(JSON.stringify(store.world), JSON.stringify(beforeWorld));
  assert.deepEqual(store.ticketLedger, beforeTicketLedger);
  assert.equal(store.pendingRetries.length, 0);
  assert.equal(harness.hooks.runtime.retry, null);
  assert.equal(harness.context.chat[1].mes, quarantinedText);
  assert.equal(store.pendingAcceptedFinal, null);
  assert.equal(store.preparedReroll, null);
  assert.equal(store.swipeOutcomes.length, 0);
  assert.equal(store.fullRuns.length, 1);
  assert.ok(store.doctorStateQuarantined);
  assert.equal(store.fullRuns.at(0).outcome.stage, 'reroll-quarantine');
  assert.equal(store.fullRuns.at(0).trace.some((entry) => /accepted-structure|ticket|variable|profile|world:/u.test(String(entry.stage || ''))), false);
  assert.equal(store.diagnostics.at(0).kind, 'reroll_quarantined');
  assert.match(store.diagnostics.at(0).detail, /禁止写入MVU修复、人物档案和世界状态/);
});

test('missing-checkpoint quarantine persists across later normal generations and disables every recovery write entry', async () => {
  const harness = runtimeHarness([
    { is_user: true, is_system: false, mes: '进入场景' },
    { is_user: false, is_system: false, mes: '旧回复', swipe_id: 0 },
  ], '继续前进');
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('regenerate', {}, false);
  harness.context.chat[1] = {
    is_user: false,
    is_system: false,
    mes: '<content>重 roll 后的新正文。</content><options><option>继续</option></options>',
    swipe_id: 1,
  };
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 650));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.ok(store.doctorStateQuarantined);
  const callsBefore = harness.doctorCalls.length;
  const writesBefore = harness.mvuWrites.length;
  const checkpointBefore = structuredClone(store.replyCheckpoint);

  harness.context.chat.push({ is_user: true, is_system: false, mes: '继续前进' });
  await harness.handlers.get('generation_started')('normal', {}, false);

  assert.equal(harness.prompts.at(-1), '');
  assert.equal(harness.doctorCalls.length, callsBefore);
  assert.equal(harness.mvuWrites.length, writesBefore);
  assert.deepEqual(store.replyCheckpoint, checkpointBefore);
  assert.equal(harness.uiNodes.get('retry').disabled, true);
  assert.equal(harness.uiNodes.get('manualVariableAudit').disabled, true);
  assert.equal(harness.uiNodes.get('manualWorldAdvance').disabled, true);
  assert.equal(harness.uiRoot.dataset.state, 'warning');
});

test('two accepted swipes round-trip their own Doctor outcome by message, swipe and final-text identity without recalling models', async () => {
  const baseTextA = '<content>分支甲中，林甲在东侧柜台查阅并核对了第一本账册。</content><options><option>询问林甲</option></options>';
  const baseTextB = '<content>分支乙中，林乙在西侧门廊阅读并检查了第二封信。</content><options><option>询问林乙</option></options>';
  let textA = '';
  let textB = '';
  const baselineData = { stat_data: { 场景: { 位置: '旅店大厅' } } };
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '进入旅店大厅。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: true,
          repairAttempts: 0,
          worldSubjectLimit: 3,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, baselineData]],
      generateRaw({ systemPrompt, prompt }) {
        const system = String(systemPrompt);
        const branchA = String(prompt).includes('分支甲');
        if (system.includes('MVU人物档案医师')) {
          const profile = completeAuthorityProfile(branchA ? '林甲' : '林乙');
          profile.currentState.location = branchA ? '东侧柜台' : '西侧门廊';
          profile.currentState.goal = branchA ? '核对第一本账册' : '检查第二封信';
          profile.evidence = [branchA ? '最终正文明确林甲在东侧柜台核对账册' : '最终正文明确林乙在西侧门廊检查信件'];
          return `<人物档案更新>${JSON.stringify([profile])}</人物档案更新>`;
        }
        if (system.includes('全局世界裁决器') || system.includes('世界长期主体发现器')) {
          const label = branchA ? '甲分支后台状态' : '乙分支后台状态';
          const sourceAnchor = branchA ? '林甲在东侧柜台查阅并核对了第一本账册' : '林乙在西侧门廊阅读并检查了第二封信';
          const blocks = [
            ...scheduledWorldBlocks(prompt, branchA ? '林甲的档案主体' : '林乙的档案主体'),
            newProcessWorldBlock({
              name: branchA ? '第一本账册' : '第二封信',
              sourceAnchor,
              anchor: `${sourceAnchor}留下的档案处理进程会按地点、文书与核对结果继续运作`,
              current: `${label}已从正文中取得第一个可核对记录`,
              goal: '按后续文书与地点记录维持分支连续性',
              attempt: '核对正文中的地点、人物与文书行动是否构成持续进程',
              outcome: `${sourceAnchor}为${label}提供了可直接核对的起点`,
              stateChange: `${label}已建立并绑定当前 swipe 的正文事实`,
              nextAction: '下一回合检查同一文书处理是否产生新记录或阻碍',
              thread: `${label}连续性`,
            }),
          ];
          return `世界摘要：${label}已按当前 swipe 正文建立。\n\n${blocks.join('\n\n')}`;
        }
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  textA = withCharacterTicketReceipt(baseTextA, [currentTicketAssignment(harness, '林甲')]);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [textA], mes: textA });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const baseline = structuredClone(store.replyCheckpoint.state);
  const outcomeA = {
    profiles: structuredClone(store.profiles),
    profileRoot: structuredClone(harness.mvuByMessage.get(1).stat_data.人物档案),
    world: structuredClone(store.world),
  };
  assert.match(JSON.stringify(outcomeA.profiles), /林甲/);
  assert.match(JSON.stringify(outcomeA.world), /甲分支后台状态/);

  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [textA], mes: textA };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(store.preparedReroll?.stage, 'slot_observed');
  assert.equal(store.preparedReroll?.target?.swipeId, 1);

  await harness.handlers.get('generation_started')('swipe', {}, false);
  assert.equal(store.preparedReroll?.stage, 'generation_started');
  assert.equal(harness.hooks.runtime.active?.expectedFinalSwipeId, 1);
  textB = withCharacterTicketReceipt(baseTextB, [currentTicketAssignment(harness, '林乙')]);
  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [textA, textB], mes: textB };
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));
  const outcomeB = {
    profiles: structuredClone(store.profiles),
    profileRoot: structuredClone(harness.mvuByMessage.get(1).stat_data.人物档案),
    world: structuredClone(store.world),
  };
  assert.match(JSON.stringify(outcomeB.profiles), /林乙/);
  assert.match(JSON.stringify(outcomeB.world), /乙分支后台状态/);
  assert.notEqual(outcomeA.world.digest, outcomeB.world.digest);
  const callsBeforeSwitching = harness.doctorCalls.length;

  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 0, swipes: [textA, textB], mes: textA };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 0 });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(harness.doctorCalls.length, callsBeforeSwitching);
  assert.deepEqual(store.profiles, outcomeA.profiles);
  assert.equal(store.world.digest, outcomeA.world.digest);
  assert.deepEqual(harness.mvuByMessage.get(1).stat_data.人物档案, outcomeA.profileRoot);

  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [textA, textB], mes: textB };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(harness.doctorCalls.length, callsBeforeSwitching);
  assert.deepEqual(store.profiles, outcomeB.profiles);
  assert.equal(store.world.digest, outcomeB.world.digest);
  assert.deepEqual(harness.mvuByMessage.get(1).stat_data.人物档案, outcomeB.profileRoot);

  const unknownText = '<content>分支甲的正文已经被外部改写，不能复用旧结果。</content><options><option>等待结算</option></options>';
  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 0, swipes: [unknownText, textB], mes: unknownText };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 0 });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(harness.doctorCalls.length, callsBeforeSwitching);
  assert.deepEqual(store.profiles, baseline.profiles);
  assert.equal(store.world.digest, baseline.world.digest);
  assert.deepEqual(harness.mvuByMessage.get(1).stat_data.人物档案, baseline.profileRoot);
  assert.doesNotMatch(JSON.stringify(store.profiles), /林甲|林乙/);
  assert.doesNotMatch(JSON.stringify(store.world), /甲分支后台状态|乙分支后台状态/);
  assert.ok(store.doctorStateQuarantined);
  assert.match(store.doctorStateQuarantined.reason, /没有与其指纹完全一致|无法证明人物档案投影/);
  assert.equal(harness.uiNodes.get('retry').disabled, true);
  assert.equal(harness.uiNodes.get('manualVariableAudit').disabled, true);
  assert.equal(harness.uiNodes.get('manualWorldAdvance').disabled, true);
  assert.match(`${harness.uiNodes.get('phase').textContent} ${harness.uiNodes.get('detail').textContent}`, /待结算|隔离|生成前状态/);
});

test('reply checkpoint is reused only while both world digest and complete profileRoot remain identical', async () => {
  const profileA = { profileId: 'baseline-a', name: '基线甲' };
  const profileB = { profileId: 'baseline-b', name: '基线乙' };
  const harness = runtimeHarness(
    [
      { is_user: false, is_system: false, mes: '已有开场回复', swipe_id: 0 },
      { is_user: true, is_system: false, mes: '继续。' },
    ],
    '',
    false,
    { mvuByMessage: [[0, { stat_data: { 人物档案: { schemaVersion: 1, byActorId: { [profileA.profileId]: profileA } } } }]] },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const first = store.replyCheckpoint;
  assert.equal(first.schemaVersion, 3);
  assert.deepEqual(first.state.profileRoot.byActorId, { [profileA.profileId]: profileA });
  const firstDigest = first.state.world.digest;
  harness.handlers.get('generation_stopped')();

  await harness.handlers.get('generation_started')('normal', {}, false);
  assert.strictEqual(store.replyCheckpoint, first);
  assert.equal(store.replyCheckpoint.state.world.digest, firstDigest);
  harness.handlers.get('generation_stopped')();

  store.world = harness.hooks.runtime.core.normalizeWorldState({
    ...store.world,
    revision: Number(store.world.revision || 0) + 1,
    summary: '生成前世界权威已经变化',
  }, { chatId: harness.context.chatId });
  await harness.handlers.get('generation_started')('normal', {}, false);
  const afterWorldChange = store.replyCheckpoint;
  assert.notStrictEqual(afterWorldChange, first);
  assert.equal(afterWorldChange.state.world.digest, store.world.digest);
  harness.handlers.get('generation_stopped')();

  harness.mvuByMessage.set(0, { stat_data: { 人物档案: { schemaVersion: 1, byActorId: { [profileB.profileId]: profileB } } } });
  await harness.handlers.get('generation_started')('normal', {}, false);
  const afterProfileChange = store.replyCheckpoint;
  assert.notStrictEqual(afterProfileChange, afterWorldChange);
  assert.deepEqual(afterProfileChange.state.profileRoot.byActorId, { [profileB.profileId]: profileB });
  assert.equal(afterProfileChange.state.world.digest, store.world.digest);
});

test('a swipe-outcome capture failure is reported without leaving the accepted run stuck in processing', async () => {
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '继续观察室内。' }],
    '',
    false,
    {
      forceCaptureSwipeOutcomeFailure: true,
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '室内' } } }]],
      generateRaw({ systemPrompt }) {
        if (String(systemPrompt).includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>室内维持原状，窗边的光线缓慢移动。</content><options><option>继续观察</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 700));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.fullRuns.length, 1);
  assert.equal(store.fullRuns[0].outcome.ok, false);
  assert.equal(store.fullRuns[0].outcome.stage, 'swipe-outcome');
  assert.equal(store.fullRuns[0].trace.some((entry) => entry.stage === 'swipe-outcome:capture-failed'), true);
  assert.equal(store.diagnostics.some((entry) => entry.kind === 'swipe_outcome_capture_failed'), true);
  assert.equal(harness.hooks.runtime.processingSession, null);
  assert.equal(harness.hooks.runtime.ownerSessionId, '');
  assert.equal(harness.uiRoot.dataset.state, 'error');
  assert.equal(harness.uiNodes.get('manualVariableAudit').disabled, false);
  assert.equal(harness.uiNodes.get('manualWorldAdvance').disabled, false);
});

test('坏变量块的完整替换不得吸收或覆盖其他扩展同回合写入', async () => {
  const previous = { stat_data: { 状态: { 数值: 0 }, 其他扩展: { 标记: '上一楼层' } } };
  const current = { stat_data: { 状态: { 数值: 1 }, 其他扩展: { 标记: '数据库本回合写入' } } };
  const invalidBlock = '<UpdateVariable><Analysis>原回复格式损坏</Analysis><JSONPatch>[{"op":"replace","path":"/状态/数值","value":???}]</JSONPatch></UpdateVariable>';
  const originalMessage = `<content>仪表读数从0变成了1。</content><options><option>记录读数</option></options>${invalidBlock}`;
  const parseTrace = [];
  const harness = runtimeHarness(
    [
      { is_user: true, is_system: false, mes: '先读取上一轮仪表。' },
      { is_user: false, is_system: false, swipe_id: 0, mes: '<content>仪表读数是0。</content><options><option>再次读取</option></options>' },
      { is_user: true, is_system: false, mes: '再次读取仪表。' },
    ],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: true,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, previous], [3, current]],
      parseMessage({ block, data }) {
        const next = structuredClone(data);
        if (String(block).includes('/状态/数值')) next.stat_data.状态.数值 = 1;
        parseTrace.push({ block: String(block), before: structuredClone(data), after: structuredClone(next) });
        return next;
      },
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU变量核验与修复器')) {
          return '<UpdateVariable><Analysis>本回合完整块只包含正文确认的仪表变化，不吸收其他扩展字段。</Analysis><JSONPatch>[{"op":"replace","path":"/状态/数值","value":1}]</JSONPatch></UpdateVariable>';
        }
        if (system.includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, mes: originalMessage });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 800));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(parseTrace.length, 2);
  const authoritativeReplay = parseTrace.find((entry) => String(entry.block).includes('/状态/数值'));
  const redundantOperationProbe = parseTrace.find((entry) => !String(entry.block).includes('/状态/数值'));
  assert.ok(authoritativeReplay);
  assert.ok(redundantOperationProbe);
  assert.notEqual(authoritativeReplay.block, invalidBlock);
  const replayPatchText = authoritativeReplay.block.match(/<JSONPatch\b[^>]*>([\s\S]*?)<\/JSONPatch\s*>/u)?.[1] || '';
  assert.deepEqual(JSON.parse(replayPatchText), [{ op: 'replace', path: '/状态/数值', value: 1 }]);
  assert.deepEqual(authoritativeReplay.before, previous);
  assert.deepEqual(authoritativeReplay.after, { stat_data: { 状态: { 数值: 1 }, 其他扩展: { 标记: '上一楼层' } } });
  assert.deepEqual(redundantOperationProbe.before, previous);
  assert.deepEqual(redundantOperationProbe.after, previous);
  assert.equal(store.fullRuns[0].outcome.ok, false);
  assert.equal(store.fullRuns[0].outcome.stage, 'variable');
  assert.match(store.fullRuns[0].outcome.variable.error, /未声明路径|遗漏了本楼层已有变化/);
  assert.ok(harness.hooks.runtime.retry);
  assert.equal(harness.context.chat[3].mes, originalMessage);
  assert.equal(harness.counters.saveChat, 0);
  assert.equal(harness.counters.mvuReplace, 0);
  assert.equal(harness.mvuWrites.length, 0);
  assert.deepEqual(harness.mvuByMessage.get(3), current);
});

test('坏变量块由模型给出完整替换块并经官方复放等于当前状态时，只规范正文且不重复写MVU', async () => {
  const previous = { stat_data: { 状态: { 数值: 0 }, 其他扩展: { 标记: '保持不变' } } };
  const current = { stat_data: { 状态: { 数值: 1 }, 其他扩展: { 标记: '保持不变' } } };
  const invalidBlock = '<UpdateVariable><Analysis>原回复格式损坏</Analysis><JSONPatch>[{"op":"replace","path":"/状态/数值","value":???}]</JSONPatch></UpdateVariable>';
  const originalMessage = `<content>仪表读数从0变成了1。</content><options><option>记录读数</option></options>${invalidBlock}`;
  const parseTrace = [];
  const harness = runtimeHarness(
    [
      { is_user: true, is_system: false, mes: '先读取上一轮仪表。' },
      { is_user: false, is_system: false, swipe_id: 0, mes: '<content>仪表读数是0。</content><options><option>再次读取</option></options>' },
      { is_user: true, is_system: false, mes: '再次读取仪表。' },
    ],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: true,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, previous], [3, current]],
      parseMessage({ block, data }) {
        const next = structuredClone(data);
        if (String(block).includes('/状态/数值')) next.stat_data.状态.数值 = 1;
        parseTrace.push({ block: String(block), before: structuredClone(data), after: structuredClone(next) });
        return next;
      },
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU变量核验与修复器')) {
          return '<UpdateVariable><Analysis>本回合完整块记录仪表从0变为1。</Analysis><JSONPatch>[{"op":"replace","path":"/状态/数值","value":1}]</JSONPatch></UpdateVariable>';
        }
        if (system.includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, mes: originalMessage });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 800));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const repairedMessage = harness.context.chat[3].mes;

  assert.equal(store.fullRuns[0].outcome.ok, true, JSON.stringify(store.fullRuns[0].outcome));
  assert.equal(store.fullRuns[0].outcome.variable.changed, true);
  assert.equal(store.fullRuns[0].outcome.variable.stateChanged, false);
  assert.equal(store.variableRepairs[0].status, 'replacement_block_normalized');
  const repairedBlock = repairedMessage.match(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable\s*>/u)?.[0] || '';
  const patchText = repairedBlock.match(/<JSONPatch\b[^>]*>([\s\S]*?)<\/JSONPatch\s*>/u)?.[1] || '';
  const operations = JSON.parse(patchText);

  assert.equal(harness.hooks.runtime.retry, null);
  assert.notEqual(repairedMessage, originalMessage);
  assert.equal(repairedMessage.includes(invalidBlock), false);
  assert.deepEqual(operations, [{ op: 'replace', path: '/状态/数值', value: 1 }]);
  assert.equal(parseTrace.length, 2);
  const authoritativeReplay = parseTrace.find((entry) => String(entry.block).includes('/状态/数值'));
  const redundantOperationProbe = parseTrace.find((entry) => !String(entry.block).includes('/状态/数值'));
  assert.ok(authoritativeReplay);
  assert.ok(redundantOperationProbe);
  assert.notEqual(authoritativeReplay.block, invalidBlock);
  const replayPatchText = authoritativeReplay.block.match(/<JSONPatch\b[^>]*>([\s\S]*?)<\/JSONPatch\s*>/u)?.[1] || '';
  assert.deepEqual(JSON.parse(replayPatchText), operations);
  assert.deepEqual(authoritativeReplay.before, previous);
  assert.deepEqual(authoritativeReplay.after, current);
  assert.deepEqual(redundantOperationProbe.before, previous);
  assert.deepEqual(redundantOperationProbe.after, previous);
  assert.equal(harness.counters.saveChat, 1);
  assert.equal(harness.counters.mvuReplace, 0);
  assert.equal(harness.mvuWrites.length, 0);
  assert.deepEqual(harness.mvuByMessage.get(3), current);
  assert.equal(store.diagnostics.some((entry) => entry.kind === 'surface_refresh_failed'), true);
});

test('变量模型返回期间人物档案根更新，提交必须基于最新整份状态并原样保留新档案', async () => {
  const previous = { stat_data: { 测试主体: { 数值: 0 }, 人物档案: { byActorId: { old: { name: '旧档案' } } } } };
  const current = structuredClone(previous);
  let harness;
  harness = runtimeHarness(
    [
      { is_user: true, is_system: false, mes: '读取上一轮数值。' },
      { is_user: false, is_system: false, swipe_id: 0, mes: '<content>数值为0。</content><options><option>继续</option></options>' },
      { is_user: true, is_system: false, mes: '再次读取。' },
    ],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: true, worldEngine: false, repairAttempts: 0 },
      },
      completeMvu: true,
      mvuByMessage: [[1, previous], [3, current]],
      parseMessage({ block, data }) {
        const next = structuredClone(data);
        if (String(block).includes('/测试主体/数值')) next.stat_data.测试主体.数值 = 1;
        return next;
      },
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU变量核验与修复器')) {
          const live = structuredClone(harness.mvuByMessage.get(3));
          live.stat_data.人物档案 = { byActorId: { latest: { name: '最新档案' } } };
          harness.mvuByMessage.set(3, live);
          return '<UpdateVariable><Analysis>本回合完整块把测试数值从0改为1。</Analysis><JSONPatch>[{"op":"replace","path":"/测试主体/数值","value":1}]</JSONPatch></UpdateVariable>';
        }
        if (system.includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>数值从0变成了1。</content><options><option>记录</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 800));

  const finalData = harness.mvuByMessage.get(3);
  assert.equal(finalData.stat_data.测试主体.数值, 1);
  assert.deepEqual(finalData.stat_data.人物档案, { byActorId: { latest: { name: '最新档案' } } });
  assert.equal(harness.mvuWrites.some((entry) => entry.data?.stat_data?.人物档案?.byActorId?.latest?.name === '最新档案'), true);
  const outcome = harness.context.chatMetadata['mvu-doctor-kemini-clean'].fullRuns[0].outcome;
  assert.equal(outcome.variable.ok, true, JSON.stringify(outcome.variable));
});

test('变量模型返回后目标swipe已变化时，空块也不得写诊断成功或旧事务元数据', async () => {
  const previous = { stat_data: { 测试主体: { 数值: 0 } } };
  let harness;
  harness = runtimeHarness(
    [
      { is_user: true, is_system: false, mes: '读取上一轮数值。' },
      { is_user: false, is_system: false, swipe_id: 0, mes: '<content>数值为0。</content><options><option>继续</option></options>' },
      { is_user: true, is_system: false, mes: '保持观察。' },
    ],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: true, worldEngine: false, repairAttempts: 0 },
      },
      completeMvu: true,
      mvuByMessage: [[1, previous], [3, previous]],
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU变量核验与修复器')) {
          harness.context.chat[3].swipes = [harness.context.chat[3].mes, '<content>新的swipe。</content>'];
          harness.context.chat[3].swipe_id = 1;
          harness.context.chat[3].mes = harness.context.chat[3].swipes[1];
          return '<UpdateVariable><Analysis>本回合没有变量变化。</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';
        }
        if (system.includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, mes: '<content>数值保持0。</content><options><option>继续</option></options>' });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 800));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.variableRepairs.length, 0);
  assert.equal(harness.counters.mvuReplace, 0);
  assert.equal(harness.counters.saveChat, 0);
  assert.equal(store.fullRuns[0].outcome.ok, false);
  assert.match(store.fullRuns[0].outcome.variable.error, /swipe|正文已经变化|旧结果已作废/u);
});

test('metadata confirmation failure after variable commit preserves accepted text and MVU while the prepared WAL remains recoverable', async () => {
  let failedAppliedSave = false;
  let durableBeforeFailure = null;
  const successfulMetadataSnapshots = [];
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '读取仪表。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: true,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 数值: 0 } } }]],
      parseMessage({ block, data }) {
        const next = structuredClone(data);
        if (String(block).includes('"path":"/状态/数值"') || String(block).includes('"path": "/状态/数值"')) {
          next.stat_data.状态.数值 = 1;
        }
        return next;
      },
      saveMetadata({ context }) {
        const snapshot = structuredClone(context.chatMetadata);
        const store = snapshot['mvu-doctor-kemini-clean'];
        const latestRepair = store?.variableRepairs?.[0];
        if (!failedAppliedSave && latestRepair?.status === 'applied') {
          failedAppliedSave = true;
          durableBeforeFailure = successfulMetadataSnapshots.at(-1);
          throw new Error('forced metadata confirmation failure');
        }
        successfulMetadataSnapshots.push(snapshot);
      },
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU变量核验与修复器')) {
          return '<UpdateVariable><Analysis>最终正文明确 /状态/数值 应从0变为1，但当前值仍为0，因此只补这一处。</Analysis><JSONPatch>[{"op":"replace","path":"/状态/数值","value":1}]</JSONPatch></UpdateVariable>';
        }
        if (system.includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>仪表的数值从0跳到了1，随后稳定下来。</content><options><option>记下读数</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(failedAppliedSave, true);
  assert.equal(durableBeforeFailure['mvu-doctor-kemini-clean'].variableRepairs[0].status, 'prepared');
  assert.equal(harness.mvuByMessage.get(1).stat_data.状态.数值, 1);
  assert.match(harness.context.chat[1].mes, /"path"\s*:\s*"\/状态\/数值"/);
  assert.match(harness.context.chat[1].mes, /"value"\s*:\s*1/);
  assert.equal(harness.counters.saveChat, 1);
  assert.equal(harness.mvuWrites.some((entry) => entry.data?.stat_data?.状态?.数值 === 1), true);
  const firstCommittedWrite = harness.mvuWrites.findIndex((entry) => entry.data?.stat_data?.状态?.数值 === 1);
  assert.equal(harness.mvuWrites.slice(firstCommittedWrite + 1).some((entry) => entry.data?.stat_data?.状态?.数值 === 0), false);
  assert.equal(store.fullRuns[0].outcome.ok, true);
  assert.equal(store.fullRuns[0].outcome.variable.metadataRecoveryPending, true);
  assert.equal(store.fullRuns[0].trace.some((entry) => entry.stage === 'variable:metadata-confirmation-deferred'), true);
  assert.notEqual(store.variableRepairs[0].status, 'rolled_back');
});

test('metadata-only profile persistence failure rolls back the profile and prevents world consumption', async () => {
  let failedProfileSave = false;
  let worldCalls = 0;
  const profile = { ...completeAuthorityProfile('林档'), profileId: 'profile-lin-dang' };
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '和柜台旁的人交谈。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: true,
          repairAttempts: 0,
          worldSubjectLimit: 3,
        },
      },
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '柜台前' } } }]],
      saveMetadata({ context }) {
        const store = context.chatMetadata['mvu-doctor-kemini-clean'];
        if (!failedProfileSave && Object.keys(store?.profiles || {}).length) {
          failedProfileSave = true;
          throw new Error('forced metadata-only profile failure');
        }
      },
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU人物档案医师')) return `<人物档案更新>${JSON.stringify([profile])}</人物档案更新>`;
        if (system.includes('全局世界裁决器') || system.includes('世界长期主体发现器')) {
          worldCalls += 1;
          return '世界摘要：本回合无新长期主体';
        }
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const worldBefore = structuredClone(store.world);

  await harness.handlers.get('generation_started')('normal', {}, false);
  const acceptedWithReceipt = withCharacterTicketReceipt(
    '<content>林档站在柜台旁，翻开登记簿核对了房号。</content><options><option>询问林档</option></options>',
    [currentTicketAssignment(harness, '林档')],
  );
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: acceptedWithReceipt,
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));

  assert.equal(failedProfileSave, true);
  assert.deepEqual(store.profiles, {});
  assert.equal(worldCalls, 0);
  assert.equal(store.world.revision, worldBefore.revision);
  assert.deepEqual(store.world.subjects, worldBefore.subjects);
  assert.equal(store.fullRuns[0].outcome.ok, false);
  assert.equal(store.fullRuns[0].outcome.stage, 'profile');
  assert.match(store.fullRuns[0].outcome.profiles.error, /metadata保存失败.*恢复旧权威/);
  assert.equal(store.diagnostics.some((entry) => entry.kind === 'profile_failed'), true);
});

test('audited no-change fails when the persisted profile projection cannot be read back from MVU', async () => {
  const keeper = { ...completeAuthorityProfile('既有档案人物'), profileId: 'keeper-profile' };
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '继续独自观察。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '室内' } } }]],
      replaceMvuData() {
        return { handled: true };
      },
      generateRaw({ systemPrompt }) {
        if (String(systemPrompt).includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  store.profiles = { [keeper.profileId]: keeper };

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: withCharacterTicketReceipt(
      '<content>室内没有出现其他人物，墙上的钟继续走动。</content><options><option>继续等待</option></options>',
      [],
    ),
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));

  assert.equal(harness.mvuWrites.some((entry) => entry.data?.stat_data?.人物档案?.byActorId?.[keeper.profileId]), true);
  assert.equal(harness.mvuByMessage.get(1).stat_data.人物档案, undefined);
  assert.deepEqual(store.profiles, { [keeper.profileId]: keeper });
  assert.equal(store.fullRuns[0].outcome.ok, false);
  assert.equal(store.fullRuns[0].outcome.stage, 'profile');
  assert.match(store.fullRuns[0].outcome.profiles.error, /无变化审计后.*(?:投影|非人物变量).*读回不一致/);
  assert.equal(store.diagnostics.some((entry) => entry.kind === 'profile_failed'), true);
});

test('same-floor continue uses the new accepted fingerprint once while manual recheck stays idempotent', async () => {
  let worldCalls = 0;
  const firstText = '<content>观察到北窗外的云层缓慢聚拢，室内仍然安静。</content><options><option>继续观察</option></options>';
  const continuedText = '<content>观察到北窗外的云层缓慢聚拢；片刻后风向改变，檐下的铃铛响了两次。</content><options><option>继续观察</option></options>';
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '观察天气。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: true,
          repairAttempts: 0,
          worldSubjectLimit: 3,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '室内' } } }]],
      generateRaw({ systemPrompt, prompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU人物档案医师')) return '<人物档案无变化/>';
        if (system.includes('全局世界裁决器') || system.includes('世界长期主体发现器')) {
          worldCalls += 1;
          const first = worldCalls === 1;
          if (first) {
            return `世界摘要：北窗外的云层变化已建立为可追踪天气进程。\n\n${newProcessWorldBlock({
              name: '北窗外的云层',
              sourceAnchor: '观察到北窗外的云层缓慢聚拢',
              anchor: '北窗外的云层与风向会按当地天气条件持续演化',
              current: '北窗外云层正在缓慢聚拢，风向尚未明显改变',
              goal: '按时段追踪云层与风向的可观察变化',
              attempt: '记录本时段北窗外的云层聚拢程度',
              outcome: '云层继续增厚，但本时段风向仍保持稳定',
              stateChange: '北窗外云量较此前增加，形成下个时段的复核基线',
              nextAction: '下一时段复核风向是否改变并检查檐下铃铛',
              thread: '北窗天气演化',
            })}`;
          }
          const blocks = scheduledWorldBlocks(prompt, '北窗天气进程');
          return `世界摘要：北窗天气进程已按上回合下一步完成结算。\n\n${blocks.join('\n\n')}`;
        }
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, mes: firstText });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(worldCalls, 1);
  const firstRun = store.fullRuns[0];
  assert.ok(firstRun.worldSourceKey);
  assert.equal(firstRun.outcome.ok, true);
  assert.equal(store.world.receipts.some((receipt) => receipt.sourceKey === firstRun.worldSourceKey && receipt.status === 'applied'), true);
  assert.equal(store.world.changes.some((change) => change.source?.sourceKey === firstRun.worldSourceKey), false);

  await harness.handlers.get('generation_started')('continue', {}, false);
  harness.context.chat[1].mes = continuedText;
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));

  assert.equal(worldCalls, 2);
  const continuedRun = store.fullRuns[0];
  assert.equal(continuedRun.outcome.ok, true, JSON.stringify(continuedRun.outcome));
  assert.notEqual(continuedRun.worldSourceKey, firstRun.worldSourceKey);
  assert.equal(store.world.receipts.some((receipt) => receipt.sourceKey === firstRun.worldSourceKey && receipt.status === 'applied'), true);
  assert.equal(store.world.changes.some((change) => change.source?.sourceKey === firstRun.worldSourceKey), false);
  assert.equal(store.world.changes.some((change) => change.source?.sourceKey === continuedRun.worldSourceKey), true);
  const continuedChangesBeforeManual = store.world.changes.filter((change) => change.source?.sourceKey === continuedRun.worldSourceKey).length;
  const worldRevisionBeforeManual = store.world.revision;

  const manual = await harness.hooks.manualWorldRecheck();

  assert.equal(manual.ok, true);
  assert.equal(manual.alreadyCommitted, true);
  assert.equal(worldCalls, 2);
  assert.equal(store.world.changes.filter((change) => change.source?.sourceKey === continuedRun.worldSourceKey).length, continuedChangesBeforeManual);
  assert.equal(store.world.revision, worldRevisionBeforeManual);
  assert.equal(store.diagnostics.some((entry) => entry.kind === 'world_manual_noop'), true);
});

test('第二轮STARTED会跨过第一轮ENDED的500ms窗口等待Doctor落定，再建立自己的session', async () => {
  let profileCalls = 0;
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '先观察第一轮。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      generateRaw({ systemPrompt }) {
        if (String(systemPrompt).includes('MVU人物档案医师')) {
          profileCalls += 1;
          return '<人物档案无变化/>';
        }
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  const firstSessionId = harness.hooks.runtime.active.id;
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>第一轮里，窗边光线缓慢移动了一段距离。</content><options><option>继续观察</option></options>',
  });
  harness.handlers.get('generation_ended')();

  harness.context.chat.push({ is_user: true, is_system: false, mes: '立刻开始第二轮。' });
  const secondStarted = harness.handlers.get('generation_started')('normal', {}, false);
  let interceptorSettled = false;
  const abortCalls = [];
  const intercepted = harness.generationInterceptor([], 0, (immediately) => abortCalls.push(immediately), 'normal')
    .then(() => { interceptorSettled = true; });

  await new Promise((resolve) => setTimeout(resolve, 120));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.fullRuns.length, 0);
  assert.equal(interceptorSettled, false);
  assert.ok(harness.hooks.runtime.generationStart);
  assert.equal(harness.hooks.runtime.active.id, firstSessionId);

  await Promise.all([secondStarted, intercepted]);

  assert.equal(abortCalls.length, 0);
  assert.equal(interceptorSettled, true);
  assert.equal(store.fullRuns.length, 1);
  assert.equal(store.fullRuns[0].outcome.ok, true);
  assert.equal(profileCalls, 1);
  assert.ok(harness.hooks.runtime.active);
  assert.notEqual(harness.hooks.runtime.active.id, firstSessionId);
  assert.equal(harness.hooks.runtime.active.targetIndex, 3);
  assert.equal(harness.hooks.runtime.preparation, null);

  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>第二轮里，室内钟摆又完整摆动了一个来回。</content><options><option>记下时间</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));

  assert.equal(store.fullRuns.length, 2);
  assert.equal(store.fullRuns.every((run) => run.outcome.ok), true);
  assert.equal(profileCalls, 2);
  assert.notEqual(store.fullRuns[0].worldSourceKey, store.fullRuns[1].worldSourceKey);
});

test('重roll检查点恢复尚在保存时STOPPED，最终原子恢复原swipe的人物世界重试与票据', async () => {
  let armCheckpointGate = false;
  let checkpointGateHeld = false;
  let announceCheckpointRestore;
  let releaseCheckpointRestore;
  const checkpointRestoreStarted = new Promise((resolve) => { announceCheckpointRestore = resolve; });
  const checkpointRestoreGate = new Promise((resolve) => { releaseCheckpointRestore = resolve; });
  const profile = { profileId: 'profile-original-swipe', name: '原swipe人物' };
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '读取仪表并停留在当前swipe。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: true,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '仪表室' } } }]],
      async saveMetadata({ context }) {
        const store = context.chatMetadata['mvu-doctor-kemini-clean'];
        const baselineIsInstalled = armCheckpointGate
          && Object.keys(store?.profiles || {}).length === 0
          && (store?.pendingRetries || []).length === 0
          && (store?.ticketLedger || []).length === 0;
        if (baselineIsInstalled && !checkpointGateHeld) {
          checkpointGateHeld = true;
          announceCheckpointRestore();
          await checkpointRestoreGate;
        }
      },
      generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU变量核验与修复器')) return '本次变量回复故意无法解析';
        if (system.includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>当前swipe中，仪表室仍维持原状。</content><options><option>继续读取</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 750));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.ok(harness.hooks.runtime.retry);
  assert.ok(store.pendingRetries.length);
  assert.ok(store.ticketLedger.length);
  store.profiles = { [profile.profileId]: structuredClone(profile) };
  store.world.summary = '原swipe仍在运行的世界状态';
  store.world.revision = Math.max(4, Number(store.world.revision || 0) + 1);
  store.world.subjects.push({
    id: 'subject-original-swipe',
    type: 'process',
    name: '原swipe后台进程',
    status: 'active',
    current: '原swipe中的后台进程仍在等待下一次检查',
    nextAction: '下回合核对原swipe留下的现场痕迹',
    nextCheckTurn: 2,
    lastAdvancedTurn: 1,
    shownTurn: 0,
  });
  store.swipeOutcomes = [];
  const expectedProfiles = structuredClone(store.profiles);
  const expectedPendingRetries = structuredClone(store.pendingRetries);
  const expectedTicketLedger = structuredClone(store.ticketLedger);
  const expectedWorldRevision = store.world.revision;

  armCheckpointGate = true;
  const preparing = harness.handlers.get('generation_started')('regenerate', {}, false);
  await checkpointRestoreStarted;

  assert.equal(checkpointGateHeld, true);
  assert.deepEqual(store.profiles, {});
  assert.equal(store.pendingRetries.length, 0);
  assert.equal(store.ticketLedger.length, 0);

  harness.handlers.get('generation_stopped')();
  releaseCheckpointRestore();
  await preparing;
  for (let attempt = 0; attempt < 50 && harness.hooks.runtime.swipeRestoring; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(harness.hooks.runtime.preparation, null);
  assert.equal(harness.hooks.runtime.active, null);
  assert.equal(harness.hooks.runtime.swipeRestoring, false);
  assert.deepEqual(store.profiles, expectedProfiles);
  assert.equal(store.world.summary, '原swipe仍在运行的世界状态');
  assert.equal(store.world.revision, expectedWorldRevision);
  assert.equal(store.world.subjects.some((subject) => subject.id === 'subject-original-swipe'), true);
  assert.deepEqual(store.pendingRetries, expectedPendingRetries);
  assert.deepEqual(store.ticketLedger, expectedTicketLedger);
  assert.ok(harness.hooks.runtime.retry);
  assert.equal(store.doctorStateQuarantined, null);
  assert.equal(store.preparedReroll, null);
  assert.deepEqual(harness.mvuByMessage.get(1).stat_data.人物档案.byActorId, expectedProfiles);
});

test('GENERATION_STOPPED during the initial preparation wait leaves no preparation, injection or ghost session', async () => {
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '开始下一回合。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
        },
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const settlingSession = { id: 'prior-doctor', cancelled: false };
  harness.hooks.runtime.processingSession = settlingSession;

  const preparing = harness.handlers.get('generation_started')('normal', {}, false);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.ok(harness.hooks.runtime.generationStart);
  assert.equal(harness.hooks.runtime.active, null);

  harness.handlers.get('generation_stopped')();
  await preparing;
  await new Promise((resolve) => setTimeout(resolve, 125));

  assert.equal(settlingSession.cancelled, true);
  assert.equal(harness.hooks.runtime.preparation, null);
  assert.equal(harness.hooks.runtime.active, null);
  assert.equal(harness.hooks.runtime.processingSession, null);
  assert.equal(harness.hooks.runtime.ownerSessionId, '');
  assert.equal(harness.prompts.filter(Boolean).length, 0);
  assert.equal(harness.uiRoot.dataset.state, 'warning');
});

test('GENERATION_STOPPED during an asynchronous reply checkpoint cannot start a ghost session after the read resolves', async () => {
  let releaseCheckpointRead;
  let announceCheckpointRead;
  const checkpointReadStarted = new Promise((resolve) => { announceCheckpointRead = resolve; });
  const checkpointReadGate = new Promise((resolve) => { releaseCheckpointRead = resolve; });
  let held = false;
  const harness = runtimeHarness(
    [
      { is_user: false, is_system: false, mes: '已有开场回复', swipe_id: 0 },
      { is_user: true, is_system: false, mes: '继续前进。' },
    ],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
        },
      },
      mvuByMessage: [[0, { stat_data: { 状态: { 场景: '开场地点' } } }]],
      async getMvuData({ messageId, defaultRead }) {
        if (messageId === 0 && !held) {
          held = true;
          announceCheckpointRead();
          await checkpointReadGate;
        }
        return defaultRead();
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  const preparing = harness.handlers.get('generation_started')('normal', {}, false);
  await checkpointReadStarted;
  assert.ok(harness.hooks.runtime.generationStart);
  assert.equal(harness.hooks.runtime.active, null);

  harness.handlers.get('generation_stopped')();
  releaseCheckpointRead();
  await preparing;
  await new Promise((resolve) => setTimeout(resolve, 40));

  assert.equal(harness.hooks.runtime.preparation, null);
  assert.equal(harness.hooks.runtime.active, null);
  assert.equal(harness.hooks.runtime.processingSession, null);
  assert.equal(harness.hooks.runtime.ownerSessionId, '');
  assert.equal(harness.prompts.filter(Boolean).length, 0);
  assert.equal(harness.uiRoot.dataset.state, 'warning');
});

test('an external normal generation waits for an in-flight Doctor generateRaw and then prepares normally', async () => {
  let releaseProfileModel;
  let announceProfileModel;
  const profileModelStarted = new Promise((resolve) => { announceProfileModel = resolve; });
  const profileModelGate = new Promise((resolve) => { releaseProfileModel = resolve; });
  let held = false;
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '先观察房间。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '房间' } } }]],
      async generateRaw({ systemPrompt }) {
        if (String(systemPrompt).includes('MVU人物档案医师')) {
          if (!held) {
            held = true;
            announceProfileModel();
            await profileModelGate;
          }
          return '<人物档案无变化/>';
        }
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>房间里没有出现新的变化。</content><options><option>继续</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await profileModelStarted;
  assert.equal(harness.hooks.runtime.internalGenerationDepth, 1);
  assert.ok(harness.hooks.runtime.processingSession);

  harness.context.chat.push({ is_user: true, is_system: false, mes: '进入下一步。' });
  const promptsBeforeNextStart = harness.prompts.length;
  const nextPreparation = harness.handlers.get('generation_started')('normal', {}, false);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(harness.hooks.runtime.generationStart);
  assert.equal(harness.prompts.length, promptsBeforeNextStart);
  assert.equal(harness.hooks.runtime.active, null);

  releaseProfileModel();
  await nextPreparation;

  assert.equal(harness.hooks.runtime.internalGenerationDepth, 0);
  assert.equal(harness.hooks.runtime.processingSession, null);
  assert.ok(harness.hooks.runtime.active);
  assert.equal(harness.hooks.runtime.active.generationKind, 'normal');
  assert.equal(harness.hooks.runtime.active.targetIndex, 3);
  assert.equal(harness.hooks.runtime.preparation, null);
  assert.ok(harness.prompts.filter(Boolean).at(-1));
  harness.handlers.get('generation_stopped')();
});

test('changing accepted text and swipe while the profile model runs leaves profile and world at zero writes', async () => {
  let releaseProfileModel;
  let announceProfileModel;
  const profileModelStarted = new Promise((resolve) => { announceProfileModel = resolve; });
  const profileModelGate = new Promise((resolve) => { releaseProfileModel = resolve; });
  let worldCalls = 0;
  const profile = { ...completeAuthorityProfile('林竞'), profileId: 'profile-race-target' };
  const accepted = '<content>林竞站在门边，核对了一次通行记录。</content><options><option>询问林竞</option></options>';
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '查看门边的记录。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: true,
          repairAttempts: 0,
          worldSubjectLimit: 3,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '门厅' } } }]],
      async generateRaw({ systemPrompt }) {
        const system = String(systemPrompt);
        if (system.includes('MVU人物档案医师')) {
          announceProfileModel();
          await profileModelGate;
          return `<人物档案更新>${JSON.stringify([profile])}</人物档案更新>`;
        }
        if (system.includes('全局世界裁决器') || system.includes('世界长期主体发现器')) {
          worldCalls += 1;
          return '世界摘要：本回合无新长期主体';
        }
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const worldBefore = structuredClone(store.world);

  await harness.handlers.get('generation_started')('normal', {}, false);
  const acceptedWithReceipt = withCharacterTicketReceipt(
    accepted,
    [currentTicketAssignment(harness, '林竞')],
  );
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [acceptedWithReceipt], mes: acceptedWithReceipt });
  harness.handlers.get('generation_ended')();
  await profileModelStarted;

  const externallyChanged = '<content>这条正文已经由外部切换为另一个 swipe。</content><options><option>等待</option></options>';
  harness.context.chat[1].swipe_id = 1;
  harness.context.chat[1].swipes = [acceptedWithReceipt, externallyChanged];
  harness.context.chat[1].mes = externallyChanged;
  releaseProfileModel();
  await new Promise((resolve) => setTimeout(resolve, 850));

  assert.equal(Object.keys(store.profiles || {}).length, 0);
  assert.equal(harness.mvuWrites.length, 0);
  assert.equal(harness.mvuByMessage.get(1).stat_data.人物档案, undefined);
  assert.equal(worldCalls, 0);
  assert.equal(store.world.revision, worldBefore.revision);
  assert.deepEqual(store.world.subjects, worldBefore.subjects);
  assert.deepEqual(store.world.changes, worldBefore.changes);
  assert.equal(store.fullRuns[0].outcome.ok, false);
  assert.match(JSON.stringify(store.fullRuns[0].outcome), /正文、楼层或swipe已被外部修改|最终正文身份已变化|变量医生交接后的正文身份读回不一致/);
});

test('profile commit rebases onto a newly added database non-profile field instead of overwriting it', async () => {
  let releaseProfileModel;
  let announceProfileModel;
  const profileModelStarted = new Promise((resolve) => { announceProfileModel = resolve; });
  const profileModelGate = new Promise((resolve) => { releaseProfileModel = resolve; });
  const profile = { ...completeAuthorityProfile('林库'), profileId: 'profile-database-race' };
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '查看档案室。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      completeMvu: true,
      mvuByMessage: [[1, { stat_data: { 状态: { 场景: '档案室' } } }]],
      async generateRaw({ systemPrompt }) {
        if (String(systemPrompt).includes('MVU人物档案医师')) {
          announceProfileModel();
          await profileModelGate;
          return `<人物档案更新>${JSON.stringify([profile])}</人物档案更新>`;
        }
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  const acceptedWithReceipt = withCharacterTicketReceipt(
    '<content>林库在档案室里整理了新的索引卡。</content><options><option>查看索引</option></options>',
    [currentTicketAssignment(harness, '林库')],
  );
  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: acceptedWithReceipt,
  });
  harness.handlers.get('generation_ended')();
  await profileModelStarted;

  const liveBeforeCommit = structuredClone(harness.mvuByMessage.get(1));
  liveBeforeCommit.stat_data.数据库投影 = {
    版本: 2,
    最近写入: '数据库在人物模型运行期间独立提交',
    rows: ['row-a', 'row-b'],
  };
  harness.mvuByMessage.set(1, liveBeforeCommit);
  releaseProfileModel();
  await new Promise((resolve) => setTimeout(resolve, 850));

  const settled = harness.mvuByMessage.get(1);
  assert.deepEqual(settled.stat_data.数据库投影, {
    版本: 2,
    最近写入: '数据库在人物模型运行期间独立提交',
    rows: ['row-a', 'row-b'],
  });
  const savedProfiles = Object.values(settled.stat_data.人物档案.byActorId);
  assert.equal(savedProfiles.length, 1);
  assert.equal(savedProfiles[0].name, '林库');
  assert.equal(harness.mvuWrites.some((entry) => entry.data?.stat_data?.数据库投影?.版本 === 2), true);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.fullRuns[0].outcome.ok, true);
});

test('accepted-final lifecycle receipt is durable before host generation and closes only after Doctor settles', async () => {
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '观察墙上时钟。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
          repairAttempts: 0,
        },
      },
      generateRaw({ systemPrompt }) {
        if (String(systemPrompt).includes('MVU人物档案医师')) return '<人物档案无变化/>';
        return '';
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  const generatingReceipt = structuredClone(store.pendingAcceptedFinal);
  assert.ok(generatingReceipt?.transactionId);
  assert.equal(generatingReceipt.stage, 'generating');
  assert.equal(generatingReceipt.chatId, harness.context.chatId);
  assert.equal(generatingReceipt.session.targetIndex, 1);
  assert.equal(generatingReceipt.endedAt, null);

  harness.context.chat.push({
    is_user: false,
    is_system: false,
    swipe_id: 0,
    mes: '<content>时钟秒针向前走了一格。</content><options><option>继续观察</option></options>',
  });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(store.pendingAcceptedFinal.transactionId, generatingReceipt.transactionId);
  assert.equal(store.pendingAcceptedFinal.stage, 'ended');
  assert.ok(Number(store.pendingAcceptedFinal.endedAt) > 0);

  await new Promise((resolve) => setTimeout(resolve, 750));
  assert.equal(store.pendingAcceptedFinal, null);
  assert.equal(store.fullRuns.length, 1);
  assert.equal(store.fullRuns[0].outcome.ok, true);
});

test('explicit host stop revokes the unaccepted generation receipt instead of creating a ghost recovery turn', async () => {
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '开始一次可以取消的生成。' }],
    '',
    false,
    {
      extensionSettings: {
        'mvu-doctor-kemini-clean': {
          enabled: true,
          variableDoctor: false,
          worldEngine: false,
        },
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(store.pendingAcceptedFinal?.stage, 'generating');

  harness.handlers.get('generation_stopped')();
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(store.pendingAcceptedFinal, null);
  assert.equal(harness.hooks.runtime.active, null);
  assert.equal(store.fullRuns.length, 0);
  assert.equal(harness.prompts.filter(Boolean).length > 0, true);
});

test('END rejects a same-floor edit or different swipe before 500ms without starting Doctor', async () => {
  const accepted = '<content>第一条正文。</content><options><option>继续</option></options>';
  const replacement = '<content>在500ms窗口内切换的另一条正文。</content><options><option>停下</option></options>';
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '生成后立刻切换。' }],
    '',
    false,
    {
      extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false, repairAttempts: 0 } },
      generateRaw() { return '<人物档案无变化/>'; },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [accepted], mes: accepted });
  harness.handlers.get('generation_ended')();
  await new Promise((resolve) => setTimeout(resolve, 80));
  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [accepted, replacement], mes: replacement };
  await new Promise((resolve) => setTimeout(resolve, 620));

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(harness.doctorCalls.length, 0);
  assert.equal(harness.counters.mvuReplace, 0);
  assert.equal(store.ticketLedger.length, 0);
  assert.equal(store.pendingAcceptedFinal, null);
  assert.equal(store.fullRuns.length, 1);
  assert.equal(store.fullRuns[0].outcome.stage, 'accepted-final');
  assert.equal(store.fullRuns[0].outcome.ok, false);
});

test('ended or accepted receipt persistence failure performs zero Doctor work', async (t) => {
  for (const failedStage of ['ended', 'accepted']) {
    await t.test(failedStage, async () => {
      let armed = true;
      const harness = runtimeHarness(
        [{ is_user: true, is_system: false, mes: `制造${failedStage}票据故障。` }],
        '',
        false,
        {
          extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: true, worldEngine: true, repairAttempts: 0 } },
          saveMetadata({ context }) {
            const stage = context.chatMetadata['mvu-doctor-kemini-clean']?.pendingAcceptedFinal?.stage;
            if (armed && stage === failedStage) {
              armed = false;
              throw new Error(`forced ${failedStage} receipt save failure`);
            }
          },
          generateRaw() { return '不应调用Doctor模型'; },
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      await harness.handlers.get('generation_started')('normal', {}, false);
      harness.context.chat.push({
        is_user: false,
        is_system: false,
        swipe_id: 0,
        swipes: ['<content>林止站在门口。</content><options><option>询问林止</option></options>'],
        mes: '<content>林止站在门口。</content><options><option>询问林止</option></options>',
      });
      harness.handlers.get('generation_ended')();
      await new Promise((resolve) => setTimeout(resolve, 650));

      const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
      assert.equal(armed, false);
      assert.equal(harness.doctorCalls.length, 0);
      assert.equal(harness.counters.mvuReplace, 0);
      assert.equal(store.ticketLedger.length, 0);
      assert.equal(store.fullRuns.length, 0);
      assert.equal(store.pendingAcceptedFinal, null);
      assert.equal(harness.hooks.runtime.processingSession, null);
    });
  }
});

test('Doctor UI cancels a pre-request start, restores ownership and makes the interceptor abort unconditionally', async () => {
  let releaseGeneratingSave;
  let announceGeneratingSave;
  const generatingSaveStarted = new Promise((resolve) => { announceGeneratingSave = resolve; });
  const generatingSaveGate = new Promise((resolve) => { releaseGeneratingSave = resolve; });
  let holdOnce = true;
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '在主请求发出前取消。' }],
    '',
    false,
    {
      extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false } },
      async saveMetadata({ context }) {
        if (holdOnce && context.chatMetadata['mvu-doctor-kemini-clean']?.pendingAcceptedFinal?.stage === 'generating') {
          holdOnce = false;
          announceGeneratingSave();
          await generatingSaveGate;
        }
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));

  const startPromise = harness.handlers.get('generation_started')('normal', {}, false);
  await generatingSaveStarted;
  assert.equal(harness.hooks.runtimeHasPendingWork(), true);
  assert.equal(harness.uiNodes.get('retry').disabled, true);
  assert.equal(harness.uiNodes.get('manualVariableAudit').disabled, true);
  assert.equal(harness.uiNodes.get('manualWorldAdvance').disabled, true);

  const cancelled = await harness.hooks.cancelFromDoctorUi();
  let intercepted = false;
  await harness.generationInterceptor([], 4096, () => { intercepted = true; }, 'normal');
  releaseGeneratingSave();
  await startPromise;

  const store = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(cancelled, true);
  assert.equal(intercepted, true);
  assert.equal(harness.hooks.runtime.generationStart, null);
  assert.equal(harness.hooks.runtime.preparation, null);
  assert.equal(harness.hooks.runtime.active, null);
  assert.equal(store.pendingAcceptedFinal, null);
  assert.equal(store.fullRuns.length, 0);
  assert.equal(harness.prompts.filter(Boolean).length, 0);
});

test('Doctor UI defers to the host stop only after the interceptor releases the main request', async () => {
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '正常发出主请求。' }],
    '',
    false,
    { extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false } } },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  await harness.handlers.get('generation_started')('normal', {}, false);
  const active = harness.hooks.runtime.active;
  assert.equal(active.hostRequestReleased, false);

  let intercepted = false;
  await harness.generationInterceptor([], 4096, () => { intercepted = true; }, 'normal');
  assert.equal(intercepted, false);
  assert.equal(active.hostRequestReleased, true);
  const cancelled = await harness.hooks.cancelFromDoctorUi();
  assert.equal(cancelled, false);
  assert.equal(harness.hooks.runtime.active, active);
  assert.match(harness.hooks.runtime.status.detail, /酒馆自己的“停止生成”/u);
  harness.handlers.get('generation_stopped')();
});

test('post-baseline pending receipt or prompt faults restore the exact source swipe and close the single reroll WAL', async (t) => {
  for (const fault of ['pending', 'prompt']) {
    await t.test(fault, async () => {
      let armedFault = '';
      const oldText = `<content>${fault}故障前的来源swipe。</content><options><option>继续</option></options>`;
      const harness = runtimeHarness(
        [{ is_user: true, is_system: false, mes: '先生成来源，再测试故障。' }],
        '',
        false,
        {
          extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false, repairAttempts: 0 } },
          saveMetadata({ context }) {
            if (armedFault === 'pending'
              && context.chatMetadata['mvu-doctor-kemini-clean']?.pendingAcceptedFinal?.stage === 'generating') {
              armedFault = '';
              throw new Error('forced generating receipt failure after baseline restore');
            }
          },
          setExtensionPrompt({ value }) {
            if (armedFault === 'prompt' && value) {
              armedFault = '';
              throw new Error('forced prompt failure after baseline restore');
            }
          },
          generateRaw() { return '<人物档案无变化/>'; },
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      const { store } = await acceptInitialSwipe(harness, oldText);
      assert.ok(store.swipeOutcomes.find((entry) => entry.messageId === 1 && entry.swipeId === 0));

      harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [oldText], mes: oldText };
      harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 1 });
      await new Promise((resolve) => setTimeout(resolve, 70));
      armedFault = fault;
      await harness.handlers.get('generation_started')('swipe', {}, false);

      assert.equal(armedFault, '');
      assert.equal(store.pendingAcceptedFinal, null);
      assert.equal(store.preparedReroll, null);
      assert.equal(store.doctorStateQuarantined, null);
      assert.equal(harness.context.chat[1].swipe_id, 0);
      assert.equal(harness.context.chat[1].mes, oldText);
      assert.equal(store.fullRuns.length, 1);
    });
  }
});

test('post-baseline fallback readback failure quarantines instead of pretending the reroll WAL closed', async () => {
  let failPrompt = false;
  let failFallbackMvu = false;
  const oldText = '<content>隔离测试的来源swipe。</content><options><option>继续</option></options>';
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '建立来源。' }],
    '',
    false,
    {
      extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: false, worldEngine: false, repairAttempts: 0 } },
      setExtensionPrompt({ value }) {
        if (failPrompt && value) {
          failPrompt = false;
          failFallbackMvu = true;
          throw new Error('force post-baseline prompt failure');
        }
      },
      replaceMvuData() {
        if (failFallbackMvu) throw new Error('force fallback MVU readback failure');
      },
      generateRaw() { return '<人物档案无变化/>'; },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const { store } = await acceptInitialSwipe(harness, oldText);
  harness.context.chat[1] = { is_user: false, is_system: false, swipe_id: 1, swipes: [oldText], mes: oldText };
  harness.handlers.get('message_swiped')({ messageId: 1, swipeId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 70));
  failPrompt = true;
  await harness.handlers.get('generation_started')('swipe', {}, false);

  assert.equal(failPrompt, false);
  assert.equal(store.pendingAcceptedFinal, null);
  assert.ok(store.preparedReroll);
  assert.ok(store.doctorStateQuarantined);
  assert.match(store.doctorStateQuarantined.reason, /来源Doctor状态未能精确恢复|无法精确恢复来源状态/u);
  assert.equal(store.fullRuns.length, 1);
});

test('cross-chat switch during END acceptance window cannot consume the old receipt into the new chat', async () => {
  const accepted = '<content>旧聊天刚生成的正文。</content><options><option>继续</option></options>';
  const harness = runtimeHarness(
    [{ is_user: true, is_system: false, mes: '旧聊天输入。' }],
    '',
    false,
    {
      extensionSettings: { 'mvu-doctor-kemini-clean': { enabled: true, variableDoctor: true, worldEngine: true } },
      generateRaw() { return '不应在新聊天调用'; },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  await harness.handlers.get('generation_started')('normal', {}, false);
  harness.context.chat.push({ is_user: false, is_system: false, swipe_id: 0, swipes: [accepted], mes: accepted });
  harness.handlers.get('generation_ended')();
  const oldStore = harness.context.chatMetadata['mvu-doctor-kemini-clean'];

  harness.context.chatId = 'new-chat-after-end';
  harness.context.chat = [{ is_user: true, is_system: false, mes: '新聊天输入。' }];
  harness.context.chatMetadata = {};
  harness.handlers.get('chat_changed')();
  await new Promise((resolve) => setTimeout(resolve, 650));

  const newStore = harness.context.chatMetadata['mvu-doctor-kemini-clean'];
  assert.equal(harness.doctorCalls.length, 0);
  assert.ok(oldStore.pendingAcceptedFinal);
  assert.equal(oldStore.pendingAcceptedFinal.stage, 'ended');
  assert.equal(newStore.pendingAcceptedFinal, null);
  assert.equal(newStore.fullRuns.length, 0);
  assert.equal(newStore.ticketLedger.length, 0);
  assert.equal(harness.counters.mvuReplace, 0);
});
