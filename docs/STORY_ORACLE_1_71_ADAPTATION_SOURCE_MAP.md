# Story Oracle 1.71 adaptation source map

Reference snapshot: `story-oracle-upstream` commit `661f9f89446de473ace70a590897ca5065bc2efe`.

This document records mechanism provenance. It does not claim that the Doctor UI or runtime was copied from Story Oracle. The Doctor keeps ownership of MVU repair, complete actor profiles, private world continuity, recall projection, transactions, diagnostics and per-chat persistence.

## Mechanism map

| Concern | Story Oracle evidence | Doctor implementation | Reuse class | Compatibility decision |
| --- | --- | --- | --- | --- |
| Bind work to the reply that triggered it | `index.js` `maybePostReply`, `fixCaptured`, `fixTargetStale`; chat id, target index, swipe id and content fingerprint are checked again before applying | `index.js` generation session pins, `validateSessionTarget`, reply checkpoint and target re-read | Minimal adaptation | Kept the invariant, adapted it to the Doctor's sequential variable/profile/world transaction instead of Story Oracle's correction swipe |
| One post-reply writer | `index.js` `maybePostReply` runs correction and diagnosis under one shared post-reply lock | `index.js` `runDoctor` owns the ordered MVU -> profile -> world commit chain | Direct mechanism reuse | Prevents multiple asynchronous modules from racing to rewrite one reply or persist incompatible state |
| Cancel on chat/target change | `cancelPostReply`, chat-change cancellation and apply-time stale guard | `cancelCurrent`, epoch/session cancellation and chat/swipe checkpoint restore | Minimal adaptation | Doctor cancellation also invalidates model routing and recovery tasks without fabricating progress |
| Distinguish executed update, no update block and dead block | `runAutoDiagnose`, `autoApplyFix` and fix outcome taxonomy distinguish usable operations, nochange and failed parse/application | `core.mjs` `assessVariableBaseline`, `parseUpdateVariableBlock`, `normalizeVariableOperations`; `index.js` `auditVariables` | Minimal adaptation | Replaces the failed AuditReceipt proof ritual with local evidence and honest zero-write outcomes |
| Deterministic local repair before model retry | Story Oracle locally repairs tags, paths, containers, verbs and common MVU patch defects before retrying | `core.mjs` normalizes operation aliases, `/stat_data` roots, duplicate/trailing slashes, numeric delta strings, VWD writes and safe moves | Minimal adaptation | Only unambiguous structural defects are repaired locally; semantic uncertainty remains fail-closed |
| Preflight plus post-write readback | `applyFix`/`autoApplyFix` validate before applying and verify the target after writing | `auditVariables` performs local patch validation, MVU dry-run, target write, fresh readback and touched-path rollback | Direct mechanism reuse | Parse success is never reported as persistence success |
| Undo and recoverable failure | Story Oracle retains original swipe and exposes undo/select-original behavior | Variable transaction snapshots and `undoLastVariableRepair`; reply checkpoints restore profile/world state on reroll | Minimal adaptation | Doctor restores only paths/state owned by the failed transaction instead of replacing an entire user reply |
| Outcome-led frontend | Story Oracle groups settings, exposes current activity, cancel/retry actions and readable correction outcomes in `buildWindow`/`bindControls` | Doctor's total UI rewrite: conclusion hero, four-stage rail, profiles, private world, recovery and unredacted evidence export | Newly written | No Story Oracle HTML or CSS copied; UI is organized around Doctor-specific state ownership and failure semantics |

## Intentionally not reused

- Story Oracle's side-chat, lorebook authoring, story-arc editor, waypoint generation and prose-correction modes are outside the Doctor's ownership.
- Its correction-as-new-swipe behavior is not used for MVU transactions; the Doctor must preserve the accepted narrative and repair only the structured update block/state.
- Its view hierarchy and CSS were not copied. The Doctor needs first-class actor archive, private continuity, connection, persistence and diagnostic surfaces that Story Oracle does not own.
- Its model prompts are not reused because the Doctor's profile completion and anti-omniscience world engine have different schemas and authority boundaries.

## New Doctor-specific work

- A four-stage progress model for recall, MVU, complete profiles and private world progression.
- Complete-profile and private-world readers tied to persisted chat state rather than transient model output.
- A single global custom-model adaptation prompt entry and one connection surface.
- Plain-language failure impact, retry, targeted manual MVU recheck, undo and full local report export.
- Baseline-aware variable auditing that rejects an empty model patch when the original update is demonstrably missing, dead or not reflected in current state.
