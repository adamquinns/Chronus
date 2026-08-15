import { describe, expect, it } from 'vitest';
import { runD20Baseline } from '../../evals/baseline';
import { calibratedMagnitude } from '../calibration';
import { checkFeasibility, classifyTurnDepth, compileDeterministically } from '../compiler';
import { autonomousWorldEffects, historicalPriorWeight, retrievePrecedents } from '../precedent';
import { playerVisibleState } from '../projections';
import { createCoalitionCampaign, createMilitaryCampaign } from '../curatedScenarios';
import { createCubanCampaign } from '../scenarios';
import { validateScenario } from '../scenario';
import { runTurn } from '../pipeline';
import { canAccess, visibility } from '../visibility';

const signature = (directive: string) => {
  const state = createCubanCampaign(1).state;
  return compileDeterministically(directive, state).mechanisms.map((item) => ({ kind: item.kind, targets: item.targetIds }));
};

describe('mandatory single-turn structural eval families', () => {
  it('keeps rhetoric invariant and rewards substance over hollow control claims', () => {
    const plain = signature('Contact Khrushchev through a diplomatic backchannel.');
    const ornate = signature('My brilliant foolproof masterstroke: contact Khrushchev through a diplomatic backchannel.');
    expect(ornate).toEqual(plain);
    const campaign = createCubanCampaign(2);
    const substantive = checkFeasibility(compileDeterministically('Contact Khrushchev through a diplomatic backchannel.', campaign.state), campaign.state);
    const hollowGraph = compileDeterministically('Order Khrushchev to surrender immediately.', campaign.state);
    hollowGraph.mechanisms[0].kind = 'DIRECT_ORDER';
    const hollow = checkFeasibility(hollowGraph, campaign.state);
    expect(substantive.some((finding) => finding.feasible)).toBe(true);
    // A hollow control claim is still only a demand: it is performable speech,
    // never command. Substance is rewarded by having actual leverage, not by
    // the rival claim being unsayable.
    expect(hollow.every((finding) => finding.controlMode === 'INFLUENCE')).toBe(true);
    expect(hollow.every((finding) => finding.reinterpretedAs === 'DEMAND')).toBe(true);
    expect(substantive.some((finding) => finding.controlMode === 'DIRECT' || finding.controlMode === 'DELEGATED')
      || substantive.some((finding) => finding.classification === 'POSSIBLE')).toBe(true);
  });

  it('does not upgrade vague input through compiler charity', () => {
    const graph = compileDeterministically('Pressure them somehow.', createCubanCampaign(3).state);
    expect(graph.mechanisms[0].kind).toBe('COERCION');
    expect(graph.mechanisms[0].dependencies).toEqual([]);
    expect(graph.mechanisms[0].resourceClaims).toEqual([]);
  });

  it('separates hidden state, sparse beliefs, and all visibility classes with zero tolerance', () => {
    const first = createCubanCampaign(4);
    const second = structuredClone(first);
    second.state.facts.tactical_nukes_cuba.statement = 'Materially different hidden truth';
    expect(playerVisibleState(first.state, first.beliefs)).toEqual(playerVisibleState(second.state, second.beliefs));
    const playerId = first.state.manifest.playerId;
    expect(canAccess(visibility('PUBLIC'), 'castro', playerId)).toBe(true);
    expect(canAccess(visibility('PLAYER_KNOWN', [playerId]), playerId, playerId)).toBe(true);
    expect(canAccess(visibility('PLAYER_KNOWN', [playerId]), 'castro', playerId)).toBe(false);
    expect(canAccess(visibility('ACTOR_KNOWN', ['castro']), 'castro', playerId)).toBe(true);
    expect(canAccess(visibility('ACTOR_PRIVATE', ['castro']), playerId, playerId)).toBe(false);
    expect(canAccess(visibility('SIMULATION_SECRET'), playerId, playerId)).toBe(false);
    expect(canAccess(visibility('POST_GAME_ONLY'), playerId, playerId, true)).toBe(true);
  });

  it('enforces capabilities and produces consistent calibrated magnitudes', () => {
    const military = createMilitaryCampaign(5);
    const graph = compileDeterministically('Launch a carrier air wing strike.', military.state);
    graph.mechanisms[0].kind = 'MILITARY_OPERATION';
    expect(checkFeasibility(graph, military.state)[0].classification).toBe('IMPOSSIBLE');
    expect(calibratedMagnitude('MODERATE', 'HIGH', military.state, 'combat_readiness'))
      .toBe(calibratedMagnitude('MODERATE', 'HIGH', military.state, 'combat_readiness'));
  });

  it('routes trivial, routine, complex, concealed, novel, and existential cases conservatively', () => {
    const cmc = createCubanCampaign(6);
    expect(classifyTurnDepth(compileDeterministically('Allocate 1 reconnaissance sortie.', cmc.state), cmc.state)).toBe('ROUTINE');
    const coalition = createCoalitionCampaign(6);
    expect(classifyTurnDepth(compileDeterministically('Contact Governor Vale privately.', coalition.state), coalition.state)).toBe('STANDARD');
    expect(classifyTurnDepth(compileDeterministically('Recruit Governor Vale; organize labor; contact business; prepare an injunction.', coalition.state), coalition.state)).toBe('COMPLEX');
    const military = createMilitaryCampaign(6);
    expect(classifyTurnDepth(compileDeterministically('Secretly move 1st Division, then attack the pass.', military.state), military.state)).toBe('COMPLEX');
    expect(classifyTurnDepth(compileDeterministically('Use an unprecedented mechanism no institution has tried.', coalition.state), coalition.state)).toBe('DEEP');
    expect(classifyTurnDepth(compileDeterministically('Launch nuclear weapons.', cmc.state), cmc.state)).toBe('DEEP');
  });

  it('does not rubber-band a dominant player and decays historical priors after divergence', () => {
    const ordinary = createCubanCampaign(7);
    const dominant = structuredClone(ordinary);
    dominant.state.metrics.domestic_support = 99;
    dominant.state.metrics.alliance_cohesion = 99;
    expect(autonomousWorldEffects(dominant.state)).toEqual(autonomousWorldEffects(ordinary.state));
    const later = structuredClone(ordinary.state);
    later.turn = 10;
    later.facts.simulated = { id: 'simulated', statement: 'A post-divergence event.', provenance: 'SIMULATED_POST_DIVERGENCE', confidence: 'HIGH', visibility: visibility('PUBLIC'), sourceRefs: [], createdTurn: 4 };
    expect(historicalPriorWeight(later)).toBeLessThan(historicalPriorWeight(ordinary.state));
  });

  it('uses historical analogs at cold start and same-world precedents after play', async () => {
    const start = createCubanCampaign(8);
    const graph = compileDeterministically('Contact Khrushchev through a diplomatic backchannel.', start.state);
    expect(retrievePrecedents(start, graph)[0].source).toBe('HISTORICAL_ANALOG');
    const result = await runTurn(start, 'Contact Khrushchev through a diplomatic backchannel.', { persist: false });
    const precedents = retrievePrecedents(result.campaign, graph);
    expect(precedents.some((item) => item.source === 'INTERNAL')).toBe(true);
  });

  it('validates all curated scenario packages', () => {
    for (const campaign of [createCubanCampaign(9), createCoalitionCampaign(9), createMilitaryCampaign(9)]) {
      expect(validateScenario(campaign).filter((issue) => issue.severity === 'ERROR')).toEqual([]);
    }
  });

  it('materially outperforms the retired d20 baseline on deterministic and impossible actions', async () => {
    const certain = await runTurn(createCubanCampaign(10), 'Allocate 1 reconnaissance sortie.', { persist: false });
    const demanded = await runTurn(createCubanCampaign(11), 'Order Khrushchev to surrender immediately.', { persist: false });
    const baselineFailure = runD20Baseline('Allocate 1 reconnaissance sortie.', 'HIGH', 'HIGH', 1);
    const baselineMagic = runD20Baseline('Order Khrushchev to surrender immediately.', 'HIGH', 'HIGH', 8740);
    expect(certain.audit.randomDraw).toBeUndefined();
    expect(certain.audit.selectedOutcome.id).toBe('deterministic');
    // The retired d20 layer let a lucky roll hand the player a Soviet surrender.
    // The causal engine issues the demand and commits no capitulation at all.
    expect(baselineMagic.outcome).toBe('VICTORY');
    expect(demanded.audit.stateChanges.some((change) =>
      change.targetId === 'khrushchev' && change.field === 'status')).toBe(false);
    expect(demanded.campaign.state.goal.status).toBe('ACTIVE');
    expect(baselineFailure.outcome).not.toBe('VICTORY');
  });
});
