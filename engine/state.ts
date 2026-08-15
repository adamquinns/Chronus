import {
  ArcState,
  BeliefState,
  EffectRecommendation,
  ProposedEffect,
  StateChange,
  ValidationIssue,
  WorldExtensionProposal,
  WorldFact,
  WorldState,
  GoalCondition,
} from './domain';
import { calibratedMagnitude } from './calibration';
import { canAccess, visibility } from './visibility';
import { applyWorldExtension } from './worldExpansion';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const goalValue = (state: WorldState, condition: GoalCondition): unknown => {
  if (condition.targetType === 'METRIC') return condition.field === 'value' ? state.metrics[condition.targetId] : undefined;
  if (condition.targetType === 'RESOURCE') return state.resources[condition.targetId]?.[condition.field as 'amount'];
  if (condition.targetType === 'ENTITY') return state.entities[condition.targetId]?.[condition.field as 'status'];
  if (condition.targetType === 'ARC') return state.arcs[condition.targetId]?.[condition.field as 'progress'];
  if (condition.targetType === 'FACT') return state.facts[condition.targetId];
  return undefined;
};

export const conditionMet = (state: WorldState, condition: GoalCondition) => {
  const actual = goalValue(state, condition);
  if (condition.operator === 'EXISTS') return actual !== undefined;
  if (condition.operator === 'NOT_EXISTS') return actual === undefined;
  if (condition.operator === 'EQ') return actual === condition.value;
  if (typeof actual !== 'number' || typeof condition.value !== 'number') return false;
  if (condition.operator === 'LT') return actual < condition.value;
  if (condition.operator === 'LTE') return actual <= condition.value;
  if (condition.operator === 'GTE') return actual >= condition.value;
  return actual > condition.value;
};

export const evaluateGoal = (state: WorldState): WorldState => {
  const next = structuredClone(state);
  if (next.goal.status !== 'ACTIVE') return next;
  const matches = (rules: GoalCondition[], mode: 'ALL' | 'ANY') =>
    rules.length > 0 && (mode === 'ALL' ? rules.every((rule) => conditionMet(next, rule)) : rules.some((rule) => conditionMet(next, rule)));
  let transition: 'ACHIEVED' | 'FAILED' | 'DEADLINE' | undefined;
  if (matches(next.goal.failureRules, next.goal.failureMode)) {
    next.goal.status = 'FAILED';
    next.goal.outcomeClass = 'CATASTROPHIC_DEFEAT';
    next.gameOver = next.goal.terminalOnFailure;
    transition = 'FAILED';
  } else if (matches(next.goal.victoryRules, next.goal.victoryMode)) {
    next.goal.status = 'ACHIEVED';
    next.goal.outcomeClass = 'VICTORY';
    next.gameOver = next.goal.terminalOnAchievement;
    transition = 'ACHIEVED';
  } else if (next.turn >= next.goal.deadlineTurn) {
    next.goal.status = 'FAILED';
    next.goal.outcomeClass = 'STRATEGIC_DEFEAT';
    next.gameOver = next.goal.terminalOnFailure;
    transition = 'DEADLINE';
  }
  if (transition && !next.gameOver) {
    const successor = next.goal.successors?.find((candidate) => candidate.on === transition)
      ?? (transition === 'DEADLINE' ? next.goal.successors?.find((candidate) => candidate.on === 'FAILED') : undefined);
    if (successor) {
      next.goal = structuredClone(successor.goal);
      next.gameOver = false;
    }
  }
  return next;
};

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
  const magnitude = calibratedMagnitude(effect.impactClass, effect.confidence, state, targetId, effect.targetType);
  const delta = numericDirection(effect) * magnitude;
  return { after: clamp(before + delta, min, max), delta };
};

export const commitEffects = (
  prior: WorldState,
  effects: Array<EffectRecommendation | ProposedEffect>,
  extension?: WorldExtensionProposal,
): { state: WorldState; changes: StateChange[]; issues: ValidationIssue[] } => {
  let state = cloneWorld(prior);
  const changes: StateChange[] = [];
  if (extension) {
    // The validated world extension is replayed here so committed state derives
    // from prior state through this single write path, and creations appear in
    // the causal ledger.
    const applied = applyWorldExtension(state, extension);
    state = applied.state;
    changes.push(...applied.changes);
  }

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

  const queue = [...effects];
  for (const effect of queue) {
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
      const magnitude = explicit ?? calibratedMagnitude(effect.impactClass, effect.confidence, state, effect.targetId, effect.targetType);
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
        // Losing the player themselves ends the campaign. The PRD reserves
        // terminal outcomes for exactly this kind of removal.
        if (entity.id === state.manifest.playerId && (entity.status === 'DESTROYED' || entity.status === 'INACTIVE')) {
          state.goal.status = 'FAILED';
          state.goal.outcomeClass = 'CATASTROPHIC_DEFEAT';
          state.gameOver = true;
        }
      }
    } else if (effect.targetType === 'RELATIONSHIP') {
      const relationship = state.relationships[effect.targetId];
      if (!relationship) continue;
      if (effect.field === 'commitments' && typeof (effect as ProposedEffect).setValue === 'string') {
        const before = [...relationship.commitments];
        if (!relationship.commitments.includes((effect as ProposedEffect).setValue as string)) relationship.commitments.push((effect as ProposedEffect).setValue as string);
        record(effect, before, [...relationship.commitments]);
        continue;
      }
      if (!['alignment', 'trust', 'leverage'].includes(effect.field)) continue;
      const field = effect.field as 'alignment' | 'trust' | 'leverage';
      const before = relationship[field];
      const result = applyNumeric(before, effect, state, effect.targetId);
      relationship[field] = result.after;
      record(effect, before, result.after, result.after - before);
    } else if (effect.targetType === 'ARC') {
      const arc = state.arcs[effect.targetId];
      if (!arc && effect.field === 'create' && (effect as ProposedEffect).setValue) {
        // A confrontation the player started becomes a durable object in the
        // world, created through the same commit path as everything else.
        const created = structuredClone((effect as ProposedEffect).setValue) as ArcState;
        state.arcs[created.id] = created;
        record(effect, undefined, created);
        continue;
      }
      if (arc && effect.field === 'status' && typeof (effect as ProposedEffect).setValue === 'string') {
        const before = arc.status;
        arc.status = (effect as ProposedEffect).setValue as ArcState['status'];
        record(effect, before, arc.status);
        if (arc.status === 'RESOLVED') queue.push(...(effect as ProposedEffect & { onSettle?: ProposedEffect[] }).onSettle ?? []);
        continue;
      }
      if (arc && effect.field === 'participants' && typeof (effect as ProposedEffect).setValue === 'string') {
        const joining = (effect as ProposedEffect).setValue as string;
        if (arc.participantIds.includes(joining)) continue;
        const before = [...arc.participantIds];
        arc.participantIds.push(joining);
        record(effect, before, [...arc.participantIds]);
        continue;
      }
      if (arc && effect.field === 'visibility' && (effect as ProposedEffect).setValue) {
        const before = structuredClone(arc.visibility);
        arc.visibility = structuredClone((effect as ProposedEffect).setValue) as typeof arc.visibility;
        record(effect, before, structuredClone(arc.visibility));
        continue;
      }
      if (!arc || effect.field !== 'progress') continue;
      const before = arc.progress;
      const result = applyNumeric(before, effect, state, effect.targetId, 0, arc.threshold);
      arc.progress = result.after;
      record(effect, before, result.after, result.after - before);
      if (arc.progress >= arc.threshold && arc.status !== 'RESOLVED') {
        const statusBefore = arc.status;
        arc.status = 'RESOLVED';
        record({ ...effect, id: `${effect.id}_resolution`, field: 'status', cause: `${arc.title} reached its resolution threshold.` }, statusBefore, arc.status);
        queue.push(...arc.onResolve);
      }
    } else if (effect.targetType === 'FACT') {
      const proposed = effect as ProposedEffect;
      const existing = state.facts[effect.targetId];
      if (existing && effect.field === 'discover') {
        const before = structuredClone(existing.visibility);
        const viewerId = effect.actorId ?? state.manifest.playerId;
        existing.visibility.actorIds = [...new Set([...existing.visibility.actorIds, viewerId])];
        if (viewerId === state.manifest.playerId && existing.visibility.classification === 'SIMULATION_SECRET') {
          existing.visibility.classification = 'ACTOR_KNOWN';
        }
        record(effect, before, structuredClone(existing.visibility));
        continue;
      }
      if (typeof proposed.setValue !== 'string') continue;
      const fact: WorldFact = {
        id: effect.targetId,
        statement: proposed.setValue,
        provenance: 'SIMULATED_POST_DIVERGENCE',
        confidence: effect.confidence,
        visibility: effect.actorId
          ? visibility('ACTOR_KNOWN', [effect.actorId])
          : visibility('PLAYER_KNOWN', [state.manifest.playerId]),
        sourceRefs: [],
        createdTurn: state.turn + 1,
      };
      const before = state.facts[effect.targetId];
      state.facts[effect.targetId] = fact;
      record(effect, before, fact);
    } else if (effect.targetType === 'PROCESS') {
      const proposed = effect as ProposedEffect;
      const existing = state.pendingProcesses[effect.targetId];
      if (existing && effect.field === 'status' && proposed.setValue === 'COMPLETED') {
        const before = existing.completed;
        existing.completed = true;
        record(effect, before, true);
      } else if (!existing && effect.field === 'status' && proposed.setValue && typeof proposed.setValue === 'object') {
        const process = proposed.setValue as typeof state.pendingProcesses[string];
        state.pendingProcesses[effect.targetId] = structuredClone(process);
        record(effect, undefined, process);
      }
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
  const evaluated = evaluateGoal(state);
  const issues = validateWorld(evaluated);
  return { state: evaluated, changes, issues };
};

export const evolvePendingProcesses = (state: WorldState): ProposedEffect[] => {
  const effects: ProposedEffect[] = [];
  for (const process of Object.values(state.pendingProcesses)) {
    if (!process.completed) effects.push(...process.perTurnEffects.map((effect) => ({
      ...effect,
      id: `${effect.id}_turn_${state.turn + 1}`,
      cause: `${effect.cause} (${process.label}, turn ${state.turn + 1}).`,
    })));
    if (!process.completed && (process.dueTurn <= state.turn + 1 || process.progress >= process.requiredProgress)) {
      effects.push(...process.onMature);
      effects.push({
        id: `complete_${process.id}_${state.turn + 1}`,
        mechanismId: process.id,
        targetType: 'PROCESS',
        targetId: process.id,
        field: 'status',
        direction: 'NEUTRAL',
        impactClass: 'NONE',
        confidence: 'VERY_HIGH',
        engagement: 'ENGAGES_STRONGLY',
        cause: `${process.label} completed and will not mature again.`,
        dependencies: [],
        setValue: 'COMPLETED',
      });
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
  const observers = [next.player, ...Object.values(next.actors)];
  const ruleFor = (change: StateChange) => {
    if (change.targetType === 'METRIC') return state.manifest.metricDefinitions.find((item) => item.id === change.targetId)?.visibility;
    if (change.targetType === 'RESOURCE') return state.resources[change.targetId]?.visibility;
    if (change.targetType === 'ENTITY') return state.entities[change.targetId]?.fieldVisibility[change.field as keyof typeof state.entities[string]['fieldVisibility']]
      ?? state.entities[change.targetId]?.visibility;
    if (change.targetType === 'RELATIONSHIP') return state.relationships[change.targetId]?.visibility;
    if (change.targetType === 'ARC') return state.arcs[change.targetId]?.visibility;
    if (change.targetType === 'FACT') return state.facts[change.targetId]?.visibility;
    if (change.targetType === 'PROCESS') return state.pendingProcesses[change.targetId]?.visibility;
    return visibility('PLAYER_KNOWN', [state.manifest.playerId]);
  };

  for (const change of changes) {
    const rule = ruleFor(change);
    const informed = rule
      ? observers.filter((observer) => canAccess(rule, observer.actorId, state.manifest.playerId, state.gameOver))
      : [];
    if (change.targetType === 'METRIC' && typeof change.after === 'number') {
      const key = `${change.targetId}.${change.field}`;
      for (const observer of informed) {
        const isPlayer = observer.actorId === state.manifest.playerId;
        observer.beliefs[key] = {
          subjectId: change.targetId,
          field: change.field,
          range: [Math.max(0, change.after - (isPlayer ? 5 : 8)), Math.min(100, change.after + (isPlayer ? 5 : 8))],
          estimate: change.after,
          confidence: isPlayer ? 'HIGH' : 'MEDIUM',
          sourceFactIds: [],
          updatedTurn: state.turn,
        };
      }
    }
    if (change.targetType === 'ENTITY' && change.field !== 'create') {
      for (const observer of informed) {
        observer.beliefs[`${change.targetId}.${change.field}`] = {
          subjectId: change.targetId,
          field: change.field,
          categorical: String(change.after),
          confidence: observer.actorId === change.targetId ? 'VERY_HIGH' : 'MEDIUM',
          sourceFactIds: [],
          updatedTurn: state.turn,
        };
      }
    }
    if (change.targetType === 'ARC' && typeof change.after === 'number') {
      const key = `${change.targetId}.progress`;
      for (const observer of informed) observer.beliefs[key] = {
        subjectId: change.targetId,
        field: 'progress',
        estimate: change.after,
        range: [Math.max(0, change.after - 8), Math.min(100, change.after + 8)],
        confidence: observer.actorId === state.manifest.playerId ? 'MEDIUM' : 'LOW',
        sourceFactIds: [],
        updatedTurn: state.turn,
      };
    }
    if (change.targetType === 'FACT') {
      for (const observer of informed) {
        if (!observer.knownFactIds.includes(change.targetId)) observer.knownFactIds.push(change.targetId);
      }
    }
  }
  return next;
};
