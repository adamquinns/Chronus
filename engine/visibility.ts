import { AccessDecision, Id, StateChange, StrategyGraph, VisibilityClass, VisibilityRule, WorldState } from './domain';

export const visibility = (
  classification: VisibilityClass,
  actorIds: Id[] = [],
  options: Partial<Omit<VisibilityRule, 'classification' | 'actorIds'>> = {},
): VisibilityRule => ({
  classification,
  actorIds: [...new Set(actorIds)],
  discoverable: options.discoverable ?? !['PUBLIC', 'POST_GAME_ONLY'].includes(classification),
  detectionDifficulty: options.detectionDifficulty,
  declassifyOnGameOver: options.declassifyOnGameOver ?? true,
});

export const canAccess = (
  rule: VisibilityRule,
  viewerId: Id,
  playerId: Id,
  gameOver = false,
  developer = false,
): boolean => {
  if (developer) return true;
  if (gameOver && rule.declassifyOnGameOver) return true;
  switch (rule.classification) {
    case 'PUBLIC': return true;
    case 'PLAYER_KNOWN': return viewerId === playerId;
    case 'ACTOR_KNOWN':
    case 'ACTOR_PRIVATE': return rule.actorIds.includes(viewerId);
    case 'SIMULATION_SECRET':
    case 'POST_GAME_ONLY': return false;
  }
};

export const accessDecision = (
  state: WorldState,
  viewerId: Id,
  objectType: AccessDecision['objectType'],
  objectId: Id,
  rule: VisibilityRule,
): AccessDecision => {
  const allowed = canAccess(rule, viewerId, state.manifest.playerId, state.gameOver);
  return {
    viewerId,
    objectType,
    objectId,
    allowed,
    classification: rule.classification,
    reason: allowed
      ? `${rule.classification} permits access for ${viewerId}.`
      : `${rule.classification} withholds access from ${viewerId}.`,
  };
};

export const visibleFactIds = (state: WorldState, viewerId: Id): Id[] =>
  Object.values(state.facts)
    .filter((fact) => canAccess(fact.visibility, viewerId, state.manifest.playerId, state.gameOver))
    .map((fact) => fact.id);

const changeVisibility = (state: WorldState, change: StateChange): VisibilityRule | undefined => {
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

export const projectChangesForViewer = (
  state: WorldState,
  viewerId: Id,
  changes: StateChange[],
  graph: StrategyGraph,
) => {
  const effectsById = new Map<string, string>();
  for (const mechanism of graph.mechanisms) effectsById.set(mechanism.id, mechanism.objective);
  return changes.flatMap((change) => {
    const rule = changeVisibility(state, change);
    if (!rule || !canAccess(rule, viewerId, state.manifest.playerId, state.gameOver)) return [];
    const label = change.targetType === 'METRIC'
      ? state.manifest.metricDefinitions.find((item) => item.id === change.targetId)?.label
      : change.targetType === 'ARC'
        ? state.arcs[change.targetId]?.title
        : change.targetId;
    const sourceMechanism = graph.mechanisms.find((mechanism) =>
      change.sourceEffectId.includes(mechanism.id));
    // A creation has no prior value and its raw object is meaningless to a
    // reader: render it as something entering the world, named.
    const isCreation = change.field === 'create';
    const createdName = isCreation && change.after && typeof change.after === 'object'
      ? ((change.after as { title?: string; name?: string; statement?: string }).title
        ?? (change.after as { name?: string }).name
        ?? (change.after as { statement?: string }).statement
        ?? String(change.targetId))
      : undefined;
    return [{
      id: change.id,
      sourceEffectId: change.sourceEffectId,
      targetType: change.targetType,
      label: (isCreation ? createdName : label) ?? label ?? 'Observable development',
      field: change.field,
      before: isCreation ? undefined : change.before,
      after: isCreation ? 'entered play' : change.after,
      explanation: isCreation
        ? change.cause
        : sourceMechanism
          ? `The player attempted to: ${effectsById.get(sourceMechanism.id)}`
          : 'An observable development with no directive attributable to it.',
      confidence: change.confidence,
    }];
  });
};

export const buildAccessDecisionMatrix = (state: WorldState): AccessDecision[] => {
  const viewers = [...new Set([state.manifest.playerId, ...Object.keys(state.entities)])];
  const objects: Array<{ type: AccessDecision['objectType']; id: string; rule: VisibilityRule }> = [
    ...state.manifest.metricDefinitions.map((item) => ({ type: 'METRIC' as const, id: item.id, rule: item.visibility })),
    ...Object.values(state.resources).map((item) => ({ type: 'RESOURCE' as const, id: item.id, rule: item.visibility })),
    ...Object.values(state.entities).map((item) => ({ type: 'ENTITY' as const, id: item.id, rule: item.visibility })),
    ...Object.values(state.relationships).map((item) => ({ type: 'RELATIONSHIP' as const, id: item.id, rule: item.visibility })),
    ...Object.values(state.arcs).map((item) => ({ type: 'ARC' as const, id: item.id, rule: item.visibility })),
    ...Object.values(state.facts).map((item) => ({ type: 'FACT' as const, id: item.id, rule: item.visibility })),
    ...Object.values(state.pendingProcesses).map((item) => ({ type: 'PROCESS' as const, id: item.id, rule: item.visibility })),
  ];
  return viewers.flatMap((viewerId) => objects.map((object) =>
    accessDecision(state, viewerId, object.type, object.id, object.rule)));
};
