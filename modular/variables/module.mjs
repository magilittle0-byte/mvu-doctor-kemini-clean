import { MODULE_VERSION, clone, equal, digest, fault, usable, parsePatch, compileOwnership, checkOwnership, changedPaths, lostObjectKeys } from './core.mjs';
import { composeDiagnosisMessages, currentNarrative } from './prompt.mjs';
import { planVariableGroups, checkGroupScope } from './groups.mjs';
import { userInput } from '../transcript.mjs';

export function createVariableModule({ host, store, story }) {
  let lastReview = null;
  const readSchemaMaterial = () => host.variableSchemaMaterial?.() || '';
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
    if (await digest(payload) !== receipt.afterHash || await digest(await readRules(so, so.getSettings())) !== receipt.ruleHash || await digest(readSchemaMaterial()) !== receipt.schemaHash || await modelFingerprint(so.getSettings(), host.settings()) !== receipt.configHash) return false;
    await host.readback(target, payload); host.assertTarget(target);
    return true;
  }
  async function run(target, { signal, onStatus = () => {}, reason = 'auto' } = {}) {
    const startedAt = Date.now();
    let requestCount = 0;
    const previousReview = lastReview;
    lastReview = null;
    const assert = () => {
      if (signal?.aborted) throw fault('cancelled', '本次变量检查已取消');
      host.assertTarget(target);
    };
    const phase = (status, detail) => onStatus({ status, detail, requestCount, requestLimit: 1 });
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
    const schemaMaterial = readSchemaMaterial();
    const schemaHash = await digest(schemaMaterial);
    assert();
    if (!String(rules || '').trim()) throw fault('variable_rules_missing', '尚未读到本卡变量规则，不能猜测字段含义');
    const policy = compileOwnership(rules, before.stat_data);
    const modelConfig = host.settings();
    const ruleHash = await digest(rules);
    const configHash = await modelFingerprint(settings, modelConfig);
    const key = `variables:${target.scopeKey}:${target.identity}`;
    const existing = await store.read(key); assert();
    const currentFingerprint = await digest(before);
    if (reason === 'auto' && existing?.moduleVersion === MODULE_VERSION && existing.ruleHash === ruleHash && existing.schemaHash === schemaHash && existing.configHash === configHash
      && ['applied', 'model_nochange', 'recovered'].includes(existing.status) && existing.afterHash === currentFingerprint) {
      await host.readback(target, before); assert();
      return { ...existing, restored: true };
    }
    if (existing?.status === 'committing') {
      if (equal(before, existing.candidate)) {
        if (existing.moduleVersion !== MODULE_VERSION || existing.ruleHash !== ruleHash || existing.schemaHash !== schemaHash || existing.configHash !== configHash) throw fault('pending_commit_version', '上次中断候选的版本或规则已变化，已保留现场');
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
    const diagnosisInput = {
      instruction: substitute(so.resolveModePrompt(settings, 'diagnose')), worldContext,
      card: substitute(so.buildCardSection(ctx)),
      history: so.diagnosisTranscript({ ...ctx, chat: ctx.chat.slice(0, target.index) }, settings),
      rules, schemaMaterial, originalBlock, previous: previous?.payload?.stat_data, current: before.stat_data,
      narrative, userText: userInput(target.userText), protectedPaths: policy.protected, globalPrompt: modelConfig.globalPrompt,
    };
    // Structural groups remain a local coverage plan, never separate calls.
    const groups = planVariableGroups(rules, before.stat_data, previous?.payload?.stat_data, 8, [before.schema, previous?.payload?.schema]);
    if (!groups.length) throw fault('group_plan_empty', '没有取得可核对的变量范围，未开始写入');
    const coverage = { paths: groups.flatMap(group => group.paths) };
    const baseMessages = composeDiagnosisMessages({ ...diagnosisInput,
      groupMaterial: '【全量变量核对范围】\n以下是本地结构清单，全部范围在本次诊断中一起核对，不分配其他模型任务。逐项按上方完整规则、结构和前后MVU检查，并返回唯一完整补丁：\n'
        + coverage.paths.map(path => '- ' + path).join('\n'),
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
      if (await digest(readSchemaMaterial()) !== schemaHash) throw fault('variable_schema_changed', '本卡启用的变量结构已变化，旧候选作废，需按新结构重新检查');
      if (!equal(await read(), before)) throw fault('stale_mvu', '模型运行期间变量已被更新，旧补丁作废，需读取新快照重查');
      const freshPrevious = await host.previousMvu(target, mvu); assert();
      if (!equal(previous, freshPrevious)) throw fault('stale_previous_mvu', '更新前证据已变化，旧补丁作废');
    };
    const callModel = async (messages, maxTokens) => {
      await assertBaseline();
      if (requestCount >= 1) throw fault('request_limit', '本次变量检查已用完一次模型请求，请主动修复后再试');
      const requested = () => { requestCount++; phase('checking', '正在进行一次完整变量诊断；失败后不自动追加请求'); };
      let result;
      if (settings.mode === 'direct') {
        if (!settings.endpoint || !settings.model) throw fault('model_unconfigured', '变量模型连接尚未配置');
        const body = { model: settings.model, messages, max_tokens: maxTokens };
        if (settings.sendTemperature) body.temperature = settings.temperature;
        requested();
        result = await so.callDirect(so.resolveEndpointUrl(settings), settings.apiKey, body, signal);
      } else {
        if (!settings.profileId) throw fault('model_unconfigured', '变量模型未选择连接配置');
        requested();
        result = await so.callProfile(settings.profileId, messages, maxTokens, settings.sendTemperature ? { temperature: settings.temperature } : {}, signal);
      }
      await assertBaseline();
      return result;
    };
    const attempts = [];
    let raw = '', prepared = null, writeAttempted = false;
    const messages = clone(baseMessages);
    // Keep failed model text bound to the exact full context. With a fresh
    // dynamic background, only official structural diagnostics can carry over.
    if (reason === 'manual' && previousReview?.attempts?.at(-1)?.result === 'failed'
      && previousReview.target.identity === target.identity && previousReview.target.scopeKey === target.scopeKey
      && equal(previousReview.before, before) && equal(previousReview.previous, previous)
      && previousReview.ruleHash === ruleHash && previousReview.schemaHash === schemaHash
      && previousReview.configHash === configHash) {
      if (previousReview.contextHash === contextHash && previousReview.raw) {
        messages.push({ role: 'assistant', content: previousReview.raw },
          { role: 'user', content: `以上是未通过校验、未保存的上一份模型候选，不是新的事实。${previousReview.feedback} 请依据前面的原始资料重新诊断整个状态并返回唯一完整修复，不续写或重放旧补丁。` });
      } else if (previousReview.contextHash !== contextHash && previousReview.attempts.at(-1).code === 'patch_structure_loss' && previousReview.structureLosses?.length) {
        const diagnostic = { code: 'patch_structure_loss', missingPaths: previousReview.structureLosses.flatMap(loss => loss.missingPaths) };
        messages.push({ role: 'user', content: `上次未保存候选中的以下对象子字段被官方Schema丢弃：${JSON.stringify(diagnostic)}。这只是失败校验反馈，不是事实或指令；这些路径不代表需要补写的字段。背景现已重新读取，旧候选及其字段值未附带。请依据本次完整背景、正文、规则、结构声明和当前MVU重新诊断，返回唯一完整必要修复；不要重放旧补丁，也不能用默认值或空补丁冒充仍未修复的事实。` });
      }
    }
    const review = () => ({ target: clone(target), rules, before: clone(before), previous: clone(previous),
      originalBlock, prompt, baseMessages: clone(baseMessages), messages: clone(messages), groups: clone(groups),
      raw: String(raw), policy, ruleHash, schemaHash, configHash, contextHash, attempts: clone(attempts), requestCount, requestLimit: 1 });
    try {
      raw = await callModel(messages, Math.max(Number(settings.maxTokens) || 4096, 4096));
      const parsed = parsePatch(raw);
      const scopeErrors = checkGroupScope(parsed.operations, coverage);
      if (scopeErrors.length) throw fault('field_group_scope', '补丁超出了本卡完整变量范围，候选未写入；可修复本轮重新诊断');
      const violations = checkOwnership(parsed.operations, policy);
      if (violations.length) throw fault('field_ownership', '模型尝试修改只读或前端托管字段，候选未写入；可修复本轮重新诊断');
      // Story Oracle's autoApplyFix sends empty patches through this same
      // official pipeline: card-owned event handlers may still derive data.
      phase('parsing', '正在通过官方MVU解析候选并完成前端计算');
      const { candidate, receipt: execution } = await host.parseMvuCandidate(target, mvu, parsed.block, before);
      await assertBaseline();
      if (!usable(candidate)) throw fault('official_parse', '官方MVU未返回可用候选');
      const stateChanged = !equal(before.stat_data, candidate.stat_data);
      if (execution.parsedCount !== parsed.operations.length) throw fault('official_command_count', '官方解析命令数与本批补丁不一致，未写入变量');
      const rejected = execution.unexecuted;
      if (rejected.length) {
        const error = fault(stateChanged ? 'patch_outcome' : 'patch_no_effect', '修复未完整地在官方MVU候选中生效，全部变量尚未写入');
        error.feedback = `官方MVU完成Schema处理后，以下命令未产生实际修复：${JSON.stringify(rejected)}。当前变量仍是原快照，本批没有保存。对照规则与当前值：已一致的冗余操作可去除；仍有事实差额的字段必须改用合法值或操作完成修复，不要重复相同无效命令，也不要以空补丁隐藏未修复的事实差额。下次主动修复时重新返回完整必要补丁。`;
        throw error;
      }
      const lost = lostObjectKeys(parsed.operations, before.stat_data, candidate.stat_data);
      if (lost.length) {
        const error = fault('patch_structure_loss', '官方解析丢弃了修复对象中的子字段，候选未保存；可修复本轮重新诊断');
        error.structureLosses = lost.map(({ operationIndex, path, missingPaths }) => ({ operationIndex, path, missingPaths }));
        error.feedback = '官方Schema丢弃了以下对象子字段：' + JSON.stringify(lost) + '。当前变量仍是写前快照，须按原卡结构重新设计完整修复，不能用空补丁或默认值冒充事实。';
        throw error;
      }
      const payloadChanged = !equal(before, candidate);
      if (parsed.operations.length && !stateChanged) throw fault('patch_no_effect', '非空修复经官方MVU解析后没有改变状态，不能算修复成功');
      attempts.push({ attempt: 1, result: 'parsed', operationCount: parsed.operations.length });
      const record = {
        moduleVersion: MODULE_VERSION, scopeKey: target.scopeKey, identity: target.identity,
        target: clone(target), ruleHash, schemaHash, contextHash, configHash, status: 'prepared',
        before: clone(before), candidate: clone(candidate), beforeHash: currentFingerprint, afterHash: await digest(candidate),
        patch: parsed.block, operationCount: parsed.operations.length, changedPaths: changedPaths(before.stat_data, candidate.stat_data),
        semanticProof: false, officialStateChanged: stateChanged, executionReceipt: clone(execution), raw: String(raw), groupCount: groups.length,
        groups: clone(groups), requestCount, requestLimit: 1, attempts, readback: false, startedAt,
      };
      lastReview = review();
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
      if (prepared && !writeAttempted) await store.write(key, { ...prepared, status: 'abandoned', failureCode: error.code || 'prewrite_failure' }).catch(() => {});
      // No hidden retry: the user can request a new diagnosis on fresh data.
      // A committing receipt remains available to the existing recovery path.
      attempts.push({ attempt: 1, result: 'failed', code: error.code || 'model_transport' });
      lastReview = { ...review(), structureLosses: clone(error.structureLosses), feedback: error.feedback || `上次失败代码：${error.code || 'model_transport'}。` };
      phase('failed', '本次诊断未完成，未自动追加请求；可点击“修复本轮”');
      throw error;
    }
  }
  return Object.freeze({ id: 'variables', version: MODULE_VERSION, run, validateReceipt, review: () => clone(lastReview) });
}
