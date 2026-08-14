# Chronus: Divergence Engine

Chronus is a local-first counterfactual strategy simulator. A persistent causal world, autonomous actors with imperfect information, bounded AI judgment, and seeded residual uncertainty produce history that is neither scripted nor improvised directly by an LLM.

## Architecture

The state engine—not the narrative model—owns reality:

```text
player directive
→ rhetoric stripping and strategy compilation
→ compiler fidelity audit
→ hard feasibility
→ information-isolated actor responses
→ red team and precedent-aware adjudication
→ bounded effect classes
→ seeded residual uncertainty
→ validated authoritative state commit
→ player-visible narrative and causal audit
```

Campaign state, sparse beliefs, actor memory, and turn audits are stored in IndexedDB. Runtime OpenRouter access is BYOK and stored separately in the browser profile. Campaigns can be exported and restored as validated JSON packages.

The supported release scenarios are **Midnight in Havana**, beginning on Black Saturday during the Cuban Missile Crisis, and **Twilight of the Republic**, a speculative modern American constitutional crisis. Earlier coalition and military packages remain in the repository as non-release test fixtures and design guidance; their source narratives are preserved verbatim in `docs/source_material/legacy-scenarios.ts.txt`.

## Run locally

Prerequisites: Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter an OpenRouter key at runtime, or use deterministic demo mode without model calls.

## Validate

```sh
npm run lint
npm test
npm run build
```

The 63-test deterministic suite covers seeded replay, rhetoric stripping, information boundaries, authority and resource constraints, causal provenance, state validation, bounded recovery, persistence and exact reconstruction, objective continuity, narrative safety, and sustained campaign play.

## Run behavioral evals

`.env.local` is intentionally absent from Git because it contains a secret. Create it in the repository root (the same folder as `package.json`):

```sh
cd /Users/adamquinn/Documents/ChatGPT/Chronos
touch .env.local
open -e .env.local
```

Paste one line into the file, replacing the example with the current key, then save it:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-your-key
```

Then run:

```sh
npm run eval
npm run eval:multiturn
```

The eval harness enforces request, token, and dollar ceilings. It runs structural gates, a faithful retired-d20 comparison, live behavioral checks, a final aggregate gate, and a resumable 12-turn live campaign gate. Machine-readable evidence is written under `evals/results/`. Do not prefix the key with `VITE_`; that would expose it in the browser bundle.

The browser app does not read `.env.local`. Its access screen stores a runtime key only in the current browser profile; deterministic demo mode needs no key.

## Model roles

All model IDs, output limits, temperatures, and timeouts are centralized in `engine/model.ts`. The default routing uses inexpensive models for compilation and narration, independent models for criticism and actors, a frontier adjudicator, and a separately isolated deep second opinion.

## Persistence and privacy

- Saved campaigns live only in the current browser profile unless exported.
- Clearing site data deletes IndexedDB campaigns.
- OpenRouter requests receive only the state permitted for that model role.
- Raw turn audits remain available in campaign exports and IndexedDB, but are not rendered in the player interface by default.
- During local development only, set `VITE_ENABLE_DEVELOPER_AUDIT=true` to expose the spoiler-heavy developer trace. Production builds never render that control.
