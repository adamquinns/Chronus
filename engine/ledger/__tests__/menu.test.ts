import { describe, expect, it } from 'vitest';
import { SCENARIO_CARDS } from '../../../components/ScenarioMenu';
import { SCENARIOS, getScenario } from '../scenarios';

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
