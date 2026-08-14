import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Adjudication, ModelCallResult, StrategyGraph, TurnNarrative } from '../domain';
import { DEFAULT_MODEL_ROUTES, ModelBudget, ModelGateway, ModelMessage, ModelRole } from '../model';
import { reconcileAdjudications, runTurn } from '../pipeline';
import { createCoalitionCampaign } from '../curatedScenarios';

const graph: StrategyGraph = {
  objective: 'Contact Governor Vale privately',
  mechanisms: [{ id: 'm1', kind: 'DIPLOMACY', objective: 'Contact Governor Vale privately', targetIds: ['governor_vale'], actorIds: ['organizer'], dependencies: [], assumptions: [], sequence: 0, durationTurns: 1, resourceClaims: [], specifiedDetail: 'Contact Governor Vale privately' }],
  sequencing: ['m1'], contingencies: [], explicitRisks: [], unspecified: [], communicationStyleIsMechanism: false,
};

const adjudication = (targetId = 'coalition_cohesion', impactClass: Adjudication['recommendedEffects'][number]['impactClass'] = 'MINOR'): Adjudication => ({
  summary: 'Bounded judgment.',
  mechanismFindings: [{ mechanismId: 'm1', engagement: 'ENGAGES', reason: 'A communication channel exists.', confidence: 'HIGH' }],
  recommendedEffects: [{ id: 'effect_1', mechanismId: 'm1', targetType: 'METRIC', targetId, field: 'value', direction: 'POSITIVE', impactClass, confidence: 'HIGH', engagement: 'ENGAGES', cause: 'Private contact improves coordination.', dependencies: [] }],
  outcomeBands: [{ id: 'only', label: 'Contact established', probability: 1, effectIds: ['effect_1'], description: 'The contact occurs.' }],
  assumptions: [], unknowns: [], confidence: 'HIGH',
});

const narrative: TurnNarrative = { title: 'Contact Established', immediateOutcome: 'The private contact occurs.', worldReaction: 'Other actors continue their plans.', strategicConsequences: 'Coalition coordination improves modestly.', news: [], advisorReactions: [] };

class RecoveryGateway implements ModelGateway {
  readonly routes = DEFAULT_MODEL_ROUTES;
  readonly budget = new ModelBudget({ maxUsd: 10, maxRequests: 100, maxInputTokens: 100_000, maxOutputTokens: 100_000 });
  private repairCount = 0;
  constructor(private readonly validOnRepair: number) {}
  traceCount() { return 0; }
  tracesSince() { return []; }
  async callJson<T>(_role: ModelRole, _messages: ModelMessage[], _schema: z.ZodType<T>, name: string): Promise<ModelCallResult<T>> {
    let value: unknown;
    if (name === 'StrategyGraph') value = graph;
    else if (name === 'CompilerFidelity') value = { faithful: true, inventedMechanisms: [], omittedWeaknesses: [], assumedCoordination: [], contradictions: [] };
    else if (name === 'ActorActions') value = { actions: [] };
    else if (name === 'RedTeamFindings') value = { findings: [] };
    else if (name === 'Adjudication') value = adjudication('missing_metric');
    else if (name === 'RepairedAdjudication' || name === 'EscalatedAdjudication') {
      this.repairCount += 1;
      value = this.repairCount >= this.validOnRepair ? adjudication() : adjudication('still_missing');
    } else if (name === 'TurnNarrative') value = narrative;
    else throw new Error(`Unexpected schema ${name}`);
    return { value: value as T, model: 'test/model', usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }, rawText: JSON.stringify(value) };
  }
}

describe('bounded validation recovery and disagreement', () => {
  it('repairs once and commits only the validated proposal', async () => {
    const result = await runTurn(createCoalitionCampaign(200), graph.objective, { gateway: new RecoveryGateway(1), persist: false });
    expect(result.audit.validation.some((issue) => issue.code === 'RECOVERED_EFFECT_TARGET_UNKNOWN')).toBe(true);
    expect(result.audit.stateChanges.some((change) => change.targetId === 'coalition_cohesion')).toBe(true);
  });

  it('escalates once after a failed repair and then commits', async () => {
    const result = await runTurn(createCoalitionCampaign(201), graph.objective, { gateway: new RecoveryGateway(2), persist: false });
    expect(result.audit.validation.filter((issue) => issue.code === 'RECOVERED_EFFECT_TARGET_UNKNOWN').length).toBeGreaterThanOrEqual(2);
  });

  it('aborts without mutating authoritative input after the bounded attempts fail', async () => {
    const campaign = createCoalitionCampaign(202);
    const snapshot = structuredClone(campaign);
    await expect(runTurn(campaign, graph.objective, { gateway: new RecoveryGateway(99), persist: false })).rejects.toThrow(/aborted after bounded recovery/i);
    expect(campaign).toEqual(snapshot);
  });

  it('treats material independent disagreement as uncertainty instead of averaging conclusions', () => {
    const primary = { ...adjudication(), outcomeBands: [
      { id: 'fail', label: 'Failure', probability: 0.1, effectIds: [], description: 'Failure.' },
      { id: 'win', label: 'Success', probability: 0.9, effectIds: ['effect_1'], description: 'Success.' },
    ] };
    const second = adjudication('coalition_cohesion', 'SEVERE');
    second.recommendedEffects.push({ ...second.recommendedEffects[0], id: 'effect_2', direction: 'NEGATIVE', impactClass: 'SYSTEMIC' });
    second.mechanismFindings[0].engagement = 'BACKFIRES';
    const result = reconcileAdjudications(primary, second);
    expect(result.disagreement.material).toBe(true);
    expect(result.adjudication.confidence).toBe('LOW');
    expect(result.adjudication.outcomeBands[0].probability).toBeGreaterThan(0.1);
    expect(result.adjudication.outcomeBands[1].probability).toBeLessThan(0.9);
  });
});
