export type Id = string;
export type Confidence = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type ImpactClass = 'NONE' | 'TRIVIAL' | 'MINOR' | 'MODERATE' | 'MAJOR' | 'SEVERE' | 'SYSTEMIC';
export type ProvenanceKind =
  | 'VERIFIED_FACT'
  | 'WELL_SUPPORTED_INFERENCE'
  | 'CONTESTED_INTERPRETATION'
  | 'SCENARIO_ABSTRACTION'
  | 'SIMULATED_POST_DIVERGENCE';
export type TurnDepth = 'ROUTINE' | 'STANDARD' | 'COMPLEX' | 'DEEP';
export type VisibilityClass =
  | 'PUBLIC'
  | 'PLAYER_KNOWN'
  | 'ACTOR_KNOWN'
  | 'ACTOR_PRIVATE'
  | 'SIMULATION_SECRET'
  | 'POST_GAME_ONLY';
export type ControlMode = 'DIRECT' | 'DELEGATED' | 'INFLUENCE' | 'NONE';
export type TimeUnit = 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';
export type MechanismEngagement =
  | 'ENGAGES_STRONGLY'
  | 'ENGAGES'
  | 'ENGAGES_WEAKLY'
  | 'DOES_NOT_ENGAGE'
  | 'BACKFIRES';

export interface VisibilityRule {
  classification: VisibilityClass;
  actorIds: Id[];
  discoverable: boolean;
  detectionDifficulty?: Confidence;
  declassifyOnGameOver?: boolean;
}

export interface AccessDecision {
  viewerId: Id;
  objectType: 'METRIC' | 'RESOURCE' | 'ENTITY' | 'RELATIONSHIP' | 'ARC' | 'FACT' | 'PROCESS' | 'GOAL';
  objectId: Id;
  allowed: boolean;
  classification: VisibilityClass;
  reason: string;
}

export interface AuthorityRule {
  actorId: Id;
  targetId: Id;
  mechanismKinds: StrategyMechanism['kind'][];
  mode: ControlMode;
  conditions: string[];
  conditionRules?: GoalCondition[];
}

export interface ExecutableHardRule {
  id: Id;
  description: string;
  appliesTo: 'PLAYER' | 'ACTOR' | 'ALL';
  mechanismKinds?: StrategyMechanism['kind'][];
  actorIds?: Id[];
  targetIds?: Id[];
  conditions?: GoalCondition[];
  /**
   * PROHIBIT — the act itself cannot be performed.
   * DENY_AUTHORITY — the act can be performed, but it compels nothing: the
   *   other party decides. Most "X has no authority over Y" rules mean this.
   */
  effect: 'PROHIBIT' | 'DENY_AUTHORITY' | 'REQUIRE_RESOURCE' | 'REQUIRE_CAPABILITY' | 'DELAY';
  resourceId?: Id;
  resourceAmount?: number;
  capabilityPattern?: string;
  delayTurns?: number;
}

export interface TimeScale {
  amount: number;
  unit: TimeUnit;
}

export interface TimeScaleRule {
  id: Id;
  condition: GoalCondition;
  scale: TimeScale;
  rationale: string;
}

export interface ScenarioCalibrationRule {
  id: Id;
  mechanismKind?: StrategyMechanism['kind'];
  targetType?: ProposedEffect['targetType'];
  targetId?: Id;
  allowedImpactClasses: ImpactClass[];
  defaultImpactClass: ImpactClass;
  rationale: string;
}

export interface HistoricalAnalog {
  id: Id;
  label: string;
  mechanismKind: StrategyMechanism['kind'];
  targetId: Id;
  impactClass: ImpactClass;
  context: string;
  provenance: ProvenanceKind;
  sourceRefs: string[];
}

export interface AdvisorState {
  id: Id;
  name: string;
  expertise: string[];
  worldview: string;
  bias: string;
  relationship: number;
  actorId?: Id;
  visibility: VisibilityRule;
  biography?: string;
  voice?: string;
  speechHabits?: string[];
  personalStakes?: string;
  relationships?: string[];
  recurringTension?: string;
}

export interface MetricDefinition {
  id: Id;
  label: string;
  description: string;
  min: number;
  max: number;
  dangerBelow?: number;
  dangerAbove?: number;
  hidden?: boolean;
  visibility: VisibilityRule;
}

export interface ResourceState {
  id: Id;
  label: string;
  amount: number;
  unit: string;
  renewable: boolean;
  ownerId: Id;
  visibility: VisibilityRule;
}

export interface EntityState {
  id: Id;
  name: string;
  kind: 'PERSON' | 'FACTION' | 'INSTITUTION' | 'MILITARY' | 'STATE' | 'ASSET';
  description: string;
  objectives: string[];
  capabilities: string[];
  constraints: string[];
  status: 'ACTIVE' | 'DEGRADED' | 'INACTIVE' | 'DESTROYED';
  power: number;
  resolve: number;
  controllerId?: Id;
  privateFacts: Id[];
  visibility: VisibilityRule;
  fieldVisibility: Partial<Record<'objectives' | 'capabilities' | 'constraints' | 'power' | 'resolve' | 'status', VisibilityRule>>;
  counterintelligence?: number;
}

export interface NarrativeVoice {
  era: string;
  tone: string;
  diction: string[];
  textureNotes: string[];
  forbiddenCliches: string[];
}

export interface NarrativeWorldModel {
  sourceMaterialRef: string;
  canonicalContext: string[];
  playerContext: string[];
  immediateHistory: string[];
  locations: string[];
  institutions: string[];
  narrativeGuidance: string[];
  storyPossibilities: string[];
  openingScene: string;
  artifactFormats: string[];
}

export interface RelationshipState {
  id: Id;
  fromId: Id;
  toId: Id;
  alignment: number;
  trust: number;
  leverage: number;
  communication: boolean;
  commitments: string[];
  visibility: VisibilityRule;
}

export interface ArcState {
  id: Id;
  title: string;
  description: string;
  progress: number;
  threshold: number;
  direction: 'RISING' | 'FALLING' | 'STABLE';
  status: 'DORMANT' | 'ACTIVE' | 'RESOLVED' | 'FAILED';
  dueTurn?: number;
  ownerId?: Id;
  participantIds: Id[];
  visibility: VisibilityRule;
  onResolve: ProposedEffect[];
}

export interface GoalState {
  id: Id;
  title: string;
  description: string;
  victoryConditions: string[];
  failureConditions: string[];
  victoryRules: GoalCondition[];
  failureRules: GoalCondition[];
  victoryMode: 'ALL' | 'ANY';
  failureMode: 'ALL' | 'ANY';
  deadlineTurn: number;
  status: 'ACTIVE' | 'ACHIEVED' | 'FAILED';
  terminalOnAchievement: boolean;
  terminalOnFailure: boolean;
  outcomeClass?: 'DECISIVE_VICTORY' | 'VICTORY' | 'COSTLY_VICTORY' | 'PARTIAL_ACHIEVEMENT' | 'UNRESOLVED' | 'STRATEGIC_DEFEAT' | 'CATASTROPHIC_DEFEAT';
  successors?: Array<{
    on: 'ACHIEVED' | 'FAILED' | 'DEADLINE';
    goal: GoalState;
  }>;
}

export interface GoalCondition {
  targetType: 'METRIC' | 'RESOURCE' | 'ENTITY' | 'ARC' | 'FACT';
  targetId: Id;
  field: string;
  operator: 'LT' | 'LTE' | 'EQ' | 'GTE' | 'GT' | 'EXISTS' | 'NOT_EXISTS';
  value?: number | string | boolean;
}

export interface WorldFact {
  id: Id;
  statement: string;
  provenance: ProvenanceKind;
  confidence: Confidence;
  visibility: VisibilityRule;
  source?: string;
  sourceRefs: string[];
  createdTurn: number;
  supersedes?: Id;
}

export interface PendingProcess {
  id: Id;
  label: string;
  ownerId: Id;
  dueTurn: number;
  progress: number;
  requiredProgress: number;
  onMature: ProposedEffect[];
  perTurnEffects: ProposedEffect[];
  participantIds: Id[];
  detectableBy: Id[];
  visibility: VisibilityRule;
  completed: boolean;
}

export interface ScenarioManifest {
  id: Id;
  title: string;
  premise: string;
  playerId: Id;
  playerRole: string;
  startingDate: string;
  timeZone?: string;
  timeUnit: TimeUnit;
  timeScale: TimeScale;
  timeScaleRules: TimeScaleRule[];
  metricDefinitions: MetricDefinition[];
  historicalCutoff: string;
  authorityRules: AuthorityRule[];
  calibrationRules: ScenarioCalibrationRule[];
  historicalAnalogs: HistoricalAnalog[];
  hardRules: string[];
  executableHardRules?: ExecutableHardRule[];
  advisors: AdvisorState[];
  unresolvedUncertainties: string[];
  metricRoles?: Partial<Record<'escalation' | 'support' | 'cohesion' | 'oppositionMomentum' | 'legal' | 'exposure' | 'intelligence', Id>>;
  voice?: NarrativeVoice;
  narrativeWorld?: NarrativeWorldModel;
}

export interface WorldState {
  schemaVersion: 2;
  campaignId: Id;
  revision: number;
  manifest: ScenarioManifest;
  turn: number;
  dateLabel: string;
  currentDateTime: string;
  elapsedMinutes: number;
  rngSeed: number;
  rngCursor: number;
  metrics: Record<Id, number>;
  resources: Record<Id, ResourceState>;
  entities: Record<Id, EntityState>;
  relationships: Record<Id, RelationshipState>;
  arcs: Record<Id, ArcState>;
  facts: Record<Id, WorldFact>;
  pendingProcesses: Record<Id, PendingProcess>;
  goal: GoalState;
  gameOver: boolean;
}

export interface BeliefValue {
  subjectId: Id;
  field: string;
  estimate?: number;
  range?: [number, number];
  categorical?: string;
  confidence: Confidence;
  sourceFactIds: Id[];
  updatedTurn: number;
}

export interface ActorBeliefState {
  actorId: Id;
  beliefs: Record<string, BeliefValue>;
  knownFactIds: Id[];
}

export interface BeliefState {
  player: ActorBeliefState;
  actors: Record<Id, ActorBeliefState>;
}

export interface ActorMemoryEvent {
  id: Id;
  actorId: Id;
  turn: number;
  kind: 'ACTION' | 'COMMITMENT' | 'BETRAYAL' | 'OUTCOME' | 'RELATIONSHIP' | 'INTELLIGENCE' | 'OTHER';
  summary: string;
  importance: ImpactClass;
  relatedEntityIds: Id[];
  sourceAuditId?: Id;
}

export interface ActorMemoryState {
  actorId: Id;
  events: ActorMemoryEvent[];
  currentStrategy?: string;
  historicalPriorWeight: number;
}

export interface StrategyMechanism {
  id: Id;
  kind:
    | 'DIRECT_ORDER'
    | 'DIPLOMACY'
    | 'COERCION'
    | 'ECONOMIC_PRESSURE'
    | 'MILITARY_OPERATION'
    | 'INTELLIGENCE'
    | 'DECEPTION'
    | 'LEGAL_ACTION'
    | 'PUBLIC_COMMUNICATION'
    | 'COALITION_BUILDING'
    | 'RESOURCE_TRANSFER'
    | 'OTHER';
  objective: string;
  targetIds: Id[];
  actorIds: Id[];
  dependencies: string[];
  assumptions: string[];
  sequence: number;
  durationTurns: number;
  resourceClaims: Array<{ resourceId: Id; amount: number }>;
  specifiedDetail: string;
  concealed?: boolean;
}

export interface StrategyGraph {
  objective: string;
  mechanisms: StrategyMechanism[];
  sequencing: string[];
  contingencies: string[];
  explicitRisks: string[];
  unspecified: string[];
  communicationStyleIsMechanism: boolean;
  requestedOutcomes: string[];
  assertedExternalEvents: string[];
  rationale: string[];
  unresolvedReferences: WorldReference[];
}

export interface WorldReference {
  mention: string;
  kindHint?: EntityState['kind'] | 'OFFICE' | 'PLACE' | 'PROCESS';
  clauseId: string;
  requiredForAttempt: boolean;
}

export interface GroundedAlias {
  alias: string;
  targetId: Id;
  confidence: Confidence;
}

export interface WorldExtensionProposal {
  rationale: string;
  entities: EntityState[];
  relationships: RelationshipState[];
  facts: WorldFact[];
  arcs: ArcState[];
  aliases: GroundedAlias[];
  sourceRefs: string[];
  confidence: Confidence;
  /** Ids among the proposed entities that are the player's own instruments or
   * subordinate institutions, and which the player may therefore direct. */
  playerControls?: Id[];
}

export interface WorldExtensionAudit {
  references: WorldReference[];
  proposal?: WorldExtensionProposal;
  validation: ValidationIssue[];
  applied: boolean;
  aliasesResolved: GroundedAlias[];
  source: 'NONE' | 'ALIASES_ONLY' | 'FIXTURE' | 'MODEL' | 'FALLBACK' | 'MIXED';
}

export interface GroundingFixture {
  id: Id;
  aliases: string[];
  existingTargetId?: Id;
  entity?: EntityState;
  relationships?: RelationshipState[];
  facts?: WorldFact[];
  /** The player's own instrument or subordinate body, which they may direct. */
  playerControlled?: boolean;
}

/** Thrown before ANY state, RNG, actor, or resource advance: the directive
 * contains only asserted external events and no player attempt. Non-consuming. */
export class DirectiveRevisionError extends Error {
  readonly kind = 'DIRECTIVE_REVISION';
  constructor(
    readonly playerMessage: string,
    readonly semantics: { assertedExternalEvents: string[]; requestedOutcomes: string[] },
  ) {
    super(playerMessage);
    this.name = 'DirectiveRevisionError';
  }
}

export interface CompilerFidelity {
  faithful: boolean;
  inventedMechanisms: string[];
  omittedWeaknesses: string[];
  assumedCoordination: string[];
  contradictions: string[];
  repairedGraph?: StrategyGraph;
}

export interface FeasibilityFinding {
  mechanismId: Id;
  feasible: boolean;
  classification: 'CERTAIN' | 'POSSIBLE' | 'IMPOSSIBLE' | 'DELAYED';
  controlMode: ControlMode;
  capabilityEvidence: string[];
  reasons: string[];
  hardConstraints: string[];
  availableFraction: number;
  /**
   * Can the player perform the initiating act at all — place the call, issue
   * the demand, convene the meeting? This is separate from whether they can
   * compel the target's compliance (`controlMode`). A president ordering
   * someone he cannot command is still making a demand that lands.
   * IMPOSSIBLE is reserved for acts that cannot be performed: no capability,
   * no channel, no resource, anachronism, or a prohibiting hard rule.
   */
  executable: boolean;
  /** When authority is absent but the act still lands, how it is reinterpreted. */
  reinterpretedAs?: 'DEMAND' | 'REQUEST' | 'APPEAL';
  /** Informal leverage over the target (0-100), derived from relationships when
   * no formal authority rule applies. Drives how hard an influence attempt bites. */
  informalLeverage?: number;
}

export interface ActorAction {
  actorId: Id;
  objective: string;
  action: string;
  mechanisms: string[];
  perceivedPlayerMechanismIds: Id[];
  beliefKeysUsed: string[];
  capabilityIdsUsed: string[];
  confidence: Confidence;
  initiative?: boolean;
  targetIds?: Id[];
  resourceClaims?: Array<{ resourceId: Id; amount: number }>;
}

export interface DetectionRecord {
  id: Id;
  turn: number;
  actorId: Id;
  mechanismId: Id;
  source: 'STRATEGY' | 'PROCESS';
  probability: number;
  draw: number;
  detected: boolean;
  garbled: boolean;
}

export interface EffectRecommendation {
  id: Id;
  /** Lands when the order is given rather than when the operation matures. */
  immediate?: boolean;
  mechanismId: Id;
  targetType: 'METRIC' | 'RESOURCE' | 'ENTITY' | 'RELATIONSHIP' | 'ARC' | 'FACT' | 'PROCESS' | 'GOAL';
  targetId: Id;
  field: string;
  direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  impactClass: ImpactClass;
  confidence: Confidence;
  engagement: MechanismEngagement;
  cause: string;
  dependencies: string[];
  actorId?: Id;
  proposedDelta?: number;
  setValue?: unknown;
}

export interface ProposedEffect extends EffectRecommendation {
  proposedDelta?: number;
  setValue?: unknown;
}

/** Marks a consequence of GIVING the order, which lands at once even when the
 * operation it sets in motion matures over later turns. */
export interface ImmediateMarker { immediate?: boolean }

export interface OutcomeBand {
  id: Id;
  label: string;
  probability: number;
  effectIds: Id[];
  description: string;
}

export interface Adjudication {
  summary: string;
  mechanismFindings: Array<{
    mechanismId: Id;
    engagement: MechanismEngagement;
    reason: string;
    confidence: Confidence;
  }>;
  recommendedEffects: EffectRecommendation[];
  outcomeBands: OutcomeBand[];
  assumptions: string[];
  unknowns: string[];
  confidence: Confidence;
}

export interface RedTeamFinding {
  category:
    | 'COMPILER_CHARITY'
    | 'HIDDEN_DEPENDENCY'
    | 'SECOND_ORDER_EFFECT'
    | 'OMNISCIENCE'
    | 'CAPABILITY_VIOLATION'
    | 'MAGNITUDE_DRIFT'
    | 'SYCOPHANCY'
    | 'OTHER';
  severity: 'INFO' | 'WARNING' | 'BLOCKING';
  claim: string;
  evidence: string[];
  affectedMechanismIds: Id[];
}

export interface CounterfactualBranch {
  id: Id;
  premise: string;
  source: 'ACTOR_RESPONSE' | 'DETECTION' | 'ASSUMPTION_FAILURE' | 'THIRD_PARTY' | 'BASE_CASE';
  affectedMechanismIds: Id[];
  robustnessConcern: string;
}

export interface ModelDisagreement {
  compared: boolean;
  material: boolean;
  severityScore: number;
  differences: string[];
  response: 'NONE' | 'LOWER_CONFIDENCE' | 'BROADEN_DISTRIBUTION';
}

export interface StateChange {
  id: Id;
  /** The mechanism this change is attributable to, carried rather than
   * inferred from the effect id so the ledger can answer "why". */
  mechanismId?: Id;
  targetType: ProposedEffect['targetType'];
  targetId: Id;
  field: string;
  before: unknown;
  after: unknown;
  appliedDelta?: number;
  cause: string;
  sourceEffectId: Id;
  impactClass: ImpactClass;
  confidence: Confidence;
}

export interface CausalPrecedent {
  source: 'INTERNAL' | 'HISTORICAL_ANALOG';
  sourceId: Id;
  relevanceScore: number;
  turn: number;
  mechanismKind: StrategyMechanism['kind'];
  targetId: Id;
  field: string;
  impactClass: ImpactClass;
  appliedDelta?: number;
  cause: string;
  contextualDifference: string;
}

export interface ValidationIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
  path?: string;
}

export interface TurnAudit {
  auditVersion: 2;
  hashVersion: 2;
  legacyIncomplete?: boolean;
  id: Id;
  campaignId: Id;
  turn: number;
  startedAt: string;
  completedAt: string;
  modelConfig: Record<string, string>;
  rawDirective: string;
  dryStrategy: StrategyGraph;
  compilerFidelity: CompilerFidelity;
  depth: TurnDepth;
  routingReasons: string[];
  feasibility: FeasibilityFinding[];
  actorActions: ActorAction[];
  redTeam: RedTeamFinding[];
  counterfactualBranches: CounterfactualBranch[];
  disagreement: ModelDisagreement;
  precedents: CausalPrecedent[];
  adjudication: Adjudication;
  selectedOutcome: OutcomeBand;
  randomDraw?: number;
  rngSeed: number;
  rngCursorBefore: number;
  rngCursorAfter: number;
  stateChanges: StateChange[];
  validation: ValidationIssue[];
  narrative: TurnNarrative;
  requestCount: number;
  estimatedCostUsd: number;
  priorRevision: number;
  committedRevision: number;
  previousStateHash: string;
  committedStateHash: string;
  previousStateSnapshot: WorldState;
  committedStateSnapshot: WorldState;
  previousBeliefSnapshot: BeliefState;
  committedBeliefSnapshot: BeliefState;
  previousMemorySnapshot: Record<Id, ActorMemoryState>;
  committedMemorySnapshot: Record<Id, ActorMemoryState>;
  modelCalls: ModelCallTrace[];
  progressEvents: TurnProgress[];
  actorSimulationPackets: ActorSimulationAudit[];
  accessDecisions: AccessDecision[];
  detectionRecords: DetectionRecord[];
  jeopardy?: JeopardyAssessment;
  narrativePacket?: NarrativePacket;
  worldExtension?: WorldExtensionAudit;
  playerForecast?: PlayerForecast;
  forecastScore?: ForecastScore;
}

export interface JeopardyAssessment {
  physical: number;
  institutional: number;
  /** The act itself: irreversible, unlawful, or of a kind that changes the
   * world whoever carries it out. */
  operational: number;
  reasons: string[];
  exposingMechanismIds: Id[];
  refusableMechanismIds: Id[];
  extremeMechanismIds: Id[];
}

export interface TurnNarrative {
  title: string;
  immediateOutcome: string;
  worldReaction: string;
  strategicConsequences: string;
  news: Array<{ source: string; headline: string }>;
  advisorReactions: Array<{ actorId: Id; name: string; reaction: string }>;
  detailedReport: string;
  pressCoverage: Array<{ source: string; headline: string; body: string }>;
  updatedStorySummary: string;
  newCharacters: Array<{ name: string; role: string }>;
  chronicleEntry: string;
  storyThreadUpdates: Array<{ id: Id; title: string; status: string; summary: string }>;
}

export interface NarrativeCharacter {
  name: string;
  role: string;
  introducedTurn: number;
  memories: string[];
}

export interface NarrativeThread {
  id: Id;
  title: string;
  status: string;
  summary: string;
  updatedTurn: number;
}

export interface ChronicleEntry {
  turn: number;
  date: string;
  title: string;
  summary: string;
}

export interface OutcomeLedger {
  attempted: string[];
  blocked: Array<{ attempt: string; reason: string }>;
  observedResponses: string[];
  unresolved: string[];
  setAside: string[];
}

export interface NarrativePacket {
  scenarioContext: Partial<NarrativeWorldModel>;
  rawDirective: string;
  outcomeLedger: OutcomeLedger;
  compiledStrategy: StrategyGraph;
  selectedOutcome: OutcomeBand;
  visibleChanges: unknown[];
  visibleActorEvents: Array<{ actorName: string; action: string }>;
  advisors: Array<Pick<AdvisorState, 'id' | 'actorId' | 'name' | 'worldview' | 'bias' | 'voice' | 'personalStakes'>>;
  recentNarratives: Array<{ title: string; immediateOutcome: string }>;
  storySoFar: string;
  recurringCharacters: NarrativeCharacter[];
  activeThreads: NarrativeThread[];
  continuingUncertainty: string[];
  voice?: NarrativeVoice;
}

export interface Campaign {
  state: WorldState;
  beliefs: BeliefState;
  memories: Record<Id, ActorMemoryState>;
  audits: TurnAudit[];
  storySummary: string;
  narrativeCharacters: NarrativeCharacter[];
  narrativeThreads: NarrativeThread[];
  chronicle: ChronicleEntry[];
  aliases: Record<string, Id>;
  forecastRecord: ForecastRecord;
}

export interface TurnProgress {
  stage:
    | 'COMPILE'
    | 'GROUND'
    | 'FEASIBILITY'
    | 'ACTORS'
    | 'RED_TEAM'
    | 'ADJUDICATE'
    | 'UNCERTAINTY'
    | 'COMMIT'
    | 'VALIDATE'
    | 'NARRATE'
    | 'PERSIST';
  label: string;
  detail?: string;
  status: 'STARTED' | 'COMPLETED';
  at: string;
}

export interface TurnPreview {
  strategy: string;
  advantages: string[];
  uncertainties: string[];
  stakes: string[];
  advisorAssessments: string[];
  intelligenceNotes: string[];
  strategicTradeoffs: string[];
}

export interface TurnOption {
  id: Id;
  label: string;
  directiveText: string;
  rationale: string;
  tradeoff: string;
}

export interface AdvisorAssessment {
  advisorId: Id;
  advisorName: string;
  assessment: string;
  confidence: Confidence;
  biasDisclosure: string;
}

export type ForecastOutcome = 'SETBACK' | 'MIXED' | 'SUCCESS' | 'STRONG_SUCCESS';
export type ForecastActorStance = 'ESCALATES' | 'HOLDS' | 'ENGAGES';

/** Captured at directive commit, BEFORE resolution. Never enters any model
 * prompt before state commit (Invariant 7) — it is scored mechanically. */
export interface PlayerForecast {
  outcome: ForecastOutcome;
  actorPredictions: Array<{ actorId: Id; stance: ForecastActorStance }>;
  freeText?: string;
}

export interface ForecastScore {
  predictedOutcome: ForecastOutcome;
  actualOutcome: ForecastOutcome;
  outcomeResult: 'HIT' | 'ADJACENT' | 'MISS';
  actorResults: Array<{ actorId: Id; predicted: ForecastActorStance; actual: ForecastActorStance; correct: boolean }>;
  freeText?: string;
}

export interface ForecastRecord {
  forecasts: number;
  hits: number;
  adjacents: number;
  actorPredictions: number;
  actorHits: number;
  /** Signed sum of (predicted − actual) outcome buckets: positive means the
   * player systematically over-predicts success. */
  outcomeBiasSum: number;
}

export interface TurnResult {
  campaign: Campaign;
  audit: TurnAudit;
}

export interface ModelCallUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ModelCallResult<T> {
  value: T;
  model: string;
  usage: ModelCallUsage;
  rawText: string;
}

export interface ModelCallTrace {
  id: Id;
  role: string;
  model: string;
  schemaName: string;
  startedAt: string;
  completedAt: string;
  status: 'SUCCEEDED' | 'FAILED' | 'CACHED';
  messages: ModelMessageSnapshot[];
  rawText?: string;
  usage?: ModelCallUsage;
  error?: string;
}

export interface ModelMessageSnapshot {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ActorSimulationAudit {
  actorId: Id;
  input: unknown;
  output: ActorAction[];
}
