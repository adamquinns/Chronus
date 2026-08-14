# Chronus — Integration & Completion Build Specification

Document type: Build specification (implementation-ready)
Audience: Codex
Governing spec: `Chronus: Deep Simulation & Gameplay PRD — Constrained Causal Judgment Architecture` remains fully binding. This document adds concrete work packages on top of the existing `codex/causal-simulation` implementation. Nothing here relaxes the PRD or the Chronus Constitution.
Build expectation: Implement ALL work packages in one development effort. Work packages are dependency ordering, not optional scope. Each has acceptance criteria; a work package is complete only when its criteria pass.

---

## 0. Context

Four code lineages exist. This build merges the best of each:

| Lineage | Location | Use for |
| --- | --- | --- |
| Causal engine (current branch) | this repo, `codex/causal-simulation` | Keep as the authoritative engine. Do not weaken any invariant. |
| Legacy UI refactor (uncommitted, never reviewed by you) | `/Users/adamquinn/Chronus` working tree | The production UI. Port it onto the engine (WP3). |
| Legacy scenario prose | `/Users/adamquinn/Chronus/data/scenarios.ts` | Narrative source material for voice blocks and two new scenarios (WP8, WP9). |
| Deployed d20 game | `origin/main`, `gh-pages` | Baseline only. Replaced at the end (WP11). |

### Invariants that must not regress

All existing tests and evals must keep passing throughout. Specifically preserved:

1. `rawDirective` never reaches the adjudicator, actor, or validator roles (Rule 5). WP7 adds it to the red team ONLY.
2. Only `commitEffects` writes authoritative state; every change retains cause + sourceEffectId (Rules 1/2/4).
3. Impact classes convert to magnitudes only in `engine/calibration.ts`; explicit deltas only for CERTAIN resource claims.
4. Actor prompts are built only from `actorVisibleState`; narrator prompts only from player-visible projections.
5. Bounded repair: attempt → validator repair → escalation → abort. Never loop.
6. Seeded RNG with cursor; audits remain exactly reconstructable (`reconstructCommittedTurn`).
7. The player's pre-resolution forecast (WP13) never appears in any model prompt before state commit — no oracle contamination of adjudication.

Add a pinning test in `engine/__tests__/pipeline.test.ts`: run a turn whose directive contains the sentinel token `XRHETORICX`; assert `JSON.stringify(messages)` for every trace with role `adjudicator`, `actor_standard`, `actor_deep`, `deep_second_opinion`, `validator`, `narrator`* contains no `XRHETORICX`. (*narrator exception is added in WP8 — after WP8, narrator is allowed to receive it; update the pin accordingly and keep the adjudicator/actor pins.)

---

## WP0 — Repository consolidation (do first, exactly as written)

1. Push this branch: `git push -u origin codex/causal-simulation`.
2. Copy the legacy UI, unmodified, into this repo in a single commit:
   - From `/Users/adamquinn/Chronus/`: `components/*.tsx`, `components/ui/Primitives.tsx`, `hooks/useBreakpoint.ts`, `hooks/useReducedMotion.ts`, `theme.ts`
   - Into: `legacy-ui/` (mirror the relative structure). Exclude `ApiKeyGateway.tsx` (this repo's OpenRouter version is newer).
   - Exclude `legacy-ui/` from `tsconfig.json` `include` until WP3 ports each file (the legacy files reference dead types and will not compile).
3. Copy `/Users/adamquinn/Chronus/data/scenarios.ts` to `docs/source_material/legacy-scenarios.ts.txt` (renamed so it is never compiled). This is authoring material for WP8/WP9.
4. Delete the stray file `README 2.md`.
5. Commit as `chore: import legacy UI and scenario source material`.

Acceptance: branch pushed; `npm test` and `npm run lint` still green; legacy files present and excluded from the build.

---

## WP1 — Eval integrity repairs

### 1a. Calibration-consistency eval is currently vacuous

`evals/run.ts` runs the identical turn twice on one gateway; `OpenRouterGateway.responseCache` guarantees identical output, so the eval cannot fail. Replace with three runs:

- Run A: `createCubanCampaign(777)`, fresh gateway instance.
- Run B: identical state, a SECOND fresh gateway instance (defeats in-process cache).
- Run C: fresh gateway, same seed, with a causally irrelevant perturbation — change one entity `description` string's wording without changing meaning (e.g. reorder two clauses in `soviet_cuba.description`).

Pass criteria (all pairs A/B, A/C):
- Recommended effects have identical `{targetType, targetId, impactClass}` multisets, OR differ by at most one effect whose class differs by one band.
- Outcome-band total-variation distance ≤ 0.1 (existing metric).

### 1b. Fabricated metadata

- Remove `tuningIterations: 8` from `evals/run.ts` and `evals/aggregate.ts`. If iteration count is worth reporting, count actual prior report files in `evals/results/` instead.
- In `evals/aggregate.ts`, record for each section the source file and its `generatedAt`. If any eval's pass comes from a re-run performed after the main run (as happened with the custom-scenario eval), the aggregate must include `"rerun": true` on that entry.

Acceptance: `npm run eval` passes with the new three-run consistency eval; aggregate JSON carries per-section provenance.

---

## WP2 — Remove scenario-specific coupling from the engine

The engine currently hardcodes curated-scenario metric ids. Make these manifest-driven:

1. Add to the scenario manifest type (`engine/domain.ts`):
   ```ts
   metricRoles?: Partial<Record<'escalation' | 'support' | 'cohesion' | 'oppositionMomentum' | 'legal' | 'exposure' | 'intelligence', Id>>;
   ```
2. `engine/pipeline.ts` second-opinion trigger: replace `campaign.state.metrics.nuclear_tension >= 95` with: any metric definition with `dangerAbove` whose current value is ≥ `dangerAbove + 0.75 * (max - dangerAbove)` (or symmetric for `dangerBelow`). No metric name literals.
3. `engine/precedent.ts` crisis distance: replace the `nuclear_tension` read with the manifest `metricRoles.escalation` metric when present, else the mean absolute change across all danger-flagged metrics, else the existing constant 25.
4. `engine/resolution.ts` `fallbackAdjudication`: resolve targets through `metricRoles` first; keep the current `firstMetric(...)` name lists only as final fallback.
5. Set `metricRoles` in all three curated scenarios.

Acceptance: `grep -rn "nuclear_tension\|federal_momentum\|domestic_support" engine/ --include='*.ts'` returns matches only in scenario definition files (`scenarios.ts`, `curatedScenarios.ts`) and tests. All tests pass.

---

## WP3 — Port the legacy UI onto the engine

Goal: the legacy "Situation Console" UI becomes the game's UI, fully driven by the engine. `components/CausalGameInterface.tsx` is deleted at the end of this WP.

### 3a. View-model adapter

Create `engine/viewModel.ts` exposing pure functions (no React imports in `engine/` — preserve this boundary):

```ts
buildConsoleModel(campaign: Campaign): ConsoleModel
// metrics: from playerVisibleState().visibleMetrics — {label, estimate, range, confidence, dangerAbove, dangerBelow}
// developments: projectChangesForViewer(...) of the latest audit
// news: latest audit narrative.news; advisors: manifest.advisors
// arcs/processes: player-visible ones, as "developing situations"
// goal: state.goal with deadline countdown
```

Display rule (PRD fog of war): when a metric belief confidence is below HIGH, the UI shows the range, not a point value.

### 3b. Component wiring (port each file from `legacy-ui/` into `components/`, updating imports/types; keep `theme.ts` tokens and the inline-style approach; keep laptop/mobile layouts, keyboard shortcuts, and reduced-motion behavior)

| Component | Wire to | Notes |
| --- | --- | --- |
| `GameConsole` | `buildConsoleModel`, `runTurn` | Options come from WP4's generator. Custom directive stays visually equal to options (PRD §7). |
| `ResolvingScreen` | `runTurn`'s `onPreview` + `onProgress` | DELETE the d20 roll animation and `rollValue` logic. New phases: `DIRECTIVE RECEIVED` (renders `TurnPreview`: strategy restatement, known advantages/uncertainties, stakes), `SIMULATION` (renders emitted `TurnProgress` stages as ✓/•; render only stages actually emitted, no fabricated percentages), `OUTCOME` (reveal when `TurnResult` resolves). Keep the reveal pacing/reduced-motion handling. |
| `ConsultCabinetModal` | `engine/advisors.ts consultAdvisors` | No turn cost. Show advisor worldview/bias as the legacy UI does. |
| `JournalDrawer` | `campaign.audits` | Per turn: narrative title, immediateOutcome, player-visible changes. |
| `LedgerSection` | latest audit's visible `StateChange[]` | Show `before → after` with `cause`. This is the causal ledger — make it prominent. |
| `Debrief` | goal outcome + declassification | On `gameOver`: outcomeClass, metric trajectories from audit snapshots, turning points = the K changes with largest `|appliedDelta|` on danger-flagged metrics. Declassification tab: facts/beliefs now visible via `declassifyOnGameOver`, per-turn "what you didn't know" (true state vs. player belief at that turn, from audit snapshots). Reuse `buildPlayerWhy`. |
| `ScenarioMenu` / `ScenarioEditorModal` | curated scenarios + `generateCustomScenario` | Editor drives the AI authoring path; a generated scenario must pass `validateScenario` before it is playable. |
| `ResumeCard` | `engine/persistence.ts` | List saved campaigns; resume exact state. |

### 3c. App flow

`App.tsx`: ApiKeyGateway → ScenarioMenu (with ResumeCard) → GameConsole ⇄ ResolvingScreen → Debrief (on gameOver) → offer continue-timeline when a successor goal exists.

Acceptance:
- `npm run build` green; `legacy-ui/` folder deleted (everything ported); `CausalGameInterface.tsx` deleted.
- Browser QA at desktop and 390×844: full CMC turn via an option AND via a custom directive; ResolvingScreen shows preview before any model result and streams real stages; ledger shows causes; cabinet consultation works without consuming a turn; Debrief + declassification render after a terminal goal; no console errors.
- A structural test asserts the console model for two campaigns differing only in hidden facts is identical (UI cannot leak).

---

## WP4 — Dynamic per-turn strategic options (restores PRD §7)

The current `suggestionsByScenario` static strings violate the PRD. Replace them.

1. Add model role `option_generator` to `DEFAULT_MODEL_ROUTES` (fast model, temperature 0.4, maxTokens 1200).
2. Create `engine/options.ts`:
   ```ts
   generateTurnOptions(campaign: Campaign, gateway?: ModelGateway): Promise<TurnOption[]>
   // TurnOption: { id, label, directiveText, rationale, tradeoff }
   ```
   - Prompt input: `playerVisibleState(...)` + latest narrative + goal. NOTHING else.
   - 3–5 options spanning different mechanism kinds (not five variants of one approach).
   - No-gateway fallback: move the current static suggestions here, keyed by scenario id.
3. Selecting an option submits its `directiveText` through the NORMAL pipeline (`runTurn` with it as the raw directive). Options get no mechanical privilege of any kind (Rule 7).
4. UI: options render as the legacy `DirectiveCard`s with A/B/C hotkeys; custom input remains equal-first-class.

Acceptance:
- Structural test: option-generation prompt built from two campaigns differing only in hidden facts is byte-identical.
- Live eval (add to `evals/run.ts`): generated options for CMC turn 1 — grader confirms ≥3 distinct mechanism kinds and no hidden-fact leak (reuse the leak-grader rubric).

---

## WP5 — Detection and leak mechanics (concealment must carry risk)

Concealment is currently free: `perceivedStrategyForActor` hides DECEPTION/INTELLIGENCE mechanisms unconditionally and `detectionDifficulty` is never read. Fix:

1. Compiler: add `concealed: boolean` to `StrategyMechanism`. The strategy compiler sets it when the player specifies secrecy (quietly/secretly/privately/concealed…); `compileDeterministically` uses the existing DECEPTION regex. A DECEPTION-kind mechanism is always `concealed`.
2. New `engine/detection.ts`:
   ```ts
   resolveDetection(graph, actorIds, state, rngSeed, rngCursor): { perceptions: Record<Id, PerceivedMechanism[]>; records: DetectionRecord[]; cursor: number }
   ```
   - For each relevant actor × each `concealed` mechanism: seeded draw (`drawSeeded`, advancing the shared cursor).
   - Detection chance = base 0.25, +0.20 if the actor has an intelligence-matching capability (reuse the `INTELLIGENCE` capability regex from `checkFeasibility`), +0.05 × (mechanisms in package − 3, min 0), −0.10 if the package contains a DECEPTION mechanism covering it, clamped to [0.05, 0.75]. Scenario override: optional `counterintelligence?: number` (0–1 multiplier) on entities.
   - A detected mechanism enters that actor's perceived strategy GARBLED: kind + target ids only, `objective: 'Concealed activity detected'` — never the full objective text.
3. `perceivedStrategyForActor` keeps its current rules for non-concealed mechanisms and consumes WP5 perceptions for concealed ones. `pipeline.ts` calls `resolveDetection` before `simulateActors`, threads the cursor into the committed state (`rngCursorAfter` accounting), and stores `DetectionRecord[]` in the audit.
4. Covert pending processes: each turn a process is active and an opposing actor is relevant, roll detection the same way (`detectableBy` grows on success; a fact-discovery effect informs that actor's beliefs).
5. Multi-turn secrecy decays: +0.05 detection chance per full turn a concealed process has been running.

Acceptance:
- Structural test across seeds 1–200 (no gateway): default concealed COALITION_BUILDING against an actor WITH intelligence capability detects in 25–60% of seeds; against an actor with NO intelligence capability, 5–30%; never 0% and never 100%.
- Detected mechanisms appear in the actor packet and are usable by the actor model; undetected ones never appear (extend `visibility.test.ts`).
- Audit contains `DetectionRecord[]` with the draw values (replayable).

---

## WP6 — Actor initiative (autonomy beyond arc drift)

Actors currently act only in reaction to the player's turn. Add genuine initiative:

1. In `pipeline.ts`, before `simulateActors`: select up to 2 initiative actors — active non-player entities ranked by (owns an active arc) + (adversarial relationship: alignment < 35 with player) + (an objective references a danger-flagged metric). Skip actors already in `relevantActorIds` twice in a row (rotation).
2. For each initiative actor with a gateway: one `actor_standard` call using the SAME `actorVisibleState` packet, with the system instruction: propose one initiative that advances this actor's own objectives independent of the player's current activity. Same `actorActionsSchema`.
3. Initiative actions are appended to `actorActions` (flagged `initiative: true` — add to the type) BEFORE red team and adjudication, so they flow through the identical validation (`validateActorActions`), capability checks, and bounded-effect adjudication as reactive actions. No separate commit path.
4. No-gateway fallback: the owner of the most advanced active arc pushes its arc (existing `autonomousWorldEffects` behavior), attributed as an initiative.
5. Deterministic cost control: initiative calls are skipped on ROUTINE turns.

Acceptance:
- New test: script 5 fallback turns where the player never references the coalition scenario's adversary; assert ≥1 committed change whose cause attributes to that actor's initiative and that it passed capability validation.
- Live check (fold into WP10): across 12 live turns, ≥2 initiative actions commit effects, none using undeclared capabilities or unperceived player mechanisms.

---

## WP7 — Red team receives the raw directive (PRD §23)

1. Add `rawDirective: string` to `runRedTeam`'s inputs; include it in the critic prompt as `literalPlayerDirective`.
2. The adjudicator, second opinion, validator, and actor prompts remain rhetoric-free — keep the WP0 pinning test green (adjudicator/actor pins stay; the red-team trace is exempt).

Acceptance: pinning test updated and green; compiler-charity live eval still passes.

---

## WP8 — Storytelling upgrade

Root causes: the narrator is prompt-starved, memoryless, routed to the fast model, capped flat, and scenarios carry no voice. Fix all of it. The narrator still CANNOT mutate state (Rule 1) — everything below is input enrichment and schema widening.

### 8a. Feed the narrator the turn's actual drama

Extend `narrate()` inputs:
- `visibleActorEvents`: from `actorActions`, filtered to actions where (a) the actor produced ≥1 player-visible committed change this turn, or (b) the action's perceived mechanisms include a PUBLIC_COMMUNICATION/MILITARY_OPERATION. Map to `{actorName, action}` strings only — strip beliefs/capability internals. Covert undetected actor moves MUST NOT appear.
- `selectedOutcome.description` (currently dropped — pass it).
- `rawDirective` (safe post-commit; lets narration echo the player's voice).
- `advisors`: `manifest.advisors` `{actorId, name, worldview, bias}` so `advisorReactions` are real people with consistent voices.
- `recentNarratives`: last 3 audits' `{title, immediateOutcome}`.
- `storySoFar` and `recurringCharacters` (8b).

### 8b. Narrative memory

- Add to `Campaign`: `storySummary: string` (≤120 words) and `narrativeCharacters: Array<{name, role, introducedTurn}>` (cap 6, FIFO).
- Extend `narrativeSchema`: `updatedStorySummary: string`, `newCharacters: max 2 per turn`. Pipeline persists both after commit. Narrator prompt instructs: reuse recurring characters where natural; do not contradict the story summary.

### 8c. Layered output (PRD §39)

Extend `narrativeSchema`: `detailedReport` (≤400 words), `pressCoverage` (≤3 × {source, headline, body ≤80 words}). UI renders compact sections by default with a disclosure for the detail layer (wire into the ported `GameConsole` news section).

### 8d. Model routing

Route `narrator` to `anthropic/claude-sonnet-5`, temperature 0.5, maxTokens 3200. Compact sections keep the ≤130-word instruction; only `detailedReport` may run long.

### 8e. Scenario voice

Add to the manifest: `voice: { era: string; tone: string; diction: string[]; textureNotes: string[]; forbiddenCliches: string[] }`. Author voice blocks for both flagship scenarios (WP9) FROM `docs/source_material/legacy-scenarios.ts.txt` — that file contains the atmospheric register to preserve (ExComm splits, Castro's posture, B-59, etc.). Include the voice block in the narrator prompt.

### 8f. Leak guard and quality gate

- Structural test: two campaigns differing only in hidden facts produce byte-identical narrator prompts.
- Live vividness eval (add to `evals/run.ts`): grader rubric `{specific: named people/places/quantities present; concrete: ≥2 physical or procedural details; fillerFree: no vague abstractions ('tensions rose', 'the situation developed'); clicheFree: zero manifest forbiddenCliches}` — pass threshold 0.7. Keep the existing fatigue and leak graders.

Acceptance: all structural + live narrative evals pass; a live CMC turn's narrative names at least one specific person and one concrete detail (checked by the grader, not string-matching).

---

## WP9 — Scenario content: two flagship storylines (revised scope)

Scope decision by the operator: the product focuses on TWO storylines — the Cuban Missile Crisis and the elections/constitutional-crisis storyline (`governors_compact_1975`). Do NOT port Iron Shogun or Twilight of the Republic now; their source material stays in `docs/source_material/` for later.

1. Deepen the two flagship manifests to this content bar: ≥8 entities, ≥5 resources, ≥5 relationships, ≥3 active arcs, ≥6 facts with ≥2 hidden and discoverable (`ACTOR_PRIVATE`/`SIMULATION_SECRET`), calibration rules covering the dominant mechanism kinds, ≥3 historical analogs with real `sourceRefs`, 2 advisors, authority rules covering DIRECT/DELEGATED/INFLUENCE/NONE for the main targets, `metricRoles` (WP2), and a `voice` block (WP8e). For the elections storyline, reuse any applicable legacy prose; otherwise author fresh material in the same register.
2. `operation_lantern` remains an engine/test fixture: keep it compiling and passing tests, but exclude it from the default `ScenarioMenu` (show it only in developer mode).
3. Historical provenance discipline (PRD §33): every fact tagged; contested interpretations marked `CONTESTED_INTERPRETATION`, not `VERIFIED_FACT`.

Acceptance: both flagships pass `validateScenario` with zero errors and the 12-turn fallback multi-turn suite; options fallback (WP4) exists for both; voice blocks present in both.

---

> WP12–WP17 below were added after operator review. Numbering is order-of-addition; execute them in document order — after WP9, before the proof and release packages (WP10, WP11), and per the priority list at the end.

## WP12 — Model routing presets and prompt economy

Observed baseline: 28 live requests cost $2.22, of which input tokens (222k) dominated output (48k). Attack input volume first, then make model choice an eval-driven decision.

1. **Role-scoped state slimming.** Add `snapshotForRole(state, role)` in `engine/projections.ts`. The compiler receives premise, entity names/kinds/capabilities, resources, and goal only; the adjudicator keeps the full snapshot; actors/narrator keep their existing projections. Additionally, strip ALL `visibility` rule objects and `fieldVisibility` maps from every model-bound serialization — visibility is engine-enforced and models never need it (this is also information hygiene).
2. **Cache-friendly prompt ordering.** For every role, order content stable-prefix-first: static system instruction, then the large state/context block, then the small per-call task block last. On Anthropic-routed roles, set OpenRouter `cache_control` breakpoints after the state block. Do not reorder in ways that change substance.
3. **Named routing presets.** Export `MODEL_PRESETS: Record<'economy' | 'standard' | 'cinematic', ModelRoutes>` from `engine/model.ts`. `OpenRouterGateway` accepts a preset name. Principle: spend on the adjudicator, starve extraction/persona roles. Economy uses a haiku/flash-class model for `strategy_compiler`, `validator`, `actor_standard`, `option_generator`; keeps a strong adjudicator; keeps the rare `deep_second_opinion` frontier. Standard ≈ current routing with the WP8d narrator upgrade. Cinematic upgrades narrator and critic one tier.
4. **Preset eval matrix.** `npm run eval -- --preset <name>` runs the live suite under a preset and writes `evals/results/live-<preset>.json`. Add `evals/preset-matrix.ts` producing a comparison table (pass rate, total cost, cost/turn) across all three presets.
5. **Cost visibility.** Surface `estimatedCostUsd` per turn (already in every audit) in the ported UI's developer/ledger area, plus campaign running total.

Acceptance: input tokens for a scripted standard live turn reduced ≥40% vs. the pre-WP12 measurement (record both in the eval report); full eval suite green on `standard`; matrix report exists for all three presets; structural test asserts no model-bound prompt contains a `"classification":` visibility key.

## WP13 — The waiting room: deliberation during resolution

The resolution wait becomes play, not a lobby. All content below derives from PRE-turn state — never from in-flight resolution.

1. **Cabinet stays open.** `ConsultCabinetModal` remains usable while `runTurn` is in flight, answering from a snapshot of the pre-turn campaign captured at directive commit. Advisor answers stream in parallel with resolution.
2. **The morning paper.** During resolution, render a reading pane with the PREVIOUS turn's `narrative.pressCoverage` and `news` (WP8c) styled as a period press digest via the scenario voice block. Zero new model calls.
3. **Forecast and calibration (build this one with the most care).**
   - At directive commit, before any outcome is shown, present a skippable forecast form: (a) expected overall outcome — one of `SETBACK / MIXED / SUCCESS / STRONG SUCCESS`; (b) for up to 2 relevant actors: `ESCALATES / HOLDS / ENGAGES`; (c) optional free-text prediction.
   - Store as `playerForecast` on the `TurnAudit`. It must NOT be passed to any model call pre-commit (Invariant 7).
   - Mechanical scoring after commit, no model calls: map the selected outcome band to the four buckets by band ordering (exact hit / adjacent / miss); map actor predictions via committed actor-action mechanism kinds (MILITARY_OPERATION or COERCION → ESCALATES; DIPLOMACY or PUBLIC_COMMUNICATION → ENGAGES; no committed action → HOLDS).
   - Maintain campaign-level `forecastRecord {forecasts, hits, adjacents}`. Debrief (WP3's port) shows a calibration summary: accuracy, and the player's dominant bias (e.g., systematically over-predicting success). Free-text predictions are shown unscored beside actual outcomes in the debrief.
4. Dossier browsing and the journal remain available during resolution (read-only).

Acceptance: forecast captured and scored across a scripted multi-turn run; skipping produces no errors; structural test asserts `playerForecast` (sentinel value) appears in NO model trace recorded before the commit stage; debrief renders the calibration summary.

## WP14 — Variance shaping: reward cleverness, price ambition, avoid the boring middle

Principle: mechanism fit moves the MEAN (already built); plan structure sets the VARIANCE (this WP); spectacle accumulates through arcs, not arbitrary spikes.

1. **Plan risk profile.** New `engine/risk.ts`: `computeRiskProfile(graph, feasibility, redTeam)` returning `{fragility, coupling, concealmentLoad, noveltyLoad}` — fragility = count of red-team WARNING/BLOCKING findings plus compiled assumptions with no supporting state; coupling = longest sequencing chain length; concealmentLoad = concealed mechanism count (WP5); noveltyLoad = OTHER-kind count.
2. **Deterministic distribution shaping** applied engine-side AFTER `sanitizeAdjudication`, recorded in the audit as `distributionShaping` with before/after:
   - Downside tail: if fragility ≥ 2 and any flagged assumption is unhedged (no contingency in the graph touches it), ensure a catastrophe-class band exists with probability `min(0.15, 0.03 + 0.03 × fragility)`.
   - Upside gate: a breakthrough-class band is permitted only when ≥1 mechanism `ENGAGES_STRONGLY` AND all of that mechanism's dependencies resolve to present state; otherwise cap the top band at 0.08 and redistribute.
   - Narrow-plan rule: a single-mechanism plan with fragility 0 gets no engine-added tails; its committed spread stays as adjudicated.
3. **Correlated failure.** When the sampled outcome band is a failure class, mechanisms later in `sequencing` than the first failed mechanism have their selected effects degraded one impact class (minimum NONE), each recorded with cause `"upstream mechanism failed: <id>"`. Rube Goldberg plans thus carry structural cascade risk with no designer thumb.
4. **Pre-commit risk display.** Extend `TurnPreview` with `riskProfile: {upsideNote, downsideNote, fragilityNotes[]}` shown in ResolvingScreen's "What is at stake". Build it ONLY from player-knowable inputs: the compiled graph's own assumptions/unspecified entries and the player's belief confidences — never from red-team findings that reference hidden state.
5. SEVERE/SYSTEMIC outside DEEP turns remains blocked (existing `sanitizeAdjudication` rule); big outcomes keep arriving via arc resolution.

Acceptance: structural tests — a 4-mechanism coupled fragile plan yields a shaped distribution with both tails and shaping recorded; a hedged single-mechanism plan yields no engine-added tails; cascade degradation applies and is attributed; the two-campaigns-differing-only-in-hidden-facts test extended to `TurnPreview.riskProfile` (byte-identical).

## WP15 — SUPERSEDED by `docs/DYNAMIC_WORLD_EXPANSION_FIX.md`

The LBJ live-play defect (PR #1) proved this WP's problem statement in the wild, and the handoff spec written in response — `docs/DYNAMIC_WORLD_EXPANSION_FIX.md` — is a strict superset of this WP: it adds directive semantics (player attempts vs. requested outcomes vs. asserted external events), alias/period-cutoff grounding, durable branch creation, the §12 causal-path rule forbidding rhetoric-to-metric shortcuts, non-consuming revision UX, and full regression tests. Implement THAT document instead of this section. It is the release blocker and runs FIRST in the execution order below. Additions to it while implementing:

1. Grounding known-answer fixtures: for each flagship scenario, a small set of period references with verified answers (officeholders, commanders, institutions at the scenario cutoff). The `world_grounder` must either match the fixture or return confidence ≤ LOW — confidently-wrong grounding is the new hallucination surface and must be a test failure, not a shrug.
2. Explicit budget: ≤2 grounded entities per turn plus their minimum relationships; excess references remain unresolved that turn with a player-visible note.
3. Keep this spec's no-gateway fallback: a deterministic generic faction (power 40, resolve 50, capabilities inferred from mechanism kind) so offline tests exercise the path.

## WP16 — Novelty grounding: research analogs, resolve slowly

The adjudicator is weakest exactly where the game's promise is strongest — mechanisms with no precedent. Ground them, and let uncertainty resolve over time instead of in one opaque judgment.

1. **Analog retrieval at adjudication time.** For each mechanism of kind OTHER, or with zero matching scenario calibration rules: one `scenario_researcher` call — "cite real cases structurally similar to this mechanism; typical outcomes; typical failure modes" — appended to `causalPrecedents` as source `RESEARCHED_ANALOG` with citations, flowing into the adjudicator prompt like other precedents.
2. **Low-confidence novelty becomes a process.** After adjudication, any novel mechanism whose mechanism-finding confidence is LOW or VERY_LOW does not resolve instantly: convert its selected effects into a `pendingProcess` (2–3 turns) whose `perTurnEffects` are small observable early signals (TRIVIAL/MINOR moves on exposure, beliefs, or the target relationship) and whose `onMature` carries the substantive effects. At maturation, re-adjudicate ONLY that mechanism against then-current state (single adjudicator call, same validation path) before applying. The narrative presents the initiative as in motion with early signals — the player learns whether the novel idea is working from the world's response, not from a hidden coin flip.
3. Novelty keeps routing to DEEP with second opinion and disagreement widening (unchanged).

Acceptance: structural — an OTHER-kind, low-confidence mechanism produces a pendingProcess, not an instant effect, and its maturation re-adjudication is recorded in the later turn's audit; live — the novel-strategy eval's audit contains ≥1 `RESEARCHED_ANALOG` precedent with a citation; all Rule 7 (no creativity bonus) evals unchanged and green.

## WP17 — Challenge and verified rewind (the trust valve)

One incoherent adjudication can undo ten fair ones. Give the player a bounded, self-policing remedy — the audit architecture already makes exact rewind free.

1. UI: `Challenge this outcome` on the latest committed turn only, with a free-text complaint. Limit: 1 challenge per campaign (configurable in developer mode).
2. Engine: `challengeTurn(campaign, auditId, complaint, gateway)` runs the `critic` against the full audit with a Constitution checklist (uncaused change, capability magic, omniscient actor, narrative/state contradiction, calibration wildly outside precedent). Returns `{violation: boolean, category, playerSummary}`. The `playerSummary` shown to the player must be built from a fixed template + category — never free prose from the full-audit context (hidden-fact leak prevention). The critic's detailed rationale goes to the developer-mode log only.
3. No violation → the player sees the template explanation ("The referee reviewed this outcome against the world's rules and found it consistent: <category basis>."). Challenge is still consumed.
4. Violation confirmed → offer rewind of that single turn: restore `previousStateSnapshot` / `previousBeliefSnapshot` / `previousMemorySnapshot` (hash-verified), pop the audit, restore the RNG cursor. The RNG discipline makes this save-scum-proof: replaying the IDENTICAL directive reproduces the identical outcome; only a different decision diverges.
5. Log every challenge + verdict on the campaign for tuning telemetry.

Acceptance: rewind restores exact prior state (hash match) and identical-directive replay reproduces the identical outcome; the once-per-campaign limit enforces; the player-facing verdict is template-generated (structural test: it contains no substring of any hidden fact statement); challenge + verdict recorded on the campaign.

---

## WP10 — Live multi-turn proof

The multi-turn suites currently exercise only the deterministic fallback; live behavior beyond one turn is unproven. Create `evals/multiturn-live.ts` (`npm run eval:multiturn`):

- 12 consecutive gateway turns on CMC, fixed seed, scripted directives mixing: diplomacy, a concealed initiative, an intelligence tasking, a resource allocation, an escalation, one directive referencing a real-but-unmodeled period actor (exercises WP15), one novel OTHER-kind mechanism (exercises WP16), and a free-form composite. Run on the `standard` preset. Budget guard: `maxUsd: 15`.
- Gates (write `evals/results/multiturn-live.json`):
  1. Zero `ERROR` validation issues across all 12 commits.
  2. Calibration stability: same mechanism kind against the same target across turns differs by ≤1 impact class, unless the effect's `cause` cites changed state or a precedent.
  3. ≥1 detection event fires for the concealed directive (WP5) OR the audit shows the draw occurring.
  4. ≥2 committed initiative effects (WP6).
  5. Narrator turns 9–12 pass the vividness + fatigue graders (WP8f) — this is the drift test.
  6. Every audit reconstructs (`reconstructCommittedTurn`) and hashes verify.
  7. The WP15 materialized entity persists to turn 12 with valid provenance and appears in ≥1 later turn's adjudication or actor simulation.
  8. The WP16 novel mechanism produced a `RESEARCHED_ANALOG` precedent and, if low-confidence, resolved as a process across turns rather than instantly.
  9. `playerForecast` sentinel values appear in zero pre-commit model traces across all 12 turns (Invariant 7).

Acceptance: report committed to the repo; all six gates pass.

---

## WP11 — Truthful compliance + release

1. Update `docs/PRD_COMPLIANCE.md`: correct the rows this spec proves were overstated (multi-turn suite was fallback-only; autonomous actors were reactive-only; calibration live eval was vacuous; generated options were static). Every row cites its NEW evidence.
2. Full gate: `npm run lint && npm test && npm run eval && npm run eval:multiturn && npm run build` — all green.
3. Open a PR from `codex/causal-simulation` to `main` titled `Chronus: causal engine + situation console`. PR body: summary of engine, UI port, and the WP10 report highlights.
4. Do NOT deploy to `gh-pages` and do NOT merge — stop after opening the PR and report. Deployment/merge is the operator's call.

---

## Completion standard

The build is complete only when: every WP's acceptance criteria pass; the pinning tests confirm no invariant regressed; the game is playable end-to-end in the browser through the ported Situation Console UI across both flagship scenarios; and the PR is open with the full gate green. Partial delivery ("UI ported but options are still static") does not meet the standard.

## Execution order

**Status as of 2026-08-14 PM:** WP0–WP11 are implemented on `codex/causal-simulation` (PR #1, draft; 63/63 tests, structural 20/20, UI ported, two flagship scenarios). Remaining work, in order:

1. `docs/DYNAMIC_WORLD_EXPANSION_FIX.md` — the release blocker (supersedes WP15; see WP15 section for three additions).
2. WP12 — routing presets + prompt economy (makes everything after cheaper to test live).
3. WP13 — waiting room + forecast/calibration.
4. WP14 — variance shaping (note: the fix doc's §12 causal-path rule complements this; implement both).
5. WP16 — novelty grounding at adjudication (distinct from the fix doc's reference grounding: this is analog retrieval + slow resolution for novel MECHANISMS, not novel ENTITIES).
6. WP17 — challenge & verified rewind.
7. Re-run WP10's live multi-turn gate (now including an LBJ-style dynamic-grounding directive) and WP11's honest compliance update before the PR leaves draft.
