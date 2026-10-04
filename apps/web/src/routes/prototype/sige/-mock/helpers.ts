import type {
  AnnualStatus,
  Attendance,
  FinalStatus,
  GradeCriteria,
  PerformanceLevel,
} from "./types";

/** Grading rules (inventory 2.3): scale 1.0-5.0, passing grade 3.0. */
export const MIN_GRADE = 1;
export const MAX_GRADE = 5;
export const PASSING_GRADE = 3;
export const EXCELLENCE_GRADE = 4.5;
export const GOOD_GRADE = 4;

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function clampScore(score: number): number {
  return Math.min(MAX_GRADE, Math.max(MIN_GRADE, score));
}

export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : (part / total) * 100;
}

/** Weighted mean of `value` using `weight` (weights need not sum to 100). */
export function weightedAverage(
  items: readonly { value: number; weight: number }[],
): number | null {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return null;
  return items.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

/**
 * Period final grade: sum(score x weight/100), re-normalised over the criteria that already have
 * a score, clamped to 1.0-5.0 and rounded to 2 decimals. `null` when nothing is graded yet.
 */
export function finalScore(
  records: readonly { criterionId: number; score: number }[],
  criteria: readonly GradeCriteria[],
): number | null {
  const scored = criteria.flatMap((criterion) => {
    const record = records.find((item) => item.criterionId === criterion.id);
    return record ? [{ value: record.score, weight: criterion.weight }] : [];
  });
  const result = weightedAverage(scored);
  return result === null ? null : round(clampScore(result));
}

export function statusFromScore(score: number | null | undefined): FinalStatus {
  if (score === null || score === undefined) return "no evaluado";
  return score >= PASSING_GRADE ? "ganada" : "perdida";
}

export function annualStatusFromScore(score: number | null | undefined): AnnualStatus {
  if (score === null || score === undefined) return "no evaluado";
  return score >= PASSING_GRADE ? "aprobado" : "reprobado";
}

/** Annual grade = mean of the available period finals. */
export function annualScore(periodFinals: readonly number[]): number | null {
  const mean = average(periodFinals);
  return mean === null ? null : round(mean);
}

/** Performance level; ranges are contiguous (the legacy 4.5-4.6 gap is closed on purpose). */
export function performanceLevel(score: number): PerformanceLevel {
  if (score >= 4.6) return "Superior";
  if (score >= 4) return "Alto";
  if (score >= 3) return "Básico";
  return "Bajo";
}

export type ScoreClass = "excellent" | "good" | "passing" | "risk" | "critical";

/** Colour bucket of a score: 4.5 / 4.0 / 3.0 / 2.0 thresholds. */
export function scoreClass(score: number): ScoreClass {
  if (score >= EXCELLENCE_GRADE) return "excellent";
  if (score >= GOOD_GRADE) return "good";
  if (score >= PASSING_GRADE) return "passing";
  if (score >= 2) return "risk";
  return "critical";
}

export type AbsenceBand = "critical" | "attention" | "normal";

/** Absence rate (percent) bands: > 20 critical, > 10 attention. */
export function absenceBand(rate: number): AbsenceBand {
  if (rate > 20) return "critical";
  if (rate > 10) return "attention";
  return "normal";
}

/** Share of sessions the student attended ("presente"), in percent with one decimal. */
export function attendancePercentage(rows: readonly Pick<Attendance, "status">[]): number {
  if (rows.length === 0) return 100;
  const present = rows.filter((row) => row.status === "presente").length;
  return round(percent(present, rows.length), 1);
}

/** Absence rate (percent): every session that is not "presente", justified or not. */
export function absenceRate(rows: readonly Pick<Attendance, "status">[]): number {
  return rows.length === 0 ? 0 : round(100 - attendancePercentage(rows), 1);
}

/** Teacher analytics thresholds (inventory 2.3). */
export type TeacherGroupState = "risk" | "attention" | "optimal";

export function teacherGroupState(averageScore: number, failingRate: number): TeacherGroupState {
  if (failingRate > 30) return "risk";
  if (averageScore < 3.5) return "attention";
  return "optimal";
}
