import {
  Audience,
  CastMember,
  EnumeratedOutcome,
  Established,
  Id,
  Ledger,
  LineUp,
  Narration,
  Reading,
  ScenarioDefinition,
  Thread,
  Unknown,
  ValidationIssue,
} from './types';

/** Deterministic, order-independent hash so a committed ledger reconstructs exactly. */
const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
    .join(',')}}`;
};

export const hashLedger = (ledger: Ledger) => {
  const input = stable(ledger);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const createLedger = (scenario: ScenarioDefinition, seed: number): Ledger => ({
  version: 1,
  campaignId: `${scenario.id}_${seed}`,
  scenarioId: scenario.id,
  turn: 0,
  date: scenario.date,
  seed,
  cursor: 0,
  playerId: scenario.playerId,
  objective: scenario.objective,
  deadlineTurn: scenario.deadlineTurn,
  established: [
    ...scenario.opening.map((item, index) => ({
      id: `open_${index + 1}`,
      statement: item.statement,
      provenance: item.provenance,
      audience: item.audience,
      sourceRefs: item.sourceRefs ?? [],
      turn: 0,
      cause: 'Established at the divergence point.',
    })),
    ...scenario.hidden.map((item, index) => ({
      id: `hidden_${index + 1}`,
      statement: item.statement,
      provenance: item.provenance,
      audience: item.audience,
      sourceRefs: [],
      turn: 0,
      cause: 'True at the divergence point, and not known to the player.',
    })),
  ],
  threads: scenario.openThreads.map((thread, index) => ({
    id: `thread_${index + 1}`,
    title: thread.title,
    question: thread.question,
    partyIds: thread.partyIds,
    resolvedBy: thread.resolvedBy,
    ifIgnored: thread.ifIgnored,
    audience: { kind: 'PUBLIC' as const },
    openedTurn: 0,
    lastMovedTurn: 0,
    status: 'OPEN' as const,
  })),
  unknowns: [],
  commitments: [],
  cast: scenario.cast.map((member) => ({ ...member, firstSeenTurn: 0 })),
  standing: scenario.readings.map((reading) => ({
    id: reading.id,
    label: reading.label,
    value: reading.start,
    reasoning: reading.meaning,
    delta: 0,
  })),
  chronicle: [],
  storySoFar: '',
});

/** What a given viewer is entitled to see. Enforced here, never by instruction. */
export const canSee = (audience: Audience, viewerId: Id, playerId: Id, concluded: boolean): boolean => {
  if (concluded) return true;
  switch (audience.kind) {
    case 'PUBLIC': return true;
    case 'PLAYER': return viewerId === playerId;
    case 'PARTIES': return audience.partyIds.includes(viewerId);
    case 'NOBODY': return false;
  }
};

/** The ledger as the player knows it. This is what reaches the player's screen
 * and the narrator, and it is the only view either is given. */
export const playerView = (ledger: Ledger) => {
  const visible = (audience: Audience) => canSee(audience, ledger.playerId, ledger.playerId, Boolean(ledger.concluded));
  return {
    turn: ledger.turn,
    date: ledger.date,
    objective: ledger.objective,
    turnsRemaining: Math.max(0, ledger.deadlineTurn - ledger.turn),
    established: ledger.established.filter((item) => visible(item.audience)).map((item) => item.statement),
    threads: ledger.threads.filter((thread) => thread.status === 'OPEN' && visible(thread.audience))
      .map((thread) => ({ id: thread.id, title: thread.title, question: thread.question, ifIgnored: thread.ifIgnored })),
    unknowns: ledger.unknowns.filter((item) => item.status === 'OPEN')
      .map((item) => ({ id: item.id, statement: item.statement, unknownPart: item.unknownPart, revealedBy: item.revealedBy })),
    commitments: ledger.commitments.filter((item) => item.status === 'STANDING')
      .map((item) => `${item.byPartyId} → ${item.toPartyId}: ${item.statement}`),
    cast: ledger.cast.map((member) => ({ id: member.id, name: member.name, standing: member.standing, towardPlayer: member.towardPlayer })),
    standing: ledger.standing.map((reading) => ({ id: reading.id, label: reading.label, value: reading.value, reasoning: reading.reasoning })),
    storySoFar: ledger.storySoFar,
  };
};

/** What a particular party knows. Actor prompts are built from this alone. */
export const partyView = (ledger: Ledger, partyId: Id) => {
  const visible = (audience: Audience) => canSee(audience, partyId, ledger.playerId, false);
  const self = ledger.cast.find((member) => member.id === partyId);
  return {
    you: self ? { name: self.name, standing: self.standing, towardPlayer: self.towardPlayer } : { name: partyId },
    turn: ledger.turn,
    date: ledger.date,
    known: ledger.established.filter((item) => visible(item.audience)).map((item) => item.statement),
    openThreads: ledger.threads
      .filter((thread) => thread.status === 'OPEN' && (thread.partyIds.includes(partyId) || visible(thread.audience)))
      .map((thread) => thread.title),
    yourCommitments: ledger.commitments
      .filter((item) => item.status === 'STANDING' && (item.byPartyId === partyId || item.toPartyId === partyId))
      .map((item) => item.statement),
  };
};

export interface ApplyResult {
  ledger: Ledger;
  issues: ValidationIssue[];
}

/**
 * The single write path. Nothing else may modify a ledger.
 */
export const applyOutcome = (
  prior: Ledger,
  outcome: EnumeratedOutcome,
  lineUp: LineUp,
  readings: Reading[],
  narration: Narration,
  interpretationParties: Array<{ id: Id; name: string; role: string }>,
  nextDate: string,
): ApplyResult => {
  const ledger: Ledger = structuredClone(prior);
  const issues: ValidationIssue[] = [];
  const turn = prior.turn + 1;
  ledger.turn = turn;
  ledger.date = nextDate;

  // Parties that entered play this turn join the cast rather than being
  // materialized into a graph. The model already knows who they are.
  for (const party of interpretationParties) {
    if (ledger.cast.some((member) => member.id === party.id)) continue;
    const member: CastMember = {
      id: party.id,
      name: party.name,
      standing: party.role,
      towardPlayer: 'Newly in play; nothing yet established between them and the player.',
      firstSeenTurn: turn,
    };
    ledger.cast.push(member);
  }

  for (const [index, item] of outcome.establishes.entries()) {
    const entry: Established = {
      id: `est_${turn}_${index + 1}`,
      statement: item.statement,
      provenance: item.provenance ?? 'ESTABLISHED_IN_PLAY',
      audience: item.audience,
      sourceRefs: [],
      turn,
      cause: outcome.event,
    };
    ledger.established.push(entry);
  }

  for (const [index, item] of outcome.opensThreads.entries()) {
    ledger.threads.push({
      id: `thread_${turn}_${index + 1}`,
      title: item.title,
      question: item.question,
      partyIds: item.partyIds,
      resolvedBy: item.resolvedBy,
      ifIgnored: item.ifIgnored,
      audience: { kind: 'PUBLIC' },
      openedTurn: turn,
      lastMovedTurn: turn,
      status: 'OPEN',
    });
  }

  for (const [index, item] of outcome.createsUnknowns.entries()) {
    const unknown: Unknown = {
      id: `unknown_${turn}_${index + 1}`,
      statement: item.statement,
      unknownPart: item.unknownPart,
      revealedBy: item.revealedBy,
      expiresTurn: item.withinTurns ? turn + item.withinTurns : undefined,
      openedTurn: turn,
      status: 'OPEN',
    };
    ledger.unknowns.push(unknown);
  }

  for (const [index, item] of outcome.commitments.entries()) {
    ledger.commitments.push({
      id: `commit_${turn}_${index + 1}`,
      byPartyId: item.byPartyId,
      toPartyId: item.toPartyId,
      kind: item.kind,
      statement: item.statement,
      turn,
      status: 'STANDING',
    });
  }

  for (const update of lineUp.threadUpdates) {
    const thread = ledger.threads.find((candidate) => candidate.id === update.threadId);
    if (!thread) {
      issues.push({ code: 'THREAD_UNKNOWN', severity: 'WARNING', message: `Line-up referenced unknown thread ${update.threadId}.` });
      continue;
    }
    thread.status = update.status;
    thread.lastMovedTurn = turn;
    if (update.status === 'OPEN') thread.question = update.movement || thread.question;
  }

  // An unknown that has run out of time stops being pending.
  for (const unknown of ledger.unknowns) {
    if (unknown.status === 'OPEN' && unknown.expiresTurn !== undefined && turn >= unknown.expiresTurn) {
      unknown.status = 'EXPIRED';
      unknown.resolution = 'The moment for learning this passed.';
    }
  }

  // Readings are taken, not enforced. Whatever the story warrants is what moves.
  for (const reading of readings) {
    const current = ledger.standing.find((candidate) => candidate.id === reading.id);
    if (!current) {
      issues.push({ code: 'READING_UNKNOWN', severity: 'WARNING', message: `Reading ${reading.id} is not part of this scenario.` });
      continue;
    }
    current.delta = reading.value - current.value;
    current.value = reading.value;
    current.reasoning = reading.reasoning;
  }

  ledger.chronicle.push({ turn, date: nextDate, title: narration.title, summary: narration.chronicleEntry });
  ledger.storySoFar = narration.storySoFar;

  if (outcome.concludes) {
    ledger.concluded = outcome.concludes;
  } else if (turn >= ledger.deadlineTurn) {
    ledger.concluded = {
      outcome: 'UNRESOLVED',
      summary: 'The window closed with the objective unresolved.',
    };
  }

  return { ledger, issues };
};

/** Keeps the ledger inside a size that can ride in every prompt. Oldest
 * resolved material is folded into the story rather than kept item by item. */
export const compact = (ledger: Ledger, keepEstablished = 60): Ledger => {
  if (ledger.established.length <= keepEstablished) return ledger;
  const next = structuredClone(ledger);
  const surplus = next.established.length - keepEstablished;
  next.established = next.established.slice(surplus);
  next.threads = next.threads.filter((thread) => thread.status === 'OPEN' || thread.lastMovedTurn >= next.turn - 3);
  next.unknowns = next.unknowns.filter((item) => item.status === 'OPEN' || item.openedTurn >= next.turn - 3);
  return next;
};
