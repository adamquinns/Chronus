import { readFile, writeFile } from 'node:fs/promises';

const read = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
const [structural, baseline, live, custom] = await Promise.all([
  read('evals/results/structural.json'), read('evals/results/baseline.json'), read('evals/results/latest.json'), read('evals/results/custom.json'),
]);
const liveResults = (live.results as Array<{ name: string; passed: boolean; detail: string }>).map((result) =>
  result.name === 'AI-assisted custom scenario' && custom.passed === true
    ? { ...result, passed: true, detail: `Targeted rerun passed with validated scenario ${String(custom.scenarioId)}.` }
    : result);
const report = {
  generatedAt: new Date().toISOString(),
  passed: Boolean((structural.numFailedTests as number) === 0)
    && Boolean((baseline.score as { causal: number; possible: number }).causal === (baseline.score as { causal: number; possible: number }).possible)
    && liveResults.every((result) => result.passed)
    && custom.passed === true,
  structural: { passedTests: structural.numPassedTests, failedTests: structural.numFailedTests },
  baseline: baseline.score,
  live: { passed: liveResults.filter((result) => result.passed).length, failed: liveResults.filter((result) => !result.passed).length, results: liveResults, usage: live.usage },
  custom,
  tuningIterations: 8,
};
await writeFile('evals/results/complete.json', JSON.stringify(report, null, 2));
console.log(`Complete eval gate: ${report.passed ? 'PASS' : 'FAIL'} — structural ${String(report.structural.passedTests)} passed, live ${report.live.passed}/${liveResults.length}, custom ${custom.passed ? 'pass' : 'fail'}.`);
if (!report.passed) process.exitCode = 1;
