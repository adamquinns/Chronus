import {
  ActorBeliefState,
  ActorMemoryState,
  BeliefState,
  EntityState,
  StrategyGraph,
  StrategyMechanism,
  VisibilityRule,
  WorldState,
} from './domain';
import { canAccess, visibleFactIds } from './visibility';

/** Remove engine-only bookkeeping (visibility rules, detection lists) from any
 * model-bound payload. Models never need them, and information architecture is
 * enforced in code — WP12 prompt economy + hygiene. */
export const stripModelHidden = <T>(value: T): T => JSON.parse(JSON.stringify(value, (key, child) =>
  key === 'visibility' || key === 'fieldVisibility' || key === 'detectableBy' ? undefined : child));

const maySee = (state: WorldState, viewerId: string, rule: VisibilityRule) =>
  canAccess(rule, viewerId, state.manifest.playerId, state.gameOver);

const visibleEntity = (state: WorldState, viewerId: string, entity: EntityState) => {
  if (entity.id !== viewerId && !maySee(state, viewerId, entity.visibility)) return undefined;
  const field = <K extends keyof EntityState>(name: K) => {
    const rule = entity.fieldVisibility[name as keyof EntityState['fieldVisibility']] ?? entity.visibility;
    return maySee(state, viewerId, rule) ? entity[name] : undefined;
  };
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    description: entity.description,
    objectives: field('objectives'),
    capabilities: field('capabilities'),
    constraints: field('constraints'),
    status: field('status'),
    power: field('power'),
    resolve: field('resolve'),
  };
};

export const entityDirectory = (state: WorldState, viewerId = state.manifest.playerId) =>
  Object.values(state.entities)
    .map((entity) => visibleEntity(state, viewerId, entity))
    .filter(Boolean);

export const playerVisibleState = (state: WorldState, beliefs: BeliefState) => {
  const playerId = state.manifest.playerId;
  return stripModelHidden({
    scenario: {
      id: state.manifest.id,
      title: state.manifest.title,
      premise: state.manifest.premise,
      playerRole: state.manifest.playerRole,
      timeScale: state.manifest.timeScale,
    },
    turn: state.turn,
    dateLabel: state.dateLabel,
    role: state.manifest.playerRole,
    visibleMetrics: state.manifest.metricDefinitions
      .filter((definition) => maySee(state, playerId, definition.visibility))
      .map((definition) => {
        const belief = beliefs.player.beliefs[`${definition.id}.value`];
        return {
          id: definition.id,
          label: definition.label,
          description: definition.description,
          dangerBelow: definition.dangerBelow,
          dangerAbove: definition.dangerAbove,
          estimate: belief?.estimate ?? state.metrics[definition.id],
          range: belief?.range,
          confidence: belief?.confidence ?? 'VERY_HIGH',
        };
      }),
    resources: Object.values(state.resources)
      .filter((resource) => maySee(state, playerId, resource.visibility))
      .map((resource) => ({ ...resource, ownerName: state.entities[resource.ownerId]?.name ?? resource.ownerId })),
    relationships: Object.values(state.relationships)
      .filter((relationship) => maySee(state, playerId, relationship.visibility))
      .map((relationship) => ({
        ...relationship,
        fromName: state.entities[relationship.fromId]?.name ?? relationship.fromId,
        toName: state.entities[relationship.toId]?.name ?? relationship.toId,
      })),
    entityDirectory: entityDirectory(state, playerId),
    knownFacts: visibleFactIds(state, playerId).map((id) => state.facts[id]),
    beliefs: Object.values(beliefs.player.beliefs),
    goal: state.goal,
    arcs: Object.values(state.arcs)
      .filter((arc) => arc.status === 'ACTIVE' && maySee(state, playerId, arc.visibility))
      .map(({ onResolve: _onResolve, ...arc }) => arc),
    processes: Object.values(state.pendingProcesses)
      .filter((process) => !process.completed && maySee(state, playerId, process.visibility))
      .map(({ onMature: _onMature, perTurnEffects: _perTurnEffects, detectableBy: _detectableBy, ...process }) => process),
  });
};

export const actorVisibleState = (
  actorId: string,
  state: WorldState,
  actorBeliefs: ActorBeliefState,
  perceivedStrategy: StrategyGraph,
  memory?: ActorMemoryState,
) => {
  const entity = state.entities[actorId];
  return stripModelHidden({
    identity: entity ? visibleEntity(state, actorId, entity) : undefined,
    turn: state.turn,
    dateLabel: state.dateLabel,
    knownFacts: visibleFactIds(state, actorId).map((id) => state.facts[id]),
    beliefs: Object.values(actorBeliefs.beliefs),
    perceivedPlayerStrategy: perceivedStrategy,
    ownResources: Object.values(state.resources)
      .filter((resource) => resource.ownerId === actorId && maySee(state, actorId, resource.visibility)),
    relationships: Object.values(state.relationships)
      .filter((relationship) => maySee(state, actorId, relationship.visibility)),
    memory: memory ? {
      currentStrategy: memory.currentStrategy,
      historicalPriorWeight: memory.historicalPriorWeight,
      significantEvents: memory.events.slice(-20),
    } : undefined,
  });
};

export const authoritativeSnapshot = (state: WorldState) => stripModelHidden({
  // Slimmed manifest: advisors, narrativeWorld, and voice are narrator-side
  // concerns and never inform causal adjudication.
  manifest: {
    id: state.manifest.id,
    title: state.manifest.title,
    premise: state.manifest.premise,
    playerId: state.manifest.playerId,
    playerRole: state.manifest.playerRole,
    timeUnit: state.manifest.timeUnit,
    timeScale: state.manifest.timeScale,
    timeScaleRules: state.manifest.timeScaleRules,
    metricDefinitions: state.manifest.metricDefinitions,
    historicalCutoff: state.manifest.historicalCutoff,
    authorityRules: state.manifest.authorityRules,
    calibrationRules: state.manifest.calibrationRules,
    historicalAnalogs: state.manifest.historicalAnalogs,
    hardRules: state.manifest.hardRules,
    executableHardRules: state.manifest.executableHardRules,
    unresolvedUncertainties: state.manifest.unresolvedUncertainties,
    metricRoles: state.manifest.metricRoles,
  },
  turn: state.turn,
  dateLabel: state.dateLabel,
  currentDateTime: state.currentDateTime,
  elapsedMinutes: state.elapsedMinutes,
  metrics: state.metrics,
  resources: state.resources,
  entities: state.entities,
  relationships: state.relationships,
  arcs: state.arcs,
  facts: state.facts,
  pendingProcesses: state.pendingProcesses,
  goal: state.goal,
});

export const perceivedStrategyForActor = (actorId: string, graph: StrategyGraph, detected: StrategyMechanism[] = []): StrategyGraph => {
  const detectedIds = new Set(detected.map((mechanism) => mechanism.id));
  const visible = graph.mechanisms.filter((mechanism) => {
    // Deception and collection work only if their subject is unaware — that is
    // the mechanism. Everything else that is merely *private* is still known to
    // the party it is aimed at: you cannot quietly demand something of someone
    // without them learning you demanded it. Concealment hides such an act from
    // third parties, not from the counterparty.
    if (mechanism.kind === 'DECEPTION' || mechanism.kind === 'INTELLIGENCE') {
      return mechanism.actorIds.includes(actorId) || detectedIds.has(mechanism.id);
    }
    if (mechanism.concealed) {
      return mechanism.actorIds.includes(actorId)
        || mechanism.targetIds.includes(actorId)
        || detectedIds.has(mechanism.id);
    }
    return mechanism.targetIds.includes(actorId)
      || mechanism.actorIds.includes(actorId)
      || mechanism.kind === 'PUBLIC_COMMUNICATION'
      || mechanism.kind === 'MILITARY_OPERATION';
  });
  return {
    objective: visible.length ? graph.objective : 'Unknown player intent',
    requestedOutcomes: [],
    assertedExternalEvents: [],
    rationale: [],
    unresolvedReferences: [],
    mechanisms: visible.map((mechanism) => detectedIds.has(mechanism.id) && !mechanism.actorIds.includes(actorId) ? {
      ...mechanism,
      objective: 'Concealed activity detected',
      specifiedDetail: `${mechanism.kind} activity involving ${mechanism.targetIds.join(', ') || 'an unknown target'}`,
      assumptions: [],
      resourceClaims: [],
    } : mechanism),
    sequencing: [],
    contingencies: [],
    explicitRisks: [],
    unspecified: [],
    communicationStyleIsMechanism: graph.communicationStyleIsMechanism,
  };
};
