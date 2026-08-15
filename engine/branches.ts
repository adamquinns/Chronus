import {
  ActorAction,
  ArcState,
  FeasibilityFinding,
  Id,
  ProposedEffect,
  StrategyGraph,
  StrategyMechanism,
  WorldState,
} from './domain';
import { visibility } from './visibility';

/**
 * Durable branch creation.
 *
 * When the player attempts something that lands but does not resolve — a demand
 * on someone who need not comply, a confrontation with an institution — the
 * consequence is not a one-turn number nudge. It is an open situation: the
 * other party has to decide, others take sides, it leaks or hardens or is
 * settled. This module turns those unresolved attempts into arcs that persist,
 * advance on their own clock, and can be re-entered on later turns.
 *
 * Everything here is deterministic and emitted as ordinary effects, so branches
 * are created through the same commit path — and land in the causal ledger —
 * as any other change.
 */

const BRANCH_PREFIX = 'branch_';

/** Deterministic per-confrontation id, so pressing the same demand again
 * escalates the SAME branch instead of spawning a duplicate. */
export const branchIdFor = (mechanism: StrategyMechanism): Id =>
  `${BRANCH_PREFIX}${[...mechanism.targetIds].sort().join('_') || 'unaddressed'}`;

const nameOf = (state: WorldState, id: Id) => state.entities[id]?.name ?? id.replaceAll('_', ' ');

const titleFor = (state: WorldState, mechanism: StrategyMechanism) => {
  const targets = mechanism.targetIds.map((id) => nameOf(state, id)).join(' and ');
  if (mechanism.kind === 'DIRECT_ORDER' || mechanism.kind === 'COERCION') {
    return `Unmet demand on ${targets || 'an unnamed party'}`;
  }
  return `Open question with ${targets || 'an unnamed party'}`;
};

export interface BranchOutcome {
  effects: ProposedEffect[];
  opened: Id[];
  escalated: Id[];
}

/**
 * A branch opens when an attempt is executable but cannot compel its outcome,
 * and at least one actor actually engaged with it. Both halves matter: without
 * executability there was no attempt, and without a response there is no live
 * situation — only an intention.
 */
export const deriveBranchEffects = (
  graph: StrategyGraph,
  feasibility: FeasibilityFinding[],
  actorActions: ActorAction[],
  state: WorldState,
): BranchOutcome => {
  const findingFor = new Map(feasibility.map((finding) => [finding.mechanismId, finding]));
  const respondingActors = new Set(actorActions
    .filter((action) => action.perceivedPlayerMechanismIds.length)
    .map((action) => action.actorId));
  const effects: ProposedEffect[] = [];
  const opened: Id[] = [];
  const escalated: Id[] = [];
  const handled = new Set<Id>();

  for (const mechanism of graph.mechanisms) {
    const finding = findingFor.get(mechanism.id);
    if (!finding?.executable) continue;
    if (!finding.reinterpretedAs) continue; // compulsion existed: not an open question
    if (!mechanism.targetIds.length) continue;
    if (!mechanism.targetIds.some((id) => respondingActors.has(id))) continue;

    const branchId = branchIdFor(mechanism);
    if (handled.has(branchId)) continue;
    handled.add(branchId);

    const participantIds = [...new Set([state.manifest.playerId, ...mechanism.targetIds, ...respondingActors])]
      .filter((id) => state.entities[id]);
    // Pressure scales with the informal leverage actually behind the demand:
    // a head of government leaning on their own institutions opens a hotter
    // situation than a stranger asking a favour.
    const pressure = Math.max(8, Math.round((finding.informalLeverage ?? 0) / 4));
    const existing = state.arcs[branchId];

    if (existing && existing.status === 'ACTIVE') {
      effects.push({
        id: `branch_press_${branchId}_${state.turn + 1}`,
        mechanismId: mechanism.id,
        targetType: 'ARC',
        targetId: branchId,
        field: 'progress',
        direction: 'POSITIVE',
        impactClass: 'MINOR',
        confidence: 'HIGH',
        engagement: 'ENGAGES',
        cause: `The player pressed the unresolved demand on ${mechanism.targetIds.map((id) => nameOf(state, id)).join(' and ')} again.`,
        dependencies: mechanism.targetIds,
      });
      escalated.push(branchId);
      continue;
    }
    if (existing) continue; // already resolved or failed; do not silently reopen

    const branch: ArcState = {
      id: branchId,
      title: titleFor(state, mechanism),
      description: `${nameOf(state, state.manifest.playerId)} pressed for an outcome the other party is free to refuse: ${mechanism.specifiedDetail || mechanism.objective}. It is unsettled, and the participants are deciding.`,
      progress: pressure,
      threshold: 100,
      direction: 'RISING',
      status: 'ACTIVE',
      dueTurn: state.turn + 4,
      ownerId: mechanism.targetIds[0],
      participantIds,
      // A demand made privately stays private; anything else is observable to
      // the people in the room.
      visibility: mechanism.concealed
        ? visibility('ACTOR_KNOWN', participantIds)
        : visibility('PUBLIC'),
      // If the confrontation runs its full course unresolved, the relationship
      // it was conducted through hardens against the player.
      onResolve: buildRuptureEffects(branchId, state, mechanism.targetIds),
    };

    effects.push({
      id: `branch_open_${branchId}_${state.turn + 1}`,
      mechanismId: mechanism.id,
      targetType: 'ARC',
      targetId: branchId,
      field: 'create',
      direction: 'NEUTRAL',
      impactClass: 'NONE',
      confidence: 'HIGH',
      engagement: 'ENGAGES',
      cause: `An unresolved ${finding.reinterpretedAs.toLowerCase()} opened a live situation with ${mechanism.targetIds.map((id) => nameOf(state, id)).join(' and ')}.`,
      dependencies: mechanism.targetIds,
      setValue: branch,
    });
    opened.push(branchId);
  }

  return { effects, opened, escalated };
};

const buildRuptureEffects = (branchId: Id, state: WorldState, targetIds: Id[]): ProposedEffect[] => {
  const playerId = state.manifest.playerId;
  return targetIds.flatMap((targetId) => {
    const edge = Object.values(state.relationships).find((relationship) =>
      (relationship.fromId === playerId && relationship.toId === targetId)
      || (relationship.toId === playerId && relationship.fromId === targetId));
    if (!edge) return [];
    return [{
      id: `branch_rupture_${branchId}_${targetId}`,
      mechanismId: `arc:${branchId}`,
      targetType: 'RELATIONSHIP' as const,
      targetId: edge.id,
      field: 'trust',
      direction: 'NEGATIVE' as const,
      impactClass: 'MODERATE' as const,
      confidence: 'MEDIUM' as const,
      engagement: 'ENGAGES' as const,
      cause: `The unresolved confrontation with ${nameOf(state, targetId)} hardened into a lasting breach.`,
      dependencies: [targetId],
      actorId: targetId,
    }];
  });
};
