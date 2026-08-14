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
export type MechanismEngagement =
  | 'ENGAGES_STRONGLY'
  | 'ENGAGES'
  | 'ENGAGES_WEAKLY'
  | 'DOES_NOT_ENGAGE'
  | 'BACKFIRES';

export interface MetricDefinition {
  id: Id;
  label: string;
  description: string;
  min: number;
  max: number;
  dangerBelow?: number;
  dangerAbove?: number;
  hidden?: boolean;
}

export interface ResourceState {
  id: Id;
  label: string;
  amount: number;
  unit: string;
  renewable: boolean;
  ownerId: Id;
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
}

export interface GoalState {
  id: Id;
  title: string;
  description: string;
  victoryConditions: string[];
  failureConditions: string[];
  deadlineTurn: number;
  status: 'ACTIVE' | 'ACHIEVED' | 'FAILED';
}

export interface WorldFact {
  id: Id;
  statement: string;
  provenance: ProvenanceKind;
  confidence: Confidence;
  knownBy: Id[];
  source?: string;
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
}

export interface ScenarioManifest {
  id: Id;
  title: string;
  premise: string;
  playerId: Id;
  playerRole: string;
  startingDate: string;
  timeUnit: 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';
  metricDefinitions: MetricDefinition[];
  historicalCutoff: string;
}

export interface WorldState {
  schemaVersion: 1;
  campaignId: Id;
  revision: number;
  manifest: ScenarioManifest;
  turn: number;
  dateLabel: string;
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

export interface ValidationIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
  path?: string;
}

export interface TurnAudit {
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
  feasibility: FeasibilityFinding[];
  actorActions: ActorAction[];
  redTeam: RedTeamFinding[];
  adjudication: Adjudication;
  selectedOutcome: OutcomeBand;
  randomDraw: number;
  stateChanges: StateChange[];
  validation: ValidationIssue[];
  narrative: TurnNarrative;
  requestCount: number;
  estimatedCostUsd: number;
  priorRevision: number;
  committedRevision: number;
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
