import { z } from 'zod';

const audience = z.object({
  kind: z.enum(['PUBLIC', 'PLAYER', 'PARTIES', 'NOBODY']),
  partyIds: z.array(z.string()).default([]),
});

const provenance = z.enum([
  'VERIFIED_FACT',
  'WELL_SUPPORTED_INFERENCE',
  'CONTESTED_INTERPRETATION',
  'SCENARIO_ABSTRACTION',
  'ESTABLISHED_IN_PLAY',
]);

export const interpretationSchema = z.object({
  summary: z.string().max(600),
  attempts: z.array(z.string().max(400)).max(8),
  requestedOutcomes: z.array(z.string().max(300)).max(8).default([]),
  assertedEvents: z.array(z.string().max(300)).max(8).default([]),
  prerequisites: z.array(z.object({
    statement: z.string().max(300),
    status: z.enum(['ESTABLISHED', 'ACHIEVABLE_WITHIN_DIRECTIVE', 'MISSING']),
    coveringItWouldRequire: z.string().max(300).optional(),
    coveringItWouldExceed: z.string().max(300).optional(),
  })).max(8).default([]),
  parties: z.array(z.object({
    id: z.string().max(64),
    name: z.string().max(120),
    role: z.string().max(200),
    newToPlay: z.boolean().default(false),
  })).max(10).default([]),
  stakes: z.array(z.string().max(300)).max(6).default([]),
  delegatedTo: z.array(z.string().max(64)).max(6).default([]),
});

export const outcomesSchema = z.object({
  outcomes: z.array(z.object({
    id: z.string().max(48),
    event: z.string().max(1400),
    because: z.string().max(900),
    probability: z.number().min(0).max(1),
    establishes: z.array(z.object({
      statement: z.string().max(400),
      audience,
      provenance: provenance.default('ESTABLISHED_IN_PLAY'),
    })).max(6).default([]),
    opensThreads: z.array(z.object({
      title: z.string().max(120),
      question: z.string().max(300),
      partyIds: z.array(z.string()).max(6).default([]),
      resolvedBy: z.string().max(300),
      ifIgnored: z.string().max(300),
    })).max(3).default([]),
    createsUnknowns: z.array(z.object({
      statement: z.string().max(400),
      unknownPart: z.string().max(300),
      revealedBy: z.string().max(300),
      withinTurns: z.number().int().min(1).max(12).optional(),
    })).max(3).default([]),
    commitments: z.array(z.object({
      byPartyId: z.string().max(64),
      toPartyId: z.string().max(64),
      kind: z.enum(['PROMISE', 'THREAT', 'DEBT']),
      statement: z.string().max(300),
    })).max(3).default([]),
    assumesMet: z.array(z.string().max(200)).max(6).default([]),
    assumesUnmet: z.array(z.string().max(200)).max(6).default([]),
    concludes: z.object({ outcome: z.string().max(80), summary: z.string().max(600) }).optional(),
  })).min(3).max(6),
});

export const criticSchema = z.object({
  findings: z.array(z.object({
    concern: z.enum(['RHETORIC_INFLATION', 'INTERPRETATION_CHARITY', 'MISSING_OUTCOME', 'IMPLAUSIBLE', 'OTHER']),
    claim: z.string().max(500),
    affectedOutcomeIds: z.array(z.string()).max(6).default([]),
  })).max(8).default([]),
});

export const lineUpSchema = z.object({
  partyMoves: z.array(z.object({
    partyId: z.string().max(64),
    name: z.string().max(120),
    move: z.string().max(400),
    visibleToPlayer: z.boolean().default(true),
  })).max(6).default([]),
  threadUpdates: z.array(z.object({
    threadId: z.string().max(64),
    movement: z.string().max(300),
    status: z.enum(['OPEN', 'RESOLVED', 'OVERTAKEN']),
  })).max(6).default([]),
  facingPlayer: z.array(z.string().max(300)).max(5).default([]),
});

export const readingsSchema = z.object({
  readings: z.array(z.object({
    id: z.string().max(64),
    value: z.number().min(0).max(100),
    reasoning: z.string().max(300),
  })).max(10),
});

export const narrationSchema = z.object({
  title: z.string().max(120),
  immediate: z.string().max(1400),
  worldReaction: z.string().max(1400),
  consequences: z.string().max(1400),
  detailed: z.string().max(3600),
  press: z.array(z.object({
    source: z.string().max(80),
    headline: z.string().max(200),
    body: z.string().max(600),
  })).max(3).default([]),
  advisors: z.array(z.object({
    name: z.string().max(80),
    reaction: z.string().max(700),
  })).max(4).default([]),
  chronicleEntry: z.string().max(900),
  storySoFar: z.string().max(2000),
});

export const researchSchema = z.object({
  findings: z.array(z.object({
    question: z.string().max(300),
    answer: z.string().max(700),
    sourceRefs: z.array(z.string().max(200)).max(4).default([]),
    provenance,
  })).max(8).default([]),
});
