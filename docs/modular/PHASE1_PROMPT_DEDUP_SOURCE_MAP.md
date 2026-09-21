# Phase 1 exact prompt deduplication

## Evidence and scope

The preceding real-host batch ended incomplete after repeated main-model refusals and an incomplete reply. No semantic acceptance or new module lock was granted. A read-only inspection of its final P1 request found a 145,447-character user message: one complete 13,558-character rule block occurred twice, and the previous/current state JSON strings were byte-identical at 12,069 characters each. These are character counts, not token savings or latency results. No private content is included here.

Before implementation, a fresh workspace search covered the previous Doctor implementations, Story Oracle, database/table templates, LifeState, Tangtang, Izumi, stitching scripts, Z-forum, card/worldbook/regex sources, and diagnostic/K3 report paths. Relevant implementations were read along their actual call chain. The local detailed source map is `deliverables/P1提示输入去重来源映射_2026-09-21.md` in the parent workspace. No live model call was used for this audit.

## Reuse and minimum adaptation

- `vendor/story-oracle-v1.35.4/index.js`: `collectMvuUpdateRules` (2401), `stripMvuRuleContents` (2411), `runAutoDiagnose` (7384) and `buildDiagnosePromptFrom` (12971). Its content-exact rule matching is minimally adapted to the current producer's `\n\n`-delimited appended rule block, already preserved in the independent rules section. No fuzzy comparison, rule summary or worldbook filtering is introduced.
- `modular/variables/module.mjs`: the existing `readRules`, `readWorldContext`, snapshots, ownership compiler, source hashes, review messages, manual repair, one-request limit and official MVU commit/readback stay unchanged.
- `modular/variables/prompt.mjs`: extend the existing final world-context projection used for the database wrapper. Only a complete rule block at the end of a larger background, preceded by the producer's two-newline delimiter, becomes an explicit reference to the unchanged complete rule section. If the whole world block equals the rules block, keep both sections as before, preserving selected mixed materials and equal fallback blocks. Similar, partially matching, embedded-in-prose and non-tail content is retained.
- `modular/variables/prompt.mjs`: serialize both states with the existing JSON format. Only byte-identical serializations share one complete current-state rendering, with the previous-state label explicitly declaring equality. The reference says equality does not prove the state is semantically correct. Missing, different or differently ordered serializations keep the existing representation. This small presentation adapter is new because the reference builder has only one state slot; importing that builder would discard this module's separate prior-state evidence.
- `modular/transcript.mjs`, Story Oracle `buildTranscriptTurns`, and LifeState `getRecentExternalContext` retain their window and regex-depth semantics. The observed five-character current-input duplication is deliberately not changed.

No history, card, schema, state path, protected path, coverage list, final narrative or user input is truncated. The raw source hashes continue to identify original evidence; review messages identify the actual projected request.

Before the final narrowing, independent diff review identified that global substring replacement would also replace a coincidental occurrence inside prose. A fresh search of current modular code, the pinned vendor and archived Doctor code reconfirmed the actual producer in `readWorldContext`: `[world, ...missing].filter(Boolean).join('\n\n')`. The adapter therefore matches only its complete suffix and preserves every other occurrence. This is a conservative presentation boundary, not a new worldbook parser. No live failure or model call was used to justify the refinement.

## Verification and acceptance boundary

Focused controlled checks cover complete rule preservation, surrounding world facts, near matches, selected equal blocks, identical/different/absent prior state, unchanged source hashes, one request and the existing official write/readback path. They do not prove real gameplay or repair accuracy.

Version 0.10.33 / variable module candidate.34 requires a new real-host batch on its own fingerprint. Prior acceptance cannot carry over. P1 remains unlocked; P2/P3 dependency locks and their runtime code are unchanged. This change does not resolve or conceal upstream refusals, and no timing improvement is claimed before measurement.
