import {
  BeliefState,
  CompilerFidelity,
  FeasibilityFinding,
  StrategyGraph,
  StrategyMechanism,
  TurnDepth,
  WorldState,
} from './domain';
import { ModelGateway } from './model';
import { fidelitySchema, strategyGraphSchema } from './schemas';
import { playerVisibleState } from './projections';

export const deRhetoricize = (directive: string) => directive
  .replace(/\b(?:brilliant|genius|masterful|masterstroke|perfect|foolproof|obviously|certainly|guaranteed|unbeatable)\b/gi, '')
  .replace(/\bI\s+(?:know|am certain|guarantee|assure you)\b[^,.;:]*/gi, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const clauses = (directive: string) => deRhetoricize(directive)
  .split(/(?:\.|;|\bthen\b|\band\s+then\b)/i)
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, 10);

const inferKind = (text: string): StrategyMechanism['kind'] => {
  if (/transfer|allocate|fund|budget|move \$|send .* supplies/i.test(text)) return 'RESOURCE_TRANSFER';
  if (/negotiate|offer|backchannel|diplom|contact|call|letter|signal .*proposal/i.test(text)) return 'DIPLOMACY';
  if (/strike|bomb|invade|deploy|attack|blockade|move .*fleet|send .*troops/i.test(text)) return 'MILITARY_OPERATION';
  if (/secret|quiet|conceal|mislead|deceiv|feint/i.test(text)) return 'DECEPTION';
  if (/intelligence|recon|surveil|investigat|spy|verify/i.test(text)) return 'INTELLIGENCE';
  if (/court|legal|injunction|lawsuit|treaty/i.test(text)) return 'LEGAL_ACTION';
  if (/speech|announce|public|broadcast|press/i.test(text)) return 'PUBLIC_COMMUNICATION';
  if (/coalition|allies|governor|organize|recruit/i.test(text)) return 'COALITION_BUILDING';
  if (/sanction|economic|business|insurance|trade|financial/i.test(text)) return 'ECONOMIC_PRESSURE';
  if (/threat|ultimatum|coerce|pressure/i.test(text)) return 'COERCION';
  if (/order|direct|authorize|instruct/i.test(text)) return 'DIRECT_ORDER';
  return 'OTHER';
};

const referencedIds = (text: string, state: WorldState) => Object.values(state.entities)
  .filter((entity) => text.toLowerCase().includes(entity.name.toLowerCase().split(' ').at(-1)!) || text.toLowerCase().includes(entity.id.replaceAll('_', ' ')))
  .map((entity) => entity.id);

export const compileDeterministically = (directive: string, state: WorldState): StrategyGraph => {
  const parts = clauses(directive);
  const mechanisms = parts.map((part, index): StrategyMechanism => ({
    id: `m${index + 1}`,
    kind: inferKind(part),
    objective: part,
    targetIds: referencedIds(part, state),
    actorIds: [state.manifest.playerId],
    dependencies: [],
    assumptions: [],
    sequence: index,
    durationTurns: /prepare|build|recruit|develop|long.term/i.test(part) ? 2 : 1,
    resourceClaims: [],
    specifiedDetail: part,
  }));
  return {
    objective: parts[0] ?? directive.trim(),
    mechanisms: mechanisms.length ? mechanisms : [{
      id: 'm1', kind: 'OTHER', objective: directive.trim(), targetIds: [], actorIds: [state.manifest.playerId],
      dependencies: [], assumptions: [], sequence: 0, durationTurns: 1, resourceClaims: [], specifiedDetail: directive.trim(),
    }],
    sequencing: mechanisms.map((item) => item.id),
    contingencies: [],
    explicitRisks: [],
    unspecified: mechanisms.filter((item) => item.kind === 'OTHER').map((item) => `Mechanism for “${item.specifiedDetail}” is unspecified.`),
    communicationStyleIsMechanism: /speech|message|signal|tone|publicly|privately/i.test(directive),
  };
};

export const compileStrategy = async (
  directive: string,
  state: WorldState,
  beliefs: BeliefState,
  gateway?: ModelGateway,
) => {
  if (!gateway) return compileDeterministically(directive, state);
  try {
    const result = await gateway.callJson('strategy_compiler', [
      {
        role: 'system',
        content: 'You are a literal strategy compiler. Extract only mechanisms supplied or reasonably implied. Do not praise, repair, optimize, or invent leverage. Preserve vague mechanisms as vague and list missing details under unspecified.',
      },
      {
        role: 'user',
        content: JSON.stringify({ deRhetoricizedDirective: deRhetoricize(directive), permittedContext: playerVisibleState(state, beliefs) }),
      },
    ], strategyGraphSchema, 'StrategyGraph');
    return result.value;
  } catch {
    return compileDeterministically(directive, state);
  }
};

export const auditCompilerFidelity = async (
  directive: string,
  graph: StrategyGraph,
  gateway?: ModelGateway,
): Promise<CompilerFidelity> => {
  if (!gateway) {
    return {
      faithful: true,
      inventedMechanisms: [],
      omittedWeaknesses: [],
      assumedCoordination: [],
      contradictions: [],
    };
  }
  try {
    const result = await gateway.callJson('critic', [
      {
        role: 'system',
        content: 'Audit whether a strategy compiler upgraded the player. Compare literal player content against the dry graph. Flag invented mechanisms, hidden assumptions, removed weakness, and contradictions. Repair only by deleting or weakening unsupported content.',
      },
      { role: 'user', content: JSON.stringify({ rawDirective: directive, compiledGraph: graph }) },
    ], fidelitySchema, 'CompilerFidelity');
    return result.value;
  } catch {
    return { faithful: true, inventedMechanisms: [], omittedWeaknesses: [], assumedCoordination: [], contradictions: ['Model fidelity audit unavailable; deterministic validation only.'] };
  }
};

export const classifyTurnDepth = (graph: StrategyGraph, state: WorldState): TurnDepth => {
  const kinds = new Set(graph.mechanisms.map((item) => item.kind));
  const highStakes = state.metrics.nuclear_tension >= 80 || state.goal.deadlineTurn - state.turn <= 2;
  const novel = graph.mechanisms.some((item) => item.kind === 'OTHER' || item.assumptions.length > 2);
  if (highStakes || novel || graph.mechanisms.length >= 6) return 'DEEP';
  if (graph.mechanisms.length >= 4 || kinds.size >= 4) return 'COMPLEX';
  if (graph.mechanisms.length >= 2 || kinds.has('MILITARY_OPERATION') || kinds.has('DIPLOMACY')) return 'STANDARD';
  return 'ROUTINE';
};

export const checkFeasibility = (graph: StrategyGraph, state: WorldState): FeasibilityFinding[] => {
  const playerId = state.manifest.playerId;
  const controlled = new Set(Object.values(state.entities).filter((entity) => entity.id === playerId || entity.controllerId === playerId).map((entity) => entity.id));
  return graph.mechanisms.map((mechanism) => {
    const reasons: string[] = [];
    const constraints: string[] = [];
    let feasible = true;
    let classification: FeasibilityFinding['classification'] = 'POSSIBLE';
    let availableFraction = 1;
    let unmechanizedControlRequest = false;
    for (const claim of mechanism.resourceClaims) {
      const resource = state.resources[claim.resourceId];
      if (!resource || resource.amount < claim.amount) {
        feasible = false;
        constraints.push(`Insufficient ${claim.resourceId}.`);
        availableFraction = resource ? Math.min(availableFraction, resource.amount / Math.max(1, claim.amount)) : 0;
      }
    }
    if (mechanism.kind === 'DIRECT_ORDER' && mechanism.targetIds.some((id) => !controlled.has(id))) {
      feasible = false;
      unmechanizedControlRequest = true;
      constraints.push('The player lacks direct authority over at least one target. Interpret as a request or influence attempt.');
    }
    if (mechanism.kind === 'DIPLOMACY' && mechanism.targetIds.length) {
      const reachable = mechanism.targetIds.some((targetId) => Object.values(state.relationships).some((relationship) =>
        relationship.communication && ((relationship.fromId === playerId && relationship.toId === targetId) || (relationship.toId === playerId && relationship.fromId === targetId)),
      ));
      if (!reachable) {
        feasible = false;
        constraints.push('No available communication channel to the specified target.');
      }
    }
    if (mechanism.durationTurns > 1) {
      classification = 'DELAYED';
      reasons.push(`Requires approximately ${mechanism.durationTurns} turns to mature.`);
    } else if (mechanism.kind === 'RESOURCE_TRANSFER' && feasible) {
      classification = 'CERTAIN';
      reasons.push('Within direct control if the stated resource exists and is available.');
    }
    if (!feasible) classification = unmechanizedControlRequest || availableFraction <= 0 ? 'IMPOSSIBLE' : 'DELAYED';
    if (graph.mechanisms.length > 6) {
      availableFraction *= 6 / graph.mechanisms.length;
      reasons.push('Organizational attention is diluted across an oversized strategic package.');
    }
    return { mechanismId: mechanism.id, feasible, classification, reasons, hardConstraints: constraints, availableFraction };
  });
};
