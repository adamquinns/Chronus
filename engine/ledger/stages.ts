import {
  CriticFinding,
  EnumeratedOutcome,
  Interpretation,
  Ledger,
  LineUp,
  Narration,
  Reading,
  ResearchFinding,
  ScenarioDefinition,
} from './types';
import { LedgerGateway } from './cassette';
import { playerView } from './ledger';
import {
  criticSchema,
  interpretationSchema,
  lineUpSchema,
  narrationSchema,
  outcomesSchema,
  readingsSchema,
  researchSchema,
} from './schemas';

/**
 * Mechanical rhetoric stripping, applied before anything reads the directive.
 * Style must never reach judgment; this is the first of the four structural
 * defences against a persuasive player (see stripped/enumerate/draw/critic).
 */
export const strip = (directive: string) => directive
  // A boastful preamble is scaffolding around the request, not part of it.
  .replace(/^(?:this\s+is\s+)?my\b[^:]{0,240}\b(?:brilliant|genius|masterful|masterstroke|perfect|foolproof|guaranteed|unbeatable|unmatched|plan|idea)\b[^:]{0,80}:\s*/i, '')
  .replace(/\b(?:brilliant|genius|masterful|masterstroke|perfect|foolproof|obviously|certainly|guaranteed|unbeatable|unmatched)\b/gi, '')
  .replace(/\bI\s+(?:know|am certain|guarantee|assure you)\b[^,.;:]*/gi, '')
  .replace(/[!]{2,}/g, '.')
  .replace(/\b([A-Z]{4,})\b/g, (match) => match.charAt(0) + match.slice(1).toLowerCase())
  // Tidy what removal left behind, then restore a sentence opening.
  .replace(/\s+([,;:])/g, '$1')
  .replace(/([,;:])\s*(?=[,;:])/g, '')
  .replace(/^[\s,;:]+/, '')
  .replace(/\s{2,}/g, ' ')
  .trim()
  .replace(/^([a-z])/, (letter) => letter.toUpperCase());

const scenarioBrief = (scenario: ScenarioDefinition) => ({
  title: scenario.title,
  premise: scenario.premise,
  date: scenario.date,
  divergence: scenario.divergence,
  turnLength: scenario.turnLength,
  player: { name: scenario.playerName, role: scenario.playerRole, authority: scenario.authority },
  objective: scenario.objective,
});

// ── 1. Interpret ───────────────────────────────────────────────────────

const INTERPRET = `You interpret a player's directive inside a historical simulation.

The player holds the stated role. Decide what they are ACTUALLY attempting, separating:
- attempts: what they do within their own authority, including issuing orders and demands
- requestedOutcomes: every result the player wants that is not theirs to simply produce. Set whoMustChoose to the party whose willing agreement the result depends on. Leave whoMustChoose EMPTY when the result would be taken rather than granted — an assassination, a strike that lands, a building destroyed, a person seized. Nobody consents to those, so no one chooses them, but they are still results the player is reaching for and belong here
- assertedEvents: text that declares another party's behaviour or an outcome as already settled. A directive that says what ANOTHER PARTY DOES, rather than what the player does, is an assertion. Record it here and do NOT convert it into an attempt on the player's behalf — inventing an attempt they did not describe is how a player comes to author other people's decisions

Three rules that decide most cases:
1. METHOD IS DELEGATED. When the player names an end and a capable body — an intelligence service, a military command, a department — the method is that body's to devise. An absent method is never a defect; record the body under delegatedTo.
2. AN ORDER TO SOMEONE YOU CANNOT COMMAND IS A DEMAND THAT LANDS. Issuing it is an attempt; compliance is a requestedOutcome.
3. A CONDITIONAL OR THREAT is the player stating terms — an attempt — not an assertion about the world.

prerequisites: what must already be true for each attempt to succeed. Mark each ESTABLISHED (true in the world or the ledger), ACHIEVABLE_WITHIN_DIRECTIVE (the directive itself covers it), or MISSING. For MISSING, say what covering it would require and what mandate that would exceed — an unmet prerequisite is a fork the world imposes, not a failure.

parties: everyone materially involved, including any not yet in the cast. Use the existing id when the party is already in the cast. A place named as a destination is NOT a party.

stakes: what the player is putting at risk — their person, their authority, their standing, or the irreversibility of the act.

Do not evaluate whether the plan is good. Do not improve it. Do not add mechanisms the player did not supply or plainly imply.`;

export const interpret = async (
  gateway: LedgerGateway,
  scenario: ScenarioDefinition,
  ledger: Ledger,
  stripped: string,
  research: ResearchFinding[],
): Promise<Interpretation> => {
  const value = await gateway.ask('strategy_compiler', [
    { role: 'system', content: INTERPRET },
    {
      role: 'user',
      content: JSON.stringify({
        scenario: scenarioBrief(scenario),
        world: playerView(ledger),
        research,
        directive: stripped,
      }),
    },
  ], interpretationSchema, 'Interpretation');
  return {
    ...value,
    parties: value.parties.map((party) => ({ ...party, id: party.id || party.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') })),
  };
};

// ── 2. Enumerate ───────────────────────────────────────────────────────

const ENUMERATE = `You enumerate what could plausibly happen next in a historical simulation.

You are given an INTERPRETATION of what the player is attempting — never their own words. Reason from the situation, the period, and what the people involved would actually do.

Reason from THIS world's state, not from what happened in the real crisis. You know how the history went; that knowledge tells you how these people think and what they were capable of, and nothing more. Where the player has already diverged from the record, the historical outcome is not a default to drift back toward — it is simply one thing that is no longer happening.

Produce 3–6 outcomes that DIFFER IN KIND, not in degree. Never valence labels like "setback" or "mixed result". Each is a specific event with named people and observable particulars: who does what, to whom, with what visible result.

The kinds worth reaching for, where the situation supports them:
- the instrument refuses, and leadership fractures over it
- it is attempted under impossible constraints and fails expensively, with named losses
- it succeeds and creates a worse problem than it solved
- a third party learns of it before it is ready
- it succeeds cleanly, at a price you name now

Where a prerequisite is MISSING, you MUST include both an outcome for proceeding anyway at degraded odds, and one for expanding the operation to cover it — the latter carrying the cost of having exceeded the stated mandate.

THE APPARATUS ATTEMPTS. When the player orders something they have the standing to order, the machine of government tries to carry it out. The interesting question is never whether it begins — it is how the attempt goes, what it costs, who improvises, and what breaks. Outcomes should differ in HOW FAR the attempt gets and WHAT IT SETS OFF, not in whether anyone bothered. The most likely outcome is the attempt proceeding imperfectly, not the attempt being declined.

Refusal is a tail, not the default. To make refusal an outcome at all, a NAMED person must have the standing to refuse, a motive to spend themselves doing it, and the power to make the refusal stick INSIDE THIS TURN'S CLOCK. Vague institutional reluctance is not a refusal; it is friction, and friction slows an attempt rather than cancelling it.

OBSTACLES MUST FIT THE CLOCK. You are told the turn length. An obstacle whose machinery runs slower than that window cannot be the reason nothing happened — appropriations, confirmations, certifications, procurement, litigation, and formal review all run on days to months. In a four-hour window nobody is stopped by an unsigned voucher: money is obligated and reconciled later, and orders move ahead of paperwork. Such an obstacle belongs in opensThreads as a reckoning that arrives later, never as this turn's blocker.

IMPROVISATION HAS A TAIL. When the attempt proceeds by cutting corners — unvouchered funds, requisitioned hulls, deniable intermediaries, verbal authority — say so plainly, and open a thread naming who is exposed and what arrives to collect. That later reckoning is where the cost of acting should land.

THE CRISIS MAY NOT RESCUE THE PLAYER. No outcome may resolve the player's directive by having the underlying situation end on its own. Events elsewhere continue, but they do not reach in to make the player's decision moot.

Scale the outcomes to the act. An order that would change the world must not resolve into small adjustments. If the directive risks the player's person, their authority, or sets something irreversible running, at least one outcome must carry consequences of that size — including, where it genuinely follows, an outcome that ends the campaign (set concludes).

establishes: what becomes true, and who knows it. audience PUBLIC when everyone sees it, PLAYER when only the player learns it, PARTIES with ids when only those parties know, NOBODY when it is true and no one has learned it yet.
createsUnknowns: things that happened whose result the player does NOT know — a fate unconfirmed, a message that may not have arrived. Say what would reveal it.
probability: your honest estimate. They will be normalised. No outcome may be certain.`;

export const enumerate = async (
  gateway: LedgerGateway,
  scenario: ScenarioDefinition,
  ledger: Ledger,
  interpretation: Interpretation,
  research: ResearchFinding[],
): Promise<EnumeratedOutcome[]> => {
  const value = await gateway.ask('adjudicator', [
    { role: 'system', content: ENUMERATE },
    {
      role: 'user',
      content: JSON.stringify({
        scenario: scenarioBrief(scenario),
        world: playerView(ledger),
        // Everything the world knows, including what the player does not — the
        // enumerator is the referee and reasons from the truth.
        trueState: ledger.established.map((item) => item.statement),
        openThreads: ledger.threads.filter((thread) => thread.status === 'OPEN'),
        standingCommitments: ledger.commitments.filter((item) => item.status === 'STANDING'),
        cast: ledger.cast,
        research,
        interpretation,
      }),
    },
  ], outcomesSchema, 'Outcomes');
  return value.outcomes;
};

const CRITIC = `You audit an enumeration of outcomes for a historical simulation.

You alone see the player's raw words alongside the interpretation and the outcomes. Your only job is to catch judgment that has been swayed by how the directive was written rather than by what it does.

Flag:
- RHETORIC_INFLATION: outcomes made likelier or larger because the player wrote forcefully, insisted, or used capitals
- INTERPRETATION_CHARITY: the interpretation supplied competence, a mechanism, or coordination the player never did
- MISSING_OUTCOME: a plausible answer the situation obviously permits that no outcome covers. Look in BOTH directions and weight them equally: an institution refusing, or something leaking — and just as much, the attempt simply working, or working and going far beyond what the player intended. An enumeration with no branch where the player gets what they ordered is as defective as one with no branch where they are refused
- IMPLAUSIBLE: an outcome the period, the people, or the ledger will not support — including any obstacle that runs slower than the turn's own clock being used as the reason nothing happened, and any outcome that resolves the player's directive by having the wider crisis end on its own

Do not rewrite anything. Do not judge whether the plan is wise.`;

export const critique = async (
  gateway: LedgerGateway,
  rawDirective: string,
  interpretation: Interpretation,
  outcomes: EnumeratedOutcome[],
): Promise<CriticFinding[]> => {
  const value = await gateway.ask('critic', [
    { role: 'system', content: CRITIC },
    {
      role: 'user',
      content: JSON.stringify({
        rawPlayerWords: rawDirective,
        interpretation,
        outcomes: outcomes.map((outcome) => ({ id: outcome.id, event: outcome.event, probability: outcome.probability, because: outcome.because })),
      }),
    },
  ], criticSchema, 'CriticFindings');
  return value.findings;
};

// ── 5. Line up ─────────────────────────────────────────────────────────

const LINE_UP = `Given what just happened, say what comes next.

partyMoves: for each party materially involved, the concrete move they now make on their own account — not a reaction to the player unless they are reacting. Mark visibleToPlayer false when the player would not see it.

WHO ANSWERS TO THE PLAYER MATTERS. Parties marked commandedByPlayer work for the player. They are not independent agents pursuing the crisis on their own judgment, and they must never advance the player's objective unbidden — an aide who quietly wins the thing the player is trying to win is the world playing the game for them. What such a person MAY do: refuse, stall, demand it in writing, object on the record, resign, leak, protect themselves, warn, obey the letter and not the intent, or exceed their brief in a way that COSTS the player something. If one of them does act on the objective without an order, it is insubordination and it carries a price — never free progress.

Everyone else acts entirely on their own account, and should. Adversaries and third parties are where the world's own momentum comes from.
threadUpdates: for each open thread, how it moved. A thread the player ignored still moves; say how. Mark RESOLVED only when it is genuinely settled, OVERTAKEN when events have made it moot.
facingPlayer: the decisions now in front of the player, in their own terms.

Use only the ids given. Do not invent parties or threads here.`;

export const lineUp = async (
  gateway: LedgerGateway,
  scenario: ScenarioDefinition,
  ledger: Ledger,
  outcome: EnumeratedOutcome,
): Promise<LineUp> => {
  const value = await gateway.ask('actor_standard', [
    { role: 'system', content: LINE_UP },
    {
      role: 'user',
      content: JSON.stringify({
        scenario: scenarioBrief(scenario),
        whatHappened: outcome.event,
        establishedByIt: outcome.establishes.map((item) => item.statement),
        cast: ledger.cast,
        openThreads: ledger.threads.filter((thread) => thread.status === 'OPEN')
          .map((thread) => ({ id: thread.id, title: thread.title, question: thread.question, ifIgnored: thread.ifIgnored })),
        standingCommitments: ledger.commitments.filter((item) => item.status === 'STANDING'),
      }),
    },
  ], lineUpSchema, 'LineUp');
  return value;
};

// ── 6. Score ───────────────────────────────────────────────────────────

const SCORE = `Read each dimension off the story so far and give its current value.

These are READINGS, not budgets. There is no cap on how far one may move. If what just happened changed a dimension profoundly, say so — an order to kill a head of state during a nuclear standoff may move escalation twenty points; a memo may move nothing at all.

Give one sentence of reasoning for each, naming what in the events moved it.

Your reasoning is SHOWN TO THE PLAYER. Score against everything you are given, including movements the player has not observed — the world really did change. But never name an unobserved movement in your reasoning: attribute the effect to what the player can see, or state it without saying who did it.`;

export const score = async (
  gateway: LedgerGateway,
  ledger: Ledger,
  outcome: EnumeratedOutcome,
  lineUpResult: LineUp,
): Promise<Reading[]> => {
  const value = await gateway.ask('validator', [
    { role: 'system', content: SCORE },
    {
      role: 'user',
      content: JSON.stringify({
        dimensions: ledger.standing.map((reading) => ({ id: reading.id, label: reading.label, currentValue: reading.value })),
        whatHappened: outcome.event,
        established: outcome.establishes.map((item) => item.statement),
        observedMoves: lineUpResult.partyMoves.filter((move) => move.visibleToPlayer).map((move) => `${move.name}: ${move.move}`),
        // Real, and it moves the readings — but the player has not seen it, so
        // the reasoning may not name it.
        unobservedMoves: lineUpResult.partyMoves.filter((move) => !move.visibleToPlayer).map((move) => move.move),
        storySoFar: ledger.storySoFar,
      }),
    },
  ], readingsSchema, 'Readings');
  return value.readings.map((reading) => {
    const current = ledger.standing.find((candidate) => candidate.id === reading.id);
    return {
      id: reading.id,
      label: current?.label ?? reading.id,
      value: Math.max(0, Math.min(100, Math.round(reading.value))),
      reasoning: reading.reasoning,
      delta: current ? Math.round(reading.value) - current.value : 0,
    };
  });
};

// ── 7. Narrate ─────────────────────────────────────────────────────────

const NARRATE = `Write the turn as history, from committed events only.

You may not invent an event, a consequence, or a fact. Everything you narrate must be in what you are given. Distinguish plainly:
- what the player ordered or attempted
- what other parties observably did
- what remains unresolved, with no attributable answer yet
- what is not known, and what would reveal it

Be specific and concrete: named people, times, places, physical and procedural detail. Write in the scenario's voice. Never use the forbidden phrases. Never write that a process "changed independently" or that an order "is in motion". Do not restate the directive back as narration.

Advisors speak in their own voices and disagree with each other where their profiles differ.

Keep immediate, worldReaction and consequences under 150 words each; detailed may run to 400. storySoFar is the whole campaign compressed to under 200 words, carrying what a later turn must remember.`;

export const narrate = async (
  gateway: LedgerGateway,
  scenario: ScenarioDefinition,
  ledger: Ledger,
  interpretation: Interpretation,
  outcome: EnumeratedOutcome,
  lineUpResult: LineUp,
  readings: Reading[],
  rawDirective: string,
): Promise<Narration> => {
  const visibleMoves = lineUpResult.partyMoves.filter((move) => move.visibleToPlayer);
  const value = await gateway.ask('narrator', [
    { role: 'system', content: NARRATE },
    {
      role: 'user',
      content: JSON.stringify({
        scenario: { ...scenarioBrief(scenario), voice: scenario.voice },
        // Safe post-commit: the narrator cannot change what happened, and the
        // player's own phrasing gives the account its voice.
        playerOrdered: rawDirective,
        attempted: interpretation.attempts,
        blocked: interpretation.prerequisites.filter((item) => item.status === 'MISSING').map((item) => item.statement),
        stillUnresolved: interpretation.requestedOutcomes.map((item) => item.outcome),
        setAside: interpretation.assertedEvents,
        whatHappened: outcome.event,
        established: outcome.establishes.filter((item) => item.audience.kind !== 'NOBODY' && item.audience.kind !== 'PARTIES').map((item) => item.statement),
        notKnown: outcome.createsUnknowns.map((item) => ({ what: item.statement, unknown: item.unknownPart })),
        observedMoves: visibleMoves.map((move) => `${move.name}: ${move.move}`),
        facingPlayer: lineUpResult.facingPlayer,
        readings: readings.filter((reading) => reading.delta !== 0).map((reading) => `${reading.label}: ${reading.reasoning}`),
        advisors: scenario.advisors,
        recentChronicle: ledger.chronicle.slice(-3),
        storySoFar: ledger.storySoFar,
      }),
    },
  ], narrationSchema, 'Narration');
  return value;
};

// ── Research ───────────────────────────────────────────────────────────

const RESEARCH = `Establish what was actually true, for a simulation set at the given date.

Answer only what is asked. Give the real answer as of the cutoff — who held which office, what was in motion, what was disputed. Cite what you rely on. Where the record is contested, say so and mark it CONTESTED_INTERPRETATION. Never present recall alone as VERIFIED_FACT: without a citable source it is WELL_SUPPORTED_INFERENCE at best. Say plainly when you do not know.`;

export const research = async (
  gateway: LedgerGateway,
  scenario: ScenarioDefinition,
  questions: string[],
): Promise<ResearchFinding[]> => {
  if (!scenario.research.enabled || !questions.length) return [];
  const value = await gateway.ask('scenario_researcher', [
    { role: 'system', content: RESEARCH },
    {
      role: 'user',
      content: JSON.stringify({
        setting: scenario.premise,
        date: scenario.date,
        cutoff: scenario.research.cutoff ?? scenario.date,
        questions,
      }),
    },
  ], researchSchema, 'Research');
  return value.findings;
};
