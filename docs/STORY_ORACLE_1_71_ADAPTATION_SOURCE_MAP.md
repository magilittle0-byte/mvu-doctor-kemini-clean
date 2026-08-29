# Story Oracle 1.71 adaptation source map

Reference snapshot: `story-oracle-upstream` commit `661f9f89446de473ace70a590897ca5065bc2efe`.

This document records mechanism provenance. It does not claim that the Doctor UI or runtime was copied from Story Oracle. The Doctor keeps ownership of MVU repair, complete actor profiles, private world continuity, recall projection, transactions, diagnostics and per-chat persistence.

## Mechanism map

| Concern | Story Oracle evidence | Doctor implementation | Reuse class | Compatibility decision |
| --- | --- | --- | --- | --- |
| Bind work to the reply that triggered it | `index.js` `maybePostReply`, `fixCaptured`, `fixTargetStale`; chat id, target index, swipe id and content fingerprint are checked again before applying | `index.js` generation session pins, `validateSessionTarget`, reply checkpoint and target re-read | Minimal adaptation | Kept the invariant, adapted it to the Doctor's sequential variable/profile/world transaction instead of Story Oracle's correction swipe |
| One post-reply writer | `index.js` `maybePostReply` runs correction and diagnosis under one shared post-reply lock | `index.js` `runDoctor` owns the ordered MVU -> profile -> world commit chain | Direct mechanism reuse | Prevents multiple asynchronous modules from racing to rewrite one reply or persist incompatible state |
| Cancel on chat/target change | `cancelPostReply`, chat-change cancellation and apply-time stale guard | `cancelCurrent`, epoch/session cancellation and chat/swipe checkpoint restore | Minimal adaptation | Doctor cancellation also invalidates model routing and recovery tasks without fabricating progress |
| One focused MVU diagnosis | `DIAGNOSE_SYSTEM_PROMPT`, `buildDiagnosePromptFrom` and `runAutoDiagnose` pass active rules, current state, final reply/update and recent dialogue to one model call | `index.js` `auditVariables`; `core.mjs` `parseVariableDoctorOutput`, `normalizeVariableOperations` | Direct mechanism reuse | The model owns semantic judgment; Doctor minimally adds the previous-floor replay baseline so its one result can replace the whole turn block without stacking delta operations |
| Tolerant block extraction | `extractUpdateBlock` accepts surrounding prose, code fences and tag case, then delegates patch semantics to official `Mvu.parseMessage` | `core.mjs` additionally performs the old Doctor/Baibai-style deterministic JSONPatch repairs before the official parser | Minimal adaptation | Story Oracle itself does not provide a complete local JSON repairer; only unambiguous format recovery is attributed to it |
| Official MVU application and visible refresh | `autoApplyFix` uses `Mvu.parseMessage -> replaceMvuData`, while `refreshMessageBar` separately rebuilds the visible message; it has no persistence readback | `auditVariables` replays the complete block through official MVU, adds old Doctor WAL/readback/rollback, then calls `updateMessageBlock -> MESSAGE_UPDATED` | Minimal adaptation | UI refresh is not treated as persistence proof; refresh failure becomes a visible warning without undoing confirmed data |
| Undo and recoverable failure | Story Oracle retains original swipe and exposes undo/select-original behavior | Variable transaction snapshots and `undoLastVariableRepair`; reply checkpoints restore profile/world state on reroll | Minimal adaptation | Doctor restores only paths/state owned by the failed transaction instead of replacing an entire user reply |
| Outcome-led frontend | Story Oracle groups settings, exposes current activity, cancel/retry actions and readable correction outcomes in `buildWindow`/`bindControls` | Doctor's own UI: conclusion hero, four-stage rail, profiles, private world, recovery and unredacted evidence export | New UI with adapted interaction mechanisms | No Story Oracle HTML or visual styling copied; only viewport, touch-target and refresh patterns are adapted |

## Intentionally not reused

- Story Oracle's side-chat, lorebook authoring, story-arc editor, waypoint generation and prose-correction modes are outside the Doctor's ownership.
- Its correction-as-new-swipe behavior is not used for MVU transactions; the Doctor must preserve the accepted narrative and repair only the structured update block/state.
- Its view hierarchy and CSS were not copied. The Doctor needs first-class actor archive, private continuity, connection, persistence and diagnostic surfaces that Story Oracle does not own.
- Its variable-diagnosis prompt structure is reused only for the variable task. Profile completion and the anti-omniscience world engine retain their separate prompts and authority boundaries.

## New Doctor-specific work

- A four-stage progress model for recall, MVU, complete profiles and private world progression.
- Complete-profile and private-world readers tied to persisted chat state rather than transient model output.
- A single global custom-model adaptation prompt entry and one connection surface.
- Plain-language failure impact, retry, targeted manual MVU recheck, undo and full local report export.
- A previous-floor complete-turn replacement block, latest profile-root preservation, actual-difference WAL, target-bound readback, path-level rollback and honest `model_reported_nochange` reporting, which Story Oracle itself does not provide.
