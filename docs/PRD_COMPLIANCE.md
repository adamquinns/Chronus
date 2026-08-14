# Chronus PRD Compliance Gate

This document is a release gate, not a roadmap. A row may be marked `PASS` only when the implementation exists and the named automated evidence passes. `PARTIAL` and `MISSING` block completion.

| Requirement | Status | Required evidence |
| --- | --- | --- |
| Authoritative state and pure engine boundary | PARTIAL | Engine API tests; no React dependency; injected model/storage services |
| Engine-only commitment and causal provenance | PARTIAL | Diff reconstruction and invalid-effect rejection tests |
| Rhetoric-stripped strategy compilation | PARTIAL | Structural rhetoric-invariance and compiler-charity eval families |
| Compiler fidelity repair | PARTIAL | Invented-mechanism, hidden-knowledge, and sequencing-upgrade tests |
| Hard authority/resource/logistics/time feasibility | PARTIAL | Deterministic and impossible-action suites with zero tolerance |
| Explicit visibility classes | IN PROGRESS | Access matrix and prompt-packet leakage tests with zero tolerance |
| Sparse beliefs layered over visibility | IN PROGRESS | Missing-override and false-belief multi-turn tests |
| Information-safe actor simulation | PARTIAL | Per-actor packet snapshots and omniscience tests |
| Persistent autonomous actor behavior | PARTIAL | Actor plans, memory, commitments, resources, and multi-turn continuity |
| Active arcs and delayed processes | PARTIAL | Maturation, detection, resource cost, and non-repetition tests |
| Bounded causal judgment and calibration | PARTIAL | Scenario bands, structural tolerances, and drift tests |
| Precedent cold start and contextual retrieval | PARTIAL | Historical analog then same-world precedence tests |
| Adaptive ROUTINE/STANDARD/COMPLEX/DEEP routing | PARTIAL | Mandatory routing corpus and under-routing guard tests |
| Independent disagreement and branch analysis | PARTIAL | Distribution broadening and robustness-branch tests |
| Deterministic residual uncertainty | PARTIAL | No-roll certainty, no-lottery impossibility, exact RNG replay |
| Validation and bounded recovery | MISSING | Normal, retry, deep escalation, and abort-without-mutation tests |
| Historical provenance and prior decay | PARTIAL | Provenance validation and divergence-adaptation suite |
| Goal continuity, victory, defeat, and terminal conditions | MISSING | Typed conditions, successor objectives, terminal-only game-over tests |
| Scenario package schema and validation | IN PROGRESS | Curated scenario validation corpus |
| AI-assisted custom scenario authoring | MISSING | Generated scenario validation and 10+ turn custom suite |
| Structured persistence and recovery | PARTIAL | IndexedDB migration, rollback, import/export, reconstruction tests |
| Complete reproducible audit record | PARTIAL | Prior hash/snapshot, beliefs, packets, calls, timings, RNG, diff replay |
| Advisors and no-turn consultation | MISSING | Advice access, bias, memory, and no-time-cost tests |
| Concise layered narrative | PARTIAL | Hidden-leak grader, fatigue suite, length and contradiction checks |
| Player-safe causal explanation | PARTIAL | Visibility-projected explanation tests |
| Truthful progress and Situation Room | PARTIAL | Started/completed stages and pre-outcome non-spoiler material tests |
| Developer and post-game declassification | PARTIAL | Explicit gate, post-game access, visibility and prompt inspection |
| OpenRouter role configuration and isolation | PARTIAL | All required roles, packet isolation, model-change regression gate |
| Single-turn regression suite | PARTIAL | All PRD Section 73 families and explicit tolerances |
| Multi-turn regression suite | MISSING | CMC, coalition, military, custom, and narrative-fatigue suites |
| Original d20 baseline comparison | MISSING | Same fixtures run through both engines with scored report |
| Production/browser accessibility QA | PARTIAL | Casual flow, advanced views, keyboard/accessibility, responsive QA |

## Completion rule

Release is permitted only when every row is `PASS`, all automated tests and eval gates pass, the production build succeeds, and the final code-to-PRD audit finds no untracked requirement.
