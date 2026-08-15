# Chronus: Ledger Architecture

Document type: Build specification
Status: Supersedes the state-graph engine on `codex/causal-simulation`
Governing intent: the PRD's constitution stands. Its *implementation* is being inverted.

---

## 0. Why this replaces what exists

The current engine encodes the world as a state graph — entities, relationships, metrics, arcs, facts — and moves the model in and out of it through projections and bounded deltas.

That graph is a **lossy re-encoding of what the model already knows.** The model knows the 89th Airlift Wing, the Dobrynin channel, that SA-2 batteries answered to Soviet officers rather than Cubans. None of it needed authoring. What the graph added was a boundary, and essentially every observed failure lived on that boundary:

- "Take me to Cuba" targeted the Soviet force stationed there, because a place had to be an entity to be mentioned
- The President could not address the nation, because speech required a declared capability
- Ordering the CIA to kill Castro produced a memo about unspecified success criteria, because an unmatched string meant an unformed intention
- Ordering an assassination moved two relationship dials by −2, because calibration bands cap what a turn may do

Each was fixed individually. The fixes were heuristics — `SELF_EXPOSING`, `EXTREME_ACT`, `namedAsDestination`, `inferMechanismKind`, four hardcoded outcome strings — and every one is a **judgment implemented as string-matching**. That is the architectural error, and it has one symptom per regex, forever.

The inversion: **the world lives where it already lives — in the model, in the scenario's story, and for contemporary settings on the live web. State stops being the world and becomes the ledger: the record of what has been established, what is owed, what is open, and what is not yet known.**

### The consequence that matters most

Today metrics *gate* the story: calibration bands cap effect size, danger thresholds route depth. That is why bold directives move small numbers — the number system sits upstream of the narrative.

In this design, **scores are readings taken after the fact.** Nuclear tension is not what the world is made of; it is the referee's assessment of the story so far. Outcomes drive scores, never the reverse. This single inversion fixes proportionality permanently and deletes impact classes, calibration rules, and magnitude bands entirely.

---

## 1. The turn loop

```
raw directive
  → 1. INTERPRET      what is being attempted, and what must be true first
  → 2. ENUMERATE      the plausible outcomes, concrete and differing in kind
  → 3. WEIGHT         probabilities, justified by the situation
  → 4. DRAW           seeded arithmetic selection
  → 5. RECORD         consequences, established facts, unknowns, commitments
  → 6. LINE UP        open threads, what each party does next, what now faces the player
  → 7. SCORE          read the dimensions off the story
  → 8. NARRATE        tell it
```

Three properties of this order are load-bearing and may not be relaxed:

**Enumeration precedes selection.** The enumerator does not know which outcome will be drawn, so it cannot work backwards from a preferred result.

**The chooser is arithmetic.** A seeded draw over stated weights. It cannot be persuaded, flattered, or impressed.

**The enumerator never sees the player's prose.** It receives the interpreted attempt only. Eloquence has no surface to act on.

This replaces the state graph as the anti-sycophancy mechanism, and is stronger: the previous design tried to make flattery unprofitable by capping deltas; this makes it structurally inert.

---

## 2. The ledger

Compact enough to sit in every prompt. It records what has been **established**, not what the world is made of.

| Section | Holds | Why it must persist |
| --- | --- | --- |
| `established` | Facts made true in play, with provenance, visibility, and the turn that set them | The model will not remember turn 3 at turn 20 |
| `threads` | Open situations: participants, what is unresolved, what would settle it, what happens if it is ignored | Confrontations must outlive the turn that started them |
| `unknowns` | Things that happened whose outcome the player does not know, with what would reveal them and by when | "Pilot statuses unknown" is a *state*, not a phrasing |
| `commitments` | What parties promised, threatened, or owe — and to whom | Betrayal requires memory of the promise |
| `standing` | The scored dimensions, each a reading with the reasoning that produced it | Shown to the player; never a gate |
| `chronicle` | The story so far, compressed to a bounded summary | Continuity of voice and event |
| `cast` | Parties who have entered play, with what has been established about each | Reuse without duplication; no materialization machinery |

**Provenance classes carry over unchanged** from the PRD: verified fact, well-supported inference, contested interpretation, scenario abstraction, simulated post-divergence. Nothing may silently change class.

**Visibility carries over,** simplified to what a ledger needs: each established fact and unknown is marked with who knows it — public, player, a named party, or no one yet. Actor prompts are built only from what that actor knows. This is enforced in code, never by instruction.

### What the ledger is not

It is not a simulation substrate. There are no metric formulas, no impact classes, no calibration bands, no authority matrices, no capability regexes. If a question can be answered by a model that knows the period, the ledger does not answer it.

---

## 3. Division of authority

**Code owns** — and may not delegate:

- The loop order, and that enumeration precedes selection
- The seeded draw and its reproducibility
- Rhetoric stripping (mechanical, before interpretation)
- Ledger persistence, hashing, exact reconstruction, rollback
- Information boundaries: what each prompt is allowed to contain
- Validation of every model answer against the ledger (§5)
- Budget, cost accounting, and model routing
- Refusing to record anything that contradicts an established fact without an explicit supersession

**The model owns** — and code may not second-guess on the merits:

- What the player is attempting, and what it depends on
- Which outcomes are plausible, and how likely each is
- What the drawn outcome establishes, opens, and leaves unknown
- What each party does next
- What the dimensions now read
- The telling

The test for any future change: *if it requires knowing how the world works, the model decides and code checks. If it requires knowing what has already been agreed, code decides.*

---

## 4. Stages in detail

### 4.1 Interpret

Input: rhetoric-stripped directive, ledger, scenario.

Output:
- `attempts` — what the player does within their own authority
- `requestedOutcomes` — results that depend on someone else's decision
- `assertedEvents` — text declaring another party's behaviour as already decided
- `prerequisites` — what must be true for each attempt to succeed, each marked `established`, `achievable-within-this-directive`, or `missing`
- `parties` — who is involved, including any not previously in the cast
- `stakes` — what the player is putting at risk: their person, their authority, their standing, or the irreversibility of the act itself

Rules preserved from the current engine, because live play proved them:

- **The player controls attempts; the simulation controls outcomes.** A directive containing only asserted events is returned for revision without consuming a turn.
- **Method is delegated.** Naming an end and a capable body is a complete order. An absent method is never a defect.
- **An order to someone you cannot command is a demand that lands.** Compliance is theirs to decide.

### 4.2 Prerequisites — the fork that was missing

A `missing` prerequisite is not a failure. It is a **choice the world imposes**, and enumeration must reflect it:

> Drop the single bomb the mandate authorises, against air defences that are still live — or suppress the defences first and exceed the mandate you set yourself.

Enumeration must therefore include outcomes for *proceeding anyway at degraded odds* and for *expanding the operation to cover the gap*, with the second carrying the cost of having exceeded the stated intent. This is the mechanism the current engine lacks entirely, and it is where much of the game's tension lives.

### 4.3 Enumerate

Input: the interpretation, the ledger, scenario context, and for enabled scenarios the research findings (§7). **Never the raw directive.**

Output: 3–6 outcomes, each with:
- a specific event, named parties, and observable particulars — never a valence label
- what it would establish, open, and leave unknown
- which prerequisites it assumes met or unmet

Outcomes must **differ in kind**, not degree. The reference set the design targets:

- the instrument refuses, and leadership fractures
- it is attempted under impossible constraints and fails expensively, with named losses
- it succeeds and creates a worse problem
- a third party learns of it
- it succeeds cleanly, at a price named now

### 4.4 Weight and draw

The model assigns probabilities with one-line justifications. Code normalises, then draws with the campaign seed and cursor.

An outcome may be **compound**: several things become true at once. The draw selects an outcome, not an effect.

### 4.5 Record

The drawn outcome is converted into ledger entries: established facts, opened threads, created unknowns, commitments made or broken, cast additions. Each carries its cause and provenance.

Code validates before committing (§5). Nothing else may write to the ledger.

### 4.6 Line up

What each involved party will do next; what now faces the player; which threads advanced, cooled, or resolved on their own clock. Threads left alone must still move.

### 4.7 Score

Each dimension is re-read from the ledger with a one-sentence justification, and the delta is whatever the story warrants. **No caps.** An order to assassinate a head of state during a nuclear standoff may move escalation twenty points if that is what happened; a memo may move nothing.

Scores are display and evaluation. They gate nothing.

### 4.8 Narrate

From the recorded outcome and the player-visible ledger only. All current narrative requirements carry over: concrete specifics, distinguishing what was ordered from what was observed from what remains unresolved, no invented mechanical consequence, no filler, the scenario's voice, continuity of recurring characters.

---

## 5. Validation — what code checks

Applied to every model answer before anything is recorded. On failure: one repair attempt with the failure stated, then escalation, then abort with the ledger untouched. Never an open-ended repair loop.

1. **No contradiction.** Nothing may assert the opposite of an established fact without an explicit supersession naming it.
2. **No manufactured compliance.** A requested outcome may not be recorded as achieved unless the drawn outcome says the deciding party decided it.
3. **No omniscience.** An actor's stated reasoning may not rest on anything outside what that actor knows.
4. **No invented capability.** A party may not do what nothing establishes it can do. Judged against the ledger and scenario, not a capability regex.
5. **Provenance discipline.** Verified-fact status requires a citable source; model recall alone is well-supported inference at best.
6. **Distribution integrity.** Weights normalise; every outcome is reachable; none is certain.
7. **Attribution.** Every ledger entry names the cause that produced it.
8. **Reproducibility.** Seed, cursor, prompts, answers, and the drawn outcome are recorded such that the committed history reconstructs exactly.

---

## 6. Anti-sycophancy, restated

The property that must survive this rewrite, and how:

| Mechanism | Effect |
| --- | --- |
| Rhetoric stripped before interpretation | Style never reaches judgment |
| Enumerator receives the interpretation, never the prose | Nothing to be impressed by |
| Enumeration precedes selection | Cannot reason backwards from a wanted result |
| Seeded arithmetic draw | The chooser cannot be persuaded |
| A critic pass that *does* see the raw prose | Its only job is to flag enumeration inflated by rhetoric or by charity in interpretation |

Eval family (§8) proves it: the same mechanism expressed two ways must produce equivalent outcome sets and weights within tolerance.

---

## 7. Research

Per-scenario flag. Two entry points:

- **Authoring** — establish the world at the divergence point: who holds which office, what is in motion, what is disputed. Results enter the ledger as established facts with sources and provenance.
- **In play** — for contemporary scenarios only, and only when interpretation surfaces a party or condition the model flags as uncertain or post-cutoff.

Historical scenarios default off; the model knows 1962 better than a search will. Contemporary scenarios default on. Findings are cached per campaign so a replay does not re-research, and are recorded in the audit like any other model answer.

---

## 8. Testing: cassettes and evals

Deterministic play is **dropped**. A regex cannot enumerate plausible outcomes, and maintaining a second, dumber judgment layer is precisely the split that produced the failures this document removes.

**Cassettes.** Every model interaction is recorded keyed by a hash of role, model, and request. Tests replay them; nothing hits the network. A record mode refreshes them deliberately. This tests the real system rather than a shadow of it.

**Eval families carry over unchanged** and remain the release gate: rhetoric invariance, interpretation charity, hidden-state separation, omniscience, capability integrity, calibration consistency, deterministic action, impossible action, good-plan-fails, dominant-player, historical prior, divergence adaptation. Two are added:

- **Proportionality** — an extreme directive must produce outcomes and score movements of matching size. This is the failure that motivated the rewrite and must be gated against.
- **Prerequisite forking** — an attempt with a missing prerequisite must enumerate both proceeding-degraded and expanding-beyond-mandate.

**Multi-turn** — a scripted twelve-turn campaign, replayed from cassettes: no contradictions against established facts, threads advance or resolve rather than freezing, unknowns eventually resolve or expire, and no narrative drift into filler.

---

## 9. What survives, what goes

**Survives untouched:** the entire UI, persistence and audit spine, seeded RNG and reconstruction, information boundaries, the forecast and calibration mechanic, scenario voice and source material, model routing and budgets, the eval harness.

**Survives as concepts, re-expressed:** branches become threads; jeopardy becomes stakes the interpreter reasons about rather than a regex; detection becomes an outcome the enumerator can produce; actor memory becomes the ledger's commitments and cast.

**Deleted:** the state graph as substrate, metrics-as-substrate, impact classes, calibration rules, magnitude bands, feasibility-as-gate, authority matrices, capability patterns, the compiler's regex judgment layer, grounding fixtures, materialization, alias resolution, and the deterministic fallback adjudicator.

Net effect is substantially less code.

---

## 10. Build order

**Phase 0 — Preserve the evidence.** Before deleting anything, run the current engine over the canonical directives (the LBJ transcript, the unescorted flight, the CIA assassination order, plus three ordinary turns) and commit the outputs as baseline artifacts. Replacement is in place, so this is the only comparison that will exist. Do not skip it.

**Phase 1 — Ledger and loop.** Types, persistence, hashing, reconstruction, rollback. The eight stages wired with cassette recording from the first call.

**Phase 2 — Interpretation and prerequisites**, including the attempt/outcome/assertion split and the non-consuming revision path.

**Phase 3 — Enumeration, weighting, seeded draw**, with the critic pass.

**Phase 4 — Recording, threads, unknowns, and scoring as readings.**

**Phase 5 — Narration** against the existing UI.

**Phase 6 — Research**, authoring first, in-play second.

**Phase 7 — Evals and the twelve-turn cassette campaign.** Compare against the Phase 0 baselines on the same directives and report the differences honestly, including any regressions.

---

## 11. Completion standard

Complete when the canonical directives produce outcomes a reader would call proportional and specific; when the eval families pass, including proportionality and prerequisite forking; when a twelve-turn campaign holds continuity without contradiction; when the audit reconstructs exactly; and when the Phase 0 comparison is published with its regressions named rather than omitted.

The measure is not that the engine is more sophisticated. It is that a player can order something extraordinary and read back something that could actually have happened.
