import { describe, expect, it } from 'vitest';
import { calibratedMagnitude } from '../calibration';
import { checkFeasibility, compileDeterministically } from '../compiler';
import { resolveDetection } from '../detection';
import { buildNarrativePacket } from '../narrative';
import { buildOptionPrompt } from '../options';
import { runTurn } from '../pipeline';
import { perceivedStrategyForActor } from '../projections';
import { createCubanCampaign, createTwilightCampaign } from '../scenarios';
import { validateScenario } from '../scenario';
import { buildConsoleModel } from '../viewModel';
import { OutcomeBand, StrategyGraph } from '../domain';

const concealedGraph: StrategyGraph = {
  objective: 'Build a private coalition',
  mechanisms: [{ id: 'secret', kind: 'COALITION_BUILDING', objective: 'Recruit quietly', targetIds: ['khrushchev'], actorIds: ['kennedy'], dependencies: [], assumptions: [], sequence: 0, durationTurns: 1, resourceClaims: [], specifiedDetail: 'private recruitment', concealed: true }],
  sequencing: [], contingencies: [], explicitRisks: [], unspecified: [], communicationStyleIsMechanism: false, requestedOutcomes: [], assertedExternalEvents: [], rationale: [], unresolvedReferences: [],
};

describe('completion invariants', () => {
  it('keeps console, option, and narrator inputs byte-identical across hidden-fact variants', () => {
    const first = createCubanCampaign(300);
    const second = structuredClone(first);
    second.state.facts.tactical_nukes_cuba.statement = 'XRHIDDENX materially different secret';
    expect(JSON.stringify(buildConsoleModel(first))).toBe(JSON.stringify(buildConsoleModel(second)));
    expect(JSON.stringify(buildOptionPrompt(first))).toBe(JSON.stringify(buildOptionPrompt(second)));
    const outcome: OutcomeBand = { id: 'mixed', label: 'Mixed', probability: 1, effectIds: [], description: 'A hidden-sensitive omniscient description must not be forwarded.' };
    const firstPacket = buildNarrativePacket(first, first.state, 'Hold position.', concealedGraph, outcome, [], [], []);
    const secondPacket = buildNarrativePacket(second, second.state, 'Hold position.', concealedGraph, outcome, [], [], []);
    expect(JSON.stringify(firstPacket)).toBe(JSON.stringify(secondPacket));
    expect(JSON.stringify(firstPacket)).not.toContain('omniscient description');
    expect(JSON.stringify(firstPacket)).not.toContain('XRHIDDENX');
  });

  it('makes concealment risky without making detection certain', () => {
    const campaign = createCubanCampaign(301);
    campaign.state.entities.khrushchev.capabilities.push('intelligence collection service');
    campaign.state.entities.castro.capabilities = campaign.state.entities.castro.capabilities.filter((item) => !/intelligence|recon|surveil/i.test(item));
    let withIntel = 0;
    let withoutIntel = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = resolveDetection(concealedGraph, ['khrushchev', 'castro'], campaign.state, seed, 0);
      withIntel += Number(result.records.find((item) => item.actorId === 'khrushchev')?.detected);
      withoutIntel += Number(result.records.find((item) => item.actorId === 'castro')?.detected);
    }
    expect(withIntel / 200).toBeGreaterThanOrEqual(0.25);
    expect(withIntel / 200).toBeLessThanOrEqual(0.6);
    expect(withoutIntel / 200).toBeGreaterThanOrEqual(0.05);
    expect(withoutIntel / 200).toBeLessThanOrEqual(0.3);
    expect(perceivedStrategyForActor('khrushchev', concealedGraph).mechanisms).toHaveLength(0);
    expect(perceivedStrategyForActor('khrushchev', concealedGraph, concealedGraph.mechanisms).mechanisms).toHaveLength(1);
  });

  it('executes scenario hard rules and conditional authority', () => {
    const cmc = createCubanCampaign(302);
    cmc.state.resources.recon_sorties.amount = 0;
    expect(checkFeasibility(compileDeterministically('Allocate 1 reconnaissance sortie.', cmc.state), cmc.state)[0].classification).toBe('IMPOSSIBLE');
    cmc.state.metrics.command_control = 20;
    const military = compileDeterministically('Order the Joint Chiefs to launch a limited strike.', cmc.state);
    expect(checkFeasibility(military, cmc.state).some((finding) => finding.classification === 'IMPOSSIBLE')).toBe(true);

    const twilight = createTwilightCampaign(303);
    twilight.state.resources.legal_teams.amount = 0;
    expect(checkFeasibility(compileDeterministically('File an injunction in federal court.', twilight.state), twilight.state)[0].classification).toBe('IMPOSSIBLE');
    expect(checkFeasibility(compileDeterministically('Order the governors to refuse the federal demand.', twilight.state), twilight.state)[0].classification).toBe('IMPOSSIBLE');
  });

  it('lets scenario calibration change otherwise identical magnitudes', () => {
    const low = createCubanCampaign(304);
    const high = structuredClone(low);
    low.state.manifest.calibrationRules.unshift({ id: 'low', targetId: 'diplomatic_space', allowedImpactClasses: ['MODERATE'], defaultImpactClass: 'TRIVIAL', rationale: 'Deliberately low test calibration.' });
    high.state.manifest.calibrationRules.unshift({ id: 'high', targetId: 'diplomatic_space', allowedImpactClasses: ['MODERATE'], defaultImpactClass: 'SYSTEMIC', rationale: 'Deliberately high test calibration.' });
    expect(calibratedMagnitude('MODERATE', 'HIGH', low.state, 'diplomatic_space'))
      .toBeLessThan(calibratedMagnitude('MODERATE', 'HIGH', high.state, 'diplomatic_space'));
  });

  it('ships full narrative packages for both supported scenarios', () => {
    for (const campaign of [createCubanCampaign(305), createTwilightCampaign(306)]) {
      expect(validateScenario(campaign).filter((issue) => issue.severity === 'ERROR')).toEqual([]);
      expect(campaign.state.manifest.narrativeWorld?.openingScene.split(/\s+/).length).toBeGreaterThan(100);
      expect(campaign.state.manifest.narrativeWorld?.sourceMaterialRef).toContain('legacy-scenarios');
      expect(campaign.state.manifest.advisors.length).toBeGreaterThanOrEqual(3);
      expect(campaign.state.manifest.advisors.every((advisor) => advisor.voice && advisor.personalStakes && advisor.recurringTension)).toBe(true);
    }
  });

  it('commits independent actor initiative through validated effects', async () => {
    let campaign = createTwilightCampaign(307);
    for (let turn = 0; turn < 5; turn += 1) {
      const result = await runTurn(campaign, 'Contact the civil-rights coalition and recruit governors privately.', { persist: false });
      campaign = result.campaign;
    }
    const initiativeActions = campaign.audits.flatMap((audit) => audit.actorActions.filter((action) => action.initiative));
    const initiativeChanges = campaign.audits.flatMap((audit) => audit.stateChanges.filter((change) => change.cause.includes('acts on its own initiative')));
    expect(initiativeActions.length).toBeGreaterThanOrEqual(2);
    expect(initiativeChanges.length).toBeGreaterThanOrEqual(1);
    expect(initiativeActions.every((action) => action.capabilityIdsUsed.every((capability) => campaign.state.entities[action.actorId].capabilities.includes(capability)))).toBe(true);
  });

  it('redacts hidden-fact language from player-visible actor events', () => {
    const campaign = createCubanCampaign(308);
    const hiddenStatement = campaign.state.facts.tactical_nukes_cuba.statement;
    const packet = buildNarrativePacket(
      campaign,
      campaign.state,
      'Hold position.',
      concealedGraph,
      { id: 'mixed', label: 'Mixed', probability: 1, effectIds: ['actor-visible'], description: 'Mixed result.' },
      [{ sourceEffectId: 'actor-visible', explanation: 'Soviet command activity becomes observable.' }],
      [{
        actorId: 'khrushchev', objective: 'Protect Soviet forces', action: hiddenStatement,
        mechanisms: ['Independent action'], perceivedPlayerMechanismIds: [], beliefKeysUsed: [],
        capabilityIdsUsed: ['direct line to Soviet Presidium'], confidence: 'MEDIUM', initiative: true,
      }],
      [{
        id: 'actor-visible', mechanismId: 'actor:khrushchev', targetType: 'METRIC', targetId: 'nuclear_tension',
        field: 'value', direction: 'POSITIVE', impactClass: 'TRIVIAL', confidence: 'MEDIUM', engagement: 'ENGAGES_WEAKLY',
        cause: 'Observable Soviet command activity.', dependencies: [], actorId: 'khrushchev', proposedDelta: 1,
      }],
    );
    expect(JSON.stringify(packet)).not.toContain(hiddenStatement);
    expect(packet.visibleActorEvents[0]?.action).toContain('protected details remain outside');
  });
});
