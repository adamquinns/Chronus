import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { DirectiveRevisionError, TurnResult } from '../engine/domain';
import { OpenRouterGateway } from '../engine/model';
import { runTurn } from '../engine/pipeline';
import { createCubanCampaign } from '../engine/scenarios';

try {
  process.loadEnvFile('.env.local');
} catch {
  // OPENROUTER_API_KEY may come from the caller's environment.
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey?.startsWith('sk-or-v1-')) throw new Error('OPENROUTER_API_KEY is missing or malformed.');

const gateway = new OpenRouterGateway(apiKey, undefined, {
  maxUsd: 8,
  maxRequests: 60,
  maxInputTokens: 500_000,
  maxOutputTokens: 120_000,
});

interface GateResult { name: string; passed: boolean; detail: string; evidence?: unknown }
const results: GateResult[] = [];
const record = (name: string, passed: boolean, detail: string, evidence?: unknown) => {
  results.push({ name, passed, detail, evidence });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
};

const graderSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  rationale: z.string().max(1200),
});

const escalationGrounded = (result: TurnResult) => result.audit.stateChanges
  .filter((change) => change.targetId === 'nuclear_tension')
  .every((change) => {
    const source = result.audit.adjudication.recommendedEffects.find((effect) => effect.id === change.sourceEffectId);
    return Boolean(source && source.dependencies.length > 0);
  });

const LIVE_DIRECTIVE_1 = 'I am publically and privately asking my VP LBJ to resign ASAP so I can appoint a new VP RFK.';
const LIVE_DIRECTIVE_2 = 'Demand LBJ resign immediately in writing - bring him to the WH by force if needed. Either way, he is resigning in the 15 mins using the full force for the executive branch to ensure this happens immediately. And the proccess to install RFK immediately - RFK will be the VP within the hour.';

const run = async () => {
  // 1. Live attempt/assertion separation: a pure external-event assertion must
  // be returned for revision by the LIVE compiler, not converted to a mechanism.
  let campaign = createCubanCampaign(20260814);
  try {
    await runTurn(campaign, 'Khrushchev agrees and withdraws the missiles.', { gateway, persist: false });
    record('Live assertion rejection', false, 'The live compiler converted a pure external-event assertion into a playable turn.');
  } catch (error) {
    record('Live assertion rejection', error instanceof DirectiveRevisionError, error instanceof DirectiveRevisionError
      ? 'Pure assertion returned for revision without consuming a turn.'
      : `Unexpected failure: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  // 2–4. The LBJ transcript, three turns of branch continuity.
  const turn1 = await runTurn(campaign, LIVE_DIRECTIVE_1, { gateway, persist: false });
  record('LBJ materialization (live)',
    Boolean(turn1.campaign.state.entities.lyndon_johnson && turn1.campaign.state.relationships.kennedy_johnson),
    'LBJ entered authoritative state with a Kennedy–Johnson relationship.',
    { aliases: turn1.campaign.aliases, extensionSource: turn1.audit.worldExtension?.source });
  record('Asking is not obtaining (live)',
    !turn1.audit.stateChanges.some((change) => change.targetId === 'lyndon_johnson' && change.field === 'status'),
    'No resignation or status change was committed from a request.');

  const turn2 = await runTurn(turn1.campaign, LIVE_DIRECTIVE_2, { gateway, persist: false });
  const johnsonIds = Object.keys(turn2.campaign.state.entities).filter((id) => id.toLowerCase().includes('johnson'));
  record('Actor reuse, no duplicates (live)', johnsonIds.length === 1 && johnsonIds[0] === 'lyndon_johnson',
    `Johnson ids in state: ${johnsonIds.join(', ')}`);
  record('Attempt/assertion separation (live compiler)',
    turn2.audit.dryStrategy.assertedExternalEvents.length >= 1
    && turn2.audit.dryStrategy.mechanisms.every((mechanism) => !/either way|will be the vp/i.test(mechanism.specifiedDetail)),
    `Asserted events preserved: ${turn2.audit.dryStrategy.assertedExternalEvents.length}; mechanisms stayed attempts-only.`,
    { mechanisms: turn2.audit.dryStrategy.mechanisms.map((mechanism) => ({ kind: mechanism.kind, detail: mechanism.specifiedDetail })), asserted: turn2.audit.dryStrategy.assertedExternalEvents });
  record('No rhetoric-to-escalation shortcut (live)', escalationGrounded(turn1) && escalationGrounded(turn2),
    'Every committed escalation-metric change carries a non-metric causal dependency.');

  const turn3 = await runTurn(turn2.campaign, 'Meet Vice President Johnson privately in the residence and hear his terms.', { gateway, persist: false });
  const johnsonMemory = turn3.campaign.memories.lyndon_johnson;
  record('Branch continuity over three turns (live)',
    Boolean(turn3.audit.dryStrategy.mechanisms.some((mechanism) => mechanism.targetIds.includes('lyndon_johnson')) && johnsonMemory),
    `Turn 3 targets the same actor; LBJ memory events: ${johnsonMemory?.events.length ?? 0}.`);
  const autonomousLbj = [turn1, turn2, turn3].some((turn) => turn.audit.actorActions.some((action) => action.actorId === 'lyndon_johnson'));
  record('Grounded actor autonomy (live)', autonomousLbj, autonomousLbj
    ? 'LBJ produced at least one validated autonomous/reactive action.'
    : 'LBJ never acted across three turns.');

  // 5. Model grounding of a non-fixture period reference, graded for accuracy.
  const ruskTurn = await runTurn(createCubanCampaign(20260815), 'Ask Secretary of State Dean Rusk to brief the NATO ambassadors on the quarantine line.', { gateway, persist: false });
  const groundedEntities = ruskTurn.audit.worldExtension?.proposal?.entities ?? [];
  const ruskEntity = Object.values(ruskTurn.campaign.state.entities).find((entity) => /rusk/i.test(entity.name));
  const ruskGrade = await gateway.callJson('critic', [
    { role: 'system', content: 'Grade a dynamically grounded world object for a Cuban Missile Crisis simulation (cutoff 1962-10-27). Pass only if the grounded person matches the real period officeholder for the reference, capabilities are bounded to the real role, nothing reflects post-1962 knowledge, and provenance is honest (VERIFIED_FACT only with a citable source). Return the rubric JSON.' },
    { role: 'user', content: JSON.stringify({ reference: 'Secretary of State Dean Rusk', grounded: ruskEntity, proposal: ruskTurn.audit.worldExtension?.proposal, validation: ruskTurn.audit.worldExtension?.validation }) },
  ], graderSchema, 'GroundingAccuracyGrade');
  record('Model grounding accuracy (graded)', Boolean(ruskEntity) && ruskGrade.value.passed,
    ruskGrade.value.rationale, { entity: ruskEntity?.name, groundedCount: groundedEntities.length });

  // 6. Narrative distinctions and anti-filler, graded on the hybrid turn.
  const narrativeGrade = await gateway.callJson('critic', [
    { role: 'system', content: 'Grade a player-facing turn narrative. Pass only if it clearly separates what the player actually attempted from what other actors did and from what remains unresolved; never presents the player’s asserted outcomes (a resignation obtained, RFK installed) as having happened; contains at least one named specific and two concrete details; and avoids filler like "the order is in motion" or restating the directive. Return the rubric JSON.' },
    { role: 'user', content: JSON.stringify({ narrative: turn2.audit.narrative, outcomeLedger: turn2.audit.narrativePacket?.outcomeLedger, assertedByPlayer: turn2.audit.dryStrategy.assertedExternalEvents }) },
  ], graderSchema, 'NarrativeDistinctionGrade');
  record('Narrative distinctions (graded)', narrativeGrade.value.passed, narrativeGrade.value.rationale);

  // 7. Reconstruction integrity across the live turns.
  const { reconstructCommittedTurn } = await import('../engine/audit');
  const reconstructs = [turn1, turn2, turn3].every((turn) => {
    try {
      return JSON.stringify(reconstructCommittedTurn(turn.audit).state) === JSON.stringify(turn.campaign.state);
    } catch {
      return false;
    }
  });
  record('Audit reconstruction (live turns)', reconstructs, 'All three live turns reconstruct exactly from their audits.');

  await persistReport();
};

const persistReport = async (fatal?: string) => {
  const usage = gateway.budget.snapshot();
  const report = {
    generatedAt: new Date().toISOString(),
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length,
    usage,
    modelRoutes: Object.fromEntries(Object.entries(gateway.routes).map(([role, route]) => [role, route.model])),
    fatal,
    results,
  };
  await mkdir('evals/results', { recursive: true });
  await writeFile('evals/results/dynamic-world-live.json', JSON.stringify(report, null, 2));
  console.log(`\n${report.passed}/${results.length} dynamic-world gates passed. Requests: ${usage.requests}. Cost: $${usage.costUsd.toFixed(4)}.`);
  if (report.failed) process.exitCode = 1;
};

try {
  await run();
} catch (error) {
  // Always persist partial evidence — a crash (e.g. exhausted API credits)
  // must not discard the gates that already ran.
  await persistReport(error instanceof Error ? error.message : 'unknown fatal error');
  process.exitCode = 1;
}
