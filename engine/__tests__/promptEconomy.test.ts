import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_ROUTES, MODEL_PRESETS, OpenRouterGateway } from '../model';
import { actorVisibleState, authoritativeSnapshot, perceivedStrategyForActor, playerVisibleState } from '../projections';
import { compileDeterministically } from '../compiler';
import { createCubanCampaign } from '../scenarios';
import { createTwilightCampaign } from '../twilightScenario';

const HIDDEN_KEYS = ['"classification"', '"fieldVisibility"', '"detectableBy"', '"visibility"'];

describe('WP12 prompt economy and hygiene', () => {
  it('keeps engine-only visibility bookkeeping out of every model-bound projection', () => {
    for (const campaign of [createCubanCampaign(71), createTwilightCampaign(71)]) {
      const graph = compileDeterministically('Prepare a public statement.', campaign.state);
      const payloads = [
        JSON.stringify(authoritativeSnapshot(campaign.state)),
        JSON.stringify(playerVisibleState(campaign.state, campaign.beliefs)),
        JSON.stringify(actorVisibleState(
          Object.keys(campaign.state.entities).find((id) => id !== campaign.state.manifest.playerId)!,
          campaign.state,
          { actorId: 'x', beliefs: {}, knownFactIds: [] },
          perceivedStrategyForActor('x', graph),
        )),
      ];
      for (const payload of payloads) {
        for (const key of HIDDEN_KEYS) expect(payload, `payload must not contain ${key}`).not.toContain(key);
      }
    }
  });

  it('slims the adjudicator snapshot well below the raw state serialization', () => {
    const state = createTwilightCampaign(72).state;
    const slim = JSON.stringify(authoritativeSnapshot(state)).length;
    const raw = JSON.stringify({
      manifest: state.manifest,
      turn: state.turn,
      dateLabel: state.dateLabel,
      currentDateTime: state.currentDateTime,
      elapsedMinutes: state.elapsedMinutes,
      metrics: state.metrics,
      resources: state.resources,
      entities: state.entities,
      relationships: state.relationships,
      arcs: state.arcs,
      facts: state.facts,
      pendingProcesses: state.pendingProcesses,
      goal: state.goal,
    }).length;
    expect(slim).toBeLessThan(raw * 0.65);
  });

  it('exposes complete, distinct routing presets resolvable by name', () => {
    const roles = Object.keys(DEFAULT_MODEL_ROUTES);
    for (const preset of Object.values(MODEL_PRESETS)) {
      expect(Object.keys(preset).sort()).toEqual([...roles].sort());
    }
    const changedInEconomy = roles.filter((role) =>
      MODEL_PRESETS.economy[role as keyof typeof DEFAULT_MODEL_ROUTES].model
      !== MODEL_PRESETS.standard[role as keyof typeof DEFAULT_MODEL_ROUTES].model);
    expect(changedInEconomy.length).toBeGreaterThanOrEqual(3);
    const gateway = new OpenRouterGateway('sk-or-v1-test-key-that-is-long-enough-for-tests', 'economy');
    expect(gateway.routes).toEqual(MODEL_PRESETS.economy);
  });
});
