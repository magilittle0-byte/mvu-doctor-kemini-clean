import { MODULE_VERSION, clone, canonical, equal, digest, fault, usable, parsePatch, compileOwnership, checkOwnership, changedPaths } from './core.mjs';
import { composeDiagnosisMessages, currentNarrative } from './prompt.mjs';
import { planVariableGroups, checkGroupScope, groupInstruction } from './groups.mjs';

export function createVariableModule({ host, store, story }) {
  let lastReview = null;
  const modelFingerprint = async (settings, own) => digest({ routeHash: await host.modelRouteHash(settings), mode: settings.mode, model: settings.model, profileId: settings.profileId, maxTokens: settings.maxTokens, temperature: settings.sendTemperature ? settings.temperature : null, diagnosisPrompt: settings.diagnoseSystemPrompt || '', applyRegex: settings.applyRegex, contextDepth: settings.contextDepth, includeHiddenFloors: settings.includeHiddenFloors, worldInfoMode: settings.worldInfoMode, globalPrompt: own.globalPrompt });
  async function readRules(so, settings) {
    if (so.diagPickerActive()) return (await so.buildDiagSelectedWi()).block;
    const collected = await so.collectMvuUpdateRules('');
    return collected.length ? collected.join('\n\n') : so.buildWorldInfo(so.wiContextMode(settings));
  }
  async function readWorldContext(so, settings, rules) {
    if (so.diagPickerActive()) return rules;
    // Restore runAutoDiagnose's original full-context assembly. The raw MVU
    // rules above retain their separate ownership/stable-rule responsibility.
    const world = await so.buildWorldInfo(so.wiContextMode(settings));
    const missing = await so.collectMvuUpdateRules(world);
    return [world, ...missing].filter(Boolean).join('\n\n');
  }
  async function validateReceipt(target, receipt) {
    host.assertTarget(target);
    if (receipt?.moduleVersion !== MODULE_VERSION || receipt.identity !== target.identity || !receipt.readback || !['applied', 'model_nochange', 'recovered'].includes(receipt.status)) return false;
    const so = story(), mvu = await so.getMvu();
    const payload = await mvu.getMvuData({ type: 'message', message_id: target.index });
    if (await digest(payload) !== receipt.afterHash || await digest(await readRules(so, so.getSettings())) !== receipt.ruleHash || await modelFingerprint(so.getSettings(), host.settings()) !== receipt.configHash) return false;
    await host.readback(target, payload); host.assertTarget(target);
    return true;
  }
  async function run(target, { signal, onStatus = () => {}, reason = 'auto' } = {}) {
    const startedAt = Date.now();
    const assert = () => {
      if (signal?.aborted) throw fault('cancelled', '本次变量检查已取消');
      host.assertTarget(target);
    };
    const phase = (status, detail) => onStatus({ status, detail });
    assert();
    const so = story();
    const mvu = await so.getMvu(); assert();
    if (!mvu?.getMvuData || !mvu.parseMessage || !mvu.replaceMvuData) throw fault('mvu_unavailable', '尚未取得MVU官方读写接口');
    phase('waiting_mvu', '正在等待本轮MVU自身更新完成');
    while (so.mvuIsBusy(mvu)) { await host.delay(200, signal); assert(); }
    const options = { type: 'message', message_id: target.index };
    const read = async () => { assert(); const payload = clone(await mvu.getMvuData(options)); assert(); return payload; };
    const before = await read();
    if (!usable(before)) throw fault('mvu_snapshot_missing', '本楼尚无可用变量快照，不能用空数据检查');
    const previous = await host.previousMvu(target, mvu); assert();
    const ctx = host.contextSnapshot(target);
    const settings = clone(so.getSettings());
    const rules = await readRules(so, settings);
    assert();
    if (!String(rules || '').trim()) throw fault('variable_rules_missing', '尚未读到本卡变量规则，不能猜测字段含义');
    const policy = compileOwnership(rules, before.stat_data);
    const modelConfig = host.settings();
    const ruleHash = await digest(rules);
    const configHash = await modelFingerprint(settings, modelConfig);
    const key = `variables:${target.scopeKey}:${target.identity}`;
    const existing = await store.read(key); assert();
    const currentFingerprint = await digest(before);
    if (reason === 'auto' && existing?.moduleVersion === MODULE_VERSION && existing.ruleHash === ruleHash && existing.configHash === configHash
      && ['applied', 'model_nochange', 'recovered'].includes(existing.status) && existing.afterHash === currentFingerprint) {
      await host.readback(target, before); assert();
      return { ...existing, restored: true };
    }
    if (existing?.status === 'committing') {
      if (equal(before, existing.candidate)) {
        if (existing.moduleVersion !== MODULE_VERSION || existing.ruleHash !== ruleHash || existing.configHash !== configHash) throw fault('pending_commit_version', '上次中断候选的版本或规则已变化，已保留现场');
        await host.saveChat(target, before); assert();
        const recovered = { ...existing, status: 'recovered', afterHash: currentFingerprint, durationMs: Date.now() - startedAt, readback: true };
        await store.write(key, recovered); await store.write(`latest:variables:${target.scopeKey}`, recovered); assert();
        return recovered;
      }
      if (!equal(before, existing.before)) throw fault('pending_commit_conflict', '上次写入被中断，当前变量与写前/候选均不同；已保留现场，未覆盖');
    }
    const originalBlock = so.extractUpdateBlock(target.content);
    const narrative = currentNarrative(so, ctx, settings, target);
    const worldContext = await readWorldContext(so, settings, rules); assert();
    const contextHash = await digest(worldContext);
    // Retain the native contract, card and transcript builders, while keeping
    // complete world background separate from the field-definition contract.
    const substitute = text => { try { return ctx.substituteParams(text); } catch { return text; } };
    const baseMessages = composeDiagnosisMessages({
      instruction: substitute(so.resolveModePrompt(settings, 'diagnose')), worldContext,
      card: substitute(so.buildCardSection(ctx)),
      history: so.buildTranscript({ ...ctx, chat: ctx.chat.slice(0, target.index) }, settings, false),
      rules, originalBlock, previous: previous?.payload?.stat_data, current: before.stat_data,
      narrative, userText: target.userText, protectedPaths: policy.protected, globalPrompt: modelConfig.globalPrompt,
    });
    const prompt = baseMessages.map(message => message.content).join('\n\n');
    const assertBaseline = async () => {
      assert();
      let currentConfigHash;
      try { currentConfigHash = await modelFingerprint(so.getSettings(), host.settings()); }
      catch (error) {
        if (error.code !== 'model_config_unavailable') throw error;
        throw fault('model_config_changed', '原连接配置已无法读取，旧候选已作废');
      }
      if (currentConfigHash !== configHash) throw fault('model_config_changed', '模型配置已变化，旧候选已作废');
      let currentRuleHash;
      try { currentRuleHash = await digest(await readRules(so, so.getSettings())); }
      catch { throw fault('variable_rules_changed', '本卡变量规则已无法读取，旧候选已作废'); }
      if (currentRuleHash !== ruleHash) throw fault('variable_rules_changed', '本卡变量规则已变化，旧候选已作废，需按新规则重新检查');
      if (!equal(await read(), before)) throw fault('stale_mvu', '模型运行期间变量已被更新，旧补丁作废，需读取新快照重查');
      const freshPrevious = await host.previousMvu(target, mvu); assert();
      if (!equal(previous, freshPrevious)) throw fault('stale_previous_mvu', '更新前证据已变化，旧补丁作废');
    };
    let retry = null, lastError = null;
    const attempts = [];
    const groups = planVariableGroups(rules, before.stat_data, previous?.payload?.stat_data);
    if (!groups.length) throw fault('group_plan_empty', '没有取得可核对的变量范围，未开始写入');
    const groupResults = new Map();
    let currentGroup = null;
    for (let attempt = 1; attempt <= modelConfig.maxAttempts; attempt++) {
      await assertBaseline();
      phase('checking', attempt === 1 ? '正在对照正文、规则和变量检查本轮状态' : `正在自动修复第${attempt - 1}次检查的问题`);
      let raw = '', prepared = null, writeAttempted = false;
      let messages = baseMessages;
      try {
        const maxTokens = Math.max(Number(settings.maxTokens) || 4096, 4096);
        for (const [index, group] of groups.entries()) {
          if (groupResults.get(group.id)?.valid) continue;
          currentGroup = group;
          await assertBaseline();
          phase('checking', `正在核对第${index + 1}/${groups.length}组变量；全部完成后统一保存`);
          messages = clone(baseMessages);
          messages.at(-1).content += '\n\n' + groupInstruction(group, index, groups.length);
          const priorRaw = retry?.groupId === group.id ? retry.raw : retry && !retry.groupId ? groupResults.get(group.id)?.raw : '';
          if (priorRaw) messages.push({ role: 'assistant', content: priorRaw }, { role: 'user', content: retry.feedback });
          raw = '';
          if (settings.mode === 'direct') {
            if (!settings.endpoint || !settings.model) throw fault('model_unconfigured', '变量模型连接尚未配置');
            const body = { model: settings.model, messages, max_tokens: maxTokens };
            if (settings.sendTemperature) body.temperature = settings.temperature;
            raw = await so.callDirect(so.resolveEndpointUrl(settings), settings.apiKey, body, signal);
          } else {
            if (!settings.profileId) throw fault('model_unconfigured', '变量模型未选择连接配置');
            raw = await so.callProfile(settings.profileId, messages, maxTokens, settings.sendTemperature ? { temperature: settings.temperature } : {}, signal);
          }
          await assertBaseline();
          const groupPatch = parsePatch(raw);
          const scopeErrors = checkGroupScope(groupPatch.operations, group);
          if (scopeErrors.length) {
            const error = fault('field_group_scope', '本组补丁越过分配范围，全部变量尚未写入');
            error.feedback = `本组只能修改${JSON.stringify(group.paths)}及其后代；越界操作：${JSON.stringify(scopeErrors)}。请重新返回本组完整必要补丁，其他组由各自任务处理。`;
            throw error;
          }
          const ownershipErrors = checkOwnership(groupPatch.operations, policy);
          if (ownershipErrors.length) {
            const error = fault('field_ownership', '本组尝试修改只读或前端托管字段，全部变量尚未写入');
            error.feedback = `本组触及不归你修改的字段：${JSON.stringify(ownershipErrors)}。前端计算字段不直接写，也不能为达到同一派生总值而绕道改基础值或自定义加成。源字段必须有独立的正文/规则错误才能修正，其他必要修复仍须完成。返回本组完整纠正补丁。`;
            throw error;
          }
          groupResults.set(group.id, { group: clone(group), raw: String(raw), operations: groupPatch.operations, messages: clone(messages), valid: true });
        }
        currentGroup = null;
        await assertBaseline();
        // Like the database's unified group commit, no official execution or
        // durable write occurs until every disjoint group has a valid result.
        const complete = groups.map(group => groupResults.get(group.id));
        if (complete.some(result => !result?.valid)) throw fault('group_incomplete', '仍有分组没有完成，未写入变量');
        raw = complete.map((result, index) => `分组 ${index + 1}/${groups.length}\n${result.raw}`).join('\n\n');
        const parsed = parsePatch(JSON.stringify(complete.flatMap(result => result.operations)));
        const violations = checkOwnership(parsed.operations, policy);
        if (violations.length) {
          const error = fault('field_ownership', '模型尝试修改只读或前端托管字段，候选未写入');
          error.feedback = `修复补丁触及不归你修改的字段：${JSON.stringify(violations)}。请按原规则重新生成完整纠正补丁：前端计算字段不直接写，也不能为达到同一派生总值而绕道改基础值或自定义加成。源字段必须有独立的正文/规则错误才能修正，已登记的同一加成不能换个字段再次计入。其他已经定位的错误仍须完整修复，不得用空数组掩盖。`;
          throw error;
        }
        // Story Oracle's autoApplyFix sends empty patches through this same
        // official pipeline: card-owned event handlers may still derive data.
        phase('parsing', '正在通过官方MVU解析候选并完成前端计算');
        const candidate = clone(await mvu.parseMessage(parsed.block, clone(before)));
        await assertBaseline();
        if (!usable(candidate)) throw fault('official_parse', '官方MVU未返回可用候选');
        const stateChanged = !equal(before.stat_data, candidate.stat_data);
        const payloadChanged = !equal(before, candidate);
        if (parsed.operations.length && !stateChanged) throw fault('patch_no_effect', '非空修复经官方MVU解析后没有改变状态，不能算修复成功');
        attempts.push({ attempt, result: 'parsed', operationCount: parsed.operations.length });
        const record = {
          moduleVersion: MODULE_VERSION, scopeKey: target.scopeKey, identity: target.identity,
          target: clone(target), ruleHash, contextHash, configHash, status: 'prepared',
          before: clone(before), candidate: clone(candidate), beforeHash: currentFingerprint, afterHash: await digest(candidate),
          patch: parsed.block, operationCount: parsed.operations.length, changedPaths: changedPaths(before.stat_data, candidate.stat_data),
          semanticProof: false, officialStateChanged: stateChanged, raw: String(raw), groupCount: groups.length,
          groups: complete.map(({ messages: _messages, ...result }) => clone(result)), attempts, readback: false, startedAt,
        };
        lastReview = { target: clone(target), rules, before: clone(before), previous: clone(previous), originalBlock, prompt, baseMessages: clone(baseMessages), messages: clone(messages), groups: clone(complete), raw: String(raw), policy, attempts: clone(attempts) };
        // Save recovery evidence before writing any MVU. It remains local to
        // this browser; public status never exposes narrative or credentials.
        prepared = record;
        await store.write(key, record); await assertBaseline();
        if (payloadChanged) {
          phase('saving', '正在写入修复并核对实际读回');
          record.status = 'committing';
          await store.write(key, record); await assertBaseline();
          writeAttempted = true;
          await mvu.replaceMvuData(clone(candidate), options);
          assert();
          if (!equal(await read(), candidate)) throw fault('mvu_readback', 'MVU写后读回不一致；未报告成功');
          await host.saveChat(target, candidate); assert();
          if (!equal(await read(), candidate)) throw fault('mvu_save_readback', '保存后变量已变化；未报告成功');
          so.refreshMessageBar(target.index);
          record.status = stateChanged ? 'applied' : 'model_nochange';
        }
        if (!payloadChanged) { await host.saveChat(target, candidate); record.status = 'model_nochange'; }
        record.readback = true; record.durationMs = Date.now() - startedAt;
        await store.write(key, record); await store.write(`latest:variables:${target.scopeKey}`, record); assert();
        return record;
      } catch (error) {
        lastError = error;
        if (prepared && !writeAttempted) await store.write(key, { ...prepared, status: 'abandoned', failureCode: error.code || 'prewrite_failure' }).catch(() => {});
        // A write or durable save may have partially completed. Never call the
        // model again against the old baseline; recovery inspects that receipt.
        if (writeAttempted) throw error;
        if (signal?.aborted || ['cancelled', 'stale_target', 'stale_mvu', 'stale_previous_mvu', 'model_unconfigured', 'model_config_changed', 'variable_rules_changed', 'mvu_readback', 'mvu_save_readback'].includes(error.code)
          || /^(?:store_|host_)/u.test(String(error.code || ''))) throw error;
        attempts.push({ attempt, groupId: currentGroup?.id || null, result: 'failed', code: error.code || 'model_transport' });
        lastReview = { target: clone(target), rules, before: clone(before), previous: clone(previous), originalBlock, prompt, baseMessages: clone(baseMessages), messages: clone(messages), groups: clone([...groupResults.values()]), failedGroup: clone(currentGroup), raw: String(raw), policy, attempts: clone(attempts) };
        retry = raw ? { groupId: currentGroup?.id || null, raw: String(raw), feedback: error.feedback || `本次返回尚不能完成变量修复（${error.code || 'model_transport'}）。只修复格式或官方无法执行的部分，仍须完成本组的全部必要修复。返回唯一完整UpdateVariable和JSONPatch。` } : null;
        if (!currentGroup) for (const result of groupResults.values()) result.valid = false;
      }
    }
    throw lastError || fault('variable_failed', '变量检查未完成');
  }
  return Object.freeze({ id: 'variables', version: MODULE_VERSION, run, validateReceipt, review: () => clone(lastReview) });
}
