import { z } from 'zod';

const confidence = z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']);
const impact = z.enum(['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE', 'SYSTEMIC']);
const engagement = z.enum(['ENGAGES_STRONGLY', 'ENGAGES', 'ENGAGES_WEAKLY', 'DOES_NOT_ENGAGE', 'BACKFIRES']);

export const mechanismSchema = z.object({
  id: z.string(),
  kind: z.enum(['DIRECT_ORDER', 'DIPLOMACY', 'COERCION', 'ECONOMIC_PRESSURE', 'MILITARY_OPERATION', 'INTELLIGENCE', 'DECEPTION', 'LEGAL_ACTION', 'PUBLIC_COMMUNICATION', 'COALITION_BUILDING', 'RESOURCE_TRANSFER', 'OTHER']),
  objective: z.string(),
  targetIds: z.array(z.string()),
  actorIds: z.array(z.string()),
  dependencies: z.array(z.string()),
  assumptions: z.array(z.string()),
  sequence: z.number().int().min(0),
  durationTurns: z.number().int().min(0).max(12),
  resourceClaims: z.array(z.object({ resourceId: z.string(), amount: z.number().nonnegative() })),
  specifiedDetail: z.string(),
});

export const strategyGraphSchema = z.object({
  objective: z.string(),
  mechanisms: z.array(mechanismSchema).min(1).max(12),
  sequencing: z.array(z.string()),
  contingencies: z.array(z.string()),
  explicitRisks: z.array(z.string()),
  unspecified: z.array(z.string()),
  communicationStyleIsMechanism: z.boolean(),
});

export const fidelitySchema = z.object({
  faithful: z.boolean(),
  inventedMechanisms: z.array(z.string()),
  omittedWeaknesses: z.array(z.string()),
  assumedCoordination: z.array(z.string()),
  contradictions: z.array(z.string()),
  repairedGraph: strategyGraphSchema.optional(),
});

export const actorActionsSchema = z.object({
  actions: z.array(z.object({
    actorId: z.string(),
    objective: z.string(),
    action: z.string(),
    mechanisms: z.array(z.string()),
    perceivedPlayerMechanismIds: z.array(z.string()),
    beliefKeysUsed: z.array(z.string()),
    capabilityIdsUsed: z.array(z.string()),
    confidence,
  })).max(8),
});

export const redTeamSchema = z.object({
  findings: z.array(z.object({
    category: z.enum(['COMPILER_CHARITY', 'HIDDEN_DEPENDENCY', 'SECOND_ORDER_EFFECT', 'OMNISCIENCE', 'CAPABILITY_VIOLATION', 'MAGNITUDE_DRIFT', 'SYCOPHANCY', 'OTHER']),
    severity: z.enum(['INFO', 'WARNING', 'BLOCKING']),
    claim: z.string(),
    evidence: z.array(z.string()),
    affectedMechanismIds: z.array(z.string()),
  })).max(12),
});

export const effectSchema = z.object({
  id: z.string(),
  mechanismId: z.string(),
  targetType: z.enum(['METRIC', 'RESOURCE', 'ENTITY', 'RELATIONSHIP', 'ARC', 'FACT', 'PROCESS', 'GOAL']),
  targetId: z.string(),
  field: z.string(),
  direction: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']),
  impactClass: impact,
  confidence,
  engagement,
  cause: z.string(),
  dependencies: z.array(z.string()),
  actorId: z.string().optional(),
  proposedDelta: z.number().optional(),
  setValue: z.unknown().optional(),
});

export const adjudicationSchema = z.object({
  summary: z.string().max(1200),
  mechanismFindings: z.array(z.object({ mechanismId: z.string(), engagement, reason: z.string().max(800), confidence })).max(12),
  recommendedEffects: z.array(effectSchema).max(16),
  outcomeBands: z.array(z.object({
    id: z.string(),
    label: z.string(),
    probability: z.number().min(0).max(1),
    effectIds: z.array(z.string()),
    description: z.string().max(900),
  })).min(1).max(5),
  assumptions: z.array(z.string().max(500)).max(10),
  unknowns: z.array(z.string().max(500)).max(10),
  confidence,
});

export const narrativeSchema = z.object({
  title: z.string(),
  immediateOutcome: z.string(),
  worldReaction: z.string(),
  strategicConsequences: z.string(),
  news: z.array(z.object({ source: z.string(), headline: z.string() })).max(5),
  advisorReactions: z.array(z.object({ actorId: z.string(), name: z.string(), reaction: z.string() })).max(4),
});

export const validationSchema = z.object({
  issues: z.array(z.object({
    code: z.string(),
    severity: z.enum(['WARNING', 'ERROR']),
    message: z.string(),
    path: z.string().optional(),
  })).max(20),
});

const visibilityDraftSchema = z.object({
  classification: z.enum(['PUBLIC', 'PLAYER_KNOWN', 'ACTOR_KNOWN', 'ACTOR_PRIVATE', 'SIMULATION_SECRET', 'POST_GAME_ONLY']),
  actorIds: z.array(z.string()).default([]),
  discoverable: z.boolean().default(true),
});

export const scenarioResearchSchema = z.object({
  divergencePoint: z.string(),
  verifiedAssertions: z.array(z.object({ statement: z.string(), sourceRefs: z.array(z.string()).min(1) })).max(20),
  contestedAssertions: z.array(z.object({ statement: z.string(), sourceRefs: z.array(z.string()) })).max(15),
  unresolvedUncertainties: z.array(z.string()).max(15),
});

export const scenarioDraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  premise: z.string(),
  startingDateLabel: z.string(),
  startingDateTime: z.string(),
  timeScale: z.object({ amount: z.number().int().positive(), unit: z.enum(['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS']) }),
  timeScaleRules: z.array(z.object({
    id: z.string(), condition: z.object({ targetType: z.literal('METRIC'), targetId: z.string(), field: z.literal('value'), operator: z.enum(['LT', 'LTE', 'EQ', 'GTE', 'GT']), value: z.number() }),
    scale: z.object({ amount: z.number().int().positive(), unit: z.enum(['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS']) }), rationale: z.string(),
  })).max(8).optional(),
  player: z.object({ id: z.string(), name: z.string(), role: z.string(), objectives: z.array(z.string()).min(1), capabilities: z.array(z.string()).min(1), constraints: z.array(z.string()) }),
  metrics: z.array(z.object({ id: z.string(), label: z.string(), description: z.string(), value: z.number().min(0).max(100), dangerBelow: z.number().min(0).max(100).optional(), dangerAbove: z.number().min(0).max(100).optional() })).min(2).max(12),
  entities: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(['PERSON', 'FACTION', 'INSTITUTION', 'MILITARY', 'STATE', 'ASSET']), description: z.string(), objectives: z.array(z.string()).min(1), capabilities: z.array(z.string()).min(1), constraints: z.array(z.string()), power: z.number().min(0).max(100), resolve: z.number().min(0).max(100), controllerId: z.string().optional(), visibility: visibilityDraftSchema })).min(1).max(20),
  resources: z.array(z.object({ id: z.string(), label: z.string(), amount: z.number().nonnegative(), unit: z.string(), renewable: z.boolean(), ownerId: z.string(), visibility: visibilityDraftSchema })).max(30),
  relationships: z.array(z.object({ id: z.string(), fromId: z.string(), toId: z.string(), alignment: z.number().min(0).max(100), trust: z.number().min(0).max(100), leverage: z.number().min(0).max(100), communication: z.boolean(), commitments: z.array(z.string()), visibility: visibilityDraftSchema })).max(40),
  facts: z.array(z.object({ id: z.string(), statement: z.string(), provenance: z.enum(['VERIFIED_FACT', 'WELL_SUPPORTED_INFERENCE', 'CONTESTED_INTERPRETATION', 'SCENARIO_ABSTRACTION']), confidence, visibility: visibilityDraftSchema, sourceRefs: z.array(z.string()) })).min(1).max(40),
  arcs: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), progress: z.number().min(0).max(100), direction: z.enum(['RISING', 'FALLING', 'STABLE']), dueTurn: z.number().int().positive().optional(), ownerId: z.string().optional(), participantIds: z.array(z.string()), visibility: visibilityDraftSchema })).max(15),
  processes: z.array(z.object({
    id: z.string(), label: z.string(), ownerId: z.string(), dueTurn: z.number().int().positive(), progress: z.number().nonnegative(), requiredProgress: z.number().positive(),
    onMature: z.array(effectSchema).max(12), perTurnEffects: z.array(effectSchema).max(8), participantIds: z.array(z.string()), detectableBy: z.array(z.string()), visibility: visibilityDraftSchema,
  })).max(15).optional(),
  goal: z.object({
    id: z.string(), title: z.string(), description: z.string(), victoryConditions: z.array(z.string()).min(1), failureConditions: z.array(z.string()).min(1),
    victoryRules: z.array(z.object({ targetType: z.enum(['METRIC', 'RESOURCE', 'ENTITY', 'ARC', 'FACT']), targetId: z.string(), field: z.string(), operator: z.enum(['LT', 'LTE', 'EQ', 'GTE', 'GT', 'EXISTS', 'NOT_EXISTS']), value: z.union([z.number(), z.string(), z.boolean()]).optional() })).min(1),
    failureRules: z.array(z.object({ targetType: z.enum(['METRIC', 'RESOURCE', 'ENTITY', 'ARC', 'FACT']), targetId: z.string(), field: z.string(), operator: z.enum(['LT', 'LTE', 'EQ', 'GTE', 'GT', 'EXISTS', 'NOT_EXISTS']), value: z.union([z.number(), z.string(), z.boolean()]).optional() })).min(1),
    victoryMode: z.enum(['ALL', 'ANY']), failureMode: z.enum(['ALL', 'ANY']), deadlineTurn: z.number().int().positive(), terminalOnAchievement: z.boolean(), terminalOnFailure: z.boolean(),
  }),
  hardRules: z.array(z.string()).min(1),
  calibrationRules: z.array(z.object({ id: z.string(), mechanismKind: mechanismSchema.shape.kind.optional(), targetType: effectSchema.shape.targetType.optional(), targetId: z.string().optional(), allowedImpactClasses: z.array(impact).min(1), defaultImpactClass: impact, rationale: z.string() })).min(1),
  historicalAnalogs: z.array(z.object({ id: z.string(), label: z.string(), mechanismKind: mechanismSchema.shape.kind, targetId: z.string(), impactClass: impact, context: z.string(), provenance: z.enum(['VERIFIED_FACT', 'WELL_SUPPORTED_INFERENCE', 'CONTESTED_INTERPRETATION', 'SCENARIO_ABSTRACTION']), sourceRefs: z.array(z.string()) })).max(10),
  advisors: z.array(z.object({ id: z.string(), name: z.string(), expertise: z.array(z.string()), worldview: z.string(), bias: z.string(), relationship: z.number().min(0).max(100), actorId: z.string().optional() })).max(6),
  unresolvedUncertainties: z.array(z.string()).min(1).max(20),
  beliefOverrides: z.array(z.object({
    actorId: z.string(), subjectId: z.string(), field: z.string(), estimate: z.number().optional(),
    range: z.tuple([z.number(), z.number()]).optional(), categorical: z.string().optional(), confidence,
    sourceFactIds: z.array(z.string()),
  })).max(60).default([]),
});
