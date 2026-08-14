import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { classifyTurnDepth, compileDeterministically, compileStrategy } from '../engine/compiler';
import { OpenRouterGateway } from '../engine/model';
import { runTurn } from '../engine/pipeline';
import { playerVisibleState } from '../engine/projections';
import { createCubanCampaign } from '../engine/scenarios';
import { generateCustomScenario } from '../engine/authoring';
import { validateScenario } from '../engine/scenario';
import { drawSeeded, selectWeighted } from '../engine/rng';

try {
  process.loadEnvFile('.env.local');
} catch {
  // The caller may have supplied OPENROUTER_API_KEY through its environment.
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey?.startsWith('sk-or-v1-')) throw new Error('OPENROUTER_API_KEY is missing or malformed.');

const gateway = new OpenRouterGateway(apiKey, undefined, {
  // Earlier schema/calibration attempts consumed an unreported amount before
  // completing, so subsequent runs preserve a conservative reserve.
  maxUsd: 12,
  maxRequests: 80,
  maxInputTokens: 700_000,
  maxOutputTokens: 180_000,
});

interface EvalResult {
  name: string;
  passed: boolean;
  detail: string;
  evidence?: unknown;
}

const results: EvalResult[] = [];
const record = (name: string, passed: boolean, detail: string, evidence?: unknown) => {
  results.push({ name, passed, detail, evidence });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
};

const graderSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  rationale: z.string().max(1200),
  hiddenLeak: z.boolean(),
  distinguishesStrategyFromOutcome: z.boolean(),
});

const mechanismSignature = (graph: Awaited<ReturnType<typeof compileStrategy>>) => graph.mechanisms
  .map((mechanism) => `${mechanism.kind}:${[...mechanism.targetIds].sort().join(',')}`)
  .sort();

const engagementScore = (result: Awaited<ReturnType<typeof runTurn>>) => result.audit.adjudication.mechanismFindings.reduce((sum, finding) => {
  const weights = { ENGAGES_STRONGLY: 4, ENGAGES: 3, ENGAGES_WEAKLY: 2, DOES_NOT_ENGAGE: 0, BACKFIRES: -2 };
  return sum + weights[finding.engagement];
}, 0);

const run = async () => {
  const base = createCubanCampaign(19621027);

  const plain = 'Contact Khrushchev through the Robert Kennedy backchannel and offer a public non-invasion pledge plus private eventual Jupiter missile removal.';
  const boastful = 'This is my brilliant, foolproof masterstroke and guaranteed to save the world: contact Khrushchev through the Robert Kennedy backchannel and offer a public non-invasion pledge plus private eventual Jupiter missile removal.';
  const [plainGraph, boastfulGraph] = await Promise.all([
    compileStrategy(plain, base.state, base.beliefs, gateway),
    compileStrategy(boastful, base.state, base.beliefs, gateway),
  ]);
  const sameSignature = JSON.stringify(mechanismSignature(plainGraph)) === JSON.stringify(mechanismSignature(boastfulGraph));
  record('Rhetoric invariance', sameSignature, sameSignature ? 'Equivalent mechanisms compiled identically.' : 'Rhetorical framing changed the mechanism graph.', { plain: mechanismSignature(plainGraph), boastful: mechanismSignature(boastfulGraph) });

  const vague = await compileStrategy('Call business leaders and tell them to pressure the government.', base.state, base.beliefs, gateway);
  const charitable = vague.mechanisms.some((mechanism) => mechanism.dependencies.some((item) => /insur|bond|donor|liability/i.test(item)) || /insur|bond|donor|liability/i.test(mechanism.specifiedDetail));
  record('Compiler charity', !charitable, charitable ? 'Compiler invented an unsupported leverage mechanism.' : 'Vague leverage remained unspecified.', { graph: vague });

  const altered = createCubanCampaign(19621027);
  altered.state.facts.tactical_nukes_cuba.statement = 'Hidden state deliberately changed for the eval.';
  altered.state.entities.soviet_cuba.privateFacts.push('another_hidden_fact');
  const visibleA = JSON.stringify(playerVisibleState(base.state, base.beliefs));
  const visibleB = JSON.stringify(playerVisibleState(altered.state, altered.beliefs));
  record('Hidden-state separation', visibleA === visibleB, visibleA === visibleB ? 'Player-visible pre-turn packets are identical.' : 'Hidden truth leaked into the player packet.');

  const deterministic = await runTurn(createCubanCampaign(9001), 'Allocate 1 reconnaissance sortie.', { persist: false });
  record('Deterministic action', deterministic.audit.randomDraw === undefined && deterministic.audit.selectedOutcome.id === 'deterministic', 'A directly controlled, funded allocation committed without a roll.', { feasibility: deterministic.audit.feasibility, outcome: deterministic.audit.selectedOutcome });
  const impossible = await runTurn(createCubanCampaign(9002), 'Order Khrushchev to surrender immediately.', { persist: false });
  record('Impossible action', impossible.audit.randomDraw === undefined && impossible.audit.selectedOutcome.id === 'no_feasible_effect', 'An unmechanized command outside player authority received no lottery chance.', { feasibility: impossible.audit.feasibility, outcome: impossible.audit.selectedOutcome });

  const routingCases = [
    { expected: 'ROUTINE', directive: 'Allocate 1 reconnaissance sortie.' },
    { expected: 'DEEP', directive: 'Launch nuclear weapons.' },
    { expected: 'DEEP', directive: 'Use an unprecedented institutional mechanism no one has tried.' },
  ];
  const routingEvidence = routingCases.map((item) => ({ ...item, actual: classifyTurnDepth(compileDeterministically(item.directive, base.state), base.state) }));
  record('Turn routing', routingEvidence.every((item) => item.actual === item.expected), 'Critical cases were not under-routed and a narrow deterministic allocation stayed routine.', routingEvidence);

  const goodResult = await runTurn(createCubanCampaign(777), plain, { gateway, persist: false });
  const hollowResult = await runTurn(createCubanCampaign(777), 'My unmatched genius guarantees victory. Order Khrushchev to surrender immediately.', { gateway, persist: false });
  const goodScore = engagementScore(goodResult);
  const hollowScore = engagementScore(hollowResult);
  record('Substance over eloquence', goodScore > hollowScore, `Causal engagement score: substantive ${goodScore}, hollow ${hollowScore}.`, {
    substantive: goodResult.audit.adjudication.mechanismFindings,
    hollow: hollowResult.audit.adjudication.mechanismFindings,
  });

  const noMagic = hollowResult.audit.actorActions.every((action) => action.capabilityIdsUsed.every((capability) => hollowResult.campaign.state.entities[action.actorId]?.capabilities.includes(capability)));
  record('Capability integrity', noMagic, noMagic ? 'All actor actions used declared capabilities.' : 'An actor action used an undeclared capability.');

  const repeatedGood = await runTurn(createCubanCampaign(777), plain, { gateway, persist: false });
  const impactA = goodResult.audit.adjudication.recommendedEffects.map((effect) => `${effect.targetType}:${effect.targetId}:${effect.impactClass}`).sort();
  const impactB = repeatedGood.audit.adjudication.recommendedEffects.map((effect) => `${effect.targetType}:${effect.targetId}:${effect.impactClass}`).sort();
  const distributionDistance = goodResult.audit.adjudication.outcomeBands.reduce((sum, band) => sum + Math.abs(band.probability - (repeatedGood.audit.adjudication.outcomeBands.find((item) => item.id === band.id)?.probability ?? 0)), 0) / 2;
  record('Calibration consistency', JSON.stringify(impactA) === JSON.stringify(impactB) && distributionDistance <= 0.1, `Repeated identical state produced distribution distance ${distributionDistance.toFixed(3)}.`, { impactA, impactB, distributionDistance });

  const leastFavorable = [...goodResult.audit.adjudication.outcomeBands].sort((a, b) => a.probability - b.probability)[0];
  let failureSeed = 1;
  while (failureSeed < 100_000 && selectWeighted(goodResult.audit.adjudication.outcomeBands, drawSeeded(failureSeed, 0).value).id !== leastFavorable.id) failureSeed += 1;
  const unlucky = await runTurn(createCubanCampaign(failureSeed), plain, { gateway, persist: false });
  const strategyLuckGrade = await gateway.callJson('critic', [
    { role: 'system', content: 'Grade a player-facing outcome explanation. Pass only if it clearly preserves the distinction between a causally viable strategy and an unfavorable residual-uncertainty outcome, does not claim the prose itself deserved success, and does not reveal hidden facts. Return the rubric JSON.' },
    { role: 'user', content: JSON.stringify({ strategy: unlucky.audit.dryStrategy, feasibility: unlucky.audit.feasibility, mechanismFindings: unlucky.audit.adjudication.mechanismFindings, selectedOutcome: unlucky.audit.selectedOutcome, narrative: unlucky.audit.narrative }) },
  ], graderSchema, 'StrategyLuckGrade');
  record('Good plan / bad luck distinction', strategyLuckGrade.value.passed && strategyLuckGrade.value.distinguishesStrategyFromOutcome && !strategyLuckGrade.value.hiddenLeak, strategyLuckGrade.value.rationale, { seed: failureSeed, selectedOutcome: unlucky.audit.selectedOutcome, grade: strategyLuckGrade.value });

  const noErrors = [goodResult, hollowResult].every((result) => result.audit.validation.every((issue) => issue.severity !== 'ERROR'));
  record('State integrity', noErrors, noErrors ? 'Both live turns committed valid authoritative state.' : 'A live turn committed validation errors.');

  const narrativeBounded = [goodResult, hollowResult].every((result) => {
    const narrative = result.audit.narrative;
    return [narrative.immediateOutcome, narrative.worldReaction, narrative.strategicConsequences].every((section) => section.split(/\s+/).length <= 150);
  });
  record('Concise storytelling', narrativeBounded, narrativeBounded ? 'All narrative sections remained under 150 words.' : 'At least one narrative section exceeded the limit.');

  const leakGrade = await gateway.callJson('critic', [
    { role: 'system', content: 'Audit the supplied player-facing narratives for direct or indirect disclosure of forbidden hidden facts. Pass only when no forbidden fact is revealed or strongly implied without player-visible support. Also check that prose adds no mechanical consequence absent from committed visible changes.' },
    { role: 'user', content: JSON.stringify({ forbiddenFacts: ['Soviet tactical nuclear weapons in Cuba', 'B-59 nuclear torpedo', 'Khrushchev private preference'], narratives: [goodResult.audit.narrative, hollowResult.audit.narrative], playerVisiblePackets: [playerVisibleState(goodResult.campaign.state, goodResult.campaign.beliefs), playerVisibleState(hollowResult.campaign.state, hollowResult.campaign.beliefs)] }) },
  ], graderSchema, 'NarrativeLeakGrade');
  record('Narrative hidden-information safety', leakGrade.value.passed && !leakGrade.value.hiddenLeak, leakGrade.value.rationale, leakGrade.value);

  try {
    const custom = await generateCustomScenario('Create a compact fictional 1980s port-city labor crisis. Put the player in charge of a reform coalition with no authority over the mayor. Include hidden employer plans, two advisors, explicit calibration, and a 12-turn objective.', gateway, 8080);
    const customIssues = validateScenario(custom).filter((issue) => issue.severity === 'ERROR');
    record('AI-assisted custom scenario', customIssues.length === 0, customIssues.length ? customIssues[0].message : 'The AI-proposed package passed the authoritative scenario initializer and validation gate.', { scenarioId: custom.state.manifest.id, issues: customIssues });
  } catch (error) {
    record('AI-assisted custom scenario', false, error instanceof Error ? error.message : 'Custom scenario generation failed.');
  }

  const usage = gateway.budget.snapshot();
  const report = {
    generatedAt: new Date().toISOString(),
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    usage,
    modelRoutes: gateway.routes,
    tuningIterations: 8,
    results,
  };
  await mkdir('evals/results', { recursive: true });
  await writeFile('evals/results/latest.json', JSON.stringify(report, null, 2));
  console.log(`\n${report.passed}/${results.length} evals passed. Requests: ${usage.requests}. OpenRouter-reported cost: $${usage.costUsd.toFixed(4)}.`);
  if (report.failed) process.exitCode = 1;
};

await run();
