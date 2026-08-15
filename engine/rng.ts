export interface RandomDraw {
  value: number;
  cursor: number;
}

/** Mulberry32 with an explicit cursor so a turn can be exactly replayed. */
export const drawSeeded = (seed: number, cursor: number): RandomDraw => {
  let value = (seed + Math.imul(cursor + 1, 0x6d2b79f5)) >>> 0;
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  const normalized = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  return { value: normalized, cursor: cursor + 1 };
};

export const selectWeighted = <T extends { probability: number }>(
  entries: T[],
  draw: number,
): T => {
  if (!entries.length) throw new Error('Cannot select from an empty distribution.');
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.probability), 0);
  if (total <= 0) return entries[entries.length - 1];
  let cursor = draw * total;
  for (const entry of entries) {
    cursor -= Math.max(0, entry.probability);
    if (cursor <= 0) return entry;
  }
  return entries[entries.length - 1];
};
