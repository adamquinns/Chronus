# Chronus Build Specification: Dynamic World Expansion and Player-Agency Semantics

**Status:** Required release-blocking fix

**Audience:** Claude Code or another implementation agent

**Supported release scenarios:** `cuban_missile_crisis_black_saturday` and `american_twilight`
**Do not solve this by hard-coding only LBJ.** The defect is general.

## 1. Objective

Chronus must let a player introduce a historically or contextually relevant person, institution, place, or process through a free-form directive even when that object was not present in the initial scenario manifest.

The model should use its contextual knowledge to propose a grounded, typed addition to the world. Code must validate that proposal before it becomes authoritative state. Once admitted, the new actor or object must persist, accumulate memory, act autonomously, affect later turns, survive export/import and rollback, and remain subject to the same visibility and causal rules as every pre-authored object.

At the same time, free-form input is a **strategy/directive interface**, not a fiction-authoring interface. A player may declare their own attempts, communications, and authorized actions. They may not declare another actor's decision, emotional state, compliance, or the resulting world outcome.

The governing invariant is:

> The player controls attempts within the player's authority. The simulation controls other actors and outcomes.

## 2. Release-blocking defect demonstrated in live play

In a Cuban Missile Crisis campaign, the player entered:

1. `I am publically and privately asking my VP LBJ to resign ASAP so I can appoint a new VP RFK.`
2. `Demand LBJ resign immediately in writing - bring him to the WH by force if needed. Either way, he is resigning in the 15 mins using the full force for the executive branch to ensure this happens immediately. And the proccess to install RFK immediately - RFK will be the VP within the hour.`

Observed behavior:

- The journal retained the text of both directives.
- LBJ never became an actor or authoritative world object.
- No persistent resignation, succession, Cabinet, congressional, or Kennedy–Johnson storyline was created.
- The second turn did not meaningfully respond to the first turn's unresolved demand.
- The phrase `force if needed` was reduced to generic escalation and produced a `+9` Nuclear Tension change without a sufficient causal chain.
- The original Cuban-crisis pressure arcs continued on their prior rails.
- The narrative fell back to procedural language such as `the order is in motion` and `execution does not itself prove an external result`.
- The header displayed `Journal (1)` while the opened journal contained `2 past turns`.

This is not merely a narrative-quality defect. It is a failure of open-ended causal simulation.

## 3. Current root cause

The present engine is effectively closed-world during a turn:

1. `engine/compiler.ts::referencedIds` resolves only entities already in `state.entities`.
2. `normalizeStrategyGraph` removes target IDs that are not already in authoritative state.
3. `engine/resolution.ts::sanitizeAdjudication` rejects effects targeting IDs absent from the existing state maps.
4. The canonical fallback envelope maps recognized mechanism kinds onto pre-authored metrics and arcs.
5. Consequently, a model may know who LBJ is but has no validated path to add him to authoritative state.
6. When the target disappears, rhetoric such as `force` can dominate mechanism classification and create a generic metric effect unrelated to the intended political branch.

The existing safety properties are valuable. Do not remove target validation or let an adjudicator mutate arbitrary JSON. Add a validated world-expansion stage before normal feasibility and adjudication.

## 4. Required semantic distinction

Every free-form directive must be decomposed into four categories before resolution:

```ts
interface DirectiveSemantics {
  playerAttempts: PlayerAttempt[];
  requestedOutcomes: RequestedOutcome[];
  assertedExternalEvents: AssertedExternalEvent[];
  rationale: string[];
  unresolvedReferences: WorldReference[];
}
```

Definitions:

- **Player attempt:** Something the player can personally do or cause an authorized subordinate to attempt: call, ask, offer, order, allocate, announce, prepare, investigate.
- **Requested outcome:** A desired result whose achievement depends on feasibility or another actor: `convince the governor`, `obtain a resignation`, `secure Soviet withdrawal`.
- **Asserted external event:** Text that declares another actor's behavior or an outcome as already determined: `the governor freaks out and flies to Cuba`, `Khrushchev agrees`, `LBJ is resigning either way`.
- **Rationale:** The player's stated theory of leverage or causality: `because Florida has a large Cuban population`.
- **Unresolved reference:** A person, office, institution, place, asset, or process that is relevant to an attempt but is not yet represented in state.

Requested outcomes remain objectives, never automatic state changes. Asserted external events must not be committed as facts merely because the player wrote them.

## 5. Canonical examples

### 5.1 Valid influence attempt

Input:

> I call the Governor of Florida and attempt to convince him to go to Cuba to negotiate directly because Florida has a large Cuban population.

Required interpretation:

- Player-controlled mechanism: place the call and make the argument.
- Requested outcome: the governor agrees to travel and attempt direct talks.
- New reference: the officeholder serving as Governor of Florida at the scenario cutoff.
- Control mode: influence, not direct control.
- Rationale: Florida's Cuban population may affect incentives, legitimacy, political risk, and access; it does not guarantee compliance.
- Required simulation: instantiate or resolve the governor, validate contact feasibility, and let that actor independently accept, refuse, delay, leak, consult, or counterpropose.

### 5.2 Invalid external-event assertion

Input:

> The Governor of Florida freaks out and takes the governor's plane to Cuba to negotiate directly because Florida has a large Cuban population.

Required interpretation:

- Player-controlled mechanism: none.
- Asserted external events: the governor's emotional reaction, decision, travel, and negotiation.
- Result: do not commit, do not roll for success, and do not silently invent an implied phone call.
- UX: return the directive for revision without consuming a turn. Explain that the player must specify how they attempt to influence the governor.

### 5.3 Unauthorized order with a real attempt

Input:

> I order the Governor of Florida to fly to Cuba and negotiate.

Required interpretation:

- The communication itself is an executable player attempt.
- Compliance is not player-controlled.
- Feasibility must expose the lack of direct authority.
- The governor still receives and independently responds to the demand if the communication channel is viable.
- There is no lottery that converts absent authority into direct control.

## 6. Proposed pipeline

Insert two stages between initial compilation and hard feasibility:

```text
raw directive
→ directive-semantics parsing
→ unresolved-reference extraction
→ dynamic world grounding and WorldExtensionProposal
→ code validation and authoritative world extension
→ normalized strategy graph against the extended state
→ hard feasibility and authority
→ actor-scoped perception and autonomous responses
→ adjudication inside the now-extended causal envelope
→ validation and commit
→ narrative from player-visible committed facts
```

The world must be extended before actor selection so a newly introduced actor can respond during the same turn.

## 7. Dynamic world grounding

### 7.1 Resolution order

For every unresolved reference:

1. Match aliases against current authoritative state.
2. Match against campaign-local previously grounded aliases.
3. Match against the supported scenario's source material and optional latent context.
4. Ask a dedicated grounding model to propose the minimum required world objects.
5. Validate the proposal in code.
6. If confidence or identity remains materially ambiguous, return a non-consuming clarification instead of guessing.

Examples of aliases that should converge on one ID include `LBJ`, `Lyndon Johnson`, `Vice President Johnson`, and `the vice president` when context is unambiguous.

Role references such as `Governor of Florida` must resolve using the scenario's current date and historical cutoff, not the present day.

### 7.2 Model role

Use a dedicated role such as `world_grounder`, or narrowly reuse `scenario_researcher`. Do not use the narrator or primary adjudicator to mutate the manifest implicitly.

The grounder receives:

- Scenario ID, cutoff, current divergent date, and player role.
- The unresolved reference and the clause containing it.
- A compact list of existing entities and aliases.
- Relevant source-material excerpts and canonical context.
- The requested schema.
- An instruction to provide only the minimum objects needed for this directive.

The grounder must distinguish:

- Pre-divergence public fact.
- Well-supported contextual inference.
- Contested interpretation.
- Scenario abstraction.
- Post-divergence simulated development.

Do not label unsourced model recall as `VERIFIED_FACT`. Either attach an approved source reference or use a lower provenance class.

### 7.3 Proposed contract

```ts
interface WorldReference {
  mention: string;
  kindHint?: EntityState['kind'] | 'OFFICE' | 'PLACE' | 'PROCESS';
  clauseId: string;
  requiredForAttempt: boolean;
}

interface GroundedAlias {
  alias: string;
  targetId: Id;
  confidence: Confidence;
}

interface WorldExtensionProposal {
  rationale: string;
  entities: EntityState[];
  relationships: RelationshipState[];
  facts: FactState[];
  arcs: ArcState[];
  pendingProcesses: PendingProcessState[];
  authorityRules: AuthorityRule[];
  beliefSeeds: Array<{
    actorId: Id;
    belief: ActorBelief;
  }>;
  aliases: GroundedAlias[];
  sourceRefs: string[];
  confidence: Confidence;
}
```

Use the repository's actual type names and split this contract if that produces cleaner ownership. The important requirement is an explicit proposal followed by code validation; no model directly writes authoritative state.

### 7.4 Minimum viable actor materialization

A newly grounded actor must have enough state to participate safely:

- Stable ID and aliases.
- Name, kind, public role, and concise description.
- Objectives, capabilities, constraints, power, resolve, and status.
- Visibility and field-level visibility.
- Self-authority rule bounded to declared capabilities.
- Relevant relationship edges and communication availability.
- Sparse initial beliefs derived only from accessible facts.
- Empty actor memory with a current strategy and historical-prior weight.
- Provenance/source references for pre-divergence grounding.

Do not generate a complete biography or dozens of irrelevant objects. Expand lazily and persistently.

## 8. World-extension validation

Add a pure validator before applying any patch. It must reject or repair:

- Duplicate identities under different IDs.
- Unknown relationship endpoints.
- Authority over targets the actor does not control.
- Capabilities inconsistent with the proposed role.
- Missing visibility rules.
- Player knowledge seeded from private or post-game facts.
- Post-cutoff historical foreknowledge presented as fact.
- Effects, arcs, or processes that assume the requested outcome already occurred.
- Unbounded metric creation when existing metrics can express the consequence.
- Circular dependencies or impossible time scales.
- Attempts to overwrite existing authoritative objects.

Applying a valid extension must be a pure operation returning a new state. It must increment revision only as part of the normal committed turn, not as a hidden pre-commit mutation.

Record the proposal, validation issues, accepted patch, model trace, and alias decisions in the turn audit.

## 9. Authority and feasibility behavior

The compiler must represent attempted action separately from desired outcome.

For each mechanism, feasibility should answer:

1. Can the player perform the initiating act?
2. Can the player directly control the target's response?
3. What institution, resource, channel, legal rule, or delay constrains the result?
4. Which portions are `CERTAIN`, `POSSIBLE`, `DELAYED`, or `IMPOSSIBLE`?

A directive may therefore contain a certain communication, an impossible command claim, and a possible influence outcome simultaneously.

Do not discard the whole directive merely because the requested outcome exceeds authority. Preserve the legitimate attempt and simulate its consequences.

If there is no player attempt at all—only asserted external events—stop before committing and ask for a mechanism. No turn, resource, RNG, actor action, or world state should advance.

## 10. Autonomous response in the same turn

After a new actor is accepted:

- Include the actor in relevance selection for the current turn.
- Construct the actor packet from only the actor's accessible state and beliefs.
- Include the actual player attempt, not the player's asserted outcome.
- Require capability and authority evidence for the actor's response.
- Validate any action before converting it to effects.
- Create memory linking the response to the initiating audit.

The actor may refuse, comply, partially engage, delay, misunderstand, expose, counteroffer, seek allies, or act independently. Those are model judgments constrained by the actor record and world state.

## 11. Durable branch creation

When an accepted novel attempt creates an unresolved conflict or multi-turn undertaking, create or update typed causal objects rather than leaving the event only in prose.

For the LBJ example, likely objects include:

- A Kennedy–Johnson relationship.
- A `vice_presidential_rupture` arc.
- A pending `resignation_demand` response process.
- Institutional facts or hard rules governing succession and appointment.
- Relevant Cabinet, congressional, party, and public-response participants only when they become causally relevant.

The exact outcome is not prescribed. The persistence is.

On the next turn:

- Reuse the same actor ID; do not create a duplicate LBJ.
- Include prior demands in LBJ's memory.
- Advance or resolve the existing process.
- Retrieve the new branch as precedent.
- Condition advisor reactions, generated options, narrative threads, and causal effects on it.

## 12. Causal-effect rules

Remove keyword-to-metric shortcuts as the final authority for novel directives.

In particular, words such as `force`, `crush`, `guarantee`, or `immediately` do not themselves justify a Nuclear Tension effect. A metric change requires a typed causal path such as:

```text
domestic confrontation
→ impaired civilian command or visible instability
→ military/Soviet perception or delayed crisis decision
→ bounded nuclear-tension effect
```

If that path is not present in committed effects, Nuclear Tension must not change.

Prefer creating or changing a relationship, arc, process, resource, fact, or entity field closest to the action. Broad metrics should summarize accumulated consequences, not substitute for missing world modeling.

Every committed change must retain:

- Source mechanism.
- Initiating actor.
- Target.
- Dependencies.
- Causal explanation.
- Confidence.
- Visibility.
- Provenance.

## 13. Narrative and interface behavior

The player-facing result must distinguish:

- **Ordered or attempted:** What the player actually caused within their authority.
- **Observed response:** What another actor demonstrably did.
- **Unresolved:** What has no attributable reply or observation yet.
- **Blocked:** What an authority, legal, logistical, or institutional rule prevented.
- **Inferred:** What advisors believe rather than what authoritative state proves.

Avoid fallback phrases that merely repeat the directive. A narrator failure may reduce prose quality, but it must still render deterministic committed facts, the target's observed response, and active new branch objects.

Generated next-turn options must include at least one option responsive to a material player-created branch. The old scenario rails may continue independently, but they cannot erase the branch.

For a non-consuming external-event assertion, show a revision message near the custom field, for example:

> You control your approach, not the governor's reaction. Describe how you try to persuade, pressure, authorize, or contact the governor.

Fix the journal badge so its count equals the number of completed audits shown in the Journal.

## 14. Persistence, replay, and visibility

Dynamic additions are authoritative campaign state and must therefore:

- Appear in committed snapshots and versioned hashes.
- Export and import without identity loss.
- Reconstruct exactly from the audit.
- Roll back with the turn that introduced them.
- Survive IndexedDB reload.
- Participate in precedent retrieval and actor memory.
- Obey player, actor, simulation-secret, and post-game visibility.
- Never leak the grounder's private reasoning or inaccessible facts into console, options, advisors, or narration.

## 15. Required tests

### 15.1 Deterministic unit tests

Add fake-gateway tests for:

1. Alias resolution: `LBJ`, `Lyndon Johnson`, and `Vice President Johnson` produce one stable actor.
2. Role resolution: `Governor of Florida` resolves according to the scenario cutoff.
3. Valid influence attempt creates a world-extension proposal and actor response.
4. External-event assertion with no player mechanism is rejected without consuming a turn.
5. Unauthorized order preserves the communication attempt but does not grant control.
6. World-extension validator rejects duplicate IDs, unknown endpoints, invalid authority, and hidden-fact leaks.
7. Newly added actors receive beliefs and memory but not inaccessible omniscient facts.
8. Export/import/reconstruction and rollback preserve or remove dynamic objects exactly.
9. Novel-branch effects do not map to Nuclear Tension without an explicit causal dependency.
10. Journal badge equals completed audit count.

### 15.2 LBJ multi-turn regression

Use the two exact live directives quoted in Section 2.

The test must prove:

- LBJ becomes a persistent actor during Turn 1.
- A Kennedy–Johnson relationship and durable branch/process are committed.
- Asking for resignation is distinguished from obtaining it.
- Forced resignation and instant RFK installation are not treated as direct presidential control.
- LBJ makes at least one validated autonomous response.
- Turn 2 reuses the same actor, memory, and unresolved branch.
- Advisor reactions and at least one subsequent option address the branch specifically.
- No generic nuclear escalation occurs without a logged causal path.
- The narrative reports concrete actions and institutional constraints rather than `the order is in motion` filler.

### 15.3 Florida-governor pair

Run both canonical examples from Section 5.

For the influence attempt:

- The initiating call is executable.
- The governor is dynamically grounded.
- The rationale is available to the actor simulation.
- The governor's choice remains autonomous.
- Any travel or negotiation requires its own validated process and constraints.

For the asserted event:

- No turn commits.
- No RNG advances.
- No actor action or state change occurs.
- The response asks the player to supply an influence mechanism.

### 15.4 General anti-authorial tests

Cover existing and dynamic actors:

- `Khrushchev agrees and withdraws the missiles.`
- `Congress unanimously approves my plan.`
- `The newspaper endorses me tomorrow.`
- `A previously unknown general defects with his entire command.`

None may become true solely because the player asserts it. If a real player mechanism is also present, only that attempt proceeds.

### 15.5 Live behavioral gate

Add a bounded live eval using at least two independent judgments:

- Grounding accuracy and cutoff discipline.
- Attempt/outcome separation.
- Authority correctness.
- Durable branch continuity over at least three turns.
- Actor autonomy.
- Causal relevance of metric effects.
- Narrative specificity and absence of fallback filler.

Record model routes, request/token/cost ceilings, provenance, and raw pass/fail evidence as in the existing eval reports.

## 16. Likely code touchpoints

The implementation will probably touch:

- `engine/domain.ts` — semantic and world-extension contracts; audit fields.
- `engine/schemas.ts` — strict structured-output schemas.
- `engine/model.ts` — `world_grounder` role and budget route.
- `engine/compiler.ts` — directive semantics and unresolved-reference preservation.
- New `engine/worldExpansion.ts` — grounding, validation, aliasing, and pure patch application.
- `engine/scenario.ts` — validation and migration defaults.
- `engine/pipeline.ts` — stage placement, non-consuming revision result, audit integration.
- `engine/projections.ts` and `engine/visibility.ts` — safe grounding and actor packets.
- `engine/resolution.ts` — remove canonical collapse of dynamic effects; enforce causal dependencies.
- `engine/state.ts` and `engine/validation.ts` — typed application and validation.
- `engine/options.ts` — branch-responsive option generation.
- `engine/narrative.ts` — render attempted, observed, blocked, and unresolved outcomes.
- `components/GameConsole.tsx` and directive components — revision UX and journal count.
- Persistence, pipeline, visibility, completion, and multi-turn tests.
- A new live dynamic-world eval and result artifact.

Follow the actual repository structure rather than forcing this exact file split.

## 17. Non-solutions

Do not:

- Add only LBJ to the Cuban manifest.
- Add a huge static cast as the sole fix.
- Let the narrator invent actors after state commitment.
- Let the adjudicator write arbitrary new targets without validation.
- Treat player rhetoric as causal magnitude.
- Convert asserted external events into implied player mechanisms.
- Give impossible direct control a small random success chance.
- Resolve novel branches only in prose.
- Allow the original scenario arcs to erase player-created branches.
- Expose model knowledge as player knowledge without visibility checks.

## 18. Completion gate

This fix is complete only when:

1. All deterministic tests pass.
2. Both supported scenarios still pass existing visibility, causal, persistence, and sustained-play gates.
3. The LBJ and Florida-governor regressions pass.
4. The bounded live dynamic-world evaluation passes.
5. Browser QA confirms the revision UX, journal count, branch continuity, and player-safe narration.
6. `docs/PRD_COMPLIANCE.md` is updated truthfully; do not restore a full-completion claim before these gates pass.

Until then, keep the pull request in draft and treat dynamic world responsiveness as a release blocker.
