/**
 * The ledger.
 *
 * State is no longer the world. The world lives in the model, in the scenario's
 * story, and — for contemporary settings — on the live web. What persists here
 * is the record: what has been established, what is owed, what is open, and
 * what is not yet known.
 *
 * Everything in this file must stay compact enough to sit in every prompt.
 */

export type Id = string;

export type Provenance =
  | 'VERIFIED_FACT'
  | 'WELL_SUPPORTED_INFERENCE'
  | 'CONTESTED_INTERPRETATION'
  | 'SCENARIO_ABSTRACTION'
  | 'ESTABLISHED_IN_PLAY';

/** Who knows a thing. Enforced in code when prompts are assembled. */
export type Audience =
  | { kind: 'PUBLIC' }
  | { kind: 'PLAYER' }
  | { kind: 'PARTIES'; partyIds: Id[] }
  | { kind: 'NOBODY' };

export interface Established {
  id: Id;
  statement: string;
  provenance: Provenance;
  audience: Audience;
  sourceRefs: string[];
  turn: number;
  cause: string;
  /** Names an earlier entry this replaces. Contradiction without this is refused. */
  supersedes?: Id;
}

export interface Thread {
  id: Id;
  title: string;
  /** What is unresolved, in a sentence. */
  question: string;
  partyIds: Id[];
  /** What would settle it. */
  resolvedBy: string;
  /** What happens if the player simply ignores it. */
  ifIgnored: string;
  audience: Audience;
  openedTurn: number;
  lastMovedTurn: number;
  status: 'OPEN' | 'RESOLVED' | 'OVERTAKEN';
}

export interface Unknown {
  id: Id;
  /** What happened, as far as it is known. */
  statement: string;
  /** The part the player does not know. */
  unknownPart: string;
  revealedBy: string;
  /** Turn by which it resolves one way or another. */
  expiresTurn?: number;
  openedTurn: number;
  status: 'OPEN' | 'RESOLVED' | 'EXPIRED';
  resolution?: string;
}

export interface Commitment {
  id: Id;
  byPartyId: Id;
  toPartyId: Id;
  /** Promised, threatened, or owed. */
  kind: 'PROMISE' | 'THREAT' | 'DEBT';
  statement: string;
  turn: number;
  status: 'STANDING' | 'HONOURED' | 'BROKEN';
}

export interface CastMember {
  id: Id;
  name: string;
  /** One line: who they are and what they want, as established. */
  standing: string;
  /** Their relationship to the player, in words rather than numbers. */
  towardPlayer: string;
  firstSeenTurn: number;
}

export interface Reading {
  id: Id;
  label: string;
  value: number;
  /** Why it reads this way now. Written every turn it moves. */
  reasoning: string;
  delta: number;
}

export interface ChronicleEntry {
  turn: number;
  date: string;
  title: string;
  summary: string;
}

export interface Ledger {
  version: 1;
  campaignId: Id;
  scenarioId: Id;
  turn: number;
  /** In-world clock, advanced by the scenario's own scale. */
  date: string;
  seed: number;
  cursor: number;
  playerId: Id;
  objective: string;
  deadlineTurn: number;
  concluded?: { outcome: string; summary: string };
  established: Established[];
  threads: Thread[];
  unknowns: Unknown[];
  commitments: Commitment[];
  cast: CastMember[];
  standing: Reading[];
  chronicle: ChronicleEntry[];
  /** Compressed story so far, bounded. */
  storySoFar: string;
}

// ── Per-turn model answers ─────────────────────────────────────────────

export type PrerequisiteStatus = 'ESTABLISHED' | 'ACHIEVABLE_WITHIN_DIRECTIVE' | 'MISSING';

export interface Prerequisite {
  statement: string;
  status: PrerequisiteStatus;
  /** For MISSING: what covering it would require, and what it would overshoot. */
  coveringItWouldRequire?: string;
  coveringItWouldExceed?: string;
}

export interface Interpretation {
  /** What the player does within their own authority. */
  attempts: string[];
  /** Results that depend on someone else deciding. */
  requestedOutcomes: string[];
  /** Text declaring another party's behaviour as already settled. */
  assertedEvents: string[];
  prerequisites: Prerequisite[];
  parties: Array<{ id: Id; name: string; role: string; newToPlay: boolean }>;
  /** What the player is putting at risk, in their own terms. */
  stakes: string[];
  /** Where the directive names an end and leaves the means to a capable body. */
  delegatedTo: Id[];
  summary: string;
}

export interface EnumeratedOutcome {
  id: Id;
  /** The specific event. Named parties, observable particulars. */
  event: string;
  /** Why this is plausible here. */
  because: string;
  probability: number;
  establishes: Array<{ statement: string; audience: Audience; provenance?: Provenance }>;
  opensThreads: Array<{ title: string; question: string; partyIds: Id[]; resolvedBy: string; ifIgnored: string }>;
  createsUnknowns: Array<{ statement: string; unknownPart: string; revealedBy: string; withinTurns?: number }>;
  commitments: Array<{ byPartyId: Id; toPartyId: Id; kind: Commitment['kind']; statement: string }>;
  /** Prerequisites this outcome assumes were met, and which were not. */
  assumesMet: string[];
  assumesUnmet: string[];
  /** Set when the outcome ends the campaign. */
  concludes?: { outcome: string; summary: string };
}

export interface CriticFinding {
  concern: 'RHETORIC_INFLATION' | 'INTERPRETATION_CHARITY' | 'MISSING_OUTCOME' | 'IMPLAUSIBLE' | 'OTHER';
  claim: string;
  affectedOutcomeIds: Id[];
}

export interface LineUp {
  partyMoves: Array<{ partyId: Id; name: string; move: string; visibleToPlayer: boolean }>;
  threadUpdates: Array<{ threadId: Id; movement: string; status: Thread['status'] }>;
  facingPlayer: string[];
}

export interface Narration {
  title: string;
  immediate: string;
  worldReaction: string;
  consequences: string;
  detailed: string;
  press: Array<{ source: string; headline: string; body: string }>;
  advisors: Array<{ name: string; reaction: string }>;
  chronicleEntry: string;
  storySoFar: string;
}

export interface ValidationIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface TurnRecord {
  version: 1;
  campaignId: Id;
  turn: number;
  startedAt: string;
  completedAt: string;
  rawDirective: string;
  /** Rhetoric-stripped, which is all the enumerator ever sees. */
  strippedDirective: string;
  interpretation: Interpretation;
  research?: ResearchFinding[];
  outcomes: EnumeratedOutcome[];
  critic: CriticFinding[];
  seed: number;
  cursorBefore: number;
  cursorAfter: number;
  draw: number;
  selectedOutcomeId: Id;
  lineUp: LineUp;
  readings: Reading[];
  narration: Narration;
  validation: ValidationIssue[];
  ledgerBefore: Ledger;
  ledgerAfter: Ledger;
  ledgerBeforeHash: string;
  ledgerAfterHash: string;
  modelCalls: Array<{ role: string; model: string; cassetteKey: string; costUsd: number }>;
  costUsd: number;
}

export interface ResearchFinding {
  question: string;
  answer: string;
  sourceRefs: string[];
  provenance: Provenance;
}

export class DirectiveRevisionNeeded extends Error {
  readonly kind = 'DIRECTIVE_REVISION';
  constructor(readonly playerMessage: string, readonly assertedEvents: string[]) {
    super(playerMessage);
    this.name = 'DirectiveRevisionNeeded';
  }
}

export interface ScenarioDefinition {
  id: Id;
  title: string;
  /** The story the world is told through. Prose, not a graph. */
  premise: string;
  playerId: Id;
  playerName: string;
  playerRole: string;
  /** What the player may and may not do by virtue of the role. */
  authority: string[];
  date: string;
  /** The point at which simulated history departs from the record. */
  divergence: string;
  /** Real time each turn represents. */
  turnLength: string;
  objective: string;
  deadlineTurn: number;
  /** Dimensions the referee reads off the story. Never gates. */
  readings: Array<{ id: Id; label: string; start: number; meaning: string }>;
  /** Established at the outset, with provenance. */
  opening: Array<{ statement: string; provenance: Provenance; audience: Audience; sourceRefs?: string[] }>;
  /** In motion before the player acts. */
  openThreads: Array<{ title: string; question: string; partyIds: Id[]; resolvedBy: string; ifIgnored: string }>;
  /** True, but not known to the player. This is the fog. */
  hidden: Array<{ statement: string; audience: Audience; provenance: Provenance }>;
  cast: Array<{ id: Id; name: string; standing: string; towardPlayer: string }>;
  advisors: Array<{ id: Id; name: string; voice: string; bias: string }>;
  voice: { era: string; tone: string; textureNotes: string[]; forbiddenCliches: string[] };
  /** Live lookup for contemporary settings. Historical scenarios leave it off. */
  research: { enabled: boolean; cutoff?: string };
  openingScene: string;
}
