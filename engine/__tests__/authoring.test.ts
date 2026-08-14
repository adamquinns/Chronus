import { describe, expect, it } from 'vitest';
import { initializeScenarioDraft, normalizeGeneratedScenarioDraft, ScenarioDraft } from '../authoring';
import { validateScenario } from '../scenario';

const draft = (): ScenarioDraft => ({
  id: 'coalition_test',
  title: 'The Governors’ Compact',
  premise: 'A disputed federal order tests a fragile coalition of state governments.',
  startingDateLabel: 'January 10, 1975',
  startingDateTime: '1975-01-10T12:00:00Z',
  timeScale: { amount: 2, unit: 'WEEKS' },
  player: { id: 'organizer', name: 'Coalition Organizer', role: 'Opposition coalition director', objectives: ['Preserve the coalition'], capabilities: ['Political organizing', 'Private negotiation'], constraints: ['Limited formal authority'] },
  metrics: [
    { id: 'coalition_cohesion', label: 'Coalition Cohesion', description: 'Ability to act together.', value: 58, dangerBelow: 20 },
    { id: 'public_support', label: 'Public Support', description: 'Visible support for resistance.', value: 51 },
  ],
  entities: [
    { id: 'governor', name: 'Governor Vale', kind: 'PERSON', description: 'A pivotal governor.', objectives: ['Preserve state authority'], capabilities: ['Executive office', 'Public platform'], constraints: ['Reelection pressure'], power: 65, resolve: 60, visibility: { classification: 'PUBLIC', actorIds: [], discoverable: false } },
  ],
  resources: [
    { id: 'organizing_capacity', label: 'Organizing Capacity', amount: 12, unit: 'teams', renewable: true, ownerId: 'organizer', visibility: { classification: 'PLAYER_KNOWN', actorIds: ['organizer'], discoverable: false } },
  ],
  relationships: [
    { id: 'organizer_governor', fromId: 'organizer', toId: 'governor', alignment: 55, trust: 48, leverage: 35, communication: true, commitments: [], visibility: { classification: 'ACTOR_KNOWN', actorIds: ['organizer', 'governor'], discoverable: false } },
  ],
  facts: [
    { id: 'order_announced', statement: 'The federal order was publicly announced.', provenance: 'VERIFIED_FACT', confidence: 'VERY_HIGH', visibility: { classification: 'PUBLIC', actorIds: [], discoverable: false }, sourceRefs: ['Scenario source record'] },
  ],
  arcs: [
    { id: 'legal_deadline', title: 'Legal Deadline', description: 'The filing window is closing.', progress: 20, direction: 'RISING', dueTurn: 6, ownerId: 'governor', participantIds: ['organizer', 'governor'], visibility: { classification: 'PLAYER_KNOWN', actorIds: ['organizer'], discoverable: false } },
  ],
  goal: {
    id: 'preserve_coalition', title: 'Preserve the coalition', description: 'Keep enough governors aligned to resist the order.', victoryConditions: ['Coalition remains viable through the legal deadline'], failureConditions: ['Coalition collapses'],
    victoryRules: [{ targetType: 'METRIC', targetId: 'coalition_cohesion', field: 'value', operator: 'GTE', value: 75 }],
    failureRules: [{ targetType: 'METRIC', targetId: 'coalition_cohesion', field: 'value', operator: 'LTE', value: 15 }],
    victoryMode: 'ALL', failureMode: 'ANY', deadlineTurn: 12, terminalOnAchievement: true, terminalOnFailure: false,
  },
  hardRules: ['The organizer cannot directly order governors.'],
  calibrationRules: [
    { id: 'coalition_change', mechanismKind: 'COALITION_BUILDING', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE'], defaultImpactClass: 'MINOR', rationale: 'Coalitions usually shift incrementally.' },
  ],
  historicalAnalogs: [],
  advisors: [{ id: 'legal_advisor', name: 'Legal Advisor', expertise: ['Public law'], worldview: 'Preserve procedural options.', bias: 'Overweights litigation.', relationship: 60 }],
  unresolvedUncertainties: ['Whether the pivotal governor will accept political risk.'],
  beliefOverrides: [{ actorId: 'organizer', subjectId: 'governor', field: 'resolve', range: [35, 70], confidence: 'LOW', sourceFactIds: [] }],
});

describe('scenario authoring and initialization', () => {
  it('turns a structured proposal into a validated authoritative package', () => {
    const campaign = initializeScenarioDraft(draft(), 42);
    expect(campaign.state.schemaVersion).toBe(2);
    expect(campaign.state.manifest.playerId).toBe('organizer');
    expect(campaign.state.manifest.authorityRules.some((rule) => rule.targetId === 'governor' && rule.mode === 'INFLUENCE')).toBe(true);
    expect(campaign.beliefs.player.beliefs['governor.resolve'].range).toEqual([35, 70]);
    expect(validateScenario(campaign).filter((issue) => issue.severity === 'ERROR')).toEqual([]);
  });

  it('refuses verified scenario facts without provenance', () => {
    const invalid = draft();
    invalid.facts[0].sourceRefs = [];
    expect(() => initializeScenarioDraft(invalid, 42)).toThrow(/source reference/i);
  });

  it('closes model-authored belief metadata over the final roster and fact set', () => {
    const generated = draft();
    generated.facts.push({
      id: 'governor_private_fact',
      statement: 'The governor privately plans to defect.',
      provenance: 'SCENARIO_ABSTRACTION',
      confidence: 'MEDIUM',
      visibility: { classification: 'ACTOR_PRIVATE', actorIds: ['governor'], discoverable: true },
      sourceRefs: [],
    });
    generated.beliefOverrides.push(
      { actorId: 'discarded_actor', subjectId: 'governor', field: 'resolve', confidence: 'LOW', sourceFactIds: [] },
      { actorId: 'organizer', subjectId: 'discarded_actor', field: 'resolve', confidence: 'LOW', sourceFactIds: [] },
    );
    generated.beliefOverrides[0]!.sourceFactIds = ['order_announced', 'governor_private_fact', 'discarded_fact'];

    const normalized = normalizeGeneratedScenarioDraft(generated);
    expect(normalized.beliefOverrides).toHaveLength(1);
    expect(normalized.beliefOverrides[0]!.sourceFactIds).toEqual(['order_announced']);
    expect(() => initializeScenarioDraft(normalized, 42)).not.toThrow();
  });
});
