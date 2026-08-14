import { describe, expect, it } from 'vitest';
import { exportCampaign, importCampaign, rollbackCampaign } from '../persistence';
import { runTurn } from '../pipeline';
import { createCubanCampaign } from '../scenarios';
import { migrateCampaign } from '../scenario';

describe('structured persistence, migration, and recovery', () => {
  it('round-trips the complete versioned campaign package', async () => {
    const result = await runTurn(createCubanCampaign(301), 'Allocate 1 reconnaissance sortie.', { persist: false });
    const restored = importCampaign(exportCampaign(result.campaign));
    expect(restored).toEqual(result.campaign);
  });

  it('rolls back to an exact committed snapshot without retaining future audits', async () => {
    const first = await runTurn(createCubanCampaign(302), 'Allocate 1 reconnaissance sortie.', { persist: false });
    const second = await runTurn(first.campaign, 'Contact Khrushchev through the backchannel.', { persist: false });
    const rolledBack = rollbackCampaign(second.campaign, 1);
    expect(rolledBack).toEqual(first.campaign);
  });

  it('honestly marks legacy audits whose exact snapshots never existed', () => {
    const campaign = createCubanCampaign(303);
    const legacy = structuredClone(campaign) as unknown as Record<string, unknown>;
    const state = (legacy.state as { schemaVersion: number });
    state.schemaVersion = 1;
    const migrated = migrateCampaign(legacy as never);
    expect(migrated.state.schemaVersion).toBe(2);
    expect(migrated.state.manifest.unresolvedUncertainties.length).toBeGreaterThan(0);
  });
});
