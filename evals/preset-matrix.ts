import { readFile, readdir, writeFile } from 'node:fs/promises';

/**
 * Aggregates per-preset live eval reports (produced by
 * `npm run eval:live -- --preset <name>`) into a comparison table.
 * Makes no model calls itself.
 */
interface LiveReport {
  generatedAt: string;
  preset?: string;
  passed: number;
  failed: number;
  usage: { requests: number; inputTokens: number; outputTokens: number; costUsd: number };
}

const run = async () => {
  const files = (await readdir('evals/results')).filter((name) => name === 'latest.json' || /^live-.*\.json$/.test(name));
  const rows: Array<Record<string, string | number>> = [];
  for (const file of files) {
    try {
      const report = JSON.parse(await readFile(`evals/results/${file}`, 'utf8')) as LiveReport;
      const total = report.passed + report.failed;
      rows.push({
        preset: report.preset ?? (file === 'latest.json' ? 'standard (legacy report)' : file.replace(/^live-|\.json$/g, '')),
        source: file,
        generatedAt: report.generatedAt,
        passRate: total ? `${report.passed}/${total}` : 'n/a',
        requests: report.usage?.requests ?? 0,
        inputTokens: report.usage?.inputTokens ?? 0,
        costUsd: Number((report.usage?.costUsd ?? 0).toFixed(4)),
        costPerRequest: report.usage?.requests ? Number((report.usage.costUsd / report.usage.requests).toFixed(4)) : 0,
      });
    } catch {
      console.warn(`Skipping unreadable report ${file}.`);
    }
  }
  rows.sort((a, b) => String(a.preset).localeCompare(String(b.preset)));
  console.table(rows);
  await writeFile('evals/results/preset-matrix.json', JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  if (!rows.length) {
    console.log('No live reports found. Run `npm run eval:live -- --preset economy` (etc.) first.');
  }
};

await run();
