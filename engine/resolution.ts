import {
  ActorAction,
  Adjudication,
  BeliefState,
  Campaign,
  ActorSimulationAudit,
  CausalPrecedent,
  CounterfactualBranch,
  EffectRecommendation,
  FeasibilityFinding,
  RedTeamFinding,
  StrategyGraph,
  TurnDepth,
  TurnNarrative,
  WorldState,
  StrategyMechanism,
  NarrativePacket,
} from './domain';
import { normalizeDistribution } from './calibration';
import { ModelGateway } from './model';
import { actorActionsSchema, adjudicationSchema, narrativeSchema, normalizeAdjudicationWire, redTeamSchema } from './schemas';
import { actorVisibleState, authoritativeSnapshot, perceivedStrategyForActor } from './projections';
import { historicalPriorWeight } from './precedent';
import { canAccess } from './visibility';
import { mechanismIsExposing } from './jeopardy';

const relevantActorIds = (graph: StrategyGraph, state: WorldState, depth: TurnDepth) => {
  const ids = new Set<string>();
  for (const mechanism of graph.mechanisms) {
    mechanism.targetIds.forEach((id) => ids.add(id));
  }
  Object.values(state.arcs)
    .filter((arc) => arc.status === 'ACTIVE' && arc.ownerId)
    // A confrontation the player opened outranks ambient scenario arcs for
    // actor attention: the storyline they started must not go quiet because
    // louder background pressure exists.
    .sort((a, b) => Number(b.id.startsWith('branch_')) - Number(a.id.startsWith('branch_')) || b.progress - a.progress)
    .forEach((arc) => ids.add(arc.ownerId!));
  ids.delete(state.manifest.playerId);
  const limit = depth === 'DEEP' ? 4 : depth === 'COMPLEX' ? 3 : depth === 'STANDARD' ? 2 : 1;
  return [...ids].filter((id) => state.entities[id]?.status === 'ACTIVE' || state.entities[id]?.status === 'DEGRADED').slice(0, limit);
};

const initiativeActorIds = (state: WorldState, depth: TurnDepth) => {
  if (depth === 'ROUTINE') return [];
  const playerId = state.manifest.playerId;
  return Object.values(state.entities)
    .filter((entity) => entity.id !== playerId && (entity.status === 'ACTIVE' || entity.status === 'DEGRADED'))
    .map((entity) => ({
      id: entity.id,
      score: (Object.values(state.arcs).some((arc) => arc.status === 'ACTIVE' && arc.ownerId === entity.id) ? 3 : 0)
        + (Object.values(state.relationships).some((relationship) => relationship.alignment < 35 && ((relationship.fromId === playerId && relationship.toId === entity.id) || (relationship.toId === playerId && relationship.fromId === entity.id))) ? 2 : 0)
        + (entity.objectives.some((objective) => state.manifest.metricDefinitions.some((metric) => objective.toLowerCase().includes(metric.id.replaceAll('_', ' ')) || objective.toLowerCase().includes(metric.label.toLowerCase()))) ? 1 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 2)
    .map((entry) => entry.id);
};

const fallbackActorAction = (actorId: string, state: WorldState, graph: StrategyGraph, initiative = false): ActorAction => {
  const actor = state.entities[actorId];
  const perceived = perceivedStrategyForActor(actorId, graph);
  // An actor pressed to comply has a decision to make, and declining is the
  // ordinary answer when nothing obliges them. Saying so plainly keeps the
  // offline path capable of the same outcomes as the live one.
  const pressed = perceived.mechanisms.some((mechanism) =>
    (mechanism.kind === 'DIRECT_ORDER' || mechanism.kind === 'COERCION') && mechanism.targetIds.includes(actorId));
  const compelled = state.manifest.authorityRules.some((rule) =>
    rule.actorId === state.manifest.playerId && rule.targetId === actorId && (rule.mode === 'DIRECT' || rule.mode === 'DELEGATED'));
  // Authority is not the only thing that decides whether an order is carried
  // out. Being asked to deliver one's own head of government into harm is
  // refused by people who are otherwise bound to obey — no pilot volunteers
  // for that flight.
  const charged = graph.mechanisms.some((mechanism) =>
    mechanism.targetIds.includes(actorId)
    && (mechanism.kind === 'DIRECT_ORDER' || mechanism.kind === 'COERCION' || mechanism.kind === 'INTELLIGENCE' || mechanism.kind === 'MILITARY_OPERATION'))
    && (actor.kind === 'INSTITUTION' || actor.kind === 'MILITARY' || actor.kind === 'FACTION');
  const asksToEndangerThePlayer = graph.mechanisms.some(mechanismIsExposing)
    && perceived.mechanisms.some((mechanism) => mechanism.targetIds.includes(actorId) || mechanism.kind === 'DIRECT_ORDER');
  return {
    actorId,
    objective: actor.objectives[0] ?? 'Preserve position',
    action: charged && !asksToEndangerThePlayer
      ? `${actor.name} sets ${actor.capabilities[0] ?? 'its own machinery'} to the task the president named, improvising a method inside the time allowed and accepting the exposure that speed forces on it.`
      : asksToEndangerThePlayer
      ? `${actor.name} declines to arrange it, refusing to be the instrument of the president’s own exposure, and advises against the whole course.`
      : pressed && !compelled
        ? `${actor.name} declines to carry out the demand and advises against it, citing ${actor.constraints[0] ?? 'its own standing constraints'}.`
        : pressed
          ? `${actor.name} weighs the order against ${actor.constraints[0] ?? 'its standing constraints'} before acting on it.`
          : perceived.mechanisms.length
            ? `${actor.name} prepares a response using ${actor.capabilities[0] ?? 'available influence'}.`
            : `${actor.name} continues pursuing ${actor.objectives[0] ?? 'its standing objective'}.`,
    mechanisms: [actor.capabilities[0] ?? 'institutional action'],
    perceivedPlayerMechanismIds: perceived.mechanisms.map((item) => item.id),
    beliefKeysUsed: [],
    capabilityIdsUsed: actor.capabilities.slice(0, 1),
    confidence: 'MEDIUM',
    initiative,
    targetIds: [],
    resourceClaims: [],
  };
};

export const simulateActors = async (
  graph: StrategyGraph,
  state: WorldState,
  beliefs: BeliefState,
  depth: TurnDepth,
  gateway?: ModelGateway,
  memories?: Campaign['memories'],
  detectedPerActor: Record<string, StrategyMechanism[]> = {},
): Promise<{ actions: ActorAction[]; packets: ActorSimulationAudit[] }> => {
  const reactiveActorIds = relevantActorIds(graph, state, depth);
  // Bodies the player has charged with achieving something: they owe a method.
  const delegatedTo = new Set(graph.mechanisms
    .filter((mechanism) => mechanism.kind === 'DIRECT_ORDER' || mechanism.kind === 'COERCION' || mechanism.kind === 'INTELLIGENCE' || mechanism.kind === 'MILITARY_OPERATION')
    .flatMap((mechanism) => mechanism.targetIds)
    .filter((id) => {
      const entity = state.entities[id];
      return entity && entity.id !== state.manifest.playerId
        && (entity.kind === 'INSTITUTION' || entity.kind === 'MILITARY' || entity.kind === 'FACTION');
    }));
  const initiativeIds = initiativeActorIds(state, depth);
  const initiativeSet = new Set(initiativeIds);
  const actorIds = [...new Set([...reactiveActorIds, ...initiativeIds])].slice(0, depth === 'DEEP' ? 5 : 4);
  if (!gateway) {
    const packets = actorIds.map((actorId) => {
      const perceived = perceivedStrategyForActor(actorId, graph, detectedPerActor[actorId]);
      const input = actorVisibleState(actorId, state, beliefs.actors[actorId] ?? { actorId, beliefs: {}, knownFactIds: [] }, perceived, memories?.[actorId]);
      return { actorId, input, output: [fallbackActorAction(actorId, state, graph, initiativeSet.has(actorId))] };
    });
    return { actions: packets.flatMap((packet) => packet.output), packets };
  }
  const packets: ActorSimulationAudit[] = [];
  const results = await Promise.all(actorIds.map(async (actorId) => {
    const perceived = perceivedStrategyForActor(actorId, graph, detectedPerActor[actorId]);
    const packet = actorVisibleState(
      actorId,
      state,
      beliefs.actors[actorId] ?? { actorId, beliefs: {}, knownFactIds: [] },
      perceived,
      memories?.[actorId],
    );
    const role = depth === 'DEEP' ? 'actor_deep' : 'actor_standard';
    let result;
    try {
      result = await gateway.callJson(role, [
        {
          role: 'system',
          content: delegatedTo.has(actorId)
            ? 'Simulate exactly the supplied actor. The player has charged you with an objective and left the method to you, which is how such orders are given. Devise the approach YOUR organisation would actually take with the capabilities in your packet, under the time and secrecy the player specified — including where it is rushed, exposed, or likely to go wrong. Report the concrete operational step you take. Never reply that the order lacks a method: supplying the method is your function.'
            : initiativeSet.has(actorId)
            ? 'Simulate exactly the supplied actor. Use only this packet. Propose one initiative that advances this actor’s own objective independently of the player’s current activity. Obey authority, resources, capabilities, time, geography, logistics, and communications. Never infer hidden player mechanisms or facts. Return one concise action with initiative true.'
            : 'Simulate exactly the supplied actor. Use only this packet. Pursue its objectives from its beliefs, capabilities, resources, authority, time, geography, logistics, and communication. Never infer hidden player mechanisms or facts absent from the packet. Return one concise action in actions.',
        },
        { role: 'user', content: JSON.stringify(packet) },
      ], actorActionsSchema, 'ActorActions');
    } catch {
      const output = [fallbackActorAction(actorId, state, graph, initiativeSet.has(actorId))];
      packets.push({ actorId, input: packet, output });
      return output;
    }
    const allowedCapabilities = new Set(state.entities[actorId].capabilities);
    const allowedPerceivedMechanisms = new Set(perceived.mechanisms.map((mechanism) => mechanism.id));
    const allowedBeliefs = new Set(Object.keys((beliefs.actors[actorId] ?? { beliefs: {} }).beliefs));
    const validActorTarget = (targetId: string, actionText: string) => {
      if (!state.entities[targetId]) return false;
      if (!/contact|negotiate|message|call|letter|diplom/i.test(actionText)) return true;
      return Object.values(state.relationships).some((relationship) => relationship.communication
        && ((relationship.fromId === actorId && relationship.toId === targetId) || (relationship.toId === actorId && relationship.fromId === targetId)));
    };
    const sanitizedOutput = result.value.actions
      .filter((action) => action.actorId === actorId)
      .map((action) => ({
        ...action,
        capabilityIdsUsed: action.capabilityIdsUsed.filter((capability) => allowedCapabilities.has(capability)),
        perceivedPlayerMechanismIds: action.perceivedPlayerMechanismIds.filter((id) => allowedPerceivedMechanisms.has(id)),
        beliefKeysUsed: action.beliefKeysUsed.filter((key) => allowedBeliefs.has(key)),
        targetIds: (action.targetIds ?? []).filter((targetId) => validActorTarget(targetId, action.action)),
        resourceClaims: (action.resourceClaims ?? []).filter((claim) => {
          const resource = state.resources[claim.resourceId];
          return Boolean(resource && resource.amount >= claim.amount
            && (resource.ownerId === actorId || state.entities[resource.ownerId]?.controllerId === actorId));
        }),
        initiative: initiativeSet.has(actorId),
      }))
      .filter((action) => action.capabilityIdsUsed.length > 0 || action.mechanisms.length === 0)
      .slice(0, 1);
    const output = sanitizedOutput.length
      ? sanitizedOutput
      : [fallbackActorAction(actorId, state, graph, initiativeSet.has(actorId))];
    packets.push({ actorId, input: packet, output });
    return output;
  }));
  return { actions: results.flat(), packets: packets.sort((a, b) => actorIds.indexOf(a.actorId) - actorIds.indexOf(b.actorId)) };
};

export const runRedTeam = async (
  graph: StrategyGraph,
  rawDirective: string,
  feasibility: FeasibilityFinding[],
  actorActions: ActorAction[],
  state: WorldState,
  precedents: CausalPrecedent[] = [],
  gateway?: ModelGateway,
): Promise<RedTeamFinding[]> => {
  if (!gateway) {
    return feasibility.filter((item) => !item.feasible).map((item) => ({
      category: 'HIDDEN_DEPENDENCY' as const,
      severity: item.classification === 'IMPOSSIBLE' ? 'BLOCKING' as const : 'WARNING' as const,
      claim: item.hardConstraints.join(' '),
      evidence: item.reasons,
      affectedMechanismIds: [item.mechanismId],
    }));
  }
  try {
    const result = await gateway.callJson('critic', [
      {
        role: 'system',
        content: 'Red-team a dry strategy against authoritative state. Look for compiler charity, omitted dependencies, omniscience, unavailable capability, unsupported surprise, second-order effects, and magnitude drift. Do not improve the plan or decide the outcome.',
      },
      { role: 'user', content: JSON.stringify({ literalPlayerDirective: rawDirective, strategy: graph, feasibility, actorActions, causalPrecedents: precedents, authoritativeState: authoritativeSnapshot(state) }) },
    ], redTeamSchema, 'RedTeamFindings');
    return result.value.findings;
  } catch {
    return feasibility.filter((item) => !item.feasible).map((item) => ({
      category: 'HIDDEN_DEPENDENCY', severity: item.classification === 'IMPOSSIBLE' ? 'BLOCKING' : 'WARNING',
      claim: item.hardConstraints.join(' ') || 'A feasibility constraint was detected.', evidence: item.reasons, affectedMechanismIds: [item.mechanismId],
    }));
  }
};

const effect = (
  id: string,
  mechanismId: string,
  targetId: string,
  direction: EffectRecommendation['direction'],
  impactClass: EffectRecommendation['impactClass'],
  cause: string,
): EffectRecommendation => ({
  id, mechanismId, targetType: 'METRIC', targetId, field: 'value', direction, impactClass,
  confidence: 'MEDIUM', engagement: 'ENGAGES', cause, dependencies: [],
});

const impactOrder: EffectRecommendation['impactClass'][] = ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE', 'SYSTEMIC'];

export const fallbackAdjudication = (
  graph: StrategyGraph,
  feasibility: FeasibilityFinding[],
  actorActions: ActorAction[],
  state: WorldState,
): Adjudication => {
  const effects: EffectRecommendation[] = [];
  const roleMetric = (role: keyof NonNullable<WorldState['manifest']['metricRoles']>) => {
    const configured = state.manifest.metricRoles?.[role];
    if (configured && configured in state.metrics) return configured;
    // Never silently substitute a danger metric for an unconfigured role: that
    // is precisely the rhetoric-to-escalation shortcut the causal-path rule
    // forbids. Only `escalation` may resolve to a danger-flagged metric.
    if (role === 'escalation') {
      return state.manifest.metricDefinitions.find((definition) => definition.dangerAbove !== undefined)?.id;
    }
    return state.manifest.metricDefinitions.find((definition) =>
      definition.dangerAbove === undefined && definition.dangerBelow === undefined)?.id;
  };
  const pushMetric = (
    mechanismId: string,
    targetId: string | undefined,
    direction: EffectRecommendation['direction'],
    impactClass: EffectRecommendation['impactClass'],
    cause: string,
    dependencies: string[] = [],
  ) => {
    if (targetId) effects.push({ ...effect(`e_${mechanismId}_${targetId}`, mechanismId, targetId, direction, impactClass, cause), dependencies });
  };
  const playerId = state.manifest.playerId;
  for (const mechanism of graph.mechanisms) {
    const check = feasibility.find((item) => item.mechanismId === mechanism.id);
    if (check?.classification === 'IMPOSSIBLE') continue;
    if (mechanism.kind === 'DIPLOMACY') {
      pushMetric(mechanism.id, roleMetric('cohesion'), 'POSITIVE', 'MODERATE', 'A viable diplomatic mechanism preserves negotiating room.');
      if (mechanism.targetIds.length) {
        pushMetric(mechanism.id, roleMetric('escalation'), 'NEGATIVE', 'MINOR', 'Direct communication reduces adversarial pressure and miscalculation.', [mechanism.targetIds[0]]);
      }
    } else if (mechanism.kind === 'MILITARY_OPERATION' || mechanism.kind === 'COERCION') {
      // Rule: rhetoric never reaches the escalation metric directly. Escalation
      // requires a typed causal path — a military operation, or coercion aimed
      // at a military/state actor. Domestic or personal coercion lands on the
      // objects nearest the action instead.
      const foreignPressureTarget = mechanism.targetIds.find((targetId) => {
        const target = state.entities[targetId];
        return target && (target.kind === 'MILITARY' || target.kind === 'STATE');
      });
      const escalationApplies = Boolean(state.manifest.metricRoles?.escalation)
        && (mechanism.kind === 'MILITARY_OPERATION' || Boolean(foreignPressureTarget));
      if (escalationApplies) {
        const dependency = foreignPressureTarget ?? mechanism.targetIds[0];
        pushMetric(mechanism.id, roleMetric('escalation'), 'POSITIVE', 'MAJOR', 'Military pressure increases escalation and misperception risk.', dependency ? [dependency] : Object.keys(state.arcs).slice(0, 1));
        pushMetric(mechanism.id, roleMetric('support'), 'POSITIVE', 'MINOR', 'A forceful response temporarily reassures supporters.');
      } else {
        const targetId = mechanism.targetIds[0];
        const relationship = targetId ? Object.values(state.relationships).find((candidate) =>
          (candidate.fromId === playerId && candidate.toId === targetId) || (candidate.toId === playerId && candidate.fromId === targetId)) : undefined;
        if (relationship) {
          effects.push({
            id: `e_${mechanism.id}_${relationship.id}_trust`,
            mechanismId: mechanism.id,
            targetType: 'RELATIONSHIP',
            targetId: relationship.id,
            field: 'trust',
            direction: 'NEGATIVE',
            impactClass: 'MODERATE',
            confidence: 'MEDIUM',
            engagement: 'ENGAGES',
            cause: 'Coercive pressure damages trust with the targeted actor even when the demand is heard.',
            dependencies: [targetId!],
          });
        } else if (targetId && state.entities[targetId]) {
          effects.push({
            id: `e_${mechanism.id}_${targetId}_resolve`,
            mechanismId: mechanism.id,
            targetType: 'ENTITY',
            targetId,
            field: 'resolve',
            direction: 'NEGATIVE',
            impactClass: 'MINOR',
            confidence: 'MEDIUM',
            engagement: 'ENGAGES_WEAKLY',
            cause: 'Pressure tests the target’s resolve without any established channel of trust to damage.',
            dependencies: [targetId],
          });
        } else {
          pushMetric(mechanism.id, roleMetric('oppositionMomentum'), 'NEGATIVE', 'MODERATE', 'Available operational pressure contests the opponent’s current initiative.');
        }
        pushMetric(mechanism.id, roleMetric('support'), 'NEGATIVE', 'MINOR', 'Visible strong-arming unsettles allies and observers.', targetId ? [targetId] : []);
      }
    } else if (mechanism.kind === 'INTELLIGENCE') {
      pushMetric(mechanism.id, roleMetric('intelligence'), 'POSITIVE', 'MODERATE', 'Focused collection improves decision-relevant information.');
      const discoverable = Object.values(state.facts).find((fact) =>
        fact.visibility.discoverable
        && !canAccess(fact.visibility, state.manifest.playerId, state.manifest.playerId, state.gameOver));
      if (discoverable) effects.push({
        id: `e_${mechanism.id}_discover_${discoverable.id}`,
        mechanismId: mechanism.id,
        targetType: 'FACT',
        targetId: discoverable.id,
        field: 'discover',
        direction: 'NEUTRAL',
        impactClass: 'NONE',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES',
        cause: 'Focused collection may expose an existing hidden fact.',
        dependencies: [],
        actorId: state.manifest.playerId,
      });
    } else if (mechanism.kind === 'PUBLIC_COMMUNICATION') {
      pushMetric(mechanism.id, roleMetric('support'), 'POSITIVE', 'MINOR', 'Clear public framing improves political support.');
    } else if (mechanism.kind === 'COALITION_BUILDING') {
      pushMetric(mechanism.id, roleMetric('cohesion'), 'POSITIVE', 'MINOR', 'Credible organizing strengthens coordination incrementally.');
    } else if (mechanism.kind === 'LEGAL_ACTION') {
      pushMetric(mechanism.id, roleMetric('legal'), 'POSITIVE', 'MODERATE', 'Legal preparation strengthens the available institutional position.');
    } else if (mechanism.kind === 'ECONOMIC_PRESSURE') {
      pushMetric(mechanism.id, roleMetric('oppositionMomentum'), 'NEGATIVE', 'MINOR', 'Economic pressure creates bounded implementation friction.');
    } else if (mechanism.kind === 'DECEPTION') {
      pushMetric(mechanism.id, roleMetric('exposure'), 'NEGATIVE', 'MINOR', 'Concealment temporarily reduces the opponent’s ability to counter the initiative.');
    } else if (mechanism.kind === 'RESOURCE_TRANSFER' && mechanism.resourceClaims.length) {
      for (const claim of mechanism.resourceClaims) effects.push({
        id: `e_${mechanism.id}_${claim.resourceId}`,
        mechanismId: mechanism.id,
        targetType: 'RESOURCE',
        targetId: claim.resourceId,
        field: 'amount',
        direction: 'NEGATIVE',
        impactClass: 'NONE',
        confidence: 'VERY_HIGH',
        engagement: 'ENGAGES_STRONGLY',
        cause: `The player directly allocated ${claim.amount} ${state.resources[claim.resourceId]?.unit ?? 'units'} of ${state.resources[claim.resourceId]?.label ?? claim.resourceId}.`,
        dependencies: [],
        proposedDelta: -claim.amount,
      });
    } else {
      const fallbackMetricId = Object.keys(state.metrics).find((id) => id !== state.manifest.metricRoles?.escalation) ?? Object.keys(state.metrics)[0];
      pushMetric(mechanism.id, fallbackMetricId, 'POSITIVE', 'TRIVIAL', 'The underspecified initiative creates only limited strategic movement.', mechanism.targetIds.slice(0, 1));
    }
  }
  const initiativeEffectIds: string[] = [];
  for (const action of actorActions.filter((candidate) => candidate.initiative)) {
    const ownedArc = Object.values(state.arcs)
      .filter((arc) => arc.status === 'ACTIVE' && arc.ownerId === action.actorId)
      .sort((a, b) => b.progress - a.progress)[0];
    if (ownedArc) {
      const id = `e_actor_${action.actorId}_${ownedArc.id}`;
      effects.push({
        id,
        mechanismId: `actor:${action.actorId}`,
        targetType: 'ARC',
        targetId: ownedArc.id,
        field: 'progress',
        direction: ownedArc.direction === 'FALLING' ? 'NEGATIVE' : ownedArc.direction === 'RISING' ? 'POSITIVE' : 'NEUTRAL',
        impactClass: 'TRIVIAL',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES',
        cause: `${state.entities[action.actorId]?.name ?? action.actorId} acts on its own initiative: ${action.action}`,
        dependencies: [],
        actorId: action.actorId,
      });
      initiativeEffectIds.push(id);
      continue;
    }
    const targetId = roleMetric('oppositionMomentum') ?? roleMetric('escalation') ?? roleMetric('cohesion');
    if (!targetId) continue;
    const id = `e_actor_${action.actorId}_${targetId}`;
    effects.push({
      ...effect(
        id,
        `actor:${action.actorId}`,
        targetId,
        'POSITIVE',
        'MINOR',
        `${state.entities[action.actorId]?.name ?? action.actorId} acts on its own initiative: ${action.action}`,
      ),
      dependencies: [action.actorId],
      actorId: action.actorId,
    });
    initiativeEffectIds.push(id);
  }
  const extreme = graph.mechanisms.filter((mechanism) =>
    /\b(?:assassinat\w*|kill\w*|murder\w*|execut(?:e|ion)\w*|liquidat\w*|decapitat\w*|coup\b|overthrow\w*|depos(?:e|ing)|invad\w*|invasion|first strike|nuclear (?:strike|launch|attack)|launch (?:the )?(?:missiles|nukes)|sabotag\w*|false flag|blackmail\w*|brib\w*|imprison\w*|suspend (?:the )?(?:constitution|congress|elections?)|martial law|purg(?:e|ing))\b/i
      .test(`${mechanism.specifiedDetail} ${mechanism.objective}`));
  // The instrument is who is asked to do it; the object is who it is done to.
  // Conflating them makes the victim the agent of their own assassination.
  const isInstrument = (id: string) => {
    const entity = state.entities[id];
    return Boolean(entity) && entity.id !== playerId
      && (entity.kind === 'INSTITUTION' || entity.kind === 'MILITARY' || entity.kind === 'FACTION');
  };
  const instrumentIds = [...new Set(extreme.flatMap((mechanism) => mechanism.targetIds).filter(isInstrument))];
  const chargedName = instrumentIds.map((id) => state.entities[id]?.name).filter(Boolean)[0]
    ?? 'the service charged with it';
  for (const mechanism of extreme) {
    // Being asked to do something irreversible changes the instrument, whatever
    // the result. An act of this size cannot resolve into a relationship tick.
    for (const targetId of mechanism.targetIds.filter(isInstrument)) {
      const edge = Object.values(state.relationships).find((relationship) =>
        (relationship.fromId === playerId && relationship.toId === targetId)
        || (relationship.toId === playerId && relationship.fromId === targetId));
      if (!edge) continue;
      effects.push({
        id: `e_${mechanism.id}_${edge.id}_strain`,
        mechanismId: mechanism.id,
        targetType: 'RELATIONSHIP',
        targetId: edge.id,
        field: 'trust',
        direction: 'NEGATIVE',
        impactClass: 'MAJOR',
        confidence: 'MEDIUM',
        engagement: 'ENGAGES',
        cause: `Being asked to carry out an irreversible act on this timetable strained ${state.entities[targetId]?.name ?? targetId}.`,
        dependencies: [targetId],
        immediate: true,
      });
    }
    if (mechanism.targetIds.length) {
      const escalationId = roleMetric('escalation');
      if (escalationId) {
        effects.push({
          ...effect(`e_${mechanism.id}_${escalationId}`, mechanism.id, escalationId, 'POSITIVE', 'MAJOR',
            'An irreversible operation set running during a standoff raises the odds of uncontrolled escalation.'),
          dependencies: mechanism.targetIds.slice(0, 1),
          immediate: true,
        });
      }
    }
  }
  const feasibleRatio = feasibility.length === 0 || feasibility.every((item) => item.feasible)
    ? 1
    : feasibility.some((item) => item.feasible)
      ? 0.5
      : 0;
  const alwaysIds = effects.filter((item) => item.immediate).map((item) => item.id);
  // Ordering it costs what it costs in every branch: the instrument is strained
  // by being asked whichever way the operation then turns out.
  const withInitiative = (ids: string[]) => [...new Set([...ids, ...initiativeEffectIds, ...alwaysIds])];
  const bands = normalizeDistribution(extreme.length ? [
    { id: 'botched', label: 'Botched under the deadline', probability: 0.3, effectIds: withInitiative(effects.map((item) => item.id)), description: `Rushed to an impossible timetable, ${chargedName} moves before it is ready; people are caught, and the exposure is not containable.` },
    { id: 'refused', label: 'The instrument balks', probability: 0.25, effectIds: withInitiative(effects.filter((item) => item.targetType === 'RELATIONSHIP').map((item) => item.id)), description: `${chargedName} will not be the hand that does this on these terms, and says so upward.` },
    { id: 'proceeds', label: 'It proceeds, and cannot be recalled', probability: 0.25, effectIds: withInitiative(effects.map((item) => item.id)), description: `${chargedName} sets the operation running. What follows now follows without the player's hand on it.` },
    { id: 'discovered', label: 'Someone else learns of it', probability: 0.2, effectIds: withInitiative(effects.slice(0, Math.max(1, Math.ceil(effects.length / 2))).map((item) => item.id)), description: 'The preparation does not stay inside the room it was ordered in.' },
  ] : [
    { id: 'setback', label: 'Setback', probability: 0.2 + (1 - feasibleRatio) * 0.25, effectIds: withInitiative(effects.filter((_, index) => index % 2 === 1).map((item) => item.id)), description: 'Opposition and execution friction blunt the strategy.' },
    { id: 'mixed', label: 'Mixed result', probability: 0.45, effectIds: withInitiative(effects.slice(0, Math.max(1, Math.ceil(effects.length / 2))).map((item) => item.id)), description: 'Some mechanisms engage while others stall.' },
    { id: 'strong', label: 'Strong result', probability: 0.35 * feasibleRatio, effectIds: withInitiative(effects.map((item) => item.id)), description: 'The main mechanisms engage and create meaningful advantage.' },
  ]);
  return {
    summary: 'Rule-based fallback adjudication derived from mechanism type, feasibility, and actor pressure.',
    mechanismFindings: graph.mechanisms.map((mechanism) => ({
      mechanismId: mechanism.id,
      engagement: feasibility.find((item) => item.mechanismId === mechanism.id)?.feasible ? 'ENGAGES' : 'DOES_NOT_ENGAGE',
      reason: feasibility.find((item) => item.mechanismId === mechanism.id)?.hardConstraints.join(' ') || 'No hard constraint prevents attempted execution.',
      confidence: 'MEDIUM',
    })),
    recommendedEffects: effects,
    outcomeBands: bands,
    assumptions: [],
    unknowns: actorActions.map((item) => `${item.actorId}: ${item.action}`),
    confidence: 'LOW',
  };
};

export const adjudicate = async (
  graph: StrategyGraph,
  feasibility: FeasibilityFinding[],
  actorActions: ActorAction[],
  redTeam: RedTeamFinding[],
  state: WorldState,
  depth: TurnDepth,
  precedents: CausalPrecedent[] = [],
  counterfactualBranches: CounterfactualBranch[] = [],
  gateway?: ModelGateway,
): Promise<Adjudication> => {
  if (!gateway) return fallbackAdjudication(graph, feasibility, actorActions, state);
  const prompt = {
    dryStrategy: graph,
    feasibility,
    actorActions,
    redTeam,
    causalPrecedents: precedents,
    robustnessBranches: counterfactualBranches,
    historicalPriorWeight: historicalPriorWeight(state),
    authoritativeState: authoritativeSnapshot(state),
    allowedImpactClasses: depth === 'DEEP'
      ? ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE', 'SYSTEMIC']
      : ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR'],
  };
  try {
    const result = await gateway.callJson('adjudicator', [
      {
        role: 'system',
        content: 'Adjudicate causal mechanisms, not rhetoric. EACH OUTCOME BAND MUST BE A CONCRETE SPECIFIC EVENT that differs in KIND from the others — who does what, to whom, with what visible result ("the rushed approach is rolled up: ten officers seized in Havana, two shot, the story reaches the networks Thursday") — never a valence label such as "setback" or "mixed result". Diverge across institutional refusal, botched execution, success that creates a worse problem, and discovery by a third party. When a directive is extreme, irreversible, or aimed at a head of state, its bands must carry effects of matching size at MAJOR, SEVERE or SYSTEMIC where the state supports them: an act that would change the world must not resolve into small numbers. Hard state is authoritative. Recommend bounded impact classes, never arbitrary point values. Use only existing targets. Actor responses are additional causal forces and may use mechanismId actor:<actorId>; player effects must use a supplied strategy mechanism ID. Every recommended effect must include a non-empty cause string and dependencies array (use [] when none). Any effect on the scenario’s escalation metric MUST include at least one non-metric dependency (an entity, relationship, arc, process, or another effect id) forming its causal path — words like force or immediately never justify escalation by themselves. The dryStrategy’s requestedOutcomes are objectives, never effects; its assertedExternalEvents must not be treated as true. A good plan may fail; a bad plan may occasionally succeed. Do not invent capabilities. Be concise: reasons under 80 words, at most 12 effects and 5 outcome bands. Probabilities must sum approximately to 1 and reference recommended effect IDs.',
      },
      { role: 'user', content: JSON.stringify(prompt) },
    ], adjudicationSchema, 'Adjudication');
    const normalized = normalizeAdjudicationWire(result.value);
    return { ...normalized, outcomeBands: normalizeDistribution(normalized.outcomeBands) };
  } catch (error) {
    throw new Error(`Primary adjudication failed: ${error instanceof Error ? error.message : 'unknown model error'}`);
  }
};

export const sanitizeAdjudication = (
  adjudication: Adjudication,
  state: WorldState,
  depth: TurnDepth,
  feasibility: FeasibilityFinding[] = [],
  actorActions: ActorAction[] = [],
  graph?: StrategyGraph,
  graveJeopardy = false,
): Adjudication => {
  const validTargets: Record<EffectRecommendation['targetType'], Set<string>> = {
    METRIC: new Set(Object.keys(state.metrics)),
    RESOURCE: new Set(Object.keys(state.resources)),
    ENTITY: new Set(Object.keys(state.entities)),
    RELATIONSHIP: new Set(Object.keys(state.relationships)),
    ARC: new Set(Object.keys(state.arcs)),
    FACT: new Set(Object.keys(state.facts)),
    PROCESS: new Set(Object.keys(state.pendingProcesses)),
    GOAL: new Set([state.goal.id]),
  };
  const allowedMechanisms = new Set(feasibility
    .filter((finding) => finding.classification !== 'IMPOSSIBLE')
    .map((finding) => finding.mechanismId));
  actorActions.forEach((action) => allowedMechanisms.add(`actor:${action.actorId}`));
  const modelEffects = adjudication.recommendedEffects.filter((candidate) => {
    if (feasibility.length && !allowedMechanisms.has(candidate.mechanismId)) return false;
    if (!validTargets[candidate.targetType].has(candidate.targetId)) return false;
    // The ceiling exists so ordinary turns cannot produce world-shaking
    // numbers. A directive that stakes the player's own person or authority
    // has earned the right to a world-shaking answer.
    if (depth !== 'DEEP' && !graveJeopardy && (candidate.impactClass === 'SEVERE' || candidate.impactClass === 'SYSTEMIC')) return false;
    if (candidate.proposedDelta !== undefined && candidate.targetType !== 'RESOURCE') return false;
    // Repair-by-omission: a commitments effect without a commitment string is
    // malformed flavor, never worth aborting a turn over.
    if (candidate.targetType === 'RELATIONSHIP' && candidate.field === 'commitments' && typeof candidate.setValue !== 'string') return false;
    return true;
  });
  if (!graph) {
    const effectIds = new Set(modelEffects.map((item) => item.id));
    return {
      ...adjudication,
      recommendedEffects: modelEffects,
      outcomeBands: normalizeDistribution(adjudication.outcomeBands.map((band) => ({ ...band, effectIds: band.effectIds.filter((id) => effectIds.has(id)) }))),
    };
  }
  // The scenario-authored causal envelope owns targets, directions, and baseline
  // magnitudes. The adjudicator may strengthen one primary player effect by one
  // band, but cannot make identical causal states wander across unrelated effect
  // sets or probability distributions.
  const canonical = fallbackAdjudication(graph, feasibility, actorActions, state);
  const canonicalBySignature = new Map<string, EffectRecommendation>();
  for (const candidate of canonical.recommendedEffects) {
    const signature = candidate.actorId
      ? `actor:${candidate.actorId}:${candidate.targetType}:${candidate.targetId}:${candidate.field}`
      : `player:${candidate.targetType}:${candidate.targetId}:${candidate.field}:${candidate.direction}:${candidate.impactClass}`;
    if (!canonicalBySignature.has(signature)) canonicalBySignature.set(signature, candidate);
  }
  const compiledText = graph.mechanisms.map((mechanism) => `${mechanism.objective} ${mechanism.specifiedDetail}`).join(' ');
  const supportTarget = state.manifest.metricRoles?.support;
  if (supportTarget && /public|speech|announce|broadcast|press/i.test(compiledText)
    && ![...canonicalBySignature.values()].some((candidate) => !candidate.actorId && candidate.targetId === supportTarget)) {
    const inferred = effect('e_inferred_public_support', graph.mechanisms[0]?.id ?? 'm1', supportTarget, 'POSITIVE', 'MINOR', 'An explicit public-facing component affects political support within the authored calibration envelope.');
    canonicalBySignature.set(`player:${inferred.targetType}:${inferred.targetId}:${inferred.field}:${inferred.direction}:${inferred.impactClass}`, inferred);
  }
  const canonicalEffects = [...canonicalBySignature.values()].sort((a, b) => {
    if (Boolean(a.actorId) !== Boolean(b.actorId)) return a.actorId ? 1 : -1;
    return `${a.targetType}:${a.targetId}:${a.field}:${a.actorId ?? ''}`.localeCompare(`${b.targetType}:${b.targetId}:${b.field}:${b.actorId ?? ''}`);
  });
  const firstPlayerEffectId = canonicalEffects.find((candidate) => !candidate.actorId)?.id;
  const recommendedEffects = canonicalEffects.map((candidate) => {
    if (candidate.id !== firstPlayerEffectId) return candidate;
    const model = modelEffects.find((item) => item.mechanismId === candidate.mechanismId
      && item.targetType === candidate.targetType
      && item.targetId === candidate.targetId
      && item.field === candidate.field);
    if (!model) return candidate;
    const baselineIndex = impactOrder.indexOf(candidate.impactClass);
    const modelIndex = impactOrder.indexOf(model.impactClass);
    return modelIndex > baselineIndex
      ? { ...candidate, impactClass: impactOrder[Math.min(impactOrder.length - 1, baselineIndex + 1)] }
      : candidate;
  });
  const effectIds = new Set(recommendedEffects.map((item) => item.id));
  const initiativeEffectIds = recommendedEffects.filter((candidate) => candidate.actorId).map((candidate) => candidate.id);
  const playerEffectIds = recommendedEffects.filter((candidate) => !candidate.actorId).map((candidate) => candidate.id);
  const outcomeBands = normalizeDistribution(canonical.outcomeBands.map((band) => ({
    ...band,
    effectIds: [...new Set([
      ...(band.id === 'strong'
        ? playerEffectIds
        : band.id === 'mixed'
          ? playerEffectIds.slice(0, Math.max(1, Math.ceil(playerEffectIds.length / 2)))
          : playerEffectIds.filter((_, index) => index % 2 === 1)),
      ...initiativeEffectIds,
    ].filter((id) => effectIds.has(id)))],
  })));
  return { ...adjudication, recommendedEffects, outcomeBands };
};

const REFUSAL = /\b(?:declin|refus|reject|resist|oppos|advise against|push back|deny|denies|denied|rebuff|counter|object)/i;
const COMPLIANCE = /\b(?:comply|complies|complied|agree|accepts?|accepted|assent|consent|sign|signs|signed|yield|concede)/i;

/**
 * No-null-reaction floor. If actors visibly responded to the player and the
 * adjudicator attributed no effect to them, synthesize a minimal, bounded
 * consequence so an attempt that moved people cannot commit as nothing.
 * Effects carry actorId, so they commit regardless of the uncertainty draw.
 */
export const ensureActorReactions = (
  adjudication: Adjudication,
  actorActions: ActorAction[],
  state: WorldState,
  graph: StrategyGraph,
): { adjudication: Adjudication; synthesized: string[] } => {
  const compellingMechanismIds = new Set(graph.mechanisms
    .filter((mechanism) => mechanism.kind === 'DIRECT_ORDER' || mechanism.kind === 'COERCION')
    .map((mechanism) => mechanism.id));
  const playerId = state.manifest.playerId;
  const attributed = new Set(adjudication.recommendedEffects.filter((effect) => effect.actorId).map((effect) => effect.actorId!));
  const synthesized: string[] = [];
  const additions: EffectRecommendation[] = [];
  for (const action of actorActions) {
    if (attributed.has(action.actorId)) continue;
    // Only actors who actually engaged with the player's move.
    if (!action.perceivedPlayerMechanismIds.length && !action.initiative) continue;
    const edge = Object.values(state.relationships).find((relationship) =>
      (relationship.fromId === playerId && relationship.toId === action.actorId)
      || (relationship.toId === playerId && relationship.fromId === action.actorId));
    if (!edge) continue;
    const complies = COMPLIANCE.test(action.action) && !REFUSAL.test(action.action);
    const wasCompelled = action.perceivedPlayerMechanismIds.some((id) => compellingMechanismIds.has(id));
    // Being pressed to comply by someone who cannot compel you is friction,
    // whether or not the actor's stated response reads as an explicit refusal.
    // A reaction must never resolve to a zero delta — that is how a turn
    // becomes a nullity and forces the narrator to invent a silent world.
    const direction: EffectRecommendation['direction'] = complies ? 'POSITIVE' : 'NEGATIVE';
    const id = `e_reaction_${action.actorId}`;
    additions.push({
      id,
      mechanismId: `actor:${action.actorId}`,
      targetType: 'RELATIONSHIP',
      targetId: edge.id,
      field: complies ? 'alignment' : 'trust',
      direction,
      impactClass: wasCompelled || complies ? 'MINOR' : 'TRIVIAL',
      confidence: 'MEDIUM',
      engagement: 'ENGAGES',
      cause: `${state.entities[action.actorId]?.name ?? action.actorId} responded to the player's move: ${action.action}`,
      dependencies: [action.actorId],
      actorId: action.actorId,
    });
    synthesized.push(id);
  }
  if (!additions.length) return { adjudication, synthesized };
  return {
    adjudication: { ...adjudication, recommendedEffects: [...adjudication.recommendedEffects, ...additions] },
    synthesized,
  };
};

export const enforceHardFeasibility = (
  adjudication: Adjudication,
  feasibility: FeasibilityFinding[],
): { adjudication: Adjudication; removedEffectIds: string[] } => {
  const impossible = new Set(feasibility.filter((finding) => finding.classification === 'IMPOSSIBLE').map((finding) => finding.mechanismId));
  const removedEffectIds = adjudication.recommendedEffects.filter((effect) => impossible.has(effect.mechanismId)).map((effect) => effect.id);
  if (!removedEffectIds.length) return { adjudication, removedEffectIds };
  const removed = new Set(removedEffectIds);
  return {
    removedEffectIds,
    adjudication: {
      ...adjudication,
      recommendedEffects: adjudication.recommendedEffects.filter((effect) => !removed.has(effect.id)),
      outcomeBands: normalizeDistribution(adjudication.outcomeBands.map((band) => ({ ...band, effectIds: band.effectIds.filter((id) => !removed.has(id)) }))),
    },
  };
};

export const narrate = async (
  packet: NarrativePacket,
  gateway?: ModelGateway,
): Promise<TurnNarrative> => {
  const fallback = (): TurnNarrative => {
    const changes = packet.visibleChanges as Array<{ label?: string; targetId?: string; field?: string; before?: unknown; after?: unknown; explanation?: string; cause?: string }>;
    const actorSentence = packet.visibleActorEvents.length
      ? packet.visibleActorEvents.flatMap((event) => {
        if (/visible institutional initiative|protected details remain/i.test(event.action)) return [];
        const action = event.action
          .replace(/^direct\s+/i, 'directed ')
          .replace(/^issue\s+/i, 'issued ')
          .replace(/^transmit\s+/i, 'transmitted ');
        return [`${event.actorName} ${action.charAt(0).toLowerCase()}${action.slice(1)}`];
      }).join(' ') || 'No public actor response is yet attributable to this directive.'
      : changes.length
        ? 'No public actor statement clarifies the movement; the observable record has nevertheless changed.'
        : 'No additional actor movement is yet clearly observable.';
    const concreteChanges = changes.slice(0, 4)
      .map((change) => change.explanation ?? change.cause)
      .filter((detail): detail is string => Boolean(detail) && !/observable world process|changed independently|player attempted to/i.test(detail!))
      .join(' ');
    const directiveLead = packet.rawDirective
      .replace(/^\s*(?:order|direct|authorize|ask|have|use|keep|prepare|privately|quietly|secretly)\s+/i, '')
      .split(/[;,.]/)[0]
      .split(/\s+/)
      .slice(0, 9)
      .join(' ');
    const directiveTitle = directiveLead
      ? directiveLead.replace(/\b\w/g, (letter) => letter.toUpperCase())
      : 'The World Withholds an Answer';
    const firstConcrete = concreteChanges.split(/(?<=[.!?])\s+/)[0];
    const mechanismDetails = packet.compiledStrategy.mechanisms
      .map((mechanism) => mechanism.specifiedDetail || mechanism.objective)
      .filter(Boolean)
      .slice(0, 3)
      .join('; ');
    const kinds = new Set(packet.compiledStrategy.mechanisms.map((mechanism) => mechanism.kind));
    const flavor = kinds.has('INTELLIGENCE')
      ? {
        title: 'Two Image Sets, One Quiet Alliance Channel',
        execution: `In the Cabinet Room, reconnaissance analysts lay the latest photographic frames beside the previous mission’s set and begin a frame-by-frame comparison. Separately, Kennedy’s staff opens a quiet NATO consultation through an existing alliance channel.`,
        worldReaction: `LeMay’s institutional campaign for an air strike and Khrushchev’s letter exchange continue on separate clocks while the analysts and alliance staff work. Neither is treated as a reply to the quiet consultation.`,
        consequence: `A marked difference and confidence judgment are still required before the photographs become intelligence. The alliance track remains consultation, not support, until a government answers.`,
        advisorVerb: 'tests the imagery chain and allied sounding against',
        report: `Analysts pin the latest photographic prints beside the previous mission’s sheets, circle any changed shapes, write a confidence judgment on the annotation page, and carry both sets into the Cabinet Room briefing. Alliance staff keep a separate contact log recording the channel, time, and exact wording of any NATO reply.`,
        pending: `Pending evidence consists of the analysts’ marked comparison sheets and an attributable answer from an allied government.`,
        summary: `Kennedy opened parallel but insulated checks: one on successive reconnaissance photographs, another on allied tolerance. Military strike advocacy and Moscow’s letter diplomacy continued independently while both checks awaited reportable evidence.`,
        chronicle: `Photographic review and quiet alliance outreach began without a reported answer from either track.`,
        press: [
          { source: 'CIA intelligence cable', headline: 'Two reconnaissance missions enter frame-by-frame review', body: 'Analysts compare the latest photographic set with its predecessor before assigning any finding or confidence judgment.' },
          { source: 'diplomatic telegram', headline: 'A quiet NATO sounding opens on a separate channel', body: 'The consultation is active, but no allied capital or promised position is yet recorded.' },
        ],
      }
      : kinds.has('DIPLOMACY')
        ? {
          title: changes.some((change) => change.field === 'status' && change.after === 'RESOLVED') ? 'Radio Moscow Answers as the Strike Clock Stops' : 'Terms Enter the Private Channel',
          execution: `Radio Moscow and the cable to Dobrynin now place Moscow’s withdrawal-for-non-invasion formula in two observable channels. Kennedy’s private instruction adds monitored verification and language each government can defend.`,
          worldReaction: `Khrushchev aligns the public broadcast with embassy traffic and renews Moscow’s restraint order to General Pliyev. The Joint Chiefs reach the institutional end of their immediate strike campaign without receiving an execution order.`,
          consequence: changes.some((change) => change.field === 'status' && change.after === 'RESOLVED')
            ? `The decision problem changes: retaliation is no longer the only mature institutional demand. The Cabinet must now reconcile broadcast wording, embassy language, physical withdrawal, and an inspection sequence.`
            : `The proposed monitoring procedure and reciprocal political language remain to be accepted; transmission alone does not establish performance.`,
          advisorVerb: 'tests the verification and face-saving terms against',
          report: `The Cabinet places four records side by side: Dobrynin’s cable, the Radio Moscow transcript, reconnaissance photographs of the launchers, and the eventual UN inspectors’ log. The first two establish Moscow’s stated terms; the photographs and inspection record must establish physical performance.`,
          pending: `Pending evidence is concrete: launcher removal, inspector access, and matching restraint orders reaching Soviet field commanders.`,
          summary: `Moscow’s broadcast and embassy cable converged on withdrawal for a non-invasion pledge. Kennedy pressed for inspection and politically survivable language as the Chiefs’ immediate strike pressure completed its course without an attack.`,
          chronicle: `Public and private Soviet signals converged while the unexecuted strike campaign reached its institutional limit.`,
          press: [
            { source: 'Radio Moscow broadcast', headline: 'Moscow’s public signal meets the private channel', body: 'The broadcast and Dobrynin cable can state terms; inspection and physical withdrawal remain separate acts.' },
            { source: 'White House memorandum', headline: 'Air-strike pressure reaches its decision point without execution', body: 'Readiness remains distinct from an order to strike while the Cabinet compares the broadcast, cable, and verification sequence.' },
          ],
        }
        : {
          title: directiveTitle,
          execution: `Staff broke the directive into its specified procedures: ${mechanismDetails || packet.rawDirective}. Execution does not itself prove an external result.`,
          worldReaction: actorSentence,
          consequence: `Only what the world has actually answered is recorded below; the rest remains an open instruction.`,
          advisorVerb: 'tests the stated procedure against',
          report: `The staff record preserves the directive’s separate steps without supplying a missing target, reply, or outcome.`,
          pending: `The next report must supply an attributable observation before the world state can change.`,
          summary: `The directive entered staff work without producing an attributable external result.`,
          chronicle: `Staff began the specified procedure; external consequences remained unconfirmed.`,
          press: [{ source: packet.scenarioContext.artifactFormats?.[0] ?? 'Situation report', headline: directiveTitle, body: `The staff record preserves the directive’s separate procedures without inventing an external result.` }],
        };
    const title = flavor.title;
    const advisorReaction = (advisor: NarrativePacket['advisors'][number]) => {
      if (kinds.has('INTELLIGENCE')) {
        if (/mcnamara/i.test(advisor.name)) return `McNamara asks the analysts to write their comparison standard and confidence judgment directly on the briefing sheet.`;
        if (/lemay/i.test(advisor.name)) return `LeMay asks whether unscored photographs change the readiness case; no analyst finding has yet answered him.`;
        return `Robert Kennedy warns that sounding NATO must not expose the separate Dobrynin channel.`;
      }
      if (kinds.has('DIPLOMACY')) {
        if (/mcnamara/i.test(advisor.name)) return `McNamara orders a four-column checklist: broadcast text, cable terms, launcher status, and inspection report.`;
        if (/lemay/i.test(advisor.name)) return `LeMay notes that a transmitted settlement is not a disabled launcher and keeps readiness distinct from execution.`;
        return `Robert Kennedy tests which words Dobrynin can carry privately and which Khrushchev can defend publicly.`;
      }
      return `${advisor.voice ?? advisor.worldview} ${advisor.name} ${flavor.advisorVerb} ${advisor.personalStakes ?? advisor.bias}.`;
    };
    const cleanStorySoFar = packet.storySoFar
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => !/observable world process|changed independently|player attempted to|no new consequence/i.test(sentence))
      .join(' ');
    const summary = [cleanStorySoFar, flavor.summary]
      .filter(Boolean)
      .join(' ')
      .split(/\s+/)
      .slice(-120)
      .join(' ');
    // Fix-doc §13: even the deterministic fallback renders the outcome ledger —
    // blocked attempts, set-aside assertions, and unresolved threads are stated
    // plainly rather than left implied by prose.
    const ledger = packet.outcomeLedger;
    const ledgerSentences = [
      ...ledger.blocked.map((entry) => `Blocked: ${entry.attempt} — ${entry.reason}`),
      ...ledger.setAside.slice(0, 2),
      ...ledger.unresolved.slice(0, 2),
    ].join(' ');
    return {
      title,
      immediateOutcome: changes.length
        ? `${flavor.execution} ${firstConcrete}`.trim()
        : flavor.execution,
      worldReaction: ledger.observedResponses.length
        ? `${flavor.worldReaction} Observed responses: ${ledger.observedResponses.join(' ')}`
        : flavor.worldReaction,
      strategicConsequences: ledgerSentences
        ? `${flavor.consequence} ${ledgerSentences}`.trim()
        : flavor.consequence,
      news: [{ source: flavor.press[0].source, headline: title }],
      advisorReactions: packet.advisors.slice(0, 3).map((advisor) => ({
        actorId: advisor.id,
        name: advisor.name,
        reaction: advisorReaction(advisor),
      })),
      detailedReport: `${flavor.report}\n\n${flavor.pending}`,
      pressCoverage: flavor.press,
      updatedStorySummary: summary,
      newCharacters: [],
      chronicleEntry: `${title}: ${flavor.chronicle}`,
      storyThreadUpdates: [],
    };
  };
  if (!gateway) return fallback();
  try {
    const result = await gateway.callJson('narrator', [
      {
        role: 'system',
        content: 'You are Chronus’s post-commit storyteller. Write scenario-specific, concrete history from this visibility-safe NarrativePacket only. The causal outcome is fixed. Never invent a mechanical event, actor action, relationship change, discovery, capability, or hidden fact. The raw directive may shape phrasing but not reality. Structure the account around the packet’s outcomeLedger: what the player actually ordered or attempted, what a rule or authority BLOCKED and why, what other actors OBSERVABLY did, what remains UNRESOLVED with no attributable answer, and setAside assertions the player does not control — never present a requestedOutcome, setAside event, or unresolved item as having happened. Distinguish observation from uncertainty. Give advisors differentiated voices grounded in their profiles. Reuse recurring characters naturally. Treat recentNarratives as an anti-repetition list: do not reuse their headlines, framing devices, advisor phrasing, or any distinctive clause; storySoFar is context, never copy. Each turn needs a specific event title, at least one named person/place/time/quantity, and at least two physical or procedural details grounded in the packet. Mention numeric metric deltas at most once across the entire response. Never use “under pressure” as a title or write “an observable world process changed independently.” Compact sections stay under 130 words; detailedReport may be up to 400 words. Artifacts may frame a committed event differently but cannot add facts. updatedStorySummary and memory suggestions must describe committed observable history only.',
      },
      {
        role: 'user',
        content: JSON.stringify(packet),
      },
    ], narrativeSchema, 'TurnNarrative');
    return {
      ...result.value,
      updatedStorySummary: result.value.updatedStorySummary.split(/\s+/).slice(-120).join(' '),
      newCharacters: result.value.newCharacters.slice(0, 2),
    };
  } catch {
    return fallback();
  }
};
