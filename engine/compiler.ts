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
import { conditionMet } from './state';
import { extractWorldReferences } from './worldExpansion';

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

export const inferMechanismKind = (text: string): StrategyMechanism['kind'] => {
  if (/transfer|allocate|fund|budget|move \$|send .* supplies/i.test(text)) return 'RESOURCE_TRANSFER';
  if (/^\s*(?:order|direct|authorize|instruct|command)\b/i.test(text)) return 'DIRECT_ORDER';
  if (/negotiate|offer|backchannel|diplom|contact|call|letter|signal .*proposal|\bmeet\b|meeting|\btalk\b|discuss|consult|hear (?:him|her|them|his|their) (?:out|terms)|listen to/i.test(text)) return 'DIPLOMACY';
  if (/strike|bomb|invade|deploy|attack|blockade|send .*troops|(?:move|advance|withdraw|reposition|march)\s+(?:the\s+)?[^.;]*\b(?:fleet|division|regiment|brigade|corps|battalion|squadron|troops|forces|army|carrier|units?)\b/i.test(text)) return 'MILITARY_OPERATION';
  // "quietly", "secretly", "privately" describe HOW an act is done, not what it
  // is: a quiet demand is a concealed demand, not a deception operation. Only
  // genuine misdirection classifies as DECEPTION; the concealed flag carries
  // manner separately.
  if (/conceal|mislead|deceiv|feint|disinformation|cover story|false flag|decoy|misdirect/i.test(text)) return 'DECEPTION';
  if (/intelligence|recon|surveil|investigat|spy|verify/i.test(text)) return 'INTELLIGENCE';
  if (/court|legal|injunction|lawsuit|treaty/i.test(text)) return 'LEGAL_ACTION';
  if (/speech|announce|public|broadcast|\bpress\b/i.test(text)) return 'PUBLIC_COMMUNICATION';
  if (/coalition|allies|governor|organize|recruit/i.test(text)) return 'COALITION_BUILDING';
  if (/sanction|economic|business|insurance|trade|financial/i.test(text)) return 'ECONOMIC_PRESSURE';
  if (/threat|ultimatum|coerce|pressure|demand/i.test(text)) return 'COERCION';
  if (/order|direct|authorize|instruct|command/i.test(text)) return 'DIRECT_ORDER';
  return 'OTHER';
};

/** Acts that create contact where none existed. */
const REACHES_OUT = /\b(?:fly|flying|flight|travel|go to|going to|visit|meet|meeting|envoy|emissary|delegation|approach|reach out|send word|broadcast|appeal|announce)\b/i;

const word = (haystack: string, needle: string) =>
  new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);

/** "Take me to Cuba" names a destination, not a party whose behaviour is being
 * acted upon. Matching a place to the force stationed there turns travel into
 * an order aimed at that force. */
const namedAsDestination = (text: string, entity: { name: string; id: string }) => {
  const tokens = [entity.name, entity.id.replaceAll('_', ' ')]
    .flatMap((value) => value.toLowerCase().split(' '))
    .filter((token) => token.length > 3);
  return tokens.some((token) => new RegExp(`\\b(?:to|toward|towards|into|for|in|over|via|from|at)\\s+(?:the\\s+)?${token}\\b`, 'i').test(text))
    && !new RegExp(`\\b(?:order|tell|ask|demand|command|instruct|negotiate|with|meet)\\s+(?:the\\s+)?[^.;]{0,20}${tokens[0]}`, 'i').test(text);
};

const STOP_TOKENS = new Set(['the', 'of', 'and', 'for', 'in', 'group', 'forces', 'staff', 'network', 'allies', 'bloc', 'state', 'states', 'united', 'national', 'federal', 'chief', 'chiefs']);

/** A single word identifies an entity when it belongs to that entity alone in
 * this scenario. "Governors" picks out the governors' network; "Allies" and
 * "Forces" do not pick out anything, and a place name is handled separately by
 * the destination guard. */
const nameTokens = (name: string) => name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const distinctiveTokens = (state: WorldState) => {
  const counts = new Map<string, number>();
  for (const entity of Object.values(state.entities)) {
    for (const token of new Set(nameTokens(entity.name))) {
      if (token.length <= 3 || STOP_TOKENS.has(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
};

const referencedIds = (text: string, state: WorldState) => {
  const counts = distinctiveTokens(state);
  return Object.values(state.entities)
    .filter((entity) => {
      const lower = text.toLowerCase();
      if (entity.id === state.manifest.playerId && /\brobert kennedy\b/i.test(text) && !/\bjohn(?: f\.)? kennedy\b|\bpresident kennedy\b/i.test(text)) return false;
      const name = entity.name.toLowerCase();
      if (namedAsDestination(lower, entity)) return false;
      if (word(lower, name) || word(lower, entity.id.replaceAll('_', ' '))) return true;
      return nameTokens(name).some((token) =>
        counts.get(token) === 1 && word(lower, token));
    })
    .map((entity) => entity.id);
};

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

/** First-person or imperative openings that mark a clause as a player ATTEMPT. */
const ATTEMPT_LEAD = /^(?:i|we|i'm|i am|i'll|i will|my|our|let's|have|order|ask|call|phone|contact|send|write|draft|demand|offer|announce|declare|prepare|investigate|authorize|instruct|direct|tell|negotiate|deploy|move|allocate|transfer|fund|recruit|organize|convene|meet|brief|publicly|privately|quietly|secretly|immediately|urgently|begin|start|launch|signal|propose|request|press|pressure|lobby|persuade|convince|warn|threaten|delay|pause|keep|use|concentrate|hold|reinforce|probe|inspect|gather|sound out|reach out)\b/i;

/** Verbs that declare another actor's behavior or an outcome as already decided. */
const EXTERNAL_EVENT = /\b(?:freaks?(?:\s+out)?|panics?|agrees?|complies|resigns?|surrenders?|defects?|approves?|endorses?|withdraws?|backs?\s+down|capitulates?|flees|flies|travels|departs|arrives|celebrates?|decides?|chooses?|refuses?|steps?\s+down|will\s+(?:be|resign|comply|agree|approve|surrender|withdraw|endorse|step\s+down)|is\s+(?:resigning|complying|agreeing|surrendering|withdrawing))\b/i;

/** Modal and conditional framing — "can resign", "should stand down", "anyone
 * who tries ... will be replaced" — is the player stating terms, which is an
 * act they perform. Only a declarative claim that another party HAS acted, or
 * definitely will, is an assertion the simulation must refuse. */
const CONDITIONAL_OR_MODAL = /\b(?:can|could|may|might|should|must|shall|if|unless|whoever|anyone who|those who|or else)\b/i;

export const classifyClause = (clause: string): 'ATTEMPT' | 'ASSERTED_EXTERNAL' | 'RATIONALE' => {
  const trimmed = clause.trim();
  if (/^because\b/i.test(trimmed)) return 'RATIONALE';
  if (ATTEMPT_LEAD.test(trimmed)) return 'ATTEMPT';
  if (EXTERNAL_EVENT.test(trimmed) && !CONDITIONAL_OR_MODAL.test(trimmed)) return 'ASSERTED_EXTERNAL';
  return 'ATTEMPT';
};

const extractRequestedOutcomes = (directive: string): string[] => {
  const outcomes: string[] = [];
  for (const match of deRhetoricize(directive).matchAll(/(?:ask|asked|asking|demand|demanding|convince|persuade|press|pressure|get|urge)\b[^.;]*?\bto\s+([^,.;]+)/gi)) {
    outcomes.push(match[1].trim());
  }
  return [...new Set(outcomes)].slice(0, 8);
};

const extractRationale = (directive: string): string[] => {
  const rationale: string[] = [];
  for (const match of deRhetoricize(directive).matchAll(/because\s+([^,.;]+)/gi)) rationale.push(match[1].trim());
  return [...new Set(rationale)].slice(0, 6);
};

export const compileDeterministically = (directive: string, state: WorldState): StrategyGraph => {
  const allParts = clauses(directive).map((clause, index) => ({ clause, clauseId: `c${index + 1}`, category: classifyClause(clause) }));
  const assertedExternalEvents = allParts.filter((part) => part.category === 'ASSERTED_EXTERNAL').map((part) => part.clause);
  const parts = allParts.filter((part) => part.category === 'ATTEMPT').map((part) => part.clause);
  const mechanisms = parts.map((part, index): StrategyMechanism => ({
    id: `m${index + 1}`,
    kind: inferMechanismKind(part),
    objective: part,
    targetIds: referencedIds(part, state),
    actorIds: [state.manifest.playerId],
    dependencies: [],
    assumptions: [],
    sequence: index,
    durationTurns: /prepare|build|recruit|develop|long.term/i.test(part) ? 2 : 1,
    resourceClaims: inferMechanismKind(part) === 'RESOURCE_TRANSFER' ? resourceClaims(part, state) : [],
    specifiedDetail: part,
    concealed: inferMechanismKind(part) === 'DECEPTION' || /secret|quietly|privately|covert|conceal/i.test(part),
  }));
  return {
    objective: parts[0] ?? directive.trim(),
    // A directive consisting ONLY of asserted external events legitimately
    // compiles to zero mechanisms; the pipeline returns it for revision without
    // consuming a turn. The generic OTHER fallback applies only when nothing
    // was classified at all.
    mechanisms: mechanisms.length ? mechanisms : assertedExternalEvents.length ? [] : [{
      id: 'm1', kind: 'OTHER', objective: directive.trim(), targetIds: [], actorIds: [state.manifest.playerId],
      dependencies: [], assumptions: [], sequence: 0, durationTurns: 1, resourceClaims: [], specifiedDetail: directive.trim(),
      concealed: /secret|quietly|privately|covert|conceal/i.test(directive),
    }],
    sequencing: mechanisms.map((item) => item.id),
    contingencies: [],
    explicitRisks: [],
    unspecified: mechanisms.filter((item) => item.kind === 'OTHER').map((item) => `Mechanism for “${item.specifiedDetail}” is unspecified.`),
    communicationStyleIsMechanism: /speech|message|signal|tone|publicly|privately/i.test(directive),
    requestedOutcomes: extractRequestedOutcomes(directive),
    assertedExternalEvents,
    rationale: extractRationale(directive),
    unresolvedReferences: extractWorldReferences(directive, state).map((reference, index) => ({
      ...reference,
      clauseId: reference.clauseId || `c${index + 1}`,
      requiredForAttempt: parts.some((part) => part.toLowerCase().includes(reference.mention.toLowerCase())),
    })),
  };
};

export const normalizeStrategyGraph = (graph: StrategyGraph, state: WorldState): StrategyGraph => {
  const unknownReferences: string[] = [];
  const droppedTargetReferences: StrategyGraph['unresolvedReferences'] = [];
  const seenIds = new Set<string>();
  const mechanisms = graph.mechanisms.map((mechanism, index) => {
    let id = mechanism.id || `m${index + 1}`;
    if (seenIds.has(id)) id = `${id}_${index + 1}`;
    seenIds.add(id);
    const unknownTargets = mechanism.targetIds.filter((targetId) => !state.entities[targetId]);
    unknownReferences.push(...unknownTargets.map((targetId) => `Unresolved target reference “${targetId}” in mechanism ${id}.`));
    droppedTargetReferences.push(...unknownTargets.map((targetId) => ({
      mention: targetId.replaceAll('_', ' '),
      clauseId: id,
      requiredForAttempt: true,
    })));
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
    return { ...mechanism, id, targetIds, actorIds, resourceClaims, concealed: Boolean(mechanism.concealed || mechanism.kind === 'DECEPTION') };
  });
  const ids = new Set(mechanisms.map((mechanism) => mechanism.id));
  const existingRefs = graph.unresolvedReferences ?? [];
  const mergedRefs = [...existingRefs];
  for (const reference of droppedTargetReferences) {
    if (!mergedRefs.some((existing) => existing.mention.toLowerCase() === reference.mention.toLowerCase())) mergedRefs.push(reference);
  }
  return {
    ...graph,
    mechanisms,
    sequencing: graph.sequencing.filter((id) => ids.has(id)),
    unspecified: [...new Set([...graph.unspecified, ...unknownReferences])],
    requestedOutcomes: graph.requestedOutcomes ?? [],
    assertedExternalEvents: graph.assertedExternalEvents ?? [],
    rationale: graph.rationale ?? [],
    unresolvedReferences: mergedRefs,
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
        content: 'You are a literal strategy compiler. targetIds are ONLY the actors whose decisions or behaviour a mechanism acts upon. A place named as a destination, origin, or route is NEVER a target — travelling to a country does not target the forces stationed there. An asset the player uses (their aircraft, their staff) is an instrument, not a target. Decompose the directive into: mechanisms — ONLY actions the player can personally attempt or order (call, ask, demand, prepare, allocate, announce); requestedOutcomes — desired results that depend on another actor or on feasibility (a resignation obtained, an agreement reached); assertedExternalEvents — text that declares another actor’s behavior, emotion, or an outcome as already decided (never convert these into mechanisms or targets); rationale — the player’s stated theory of leverage; unresolvedReferences — people, offices, or institutions relevant to an attempt but absent from the permittedContext entity list. Extract only what is supplied or reasonably implied. Do not praise, repair, optimize, or invent leverage. Preserve vague mechanisms as vague and list missing details under unspecified.',
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
  // Concealment is a property of a mechanism, not a separate kind: a covert
  // troop movement is MILITARY_OPERATION with concealed set.
  const concealedForce = graph.mechanisms.some((item) =>
    item.kind === 'MILITARY_OPERATION' && (item.concealed || kinds.has('DECEPTION')));
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
  // Specialised capabilities only. Speaking publicly, meeting, and making a
  // demand are baseline acts of being an actor — a head of state does not
  // need a declared "public communication" capability to address the nation.
  const capabilityPatterns: Partial<Record<StrategyMechanism['kind'], RegExp>> = {
    MILITARY_OPERATION: /military|strike|invasion|naval|force|troop|air|strategic|weapon/i,
    INTELLIGENCE: /intelligence|recon|surveil|collection|investigat|audit|spy/i,
    LEGAL_ACTION: /legal|law|court|injunction|treaty/i,
  };
  return graph.mechanisms.map((mechanism) => {
    const reasons: string[] = [];
    const constraints: string[] = [];
    let feasible = true;
    let classification: FeasibilityFinding['classification'] = 'POSSIBLE';
    let availableFraction = 1;
    let unmechanizedControlRequest = false;
    let lacksCompulsion = false;
    const scopedRules = state.manifest.authorityRules.filter((rule) =>
      rule.actorId === playerId
      && (mechanism.targetIds.includes(rule.targetId) || (!mechanism.targetIds.length && rule.targetId === playerId))
      && rule.mechanismKinds.includes(mechanism.kind));
    const matchingRules = scopedRules.filter((rule) => (rule.conditionRules ?? []).every((condition) => conditionMet(state, condition)));
    const controlRank = { NONE: 0, INFLUENCE: 1, DELEGATED: 2, DIRECT: 3 } as const;
    const controlMode: ControlMode = matchingRules.reduce<ControlMode>((best, rule) =>
      controlRank[rule.mode] > controlRank[best] ? rule.mode : best, mechanism.targetIds.length ? 'NONE' : 'DIRECT');
    const capableEntities = Object.values(state.entities).filter((entity) => controlled.has(entity.id));
    const capabilityPattern = capabilityPatterns[mechanism.kind];
    const capabilityEvidence = capabilityPattern
      ? capableEntities.flatMap((entity) => entity.capabilities.filter((capability) => capabilityPattern.test(capability)))
      : capableEntities.flatMap((entity) => entity.capabilities).slice(0, 3);
    capabilityEvidence.push(...matchingRules.map((rule) => `Explicit ${rule.mode.toLowerCase()} authority for ${rule.targetId}`));
    for (const rule of scopedRules.filter((candidate) => !matchingRules.includes(candidate))) {
      feasible = false;
      constraints.push(`Authority condition is not satisfied for ${rule.targetId}: ${rule.conditions.join('; ') || 'required state condition'}.`);
      availableFraction = 0;
    }
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
    // Any mechanism that seeks compliance FROM another actor has the same
    // structure: the player can perform the act, but the target decides.
    const COMPLIANCE_SEEKING: StrategyMechanism['kind'][] = ['DIRECT_ORDER', 'COERCION'];
    const uncommandableTargets = COMPLIANCE_SEEKING.includes(mechanism.kind)
      ? mechanism.targetIds.filter((id) =>
        !controlled.has(id) && !matchingRules.some((rule) => rule.targetId === id && (rule.mode === 'DIRECT' || rule.mode === 'DELEGATED')))
      : [];
    if (uncommandableTargets.length) {
      // The player cannot COMPEL these targets — but issuing the order is still
      // an act that lands. Reinterpret as a demand (PRD §4.2/§6) rather than
      // erasing it. Compliance becomes the target's own decision.
      lacksCompulsion = true;
      reasons.push(`No authority compels ${uncommandableTargets.join(', ')}; the order lands as a demand and compliance is theirs to decide.`);
    }
    if (mechanism.kind === 'DIRECT_ORDER' && mechanism.targetIds.length === 0) {
      // An order that names no other party is addressed to the player's own
      // establishment — their staff, their transport, their department. A head
      // of government commanding their own apparatus is the clearest case of
      // authority there is; it is not an order into the void.
      reasons.push('Addressed to the player’s own establishment; no external party is being commanded.');
    }
    if (matchingRules.some((rule) => rule.conditions.length)) {
      reasons.push(...matchingRules.flatMap((rule) => rule.conditions.map((condition) => `Authority condition: ${condition}.`)));
    }
    const hardRules = (state.manifest.executableHardRules ?? []).filter((rule) =>
      (rule.appliesTo === 'ALL' || rule.appliesTo === 'PLAYER')
      && (!rule.actorIds?.length || rule.actorIds.includes(playerId))
      && (!rule.mechanismKinds?.length || rule.mechanismKinds.includes(mechanism.kind))
      && (!rule.targetIds?.length || mechanism.targetIds.some((targetId) => rule.targetIds!.includes(targetId)))
      && (rule.conditions ?? []).every((condition) => conditionMet(state, condition)));
    for (const rule of hardRules) {
      if (rule.effect === 'PROHIBIT') {
        feasible = false;
        availableFraction = 0;
        constraints.push(rule.description);
      } else if (rule.effect === 'DENY_AUTHORITY') {
        lacksCompulsion = true;
        reasons.push(`${rule.description} The attempt still lands; compliance is not the player's to command.`);
      } else if (rule.effect === 'REQUIRE_RESOURCE' && rule.resourceId) {
        const resource = state.resources[rule.resourceId];
        if (!resource || resource.amount < (rule.resourceAmount ?? 1)) {
          feasible = false;
          availableFraction = 0;
          constraints.push(rule.description);
        }
      } else if (rule.effect === 'REQUIRE_CAPABILITY' && rule.capabilityPattern) {
        const pattern = new RegExp(rule.capabilityPattern, 'i');
        if (!capableEntities.some((entity) => entity.capabilities.some((capability) => pattern.test(capability)))) {
          feasible = false;
          availableFraction = 0;
          constraints.push(rule.description);
        }
      } else if (rule.effect === 'DELAY') {
        classification = 'DELAYED';
        reasons.push(rule.description);
      }
    }
    const channelTo = (targetId: string) => controlled.has(targetId) || Object.values(state.relationships).some((relationship) =>
      relationship.communication && ((relationship.fromId === playerId && relationship.toId === targetId) || (relationship.toId === playerId && relationship.fromId === targetId)));
    if ((mechanism.kind === 'DIPLOMACY' || mechanism.kind === 'DIRECT_ORDER' || mechanism.kind === 'COERCION') && mechanism.targetIds.length) {
      if (!mechanism.targetIds.some(channelTo)) {
        // Going to someone in person, sending an envoy, or appealing publicly
        // is precisely how contact gets made with a party you have no channel
        // to. Blocking that for want of a prior channel is circular.
        const reachesOut = graph.mechanisms.some((other) =>
          (other.targetIds.some((id) => mechanism.targetIds.includes(id)) || other.kind === 'PUBLIC_COMMUNICATION')
          && (REACHES_OUT.test(other.specifiedDetail) || other.kind === 'PUBLIC_COMMUNICATION'));
        if (reachesOut) {
          classification = 'DELAYED';
          reasons.push('No standing channel exists; contact must first be established by the approach in this package.');
        } else {
          feasible = false;
          availableFraction = 0;
          constraints.push('No available communication channel to the specified target, and nothing in this directive establishes one.');
        }
      }
    }
    // Informal power: where no formal rule grants control, leverage/trust with
    // the target still determines how hard the attempt bites. A head of
    // government demanding of their own institutions carries real weight.
    const informalLeverage = mechanism.targetIds.length
      ? Math.round(mechanism.targetIds.reduce((best, targetId) => {
        const edge = Object.values(state.relationships).find((relationship) =>
          (relationship.fromId === playerId && relationship.toId === targetId) || (relationship.toId === playerId && relationship.fromId === targetId));
        if (!edge) return best;
        return Math.max(best, (edge.leverage * 0.6) + (edge.alignment * 0.25) + (edge.trust * 0.15));
      }, 0))
      : 0;
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
    const executable = feasible || (lacksCompulsion && availableFraction > 0);
    if (!feasible) classification = unmechanizedControlRequest || availableFraction <= 0 ? 'IMPOSSIBLE' : 'DELAYED';
    if (lacksCompulsion && executable) {
      // Executable act, no compulsion: an influence attempt, not a nullity.
      classification = classification === 'DELAYED' ? 'DELAYED' : 'POSSIBLE';
      feasible = true;
    }
    if (graph.mechanisms.length > 6) {
      availableFraction *= 6 / graph.mechanisms.length;
      reasons.push('Organizational attention is diluted across an oversized strategic package.');
    }
    const effectiveControl: ControlMode = lacksCompulsion && controlMode === 'NONE' ? 'INFLUENCE' : controlMode;
    return {
      mechanismId: mechanism.id,
      feasible,
      classification,
      controlMode: effectiveControl,
      capabilityEvidence,
      reasons,
      hardConstraints: constraints,
      availableFraction,
      executable: classification !== 'IMPOSSIBLE',
      reinterpretedAs: lacksCompulsion ? (COMPLIANCE_SEEKING.includes(mechanism.kind) ? 'DEMAND' : 'REQUEST') : undefined,
      informalLeverage,
    };
  });
};
