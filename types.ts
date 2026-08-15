

export interface GameStats {
  stability: number;
  wealth: number;
  support: number;
  primaryStatValue: number;
}

export interface MetricDisplay {
  id: string;
  label: string;
  value: number;
  display: string;
  delta: number;
  confidence: string;
  danger: boolean;
}

export interface CausalDevelopment {
  id: string;
  label: string;
  field: string;
  before: unknown;
  after: unknown;
  cause: string;
}

export interface StatsDelta {
  stability: number;
  wealth: number;
  support: number;
  primaryStatValue: number;
}

// === NEW ENGINE TYPES ===

export interface SimulationManifest {
  genre: string; // e.g. "Political Thriller", "Hard Scifi", "Ancient Warfare"
  timeUnit: string; // "Days", "Months", "Years", "Hours"
  statsConfig: {
    stabilityLabel: string; // e.g. "Voter Base" or "Hull Integrity"
    wealthLabel: string;    // e.g. "Campaign Funds" or "Energy"
    supportLabel: string;   // e.g. "Polling" or "Crew Morale"
    primaryStatLabel: string; // e.g. "Media Attention" or "Ammo"
  };
}

export interface Goal {
  id: string;
  description: string; // e.g. "Secure a majority in the 2026 Midterms"
  type: 'SURVIVAL' | 'CONQUEST' | 'DIPLOMACY' | 'REFORM';
  turnsRemaining: number;
  totalTurns: number; // To calculate progress bar
  status: 'ACTIVE' | 'ACHIEVED' | 'FAILED';
  victoryCondition: string; // e.g. "Support > 50 and Stability > 60"
}

export interface GoalResult {
  outcome: 'VICTORY' | 'DEFEAT';
  title: string; // e.g. "MISSION ACCOMPLISHED" or "TIMELINE COMPROMISED"
  description: string; // Brief narrative of the result
}

export interface Entity {
  id: string;
  name: string;
  type: 'Faction' | 'Asset' | 'Figure' | 'Threat';
  description: string;
  power?: number; // 0-100 (Capability). Absent when the source does not measure it.
  loyalty?: number; // 0-100 (Willingness/Alignment). For Threats, "Distance/Inactivity".
  status: string; // e.g., "Mobilizing", "Bankrupt", "Attacking"
}

export interface PlotArc {
  id: string;
  title: string; // e.g., "Election Day", "Invasion Fleet Arrival"
  currentValue: number; // 0-100
  maxValue: number; // Usually 100
  status: string; // "Looming", "Active", "Resolved"
}

export interface WorldLedger {
  allies: Entity[];  // Factions/Figures helping you
  enemies: Entity[]; // Factions/Threats hurting you
  assets: Entity[];  // Tools/Armies you own
}

// ========================

export interface Advisor {
  id: string;
  name: string;
  role: string;
  advice: string;
  bias: 'force' | 'diplomacy' | 'profit' | 'innovation';
  status?: 'Active' | 'Compromised' | 'Deceased' | string;
}

export interface NewsFlash {
  source: string;
  headline: string;
}

export interface Choice {
  id: string;
  text: string;
  type: 'diplomacy' | 'force' | 'profit' | 'innovation';
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  projectedCost?: string;
  detailedDescription: string;
  forecastRange: string;
  forecastConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'VOLATILE';
  technicalReport: string;
}

export interface ExecutionAnalysis {
  directiveType: 'STANDARD' | 'CUSTOM';
  perceivedRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  forecastedRange: string;
  forecastConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'VOLATILE';
  intelModifierValue: number; // The hidden shift applied to the matrix (e.g. +2 or -3)
  outcomeCategory: 'VICTORY' | 'PARTIAL_SUCCESS' | 'PARTIAL_FAILURE' | 'CRITICAL_FAILURE';
  outcomeLabel: string;
  resourcesConsumed: string;
  rollValue: string; // e.g. "14/20"
}

export interface TurnData {
  turnNumber: number;
  year: string;
  eventTitle: string;

  // The Physics Engine
  manifest: SimulationManifest;
  currentGoal: Goal; // NEW: The specific objective for this phase
  goalResult?: GoalResult; // NEW: Present only when a goal finishes this turn
  arcs: PlotArc[];

  news: NewsFlash[];
  narrative: string;
  advisors: Advisor[];

  stats: GameStats;
  metricDisplays: MetricDisplay[];
  statsDelta: StatsDelta;
  statsReasoning: string;
  detailedReport?: string;
  pressCoverage?: Array<{ source: string; headline: string; body: string }>;
  advisorReactions?: Array<{ actorId: string; name: string; reaction: string }>;
  developments?: CausalDevelopment[];
  storyThreads?: Array<{ id: string; title: string; status: string; summary: string }>;
  /** What the world now puts in front of the player, in their own terms. */
  facingPlayer?: string[];
  /** Every branch the world weighed this turn, and which one the draw took. */
  whatElseCouldHaveHappened?: {
    draw: number;
    outcomes: Array<{ id: string; event: string; probability: number; taken: boolean }>;
  };
  ledger: WorldLedger;
  choices: Choice[];
  executionAnalysis?: ExecutionAnalysis;
  gameOver: boolean;
}

export interface HistoryEntry {
  turnNumber: number;
  year: string;
  narrative: string;
  eventTitle: string;
  statsSnapshot: GameStats;
  statsDelta: StatsDelta;
  statsReasoning: string;
  ledgerSnapshot: WorldLedger;
  manifestSnapshot: SimulationManifest; // Keep record of rules
  goalSnapshot: Goal;
  goalResultSnapshot?: GoalResult; // NEW
  arcsSnapshot: PlotArc[];
  advisorsSnapshot: Advisor[]; // NEW: Track advisors to ensure continuity
  userChoice?: string;
  executionAnalysis?: ExecutionAnalysis;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  startingYear: string;
  imageUrl: string;
  promptContext: string;
}

export enum GameStatus {
  MENU = 'MENU',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  ENDED = 'ENDED'
}
