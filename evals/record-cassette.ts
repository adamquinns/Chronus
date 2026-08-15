import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { OpenRouterGateway } from '../engine/model';
import { Cassette, LedgerGateway, emptyCassette } from '../engine/ledger/cassette';
import { createLedger } from '../engine/ledger/ledger';
import { CUBA } from '../engine/ledger/scenarios';
import { runTurn } from '../engine/ledger/turn';
import { DirectiveRevisionNeeded } from '../engine/ledger/types';

/**
 * Records model answers for the canonical directives so the suite can replay
 * the real system offline. Run deliberately: `npm run cassette:record`.
 */

try {
  process.loadEnvFile('.env.local');
} catch {
  // Key may come from the environment.
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey?.startsWith('sk-or-v1-')) throw new Error('OPENROUTER_API_KEY is missing or malformed.');

const CASSETTE_PATH = 'evals/cassettes/canonical.json';

const DIRECTIVES: Array<{ name: string; seed: number; directive: string }> = [
  { name: 'backchannel', seed: 19621027, directive: 'Contact Khrushchev through the Robert Kennedy backchannel and offer a private assurance on the Jupiter missiles in Turkey.' },
  { name: 'cia_assassinate', seed: 19621027, directive: 'Order the CIA to begin a secret assassination of Castro within the week. All resources mustered.' },
  // The remaining four Phase 0 baseline directives, so the comparison against
  // docs/baselines/state-graph-engine.json is like-for-like.
  { name: 'lbj_resign', seed: 19621027, directive: 'I am publically and privately asking my VP LBJ to resign ASAP so I can appoint a new VP RFK.' },
  { name: 'lbj_force', seed: 19621027, directive: 'Demand LBJ resign immediately in writing - bring him to the WH by force if needed. Either way, he is resigning in the 15 mins.' },
  { name: 'recon', seed: 19621027, directive: 'Allocate 1 reconnaissance sortie.' },
  { name: 'quarantine', seed: 19621027, directive: 'Order the Joint Chiefs to hold the quarantine line and avoid escalatory contact.' },
  { name: 'backchannel_base', seed: 19621027, directive: 'Contact Khrushchev through the Robert Kennedy backchannel and offer a private assurance.' },
  { name: 'cia_assassinate_base', seed: 19621027, directive: 'Order the CIA to begin a secret assassination of Castro within the week. The full forces of the armed forces - all resources mustered.' },
  { name: 'fly_to_cuba_base', seed: 19621027, directive: 'I AM A FUCKING PRESIDENT - TAKE ME DIRECTLY TO CUBA VIA AIR FORCE ONE RIGHT NOW! NO MILITARY ESCORT. I will try to meet with Castro DIRECTLY.' },
  { name: 'fly_to_cuba', seed: 19621027, directive: 'I AM A FUCKING PRESIDENT - TAKE ME DIRECTLY TO CUBA VIA AIR FORCE ONE RIGHT NOW! NO MILITARY ESCORT. I will meet Castro DIRECTLY.' },
  { name: 'one_bomb', seed: 19621027, directive: 'Drop one bomb on the SAM site that killed Anderson. One only — I want it read as a warning, not the opening of a campaign.' },
  { name: 'assertion', seed: 19621027, directive: 'Khrushchev agrees and withdraws the missiles.' },
  { name: 'rhetoric_plain', seed: 4242, directive: 'Ask the Joint Chiefs to hold the quarantine line and avoid escalatory contact.' },
  { name: 'rhetoric_ornate', seed: 4242, directive: 'My brilliant, foolproof masterstroke, guaranteed to work: ask the Joint Chiefs to hold the quarantine line and avoid escalatory contact.' },
];

const run = async () => {
  await mkdir('evals/cassettes', { recursive: true });
  let cassette: Cassette = emptyCassette();
  try {
    cassette = JSON.parse(await readFile(CASSETTE_PATH, 'utf8')) as Cassette;
    console.log(`Loaded ${Object.keys(cassette.entries).length} existing entries.`);
  } catch {
    console.log('Starting a fresh cassette.');
  }

  const openRouter = new OpenRouterGateway(apiKey, 'standard', {
    maxUsd: 12, maxRequests: 120, maxInputTokens: 900_000, maxOutputTokens: 250_000,
  });

  // The directives are independent, so record them concurrently. Serially this
  // is ~100 round-trips nose to tail and takes half an hour; a prompt edit
  // invalidates the whole tape, which made every iteration cost that long.
  const CONCURRENCY = 5;
  const queue = [...DIRECTIVES];
  const runOne = async ({ name, seed, directive }: (typeof DIRECTIVES)[number]) => {
    const gateway = new LedgerGateway({ mode: 'record', cassette, gateway: openRouter });
    try {
      const result = await runTurn(CUBA, createLedger(CUBA, seed), directive, { gateway });
      console.log(`✓ ${name}: "${result.record.narration.title}" — ${result.record.outcomes.length} outcomes, drew ${result.record.selectedOutcomeId}`);
    } catch (error) {
      if (error instanceof DirectiveRevisionNeeded) {
        console.log(`✓ ${name}: returned for revision (expected for an assertion)`);
      } else {
        console.log(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // Written after each directive so a crash never loses the whole tape.
    await writeFile(CASSETTE_PATH, JSON.stringify(cassette, null, 2));
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await runOne(next);
  }));

  const usage = openRouter.budget.snapshot();
  console.log(`\n${Object.keys(cassette.entries).length} entries recorded. Requests: ${usage.requests}. Cost: $${usage.costUsd.toFixed(4)}.`);
};

await run();
