import { ActorBeliefState, BeliefState, Campaign, ScenarioManifest, WorldState } from './domain';
import { canAccess, visibility } from './visibility';
import { assertValidScenario } from './scenario';

const publicVisibility = () => visibility('PUBLIC');
const playerVisibility = () => visibility('PLAYER_KNOWN', ['kennedy']);
const actorVisibility = (...actorIds: string[]) => visibility('ACTOR_KNOWN', actorIds);
const privateVisibility = (...actorIds: string[]) => visibility('ACTOR_PRIVATE', actorIds);
const secretVisibility = () => visibility('SIMULATION_SECRET', [], { discoverable: true, detectionDifficulty: 'VERY_HIGH' });

const belief = (
  actorId: string,
  subjectId: string,
  field: string,
  range: [number, number],
  confidence: ActorBeliefState['beliefs'][string]['confidence'],
  turn = 0,
) => ({
  subjectId,
  field,
  range,
  estimate: Math.round((range[0] + range[1]) / 2),
  confidence,
  sourceFactIds: [],
  updatedTurn: turn,
});

export const createCubanCampaign = (seed = 19621027): Campaign => {
  const manifest: ScenarioManifest = {
    id: 'cuban_missile_crisis_black_saturday',
    title: 'Midnight in Havana',
    premise: 'October 27, 1962. A U-2 has been shot down over Cuba while a diplomatic exit remains barely possible.',
    playerId: 'kennedy',
    playerRole: 'President of the United States',
    startingDate: 'October 27, 1962 — 12:00 PM',
    timeUnit: 'HOURS',
    timeScale: { amount: 4, unit: 'HOURS' },
    historicalCutoff: '1962-10-27T12:00:00-05:00',
    metricDefinitions: [
      { id: 'nuclear_tension', label: 'Nuclear Tension', description: 'Proximity to uncontrolled nuclear exchange.', min: 0, max: 100, dangerAbove: 80, visibility: playerVisibility() },
      { id: 'alliance_cohesion', label: 'Alliance Cohesion', description: 'Confidence and alignment inside the Western alliance.', min: 0, max: 100, dangerBelow: 25, visibility: playerVisibility() },
      { id: 'domestic_support', label: 'Domestic Support', description: 'Political support for the administration response.', min: 0, max: 100, dangerBelow: 20, visibility: playerVisibility() },
      { id: 'command_control', label: 'Command Control', description: 'Civilian control and reliability of escalation management.', min: 0, max: 100, dangerBelow: 30, visibility: playerVisibility() },
      { id: 'diplomatic_space', label: 'Diplomatic Space', description: 'Remaining room for a negotiated settlement.', min: 0, max: 100, dangerBelow: 15, visibility: playerVisibility() },
      { id: 'intelligence_quality', label: 'Intelligence Quality', description: 'Accuracy and timeliness of decision-relevant intelligence.', min: 0, max: 100, visibility: playerVisibility() },
    ],
    authorityRules: [
      { actorId: 'kennedy', targetId: 'kennedy', mechanismKinds: ['DIRECT_ORDER', 'RESOURCE_TRANSFER', 'PUBLIC_COMMUNICATION'], mode: 'DIRECT', conditions: [] },
      { actorId: 'kennedy', targetId: 'joint_chiefs', mechanismKinds: ['DIRECT_ORDER', 'MILITARY_OPERATION', 'INTELLIGENCE'], mode: 'DELEGATED', conditions: ['Lawful presidential command'] },
      { actorId: 'kennedy', targetId: 'excomm_doves', mechanismKinds: ['DIRECT_ORDER', 'DIPLOMACY', 'INTELLIGENCE'], mode: 'DELEGATED', conditions: [] },
      { actorId: 'kennedy', targetId: 'khrushchev', mechanismKinds: ['DIPLOMACY', 'COERCION', 'PUBLIC_COMMUNICATION'], mode: 'INFLUENCE', conditions: ['Available communication channel'] },
      { actorId: 'kennedy', targetId: 'castro', mechanismKinds: ['DIPLOMACY', 'COERCION', 'PUBLIC_COMMUNICATION'], mode: 'INFLUENCE', conditions: ['Indirect or public channel'] },
    ],
    calibrationRules: [
      { id: 'cmc_diplomacy', mechanismKind: 'DIPLOMACY', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR'], defaultImpactClass: 'MODERATE', rationale: 'Direct superpower communication can materially change escalation space but rarely resolves the crisis alone.' },
      { id: 'cmc_military', mechanismKind: 'MILITARY_OPERATION', allowedImpactClasses: ['MINOR', 'MODERATE', 'MAJOR', 'SEVERE', 'SYSTEMIC'], defaultImpactClass: 'MAJOR', rationale: 'Military action during Black Saturday carries unusually high escalation sensitivity.' },
      { id: 'cmc_intelligence', mechanismKind: 'INTELLIGENCE', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE'], defaultImpactClass: 'MINOR', rationale: 'Collection changes beliefs before it changes strategic reality.' },
      { id: 'cmc_relationship_norm', targetType: 'RELATIONSHIP', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE'], defaultImpactClass: 'MINOR', rationale: 'Trust and alignment normally move incrementally within a four-hour turn.' },
    ],
    historicalAnalogs: [
      { id: 'analog_rfk_dobrynin', label: 'Robert Kennedy–Dobrynin backchannel', mechanismKind: 'DIPLOMACY', targetId: 'diplomatic_space', impactClass: 'MODERATE', context: 'A private channel enabled face-saving terms while public positions remained constrained.', provenance: 'VERIFIED_FACT', sourceRefs: ['U.S. Department of State, Foreign Relations of the United States, Cuban Missile Crisis volumes'] },
      { id: 'analog_u2_shootdown', label: 'U-2 shootdown escalation pressure', mechanismKind: 'MILITARY_OPERATION', targetId: 'nuclear_tension', impactClass: 'MAJOR', context: 'Direct loss of an American aircraft created immediate pressure for retaliation and miscalculation.', provenance: 'VERIFIED_FACT', sourceRefs: ['John F. Kennedy Presidential Library, Cuban Missile Crisis records'] },
    ],
    hardRules: [
      'Only the president may authorize United States strategic or theater military operations.',
      'No actor may use a capability absent from its authoritative entity record.',
      'Private diplomatic exchange requires an active communication relationship.',
      'Soviet missile withdrawal requires Khrushchev authority and a viable transmission path to forces in Cuba.',
    ],
    advisors: [
      { id: 'advisor_excomm_restraint', name: 'ExComm Restraint Bloc', expertise: ['Diplomacy', 'Escalation control'], worldview: 'Preserve options and create a negotiated exit.', bias: 'Underweights domestic demands for immediate retaliation.', relationship: 72, actorId: 'excomm_doves', visibility: playerVisibility() },
      { id: 'advisor_joint_chiefs', name: 'Joint Chiefs of Staff', expertise: ['Military operations', 'Readiness'], worldview: 'Credible force and decisive action prevent strategic defeat.', bias: 'Underweights uncontrolled escalation and diplomatic ambiguity.', relationship: 65, actorId: 'joint_chiefs', visibility: playerVisibility() },
    ],
    unresolvedUncertainties: [
      'Whether field commanders will interpret signaling as attack preparation.',
      'Whether a face-saving exchange can outrun military escalation pressure.',
      'How much operational control Moscow retains over forces in Cuba and at sea.',
    ],
  };

  const state: WorldState = {
    schemaVersion: 2,
    campaignId: `cmc_${seed}`,
    revision: 0,
    manifest,
    turn: 0,
    dateLabel: manifest.startingDate,
    currentDateTime: manifest.historicalCutoff,
    elapsedMinutes: 0,
    rngSeed: seed >>> 0,
    rngCursor: 0,
    metrics: {
      nuclear_tension: 82,
      alliance_cohesion: 68,
      domestic_support: 61,
      command_control: 54,
      diplomatic_space: 43,
      intelligence_quality: 64,
    },
    entities: {
      kennedy: {
        id: 'kennedy', name: 'John F. Kennedy', kind: 'PERSON',
        description: 'President of the United States and player role.',
        objectives: ['Remove offensive missiles from Cuba', 'Avoid nuclear war', 'Preserve alliance credibility'],
        capabilities: ['Presidential command authority', 'ExComm', 'Naval quarantine', 'Diplomatic channels', 'Strategic forces'],
        constraints: ['Congressional pressure', 'Military advice', 'Alliance commitments', 'Incomplete intelligence'],
        status: 'ACTIVE', power: 88, resolve: 74, privateFacts: ['rfk_backchannel'],
        visibility: publicVisibility(),
        fieldVisibility: { objectives: playerVisibility(), capabilities: playerVisibility(), constraints: playerVisibility(), power: playerVisibility(), resolve: playerVisibility() },
      },
      khrushchev: {
        id: 'khrushchev', name: 'Nikita Khrushchev', kind: 'PERSON',
        description: 'Premier of the Soviet Union balancing strategic leverage against uncontrolled escalation.',
        objectives: ['Protect Cuba', 'Avoid humiliating capitulation', 'Reduce US strategic pressure', 'Avoid nuclear war'],
        capabilities: ['Soviet strategic forces', 'Missile withdrawal authority', 'Diplomatic correspondence'],
        constraints: ['Presidium hardliners', 'Slow communications', 'Limited control of field events'],
        status: 'ACTIVE', power: 87, resolve: 67, privateFacts: ['soviet_seeks_exit', 'tactical_nukes_cuba'],
        visibility: publicVisibility(),
        fieldVisibility: { objectives: privateVisibility('khrushchev'), capabilities: actorVisibility('khrushchev', 'kennedy'), constraints: privateVisibility('khrushchev'), power: privateVisibility('khrushchev'), resolve: privateVisibility('khrushchev') },
      },
      castro: {
        id: 'castro', name: 'Fidel Castro', kind: 'PERSON',
        description: 'Cuban leader expecting invasion and prepared to resist.',
        objectives: ['Prevent US invasion', 'Preserve the revolution', 'Avoid abandonment by Moscow'],
        capabilities: ['Cuban armed forces', 'Militia', 'Political mobilization'],
        constraints: ['Dependence on Soviet support', 'Limited strategic reach'],
        status: 'ACTIVE', power: 55, resolve: 92, privateFacts: ['castro_invasion_expected'],
        visibility: publicVisibility(),
        fieldVisibility: { objectives: privateVisibility('castro'), capabilities: publicVisibility(), constraints: actorVisibility('castro', 'khrushchev'), power: privateVisibility('castro'), resolve: privateVisibility('castro') },
      },
      joint_chiefs: {
        id: 'joint_chiefs', name: 'Joint Chiefs of Staff', kind: 'INSTITUTION',
        description: 'Senior military leadership pressing for strikes and invasion readiness.',
        objectives: ['Remove missiles decisively', 'Preserve deterrent credibility', 'Minimize operational surprise'],
        capabilities: ['OPLAN 312 air strikes', 'OPLAN 316 invasion', 'Strategic readiness'],
        constraints: ['Presidential authority', 'Uncertain Soviet response'],
        status: 'ACTIVE', power: 84, resolve: 86, controllerId: 'kennedy', privateFacts: [],
        visibility: playerVisibility(),
        fieldVisibility: { objectives: playerVisibility(), capabilities: playerVisibility(), constraints: playerVisibility(), power: playerVisibility(), resolve: playerVisibility() },
      },
      excomm_doves: {
        id: 'excomm_doves', name: 'ExComm Restraint Bloc', kind: 'FACTION',
        description: 'Civilian advisors seeking a controlled diplomatic resolution.',
        objectives: ['Prevent escalation', 'Preserve flexible options', 'Secure verified withdrawal'],
        capabilities: ['Policy advice', 'Backchannels', 'Civilian departments'],
        constraints: ['Military pressure', 'Political time pressure'],
        status: 'ACTIVE', power: 65, resolve: 71, controllerId: 'kennedy', privateFacts: ['rfk_backchannel'],
        visibility: playerVisibility(),
        fieldVisibility: { objectives: playerVisibility(), capabilities: playerVisibility(), constraints: playerVisibility(), power: playerVisibility(), resolve: playerVisibility() },
      },
      b59: {
        id: 'b59', name: 'Soviet Submarine B-59', kind: 'MILITARY',
        description: 'A diesel-electric submarine under severe pressure near the quarantine line.',
        objectives: ['Avoid capture', 'Follow standing orders', 'Return safely'],
        capabilities: ['Conventional torpedoes', 'One nuclear torpedo'],
        constraints: ['Poor communications', 'Heat and battery depletion', 'Ambiguous signaling'],
        status: 'DEGRADED', power: 38, resolve: 63, controllerId: 'khrushchev', privateFacts: ['b59_nuclear_torpedo'],
        visibility: playerVisibility(),
        fieldVisibility: { objectives: privateVisibility('b59', 'khrushchev'), capabilities: privateVisibility('b59', 'khrushchev'), constraints: privateVisibility('b59', 'khrushchev'), power: secretVisibility(), resolve: secretVisibility() },
      },
      soviet_cuba: {
        id: 'soviet_cuba', name: 'Soviet Group of Forces in Cuba', kind: 'MILITARY',
        description: 'Missile, air-defense, and ground forces deployed in Cuba.',
        objectives: ['Defend Cuba', 'Maintain readiness', 'Follow Moscow directives'],
        capabilities: ['MRBMs', 'IRBMs', 'SA-2 defenses', 'Tactical nuclear weapons'],
        constraints: ['Incomplete readiness', 'Communications delay', 'US surveillance'],
        status: 'ACTIVE', power: 76, resolve: 77, controllerId: 'khrushchev', privateFacts: ['tactical_nukes_cuba'],
        visibility: playerVisibility(),
        fieldVisibility: { objectives: privateVisibility('soviet_cuba', 'khrushchev'), capabilities: privateVisibility('soviet_cuba', 'khrushchev'), constraints: actorVisibility('soviet_cuba', 'khrushchev'), power: secretVisibility(), resolve: privateVisibility('soviet_cuba', 'khrushchev') },
      },
      nato: {
        id: 'nato', name: 'NATO Allies', kind: 'FACTION',
        description: 'Allies concerned about Berlin, credibility, and nuclear escalation.',
        objectives: ['Avoid nuclear war', 'Protect Berlin', 'Preserve alliance unity'],
        capabilities: ['Diplomatic support', 'European basing', 'Alliance legitimacy'],
        constraints: ['Limited access to US-Soviet exchanges', 'Divergent risk tolerance'],
        status: 'ACTIVE', power: 70, resolve: 59, privateFacts: [],
        visibility: publicVisibility(),
        fieldVisibility: { objectives: publicVisibility(), capabilities: publicVisibility(), constraints: actorVisibility('nato', 'kennedy'), power: actorVisibility('nato', 'kennedy'), resolve: actorVisibility('nato', 'kennedy') },
      },
    },
    resources: {
      political_capital: { id: 'political_capital', label: 'Political Capital', amount: 63, unit: 'points', renewable: true, ownerId: 'kennedy', visibility: playerVisibility() },
      recon_sorties: { id: 'recon_sorties', label: 'Reconnaissance Sorties', amount: 8, unit: 'sorties', renewable: false, ownerId: 'kennedy', visibility: playerVisibility() },
      diplomatic_channels: { id: 'diplomatic_channels', label: 'Diplomatic Channels', amount: 3, unit: 'channels', renewable: true, ownerId: 'kennedy', visibility: playerVisibility() },
      invasion_readiness: { id: 'invasion_readiness', label: 'Invasion Readiness', amount: 78, unit: 'percent', renewable: true, ownerId: 'joint_chiefs', visibility: actorVisibility('kennedy', 'joint_chiefs') },
      soviet_missiles_ready: { id: 'soviet_missiles_ready', label: 'Operational Soviet Missiles', amount: 24, unit: 'launchers', renewable: false, ownerId: 'soviet_cuba', visibility: actorVisibility('khrushchev', 'soviet_cuba') },
    },
    relationships: {
      kennedy_chiefs: { id: 'kennedy_chiefs', fromId: 'joint_chiefs', toId: 'kennedy', alignment: 58, trust: 65, leverage: 67, communication: true, commitments: ['Obey lawful presidential orders'], visibility: actorVisibility('kennedy', 'joint_chiefs') },
      kennedy_khrushchev: { id: 'kennedy_khrushchev', fromId: 'kennedy', toId: 'khrushchev', alignment: 10, trust: 24, leverage: 61, communication: true, commitments: [], visibility: actorVisibility('kennedy', 'khrushchev') },
      kennedy_nato: { id: 'kennedy_nato', fromId: 'kennedy', toId: 'nato', alignment: 78, trust: 69, leverage: 74, communication: true, commitments: ['NATO collective defense'], visibility: actorVisibility('kennedy', 'nato') },
      khrushchev_castro: { id: 'khrushchev_castro', fromId: 'khrushchev', toId: 'castro', alignment: 73, trust: 46, leverage: 82, communication: true, commitments: ['Defend Cuban sovereignty'], visibility: actorVisibility('khrushchev', 'castro') },
      castro_kennedy: { id: 'castro_kennedy', fromId: 'castro', toId: 'kennedy', alignment: 2, trust: 4, leverage: 17, communication: false, commitments: [], visibility: actorVisibility('castro', 'kennedy') },
    },
    arcs: {
      diplomatic_exchange: { id: 'diplomatic_exchange', title: 'The Two Letters', description: 'Competing Soviet proposals create a narrow path to settlement.', progress: 45, threshold: 100, direction: 'RISING', status: 'ACTIVE', dueTurn: 4, ownerId: 'khrushchev', participantIds: ['kennedy', 'khrushchev', 'excomm_doves'], visibility: playerVisibility(), onResolve: [] },
      air_strike_pressure: { id: 'air_strike_pressure', title: 'Pressure for Air Strikes', description: 'Military and political pressure for retaliation is mounting.', progress: 62, threshold: 100, direction: 'RISING', status: 'ACTIVE', dueTurn: 3, ownerId: 'joint_chiefs', participantIds: ['kennedy', 'joint_chiefs', 'soviet_cuba'], visibility: playerVisibility(), onResolve: [] },
      submarine_contact: { id: 'submarine_contact', title: 'Submarine Contact', description: 'US destroyers are signaling an unidentified Soviet submarine to surface.', progress: 72, threshold: 100, direction: 'RISING', status: 'ACTIVE', dueTurn: 2, ownerId: 'b59', participantIds: ['b59', 'kennedy', 'khrushchev'], visibility: playerVisibility(), onResolve: [] },
    },
    facts: {
      u2_shot_down: { id: 'u2_shot_down', statement: 'Major Rudolf Anderson Jr. was killed when his U-2 was shot down over Cuba.', provenance: 'VERIFIED_FACT', confidence: 'VERY_HIGH', visibility: publicVisibility(), source: 'Scenario record', sourceRefs: ['John F. Kennedy Presidential Library, Black Saturday records'], createdTurn: 0 },
      rfk_backchannel: { id: 'rfk_backchannel', statement: 'Robert Kennedy has a viable private channel to Ambassador Dobrynin.', provenance: 'VERIFIED_FACT', confidence: 'HIGH', visibility: actorVisibility('kennedy', 'excomm_doves', 'khrushchev'), source: 'Scenario record', sourceRefs: ['U.S. Department of State, Foreign Relations of the United States, Cuban Missile Crisis volumes'], createdTurn: 0 },
      tactical_nukes_cuba: { id: 'tactical_nukes_cuba', statement: 'Soviet tactical nuclear weapons are deployed in Cuba.', provenance: 'VERIFIED_FACT', confidence: 'VERY_HIGH', visibility: actorVisibility('khrushchev', 'soviet_cuba', 'castro'), source: 'Declassified historical record', sourceRefs: ['National Security Archive, tactical nuclear weapons in Cuba collection'], createdTurn: 0 },
      b59_nuclear_torpedo: { id: 'b59_nuclear_torpedo', statement: 'B-59 carries a nuclear-armed torpedo.', provenance: 'VERIFIED_FACT', confidence: 'VERY_HIGH', visibility: actorVisibility('b59', 'khrushchev'), source: 'Declassified historical record', sourceRefs: ['National Security Archive, Soviet submarine B-59 collection'], createdTurn: 0 },
      soviet_seeks_exit: { id: 'soviet_seeks_exit', statement: 'Khrushchev strongly prefers a face-saving negotiated exit to war.', provenance: 'WELL_SUPPORTED_INFERENCE', confidence: 'HIGH', visibility: privateVisibility('khrushchev'), source: 'Historical inference', sourceRefs: ['Khrushchev correspondence and Presidium accounts'], createdTurn: 0 },
      castro_invasion_expected: { id: 'castro_invasion_expected', statement: 'Castro believes a US invasion is imminent.', provenance: 'VERIFIED_FACT', confidence: 'HIGH', visibility: actorVisibility('castro', 'khrushchev'), source: 'Scenario record', sourceRefs: ['Castro–Khrushchev correspondence, October 1962'], createdTurn: 0 },
    },
    pendingProcesses: {},
    goal: {
      id: 'remove_missiles',
      title: 'Resolve the Missile Crisis',
      description: 'Secure verified removal of Soviet offensive missiles without nuclear exchange.',
      victoryConditions: ['Soviet missiles withdrawn or verifiably disabled', 'No nuclear exchange', 'No permanent Soviet nuclear base in Cuba'],
      failureConditions: ['Nuclear exchange', 'Uncontrolled general war', 'Permanent operational Soviet missile base'],
      victoryRules: [
        { targetType: 'RESOURCE', targetId: 'soviet_missiles_ready', field: 'amount', operator: 'LTE', value: 0 },
        { targetType: 'METRIC', targetId: 'nuclear_tension', field: 'value', operator: 'LT', value: 100 },
      ],
      failureRules: [
        { targetType: 'METRIC', targetId: 'nuclear_tension', field: 'value', operator: 'GTE', value: 100 },
      ],
      victoryMode: 'ALL',
      failureMode: 'ANY',
      deadlineTurn: 12,
      status: 'ACTIVE',
      terminalOnAchievement: true,
      terminalOnFailure: true,
    },
    gameOver: false,
  };

  const playerBeliefs: ActorBeliefState = {
    actorId: 'kennedy',
    knownFactIds: ['u2_shot_down', 'rfk_backchannel'],
    beliefs: {
      'nuclear_tension.value': belief('kennedy', 'nuclear_tension', 'value', [75, 90], 'HIGH'),
      'soviet_cuba.power': belief('kennedy', 'soviet_cuba', 'power', [58, 76], 'MEDIUM'),
      'khrushchev.resolve': belief('kennedy', 'khrushchev', 'resolve', [55, 82], 'LOW'),
      'castro.resolve': belief('kennedy', 'castro', 'resolve', [70, 95], 'MEDIUM'),
      'b59.capability': { subjectId: 'b59', field: 'capability', categorical: 'Conventional submarine; armament uncertain', confidence: 'LOW', sourceFactIds: [], updatedTurn: 0 },
    },
  };

  const actorBeliefs: Record<string, ActorBeliefState> = {};
  for (const entity of Object.values(state.entities)) {
    actorBeliefs[entity.id] = {
      actorId: entity.id,
      knownFactIds: Object.values(state.facts)
        .filter((fact) => canAccess(fact.visibility, entity.id, state.manifest.playerId))
        .map((fact) => fact.id),
      beliefs: {},
    };
  }
  actorBeliefs.khrushchev.beliefs['kennedy.resolve'] = belief('khrushchev', 'kennedy', 'resolve', [58, 80], 'MEDIUM');
  actorBeliefs.castro.beliefs['invasion.probability'] = belief('castro', 'invasion', 'probability', [75, 95], 'HIGH');
  actorBeliefs.joint_chiefs.beliefs['soviet_response.escalation'] = belief('joint_chiefs', 'soviet_response', 'escalation', [20, 55], 'LOW');
  actorBeliefs.b59.beliefs['war.started'] = { subjectId: 'war', field: 'started', categorical: 'Possibly', confidence: 'LOW', sourceFactIds: [], updatedTurn: 0 };

  const beliefs: BeliefState = { player: playerBeliefs, actors: actorBeliefs };
  const memories = Object.fromEntries(Object.keys(state.entities).map((actorId) => [actorId, {
    actorId,
    events: [],
    currentStrategy: state.entities[actorId].objectives[0],
    historicalPriorWeight: 1,
  }]));
  const campaign: Campaign = { state, beliefs, memories, audits: [] };
  assertValidScenario(campaign);
  return campaign;
};

export const createCampaign = (scenarioId = 'cuban_missile_crisis_black_saturday', seed?: number): Campaign => {
  if (scenarioId === 'cuban_missile_crisis_black_saturday') return createCubanCampaign(seed);
  throw new Error(`Unknown scenario: ${scenarioId}`);
};
