import { installNativeCore } from './native/core.mjs';
import { installNativeEvolution } from './native/evolution.mjs';
import { installNativeRules } from './native/rules.mjs';
import { installNativeLedger } from './native/ledger.mjs';
import { parseJsonResponse } from '../profiles/content.mjs';

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const quietConsole = Object.freeze({
  log() {}, info() {}, warn() {}, error() {}, debug() {}, trace() {},
});

function json(value) {
  try {
    const encoded = JSON.stringify(value ?? null, null, 2);
    if (typeof encoded !== 'string') throw new Error('not_string');
    return encoded;
  } catch {
    throw Object.assign(new Error('world_input_unserializable'), { code: 'world_input_unserializable' });
  }
}

/**
 * Construct one isolated native World Engine. The supplied window is a local
 * facade object; this function never mutates globalThis or performs durable IO.
 */
export function createNativeWorldEngine({
  world = null,
  chatId = 'local-world',
  chatLength = 1,
  callModel,
  rulesText = '',
  input = {},
  signal = null,
  instruction = '',
} = {}) {
  if (typeof callModel !== 'function') throw new TypeError('callModel must be a function');
  const memory = new Map();
  const localWindow = {};
  const localConsole = quietConsole;
  const serializedInput = json(input);
  const localChat = Array.from({ length: Math.max(1, Number(chatLength) || 1) }, () => ({}));
  const localSillyTavern = Object.freeze({
    getContext: () => ({ chatId: String(chatId), chat: localChat }),
  });
  localWindow.SillyTavern = localSillyTavern;
  localWindow.WORLD_ENGINE_STORE = {
    getItem: key => memory.has(String(key)) ? memory.get(String(key)) : null,
    setItem: (key, value) => { memory.set(String(key), String(value)); },
    removeItem: key => { memory.delete(String(key)); },
  };

  const settings = Object.freeze({
    apiAutoRetries: 0,
    apiTimeoutMs: 0,
    localCapBlackbox: 12,
    localCapEvents: 16,
    localCapFactions: 15,
    localCapWorldTrends: 4,
    localCapWinds: 12,
    localCapEnemies: 8,
    localCapInfluence: 12,
    localCapEconomySignals: 8,
    localLedgerKeepRounds: 20,
    tonePrompt: '',
  });
  localWindow.WORLD_ENGINE_API = {
    getSettings: () => settings,
    parseJSON: raw => parseJsonResponse(raw),
    callApi: (prompt, _unusedA, _unusedB, apiSignal) => {
      localStateBeforeModel = captureProgramState(activeState);
      return callModel(prompt, apiSignal);
    },
  };
  localWindow.WORLD_ENGINE_WORLDBOOK = {
    getChatId: () => String(chatId),
    buildPromptSection: async () => [
      'P3完整输入（正文、MVU、完整P2档案、权威设定）：', serializedInput,
    ].join('\n'),
  };
  localWindow.WORLD_ENGINE_PRESET = { getOverrides: () => null };
  localWindow.MEMORY_ENGINE = { buildWorldEngineContext: () => '' };

  installNativeCore(localWindow, localSillyTavern, localConsole);
  installNativeRules(localWindow, localSillyTavern, localConsole);
  installNativeLedger(localWindow, localSillyTavern, localConsole);
  localWindow.MVUDoctorProfileEngine = {
    buildWorldActorInstruction: () => String(instruction || ''),
  };
  localWindow.DOCTOR_PROFILE_ENGINE = localWindow.MVUDoctorProfileEngine;
  const nativeRules = localWindow.WORLD_ENGINE_RULES;
  localWindow.WORLD_ENGINE_RULES = {
    ...nativeRules,
    getAllRulesText: () => [nativeRules.getAllRulesText(), String(rulesText || '')].filter(Boolean).join('\n\n'),
  };
  installNativeEvolution(localWindow, localSillyTavern, localConsole);

  const core = localWindow.WORLD_ENGINE_CORE;
  const evolution = localWindow.WORLD_ENGINE_EVOLUTION;
  if (world && typeof world === 'object' && !Array.isArray(world)) {
    memory.set(`world_engine_${String(chatId)}`, JSON.stringify(clone(world)));
  }
  let disposed = false;
  let activeState = null;
  let localStateBeforeModel = null;
  let abortUnsubscribe = null;
  if (signal?.addEventListener) {
    const onAbort = () => evolution.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    abortUnsubscribe = () => signal.removeEventListener?.('abort', onAbort);
  }

  function captureProgramState(state) {
    return {
      round: Number(state?.round || 0),
      events: clone((state?.events || []).map(event => ({
        id: event.id, stage: event.stage, stageRound: event.stageRound, evolveResult: event.evolveResult,
      }))),
      regionalIncident: clone(state?.regionalIncident || null),
      distantEvent: clone(state?.distantEvent || null),
      nearEvent: clone(state?.nearEvent || null),
    };
  }

  function debugState(state) {
    return {
      round: Number(state?.round || 0),
      localStateBeforeModel,
      nativeProgramStateAfter: {
        regionalIncident: clone(state?.regionalIncident || null),
        distantEvent: clone(state?.distantEvent || null),
        nearEvent: clone(state?.nearEvent || null),
      },
      running: evolution.isRunning(),
    };
  }

  async function evolve() {
    if (disposed) throw new Error('world_engine_disposed');
    if (signal?.aborted) throw Object.assign(new Error('world_engine_aborted'), { name: 'AbortError' });
    const state = core.loadState();
    activeState = state;
    localStateBeforeModel = null;
    const userText = String(input?.userText ?? '');
    const narrative = String(input?.narrative ?? '');
    const dialogueText = `用户：${userText}\nAI：${narrative}`;
    const ok = await evolution.evolve(state, userText, narrative, {
      mode: 'forward',
      dialogueText,
    });
    if (ok === true) localWindow.WORLD_ENGINE_LEDGER.recordChanges(state);
    const after = core.loadState();
    const debug = debugState(after);
    activeState = null;
    return Object.freeze({
      ok: ok === true,
      state: clone(after),
      debug,
      error: ok === true ? null : String(evolution.getLastError?.() || 'native_evolve_failed'),
    });
  }

  function abort() { evolution.abort(); }
  function dispose() {
    if (disposed) return;
    disposed = true;
    abort();
    abortUnsubscribe?.();
    abortUnsubscribe = null;
  }

  return Object.freeze({
    evolve,
    abort,
    dispose,
    state: () => clone(core.loadState()),
    isRunning: () => evolution.isRunning(),
    store: memory,
    window: localWindow,
  });
}
