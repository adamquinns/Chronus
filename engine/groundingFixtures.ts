import { GroundingFixture, Id } from './domain';
import { visibility } from './visibility';

const pub = () => visibility('PUBLIC');

const person = (
  id: Id,
  name: string,
  description: string,
  objectives: string[],
  capabilities: string[],
  constraints: string[],
  power: number,
  resolve: number,
) => ({
  id,
  name,
  kind: 'PERSON' as const,
  description,
  objectives,
  capabilities,
  constraints,
  status: 'ACTIVE' as const,
  power,
  resolve,
  privateFacts: [],
  visibility: pub(),
  fieldVisibility: {},
});

const officeFact = (id: Id, statement: string, sourceRefs: string[]) => ({
  id,
  statement,
  provenance: 'VERIFIED_FACT' as const,
  confidence: 'VERY_HIGH' as const,
  visibility: pub(),
  source: 'Grounding fixture',
  sourceRefs,
  createdTurn: 0,
});

/**
 * Known-answer grounding fixtures, keyed by scenario id. These are authoring
 * data, NOT world state: they never enter authoritative snapshots or model
 * prompts. They serve (a) deterministic offline grounding, (b) known-answer
 * tests that fail when a grounder is confidently wrong about the period.
 */
export const GROUNDING_FIXTURES: Record<string, GroundingFixture[]> = {
  cuban_missile_crisis_black_saturday: [
    {
      id: 'fixture_lbj',
      aliases: ['lbj', 'lyndon johnson', 'lyndon b johnson', 'vice president johnson', 'the vice president', 'my vp', 'vp lbj', 'my vp lbj', 'johnson'],
      entity: person(
        'lyndon_johnson',
        'Lyndon B. Johnson',
        'Vice President of the United States; a formidable legislative operator kept at the edge of the ExComm inner circle, attentive to his standing and to Texas politics.',
        ['Preserve his position and political future', 'Avoid a public rupture with the administration during the crisis'],
        ['Senate relationships and legislative influence', 'Public political voice', 'Constitutional office of the vice presidency'],
        ['No independent command authority', 'Standing depends on the president'],
        55,
        62,
      ),
      facts: [officeFact(
        'fact_lbj_office',
        'Lyndon B. Johnson serves as Vice President of the United States (October 1962).',
        ['U.S. Senate, Vice Presidents of the United States'],
      )],
      relationships: [{
        id: 'kennedy_johnson',
        fromId: 'kennedy',
        toId: 'lyndon_johnson',
        alignment: 55,
        trust: 40,
        leverage: 62,
        communication: true,
        commitments: [],
        visibility: pub(),
      }],
    },
    {
      id: 'fixture_rfk',
      aliases: ['rfk', 'robert kennedy', 'robert f kennedy', 'bobby', 'bobby kennedy', 'the attorney general', 'attorney general'],
      entity: person(
        'robert_kennedy',
        'Robert F. Kennedy',
        'Attorney General and the president’s brother; the administration’s most trusted private channel, running the quiet contact with Ambassador Dobrynin.',
        ['Protect the president', 'Find a negotiated exit that avoids humiliation or war'],
        ['Justice Department authority', 'Private diplomatic backchannel to Ambassador Dobrynin', 'Unmatched access to the president'],
        ['No military command authority', 'Effectiveness depends on discretion'],
        60,
        75,
      ),
      facts: [officeFact(
        'fact_rfk_office',
        'Robert F. Kennedy serves as Attorney General of the United States (October 1962).',
        ['U.S. Department of Justice, Attorneys General'],
      )],
      relationships: [{
        id: 'kennedy_rfk',
        fromId: 'kennedy',
        toId: 'robert_kennedy',
        alignment: 92,
        trust: 95,
        leverage: 40,
        communication: true,
        commitments: [],
        visibility: pub(),
      }],
    },
    {
      id: 'fixture_florida_governor',
      aliases: ['governor of florida', 'florida governor', 'the governor of florida', 'farris bryant', 'c farris bryant', 'governor bryant'],
      entity: person(
        'farris_bryant',
        'C. Farris Bryant',
        'Governor of Florida; a segregation-era Democrat managing a state on the crisis’s front line, with civil-defense responsibilities and a large Cuban exile population in Miami.',
        ['Protect Florida and its economy', 'Maintain standing with Washington and Florida voters'],
        ['Florida state government and National Guard (state role)', 'Civil defense coordination', 'Political voice in the South'],
        ['No federal or military authority', 'Cannot conduct foreign policy'],
        38,
        55,
      ),
      facts: [officeFact(
        'fact_florida_governor',
        'C. Farris Bryant serves as Governor of Florida (October 1962).',
        ['Florida Department of State, Governors of Florida'],
      )],
      relationships: [{
        id: 'kennedy_bryant',
        fromId: 'kennedy',
        toId: 'farris_bryant',
        alignment: 60,
        trust: 55,
        leverage: 70,
        communication: true,
        commitments: [],
        visibility: pub(),
      }],
    },
    {
      id: 'fixture_pope',
      aliases: ['pope', 'the pope', 'pope john xxiii', 'the vatican', 'vatican', 'holy see'],
      entity: person(
        'pope_john_xxiii',
        'Pope John XXIII',
        'Bishop of Rome; a globally trusted moral voice already privately urging both superpowers toward restraint.',
        ['Prevent nuclear war', 'Preserve the Church’s independence as a mediator'],
        ['Global moral authority', 'Vatican diplomatic channels to both blocs', 'Public appeal capacity'],
        ['No temporal enforcement power', 'Must remain visibly neutral'],
        45,
        80,
      ),
      facts: [officeFact(
        'fact_pope_office',
        'John XXIII is the reigning Pope (October 1962), days into the Second Vatican Council.',
        ['Vatican, Annuario Pontificio'],
      )],
      relationships: [{
        id: 'kennedy_vatican',
        fromId: 'kennedy',
        toId: 'pope_john_xxiii',
        alignment: 65,
        trust: 60,
        leverage: 20,
        communication: true,
        commitments: [],
        visibility: pub(),
      }],
    },
    {
      id: 'fixture_u_thant',
      aliases: ['u thant', 'un secretary general', 'un secretary-general', 'secretary general of the united nations', 'the united nations', 'the un'],
      entity: person(
        'u_thant',
        'U Thant',
        'Acting Secretary-General of the United Nations; actively proposing a standstill between the superpowers and available as a face-saving intermediary.',
        ['Broker a peaceful resolution', 'Preserve the UN’s credibility as mediator'],
        ['UN mediation and public proposals', 'Direct channels to Washington, Moscow, and Havana'],
        ['No enforcement power', 'Must appear even-handed'],
        40,
        70,
      ),
      facts: [officeFact(
        'fact_u_thant_office',
        'U Thant serves as Acting Secretary-General of the United Nations (October 1962).',
        ['United Nations, Secretaries-General'],
      )],
      relationships: [{
        id: 'kennedy_u_thant',
        fromId: 'kennedy',
        toId: 'u_thant',
        alignment: 55,
        trust: 55,
        leverage: 30,
        communication: true,
        commitments: [],
        visibility: pub(),
      }],
    },
    {
      id: 'fixture_macmillan',
      aliases: ['harold macmillan', 'macmillan', 'uk prime minister', 'british prime minister', 'prime minister of the united kingdom', 'the british'],
      entity: person(
        'harold_macmillan',
        'Harold Macmillan',
        'Prime Minister of the United Kingdom; Kennedy’s closest allied confidant, consulted nightly by phone, balancing alliance solidarity against British fears of escalation.',
        ['Keep the United States and NATO aligned', 'Avoid nuclear war over Cuba'],
        ['UK government and armed forces', 'Direct personal channel to Kennedy', 'Influence inside NATO'],
        ['Domestic skepticism of US brinkmanship', 'Limited leverage over Soviet decisions'],
        50,
        60,
      ),
      facts: [officeFact(
        'fact_macmillan_office',
        'Harold Macmillan serves as Prime Minister of the United Kingdom (October 1962).',
        ['UK Government, Past Prime Ministers'],
      )],
      relationships: [{
        id: 'kennedy_macmillan',
        fromId: 'kennedy',
        toId: 'harold_macmillan',
        alignment: 80,
        trust: 78,
        leverage: 35,
        communication: true,
        commitments: ['NATO collective defense'],
        visibility: pub(),
      }],
    },
  ],
};

export const fixturesForScenario = (scenarioId: string): GroundingFixture[] =>
  GROUNDING_FIXTURES[scenarioId] ?? [];
