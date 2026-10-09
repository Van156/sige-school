/** Institution default time zone (sige/02 `institution_profile.timezone` default). */
export const DEFAULT_TIME_ZONE = "America/Bogota";

/**
 * Calendar day (`YYYY-MM-DD`) of `now` in `timeZone`. `now` is injectable so callers and tests
 * stay deterministic; the `en-CA` locale formats as ISO year-month-day.
 */
export function todayIn(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whether a `YYYY-MM-DD` day is after today in `timeZone` (lexicographic = chronological). */
export function isFutureDate(
  value: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): boolean {
  return value > todayIn(timeZone, now);
}
