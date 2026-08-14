import { describe, expect, it } from 'vitest';
import { createCubanCampaign } from '../scenarios';
import { runTurn } from '../pipeline';
import { retrievePrecedents } from '../precedent';
import { compileDeterministically } from '../compiler';
import { reconstructCommittedTurn } from '../audit';
import { rollbackCampaign } from '../persistence';

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

  it('does not give an impossible command a lottery chance', async () => {
    const campaign = createCubanCampaign(654);
    const result = await runTurn(campaign, 'Order Khrushchev to surrender immediately.', { persist: false });
    expect(result.audit.feasibility[0].classification).toBe('IMPOSSIBLE');
    expect(result.audit.randomDraw).toBeUndefined();
    expect(result.audit.rngCursorAfter).toBe(result.audit.rngCursorBefore);
    expect(result.audit.selectedOutcome.id).toBe('no_feasible_effect');
    expect(result.audit.stateChanges.filter((change) => change.sourceEffectId.startsWith('e_'))).toHaveLength(0);
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
});
