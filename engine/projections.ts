import { ActorBeliefState, BeliefState, StrategyGraph, WorldState } from './domain';

export const entityDirectory = (state: WorldState) => Object.values(state.entities).map((entity) => ({
  id: entity.id,
  name: entity.name,
  kind: entity.kind,
  description: entity.description,
  publicStatus: entity.status,
}));

export const playerVisibleState = (state: WorldState, beliefs: BeliefState) => ({
  scenario: state.manifest,
  turn: state.turn,
  dateLabel: state.dateLabel,
  role: state.manifest.playerRole,
  visibleMetrics: state.manifest.metricDefinitions
    .filter((definition) => !definition.hidden)
    .map((definition) => ({ ...definition, value: state.metrics[definition.id] })),
  controlledResources: Object.values(state.resources).filter((resource) => resource.ownerId === state.manifest.playerId),
  entityDirectory: entityDirectory(state),
  knownFacts: beliefs.player.knownFactIds.map((id) => state.facts[id]).filter(Boolean),
  beliefs: Object.values(beliefs.player.beliefs),
  goal: state.goal,
  arcs: Object.values(state.arcs).filter((arc) => arc.status === 'ACTIVE'),
});

export const actorVisibleState = (
  actorId: string,
  state: WorldState,
  actorBeliefs: ActorBeliefState,
  perceivedStrategy: StrategyGraph,
) => {
  const entity = state.entities[actorId];
  return {
    identity: entity && {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      objectives: entity.objectives,
      capabilities: entity.capabilities,
      constraints: entity.constraints,
      status: entity.status,
      resolve: entity.resolve,
    },
    turn: state.turn,
    dateLabel: state.dateLabel,
    knownFacts: actorBeliefs.knownFactIds.map((id) => state.facts[id]).filter(Boolean),
    beliefs: Object.values(actorBeliefs.beliefs),
    perceivedPlayerStrategy: perceivedStrategy,
    ownResources: Object.values(state.resources).filter((resource) => resource.ownerId === actorId),
    relationships: Object.values(state.relationships).filter((relationship) => relationship.fromId === actorId),
  };
};

export const authoritativeSnapshot = (state: WorldState) => ({
  manifest: state.manifest,
  turn: state.turn,
  dateLabel: state.dateLabel,
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
