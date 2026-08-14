import { describe, expect, it } from 'vitest';
import { compileDeterministically, checkFeasibility } from '../compiler';
import { perceivedStrategyForActor, playerVisibleState } from '../projections';
import { createCubanCampaign } from '../scenarios';
import { commitEffects, validateWorld } from '../state';
import { drawSeeded, selectWeighted } from '../rng';
import { ProposedEffect, StrategyGraph } from '../domain';

describe('seeded uncertainty', () => {
  it('replays identical draws and weighted selections', () => {
    const first = drawSeeded(19621027, 4);
    const second = drawSeeded(19621027, 4);
    expect(first).toEqual(second);
    const bands = [{ probability: 0.2, id: 'a' }, { probability: 0.8, id: 'b' }];
    expect(selectWeighted(bands, first.value)).toEqual(selectWeighted(bands, second.value));
  });
});

describe('rhetoric invariance', () => {
  it('does not convert praise into a strategic mechanism', () => {
    const state = createCubanCampaign().state;
    const plain = compileDeterministically('Contact Khrushchev through a diplomatic backchannel.', state);
    const boastful = compileDeterministically('My brilliant foolproof masterstroke: contact Khrushchev through a diplomatic backchannel.', state);
    expect(plain.mechanisms[0].kind).toBe('DIPLOMACY');
    expect(boastful.mechanisms[0].kind).toBe('DIPLOMACY');
    expect(JSON.stringify(boastful)).not.toMatch(/brilliant|foolproof|masterstroke/i);
  });
});

describe('information boundaries', () => {
  it('does not expose hidden existing truths in the player packet', () => {
    const campaign = createCubanCampaign();
    const packet = JSON.stringify(playerVisibleState(campaign.state, campaign.beliefs));
    expect(packet).not.toContain('tactical nuclear weapons are deployed');
    expect(packet).not.toContain('nuclear-armed torpedo');
    expect(packet).toContain('U-2 was shot down');
  });

  it('does not reveal secret intelligence or deception to its target automatically', () => {
    const graph: StrategyGraph = {
      objective: 'Learn Soviet readiness without detection',
      mechanisms: [{
        id: 'm1', kind: 'INTELLIGENCE', objective: 'Covertly inspect readiness', targetIds: ['khrushchev'], actorIds: ['kennedy'],
        dependencies: [], assumptions: [], sequence: 0, durationTurns: 1, resourceClaims: [], specifiedDetail: 'covert collection',
      }],
      sequencing: ['m1'], contingencies: [], explicitRisks: [], unspecified: [], communicationStyleIsMechanism: false,
    };
    expect(perceivedStrategyForActor('khrushchev', graph).mechanisms).toHaveLength(0);
  });
});

describe('hard feasibility', () => {
  it('does not grant direct control over an enemy actor', () => {
    const campaign = createCubanCampaign();
    const graph = compileDeterministically('Order Khrushchev to surrender immediately.', campaign.state);
    graph.mechanisms[0].kind = 'DIRECT_ORDER';
    graph.mechanisms[0].targetIds = ['khrushchev'];
    const finding = checkFeasibility(graph, campaign.state)[0];
    expect(finding.feasible).toBe(false);
    expect(finding.classification).toBe('IMPOSSIBLE');
  });

  it('rejects unavailable resources instead of rolling for them', () => {
    const campaign = createCubanCampaign();
    const graph = compileDeterministically('Transfer reconnaissance resources.', campaign.state);
    graph.mechanisms[0].kind = 'RESOURCE_TRANSFER';
    graph.mechanisms[0].resourceClaims = [{ resourceId: 'recon_sorties', amount: 99 }];
    const finding = checkFeasibility(graph, campaign.state)[0];
    expect(finding.feasible).toBe(false);
  });
});

describe('authoritative commitment and provenance', () => {
  it('applies bounded effects and retains attributable causes', () => {
    const campaign = createCubanCampaign();
    const proposed: ProposedEffect = {
      id: 'effect_test', mechanismId: 'm1', targetType: 'METRIC', targetId: 'diplomatic_space', field: 'value',
      direction: 'POSITIVE', impactClass: 'MODERATE', confidence: 'HIGH', engagement: 'ENGAGES',
      cause: 'A credible backchannel opens negotiating room.', dependencies: [],
    };
    const result = commitEffects(campaign.state, [proposed]);
    expect(result.state.metrics.diplomatic_space).toBeGreaterThan(campaign.state.metrics.diplomatic_space);
    expect(result.changes[0].cause).toBe(proposed.cause);
    expect(result.changes[0].sourceEffectId).toBe(proposed.id);
    expect(result.issues).toEqual([]);
  });

  it('never permits a resource below zero', () => {
    const campaign = createCubanCampaign();
    const proposed: ProposedEffect = {
      id: 'effect_spend', mechanismId: 'm1', targetType: 'RESOURCE', targetId: 'political_capital', field: 'amount',
      direction: 'NEGATIVE', impactClass: 'SYSTEMIC', confidence: 'VERY_HIGH', engagement: 'ENGAGES', cause: 'Authorized expenditure.',
      dependencies: [], proposedDelta: -500,
    };
    const result = commitEffects(campaign.state, [proposed]);
    expect(result.state.resources.political_capital.amount).toBe(0);
    expect(validateWorld(result.state)).toEqual([]);
  });
});
