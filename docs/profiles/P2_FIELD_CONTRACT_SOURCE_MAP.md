# P2 field-contract clarification source map

Date: 2026-09-21. This 2A map was written before runtime-prompt edits. The review used repository source and history only; it did not access the host, model, private narrative, credentials, runtime logs, or evidence text.

## Data path and ambiguity

P2 emits one `people[]` record from `parseProfileTurn` in [`profiles/content.mjs`](../../profiles/content.mjs). The outer `people[].evidence` is passed to `parseDiscovery`, which requires it to be a non-empty literal substring of the final narrative. The nested `people[].profile.evidence` is one of the 44 profile content fields and is validated later by `validateProfile` as a non-empty list of usable strings. It may describe verified evidence from narrative or authority sources; the validator does not require its list items to be narrative substrings.

The existing source rule in `PROFILE_TURN_INSTRUCTIONS` uses the unqualified word “evidence” for the outer anchor, while the create rule requires a full profile without restating the distinct meaning of its nested evidence list. The old batch prompt already names `profile.evidence` explicitly as a required list, separating it from `task.evidence`. This is a prompt-path ambiguity; no parser or validator defect is shown by these sources.

## Fresh search and complete-source review

Fresh targeted searches covered the current candidate, candidate.5, `mvu-auto-doctor-testing`, prior auto-doctor sources, and the NPC Tracker reference for `profile.evidence`, `task.evidence`, profile output prompts, source anchors, empty-list rules, placeholder rejection, and non-applicable species/construct wording. Relevant matches and their adjacent caller/validator paths were read in full:

- Current [`profiles/content.mjs`](../../profiles/content.mjs): `PROFILE_FIELDS` and `PROFILE_TEMPLATE` define the 44 content fields (36 text and 8 list fields); `validateProfile` defines actual completeness; `parseDiscovery` validates the outer discovery evidence; `parseProfileTurn` constructs the nested create item; `materializeProfile` performs final candidate validation.
- The current `profileBatchPrompt` (same file, around lines 549–562) explicitly says `profile.evidence` is a required non-empty list and distinguishes it from `sourceName/task.evidence/presence`. Its full prompt places the input and row binding before the output contract and full profile template. This is a direct wording precedent; the old batch response shape and IDs are not reused.
- The current `PROFILE_PROMPT_GUIDANCE` and `PROFILE_OUTPUT_INSTRUCTION` (same file, around lines 532–536) separately preserve the full-field requirement and reasonable inferred completion. They do not define `aliases` as the only empty-list exception or tell a non-human entity how to describe an inapplicable field.
- In historical [`actor-profile-v6-core.mjs`](../../../mvu-auto-doctor-testing/actor-profile-v6-core.mjs), `PROFILE_MODULE_NOTES.physiology` (line 347) says inapplicable items must state a species or construction reason. Its prompt-building path passes these module notes into profile generation, and the old MVU/parser path validates the resulting actor candidate. Only the narrow “give a concrete species/construction reason” wording is relevant here; the adult physiology schema, ActorRef/ticket ownership, anchor pipeline, and parser are not being ported.
- Searches of current and historical implementations also found separate source-anchor validators that bind a candidate name to narrative evidence. That mechanism is unrelated to distinguishing two already-existing `evidence` paths and is outside this prompt-only change.

## Local validation contract (unchanged)

`usable()` in current `profiles/content.mjs` rejects empty text, bare placeholder tokens such as `unknown`, `未知`, `none`, `无`, `n/a`, and the listed placeholder words. `validateProfile` requires every text field to be usable, every list field to be an array, and every list except `aliases` to contain at least one usable item. Thus empty `aliases` is allowed; an empty `relationships`, `evidence`, or other non-alias list fails. The prompt should state this boundary rather than relaxing it.

The existing create rule requires all 44 content fields. For an actual non-human individual, an inapplicable anatomy/appearance/identity detail still needs a usable, specific value: state the concrete species or construction reason, rather than leaving it empty or using a bare “not applicable/unknown” placeholder. This changes guidance only; it does not create a new exemption or modify placeholder validation.

## Minimal edit boundary and behavior checks

Replace only the two current P2 instruction sentences:

1. Name `people[].evidence` as the literal narrative anchor for this round's character discovery, and name `people[].profile.evidence` as the required archive evidence list, which may summarize verified narrative, MVU, character-card, or world-setting support and need not be a literal narrative substring. State that the fields cannot substitute for each other.
2. In the existing create completeness rule, state that all 44 fields need usable content, `aliases` alone may be an empty list, the other seven lists need at least one usable entry, pure empty/unknown placeholders are invalid, and non-applicable dimensions for a non-human individual need a concrete species/construction reason.

Do not change `PROFILE_FIELDS`, templates, validators, parsing, identity binding, model APIs, call limits, or retry behavior. Do not add additional system state or copy the old batch contract wholesale.

Behavior tests should show both sides of the current contract:

- A fully populated synthetic non-human profile with an empty `aliases` array and concrete species/construction reasons passes `validateProfile`; replacing a required text value with bare `未知`/`无`, or emptying a non-alias list, still fails.
- A P2 item with `people[].evidence` copied exactly from the narrative and `people[].profile.evidence` containing a usable summary of a verified card/world/MVU fact parses and materializes even when that summary is not in the narrative. Changing only the outer evidence to a card-only sentence still fails as `discovery_evidence_unbound`.

These tests establish prompt/validator contract alignment. They do not prove model compliance or real-host acceptance.
