import { TimeScale, WorldState } from './domain';

const minutesFor = (scale: TimeScale) => {
  const factors = { MINUTES: 1, HOURS: 60, DAYS: 1440, WEEKS: 10080, MONTHS: 43830, YEARS: 525960 } as const;
  return scale.amount * factors[scale.unit];
};

export const advanceScenarioTime = (state: WorldState): WorldState => {
  const next = structuredClone(state);
  const date = new Date(next.currentDateTime);
  const conditionMet = (rule: WorldState['manifest']['timeScaleRules'][number]) => {
    const actual = next.metrics[rule.condition.targetId];
    const expected = rule.condition.value as number;
    if (rule.condition.operator === 'LT') return actual < expected;
    if (rule.condition.operator === 'LTE') return actual <= expected;
    if (rule.condition.operator === 'EQ') return actual === expected;
    if (rule.condition.operator === 'GTE') return actual >= expected;
    return actual > expected;
  };
  const activeScale = next.manifest.timeScaleRules.find(conditionMet)?.scale ?? next.manifest.timeScale;
  const { amount, unit } = activeScale;
  if (unit === 'MONTHS') date.setUTCMonth(date.getUTCMonth() + amount);
  else if (unit === 'YEARS') date.setUTCFullYear(date.getUTCFullYear() + amount);
  else date.setUTCMinutes(date.getUTCMinutes() + minutesFor(activeScale));
  next.currentDateTime = date.toISOString();
  next.elapsedMinutes += minutesFor(activeScale);
  next.dateLabel = `${date.toISOString().replace('T', ' ').replace('.000Z', ' UTC')} · Turn ${next.turn}`;
  return next;
};
