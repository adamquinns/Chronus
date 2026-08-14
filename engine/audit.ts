import { ActorMemoryState, BeliefState, TurnAudit, WorldState } from './domain';

const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
    .join(',')}}`;
};

export const snapshotHash = (value: unknown) => {
  const input = stable(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const reconstructCommittedTurn = (audit: TurnAudit): { state: WorldState; beliefs: BeliefState; memories: Record<string, ActorMemoryState> } => {
  if (audit.legacyIncomplete) throw new Error('Legacy audit does not contain an exact reconstructable snapshot.');
  if (snapshotHash(audit.previousStateSnapshot) !== audit.previousStateHash) throw new Error('Audit previous-state hash mismatch.');
  if (snapshotHash(audit.committedStateSnapshot) !== audit.committedStateHash) throw new Error('Audit committed-state hash mismatch.');
  if (audit.previousStateSnapshot.revision !== audit.priorRevision) throw new Error('Audit prior revision mismatch.');
  if (audit.committedStateSnapshot.revision !== audit.committedRevision) throw new Error('Audit committed revision mismatch.');
  return {
    state: structuredClone(audit.committedStateSnapshot),
    beliefs: structuredClone(audit.committedBeliefSnapshot),
    memories: structuredClone(audit.committedMemorySnapshot),
  };
};
