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
import { drawSeeded } from './rng';

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

export type BranchIncidentKind = 'THIRD_PARTY_TAKES_SIDES' | 'LEAK' | 'COUNTER_PRESSURE';

export interface BranchIncident {
  branchId: Id;
  kind: BranchIncidentKind;
  actorId?: Id;
  probability: number;
  draw: number;
  summary: string;
}

export interface BranchOutcome {
  effects: ProposedEffect[];
  opened: Id[];
  escalated: Id[];
  deescalated: Id[];
  settled: Id[];
  incidents: BranchIncident[];
  cursor: number;
}

/** Talking to the party you are in conflict with is de-escalation; pressing
 * them again is not. Kind is the honest signal here — a demand repeated in
 * softer words is still a demand. */
const CONCILIATORY: StrategyMechanism['kind'][] = ['DIPLOMACY', 'PUBLIC_COMMUNICATION', 'COALITION_BUILDING'];

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
  rngSeed = state.rngSeed,
  rngCursor = state.rngCursor,
): BranchOutcome => {
  const findingFor = new Map(feasibility.map((finding) => [finding.mechanismId, finding]));
  const respondingActors = new Set(actorActions
    .filter((action) => action.perceivedPlayerMechanismIds.length)
    .map((action) => action.actorId));
  const effects: ProposedEffect[] = [];
  const opened: Id[] = [];
  const escalated: Id[] = [];
  const deescalated: Id[] = [];
  const settled: Id[] = [];
  const incidents: BranchIncident[] = [];
  const handled = new Set<Id>();
  let cursor = rngCursor;

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

  // ── Existing branches live on: they de-escalate, settle, or generate
  // pressure of their own while the player is looking elsewhere. ──────────
  for (const branch of Object.values(state.arcs)) {
    if (!branch.id.startsWith(BRANCH_PREFIX) || branch.status !== 'ACTIVE') continue;
    if (handled.has(branch.id)) continue;
    const ownerId = branch.ownerId;
    if (!ownerId) continue;

    // The owner conceding settles it, whatever the player did this turn.
    const ownerAction = actorActions.find((action) => action.actorId === ownerId);
    if (ownerAction && CONCEDES.test(ownerAction.action)) {
      effects.push(settlementEffect(branch.id, state, ownerId, `${nameOf(state, ownerId)} conceded the point and the confrontation closed.`));
      settled.push(branch.id);
      handled.add(branch.id);
      continue;
    }

    // Engaging the other party rather than pressing them cools it, and a
    // fully cooled confrontation is settled rather than merely quiet.
    const conciliatory = graph.mechanisms.some((mechanism) =>
      mechanism.targetIds.includes(ownerId) && CONCILIATORY.includes(mechanism.kind));
    if (conciliatory) {
      if (branch.progress <= 12) {
        effects.push(settlementEffect(branch.id, state, ownerId, `${nameOf(state, state.manifest.playerId)} engaged ${nameOf(state, ownerId)} directly and the confrontation was settled.`));
        settled.push(branch.id);
      } else {
        effects.push({
          id: `branch_cool_${branch.id}_${state.turn + 1}`,
          mechanismId: `arc:${branch.id}`,
          targetType: 'ARC',
          targetId: branch.id,
          field: 'progress',
          direction: 'NEGATIVE',
          impactClass: 'MINOR',
          confidence: 'HIGH',
          engagement: 'ENGAGES',
          cause: `Engaging ${nameOf(state, ownerId)} directly took heat out of the unresolved demand.`,
          dependencies: [ownerId],
        });
        deescalated.push(branch.id);
      }
      handled.add(branch.id);
      continue;
    }

    // Otherwise the situation is live and can throw off its own events. The
    // hotter it runs, the likelier that is.
    // A live confrontation inside a government is not quiet: people take
    // sides, it leaks, the other party pushes back. The hotter it runs the
    // likelier that is, but even a fresh one rarely sits inert.
    const chance = Math.min(0.8, 0.3 + (branch.progress / 100) * 0.5);
    const roll = drawSeeded(rngSeed, cursor);
    cursor = roll.cursor;
    if (roll.value > chance) continue;

    const incident = buildIncident(branch, state, rngSeed, cursor);
    cursor = incident.cursor;
    if (!incident.effects.length) continue;
    effects.push(...incident.effects);
    incidents.push({ ...incident.record, probability: chance, draw: roll.value });
    handled.add(branch.id);
  }

  return { effects, opened, escalated, deescalated, settled, incidents, cursor };
};

const CONCEDES = /\b(?:concede|concedes|conceded|comply|complies|complied|agree|agrees|agreed|accept|accepts|accepted|resign|resigns|resigned|step down|steps down|yield|yields|yielded)\b/i;

const settlementEffect = (branchId: Id, state: WorldState, ownerId: Id, cause: string): ProposedEffect => {
  const edge = Object.values(state.relationships).find((relationship) =>
    (relationship.fromId === state.manifest.playerId && relationship.toId === ownerId)
    || (relationship.toId === state.manifest.playerId && relationship.fromId === ownerId));
  return {
    id: `branch_settle_${branchId}_${state.turn + 1}`,
    mechanismId: `arc:${branchId}`,
    targetType: 'ARC',
    targetId: branchId,
    field: 'status',
    direction: 'NEUTRAL',
    impactClass: 'NONE',
    confidence: 'HIGH',
    engagement: 'ENGAGES',
    cause,
    dependencies: [ownerId],
    setValue: 'RESOLVED',
    // Settling repairs some of what the confrontation cost.
    onSettle: edge ? [{
      id: `branch_settle_repair_${branchId}`,
      mechanismId: `arc:${branchId}`,
      targetType: 'RELATIONSHIP' as const,
      targetId: edge.id,
      field: 'trust',
      direction: 'POSITIVE' as const,
      impactClass: 'MINOR' as const,
      confidence: 'MEDIUM' as const,
      engagement: 'ENGAGES' as const,
      cause: `Settling the confrontation with ${nameOf(state, ownerId)} restored some standing.`,
      dependencies: [ownerId],
      actorId: ownerId,
    }] : [],
  } as ProposedEffect;
};

/** Third parties are drawn in through the relationship graph, not by script:
 * whoever is actually connected to the participants is who gets involved. */
const buildIncident = (
  branch: { id: Id; progress: number; participantIds: Id[]; ownerId?: Id; visibility: { classification: string } },
  state: WorldState,
  rngSeed: number,
  startCursor: number,
): { effects: ProposedEffect[]; record: Omit<BranchIncident, 'probability' | 'draw'>; cursor: number } => {
  let cursor = startCursor;
  const playerId = state.manifest.playerId;
  const ownerId = branch.ownerId!;
  const isPrivate = branch.visibility.classification !== 'PUBLIC';

  // A private confrontation can surface. That is the most consequential thing
  // that can happen to it, so it is checked first.
  if (isPrivate) {
    const leak = drawSeeded(rngSeed, cursor);
    cursor = leak.cursor;
    if (leak.value < 0.35) {
      return {
        cursor,
        record: { branchId: branch.id, kind: 'LEAK', summary: `The confrontation with ${nameOf(state, ownerId)} became public knowledge.` },
        effects: [{
          id: `branch_leak_${branch.id}_${state.turn + 1}`,
          mechanismId: `arc:${branch.id}`,
          targetType: 'ARC',
          targetId: branch.id,
          field: 'visibility',
          direction: 'NEUTRAL',
          impactClass: 'NONE',
          confidence: 'MEDIUM',
          engagement: 'ENGAGES',
          cause: `The confrontation with ${nameOf(state, ownerId)} leaked and is no longer private.`,
          dependencies: [ownerId],
          setValue: visibility('PUBLIC'),
        }],
      };
    }
  }

  const candidates = Object.values(state.relationships)
    .filter((relationship) => relationship.communication
      && (branch.participantIds.includes(relationship.fromId) || branch.participantIds.includes(relationship.toId)))
    .map((relationship) => (branch.participantIds.includes(relationship.fromId) ? relationship.toId : relationship.fromId))
    .filter((id) => id !== playerId && !branch.participantIds.includes(id) && state.entities[id]?.status === 'ACTIVE');
  const unique = [...new Set(candidates)].sort();

  if (unique.length) {
    const pick = drawSeeded(rngSeed, cursor);
    cursor = pick.cursor;
    const thirdParty = unique[Math.floor(pick.value * unique.length) % unique.length];
    const playerEdge = Object.values(state.relationships).find((relationship) =>
      (relationship.fromId === playerId && relationship.toId === thirdParty)
      || (relationship.toId === playerId && relationship.fromId === thirdParty));
    // Which way they lean follows their existing alignment with the player.
    const backsPlayer = (playerEdge?.alignment ?? 50) >= 55;
    const effects: ProposedEffect[] = [{
      id: `branch_join_${branch.id}_${thirdParty}`,
      mechanismId: `arc:${branch.id}`,
      targetType: 'ARC',
      targetId: branch.id,
      field: 'participants',
      direction: 'NEUTRAL',
      impactClass: 'NONE',
      confidence: 'MEDIUM',
      engagement: 'ENGAGES',
      cause: `${nameOf(state, thirdParty)} was drawn into the confrontation with ${nameOf(state, ownerId)}.`,
      dependencies: [ownerId, thirdParty],
      setValue: thirdParty,
    }];
    if (playerEdge) {
      effects.push({
        id: `branch_side_${branch.id}_${thirdParty}`,
        mechanismId: `arc:${branch.id}`,
        targetType: 'RELATIONSHIP',
        targetId: playerEdge.id,
        field: 'alignment',
        direction: backsPlayer ? 'POSITIVE' : 'NEGATIVE',
        impactClass: 'MINOR',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES',
        cause: `${nameOf(state, thirdParty)} took ${backsPlayer ? 'the player’s side' : `${nameOf(state, ownerId)}’s side`} in the unresolved confrontation.`,
        dependencies: [thirdParty],
        actorId: thirdParty,
      });
    }
    return {
      cursor,
      effects,
      record: {
        branchId: branch.id,
        kind: 'THIRD_PARTY_TAKES_SIDES',
        actorId: thirdParty,
        summary: `${nameOf(state, thirdParty)} took ${backsPlayer ? 'the player’s' : `${nameOf(state, ownerId)}’s`} side.`,
      },
    };
  }

  // Nobody left to draw in: the other party pushes back on their own.
  return {
    cursor,
    record: { branchId: branch.id, kind: 'COUNTER_PRESSURE', actorId: ownerId, summary: `${nameOf(state, ownerId)} pushed back on the unresolved demand.` },
    effects: [{
      id: `branch_counter_${branch.id}_${state.turn + 1}`,
      mechanismId: `arc:${branch.id}`,
      targetType: 'ARC',
      targetId: branch.id,
      field: 'progress',
      direction: 'POSITIVE',
      impactClass: 'MINOR',
      confidence: 'MEDIUM',
      engagement: 'ENGAGES',
      cause: `${nameOf(state, ownerId)} pushed back rather than settling, hardening the confrontation.`,
      dependencies: [ownerId],
      actorId: ownerId,
    }],
  };
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
