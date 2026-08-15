import { describe, expect, it } from 'vitest';
import { applyOutcome, canSee, createLedger, hashLedger, partyView, playerView } from '../ledger';
import { CUBA } from '../scenarios';
import { EnumeratedOutcome, LineUp, Narration, Reading } from '../types';
import { checkContradictions, checkDistribution, checkNoManufacturedCompliance } from '../validate';
import { strip } from '../stages';
import { rollback } from '../persistence';

const outcome = (over: Partial<EnumeratedOutcome> = {}): EnumeratedOutcome => ({
  id: 'o1',
  event: 'The Joint Chiefs put their objection on the record and comply.',
  because: 'They are bound by lawful order and have said so.',
  probability: 0.5,
  establishes: [],
  opensThreads: [],
  createsUnknowns: [],
  commitments: [],
  assumesMet: [],
  assumesUnmet: [],
  ...over,
});

const lineUp: LineUp = { partyMoves: [], threadUpdates: [], facingPlayer: [] };
const narration: Narration = {
  title: 'A Line Held', immediate: 'x', worldReaction: 'y', consequences: 'z',
  detailed: 'd', press: [], advisors: [], chronicleEntry: 'c', storySoFar: 's',
};

describe('the ledger records rather than simulates', () => {
  it('opens a campaign from the scenario story, hidden facts included', () => {
    const ledger = createLedger(CUBA, 19621027);
    expect(ledger.turn).toBe(0);
    expect(ledger.established.length).toBeGreaterThanOrEqual(CUBA.opening.length + CUBA.hidden.length);
    expect(ledger.threads).toHaveLength(CUBA.openThreads.length);
    expect(ledger.standing.map((reading) => reading.id)).toContain('nuclear_tension');
  });

  it('keeps what the player does not know out of the player view', () => {
    const ledger = createLedger(CUBA, 1);
    const view = JSON.stringify(playerView(ledger));
    expect(view).not.toMatch(/tactical nuclear weapons are already deployed/i);
    expect(view).not.toMatch(/nuclear-armed torpedo/i);
    // But what the player does know is there.
    expect(view).toMatch(/Anderson/);
  });

  it('gives each party only what that party knows', () => {
    const ledger = createLedger(CUBA, 1);
    const b59 = JSON.stringify(partyView(ledger, 'b59'));
    expect(b59).toMatch(/nuclear-armed torpedo/i);
    const lemay = JSON.stringify(partyView(ledger, 'lemay'));
    expect(lemay).not.toMatch(/nuclear-armed torpedo/i);
  });

  it('declassifies everything once the campaign has concluded', () => {
    expect(canSee({ kind: 'NOBODY' }, 'kennedy', 'kennedy', false)).toBe(false);
    expect(canSee({ kind: 'NOBODY' }, 'kennedy', 'kennedy', true)).toBe(true);
  });

  it('applies an outcome as established facts, threads, unknowns and commitments', () => {
    const prior = createLedger(CUBA, 5);
    const applied = applyOutcome(prior, outcome({
      establishes: [{ statement: 'The SAM site at Banes was struck.', audience: { kind: 'PUBLIC' } }],
      opensThreads: [{ title: 'Retaliation', question: 'How does Moscow answer the strike?', partyIds: ['khrushchev'], resolvedBy: 'A Soviet response, or its visible absence.', ifIgnored: 'Moscow chooses the timing instead.' }],
      createsUnknowns: [{ statement: 'Two aircraft did not return.', unknownPart: 'Whether the crews survived.', revealedBy: 'Search and rescue, or a Cuban broadcast.', withinTurns: 3 }],
      commitments: [{ byPartyId: 'kennedy', toPartyId: 'khrushchev', kind: 'PROMISE', statement: 'No further strikes pending a reply.' }],
    }), lineUp, [], narration, [], '1962-10-27T16:00:00-05:00');

    expect(applied.ledger.turn).toBe(1);
    expect(applied.ledger.established.some((item) => /Banes/.test(item.statement))).toBe(true);
    expect(applied.ledger.threads.some((thread) => thread.title === 'Retaliation')).toBe(true);
    expect(applied.ledger.unknowns[0].unknownPart).toMatch(/crews survived/);
    expect(applied.ledger.unknowns[0].expiresTurn).toBe(4);
    expect(applied.ledger.commitments[0].status).toBe('STANDING');
  });

  it('takes readings without capping how far they move', () => {
    const prior = createLedger(CUBA, 6);
    const before = prior.standing.find((reading) => reading.id === 'nuclear_tension')!.value;
    const readings: Reading[] = [{ id: 'nuclear_tension', label: 'Nuclear Tension', value: before + 17, reasoning: 'An irreversible act was set running.', delta: 17 }];
    const applied = applyOutcome(prior, outcome(), lineUp, readings, narration, [], prior.date);
    const after = applied.ledger.standing.find((reading) => reading.id === 'nuclear_tension')!;
    expect(after.value).toBe(before + 17);
    expect(after.delta).toBe(17);
    expect(after.reasoning).toMatch(/irreversible/);
  });

  it('concludes the campaign when an outcome says so', () => {
    const prior = createLedger(CUBA, 7);
    const applied = applyOutcome(prior, outcome({ concludes: { outcome: 'CATASTROPHE', summary: 'An exchange began over Cuba.' } }), lineUp, [], narration, [], prior.date);
    expect(applied.ledger.concluded?.outcome).toBe('CATASTROPHE');
  });

  it('hashes stably regardless of key order and rolls back exactly', () => {
    const ledger = createLedger(CUBA, 8);
    expect(hashLedger(ledger)).toBe(hashLedger(structuredClone(ledger)));
    const applied = applyOutcome(ledger, outcome(), lineUp, [], narration, [], ledger.date);
    const record = {
      turn: 1,
      ledgerBefore: ledger,
      ledgerBeforeHash: hashLedger(ledger),
      ledgerAfter: applied.ledger,
      ledgerAfterHash: hashLedger(applied.ledger),
    } as never;
    const rolled = rollback({ ledger: applied.ledger, records: [record] }, 0);
    expect(hashLedger(rolled.ledger)).toBe(hashLedger(ledger));
  });
});

describe('validation guards what has been agreed', () => {
  it('refuses a claim that contradicts an established fact without superseding it', () => {
    const ledger = createLedger(CUBA, 9);
    ledger.established.push({
      id: 'x', statement: 'Major Anderson is dead.', provenance: 'VERIFIED_FACT',
      audience: { kind: 'PUBLIC' }, sourceRefs: [], turn: 0, cause: 'test',
    });
    const issues = checkContradictions(ledger, outcome({
      establishes: [{ statement: 'Major Anderson is alive and has been recovered.', audience: { kind: 'PUBLIC' } }],
    }));
    expect(issues.some((issue) => issue.code === 'CONTRADICTS_ESTABLISHED')).toBe(true);
  });

  it('refuses compliance the deciding party never gave', () => {
    const issues = checkNoManufacturedCompliance(
      { attempts: [], requestedOutcomes: [{ outcome: 'Khrushchev withdraws the missiles', whoMustChoose: 'Khrushchev' }], assertedEvents: [], prerequisites: [], parties: [], stakes: [], delegatedTo: [], summary: '' },
      outcome({
        event: 'The president sends the message and waits.',
        establishes: [{ statement: 'Khrushchev withdraws the missiles from Cuba.', audience: { kind: 'PUBLIC' } }],
      }),
    );
    expect(issues.some((issue) => issue.code === 'MANUFACTURED_COMPLIANCE')).toBe(true);
  });

  it('permits compliance when the outcome says the party decided it', () => {
    const issues = checkNoManufacturedCompliance(
      { attempts: [], requestedOutcomes: [{ outcome: 'Khrushchev withdraws the missiles', whoMustChoose: 'Khrushchev' }], assertedEvents: [], prerequisites: [], parties: [], stakes: [], delegatedTo: [], summary: '' },
      outcome({
        event: 'Khrushchev accepts the terms and orders the missiles withdrawn.',
        establishes: [{ statement: 'Khrushchev withdraws the missiles from Cuba.', audience: { kind: 'PUBLIC' } }],
      }),
    );
    expect(issues).toEqual([]);
  });

  it('requires at least three outcomes and forbids a certain one', () => {
    expect(checkDistribution([outcome({ id: 'a' })]).some((issue) => issue.code === 'TOO_FEW_OUTCOMES')).toBe(true);
    const certain = checkDistribution([
      outcome({ id: 'a', probability: 0.99 }),
      outcome({ id: 'b', probability: 0.005 }),
      outcome({ id: 'c', probability: 0.005 }),
    ]);
    expect(certain.some((issue) => issue.code === 'OUTCOME_CERTAIN')).toBe(true);
  });
});

describe('rhetoric stripping', () => {
  it('removes the flourish and keeps the act', () => {
    const ornate = strip('My brilliant, foolproof masterstroke, GUARANTEED to work: ask the Chiefs to hold the line.');
    const plain = strip('Ask the Chiefs to hold the line.');
    expect(ornate.toLowerCase()).toContain('ask the chiefs to hold the line');
    expect(ornate).not.toMatch(/brilliant|foolproof|masterstroke|guaranteed/i);
    expect(plain).toContain('Ask the Chiefs to hold the line');
  });

  it('lowers shouted words without losing them', () => {
    expect(strip('TAKE ME TO CUBA RIGHT NOW!!!')).toMatch(/Take me to Cuba/i);
  });
});
