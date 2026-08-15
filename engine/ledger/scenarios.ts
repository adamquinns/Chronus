import { ScenarioDefinition } from './types';

/**
 * Scenarios are stories injected into a world the model already holds, not
 * graphs it must be projected into. Everything here is either something the
 * model could not know (what is true in THIS divergence, what is hidden from
 * the player) or something that shapes the telling.
 */

export const CUBA: ScenarioDefinition = {
  id: 'cuban_missile_crisis',
  title: 'Midnight in Havana',
  premise: 'Black Saturday, 27 October 1962. Two weeks into the Cuban Missile Crisis. A U-2 has been shot down over Cuba this morning and its pilot killed — the first combat death of the crisis. Soviet medium-range missiles remain on the island. A naval quarantine is in force. Strategic forces on both sides stand at unprecedented alert, and there is no hotline between Washington and Moscow.',
  playerId: 'kennedy',
  playerName: 'John F. Kennedy',
  playerRole: 'President of the United States',
  authority: [
    'Commander-in-chief: the armed forces execute lawful orders, though senior officers argue hard and may resign rather than comply with what they believe reckless.',
    'Head of the executive branch: departments and agencies act on presidential direction; the CIA, State and Defense devise their own methods once given an objective.',
    'No authority whatever over Soviet or Cuban forces, over Congress, or over the courts.',
    'Cabinet members serve at the president’s pleasure but cannot be compelled to stay, and their resignations are public events.',
  ],
  date: '1962-10-27T12:00:00-05:00',
  divergence: 'The record diverges from noon on 27 October 1962. What follows is this simulation’s history, not the one that happened.',
  turnLength: '4 hours',
  objective: 'Secure the verified removal of Soviet offensive missiles from Cuba without a nuclear exchange.',
  deadlineTurn: 12,
  readings: [
    { id: 'nuclear_tension', label: 'Nuclear Tension', start: 82, meaning: 'How near the two sides stand to an exchange neither intends.' },
    { id: 'alliance_cohesion', label: 'Alliance Cohesion', start: 68, meaning: 'Whether the Western alliance holds together behind American decisions.' },
    { id: 'domestic_support', label: 'Domestic Support', start: 61, meaning: 'Political support at home for the administration’s handling of the crisis.' },
    { id: 'command_control', label: 'Command Control', start: 54, meaning: 'How firmly civilian authority governs what the military actually does.' },
    { id: 'diplomatic_space', label: 'Diplomatic Space', start: 43, meaning: 'How much room remains for a settlement either side could accept.' },
  ],
  opening: [
    { statement: 'Major Rudolf Anderson Jr. was killed this morning when his U-2 was shot down over eastern Cuba by a Soviet SA-2 battery.', provenance: 'VERIFIED_FACT', audience: { kind: 'PUBLIC' }, sourceRefs: ['John F. Kennedy Presidential Library, Black Saturday records'] },
    { statement: 'The Joint Chiefs, led by General Curtis LeMay, are pressing for OPLAN 312 air strikes against Cuban air defences and have them ready to execute.', provenance: 'VERIFIED_FACT', audience: { kind: 'PUBLIC' } },
    { statement: 'Robert Kennedy holds a private channel to Soviet Ambassador Anatoly Dobrynin that both governments can disown.', provenance: 'VERIFIED_FACT', audience: { kind: 'PARTIES', partyIds: ['kennedy', 'rfk', 'khrushchev'] } },
    { statement: 'Two letters have arrived from Khrushchev on successive days with different terms; the second is harder than the first and adds the Jupiter missiles in Turkey.', provenance: 'VERIFIED_FACT', audience: { kind: 'PLAYER' } },
    { statement: 'US destroyers are signalling a submerged Soviet submarine near the quarantine line with practice depth charges.', provenance: 'VERIFIED_FACT', audience: { kind: 'PUBLIC' } },
  ],
  hidden: [
    { statement: 'Soviet tactical nuclear weapons are already deployed in Cuba, intended for use against an invasion force. American intelligence does not know this.', provenance: 'VERIFIED_FACT', audience: { kind: 'PARTIES', partyIds: ['khrushchev', 'soviet_forces', 'castro'] } },
    { statement: 'Submarine B-59 carries a nuclear-armed torpedo, its crew has been out of contact with Moscow for days, and its officers believe war may already have begun.', provenance: 'VERIFIED_FACT', audience: { kind: 'PARTIES', partyIds: ['b59'] } },
    { statement: 'Khrushchev has privately decided he will settle for a public non-invasion pledge, and is drafting the message that says so.', provenance: 'WELL_SUPPORTED_INFERENCE', audience: { kind: 'PARTIES', partyIds: ['khrushchev'] } },
    { statement: 'The SA-2 battery that killed Anderson fired without authorisation from Moscow; Soviet commanders in Cuba have since been ordered to seek explicit approval.', provenance: 'VERIFIED_FACT', audience: { kind: 'PARTIES', partyIds: ['khrushchev', 'soviet_forces'] } },
  ],
  openThreads: [
    { title: 'The Two Letters', question: 'Which of Khrushchev’s two sets of terms, if either, will Washington answer?', partyIds: ['kennedy', 'khrushchev', 'rfk'], resolvedBy: 'A reply that one side can present as acceptable at home.', ifIgnored: 'Moscow reads silence as refusal and the harder terms harden further.' },
    { title: 'Pressure for Air Strikes', question: 'Will the president authorise OPLAN 312 against the SAM sites after Anderson’s death?', partyIds: ['kennedy', 'joint_chiefs', 'lemay'], resolvedBy: 'An order given, or a decision that visibly closes the option.', ifIgnored: 'The Chiefs press harder, and the argument leaks.' },
    { title: 'Submarine Contact', question: 'What happens to the Soviet submarine being signalled at the quarantine line?', partyIds: ['b59', 'us_navy', 'khrushchev'], resolvedBy: 'The boat surfaces, escapes, or is forced to act.', ifIgnored: 'The destroyers keep signalling, and the boat’s officers keep deciding.' },
  ],
  cast: [
    { id: 'khrushchev', name: 'Nikita Khrushchev', standing: 'Premier of the Soviet Union, looking for an exit that does not read as capitulation to his own hardliners.', towardPlayer: 'Adversary, but one who wants the same thing the president wants and cannot say so plainly.' },
    { id: 'castro', name: 'Fidel Castro', standing: 'Cuban premier, certain an invasion is coming, mobilising the population and pressing Moscow not to yield.', towardPlayer: 'Implacably hostile; no channel exists between them.' },
    { id: 'rfk', name: 'Robert F. Kennedy', standing: 'Attorney General, the president’s brother, running the Dobrynin channel.', towardPlayer: 'The most trusted person in the room.', commandedByPlayer: true },
    { id: 'lemay', name: 'General Curtis LeMay', standing: 'Air Force Chief of Staff, contemptuous of restraint, convinced delay is surrender by instalment.', towardPlayer: 'Loyal to the office and openly scornful of the man in it.', commandedByPlayer: true },
    { id: 'mcnamara', name: 'Robert McNamara', standing: 'Secretary of Defense, focused on keeping events from escaping political control.', towardPlayer: 'Trusted, analytical, willing to say what the president does not want to hear.', commandedByPlayer: true },
    { id: 'joint_chiefs', name: 'The Joint Chiefs of Staff', standing: 'Unanimous that the SAM site should be struck; OPLAN 312 is loaded and waiting.', towardPlayer: 'Will execute lawful orders, and will put their objections on the record first.', commandedByPlayer: true },
    { id: 'excomm', name: 'The Executive Committee', standing: 'The president’s crisis cabinet, split between those who want a strike and those who want a deal.', towardPlayer: 'Advisory; their consent is not required but their resignation would be an event.', commandedByPlayer: true },
  ],
  advisors: [
    { id: 'mcnamara', name: 'Robert McNamara', voice: 'Analytical, clipped, reframes danger as sequences and probabilities. Asks for the number of minutes before he answers.', bias: 'Systematically underweights how fast politics moves compared to how fast machinery does.' },
    { id: 'lemay', name: 'General Curtis LeMay', voice: 'Blunt, impatient, concrete. Speaks in operational readiness and treats hesitation as a decision already made.', bias: 'Cannot imagine an escalation that ends anywhere but American advantage.' },
    { id: 'rfk', name: 'Robert F. Kennedy', voice: 'Familiar, direct, uses the president’s first name. Argues in terms of what the other man can survive politically.', bias: 'Protects his brother’s position ahead of the merits, and trusts the channel he personally runs.' },
  ],
  voice: {
    era: 'October 1962. Teletype, cable traffic, Radio Moscow, black-and-white television bulletins, cigarette smoke in the Cabinet Room.',
    tone: 'Procedural and close. Men in a room deciding things on incomplete information, with the machinery of two governments moving underneath them.',
    textureNotes: [
      'Times of day and the elapsing clock matter and should be stated.',
      'Reconnaissance photographs, annotation sheets, cable numbers, flight call signs.',
      'The physical Cabinet Room: the table, the coffee, who is standing.',
      'Distance and delay: nothing in Moscow is heard from quickly.',
    ],
    forbiddenCliches: [
      'the order is in motion',
      'tensions rose',
      'the situation developed',
      'an observable world process changed independently',
      'under pressure',
      'the world held its breath',
    ],
  },
  research: { enabled: false, cutoff: '1962-10-27' },
  openingScene: 'Saturday, 27 October 1962, shortly after noon. The Cabinet Room smells of coffee and cigarette smoke. Reconnaissance photographs cover the table beside the first report of Major Anderson’s death over Cuba. LeMay wants the SAM site destroyed before dark. McNamara is asking who controls the rung above retaliation. Somewhere off the quarantine line, a destroyer is dropping practice charges on a submarine no one in this room knows is carrying a nuclear torpedo.',
};

export const SCENARIOS: Record<string, ScenarioDefinition> = {
  [CUBA.id]: CUBA,
};

export const getScenario = (id: string): ScenarioDefinition => {
  const scenario = SCENARIOS[id];
  if (!scenario) throw new Error(`Unknown scenario "${id}".`);
  return scenario;
};
