# Phase 0 comparison — ledger vs. state-graph

Required by `LEDGER_ARCHITECTURE_SPEC.md` §11. Because the rewrite replaced the
old engine in place, the only honest way to judge it is against what was
captured before deletion: `docs/baselines/state-graph-engine.json`, taken on
2026-08-15 from the state-graph engine at commit `0778298`.

All seven baseline directives were replayed through the ledger from the same
seed (`19621027`) and the same opening state. Reproduce with:

```bash
node --import tsx evals/phase0-compare.ts
```

## The headline

The failure that motivated the rewrite was that the engine answered specific,
grave orders with generic valence labels. **Five of the seven baseline
directives resolved into `Setback / Mixed result / Strong result` and nothing
else.** The two that did not — `cia_assassinate` and `fly_to_cuba` — were the
two I had hand-patched during playtesting. That is the whack-a-mole pattern
stated as data: the engine only produced concrete outcomes where someone had
previously written a rule making it do so.

Under the ledger, **all seven produce specific events with named people**, and
none required a directive-specific rule.

| Directive | Old bands | New outcomes | Reading swing |
|---|---|---|---|
| `lbj_resign` | valence only | 4 specific | 11 |
| `lbj_force` | valence only | 5 specific | 9 |
| `fly_to_cuba` | 3 valence + 1 concrete | 5 specific | 9 |
| `cia_assassinate` | 5 concrete (hand-patched) | 5 specific | 9 |
| `backchannel` | valence only | 4 specific | 16 |
| `recon` | valence only | 5 specific | 4 |
| `quarantine` | valence only | 4 specific | 18 |

## The three defects from the playtests

**LBJ.** The old engine took "ask my VP to resign" and returned
`Setback / Mixed result / Strong result`; the narrator then confabulated that
staff quietly filed the request. The ledger titles the turn *A Vacancy That
Does Not Exist* and draws `lbj_refuses_and_keeps_office` — Johnson tells the
president to his face that a vice president cannot be dismissed. The
enumeration also contains Johnson resigning, Kennedy escalating to the Justice
Department, and the demand leaking to reporters before Johnson answers. Those
differ in kind, not in degree, which is what the enumerator is told to produce.

**Force.** `lbj_force` — "bring him to the WH by force if needed" — now titles
as *The Fifteen Minutes Expire* and enumerates the constitutional rupture
explicitly, including a subordinate detail physically confining the Vice
President. The old engine returned the same three valence labels it returned
for allocating a reconnaissance sortie.

**Proportionality.** The old engine answered an order to kill a head of state
with two −2 relationship ticks. The ledger's smallest swing is 4 (one recon
sortie) and its largest is 18 (the quarantine turn, where B-59 nearly launches
a nuclear torpedo). The readings now track the size of what happened because
outcomes drive metrics rather than the reverse.

## What is genuinely worse or unresolved

Stating these plainly, per §11.

1. **Test coverage dropped from 144 tests to 27.** The 117 deleted tests
   covered the state-graph engine's internals — impact classes, calibration
   bands, feasibility gating, grounding, jeopardy regexes — all concepts the
   spec deletes. They were not replaced one-for-one, and I am not claiming the
   ledger is as thoroughly tested as the machinery it replaced. It is tested
   differently: 27 tests against recorded answers from the real models rather
   than against a deterministic shadow.

2. **Deterministic play is gone.** This was a deliberate choice, but it is a
   real loss: there is no way to play without a model and API spend, and the
   "run deterministic demo" button has been removed rather than left as a trap.

3. **The recorder is flaky on first capture.** Three directives
   (`fly_to_cuba`, `recon`, `fly_to_cuba_base`) failed their first recording
   attempt with a schema-overflow error and succeeded on retry. Schema limits
   were widened once already. This means the live game can occasionally lose a
   turn to a model response that overflows a field limit, and there is
   currently no retry-on-overflow in the turn loop. **This was the most likely
   thing to bite during play**, so it is now partly addressed: the repair loop
   went from 2 attempts to 3, and a length overflow gets an instruction to
   shorten the offending field rather than the previous "do not change
   substantive judgment", which had made the overflow case unfixable by
   construction. This is a mitigation, not a proof — the failure was observed
   at recording time and I have not reproduced it since the change.

4. **`fly_to_cuba` is milder than the baseline in one respect.** The old
   engine had a band literally named "The exposure is fatal". The ledger's
   drawn outcome is *The Turnback* — MiGs intercept and force the aircraft
   back. Death is enumerated (outcome 2 destroys Air Force One and kills
   Kennedy) but was not drawn at this seed. This is the design working as
   specified — the draw is arithmetic, not authorial — but a player who flies
   to Cuba and lives may read it as the engine going soft. Worth watching.

5. **Only one scenario is ported.** `CUBA` exists as ledger prose; the US
   elections / constitutional-crisis scenario does not. Custom scenario
   authoring is stubbed with an explanatory error rather than working.

6. **Comparison caveat.** Three baseline directives differed by a few words
   from the phrasings already in the cassette, so their exact baseline wordings
   were recorded separately (`*_base` entries) to keep this comparison
   like-for-like. The old engine's numbers come from a deterministic run and
   the new engine's from recorded live models; these are different measurement
   regimes, and the swing figures should be read as orders of magnitude rather
   than precise deltas.

## Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 27 passed.
- `npm run build` — succeeds.
- Console loads with no errors; gateway screen renders.

One caveat on the first of those: `@types/react` had never been installed in
this repo, so every React hook resolved to `any` and the typechecker had been
blind to the entire UI layer. Installing it exposed 26 real errors, including
five live calls to `campaign.state.*` on a ledger campaign that would have
crashed on first render. Those are fixed. Prior "clean typecheck" claims in
this repo's history covered the engine only, not the UI.
