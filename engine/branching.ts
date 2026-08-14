import { ActorAction, CounterfactualBranch, RedTeamFinding, StrategyGraph, WorldState } from './domain';

export const buildCounterfactualBranches = (
  graph: StrategyGraph,
  actorActions: ActorAction[],
  redTeam: RedTeamFinding[],
  state: WorldState,
): CounterfactualBranch[] => {
  const branches: CounterfactualBranch[] = [{
    id: 'branch_base', premise: 'The most likely actor responses and stated dependencies hold.', source: 'BASE_CASE',
    affectedMechanismIds: graph.mechanisms.map((mechanism) => mechanism.id), robustnessConcern: 'Whether the strategy remains useful under ordinary execution friction.',
  }];
  for (const [index, action] of actorActions.slice(0, 3).entries()) branches.push({
    id: `branch_actor_${index + 1}_${action.actorId}`,
    premise: `${state.entities[action.actorId]?.name ?? action.actorId} prioritizes: ${action.action}`,
    source: 'ACTOR_RESPONSE',
    affectedMechanismIds: action.perceivedPlayerMechanismIds,
    robustnessConcern: `Whether the package still advances its objective against this causally available response using ${action.capabilityIdsUsed.join(', ') || 'declared institutions'}.`,
  });
  if (graph.mechanisms.some((mechanism) => mechanism.kind === 'DECEPTION' || mechanism.kind === 'INTELLIGENCE')) branches.push({
    id: 'branch_detection', premise: 'A concealed mechanism is detected earlier than intended.', source: 'DETECTION',
    affectedMechanismIds: graph.mechanisms.filter((mechanism) => mechanism.kind === 'DECEPTION' || mechanism.kind === 'INTELLIGENCE').map((mechanism) => mechanism.id),
    robustnessConcern: 'Whether exposure causes only bounded degradation or collapses a critical dependency.',
  });
  const blocking = redTeam.find((finding) => finding.severity === 'BLOCKING') ?? redTeam.find((finding) => finding.severity === 'WARNING');
  if (blocking) branches.push({
    id: 'branch_assumption_failure', premise: blocking.claim, source: 'ASSUMPTION_FAILURE',
    affectedMechanismIds: blocking.affectedMechanismIds,
    robustnessConcern: 'Whether the plan has a viable path if this challenged assumption fails.',
  });
  return branches.slice(0, 6);
};
