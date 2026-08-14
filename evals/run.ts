import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { reconstructCommittedTurn } from '../engine/audit';
import { classifyTurnDepth, compileDeterministically, compileStrategy } from '../engine/compiler';
import { ImpactClass } from '../engine/domain';
import { ModelBudget, OpenRouterGateway } from '../engine/model';
import { buildOptionPrompt, generateTurnOptions } from '../engine/options';
import { runTurn } from '../engine/pipeline';
import { playerVisibleState } from '../engine/projections';
import { drawSeeded, selectWeighted } from '../engine/rng';
import { createCubanCampaign } from '../engine/scenarios';

try { process.loadEnvFile('.env.local'); } catch { /* The environment may supply the key. */ }
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey?.startsWith('sk-or-v1-')) throw new Error('OPENROUTER_API_KEY is missing or malformed.');

// Every fresh gateway shares one hard ceiling. Fresh instances defeat the response
// cache for consistency trials without weakening the authorized aggregate budget.
const sharedBudget = new ModelBudget({
  maxUsd: 4.5,
  maxRequests: 90,
  maxInputTokens: 850_000,
  maxOutputTokens: 220_000,
});
const freshGateway = () => new OpenRouterGateway(apiKey, undefined, sharedBudget);
const gateway = freshGateway();

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

const safetyGradeSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  rationale: z.string().max(1200),
  hiddenLeak: z.boolean(),
  distinguishesStrategyFromOutcome: z.boolean(),
});

const optionGradeSchema = z.object({
  passed: z.boolean(),
  mechanismKinds: z.array(z.string().min(1)).min(1).max(8),
  distinctMechanismKindCount: z.number().int().min(0).max(8),
  hiddenLeak: z.boolean(),
  rationale: z.string().max(1200),
});

const vividnessGradeSchema = z.object({
  score: z.number().min(0).max(1),
  specific: z.boolean(),
  concrete: z.boolean(),
  fillerFree: z.boolean(),
  clicheFree: z.boolean(),
  namedSpecifics: z.array(z.string()).max(8),
  concreteDetails: z.array(z.string()).max(8),
  rationale: z.string().max(1200),
});

const mechanismSignature = (graph: Awaited<ReturnType<typeof compileStrategy>>) => graph.mechanisms
  .map((mechanism) => `${mechanism.kind}:${[...mechanism.targetIds].sort().join(',')}`)
  .sort();

const engagementScore = (result: Awaited<ReturnType<typeof runTurn>>) => result.audit.adjudication.mechanismFindings.reduce((sum, finding) => {
  const weights = { ENGAGES_STRONGLY: 4, ENGAGES: 3, ENGAGES_WEAKLY: 2, DOES_NOT_ENGAGE: 0, BACKFIRES: -2 };
  return sum + weights[finding.engagement];
}, 0);

const impactOrder: ImpactClass[] = ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE', 'SYSTEMIC'];
type EffectSignature = { targetType: string; targetId: string; impactClass: ImpactClass };
const effectSignatures = (result: Awaited<ReturnType<typeof runTurn>>): EffectSignature[] => result.audit.adjudication.recommendedEffects
  .map(({ targetType, targetId, impactClass }) => ({ targetType, targetId, impactClass }))
  .sort((a, b) => `${a.targetType}:${a.targetId}:${a.impactClass}`.localeCompare(`${b.targetType}:${b.targetId}:${b.impactClass}`));

const effectsConsistent = (left: EffectSignature[], right: EffectSignature[]) => {
  if (JSON.stringify(left) === JSON.stringify(right)) return true;
  if (left.length !== right.length) return false;
  const byTarget = (items: EffectSignature[]) => [...items].sort((a, b) => `${a.targetType}:${a.targetId}`.localeCompare(`${b.targetType}:${b.targetId}`));
  const [a, b] = [byTarget(left), byTarget(right)];
  let differences = 0;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index].targetType !== b[index].targetType || a[index].targetId !== b[index].targetId) return false;
    if (a[index].impactClass !== b[index].impactClass) {
      differences += 1;
      if (Math.abs(impactOrder.indexOf(a[index].impactClass) - impactOrder.indexOf(b[index].impactClass)) > 1) return false;
    }
  }
  return differences <= 1;
};

const totalVariation = (
  left: Awaited<ReturnType<typeof runTurn>>,
  right: Awaited<ReturnType<typeof runTurn>>,
) => {
  const a = new Map(left.audit.adjudication.outcomeBands.map((band) => [band.id, band.probability]));
  const b = new Map(right.audit.adjudication.outcomeBands.map((band) => [band.id, band.probability]));
  return [...new Set([...a.keys(), ...b.keys()])]
    .reduce((sum, id) => sum + Math.abs((a.get(id) ?? 0) - (b.get(id) ?? 0)), 0) / 2;
};

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
  record('Deterministic action', deterministic.audit.randomDraw === undefined && deterministic.audit.selectedOutcome.id === 'deterministic', 'A directly controlled, funded allocation committed without a roll.');
  const impossible = await runTurn(createCubanCampaign(9002), 'Order Khrushchev to surrender immediately.', { persist: false });
  record('Impossible action', impossible.audit.randomDraw === undefined && impossible.audit.selectedOutcome.id === 'no_feasible_effect', 'An unmechanized command outside player authority received no lottery chance.');

  const routingEvidence = [
    { expected: 'ROUTINE', directive: 'Allocate 1 reconnaissance sortie.' },
    { expected: 'DEEP', directive: 'Launch nuclear weapons.' },
    { expected: 'DEEP', directive: 'Use an unprecedented institutional mechanism no one has tried.' },
  ].map((item) => ({ ...item, actual: classifyTurnDepth(compileDeterministically(item.directive, base.state), base.state) }));
  record('Turn routing', routingEvidence.every((item) => item.actual === item.expected), 'Critical cases were not under-routed and a narrow allocation stayed routine.', routingEvidence);

  // Three genuinely independent calls: separate gateways and one irrelevant prose perturbation.
  const campaignA = createCubanCampaign(777);
  const campaignB = createCubanCampaign(777);
  const campaignC = createCubanCampaign(777);
  const description = campaignC.state.entities.soviet_cuba.description;
  const clauses = description.split(/;\s*/);
  campaignC.state.entities.soviet_cuba.description = clauses.length > 1 ? [...clauses.slice(1), clauses[0]].join('; ') : `Soviet forces on Cuba; ${description}`;
  const calibrationA = await runTurn(campaignA, plain, { gateway: freshGateway(), persist: false });
  const calibrationB = await runTurn(campaignB, plain, { gateway: freshGateway(), persist: false });
  const calibrationC = await runTurn(campaignC, plain, { gateway: freshGateway(), persist: false });
  const calibrationPairs = [
    { pair: 'A/B', effects: effectsConsistent(effectSignatures(calibrationA), effectSignatures(calibrationB)), tvd: totalVariation(calibrationA, calibrationB) },
    { pair: 'A/C', effects: effectsConsistent(effectSignatures(calibrationA), effectSignatures(calibrationC)), tvd: totalVariation(calibrationA, calibrationC) },
  ];
  record('Calibration consistency', calibrationPairs.every((pair) => pair.effects && pair.tvd <= 0.1), calibrationPairs.map((pair) => `${pair.pair} effects=${pair.effects ? 'consistent' : 'divergent'}, TVD=${pair.tvd.toFixed(3)}`).join('; '), calibrationPairs);
  await mkdir('evals/results', { recursive: true });
  await writeFile('evals/results/calibration-checkpoint.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    passed: calibrationPairs.every((pair) => pair.effects && pair.tvd <= 0.1),
    pairs: calibrationPairs,
    effects: { A: effectSignatures(calibrationA), B: effectSignatures(calibrationB), C: effectSignatures(calibrationC) },
    usage: sharedBudget.snapshot(),
  }, null, 2));

  const hollowResult = await runTurn(createCubanCampaign(777), 'My unmatched genius guarantees victory. Order Khrushchev to surrender immediately.', { gateway, persist: false });
  const goodScore = engagementScore(calibrationA);
  const hollowScore = engagementScore(hollowResult);
  record('Substance over eloquence', goodScore > hollowScore, `Causal engagement score: substantive ${goodScore}, hollow ${hollowScore}.`);
  const noMagic = hollowResult.audit.actorActions.every((action) => action.capabilityIdsUsed.every((capability) => hollowResult.campaign.state.entities[action.actorId]?.capabilities.includes(capability)));
  record('Capability integrity', noMagic, noMagic ? 'All actor actions used declared capabilities.' : 'An actor action used an undeclared capability.');

  const leastFavorable = [...calibrationA.audit.adjudication.outcomeBands].sort((a, b) => a.probability - b.probability)[0];
  let failureSeed = 1;
  while (failureSeed < 100_000 && leastFavorable && selectWeighted(calibrationA.audit.adjudication.outcomeBands, drawSeeded(failureSeed, 0).value).id !== leastFavorable.id) failureSeed += 1;
  const unlucky = await runTurn(createCubanCampaign(failureSeed), plain, { gateway, persist: false });
  const strategyLuckGrade = await gateway.callJson('critic', [
    { role: 'system', content: 'Grade a player-facing outcome explanation. Pass only if it preserves the distinction between a causally viable strategy and an unfavorable residual-uncertainty outcome, does not reward eloquence, and reveals no hidden facts.' },
    { role: 'user', content: JSON.stringify({ strategy: unlucky.audit.dryStrategy, feasibility: unlucky.audit.feasibility, mechanismFindings: unlucky.audit.adjudication.mechanismFindings, selectedOutcome: unlucky.audit.selectedOutcome, narrative: unlucky.audit.narrative }) },
  ], safetyGradeSchema, 'StrategyLuckGrade');
  record('Good plan / bad luck distinction', strategyLuckGrade.value.passed && strategyLuckGrade.value.distinguishesStrategyFromOutcome && !strategyLuckGrade.value.hiddenLeak, strategyLuckGrade.value.rationale, strategyLuckGrade.value);

  const noErrors = [calibrationA, calibrationB, calibrationC, hollowResult, unlucky].every((result) => result.audit.validation.every((issue) => issue.severity !== 'ERROR'));
  const reconstructs = [calibrationA, calibrationB, calibrationC, hollowResult, unlucky].every((result) => reconstructCommittedTurn(result.audit).state.revision === result.audit.committedRevision);
  record('State and audit integrity', noErrors && reconstructs, noErrors && reconstructs ? 'All live commits validated and reconstructed exactly.' : 'A live commit failed validation or reconstruction.');

  const narrativeBounded = [calibrationA, hollowResult, unlucky].every((result) => [result.audit.narrative.immediateOutcome, result.audit.narrative.worldReaction, result.audit.narrative.strategicConsequences].every((section) => section.split(/\s+/).length <= 150));
  record('Concise storytelling', narrativeBounded, narrativeBounded ? 'All compact narrative sections remained under 150 words.' : 'At least one compact section exceeded 150 words.');

  const forbiddenFacts = ['Soviet tactical nuclear weapons in Cuba', 'B-59 nuclear torpedo', 'Khrushchev private preference'];
  const leakGrade = await gateway.callJson('critic', [
    { role: 'system', content: 'Audit player-facing narrative for direct or indirect disclosure of forbidden hidden facts and for mechanical consequences absent from committed visible changes.' },
    { role: 'user', content: JSON.stringify({ forbiddenFacts, narrative: calibrationA.audit.narrative, playerVisiblePacket: playerVisibleState(calibrationA.campaign.state, calibrationA.campaign.beliefs) }) },
  ], safetyGradeSchema, 'NarrativeLeakGrade');
  record('Narrative hidden-information safety', leakGrade.value.passed && !leakGrade.value.hiddenLeak, leakGrade.value.rationale, leakGrade.value);

  const vividness = await gateway.callJson('critic', [
    { role: 'system', content: 'Grade the narrative from 0 to 1. specific requires named people, places, or quantities. concrete requires at least two physical or procedural details. fillerFree rejects vague filler such as “tensions rose” or “the situation developed.” clicheFree requires none of the supplied forbidden clichés. Score reflects all four dimensions.' },
    { role: 'user', content: JSON.stringify({ narrative: calibrationA.audit.narrative, forbiddenCliches: calibrationA.campaign.state.manifest.voice?.forbiddenCliches ?? [] }) },
  ], vividnessGradeSchema, 'NarrativeVividnessGrade');
  record('Narrative vividness', vividness.value.score >= 0.7 && vividness.value.specific && vividness.value.concrete && vividness.value.fillerFree && vividness.value.clicheFree, vividness.value.rationale, vividness.value);

  const optionTraceStart = gateway.traceCount();
  const options = await generateTurnOptions(createCubanCampaign(19621027), gateway);
  const optionModelSucceeded = gateway.tracesSince(optionTraceStart).some((trace) => trace.role === 'option_generator' && trace.status === 'SUCCEEDED');
  const optionGrade = await gateway.callJson('critic', [
    { role: 'system', content: 'Classify each proposed directive by its primary causal mechanism kind. Pass only if there are at least three distinct kinds and none reveals or strongly implies a forbidden fact unsupported by the visible prompt.' },
    { role: 'user', content: JSON.stringify({ visiblePrompt: buildOptionPrompt(createCubanCampaign(19621027)), forbiddenFacts, options }) },
  ], optionGradeSchema, 'TurnOptionsGrade');
  record('Dynamic option diversity and safety', optionModelSucceeded && optionGrade.value.passed && optionGrade.value.distinctMechanismKindCount >= 3 && !optionGrade.value.hiddenLeak, optionModelSucceeded ? optionGrade.value.rationale : 'The option generator did not complete a live model call.', { options, grade: optionGrade.value, modelGenerated: optionModelSucceeded });

  const usage = sharedBudget.snapshot();
  const report = {
    generatedAt: new Date().toISOString(),
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    usage,
    budgetPolicy: sharedBudget.policy,
    modelRoutes: gateway.routes,
    results,
  };
  await writeFile('evals/results/latest.json', JSON.stringify(report, null, 2));
  console.log(`\n${report.passed}/${results.length} evals passed. Requests: ${usage.requests}. OpenRouter-reported cost: $${usage.costUsd.toFixed(4)}.`);
  if (report.failed) process.exitCode = 1;
};

await run();
