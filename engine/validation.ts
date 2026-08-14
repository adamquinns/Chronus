import {
  ActorAction,
  Adjudication,
  FeasibilityFinding,
  StrategyGraph,
  ValidationIssue,
  WorldState,
} from './domain';

const allowedFields: Record<Adjudication['recommendedEffects'][number]['targetType'], Set<string>> = {
  METRIC: new Set(['value']),
  RESOURCE: new Set(['amount']),
  ENTITY: new Set(['power', 'resolve', 'status']),
  RELATIONSHIP: new Set(['alignment', 'trust', 'leverage']),
  ARC: new Set(['progress']),
  FACT: new Set(['statement', 'discover']),
  PROCESS: new Set(['progress', 'status']),
  GOAL: new Set(['status']),
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
  const perceived = new Set(graph.mechanisms.map((mechanism) => mechanism.id));
  for (const mechanismId of action.perceivedPlayerMechanismIds) {
    if (!perceived.has(mechanismId)) issues.push({ code: 'ACTOR_PERCEPTION_UNKNOWN', severity: 'ERROR', message: `${action.actorId} perceived nonexistent mechanism ${mechanismId}.` });
  }
  return issues;
});

export const validateAdjudicationProposal = (
  adjudication: Adjudication,
  graph: StrategyGraph,
  feasibility: FeasibilityFinding[],
  state: WorldState,
  actorActions: ActorAction[] = [],
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const mechanisms = new Map(graph.mechanisms.map((mechanism) => [mechanism.id, mechanism]));
  const feasibilityById = new Map(feasibility.map((finding) => [finding.mechanismId, finding]));
  const actorMechanisms = new Set(actorActions.map((action) => `actor:${action.actorId}`));
  const effects = new Map(adjudication.recommendedEffects.map((effect) => [effect.id, effect]));
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

  for (const effect of adjudication.recommendedEffects) {
    const mechanism = mechanisms.get(effect.mechanismId);
    if (!mechanism && !actorMechanisms.has(effect.mechanismId)) issues.push({ code: 'EFFECT_MECHANISM_UNKNOWN', severity: 'ERROR', message: `${effect.id} references unknown mechanism ${effect.mechanismId}.` });
    if (feasibilityById.get(effect.mechanismId)?.classification === 'IMPOSSIBLE') issues.push({ code: 'EFFECT_FROM_IMPOSSIBLE', severity: 'ERROR', message: `${effect.id} derives from an impossible mechanism.` });
    if (!targetExists(effect)) issues.push({ code: 'EFFECT_TARGET_UNKNOWN', severity: 'ERROR', message: `${effect.id} references unknown target ${effect.targetId}.` });
    if (!allowedFields[effect.targetType].has(effect.field)) issues.push({ code: 'EFFECT_FIELD_INVALID', severity: 'ERROR', message: `${effect.id} cannot change ${effect.targetType}.${effect.field}.` });
    const calibration = state.manifest.calibrationRules.filter((rule) =>
      (!rule.mechanismKind || rule.mechanismKind === mechanism?.kind)
      && (!rule.targetType || rule.targetType === effect.targetType)
      && (!rule.targetId || rule.targetId === effect.targetId));
    if (calibration.length && !calibration.some((rule) => rule.allowedImpactClasses.includes(effect.impactClass))) {
      issues.push({ code: 'EFFECT_OUTSIDE_CALIBRATION', severity: 'ERROR', message: `${effect.id} uses ${effect.impactClass} outside scenario calibration.` });
    }
    if (effect.proposedDelta !== undefined) {
      const claim = mechanism?.resourceClaims.find((item) => item.resourceId === effect.targetId);
      if (effect.targetType !== 'RESOURCE' || !claim || effect.proposedDelta !== -claim.amount || feasibilityById.get(effect.mechanismId)?.classification !== 'CERTAIN') {
        issues.push({ code: 'EFFECT_EXPLICIT_DELTA', severity: 'ERROR', message: `${effect.id} contains an unauthorized explicit delta.` });
      }
    }
    for (const dependency of effect.dependencies) {
      if (!mechanisms.has(dependency) && !actorMechanisms.has(dependency) && !effects.has(dependency) && !(dependency in state.facts)) {
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
