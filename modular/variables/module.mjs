import { MODULE_VERSION, clone, canonical, equal, digest, fault, usable, parsePatch, compileOwnership, checkOwnership, changedPaths } from './core.mjs';
import { adaptDiagnosisPrompt, currentNarrative } from './prompt.mjs';

export function createVariableModule({ host, store, story }) {
  let lastReview = null;
  const modelFingerprint = (settings, own) => digest({ mode: settings.mode, model: settings.model, profileId: settings.profileId, maxTokens: settings.maxTokens, temperature: settings.sendTemperature ? settings.temperature : null, diagnosisPrompt: settings.diagnoseSystemPrompt || '', applyRegex: settings.applyRegex, contextDepth: settings.contextDepth, includeHiddenFloors: settings.includeHiddenFloors, worldInfoMode: settings.worldInfoMode, globalPrompt: own.globalPrompt });
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
    // Retain the original diagnosis contract and its card/transcript builder.
    // auto=false avoids the unsupported presence-of-tag == application claim.
    const nativePrompt = so.buildDiagnosePromptFrom(ctx, { ...settings, includeCard: true, diagnoseSystemPrompt: adaptDiagnosisPrompt(so.resolveModePrompt(settings, 'diagnose')) }, {
      wiBlock: worldContext, statStr: JSON.stringify(before.stat_data), latestBlock: originalBlock, latestReply: narrative, auto: false,
    });
    const prompt = `${nativePrompt}\n\n【明确由前端/脚本拥有的精确路径】\n${JSON.stringify(policy.protected)}\n\n【更新前MVU；缺失时不能臆造】\n${previous ? JSON.stringify(previous.payload.stat_data) : '本轮没有可用的前态'}\n\n【本轮用户输入】\n${target.userText}\n\n【最终接受的本轮正文（原生正则投影，原更新已单独提供）】\n${narrative}${modelConfig.globalPrompt ? `\n\n【全局自定义模型适配附加提示词】\n${modelConfig.globalPrompt}` : ''}`;
    const baseMessages = [
      { role: 'system', content: prompt },
      { role: 'user', content: '请检查本轮相关状态是否与实际正文及本卡规则一致。完整修正确定的错写和漏写，保留已经正确的值，输出唯一的纠正补丁。' },
    ];
    const assertBaseline = async () => {
      assert();
      if (await modelFingerprint(so.getSettings(), host.settings()) !== configHash) throw fault('model_config_changed', '模型配置已变化，旧候选已作废');
      if (!equal(await read(), before)) throw fault('stale_mvu', '模型运行期间变量已被更新，旧补丁作废，需读取新快照重查');
      const freshPrevious = await host.previousMvu(target, mvu); assert();
      if (!equal(previous, freshPrevious)) throw fault('stale_previous_mvu', '更新前证据已变化，旧补丁作废');
    };
    let retry = null, lastError = null;
    const attempts = [];
    for (let attempt = 1; attempt <= modelConfig.maxAttempts; attempt++) {
      await assertBaseline();
      phase('checking', attempt === 1 ? '正在对照正文、规则和变量检查本轮状态' : `正在自动修复第${attempt - 1}次检查的问题`);
      let raw = '', prepared = null, writeAttempted = false;
      try {
        const messages = retry ? [...baseMessages, { role: 'assistant', content: retry.raw }, { role: 'user', content: retry.feedback }] : baseMessages;
        const maxTokens = Math.max(Number(settings.maxTokens) || 4096, 4096);
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
        const parsed = parsePatch(raw);
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
          semanticProof: false, officialStateChanged: stateChanged, raw: String(raw), attempts, readback: false, startedAt,
        };
        lastReview = { target: clone(target), rules, before: clone(before), previous: clone(previous), prompt, raw: String(raw), policy, attempts: clone(attempts) };
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
        if (signal?.aborted || ['cancelled', 'stale_target', 'stale_mvu', 'stale_previous_mvu', 'model_unconfigured', 'model_config_changed', 'mvu_readback', 'mvu_save_readback'].includes(error.code)
          || /^(?:store_|host_)/u.test(String(error.code || ''))) throw error;
        attempts.push({ attempt, result: 'failed', code: error.code || 'model_transport' });
        lastReview = { target: clone(target), rules, before: clone(before), previous: clone(previous), prompt, raw: String(raw), policy, attempts: clone(attempts) };
        retry = raw ? { raw: String(raw), feedback: error.feedback || `本次返回尚不能完成变量修复（${error.code || 'model_transport'}）。只修复格式或官方无法执行的部分，仍须完成原任务的全部必要修复。返回唯一完整UpdateVariable和JSONPatch。` } : null;
      }
    }
    throw lastError || fault('variable_failed', '变量检查未完成');
  }
  return Object.freeze({ id: 'variables', version: MODULE_VERSION, run, validateReceipt, review: () => clone(lastReview) });
}
