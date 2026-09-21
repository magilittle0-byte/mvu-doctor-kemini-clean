# P1 frontend settlement before diagnosis

2026-09-21. Required compatibility fix during the single-call performance test. This document precedes production changes and is not acceptance evidence.

## Observed failure

The frozen 0.10.30 variable module encountered two consecutive normal frontend consumption transitions: an explicitly frontend-owned log array became empty after the card rendered. All other MVU payload fields were equal. One failure occurred before any Doctor request; the next after one P1 response, preventing P2 from running. An actual manual repair of the first failure recaptured the cleared snapshot and completed. The live card timer and caller were inspected locally; private material remains outside the repository. This recurring coordination issue justifies reopening P1. It is separate from unrecovered model content errors in P2.

## Fresh source search and full reads

Root and Luna searched the current modular files, old Doctor testing/hotfix, reference archive (Doctor, database, Story Oracle, NPC Tracker and associated material) and prior diagnostics for MVU idle/stable waits and frontend clearing. Root read the complete current variable run/assert/model/parse/commit path, runtime scheduling/retry, host capture/official candidate/readback, ownership compiler/checker, and the relevant variable tests.

| Data path | Existing source | Reuse | Minimal adaptation |
|---|---|---|---|
| Delayed frontend writes before diagnosis | `mvu-auto-doctor-v1.8-hotfix/index.js`, `runTarget` at 9333-9402 and `waitMvuStable` at 6705-6722 | Automatic startup grace of 1600 ms, bounded stable reads at 250 ms, three repeated matches, 8000 ms stability cap | Use the already-bound target, complete MVU payload equality and abort-aware host delay. Assert target around every read/wait; never use mutable `latest`, fallback to another message or continue on instability. |
| MVU extra analysis | `vendor/story-oracle-v1.35.4/index.js`, complete `mvuIsBusy`, `awaitMvuIdle`, `maybePostReply`, `runAutoDiagnose`, `autoApplyFix` at 7324-7466 | Existing MVU busy wait and module's exact target reader | Busy is not a frontend timer completion event. Add snapshot settlement before selecting the diagnosis baseline. Do not replace the strict P1 commit checks with native latest-message application. |
| Baseline and ownership | `modular/variables/module.mjs`, `core.mjs`, `modular/host.mjs` | Full-payload checks after model/parse and before writes; configuration, schema, previous-MVU, target checks; official execution receipt, all ownership and durability checks | The only changed baseline is the fresh snapshot obtained before the single model request. No protected-field exclusion, ignored drift, post-response rebase or model retry. |
| Local verification | `tests/modular-variables.test.mjs` harness and existing stale/ownership tests | Controlled exact-target reads and callbacks, existing negative invariants | Add delayed frontend consumption before model, instability with zero calls/writes, target/cancel during wait, and real drift during model still failing. Synthetic checks are not real acceptance. |

## Candidate boundary

Automatic diagnosis waits the mature 1600 ms startup grace after MVU becomes idle, then requires three repeated equal complete snapshots at 250 ms intervals within an 8000 ms local stability window. A changing snapshot restarts the stable-read count; if extra MVU analysis resumes, no stable result is accepted while busy. Manual diagnosis retains the stable-read gate and may skip the automatic startup grace. The snapshot returned by this gate becomes `before`; no earlier snapshot is later written back.

This adds a small bounded local wait, not another model call. It cannot guarantee that arbitrary external scripts never write later; the existing strict guards still reject such changes. P1's old lock/evidence remain historical and must not be rebound as acceptance for new bytes. The new P1 candidate must be genuinely tested and locked before P2/P3 are enabled against it. No private text, user card edits, model route changes, global concurrency mechanism or storage migration is included.

Root also read the complete current lock loader/validator, fingerprint builder, lock tests, version consistency test, active entry and manifest/package declarations. They already represent a missing active phase-1 lock as an ordinary unlocked candidate. Archive the three exact 0.10.30 lock files under `locks/history/phase1-0.10.30/` with byte verification, then remove only their active copies. Advance the P1 manifest/package/entry version to 0.10.31 and its independently numbered core module version from 1.0.0-candidate.31 to candidate.32. Keep P2/P3 dependencies pinned to their old upstream until new real P1 acceptance exists, so they cannot falsely start against unaccepted P1. The validators themselves are unchanged.
