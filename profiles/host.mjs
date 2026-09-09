import { createHost } from '../modular/host.mjs';
import { storyAdapter } from '../modular/story-adapter.mjs';
import { clone, digest, canonical, fault } from '../modular/variables/core.mjs';
import { currentNarrative } from '../modular/variables/prompt.mjs';
import { userInput } from '../modular/transcript.mjs';

// Sources and adaptations: docs/profiles/PHASE2_SOURCE_MAP.md.
export function createProfileHost(base = createHost(), getDoctor = () => globalThis.MVUDoctorModular) {
  const context = base.context;
  const story = () => storyAdapter();
  const check = signal => { if (signal?.aborted) throw fault('cancelled', '人物档案检查已取消'); };
  async function configHash(so) {
    const settings = so.getSettings(), own = base.settings();
    return digest({ routeHash: await base.modelRouteHash(settings), mode: settings.mode, model: settings.model,
      profileId: settings.profileId, maxTokens: settings.maxTokens, temperature: settings.sendTemperature ? settings.temperature : null,
      diagnosisPrompt: settings.diagnoseSystemPrompt || '', applyRegex: settings.applyRegex, contextDepth: settings.contextDepth,
      includeHiddenFloors: settings.includeHiddenFloors, worldInfoMode: settings.worldInfoMode, globalPrompt: own.globalPrompt });
  }
  async function rules(so) {
    if (so.diagPickerActive()) return (await so.buildDiagSelectedWi()).block;
    const collected = await so.collectMvuUpdateRules('');
    return collected.length ? collected.join('\n\n') : so.buildWorldInfo(so.wiContextMode(so.getSettings()));
  }
  function assertTarget(receipt, signal) {
    check(signal); base.assertTarget(receipt.target);
    const doctor = getDoctor(), status = doctor?.status?.(), current = doctor?.record?.();
    if (!doctor?.ready || !doctor.locked || status?.busy || status?.inFlight
      || !['applied', 'model_nochange', 'recovered'].includes(status?.status)
      || !receipt.readback || current?.identity !== receipt.identity || current?.afterHash !== receipt.afterHash)
      throw fault('variables_not_ready', '请先完成当前正文的变量检查，再修复人物档案');
  }
  async function assertReceipt(receipt, signal) {
    assertTarget(receipt, signal);
    const so = story(), mvu = await so.getMvu();
    const payload = await mvu.getMvuData({ type: 'message', message_id: receipt.target.index });
    if (await digest(payload) !== receipt.afterHash) throw fault('stale_mvu', '当前变量已变化，旧人物候选已停止');
    if (await configHash(so) !== receipt.configHash || await digest(await rules(so)) !== receipt.ruleHash
      || await digest(base.variableSchemaMaterial()) !== receipt.schemaHash)
      throw fault('variable_evidence_changed', '变量规则或配置已变化，请先重新检查变量');
    assertTarget(receipt, signal);
    return clone(payload);
  }
  function playerNames(target) {
    const ctx = context(), persona = ctx.chatMetadata?.persona;
    return [...new Set([ctx.name1, ctx.user_name, ctx.userName,
      persona ? ctx.powerUserSettings?.personas?.[persona] : '',
      ...ctx.chat.slice(0, target.index + 1).filter(row => row.is_user).map(row => row.name)]
      .map(value => String(value || '').trim()).filter(Boolean))];
  }
  async function inputFor(receipt, profiles, globalPrompt, signal) {
    const payload = await assertReceipt(receipt, signal), so = story(), target = receipt.target;
    const ctx = base.contextSnapshot(target), settings = so.getSettings();
    const substitute = value => ctx.substituteParams ? ctx.substituteParams(value) : value;
    const card = substitute(so.buildCardSection(ctx));
    const world = await so.buildWorldInfo(so.wiContextMode(settings));
    const missingRules = await so.collectMvuUpdateRules(world);
    const authority = { card: String(card || ''), world: [world, ...missingRules].filter(Boolean).join('\n\n') };
    if (!authority.card.trim() || !authority.world.trim()) throw fault('authority_unavailable', '人物档案未取得完整角色卡或世界设定');
    await base.readback(target, payload); await assertReceipt(receipt, signal);
    return { target: clone(target), narrative: currentNarrative(so, ctx, settings, target), userText: userInput(target.userText),
      mvu: clone(payload.stat_data ?? payload), authority, players: playerNames(target), profiles: clone(profiles), globalPrompt: String(globalPrompt || '') };
  }
  async function callModel(receipt, prompt, signal) {
    await assertReceipt(receipt, signal);
    const so = story(), settings = clone(so.getSettings());
    const messages = [{ role: 'user', content: prompt }], maxTokens = Math.max(Number(settings.maxTokens) || 4096, 4096);
    let raw;
    // Same direct/profile dispatch as P1. Credentials remain in this call only.
    if (settings.mode === 'direct') {
      if (!settings.endpoint || !settings.model) throw fault('model_unconfigured', '当前模型连接尚未配置');
      const body = { model: settings.model, messages, max_tokens: maxTokens };
      if (settings.sendTemperature) body.temperature = settings.temperature;
      raw = await so.callDirect(so.resolveEndpointUrl(settings), settings.apiKey, body, signal);
    } else {
      if (!settings.profileId) throw fault('model_unconfigured', '当前模型尚未选择连接配置');
      raw = await so.callProfile(settings.profileId, messages, maxTokens,
        settings.sendTemperature ? { temperature: settings.temperature } : {}, signal);
    }
    await assertReceipt(receipt, signal);
    return String(raw ?? '');
  }
  async function branches() {
    const scope = base.scope(); if (!scope) return [];
    const rows = context().chat.map(row => ({ user: row.is_user === true, system: row.is_system === true,
      swipe: Number(row.swipe_id || 0), text: base.messageText(row) }));
    const scopeKey = await digest(scope), result = [];
    for (let index = 0; index < rows.length; index++) {
      if (rows[index].user || rows[index].system || !rows[index].text) continue;
      result.push({ index, scopeKey, lineage: await digest({ scope, rows: rows.slice(0, index + 1) }) });
    }
    if (canonical(scope) !== canonical(base.scope()) || canonical(rows) !== canonical(context().chat.map(row => ({
      user: row.is_user === true, system: row.is_system === true, swipe: Number(row.swipe_id || 0), text: base.messageText(row) }))))
      throw fault('stale_target', '聊天分支读取期间发生变化');
    return result;
  }
  return Object.freeze({ ...base, story, playerNames, inputFor, callModel, assertReceipt, assertTarget, branches,
    doctor: getDoctor, receipt: () => clone(getDoctor()?.record?.() || null) });
}
