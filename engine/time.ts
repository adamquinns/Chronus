import { TimeScale, WorldState } from './domain';

const minutesFor = (scale: TimeScale) => {
  const factors = { MINUTES: 1, HOURS: 60, DAYS: 1440, WEEKS: 10080, MONTHS: 43830, YEARS: 525960 } as const;
  return scale.amount * factors[scale.unit];
};

export const advanceScenarioTime = (state: WorldState): WorldState => {
  const next = structuredClone(state);
  const date = new Date(next.currentDateTime);
  const { amount, unit } = next.manifest.timeScale;
  if (unit === 'MONTHS') date.setUTCMonth(date.getUTCMonth() + amount);
  else if (unit === 'YEARS') date.setUTCFullYear(date.getUTCFullYear() + amount);
  else date.setUTCMinutes(date.getUTCMinutes() + minutesFor(next.manifest.timeScale));
  next.currentDateTime = date.toISOString();
  next.elapsedMinutes += minutesFor(next.manifest.timeScale);
  const elapsed = next.turn * amount;
  const labelUnit = unit.toLowerCase();
  next.dateLabel = `${next.manifest.startingDate} + ${elapsed} ${labelUnit}`;
  return next;
};
