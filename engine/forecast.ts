import {
  ActorAction,
  Adjudication,
  ForecastActorStance,
  ForecastOutcome,
  ForecastRecord,
  ForecastScore,
  OutcomeBand,
  PlayerForecast,
  StateChange,
  TurnResult,
  WorldState,
} from './domain';
import { inferMechanismKind } from './compiler';

export const FORECAST_OUTCOMES: ForecastOutcome[] = ['SETBACK', 'MIXED', 'SUCCESS', 'STRONG_SUCCESS'];

export const emptyForecastRecord = (): ForecastRecord => ({
  forecasts: 0,
  hits: 0,
  adjacents: 0,
  actorPredictions: 0,
  actorHits: 0,
  outcomeBiasSum: 0,
});

/**
 * How favorable a band is for the player, derived from its effects against the
 * scenario's own danger thresholds: raising a dangerAbove metric is bad,
 * lowering a dangerBelow metric is bad. Pure and deterministic — no model call.
 */
const bandFavorability = (band: OutcomeBand, adjudication: Adjudication, state: WorldState): number => {
  const weights: Record<string, number> = { NONE: 0, TRIVIAL: 1, MINOR: 2.5, MODERATE: 5.5, MAJOR: 10, SEVERE: 16, SYSTEMIC: 28 };
  let score = 0;
  for (const effectId of band.effectIds) {
    const effect = adjudication.recommendedEffects.find((candidate) => candidate.id === effectId);
    if (!effect || effect.direction === 'NEUTRAL') continue;
    const magnitude = weights[effect.impactClass] ?? 0;
    const sign = effect.direction === 'POSITIVE' ? 1 : -1;
    let playerGood = sign;
    if (effect.targetType === 'METRIC') {
      const definition = state.manifest.metricDefinitions.find((candidate) => candidate.id === effect.targetId);
      if (definition?.dangerAbove !== undefined) playerGood = -sign;
      else if (definition?.dangerBelow !== undefined) playerGood = sign;
    }
    score += playerGood * magnitude;
  }
  return score;
};

/** Rank the selected band among all bands and map that rank onto the four
 * player-facing buckets. Ties break by band id for determinism. */
export const bucketForOutcome = (
  selected: OutcomeBand,
  adjudication: Adjudication,
  state: WorldState,
): ForecastOutcome => {
  const bands = adjudication.outcomeBands.length ? adjudication.outcomeBands : [selected];
  const ranked = [...bands]
    .map((band) => ({ band, score: bandFavorability(band, adjudication, state) }))
    .sort((a, b) => a.score - b.score || a.band.id.localeCompare(b.band.id));
  const index = Math.max(0, ranked.findIndex((entry) => entry.band.id === selected.id));
  const bucket = Math.min(3, Math.floor((index / ranked.length) * 4));
  return FORECAST_OUTCOMES[bucket];
};

const STANCE_BY_KIND: Partial<Record<ReturnType<typeof inferMechanismKind>, ForecastActorStance>> = {
  MILITARY_OPERATION: 'ESCALATES',
  COERCION: 'ESCALATES',
  DIPLOMACY: 'ENGAGES',
  PUBLIC_COMMUNICATION: 'ENGAGES',
};

/** An actor with no committed action HOLDS; otherwise its action text is
 * classified with the same kind inference the compiler uses. */
export const actualStanceFor = (actorId: string, actorActions: ActorAction[], changes: StateChange[]): ForecastActorStance => {
  const action = actorActions.find((candidate) => candidate.actorId === actorId);
  const committed = changes.some((change) => change.cause.toLowerCase().includes(actorId.replaceAll('_', ' ')));
  if (!action && !committed) return 'HOLDS';
  if (!action) return 'ENGAGES';
  const kind = inferMechanismKind(`${action.action} ${action.mechanisms.join(' ')}`);
  return STANCE_BY_KIND[kind] ?? 'HOLDS';
};

export const scoreForecast = (
  forecast: PlayerForecast,
  selected: OutcomeBand,
  adjudication: Adjudication,
  state: WorldState,
  actorActions: ActorAction[],
  changes: StateChange[],
): ForecastScore => {
  const actualOutcome = bucketForOutcome(selected, adjudication, state);
  const predictedIndex = FORECAST_OUTCOMES.indexOf(forecast.outcome);
  const actualIndex = FORECAST_OUTCOMES.indexOf(actualOutcome);
  const distance = Math.abs(predictedIndex - actualIndex);
  return {
    predictedOutcome: forecast.outcome,
    actualOutcome,
    outcomeResult: distance === 0 ? 'HIT' : distance === 1 ? 'ADJACENT' : 'MISS',
    actorResults: forecast.actorPredictions.map((prediction) => {
      const actual = actualStanceFor(prediction.actorId, actorActions, changes);
      return { actorId: prediction.actorId, predicted: prediction.stance, actual, correct: actual === prediction.stance };
    }),
    freeText: forecast.freeText,
  };
};

export const applyForecastScore = (record: ForecastRecord, score: ForecastScore): ForecastRecord => ({
  forecasts: record.forecasts + 1,
  hits: record.hits + (score.outcomeResult === 'HIT' ? 1 : 0),
  adjacents: record.adjacents + (score.outcomeResult === 'ADJACENT' ? 1 : 0),
  actorPredictions: record.actorPredictions + score.actorResults.length,
  actorHits: record.actorHits + score.actorResults.filter((result) => result.correct).length,
  outcomeBiasSum: record.outcomeBiasSum
    + (FORECAST_OUTCOMES.indexOf(score.predictedOutcome) - FORECAST_OUTCOMES.indexOf(score.actualOutcome)),
});

/**
 * Attach a forecast to an already-resolved turn. Pure: recomputes the score and
 * the campaign record from committed data. Because the forecast is applied
 * AFTER resolution and never enters runTurn, it structurally cannot influence
 * adjudication (Invariant 7).
 */
export const attachForecast = (result: TurnResult, forecast: PlayerForecast): TurnResult => {
  if (result.audit.forecastScore) return result;
  const score = scoreForecast(
    forecast,
    result.audit.selectedOutcome,
    result.audit.adjudication,
    result.audit.committedStateSnapshot,
    result.audit.actorActions,
    result.audit.stateChanges,
  );
  const audit = { ...result.audit, playerForecast: forecast, forecastScore: score };
  return {
    audit,
    campaign: {
      ...result.campaign,
      audits: result.campaign.audits.map((candidate) => (candidate.id === audit.id ? audit : candidate)),
      forecastRecord: applyForecastScore(result.campaign.forecastRecord ?? emptyForecastRecord(), score),
    },
  };
};

export interface CalibrationSummary {
  forecasts: number;
  outcomeAccuracy: number;
  outcomeWithinOne: number;
  actorAccuracy: number;
  bias: 'OPTIMISTIC' | 'PESSIMISTIC' | 'BALANCED';
  headline: string;
}

export const calibrationSummary = (record: ForecastRecord): CalibrationSummary => {
  const outcomeAccuracy = record.forecasts ? record.hits / record.forecasts : 0;
  const outcomeWithinOne = record.forecasts ? (record.hits + record.adjacents) / record.forecasts : 0;
  const actorAccuracy = record.actorPredictions ? record.actorHits / record.actorPredictions : 0;
  const averageBias = record.forecasts ? record.outcomeBiasSum / record.forecasts : 0;
  const bias = averageBias >= 0.5 ? 'OPTIMISTIC' : averageBias <= -0.5 ? 'PESSIMISTIC' : 'BALANCED';
  const headline = !record.forecasts
    ? 'No forecasts were recorded this campaign.'
    : `${record.hits} of ${record.forecasts} outcome forecasts were exact${record.adjacents ? `, ${record.adjacents} within one band` : ''}. ${
      bias === 'OPTIMISTIC' ? 'You consistently expected better results than the world delivered.'
        : bias === 'PESSIMISTIC' ? 'You consistently expected worse results than the world delivered.'
          : 'Your expectations tracked outcomes without systematic optimism or pessimism.'}`;
  return { forecasts: record.forecasts, outcomeAccuracy, outcomeWithinOne, actorAccuracy, bias, headline };
};
