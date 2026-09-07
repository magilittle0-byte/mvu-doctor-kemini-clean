# Phase 1: preserve ownership for missing declared fields

## Source mapping

- Reused `modular/variables/core.mjs`'s `expandPath`, `ownershipSubjects`, `compileOwnership`, `overlaps`, `insertLeaves`, and `checkOwnership` chain. The existing candidate matching remains scoped to each declared path and its current siblings; ancestor and nested insert checks were left intact.
- Read `tests/modular-variables.test.mjs` ownership/group cases, `docs/modular/PHASE1_OWNERSHIP_SUBJECT_FIX.md`, and the relevant complete functions in `vendor/story-oracle-v1.35.4/index.js`: `getSettings`, `diagPickerActive`, `buildDiagSelectedWi`, `collectMvuUpdateRules`, and the native diagnose assembly/send path. Story Oracle supplies world-book selection, prompt assembly, and connection routing; the inspected vendor functions do not compile MVU field ownership or protect absent declared paths.
- Independent review repeated the ownership-function search across `mvu-auto-doctor-reference-archive`, `tauritavern-system-knowledge-archive`, `mvu-integration`, and the pinned vendors. The complete `pathHasReadonlySegment` in `mvu-auto-doctor-reference-archive/01-doctor/latest/core.mjs` protects underscore-prefixed segments, which this module already supports; it does not interpret the card's scoped ownership declarations. The complete `validateReadOnlySql_ACU` and `hasMultipleStatements_ACU` in `tauritavern-system-knowledge-archive/checkpoints/2026-07-23_database-history-v4/database-patches-v4/shujuku-spv8.4-index.test-fixture.js` validate SQL query permissions rather than MVU JSON-pointer ownership. Neither is a compatible replacement for this missing-field defect; no database or vendor code is changed.
- New code is limited to retaining each explicitly declared expanded path as an ownership candidate even when its current value is missing. It does not infer paths from free text, widen ownership by leaf name, or alter enemy/NPC same-name fields.

## Defect and boundary

Previously, `compileOwnership` skipped a rule section unless at least one expanded path already existed in `state`. For a partially missing wildcard declaration, only present leaves could become candidates; for an all-missing declaration, no ownership was compiled. The smallest safe correction keeps the declared paths available for the existing subject matcher. Value presence remains relevant only to discovering existing sibling/container outputs.

The regression covers a named partially missing `AGI` leaf, a wholly missing declared `装备.槽位` path, anonymous `此变量` declarations, nested insert and ancestor replacement, both move directions with exact `ownerPath` assertions, and an undeclared same-name enemy path remaining writable. These checks are controlled tests only and do not constitute real Tavern acceptance.
