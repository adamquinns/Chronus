import { describe, expect, it } from 'vitest';
import { consultAdvisors } from '../advisors';
import { ChronusSimulationEngine } from '../api';
import { createCubanCampaign } from '../scenarios';

describe('advisor consultation and situation-room safety', () => {
  it('returns biased, bounded advice without advancing or mutating the campaign', async () => {
    const campaign = createCubanCampaign(401);
    const snapshot = structuredClone(campaign);
    const answers = await consultAdvisors(campaign, 'What are we underestimating?');
    expect(answers).toHaveLength(campaign.state.manifest.advisors.length);
    expect(answers.every((answer) => answer.biasDisclosure.length > 0)).toBe(true);
    expect(JSON.stringify(answers)).not.toContain('nuclear-armed torpedo');
    expect(campaign).toEqual(snapshot);
  });

  it('is available through the narrow UI-independent simulation API', async () => {
    const campaign = createCubanCampaign(402);
    const engine = new ChronusSimulationEngine();
    const answers = await engine.consult(campaign, 'What is the central tradeoff?');
    expect(answers.length).toBeGreaterThan(0);
    expect(campaign.state.turn).toBe(0);
  });
});
