# P2 unmatched opening JSON fence: source map — 2026-09-20

## Scope and evidence boundary

This is a read-only source audit for the narrow parser edge case reported by Root: a single opening Markdown JSON fence with no closing fence, followed by a complete JSON body. The audit searched the current candidate, earlier doctor sources, the testing checkout, and the NPC Tracker reference. It did not access the host, model, user data, private response text, or modify code.

Root reports two separate observations. In the real candidate.9 sequence 2 response, removing the unmatched opening fence for a local check leaves a JSON body that parses but fails the later `discovery_evidence_unbound` validation. A separate synthetic structured-output probe returned a synthetic `{ "ok": true }` JSON body with an unmatched opening fence; the host's `extractJsonFromData` path produced `{}`. These are not the same response. The real sequence 2 observation means fence normalization would expose the downstream evidence error, not semantic recovery or acceptance.

## Audited candidate.9 path

In [`profiles/content.mjs`](../../profiles/content.mjs), `stripCodeFence` at lines 9–12 strips a fence only when both the opening and closing delimiters match the whole input. `parseJsonResponse` calls it at lines 70–75, then `parseJsonCandidate` applies JSON parsing. The P2 entrypoint `parseProfileTurn` at lines 350–354 explicitly uses `parseJsonResponse(raw, { extract: false })`; it then validates the exact top-level contract and delegates source evidence, identity, and existing-profile checks to `parseDiscovery` (lines 362 onward). Thus the unmatched wrapper currently prevents the strict P2 envelope checks from seeing an otherwise parseable object.

In [`profiles/runtime.mjs`](../../profiles/runtime.mjs), the one `profile-turn` result is passed directly to `parseProfileTurn` after `call(...)` (around lines 247–253). A parser failure is recorded by the existing outer failure path (around lines 333–349). There is no second parse or retry at this callsite. Root’s reported manual retry is also bounded to one request.

## Existing independent fence-removal precedents

- The current candidate’s [`profile-engine.js`](../../profile-engine.js) has a direct lexical precedent in the Story Oracle JSONPatch path around lines 1724–1728: it removes an opening fence with one anchored replacement and a closing fence with a separate end-anchored replacement. The path first enforces exactly one enclosing `<JSONPatch>` block, then uses the normalized body for the exact empty-array check; non-empty patches continue through the existing MVU parser. This is a narrow fence-removal primitive, not a P2 JSON parser.
- [`mvu-auto-doctor-testing/index.js`](../../../mvu-auto-doctor-testing/index.js) has `stage3ParseWorldTargetedRepairOutput` around lines 25563–25572. It removes the opening and ending fences separately, tries `JSON.parse` on the whole remaining text, and only then falls back to `extractFirstBalancedJsonObject`. The prefix-removal plus whole-body parse is the closest strict parsing precedent. The later balanced-object fallback is unsafe for P2 and must not be copied; P2 must keep `extract:false`.
- The historical [`core.mjs`](../../core.mjs) `stripJsonFence` around lines 141–147 independently strips optional opening and closing fences. Its direct `parseJsonWithLocalRepair` caller around lines 207–255 then performs punctuation repair and further local salvage. The lexical operation is relevant, but the surrounding repair behavior is not suitable for P2.
- The NPC Tracker reference [`scripts/api.js`](../../../.codex-p0-reference-npc-tracker/scripts/api.js) `extractJson` around lines 28–44 first accepts direct JSON, then only extracts a *closed* fence, then tries the substring from first `{` to last `}`. It offers no safe unmatched-fence handling and its substring fallback is broader than P2 permits.

These searches found no mature P2 parser already accepting an unmatched opener while also preserving an exact whole-response parse boundary. The safe reusable mechanism is only the separate anchored delimiter removal followed by `JSON.parse` of the entire post-prefix text.

## Minimal compatibility boundary and tests

If implemented, add one unmatched-opening-fence branch to `stripCodeFence`: recognize exactly one opening fence, optionally labeled `json`, at the first non-whitespace position; remove only that prefix; and return the suffix only when `JSON.parse(suffix)` succeeds on the entire suffix. Keep the existing paired-fence behavior unchanged. Do not search for a balanced inner object, remove arbitrary prose, append a missing brace/value, normalize field shape, or change P2's `extract:false` option. The branch should only normalize transport decoration around an already complete JSON value; all existing profile-turn, evidence, identity, and materialization checks remain untouched.

Bounded regression cases should prove:

1. Existing complete fenced JSON still parses.
2. A single unmatched opening fence followed by a complete JSON value parses to exactly the same value, with no invented keys or values.
3. An unmatched opening fence followed by truncated JSON still fails with `profile_turn_invalid`.
4. An unmatched opening fence followed by valid JSON plus trailing prose still fails.
5. A malformed outer response containing a balanced nested object is not salvaged under `extract:false`.
6. Root’s reported downstream case remains rejected as `discovery_evidence_unbound` after lexical normalization; this is a parser diagnosis correction, not semantic acceptance.

## Limits

No tests were run because this task was a source audit. The cited historical paths demonstrate local patterns, not a guarantee that the P2 model output is semantically valid. Root’s sanitized live observation is the only stated evidence that the unmatched-fence case occurred on this candidate; it does not change the real acceptance or semantic-pass status.

## Implementation

Candidate.10 implements only the complete-body unmatched-opening-fence branch. Prompts, transport, P1/P3, vendor and persistence code are unchanged. The real sequence 2 source-binding error remains a failure. Current-fingerprint real acceptance is pending.

The current local profile suites pass 80 tests. A RAM-only check of the prior sequence 2 response with this parser preserves discovery_evidence_unbound and saves no profile. Neither check counts as current-fingerprint real acceptance.
