import {
  ActorBeliefState,
  ActorMemoryState,
  BeliefState,
  EntityState,
  StrategyGraph,
  VisibilityRule,
  WorldState,
} from './domain';
import { canAccess, visibleFactIds } from './visibility';

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
  return {
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
  };
};

export const actorVisibleState = (
  actorId: string,
  state: WorldState,
  actorBeliefs: ActorBeliefState,
  perceivedStrategy: StrategyGraph,
  memory?: ActorMemoryState,
) => {
  const entity = state.entities[actorId];
  return {
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
  };
};

export const authoritativeSnapshot = (state: WorldState) => ({
  manifest: state.manifest,
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

export const perceivedStrategyForActor = (actorId: string, graph: StrategyGraph): StrategyGraph => {
  const visible = graph.mechanisms.filter((mechanism) => {
    if (mechanism.kind === 'DECEPTION' || mechanism.kind === 'INTELLIGENCE') {
      return mechanism.actorIds.includes(actorId);
    }
    return mechanism.targetIds.includes(actorId)
      || mechanism.actorIds.includes(actorId)
      || mechanism.kind === 'PUBLIC_COMMUNICATION'
      || mechanism.kind === 'MILITARY_OPERATION';
  });
  return {
    objective: visible.length ? graph.objective : 'Unknown player intent',
    mechanisms: visible,
    sequencing: [],
    contingencies: [],
    explicitRisks: [],
    unspecified: [],
    communicationStyleIsMechanism: graph.communicationStyleIsMechanism,
  };
};
