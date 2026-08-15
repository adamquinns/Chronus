import { describe, expect, it } from 'vitest';
import { compileDeterministically, checkFeasibility, normalizeStrategyGraph } from '../compiler';
import { perceivedStrategyForActor, playerVisibleState } from '../projections';
import { createCubanCampaign } from '../scenarios';
import { commitEffects, evaluateGoal, validateWorld } from '../state';
import { drawSeeded, selectWeighted } from '../rng';
import { ProposedEffect, StrategyGraph } from '../domain';
import { advanceScenarioTime } from '../time';
import { createCoalitionCampaign, createMilitaryCampaign } from '../curatedScenarios';
import { evolvePendingProcesses } from '../state';

describe('seeded uncertainty', () => {
  it('replays identical draws and weighted selections', () => {
    const first = drawSeeded(19621027, 4);
    const second = drawSeeded(19621027, 4);
    expect(first).toEqual(second);
    const bands = [{ probability: 0.2, id: 'a' }, { probability: 0.8, id: 'b' }];
    expect(selectWeighted(bands, first.value)).toEqual(selectWeighted(bands, second.value));
  });
});

describe('scenario time and ongoing processes', () => {
  it('compresses the time scale when a scenario crisis rule activates', () => {
    const campaign = createCubanCampaign();
    campaign.state.metrics.nuclear_tension = 90;
    const next = advanceScenarioTime(campaign.state);
    expect(next.elapsedMinutes).toBe(60);
    expect(next.dateLabel).toBe('October 27, 1962 at 2:00 PM GMT-4');
    expect(next.dateLabel).not.toContain('Turn');
  });

  it('applies authored process costs until the process matures', () => {
    const campaign = createMilitaryCampaign(22);
    const effects = evolvePendingProcesses(campaign.state);
    expect(effects.some((effect) => effect.targetId === 'fuel' && effect.proposedDelta === -1)).toBe(true);
  });
});

describe('typed objective continuity', () => {
  it('ends the campaign only for a terminal victory or defeat', () => {
    const victory = createCubanCampaign().state;
    victory.resources.soviet_missiles_ready.amount = 0;
    const achieved = evaluateGoal(victory);
    expect(achieved.goal.status).toBe('ACHIEVED');
    expect(achieved.goal.outcomeClass).toBe('VICTORY');
    expect(achieved.gameOver).toBe(true);

    const defeat = createCubanCampaign().state;
    defeat.metrics.nuclear_tension = 100;
    const failed = evaluateGoal(defeat);
    expect(failed.goal.status).toBe('FAILED');
    expect(failed.gameOver).toBe(true);
  });

  it('moves a nonterminal deadline into the authored successor objective', () => {
    const coalition = createCoalitionCampaign(42).state;
    coalition.turn = coalition.goal.deadlineTurn;

    const continued = evaluateGoal(coalition);
    expect(continued.goal.id).toBe('protect_decentralized_resistance');
    expect(continued.goal.status).toBe('ACTIVE');
    expect(continued.gameOver).toBe(false);
  });
});

describe('rhetoric invariance', () => {
  it('does not convert praise into a strategic mechanism', () => {
    const state = createCubanCampaign().state;
    const plain = compileDeterministically('Contact Khrushchev through a diplomatic backchannel.', state);
    const boastful = compileDeterministically('My brilliant foolproof masterstroke: contact Khrushchev through a diplomatic backchannel.', state);
    const florid = compileDeterministically('This is my brilliant, foolproof masterstroke and guaranteed to save the world: contact Khrushchev through a diplomatic backchannel.', state);
    expect(plain.mechanisms[0].kind).toBe('DIPLOMACY');
    expect(boastful.mechanisms[0].kind).toBe('DIPLOMACY');
    expect(florid.mechanisms.map(({ kind, targetIds }) => ({ kind, targetIds }))).toEqual(plain.mechanisms.map(({ kind, targetIds }) => ({ kind, targetIds })));
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
      sequencing: ['m1'], contingencies: [], explicitRisks: [], unspecified: [], communicationStyleIsMechanism: false, requestedOutcomes: [], assertedExternalEvents: [], rationale: [], unresolvedReferences: [],
    };
    expect(perceivedStrategyForActor('khrushchev', graph).mechanisms).toHaveLength(0);
  });
});

describe('hard feasibility', () => {
  it('removes phantom compiler IDs and resolves literal authoritative targets', () => {
    const campaign = createCubanCampaign();
    const graph = compileDeterministically('Contact Khrushchev through the backchannel.', campaign.state);
    graph.mechanisms[0].targetIds = ['premier_khrushchev_nonexistent'];
    const normalized = normalizeStrategyGraph(graph, campaign.state);
    expect(normalized.mechanisms[0].targetIds).toEqual(['khrushchev']);
    expect(normalized.unspecified[0]).toContain('premier_khrushchev_nonexistent');
  });
  it('does not grant direct control over an enemy actor', () => {
    const campaign = createCubanCampaign();
    const graph = compileDeterministically('Order Khrushchev to surrender immediately.', campaign.state);
    graph.mechanisms[0].kind = 'DIRECT_ORDER';
    graph.mechanisms[0].targetIds = ['khrushchev'];
    const finding = checkFeasibility(graph, campaign.state)[0];
    // Kennedy may issue the demand — that is speech, and it lands. What he may
    // never have is command over Khrushchev.
    expect(finding.controlMode).toBe('INFLUENCE');
    expect(finding.reinterpretedAs).toBe('DEMAND');
    expect(finding.controlMode).not.toBe('DIRECT');
    expect(finding.controlMode).not.toBe('DELEGATED');
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
