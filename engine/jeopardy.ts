import {
  ActorAction,
  FeasibilityFinding,
  Id,
  ProposedEffect,
  StrategyGraph,
  StrategyMechanism,
  WorldState,
} from './domain';

/**
 * Jeopardy — what the player is putting at risk.
 *
 * The engine otherwise models only effects on other parties. That leaves it
 * unable to answer a reckless directive with the two things that should
 * actually happen: the institution refusing and the player's authority
 * collapsing, or the player going ahead and being destroyed. Both are
 * consequences. "It did not happen" is not.
 *
 * Jeopardy is computed deterministically from the directive and the world, and
 * it does three things: raises the ceiling on how large an outcome may be,
 * guarantees a catastrophic band exists to be drawn, and lets the player's own
 * apparatus refuse an order it should not be asked to carry out.
 */

/** The player putting their own person somewhere it can be harmed. */
const SELF_EXPOSING = /\b(?:i|me|my|myself|personally|in person)\b[^.;]{0,60}\b(?:go|going|goes|fly|flying|flight|travel|visit|land|arrive|walk|drive|sail|meet)\b|\b(?:take me|fly me|bring me|get me|put me)\b/i;
/** Deliberately shedding the protection that would normally attend them. */
const UNPROTECTED = /\b(?:no (?:military )?escort|without escort|unescorted|no security|without security|alone|unarmed|no protection|without protection|no detail|dismiss the detail)\b/i;
/**
 * Acts that are grave in themselves, whoever carries them out: irreversible,
 * unlawful, or of a kind that cannot be walked back once begun. The player's
 * own safety is not the only thing that can be staked.
 */
const EXTREME_ACT = /\b(?:assassinat\w*|kill\w*|murder\w*|execut(?:e|ion)\w*|liquidat\w*|decapitat\w*|coup\b|overthrow\w*|depos(?:e|ing)|invad\w*|invasion|first strike|nuclear (?:strike|launch|attack)|launch (?:the )?(?:missiles|nukes)|sabotag\w*|false flag|blackmail\w*|brib\w*|imprison\w*|suspend (?:the )?(?:constitution|congress|elections?)|martial law|purg(?:e|ing))\b/i;
/** Doing it to a head of state or an equivalent principal raises it again. */
const AGAINST_PRINCIPAL = /\b(?:castro|khrushchev|premier|president|prime minister|chairman|head of state|leader)\b/i;

/** Language that treats institutional constraint as an obstacle to override. */
const OVERRIDE = /\b(?:whatever it takes|i will not take no|no matter what|regardless|override|bypass|ignore (?:the|any)|do it anyway|i don'?t care|right now|immediately)\b/i;

export type { JeopardyAssessment } from './domain';
import type { JeopardyAssessment } from './domain';

const hostileTowardPlayer = (state: WorldState, targetId: Id) => {
  const playerId = state.manifest.playerId;
  const edge = Object.values(state.relationships).find((relationship) =>
    (relationship.fromId === playerId && relationship.toId === targetId)
    || (relationship.toId === playerId && relationship.fromId === targetId));
  const entity = state.entities[targetId];
  if (!entity) return false;
  return (edge ? edge.alignment < 35 : true) && (entity.kind === 'MILITARY' || entity.kind === 'STATE' || entity.power >= 50);
};

export const assessJeopardy = (
  graph: StrategyGraph,
  feasibility: FeasibilityFinding[],
  state: WorldState,
): JeopardyAssessment => {
  const findingFor = new Map(feasibility.map((finding) => [finding.mechanismId, finding]));
  const reasons: string[] = [];
  const exposingMechanismIds: Id[] = [];
  const refusableMechanismIds: Id[] = [];
  let physical = 0;
  let institutional = 0;
  let operational = 0;
  const extremeMechanismIds: Id[] = [];
  const directive = graph.mechanisms.map((mechanism) => mechanism.specifiedDetail).join(' ');

  for (const mechanism of graph.mechanisms) {
    const text = mechanism.specifiedDetail || mechanism.objective;
    const selfExposing = SELF_EXPOSING.test(text);
    if (selfExposing) {
      exposingMechanismIds.push(mechanism.id);
      physical += 30;
      reasons.push('The player is placing their own person in the path of events.');
      // Going toward a party that would welcome their harm is the difference
      // between a risky trip and an unsurvivable one.
      const towardHostile = mechanism.targetIds.some((id) => hostileTowardPlayer(state, id))
        || Object.values(state.entities).some((entity) =>
          hostileTowardPlayer(state, entity.id)
          && entity.name.toLowerCase().split(/[^a-z]+/).some((token) => token.length > 3 && text.toLowerCase().includes(token)));
      if (towardHostile) {
        physical += 30;
        reasons.push('The destination is held by a party with the means and the motive to do them harm.');
      }
      const dangerMetric = state.manifest.metricDefinitions.find((definition) =>
        definition.dangerAbove !== undefined && state.metrics[definition.id] >= definition.dangerAbove);
      if (dangerMetric) {
        physical += 20;
        reasons.push(`${dangerMetric.label} is already past its danger threshold; exposure now carries the crisis with it.`);
      }
    }

    // An order to the player's own establishment that a subordinate could
    // lawfully decline — because it is unprecedented, unprotected, or issued
    // over stated objection — strains the authority it is issued with.
    const finding = findingFor.get(mechanism.id);
    const ownApparatus = (mechanism.kind === 'DIRECT_ORDER' || mechanism.kind === 'COERCION')
      && (finding?.controlMode === 'DIRECT' || finding?.controlMode === 'DELEGATED');
    if (ownApparatus && (selfExposing || UNPROTECTED.test(directive) || OVERRIDE.test(directive))) {
      refusableMechanismIds.push(mechanism.id);
      institutional += 30;
      reasons.push('The order asks the player’s own people to carry out something they may refuse.');
    }
  }

  for (const mechanism of graph.mechanisms) {
    const text = `${mechanism.specifiedDetail} ${mechanism.objective}`;
    if (!EXTREME_ACT.test(text)) continue;
    extremeMechanismIds.push(mechanism.id);
    operational += 45;
    reasons.push('The act itself is of a kind that cannot be undone once begun.');
    // Aimed at a principal — a head of state or equivalent — whether named as
    // an entity or only in the text.
    const principal = mechanism.targetIds.some((id) => {
      const entity = state.entities[id];
      return entity?.kind === 'PERSON' && entity.power >= 40;
    }) || AGAINST_PRINCIPAL.test(text);
    if (principal) {
      operational += 25;
      reasons.push('It is aimed at a head of state, where failure and success are both events of the first order.');
    }
    const dangerMetric = state.manifest.metricDefinitions.find((definition) =>
      definition.dangerAbove !== undefined && state.metrics[definition.id] >= definition.dangerAbove);
    if (dangerMetric) {
      operational += 20;
      reasons.push(`${dangerMetric.label} is already past its danger threshold; an act this size lands on top of it.`);
    }
  }

  if (UNPROTECTED.test(directive)) {
    physical += 25;
    institutional += 15;
    reasons.push('Protection that would normally attend the player is being deliberately shed.');
  }
  if (OVERRIDE.test(directive)) {
    institutional += 20;
    reasons.push('The directive treats institutional constraint as an obstacle to be overridden.');
  }

  return {
    physical: Math.min(100, physical),
    institutional: Math.min(100, institutional),
    operational: Math.min(100, operational),
    reasons: [...new Set(reasons)],
    exposingMechanismIds,
    refusableMechanismIds,
    extremeMechanismIds,
  };
};

const REFUSES = /\b(?:declin|refus|reject|resist|oppos|advise against|will not|cannot comply|balk|object|counsel against|push back|withhold)/i;

/**
 * A directive's tone is not by itself a crisis of authority. What makes it one
 * is the player's own people actually balking. Assessed only after they have
 * responded, so the crisis is confirmed by refusal rather than by volume.
 */
export const escalateWithRefusal = (
  jeopardy: JeopardyAssessment,
  actorActions: ActorAction[],
  state: WorldState,
): JeopardyAssessment => {
  if (!jeopardy.refusableMechanismIds.length) return jeopardy;
  const refusers = actorActions.filter((action) =>
    action.perceivedPlayerMechanismIds.some((id) => jeopardy.refusableMechanismIds.includes(id))
    && REFUSES.test(action.action));
  if (!refusers.length) return jeopardy;
  const names = refusers.map((action) => state.entities[action.actorId]?.name ?? action.actorId);
  return {
    ...jeopardy,
    institutional: Math.min(100, jeopardy.institutional + 25 + (refusers.length - 1) * 10),
    reasons: [...jeopardy.reasons, `${names.join(' and ')} declined to carry the order out; the authority behind it is now in question.`],
  };
};

export const jeopardyIsGrave = (jeopardy: JeopardyAssessment) =>
  jeopardy.physical >= 60 || jeopardy.institutional >= 60 || jeopardy.operational >= 60;

/** How far outside ordinary business the directive sits, 0–1. Drives how wide
 * the outcome distribution should be and how large its effects may run. */
export const boldness = (jeopardy: JeopardyAssessment) =>
  Math.min(1, Math.max(jeopardy.physical, jeopardy.institutional, jeopardy.operational) / 100);

/**
 * The catastrophic effects a grave directive must be able to produce. These are
 * candidates placed in a catastrophe band — reachable, not certain.
 */
export const catastropheEffects = (
  jeopardy: JeopardyAssessment,
  state: WorldState,
  actorActions: ActorAction[],
): ProposedEffect[] => {
  const playerId = state.manifest.playerId;
  const effects: ProposedEffect[] = [];

  if (jeopardy.physical >= 60) {
    effects.push({
      id: 'catastrophe_player_lost',
      mechanismId: jeopardy.exposingMechanismIds[0] ?? 'jeopardy',
      targetType: 'ENTITY',
      targetId: playerId,
      field: 'status',
      direction: 'NEGATIVE',
      impactClass: 'SYSTEMIC',
      confidence: 'MEDIUM',
      engagement: 'ENGAGES_STRONGLY',
      cause: 'The player exposed their own person and did not survive the exposure.',
      dependencies: jeopardy.exposingMechanismIds.length ? jeopardy.exposingMechanismIds : [playerId],
      setValue: 'DESTROYED',
    });
    const escalation = state.manifest.metricRoles?.escalation;
    if (escalation && escalation in state.metrics) {
      effects.push({
        id: 'catastrophe_escalation',
        mechanismId: jeopardy.exposingMechanismIds[0] ?? 'jeopardy',
        targetType: 'METRIC',
        targetId: escalation,
        field: 'value',
        direction: 'POSITIVE',
        impactClass: 'SEVERE',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES_STRONGLY',
        cause: 'The loss of the head of government in contested space removed every restraint that depended on him.',
        dependencies: [playerId],
      });
    }
  }

  if (jeopardy.operational >= 60) {
    const escalation = state.manifest.metricRoles?.escalation;
    if (escalation && escalation in state.metrics) {
      effects.push({
        id: 'catastrophe_operation_exposed',
        mechanismId: jeopardy.extremeMechanismIds[0] ?? 'jeopardy',
        targetType: 'METRIC',
        targetId: escalation,
        field: 'value',
        direction: 'POSITIVE',
        impactClass: 'SEVERE',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES_STRONGLY',
        cause: 'The operation was exposed before it could be disowned, and the other side read it as an act of war.',
        dependencies: jeopardy.extremeMechanismIds.length ? jeopardy.extremeMechanismIds : [playerId],
        immediate: true,
      });
    }
    const support = state.manifest.metricRoles?.support ?? state.manifest.metricRoles?.cohesion;
    if (support && support in state.metrics) {
      effects.push({
        id: 'catastrophe_operation_disgrace',
        mechanismId: jeopardy.extremeMechanismIds[0] ?? 'jeopardy',
        targetType: 'METRIC',
        targetId: support,
        field: 'value',
        direction: 'NEGATIVE',
        impactClass: 'SEVERE',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES_STRONGLY',
        cause: 'What was ordered in secret did not stay secret, and the standing of the office did not survive the telling.',
        dependencies: jeopardy.extremeMechanismIds.length ? jeopardy.extremeMechanismIds : [playerId],
        immediate: true,
      });
    }
  }

  if (jeopardy.institutional >= 60) {
    // Whoever was asked to carry it out is who breaks with the player.
    const refuser = actorActions.find((action) => action.perceivedPlayerMechanismIds
      .some((id) => jeopardy.refusableMechanismIds.includes(id)))?.actorId;
    const edge = Object.values(state.relationships).find((relationship) =>
      (relationship.fromId === playerId && relationship.toId === (refuser ?? ''))
      || (relationship.toId === playerId && relationship.fromId === (refuser ?? '')));
    if (edge) {
      effects.push({
        id: 'catastrophe_authority_breaks',
        mechanismId: jeopardy.refusableMechanismIds[0] ?? 'jeopardy',
        targetType: 'RELATIONSHIP',
        targetId: edge.id,
        field: 'trust',
        direction: 'NEGATIVE',
        impactClass: 'SEVERE',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES_STRONGLY',
        cause: 'The player’s own establishment declined the order, and the authority behind it did not survive the refusal.',
        dependencies: refuser ? [refuser] : [playerId],
        actorId: refuser,
      });
    }
    const cohesion = state.manifest.metricRoles?.cohesion ?? state.manifest.metricRoles?.support;
    if (cohesion && cohesion in state.metrics) {
      effects.push({
        id: 'catastrophe_legitimacy',
        mechanismId: jeopardy.refusableMechanismIds[0] ?? 'jeopardy',
        targetType: 'METRIC',
        targetId: cohesion,
        field: 'value',
        direction: 'NEGATIVE',
        impactClass: 'SEVERE',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES_STRONGLY',
        cause: 'An order refused in the open put the player’s fitness to command in question.',
        dependencies: refuser ? [refuser] : [playerId],
      });
    }
  }
  return effects;
};

/** A directive this exposed must have a real chance of ending badly. */
export const catastropheProbability = (jeopardy: JeopardyAssessment) => {
  const worst = Math.max(jeopardy.physical, jeopardy.institutional, jeopardy.operational);
  if (worst < 60) return 0;
  return Math.min(0.45, 0.12 + ((worst - 60) / 40) * 0.3);
};

export const mechanismIsExposing = (mechanism: StrategyMechanism) =>
  SELF_EXPOSING.test(mechanism.specifiedDetail || mechanism.objective);
