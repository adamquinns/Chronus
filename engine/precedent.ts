import { Campaign, CausalPrecedent, ProposedEffect, StrategyGraph, WorldState } from './domain';

export const retrievePrecedents = (campaign: Campaign, graph: StrategyGraph, limit = 12): CausalPrecedent[] => {
  const currentKinds = new Set(graph.mechanisms.map((mechanism) => mechanism.kind));
  const results: CausalPrecedent[] = [];
  for (const audit of [...campaign.audits].reverse()) {
    const kindsByMechanism = new Map(audit.dryStrategy.mechanisms.map((mechanism) => [mechanism.id, mechanism.kind]));
    for (const change of audit.stateChanges) {
      const effect = audit.adjudication.recommendedEffects.find((item) => item.id === change.sourceEffectId);
      const mechanismKind = kindsByMechanism.get(effect?.mechanismId ?? '');
      if (!mechanismKind || !currentKinds.has(mechanismKind)) continue;
      results.push({
        turn: audit.turn,
        mechanismKind,
        targetId: change.targetId,
        field: change.field,
        impactClass: change.impactClass,
        appliedDelta: change.appliedDelta,
        cause: change.cause,
        contextualDifference: 'Prior event in the same simulation; compare current resources, actors, and escalation state.',
      });
      if (results.length >= limit) return results;
    }
  }
  return results;
};

export const historicalPriorWeight = (state: WorldState) => {
  const simulatedFacts = Object.values(state.facts).filter((fact) => fact.provenance === 'SIMULATED_POST_DIVERGENCE').length;
  return Math.max(0.1, Math.min(1, 1 - state.turn * 0.06 - simulatedFacts * 0.025));
};

export const autonomousWorldEffects = (state: WorldState): ProposedEffect[] => Object.values(state.arcs)
  .filter((arc) => arc.status === 'ACTIVE')
  .map((arc, index): ProposedEffect => {
    const urgent = arc.dueTurn !== undefined && arc.dueTurn <= state.turn + 2;
    return {
      id: `autonomous_arc_${state.turn + 1}_${index + 1}`,
      mechanismId: `autonomous_${arc.ownerId ?? 'world'}`,
      targetType: 'ARC',
      targetId: arc.id,
      field: 'progress',
      direction: arc.direction === 'FALLING' ? 'NEGATIVE' : arc.direction === 'RISING' ? 'POSITIVE' : 'NEUTRAL',
      impactClass: urgent ? 'MINOR' : 'TRIVIAL',
      confidence: 'VERY_HIGH',
      engagement: 'ENGAGES',
      cause: `${arc.title} advances independently as time passes.`,
      dependencies: [],
      actorId: arc.ownerId,
    };
  });
