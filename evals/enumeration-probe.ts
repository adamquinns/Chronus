import { LedgerGateway } from '../engine/ledger/cassette';
import { OpenRouterGateway, MODEL_PRESETS } from '../engine/model';
import { createLedger } from '../engine/ledger/ledger';
import { CUBA } from '../engine/ledger/scenarios';
import { interpret, enumerate } from '../engine/ledger/stages';
import { strip } from '../engine/ledger/stages';

process.loadEnvFile('.env.local');
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error('OPENROUTER_API_KEY not set');
const model = new OpenRouterGateway(key, MODEL_PRESETS.standard, { maxUsd: 1, maxRequests: 6, maxInputTokens: 120_000, maxOutputTokens: 40_000 });
const gateway = new LedgerGateway({ mode: 'live', gateway: model });

const DIRECTIVE = process.argv[2] ?? 'Order the armed forces to bomb the presidential palace in Havana as soon as possible. The Joint Chiefs are to work out the operational details.';
const ledger = createLedger(CUBA, 19621027);
const stripped = strip(DIRECTIVE);
const interpretation = await interpret(gateway, CUBA, ledger, stripped, []);
const outcomes = await enumerate(gateway, CUBA, ledger, interpretation, []);

const total = outcomes.reduce((sum, o) => sum + o.probability, 0);
for (const o of outcomes) {
  console.log(`\n[${(o.probability / total * 100).toFixed(0)}%] ${o.id}`);
  console.log('  ' + o.event.slice(0, 320));
  if (o.concludes) console.log('  >>> CONCLUDES: ' + o.concludes.outcome);
}
console.log('\ndone');
