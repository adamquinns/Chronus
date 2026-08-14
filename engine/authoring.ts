import { z } from 'zod';
import { ActorBeliefState, AuthorityRule, Campaign, EntityState, ScenarioManifest, WorldState } from './domain';
import { ModelGateway } from './model';
import { assertValidScenario } from './scenario';
import { scenarioDraftSchema, scenarioResearchSchema } from './schemas';
import { canAccess, visibility } from './visibility';

export type ScenarioDraft = z.infer<typeof scenarioDraftSchema>;

const toVisibility = (draft: ScenarioDraft['facts'][number]['visibility']) =>
  visibility(draft.classification, draft.actorIds, { discoverable: draft.discoverable });

const playerEntity = (draft: ScenarioDraft): EntityState => ({
  id: draft.player.id,
  name: draft.player.name,
  kind: 'PERSON',
  description: draft.player.role,
  objectives: draft.player.objectives,
  capabilities: draft.player.capabilities,
  constraints: draft.player.constraints,
  status: 'ACTIVE',
  power: 70,
  resolve: 70,
  privateFacts: [],
  visibility: visibility('PLAYER_KNOWN', [draft.player.id]),
  fieldVisibility: {
    objectives: visibility('PLAYER_KNOWN', [draft.player.id]),
    capabilities: visibility('PLAYER_KNOWN', [draft.player.id]),
    constraints: visibility('PLAYER_KNOWN', [draft.player.id]),
    power: visibility('PLAYER_KNOWN', [draft.player.id]),
    resolve: visibility('PLAYER_KNOWN', [draft.player.id]),
  },
});

export const initializeScenarioDraft = (draftInput: ScenarioDraft, seed = Date.now()): Campaign => {
  const draft = scenarioDraftSchema.parse(draftInput);
  if (Number.isNaN(Date.parse(draft.startingDateTime))) throw new Error('Scenario startingDateTime must be an ISO-compatible date.');
  const entities: Record<string, EntityState> = { [draft.player.id]: playerEntity(draft) };
  for (const entity of draft.entities.filter((item) => item.id !== draft.player.id)) {
    entities[entity.id] = {
      ...entity,
      status: 'ACTIVE',
      privateFacts: [],
      visibility: toVisibility(entity.visibility),
      fieldVisibility: {
        objectives: visibility('ACTOR_PRIVATE', [entity.id]),
        capabilities: visibility('ACTOR_KNOWN', [entity.id, ...(entity.controllerId ? [entity.controllerId] : [])]),
        constraints: visibility('ACTOR_PRIVATE', [entity.id]),
        power: visibility('POST_GAME_ONLY'),
        resolve: visibility('ACTOR_PRIVATE', [entity.id]),
      },
    };
  }

  const authorityRules: ScenarioManifest['authorityRules'] = [
    { actorId: draft.player.id, targetId: draft.player.id, mechanismKinds: ['DIRECT_ORDER', 'RESOURCE_TRANSFER', 'PUBLIC_COMMUNICATION'], mode: 'DIRECT', conditions: [] },
    ...Object.values(entities)
      .filter((entity) => entity.controllerId === draft.player.id)
      .map((entity): AuthorityRule => ({ actorId: draft.player.id, targetId: entity.id, mechanismKinds: ['DIRECT_ORDER', 'MILITARY_OPERATION', 'INTELLIGENCE'], mode: 'DELEGATED', conditions: [] })),
    ...draft.relationships
      .filter((relationship) => relationship.communication && (relationship.fromId === draft.player.id || relationship.toId === draft.player.id))
      .map((relationship): AuthorityRule => ({
        actorId: draft.player.id,
        targetId: relationship.fromId === draft.player.id ? relationship.toId : relationship.fromId,
        mechanismKinds: ['DIPLOMACY', 'COERCION', 'PUBLIC_COMMUNICATION'],
        mode: 'INFLUENCE',
        conditions: ['Available communication channel'],
      })),
  ];

  const manifest: ScenarioManifest = {
    id: draft.id,
    title: draft.title,
    premise: draft.premise,
    playerId: draft.player.id,
    playerRole: draft.player.role,
    startingDate: draft.startingDateLabel,
    timeUnit: draft.timeScale.unit,
    timeScale: draft.timeScale,
    metricDefinitions: draft.metrics.map(({ value: _value, ...metric }) => ({ ...metric, min: 0, max: 100, visibility: visibility('PLAYER_KNOWN', [draft.player.id]) })),
    historicalCutoff: draft.startingDateTime,
    authorityRules,
    calibrationRules: draft.calibrationRules,
    historicalAnalogs: draft.historicalAnalogs,
    hardRules: draft.hardRules,
    advisors: draft.advisors.map((advisor) => ({ ...advisor, visibility: visibility('PLAYER_KNOWN', [draft.player.id]) })),
    unresolvedUncertainties: draft.unresolvedUncertainties,
  };

  const state: WorldState = {
    schemaVersion: 2,
    campaignId: `${draft.id}_${seed >>> 0}`,
    revision: 0,
    manifest,
    turn: 0,
    dateLabel: draft.startingDateLabel,
    currentDateTime: new Date(draft.startingDateTime).toISOString(),
    elapsedMinutes: 0,
    rngSeed: seed >>> 0,
    rngCursor: 0,
    metrics: Object.fromEntries(draft.metrics.map((metric) => [metric.id, metric.value])),
    resources: Object.fromEntries(draft.resources.map((resource) => [resource.id, { ...resource, visibility: toVisibility(resource.visibility) }])),
    entities,
    relationships: Object.fromEntries(draft.relationships.map((relationship) => [relationship.id, { ...relationship, visibility: toVisibility(relationship.visibility) }])),
    arcs: Object.fromEntries(draft.arcs.map((arc) => [arc.id, { ...arc, threshold: 100, status: 'ACTIVE' as const, visibility: toVisibility(arc.visibility), onResolve: [] }])),
    facts: Object.fromEntries(draft.facts.map((fact) => [fact.id, { ...fact, visibility: toVisibility(fact.visibility), createdTurn: 0 }])),
    pendingProcesses: {},
    goal: { ...draft.goal, status: 'ACTIVE' },
    gameOver: false,
  };

  const actorBeliefs: Record<string, ActorBeliefState> = {};
  for (const actorId of Object.keys(entities)) actorBeliefs[actorId] = {
    actorId,
    knownFactIds: Object.values(state.facts).filter((fact) => canAccess(fact.visibility, actorId, draft.player.id)).map((fact) => fact.id),
    beliefs: {},
  };
  const beliefs = {
    player: actorBeliefs[draft.player.id],
    actors: actorBeliefs,
  };
  const memories = Object.fromEntries(Object.values(entities).map((entity) => [entity.id, {
    actorId: entity.id,
    events: [],
    currentStrategy: entity.objectives[0],
    historicalPriorWeight: 1,
  }]));
  const campaign: Campaign = { state, beliefs, memories, audits: [] };
  assertValidScenario(campaign);
  return campaign;
};

export const generateCustomScenario = async (
  premise: string,
  gateway: ModelGateway,
  seed = Date.now(),
): Promise<Campaign> => {
  if (!premise.trim()) throw new Error('A custom scenario premise is required.');
  const research = await gateway.callJson('scenario_researcher', [
    { role: 'system', content: 'Create a concise research packet for scenario initialization. Separate verified assertions, contested interpretation, and unresolved uncertainty. Never invent source titles; use descriptive source families when exact citations are unavailable.' },
    { role: 'user', content: premise },
  ], scenarioResearchSchema, 'ScenarioResearch');
  const draft = await gateway.callJson('scenario_architect', [
    { role: 'system', content: 'Design a complete playable Chronus scenario package. Use stable snake_case IDs. Include explicit visibility for every item, causal arcs with participants, resources, unresolved uncertainties, calibration, authority through entity control and relationships, historical analogs where grounded, and a viable but non-prescriptive objective. Verified facts require source references. Do not pre-script future outcomes.' },
    { role: 'user', content: JSON.stringify({ playerRequest: premise, research: research.value }) },
  ], scenarioDraftSchema, 'ScenarioDraft');
  return initializeScenarioDraft(draft.value, seed);
};
