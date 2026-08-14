import { ActorAction, Campaign, EffectRecommendation, NarrativePacket, OutcomeBand, StrategyGraph, WorldState } from './domain';
import { canAccess } from './visibility';

const relevantNarrativeContext = (campaign: Campaign, graph: StrategyGraph) => {
  const world = campaign.state.manifest.narrativeWorld;
  if (!world) return {};
  const terms = new Set(graph.mechanisms.flatMap((mechanism) => mechanism.targetIds)
    .map((id) => campaign.state.entities[id]?.name.toLowerCase()).filter(Boolean) as string[]);
  const relevant = (items: string[], limit: number) => {
    const matched = items.filter((item) => [...terms].some((term) => item.toLowerCase().includes(term)));
    return [...new Set([...matched, ...items.slice(0, Math.max(0, limit - matched.length))])].slice(0, limit);
  };
  return {
    sourceMaterialRef: world.sourceMaterialRef,
    canonicalContext: relevant(world.canonicalContext, 7),
    playerContext: relevant(world.playerContext, 6),
    immediateHistory: relevant(world.immediateHistory, 6),
    locations: relevant(world.locations, 4),
    institutions: relevant(world.institutions, 5),
    narrativeGuidance: world.narrativeGuidance,
    storyPossibilities: relevant(world.storyPossibilities, 4),
    openingScene: world.openingScene,
    artifactFormats: world.artifactFormats,
  };
};

export const buildNarrativePacket = (
  campaign: Campaign,
  stateAfter: WorldState,
  rawDirective: string,
  graph: StrategyGraph,
  selectedOutcome: OutcomeBand,
  visibleChanges: NarrativePacket['visibleChanges'],
  actorActions: ActorAction[],
  selectedEffects: EffectRecommendation[],
): NarrativePacket => {
  const visibleEffectIds = new Set(visibleChanges.flatMap((change) => {
    if (change && typeof change === 'object' && 'sourceEffectId' in change && typeof change.sourceEffectId === 'string') {
      return [change.sourceEffectId];
    }
    return [];
  }));
  const hiddenFactPhrases = Object.values(stateAfter.facts)
    .filter((fact) => !canAccess(fact.visibility, stateAfter.manifest.playerId, stateAfter.manifest.playerId, stateAfter.gameOver))
    .flatMap((fact) => {
      const words = fact.statement.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter((word) => word.length > 2);
      return words.slice(0, -2).map((_, index) => words.slice(index, index + 3).join(' '));
    });
  const safeActorAction = (actorName: string, action: string) => {
    if (hiddenFactPhrases.some((phrase) => action.toLowerCase().includes(phrase))) {
      return `${actorName} made an observable independent move; protected details remain outside the player report.`;
    }
    if (action.toLowerCase().startsWith(actorName.toLowerCase()) || /continues pursuing/i.test(action)) {
      return `${actorName} continued its visible institutional initiative.`;
    }
    return action;
  };
  const visibleActorIds = new Set(selectedEffects.filter((effect) => effect.actorId && visibleEffectIds.has(effect.id)).map((effect) => effect.actorId!));
  const visibleActorEvents = actorActions
    .filter((action) => visibleActorIds.has(action.actorId))
    .map((action) => {
      const actorName = stateAfter.entities[action.actorId]?.name ?? action.actorId;
      return { actorName, action: safeActorAction(actorName, action.action) };
    });
  const observableOutcome = {
    ...selectedOutcome,
    label: visibleChanges.length ? 'Observable consequences' : 'No observable change',
    description: visibleChanges.length
      ? visibleChanges.flatMap((change) => change && typeof change === 'object' && 'explanation' in change && typeof change.explanation === 'string' ? [change.explanation] : []).join(' ')
      : 'No new consequence is yet observable to the player.',
    effectIds: [...visibleEffectIds],
  };
  return {
    scenarioContext: relevantNarrativeContext(campaign, graph),
    rawDirective,
    compiledStrategy: graph,
    selectedOutcome: observableOutcome,
    visibleChanges,
    visibleActorEvents,
    advisors: stateAfter.manifest.advisors
      .filter((advisor) => canAccess(advisor.visibility, stateAfter.manifest.playerId, stateAfter.manifest.playerId, stateAfter.gameOver))
      .map(({ id, actorId, name, worldview, bias, voice, personalStakes }) => ({ id, actorId, name, worldview, bias, voice, personalStakes })),
    recentNarratives: campaign.audits.slice(-3).map((audit) => ({ title: audit.narrative.title, immediateOutcome: audit.narrative.immediateOutcome })),
    storySoFar: campaign.storySummary,
    recurringCharacters: campaign.narrativeCharacters,
    activeThreads: campaign.narrativeThreads,
    continuingUncertainty: stateAfter.manifest.unresolvedUncertainties,
    voice: stateAfter.manifest.voice,
  };
};
