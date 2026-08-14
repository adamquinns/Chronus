import { Campaign, CausalPrecedent, ProposedEffect, StrategyGraph, WorldState } from './domain';

export const retrievePrecedents = (campaign: Campaign, graph: StrategyGraph, limit = 12): CausalPrecedent[] => {
  const currentKinds = new Set(graph.mechanisms.map((mechanism) => mechanism.kind));
  const currentActors = new Set(graph.mechanisms.flatMap((mechanism) => [...mechanism.actorIds, ...mechanism.targetIds]));
  const internal: CausalPrecedent[] = [];
  for (const audit of [...campaign.audits].reverse()) {
    const kindsByMechanism = new Map(audit.dryStrategy.mechanisms.map((mechanism) => [mechanism.id, mechanism.kind]));
    const actorsByMechanism = new Map(audit.dryStrategy.mechanisms.map((mechanism) => [mechanism.id, [...mechanism.actorIds, ...mechanism.targetIds]]));
    for (const change of audit.stateChanges) {
      const effect = audit.adjudication.recommendedEffects.find((item) => item.id === change.sourceEffectId);
      const mechanismKind = kindsByMechanism.get(effect?.mechanismId ?? '');
      if (!mechanismKind || !currentKinds.has(mechanismKind)) continue;
      const actorOverlap = (actorsByMechanism.get(effect?.mechanismId ?? '') ?? []).filter((id) => currentActors.has(id)).length;
      const targetMatch = graph.mechanisms.some((mechanism) => mechanism.targetIds.includes(change.targetId));
      const escalationId = campaign.state.manifest.metricRoles?.escalation;
      const dangerIds = campaign.state.manifest.metricDefinitions.filter((definition) => definition.dangerAbove !== undefined || definition.dangerBelow !== undefined).map((definition) => definition.id);
      const distances = escalationId
        ? [Math.abs((audit.previousStateSnapshot?.metrics[escalationId] ?? campaign.state.metrics[escalationId]) - campaign.state.metrics[escalationId])]
        : dangerIds.map((id) => Math.abs((audit.previousStateSnapshot?.metrics[id] ?? campaign.state.metrics[id]) - campaign.state.metrics[id]));
      const crisisDistance = distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 25;
      internal.push({
        source: 'INTERNAL',
        sourceId: audit.id,
        relevanceScore: 5 + (targetMatch ? 3 : 0) + Math.min(2, actorOverlap) + Math.max(0, 2 - crisisDistance / 20),
        turn: audit.turn,
        mechanismKind,
        targetId: change.targetId,
        field: change.field,
        impactClass: change.impactClass,
        appliedDelta: change.appliedDelta,
        cause: change.cause,
        contextualDifference: `Same-world event; actor overlap ${actorOverlap}, target ${targetMatch ? 'matches' : 'differs'}, crisis-distance ${crisisDistance.toFixed(0)}.`,
      });
    }
  }
  const analogs: CausalPrecedent[] = campaign.state.manifest.historicalAnalogs
    .filter((analog) => currentKinds.has(analog.mechanismKind))
    .map((analog) => ({
      source: 'HISTORICAL_ANALOG',
      sourceId: analog.id,
      relevanceScore: 6 + (graph.mechanisms.some((mechanism) => mechanism.targetIds.includes(analog.targetId)) ? 2 : 0),
      turn: 0,
      mechanismKind: analog.mechanismKind,
      targetId: analog.targetId,
      field: 'value',
      impactClass: analog.impactClass,
      cause: analog.label,
      contextualDifference: `${analog.context} Compare scale, institutions, actors, starting state, and time horizon before applying.`,
    }));
  const sameWorldWeight = Math.min(1, campaign.state.turn / 6);
  return [...analogs, ...internal]
    .sort((a, b) => {
      const weightedA = a.relevanceScore * (a.source === 'INTERNAL' ? sameWorldWeight : 1 - sameWorldWeight * 0.5);
      const weightedB = b.relevanceScore * (b.source === 'INTERNAL' ? sameWorldWeight : 1 - sameWorldWeight * 0.5);
      return weightedB - weightedA || b.turn - a.turn;
    })
    .slice(0, limit);
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
