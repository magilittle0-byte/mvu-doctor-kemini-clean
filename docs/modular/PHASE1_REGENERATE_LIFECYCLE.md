# Phase 1: preserve the regeneration ticket during the host's initial deletion

## Evidence and source mapping recorded before the change

The real host started a `regenerate` generation while the installed 0.10.10 Doctor returned to idle instead of checking the replacement reply. The old round probe's `endedAt` is a one-shot measurement and cannot establish whether this later generation emitted its end event.

The live host's public `/script.js` source has SHA-256 `95f31bdacefaabcba7bae51ca5a0839de141753f86de56fffa0b183dbe87ca09`. Its native `GenerateInternal` emits `GENERATION_STARTED` at line 5070, then its regenerate branch removes the old assistant reply and emits `MESSAGE_DELETED(chat.length)` at lines 5170–5185. The emitted index equals the removed reply's former index and the new chat length. Doctor `modular/runtime.mjs` previously cancelled every deletion and then called `restore`, discarding the ticket just created by that start event. Doctor's `host.latestIndex()` skips user/system messages, so it cannot represent the truncated array length. The complete local host context, latest-index, capture and identity chain was also read; the deletion guard must use the actual chat array length.

The project-wide lifecycle search covered archived Doctor, database patches, official MVU, Life State, NPC tracker, Story Oracle and world-memory code. The relevant implementations and their surrounding callers were read:

| Source | Existing mechanism | Reuse or incompatibility |
| --- | --- | --- |
| Native host `/script.js`: `Generate`, `GenerateInternal`, `deleteLastMessage`, `saveReply`, `swipe`, regenerate button | Native generation/deletion ordering and reply indices | Host behavior is unchanged; Doctor adapts to its event contract. Tool cleanup can also delete messages later and is outside the initial-deletion exception. |
| `mvu-auto-doctor-reference-archive/02-reference-code/database-patches/src/runtime-body.js` | `installDeletionRecoveryGuard`, host connection and bootstrap; scoped generation tokens and deletion recovery | Its recovery writes database-owned snapshots and cannot restore a Doctor generation ticket. Do not transplant its writes or timeouts. |
| `vendor/life-state-v5.35/life-state-v5.35.js` | Complete `enqueueMessage`, `registerHostEvents` and branch rebuild scheduling | These own a received-message queue, not Doctor's START/END final-reply ticket. Vendor remains unchanged; no parallel queue is introduced. |
| `mvu-auto-doctor-reference-archive/02-reference-code/npc-tracker/scripts/host.js` | Host context and event subscription helpers | Subscription boundary is already provided by Doctor's host adapter; no replacement is needed. |
| `modular/runtime.mjs` | Start ticket, cancellation epoch, final fresh reads, pending record, variable execution and restore | Reuse this complete chain. Only the existing deletion subscription gains a private conditional handler. |

## Minimal adaptation

Preserve one expected initial deletion only when an active `regenerate` ticket is in the same scope, has neither received a replacement nor ended, has not already consumed that deletion, and both the deleted index and current chat length equal the original assistant index. All other deletions retain cancellation and restore. This is an event-boundary adaptation, not a new state machine or an MVU patch executor.

Generation end plus a received index, the 500 ms wait, second fresh read, identity checks, pending persistence and official MVU transaction remain unchanged. Native swipe reports `MESSAGE_SWIPED` before `GENERATION_STARTED('swipe')`; it receives no deletion exemption. Later tool cleanup is not broadly exempted. The host provides no origin tag to distinguish two events with exactly identical scope, timing and indices; the exception is deliberately one-time and narrow.

## Validation boundary

Controlled tests exercise the actual registered event handlers and production `createHost` over a synthetic chat array: initial regenerate deletion followed by replacement receipt/end, cancellation on unrelated, repeated or late deletion, normal/continue deletion, scope change, explicit stop, and native swipe ordering. They verify the replacement target, exactly one variable run, accepted pending persistence and final-read delay, with no tests-only runtime API. An initial test double incorrectly treated latest assistant index as chat length; Luna's review caught that mismatch, and the corrected harness uses the real adapter instead.

These checks cannot establish model semantic correctness or real Tavern acceptance. Earlier equipment/relationship omissions remain rejected. This candidate needs a new fingerprint and a fresh twelve-reply real-host run before the variable module can be locked. Profiles and world remain unimplemented.
