import { ActorAction, ActorMemoryState, Campaign, StateChange, WorldState } from './domain';
import { historicalPriorWeight } from './precedent';

const importanceScore = { NONE: 0, TRIVIAL: 1, MINOR: 2, MODERATE: 3, MAJOR: 4, SEVERE: 5, SYSTEMIC: 6 } as const;

export const updateActorMemories = (
  campaign: Campaign,
  actions: ActorAction[],
  changes: StateChange[],
  stateAfter: WorldState,
  auditId: string,
): Record<string, ActorMemoryState> => {
  const next = structuredClone(campaign.memories);
  for (const actorId of Object.keys(stateAfter.entities)) {
    next[actorId] ??= { actorId, events: [], historicalPriorWeight: 1 };
    next[actorId].historicalPriorWeight = historicalPriorWeight(stateAfter);
  }

  for (const action of actions) {
    const memory = next[action.actorId];
    if (!memory) continue;
    memory.currentStrategy = action.action;
    memory.events.push({
      id: `memory_${auditId}_${action.actorId}_action`,
      actorId: action.actorId,
      turn: stateAfter.turn,
      kind: 'ACTION',
      summary: action.action,
      importance: action.confidence === 'VERY_HIGH' || action.confidence === 'HIGH' ? 'MODERATE' : 'MINOR',
      relatedEntityIds: [action.actorId],
      sourceAuditId: auditId,
    });
  }

  for (const change of changes.filter((item) => item.targetType === 'RELATIONSHIP' && item.field === 'commitments')) {
    const relationship = stateAfter.relationships[change.targetId];
    if (!relationship) continue;
    for (const actorId of [relationship.fromId, relationship.toId]) {
      const memory = next[actorId];
      if (!memory) continue;
      memory.events.push({
        id: `memory_${auditId}_${change.id}_${actorId}_commitment`, actorId, turn: stateAfter.turn, kind: 'COMMITMENT',
        summary: `${stateAfter.entities[relationship.fromId]?.name ?? relationship.fromId} and ${stateAfter.entities[relationship.toId]?.name ?? relationship.toId}: ${String((change.after as string[]).at(-1) ?? change.cause)}`,
        importance: 'MODERATE', relatedEntityIds: [relationship.fromId, relationship.toId], sourceAuditId: auditId,
      });
    }
  }

  for (const change of changes.filter((item) => importanceScore[item.impactClass] >= importanceScore.MODERATE)) {
    const relatedActorIds = new Set<string>();
    if (stateAfter.entities[change.targetId]) relatedActorIds.add(change.targetId);
    if (change.targetType === 'RELATIONSHIP') {
      const relationship = stateAfter.relationships[change.targetId];
      if (relationship) {
        relatedActorIds.add(relationship.fromId);
        relatedActorIds.add(relationship.toId);
      }
    }
    for (const actorId of relatedActorIds) {
      const memory = next[actorId];
      if (!memory) continue;
      memory.events.push({
        id: `memory_${auditId}_${change.id}_${actorId}`,
        actorId,
        turn: stateAfter.turn,
        kind: change.targetType === 'RELATIONSHIP' ? 'RELATIONSHIP' : 'OUTCOME',
        summary: change.cause,
        importance: change.impactClass,
        relatedEntityIds: [...relatedActorIds],
        sourceAuditId: auditId,
      });
    }
  }

  for (const memory of Object.values(next)) {
    memory.events = memory.events
      .sort((a, b) => importanceScore[b.importance] - importanceScore[a.importance] || b.turn - a.turn)
      .slice(0, 200)
      .sort((a, b) => a.turn - b.turn);
  }
  return next;
};
