import { describe, expect, it } from 'vitest';
import { PlayerForecast } from '../domain';
import { applyForecastScore, attachForecast, calibrationSummary, emptyForecastRecord } from '../forecast';
import { runTurn } from '../pipeline';
import { rollbackCampaign } from '../persistence';
import { createCubanCampaign } from '../scenarios';

const FORECAST: PlayerForecast = {
  outcome: 'SUCCESS',
  actorPredictions: [{ actorId: 'khrushchev', stance: 'ENGAGES' }],
  freeText: 'SENTINEL_FORECAST_XYZZY expects the backchannel to hold.',
};

describe('WP13 forecast capture and mechanical scoring', () => {
  it('never leaks the forecast into any pre-commit model prompt (Invariant 7)', async () => {
    const result = attachForecast(
      await runTurn(createCubanCampaign(801), 'Contact Khrushchev through the Robert Kennedy backchannel.', { persist: false }),
      FORECAST,
    );
    // The forecast is applied only after resolution, so it structurally cannot
    // reach a prompt; assert on every serialized prompt-bound artifact anyway.
    const promptSurfaces = JSON.stringify({
      traces: result.audit.modelCalls,
      actorPackets: result.audit.actorSimulationPackets,
      narrativePacket: result.audit.narrativePacket,
      dryStrategy: result.audit.dryStrategy,
    });
    expect(promptSurfaces).not.toContain('SENTINEL_FORECAST_XYZZY');
    // But it IS recorded on the audit for the debrief.
    expect(result.audit.playerForecast?.freeText).toContain('SENTINEL_FORECAST_XYZZY');
  });

  it('scores an outcome bucket and actor stance without any model call', async () => {
    const result = attachForecast(
      await runTurn(createCubanCampaign(802), 'Contact Khrushchev through the Robert Kennedy backchannel.', { persist: false }),
      FORECAST,
    );
    const score = result.audit.forecastScore!;
    expect(score.predictedOutcome).toBe('SUCCESS');
    expect(['SETBACK', 'MIXED', 'SUCCESS', 'STRONG_SUCCESS']).toContain(score.actualOutcome);
    expect(['HIT', 'ADJACENT', 'MISS']).toContain(score.outcomeResult);
    expect(score.actorResults).toHaveLength(1);
    expect(['ESCALATES', 'HOLDS', 'ENGAGES']).toContain(score.actorResults[0].actual);
    expect(result.campaign.forecastRecord.forecasts).toBe(1);
  });

  it('is fully optional and leaves the record untouched when skipped', async () => {
    const result = await runTurn(createCubanCampaign(803), 'Allocate 1 reconnaissance sortie.', { persist: false });
    expect(result.audit.playerForecast).toBeUndefined();
    expect(result.audit.forecastScore).toBeUndefined();
    expect(result.campaign.forecastRecord).toEqual(emptyForecastRecord());
  });

  it('summarizes calibration and detects systematic optimism', () => {
    let record = emptyForecastRecord();
    for (let index = 0; index < 4; index += 1) {
      record = applyForecastScore(record, {
        predictedOutcome: 'STRONG_SUCCESS',
        actualOutcome: 'MIXED',
        outcomeResult: 'MISS',
        actorResults: [{ actorId: 'a', predicted: 'ENGAGES', actual: 'ESCALATES', correct: false }],
      });
    }
    const summary = calibrationSummary(record);
    expect(summary.bias).toBe('OPTIMISTIC');
    expect(summary.outcomeAccuracy).toBe(0);
    expect(summary.headline).toMatch(/expected better results/i);

    const balanced = applyForecastScore(emptyForecastRecord(), {
      predictedOutcome: 'MIXED',
      actualOutcome: 'MIXED',
      outcomeResult: 'HIT',
      actorResults: [{ actorId: 'a', predicted: 'HOLDS', actual: 'HOLDS', correct: true }],
    });
    expect(calibrationSummary(balanced).bias).toBe('BALANCED');
    expect(calibrationSummary(balanced).actorAccuracy).toBe(1);
  });

  it('rebuilds the calibration record from surviving audits after a rollback', async () => {
    const first = attachForecast(await runTurn(createCubanCampaign(804), 'Contact Khrushchev through the Robert Kennedy backchannel.', { persist: false }), FORECAST);
    const second = attachForecast(await runTurn(first.campaign, 'Allocate 1 reconnaissance sortie.', { persist: false }), FORECAST);
    expect(second.campaign.forecastRecord.forecasts).toBe(2);
    const rolledBack = rollbackCampaign(second.campaign, 1);
    expect(rolledBack.forecastRecord.forecasts).toBe(1);
  });
});

describe('deterministic narrative fallback quality', () => {
  it('never emits the banned filler phrases the live defect report named', async () => {
    const campaign = createCubanCampaign(805);
    const directives = [
      'Order the Joint Chiefs to hold the quarantine line.',
      'Ask Khrushchev for a verified stand-down through the backchannel.',
      'Allocate 1 reconnaissance sortie.',
    ];
    let current = campaign;
    for (const directive of directives) {
      const result = await runTurn(current, directive, { persist: false });
      const prose = [
        result.audit.narrative.title,
        result.audit.narrative.immediateOutcome,
        result.audit.narrative.worldReaction,
        result.audit.narrative.strategicConsequences,
        result.audit.narrative.detailedReport,
      ].join(' ');
      expect(prose).not.toMatch(/the order is in motion/i);
      expect(prose).not.toMatch(/an observable world process changed independently/i);
      current = result.campaign;
    }
  });
});
