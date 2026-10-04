/** Seeded pseudo-random generator (mulberry32) so every render sees the same dataset. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Approximately normal sample (Box-Muller). */
  normal(mean: number, standardDeviation: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const range = (min: number, max: number) => min + next() * (max - min);

  return {
    next,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    normal: (mean, standardDeviation) => {
      const u = Math.max(next(), Number.EPSILON);
      const v = next();
      return mean + standardDeviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)] as (typeof items)[number],
  };
}
