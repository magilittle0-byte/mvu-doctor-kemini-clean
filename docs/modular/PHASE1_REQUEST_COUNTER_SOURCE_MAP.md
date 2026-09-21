# Phase 1 per-generation request counter source map

## Scope and observed path

The reported case is a later main generation whose accepted final body is an upstream error reply. In `modular/runtime.mjs`, `finish()` recognizes that reply at line 75 and publishes `host_generation_error` at line 76 before it writes an `accepted` pending record or calls `run()` (lines 78–81). The failure state is merged into the previous state, so it retains the prior generation's `requestCount`.

`started()` filters dry runs, quiet/silent/raw events and unsupported generation types before creating a ticket (lines 86–92). For accepted generation events it publishes `waiting` at line 93 without resetting `requestCount`. The UI renders the value as “本次变量诊断请求” in `modular/ui.mjs:38`, making a previous turn's count visible as the current turn's count. This is a display/snapshot accounting defect; the early host-error branch does not call the variable module and does not make a Doctor model request.

## Search performed

Fresh repository-wide filename/content search covered `.mjs` and `.js` files, excluding `node_modules`, `.git`, and `private-assets`, for `requestCount: 0`, `requestCount = 0`, `modelCalls: 0`, `host_generation_error`, and `本次变量诊断请求`. Relevant hits included the current Kemini Clean P1 runtime/UI/module, the current profile runtime, historical Kemini snapshots, the `mvu-auto-doctor` reference archive and 2.0 testing line, the v1.8 hotfix, and read-only deployment copies. No deployment copy is used as an implementation source.

## Relevant implementations read

- `modular/runtime.mjs`: generation filter/ticket creation (`86–94`), accepted-final/error detection (`56–84`), request-run initialization (`14–27`), cancellation and state merge (`8–12`). The true error branch runs before the per-run reset.
- `modular/ui.mjs`: visible request counter label and rendering (`8`, `34–40`).
- `modular/variables/module.mjs`: a fresh local `requestCount = 0` is created for each `run()` (`32–42`); the value increments immediately before the direct/profile model dispatch (`176–193`). This confirms actual model-call accounting is already per invocation.
- `profiles/runtime.mjs`: its current P2 `execute()` publishes `waiting` with `requestCount: 0` before work (`160–192`) and reports actual calls from its per-run request list (`179–189`). This is a useful lifecycle precedent, but its receipt/request ownership is different, so its code is not transplanted.
- `mvu-auto-doctor-reference-archive/01-doctor/latest/actor-profile-batch-core.mjs`: output base starts at `modelCalls: 0` (`622–637`), the active invocation has a fresh local counter (`670–676`), and only a completed `requestBatch` or an exception carrying `requestStarted: true` increments it (`852–889`). Failed and successful result paths return that invocation's count (`1614–1688`, `2269–2285`). Corresponding tests distinguish requests that started from those that did not (`tests/actor-profile-batch-p1.test.mjs:4438–4555`). This corroborates per-operation counting, but is not a direct state-transition implementation for P1.
- `tests/modular-variables.test.mjs`: runtime tests cover accepted-final timing, settings/manual retry, stale targets, cancellation and regenerate lifecycle (`1017–1160`), but do not cover an earlier count of one followed by a new generation that exits through `host_generation_error`.

## Minimal adaptation and regression boundary

Reset only the P1 visible per-generation counter when a supported, non-dry generation event has passed the existing filter and transitions into `waiting`; keep the existing actual-call reset and one-call limit in `run()`/the variable module. Do not change error classification, retry behavior, native generation accounting, or event filters.

Add one synthetic two-generation regression: complete a first accepted reply whose variable runner reports one actual request; start a new supported generation and assert `waiting` shows zero; deliver an upstream error final and assert `host_generation_error`, zero requests, no second variable invocation, and no additional store writes. Exercise both `normal` and `swipe` event types without using private text or a live host.

## Local validation and acceptance boundary

The new normal/swipe regression first failed against the previous runtime with a retained count of one, then passed after the single waiting-state reset. The seven suites declared by `package.json`'s `test` script passed in two non-overlapping runs: 111 modular/lock/version checks and 19 reference/vendor checks, 130 total. `scripts/check-modular.mjs` passed syntax and JSON checks for all 17 fingerprinted runtime files.

An additional `tests/ui-contract.test.mjs` run has 26 failures against the legacy single-file `index.js` UI contract. That suite reads `index.js`, `style.css`, and the manifest; the legacy files and the manifest's modular entry selection were already unchanged at the parent candidate. It is outside the declared test script, and its failures are retained as a validation limitation rather than represented as passing.

Release metadata is advanced to 0.10.32 / variable module candidate.33 so the new source cannot inherit prior runtime acceptance. No P1 lock is created and no P2/P3 dependency lock is changed. These local checks do not prove real Tavern acceptance, fix an upstream stream interruption, or complete the three-module performance goal. The current candidate remains unaccepted until its own required real workflow succeeds.
