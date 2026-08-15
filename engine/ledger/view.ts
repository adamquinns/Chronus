import { Choice, HistoryEntry, TurnData } from '../../types';
import { Ledger, ScenarioDefinition, TurnRecord } from './types';

/**
 * Adapts the ledger to the shape the existing Situation Console renders. The UI
 * is unchanged by this architecture; only what feeds it has changed.
 */

const asChoice = (id: string, text: string, rationale: string): Choice => ({
  id,
  text,
  type: 'diplomacy',
  risk: 'MEDIUM',
  detailedDescription: rationale,
  forecastRange: 'The world will answer; how is not yours to set.',
  forecastConfidence: 'MEDIUM',
  technicalReport: rationale,
});

export const buildTurnData = (
  scenario: ScenarioDefinition,
  ledger: Ledger,
  latest: TurnRecord | undefined,
  suggestions: Array<{ id: string; label: string; directive: string; rationale: string }> = [],
): TurnData => {
  const readings = ledger.standing;
  const primary = readings.slice(0, 4);
  const narrative = latest?.narration;

  return {
    turnNumber: ledger.turn + 1,
    year: new Date(ledger.date).toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }),
    eventTitle: narrative?.title ?? scenario.title,
    manifest: {
      genre: 'Nuclear Crisis',
      timeUnit: scenario.turnLength,
      statsConfig: {
        stabilityLabel: readings[0]?.label ?? '—',
        wealthLabel: readings[1]?.label ?? '—',
        supportLabel: readings[2]?.label ?? '—',
        primaryStatLabel: readings[3]?.label ?? '—',
      },
    },
    currentGoal: {
      id: 'objective',
      description: ledger.objective,
      type: 'DIPLOMACY',
      turnsRemaining: Math.max(0, ledger.deadlineTurn - ledger.turn),
      totalTurns: ledger.deadlineTurn,
      status: ledger.concluded ? 'FAILED' : 'ACTIVE',
      victoryCondition: ledger.objective,
    },
    goalResult: ledger.concluded
      ? {
        outcome: /victor|achiev|secur|success/i.test(ledger.concluded.outcome) ? 'VICTORY' as const : 'DEFEAT' as const,
        title: ledger.concluded.outcome,
        description: ledger.concluded.summary,
      }
      : undefined,
    arcs: ledger.threads.filter((thread) => thread.status === 'OPEN').map((thread) => ({
      id: thread.id,
      title: thread.title,
      // Threads carry no numeric progress of their own: how long one has run
      // and how recently it moved is the honest reading of where it stands.
      currentValue: Math.min(100, 20 + (ledger.turn - thread.openedTurn) * 15),
      maxValue: 100,
      status: 'ACTIVE',
    })),
    news: (narrative?.press ?? []).map((item) => ({ source: item.source, headline: item.headline })),
    narrative: narrative
      ? [narrative.immediate, narrative.worldReaction, narrative.consequences].filter(Boolean).join('\n\n')
      : scenario.openingScene,
    advisors: scenario.advisors.map((advisor) => {
      const spoke = narrative?.advisors.find((item) => item.name === advisor.name);
      return {
        id: advisor.id,
        name: advisor.name,
        role: advisor.voice.split('.')[0],
        advice: spoke?.reaction ?? advisor.bias,
        bias: /force|strike|military/i.test(advisor.bias) ? 'force' as const : 'diplomacy' as const,
        status: 'Active',
      };
    }),
    stats: {
      stability: primary[0]?.value ?? 0,
      wealth: primary[1]?.value ?? 0,
      support: primary[2]?.value ?? 0,
      primaryStatValue: primary[3]?.value ?? 0,
    },
    metricDisplays: readings.map((reading) => ({
      id: reading.id,
      label: reading.label,
      value: reading.value,
      display: String(Math.round(reading.value)),
      delta: reading.delta,
      confidence: 'HIGH',
      danger: reading.id === 'nuclear_tension' ? reading.value >= 85 : reading.value <= 20,
    })),
    statsDelta: {
      stability: primary[0]?.delta ?? 0,
      wealth: primary[1]?.delta ?? 0,
      support: primary[2]?.delta ?? 0,
      primaryStatValue: primary[3]?.delta ?? 0,
    },
    statsReasoning: readings.filter((reading) => reading.delta !== 0).map((reading) => reading.reasoning).join(' '),
    detailedReport: narrative?.detailed,
    pressCoverage: narrative?.press,
    advisorReactions: narrative?.advisors.map((item) => ({ actorId: item.name, name: item.name, reaction: item.reaction })),
    developments: latest
      ? [
        ...latest.outcomes.filter((outcome) => outcome.id === latest.selectedOutcomeId).flatMap((outcome) =>
          outcome.establishes
            .filter((item) => item.audience.kind === 'PUBLIC' || item.audience.kind === 'PLAYER')
            .map((item, index) => ({
              id: `est_${index}`,
              label: item.statement,
              field: 'established',
              before: undefined,
              after: 'now true',
              cause: outcome.event,
            }))),
        ...latest.readings.filter((reading) => reading.delta !== 0).map((reading) => ({
          id: `reading_${reading.id}`,
          label: reading.label,
          field: 'reading',
          before: reading.value - reading.delta,
          after: reading.value,
          cause: reading.reasoning,
        })),
        ...ledger.unknowns.filter((item) => item.status === 'OPEN' && item.openedTurn === ledger.turn).map((item) => ({
          id: item.id,
          label: item.statement,
          field: 'unknown',
          before: undefined,
          after: `not yet known: ${item.unknownPart}`,
          cause: `Would be revealed by: ${item.revealedBy}`,
        })),
      ]
      : [],
    storyThreads: ledger.threads.filter((thread) => thread.status === 'OPEN').map((thread) => ({
      id: thread.id,
      title: thread.title,
      status: 'OPEN',
      summary: thread.question,
    })),
    // The field is `enemies`, not `threats`: an `as unknown as` cast here once
    // hid the mismatch from the typechecker and blanked the console on entry.
    ledger: {
      allies: ledger.cast.slice(0, 6).map((member) => ({
        id: member.id, name: member.name, type: 'Figure' as const,
        description: member.towardPlayer, status: '',
      })),
      enemies: ledger.threads.filter((thread) => thread.status === 'OPEN').slice(0, 5).map((thread) => ({
        id: thread.id, name: thread.title, type: 'Threat' as const,
        description: thread.ifIgnored, status: 'Open',
      })),
      assets: [],
    },
    choices: suggestions.map((item) => asChoice(item.id, item.directive, item.rationale)),
    gameOver: Boolean(ledger.concluded),
  };
};

export const buildHistory = (
  scenario: ScenarioDefinition,
  records: TurnRecord[],
): HistoryEntry[] => records.map((record) => {
  const turn = buildTurnData(scenario, record.ledgerAfter, record);
  return {
    turnNumber: record.turn,
    year: turn.year,
    narrative: [record.narration.immediate, record.narration.worldReaction].join('\n\n'),
    eventTitle: record.narration.title,
    statsSnapshot: turn.stats,
    statsDelta: turn.statsDelta,
    statsReasoning: turn.statsReasoning,
    ledgerSnapshot: turn.ledger,
    manifestSnapshot: turn.manifest,
    goalSnapshot: turn.currentGoal,
    goalResultSnapshot: turn.goalResult,
    arcsSnapshot: turn.arcs,
    advisorsSnapshot: turn.advisors,
    userChoice: record.rawDirective,
  };
});
