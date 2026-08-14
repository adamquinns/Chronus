import {
  ArcState,
  EntityState,
  GroundedAlias,
  Id,
  RelationshipState,
  StateChange,
  StrategyGraph,
  ValidationIssue,
  WorldExtensionAudit,
  WorldExtensionProposal,
  WorldFact,
  WorldReference,
  WorldState,
} from './domain';
import { ModelGateway } from './model';
import { worldExtensionSchema } from './schemas';
import { visibility } from './visibility';
import { fixturesForScenario } from './groundingFixtures';

const MAX_NEW_ENTITIES_PER_TURN = 2;

export const normalizeMention = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const ROLE_PHRASE_SOURCE = '\\b(?:vice president|governor|senator|president|prime minister|premier|pope|ambassador|attorney general|chief justice|secretary of state|secretary of defense|mayor|general secretary|secretary-general)\\b(?:\\s+of\\s+(?:the\\s+)?[A-Za-z][A-Za-z]+)?';
// Fresh instances per call: global regexes carry lastIndex state across calls.
const rolePhraseAll = () => new RegExp(ROLE_PHRASE_SOURCE, 'gi');
const rolePhraseTest = () => new RegExp(ROLE_PHRASE_SOURCE, 'i');
const properNounAll = () => new RegExp('\\b(?:[A-Z]{2,4}\\b|[A-Z][a-z]{2,}(?:\\s+[A-Z][a-z.]{1,}){1,2})', 'g');
const ACRONYM = /^[A-Z]{2,4}$/;
const ACRONYM_STOPLIST = new Set(['ASAP', 'OK', 'USA', 'WH', 'AM', 'PM', 'TV', 'VS']);

const knownNames = (state: WorldState): { full: Set<string>; last: Set<string> } => {
  const full = new Set<string>();
  const last = new Set<string>();
  for (const entity of Object.values(state.entities)) {
    const name = normalizeMention(entity.name);
    full.add(name);
    full.add(normalizeMention(entity.id.replaceAll('_', ' ')));
    const words = name.split(' ');
    if (words.length) last.add(words[words.length - 1]);
  }
  for (const advisor of state.manifest.advisors) full.add(normalizeMention(advisor.name));
  return full.size ? { full, last } : { full, last };
};

const isKnown = (mention: string, known: { full: Set<string>; last: Set<string> }) => {
  const normalized = normalizeMention(mention);
  if (!normalized) return true;
  for (const name of known.full) {
    if (name === normalized) return true;
    // Substring containment only for reasonably long mentions, so "UN" or
    // "LBJ" never accidentally matches inside an unrelated name.
    if (normalized.length >= 4 && (name.includes(normalized) || normalized.includes(name))) return true;
  }
  const words = normalized.split(' ');
  // Single-word mentions match on known last names; multi-word mentions require
  // full-name containment (handled above) so "Robert Kennedy" stays distinct
  // from "John F. Kennedy".
  if (words.length === 1) return known.last.has(words[0]);
  return false;
};

export const extractWorldReferences = (directive: string, state: WorldState): WorldReference[] => {
  const known = knownNames(state);
  const candidates: string[] = [];
  for (const match of directive.matchAll(rolePhraseAll())) candidates.push(match[0]);
  for (const match of directive.matchAll(properNounAll())) {
    const text = match[0];
    const words = text.trim().split(/\s+/);
    if (words.length === 1 && (!ACRONYM.test(text) || ACRONYM_STOPLIST.has(text))) continue; // single title-case words are too noisy
    candidates.push(text);
  }
  // Drop candidates fully contained inside a longer candidate ("vice president"
  // inside "Vice President Johnson").
  const unique = [...new Set(candidates.map((candidate) => candidate.trim()))]
    .filter((candidate, _, all) => !all.some((other) =>
      other !== candidate && normalizeMention(other).includes(normalizeMention(candidate))));
  const references: WorldReference[] = [];
  for (const mention of unique) {
    if (isKnown(mention, known)) continue;
    if (references.some((reference) => normalizeMention(reference.mention) === normalizeMention(mention))) continue;
    references.push({
      mention,
      kindHint: rolePhraseTest().test(mention) ? 'OFFICE' : undefined,
      clauseId: '',
      requiredForAttempt: true,
    });
    if (references.length >= 6) break;
  }
  return references;
};

const emptyProposal = (rationale: string): WorldExtensionProposal => ({
  rationale,
  entities: [],
  relationships: [],
  facts: [],
  arcs: [],
  aliases: [],
  sourceRefs: [],
  confidence: 'MEDIUM',
});

const resolveAgainstState = (
  reference: WorldReference,
  state: WorldState,
  aliases: Record<string, Id>,
): GroundedAlias | undefined => {
  const normalized = normalizeMention(reference.mention);
  const aliased = aliases[normalized];
  if (aliased && state.entities[aliased]) return { alias: normalized, targetId: aliased, confidence: 'HIGH' };
  for (const entity of Object.values(state.entities)) {
    const name = normalizeMention(entity.name);
    if (name === normalized || (normalized.length >= 4 && (name.includes(normalized) || normalized.includes(name)))) {
      return { alias: normalized, targetId: entity.id, confidence: 'HIGH' };
    }
  }
  return undefined;
};

export const validateWorldExtension = (
  proposal: WorldExtensionProposal,
  state: WorldState,
): { proposal: WorldExtensionProposal; issues: ValidationIssue[] } => {
  const issues: ValidationIssue[] = [];
  const repaired = structuredClone(proposal);
  const existingNames = new Map(Object.values(state.entities).map((entity) => [normalizeMention(entity.name), entity.id]));

  const keptEntities: EntityState[] = [];
  for (const entity of repaired.entities) {
    if (state.entities[entity.id]) {
      issues.push({ code: 'WX_ENTITY_EXISTS', severity: 'WARNING', message: `${entity.id} already exists; converted to alias.` });
      repaired.aliases.push({ alias: normalizeMention(entity.name), targetId: entity.id, confidence: 'HIGH' });
      continue;
    }
    const collidingId = existingNames.get(normalizeMention(entity.name));
    if (collidingId) {
      issues.push({ code: 'WX_ENTITY_DUPLICATE_NAME', severity: 'WARNING', message: `"${entity.name}" duplicates ${collidingId}; converted to alias.` });
      repaired.aliases.push({ alias: normalizeMention(entity.name), targetId: collidingId, confidence: 'HIGH' });
      continue;
    }
    if (keptEntities.some((kept) => kept.id === entity.id)) {
      issues.push({ code: 'WX_ENTITY_DUPLICATE_ID', severity: 'ERROR', message: `Duplicate proposed entity id ${entity.id}.` });
      continue;
    }
    if (keptEntities.length >= MAX_NEW_ENTITIES_PER_TURN) {
      issues.push({ code: 'WX_ENTITY_BUDGET', severity: 'WARNING', message: `Entity budget reached; ${entity.id} deferred to a later turn.` });
      continue;
    }
    keptEntities.push({
      ...entity,
      power: Math.max(0, Math.min(100, entity.power)),
      resolve: Math.max(0, Math.min(100, entity.resolve)),
      status: entity.status ?? 'ACTIVE',
      constraints: entity.constraints ?? [],
      privateFacts: entity.privateFacts ?? [],
      visibility: entity.visibility ?? visibility('PUBLIC'),
      fieldVisibility: entity.fieldVisibility ?? {},
    });
  }
  repaired.entities = keptEntities;

  const availableIds = new Set([...Object.keys(state.entities), ...repaired.entities.map((entity) => entity.id)]);
  repaired.relationships = repaired.relationships.flatMap((relationship) => {
    if (!availableIds.has(relationship.fromId) || !availableIds.has(relationship.toId)) {
      issues.push({ code: 'WX_RELATIONSHIP_ENDPOINT', severity: 'ERROR', message: `${relationship.id} references an unknown endpoint.` });
      return [];
    }
    const id = state.relationships[relationship.id] ? `${relationship.id}_dyn` : relationship.id;
    return [{
      ...relationship,
      id,
      commitments: relationship.commitments ?? [],
      visibility: relationship.visibility ?? visibility('PUBLIC'),
    }];
  });

  repaired.facts = repaired.facts.flatMap((fact) => {
    if ((fact.provenance as string) === 'SIMULATED_POST_DIVERGENCE') {
      issues.push({ code: 'WX_FACT_PROVENANCE', severity: 'ERROR', message: `${fact.id} may not claim simulated provenance from grounding.` });
      return [];
    }
    const id = state.facts[fact.id] ? `${fact.id}_dyn` : fact.id;
    return [{
      ...fact,
      id,
      visibility: fact.visibility ?? visibility('PUBLIC'),
      source: fact.source ?? 'Dynamic grounding',
      sourceRefs: fact.sourceRefs ?? [],
      createdTurn: state.turn,
    }];
  });

  repaired.arcs = repaired.arcs.flatMap((arc) => {
    const participants = (arc.participantIds ?? []).filter((id) => availableIds.has(id));
    if (arc.ownerId && !availableIds.has(arc.ownerId)) {
      issues.push({ code: 'WX_ARC_OWNER', severity: 'ERROR', message: `${arc.id} has an unknown owner.` });
      return [];
    }
    const id = state.arcs[arc.id] ? `${arc.id}_dyn` : arc.id;
    return [{
      ...arc,
      id,
      progress: arc.progress ?? 0,
      threshold: arc.threshold ?? 100,
      status: 'ACTIVE' as const,
      participantIds: participants,
      visibility: arc.visibility ?? visibility('PUBLIC'),
      onResolve: arc.onResolve ?? [],
    }];
  });

  repaired.aliases = repaired.aliases.filter((alias) => {
    if (availableIds.has(alias.targetId)) return true;
    issues.push({ code: 'WX_ALIAS_TARGET', severity: 'ERROR', message: `Alias "${alias.alias}" points at unknown ${alias.targetId}.` });
    return false;
  });

  return { proposal: repaired, issues };
};

/** Pure application: returns a new state plus ledger records. Never mutates input. */
export const applyWorldExtension = (
  state: WorldState,
  proposal: WorldExtensionProposal,
): { state: WorldState; changes: StateChange[] } => {
  const next = structuredClone(state);
  const changes: StateChange[] = [];
  const sourceEffectId = `world_extension_${state.turn + 1}`;
  const record = (targetType: StateChange['targetType'], targetId: Id, after: unknown) => changes.push({
    id: `wx_${state.turn + 1}_${changes.length + 1}`,
    targetType,
    targetId,
    field: 'create',
    before: undefined,
    after: structuredClone(after),
    cause: `Materialized on first contact: ${proposal.rationale}`,
    sourceEffectId,
    impactClass: 'NONE',
    confidence: proposal.confidence,
  });
  for (const entity of proposal.entities) {
    next.entities[entity.id] = structuredClone(entity);
    record('ENTITY', entity.id, entity);
    // Fix doc §7.4: a materialized actor gets a self-authority rule bounded by
    // its declared capabilities so it can act autonomously — over itself only.
    next.manifest.authorityRules.push({
      actorId: entity.id,
      targetId: entity.id,
      mechanismKinds: ['DIRECT_ORDER', 'DIPLOMACY', 'COERCION', 'ECONOMIC_PRESSURE', 'MILITARY_OPERATION', 'INTELLIGENCE', 'DECEPTION', 'LEGAL_ACTION', 'PUBLIC_COMMUNICATION', 'COALITION_BUILDING', 'RESOURCE_TRANSFER', 'OTHER'],
      mode: 'DIRECT',
      conditions: [],
    });
  }
  for (const relationship of proposal.relationships) {
    next.relationships[relationship.id] = structuredClone(relationship);
    record('RELATIONSHIP', relationship.id, relationship);
  }
  for (const fact of proposal.facts) {
    next.facts[fact.id] = structuredClone(fact);
    record('FACT', fact.id, fact);
  }
  for (const arc of proposal.arcs) {
    next.arcs[arc.id] = structuredClone(arc);
    record('ARC', arc.id, arc);
  }
  return { state: next, changes };
};

const fixtureProposal = (
  references: WorldReference[],
  state: WorldState,
): { proposal: WorldExtensionProposal; grounded: Map<string, Id>; remaining: WorldReference[] } => {
  const fixtures = fixturesForScenario(state.manifest.id);
  const proposal = emptyProposal('Grounded from period fixtures.');
  const grounded = new Map<string, Id>();
  const remaining: WorldReference[] = [];
  for (const reference of references) {
    const normalized = normalizeMention(reference.mention);
    const fixture = fixtures.find((candidate) => candidate.aliases.some((alias) =>
      alias === normalized || normalized.includes(alias) || alias.includes(normalized)));
    if (!fixture) {
      remaining.push(reference);
      continue;
    }
    const targetId = fixture.existingTargetId ?? fixture.entity?.id;
    if (!targetId) {
      remaining.push(reference);
      continue;
    }
    grounded.set(normalized, targetId);
    proposal.aliases.push({ alias: normalized, targetId, confidence: 'VERY_HIGH' });
    if (fixture.entity && !state.entities[fixture.entity.id] && !proposal.entities.some((entity) => entity.id === fixture.entity!.id)) {
      proposal.entities.push(structuredClone(fixture.entity));
      for (const relationship of fixture.relationships ?? []) proposal.relationships.push(structuredClone(relationship));
      for (const fact of fixture.facts ?? []) proposal.facts.push(structuredClone(fact));
    }
  }
  proposal.confidence = 'VERY_HIGH';
  return { proposal, grounded, remaining };
};

const genericOfficeProposal = (references: WorldReference[], state: WorldState): WorldExtensionProposal => {
  const proposal = emptyProposal('Generic period abstraction created without model grounding.');
  for (const reference of references) {
    if (reference.kindHint !== 'OFFICE' || !reference.requiredForAttempt) continue;
    if (proposal.entities.length >= MAX_NEW_ENTITIES_PER_TURN) break;
    const id = normalizeMention(reference.mention).replaceAll(' ', '_').slice(0, 48);
    if (!id || state.entities[id]) continue;
    proposal.entities.push({
      id,
      name: reference.mention.replace(/\b[a-z]/g, (char) => char.toUpperCase()),
      kind: 'PERSON',
      description: `Holder of the office "${reference.mention}" at the scenario date. Materialized as a scenario abstraction pending better grounding.`,
      objectives: ['Fulfill the responsibilities of the office', 'Protect their own standing'],
      capabilities: ['Institutional authority of the office', 'Public voice'],
      constraints: ['Acts within the office’s ordinary legal limits'],
      status: 'ACTIVE',
      power: 40,
      resolve: 50,
      privateFacts: [],
      visibility: visibility('PUBLIC'),
      fieldVisibility: {},
    });
    proposal.facts.push({
      id: `fact_${id}_office`,
      statement: `An officeholder matching "${reference.mention}" exists at the scenario date; identity abstracted.`,
      provenance: 'SCENARIO_ABSTRACTION',
      confidence: 'MEDIUM',
      visibility: visibility('PUBLIC'),
      source: 'Dynamic grounding fallback',
      sourceRefs: [],
      createdTurn: state.turn,
    });
    proposal.aliases.push({ alias: normalizeMention(reference.mention), targetId: id, confidence: 'MEDIUM' });
  }
  proposal.confidence = 'MEDIUM';
  return proposal;
};

const mergeProposals = (parts: WorldExtensionProposal[]): WorldExtensionProposal => {
  const merged = emptyProposal(parts.map((part) => part.rationale).filter(Boolean).join(' '));
  const seenEntities = new Set<string>();
  for (const part of parts) {
    for (const entity of part.entities) {
      if (seenEntities.has(entity.id)) continue;
      seenEntities.add(entity.id);
      merged.entities.push(entity);
    }
    merged.relationships.push(...part.relationships);
    merged.facts.push(...part.facts);
    merged.arcs.push(...part.arcs);
    merged.aliases.push(...part.aliases);
    merged.sourceRefs.push(...part.sourceRefs);
  }
  merged.entities = merged.entities.slice(0, MAX_NEW_ENTITIES_PER_TURN);
  merged.aliases = merged.aliases.filter((alias, index, all) =>
    all.findIndex((other) => other.alias === alias.alias) === index);
  merged.confidence = parts.length === 1 ? parts[0].confidence : 'MEDIUM';
  return merged;
};

const modelProposal = async (
  references: WorldReference[],
  state: WorldState,
  gateway: ModelGateway,
): Promise<WorldExtensionProposal> => {
  const result = await gateway.callJson('world_grounder', [
    {
      role: 'system',
      content: 'You ground references for a historical simulation. Propose the MINIMUM period-accurate world objects needed for the listed unresolved references at the scenario cutoff date: the correct real officeholder or institution where identifiable, with realistic capabilities bounded to the actual role. Omit references that are implausible or anachronistic for the period and explain the omission in rationale. Never duplicate existingEntities — return an alias instead. Use snake_case ids. Label provenance honestly: VERIFIED_FACT only with a citable source in sourceRefs, otherwise WELL_SUPPORTED_INFERENCE or SCENARIO_ABSTRACTION.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        scenario: {
          id: state.manifest.id,
          title: state.manifest.title,
          premise: state.manifest.premise,
          playerRole: state.manifest.playerRole,
          historicalCutoff: state.manifest.historicalCutoff,
          currentDate: state.dateLabel,
        },
        unresolvedReferences: references,
        existingEntities: Object.values(state.entities).map((entity) => ({ id: entity.id, name: entity.name, kind: entity.kind })),
      }),
    },
  ], worldExtensionSchema, 'WorldExtensionProposal');
  const wire = result.value;
  return {
    rationale: wire.rationale,
    entities: wire.entities.map((entity) => ({
      ...entity,
      constraints: entity.constraints ?? [],
      status: 'ACTIVE' as const,
      privateFacts: [],
      visibility: visibility('PUBLIC'),
      fieldVisibility: {},
    })),
    relationships: wire.relationships.map((relationship) => ({
      ...relationship,
      commitments: relationship.commitments ?? [],
      visibility: visibility('PUBLIC'),
    })),
    facts: wire.facts.map((fact) => ({
      ...fact,
      visibility: visibility('PUBLIC'),
      source: 'Dynamic grounding (model)',
      sourceRefs: fact.sourceRefs ?? [],
      createdTurn: state.turn,
    })),
    arcs: wire.arcs.map((arc) => ({
      ...arc,
      progress: 0,
      threshold: 100,
      status: 'ACTIVE' as const,
      participantIds: arc.participantIds ?? [],
      visibility: visibility('PUBLIC'),
      onResolve: [],
    })),
    aliases: wire.aliases,
    sourceRefs: wire.sourceRefs ?? [],
    confidence: wire.confidence,
  };
};

export interface GroundingOutcome {
  graph: StrategyGraph;
  workingState: WorldState;
  proposal?: WorldExtensionProposal;
  audit: WorldExtensionAudit;
  aliasUpdates: Record<string, Id>;
}

const attachGroundedTargets = (graph: StrategyGraph, aliasToId: Map<string, Id>): StrategyGraph => {
  if (!aliasToId.size) return graph;
  const mechanisms = graph.mechanisms.map((mechanism) => {
    const text = normalizeMention(`${mechanism.specifiedDetail} ${mechanism.objective}`);
    const added = [...aliasToId.entries()]
      .filter(([alias]) => text.includes(alias))
      .map(([, targetId]) => targetId);
    if (!added.length) return mechanism;
    return { ...mechanism, targetIds: [...new Set([...mechanism.targetIds, ...added])] };
  });
  return { ...graph, mechanisms };
};

export const groundReferences = async (
  graph: StrategyGraph,
  state: WorldState,
  aliases: Record<string, Id>,
  gateway?: ModelGateway,
): Promise<GroundingOutcome> => {
  const references = graph.unresolvedReferences;
  const audit: WorldExtensionAudit = {
    references,
    validation: [],
    applied: false,
    aliasesResolved: [],
    source: 'NONE',
  };
  if (!references.length) return { graph, workingState: state, audit, aliasUpdates: {} };

  const aliasToId = new Map<string, Id>();
  const stillUnresolved: WorldReference[] = [];
  for (const reference of references) {
    const resolved = resolveAgainstState(reference, state, aliases);
    if (resolved) {
      aliasToId.set(resolved.alias, resolved.targetId);
      audit.aliasesResolved.push(resolved);
    } else {
      stillUnresolved.push(reference);
    }
  }

  const parts: WorldExtensionProposal[] = [];
  const sources: WorldExtensionAudit['source'][] = [];
  const fixtures = fixtureProposal(stillUnresolved, state);
  if (fixtures.proposal.entities.length || fixtures.proposal.aliases.length) {
    parts.push(fixtures.proposal);
    sources.push('FIXTURE');
  }
  let remaining = fixtures.remaining;
  if (remaining.length && gateway) {
    try {
      parts.push(await modelProposal(remaining, state, gateway));
      sources.push('MODEL');
      remaining = [];
    } catch {
      audit.validation.push({ code: 'WX_MODEL_UNAVAILABLE', severity: 'WARNING', message: 'World grounding model unavailable; deterministic fallback used.' });
    }
  }
  if (remaining.length) {
    const fallback = genericOfficeProposal(remaining, state);
    if (fallback.entities.length) {
      parts.push(fallback);
      sources.push('FALLBACK');
    }
  }

  if (!parts.length) {
    audit.source = audit.aliasesResolved.length ? 'ALIASES_ONLY' : 'NONE';
    const aliasUpdates = Object.fromEntries(audit.aliasesResolved.map((alias) => [alias.alias, alias.targetId]));
    return { graph: attachGroundedTargets(graph, aliasToId), workingState: state, audit, aliasUpdates };
  }

  const merged = mergeProposals(parts);
  const validated = validateWorldExtension(merged, state);
  audit.validation.push(...validated.issues);
  audit.proposal = validated.proposal;
  audit.source = sources.length > 1 ? 'MIXED' : sources[0];

  const applied = applyWorldExtension(state, validated.proposal);
  audit.applied = true;
  for (const alias of validated.proposal.aliases) {
    if (applied.state.entities[alias.targetId]) aliasToId.set(alias.alias, alias.targetId);
  }
  const aliasUpdates = Object.fromEntries([
    ...audit.aliasesResolved.map((alias) => [alias.alias, alias.targetId]),
    ...validated.proposal.aliases.filter((alias) => applied.state.entities[alias.targetId]).map((alias) => [alias.alias, alias.targetId]),
  ]);
  return {
    graph: attachGroundedTargets(graph, aliasToId),
    workingState: applied.state,
    proposal: validated.proposal,
    audit,
    aliasUpdates,
  };
};
