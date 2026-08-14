import { readFile, writeFile } from 'node:fs/promises';

type JsonReport = Record<string, unknown> & { generatedAt?: string };
const read = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as JsonReport;
const sources = {
  structural: 'evals/results/structural.json',
  baseline: 'evals/results/baseline.json',
  live: 'evals/results/latest.json',
} as const;
const [structural, baseline, live] = await Promise.all([
  read(sources.structural), read(sources.baseline), read(sources.live),
]);
const liveResults = live.results as Array<{ name: string; passed: boolean; detail: string }>;
const provenance = Object.fromEntries(Object.entries(sources).map(([section, sourceFile]) => {
  const report = { structural, baseline, live }[section as keyof typeof sources];
  const rerun = section !== 'live' && Boolean(report.generatedAt && live.generatedAt
    && new Date(report.generatedAt).getTime() > new Date(live.generatedAt).getTime());
  return [section, { sourceFile, generatedAt: report.generatedAt, rerun }];
}));
const baselineScore = baseline.score as { causal: number; possible: number };
const report = {
  generatedAt: new Date().toISOString(),
  passed: Number(structural.numFailedTests) === 0
    && baselineScore.causal === baselineScore.possible
    && liveResults.every((result) => result.passed),
  provenance,
  structural: { passedTests: structural.numPassedTests, failedTests: structural.numFailedTests },
  baseline: baseline.score,
  live: {
    passed: liveResults.filter((result) => result.passed).length,
    failed: liveResults.filter((result) => !result.passed).length,
    results: liveResults,
    usage: live.usage,
    budgetPolicy: live.budgetPolicy,
  },
};
await writeFile('evals/results/complete.json', JSON.stringify(report, null, 2));
console.log(`Complete eval gate: ${report.passed ? 'PASS' : 'FAIL'} — structural ${String(report.structural.passedTests)} passed, live ${report.live.passed}/${liveResults.length}.`);
if (!report.passed) process.exitCode = 1;
