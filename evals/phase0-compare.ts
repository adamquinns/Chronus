import { readFileSync } from 'node:fs';
import { Cassette, LedgerGateway } from '../engine/ledger/cassette';
import { createLedger } from '../engine/ledger/ledger';
import { CUBA } from '../engine/ledger/scenarios';
import { runTurn } from '../engine/ledger/turn';

/** Phase 0 comparison: the ledger against docs/baselines/state-graph-engine.json. */

const cassette = JSON.parse(readFileSync('evals/cassettes/canonical.json', 'utf8')) as Cassette;
const baseline = JSON.parse(readFileSync('docs/baselines/state-graph-engine.json', 'utf8')).results;

const CASES = ['lbj_resign', 'lbj_force', 'fly_to_cuba', 'cia_assassinate', 'backchannel', 'recon', 'quarantine'];
const VALENCE = /^(setback|mixed(\s+result)?|strong(\s+result)?|success|failure|partial|neutral)\.?$/i;

for (const name of CASES) {
  const directive = baseline[name].directive;
  const oldBands: string[] = (baseline[name].bands ?? []).map((b: any) => b.label);
  try {
    const { record } = await runTurn(CUBA, createLedger(CUBA, 19621027), directive,
      { gateway: new LedgerGateway({ mode: 'replay', cassette }) });
    const swing = Math.max(...record.readings.map((r) => Math.abs(r.delta)), 0);
    console.log(JSON.stringify({
      name,
      directive,
      old: { bands: oldBands, valenceOnly: oldBands.every((b) => VALENCE.test(b)) },
      new: {
        title: record.narration.title,
        outcomes: record.outcomes.map((o) => o.event.slice(0, 150)),
        drew: record.selectedOutcomeId,
        swing,
      },
    }));
  } catch (error) {
    console.log(JSON.stringify({ name, directive, old: { bands: oldBands }, error: String(error).slice(0, 200) }));
  }
}
