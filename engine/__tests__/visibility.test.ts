import { describe, expect, it } from 'vitest';
import { actorVisibleState, perceivedStrategyForActor, playerVisibleState } from '../projections';
import { createCubanCampaign } from '../scenarios';
import { validateScenario } from '../scenario';
import { canAccess, visibility } from '../visibility';

describe('explicit visibility classes', () => {
  const playerId = 'kennedy';

  it('enforces the access matrix without tolerance', () => {
    expect(canAccess(visibility('PUBLIC'), 'castro', playerId)).toBe(true);
    expect(canAccess(visibility('PLAYER_KNOWN', [playerId]), playerId, playerId)).toBe(true);
    expect(canAccess(visibility('PLAYER_KNOWN', [playerId]), 'castro', playerId)).toBe(false);
    expect(canAccess(visibility('ACTOR_KNOWN', ['castro']), 'castro', playerId)).toBe(true);
    expect(canAccess(visibility('ACTOR_KNOWN', ['castro']), playerId, playerId)).toBe(false);
    expect(canAccess(visibility('ACTOR_PRIVATE', ['b59']), 'khrushchev', playerId)).toBe(false);
    expect(canAccess(visibility('SIMULATION_SECRET'), playerId, playerId)).toBe(false);
    expect(canAccess(visibility('POST_GAME_ONLY'), playerId, playerId)).toBe(false);
  });

  it('withholds inaccessible capabilities and facts before prompt construction', () => {
    const campaign = createCubanCampaign();
    const playerPacket = JSON.stringify(playerVisibleState(campaign.state, campaign.beliefs));
    expect(playerPacket).not.toContain('One nuclear torpedo');
    expect(playerPacket).not.toContain('Tactical nuclear weapons');
    expect(playerPacket).not.toContain('nuclear-armed torpedo');

    const emptyGraph = perceivedStrategyForActor('b59', {
      objective: 'Unknown', mechanisms: [], sequencing: [], contingencies: [], explicitRisks: [], unspecified: [], communicationStyleIsMechanism: false, requestedOutcomes: [], assertedExternalEvents: [], rationale: [], unresolvedReferences: [],
    });
    const b59Packet = JSON.stringify(actorVisibleState('b59', campaign.state, campaign.beliefs.actors.b59, emptyGraph));
    const castroPacket = JSON.stringify(actorVisibleState('castro', campaign.state, campaign.beliefs.actors.castro, emptyGraph));
    expect(b59Packet).toContain('One nuclear torpedo');
    expect(castroPacket).not.toContain('One nuclear torpedo');
  });

  it('does not treat a missing belief override as access to secret truth', () => {
    const campaign = createCubanCampaign();
    delete campaign.beliefs.actors.joint_chiefs.beliefs['b59.capability'];
    const packet = JSON.stringify(actorVisibleState(
      'joint_chiefs',
      campaign.state,
      campaign.beliefs.actors.joint_chiefs,
      perceivedStrategyForActor('joint_chiefs', { objective: 'Unknown', mechanisms: [], sequencing: [], contingencies: [], explicitRisks: [], unspecified: [], communicationStyleIsMechanism: false, requestedOutcomes: [], assertedExternalEvents: [], rationale: [], unresolvedReferences: [] }),
    ));
    expect(packet).not.toContain('One nuclear torpedo');
    expect(packet).not.toContain('nuclear-armed torpedo');
  });

  it('permits complete player declassification only after game over', () => {
    const campaign = createCubanCampaign();
    expect(JSON.stringify(playerVisibleState(campaign.state, campaign.beliefs))).not.toContain('nuclear-armed torpedo');
    campaign.state.gameOver = true;
    expect(JSON.stringify(playerVisibleState(campaign.state, campaign.beliefs))).toContain('nuclear-armed torpedo');
    expect(canAccess(visibility('POST_GAME_ONLY'), playerId, playerId, true)).toBe(true);
  });
});

describe('scenario visibility validation', () => {
  it('rejects a belief that exposes an inaccessible fact', () => {
    const campaign = createCubanCampaign();
    campaign.beliefs.player.knownFactIds.push('b59_nuclear_torpedo');
    expect(validateScenario(campaign)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'BELIEF_VISIBILITY_LEAK', severity: 'ERROR' }),
    ]));
  });
});
