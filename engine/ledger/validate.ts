import { EnumeratedOutcome, Interpretation, Ledger, ValidationIssue } from './types';

/**
 * What code checks. Everything here is a question about what has already been
 * agreed — never a question about how the world works, which is the model's.
 */

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const NEGATIONS: Array<[RegExp, RegExp]> = [
  [/\bis alive\b|\bsurvived\b|\bunharmed\b/, /\bis dead\b|\bwas killed\b|\bdied\b/],
  [/\bagreed\b|\baccepted\b|\bcomplied\b/, /\brefused\b|\bdeclined\b|\brejected\b/],
  [/\bwithdrew\b|\bwithdrawn\b/, /\bremains? in place\b|\bdid not withdraw\b/],
];

/** Nothing may assert the opposite of an established fact without naming it. */
export const checkContradictions = (ledger: Ledger, outcome: EnumeratedOutcome): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  for (const claim of outcome.establishes) {
    const claimText = norm(claim.statement);
    for (const established of ledger.established) {
      const priorText = norm(established.statement);
      const subject = priorText.split(' ').slice(0, 3).join(' ');
      if (subject.length < 6 || !claimText.includes(subject)) continue;
      for (const [left, right] of NEGATIONS) {
        const opposed = (left.test(priorText) && right.test(claimText)) || (right.test(priorText) && left.test(claimText));
        if (opposed) {
          issues.push({
            code: 'CONTRADICTS_ESTABLISHED',
            severity: 'ERROR',
            message: `"${claim.statement}" contradicts established "${established.statement}" without superseding it.`,
          });
        }
      }
    }
  }
  return issues;
};

/**
 * A requested outcome may not be recorded as achieved unless the drawn outcome
 * says the deciding party decided it. This is the anti-wish-fulfilment rule.
 */
export const checkNoManufacturedCompliance = (
  interpretation: Interpretation,
  outcome: EnumeratedOutcome,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const eventText = norm(outcome.event);
  for (const requested of interpretation.requestedOutcomes) {
    const requestedText = norm(requested);
    const key = requestedText.split(' ').filter((word) => word.length > 4).slice(0, 2);
    if (!key.length) continue;
    const establishedIt = outcome.establishes.some((item) => {
      const text = norm(item.statement);
      return key.every((word) => text.includes(word));
    });
    if (!establishedIt) continue;
    // Legitimate when the deciding party is named as the one deciding —
    // whether that is said in the event or in the statement it establishes.
    const DECIDES = /\b(?:agree|agrees|agreed|accept|accepts|accepted|consent|consents|comply|complies|complied|concede|concedes|conceded|yield|yields|yielded|grant|grants|granted|approve|approves|approved|resign|resigns|resigned|sign|signs|signed|order|orders|ordered|decide|decides|decided|allow|allows|allowed|permit|permits|permitted|refus|declin)\w*\b/;
    const decidedInStatement = outcome.establishes.some((item) => {
      const text = norm(item.statement);
      return key.every((word) => text.includes(word)) && DECIDES.test(text);
    });
    const decided = decidedInStatement || DECIDES.test(eventText);
    if (!decided) {
      issues.push({
        code: 'MANUFACTURED_COMPLIANCE',
        severity: 'ERROR',
        message: `"${requested}" is recorded as achieved but the outcome does not say the deciding party decided it.`,
      });
    }
  }
  return issues;
};

/** Weights normalise, every outcome is reachable, none is certain. */
export const checkDistribution = (outcomes: EnumeratedOutcome[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (outcomes.length < 3) {
    issues.push({ code: 'TOO_FEW_OUTCOMES', severity: 'ERROR', message: `Only ${outcomes.length} outcomes were enumerated; at least three are required.` });
  }
  const total = outcomes.reduce((sum, outcome) => sum + Math.max(0, outcome.probability), 0);
  if (total <= 0) {
    issues.push({ code: 'DISTRIBUTION_EMPTY', severity: 'ERROR', message: 'No outcome carries any probability.' });
    return issues;
  }
  for (const outcome of outcomes) {
    const share = Math.max(0, outcome.probability) / total;
    if (share <= 0) {
      issues.push({ code: 'OUTCOME_UNREACHABLE', severity: 'WARNING', message: `${outcome.id} cannot be drawn.` });
    }
    if (share >= 0.95) {
      issues.push({ code: 'OUTCOME_CERTAIN', severity: 'ERROR', message: `${outcome.id} is effectively certain; no outcome may be foregone.` });
    }
  }
  const ids = new Set(outcomes.map((outcome) => outcome.id));
  if (ids.size !== outcomes.length) {
    issues.push({ code: 'OUTCOME_IDS_DUPLICATE', severity: 'ERROR', message: 'Outcome ids are not unique.' });
  }
  return issues;
};

/** Verified-fact status requires a citable source; recall alone does not qualify. */
export const checkProvenance = (outcome: EnumeratedOutcome): ValidationIssue[] =>
  outcome.establishes.flatMap((item) => (item.provenance === 'VERIFIED_FACT'
    ? [{
      code: 'PROVENANCE_OVERCLAIMED',
      severity: 'WARNING' as const,
      message: `"${item.statement}" claims verified-fact status; established-in-play is the honest class for something that happened in the simulation.`,
    }]
    : []));

/** A party may not act who is not in play. */
export const checkParties = (ledger: Ledger, interpretation: Interpretation, outcome: EnumeratedOutcome): ValidationIssue[] => {
  const known = new Set([
    ledger.playerId,
    ...ledger.cast.map((member) => member.id),
    ...interpretation.parties.map((party) => party.id),
  ]);
  const issues: ValidationIssue[] = [];
  for (const commitment of outcome.commitments) {
    for (const partyId of [commitment.byPartyId, commitment.toPartyId]) {
      if (!known.has(partyId)) {
        issues.push({ code: 'PARTY_UNKNOWN', severity: 'WARNING', message: `Commitment references ${partyId}, who is not in play.` });
      }
    }
  }
  return issues;
};

export const validateOutcome = (
  ledger: Ledger,
  interpretation: Interpretation,
  outcome: EnumeratedOutcome,
  outcomes: EnumeratedOutcome[],
): ValidationIssue[] => [
  ...checkDistribution(outcomes),
  ...checkContradictions(ledger, outcome),
  ...checkNoManufacturedCompliance(interpretation, outcome),
  ...checkProvenance(outcome),
  ...checkParties(ledger, interpretation, outcome),
];
