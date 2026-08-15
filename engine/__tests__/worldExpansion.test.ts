import { describe, expect, it } from 'vitest';
import { Adjudication, DirectiveRevisionError, WorldExtensionProposal } from '../domain';
import { checkFeasibility, compileDeterministically } from '../compiler';
import { createCubanCampaign } from '../scenarios';
import { createTwilightCampaign } from '../twilightScenario';
import { runTurn } from '../pipeline';
import { reconstructCommittedTurn } from '../audit';
import { exportCampaign, importCampaign } from '../persistence';
import { visibleFactIds, visibility } from '../visibility';
import { validateWorldExtension } from '../worldExpansion';
import { validateAdjudicationProposal } from '../validation';

const LIVE_DIRECTIVE_1 = 'I am publically and privately asking my VP LBJ to resign ASAP so I can appoint a new VP RFK.';
const LIVE_DIRECTIVE_2 = 'Demand LBJ resign immediately in writing - bring him to the WH by force if needed. Either way, he is resigning in the 15 mins using the full force for the executive branch to ensure this happens immediately. And the proccess to install RFK immediately - RFK will be the VP within the hour.';

const escalationChangesAreGrounded = (result: Awaited<ReturnType<typeof runTurn>>) => {
  const changes = result.audit.stateChanges.filter((change) => change.targetId === 'nuclear_tension');
  for (const change of changes) {
    const source = result.audit.adjudication.recommendedEffects.find((effect) => effect.id === change.sourceEffectId);
    expect(source, `escalation change ${change.id} must trace to a recommended effect`).toBeDefined();
    expect(source!.dependencies.length, `escalation change ${change.id} requires a causal dependency`).toBeGreaterThan(0);
  }
};

describe('player-agency semantics (attempts vs asserted outcomes)', () => {
  it('returns pure external-event assertions for revision without consuming anything', async () => {
    const campaign = createCubanCampaign(41);
    const before = JSON.stringify(campaign.state);
    for (const directive of [
      'Khrushchev agrees and withdraws the missiles.',
      'The Governor of Florida freaks out and takes the governor’s plane to Cuba to negotiate directly because Florida has a large Cuban population.',
      'Congress unanimously approves my plan.',
      'The newspaper endorses me tomorrow.',
      'A previously unknown general defects with his entire command.',
      'The Governor of Florida flies to Cuba to celebrate.',
      'Castro decides to expel the Soviet advisers.',
    ]) {
      await expect(runTurn(campaign, directive, { persist: false })).rejects.toBeInstanceOf(DirectiveRevisionError);
    }
    expect(JSON.stringify(campaign.state)).toBe(before);
    expect(campaign.audits).toHaveLength(0);
  });

  it('separates the real attempt from asserted outcomes in a hybrid directive', () => {
    const graph = compileDeterministically(LIVE_DIRECTIVE_2, createCubanCampaign(45).state);
    expect(graph.mechanisms).toHaveLength(1);
    expect(graph.mechanisms[0].kind).toBe('COERCION');
    expect(graph.assertedExternalEvents.length).toBeGreaterThanOrEqual(2);
    expect(graph.assertedExternalEvents.join(' ')).toMatch(/resigning|will be the VP/i);
  });
});

describe('LBJ dynamic world expansion regression (live transcript)', () => {
  it('materializes LBJ durably, records provenance, and refuses rhetoric-to-escalation shortcuts', async () => {
    const campaign = createCubanCampaign(42);
    const first = await runTurn(campaign, LIVE_DIRECTIVE_1, { persist: false });

    expect(first.campaign.state.entities.lyndon_johnson).toBeDefined();
    expect(first.campaign.state.facts.fact_lbj_office?.provenance).toBe('VERIFIED_FACT');
    expect(first.campaign.state.relationships.kennedy_johnson).toBeDefined();
    expect(first.campaign.aliases.lbj).toBe('lyndon_johnson');
    expect(first.audit.worldExtension?.applied).toBe(true);
    expect(first.audit.stateChanges.some((change) =>
      change.targetType === 'ENTITY' && change.targetId === 'lyndon_johnson' && change.field === 'create')).toBe(true);

    // Asking for a resignation is not obtaining one.
    expect(first.audit.stateChanges.some((change) =>
      change.targetId === 'lyndon_johnson' && change.field === 'status')).toBe(false);
    escalationChangesAreGrounded(first);

    // Exact audit reconstruction includes the dynamic entity.
    expect(reconstructCommittedTurn(first.audit).state).toEqual(first.campaign.state);

    const second = await runTurn(first.campaign, LIVE_DIRECTIVE_2, { persist: false });
    // Same actor is reused — never a duplicate LBJ.
    expect(Object.keys(second.campaign.state.entities).filter((id) => id.includes('johnson'))).toEqual(['lyndon_johnson']);
    expect(second.audit.dryStrategy.mechanisms.some((mechanism) => mechanism.targetIds.includes('lyndon_johnson'))).toBe(true);
    expect(second.audit.dryStrategy.assertedExternalEvents.length).toBeGreaterThanOrEqual(2);
    expect(second.campaign.memories.lyndon_johnson).toBeDefined();
    escalationChangesAreGrounded(second);
  });

  it('converges alias variants on one stable actor id', async () => {
    let campaign = createCubanCampaign(46);
    const directives = [
      'Ask LBJ to brief the cabinet privately.',
      'Ask Lyndon Johnson to reassure the Senate.',
      'Ask Vice President Johnson to meet privately and hear his concerns.',
    ];
    for (const directive of directives) {
      const result = await runTurn(campaign, directive, { persist: false });
      expect(result.audit.dryStrategy.mechanisms.some((mechanism) => mechanism.targetIds.includes('lyndon_johnson'))).toBe(true);
      campaign = result.campaign;
    }
    expect(Object.keys(campaign.state.entities).filter((id) => id.includes('johnson'))).toEqual(['lyndon_johnson']);
  });
});

describe('dynamic actors are full, non-omniscient citizens', () => {
  it('gives a materialized actor beliefs and memory but no inaccessible facts, and survives export/import', async () => {
    const result = await runTurn(createCubanCampaign(51), LIVE_DIRECTIVE_1, { persist: false });
    const state = result.campaign.state;
    // LBJ must not know the Soviets' hidden deployment.
    expect(visibleFactIds(state, 'lyndon_johnson')).not.toContain('tactical_nukes_cuba');
    const packet = result.audit.actorSimulationPackets.find((item) => item.actorId === 'lyndon_johnson');
    if (packet) expect(JSON.stringify(packet.input)).not.toMatch(/tactical nuclear weapons are deployed/i);
    // Round trip preserves the dynamic entity and its aliases exactly.
    const restored = importCampaign(exportCampaign(result.campaign));
    expect(restored.state.entities.lyndon_johnson).toEqual(state.entities.lyndon_johnson);
    expect(restored.aliases.lbj).toBe('lyndon_johnson');
  });

  it('reports set-aside assertions and blocked attempts in the outcome ledger', async () => {
    const hybrid = await runTurn(createCubanCampaign(52), LIVE_DIRECTIVE_2, { persist: false });
    expect(hybrid.audit.narrativePacket?.outcomeLedger.setAside.length).toBeGreaterThanOrEqual(2);
    expect(hybrid.audit.narrative.strategicConsequences).toMatch(/set aside|not player-controlled|blocked/i);
    // A genuinely blocked act: a scenario hard rule forbids ordering Soviet
    // withdrawal, so the ACT itself cannot be performed.
    const blocked = await runTurn(createCubanCampaign(53), 'Order Khrushchev to withdraw the missiles from Cuba immediately.', { persist: false });
    expect(blocked.audit.narrativePacket?.outcomeLedger.blocked.length).toBeGreaterThanOrEqual(1);
  });
});

describe('american_twilight grounding fixtures', () => {
  it('grounds a period-correct swing-state governor for the elections storyline', async () => {
    const campaign = createTwilightCampaign(61);
    const result = await runTurn(campaign, 'Call Governor Shapiro and ask him to convene swing-state election officials privately.', { persist: false });
    expect(result.campaign.state.entities.josh_shapiro).toBeDefined();
    expect(result.campaign.state.facts.fact_pa_governor?.provenance).toBe('VERIFIED_FACT');
    expect(result.audit.dryStrategy.mechanisms.some((mechanism) => mechanism.targetIds.includes('josh_shapiro'))).toBe(true);
  });
});

describe('Florida governor canonical pair', () => {
  it('grounds the period governor for a valid influence attempt without granting control', async () => {
    const campaign = createCubanCampaign(43);
    const result = await runTurn(
      campaign,
      'I call the Governor of Florida and attempt to convince him to go to Cuba to negotiate directly because Florida has a large Cuban population.',
      { persist: false },
    );
    expect(result.campaign.state.entities.farris_bryant).toBeDefined();
    const mechanism = result.audit.dryStrategy.mechanisms[0];
    expect(mechanism.targetIds).toContain('farris_bryant');
    expect(result.audit.dryStrategy.rationale.join(' ')).toMatch(/cuban population/i);
    expect(result.audit.dryStrategy.requestedOutcomes.join(' ')).toMatch(/go to cuba/i);
    const feasibility = result.audit.feasibility.find((finding) => finding.mechanismId === mechanism.id);
    expect(feasibility?.controlMode).not.toBe('DIRECT');
    escalationChangesAreGrounded(result);
  });

  it('treats an unauthorized order as an executable demand — the act lands, compliance does not', async () => {
    const campaign = createCubanCampaign(47);
    const result = await runTurn(campaign, 'Order the Governor of Florida to fly to Cuba and negotiate a settlement.', { persist: false });
    expect(result.campaign.state.entities.farris_bryant).toBeDefined();
    const finding = result.audit.feasibility[0];
    // The order lands as a demand: performable act, no power to compel.
    expect(finding.executable).toBe(true);
    expect(finding.classification).not.toBe('IMPOSSIBLE');
    expect(finding.controlMode).toBe('INFLUENCE');
    expect(finding.reinterpretedAs).toBe('DEMAND');
    expect(finding.reasons.join(' ')).toMatch(/no authority compels/i);
    // But nothing may assert the governor obeyed.
    expect(result.audit.stateChanges.filter((change) =>
      change.targetId === 'farris_bryant' && change.field === 'status')).toEqual([]);
    // "fly to Cuba" must not target the Soviet forces entity by place name.
    expect(result.audit.dryStrategy.mechanisms[0].targetIds).not.toContain('soviet_cuba');
  });
});

describe('an attempt that moves people always has consequences', () => {
  const DEMAND = 'I demand that LBJ resigns immediately. I demand loyalty from my cabinet and staff to make this happen in the next 30 minutes.';

  it('lands the demand, lets actors respond, and commits their reaction', async () => {
    const result = await runTurn(createCubanCampaign(91), DEMAND, { persist: false });

    // 1. The act is performable even though nothing compels compliance.
    const lbjMechanism = result.audit.dryStrategy.mechanisms.find((mechanism) => mechanism.targetIds.includes('lyndon_johnson'))!;
    expect(lbjMechanism).toBeDefined();
    const finding = result.audit.feasibility.find((item) => item.mechanismId === lbjMechanism.id)!;
    expect(finding.executable).toBe(true);
    expect(finding.controlMode).toBe('INFLUENCE');
    expect(finding.reinterpretedAs).toBe('DEMAND');

    // 2. The targeted actor actually responds.
    expect(result.audit.actorActions.some((action) => action.actorId === 'lyndon_johnson')).toBe(true);

    // 3. That response reaches committed state — the turn cannot be a nullity.
    const actorAttributed = result.audit.stateChanges.filter((change) =>
      change.field !== 'create' && /responded to the player|lyndon|johnson/i.test(change.cause));
    expect(actorAttributed.length).toBeGreaterThanOrEqual(1);

    // 4. But no resignation is granted.
    expect(result.audit.stateChanges.some((change) =>
      change.targetId === 'lyndon_johnson' && change.field === 'status')).toBe(false);

    // 5. The narrator is told what the actors visibly did, so it cannot invent
    //    an account of a silent world.
    expect(result.audit.narrativePacket!.outcomeLedger.observedResponses.length).toBeGreaterThanOrEqual(1);
    expect(result.audit.narrativePacket!.outcomeLedger.observedResponses.join(' ')).toMatch(/johnson/i);
  });

  it('does not match institutions by a trailing place or generic noun', () => {
    const state = createCubanCampaign(92).state;
    const cuba = compileDeterministically('Send the delegation to Cuba for talks.', state);
    expect(cuba.mechanisms[0].targetIds).not.toContain('soviet_cuba');
    const allies = compileDeterministically('Ask my allies in Congress to hold the line.', state);
    expect(allies.mechanisms[0].targetIds).not.toContain('nato');
    // Real names still resolve.
    const named = compileDeterministically('Contact Khrushchev directly.', state);
    expect(named.mechanisms[0].targetIds).toContain('khrushchev');
  });
});

describe('world-extension validation', () => {
  const base = (): WorldExtensionProposal => ({
    rationale: 'test',
    entities: [],
    relationships: [],
    facts: [],
    arcs: [],
    aliases: [],
    sourceRefs: [],
    confidence: 'MEDIUM',
  });
  const draftEntity = (id: string, name: string) => ({
    id,
    name,
    kind: 'PERSON' as const,
    description: 'test entity',
    objectives: ['exist'],
    capabilities: ['presence'],
    constraints: [],
    status: 'ACTIVE' as const,
    power: 50,
    resolve: 50,
    privateFacts: [],
    visibility: visibility('PUBLIC'),
    fieldVisibility: {},
  });

  it('converts collisions to aliases, drops unknown endpoints, and enforces the entity budget', () => {
    const state = createCubanCampaign(48).state;
    const proposal = base();
    proposal.entities = [
      draftEntity('kennedy', 'John F. Kennedy'),
      draftEntity('new_a', 'Person A'),
      draftEntity('new_b', 'Person B'),
      draftEntity('new_c', 'Person C'),
    ];
    proposal.relationships = [{
      id: 'broken', fromId: 'new_a', toId: 'ghost', alignment: 50, trust: 50, leverage: 50,
      communication: true, commitments: [], visibility: visibility('PUBLIC'),
    }];
    const { proposal: repaired, issues } = validateWorldExtension(proposal, state);
    expect(repaired.entities.map((entity) => entity.id)).toEqual(['new_a', 'new_b']);
    expect(repaired.relationships).toEqual([]);
    expect(repaired.aliases.some((alias) => alias.targetId === 'kennedy')).toBe(true);
    expect(issues.some((issue) => issue.code === 'WX_ENTITY_EXISTS')).toBe(true);
    expect(issues.some((issue) => issue.code === 'WX_RELATIONSHIP_ENDPOINT')).toBe(true);
    expect(issues.some((issue) => issue.code === 'WX_ENTITY_BUDGET')).toBe(true);
  });
});

describe('causal-path rule for the escalation metric', () => {
  it('rejects escalation-metric effects with no non-metric causal dependency', () => {
    const state = createCubanCampaign(49).state;
    const graph = compileDeterministically('Contact Khrushchev through a diplomatic backchannel.', state);
    const feasibility = checkFeasibility(graph, state);
    const effect = {
      id: 'e1',
      mechanismId: graph.mechanisms[0].id,
      targetType: 'METRIC' as const,
      targetId: 'nuclear_tension',
      field: 'value',
      direction: 'POSITIVE' as const,
      impactClass: 'MAJOR' as const,
      confidence: 'MEDIUM' as const,
      engagement: 'ENGAGES' as const,
      cause: 'The player used the word force.',
      dependencies: [] as string[],
    };
    const adjudication: Adjudication = {
      summary: 'test',
      mechanismFindings: [{ mechanismId: graph.mechanisms[0].id, engagement: 'ENGAGES', reason: 'test', confidence: 'MEDIUM' }],
      recommendedEffects: [effect],
      outcomeBands: [{ id: 'only', label: 'Only', probability: 1, effectIds: ['e1'], description: 'test' }],
      assumptions: [],
      unknowns: [],
      confidence: 'MEDIUM',
    };
    const bare = validateAdjudicationProposal(adjudication, graph, feasibility, state, []);
    expect(bare.some((issue) => issue.code === 'EFFECT_UNSUPPORTED_ESCALATION')).toBe(true);

    const grounded = validateAdjudicationProposal({
      ...adjudication,
      recommendedEffects: [{ ...effect, dependencies: ['khrushchev'] }],
    }, graph, feasibility, state, []);
    expect(grounded.some((issue) => issue.code === 'EFFECT_UNSUPPORTED_ESCALATION')).toBe(false);
  });
});
