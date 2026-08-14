import {
  Adjudication,
  Campaign,
  CompilerFidelity,
  EffectRecommendation,
  RedTeamFinding,
  TurnAudit,
  TurnProgress,
  TurnPreview,
  TurnResult,
  ValidationIssue,
} from './domain';
import { normalizeDistribution } from './calibration';
import { auditCompilerFidelity, checkFeasibility, classifyTurn, compileStrategy } from './compiler';
import { ModelGateway } from './model';
import { adjudicationSchema } from './schemas';
import { authoritativeSnapshot } from './projections';
import { adjudicate, fallbackAdjudication, narrate, runRedTeam, sanitizeAdjudication, simulateActors } from './resolution';
import { commitEffects, evolvePendingProcesses, updateBeliefsFromChanges, validateWorld } from './state';
import { drawSeeded, selectWeighted } from './rng';
import { autonomousWorldEffects, historicalPriorWeight, retrievePrecedents } from './precedent';
import { updateActorMemories } from './memory';
import { advanceScenarioTime } from './time';
import { buildAccessDecisionMatrix, projectChangesForViewer, visibility } from './visibility';
import { validateActorActions, validateAdjudicationProposal } from './validation';
import { snapshotHash } from './audit';

export interface RunTurnOptions {
  gateway?: ModelGateway;
  persist?: boolean;
  storage?: { save: (campaign: Campaign) => Promise<void> };
  onProgress?: (progress: TurnProgress) => void;
  onPreview?: (preview: TurnPreview) => void;
}

const progress = (
  options: RunTurnOptions,
  stage: TurnProgress['stage'],
  label: string,
  detail?: string,
  status: TurnProgress['status'] = 'STARTED',
) => options.onProgress?.({ stage, label, detail, status, at: new Date().toISOString() });

const usageDelta = (before: ReturnType<ModelGateway['budget']['snapshot']>, after: ReturnType<ModelGateway['budget']['snapshot']>) => ({
  requests: after.requests - before.requests,
  costUsd: after.costUsd - before.costUsd,
});

const reconcile = (primary: Adjudication, second: Adjudication): { adjudication: Adjudication; finding?: RedTeamFinding } => {
  const primarySevere = primary.recommendedEffects.filter((effect) => effect.impactClass === 'SEVERE' || effect.impactClass === 'SYSTEMIC').length;
  const secondSevere = second.recommendedEffects.filter((effect) => effect.impactClass === 'SEVERE' || effect.impactClass === 'SYSTEMIC').length;
  const primaryNegative = primary.recommendedEffects.filter((effect) => effect.direction === 'NEGATIVE').length;
  const secondNegative = second.recommendedEffects.filter((effect) => effect.direction === 'NEGATIVE').length;
  const disagreement = Math.abs(primarySevere - secondSevere) + Math.abs(primaryNegative - secondNegative);
  if (disagreement < 3) return { adjudication: primary };
  return {
    adjudication: {
      ...primary,
      confidence: 'LOW',
      outcomeBands: normalizeDistribution(primary.outcomeBands.map((band) => ({ ...band, probability: band.probability + 0.04 }))),
      unknowns: [...primary.unknowns, 'Independent adjudicators materially disagreed; confidence was reduced.'],
    },
    finding: {
      category: 'OTHER', severity: 'WARNING',
      claim: 'Independent causal judgments materially disagreed.',
      evidence: [primary.summary, second.summary], affectedMechanismIds: primary.mechanismFindings.map((item) => item.mechanismId),
    },
  };
};

const getSecondOpinion = async (
  campaign: Campaign,
  graph: TurnAudit['dryStrategy'],
  feasibility: TurnAudit['feasibility'],
  actorActions: TurnAudit['actorActions'],
  redTeam: TurnAudit['redTeam'],
  precedents: TurnAudit['precedents'],
  gateway: ModelGateway,
) => {
  const result = await gateway.callJson('deep_second_opinion', [
    {
      role: 'system',
      content: 'Independently adjudicate this pivotal turn. Enforce actual capabilities, information boundaries, causal mechanisms, and calibrated impact classes. You do not receive another adjudicator’s conclusion. Return a complete concise alternative adjudication.',
    },
    {
      role: 'user',
      content: JSON.stringify({ dryStrategy: graph, feasibility, actorActions, redTeam, causalPrecedents: precedents, historicalPriorWeight: historicalPriorWeight(campaign.state), authoritativeState: authoritativeSnapshot(campaign.state) }),
    },
  ], adjudicationSchema, 'IndependentAdjudication');
  return result.value;
};

const repairAdjudication = async (
  role: 'validator' | 'deep_second_opinion',
  campaign: Campaign,
  graph: TurnAudit['dryStrategy'],
  feasibility: TurnAudit['feasibility'],
  actorActions: TurnAudit['actorActions'],
  redTeam: TurnAudit['redTeam'],
  precedents: TurnAudit['precedents'],
  prior: Adjudication,
  failures: ValidationIssue[],
  gateway: ModelGateway,
) => {
  const result = await gateway.callJson(role, [
    {
      role: 'system',
      content: 'Repair an invalid causal adjudication. Preserve supported judgments, remove only invalid effects, use existing targets and mechanisms, obey feasibility and scenario calibration, and return a complete adjudication. Do not add capabilities or arbitrary deltas.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        dryStrategy: graph,
        feasibility,
        actorActions,
        redTeam,
        causalPrecedents: precedents,
        authoritativeState: authoritativeSnapshot(campaign.state),
        priorAdjudication: prior,
        validationFailures: failures,
      }),
    },
  ], adjudicationSchema, role === 'validator' ? 'RepairedAdjudication' : 'EscalatedAdjudication');
  return { ...result.value, outcomeBands: normalizeDistribution(result.value.outcomeBands) };
};

export const runTurn = async (campaign: Campaign, rawDirective: string, options: RunTurnOptions = {}): Promise<TurnResult> => {
  if (!rawDirective.trim()) throw new Error('A strategic directive is required.');
  if (campaign.state.gameOver) throw new Error('This campaign has concluded.');
  const progressEvents: TurnProgress[] = [];
  const externalProgress = options.onProgress;
  options = {
    ...options,
    onProgress: (event) => {
      progressEvents.push(event);
      externalProgress?.(event);
    },
  };
  const traceStart = options.gateway?.traceCount() ?? 0;
  const startedAt = new Date().toISOString();
  const budgetBefore = options.gateway?.budget.snapshot() ?? { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const priorState = structuredClone(campaign.state);
  const priorBeliefs = structuredClone(campaign.beliefs);

  progress(options, 'COMPILE', 'Compiling directive', 'Removing rhetoric and extracting causal mechanisms.');
  let dryStrategy = await compileStrategy(rawDirective, campaign.state, campaign.beliefs, options.gateway);
  const compilerFidelity: CompilerFidelity = await auditCompilerFidelity(rawDirective, dryStrategy, options.gateway);
  if (!compilerFidelity.faithful && compilerFidelity.repairedGraph) dryStrategy = compilerFidelity.repairedGraph;
  const routing = classifyTurn(dryStrategy, campaign.state);
  const depth = routing.depth;
  progress(options, 'COMPILE', 'Strategy interpreted', 'Rhetoric removed and causal mechanisms extracted.', 'COMPLETED');

  progress(options, 'FEASIBILITY', 'Checking hard constraints', 'Authority, resources, timing, logistics, and communication.');
  const feasibility = checkFeasibility(dryStrategy, campaign.state);
  const precedents = retrievePrecedents(campaign, dryStrategy);
  options.onPreview?.({
    strategy: dryStrategy.objective,
    advantages: feasibility
      .filter((finding) => finding.feasible)
      .map((finding) => `${finding.mechanismId}: ${finding.classification.toLowerCase().replace('_', ' ')}`)
      .slice(0, 4),
    uncertainties: [...dryStrategy.unspecified, ...dryStrategy.explicitRisks].slice(0, 6),
    stakes: [
      `Objective deadline: turn ${campaign.state.goal.deadlineTurn}.`,
      depth === 'DEEP' ? 'This turn has pivotal or existential consequences.' : `Turn depth: ${depth.toLowerCase()}.`,
    ],
    advisorAssessments: campaign.state.manifest.advisors.slice(0, 2).map((advisor) => `${advisor.name}: ${advisor.worldview}`),
    intelligenceNotes: Object.values(campaign.beliefs.player.beliefs)
      .filter((belief) => belief.confidence === 'LOW' || belief.confidence === 'VERY_LOW')
      .slice(0, 3)
      .map((belief) => `${belief.subjectId}.${belief.field} remains ${belief.confidence.toLowerCase()} confidence.`),
    strategicTradeoffs: [
      dryStrategy.mechanisms.some((mechanism) => mechanism.kind === 'DECEPTION')
        ? 'Concealment protects surprise but creates detection and coordination risk.'
        : 'Visible action may improve coordination while giving other actors time to respond.',
    ],
  });
  progress(options, 'FEASIBILITY', 'Feasibility checked', 'Authority, resources, timing, logistics, and communication checked.', 'COMPLETED');

  progress(options, 'ACTORS', depth === 'ROUTINE' ? 'Actor simulation not required' : 'Simulating relevant actors', depth === 'ROUTINE' ? 'This narrow action has no material actor response before commitment.' : 'Each actor receives only its permitted beliefs and observations.');
  progress(options, 'RED_TEAM', depth === 'ROUTINE' ? 'Routine constraint audit' : 'Challenging the strategy', depth === 'ROUTINE' ? 'Hard constraints provide sufficient adversarial checking.' : 'Auditing hidden dependencies, capabilities, and second-order effects.');
  const [actorSimulation, redTeam] = depth === 'ROUTINE'
    ? [{ actions: [], packets: [] }, await runRedTeam(dryStrategy, feasibility, [], campaign.state, precedents)]
    : await Promise.all([
      simulateActors(dryStrategy, campaign.state, campaign.beliefs, depth, options.gateway, campaign.memories),
      runRedTeam(dryStrategy, feasibility, [], campaign.state, precedents, options.gateway),
    ]);
  const actorActions = actorSimulation.actions;
  const actorValidation = validateActorActions(actorActions, campaign.state, dryStrategy);
  const invalidActorActions = actorValidation.filter((issue) => issue.severity === 'ERROR');
  if (invalidActorActions.length) throw new Error(`Actor simulation rejected: ${invalidActorActions[0].message}`);
  progress(options, 'ACTORS', 'Relevant actors modeled', 'Information-isolated actor actions are ready for adjudication.', 'COMPLETED');
  progress(options, 'RED_TEAM', 'Strategic assumptions challenged', 'Dependencies, capabilities, and second-order risks were reviewed.', 'COMPLETED');

  progress(options, 'ADJUDICATE', 'Adjudicating causal effects', 'Converting constrained judgments into bounded effect recommendations.');
  const primaryPromise = adjudicate(dryStrategy, feasibility, actorActions, redTeam, campaign.state, depth, precedents, options.gateway);
  const needsSecondOpinion = depth === 'DEEP' && Boolean(options.gateway) && (
    dryStrategy.mechanisms.some((mechanism) => mechanism.kind === 'OTHER')
    || dryStrategy.mechanisms.length >= 5
    || redTeam.some((finding) => finding.severity === 'BLOCKING')
    || campaign.state.metrics.nuclear_tension >= 95
  );
  const secondPromise = needsSecondOpinion && options.gateway
    ? getSecondOpinion(campaign, dryStrategy, feasibility, actorActions, redTeam, precedents, options.gateway)
    : undefined;
  let rawAdjudication: Adjudication;
  const recoveredValidation: ValidationIssue[] = [];
  try {
    rawAdjudication = await primaryPromise;
  } catch (error) {
    rawAdjudication = fallbackAdjudication(dryStrategy, feasibility, actorActions, campaign.state);
    recoveredValidation.push({
      code: 'PRIMARY_ADJUDICATION_FAILED',
      severity: 'WARNING',
      message: error instanceof Error ? error.message : 'Primary adjudication failed.',
    });
  }
  let proposalFailures = validateAdjudicationProposal(rawAdjudication, dryStrategy, feasibility, campaign.state, actorActions)
    .filter((issue) => issue.severity === 'ERROR');
  if ((proposalFailures.length || recoveredValidation.length) && options.gateway) {
    const originalFailures = proposalFailures.length ? proposalFailures : recoveredValidation;
    try {
      rawAdjudication = await repairAdjudication(
        'validator', campaign, dryStrategy, feasibility, actorActions, redTeam, precedents,
        rawAdjudication, originalFailures, options.gateway,
      );
      proposalFailures = validateAdjudicationProposal(rawAdjudication, dryStrategy, feasibility, campaign.state, actorActions)
        .filter((issue) => issue.severity === 'ERROR');
      recoveredValidation.push(...originalFailures.map((issue) => ({ ...issue, code: `RECOVERED_${issue.code}`, severity: 'WARNING' as const })));
    } catch (error) {
      proposalFailures = [{ code: 'ADJUDICATION_REPAIR_FAILED', severity: 'ERROR', message: error instanceof Error ? error.message : 'Adjudication repair failed.' }];
    }
    if (proposalFailures.length) {
      try {
        rawAdjudication = await repairAdjudication(
          'deep_second_opinion', campaign, dryStrategy, feasibility, actorActions, redTeam, precedents,
          rawAdjudication, proposalFailures, options.gateway,
        );
        const escalatedFailures = validateAdjudicationProposal(rawAdjudication, dryStrategy, feasibility, campaign.state, actorActions)
          .filter((issue) => issue.severity === 'ERROR');
        if (escalatedFailures.length) throw new Error(escalatedFailures[0].message);
        recoveredValidation.push(...proposalFailures.map((issue) => ({ ...issue, code: `RECOVERED_${issue.code}`, severity: 'WARNING' as const })));
        proposalFailures = [];
      } catch (error) {
        throw new Error(`Adjudication aborted after bounded recovery: ${error instanceof Error ? error.message : 'unknown validation failure'}`);
      }
    }
  }
  if (proposalFailures.length) throw new Error(`Adjudication rejected: ${proposalFailures[0].message}`);
  let adjudication = sanitizeAdjudication(rawAdjudication, campaign.state, depth, feasibility, actorActions);
  if (needsSecondOpinion && options.gateway) {
    try {
      const second = sanitizeAdjudication(await secondPromise!, campaign.state, depth, feasibility, actorActions);
      const reconciled = reconcile(adjudication, second);
      adjudication = reconciled.adjudication;
      if (reconciled.finding) redTeam.push(reconciled.finding);
    } catch (error) {
      redTeam.push({
        category: 'OTHER', severity: 'WARNING', claim: 'Independent second opinion was unavailable.',
        evidence: [error instanceof Error ? error.message : 'Unknown model failure'],
        affectedMechanismIds: dryStrategy.mechanisms.map((item) => item.id),
      });
    }
  }
  progress(options, 'ADJUDICATE', 'Causal effects adjudicated', 'Bounded effect recommendations and uncertainty bands are complete.', 'COMPLETED');

  progress(options, 'UNCERTAINTY', 'Resolving residual uncertainty', 'Using a seeded draw only after causal analysis.');
  const certainMechanismIds = new Set(feasibility
    .filter((finding) => finding.classification === 'CERTAIN')
    .map((finding) => finding.mechanismId));
  const uncertainEffects = adjudication.recommendedEffects
    .filter((effect) => !certainMechanismIds.has(effect.mechanismId));
  const hasResidualUncertainty = uncertainEffects.length > 0 && adjudication.outcomeBands.length > 0;
  const draw = hasResidualUncertainty
    ? drawSeeded(campaign.state.rngSeed, campaign.state.rngCursor)
    : undefined;
  const sampledOutcome = draw
    ? selectWeighted(adjudication.outcomeBands, draw.value)
    : undefined;
  const certainEffectIds = adjudication.recommendedEffects
    .filter((effect) => certainMechanismIds.has(effect.mechanismId))
    .map((effect) => effect.id);
  const selectedOutcome = sampledOutcome
    ? { ...sampledOutcome, effectIds: [...new Set([...sampledOutcome.effectIds, ...certainEffectIds])] }
    : {
      id: certainEffectIds.length ? 'deterministic' : 'no_feasible_effect',
      label: certainEffectIds.length ? 'Executed as ordered' : 'No feasible effect',
      probability: 1,
      effectIds: certainEffectIds,
      description: certainEffectIds.length
        ? 'Hard feasibility established a deterministic result; no uncertainty draw was used.'
        : 'No feasible player mechanism produced an authoritative effect.',
    };
  const selectedEffectIds = new Set(selectedOutcome.effectIds);
  const chosenEffects: EffectRecommendation[] = adjudication.recommendedEffects.filter((effect) => selectedEffectIds.has(effect.id));
  const delayedMechanismIds = new Set(feasibility.filter((finding) => finding.classification === 'DELAYED').map((finding) => finding.mechanismId));
  const selectedEffects = chosenEffects.filter((effect) => !delayedMechanismIds.has(effect.mechanismId));
  const scheduledEffects: EffectRecommendation[] = dryStrategy.mechanisms
    .filter((mechanism) => delayedMechanismIds.has(mechanism.id))
    .flatMap((mechanism) => {
      const effects = chosenEffects.filter((effect) => effect.mechanismId === mechanism.id);
      if (!effects.length) return [];
      const processId = `process_${campaign.state.turn + 1}_${mechanism.id}`;
      return [{
        id: `schedule_${processId}`,
        mechanismId: mechanism.id,
        targetType: 'PROCESS' as const,
        targetId: processId,
        field: 'status',
        direction: 'NEUTRAL' as const,
        impactClass: 'NONE' as const,
        confidence: 'VERY_HIGH' as const,
        engagement: 'ENGAGES' as const,
        cause: `${mechanism.objective} began as a delayed process.`,
        dependencies: mechanism.dependencies,
        setValue: {
          id: processId,
          label: mechanism.objective,
          ownerId: campaign.state.manifest.playerId,
          dueTurn: campaign.state.turn + Math.max(1, mechanism.durationTurns),
          progress: 0,
          requiredProgress: 100,
          onMature: effects,
          detectableBy: [campaign.state.manifest.playerId],
          visibility: visibility('PLAYER_KNOWN', [campaign.state.manifest.playerId]),
          completed: false,
        },
      }];
    });
  const maturedEffects = evolvePendingProcesses(campaign.state);
  const worldEffects = autonomousWorldEffects(campaign.state);
  progress(
    options,
    'UNCERTAINTY',
    hasResidualUncertainty ? 'Residual uncertainty resolved' : 'No residual uncertainty required',
    hasResidualUncertainty ? 'The seeded draw selected among the adjudicated outcome bands.' : 'Deterministic feasibility bypassed random resolution.',
    'COMPLETED',
  );

  progress(options, 'COMMIT', 'Committing authoritative state', 'Applying validated effects with causal provenance.');
  const committed = commitEffects(campaign.state, [...selectedEffects, ...scheduledEffects, ...maturedEffects, ...worldEffects]);
  committed.state.rngCursor = draw?.cursor ?? campaign.state.rngCursor;
  committed.state = advanceScenarioTime(committed.state);
  progress(options, 'COMMIT', 'History committed', 'Only engine-validated effects changed authoritative state.', 'COMPLETED');

  progress(options, 'VALIDATE', 'Validating committed reality', 'Checking ranges, references, resources, and state consistency.');
  const validation = [...actorValidation, ...recoveredValidation, ...committed.issues, ...validateWorld(committed.state)];
  const fatal = validation.filter((issue) => issue.severity === 'ERROR');
  if (fatal.length) throw new Error(`State commit rejected: ${fatal[0].message}`);
  const nextBeliefs = updateBeliefsFromChanges(campaign.beliefs, committed.changes, committed.state);
  progress(options, 'VALIDATE', 'Committed reality validated', 'Ranges, references, resources, and state consistency passed.', 'COMPLETED');

  progress(options, 'NARRATE', 'Writing the situation report', 'Narrating committed, player-visible reality without adding consequences.');
  const visibleCommittedChanges = projectChangesForViewer(
    committed.state,
    committed.state.manifest.playerId,
    committed.changes,
    dryStrategy,
  );
  const narrative = await narrate(
    priorState,
    committed.state,
    priorBeliefs,
    nextBeliefs,
    dryStrategy,
    selectedOutcome,
    visibleCommittedChanges,
    options.gateway,
  );
  progress(options, 'NARRATE', 'Situation report written', 'Narrative was generated from committed player-visible reality.', 'COMPLETED');
  const budgetAfter = options.gateway?.budget.snapshot() ?? budgetBefore;
  const spent = usageDelta(budgetBefore, budgetAfter);
  const auditId = `audit_${campaign.state.campaignId}_${committed.state.turn}`;
  const nextMemories = updateActorMemories(campaign, actorActions, committed.changes, committed.state, auditId);
  const audit: TurnAudit = {
    auditVersion: 2,
    id: `audit_${campaign.state.campaignId}_${committed.state.turn}`,
    campaignId: campaign.state.campaignId,
    turn: committed.state.turn,
    startedAt,
    completedAt: new Date().toISOString(),
    modelConfig: options.gateway ? Object.fromEntries(Object.entries(options.gateway.routes).map(([role, route]) => [role, route.model])) : { mode: 'deterministic-fallback' },
    rawDirective,
    dryStrategy,
    compilerFidelity,
    depth,
    routingReasons: routing.reasons,
    feasibility,
    actorActions,
    redTeam,
    precedents,
    adjudication,
    selectedOutcome,
    randomDraw: draw?.value,
    rngSeed: campaign.state.rngSeed,
    rngCursorBefore: campaign.state.rngCursor,
    rngCursorAfter: committed.state.rngCursor,
    stateChanges: committed.changes,
    validation,
    narrative,
    requestCount: spent.requests,
    estimatedCostUsd: spent.costUsd,
    priorRevision: campaign.state.revision,
    committedRevision: committed.state.revision,
    previousStateHash: snapshotHash(priorState),
    committedStateHash: snapshotHash(committed.state),
    previousStateSnapshot: priorState,
    committedStateSnapshot: structuredClone(committed.state),
    previousBeliefSnapshot: priorBeliefs,
    committedBeliefSnapshot: structuredClone(nextBeliefs),
    previousMemorySnapshot: structuredClone(campaign.memories),
    committedMemorySnapshot: structuredClone(nextMemories),
    modelCalls: options.gateway?.tracesSince(traceStart) ?? [],
    progressEvents,
    actorSimulationPackets: actorSimulation.packets,
    accessDecisions: buildAccessDecisionMatrix(committed.state),
  };
  const nextCampaign: Campaign = {
    state: committed.state,
    beliefs: nextBeliefs,
    memories: nextMemories,
    audits: [...campaign.audits, audit],
  };
  if (options.persist !== false && options.storage) {
    progress(options, 'PERSIST', 'Saving campaign', 'Writing structured state and audit history to IndexedDB.');
    await options.storage.save(nextCampaign);
    progress(options, 'PERSIST', 'Campaign saved', 'Structured state and audit history were written to IndexedDB.', 'COMPLETED');
  }
  return { campaign: nextCampaign, audit };
};
