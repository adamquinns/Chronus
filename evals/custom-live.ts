import { generateCustomScenario } from '../engine/authoring';
import { OpenRouterGateway } from '../engine/model';
import { validateScenario } from '../engine/scenario';
import { mkdir, writeFile } from 'node:fs/promises';

try { process.loadEnvFile('.env.local'); } catch { /* environment may supply the key */ }
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey?.startsWith('sk-or-v1-')) throw new Error('OPENROUTER_API_KEY is missing or malformed.');
const gateway = new OpenRouterGateway(apiKey, undefined, { maxUsd: 5, maxRequests: 8, maxInputTokens: 180_000, maxOutputTokens: 40_000 });
try {
  const campaign = await generateCustomScenario('Create a compact fictional 1980s port-city labor crisis. Put the player in charge of a reform coalition with no authority over the mayor. Include hidden employer plans, two advisors, explicit calibration, and a 12-turn objective.', gateway, 8080);
  const errors = validateScenario(campaign).filter((issue) => issue.severity === 'ERROR');
  const report = { generatedAt: new Date().toISOString(), passed: errors.length === 0, scenarioId: campaign.state.manifest.id, errors, usage: gateway.budget.snapshot(), traces: gateway.tracesSince(0).map(({ role, model, schemaName, status, error }) => ({ role, model, schemaName, status, error })) };
  await mkdir('evals/results', { recursive: true });
  await writeFile('evals/results/custom.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(JSON.stringify({ usage: gateway.budget.snapshot(), traces: gateway.tracesSince(0).map(({ role, model, schemaName, status, error: traceError }) => ({ role, model, schemaName, status, error: traceError })) }, null, 2));
  process.exitCode = 1;
}
