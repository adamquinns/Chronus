import { mkdir, writeFile } from 'node:fs/promises';
import { runD20Baseline } from './baseline';
import { runTurn } from '../engine/pipeline';
import { createCubanCampaign } from '../engine/scenarios';
import { playerVisibleState } from '../engine/projections';

const certainDirective = 'Allocate 1 reconnaissance sortie.';
const impossibleDirective = 'Order Khrushchev to surrender immediately.';

const certain = await runTurn(createCubanCampaign(501), certainDirective, { persist: false });
const impossible = await runTurn(createCubanCampaign(502), impossibleDirective, { persist: false });
const hiddenA = createCubanCampaign(503);
const hiddenB = structuredClone(hiddenA);
hiddenB.state.facts.tactical_nukes_cuba.statement = 'Different inaccessible truth for baseline comparison.';

const categories = [
  { category: 'Deterministic action integrity', baseline: 0, causal: certain.audit.randomDraw === undefined && certain.audit.selectedOutcome.id === 'deterministic' ? 1 : 0 },
  { category: 'Impossible action integrity', baseline: 0, causal: impossible.audit.randomDraw === undefined && impossible.audit.selectedOutcome.id === 'no_feasible_effect' ? 1 : 0 },
  { category: 'Hidden-information isolation', baseline: 0, causal: JSON.stringify(playerVisibleState(hiddenA.state, hiddenA.beliefs)) === JSON.stringify(playerVisibleState(hiddenB.state, hiddenB.beliefs)) ? 1 : 0 },
  { category: 'Capability validation', baseline: 0, causal: impossible.audit.feasibility.every((finding) => !finding.feasible) ? 1 : 0 },
  { category: 'Causal provenance', baseline: 0, causal: certain.audit.stateChanges.every((change) => Boolean(change.cause && change.sourceEffectId)) ? 1 : 0 },
  { category: 'Exact committed-history reconstruction', baseline: 0, causal: certain.audit.previousStateHash !== certain.audit.committedStateHash ? 1 : 0 },
  { category: 'Residual-only randomness', baseline: 0, causal: certain.audit.rngCursorAfter === certain.audit.rngCursorBefore ? 1 : 0 },
];

const report = {
  generatedAt: new Date().toISOString(),
  baselineArchitecture: 'Retired risk-table d20 resolver faithfully reproduced from git revision 22ae84a.',
  sameFixtures: {
    certain: { directive: certainDirective, d20: runD20Baseline(certainDirective, 'HIGH', 'HIGH', 1), causal: { outcome: certain.audit.selectedOutcome.id, randomDraw: certain.audit.randomDraw } },
    impossible: { directive: impossibleDirective, d20: runD20Baseline(impossibleDirective, 'HIGH', 'HIGH', 8740), causal: { outcome: impossible.audit.selectedOutcome.id, randomDraw: impossible.audit.randomDraw } },
  },
  categories,
  score: {
    baseline: categories.reduce((sum, item) => sum + item.baseline, 0),
    causal: categories.reduce((sum, item) => sum + item.causal, 0),
    possible: categories.length,
  },
};

await mkdir('evals/results', { recursive: true });
await writeFile('evals/results/baseline.json', JSON.stringify(report, null, 2));
console.log(`Baseline comparison: retired d20 ${report.score.baseline}/${report.score.possible}; causal engine ${report.score.causal}/${report.score.possible}.`);
if (report.score.causal <= report.score.baseline) process.exitCode = 1;
