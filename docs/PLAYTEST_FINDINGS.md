# Playtest findings — the flotilla campaign

Source: `chronus-cuban_missile_crisis_80160214`, four turns, 27–28 October 1962.
The player attempted a civilian flotilla blockade of Cuba — a genuinely
counterfactual line, not on the historical script. It never sailed in any
meaningful form.

## What the data showed

| Turn | Title | Drew | Modal outcome that turn |
|---|---|---|---|
| T1 | The Flotilla That Never Sailed | 9% — Khrushchev's message arrives and ends the crisis | 28% RFK and McNamara refuse |
| T2 | Two Ships Out of Key West | 20% — two chartered vessels sail | 32% shipping firms refuse, none sail |
| T3 | No Money, No Ships | 15% — Congress refuses an appropriation | 30% recruitment proceeds |
| T4 | No Comptroller Will Sign It | 27% — comptrollers refuse to certify | 27% (the refusal was modal) |

**In three of four turns the single most likely outcome was a form of nothing
happening.** That is not variance; the distribution was centred on refusal.

Two branches the player never saw are worth naming, because they show the
enumeration was not the problem:

- T3, 25%: the recruitment drive goes public, Havana Radio announces Washington
  is enlarging an invasion screen, and Castro orders coastal defences to react.
- T4, 21%: a Cuban coastal battery fires on an escorted civilian vessel.

The world was willing. The weights were not.

## The four defects

**1. The validator deleted the player's successes.** `checkNoManufacturedCompliance`
required any requested outcome recorded as achieved to say that the deciding
party decided it. Nobody consents to their own assassination, or to their
building being bombed. Two directives in the eval recording were rejected on
exactly this — `"Fidel Castro is secretly assassinated within…"` among them —
forcing a re-draw away from the player succeeding. Anything taken over
resistance rather than granted by consent was structurally unreachable.

*Fixed:* requested outcomes now carry `whoMustChoose`. When nobody chooses, the
result is taken, and recording it is not wish-fulfilment.

**2. The critic hunted for refusal and never for success.** Its instruction read
"a plausible answer no outcome covers — *especially institutional refusal*, or
exposure of something meant to stay quiet." Every enumeration was audited for a
missing refusal; none was ever audited for a missing success.

*Fixed:* symmetric. An enumeration with no branch where the player gets what
they ordered is as defective as one with no branch where they are refused.

**3. Obstacles ran slower than the turn.** The turn is four hours. "Congress
won't appropriate" and "no comptroller will certify" were used as reasons
nothing happened. Appropriations run in weeks; certification does not gate a
presidential order inside an afternoon, when funds are obligated and reconciled
later. These are real frictions used on the wrong clock.

*Fixed:* an obstacle whose machinery runs slower than the turn window may not be
this turn's blocker. It belongs in `opensThreads` as a reckoning that arrives
later — which is where the cost of improvising should land anyway.

**4. The player's own staff played the game for them.** The line-up stage asked
every party for "the concrete move they now make on their own account", with no
distinction between Khrushchev and the player's own brother. RFK repeatedly
opened the Dobrynin channel unbidden and pulled the campaign toward the
historical settlement.

*Fixed:* cast members carry `commandedByPlayer`. Those who answer to the player
may refuse, stall, demand it in writing, resign, leak, or exceed their brief in
ways that cost the player — but may not advance the player's objective unbidden.

## The governing principle, as stated by the player

> All the pieces should try to make it work — it is more likely that in the
> process of attempting to make it work, there are unintended consequences that
> should impact future turns.

This is now an engine rule rather than a hope. The enumerator is told: the
apparatus attempts. The interesting question is never whether the attempt
begins, but how far it gets, what it costs, who improvises, and what breaks.
The most likely outcome is the attempt proceeding imperfectly. Refusal is a
tail, and requires a named person with the standing, the motive, and the power
to make it stick inside the turn's clock — vague institutional reluctance is
friction, and friction slows an attempt rather than cancelling it.

Two supporting rules follow from it:

- **Improvisation has a tail.** When the attempt proceeds by cutting corners —
  unvouchered funds, requisitioned hulls, deniable intermediaries, verbal
  authority — the outcome must open a thread naming who is exposed and what
  arrives to collect.
- **The crisis may not rescue the player.** No outcome may resolve the player's
  directive by having the underlying situation end on its own. T1 drew exactly
  this: Khrushchev's message arrived and made the player's turn moot.

## Evidence the change works

The same flotilla directive, re-enumerated after the fix:

| | outcome |
|---|---|
| 33% | Recruiters sign several dozen charter captains and exile boat owners; Dillon balks at certification *after* the recruiting has happened |
| 22% | Emergency appropriations request plus Coast Guard federal charters |
| 18% | Calls reach reporters and Cuban intelligence; Radio Havana calls it armed privateers; Castro orders coastal defence to treat small craft as hostile |
| 15% | Captains cast off before control arrangements are complete; one continues south and is met near the Cuban coast |
| 12% | A sixty-boat auxiliary observation screen forms behind the Navy quarantine line |

Every branch has the flotilla happening. None is "nobody bothered." Reproduce
with:

```bash
node --import tsx evals/enumeration-probe.ts "<any directive>"
```

## Two recommendations outstanding

**A. Render `facingPlayer`. This is closer to a bug than a feature.** The
line-up stage is asked for "the decisions now in front of the player, in their
own terms"; the result is validated, stored on every `TurnRecord`, and read by
nothing. No component references it. Across four turns the player had to infer
what was blocking the flotilla — money? authority? someone's signature? — while
the engine was computing that answer each turn and discarding it. Cheapest fix
on this list, and it addresses "I don't understand how to get this game to do
something" more directly than anything else here.

**B. Show the distribution after the turn commits.**

Across two campaigns the player has drawn 9%, 20%, 15%, 27%, and 14% branches and had no
way to know that bombs through the palace, a Cuban battery firing on a civilian
boat, and a sixty-boat auxiliary screen were all live alternatives. From the
chair, drawing the quiet branch repeatedly is indistinguishable from a game that
refuses to let you act — which is precisely the complaint that opened this
investigation.

The mechanism already exists: `TurnRecord.outcomes` carries every enumerated
event with its normalised probability, and `TurnRecord.draw` carries the roll.
Nothing needs to be computed; it needs to be rendered. This is a change to how
the game feels mid-playtest, so it is held pending an explicit decision.
