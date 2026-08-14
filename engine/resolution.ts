import {
  ActorAction,
  Adjudication,
  BeliefState,
  Campaign,
  ActorSimulationAudit,
  CausalPrecedent,
  EffectRecommendation,
  FeasibilityFinding,
  RedTeamFinding,
  StrategyGraph,
  TurnDepth,
  TurnNarrative,
  WorldState,
} from './domain';
import { normalizeDistribution } from './calibration';
import { ModelGateway } from './model';
import { actorActionsSchema, adjudicationSchema, narrativeSchema, redTeamSchema } from './schemas';
import { actorVisibleState, authoritativeSnapshot, perceivedStrategyForActor, playerVisibleState } from './projections';
import { historicalPriorWeight } from './precedent';
import { canAccess } from './visibility';

const relevantActorIds = (graph: StrategyGraph, state: WorldState, depth: TurnDepth) => {
  const ids = new Set<string>();
  for (const mechanism of graph.mechanisms) {
    mechanism.targetIds.forEach((id) => ids.add(id));
  }
  Object.values(state.arcs)
    .filter((arc) => arc.status === 'ACTIVE' && arc.ownerId)
    .sort((a, b) => b.progress - a.progress)
    .forEach((arc) => ids.add(arc.ownerId!));
  ids.delete(state.manifest.playerId);
  const limit = depth === 'DEEP' ? 4 : depth === 'COMPLEX' ? 3 : depth === 'STANDARD' ? 2 : 1;
  return [...ids].filter((id) => state.entities[id]?.status === 'ACTIVE' || state.entities[id]?.status === 'DEGRADED').slice(0, limit);
};

const fallbackActorAction = (actorId: string, state: WorldState, graph: StrategyGraph): ActorAction => {
  const actor = state.entities[actorId];
  const perceived = perceivedStrategyForActor(actorId, graph);
  return {
    actorId,
    objective: actor.objectives[0] ?? 'Preserve position',
    action: perceived.mechanisms.length
      ? `${actor.name} prepares a response using ${actor.capabilities[0] ?? 'available influence'}.`
      : `${actor.name} continues pursuing ${actor.objectives[0] ?? 'its standing objective'}.`,
    mechanisms: [actor.capabilities[0] ?? 'institutional action'],
    perceivedPlayerMechanismIds: perceived.mechanisms.map((item) => item.id),
    beliefKeysUsed: [],
    capabilityIdsUsed: actor.capabilities.slice(0, 1),
    confidence: 'MEDIUM',
  };
};

export const simulateActors = async (
  graph: StrategyGraph,
  state: WorldState,
  beliefs: BeliefState,
  depth: TurnDepth,
  gateway?: ModelGateway,
  memories?: Campaign['memories'],
): Promise<{ actions: ActorAction[]; packets: ActorSimulationAudit[] }> => {
  const actorIds = relevantActorIds(graph, state, depth);
  if (!gateway) {
    const packets = actorIds.map((actorId) => {
      const perceived = perceivedStrategyForActor(actorId, graph);
      const input = actorVisibleState(actorId, state, beliefs.actors[actorId] ?? { actorId, beliefs: {}, knownFactIds: [] }, perceived, memories?.[actorId]);
      return { actorId, input, output: [fallbackActorAction(actorId, state, graph)] };
    });
    return { actions: packets.flatMap((packet) => packet.output), packets };
  }
  const packets: ActorSimulationAudit[] = [];
  const results = await Promise.all(actorIds.map(async (actorId) => {
    const perceived = perceivedStrategyForActor(actorId, graph);
    const packet = actorVisibleState(
      actorId,
      state,
      beliefs.actors[actorId] ?? { actorId, beliefs: {}, knownFactIds: [] },
      perceived,
      memories?.[actorId],
    );
    const role = depth === 'DEEP' ? 'actor_deep' : 'actor_standard';
    let result;
    try {
      result = await gateway.callJson(role, [
        {
          role: 'system',
          content: 'Simulate exactly the supplied actor. Use only this packet. Pursue its objectives from its beliefs, capabilities, and constraints. Never infer hidden player mechanisms or facts absent from the packet. Return one concise action in actions.',
        },
        { role: 'user', content: JSON.stringify(packet) },
      ], actorActionsSchema, 'ActorActions');
    } catch {
      const output = [fallbackActorAction(actorId, state, graph)];
      packets.push({ actorId, input: packet, output });
      return output;
    }
    const allowedCapabilities = new Set(state.entities[actorId].capabilities);
    const allowedPerceivedMechanisms = new Set(perceived.mechanisms.map((mechanism) => mechanism.id));
    const allowedBeliefs = new Set(Object.keys((beliefs.actors[actorId] ?? { beliefs: {} }).beliefs));
    const output = result.value.actions
      .filter((action) => action.actorId === actorId)
      .map((action) => ({
        ...action,
        capabilityIdsUsed: action.capabilityIdsUsed.filter((capability) => allowedCapabilities.has(capability)),
        perceivedPlayerMechanismIds: action.perceivedPlayerMechanismIds.filter((id) => allowedPerceivedMechanisms.has(id)),
        beliefKeysUsed: action.beliefKeysUsed.filter((key) => allowedBeliefs.has(key)),
      }))
      .filter((action) => action.capabilityIdsUsed.length > 0 || action.mechanisms.length === 0)
      .slice(0, 1);
    packets.push({ actorId, input: packet, output });
    return output;
  }));
  return { actions: results.flat(), packets: packets.sort((a, b) => actorIds.indexOf(a.actorId) - actorIds.indexOf(b.actorId)) };
};

export const runRedTeam = async (
  graph: StrategyGraph,
  feasibility: FeasibilityFinding[],
  actorActions: ActorAction[],
  state: WorldState,
  precedents: CausalPrecedent[] = [],
  gateway?: ModelGateway,
): Promise<RedTeamFinding[]> => {
  if (!gateway) {
    return feasibility.filter((item) => !item.feasible).map((item) => ({
      category: 'HIDDEN_DEPENDENCY' as const,
      severity: item.classification === 'IMPOSSIBLE' ? 'BLOCKING' as const : 'WARNING' as const,
      claim: item.hardConstraints.join(' '),
      evidence: item.reasons,
      affectedMechanismIds: [item.mechanismId],
    }));
  }
  try {
    const result = await gateway.callJson('critic', [
      {
        role: 'system',
        content: 'Red-team a dry strategy against authoritative state. Look for compiler charity, omitted dependencies, omniscience, unavailable capability, unsupported surprise, second-order effects, and magnitude drift. Do not improve the plan or decide the outcome.',
      },
      { role: 'user', content: JSON.stringify({ strategy: graph, feasibility, actorActions, causalPrecedents: precedents, authoritativeState: authoritativeSnapshot(state) }) },
    ], redTeamSchema, 'RedTeamFindings');
    return result.value.findings;
  } catch {
    return feasibility.filter((item) => !item.feasible).map((item) => ({
      category: 'HIDDEN_DEPENDENCY', severity: item.classification === 'IMPOSSIBLE' ? 'BLOCKING' : 'WARNING',
      claim: item.hardConstraints.join(' ') || 'A feasibility constraint was detected.', evidence: item.reasons, affectedMechanismIds: [item.mechanismId],
    }));
  }
};

const effect = (
  id: string,
  mechanismId: string,
  targetId: string,
  direction: EffectRecommendation['direction'],
  impactClass: EffectRecommendation['impactClass'],
  cause: string,
): EffectRecommendation => ({
  id, mechanismId, targetType: 'METRIC', targetId, field: 'value', direction, impactClass,
  confidence: 'MEDIUM', engagement: 'ENGAGES', cause, dependencies: [],
});

export const fallbackAdjudication = (
  graph: StrategyGraph,
  feasibility: FeasibilityFinding[],
  actorActions: ActorAction[],
  state: WorldState,
): Adjudication => {
  const effects: EffectRecommendation[] = [];
  for (const mechanism of graph.mechanisms) {
    const check = feasibility.find((item) => item.mechanismId === mechanism.id);
    if (check?.classification === 'IMPOSSIBLE') continue;
    if (mechanism.kind === 'DIPLOMACY') {
      effects.push(effect(`e_${mechanism.id}_space`, mechanism.id, 'diplomatic_space', 'POSITIVE', 'MODERATE', 'A viable diplomatic mechanism preserves negotiating room.'));
      effects.push(effect(`e_${mechanism.id}_tension`, mechanism.id, 'nuclear_tension', 'NEGATIVE', 'MINOR', 'Direct communication reduces miscalculation pressure.'));
    } else if (mechanism.kind === 'MILITARY_OPERATION' || mechanism.kind === 'COERCION') {
      effects.push(effect(`e_${mechanism.id}_tension`, mechanism.id, 'nuclear_tension', 'POSITIVE', 'MAJOR', 'Military pressure increases escalation and misperception risk.'));
      effects.push(effect(`e_${mechanism.id}_support`, mechanism.id, 'domestic_support', 'POSITIVE', 'MINOR', 'A forceful response temporarily reassures domestic hawks.'));
    } else if (mechanism.kind === 'INTELLIGENCE') {
      effects.push(effect(`e_${mechanism.id}_intel`, mechanism.id, 'intelligence_quality', 'POSITIVE', 'MODERATE', 'Focused collection improves decision-relevant information.'));
      const discoverable = Object.values(state.facts).find((fact) =>
        fact.visibility.discoverable
        && !canAccess(fact.visibility, state.manifest.playerId, state.manifest.playerId, state.gameOver));
      if (discoverable) effects.push({
        id: `e_${mechanism.id}_discover_${discoverable.id}`,
        mechanismId: mechanism.id,
        targetType: 'FACT',
        targetId: discoverable.id,
        field: 'discover',
        direction: 'NEUTRAL',
        impactClass: 'NONE',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES',
        cause: 'Focused collection may expose an existing hidden fact.',
        dependencies: [],
        actorId: state.manifest.playerId,
      });
    } else if (mechanism.kind === 'PUBLIC_COMMUNICATION') {
      effects.push(effect(`e_${mechanism.id}_support`, mechanism.id, 'domestic_support', 'POSITIVE', 'MINOR', 'Clear public framing improves political support.'));
    } else if (mechanism.kind === 'RESOURCE_TRANSFER' && mechanism.resourceClaims.length) {
      for (const claim of mechanism.resourceClaims) effects.push({
        id: `e_${mechanism.id}_${claim.resourceId}`,
        mechanismId: mechanism.id,
        targetType: 'RESOURCE',
        targetId: claim.resourceId,
        field: 'amount',
        direction: 'NEGATIVE',
        impactClass: 'NONE',
        confidence: 'VERY_HIGH',
        engagement: 'ENGAGES_STRONGLY',
        cause: `The player directly allocated ${claim.amount} ${state.resources[claim.resourceId]?.unit ?? 'units'} of ${state.resources[claim.resourceId]?.label ?? claim.resourceId}.`,
        dependencies: [],
        proposedDelta: -claim.amount,
      });
    } else {
      effects.push(effect(`e_${mechanism.id}_space`, mechanism.id, 'diplomatic_space', 'POSITIVE', 'TRIVIAL', 'The initiative creates limited strategic movement.'));
    }
  }
  const feasibleRatio = feasibility.filter((item) => item.feasible).length / Math.max(1, feasibility.length);
  const bands = normalizeDistribution([
    { id: 'setback', label: 'Setback', probability: 0.2 + (1 - feasibleRatio) * 0.25, effectIds: effects.filter((_, index) => index % 2 === 1).map((item) => item.id), description: 'Opposition and execution friction blunt the strategy.' },
    { id: 'mixed', label: 'Mixed result', probability: 0.45, effectIds: effects.slice(0, Math.max(1, Math.ceil(effects.length / 2))).map((item) => item.id), description: 'Some mechanisms engage while others stall.' },
    { id: 'strong', label: 'Strong result', probability: 0.35 * feasibleRatio, effectIds: effects.map((item) => item.id), description: 'The main mechanisms engage and create meaningful advantage.' },
  ]);
  return {
    summary: 'Rule-based fallback adjudication derived from mechanism type, feasibility, and actor pressure.',
    mechanismFindings: graph.mechanisms.map((mechanism) => ({
      mechanismId: mechanism.id,
      engagement: feasibility.find((item) => item.mechanismId === mechanism.id)?.feasible ? 'ENGAGES' : 'DOES_NOT_ENGAGE',
      reason: feasibility.find((item) => item.mechanismId === mechanism.id)?.hardConstraints.join(' ') || 'No hard constraint prevents attempted execution.',
      confidence: 'MEDIUM',
    })),
    recommendedEffects: effects,
    outcomeBands: bands,
    assumptions: [],
    unknowns: actorActions.map((item) => `${item.actorId}: ${item.action}`),
    confidence: 'LOW',
  };
};

export const adjudicate = async (
  graph: StrategyGraph,
  feasibility: FeasibilityFinding[],
  actorActions: ActorAction[],
  redTeam: RedTeamFinding[],
  state: WorldState,
  depth: TurnDepth,
  precedents: CausalPrecedent[] = [],
  gateway?: ModelGateway,
): Promise<Adjudication> => {
  if (!gateway) return fallbackAdjudication(graph, feasibility, actorActions, state);
  const prompt = {
    dryStrategy: graph,
    feasibility,
    actorActions,
    redTeam,
    causalPrecedents: precedents,
    historicalPriorWeight: historicalPriorWeight(state),
    authoritativeState: authoritativeSnapshot(state),
    allowedImpactClasses: depth === 'DEEP'
      ? ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE', 'SYSTEMIC']
      : ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR'],
  };
  try {
    const result = await gateway.callJson('adjudicator', [
      {
        role: 'system',
        content: 'Adjudicate causal mechanisms, not rhetoric. Hard state is authoritative. Recommend bounded impact classes, never arbitrary point values. Use only existing targets. Actor responses are additional causal forces and may use mechanismId actor:<actorId>; player effects must use a supplied strategy mechanism ID. A good plan may fail; a bad plan may occasionally succeed. Do not invent capabilities. Be concise: reasons under 80 words, at most 12 effects and 5 outcome bands. Probabilities must sum approximately to 1 and reference recommended effect IDs.',
      },
      { role: 'user', content: JSON.stringify(prompt) },
    ], adjudicationSchema, 'Adjudication');
    return { ...result.value, outcomeBands: normalizeDistribution(result.value.outcomeBands) };
  } catch (error) {
    throw new Error(`Primary adjudication failed: ${error instanceof Error ? error.message : 'unknown model error'}`);
  }
};

export const sanitizeAdjudication = (
  adjudication: Adjudication,
  state: WorldState,
  depth: TurnDepth,
  feasibility: FeasibilityFinding[] = [],
  actorActions: ActorAction[] = [],
): Adjudication => {
  const validTargets: Record<EffectRecommendation['targetType'], Set<string>> = {
    METRIC: new Set(Object.keys(state.metrics)),
    RESOURCE: new Set(Object.keys(state.resources)),
    ENTITY: new Set(Object.keys(state.entities)),
    RELATIONSHIP: new Set(Object.keys(state.relationships)),
    ARC: new Set(Object.keys(state.arcs)),
    FACT: new Set(Object.keys(state.facts)),
    PROCESS: new Set(Object.keys(state.pendingProcesses)),
    GOAL: new Set([state.goal.id]),
  };
  const allowedMechanisms = new Set(feasibility
    .filter((finding) => finding.classification !== 'IMPOSSIBLE')
    .map((finding) => finding.mechanismId));
  actorActions.forEach((action) => allowedMechanisms.add(`actor:${action.actorId}`));
  const recommendedEffects = adjudication.recommendedEffects.filter((candidate) => {
    if (feasibility.length && !allowedMechanisms.has(candidate.mechanismId)) return false;
    if (!validTargets[candidate.targetType].has(candidate.targetId)) return false;
    if (depth !== 'DEEP' && (candidate.impactClass === 'SEVERE' || candidate.impactClass === 'SYSTEMIC')) return false;
    if (candidate.proposedDelta !== undefined && candidate.targetType !== 'RESOURCE') return false;
    return true;
  });
  const effectIds = new Set(recommendedEffects.map((item) => item.id));
  const outcomeBands = normalizeDistribution(adjudication.outcomeBands.map((band) => ({
    ...band,
    effectIds: band.effectIds.filter((id) => effectIds.has(id)),
  })));
  return { ...adjudication, recommendedEffects, outcomeBands };
};

export const narrate = async (
  stateBefore: WorldState,
  stateAfter: WorldState,
  beliefsBefore: BeliefState,
  beliefsAfter: BeliefState,
  graph: StrategyGraph,
  selectedOutcome: Adjudication['outcomeBands'][number],
  changes: unknown[],
  gateway?: ModelGateway,
): Promise<TurnNarrative> => {
  const fallback = (): TurnNarrative => {
    return {
      title: selectedOutcome.label,
      immediateOutcome: `The strategy produced a ${selectedOutcome.label.toLowerCase()}.`,
      worldReaction: 'Other actors adjust their plans as the consequences become visible.',
      strategicConsequences: changes.length ? `${changes.length} attributable state changes were committed.` : 'No authoritative mechanical change was committed.',
      news: [{ source: 'Executive Situation Room', headline: `The strategy produced a ${selectedOutcome.label.toLowerCase()}.` }],
      advisorReactions: [],
    };
  };
  if (!gateway) return fallback();
  try {
    const result = await gateway.callJson('narrator', [
      {
        role: 'system',
        content: 'Write concise, vivid history from committed reality only. Do not add mechanical consequences, hidden facts, or omniscient explanations. Distinguish what the player can observe from what remains uncertain. Each main section should be under 130 words.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          playerVisibleBefore: playerVisibleState(stateBefore, beliefsBefore),
          committedVisibleAfter: playerVisibleState(stateAfter, beliefsAfter),
          dryStrategy: graph,
          selectedOutcome: { id: selectedOutcome.id, label: selectedOutcome.label },
          committedChanges: changes,
        }),
      },
    ], narrativeSchema, 'TurnNarrative');
    return result.value;
  } catch {
    return fallback();
  }
};
