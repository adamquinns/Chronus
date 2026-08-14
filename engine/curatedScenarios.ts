import { ScenarioDraft, initializeScenarioDraft } from './authoring';
import { Campaign, ProposedEffect } from './domain';
import { assertValidScenario } from './scenario';

const visible = (playerId: string) => ({ classification: 'PLAYER_KNOWN' as const, actorIds: [playerId], discoverable: false });
const publicRule = () => ({ classification: 'PUBLIC' as const, actorIds: [], discoverable: false });
const actorRule = (...actorIds: string[]) => ({ classification: 'ACTOR_KNOWN' as const, actorIds, discoverable: true });
const secret = (...actorIds: string[]) => ({ classification: 'ACTOR_PRIVATE' as const, actorIds, discoverable: true });

const effect = (
  id: string,
  mechanismId: string,
  targetType: ProposedEffect['targetType'],
  targetId: string,
  field: string,
  direction: ProposedEffect['direction'],
  impactClass: ProposedEffect['impactClass'],
  cause: string,
): ProposedEffect => ({ id, mechanismId, targetType, targetId, field, direction, impactClass, cause, confidence: 'HIGH', engagement: 'ENGAGES', dependencies: [] });

export const createCoalitionCampaign = (seed = Date.now()): Campaign => {
  const draft: ScenarioDraft = {
    id: 'governors_compact_1975',
    title: 'The Governors’ Compact',
    premise: 'A fictionalized 1970s federal emergency order tests a fragile interstate opposition coalition before a legal deadline.',
    startingDateLabel: 'January 10, 1975',
    startingDateTime: '1975-01-10T12:00:00Z',
    timeScale: { amount: 2, unit: 'WEEKS' },
    player: { id: 'organizer', name: 'Avery Quinn', role: 'Director of the Governors’ Compact', objectives: ['Preserve a viable coalition', 'Prevent durable implementation of the emergency order'], capabilities: ['Political organizing network', 'Private negotiation', 'Legal research staff', 'Press relationships'], constraints: ['No direct authority over governors', 'Limited staff capacity', 'Labor and business factions distrust one another'] },
    metrics: [
      { id: 'coalition_cohesion', label: 'Coalition Cohesion', description: 'Ability of member states and factions to act together.', value: 56, dangerBelow: 18 },
      { id: 'public_support', label: 'Public Support', description: 'Public backing for resistance to the order.', value: 49, dangerBelow: 20 },
      { id: 'legal_position', label: 'Legal Position', description: 'Readiness and credibility of institutional challenges.', value: 44 },
      { id: 'federal_momentum', label: 'Federal Momentum', description: 'Administrative capacity to make the order durable.', value: 61, dangerAbove: 88 },
      { id: 'exposure_risk', label: 'Exposure Risk', description: 'Likelihood that private coalition coordination becomes public.', value: 27, dangerAbove: 80 },
    ],
    entities: [
      { id: 'governor_vale', name: 'Governor Miriam Vale', kind: 'PERSON', description: 'A pivotal moderate governor with a difficult reelection.', objectives: ['Protect state authority', 'Avoid appearing extreme', 'Win reelection'], capabilities: ['Executive office', 'State legal apparatus', 'Public platform'], constraints: ['Close polling', 'Business pressure', 'Cautious legislature'], power: 67, resolve: 52, visibility: publicRule() },
      { id: 'labor_council', name: 'Interstate Labor Council', kind: 'FACTION', description: 'A mobilized constituency suspicious of corporate leadership.', objectives: ['Protect workers', 'Keep voting rights central', 'Avoid corporate capture'], capabilities: ['Organizing network', 'Strike capacity', 'Field intelligence'], constraints: ['Limited funds', 'Factional rivalry'], power: 58, resolve: 72, visibility: publicRule() },
      { id: 'business_forum', name: 'Regional Business Forum', kind: 'FACTION', description: 'Firms exposed to compliance and liability costs.', objectives: ['Limit implementation costs', 'Preserve access to federal agencies'], capabilities: ['Insurance leverage', 'Campaign finance network', 'Governor access'], constraints: ['Fear of retaliation', 'Reputational risk'], power: 71, resolve: 46, visibility: publicRule() },
      { id: 'federal_admin', name: 'Federal Implementation Office', kind: 'INSTITUTION', description: 'The agency coordinating rapid implementation.', objectives: ['Make the emergency order administratively irreversible', 'Split state resistance'], capabilities: ['Regulatory authority', 'Federal grants', 'Legal counsel', 'National messaging'], constraints: ['Judicial review', 'Uneven state cooperation'], power: 82, resolve: 76, visibility: publicRule() },
    ],
    resources: [
      { id: 'organizing_teams', label: 'Organizing Teams', amount: 10, unit: 'teams', renewable: true, ownerId: 'organizer', visibility: visible('organizer') },
      { id: 'legal_staff', label: 'Legal Staff Capacity', amount: 7, unit: 'staff-weeks', renewable: true, ownerId: 'organizer', visibility: visible('organizer') },
      { id: 'political_capital', label: 'Political Capital', amount: 48, unit: 'points', renewable: true, ownerId: 'organizer', visibility: visible('organizer') },
      { id: 'federal_grants', label: 'Discretionary Federal Grants', amount: 18, unit: 'grant packages', renewable: true, ownerId: 'federal_admin', visibility: actorRule('federal_admin') },
    ],
    relationships: [
      { id: 'organizer_vale', fromId: 'organizer', toId: 'governor_vale', alignment: 55, trust: 47, leverage: 34, communication: true, commitments: ['Vale will review a legally credible plan'], visibility: actorRule('organizer', 'governor_vale') },
      { id: 'organizer_labor', fromId: 'organizer', toId: 'labor_council', alignment: 68, trust: 61, leverage: 41, communication: true, commitments: ['Keep voting rights visible'], visibility: actorRule('organizer', 'labor_council') },
      { id: 'organizer_business', fromId: 'organizer', toId: 'business_forum', alignment: 43, trust: 38, leverage: 52, communication: true, commitments: [], visibility: actorRule('organizer', 'business_forum') },
      { id: 'vale_federal', fromId: 'governor_vale', toId: 'federal_admin', alignment: 42, trust: 45, leverage: 58, communication: true, commitments: [], visibility: secret('governor_vale', 'federal_admin') },
    ],
    facts: [
      { id: 'order_public', statement: 'The emergency order and its thirty-day implementation window are public.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'VERY_HIGH', visibility: publicRule(), sourceRefs: [] },
      { id: 'vale_private_poll', statement: 'Governor Vale’s private polling shows unusually high vulnerability among suburban voters.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'HIGH', visibility: secret('governor_vale'), sourceRefs: [] },
      { id: 'federal_grant_threat', statement: 'The federal office is preparing a targeted grant-delay threat against one undecided state.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'MEDIUM', visibility: secret('federal_admin'), sourceRefs: [] },
      { id: 'insurer_liability', statement: 'Two insurers believe immediate implementation creates material liability exposure.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'MEDIUM', visibility: actorRule('business_forum'), sourceRefs: [] },
    ],
    arcs: [
      { id: 'filing_window', title: 'Filing Window', description: 'The opportunity for an early injunction is closing.', progress: 22, direction: 'RISING', dueTurn: 6, ownerId: 'governor_vale', participantIds: ['organizer', 'governor_vale', 'federal_admin'], visibility: visible('organizer') },
      { id: 'federal_implementation', title: 'Federal Implementation', description: 'Administrative commitments make reversal progressively harder.', progress: 34, direction: 'RISING', dueTurn: 10, ownerId: 'federal_admin', participantIds: ['federal_admin', 'governor_vale'], visibility: publicRule() },
      { id: 'coalition_fracture', title: 'Coalition Fracture', description: 'Labor-business distrust could split the opposition.', progress: 18, direction: 'RISING', ownerId: 'labor_council', participantIds: ['organizer', 'labor_council', 'business_forum'], visibility: visible('organizer') },
    ],
    goal: {
      id: 'prevent_durable_order', title: 'Prevent durable implementation', description: 'Build a viable institutional coalition before federal implementation becomes irreversible.',
      victoryConditions: ['Coalition cohesion and legal position reach decisive strength before the deadline'], failureConditions: ['Federal momentum becomes irreversible'],
      victoryRules: [{ targetType: 'METRIC', targetId: 'coalition_cohesion', field: 'value', operator: 'GTE', value: 75 }, { targetType: 'METRIC', targetId: 'legal_position', field: 'value', operator: 'GTE', value: 65 }],
      failureRules: [{ targetType: 'METRIC', targetId: 'federal_momentum', field: 'value', operator: 'GTE', value: 95 }],
      victoryMode: 'ALL', failureMode: 'ANY', deadlineTurn: 15, terminalOnAchievement: true, terminalOnFailure: false,
    },
    hardRules: ['The organizer cannot order governors, firms, unions, courts, or federal agencies.', 'Legal filing consumes legal staff capacity.', 'Private coordination is not perceived without detection or disclosure.'],
    calibrationRules: [
      { id: 'coalition_norm', mechanismKind: 'COALITION_BUILDING', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE'], defaultImpactClass: 'MINOR', rationale: 'Coalitions normally move incrementally over a two-week turn.' },
      { id: 'legal_norm', mechanismKind: 'LEGAL_ACTION', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR'], defaultImpactClass: 'MODERATE', rationale: 'A credible filing can change institutional timing but not guarantee judgment.' },
      { id: 'relationship_norm', targetType: 'RELATIONSHIP', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE'], defaultImpactClass: 'MINOR', rationale: 'Trust changes require repeated evidence.' },
    ],
    historicalAnalogs: [{ id: 'compact_analog', label: 'Interstate institutional resistance', mechanismKind: 'COALITION_BUILDING', targetId: 'coalition_cohesion', impactClass: 'MINOR', context: 'Fictional scenario calibration analog: diverse coalitions strengthen slowly and fracture when incompatible constituencies are exposed.', provenance: 'SCENARIO_ABSTRACTION', sourceRefs: ['Scenario design calibration record'] }],
    advisors: [
      { id: 'advisor_legal', name: 'Elena Marsh', expertise: ['Public law', 'Injunction strategy'], worldview: 'Preserve procedural options until standing and plaintiffs are secure.', bias: 'Overweights litigation and underweights mass politics.', relationship: 66 },
      { id: 'advisor_field', name: 'Cal Brooks', expertise: ['Coalition organizing', 'Labor politics'], worldview: 'Trust is built through visible commitments, not elite assurances.', bias: 'Underweights quiet business leverage.', relationship: 74, actorId: 'labor_council' },
    ],
    unresolvedUncertainties: ['Governor Vale’s true defection threshold.', 'Whether insurer concern can translate into political leverage.', 'Whether the federal grant threat will be discovered before use.'],
    beliefOverrides: [],
  };
  const campaign = initializeScenarioDraft(draft, seed);
  campaign.state.arcs.coalition_fracture.onResolve = [effect('fracture_cohesion', 'coalition_fracture', 'METRIC', 'coalition_cohesion', 'value', 'NEGATIVE', 'SEVERE', 'The labor-business coalition fractured after accumulated distrust.')];
  campaign.state.goal.successors = [{
    on: 'FAILED',
    goal: {
      id: 'protect_decentralized_resistance', title: 'Protect decentralized resistance', description: 'The federal order has gained momentum; preserve state-level legal and civic capacity for a longer struggle.',
      victoryConditions: ['Maintain a viable legal position'], failureConditions: ['Coalition and public support collapse'],
      victoryRules: [{ targetType: 'METRIC', targetId: 'legal_position', field: 'value', operator: 'GTE', value: 70 }],
      failureRules: [{ targetType: 'METRIC', targetId: 'coalition_cohesion', field: 'value', operator: 'LTE', value: 10 }],
      victoryMode: 'ALL', failureMode: 'ANY', deadlineTurn: 24, status: 'ACTIVE', terminalOnAchievement: true, terminalOnFailure: true,
    },
  }];
  assertValidScenario(campaign);
  return campaign;
};

export const createMilitaryCampaign = (seed = Date.now()): Campaign => {
  const draft: ScenarioDraft = {
    id: 'operation_lantern', title: 'Operation Lantern', premise: 'A fictional mid-century mountain campaign forces a corps commander to balance a narrow supply corridor, uncertain enemy reserves, and political pressure for a rapid advance.',
    startingDateLabel: 'September 3, 1951', startingDateTime: '1951-09-03T06:00:00Z', timeScale: { amount: 3, unit: 'DAYS' },
    player: { id: 'corps_command', name: 'General Rowan', role: 'Commander, Northern Corps', objectives: ['Secure the Lantern Pass', 'Preserve combat power'], capabilities: ['Corps command authority', 'Three infantry divisions', 'Reconnaissance aviation', 'Combat engineers', 'Operational reserve'], constraints: ['Single mountain supply route', 'Civilian evacuation', 'Limited fuel'] },
    metrics: [
      { id: 'combat_readiness', label: 'Combat Readiness', description: 'Aggregate readiness of the corps.', value: 74, dangerBelow: 22 },
      { id: 'supply_integrity', label: 'Supply Integrity', description: 'Reliability of the mountain logistics corridor.', value: 63, dangerBelow: 20 },
      { id: 'enemy_pressure', label: 'Enemy Pressure', description: 'Operational pressure exerted by known enemy formations.', value: 57, dangerAbove: 90 },
      { id: 'civilian_security', label: 'Civilian Security', description: 'Safety and access for displaced civilians.', value: 48, dangerBelow: 15 },
      { id: 'intelligence_quality', label: 'Intelligence Quality', description: 'Confidence and timeliness of operational intelligence.', value: 41 },
    ],
    entities: [
      { id: 'first_division', name: '1st Infantry Division', kind: 'MILITARY', description: 'Experienced formation holding the central valley.', objectives: ['Hold the central valley', 'Maintain unit cohesion'], capabilities: ['Infantry brigades', 'Organic artillery', 'Limited motor transport'], constraints: ['Recent casualties', 'Exposed flank'], power: 71, resolve: 69, controllerId: 'corps_command', visibility: visible('corps_command') },
      { id: 'third_division', name: '3rd Infantry Division', kind: 'MILITARY', description: 'Fresh formation assigned to the western ridge.', objectives: ['Seize the western ridge'], capabilities: ['Infantry brigades', 'Mortar battalions', 'Mountain scouts'], constraints: ['Inexperienced staff', 'Poor maps'], power: 68, resolve: 73, controllerId: 'corps_command', visibility: visible('corps_command') },
      { id: 'enemy_army', name: 'Eastern Field Army', kind: 'MILITARY', description: 'Opponent defending the pass through depth and concealment.', objectives: ['Deny Lantern Pass', 'Disrupt the supply corridor', 'Preserve hidden reserve'], capabilities: ['Entrenched infantry', 'Mountain artillery', 'Raiding battalions'], constraints: ['Limited fuel', 'Weak air cover'], power: 77, resolve: 78, visibility: publicRule() },
      { id: 'civil_authority', name: 'Provincial Relief Authority', kind: 'INSTITUTION', description: 'Civil officials coordinating evacuation and road access.', objectives: ['Evacuate civilians', 'Keep relief corridor open'], capabilities: ['Local transport', 'Municipal records', 'Civil defense volunteers'], constraints: ['No combat authority', 'Overloaded roads'], power: 38, resolve: 64, visibility: publicRule() },
    ],
    resources: [
      { id: 'fuel', label: 'Fuel Reserve', amount: 16, unit: 'operational lots', renewable: false, ownerId: 'corps_command', visibility: visible('corps_command') },
      { id: 'artillery_ammunition', label: 'Artillery Ammunition', amount: 22, unit: 'fire-plan lots', renewable: false, ownerId: 'corps_command', visibility: visible('corps_command') },
      { id: 'recon_sorties', label: 'Reconnaissance Sorties', amount: 9, unit: 'sorties', renewable: false, ownerId: 'corps_command', visibility: visible('corps_command') },
      { id: 'enemy_reserve', label: 'Enemy Mobile Reserve', amount: 2, unit: 'battalions', renewable: false, ownerId: 'enemy_army', visibility: secret('enemy_army') },
    ],
    relationships: [
      { id: 'command_first', fromId: 'corps_command', toId: 'first_division', alignment: 86, trust: 78, leverage: 92, communication: true, commitments: ['Hold unless explicitly released'], visibility: actorRule('corps_command', 'first_division') },
      { id: 'command_third', fromId: 'corps_command', toId: 'third_division', alignment: 83, trust: 61, leverage: 90, communication: true, commitments: [], visibility: actorRule('corps_command', 'third_division') },
      { id: 'command_civil', fromId: 'corps_command', toId: 'civil_authority', alignment: 62, trust: 57, leverage: 49, communication: true, commitments: ['Preserve one lane for evacuation'], visibility: actorRule('corps_command', 'civil_authority') },
    ],
    facts: [
      { id: 'pass_mission', statement: 'Northern Corps has orders to secure Lantern Pass without abandoning the relief corridor.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'VERY_HIGH', visibility: actorRule('corps_command', 'first_division', 'third_division'), sourceRefs: [] },
      { id: 'enemy_reserve_hidden', statement: 'Two enemy mobile battalions are concealed beyond the eastern ridge.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'HIGH', visibility: secret('enemy_army'), sourceRefs: [] },
      { id: 'bridge_fatigue', statement: 'The Stone River bridge has structural fatigue not visible from routine inspection.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'MEDIUM', visibility: { classification: 'SIMULATION_SECRET', actorIds: [], discoverable: true }, sourceRefs: [] },
    ],
    arcs: [
      { id: 'pass_assault', title: 'Battle for Lantern Pass', description: 'Both armies are concentrating for control of the pass.', progress: 24, direction: 'RISING', dueTurn: 10, ownerId: 'enemy_army', participantIds: ['corps_command', 'first_division', 'third_division', 'enemy_army'], visibility: visible('corps_command') },
      { id: 'corridor_degradation', title: 'Supply Corridor Degradation', description: 'Traffic, weather, and raids are degrading the only reliable road.', progress: 31, direction: 'RISING', dueTurn: 8, ownerId: 'enemy_army', participantIds: ['corps_command', 'enemy_army', 'civil_authority'], visibility: visible('corps_command') },
      { id: 'enemy_infiltration', title: 'Enemy Infiltration', description: 'Raiders are probing for a route behind the corps.', progress: 19, direction: 'RISING', ownerId: 'enemy_army', participantIds: ['enemy_army'], visibility: secret('enemy_army') },
    ],
    goal: {
      id: 'secure_lantern_pass', title: 'Secure Lantern Pass', description: 'Gain durable control of the pass without destroying the corps or relief corridor.',
      victoryConditions: ['Battle arc resolves while readiness and supply remain viable'], failureConditions: ['Corps readiness or supply corridor collapses'],
      victoryRules: [{ targetType: 'ARC', targetId: 'pass_assault', field: 'progress', operator: 'GTE', value: 100 }, { targetType: 'METRIC', targetId: 'combat_readiness', field: 'value', operator: 'GT', value: 25 }],
      failureRules: [{ targetType: 'METRIC', targetId: 'combat_readiness', field: 'value', operator: 'LTE', value: 10 }, { targetType: 'METRIC', targetId: 'supply_integrity', field: 'value', operator: 'LTE', value: 5 }],
      victoryMode: 'ALL', failureMode: 'ANY', deadlineTurn: 15, terminalOnAchievement: true, terminalOnFailure: true,
    },
    hardRules: ['Units cannot use capabilities or ammunition they do not possess.', 'Movement through the pass requires a viable supply corridor.', 'Enemy reserves remain unavailable to enemy action if destroyed or committed elsewhere.', 'Civilian road usage constrains military logistics until evacuation changes.'],
    calibrationRules: [
      { id: 'military_readiness', mechanismKind: 'MILITARY_OPERATION', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE'], defaultImpactClass: 'MODERATE', rationale: 'Three-day combat operations can materially change readiness but systemic collapse requires accumulated causes.' },
      { id: 'logistics_norm', targetId: 'supply_integrity', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR'], defaultImpactClass: 'MINOR', rationale: 'Logistics normally degrade cumulatively rather than vanish in one turn.' },
      { id: 'intel_norm', mechanismKind: 'INTELLIGENCE', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE'], defaultImpactClass: 'MINOR', rationale: 'Reconnaissance changes knowledge before combat power.' },
    ],
    historicalAnalogs: [{ id: 'mountain_logistics_analog', label: 'Single-corridor mountain logistics', mechanismKind: 'MILITARY_OPERATION', targetId: 'supply_integrity', impactClass: 'MODERATE', context: 'Scenario calibration analog: tempo is bounded by roads, bridging, fuel, and artillery supply rather than intent alone.', provenance: 'SCENARIO_ABSTRACTION', sourceRefs: ['Scenario design calibration record'] }],
    advisors: [
      { id: 'advisor_operations', name: 'Brigadier Ellis', expertise: ['Operations', 'Combined arms'], worldview: 'Concentrate force at the decisive point and retain a reserve.', bias: 'Underweights civilian and political constraints.', relationship: 71 },
      { id: 'advisor_logistics', name: 'Colonel Sato', expertise: ['Logistics', 'Engineering'], worldview: 'Operational reach ends where reliable tonnage ends.', bias: 'May reject high-tempo opportunities too quickly.', relationship: 79 },
    ],
    unresolvedUncertainties: ['Location and readiness of the enemy reserve.', 'Whether the Stone River bridge can carry sustained heavy traffic.', 'Enemy infiltration route and timing.'],
    beliefOverrides: [],
  };
  const campaign = initializeScenarioDraft(draft, seed);
  campaign.state.pendingProcesses.bridge_maintenance = {
    id: 'bridge_maintenance', label: 'Stone River Bridge Maintenance', ownerId: 'corps_command', dueTurn: 4,
    progress: 0, requiredProgress: 100, participantIds: ['corps_command', 'civil_authority'], detectableBy: ['corps_command', 'civil_authority'], visibility: visible('corps_command'), completed: false,
    perTurnEffects: [{ ...effect('bridge_fuel_cost', 'bridge_maintenance', 'RESOURCE', 'fuel', 'amount', 'NEGATIVE', 'NONE', 'Engineer and transport work consumes one fuel lot'), proposedDelta: -1 }],
    onMature: [effect('bridge_supply_gain', 'bridge_maintenance', 'METRIC', 'supply_integrity', 'value', 'POSITIVE', 'MINOR', 'Completed bridge reinforcement improves corridor reliability.')],
  };
  campaign.state.arcs.corridor_degradation.onResolve = [effect('corridor_collapse', 'corridor_degradation', 'METRIC', 'supply_integrity', 'value', 'NEGATIVE', 'SEVERE', 'Accumulated road damage, congestion, and raids collapsed reliable supply throughput.')];
  campaign.state.arcs.pass_assault.onResolve = [effect('pass_pressure_relief', 'pass_assault', 'METRIC', 'enemy_pressure', 'value', 'NEGATIVE', 'MAJOR', 'The battle for the pass reached a decisive operational phase.')];
  assertValidScenario(campaign);
  return campaign;
};
