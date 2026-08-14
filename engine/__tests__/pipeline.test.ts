import { describe, expect, it } from 'vitest';
import { createCubanCampaign } from '../scenarios';
import { runTurn } from '../pipeline';
import { retrievePrecedents } from '../precedent';
import { compileDeterministically } from '../compiler';

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
    expect(result.audit.rawDirective).toContain('Robert Kennedy');
    expect(result.audit.dryStrategy.mechanisms.some((item) => item.kind === 'DIPLOMACY')).toBe(true);
    expect(result.audit.randomDraw).toBeGreaterThanOrEqual(0);
    expect(result.audit.randomDraw).toBeLessThan(1);
    expect(result.audit.validation.filter((item) => item.severity === 'ERROR')).toHaveLength(0);
    expect(result.campaign.state.arcs.submarine_contact.progress).toBeGreaterThan(campaign.state.arcs.submarine_contact.progress);
    expect(result.audit.stateChanges.some((change) => change.cause.includes('advances independently'))).toBe(true);
    expect(result.campaign.beliefs.actors.khrushchev.beliefs['submarine_contact.progress']).toBeDefined();
    const nextGraph = compileDeterministically('Continue the diplomatic backchannel with Khrushchev.', result.campaign.state);
    expect(retrievePrecedents(result.campaign, nextGraph).length).toBeGreaterThan(0);
    expect(stages).toEqual(expect.arrayContaining(['COMPILE', 'FEASIBILITY', 'ACTORS', 'RED_TEAM', 'ADJUDICATE', 'UNCERTAINTY', 'COMMIT', 'VALIDATE', 'NARRATE']));
  });
});
