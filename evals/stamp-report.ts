import { readFile, writeFile } from 'node:fs/promises';

const path = process.argv[2];
if (!path) throw new Error('A report path is required.');
const report = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
report.generatedAt = new Date().toISOString();
await writeFile(path, JSON.stringify(report, null, 2));
