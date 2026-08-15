import { describe, expect, it } from 'vitest';
import { createCubanCampaign } from '../scenarios';
import { runTurn } from '../pipeline';
import { retrievePrecedents } from '../precedent';
import { compileDeterministically } from '../compiler';
import { reconstructCommittedTurn } from '../audit';
import { rollbackCampaign } from '../persistence';
import { z } from 'zod';
import { Adjudication, ModelCallResult, ModelCallTrace, TurnNarrative } from '../domain';
import { DEFAULT_MODEL_ROUTES, ModelBudget, ModelGateway, ModelMessage, ModelRole } from '../model';

class PinningGateway implements ModelGateway {
  readonly routes = DEFAULT_MODEL_ROUTES;
  readonly budget = new ModelBudget({ maxUsd: 10, maxRequests: 100, maxInputTokens: 100_000, maxOutputTokens: 100_000 });
  readonly records: Array<{ role: ModelRole; name: string; messages: ModelMessage[] }> = [];
  traceCount() { return this.records.length; }
  tracesSince(index: number): ModelCallTrace[] { return this.records.slice(index).map((record, offset) => ({ id: `pin_${index + offset}`, role: record.role, model: 'test/model', schemaName: record.name, startedAt: '', completedAt: '', status: 'SUCCEEDED', messages: record.messages, rawText: '{}', usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } })); }
  async callJson<T>(role: ModelRole, messages: ModelMessage[], _schema: z.ZodType<T>, name: string): Promise<ModelCallResult<T>> {
    this.records.push({ role, name, messages: structuredClone(messages) });
    const graph = compileDeterministically('Contact Khrushchev through the diplomatic backchannel.', createCubanCampaign(1).state);
    const adjudication: Adjudication = { summary: 'No immediate mechanical effect.', mechanismFindings: graph.mechanisms.map((mechanism) => ({ mechanismId: mechanism.id, engagement: 'ENGAGES', reason: 'A channel exists.', confidence: 'HIGH' })), recommendedEffects: [], outcomeBands: [{ id: 'observed', label: 'Channel tested', probability: 1, effectIds: [], description: 'No immediate state change is observed.' }], assumptions: [], unknowns: [], confidence: 'HIGH' };
    const narrative: TurnNarrative = { title: 'A Channel Tested', immediateOutcome: 'Robert Kennedy tests the channel.', worldReaction: 'No public response is visible.', strategicConsequences: 'The situation remains unsettled.', news: [], advisorReactions: [], detailedReport: 'The private approach is made without a visible response.', pressCoverage: [], updatedStorySummary: 'A private channel was tested.', newCharacters: [], chronicleEntry: 'The channel was tested.', storyThreadUpdates: [] };
    let value: unknown;
    if (name === 'StrategyGraph') value = graph;
    else if (name === 'CompilerFidelity') value = { faithful: true, inventedMechanisms: [], omittedWeaknesses: [], assumedCoordination: [], contradictions: [] };
    else if (name === 'ActorActions') value = { actions: [] };
    else if (name === 'RedTeamFindings') value = { findings: [] };
    else if (name === 'Adjudication' || name === 'IndependentAdjudication') value = adjudication;
    else if (name === 'TurnNarrative') value = narrative;
    else throw new Error(`Unexpected schema ${name}`);
    return { value: value as T, model: 'test/model', usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }, rawText: JSON.stringify(value) };
  }
}

describe('complete deterministic turn pipeline', () => {
  it('compiles, resolves, commits, narrates, and audits without an LLM oracle', async () => {
    const campaign = createCubanCampaign(12345);
    const stages: string[] = [];
    const result = await runTurn(
      campaign,
      'Use the Robert Kennedy backchannel to offer a public non-invasion pledge and privately signal eventual Jupiter missile removal.',
      { persist: false, onProgress: (item) => stages.push(item.stage) },
    );
    expect(result.campaign.state.turn).toBe(1);
    expect(result.campaign.state.revision).toBe(1);
    expect(result.campaign.audits).toHaveLength(1);
    expect(result.audit.auditVersion).toBe(2);
    expect(result.audit.progressEvents.some((item) => item.stage === 'COMMIT' && item.status === 'COMPLETED')).toBe(true);
    expect(result.audit.accessDecisions.length).toBeGreaterThan(0);
    expect(result.audit.actorSimulationPackets.length).toBeGreaterThan(0);
    expect(result.audit.rawDirective).toContain('Robert Kennedy');
    expect(result.audit.dryStrategy.mechanisms.some((item) => item.kind === 'DIPLOMACY')).toBe(true);
    expect(result.audit.randomDraw).toBeGreaterThanOrEqual(0);
    expect(result.audit.randomDraw).toBeLessThan(1);
    expect(result.audit.validation.filter((item) => item.severity === 'ERROR')).toHaveLength(0);
    expect(result.campaign.state.arcs.submarine_contact.progress).toBeGreaterThan(campaign.state.arcs.submarine_contact.progress);
    expect(result.audit.stateChanges.some((change) => change.cause.includes('advances independently'))).toBe(true);
    expect(result.campaign.beliefs.player.beliefs['submarine_contact.progress']).toBeDefined();
    expect(result.campaign.beliefs.actors.khrushchev.beliefs['submarine_contact.progress']).toBeUndefined();
    const nextGraph = compileDeterministically('Continue the diplomatic backchannel with Khrushchev.', result.campaign.state);
    expect(retrievePrecedents(result.campaign, nextGraph).length).toBeGreaterThan(0);
    expect(stages).toEqual(expect.arrayContaining(['COMPILE', 'FEASIBILITY', 'ACTORS', 'RED_TEAM', 'ADJUDICATE', 'UNCERTAINTY', 'COMMIT', 'VALIDATE', 'NARRATE']));
    const reconstructed = reconstructCommittedTurn(result.audit);
    expect(reconstructed.state).toEqual(result.campaign.state);
    expect(reconstructed.beliefs).toEqual(result.campaign.beliefs);
    expect(reconstructed.memories).toEqual(result.campaign.memories);
    const rolledBack = rollbackCampaign(result.campaign, 0);
    expect(rolledBack.state).toEqual(campaign.state);
    expect(rolledBack.audits).toEqual([]);
  });

  it('bypasses uncertainty for a fully controlled resource allocation', async () => {
    const campaign = createCubanCampaign(321);
    const result = await runTurn(campaign, 'Allocate 2 reconnaissance sorties.', { persist: false });
    expect(result.audit.feasibility[0].classification).toBe('CERTAIN');
    expect(result.audit.randomDraw).toBeUndefined();
    expect(result.audit.rngCursorAfter).toBe(result.audit.rngCursorBefore);
    expect(result.campaign.state.resources.recon_sorties.amount).toBe(6);
    expect(result.audit.selectedOutcome.id).toBe('deterministic');
  });

  it('never converts a demand into compliance, however forcefully it is issued', async () => {
    const campaign = createCubanCampaign(654);
    const result = await runTurn(campaign, 'Order Khrushchev to surrender immediately.', { persist: false });
    // The demand is issued — it is speech the president can perform.
    expect(result.audit.feasibility[0].controlMode).toBe('INFLUENCE');
    expect(result.audit.feasibility[0].reinterpretedAs).toBe('DEMAND');
    // But nothing may commit the surrender: no status change, no capitulation,
    // and no roll that could manufacture one.
    expect(result.audit.stateChanges.some((change) =>
      change.targetId === 'khrushchev' && change.field === 'status')).toBe(false);
    expect(result.audit.stateChanges.some((change) =>
      change.targetType === 'GOAL')).toBe(false);
    const surrenderEffects = result.audit.adjudication.recommendedEffects.filter((effect) =>
      /surrender|capitulat|withdraw the missiles/i.test(effect.cause));
    expect(surrenderEffects).toHaveLength(0);
  });

  it('still refuses a lottery for an act that genuinely cannot be performed', async () => {
    const result = await runTurn(createCubanCampaign(655), 'Launch a carrier air wing strike on the SAM site.', { persist: false });
    const finding = result.audit.feasibility[0];
    expect(finding.classification).toBe('IMPOSSIBLE');
    expect(finding.executable).toBe(false);
    expect(result.audit.stateChanges.filter((change) => change.sourceEffectId.includes('_m1_'))).toHaveLength(0);
  });

  it('matures a delayed process exactly once', async () => {
    const campaign = createCubanCampaign(987);
    campaign.state.pendingProcesses.test_process = {
      id: 'test_process',
      label: 'Prepared diplomatic initiative',
      ownerId: 'kennedy',
      dueTurn: 1,
      progress: 0,
      requiredProgress: 100,
      onMature: [{
        id: 'mature_test_process', mechanismId: 'test_process', targetType: 'METRIC', targetId: 'diplomatic_space', field: 'value',
        direction: 'POSITIVE', impactClass: 'MINOR', confidence: 'HIGH', engagement: 'ENGAGES_STRONGLY', cause: 'The prepared initiative matured.', dependencies: [],
      }],
      perTurnEffects: [],
      participantIds: ['kennedy'],
      detectableBy: ['kennedy'],
      visibility: { classification: 'PLAYER_KNOWN', actorIds: ['kennedy'], discoverable: true, declassifyOnGameOver: true },
      completed: false,
    };
    const first = await runTurn(campaign, 'Order Khrushchev to surrender immediately.', { persist: false });
    const afterFirst = first.campaign.state.metrics.diplomatic_space;
    expect(first.campaign.state.pendingProcesses.test_process.completed).toBe(true);
    const second = await runTurn(first.campaign, 'Order Khrushchev to surrender immediately.', { persist: false });
    expect(second.campaign.state.metrics.diplomatic_space).toBe(afterFirst);
  });

  it('pins rhetoric to compiler, red team, and post-commit narration only', async () => {
    const gateway = new PinningGateway();
    const result = await runTurn(createCubanCampaign(988), 'XRHETORICX Contact Khrushchev through the diplomatic backchannel.', { gateway, persist: false });
    const protectedRoles = new Set<ModelRole>(['adjudicator', 'actor_standard', 'actor_deep', 'deep_second_opinion', 'validator']);
    for (const trace of result.audit.modelCalls.filter((item) => protectedRoles.has(item.role as ModelRole))) {
      expect(JSON.stringify(trace.messages)).not.toContain('XRHETORICX');
    }
    expect(gateway.records.some((record) => record.name === 'RedTeamFindings' && JSON.stringify(record.messages).includes('XRHETORICX'))).toBe(true);
    expect(gateway.records.some((record) => record.name === 'TurnNarrative' && JSON.stringify(record.messages).includes('XRHETORICX'))).toBe(true);
  });
});
