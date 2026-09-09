# P3 isolated native engine source map

`world/engine.mjs` is a local, non-durable composition layer over the four exact-source native factories. It does not install anything on `globalThis`, load `world-engine.js`, create a scheduler, or add a second MVU writer.

| Area | Source and adapter |
|---|---|
| Core state | `world/native/core.mjs`; local `WORLD_ENGINE_STORE` is a synchronous `Map` facade. `getChatId`/`getChatLayer` are supplied by the local `SillyTavern.getContext()`. Native checkpoint, fingerprint, merge, caps and save paths remain unchanged. |
| Evolution | `world/native/evolution.mjs`; `evolve(state, userMsg, aiMsg, { mode: 'forward', dialogueText })` is called once. `WORLD_ENGINE_API.callApi` forwards the native prompt and abort signal to `callModel(prompt, signal)`. Native local rolls, parsing, caps, blackbox replacement, rollback and running guard remain in the source factory. |
| Rules | `world/native/rules.mjs`; native `getAllRulesText()` is preserved and the caller's `rulesText` is appended through a facade. No semantic rule interpreter is added. |
| Worldbook/input | Local `WORLD_ENGINE_WORLDBOOK.buildPromptSection()` serializes the complete supplied input (narrative, user text, MVU, profiles and authority) once into the native worldbook prompt segment. Native `dialogueText` contains only the ordinary user/AI narrative fields, avoiding duplicate full-profile injection. |
| Actor instruction | `MVUDoctorProfileEngine.buildWorldActorInstruction()` returns only the caller's instruction. It does not write state. |
| Ledger | `world/native/ledger.mjs` uses the same local core and records native event/wind changes against checkpoint. It is not an actor-attempt ledger. |
| Lifecycle | `abort()` delegates to native evolution; external `signal` is bridged to that abort controller. `dispose()` prevents another evolve call and removes the listener. |

The API facade captures the native working state at the actual `WORLD_ENGINE_API.callApi` entry, after native local rolls and immediately before `callModel`; it records only `round`, event id/stage/stageRound/evolveResult, and regional/distant/near program state. Model output is never labelled as dice evidence. After a successful native evolve, the mature `world-engine.js` order is preserved by calling `ledger.recordChanges(state)` once, so checkpoint-backed event/wind changes can enter native memories. The engine returns a cloned native state and redacted structured debug; native prompt/raw response/segment text is never returned or logged by this layer. Input JSON serialization failure is a fixed error, never a partial placeholder. Settings are fixed locally with `apiAutoRetries: 0`; caller input cannot override native retry policy. Storage is process-local and disappears with the engine instance. This is controlled offline composition evidence, not real-host acceptance.
