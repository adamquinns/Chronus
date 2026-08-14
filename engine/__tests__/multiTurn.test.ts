import { describe, expect, it } from 'vitest';
import { Campaign } from '../domain';
import { reconstructCommittedTurn } from '../audit';
import { runTurn } from '../pipeline';
import { createCoalitionCampaign, createMilitaryCampaign } from '../curatedScenarios';
import { createCubanCampaign } from '../scenarios';
import { validateScenario } from '../scenario';

const runScript = async (initial: Campaign, directives: string[]) => {
  let campaign = initial;
  for (const directive of directives) {
    const result = await runTurn(campaign, directive, { persist: false });
    campaign = result.campaign;
    expect(result.audit.validation.filter((issue) => issue.severity === 'ERROR')).toEqual([]);
    expect(reconstructCommittedTurn(result.audit).state).toEqual(campaign.state);
    expect(result.audit.actorActions.every((action) => action.capabilityIdsUsed.every((capability) => campaign.state.entities[action.actorId]?.capabilities.includes(capability)))).toBe(true);
    const unauthorizedPackets = result.audit.actorSimulationPackets.filter((packet) => !['b59', 'khrushchev'].includes(packet.actorId));
    expect(JSON.stringify(unauthorizedPackets)).not.toContain('nuclear-armed torpedo');
    expect(Object.values(campaign.state.resources).every((resource) => resource.amount >= 0)).toBe(true);
  }
  return campaign;
};

describe('mandatory multi-turn regression suites', () => {
  it('keeps the Cuban Missile Crisis coherent for 12 turns', async () => {
    const directives = Array.from({ length: 12 }, (_, index) => index < 8
      ? 'Allocate 1 reconnaissance sortie.'
      : 'Contact Khrushchev through the Robert Kennedy backchannel.');
    const campaign = await runScript(createCubanCampaign(101), directives);
    expect(campaign.audits).toHaveLength(12);
    expect(campaign.state.rngCursor).toBeLessThan(12);
    expect(campaign.memories.khrushchev.events.length).toBeGreaterThan(0);
  });

  it('preserves coalition relationships, precedents, hidden deals, and objective continuity for 15 turns', async () => {
    const directives = Array.from({ length: 15 }, () => 'Recruit Governor Vale while keeping labor and business coordination private.');
    const campaign = await runScript(createCoalitionCampaign(102), directives);
    expect(campaign.audits).toHaveLength(15);
    expect(campaign.state.facts.federal_grant_threat.visibility.actorIds).not.toContain('organizer');
    expect(campaign.audits.at(-1)!.precedents.some((item) => item.source === 'INTERNAL')).toBe(true);
  });

  it('preserves military logistics, force capability, hidden reserves, and delayed arcs for 12 turns', async () => {
    const directives = Array.from({ length: 12 }, () => 'Order 1st Division to hold the central valley while engineers protect the supply corridor.');
    const campaign = await runScript(createMilitaryCampaign(103), directives);
    expect(campaign.audits).toHaveLength(12);
    expect(campaign.state.resources.enemy_reserve.amount).toBe(2);
    expect(campaign.beliefs.player.knownFactIds).not.toContain('enemy_reserve_hidden');
  });

  it('runs an accepted custom-package world for 10+ turns without corrupting its schema', async () => {
    const custom = createCoalitionCampaign(104);
    custom.state.manifest.id = 'custom_generated_fixture';
    custom.state.manifest.title = 'Validated Custom Coalition';
    custom.state.campaignId = 'custom_generated_fixture_104';
    expect(validateScenario(custom).filter((issue) => issue.severity === 'ERROR')).toEqual([]);
    const campaign = await runScript(custom, Array.from({ length: 10 }, () => 'Announce a narrow public defense of state consultation rights.'));
    expect(campaign.audits).toHaveLength(10);
    expect(campaign.state.schemaVersion).toBe(2);
    expect(campaign.state.manifest.calibrationRules.length).toBeGreaterThan(0);
  });

  it('avoids narrative fatigue markers and uncontrolled length across sustained play', async () => {
    const campaign = await runScript(createMilitaryCampaign(105), Array.from({ length: 10 }, () => 'Order 1st Division to hold position.'));
    const prose = campaign.audits.map((audit) => `${audit.narrative.title} ${audit.narrative.immediateOutcome} ${audit.narrative.worldReaction}`);
    expect(prose.every((item) => item.split(/\s+/).length < 220)).toBe(true);
    expect(prose.filter((item) => /historic|unprecedented|destiny|shocking/i.test(item))).toHaveLength(0);
  });
});
