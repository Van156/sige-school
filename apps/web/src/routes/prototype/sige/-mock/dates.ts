/** Pure UTC date helpers: the dataset never reads the wall clock. */

export const ACADEMIC_YEAR = "2026";
/** Monday of the snapshot every screen is "as of". */
export const REFERENCE_DATE = "2026-10-05";

const DAY_MS = 86_400_000;

function toUtcMs(iso: string): number {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(year as number, (month as number) - 1, day);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (new Date(toUtcMs(iso)).getUTCDay() + 6) % 7;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Inclusive list of calendar dates. */
export function dateRange(from: string, to: string): string[] {
  const total = daysBetween(from, to);
  return Array.from({ length: total + 1 }, (_, offset) => addDays(from, offset));
}

/** `HH:MM` strings overlap when their half-open intervals intersect. */
export function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}
