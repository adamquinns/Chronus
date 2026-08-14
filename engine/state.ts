import {
  BeliefState,
  EffectRecommendation,
  ProposedEffect,
  StateChange,
  ValidationIssue,
  WorldFact,
  WorldState,
} from './domain';
import { calibratedMagnitude } from './calibration';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export const cloneWorld = (state: WorldState): WorldState => structuredClone(state);

export const validateWorld = (state: WorldState): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (state.revision < 0 || !Number.isInteger(state.revision)) {
    issues.push({ code: 'REVISION_INVALID', severity: 'ERROR', message: 'Revision must be a non-negative integer.' });
  }
  if (state.turn < 0 || !Number.isInteger(state.turn)) {
    issues.push({ code: 'TURN_INVALID', severity: 'ERROR', message: 'Turn must be a non-negative integer.' });
  }
  for (const definition of state.manifest.metricDefinitions) {
    const value = state.metrics[definition.id];
    if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
      issues.push({
        code: 'METRIC_RANGE',
        severity: 'ERROR',
        message: `${definition.label} is outside ${definition.min}-${definition.max}.`,
        path: `metrics.${definition.id}`,
      });
    }
  }
  for (const resource of Object.values(state.resources)) {
    if (!Number.isFinite(resource.amount) || resource.amount < 0) {
      issues.push({
        code: 'RESOURCE_NEGATIVE',
        severity: 'ERROR',
        message: `${resource.label} cannot be negative.`,
        path: `resources.${resource.id}.amount`,
      });
    }
    if (!state.entities[resource.ownerId]) {
      issues.push({ code: 'RESOURCE_OWNER', severity: 'ERROR', message: `${resource.label} has no valid owner.` });
    }
  }
  for (const relationship of Object.values(state.relationships)) {
    if (!state.entities[relationship.fromId] || !state.entities[relationship.toId]) {
      issues.push({ code: 'RELATIONSHIP_ENTITY', severity: 'ERROR', message: `${relationship.id} references a missing entity.` });
    }
    for (const field of ['alignment', 'trust', 'leverage'] as const) {
      if (relationship[field] < 0 || relationship[field] > 100) {
        issues.push({ code: 'RELATIONSHIP_RANGE', severity: 'ERROR', message: `${relationship.id}.${field} is out of range.` });
      }
    }
  }
  for (const process of Object.values(state.pendingProcesses)) {
    if (!state.entities[process.ownerId]) {
      issues.push({ code: 'PROCESS_OWNER', severity: 'ERROR', message: `${process.label} has no valid owner.` });
    }
  }
  return issues;
};

const numericDirection = (effect: EffectRecommendation) =>
  effect.direction === 'POSITIVE' ? 1 : effect.direction === 'NEGATIVE' ? -1 : 0;

const applyNumeric = (
  before: number,
  effect: EffectRecommendation,
  state: WorldState,
  targetId: string,
  min = 0,
  max = 100,
) => {
  const magnitude = calibratedMagnitude(effect.impactClass, effect.confidence, state, targetId);
  const delta = numericDirection(effect) * magnitude;
  return { after: clamp(before + delta, min, max), delta };
};

export const commitEffects = (
  prior: WorldState,
  effects: Array<EffectRecommendation | ProposedEffect>,
): { state: WorldState; changes: StateChange[]; issues: ValidationIssue[] } => {
  const state = cloneWorld(prior);
  const changes: StateChange[] = [];

  const record = (effect: EffectRecommendation, before: unknown, after: unknown, appliedDelta?: number) => {
    if (Object.is(before, after)) return;
    changes.push({
      id: `change_${prior.turn + 1}_${changes.length + 1}`,
      targetType: effect.targetType,
      targetId: effect.targetId,
      field: effect.field,
      before,
      after,
      appliedDelta,
      cause: effect.cause,
      sourceEffectId: effect.id,
      impactClass: effect.impactClass,
      confidence: effect.confidence,
    });
  };

  for (const effect of effects) {
    if (effect.targetType === 'METRIC') {
      const definition = state.manifest.metricDefinitions.find((item) => item.id === effect.targetId);
      if (!definition || typeof state.metrics[effect.targetId] !== 'number') continue;
      const before = state.metrics[effect.targetId];
      const result = applyNumeric(before, effect, state, effect.targetId, definition.min, definition.max);
      state.metrics[effect.targetId] = result.after;
      record(effect, before, result.after, result.after - before);
    } else if (effect.targetType === 'RESOURCE') {
      const resource = state.resources[effect.targetId];
      if (!resource || effect.field !== 'amount') continue;
      const before = resource.amount;
      const explicit = (effect as ProposedEffect).proposedDelta;
      const magnitude = explicit ?? calibratedMagnitude(effect.impactClass, effect.confidence, state, effect.targetId);
      const delta = explicit ?? numericDirection(effect) * magnitude;
      resource.amount = Math.max(0, before + delta);
      record(effect, before, resource.amount, resource.amount - before);
    } else if (effect.targetType === 'ENTITY') {
      const entity = state.entities[effect.targetId];
      if (!entity) continue;
      if (effect.field === 'power' || effect.field === 'resolve') {
        const before = entity[effect.field];
        const result = applyNumeric(before, effect, state, effect.targetId);
        entity[effect.field] = result.after;
        record(effect, before, result.after, result.after - before);
      } else if (effect.field === 'status' && (effect as ProposedEffect).setValue) {
        const before = entity.status;
        entity.status = (effect as ProposedEffect).setValue as typeof entity.status;
        record(effect, before, entity.status);
      }
    } else if (effect.targetType === 'RELATIONSHIP') {
      const relationship = state.relationships[effect.targetId];
      if (!relationship || !['alignment', 'trust', 'leverage'].includes(effect.field)) continue;
      const field = effect.field as 'alignment' | 'trust' | 'leverage';
      const before = relationship[field];
      const result = applyNumeric(before, effect, state, effect.targetId);
      relationship[field] = result.after;
      record(effect, before, result.after, result.after - before);
    } else if (effect.targetType === 'ARC') {
      const arc = state.arcs[effect.targetId];
      if (!arc || effect.field !== 'progress') continue;
      const before = arc.progress;
      const result = applyNumeric(before, effect, state, effect.targetId, 0, arc.threshold);
      arc.progress = result.after;
      if (arc.progress >= arc.threshold) arc.status = 'RESOLVED';
      record(effect, before, result.after, result.after - before);
    } else if (effect.targetType === 'FACT') {
      const proposed = effect as ProposedEffect;
      if (typeof proposed.setValue !== 'string') continue;
      const fact: WorldFact = {
        id: effect.targetId,
        statement: proposed.setValue,
        provenance: 'SIMULATED_POST_DIVERGENCE',
        confidence: effect.confidence,
        knownBy: effect.actorId ? [effect.actorId] : [state.manifest.playerId],
        createdTurn: state.turn + 1,
      };
      const before = state.facts[effect.targetId];
      state.facts[effect.targetId] = fact;
      record(effect, before, fact);
    } else if (effect.targetType === 'GOAL' && effect.field === 'status') {
      const next = (effect as ProposedEffect).setValue;
      if (next === 'ACTIVE' || next === 'ACHIEVED' || next === 'FAILED') {
        const before = state.goal.status;
        state.goal.status = next;
        state.gameOver = next !== 'ACTIVE';
        record(effect, before, next);
      }
    }
  }

  state.revision += 1;
  state.turn += 1;
  state.rngCursor += 1;
  if (state.goal.status === 'ACTIVE' && state.turn >= state.goal.deadlineTurn) {
    state.goal.status = 'FAILED';
    state.gameOver = true;
  }
  const issues = validateWorld(state);
  return { state, changes, issues };
};

export const evolvePendingProcesses = (state: WorldState): ProposedEffect[] => {
  const effects: ProposedEffect[] = [];
  for (const process of Object.values(state.pendingProcesses)) {
    if (process.dueTurn <= state.turn + 1 || process.progress >= process.requiredProgress) {
      effects.push(...process.onMature);
    }
  }
  return effects;
};

export const updateBeliefsFromChanges = (
  beliefs: BeliefState,
  changes: StateChange[],
  state: WorldState,
): BeliefState => {
  const next = structuredClone(beliefs);
  for (const change of changes) {
    if (change.targetType !== 'METRIC' || typeof change.after !== 'number') continue;
    const key = `${change.targetId}.${change.field}`;
    next.player.beliefs[key] = {
      subjectId: change.targetId,
      field: change.field,
      range: [Math.max(0, change.after - 5), Math.min(100, change.after + 5)],
      estimate: change.after,
      confidence: 'HIGH',
      sourceFactIds: [],
      updatedTurn: state.turn,
    };
  }
  return next;
};
