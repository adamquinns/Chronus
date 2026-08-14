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
