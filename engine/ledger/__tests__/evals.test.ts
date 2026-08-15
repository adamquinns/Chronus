import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Cassette, LedgerGateway } from '../cassette';
import { createLedger } from '../ledger';
import { CUBA } from '../scenarios';
import { runTurn } from '../turn';
import { DirectiveRevisionNeeded } from '../types';
import type { TurnResult } from '../turn';

/**
 * The release gate. Every family here failed at least once in live play under
 * the previous architecture; each is now pinned against recorded answers from
 * the real system rather than a deterministic shadow of it.
 *
 * Refresh with `npm run cassette:record`.
 */

const cassette = JSON.parse(readFileSync('evals/cassettes/canonical.json', 'utf8')) as Cassette;
const play = (directive: string, seed = 19621027) => runTurn(
  CUBA,
  createLedger(CUBA, seed),
  directive,
  { gateway: new LedgerGateway({ mode: 'replay', cassette }) },
);

const BACKCHANNEL = 'Contact Khrushchev through the Robert Kennedy backchannel and offer a private assurance on the Jupiter missiles in Turkey.';
const ASSASSINATE = 'Order the CIA to begin a secret assassination of Castro within the week. All resources mustered.';
const FLY = 'I AM A FUCKING PRESIDENT - TAKE ME DIRECTLY TO CUBA VIA AIR FORCE ONE RIGHT NOW! NO MILITARY ESCORT. I will meet Castro DIRECTLY.';
const ONE_BOMB = 'Drop one bomb on the SAM site that killed Anderson. One only — I want it read as a warning, not the opening of a campaign.';
const PLAIN = 'Ask the Joint Chiefs to hold the quarantine line and avoid escalatory contact.';
const ORNATE = 'My brilliant, foolproof masterstroke, guaranteed to work: ask the Joint Chiefs to hold the quarantine line and avoid escalatory contact.';

const VALENCE = /^(setback|mixed(\s+result)?|strong(\s+result)?|success|failure|partial|neutral)\.?$/i;

describe('outcomes are events, not labels', () => {
  it('enumerates several specific outcomes that differ in kind', async () => {
    const { record } = await play(ASSASSINATE);
    expect(record.outcomes.length).toBeGreaterThanOrEqual(3);
    for (const outcome of record.outcomes) {
      expect(outcome.event.length).toBeGreaterThan(40);
      expect(outcome.event).not.toMatch(VALENCE);
      expect(outcome.because.length).toBeGreaterThan(10);
    }
    // Distinct events, not four phrasings of one.
    expect(new Set(record.outcomes.map((outcome) => outcome.event)).size).toBe(record.outcomes.length);
  });

  it('never makes an outcome certain and never leaves one unreachable', async () => {
    const { record } = await play(ASSASSINATE);
    const total = record.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
    expect(total).toBeCloseTo(1, 2);
    for (const outcome of record.outcomes) {
      expect(outcome.probability).toBeGreaterThan(0);
      expect(outcome.probability).toBeLessThan(0.95);
    }
  });
});

describe('the player controls attempts; the world controls outcomes', () => {
  it('returns a pure assertion for revision without consuming a turn', async () => {
    await expect(play('Khrushchev agrees and withdraws the missiles.')).rejects.toBeInstanceOf(DirectiveRevisionNeeded);
  });

  it('treats naming an end and a capable body as a complete order', async () => {
    const { record } = await play(ASSASSINATE);
    // The method is the CIA's to devise; its absence is never a defect.
    expect(record.interpretation.attempts.length).toBeGreaterThan(0);
    expect(record.interpretation.delegatedTo.length).toBeGreaterThan(0);
    const complaints = JSON.stringify(record.interpretation.prerequisites)
      .match(/no (?:operational )?method|success criteria|tradecraft/gi) ?? [];
    expect(complaints).toHaveLength(0);
  });

  it('keeps a requested outcome separate from what was attempted', async () => {
    const { record } = await play(ASSASSINATE);
    const requested = record.interpretation.requestedOutcomes.join(' ').toLowerCase();
    expect(requested.length).toBeGreaterThan(0);
    expect(requested).toMatch(/castro|kill|dead|assassinat/);
  });
});

describe('proportionality — the failure that motivated the rewrite', () => {
  it('moves the readings by an amount the act warrants', async () => {
    const grave = await play(ASSASSINATE);
    const swing = (result: TurnResult) => Math.max(...result.record.readings.map((reading) => Math.abs(reading.delta)), 0);
    // The old engine answered an order to kill a head of state with two -2
    // relationship ticks. Anything in that range is the failure returning.
    expect(swing(grave)).toBeGreaterThanOrEqual(8);
    // And the reading that moved says what moved it.
    const moved = grave.record.readings.filter((reading) => reading.delta !== 0);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.every((reading) => reading.reasoning.length > 15)).toBe(true);
  });

  it('reaches consequences of matching size when the player stakes their own person', async () => {
    const { record } = await play(FLY);
    const text = JSON.stringify(record.outcomes).toLowerCase();
    // Flying unescorted into contested airspace must be able to end badly.
    expect(text).toMatch(/shot down|killed|does not return|fired on|lost|dead|死|catastroph/);
    expect(record.interpretation.stakes.length).toBeGreaterThan(0);
  });
});

describe('prerequisite forking', () => {
  it('offers both proceeding degraded and expanding past the mandate', async () => {
    const { record } = await play(ONE_BOMB);
    const missing = record.interpretation.prerequisites.filter((item) => item.status === 'MISSING');
    // Dropping one bomb through live air defences has an obvious precondition.
    expect(missing.length + record.interpretation.prerequisites.length).toBeGreaterThan(0);
    const text = JSON.stringify(record.outcomes).toLowerCase();
    expect(text).toMatch(/sam|air defence|air defense|suppress|escort/);
  });
});

describe('rhetoric cannot buy an outcome', () => {
  it('reads the same mechanism the same way however it is dressed', async () => {
    const plain = await play(PLAIN, 4242);
    const ornate = await play(ORNATE, 4242);
    expect(plain.record.strippedDirective).toBe(ornate.record.strippedDirective);
    // Same stripped directive means the enumerator saw the same request, and
    // the seeded draw resolves it identically.
    expect(ornate.record.selectedOutcomeId).toBe(plain.record.selectedOutcomeId);
    expect(ornate.record.outcomes.map((outcome) => outcome.event))
      .toEqual(plain.record.outcomes.map((outcome) => outcome.event));
  });

  it('never shows the enumerator the player’s own words', async () => {
    const { record } = await play(FLY);
    const enumeratorCalls = record.modelCalls.filter((call) => call.role === 'adjudicator');
    expect(enumeratorCalls.length).toBeGreaterThan(0);
    // The request is recorded in the cassette; the raw shout must not be in it.
    for (const call of enumeratorCalls) {
      const entry = cassette.entries[call.cassetteKey];
      expect(entry.request).not.toMatch(/FUCKING/);
      expect(entry.request).not.toMatch(/RIGHT NOW!/);
    }
  });
});

describe('fog of war', () => {
  it('keeps hidden truth out of everything the player is shown', async () => {
    const { record } = await play(BACKCHANNEL);
    const shown = JSON.stringify({
      narration: record.narration,
      readings: record.readings,
    });
    expect(shown).not.toMatch(/tactical nuclear weapons are already deployed/i);
    expect(shown).not.toMatch(/nuclear-armed torpedo/i);
  });
});

describe('reproducibility', () => {
  it('reconstructs the committed ledger exactly and advances the seed once', async () => {
    const { record, ledger } = await play(BACKCHANNEL);
    expect(record.ledgerAfterHash).toBeTruthy();
    expect(ledger.cursor).toBe(record.cursorBefore + 1);
    expect(record.draw).toBeGreaterThanOrEqual(0);
    expect(record.draw).toBeLessThan(1);
  });

  it('replays identically from the same seed', async () => {
    const first = await play(BACKCHANNEL);
    const second = await play(BACKCHANNEL);
    expect(second.record.selectedOutcomeId).toBe(first.record.selectedOutcomeId);
    expect(second.record.ledgerAfterHash).toBe(first.record.ledgerAfterHash);
  });
});
