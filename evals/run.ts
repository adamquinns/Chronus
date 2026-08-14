import { mkdir, writeFile } from 'node:fs/promises';
import { compileStrategy } from '../engine/compiler';
import { OpenRouterGateway } from '../engine/model';
import { runTurn } from '../engine/pipeline';
import { playerVisibleState } from '../engine/projections';
import { createCubanCampaign } from '../engine/scenarios';

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
  maxUsd: 20,
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

  const noErrors = [goodResult, hollowResult].every((result) => result.audit.validation.every((issue) => issue.severity !== 'ERROR'));
  record('State integrity', noErrors, noErrors ? 'Both live turns committed valid authoritative state.' : 'A live turn committed validation errors.');

  const narrativeBounded = [goodResult, hollowResult].every((result) => {
    const narrative = result.audit.narrative;
    return [narrative.immediateOutcome, narrative.worldReaction, narrative.strategicConsequences].every((section) => section.split(/\s+/).length <= 150);
  });
  record('Concise storytelling', narrativeBounded, narrativeBounded ? 'All narrative sections remained under 150 words.' : 'At least one narrative section exceeded the limit.');

  const usage = gateway.budget.snapshot();
  const report = {
    generatedAt: new Date().toISOString(),
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    usage,
    modelRoutes: gateway.routes,
    results,
  };
  await mkdir('evals/results', { recursive: true });
  await writeFile('evals/results/latest.json', JSON.stringify(report, null, 2));
  console.log(`\n${report.passed}/${results.length} evals passed. Requests: ${usage.requests}. OpenRouter-reported cost: $${usage.costUsd.toFixed(4)}.`);
  if (report.failed) process.exitCode = 1;
};

await run();
