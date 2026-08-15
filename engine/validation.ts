import {
  ActorAction,
  ImpactClass,
  Adjudication,
  FeasibilityFinding,
  StrategyGraph,
  ValidationIssue,
  WorldState,
} from './domain';
import { conditionMet } from './state';

const allowedFields: Record<Adjudication['recommendedEffects'][number]['targetType'], Set<string>> = {
  METRIC: new Set(['value']),
  RESOURCE: new Set(['amount']),
  ENTITY: new Set(['power', 'resolve', 'status']),
  RELATIONSHIP: new Set(['alignment', 'trust', 'leverage', 'commitments']),
  ARC: new Set(['progress']),
  FACT: new Set(['statement', 'discover']),
  PROCESS: new Set(['progress', 'status']),
  GOAL: new Set(),
};

export const validateActorActions = (
  actions: ActorAction[],
  state: WorldState,
  graph: StrategyGraph,
): ValidationIssue[] => actions.flatMap((action) => {
  const issues: ValidationIssue[] = [];
  const actor = state.entities[action.actorId];
  if (!actor) return [{ code: 'ACTOR_ACTION_UNKNOWN', severity: 'ERROR' as const, message: `Action references unknown actor ${action.actorId}.` }];
  for (const capability of action.capabilityIdsUsed) {
    if (!actor.capabilities.includes(capability)) issues.push({ code: 'ACTOR_CAPABILITY_MAGIC', severity: 'ERROR', message: `${action.actorId} used undeclared capability ${capability}.` });
  }
  for (const targetId of action.targetIds ?? []) {
    if (!state.entities[targetId]) issues.push({ code: 'ACTOR_TARGET_UNKNOWN', severity: 'ERROR', message: `${action.actorId} targeted unknown entity ${targetId}.` });
    const hasChannel = Object.values(state.relationships).some((relationship) => relationship.communication
      && ((relationship.fromId === action.actorId && relationship.toId === targetId) || (relationship.toId === action.actorId && relationship.fromId === targetId)));
    if (!hasChannel && /contact|negotiate|message|call|letter|diplom/i.test(action.action)) issues.push({ code: 'ACTOR_COMMUNICATION_MAGIC', severity: 'ERROR', message: `${action.actorId} has no communication channel to ${targetId}.` });
  }
  for (const claim of action.resourceClaims ?? []) {
    const resource = state.resources[claim.resourceId];
    if (!resource || resource.amount < claim.amount) issues.push({ code: 'ACTOR_RESOURCE_MAGIC', severity: 'ERROR', message: `${action.actorId} lacks ${claim.amount} of ${claim.resourceId}.` });
    else if (resource.ownerId !== action.actorId && state.entities[resource.ownerId]?.controllerId !== action.actorId) issues.push({ code: 'ACTOR_RESOURCE_AUTHORITY', severity: 'ERROR', message: `${action.actorId} does not control ${claim.resourceId}.` });
  }
  const selfAuthority = state.manifest.authorityRules.filter((rule) => rule.actorId === action.actorId && rule.targetId === action.actorId);
  if (!selfAuthority.some((rule) => (rule.conditionRules ?? []).every((condition) => conditionMet(state, condition)))) {
    issues.push({ code: 'ACTOR_AUTHORITY_MISSING', severity: 'ERROR', message: `${action.actorId} lacks currently valid authority for autonomous action.` });
  }
  for (const rule of (state.manifest.executableHardRules ?? []).filter((candidate) =>
    (candidate.appliesTo === 'ALL' || candidate.appliesTo === 'ACTOR')
    && (!candidate.actorIds?.length || candidate.actorIds.includes(action.actorId))
    && (candidate.conditions ?? []).every((condition) => conditionMet(state, condition)))) {
    if (rule.effect === 'PROHIBIT' && (!rule.targetIds?.length || (action.targetIds ?? []).some((targetId) => rule.targetIds!.includes(targetId)))) {
      issues.push({ code: 'ACTOR_HARD_RULE', severity: 'ERROR', message: `${action.actorId}: ${rule.description}` });
    }
    if (rule.effect === 'REQUIRE_RESOURCE' && rule.resourceId && (state.resources[rule.resourceId]?.amount ?? 0) < (rule.resourceAmount ?? 1)) {
      issues.push({ code: 'ACTOR_HARD_RESOURCE', severity: 'ERROR', message: `${action.actorId}: ${rule.description}` });
    }
  }
  const perceived = new Set(graph.mechanisms.map((mechanism) => mechanism.id));
  for (const mechanismId of action.perceivedPlayerMechanismIds) {
    if (!perceived.has(mechanismId)) issues.push({ code: 'ACTOR_PERCEPTION_UNKNOWN', severity: 'ERROR', message: `${action.actorId} perceived nonexistent mechanism ${mechanismId}.` });
  }
  return issues;
});

const IMPACT_ORDER: ImpactClass[] = ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE', 'SYSTEMIC'];

/** Scenario calibration describes what NORMALLY happens in a turn. A directive
 * that stakes the player's person, authority, or an irreversible act is not
 * normal business, and is permitted one band beyond the ordinary ceiling. */
const permittedClasses = (allowed: ImpactClass[], graveJeopardy: boolean): Set<ImpactClass> => {
  const permitted = new Set(allowed);
  if (!graveJeopardy) return permitted;
  const highest = allowed.reduce((best, current) =>
    IMPACT_ORDER.indexOf(current) > IMPACT_ORDER.indexOf(best) ? current : best, 'NONE' as ImpactClass);
  const next = IMPACT_ORDER[Math.min(IMPACT_ORDER.length - 1, IMPACT_ORDER.indexOf(highest) + 1)];
  permitted.add(next);
  return permitted;
};

export const validateAdjudicationProposal = (
  adjudication: Adjudication,
  graph: StrategyGraph,
  feasibility: FeasibilityFinding[],
  state: WorldState,
  actorActions: ActorAction[] = [],
  graveJeopardy = false,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const mechanisms = new Map(graph.mechanisms.map((mechanism) => [mechanism.id, mechanism]));
  const feasibilityById = new Map(feasibility.map((finding) => [finding.mechanismId, finding]));
  const actorMechanisms = new Set(actorActions.map((action) => `actor:${action.actorId}`));
  const effects = new Map(adjudication.recommendedEffects.map((effect) => [effect.id, effect]));
  const authoritativeDependencies = new Set([
    ...Object.keys(state.metrics),
    ...Object.keys(state.resources),
    ...Object.keys(state.entities),
    ...Object.keys(state.relationships),
    ...Object.keys(state.arcs),
    ...Object.keys(state.facts),
    ...Object.keys(state.pendingProcesses),
    state.goal.id,
  ]);
  const targetExists = (effect: Adjudication['recommendedEffects'][number]) => {
    if (effect.targetType === 'METRIC') return effect.targetId in state.metrics;
    if (effect.targetType === 'RESOURCE') return effect.targetId in state.resources;
    if (effect.targetType === 'ENTITY') return effect.targetId in state.entities;
    if (effect.targetType === 'RELATIONSHIP') return effect.targetId in state.relationships;
    if (effect.targetType === 'ARC') return effect.targetId in state.arcs;
    if (effect.targetType === 'FACT') return effect.targetId in state.facts || typeof effect.setValue === 'string';
    if (effect.targetType === 'PROCESS') return effect.targetId in state.pendingProcesses || Boolean(effect.setValue);
    return effect.targetId === state.goal.id;
  };

  const escalationMetricId = state.manifest.metricRoles?.escalation;
  for (const effect of adjudication.recommendedEffects) {
    const mechanism = mechanisms.get(effect.mechanismId);
    if (escalationMetricId && effect.targetType === 'METRIC' && effect.targetId === escalationMetricId) {
      const grounded = effect.dependencies.some((dependency) =>
        (effects.has(dependency) && effects.get(dependency)!.targetType !== 'METRIC')
        || (authoritativeDependencies.has(dependency) && !(dependency in state.metrics)));
      if (!grounded) {
        issues.push({
          code: 'EFFECT_UNSUPPORTED_ESCALATION',
          severity: 'ERROR',
          message: `${effect.id} changes the escalation metric without a non-metric causal dependency; rhetoric-to-metric shortcuts are forbidden.`,
        });
      }
    }
    if (!mechanism && !actorMechanisms.has(effect.mechanismId)) issues.push({ code: 'EFFECT_MECHANISM_UNKNOWN', severity: 'ERROR', message: `${effect.id} references unknown mechanism ${effect.mechanismId}.` });
    if (feasibilityById.get(effect.mechanismId)?.classification === 'IMPOSSIBLE') issues.push({ code: 'EFFECT_FROM_IMPOSSIBLE', severity: 'ERROR', message: `${effect.id} derives from an impossible mechanism.` });
    if (!targetExists(effect)) issues.push({ code: 'EFFECT_TARGET_UNKNOWN', severity: 'ERROR', message: `${effect.id} references unknown target ${effect.targetId}.` });
    if (!allowedFields[effect.targetType].has(effect.field)) issues.push({ code: 'EFFECT_FIELD_INVALID', severity: 'ERROR', message: `${effect.id} cannot change ${effect.targetType}.${effect.field}.` });
    if (!effect.cause.trim()) issues.push({ code: 'EFFECT_CAUSE_MISSING', severity: 'ERROR', message: `${effect.id} has no causal explanation.` });
    if (effect.targetType === 'RELATIONSHIP' && effect.field === 'commitments' && typeof effect.setValue !== 'string') issues.push({ code: 'COMMITMENT_VALUE', severity: 'ERROR', message: `${effect.id} must provide a commitment string.` });
    const calibration = state.manifest.calibrationRules.filter((rule) =>
      (!rule.mechanismKind || rule.mechanismKind === mechanism?.kind)
      && (!rule.targetType || rule.targetType === effect.targetType)
      && (!rule.targetId || rule.targetId === effect.targetId));
    if (calibration.length && !calibration.some((rule) =>
      permittedClasses(rule.allowedImpactClasses, graveJeopardy).has(effect.impactClass))) {
      issues.push({ code: 'EFFECT_OUTSIDE_CALIBRATION', severity: 'ERROR', message: `${effect.id} uses ${effect.impactClass} outside scenario calibration.` });
    }
    if (effect.proposedDelta !== undefined) {
      const claim = mechanism?.resourceClaims.find((item) => item.resourceId === effect.targetId);
      if (effect.targetType !== 'RESOURCE' || !claim || effect.proposedDelta !== -claim.amount || feasibilityById.get(effect.mechanismId)?.classification !== 'CERTAIN') {
        issues.push({ code: 'EFFECT_EXPLICIT_DELTA', severity: 'ERROR', message: `${effect.id} contains an unauthorized explicit delta.` });
      }
    }
    for (const dependency of effect.dependencies) {
      if (!mechanisms.has(dependency) && !actorMechanisms.has(dependency) && !effects.has(dependency) && !authoritativeDependencies.has(dependency)) {
        issues.push({ code: 'EFFECT_DEPENDENCY_UNKNOWN', severity: 'ERROR', message: `${effect.id} references unknown dependency ${dependency}.` });
      }
    }
  }

  const probability = adjudication.outcomeBands.reduce((sum, band) => sum + band.probability, 0);
  if (Math.abs(probability - 1) > 0.02) issues.push({ code: 'OUTCOME_DISTRIBUTION', severity: 'ERROR', message: `Outcome probabilities sum to ${probability.toFixed(4)}, not 1.` });
  for (const band of adjudication.outcomeBands) {
    for (const effectId of band.effectIds) if (!effects.has(effectId)) issues.push({ code: 'OUTCOME_EFFECT_UNKNOWN', severity: 'ERROR', message: `${band.id} references unknown effect ${effectId}.` });
  }
  return issues;
};
