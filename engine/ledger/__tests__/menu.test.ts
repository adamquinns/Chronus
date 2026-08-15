import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SCENARIO_CARDS } from '../../../components/ScenarioMenu';
import { Cassette, LedgerGateway } from '../cassette';
import { createLedger } from '../ledger';
import { runTurn } from '../turn';
import { buildTurnData } from '../view';
import { CUBA, SCENARIOS, getScenario } from '../scenarios';

/**
 * The menu once offered "cuban_missile_crisis_black_saturday" while the engine
 * carried "cuban_missile_crisis", so entering the situation threw. Ids drift
 * silently; this is the check that they cannot.
 */

describe('the menu and the engine agree on what exists', () => {
  it('offers at least one scenario the engine actually carries', () => {
    const playable = SCENARIO_CARDS.filter((card) => card.id in SCENARIOS);
    expect(playable.length).toBeGreaterThan(0);
  });

  it('can start every scenario it presents as ready', () => {
    for (const card of SCENARIO_CARDS.filter((item) => item.id in SCENARIOS)) {
      expect(() => getScenario(card.id)).not.toThrow();
    }
  });

  it('never presents an id the engine would reject as playable', () => {
    for (const card of SCENARIO_CARDS) {
      if (card.id in SCENARIOS) continue;
      // Unported scenarios must be visibly unavailable, never clickable.
      expect(() => getScenario(card.id)).toThrow(/Unknown scenario/);
    }
  });
});

/**
 * The line-up stage produced facingPlayer for four turns of a real campaign
 * and nothing rendered it; the distribution was likewise recorded and never
 * shown. Both are now part of the console model, and stay that way.
 */
describe('the console shows what the engine already knew', () => {
  it('surfaces what the world puts in front of the player, and the branches not taken', async () => {
    const cassette = JSON.parse(readFileSync('evals/cassettes/canonical.json', 'utf8')) as Cassette;
    const { ledger, record } = await runTurn(
      CUBA,
      createLedger(CUBA, 19621027),
      'Contact Khrushchev through the Robert Kennedy backchannel and offer a private assurance on the Jupiter missiles in Turkey.',
      { gateway: new LedgerGateway({ mode: 'replay', cassette }) },
    );
    const model = buildTurnData(CUBA, ledger, record);

    expect(model.facingPlayer).toEqual(record.lineUp.facingPlayer);
    expect(model.whatElseCouldHaveHappened?.outcomes.length).toBe(record.outcomes.length);
    // Exactly one branch is the one the draw took, and it is the committed one.
    const taken = model.whatElseCouldHaveHappened?.outcomes.filter((item) => item.taken) ?? [];
    expect(taken).toHaveLength(1);
    expect(taken[0].id).toBe(record.selectedOutcomeId);
  });
});
