

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'VOLATILE';

type RangeConfig = {
    critFailMax: number;
    failMax: number;
    successMax: number;
    threshold: number; // The minimum roll needed for a standard success
    label: string;
};

// Configuration defining the upper bounds (inclusive) for each result category
const RISK_RANGES: Record<RiskLevel, RangeConfig> = {
    // Low: 1 Crit Fail, 2 Fail, 3-19 Success, 20 Crit Success
    LOW: { critFailMax: 1, failMax: 2, successMax: 19, threshold: 3, label: '90% Success Rate' },
    
    // Medium: 1-3 Crit Fail, 4-7 Fail, 8-16 Success, 17-20 Crit Success
    MEDIUM: { critFailMax: 3, failMax: 7, successMax: 16, threshold: 8, label: '65% Success Rate' },
    
    // High: 1-5 Crit Fail, 6-11 Fail, 12-17 Success, 18-20 Crit Success
    HIGH: { critFailMax: 5, failMax: 11, successMax: 17, threshold: 12, label: '45% Success Rate' },
    
    // Extreme: 1-6 Crit Fail, 7-14 Fail, 15-18 Success, 19-20 Crit Success
    EXTREME: { critFailMax: 6, failMax: 14, successMax: 18, threshold: 15, label: '25% Success Rate' },
};

export const getRiskConfig = (risk: string) => {
    // Normalize string to RiskLevel key
    const r = (risk?.toUpperCase() || 'HIGH') as RiskLevel;
    return RISK_RANGES[r] || RISK_RANGES.HIGH;
};

/**
 * Calculates the random variance shift based on confidence.
 * HIGH: 0
 * MEDIUM: +/- 1
 * LOW: +/- 2
 * VOLATILE: +/- 3
 * Positive shift = HARDER (Thresholds move up).
 * Negative shift = EASIER (Thresholds move down).
 */
const getConfidenceShift = (confidence: string): number => {
    const c = (confidence?.toUpperCase() || 'MEDIUM') as ConfidenceLevel;
    const randSign = Math.random() < 0.5 ? -1 : 1;
    
    switch (c) {
        case 'HIGH': return 0;
        case 'MEDIUM': return Math.floor(Math.random() * 2) * randSign; // 0 or 1
        case 'LOW': return Math.floor(Math.random() * 3) * randSign; // 0, 1, or 2
        case 'VOLATILE': return Math.floor(Math.random() * 4) * randSign; // 0, 1, 2, or 3
        default: return 0;
    }
};

export const calculateOutcome = (risk: string, confidence: string): { roll: number; outcome: string; label: string; modifier: number; effectiveThreshold: number } => {
    const roll = Math.floor(Math.random() * 20) + 1; // 1-20
    const config = getRiskConfig(risk);
    const shift = getConfidenceShift(confidence);

    // Apply Shift logic:
    // A positive shift increases the numbers required, making it HARDER.
    // A negative shift decreases the numbers required, making it EASIER.
    // We clamp to ensure we don't break the d20 scale completely (keeping 20 as crit success usually, 1 as crit fail).
    
    const clamp = (num: number) => Math.max(0, Math.min(19, num));

    const effectiveCritFail = clamp(config.critFailMax + shift);
    const effectiveFail = clamp(config.failMax + shift);
    const effectiveSuccess = clamp(config.successMax + shift);
    const effectiveThreshold = clamp(config.threshold + shift);

    let outcomeCategory = 'PARTIAL_FAILURE';
    let outcomeLabel = 'FAILURE';

    if (roll > effectiveSuccess) {
        // Roll is higher than the max for standard success -> Critical Success
        outcomeCategory = 'VICTORY';
        outcomeLabel = 'CRITICAL SUCCESS';
    } else if (roll >= effectiveThreshold) {
        // Roll is within the success range
        outcomeCategory = 'VICTORY';
        outcomeLabel = 'SUCCESS';
    } else if (roll > effectiveCritFail) {
        // Roll is in the failure range (but not critical)
        outcomeCategory = 'PARTIAL_FAILURE';
        outcomeLabel = 'PARTIAL FAILURE';
    } else {
        // Roll is in the critical failure range
        outcomeCategory = 'CRITICAL_FAILURE';
        outcomeLabel = 'CATASTROPHIC FAILURE';
    }

    return { 
        roll, 
        outcome: outcomeCategory, 
        label: outcomeLabel,
        modifier: shift,
        effectiveThreshold
    };
};

export const getOutcomeRanges = (risk: string) => {
    const config = getRiskConfig(risk);
    
    // Helper to format ranges nicely (e.g. "1-3" or just "1")
    const format = (min: number, max: number) => min === max ? `${min}` : `${min}-${max}`;

    return {
        critFail: format(1, config.critFailMax),
        fail: format(config.critFailMax + 1, config.failMax),
        success: format(config.failMax + 1, config.successMax),
        critSuccess: format(config.successMax + 1, 20),
        
        // Metadata for UI sizing (proportions out of 20)
        counts: {
            critFail: config.critFailMax,
            fail: config.failMax - config.critFailMax,
            success: config.successMax - config.failMax,
            critSuccess: 20 - config.successMax
        }
    };
};