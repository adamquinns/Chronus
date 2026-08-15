import { ActorBeliefState, BeliefState, Campaign, ScenarioManifest, WorldState } from './domain';
import { canAccess, visibility } from './visibility';
import { assertValidScenario } from './scenario';
export { createCoalitionCampaign, createMilitaryCampaign } from './curatedScenarios';
import { createCoalitionCampaign, createMilitaryCampaign } from './curatedScenarios';
import { createTwilightCampaign } from './twilightScenario';
import { emptyForecastRecord } from './forecast';
export { createTwilightCampaign } from './twilightScenario';

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
    timeZone: 'America/New_York',
    timeUnit: 'HOURS',
    timeScale: { amount: 4, unit: 'HOURS' },
    timeScaleRules: [
      { id: 'nuclear_edge_compression', condition: { targetType: 'METRIC', targetId: 'nuclear_tension', field: 'value', operator: 'GTE', value: 90 }, scale: { amount: 1, unit: 'HOURS' }, rationale: 'Near the nuclear threshold, operational decisions compress to hourly windows.' },
    ],
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
      { actorId: 'kennedy', targetId: 'joint_chiefs', mechanismKinds: ['DIRECT_ORDER', 'MILITARY_OPERATION', 'INTELLIGENCE'], mode: 'DELEGATED', conditions: ['Civilian command-and-control remains functional'], conditionRules: [{ targetType: 'METRIC', targetId: 'command_control', field: 'value', operator: 'GTE', value: 30 }] },
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
      { id: 'advisor_mcnamara', name: 'Robert McNamara', expertise: ['Defense policy', 'Escalation control'], worldview: 'Preserve civilian control, quantify the ladder of escalation, and avoid steps whose consequences cannot be bounded.', bias: 'Can overestimate the ability of analysis and procedure to control frightened men and imperfect systems.', relationship: 76, actorId: 'excomm_doves', visibility: playerVisibility(), biography: 'Secretary of Defense and central ExComm participant.', voice: 'Controlled, analytical, clipped; often reframes danger as sequences and probabilities.', speechHabits: ['enumerates consequences', 'asks what happens after the next step'], personalStakes: 'Prevent a local military response from becoming an uncontrollable nuclear sequence.', recurringTension: 'Persistent conflict with LeMay and the Joint Chiefs over whether force can remain limited.' },
      { id: 'advisor_lemay', name: 'Curtis LeMay', expertise: ['Strategic air power', 'Military readiness'], worldview: 'Failure to answer force with force invites strategic defeat and makes later war more dangerous.', bias: 'Underweights diplomatic ambiguity, local-command error, and the political impossibility of controlling retaliation.', relationship: 54, actorId: 'joint_chiefs', visibility: playerVisibility(), biography: 'Air Force Chief of Staff and the most forceful advocate for striking Cuba.', voice: 'Blunt, impatient, concrete; speaks in operational requirements and treats hesitation as a decision.', speechHabits: ['rejects euphemism', 'presses for executable orders'], personalStakes: 'Avoid an outcome he believes will leave the United States strategically humiliated.', recurringTension: 'Believes civilian restraint confuses prudence with weakness.' },
      { id: 'advisor_rfk', name: 'Robert F. Kennedy', expertise: ['Backchannel diplomacy', 'Presidential politics'], worldview: 'A private, face-saving settlement may be possible if public positions and military clocks can be kept apart.', bias: 'May overvalue personal channels and his ability to read the President’s adversaries.', relationship: 88, actorId: 'excomm_doves', visibility: playerVisibility(), biography: 'Attorney General, presidential brother, and principal private channel to Ambassador Anatoly Dobrynin.', voice: 'Direct and personal, less bureaucratic than ExComm; speaks in terms of what another man may be able to accept.', speechHabits: ['distinguishes public from private terms', 'returns to the narrowing clock'], personalStakes: 'Protect his brother and find a settlement neither side must publicly describe as surrender.', recurringTension: 'The backchannel requires secrecy while the military demands clarity and speed.' },
    ],
    unresolvedUncertainties: [
      'Whether field commanders will interpret signaling as attack preparation.',
      'Whether a face-saving exchange can outrun military escalation pressure.',
      'How much operational control Moscow retains over forces in Cuba and at sea.',
    ],
    metricRoles: { escalation: 'nuclear_tension', support: 'domestic_support', cohesion: 'alliance_cohesion', intelligence: 'intelligence_quality' },
    voice: { era: 'Cold War, October 1962', tone: 'claustrophobic, procedural, grave, historically grounded', diction: ['ExComm', 'quarantine line', 'SAM site', 'readiness', 'backchannel', 'cable traffic'], textureNotes: ['Use maps, clocks, typed memoranda, delayed cables, reconnaissance photography, naval reports, and voices carried through secure telephones.', 'Scenes should emphasize incomplete information and the separation between political intention and military procedure.'], forbiddenCliches: ['tensions rose', 'the world watched', 'history held its breath', 'a dramatic turn', 'unprecedented times'] },
    narrativeWorld: {
      sourceMaterialRef: 'docs/source_material/legacy-scenarios.ts.txt#cuban_crisis',
      canonicalContext: [
        'For nearly two weeks, US reconnaissance has confirmed Soviet medium- and intermediate-range nuclear missiles in Cuba; Kennedy has answered with a naval quarantine.',
        'Strategic forces are at extraordinary alert. There is no Washington–Moscow hotline, and orders pass through slow, fallible channels.',
        'ExComm is divided between military leaders pressing for air strikes and civilian advisors warning that a limited reprisal may not remain limited.',
        'Robert Kennedy maintains a fragile private channel through Soviet Ambassador Anatoly Dobrynin.',
        'Khrushchev wants to defend Cuba and correct the strategic imbalance but fears losing control of deployed forces and local commanders.',
        'Castro expects invasion and resents any settlement that trades Cuban security for superpower convenience.',
        'NATO allies fear both American weakness and being destroyed by a crisis they cannot control; Berlin and the Jupiter missiles in Turkey shadow every bargain.',
      ],
      playerContext: ['You are President John F. Kennedy. You can command US forces, but you cannot command Soviet, Cuban, allied, or local military interpretation.', 'You know Major Rudolf Anderson has been killed over Cuba and that pressure for retaliation is immediate.', 'You know the Dobrynin channel exists. You do not know the full tactical nuclear deployment in Cuba or aboard Soviet submarines.'],
      immediateHistory: ['A Soviet SA-2 battery has shot down Major Rudolf Anderson Jr.’s U-2 over eastern Cuba.', 'A separate U-2 has strayed into Soviet airspace near the Arctic, prompting fighter scrambles.', 'Two different Soviet letters suggest different settlement terms.', 'US destroyers are using practice depth charges to signal a Soviet submarine near the quarantine line.'],
      locations: ['the Cabinet Room and Oval Office', 'eastern Cuba', 'the quarantine line in the Atlantic', 'the Soviet Embassy in Washington', 'Moscow and Havana', 'Berlin and Jupiter missile sites in Turkey'],
      institutions: ['Executive Committee of the National Security Council', 'Joint Chiefs of Staff', 'Strategic Air Command', 'Soviet Presidium', 'NATO', 'US Navy quarantine force'],
      narrativeGuidance: ['Use institutional and operational realism over cinematic omniscience.', 'Keep hidden tactical nuclear weapons and B-59 armament out of player-facing narration until causally discovered.', 'Let military, diplomatic, and political clocks conflict.', 'Use period-appropriate cables, memoranda, radio reports, and television bulletins.'],
      storyPossibilities: ['Kennedy–LeMay disagreement may sharpen if retaliation is delayed.', 'The Dobrynin backchannel may create a settlement that cannot be stated publicly.', 'A local military incident may outrun political instructions.', 'Alliance concerns over Berlin or Turkey may constrain an otherwise workable Cuba bargain.'],
      openingScene: 'Saturday, October 27, 1962 — noon. The Cabinet Room smells of coffee, cigarette smoke, and damp wool. Reconnaissance photographs cover the table beside the first report of Major Rudolf Anderson Jr.’s death over Cuba. General Curtis LeMay wants the responsible SAM site destroyed before delay looks like paralysis. Robert McNamara asks who controls the rung after retaliation—and whether anyone in this room can promise the answer.\n\nRobert Kennedy has word that Ambassador Anatoly Dobrynin may still carry a private proposal to Moscow: a non-invasion assurance, perhaps something unstated about the obsolete Jupiter missiles in Turkey. It is a route out, but not one the alliance or the Joint Chiefs can safely watch being negotiated. Before the President answers, an aide enters with an incomplete report: another American U-2 has strayed across the Soviet frontier near the Arctic, and fighters on both sides are moving.\n\nYou are President John F. Kennedy. Your objective is to remove the offensive missiles without allowing local incidents, military timetables, or public commitments to decide the war for you. You know what is on this table. You do not know every weapon already in Cuba, every order aboard the submarines below the quarantine line, or how firmly Moscow controls the men holding them. The next four hours belong to you only in part.',
      artifactFormats: ['White House memorandum', 'CIA intelligence cable', 'AP or UPI bulletin', 'CBS television report', 'Radio Moscow broadcast', 'Navy contact report', 'diplomatic telegram'],
    },
    executableHardRules: [
      { id: 'cmc_recon_capacity', description: 'Reconnaissance tasking requires an available reconnaissance sortie.', appliesTo: 'PLAYER', mechanismKinds: ['INTELLIGENCE'], effect: 'REQUIRE_RESOURCE', resourceId: 'recon_sorties', resourceAmount: 1 },
      { id: 'cmc_command_control', description: 'US military operations cannot be initiated after civilian command-and-control has collapsed.', appliesTo: 'PLAYER', mechanismKinds: ['MILITARY_OPERATION'], conditions: [{ targetType: 'METRIC', targetId: 'command_control', field: 'value', operator: 'LT', value: 30 }], effect: 'PROHIBIT' },
      { id: 'cmc_soviet_withdrawal', description: 'The United States cannot compel Soviet missile withdrawal by order; it can only demand it.', appliesTo: 'PLAYER', mechanismKinds: ['DIRECT_ORDER'], targetIds: ['khrushchev', 'soviet_cuba'], effect: 'DENY_AUTHORITY' },
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

  for (const entity of Object.values(state.entities)) {
    if (!manifest.authorityRules.some((rule) => rule.actorId === entity.id && rule.targetId === entity.id)) manifest.authorityRules.push({
      actorId: entity.id,
      targetId: entity.id,
      mechanismKinds: ['DIRECT_ORDER', 'DIPLOMACY', 'COERCION', 'ECONOMIC_PRESSURE', 'MILITARY_OPERATION', 'INTELLIGENCE', 'DECEPTION', 'LEGAL_ACTION', 'PUBLIC_COMMUNICATION', 'COALITION_BUILDING', 'RESOURCE_TRANSFER', 'OTHER'],
      mode: 'DIRECT',
      conditions: ['Limited to declared capabilities, resources, institutions, and constraints'],
    });
  }

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
  const campaign: Campaign = { state, beliefs, memories, audits: [], storySummary: '', narrativeCharacters: [], narrativeThreads: [], chronicle: [], aliases: {}, forecastRecord: emptyForecastRecord() };
  assertValidScenario(campaign);
  return campaign;
};

export const createCampaign = (scenarioId = 'cuban_missile_crisis_black_saturday', seed?: number): Campaign => {
  if (scenarioId === 'cuban_missile_crisis_black_saturday') return createCubanCampaign(seed);
  if (scenarioId === 'american_twilight') return createTwilightCampaign(seed);
  if (scenarioId === 'governors_compact_1975') return createCoalitionCampaign(seed);
  if (scenarioId === 'operation_lantern') return createMilitaryCampaign(seed);
  throw new Error(`Unknown scenario: ${scenarioId}`);
};
