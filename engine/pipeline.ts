import {
  Adjudication,
  Campaign,
  CompilerFidelity,
  EffectRecommendation,
  RedTeamFinding,
  TurnAudit,
  TurnProgress,
  TurnResult,
} from './domain';
import { normalizeDistribution } from './calibration';
import { auditCompilerFidelity, checkFeasibility, classifyTurnDepth, compileStrategy } from './compiler';
import { ModelGateway } from './model';
import { adjudicationSchema } from './schemas';
import { authoritativeSnapshot } from './projections';
import { adjudicate, narrate, runRedTeam, sanitizeAdjudication, simulateActors } from './resolution';
import { commitEffects, evolvePendingProcesses, updateBeliefsFromChanges, validateWorld } from './state';
import { drawSeeded, selectWeighted } from './rng';
import { saveCampaign } from './persistence';

export interface RunTurnOptions {
  gateway?: ModelGateway;
  persist?: boolean;
  onProgress?: (progress: TurnProgress) => void;
}

const progress = (options: RunTurnOptions, stage: TurnProgress['stage'], label: string, detail?: string) =>
  options.onProgress?.({ stage, label, detail });

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
  gateway: ModelGateway,
) => {
  const result = await gateway.callJson('deep_second_opinion', [
    {
      role: 'system',
      content: 'Independently adjudicate this pivotal turn. Enforce actual capabilities, information boundaries, causal mechanisms, and calibrated impact classes. You do not receive another adjudicator’s conclusion. Return a complete concise alternative adjudication.',
    },
    {
      role: 'user',
      content: JSON.stringify({ dryStrategy: graph, feasibility, actorActions, redTeam, authoritativeState: authoritativeSnapshot(campaign.state) }),
    },
  ], adjudicationSchema, 'IndependentAdjudication');
  return result.value;
};

export const runTurn = async (campaign: Campaign, rawDirective: string, options: RunTurnOptions = {}): Promise<TurnResult> => {
  if (!rawDirective.trim()) throw new Error('A strategic directive is required.');
  if (campaign.state.gameOver) throw new Error('This campaign has concluded.');
  const startedAt = new Date().toISOString();
  const budgetBefore = options.gateway?.budget.snapshot() ?? { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const priorState = structuredClone(campaign.state);

  progress(options, 'COMPILE', 'Compiling directive', 'Removing rhetoric and extracting causal mechanisms.');
  let dryStrategy = await compileStrategy(rawDirective, campaign.state, campaign.beliefs, options.gateway);
  const compilerFidelity: CompilerFidelity = await auditCompilerFidelity(rawDirective, dryStrategy, options.gateway);
  if (!compilerFidelity.faithful && compilerFidelity.repairedGraph) dryStrategy = compilerFidelity.repairedGraph;
  const depth = classifyTurnDepth(dryStrategy, campaign.state);

  progress(options, 'FEASIBILITY', 'Checking hard constraints', 'Authority, resources, timing, logistics, and communication.');
  const feasibility = checkFeasibility(dryStrategy, campaign.state);

  progress(options, 'ACTORS', 'Simulating relevant actors', 'Each actor receives only its permitted beliefs and observations.');
  const actorActions = await simulateActors(dryStrategy, campaign.state, campaign.beliefs, depth, options.gateway);

  progress(options, 'RED_TEAM', 'Challenging the strategy', 'Auditing hidden dependencies, capabilities, and second-order effects.');
  const redTeam = await runRedTeam(dryStrategy, feasibility, actorActions, campaign.state, options.gateway);

  progress(options, 'ADJUDICATE', 'Adjudicating causal effects', 'Converting constrained judgments into bounded effect recommendations.');
  const primaryPromise = adjudicate(dryStrategy, feasibility, actorActions, redTeam, campaign.state, depth, options.gateway);
  const secondPromise = depth === 'DEEP' && options.gateway
    ? getSecondOpinion(campaign, dryStrategy, feasibility, actorActions, redTeam, options.gateway)
    : undefined;
  let adjudication = sanitizeAdjudication(await primaryPromise, campaign.state, depth);
  if (depth === 'DEEP' && options.gateway) {
    try {
      const second = sanitizeAdjudication(await secondPromise!, campaign.state, depth);
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

  progress(options, 'UNCERTAINTY', 'Resolving residual uncertainty', 'Using a seeded draw only after causal analysis.');
  const draw = drawSeeded(campaign.state.rngSeed, campaign.state.rngCursor);
  const selectedOutcome = selectWeighted(adjudication.outcomeBands, draw.value);
  const selectedEffectIds = new Set(selectedOutcome.effectIds);
  const selectedEffects: EffectRecommendation[] = adjudication.recommendedEffects.filter((effect) => selectedEffectIds.has(effect.id));
  const maturedEffects = evolvePendingProcesses(campaign.state);

  progress(options, 'COMMIT', 'Committing authoritative state', 'Applying validated effects with causal provenance.');
  const committed = commitEffects(campaign.state, [...selectedEffects, ...maturedEffects]);
  committed.state.rngCursor = draw.cursor;
  committed.state.dateLabel = `${campaign.state.manifest.startingDate} + ${committed.state.turn * 4} hours`;

  progress(options, 'VALIDATE', 'Validating committed reality', 'Checking ranges, references, resources, and state consistency.');
  const validation = [...committed.issues, ...validateWorld(committed.state)];
  const fatal = validation.filter((issue) => issue.severity === 'ERROR');
  if (fatal.length) throw new Error(`State commit rejected: ${fatal[0].message}`);
  const nextBeliefs = updateBeliefsFromChanges(campaign.beliefs, committed.changes, committed.state);

  progress(options, 'NARRATE', 'Writing the situation report', 'Narrating committed, player-visible reality without adding consequences.');
  const narrative = await narrate(priorState, committed.state, nextBeliefs, dryStrategy, selectedOutcome, committed.changes, options.gateway);
  const budgetAfter = options.gateway?.budget.snapshot() ?? budgetBefore;
  const spent = usageDelta(budgetBefore, budgetAfter);
  const audit: TurnAudit = {
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
    feasibility,
    actorActions,
    redTeam,
    adjudication,
    selectedOutcome,
    randomDraw: draw.value,
    stateChanges: committed.changes,
    validation,
    narrative,
    requestCount: spent.requests,
    estimatedCostUsd: spent.costUsd,
    priorRevision: campaign.state.revision,
    committedRevision: committed.state.revision,
  };
  const nextCampaign: Campaign = {
    state: committed.state,
    beliefs: nextBeliefs,
    audits: [...campaign.audits, audit],
  };
  if (options.persist !== false && typeof indexedDB !== 'undefined') {
    progress(options, 'PERSIST', 'Saving campaign', 'Writing structured state and audit history to IndexedDB.');
    await saveCampaign(nextCampaign);
  }
  return { campaign: nextCampaign, audit };
};
