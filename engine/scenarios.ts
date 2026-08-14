import { ActorBeliefState, BeliefState, Campaign, ScenarioManifest, WorldState } from './domain';

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
    historicalCutoff: '1962-10-27T12:00:00-05:00',
    metricDefinitions: [
      { id: 'nuclear_tension', label: 'Nuclear Tension', description: 'Proximity to uncontrolled nuclear exchange.', min: 0, max: 100, dangerAbove: 80 },
      { id: 'alliance_cohesion', label: 'Alliance Cohesion', description: 'Confidence and alignment inside the Western alliance.', min: 0, max: 100, dangerBelow: 25 },
      { id: 'domestic_support', label: 'Domestic Support', description: 'Political support for the administration response.', min: 0, max: 100, dangerBelow: 20 },
      { id: 'command_control', label: 'Command Control', description: 'Civilian control and reliability of escalation management.', min: 0, max: 100, dangerBelow: 30 },
      { id: 'diplomatic_space', label: 'Diplomatic Space', description: 'Remaining room for a negotiated settlement.', min: 0, max: 100, dangerBelow: 15 },
      { id: 'intelligence_quality', label: 'Intelligence Quality', description: 'Accuracy and timeliness of decision-relevant intelligence.', min: 0, max: 100 },
    ],
  };

  const state: WorldState = {
    schemaVersion: 1,
    campaignId: `cmc_${seed}`,
    revision: 0,
    manifest,
    turn: 0,
    dateLabel: manifest.startingDate,
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
      },
      khrushchev: {
        id: 'khrushchev', name: 'Nikita Khrushchev', kind: 'PERSON',
        description: 'Premier of the Soviet Union balancing strategic leverage against uncontrolled escalation.',
        objectives: ['Protect Cuba', 'Avoid humiliating capitulation', 'Reduce US strategic pressure', 'Avoid nuclear war'],
        capabilities: ['Soviet strategic forces', 'Missile withdrawal authority', 'Diplomatic correspondence'],
        constraints: ['Presidium hardliners', 'Slow communications', 'Limited control of field events'],
        status: 'ACTIVE', power: 87, resolve: 67, privateFacts: ['soviet_seeks_exit', 'tactical_nukes_cuba'],
      },
      castro: {
        id: 'castro', name: 'Fidel Castro', kind: 'PERSON',
        description: 'Cuban leader expecting invasion and prepared to resist.',
        objectives: ['Prevent US invasion', 'Preserve the revolution', 'Avoid abandonment by Moscow'],
        capabilities: ['Cuban armed forces', 'Militia', 'Political mobilization'],
        constraints: ['Dependence on Soviet support', 'Limited strategic reach'],
        status: 'ACTIVE', power: 55, resolve: 92, privateFacts: ['castro_invasion_expected'],
      },
      joint_chiefs: {
        id: 'joint_chiefs', name: 'Joint Chiefs of Staff', kind: 'INSTITUTION',
        description: 'Senior military leadership pressing for strikes and invasion readiness.',
        objectives: ['Remove missiles decisively', 'Preserve deterrent credibility', 'Minimize operational surprise'],
        capabilities: ['OPLAN 312 air strikes', 'OPLAN 316 invasion', 'Strategic readiness'],
        constraints: ['Presidential authority', 'Uncertain Soviet response'],
        status: 'ACTIVE', power: 84, resolve: 86, controllerId: 'kennedy', privateFacts: [],
      },
      excomm_doves: {
        id: 'excomm_doves', name: 'ExComm Restraint Bloc', kind: 'FACTION',
        description: 'Civilian advisors seeking a controlled diplomatic resolution.',
        objectives: ['Prevent escalation', 'Preserve flexible options', 'Secure verified withdrawal'],
        capabilities: ['Policy advice', 'Backchannels', 'Civilian departments'],
        constraints: ['Military pressure', 'Political time pressure'],
        status: 'ACTIVE', power: 65, resolve: 71, controllerId: 'kennedy', privateFacts: ['rfk_backchannel'],
      },
      b59: {
        id: 'b59', name: 'Soviet Submarine B-59', kind: 'MILITARY',
        description: 'A diesel-electric submarine under severe pressure near the quarantine line.',
        objectives: ['Avoid capture', 'Follow standing orders', 'Return safely'],
        capabilities: ['Conventional torpedoes', 'One nuclear torpedo'],
        constraints: ['Poor communications', 'Heat and battery depletion', 'Ambiguous signaling'],
        status: 'DEGRADED', power: 38, resolve: 63, controllerId: 'khrushchev', privateFacts: ['b59_nuclear_torpedo'],
      },
      soviet_cuba: {
        id: 'soviet_cuba', name: 'Soviet Group of Forces in Cuba', kind: 'MILITARY',
        description: 'Missile, air-defense, and ground forces deployed in Cuba.',
        objectives: ['Defend Cuba', 'Maintain readiness', 'Follow Moscow directives'],
        capabilities: ['MRBMs', 'IRBMs', 'SA-2 defenses', 'Tactical nuclear weapons'],
        constraints: ['Incomplete readiness', 'Communications delay', 'US surveillance'],
        status: 'ACTIVE', power: 76, resolve: 77, controllerId: 'khrushchev', privateFacts: ['tactical_nukes_cuba'],
      },
      nato: {
        id: 'nato', name: 'NATO Allies', kind: 'FACTION',
        description: 'Allies concerned about Berlin, credibility, and nuclear escalation.',
        objectives: ['Avoid nuclear war', 'Protect Berlin', 'Preserve alliance unity'],
        capabilities: ['Diplomatic support', 'European basing', 'Alliance legitimacy'],
        constraints: ['Limited access to US-Soviet exchanges', 'Divergent risk tolerance'],
        status: 'ACTIVE', power: 70, resolve: 59, privateFacts: [],
      },
    },
    resources: {
      political_capital: { id: 'political_capital', label: 'Political Capital', amount: 63, unit: 'points', renewable: true, ownerId: 'kennedy' },
      recon_sorties: { id: 'recon_sorties', label: 'Reconnaissance Sorties', amount: 8, unit: 'sorties', renewable: false, ownerId: 'kennedy' },
      diplomatic_channels: { id: 'diplomatic_channels', label: 'Diplomatic Channels', amount: 3, unit: 'channels', renewable: true, ownerId: 'kennedy' },
      invasion_readiness: { id: 'invasion_readiness', label: 'Invasion Readiness', amount: 78, unit: 'percent', renewable: true, ownerId: 'joint_chiefs' },
      soviet_missiles_ready: { id: 'soviet_missiles_ready', label: 'Operational Soviet Missiles', amount: 24, unit: 'launchers', renewable: false, ownerId: 'soviet_cuba' },
    },
    relationships: {
      kennedy_chiefs: { id: 'kennedy_chiefs', fromId: 'joint_chiefs', toId: 'kennedy', alignment: 58, trust: 65, leverage: 67, communication: true, commitments: ['Obey lawful presidential orders'] },
      kennedy_khrushchev: { id: 'kennedy_khrushchev', fromId: 'kennedy', toId: 'khrushchev', alignment: 10, trust: 24, leverage: 61, communication: true, commitments: [] },
      kennedy_nato: { id: 'kennedy_nato', fromId: 'kennedy', toId: 'nato', alignment: 78, trust: 69, leverage: 74, communication: true, commitments: ['NATO collective defense'] },
      khrushchev_castro: { id: 'khrushchev_castro', fromId: 'khrushchev', toId: 'castro', alignment: 73, trust: 46, leverage: 82, communication: true, commitments: ['Defend Cuban sovereignty'] },
      castro_kennedy: { id: 'castro_kennedy', fromId: 'castro', toId: 'kennedy', alignment: 2, trust: 4, leverage: 17, communication: false, commitments: [] },
    },
    arcs: {
      diplomatic_exchange: { id: 'diplomatic_exchange', title: 'The Two Letters', description: 'Competing Soviet proposals create a narrow path to settlement.', progress: 45, threshold: 100, direction: 'RISING', status: 'ACTIVE', dueTurn: 4, ownerId: 'khrushchev' },
      air_strike_pressure: { id: 'air_strike_pressure', title: 'Pressure for Air Strikes', description: 'Military and political pressure for retaliation is mounting.', progress: 62, threshold: 100, direction: 'RISING', status: 'ACTIVE', dueTurn: 3, ownerId: 'joint_chiefs' },
      submarine_contact: { id: 'submarine_contact', title: 'Submarine Contact', description: 'US destroyers are signaling an unidentified Soviet submarine to surface.', progress: 72, threshold: 100, direction: 'RISING', status: 'ACTIVE', dueTurn: 2, ownerId: 'b59' },
    },
    facts: {
      u2_shot_down: { id: 'u2_shot_down', statement: 'Major Rudolf Anderson Jr. was killed when his U-2 was shot down over Cuba.', provenance: 'VERIFIED_FACT', confidence: 'VERY_HIGH', knownBy: ['kennedy', 'joint_chiefs', 'excomm_doves', 'khrushchev', 'castro'], source: 'Scenario record', createdTurn: 0 },
      rfk_backchannel: { id: 'rfk_backchannel', statement: 'Robert Kennedy has a viable private channel to Ambassador Dobrynin.', provenance: 'VERIFIED_FACT', confidence: 'HIGH', knownBy: ['kennedy', 'excomm_doves', 'khrushchev'], source: 'Scenario record', createdTurn: 0 },
      tactical_nukes_cuba: { id: 'tactical_nukes_cuba', statement: 'Soviet tactical nuclear weapons are deployed in Cuba.', provenance: 'VERIFIED_FACT', confidence: 'VERY_HIGH', knownBy: ['khrushchev', 'soviet_cuba', 'castro'], source: 'Declassified historical record', createdTurn: 0 },
      b59_nuclear_torpedo: { id: 'b59_nuclear_torpedo', statement: 'B-59 carries a nuclear-armed torpedo.', provenance: 'VERIFIED_FACT', confidence: 'VERY_HIGH', knownBy: ['b59', 'khrushchev'], source: 'Declassified historical record', createdTurn: 0 },
      soviet_seeks_exit: { id: 'soviet_seeks_exit', statement: 'Khrushchev strongly prefers a face-saving negotiated exit to war.', provenance: 'WELL_SUPPORTED_INFERENCE', confidence: 'HIGH', knownBy: ['khrushchev'], source: 'Historical inference', createdTurn: 0 },
      castro_invasion_expected: { id: 'castro_invasion_expected', statement: 'Castro believes a US invasion is imminent.', provenance: 'VERIFIED_FACT', confidence: 'HIGH', knownBy: ['castro', 'khrushchev'], source: 'Scenario record', createdTurn: 0 },
    },
    pendingProcesses: {},
    goal: {
      id: 'remove_missiles',
      title: 'Resolve the Missile Crisis',
      description: 'Secure verified removal of Soviet offensive missiles without nuclear exchange.',
      victoryConditions: ['Soviet missiles withdrawn or verifiably disabled', 'No nuclear exchange', 'No permanent Soviet nuclear base in Cuba'],
      failureConditions: ['Nuclear exchange', 'Uncontrolled general war', 'Permanent operational Soviet missile base'],
      deadlineTurn: 12,
      status: 'ACTIVE',
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
      knownFactIds: Object.values(state.facts).filter((fact) => fact.knownBy.includes(entity.id)).map((fact) => fact.id),
      beliefs: {},
    };
  }
  actorBeliefs.khrushchev.beliefs['kennedy.resolve'] = belief('khrushchev', 'kennedy', 'resolve', [58, 80], 'MEDIUM');
  actorBeliefs.castro.beliefs['invasion.probability'] = belief('castro', 'invasion', 'probability', [75, 95], 'HIGH');
  actorBeliefs.joint_chiefs.beliefs['soviet_response.escalation'] = belief('joint_chiefs', 'soviet_response', 'escalation', [20, 55], 'LOW');
  actorBeliefs.b59.beliefs['war.started'] = { subjectId: 'war', field: 'started', categorical: 'Possibly', confidence: 'LOW', sourceFactIds: [], updatedTurn: 0 };

  const beliefs: BeliefState = { player: playerBeliefs, actors: actorBeliefs };
  return { state, beliefs, audits: [] };
};

export const createCampaign = (scenarioId = 'cuban_missile_crisis_black_saturday', seed?: number): Campaign => {
  if (scenarioId === 'cuban_missile_crisis_black_saturday') return createCubanCampaign(seed);
  throw new Error(`Unknown scenario: ${scenarioId}`);
};
