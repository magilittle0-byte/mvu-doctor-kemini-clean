// Hook-only adaptation. The pinned Story Oracle file remains byte-identical.
import { fault } from './variables/core.mjs';
export function disableNativeDiagnosis(ctx) {
  const settings = ctx.extensionSettings.storyOracle ||= {};
  if (settings.autoDiagnoseEnabled !== false) {
    settings.autoDiagnoseEnabled = false;
    ctx.saveSettingsDebounced?.();
  }
}
export function storyAdapter(api = globalThis.StoryOracleAPI) {
  if (!api?.isCompatible?.(1) || typeof api?.unsafe?.eval !== 'function') throw fault('reference_contract', '故事神谕接口不兼容');
  // Literal, trusted adapter code only. Model text never reaches this hook.
  const internals = api.unsafe.eval(`({ getSettings, getMvu, diagPickerActive, buildDiagSelectedWi,
    buildWorldInfo, wiContextMode, collectMvuUpdateRules, extractUpdateBlock, buildDiagnosePromptFrom,
    callDirect, resolveEndpointUrl, callProfile, refreshMessageBar, mvuIsBusy })`);
  if (Object.values(internals).some(fn => typeof fn !== 'function')) throw fault('reference_contract', '故事神谕诊断接口缺失');
  return Object.freeze(internals);
}
export async function loadStory(root, host) {
  disableNativeDiagnosis(host.context());
  if (!globalThis.StoryOracleAPI) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = new URL('vendor/story-oracle-v1.35.4/style.css', root).href;
    document.head.appendChild(link);
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('vendor/story-oracle-v1.35.4/index.js', root).href;
      script.async = false; script.onload = resolve;
      script.onerror = () => reject(fault('reference_load', '故事神谕原件加载失败'));
      document.head.appendChild(script);
    });
  }
  const started = Date.now();
  while (!globalThis.StoryOracleAPI?.unsafe?.eval) {
    if (Date.now() - started > 60000) throw fault('reference_init', '故事神谕初始化尚未完成，请刷新后重试');
    await host.delay(100);
  }
  disableNativeDiagnosis(host.context());
  return storyAdapter();
}
