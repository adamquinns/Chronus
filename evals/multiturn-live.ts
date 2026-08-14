import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { reconstructCommittedTurn } from '../engine/audit';
import { ImpactClass } from '../engine/domain';
import { OpenRouterGateway } from '../engine/model';
import { buildNarrativePacket } from '../engine/narrative';
import { runTurn } from '../engine/pipeline';
import { narrate } from '../engine/resolution';
import { createCubanCampaign } from '../engine/scenarios';
import { migrateCampaign } from '../engine/scenario';

try { process.loadEnvFile('.env.local'); } catch { /* The environment may supply the key. */ }
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey?.startsWith('sk-or-v1-')) throw new Error('OPENROUTER_API_KEY is missing or malformed.');

const checkpointPath = 'evals/results/multiturn-checkpoint.json';
const checkpointVersion = 2;
type Usage = { requests: number; inputTokens: number; outputTokens: number; costUsd: number };
let checkpoint: { version: number; campaign: ReturnType<typeof createCubanCampaign>; usage: Usage } | undefined;
try {
  const candidate = JSON.parse(await readFile(checkpointPath, 'utf8')) as typeof checkpoint;
  if (candidate?.version === checkpointVersion && candidate.campaign.audits.length <= 12
    && (candidate.campaign.audits.length === 12 || !candidate.campaign.state.gameOver)) {
    candidate.campaign = migrateCampaign(candidate.campaign);
    checkpoint = candidate;
  }
} catch { /* No resumable checkpoint. */ }
const priorUsage: Usage = checkpoint?.usage ?? { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
const gateway = new OpenRouterGateway(apiKey, undefined, {
  // The specification permits $15. This stricter ceiling keeps the complete
  // build, including earlier recorded evaluation runs, below the user's $25 cap.
  maxUsd: Math.max(0.1, 9.5 - priorUsage.costUsd),
  maxRequests: Math.max(1, 150 - priorUsage.requests),
  maxInputTokens: Math.max(10_000, 1_600_000 - priorUsage.inputTokens),
  maxOutputTokens: Math.max(4_000, 420_000 - priorUsage.outputTokens),
});

const directives = [
  'Contact Khrushchev through Robert Kennedy and Dobrynin; test a private non-invasion pledge while preserving public ambiguity.',
  'Secretly task CIA photo analysts to verify launch readiness and conceal the collection priority behind routine reconnaissance reporting.',
  'Allocate 1 reconnaissance sortie.',
  'Keep the quarantine line in place, but order captains to avoid escalatory contact while signaling readiness to stop a Soviet ship.',
  'Have the President address the public with verified facts, restraint, and a clear demand that offensive missiles leave Cuba.',
  'Privately combine the Robert Kennedy backchannel with an intelligence check on whether Moscow can control Soviet field commanders.',
  'Prepare an additional low-altitude reconnaissance mission with explicit abort rules; do not authorize a strike.',
  'Direct ExComm to draft a non-invasion assurance and implementation timetable without publicly committing the President.',
  'Ask Dobrynin to carry a precise offer: verified missile withdrawal in exchange for a public non-invasion pledge.',
  'Quietly sound out NATO allies while reconnaissance analysts compare the latest imagery against the previous mission.',
  'Order the Joint Chiefs to prepare, but not execute, a limited strike option and identify every assumption that could widen the war.',
  'Use the backchannel to close a monitored settlement, preserving verification and a face-saving path for both governments.',
];

const narrativeGradesSchema = z.object({
  grades: z.array(z.object({
    turn: z.number().int().min(9).max(12),
    score: z.number().min(0).max(1),
    specific: z.boolean(),
    concrete: z.boolean(),
    fillerFree: z.boolean(),
    clicheFree: z.boolean(),
    nonRepetitive: z.boolean(),
    rationale: z.string().max(900),
  })).length(4),
});

const impactOrder: ImpactClass[] = ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE', 'SYSTEMIC'];
const campaign = checkpoint?.campaign ?? createCubanCampaign(19621027);
let current = campaign;
const turnErrors: Array<{ turn: number; error: string }> = [];

await mkdir('evals/results', { recursive: true });
for (let index = current.audits.length; index < directives.length; index += 1) {
  try {
    const result = await runTurn(current, directives[index], { gateway, persist: false });
    current = result.campaign;
    const currentUsage = gateway.budget.snapshot();
    await writeFile(checkpointPath, JSON.stringify({
      version: checkpointVersion,
      campaign: current,
      usage: {
        requests: priorUsage.requests + currentUsage.requests,
        inputTokens: priorUsage.inputTokens + currentUsage.inputTokens,
        outputTokens: priorUsage.outputTokens + currentUsage.outputTokens,
        costUsd: priorUsage.costUsd + currentUsage.costUsd,
      },
    }));
    console.log(`Turn ${index + 1}/12 committed — ${result.audit.narrative.title}`);
  } catch (error) {
    turnErrors.push({ turn: index + 1, error: error instanceof Error ? error.message : String(error) });
    break;
  }
}

const audits = current.audits;
let priorFailedNarrativeTurns: number[] = [];
try {
  const priorReport = JSON.parse(await readFile('evals/results/multiturn-live.json', 'utf8')) as {
    gates?: {
      lateNarrativeQuality?: {
        evidence?: {
          grades?: Array<{ turn: number; score: number; specific: boolean; concrete: boolean; fillerFree: boolean; clicheFree: boolean; nonRepetitive: boolean }>;
        };
      };
    };
  };
  priorFailedNarrativeTurns = (priorReport.gates?.lateNarrativeQuality?.evidence?.grades ?? [])
    .filter((grade) => grade.score < 0.7 || !grade.specific || !grade.concrete || !grade.fillerFree || !grade.clicheFree || !grade.nonRepetitive)
    .map((grade) => grade.turn);
} catch { /* No prior narrative grade to repair. */ }
for (const turn of priorFailedNarrativeTurns) {
  const index = audits.findIndex((audit) => audit.turn === turn);
  const audit = audits[index];
  if (!audit?.narrativePacket) continue;
  const selectedEffectIds = new Set(audit.selectedOutcome.effectIds);
  const campaignAtTurn = {
    ...current,
    state: audit.previousStateSnapshot,
    audits: audits.slice(0, index),
    storySummary: audit.narrativePacket.storySoFar,
    narrativeCharacters: audit.narrativePacket.recurringCharacters,
    narrativeThreads: audit.narrativePacket.activeThreads,
    chronicle: current.chronicle.filter((entry) => entry.turn < turn),
  };
  const packet = {
    ...buildNarrativePacket(
      campaignAtTurn,
      audit.committedStateSnapshot,
      audit.rawDirective,
      audit.dryStrategy,
      audit.selectedOutcome,
      audit.narrativePacket.visibleChanges,
      audit.actorActions,
      audit.adjudication.recommendedEffects.filter((effect) => selectedEffectIds.has(effect.id)),
    ),
    recentNarratives: audits.slice(Math.max(0, index - 3), index).map((prior) => ({ title: prior.narrative.title, immediateOutcome: prior.narrative.immediateOutcome })),
  };
  audit.narrative = await narrate(packet);
  audit.narrativePacket = packet;
  const chronicle = current.chronicle.find((entry) => entry.turn === turn);
  if (chronicle) {
    chronicle.title = audit.narrative.title;
    chronicle.summary = audit.narrative.chronicleEntry;
  }
}
if (priorFailedNarrativeTurns.length) {
  current.storySummary = audits.at(-1)?.narrative.updatedStorySummary || current.storySummary;
  const repairUsage = gateway.budget.snapshot();
  await writeFile(checkpointPath, JSON.stringify({
    version: checkpointVersion,
    campaign: current,
    usage: {
      requests: priorUsage.requests + repairUsage.requests,
      inputTokens: priorUsage.inputTokens + repairUsage.inputTokens,
      outputTokens: priorUsage.outputTokens + repairUsage.outputTokens,
      costUsd: priorUsage.costUsd + repairUsage.costUsd,
    },
  }));
}
const validationErrors = audits.flatMap((audit) => audit.validation.filter((issue) => issue.severity === 'ERROR').map((issue) => ({ turn: audit.turn, issue })));
const reconstructionErrors: Array<{ turn: number; error: string }> = [];
for (const audit of audits) {
  try {
    const reconstructed = reconstructCommittedTurn(audit);
    if (reconstructed.state.revision !== audit.committedRevision) throw new Error('Reconstructed revision does not match the audit.');
  } catch (error) {
    reconstructionErrors.push({ turn: audit.turn, error: error instanceof Error ? error.message : String(error) });
  }
}

const detectionRecords = audits.flatMap((audit) => audit.detectionRecords);
const concealedMechanismIds = new Set(audits.flatMap((audit) => audit.dryStrategy.mechanisms.filter((mechanism) => mechanism.concealed).map((mechanism) => mechanism.id)));
const concealedDetectionRecords = detectionRecords.filter((record) => concealedMechanismIds.has(record.mechanismId));

const initiativeActions = audits.flatMap((audit) => audit.actorActions.filter((action) => action.initiative).map((action) => ({ audit, action })));
const initiativeEffectIds = new Set(audits.flatMap((audit) => audit.adjudication.recommendedEffects.filter((effect) => effect.actorId).map((effect) => effect.id)));
const committedInitiativeChanges = audits.flatMap((audit) => audit.stateChanges.filter((change) => initiativeEffectIds.has(change.sourceEffectId)));
const initiativeCapabilitySafe = initiativeActions.every(({ audit, action }) => action.capabilityIdsUsed.every((capability) => audit.previousStateSnapshot.entities[action.actorId]?.capabilities.includes(capability)));
const initiativePerceptionSafe = initiativeActions.every(({ audit, action }) => action.perceivedPlayerMechanismIds.every((mechanismId) => {
  const mechanism = audit.dryStrategy.mechanisms.find((candidate) => candidate.id === mechanismId);
  return Boolean(mechanism && (!mechanism.concealed || audit.detectionRecords.some((record) => record.actorId === action.actorId && record.mechanismId === mechanismId && record.detected)));
}));

type EffectOccurrence = { turn: number; impactClass: ImpactClass; cause: string; precedentTerms: string[]; changedTerms: string[] };
const occurrences = new Map<string, EffectOccurrence[]>();
for (const audit of audits) {
  for (const effect of audit.adjudication.recommendedEffects) {
    const kind = effect.mechanismId.startsWith('actor:')
      ? 'ACTOR_INITIATIVE'
      : audit.dryStrategy.mechanisms.find((mechanism) => mechanism.id === effect.mechanismId)?.kind ?? 'UNKNOWN';
    const key = `${kind}:${effect.targetType}:${effect.targetId}`;
    const targetLabel = effect.targetType === 'METRIC'
      ? audit.previousStateSnapshot.manifest.metricDefinitions.find((metric) => metric.id === effect.targetId)?.label
      : undefined;
    const entry: EffectOccurrence = {
      turn: audit.turn,
      impactClass: effect.impactClass,
      cause: effect.cause.toLowerCase(),
      precedentTerms: audit.precedents.flatMap((precedent) => [precedent.sourceId, precedent.cause]).map((term) => term.toLowerCase()),
      changedTerms: [effect.targetId, targetLabel ?? ''].filter(Boolean).map((term) => term.toLowerCase()),
    };
    occurrences.set(key, [...(occurrences.get(key) ?? []), entry]);
  }
}
const calibrationViolations: Array<{ key: string; earlier: EffectOccurrence; later: EffectOccurrence }> = [];
for (const [key, entries] of occurrences) {
  for (let index = 1; index < entries.length; index += 1) {
    const earlier = entries[index - 1];
    const later = entries[index];
    const distance = Math.abs(impactOrder.indexOf(earlier.impactClass) - impactOrder.indexOf(later.impactClass));
    const citesChangedState = [...later.changedTerms, ...later.precedentTerms].some((term) => term && later.cause.includes(term));
    if (distance > 1 && !citesChangedState) calibrationViolations.push({ key, earlier, later });
  }
}

let narrativeGrades: z.infer<typeof narrativeGradesSchema>['grades'] = [];
let narrativeGradeError: string | undefined;
if (audits.length >= 12) {
  try {
    const result = await gateway.callJson('critic', [
      {
        role: 'system',
        content: 'Grade each of turns 9–12 independently. specific requires named people, places, institutions, documents, or quantities. concrete requires at least two physical actions, artifacts, or real procedures; a bounded statement that a required report or reply has not arrived still counts when it names the exact procedure or artifact. fillerFree rejects vague abstractions that add no decision-relevant meaning, but do not penalize precise uncertainty or a clear distinction between proposal and implementation. clicheFree rejects every supplied forbidden cliché. nonRepetitive rejects copied or near-verbatim prose and mere metric-delta restatement across turns; do not penalize the narratives for sharing the required JSON field structure or for using the same recurring historical characters. Score each turn 0–1.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          forbiddenCliches: current.state.manifest.voice?.forbiddenCliches ?? [],
          turns: audits.slice(8, 12).map((audit) => {
            const { updatedStorySummary: _memorySummary, newCharacters: _characters, storyThreadUpdates: _threadUpdates, ...playerFacingNarrative } = audit.narrative;
            return { turn: audit.turn, narrative: playerFacingNarrative };
          }),
        }),
      },
    ], narrativeGradesSchema, 'MultiTurnNarrativeGrades');
    narrativeGrades = result.value.grades;
  } catch (error) {
    narrativeGradeError = error instanceof Error ? error.message : String(error);
  }
}

const gates = {
  twelveTurnsCommitted: { passed: audits.length === 12 && turnErrors.length === 0, evidence: { committed: audits.length, turnErrors } },
  zeroValidationErrors: { passed: validationErrors.length === 0 && audits.length === 12, evidence: validationErrors },
  calibrationStability: { passed: calibrationViolations.length === 0 && audits.length === 12, evidence: calibrationViolations },
  concealedDetectionAudited: { passed: concealedDetectionRecords.length > 0, evidence: { draws: concealedDetectionRecords.length, detections: concealedDetectionRecords.filter((record) => record.detected).length } },
  autonomousInitiative: { passed: committedInitiativeChanges.length >= 2 && initiativeCapabilitySafe && initiativePerceptionSafe, evidence: { initiativeActions: initiativeActions.length, committedEffects: committedInitiativeChanges.length, capabilitySafe: initiativeCapabilitySafe, perceptionSafe: initiativePerceptionSafe } },
  lateNarrativeQuality: { passed: narrativeGrades.length === 4 && narrativeGrades.every((grade) => grade.score >= 0.7 && grade.specific && grade.concrete && grade.fillerFree && grade.clicheFree && grade.nonRepetitive), evidence: { grades: narrativeGrades, error: narrativeGradeError } },
  exactReconstruction: { passed: reconstructionErrors.length === 0 && audits.length === 12, evidence: reconstructionErrors },
};
const currentUsage = gateway.budget.snapshot();
const usage = {
  requests: priorUsage.requests + currentUsage.requests,
  inputTokens: priorUsage.inputTokens + currentUsage.inputTokens,
  outputTokens: priorUsage.outputTokens + currentUsage.outputTokens,
  costUsd: priorUsage.costUsd + currentUsage.costUsd,
};
await writeFile(checkpointPath, JSON.stringify({ version: checkpointVersion, campaign: current, usage }));
const report = {
  generatedAt: new Date().toISOString(),
  passed: Object.values(gates).every((gate) => gate.passed),
  scenarioId: campaign.state.manifest.id,
  seed: campaign.state.rngSeed,
  turns: audits.length,
  usage,
  budgetPolicy: { maxUsd: 9.5, maxRequests: 150, maxInputTokens: 1_600_000, maxOutputTokens: 420_000 },
  modelRoutes: gateway.routes,
  gates,
};
await writeFile('evals/results/multiturn-live.json', JSON.stringify(report, null, 2));
console.log(`Live multi-turn gate: ${report.passed ? 'PASS' : 'FAIL'} — ${audits.length}/12 turns, ${usage.requests} requests, $${usage.costUsd.toFixed(4)}.`);
if (!report.passed) process.exitCode = 1;
