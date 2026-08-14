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
}

export interface TimeScale {
  amount: number;
  unit: TimeUnit;
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
  timeUnit: TimeUnit;
  timeScale: TimeScale;
  metricDefinitions: MetricDefinition[];
  historicalCutoff: string;
  authorityRules: AuthorityRule[];
  calibrationRules: ScenarioCalibrationRule[];
  historicalAnalogs: HistoricalAnalog[];
  hardRules: string[];
  advisors: AdvisorState[];
  unresolvedUncertainties: string[];
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
}

export interface StrategyGraph {
  objective: string;
  mechanisms: StrategyMechanism[];
  sequencing: string[];
  contingencies: string[];
  explicitRisks: string[];
  unspecified: string[];
  communicationStyleIsMechanism: boolean;
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
}

export interface EffectRecommendation {
  id: Id;
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

export interface StateChange {
  id: Id;
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
}

export interface TurnNarrative {
  title: string;
  immediateOutcome: string;
  worldReaction: string;
  strategicConsequences: string;
  news: Array<{ source: string; headline: string }>;
  advisorReactions: Array<{ actorId: Id; name: string; reaction: string }>;
}

export interface Campaign {
  state: WorldState;
  beliefs: BeliefState;
  memories: Record<Id, ActorMemoryState>;
  audits: TurnAudit[];
}

export interface TurnProgress {
  stage:
    | 'COMPILE'
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

export interface AdvisorAssessment {
  advisorId: Id;
  advisorName: string;
  assessment: string;
  confidence: Confidence;
  biasDisclosure: string;
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
