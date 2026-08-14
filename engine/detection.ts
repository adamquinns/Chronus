import { DetectionRecord, Id, StrategyGraph, StrategyMechanism, WorldState } from './domain';
import { drawSeeded } from './rng';

export interface DetectionResult {
  perceptions: Record<Id, StrategyMechanism[]>;
  records: DetectionRecord[];
  cursor: number;
}

const intelligenceCapability = /intelligence|recon|surveil|collection|investigat|audit|spy|counterintelligence/i;

export const resolveDetection = (
  graph: StrategyGraph,
  actorIds: Id[],
  state: WorldState,
  rngSeed = state.rngSeed,
  rngCursor = state.rngCursor,
): DetectionResult => {
  const perceptions: Record<Id, StrategyMechanism[]> = Object.fromEntries(actorIds.map((actorId) => [actorId, []]));
  const records: DetectionRecord[] = [];
  let cursor = rngCursor;
  const packagePenalty = Math.max(0, graph.mechanisms.length - 3) * 0.05;
  const deceptionCover = graph.mechanisms.some((mechanism) => mechanism.kind === 'DECEPTION');
  for (const actorId of actorIds) {
    const actor = state.entities[actorId];
    if (!actor) continue;
    for (const mechanism of graph.mechanisms.filter((candidate) => candidate.concealed || candidate.kind === 'DECEPTION' || candidate.kind === 'INTELLIGENCE')) {
      const draw = drawSeeded(rngSeed, cursor);
      cursor = draw.cursor;
      const intelligenceBonus = actor.capabilities.some((capability) => intelligenceCapability.test(capability)) ? 0.2 : 0;
      const counterintelligence = Math.max(0, Math.min(1, actor.counterintelligence ?? 0));
      const probability = Math.max(0.05, Math.min(0.75, (0.25 + intelligenceBonus + packagePenalty - (deceptionCover && mechanism.kind !== 'DECEPTION' ? 0.1 : 0)) * (1 - counterintelligence * 0.4)));
      const detected = draw.value < probability;
      records.push({ id: `detect_${state.turn + 1}_${actorId}_${mechanism.id}`, turn: state.turn + 1, actorId, mechanismId: mechanism.id, source: 'STRATEGY', probability, draw: draw.value, detected, garbled: detected });
      if (detected) perceptions[actorId].push(mechanism);
    }
  }
  return { perceptions, records, cursor };
};
