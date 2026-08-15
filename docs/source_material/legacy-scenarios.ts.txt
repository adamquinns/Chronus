import { Scenario } from '../types';

export const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 'rome_survives',
    title: 'The Eternal Empire',
    startingYear: '461 AD',
    description: 'Western Rome does not fall. Majorian survives Ricimer\'s betrayal. Now, a reformed but bankrupt Empire faces the Vandal threat.',
    imageUrl: 'https://picsum.photos/id/1015/400/200',
    promptContext: `
      TIMELINE: 461 AD (Divergence: Majorian executes Ricimer at Tortona).
      ROLE: Emperor Majorian.
      
      === STATE OF THE EMPIRE ===
      TREASURY: Critically Low (Can sustain 2 legions for 6 months).
      STABILITY: Fragile (The Senate hates your reforms; the Army loves your victories).
      
      === MILITARY ASSETS ===
      1. THE COMITATENSES (Italy): 15,000 veteran troops, loyal but unpaid.
      2. THE GALLIC FIELD ARMY (Gaul): Commanded by Aegidius. Currently refusing orders until back-pay arrives.
      3. THE FLEET (Cartagena): 300 ships under construction. 50% operational.
      
      === KEY FACTIONS & FIGURES ===
      - GENERAL AEGIDIUS (Gaul): Loyal to Rome, but hates the Senate.
      - KING GAISERIC (Vandals): Controls North Africa (Grain Supply). Cunning, elderly, holds Roman hostages.
      - THE SENATE (Rome): Led by the corrupt aristocrat Petronius. They are plotting to defund your fleet.
      
      === IMMEDIATE STRATEGIC THREATS ===
      1. FAMINE: The Vandals have cut the grain shipments. Rome has 3 months of food.
      2. INSOLVENCY: You seized church gold to build the fleet. The clergy is inciting riots.
      3. VISIGOTHS: King Theodoric II is "allied" but watching for weakness to seize Spain.
      
      === PRIMARY OBJECTIVE (GOAL) ===
      GOAL: Retake the Grain Supply in North Africa.
      TIMELINE: 12 Months.
      VICTORY CONDITION: Defeat the Vandal Fleet and secure Carthage.
      FAILURE CONDITION: Famine causes Rome to revolt.
    `
  },
  {
    id: 'cuban_crisis',
    title: 'Midnight in Havana',
    startingYear: '1962',
    description: 'October 27, 1962. "Black Saturday". A U-2 spy plane has been shot down over Cuba. The pilot is dead. The Joint Chiefs are demanding immediate air strikes.',
    imageUrl: 'https://picsum.photos/id/1025/400/200',
    promptContext: `
SETTING:
Late October 1962 – the height of the Cuban Missile Crisis. The world has been on edge for nearly two weeks. US reconnaissance has confirmed Soviet medium-range and intermediate-range nuclear missiles in Cuba, capable of striking most of the continental United States. In response, President John F. Kennedy has ordered a naval “quarantine” of the island to stop further offensive weapons from arriving. 

Strategic forces on both sides are at unprecedented peacetime alert. US Strategic Air Command has bombers airborne loaded with nuclear weapons and missiles primed; Soviet strategic forces are on their own heightened alert, with commanders under immense pressure not to appear weak. Communications between Washington and Moscow are slow and easily garbled – there is no hotline yet.

TRIGGER – OCTOBER 27, 1962 (“BLACK SATURDAY”):
On this morning, a US U-2 reconnaissance plane piloted by Major Rudolf Anderson Jr. is shot down over eastern Cuba by a Soviet S-75 (SA-2) surface-to-air missile battery. Anderson is killed – the first American combat casualty of the crisis. Until now, all US actions have been limited to surveillance flights and the naval quarantine; this is the first direct Soviet-linked bloodshed.

At almost the same time, another U-2 on an unrelated polar mission strays into Soviet airspace near the Arctic due to a navigational error, triggering a scramble of Soviet fighters. US and Soviet air defense systems are on hair-trigger alert, and both sides risk misreading any radar track as a possible start of a nuclear strike.

PRIMARY ACTORS:
- United States – President John F. Kennedy, his Executive Committee (ExComm), the Joint Chiefs of Staff, and the broader US political system (Congress, media, public opinion).
- Soviet Union – Premier Nikita Khrushchev, the Presidium, Soviet military leadership, and commanders in Cuba and on deployed ships and submarines.
- Cuba – Fidel Castro and his revolutionary government, Cuban armed forces, and local militia, determined not to be humiliated or invaded again.
- NATO Allies – especially the United Kingdom and West Germany, who fear both nuclear war and the possibility that the US might cut a deal over Cuba that sacrifices their interests or Berlin.
- Other fronts in the Cold War – Turkey (hosting US Jupiter missiles), Berlin, and the broader Non-Aligned world watching to see which superpower appears stronger and more responsible.

US INTERNAL DIVISIONS:
Inside the White House, Kennedy’s ExComm is deeply split. The Joint Chiefs, led by General Curtis LeMay and other senior commanders, argue that the shoot-down proves the Soviets are testing American resolve. They press for immediate retaliation: at minimum destroying the responsible SAM site, and ideally launching the pre-planned OPLAN 312 air strikes on Cuban air defenses and airfields. They believe that failure to respond with force will embolden Moscow and damage US credibility with allies and adversaries alike.

Civilian advisors led by Secretary of Defense Robert McNamara warn that even a “limited reprisal” could trigger a chain reaction: more US aircraft shot down, wider bombing, pressure to invade Cuba under OPLAN 316, and likely Soviet countermoves in Berlin or elsewhere. They are acutely aware that once large-scale combat begins, control may slip from political leaders to field commanders.

Robert F. Kennedy, the President’s brother and Attorney General, is nurturing a fragile backchannel with Soviet Ambassador Anatoly Dobrynin. Between public statements and private messages, there is the outline of a possible deal: Soviet missiles removed from Cuba in exchange for public US pledges not to invade the island and a quiet, face-saving removal of obsolete US Jupiter missiles from Turkey. He believes a diplomatic exit is still possible if military escalation can be delayed for even a few more hours or days.

SOVIET AND CUBAN PERSPECTIVES:
From Moscow, Khrushchev sees the deployment of missiles to Cuba as a way to redress the strategic imbalance (US missiles near his borders, US nuclear superiority) and to protect a socialist ally a short flight from Florida. He is under pressure from hardliners not to yield under American threats. At the same time, he fears losing control of events: Soviet ships, air defense units, and submarines in the Atlantic and around Cuba are operating under general instructions but have limited direct contact with the Kremlin.

In Havana, Fidel Castro believes an American invasion is likely and is prepared to fight to the end rather than see his revolution crushed. He is angry that Soviet “restraint” might leave Cuba exposed. Cuban forces and militias are ready to respond fiercely to any US air strikes or landings, and Castro is pushing the Soviets not to back down.

HIDDEN ESCALATION RISKS (FOG OF WAR ELEMENTS):
- Soviet tactical nuclear weapons, including short-range missiles and possibly nuclear-armed torpedoes, are already on Cuban soil or in nearby waters. They are intended as a last-ditch defense if the US invades. US intelligence does not yet understand the full extent of these deployments.
- Soviet submarines, including diesel-electric boats like B-59, are operating near the US quarantine line. Harassed by US Navy ships using practice depth charges as “signals” to surface, some commanders fear war may already have started and hold nuclear-armed torpedoes they are authorized to use under certain conditions.
- Communication delays and misinterpretations mean that by the time leaders in Washington or Moscow learn about an incident, local commanders may already have escalated.

DOMESTIC POLITICS AND ALLIANCE PRESSURE:
In Washington, hawks in Congress from both parties are demanding a firm response to the missile deployment and now to the death of an American pilot. Some already felt that the naval quarantine was too weak; they talk about “Munich” and appeasement. Doves are alarmed by the risk of nuclear war and want Kennedy to avoid any first strikes or irreversible steps.

NATO allies are torn. West German leaders fear any sign of softness toward the Soviets will encourage pressure on Berlin; British officials urge caution but also worry about American resolve. None of them want to be incinerated because of a misstep over Cuba, but none want to see the Western alliance humiliated either. They have limited visibility into the most secret US–Soviet exchanges.

STRATEGIC DILEMMAS:
- Credibility vs Survival – If the US does not retaliate for the U-2 shoot-down, does it lose face with allies and adversaries, or does it show mature restraint? If it does retaliate, can it keep the response limited enough to avoid all-out war?
- Local vs Global – Decisions focused on Cuba reverberate in Berlin, Turkey, and across the alliance system. A move that looks sensible in the Caribbean might trigger Soviet action in Central Europe.
- Civilian Control vs Military Logic – Civilian leaders want options and flexibility; military planners see war plans and timetables. As tensions mount, the risk grows that field commanders or standard operating procedures will effectively decide events.
- Information vs Action – Reconnaissance flights provide vital intelligence but are increasingly dangerous. Cancelling them reduces risk but increases uncertainty; continuing them increases the risk of triggers like the one that killed Major Anderson.

=== PRIMARY OBJECTIVE (GOAL) ===
GOAL: Remove Soviet Missiles from Cuba.
TIMELINE: 13 Days (Turns are Days).
VICTORY CONDITION: Soviet withdrawal verified without Nuclear Exchange.
FAILURE CONDITION: Nuclear War or Permanent Soviet Nuclear Base established.
    `
  },
  {
    id: 'steam_edo',
    title: 'Iron Shogun',
    startingYear: '1853',
    description: 'Japan industrialized 50 years early in secret. When Perry arrives, he finds a fortress, not a victim.',
    imageUrl: 'https://picsum.photos/id/1043/400/200',
    promptContext: `
      TIMELINE: 1853 (The Black Ships Arrival).
      ROLE: Tokugawa Shogun (Reformist Faction).
      
      === THE SECRET HISTORY ===
      In 1800, the Shogunate seized Dutch texts and built secret foundries in the mountains of Hida. Japan has steam power, rifled muskets, and primitive ironclads, but lacks mass production.
      
      === MILITARY ASSETS ===
      1. THE "SHIRO-JO" (White Castle): A massive, coal-hungry steam ironclad defending Edo Bay. 
      2. THE SHINSENGUMI: Secret police equipped with prototype revolvers. Ruthlessly loyal.
      3. COASTAL BATTERIES: Hidden rifled cannons overlooking the bay entrance.
      
      === INTERNAL TENSIONS ===
      - THE SAMURAI CASTE: Furious. Steam engines make their swords obsolete. 40% are near rebellion.
      - THE PEASANTRY: Starving. The coal mines have poisoned the rice paddies.
      - DAIMYO OF SATSUMA: Has discovered the secret foundries and wants the tech to overthrow you.
      
      === THE EVENT ===
      Commodore Perry has anchored 4 US Warships in Uraga Harbor. He demands trade. He assumes you are primitive. He is wrong.
      
      === PRIMARY OBJECTIVE (GOAL) ===
      GOAL: Deter the American Fleet and Preserve Shogunate Authority.
      TIMELINE: 6 Months.
      VICTORY CONDITION: Perry leaves without a treaty OR signs a treaty on YOUR terms.
      FAILURE CONDITION: Civil War or American Bombardment of Edo.
    `
  },
  {
    id: 'american_twilight',
    title: 'Twilight of the Republic',
    startingYear: 'Nov 2025',
    description: 'One year into the second term. Norms are shattering. Institutions are buckling. The opposition is fragmented. Can democracy survive?',
    imageUrl: 'https://picsum.photos/id/1047/400/200',
    promptContext: `
SCENARIO SEED – “PROJECT 2025: AUTHORITARIAN TURN” (UNITED STATES, NOVEMBER 2025)

NOTE: This is a speculative near-future branch set in late 2025, built from real policies, actors, and conflicts. It imagines a systematic authoritarian consolidation of power using tools that already exist.

[1] SHARED PAST CONTEXT – 2024 ELECTION TO MID-2025

On November 5, 2024, Donald Trump defeats Kamala Harris and returns to the White House with a hard-right agenda shaped in part by the Heritage Foundation’s “Project 2025” – a blueprint that openly calls for a “purge” of the federal bureaucracy, a maximalist “unitary executive”, and the dismantling of guardrails that constrain presidential power. Legal and democracy experts across the spectrum describe the plan as authoritarian – borrowing tactics from Hungary, Turkey, and other backsliding democracies to hollow out independent institutions while maintaining the appearance of elections.

On January 20, 2025, Trump takes office and immediately signs a stack of executive orders. One order revives and expands the old “Schedule F” concept into a new “Schedule Policy/Career” category. It gives the White House sweeping power to reclassify thousands of civil servants as at-will employees who can be fired for being “insufficiently loyal”. The ACLU of D.C. calls it a power grab aimed at punishing federal workers whose loyalty is to the Constitution rather than to Trump personally. Governance experts and unions warn that this is not “reform” – it is the classic authoritarian move of turning a professional civil service into a patronage machine.

Project 2025’s logic extends across the executive branch. Heritage and allied operatives have spent years building dossiers on climate scientists, civil-rights lawyers, voting-rights staff, and gender-equity advocates inside agencies – a target list for future purges. The new administration moves quickly: independent agency heads are forced out, watchdogs and inspectors general are sidelined, and the Department of Justice’s Civil Rights Division is gutted. By mid-2025, former civil-rights attorneys say a large share of their colleagues are gone, key voting-rights cases have been abandoned, and the division’s mission has been inverted – from protecting voters and marginalized communities to hunting for rare “voter fraud” and punishing dissent.

Immigration enforcement becomes a blunt political weapon. Trump’s DHS tears up “sensitive locations” guidance and leans into tactics first tested in Portland in 2020 – masked federal officers in military gear, unmarked vans, and “snatch and grab” operations that blur the line between policing and abduction. ICE and Border Patrol are unleashed on “sanctuary” cities and states. Mayors and governors who resist see threats to their funding and targeted media attacks. Behind the rhetoric of “law and order”, the pattern looks like classic authoritarian practice – using security forces to intimidate political enemies and communities of color.

Voting and elections are pulled into the same project. The Justice Department leans on states to hand over voter files and access to voting machines in the name of “election integrity”, while Project 2025 allies talk openly about reshaping the Federal Election Commission and subordinating independent election administration to the White House. Democracy advocates warn that the point is not to find fraud – it is to create a permanent pretext to intervene in elections the regime might lose.

[2] IMMEDIATE SITUATION – NOVEMBER 2025

It is November 2025 – one year into this experiment and one year out from the 2026 midterms.

Inside the federal government, fear has replaced professional norms. The new Schedule Policy/Career regime hangs over tens of thousands of workers. People who push back on illegal orders or try to enforce civil-rights protections know they can be labeled “policy-resistant” and removed. Former DOJ Civil Rights staff describe purges and make-work reassignments designed to humiliate and drive out anyone committed to voting rights or police accountability. The message from the top is clear – loyalty to Trump matters more than law.

On the streets and in neighborhoods, immigration enforcement has taken on an openly terrorizing edge. ICE and other DHS units conduct raids in the early hours, sometimes in tactical gear and masks, sometimes using unmarked vehicles. These tactics are especially visible in cities like Chicago, Los Angeles, Houston, and Portland – places already on the administration’s enemies list. Reports pile up of U.S. citizens and legal residents being swept up anyway – detained, shackled, denied medication, or threatened with deportation because they “look foreign” or speak another language. In California alone, multiple citizens are suing over wrongful ICE detentions from the summer of 2025. Civil-rights groups document beatings, sexual abuse, and clandestine deportations at ICE camps along the border. The administration denies everything, but the pattern is hard to ignore – a “chaotic” system of mass detention that, in practice, normalizes rights violations and collective punishment.

Election systems are under sustained, top-down pressure. DOJ letters and lawsuits demand full voter rolls, voting-machine access, and “audits” in selected counties – almost always in states and jurisdictions that resisted Trump or expanded voting rights. State and local officials know the pattern from the last decade – Trump allies got illegal access to machines, copied software, and turned technical issues into propaganda. Now similar tactics have the weight of the Justice Department behind them. Many election workers, already traumatized by threats from previous cycles, consider quitting rather than run another election under federal harassment and the risk of physical violence.

Structural rules are tilting. Republican legislatures in states like Texas and Florida have passed new gerrymanders to lock in power for the decade. In response, California voters pass Proposition 50, which gives Governor Gavin Newsom and the legislature authority to redraw the state’s congressional map to claw back some of the losses. To the right, this proves “everyone gerrymanders”. To many observers, it underscores a grim reality – the formal rules of democracy are now part of an arms race, not neutral ground.

Overall, the federal government is shrinking space for independent civil service, weaponizing federal law enforcement, and laying groundwork to bend or nullify future elections – all while insisting that everything is “legal” and “constitutional”.

[3] PUBLIC MOOD, POLLING, AND STREET-LEVEL ENERGY – LATE 2025

The national mood is anxious, angry, and fragmented. Trust in the federal government is scraping historic lows; only a small minority of Americans say they trust Washington to do the right thing most of the time. People across parties believe the system is failing them, but they disagree sharply on who is to blame and what “fixing it” means.

At the same time, concern about democracy itself is sky-high. Polls in 2024 and 2025 show large majorities of voters saying American democracy is under threat and listing “weakening democracy”, corruption, and political violence alongside economic worries as top concerns. The paradox is stark – huge majorities say they fear democratic breakdown, yet the authoritarian project continues to advance.

Attitudes toward authoritarianism are not hypothetical. Surveys taken after 2020 and into the mid-2020s consistently find that a substantial minority of Americans agree, at least somewhat, that “having a strong leader for America is more important than having a democracy”, or that the government should be able to use the military to enforce its policies at home. That minority is large enough to give Trump and his allies a real base for hard-edged moves, even as a broader majority tells pollsters they oppose one-man rule.

On Project 2025 itself, awareness is uneven but lopsidedly negative once people hear about it. Polls and focus groups in 2024 showed only a small minority of voters explicitly supporting the Heritage blueprint when its details were described, with large majorities opposed across most demographic groups. The administration’s best asset is ignorance and confusion – the more people learn about the actual agenda, the less they like it – but many are still focused on immediate economic and cultural battles rather than on institutional design.

The streets have not been quiet. By mid-2025, researchers tracking protest activity count hundreds of immigration-related demonstrations across dozens of states – from courthouse vigils and school walkouts to mass marches against deportation raids. The June 2025 Los Angeles protests against mass deportations become a national flashpoint: weeks of demonstrations, civil disobedience, police crackdowns, and the deployment of California National Guard troops and federal forces to control unrest. Similar tensions explode in parts of the Midwest when federal agents use pepper spray and “snatch and grab” tactics during ID checks in immigrant neighborhoods.

Local pushback is visible. Chicago, Minneapolis, San Francisco, Los Angeles, and other cities see waves of marches and emergency city-council meetings. San Francisco supervisors move to bar ICE from staging raids on city property; Illinois and other blue states pass laws limiting immigration arrests near courthouses, hospitals, and colleges and giving residents a right to sue for abusive enforcement. These steps energize some communities and infuriate the White House, which denounces them as “lawless” and hints at more direct federal intervention.

Younger Americans are especially grim. Youth polls in 2025 find only a small minority of young adults think the country is on the right track; most report financial stress, emotional strain, and deep pessimism about the future of work and politics. Many are active in protests over immigration, climate, Gaza, and police violence, but they are also burned out and cynical about both parties. For organizers, they are simultaneously the most crucial potential base and the hardest to keep engaged.

From the vantage point of global civil-society monitors, the danger is not theoretical. International watchdogs that track civic freedoms and democratic health now rate the United States as having “obstructed” civic space and warn that the country is undergoing a rapid authoritarian shift – pointing to protest crackdowns, targeted surveillance, and legal attacks on dissent. The broad state of play: a public that overwhelmingly says democracy is in danger but is divided and exhausted; a substantial minority openly comfortable with authoritarian solutions; a protest wave that surges and recedes without yet coalescing into a sustained mass movement; and a pro-democracy coalition that has potential mass backing but has not fully turned that fear of authoritarianism into coordinated, durable power.

[4] ACTOR PROFILES – DISPOSITIONS AND CONSTRAINTS (LATE 2025)

PRESIDENT DONALD TRUMP AND INNER CIRCLE  
Trump and his core lieutenants see this as payback and consolidation. They believe “the deep state” sabotaged them last time and are determined not to let that happen again. Project 2025 gives them language and legal theories – the “unitary executive”, loyalty tests, mass reclassification – to justify firing career experts and replacing them with loyalists. This is not a normal policy swing; it is an attempt to shift the system toward a leader-centric regime.

BLUE-STATE GOVERNORS – GAVIN NEWSOM (CA), JB PRITZKER (IL), KATHY HOCHUL (NY)  
These governors sit on the front line of open defiance. Their states are sanctuary jurisdictions, abortion and trans-health refuges, and home to large immigrant and Black and brown communities directly targeted by federal policy. Newsom pushes Proposition 50 and other counter-moves – using state power to fight gerrymandering and protect rights. Pritzker signs laws that turn courthouses, schools, and hospitals into “ICE-free” zones and funds legal defense for residents facing raids. Hochul tries to keep New York a relative refuge while coping with housing and budget crises the administration exploits rhetorically. All three face lawsuits, retaliatory funding threats, and smear campaigns. Their base wants them to go further – deeper non-cooperation with ICE and DOJ, state-level “sanctuary for democracy” laws – but every escalation carries economic, legal, and security risks.

CIVIL-RIGHTS AND VOTING-RIGHTS ORGANIZATIONS – ACLU, BRENNAN CENTER, NAACP LDF, DEMOCRACY DOCKET, OTHERS  
These groups are the legal firewall. The ACLU brands Project 2025 a dystopian roadmap for discrimination and surveillance. The Brennan Center warns that the presidency is being redrawn as an elected autocrat, no longer meaningfully constrained by independent institutions. NAACP Legal Defense Fund, Democracy Docket, and allied groups are buried under cases – suing over ICE abuses, wrongful detentions of citizens, targeted funding cuts, voting restrictions, and partisan takeovers of election offices. They win some injunctions, lose others, and watch the Supreme Court narrow or overturn victories. They cannot stop an authoritarian project through courts alone, but without litigation the abuses would deepen faster and be harder to reverse.

LABOR MOVEMENT – AFL-CIO (LIZ SHULER) AND MAJOR UNIONS  
The labor movement is a potential backbone of resistance, but not yet fully mobilized. Liz Shuler’s 2025 “State of the Unions” speech is blunt – unions are under attack not just on wages, but on the right to organize, protest, and bargain at all. Some unions see the pattern clearly and discuss coordinated work stoppages, consumer boycotts, and, if elections are openly sabotaged, the possibility of escalating toward a general strike. Others are cautious: members are divided, union density is fragile, and a failed strike could invite crippling legal and financial retaliation. Unions remain their own center of gravity – distinct from NGOs and parties – with the unique power to withhold labor across strategic sectors if they choose.

GRASSROOTS DEMOCRACY AND COMMUNITY GROUPS  
Indivisible chapters, immigrant-rights coalitions, Black-led organizations, mutual-aid networks, student coalitions, and faith communities form the street-level opposition. They run “know your rights” trainings as masked agents sweep neighborhoods. They do jail support for protesters grabbed off the street by federal officers. They pressure city councils, sheriffs, and school boards to refuse cooperation with ICE and to adopt strong sanctuary and voting-rights ordinances. They also register voters, recruit local candidates, and build neighborhood-level solidarity. Many volunteers feel like they are living through a slow-motion coup: the danger is constant but rarely acknowledged by national elites until it spills into headlines.

ELECTION OFFICIALS AND ADMINISTRATORS  
Election workers are collateral damage in this conflict. Secretaries of state, county clerks, and local administrators in swing states get subpoenas, federal “guidance”, online mobs, and threats if they do anything that can be framed as “anti-Trump”. DOJ demands for data and equipment feel less like neutral oversight and more like soft intimidation and groundwork for contesting or nullifying future results. Some officials quietly coordinate with voting-rights groups and blue-state peers, others keep their heads down, and a non-trivial number simply leave the profession. The machinery of elections continues to turn, but with fewer experienced referees and more fear.

CONGRESSIONAL DEMOCRATS AND NATIONAL PARTY COMMITTEES  
Democratic leaders in Congress and the DNC/DSCC/DCCC sit on a critical but ambivalent perch. They can run investigations, hold hearings, block or delay some legislation, and frame the stakes for the public. They raise hundreds of millions of dollars each cycle and decide which races and states get serious resources and staff. Yet they are also risk-averse institutions: many incumbents fear being painted as “radical” or “anti-police” and are wary of embracing disruptive tactics or state-level defiance. Some members push aggressively for impeachment, court reform, and structural democracy fixes; others prefer “normal politics” – messaging bills, incremental deals, and fundraising – even as the playing field is tilting under their feet.

RED-STATE REPUBLICAN BLOC – GOVERNORS, ATTORNEYS GENERAL, LEGISLATURES  
Republican power in red states is not just an echo of the White House – it is its own engine. Governors, attorneys general, and legislatures in states like Texas, Florida, and others pass aggressive abortion bans, anti-trans laws, anti-protest bills, voting restrictions, and gerrymanders that pre-empt local progressive policies and criminalize dissent. Some are eager partners in Project 2025 and move even faster than Washington on crackdowns. A smaller handful worry about open lawbreaking or economic backlash but mostly keep those worries private. This bloc provides a network of laboratories for authoritarian policy, and also potential fractures if a few ambitious Republicans decide that Trump’s project is too risky or unpopular.

FEDERAL COURTS AND CONSERVATIVE LEGAL ECOSYSTEM  
The federal courts – especially the Supreme Court and the network around the Federalist Society – are a decisive but unpredictable actor. Decades of conservative judicial appointments mean that many judges are sympathetic to unitary-executive theories, skeptical of the administrative state, and hostile to voting-rights and labor protections. In practice, that means some of the worst excesses of the regime are legalized or at least tolerated. At the same time, judges can occasionally surprise on narrow grounds – institutional pride, procedural issues, or personal lines they will not cross. The courts are both a battlefield and a filter: they sometimes slow authoritarian moves, but they also launder and legitimize others.

FEDERAL SECURITY AND ENFORCEMENT APPARATUS – DHS/ICE/CBP/DOJ/FBI  
The federal security state is not monolithic, but its weight is enormous. DHS, ICE, CBP, segments of DOJ, and the FBI have legal authorities, armed personnel, surveillance tools, and detention infrastructure that can be used in authoritarian ways while retaining a veneer of legality. Some rank-and-file and career lawyers push back, leak, or quietly slow-roll the worst demands. Others embrace the new freedom to go after “enemies” at home. How far these institutions bend – or break – under political pressure is one of the central unknowns of the moment.

RIGHT-WING MEDIA AND DONOR NETWORKS  
Fox News, talk radio, social-media influencers, and a constellation of right-wing outlets and billionaire-funded organizations provide the narrative and money for the project. They frame purges as “draining the swamp”, raids as “restoring law and order”, and attacks on voting rights as “election integrity”. Donor networks decide which legal fights get backed, which state races get flooded with money, and which extreme policies get normalized through think-tank white papers and op-eds. This ecosystem functions as propaganda and logistics – constantly manufacturing consent and drowning out or distorting pro-democracy messaging.

PRO-DEMOCRACY REPUBLICANS AND RULE-OF-LAW CONSERVATIVES  
A thinner but still relevant slice of the landscape consists of Republicans, former officials, judges, and conservative lawyers who see the authoritarian turn as a betrayal of their own stated values. Some work through groups focused on defending elections and the rule of law; others speak out as columnists, whistleblowers, or expert witnesses. Their electoral power is limited, and many are ostracized inside the GOP, but they can matter at key margins – persuading a judge, stiffening the spine of a wavering Republican official, or providing cover for bipartisan state-level pushback. They are not the main engine of resistance, but they complicate the story and can tip narrow fights.

INSTITUTIONAL CIVIL SOCIETY – PROFESSIONAL ASSOCIATIONS, UNIVERSITIES, MAINSTREAM JOURNALISM  
Bar associations, medical and scientific societies, universities, and parts of mainstream journalism still hold some normative and agenda-setting power. They issue reports, resolutions, and investigations documenting abuses; they can refuse to participate in sham processes or bogus “review” commissions; they can provide platforms and legitimacy for whistleblowers and dissidents. Their influence is softer than that of courts or governors, but in an authoritarian slide, public statements from these institutions help shape whether the broader public sees events as normal partisan conflict or as a genuine breakdown of constitutional democracy.

IDEOLOGICAL AND RELIGIOUS RIGHT INFRASTRUCTURE  
Project 2025 is not just a policy document; it is the product of a dense network of think tanks, legal outfits, and religious-right organizations. Groups like the Heritage Foundation, Alliance Defending Freedom, Family Research Council, and others promote a vision of government “imbued with biblical principles” and explicitly seek to roll back LGBTQ+ rights, reproductive freedom, and church–state separation. Christian nationalist currents treat Trump’s presidency as a vehicle for cultural restoration and see agency purges, education fights, and court capture as steps toward that goal. Pastors, religious broadcasters, and church networks help frame authoritarian moves as moral necessities, not just political choices.

PARAMILITARIES AND ARMED NON-STATE ACTORS  
Militia-style groups, “patriot” organizations, and fragments of outfits like the Proud Boys and Oath Keepers did not disappear after January 6; they reconstituted in looser, more localized forms. In some states, armed groups show up at school-board meetings, drag story hours, abortion clinics, and immigrant-rights rallies. A subset coordinate with sympathetic sheriffs or local officials and operate as an informal intimidation force – patrolling ballot drop boxes, filming voters, or confronting protesters. Their legal status is murky, but their presence raises the cost of public dissent and gives the administration a deniable street-level pressure tool whenever it chooses to look the other way.

FOREIGN POLICY AND EXTERNAL CRISES  
Abroad, the United States is entangled in multiple crises – an ongoing, grinding war in Ukraine; a fragile ceasefire and reconstruction process in Gaza; renewed great-power maneuvering among Russia, China, and regional allies; and periodic flare-ups on the Korean Peninsula and in the South China Sea. The administration uses these conflicts both as justification for broad “national emergency” claims and as rhetorical weapons against domestic critics (“helping our enemies”, “siding with terrorists”, “weakening America in front of China and Russia”). Foreign crises provide opportunities to centralize power, expand surveillance, and clamp down on dissent under the banner of unity and security – or, if mishandled, they can expose incompetence and open space for opposition.

SCHOOLS, UNIVERSITIES, AND CURRICULUM BATTLES  
K–12 schools and universities are a central battleground. National groups such as Moms for Liberty and similar networks have spent years organizing around school-board races, book bans, and anti-“woke” curriculum campaigns. They target materials on race, gender, sexuality, and U.S. history, pushing to remove books and lessons that acknowledge systemic racism, queer and trans lives, or reproductive rights. State-level laws in multiple red states restrict how teachers can talk about race and gender and move to dismantle diversity, equity, and inclusion programs in public universities. In response, some blue states pass laws limiting book bans and protecting library collections, and the ACLU and others sue districts over censorship and discriminatory policies. Classrooms, libraries, and campuses become disputed zones where the next generation’s view of democracy, pluralism, and authority is shaped – or narrowed.

=== PRIMARY OBJECTIVE (GOAL) ===
GOAL: Ensure Free and Fair Midterm Elections in November 2026.
TIMELINE: 12 Months (Turns are Months).
VICTORY CONDITION: Election Certified without widespread suppression or violence.
FAILURE CONDITION: Cancellation of elections or successful Federal takeover of ballot counting.
    `
  },
];
