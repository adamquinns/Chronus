# Chronus PRD Compliance Gate

This document is a release gate, not a roadmap. A row may be marked `PASS` only when the implementation exists and the named automated evidence passes. `PARTIAL` and `MISSING` block completion.

| Requirement | Status | Required evidence |
| --- | --- | --- |
| Authoritative state and pure engine boundary | PASS | `api.ts`, `pipeline.test.ts`, and `advisors.test.ts`; injected model and storage services; no React import in `engine/` |
| Engine-only commitment and causal provenance | PASS | `pipeline.test.ts` and `causal-engine.test.ts`; every committed diff retains a source effect and cause |
| Rhetoric-stripped strategy compilation | PASS | Structural and live rhetoric-invariance plus compiler-charity gates |
| Compiler fidelity repair | PASS | `causal-engine.test.ts`, `evals.test.ts`, and validated compiler normalization/repair |
| Hard authority/resource/logistics/time feasibility | PASS | Zero-tolerance deterministic, impossible-action, resource, process, and time-compression tests |
| Explicit visibility classes | PASS | `visibility.test.ts` access matrix, prompt packet tests, and post-game boundary test |
| Sparse beliefs layered over visibility | PASS | Missing-override, inaccessible-source, false-belief, and multi-turn visibility tests |
| Information-safe actor simulation | PASS | Actor-scoped state projection, access-decision audit records, and hidden-state evals |
| Persistent autonomous actor behavior | PASS | Actor actions, strategies, commitments, memories, resources, and long-horizon continuity suites |
| Active arcs and delayed processes | PASS | Per-turn costs, maturation, detection, participant validation, and exactly-once tests |
| Bounded causal judgment and calibration | PASS | Scenario bands, calibrated magnitude validation, and zero-distance repeated-state live eval |
| Precedent cold start and contextual retrieval | PASS | `evals.test.ts` proves historical-analog cold start and same-world precedence after play |
| Adaptive ROUTINE/STANDARD/COMPLEX/DEEP routing | PASS | Structural routing corpus and live under-routing gate |
| Independent disagreement and branch analysis | PASS | `recovery.test.ts` and deep-path branch/disagreement records |
| Deterministic residual uncertainty | PASS | Exact seeded replay, no-roll certainty, and no-lottery impossibility tests |
| Validation and bounded recovery | PASS | Normal validation, one repair, deep escalation, and abort-without-mutation tests |
| Historical provenance and prior decay | PASS | Scenario provenance validation and divergence-adaptation suite |
| Goal continuity, victory, defeat, and terminal conditions | PASS | Typed condition, terminal victory/defeat, deadline fallback, and successor-objective tests |
| Scenario package schema and validation | PASS | All three curated packages pass the authoritative initializer and validation corpus |
| AI-assisted custom scenario authoring | PASS | Live two-model generation passed; optional metadata normalization and 10+ turn custom suite pass |
| Structured persistence and recovery | PASS | IndexedDB, migration, exact rollback, validated import/export, reconstruction tests, and import UI |
| Complete reproducible audit record | PASS | Prior/committed snapshots and hashes, beliefs, memories, packets, calls, timings, RNG, and diff replay |
| Advisors and no-turn consultation | PASS | Access-safe, bias-disclosed, non-mutating API/unit tests and browser flow |
| Concise layered narrative | PASS | Hidden-leak live grader, fatigue suite, section-length, and contradiction gates |
| Player-safe causal explanation | PASS | Visibility-projected changes and exact-probability/hidden-cause exclusion tests |
| Truthful progress and Situation Room | PASS | Started/completed stages plus pre-outcome strategy, stakes, advice, intelligence, and tradeoffs |
| Developer and post-game declassification | PASS | Development-plus-flag gate, post-game access test, and complete trace/declassification UI |
| OpenRouter role configuration and isolation | PASS | Centralized routes, per-role packets, strict-schema adapter, traces, budgets, and model-change eval gate |
| Single-turn regression suite | PASS | Required Section 73 property families pass structurally and 14/14 in live evaluation |
| Multi-turn regression suite | PASS | CMC 12 turns, coalition 15, military 12, custom 10+, and narrative-fatigue suites pass |
| Original d20 baseline comparison | PASS | Retired resolver reproduced from revision `22ae84a`; causal engine scores 7/7 versus 0/7 |
| Production/browser accessibility QA | PASS | Casual and advanced flows, all curated scenarios, accessible names, player secrecy, mobile 390px overflow check, and zero browser errors |

## Completion rule

Release is permitted only when every row is `PASS`, all automated tests and eval gates pass, the production build succeeds, and the final code-to-PRD audit finds no untracked requirement.

Latest evidence is written to `evals/results/complete.json`. The 2026-08-14 completion run recorded structural 19/19, live 14/14, custom scenario validation PASS, and baseline 7/7 versus 0/7. Browser QA was performed against the local production-equivalent Vite app at desktop and 390×844 mobile viewport.
