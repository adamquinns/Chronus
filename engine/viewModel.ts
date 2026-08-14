import { Choice, Entity, HistoryEntry, TurnData } from '../types';
import { Campaign, TurnOption } from './domain';
import { playerVisibleState } from './projections';
import { projectChangesForViewer } from './visibility';

const numberFrom = (value: unknown, fallback = 0) => typeof value === 'number' ? value : fallback;

const optionType = (text: string): Choice['type'] => {
  if (/strike|military|force|deploy|guard|mobil/i.test(text)) return 'force';
  if (/fund|economic|business|resource|allocate/i.test(text)) return 'profit';
  if (/coalition|recruit|governor|coordinate|diplomat|negot|backchannel|statement/i.test(text)) return 'diplomacy';
  if (/recon|intelligence|verify|investigat|technical|court|legal|injunction|lawsuit/i.test(text)) return 'innovation';
  return 'diplomacy';
};

const advisorBias = (bias: string): Choice['type'] => optionType(bias);

const entityType = (kind: string): Entity['type'] => {
  if (kind === 'PERSON') return 'Figure';
  if (kind === 'ASSET' || kind === 'MILITARY') return 'Asset';
  if (kind === 'FACTION' || kind === 'INSTITUTION' || kind === 'STATE') return 'Faction';
  return 'Threat';
};

const optionToChoice = (option: TurnOption): Choice => ({
  id: option.id,
  text: option.directiveText,
  type: optionType(`${option.label} ${option.directiveText}`),
  risk: /catastroph|war|strike|exposure|retaliat|irreversible/i.test(option.tradeoff) ? 'HIGH' : 'MEDIUM',
  detailedDescription: option.rationale,
  forecastRange: 'Consequences remain contingent',
  forecastConfidence: 'MEDIUM',
  technicalReport: `Tradeoff: ${option.tradeoff}`,
});

export const buildConsoleModel = (campaign: Campaign, options: TurnOption[] = []): TurnData => {
  const state = campaign.state;
  const visible = playerVisibleState(state, campaign.beliefs);
  const latest = campaign.audits.at(-1);
  const priorState = latest?.previousStateSnapshot;
  const visibleChanges = latest ? projectChangesForViewer(
    state,
    state.manifest.playerId,
    latest.stateChanges,
    latest.dryStrategy,
  ) : [];
  const metricDisplays = visible.visibleMetrics.map((metric) => {
    const value = metric.estimate;
    const delta = value - (priorState?.metrics[metric.id] ?? value);
    const showPoint = metric.confidence === 'HIGH' || metric.confidence === 'VERY_HIGH' || !metric.range;
    return {
      id: metric.id,
      label: metric.label,
      value,
      display: showPoint ? String(Math.round(value)) : `${Math.round(metric.range![0])}–${Math.round(metric.range![1])}`,
      delta,
      confidence: metric.confidence,
      danger: (metric.dangerAbove !== undefined && value >= metric.dangerAbove)
        || (metric.dangerBelow !== undefined && value <= metric.dangerBelow),
    };
  });
  const primary = [...metricDisplays, ...Array.from({ length: 4 }, (_, index) => ({
    id: `empty_${index}`, label: 'Untracked', value: 0, display: '—', delta: 0, confidence: 'VERY_LOW', danger: false,
  }))].slice(0, 4);
  const relationships = visible.relationships;
  const relationFor = (id: string) => relationships.find((relationship) =>
    (relationship.fromId === state.manifest.playerId && relationship.toId === id)
    || (relationship.toId === state.manifest.playerId && relationship.fromId === id));
  const entities: Entity[] = visible.entityDirectory.filter((item): item is NonNullable<typeof item> => Boolean(item)).map((entity) => ({
    id: entity.id,
    name: entity.name,
    type: entityType(entity.kind),
    description: entity.description,
    power: numberFrom(entity.power, 50),
    loyalty: relationFor(entity.id)?.alignment ?? (entity.id === state.manifest.playerId || state.entities[entity.id]?.controllerId === state.manifest.playerId ? 100 : -1),
    status: entity.status ?? 'Status uncertain',
  }));
  const controlledIds = new Set(Object.values(state.entities).filter((entity) => entity.id === state.manifest.playerId || entity.controllerId === state.manifest.playerId).map((entity) => entity.id));
  const allies = entities.filter((entity) => !controlledIds.has(entity.id) && entity.loyalty >= 40);
  const enemies = entities.filter((entity) => !controlledIds.has(entity.id) && entity.loyalty < 40);
  const assets = entities.filter((entity) => controlledIds.has(entity.id));
  const latestNarrative = latest?.narrative;
  const opening = state.manifest.narrativeWorld?.openingScene ?? state.manifest.premise;
  const narrative = latestNarrative
    ? [latestNarrative.immediateOutcome, latestNarrative.worldReaction, latestNarrative.strategicConsequences].filter(Boolean).join('\n\n')
    : opening;
  const status = state.goal.status;
  return {
    turnNumber: state.turn + (state.gameOver ? 0 : 1),
    year: state.dateLabel,
    eventTitle: latestNarrative?.title ?? state.manifest.title,
    manifest: {
      genre: state.manifest.id === 'american_twilight' ? 'Constitutional Political Thriller' : 'Nuclear Crisis',
      timeUnit: state.manifest.timeUnit,
      statsConfig: {
        stabilityLabel: primary[0].label,
        wealthLabel: primary[1].label,
        supportLabel: primary[2].label,
        primaryStatLabel: primary[3].label,
      },
    },
    currentGoal: {
      id: state.goal.id,
      description: state.goal.description,
      type: state.manifest.id === 'american_twilight' ? 'REFORM' : 'DIPLOMACY',
      turnsRemaining: Math.max(0, state.goal.deadlineTurn - state.turn),
      totalTurns: state.goal.deadlineTurn,
      status,
      victoryCondition: state.goal.victoryConditions.join('; '),
    },
    goalResult: status === 'ACTIVE' ? undefined : {
      outcome: status === 'ACHIEVED' ? 'VICTORY' : 'DEFEAT',
      title: state.goal.outcomeClass?.replaceAll('_', ' ') ?? (status === 'ACHIEVED' ? 'Objective secured' : 'Timeline compromised'),
      description: latestNarrative?.strategicConsequences ?? state.goal.description,
    },
    arcs: visible.arcs.map((arc) => ({
      id: arc.id,
      title: arc.title,
      currentValue: Math.round((arc.progress / Math.max(1, arc.threshold)) * 100),
      maxValue: 100,
      status: arc.status,
    })),
    news: latestNarrative?.news ?? [],
    narrative,
    advisors: state.manifest.advisors.map((advisor) => ({
      id: advisor.id,
      name: advisor.name,
      role: advisor.expertise.join(' · '),
      advice: latestNarrative?.advisorReactions.find((reaction) => reaction.actorId === advisor.id || reaction.actorId === advisor.actorId)?.reaction
        ?? `${advisor.worldview} ${advisor.recurringTension ?? ''}`.trim(),
      bias: advisorBias(`${advisor.bias} ${advisor.expertise.join(' ')}`),
      status: 'Active',
    })),
    stats: {
      stability: primary[0].value,
      wealth: primary[1].value,
      support: primary[2].value,
      primaryStatValue: primary[3].value,
    },
    metricDisplays,
    statsDelta: {
      stability: primary[0].delta,
      wealth: primary[1].delta,
      support: primary[2].delta,
      primaryStatValue: primary[3].delta,
    },
    statsReasoning: latest
      ? `${latest.selectedOutcome.label}. ${visibleChanges.length} player-observable causal change${visibleChanges.length === 1 ? '' : 's'} committed.`
      : `You are ${state.manifest.playerRole}. ${state.manifest.unresolvedUncertainties[0] ?? 'The situation remains uncertain.'}`,
    detailedReport: latestNarrative?.detailedReport,
    pressCoverage: latestNarrative?.pressCoverage,
    advisorReactions: latestNarrative?.advisorReactions,
    developments: visibleChanges.map((change) => ({ ...change, cause: change.explanation })),
    storyThreads: campaign.narrativeThreads,
    ledger: { allies, enemies, assets },
    choices: options.map(optionToChoice),
    gameOver: state.gameOver,
  };
};

export const buildHistoryModel = (campaign: Campaign): HistoryEntry[] => campaign.audits.map((audit, index) => {
  const prefix: Campaign = {
    ...campaign,
    state: audit.committedStateSnapshot,
    beliefs: audit.committedBeliefSnapshot,
    memories: audit.committedMemorySnapshot,
    audits: campaign.audits.slice(0, index + 1),
  };
  const model = buildConsoleModel(prefix);
  return {
    turnNumber: audit.turn,
    year: audit.committedStateSnapshot.dateLabel,
    narrative: audit.narrative.immediateOutcome,
    eventTitle: audit.narrative.title,
    statsSnapshot: model.stats,
    statsDelta: model.statsDelta,
    statsReasoning: audit.narrative.strategicConsequences,
    ledgerSnapshot: model.ledger,
    manifestSnapshot: model.manifest,
    goalSnapshot: model.currentGoal,
    goalResultSnapshot: model.goalResult,
    arcsSnapshot: model.arcs,
    advisorsSnapshot: model.advisors,
    userChoice: audit.rawDirective,
  };
});
