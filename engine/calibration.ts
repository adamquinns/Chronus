import { Confidence, ImpactClass, WorldState } from './domain';

export const IMPACT_BANDS: Record<ImpactClass, readonly [number, number]> = {
  NONE: [0, 0],
  TRIVIAL: [1, 1],
  MINOR: [2, 3],
  MODERATE: [4, 7],
  MAJOR: [8, 12],
  SEVERE: [13, 20],
  SYSTEMIC: [21, 35],
};

const confidenceScale: Record<Confidence, number> = {
  VERY_LOW: 0.55,
  LOW: 0.7,
  MEDIUM: 0.85,
  HIGH: 1,
  VERY_HIGH: 1.1,
};

export const calibratedMagnitude = (
  impactClass: ImpactClass,
  confidence: Confidence,
  state: WorldState,
  targetId: string,
  targetType: 'METRIC' | 'RESOURCE' | 'ENTITY' | 'RELATIONSHIP' | 'ARC' | 'FACT' | 'PROCESS' | 'GOAL' = 'METRIC',
): number => {
  const [min, max] = IMPACT_BANDS[impactClass];
  if (max === 0) return 0;
  const midpoint = (min + max) / 2;
  const current = state.metrics[targetId];
  const boundaryScale = typeof current === 'number' && (current < 10 || current > 90) ? 0.75 : 1;
  const scenarioRule = state.manifest.calibrationRules
    .filter((rule) => (!rule.targetId || rule.targetId === targetId) && (!rule.targetType || rule.targetType === targetType))
    .sort((a, b) => Number(Boolean(b.targetId)) - Number(Boolean(a.targetId)))[0];
  const scenarioScale: Record<ImpactClass, number> = { NONE: 0.8, TRIVIAL: 0.85, MINOR: 0.95, MODERATE: 1, MAJOR: 1.1, SEVERE: 1.2, SYSTEMIC: 1.3 };
  const calibrationScale = scenarioRule ? scenarioScale[scenarioRule.defaultImpactClass] : 1;
  return Math.max(min, Math.min(max, Math.round(midpoint * confidenceScale[confidence] * boundaryScale * calibrationScale)));
};

export const normalizeDistribution = <T extends { probability: number }>(entries: T[]): T[] => {
  const clean = entries.map((entry) => ({ ...entry, probability: Math.max(0, entry.probability) }));
  const total = clean.reduce((sum, entry) => sum + entry.probability, 0);
  if (total === 0) {
    const equal = 1 / Math.max(1, clean.length);
    return clean.map((entry) => ({ ...entry, probability: equal }));
  }
  return clean.map((entry) => ({ ...entry, probability: entry.probability / total }));
};
