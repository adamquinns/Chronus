import { ScenarioDraft, initializeScenarioDraft } from './authoring';
import { Campaign } from './domain';
import { assertValidScenario } from './scenario';

const publicRule = () => ({ classification: 'PUBLIC' as const, actorIds: [], discoverable: false });
const playerRule = () => ({ classification: 'PLAYER_KNOWN' as const, actorIds: ['coalition_director'], discoverable: false });
const actorRule = (...actorIds: string[]) => ({ classification: 'ACTOR_KNOWN' as const, actorIds, discoverable: true });
const privateRule = (...actorIds: string[]) => ({ classification: 'ACTOR_PRIVATE' as const, actorIds, discoverable: true });

export const createTwilightCampaign = (seed = 20251105): Campaign => {
  const draft: ScenarioDraft = {
    id: 'american_twilight',
    title: 'Twilight of the Republic',
    premise: 'November 2025. One year before the midterms, federal pressure on election administration, civil service, immigration enforcement, and dissent has become a coordinated struggle over whether democratic institutions can still constrain executive power.',
    startingDateLabel: 'November 5, 2025',
    startingDateTime: '2025-11-05T12:00:00-05:00',
    timeScale: { amount: 1, unit: 'MONTHS' },
    player: {
      id: 'coalition_director', name: 'National Democratic Resilience Coalition', role: 'National Coalition Director',
      objectives: ['Ensure free and fair 2026 midterm elections', 'Preserve independent state and civic capacity', 'Build a broad lawful coalition without triggering premature collapse'],
      capabilities: ['National organizing network', 'State-government relationships', 'Legal coordination', 'Press and civic communications', 'Secure coalition channels'],
      constraints: ['No authority over governors, courts, unions, parties, or election officials', 'Coalition partners disagree about tactics', 'Public attention is fragmented'],
    },
    metrics: [
      { id: 'democratic_integrity', label: 'Democratic Integrity', description: 'Independence and practical resilience of election and constitutional institutions.', value: 48, dangerBelow: 20 },
      { id: 'coalition_cohesion', label: 'Coalition Cohesion', description: 'Capacity of state, legal, labor, and civic partners to coordinate.', value: 43, dangerBelow: 18 },
      { id: 'public_legitimacy', label: 'Public Legitimacy', description: 'Public acceptance of lawful democratic resistance and election administration.', value: 52, dangerBelow: 22 },
      { id: 'federal_consolidation', label: 'Federal Consolidation', description: 'Administrative capacity to subordinate institutions and election administration.', value: 64, dangerAbove: 88 },
      { id: 'legal_resilience', label: 'Legal Resilience', description: 'Readiness and credibility of litigation and institutional defense.', value: 46 },
      { id: 'exposure_risk', label: 'Coalition Exposure', description: 'Risk that private coordination is exposed before partners are prepared.', value: 28, dangerAbove: 82 },
      { id: 'civic_mobilization', label: 'Civic Mobilization', description: 'Sustainable community and labor participation beyond episodic protest.', value: 39 },
    ],
    entities: [
      { id: 'white_house', name: 'The White House Inner Circle', kind: 'INSTITUTION', description: 'A leader-centered executive network using unitary-executive theories, personnel control, enforcement power, and public intimidation to consolidate authority.', objectives: ['Subordinate independent administration', 'Control the terms of the 2026 election', 'Fragment organized opposition'], capabilities: ['Executive orders', 'Federal appointments', 'National messaging', 'Emergency authorities'], constraints: ['Courts', 'State authority', 'Professional resistance', 'Public backlash'], power: 88, resolve: 87, visibility: publicRule() },
      { id: 'federal_enforcement', name: 'Federal Enforcement Apparatus', kind: 'INSTITUTION', description: 'DHS, ICE, CBP, DOJ, and FBI components with armed personnel, surveillance, litigation, and detention authorities but uneven internal loyalty.', objectives: ['Execute lawful-seeming directives', 'Preserve institutional power', 'Suppress operational resistance'], capabilities: ['Federal law enforcement', 'Surveillance systems', 'Detention infrastructure', 'Federal litigation'], constraints: ['Career dissent', 'Judicial orders', 'State non-cooperation', 'Logistical limits'], power: 84, resolve: 68, visibility: publicRule() },
      { id: 'blue_governors', name: 'Blue-State Governors’ Network', kind: 'FACTION', description: 'Governors including Gavin Newsom, JB Pritzker, and Kathy Hochul balancing open resistance, public services, budgets, and electoral pressure.', objectives: ['Protect state authority', 'Shield residents and election systems', 'Avoid isolated retaliation'], capabilities: ['State executive power', 'Attorneys general', 'National Guard authority', 'Public platforms'], constraints: ['Federal funding leverage', 'Courts', 'Divergent state interests'], power: 74, resolve: 69, visibility: publicRule() },
      { id: 'civil_rights', name: 'Civil-Rights Legal Coalition', kind: 'FACTION', description: 'Voting-rights, immigrant-rights, and civil-liberties organizations coordinating litigation and public documentation.', objectives: ['Block unlawful enforcement', 'Protect voters and targeted communities', 'Preserve credible evidence'], capabilities: ['Litigation teams', 'Plaintiff networks', 'Investigative documentation', 'Public advocacy'], constraints: ['Court capacity', 'Funding limits', 'Hostile precedent'], power: 63, resolve: 82, visibility: publicRule() },
      { id: 'labor', name: 'Organized Labor Network', kind: 'FACTION', description: 'The AFL-CIO and major unions possess unusual disruptive capacity but face member division and legal retaliation.', objectives: ['Protect organizing and bargaining rights', 'Defend democratic participation', 'Avoid a strategically ruinous failed mobilization'], capabilities: ['Workplace networks', 'Strike capacity', 'Member communications', 'Political field operations'], constraints: ['Member division', 'Low union density', 'Financial and legal exposure'], power: 69, resolve: 58, visibility: publicRule() },
      { id: 'election_officials', name: 'State and Local Election Officials', kind: 'INSTITUTION', description: 'Secretaries of state, county clerks, and administrators facing federal demands, threats, attrition, and technical pressure.', objectives: ['Run accurate lawful elections', 'Protect personnel and systems', 'Maintain public trust'], capabilities: ['Election administration', 'Certification authority', 'Technical expertise', 'State legal duties'], constraints: ['Threats', 'Staff attrition', 'Partisan oversight', 'Federal subpoenas'], power: 61, resolve: 62, visibility: publicRule() },
      { id: 'federal_courts', name: 'Federal Courts', kind: 'INSTITUTION', description: 'A conservative judiciary that may validate broad executive power while retaining procedural and institutional limits of its own.', objectives: ['Preserve judicial authority', 'Apply governing doctrine', 'Avoid direct institutional humiliation'], capabilities: ['Injunctions', 'Appellate review', 'Contempt authority', 'Legitimating judgments'], constraints: ['Enforcement dependence', 'Ideological division', 'Slow process'], power: 81, resolve: 66, visibility: publicRule() },
      { id: 'media_network', name: 'Administration-Aligned Media Network', kind: 'FACTION', description: 'Broadcast, digital, donor, and influencer networks that frame consolidation as law and order and resistance as sabotage.', objectives: ['Sustain leader legitimacy', 'Discredit opposition', 'Normalize institutional capture'], capabilities: ['National audience', 'Donor coordination', 'Rapid message amplification'], constraints: ['Credibility outside core audience', 'Fragmented information environment'], power: 77, resolve: 84, visibility: publicRule() },
    ],
    resources: [
      { id: 'field_organizers', label: 'Field Organizers', amount: 18, unit: 'regional teams', renewable: true, ownerId: 'coalition_director', visibility: playerRule() },
      { id: 'legal_teams', label: 'Coordinated Legal Teams', amount: 10, unit: 'teams', renewable: true, ownerId: 'coalition_director', visibility: playerRule() },
      { id: 'emergency_fund', label: 'Emergency Defense Fund', amount: 24, unit: 'funding units', renewable: false, ownerId: 'coalition_director', visibility: playerRule() },
      { id: 'secure_channels', label: 'Secure Coalition Channels', amount: 6, unit: 'channels', renewable: true, ownerId: 'coalition_director', visibility: playerRule() },
      { id: 'enforcement_capacity', label: 'Federal Enforcement Capacity', amount: 82, unit: 'deployment units', renewable: true, ownerId: 'federal_enforcement', visibility: privateRule('white_house', 'federal_enforcement') },
    ],
    relationships: [
      { id: 'coalition_governors', fromId: 'coalition_director', toId: 'blue_governors', alignment: 74, trust: 56, leverage: 48, communication: true, commitments: ['Share verified federal demands before public response'], visibility: actorRule('coalition_director', 'blue_governors') },
      { id: 'coalition_civil_rights', fromId: 'coalition_director', toId: 'civil_rights', alignment: 82, trust: 68, leverage: 41, communication: true, commitments: ['Protect plaintiffs and source confidentiality'], visibility: actorRule('coalition_director', 'civil_rights') },
      { id: 'coalition_labor', fromId: 'coalition_director', toId: 'labor', alignment: 66, trust: 49, leverage: 57, communication: true, commitments: [], visibility: actorRule('coalition_director', 'labor') },
      { id: 'coalition_elections', fromId: 'coalition_director', toId: 'election_officials', alignment: 79, trust: 52, leverage: 32, communication: true, commitments: ['Do not politicize technical security work'], visibility: actorRule('coalition_director', 'election_officials') },
      { id: 'white_house_enforcement', fromId: 'white_house', toId: 'federal_enforcement', alignment: 84, trust: 61, leverage: 88, communication: true, commitments: ['Prioritize election-integrity and immigration directives'], visibility: privateRule('white_house', 'federal_enforcement') },
      { id: 'white_house_courts', fromId: 'white_house', toId: 'federal_courts', alignment: 61, trust: 43, leverage: 52, communication: true, commitments: [], visibility: publicRule() },
    ],
    facts: [
      { id: 'public_federal_demands', statement: 'DOJ has publicly demanded voter-roll and election-system access from selected jurisdictions.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'VERY_HIGH', visibility: publicRule(), sourceRefs: ['Preserved speculative source: docs/source_material/legacy-scenarios.ts.txt'] },
      { id: 'coalition_contacts', statement: 'Several governors and election officials are willing to coordinate privately if legal and security safeguards are credible.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'HIGH', visibility: playerRule(), sourceRefs: ['Scenario premise'] },
      { id: 'target_county_plan', statement: 'The federal enforcement network is preparing a coercive intervention focused on three high-population counties.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'HIGH', visibility: privateRule('white_house', 'federal_enforcement'), sourceRefs: ['Scenario divergence assumption'] },
      { id: 'court_swing_vote', statement: 'A pivotal appellate judge is privately skeptical of compelled access to voting equipment on procedural grounds.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'MEDIUM', visibility: privateRule('federal_courts'), sourceRefs: ['Scenario divergence assumption'] },
      { id: 'labor_division', statement: 'Several major union locals will not support disruptive action without a specific election-related trigger.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'HIGH', visibility: privateRule('labor'), sourceRefs: ['Scenario divergence assumption'] },
      { id: 'career_resistance', statement: 'Career personnel inside federal enforcement are preserving records and quietly slowing selected directives.', provenance: 'SCENARIO_ABSTRACTION', confidence: 'MEDIUM', visibility: privateRule('federal_enforcement'), sourceRefs: ['Scenario divergence assumption'] },
    ],
    arcs: [
      { id: 'federal_takeover', title: 'Federal Election Intervention', description: 'Legal, administrative, and enforcement preparations for direct federal leverage over election systems.', progress: 46, direction: 'RISING', dueTurn: 10, ownerId: 'white_house', participantIds: ['white_house', 'federal_enforcement', 'election_officials'], visibility: playerRule() },
      { id: 'state_compact', title: 'State Resilience Compact', description: 'Governors, attorneys general, and election officials are testing whether private coordination can become durable.', progress: 24, direction: 'RISING', dueTurn: 8, ownerId: 'blue_governors', participantIds: ['coalition_director', 'blue_governors', 'election_officials'], visibility: playerRule() },
      { id: 'civic_front', title: 'Civic and Labor Mobilization', description: 'Legal groups, communities, and unions are negotiating shared triggers and limits.', progress: 19, direction: 'RISING', ownerId: 'labor', participantIds: ['coalition_director', 'civil_rights', 'labor'], visibility: playerRule() },
      { id: 'administrative_purge', title: 'Administrative Purge', description: 'Personnel reclassification and loyalty enforcement are reducing professional resistance.', progress: 58, direction: 'RISING', dueTurn: 7, ownerId: 'white_house', participantIds: ['white_house', 'federal_enforcement'], visibility: publicRule() },
    ],
    goal: {
      id: 'free_midterms', title: 'Ensure Free and Fair Midterm Elections', description: 'Reach November 2026 with independent election administration capable of conducting and certifying results without widespread suppression, violent disruption, or federal takeover.',
      victoryConditions: ['Democratic integrity and coalition cohesion remain viable through certification'], failureConditions: ['Election administration is subordinated or democratic integrity collapses'],
      victoryRules: [{ targetType: 'METRIC', targetId: 'democratic_integrity', field: 'value', operator: 'GTE', value: 65 }, { targetType: 'METRIC', targetId: 'coalition_cohesion', field: 'value', operator: 'GTE', value: 60 }],
      failureRules: [{ targetType: 'METRIC', targetId: 'federal_consolidation', field: 'value', operator: 'GTE', value: 96 }, { targetType: 'METRIC', targetId: 'democratic_integrity', field: 'value', operator: 'LTE', value: 8 }],
      victoryMode: 'ALL', failureMode: 'ANY', deadlineTurn: 12, terminalOnAchievement: true, terminalOnFailure: true,
    },
    hardRules: ['The coalition cannot order governors, courts, unions, parties, or election officials.', 'Legal action consumes coordinated legal capacity.', 'Private coalition coordination can be detected.', 'Public claims do not create institutional compliance.'],
    calibrationRules: [
      { id: 'twilight_coalition', mechanismKind: 'COALITION_BUILDING', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE'], defaultImpactClass: 'MINOR', rationale: 'Durable political trust accumulates through repeated commitments.' },
      { id: 'twilight_legal', mechanismKind: 'LEGAL_ACTION', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR'], defaultImpactClass: 'MODERATE', rationale: 'A credible injunction can change timing without settling the constitutional conflict.' },
      { id: 'twilight_exposure', targetId: 'exposure_risk', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR'], defaultImpactClass: 'MODERATE', rationale: 'Premature disclosure can rapidly damage a fragile private coalition.' },
      { id: 'twilight_integrity', targetId: 'democratic_integrity', allowedImpactClasses: ['NONE', 'TRIVIAL', 'MINOR', 'MODERATE', 'MAJOR'], defaultImpactClass: 'MINOR', rationale: 'Institutional integrity normally changes cumulatively rather than in one speech.' },
    ],
    historicalAnalogs: [
      { id: 'election_2020_officials', label: 'State and local certification under pressure in 2020', mechanismKind: 'COALITION_BUILDING', targetId: 'democratic_integrity', impactClass: 'MODERATE', context: 'Distributed officials, courts, and administrators preserved certification through institution-specific actions.', provenance: 'VERIFIED_FACT', sourceRefs: ['U.S. Cybersecurity and Infrastructure Security Agency, Joint Statement from Elections Infrastructure Government Coordinating Council, November 12, 2020'] },
      { id: 'watergate_institutions', label: 'Institutional checks during Watergate', mechanismKind: 'LEGAL_ACTION', targetId: 'legal_resilience', impactClass: 'MODERATE', context: 'Courts, Congress, press, and executive-branch officials created mutually reinforcing constraints over time.', provenance: 'WELL_SUPPORTED_INFERENCE', sourceRefs: ['U.S. Senate Select Committee on Presidential Campaign Activities, final report'] },
    ],
    advisors: [
      { id: 'advisor_pritzker', name: 'JB Pritzker', expertise: ['State executive power', 'Federal-state conflict'], worldview: 'States must create practical lines the federal government cannot cross alone.', bias: 'May overestimate how readily other governors will accept retaliation.', relationship: 61, actorId: 'blue_governors' },
      { id: 'advisor_shuler', name: 'Liz Shuler', expertise: ['Labor mobilization', 'Coalition durability'], worldview: 'Democratic defense becomes real only when working people can act through durable organizations.', bias: 'Protects labor capacity from symbolic actions without credible triggers.', relationship: 58, actorId: 'labor' },
      { id: 'advisor_counsel', name: 'Coalition General Counsel', expertise: ['Election law', 'Emergency litigation'], worldview: 'Every escalation needs standing, evidence, a remedy, and an institution capable of enforcing it.', bias: 'Can mistake a legally precise position for a politically sufficient strategy.', relationship: 74, actorId: 'civil_rights' },
    ],
    unresolvedUncertainties: ['How far federal enforcement personnel will comply with unlawful pressure.', 'Whether courts will enforce narrow procedural limits against executive claims.', 'Which governors will accept retaliation for collective action.', 'Whether labor can agree on a credible democratic trigger.'],
    beliefOverrides: [
      { actorId: 'coalition_director', subjectId: 'federal_consolidation', field: 'value', range: [56, 72], confidence: 'MEDIUM', sourceFactIds: ['public_federal_demands'] },
      { actorId: 'white_house', subjectId: 'coalition_cohesion', field: 'value', range: [22, 42], confidence: 'LOW', sourceFactIds: [] },
    ],
  };
  const campaign = initializeScenarioDraft(draft, seed);
  campaign.state.manifest.timeZone = 'America/New_York';
  campaign.state.manifest.metricRoles = { cohesion: 'coalition_cohesion', support: 'public_legitimacy', oppositionMomentum: 'federal_consolidation', legal: 'legal_resilience', exposure: 'exposure_risk', intelligence: 'democratic_integrity' };
  campaign.state.manifest.voice = {
    era: 'United States, speculative November 2025', tone: 'institutionally realistic, anxious, sober, resistant to melodrama',
    diction: ['injunction', 'certification', 'subpoena', 'state authority', 'organizer report', 'federal guidance'],
    textureNotes: ['Use court filings, coalition calls, local reporting, legal deadlines, staff attrition, and concrete administrative procedure.', 'Slow institutional change can be dramatic. Competing factions should frame the same event differently.'],
    forbiddenCliches: ['tensions rose', 'the world watched', 'unprecedented times', 'a dramatic turn', 'history held its breath'],
  };
  campaign.state.manifest.narrativeWorld = {
    sourceMaterialRef: 'docs/source_material/legacy-scenarios.ts.txt#american_twilight',
    canonicalContext: [
      'The scenario is a speculative branch, not a claim that every described 2025 event is verified history.',
      'Executive consolidation works through personnel rules, enforcement discretion, legal theories, funding pressure, and election-administration demands while preserving a veneer of legality.',
      'Blue-state governments, civil-rights litigators, labor, community organizations, election officials, courts, media networks, and conservative rule-of-law dissenters are distinct centers of power with conflicting incentives.',
      'Public fear about democracy is widespread but does not automatically create coordinated resistance.',
      'Election workers face threats, subpoenas, attrition, and technical pressure; their professional capacity is strategically important.',
      'Federal security institutions are powerful but not monolithic; career resistance, compliance, and opportunism coexist.',
    ],
    playerContext: ['You coordinate rather than command. Every governor, union, legal group, and election official retains independent authority.', 'Your objective is a free and certifiable November 2026 election, not merely favorable headlines.', 'Private coordination can create strength, but discovery before commitments harden can invite targeted retaliation.'],
    immediateHistory: ['One year remains before the 2026 midterms.', 'DOJ demands for voter data and voting-system access are escalating in selected jurisdictions.', 'State officials and legal organizations are discussing a shared response but have not formed a binding compact.', 'Civil-service reclassification and agency purges are eroding professional resistance.'],
    locations: ['Washington, D.C.', 'state capitols in California, Illinois, and New York', 'county election offices', 'federal courthouses', 'union halls and community legal clinics'],
    institutions: ['Department of Justice', 'DHS and ICE', 'state attorneys general', 'county election boards', 'federal courts', 'AFL-CIO', 'civil-rights litigation networks'],
    narrativeGuidance: ['Favor institutional realism over cinematic conspiracy.', 'Use specific procedures, deadlines, documents, and organizations.', 'Keep speculative scenario assumptions clearly distinct from sourced past context.', 'Let factions disagree about law, legitimacy, messaging, disruption, and risk.'],
    storyPossibilities: ['A private state compact may fracture over public messaging.', 'Labor may demand a concrete trigger before committing disruptive capacity.', 'Career officials may preserve evidence or slow directives if they believe outside institutions can protect them.', 'A narrow court victory may buy time without resolving the larger conflict.'],
    openingScene: 'November 2025 — 7:10 p.m. Pacific. A secure coalition call begins twelve minutes after the Justice Department sends three states a forty-eight-hour demand for voter-file extracts and access to selected election equipment. The request is written as routine oversight. County officials read it as the opening move in a federal intervention they may be ordered to facilitate.\n\nJB Pritzker wants the governors to refuse together, before Washington can isolate them one at a time. Liz Shuler says labor will defend election workers, but not through a theatrical mobilization with no agreed trigger and no protection for members. Coalition counsel has draft language for an injunction and no plaintiff she trusts to survive the first hearing. An election director from a targeted county asks that nobody name her staff on television.\n\nBefore the call ends, an administration-aligned network reports that unnamed governors are obstructing an election-integrity review. The language from a private draft memorandum appears almost verbatim on screen. Someone has disclosed the shape of the conversation, though not yet its participants.\n\nYou are the coalition’s national director. You can convene governors, litigators, unions, civic organizations, and election professionals; you cannot command any of them. Your objective is not a news-cycle victory. It is to reach the 2026 midterms with lawful election administration still capable of conducting and certifying a result. Every institution at this table has its own authority, constituency, fear, and breaking point.',
    artifactFormats: ['AP national wire', 'state attorney general memorandum', 'county election-security bulletin', 'coalition organizer report', 'federal court filing', 'administration-aligned cable segment'],
  };
  campaign.state.manifest.executableHardRules = [
    { id: 'no_direct_orders', description: 'The coalition has no direct authority over governors, courts, unions, election officials, or federal agencies.', appliesTo: 'PLAYER', mechanismKinds: ['DIRECT_ORDER'], targetIds: ['blue_governors', 'civil_rights', 'labor', 'election_officials', 'federal_courts', 'white_house', 'federal_enforcement'], effect: 'DENY_AUTHORITY' },
    { id: 'legal_capacity', description: 'Legal action requires at least one coordinated legal team.', appliesTo: 'PLAYER', mechanismKinds: ['LEGAL_ACTION'], effect: 'REQUIRE_RESOURCE', resourceId: 'legal_teams', resourceAmount: 1 },
    { id: 'secure_private_coordination', description: 'Private coalition coordination requires an available secure channel.', appliesTo: 'PLAYER', mechanismKinds: ['DECEPTION', 'COALITION_BUILDING'], effect: 'REQUIRE_RESOURCE', resourceId: 'secure_channels', resourceAmount: 1 },
  ];
  const advisorDetail = {
    advisor_pritzker: {
      biography: 'Illinois governor and national political figure accustomed to using state authority in direct conflict with federal policy.',
      voice: 'Blunt, executive, impatient with symbolic protest; returns to what states can operationally refuse or protect.',
      speechHabits: ['asks which governors will sign', 'turns principles into an executable state action'],
      personalStakes: 'Illinois institutions and residents will be exposed if a multi-state defense collapses into isolated defiance.',
      recurringTension: 'Wants visible resolve sooner than legal and election partners consider safe.',
    },
    advisor_shuler: {
      biography: 'President of the AFL-CIO, responsible for a broad labor federation whose members do not share one political risk tolerance.',
      voice: 'Coalitional and practical; tests every proposal against member trust, workplace capacity, and whether leaders will still be present after retaliation.',
      speechHabits: ['asks for a concrete trigger', 'distinguishes durable organization from a public gesture'],
      personalStakes: 'A failed mobilization could damage both democratic defense and organized labor’s remaining capacity.',
      recurringTension: 'Will not spend labor power to compensate for political leaders who have not accepted comparable risk.',
    },
    advisor_counsel: {
      biography: 'A composite senior election and civil-rights lawyer coordinating litigation across organizations and jurisdictions.',
      voice: 'Exact, skeptical, procedural; names the plaintiff, forum, evidence, remedy, and enforcement problem before calling a plan legal.',
      speechHabits: ['separates a claim from a remedy', 'asks what fact can be proved by morning'],
      personalStakes: 'A premature test case could create precedent that weakens every later defense.',
      recurringTension: 'Legal precision buys time but cannot by itself build political compliance.',
    },
  };
  campaign.state.manifest.advisors = campaign.state.manifest.advisors.map((advisor) => ({ ...advisor, ...advisorDetail[advisor.id as keyof typeof advisorDetail] }));
  assertValidScenario(campaign);
  return campaign;
};
