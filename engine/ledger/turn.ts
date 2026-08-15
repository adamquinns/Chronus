import { drawSeeded } from '../rng';
import { LedgerGateway } from './cassette';
import { applyOutcome, compact, hashLedger } from './ledger';
import {
  critique,
  enumerate,
  interpret,
  lineUp as lineUpStage,
  narrate,
  research as researchStage,
  score,
  strip,
} from './stages';
import { validateOutcome } from './validate';
import {
  DirectiveRevisionNeeded,
  EnumeratedOutcome,
  Ledger,
  ScenarioDefinition,
  TurnRecord,
  ValidationIssue,
} from './types';

export interface RunTurnOptions {
  gateway: LedgerGateway;
  onProgress?: (stage: string, label: string, done: boolean) => void;
}

export interface TurnResult {
  ledger: Ledger;
  record: TurnRecord;
}

/** Advance the in-world clock by the scenario's own scale. */
const advanceDate = (scenario: ScenarioDefinition, ledger: Ledger): string => {
  const match = scenario.turnLength.match(/(\d+)\s*(minute|hour|day|week|month|year)/i);
  if (!match) return ledger.date;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const parsed = Date.parse(ledger.date);
  if (Number.isNaN(parsed)) return ledger.date;
  const ms: Record<string, number> = {
    minute: 60_000, hour: 3_600_000, day: 86_400_000,
    week: 604_800_000, month: 2_592_000_000, year: 31_536_000_000,
  };
  return new Date(parsed + amount * (ms[unit] ?? 0)).toISOString();
};

const normalise = (outcomes: EnumeratedOutcome[]): EnumeratedOutcome[] => {
  const total = outcomes.reduce((sum, outcome) => sum + Math.max(0, outcome.probability), 0);
  if (total <= 0) {
    const share = 1 / Math.max(1, outcomes.length);
    return outcomes.map((outcome) => ({ ...outcome, probability: share }));
  }
  return outcomes.map((outcome) => ({ ...outcome, probability: Math.max(0, outcome.probability) / total }));
};

const pick = (outcomes: EnumeratedOutcome[], draw: number): EnumeratedOutcome => {
  let cursor = draw;
  for (const outcome of outcomes) {
    cursor -= outcome.probability;
    if (cursor <= 0) return outcome;
  }
  return outcomes[outcomes.length - 1];
};

/**
 * One turn.
 *
 *   interpret → enumerate → weight → draw → record → line up → score → narrate
 *
 * Three properties of this order are load-bearing and must not be relaxed:
 * enumeration happens before anything selects among the outcomes, so nothing
 * can reason backwards from a preferred result; the chooser is a seeded draw,
 * which cannot be persuaded; and the enumerator never receives the player's
 * own words, so eloquence has no surface to act on.
 */
export const runTurn = async (
  scenario: ScenarioDefinition,
  prior: Ledger,
  rawDirective: string,
  options: RunTurnOptions,
): Promise<TurnResult> => {
  if (!rawDirective.trim()) throw new Error('A directive is required.');
  if (prior.concluded) throw new Error('This campaign has concluded.');
  const { gateway, onProgress } = options;
  const startedAt = new Date().toISOString();
  const ledgerBefore = structuredClone(prior);
  const validation: ValidationIssue[] = [];
  const stage = (name: string, label: string, done = false) => onProgress?.(name, label, done);

  // 1. Interpret ────────────────────────────────────────────────────────
  stage('INTERPRET', 'Reading the directive');
  const stripped = strip(rawDirective);
  const findings = scenario.research.enabled
    ? await researchStage(gateway, scenario, [`What was true at ${prior.date} that bears on: ${stripped}`])
    : [];
  const interpretation = await interpret(gateway, scenario, prior, stripped, findings);
  stage('INTERPRET', 'Directive read', true);

  // The player controls attempts; the simulation controls outcomes. A directive
  // that only declares what others do has nothing to simulate.
  if (!interpretation.attempts.length && interpretation.assertedEvents.length) {
    throw new DirectiveRevisionNeeded(
      'You control your approach, not other parties’ choices. Say what you attempt — who you order, ask, press, or prepare — and the world will decide how it answers.',
      interpretation.assertedEvents,
    );
  }
  if (!interpretation.attempts.length) {
    throw new DirectiveRevisionNeeded(
      'Nothing in that directive is something you can attempt. Name an action you take, and the world will answer it.',
      [],
    );
  }

  // 2–3. Enumerate and weight ───────────────────────────────────────────
  stage('ENUMERATE', 'Working out what could happen');
  const enumerated = normalise(await enumerate(gateway, scenario, prior, interpretation, findings));
  const critic = await critique(gateway, rawDirective, interpretation, enumerated);
  validation.push(...critic.map((finding) => ({
    code: `CRITIC_${finding.concern}`,
    severity: 'WARNING' as const,
    message: finding.claim,
  })));
  stage('ENUMERATE', `${enumerated.length} plausible outcomes`, true);

  const distributionIssues = validateOutcome(prior, interpretation, enumerated[0], enumerated)
    .filter((issue) => issue.code.startsWith('DISTRIBUTION') || issue.code.startsWith('TOO_FEW') || issue.code.startsWith('OUTCOME_'));
  const fatalDistribution = distributionIssues.filter((issue) => issue.severity === 'ERROR');
  if (fatalDistribution.length) throw new Error(`Enumeration rejected: ${fatalDistribution[0].message}`);
  validation.push(...distributionIssues);

  // 4. Draw ─────────────────────────────────────────────────────────────
  stage('DRAW', 'Resolving');
  const roll = drawSeeded(prior.seed, prior.cursor);
  const selected = pick(enumerated, roll.value);
  stage('DRAW', 'Resolved', true);

  const outcomeIssues = validateOutcome(prior, interpretation, selected, enumerated)
    .filter((issue) => !issue.code.startsWith('DISTRIBUTION') && !issue.code.startsWith('TOO_FEW') && !issue.code.startsWith('OUTCOME_'));
  const fatal = outcomeIssues.filter((issue) => issue.severity === 'ERROR');
  if (fatal.length) throw new Error(`Outcome rejected: ${fatal[0].message}`);
  validation.push(...outcomeIssues);

  // 5–6. Line up and score ──────────────────────────────────────────────
  stage('LINE_UP', 'Setting the board');
  const lineUp = await lineUpStage(gateway, scenario, prior, selected);
  const readings = await score(gateway, prior, selected, lineUp);
  stage('LINE_UP', 'Board set', true);

  // 7. Narrate ──────────────────────────────────────────────────────────
  stage('NARRATE', 'Writing the report');
  const narration = await narrate(gateway, scenario, prior, interpretation, selected, lineUp, readings, rawDirective);
  stage('NARRATE', 'Report written', true);

  // 8. Record ───────────────────────────────────────────────────────────
  stage('RECORD', 'Committing');
  const applied = applyOutcome(
    prior,
    selected,
    lineUp,
    readings,
    narration,
    interpretation.parties,
    advanceDate(scenario, prior),
  );
  validation.push(...applied.issues);
  const ledger = compact({ ...applied.ledger, cursor: roll.cursor });
  stage('RECORD', 'Committed', true);

  const record: TurnRecord = {
    version: 1,
    campaignId: ledger.campaignId,
    turn: ledger.turn,
    startedAt,
    completedAt: new Date().toISOString(),
    rawDirective,
    strippedDirective: stripped,
    interpretation,
    research: findings.length ? findings : undefined,
    outcomes: enumerated,
    critic,
    seed: prior.seed,
    cursorBefore: prior.cursor,
    cursorAfter: ledger.cursor,
    draw: roll.value,
    selectedOutcomeId: selected.id,
    lineUp,
    readings,
    narration,
    validation,
    ledgerBefore,
    ledgerAfter: structuredClone(ledger),
    ledgerBeforeHash: hashLedger(ledgerBefore),
    ledgerAfterHash: hashLedger(ledger),
    modelCalls: gateway.calls.slice(),
    costUsd: gateway.costUsd,
  };

  return { ledger, record };
};

/** A committed turn must reconstruct exactly from its record. */
export const reconstruct = (record: TurnRecord): Ledger => {
  if (hashLedger(record.ledgerBefore) !== record.ledgerBeforeHash) throw new Error('Prior ledger hash mismatch.');
  if (hashLedger(record.ledgerAfter) !== record.ledgerAfterHash) throw new Error('Committed ledger hash mismatch.');
  return structuredClone(record.ledgerAfter);
};
