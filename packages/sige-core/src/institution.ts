/**
 * Pure institution-structure rules (sige/02 §4.1, INS-R7, INS-R9). No framework imports so the
 * API schemas, services and the web share one definition of each boundary.
 */

export const CRITERION_WEIGHT_MAX = 100;
export const PERIOD_ORDER_MIN = 1;
export const PERIOD_ORDER_MAX = 4;
export const COURSE_CAPACITY_MIN = 1;
export const COURSE_CAPACITY_MAX = 60;

/** Weights are `numeric(5,2)`: work in hundredths so sums never drift. */
const toHundredths = (value: number) => Math.round(value * 100);

/** `0 < weight <= 100` with at most two decimals. */
export function isValidCriterionWeight(weight: number): boolean {
  if (!Number.isFinite(weight) || weight <= 0 || weight > CRITERION_WEIGHT_MAX) {
    return false;
  }
  return Math.abs(weight * 100 - toHundredths(weight)) < 1e-6;
}

/** Period order inside an academic year: integer 1..4. */
export function isValidPeriodOrder(order: number): boolean {
  return Number.isInteger(order) && order >= PERIOD_ORDER_MIN && order <= PERIOD_ORDER_MAX;
}

/** Course capacity: integer 1..60. */
export function isValidCourseCapacity(capacity: number): boolean {
  return (
    Number.isInteger(capacity) && capacity >= COURSE_CAPACITY_MIN && capacity <= COURSE_CAPACITY_MAX
  );
}

/** Σ of criterion weights, exact to two decimals (INS-R7: the total is validated, not enforced). */
export function sumWeights(weights: readonly number[]): number {
  return weights.reduce((total, weight) => total + toHundredths(weight), 0) / 100;
}

export type PeriodRange = {
  academicYear: string;
  /** ISO date `YYYY-MM-DD`. */
  startDate: string;
  /** ISO date `YYYY-MM-DD`. */
  endDate: string;
};

/** Closed-range overlap inside the same academic year; ISO dates compare lexicographically. */
export function periodsOverlap(a: PeriodRange, b: PeriodRange): boolean {
  if (a.academicYear !== b.academicYear) {
    return false;
  }
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}
