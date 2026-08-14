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

Campaign state, sparse beliefs, and turn audits are stored in IndexedDB. Runtime OpenRouter access is BYOK and stored separately in the browser profile. Campaigns can be exported as JSON.

The current golden vertical slice is **October 27, 1962—the Cuban Missile Crisis on Black Saturday**.

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

The deterministic suite covers seeded replay, rhetoric stripping, information boundaries, authority and resource constraints, causal provenance, state validation, and the complete turn pipeline.

## Run behavioral evals

Create `.env.local` in the repository root:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-your-key
```

Then run:

```sh
npm run eval
```

The eval harness enforces request, token, and dollar ceilings and writes its latest machine-readable report to `evals/results/latest.json`. Do not prefix the key with `VITE_`; that would expose it in the browser bundle.

## Model roles

All model IDs, output limits, temperatures, and timeouts are centralized in `engine/model.ts`. The default routing uses inexpensive models for compilation and narration, independent models for criticism and actors, a frontier adjudicator, and a separately isolated deep second opinion.

## Persistence and privacy

- Saved campaigns live only in the current browser profile unless exported.
- Clearing site data deletes IndexedDB campaigns.
- OpenRouter requests receive only the state permitted for that model role.
- The local owner can inspect declassified developer audits; anti-cheat against the owner is intentionally out of scope.
