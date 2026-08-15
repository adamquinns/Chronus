export type BaselineRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
export type BaselineConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'VOLATILE';

const ranges = {
  LOW: { critFailMax: 1, successMax: 19, threshold: 3 },
  MEDIUM: { critFailMax: 3, successMax: 16, threshold: 8 },
  HIGH: { critFailMax: 5, successMax: 17, threshold: 12 },
  EXTREME: { critFailMax: 6, successMax: 18, threshold: 15 },
} as const;

const unit = (seed: number) => {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x1_0000_0000;
};

export interface BaselineResult {
  directive: string;
  roll: number;
  outcome: 'VICTORY' | 'PARTIAL_FAILURE' | 'CRITICAL_FAILURE';
  usesMechanismAnalysis: false;
  checksAuthority: false;
  checksCapabilities: false;
  isolatesHiddenState: false;
  deterministicWhenControlled: false;
}

/** Faithful, dependency-free reproduction of the retired Chronus d20 resolver. */
export const runD20Baseline = (
  directive: string,
  risk: BaselineRisk,
  _confidence: BaselineConfidence,
  seed: number,
): BaselineResult => {
  const roll = Math.floor(unit(seed) * 20) + 1;
  const range = ranges[risk];
  const outcome = roll > range.successMax || roll >= range.threshold
    ? 'VICTORY'
    : roll <= range.critFailMax ? 'CRITICAL_FAILURE' : 'PARTIAL_FAILURE';
  return {
    directive, roll, outcome,
    usesMechanismAnalysis: false,
    checksAuthority: false,
    checksCapabilities: false,
    isolatesHiddenState: false,
    deterministicWhenControlled: false,
  };
};

export const baselineSuccessRate = (risk: BaselineRisk) => {
  const range = ranges[risk];
  return (21 - range.threshold) / 20;
};
