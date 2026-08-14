import {
  BeliefState,
  CompilerFidelity,
  ControlMode,
  FeasibilityFinding,
  StrategyGraph,
  StrategyMechanism,
  TurnDepth,
  WorldState,
} from './domain';
import { ModelGateway } from './model';
import { fidelitySchema, strategyGraphSchema } from './schemas';
import { playerVisibleState } from './projections';

export const deRhetoricize = (directive: string) => directive
  .replace(/^(?:(?:this\s+is|behold)\s+)?my\b[^:]{0,240}\b(?:brilliant|genius|masterful|masterstroke|perfect|foolproof|guaranteed|unbeatable)\b[^:]*:\s*/i, '')
  .replace(/\b(?:brilliant|genius|masterful|masterstroke|perfect|foolproof|obviously|certainly|guaranteed|unbeatable)\b/gi, '')
  .replace(/\bI\s+(?:know|am certain|guarantee|assure you)\b[^,.;:]*/gi, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const clauses = (directive: string) => deRhetoricize(directive)
  .split(/(?:\.|;|\bthen\b|\band\s+then\b)/i)
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, 10);

const inferKind = (text: string): StrategyMechanism['kind'] => {
  if (/transfer|allocate|fund|budget|move \$|send .* supplies/i.test(text)) return 'RESOURCE_TRANSFER';
  if (/negotiate|offer|backchannel|diplom|contact|call|letter|signal .*proposal/i.test(text)) return 'DIPLOMACY';
  if (/strike|bomb|invade|deploy|attack|blockade|move .*fleet|send .*troops/i.test(text)) return 'MILITARY_OPERATION';
  if (/secret|quiet|conceal|mislead|deceiv|feint/i.test(text)) return 'DECEPTION';
  if (/intelligence|recon|surveil|investigat|spy|verify/i.test(text)) return 'INTELLIGENCE';
  if (/court|legal|injunction|lawsuit|treaty/i.test(text)) return 'LEGAL_ACTION';
  if (/speech|announce|public|broadcast|\bpress\b/i.test(text)) return 'PUBLIC_COMMUNICATION';
  if (/coalition|allies|governor|organize|recruit/i.test(text)) return 'COALITION_BUILDING';
  if (/sanction|economic|business|insurance|trade|financial/i.test(text)) return 'ECONOMIC_PRESSURE';
  if (/threat|ultimatum|coerce|pressure/i.test(text)) return 'COERCION';
  if (/order|direct|authorize|instruct/i.test(text)) return 'DIRECT_ORDER';
  return 'OTHER';
};

const referencedIds = (text: string, state: WorldState) => Object.values(state.entities)
  .filter((entity) => {
    const lower = text.toLowerCase();
    if (entity.id === state.manifest.playerId && /\brobert kennedy\b/i.test(text) && !/\bjohn(?: f\.)? kennedy\b|\bpresident kennedy\b/i.test(text)) return false;
    return lower.includes(entity.name.toLowerCase().split(' ').at(-1)!) || lower.includes(entity.id.replaceAll('_', ' '));
  })
  .map((entity) => entity.id);

const resourceClaims = (text: string, state: WorldState) => {
  const amount = Number(text.match(/\b(\d+(?:\.\d+)?)\b/)?.[1]);
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const lower = text.toLowerCase();
  const singular = (value: string) => value.replace(/s\b/g, '');
  const resource = Object.values(state.resources).find((candidate) =>
    lower.includes(candidate.id.replaceAll('_', ' '))
    || lower.includes(candidate.label.toLowerCase())
    || lower.includes(candidate.unit.toLowerCase())
    || singular(lower).includes(singular(candidate.id.replaceAll('_', ' ')))
    || singular(lower).includes(singular(candidate.label.toLowerCase()))
    || singular(lower).includes(singular(candidate.unit.toLowerCase())),
  );
  return resource ? [{ resourceId: resource.id, amount }] : [];
};

export const compileDeterministically = (directive: string, state: WorldState): StrategyGraph => {
  const parts = clauses(directive);
  const mechanisms = parts.map((part, index): StrategyMechanism => ({
    id: `m${index + 1}`,
    kind: inferKind(part),
    objective: part,
    targetIds: referencedIds(part, state),
    actorIds: [state.manifest.playerId],
    dependencies: [],
    assumptions: [],
    sequence: index,
    durationTurns: /prepare|build|recruit|develop|long.term/i.test(part) ? 2 : 1,
    resourceClaims: inferKind(part) === 'RESOURCE_TRANSFER' ? resourceClaims(part, state) : [],
    specifiedDetail: part,
  }));
  return {
    objective: parts[0] ?? directive.trim(),
    mechanisms: mechanisms.length ? mechanisms : [{
      id: 'm1', kind: 'OTHER', objective: directive.trim(), targetIds: [], actorIds: [state.manifest.playerId],
      dependencies: [], assumptions: [], sequence: 0, durationTurns: 1, resourceClaims: [], specifiedDetail: directive.trim(),
    }],
    sequencing: mechanisms.map((item) => item.id),
    contingencies: [],
    explicitRisks: [],
    unspecified: mechanisms.filter((item) => item.kind === 'OTHER').map((item) => `Mechanism for “${item.specifiedDetail}” is unspecified.`),
    communicationStyleIsMechanism: /speech|message|signal|tone|publicly|privately/i.test(directive),
  };
};

export const normalizeStrategyGraph = (graph: StrategyGraph, state: WorldState): StrategyGraph => {
  const unknownReferences: string[] = [];
  const seenIds = new Set<string>();
  const mechanisms = graph.mechanisms.map((mechanism, index) => {
    let id = mechanism.id || `m${index + 1}`;
    if (seenIds.has(id)) id = `${id}_${index + 1}`;
    seenIds.add(id);
    const unknownTargets = mechanism.targetIds.filter((targetId) => !state.entities[targetId]);
    unknownReferences.push(...unknownTargets.map((targetId) => `Unresolved target reference “${targetId}” in mechanism ${id}.`));
    const literalTargets = referencedIds(`${mechanism.specifiedDetail} ${mechanism.objective}`, state);
    const targetIds = [...new Set([
      ...mechanism.targetIds.filter((targetId) => Boolean(state.entities[targetId])),
      ...literalTargets,
    ])];
    const actorIds = [...new Set(mechanism.actorIds.filter((actorId) => Boolean(state.entities[actorId])))];
    if (!actorIds.length) actorIds.push(state.manifest.playerId);
    const resourceClaims = mechanism.resourceClaims.filter((claim) => {
      const valid = Boolean(state.resources[claim.resourceId]) && Number.isFinite(claim.amount) && claim.amount >= 0;
      if (!valid) unknownReferences.push(`Invalid resource claim “${claim.resourceId}” in mechanism ${id}.`);
      return valid;
    });
    return { ...mechanism, id, targetIds, actorIds, resourceClaims };
  });
  const ids = new Set(mechanisms.map((mechanism) => mechanism.id));
  return {
    ...graph,
    mechanisms,
    sequencing: graph.sequencing.filter((id) => ids.has(id)),
    unspecified: [...new Set([...graph.unspecified, ...unknownReferences])],
  };
};

export const compileStrategy = async (
  directive: string,
  state: WorldState,
  beliefs: BeliefState,
  gateway?: ModelGateway,
) => {
  if (!gateway) return compileDeterministically(directive, state);
  try {
    const result = await gateway.callJson('strategy_compiler', [
      {
        role: 'system',
        content: 'You are a literal strategy compiler. Extract only mechanisms supplied or reasonably implied. Do not praise, repair, optimize, or invent leverage. Preserve vague mechanisms as vague and list missing details under unspecified.',
      },
      {
        role: 'user',
        content: JSON.stringify({ deRhetoricizedDirective: deRhetoricize(directive).toLocaleLowerCase('en-US'), permittedContext: playerVisibleState(state, beliefs) }),
      },
    ], strategyGraphSchema, 'StrategyGraph');
    return normalizeStrategyGraph(result.value, state);
  } catch {
    return compileDeterministically(directive, state);
  }
};

export const auditCompilerFidelity = async (
  directive: string,
  graph: StrategyGraph,
  gateway?: ModelGateway,
): Promise<CompilerFidelity> => {
  if (!gateway) {
    return {
      faithful: true,
      inventedMechanisms: [],
      omittedWeaknesses: [],
      assumedCoordination: [],
      contradictions: [],
    };
  }
  try {
    const result = await gateway.callJson('critic', [
      {
        role: 'system',
        content: 'Audit whether a strategy compiler upgraded the player. Compare literal player content against the dry graph. Flag invented mechanisms, hidden assumptions, removed weakness, and contradictions. Repair only by deleting or weakening unsupported content.',
      },
      { role: 'user', content: JSON.stringify({ rawDirective: directive, compiledGraph: graph }) },
    ], fidelitySchema, 'CompilerFidelity');
    return result.value;
  } catch {
    return { faithful: true, inventedMechanisms: [], omittedWeaknesses: [], assumedCoordination: [], contradictions: ['Model fidelity audit unavailable; deterministic validation only.'] };
  }
};

export const classifyTurn = (graph: StrategyGraph, state: WorldState): { depth: TurnDepth; reasons: string[] } => {
  const kinds = new Set(graph.mechanisms.map((item) => item.kind));
  const dangerousMetric = state.manifest.metricDefinitions.some((definition) => {
    const value = state.metrics[definition.id];
    return (definition.dangerAbove !== undefined && value >= definition.dangerAbove)
      || (definition.dangerBelow !== undefined && value <= definition.dangerBelow);
  });
  const pivotalLanguage = graph.mechanisms.some((item) =>
    /nuclear|constitutional crisis|coup|regime change|overthrow|general war|assassinat|launch|annihilat/i.test(item.specifiedDetail));
  const concealedForce = kinds.has('MILITARY_OPERATION') && kinds.has('DECEPTION');
  const highStakes = dangerousMetric || state.goal.deadlineTurn - state.turn <= 2 || pivotalLanguage;
  const novel = graph.mechanisms.some((item) => item.kind === 'OTHER' || item.assumptions.length > 2);
  const narrowDeterministic = graph.mechanisms.length === 1
    && graph.mechanisms[0].kind === 'RESOURCE_TRANSFER'
    && graph.mechanisms[0].resourceClaims.length > 0;
  if (narrowDeterministic) return { depth: 'ROUTINE', reasons: ['A single fully specified resource allocation is mechanically resolvable.'] };
  if (highStakes || novel || graph.mechanisms.length >= 6) return {
    depth: 'DEEP',
    reasons: [
      ...(dangerousMetric ? ['A scenario danger threshold is active.'] : []),
      ...(state.goal.deadlineTurn - state.turn <= 2 ? ['The active objective is near its deadline.'] : []),
      ...(pivotalLanguage ? ['The directive contains pivotal or existential consequences.'] : []),
      ...(novel ? ['At least one mechanism requires open-world causal judgment.'] : []),
      ...(graph.mechanisms.length >= 6 ? ['The strategic package contains at least six mechanisms.'] : []),
    ],
  };
  if (concealedForce || graph.mechanisms.length >= 4 || kinds.size >= 4 || (kinds.has('ECONOMIC_PRESSURE') && graph.mechanisms.some((item) => /bond|insurance|market|financial/i.test(item.specifiedDetail)))) return {
    depth: 'COMPLEX',
    reasons: [concealedForce ? 'A concealed military operation requires multi-actor analysis.' : 'The package has multiple interacting or context-sensitive mechanisms.'],
  };
  if (graph.mechanisms.length >= 2 || kinds.has('MILITARY_OPERATION') || kinds.has('DIPLOMACY')) return {
    depth: 'STANDARD',
    reasons: ['The action has meaningful strategic or actor-dependent effects.'],
  };
  return { depth: 'ROUTINE', reasons: ['The action is narrow, familiar, and low-complexity.'] };
};

export const classifyTurnDepth = (graph: StrategyGraph, state: WorldState): TurnDepth => classifyTurn(graph, state).depth;

export const checkFeasibility = (graph: StrategyGraph, state: WorldState): FeasibilityFinding[] => {
  const playerId = state.manifest.playerId;
  const controlled = new Set(Object.values(state.entities).filter((entity) => entity.id === playerId || entity.controllerId === playerId).map((entity) => entity.id));
  const capabilityPatterns: Partial<Record<StrategyMechanism['kind'], RegExp>> = {
    MILITARY_OPERATION: /military|strike|invasion|naval|force|troop|air|strategic|weapon/i,
    INTELLIGENCE: /intelligence|recon|surveil|collection|investigat|audit|spy/i,
    DIPLOMACY: /diplom|channel|backchannel|correspondence|negotiat/i,
    LEGAL_ACTION: /legal|law|court|injunction|treaty/i,
    PUBLIC_COMMUNICATION: /public|press|speech|broadcast|media/i,
  };
  return graph.mechanisms.map((mechanism) => {
    const reasons: string[] = [];
    const constraints: string[] = [];
    let feasible = true;
    let classification: FeasibilityFinding['classification'] = 'POSSIBLE';
    let availableFraction = 1;
    let unmechanizedControlRequest = false;
    const matchingRules = state.manifest.authorityRules.filter((rule) =>
      rule.actorId === playerId
      && (mechanism.targetIds.includes(rule.targetId) || (!mechanism.targetIds.length && rule.targetId === playerId))
      && rule.mechanismKinds.includes(mechanism.kind));
    const controlRank = { NONE: 0, INFLUENCE: 1, DELEGATED: 2, DIRECT: 3 } as const;
    const controlMode: ControlMode = matchingRules.reduce<ControlMode>((best, rule) =>
      controlRank[rule.mode] > controlRank[best] ? rule.mode : best, mechanism.targetIds.length ? 'NONE' : 'DIRECT');
    const capableEntities = Object.values(state.entities).filter((entity) => controlled.has(entity.id));
    const capabilityPattern = capabilityPatterns[mechanism.kind];
    const capabilityEvidence = capabilityPattern
      ? capableEntities.flatMap((entity) => entity.capabilities.filter((capability) => capabilityPattern.test(capability)))
      : capableEntities.flatMap((entity) => entity.capabilities).slice(0, 3);
    capabilityEvidence.push(...matchingRules.map((rule) => `Explicit ${rule.mode.toLowerCase()} authority for ${rule.targetId}`));
    const specificCapabilityChecks: Array<[RegExp, RegExp]> = [
      [/carrier|air wing/i, /carrier|air wing/i],
      [/nuclear|atomic/i, /nuclear|atomic|strategic force/i],
      [/submarine/i, /submarine/i],
      [/satellite/i, /satellite|space/i],
      [/cyber/i, /cyber|computer/i],
      [/artillery/i, /artillery/i],
      [/engineer/i, /engineer/i],
    ];
    const missingSpecific = specificCapabilityChecks.find(([requested, evidence]) =>
      requested.test(mechanism.objective)
      && !capableEntities.some((entity) => entity.capabilities.some((capability) => evidence.test(capability))));
    if (capabilityPattern && capabilityEvidence.length === 0) {
      feasible = false;
      constraints.push(`No controlled entity has a declared capability supporting ${mechanism.kind}.`);
      availableFraction = 0;
    }
    if (missingSpecific) {
      feasible = false;
      constraints.push('The directive requires a specific capability absent from every controlled entity.');
      availableFraction = 0;
    }
    for (const claim of mechanism.resourceClaims) {
      const resource = state.resources[claim.resourceId];
      if (!resource || resource.amount < claim.amount) {
        feasible = false;
        constraints.push(`Insufficient ${claim.resourceId}.`);
        availableFraction = resource ? Math.min(availableFraction, resource.amount / Math.max(1, claim.amount)) : 0;
      } else if (!controlled.has(resource.ownerId) && !matchingRules.some((rule) => rule.targetId === resource.ownerId && (rule.mode === 'DIRECT' || rule.mode === 'DELEGATED'))) {
        feasible = false;
        constraints.push(`The player cannot allocate ${claim.resourceId}, which is controlled by ${resource.ownerId}.`);
        availableFraction = 0;
      }
    }
    if (mechanism.kind === 'DIRECT_ORDER' && mechanism.targetIds.some((id) =>
      !controlled.has(id) && !matchingRules.some((rule) => rule.targetId === id && (rule.mode === 'DIRECT' || rule.mode === 'DELEGATED')))) {
      feasible = false;
      unmechanizedControlRequest = true;
      constraints.push('The player lacks direct authority over at least one target. Interpret as a request or influence attempt.');
    }
    if (matchingRules.some((rule) => rule.conditions.length)) {
      reasons.push(...matchingRules.flatMap((rule) => rule.conditions.map((condition) => `Authority condition: ${condition}.`)));
    }
    if (mechanism.kind === 'DIPLOMACY' && mechanism.targetIds.length) {
      const reachable = mechanism.targetIds.some((targetId) => Object.values(state.relationships).some((relationship) =>
        relationship.communication && ((relationship.fromId === playerId && relationship.toId === targetId) || (relationship.toId === playerId && relationship.fromId === targetId)),
      ));
      if (!reachable) {
        feasible = false;
        availableFraction = 0;
        constraints.push('No available communication channel to the specified target.');
      }
    }
    if (mechanism.sequence >= 6) {
      classification = 'DELAYED';
      availableFraction = Math.min(availableFraction, 0.5);
      reasons.push('This part of the package exceeds immediate organizational capacity and can only begin this turn.');
    } else if (mechanism.durationTurns > 1) {
      classification = 'DELAYED';
      reasons.push(`Requires approximately ${mechanism.durationTurns} turns to mature.`);
    } else if (mechanism.kind === 'RESOURCE_TRANSFER' && feasible && mechanism.resourceClaims.length > 0) {
      classification = 'CERTAIN';
      reasons.push('Within direct control if the stated resource exists and is available.');
    } else if (mechanism.kind === 'RESOURCE_TRANSFER' && mechanism.resourceClaims.length === 0) {
      reasons.push('The resource and amount are insufficiently specified for deterministic execution.');
    }
    if (!feasible) classification = unmechanizedControlRequest || availableFraction <= 0 ? 'IMPOSSIBLE' : 'DELAYED';
    if (graph.mechanisms.length > 6) {
      availableFraction *= 6 / graph.mechanisms.length;
      reasons.push('Organizational attention is diluted across an oversized strategic package.');
    }
    return { mechanismId: mechanism.id, feasible, classification, controlMode, capabilityEvidence, reasons, hardConstraints: constraints, availableFraction };
  });
};
