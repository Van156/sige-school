/**
 * Grading functions of sige/06 §3, the single source for the sheet's live totals, `saveSheet`,
 * the stored `final_grade`, recalculation, import, seed and metrics (foundation §5.4, D12).
 *
 * Every score is integer hundredths ("cents", 4.25 -> 425) and every weight hundredths of a
 * percent (20.00 -> 2000); parse database and form text with `rules.ts`. Status and level are
 * always evaluated on the rounded two-decimal value.
 */
import { SIGE_RULES, divHalfUp } from "./rules";

const { CENTS } = SIGE_RULES;

export type CriterionWeight = { id: string; weight: number };
export type CriterionScore = { criterionId: string; score: number };

export const FINAL_STATUSES = ["ganada", "perdida", "no evaluado"] as const;
export type FinalStatus = (typeof FINAL_STATUSES)[number];

export const ANNUAL_STATUSES = ["aprobado", "reprobado", "no evaluado"] as const;
export type AnnualStatus = (typeof ANNUAL_STATUSES)[number];

export const PERFORMANCE_LEVELS = ["Superior", "Alto", "Básico", "Bajo"] as const;
export type PerformanceLevel = (typeof PERFORMANCE_LEVELS)[number];

export type ScoreClass = "excellent" | "good" | "passing" | "risk" | "critical";

const clampScore = (cents: number) => Math.min(CENTS.SCORE_MAX, Math.max(CENTS.SCORE_MIN, cents));

/**
 * Period final: `Σ(score·weight) / Σ(weight)` over the criteria that have a score, rounded
 * half-up to hundredths (`(2·num + den) div (2·den)`) and clamped to 1.00–5.00; `null` when
 * nothing is scored. Scores of criteria missing from `criteria` are ignored; with duplicates the
 * first score of a criterion counts.
 */
export function periodFinal(
  scores: readonly CriterionScore[],
  criteria: readonly CriterionWeight[],
): number | null {
  const byCriterion = new Map<string, number>();
  for (const cell of scores) {
    if (!byCriterion.has(cell.criterionId)) byCriterion.set(cell.criterionId, cell.score);
  }
  let numerator = 0;
  let denominator = 0;
  for (const criterion of criteria) {
    const score = byCriterion.get(criterion.id);
    if (score === undefined) continue;
    numerator += score * criterion.weight;
    denominator += criterion.weight;
  }
  if (denominator === 0) return null;
  return clampScore(divHalfUp(numerator, denominator));
}

/** `>= 3.00` ganada, `< 3.00` perdida, no final -> no evaluado. */
export function statusOf(final: number | null): FinalStatus {
  if (final === null) return "no evaluado";
  return final >= CENTS.PASSING_GRADE ? "ganada" : "perdida";
}

/** `>= 4.60` Superior, `>= 4.00` Alto, `>= 3.00` Básico, else Bajo; `null` without a final. */
export function performanceLevel(final: number | null): PerformanceLevel | null {
  if (final === null) return null;
  if (final >= CENTS.LEVEL_SUPERIOR) return "Superior";
  if (final >= CENTS.LEVEL_ALTO) return "Alto";
  if (final >= CENTS.LEVEL_BASICO) return "Básico";
  return "Bajo";
}

/** Badge tone of a score: 4.5 / 4.0 / 3.0 / 2.0 thresholds. */
export function scoreClass(score: number): ScoreClass {
  if (score >= CENTS.EXCELLENCE) return "excellent";
  if (score >= CENTS.GOOD) return "good";
  if (score >= CENTS.PASSING_GRADE) return "passing";
  if (score >= CENTS.RISK) return "risk";
  return "critical";
}

/** Half-up mean in hundredths of the given cents values; `null` when empty. */
export function meanCents(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return divHalfUp(
    values.reduce((sum, value) => sum + value, 0),
    values.length,
  );
}

/** Annual definitive (DEF): half-up mean of the available period finals. */
export function annualDef(finals: readonly (number | null)[]): number | null {
  return meanCents(finals.filter((final): final is number => final !== null));
}

/** `>= 3.00` aprobado, `< 3.00` reprobado, no DEF -> no evaluado. */
export function annualStatus(def: number | null): AnnualStatus {
  if (def === null) return "no evaluado";
  return def >= CENTS.PASSING_GRADE ? "aprobado" : "reprobado";
}

export type ScoreBucketTone = "red" | "orange" | "amber" | "teal" | "blue";
export type ScoreBucket = { label: string; count: number; tone: ScoreBucketTone };

const BUCKETS: readonly { label: string; min: number; tone: ScoreBucketTone }[] = [
  { label: "1.0-1.9", min: 100, tone: "red" },
  { label: "2.0-2.9", min: 200, tone: "orange" },
  { label: "3.0-3.9", min: 300, tone: "amber" },
  { label: "4.0-4.9", min: 400, tone: "teal" },
  { label: "5.0", min: 500, tone: "blue" },
];

/** Distribution of finals in five buckets; exactly 5.00 is the last one. */
export function scoreBuckets(finals: readonly number[]): ScoreBucket[] {
  return BUCKETS.map((bucket, index) => {
    const next = BUCKETS[index + 1]?.min ?? Number.POSITIVE_INFINITY;
    return {
      label: bucket.label,
      tone: bucket.tone,
      count: finals.filter((final) => final >= bucket.min && final < next).length,
    };
  });
}

export type ClassStatsRow = { scores: readonly CriterionScore[]; final: number | null };

export type ClassStats = {
  /** Students in the class. */
  total: number;
  /** Students with a final. */
  evaluated: number;
  notEvaluated: number;
  /** Finals `< 3.00` ("Reprobados"). */
  failed: number;
  /** Half-up mean of the finals, in hundredths. */
  mean: number | null;
  /** Percent of finals `>= 3.00`, one decimal (87.5). */
  passRate: number | null;
  max: number | null;
  min: number | null;
  /** Population standard deviation of the finals in score units, one decimal (1.1). */
  standardDeviation: number | null;
  /** Per criterion, in `criteria` order: half-up mean in hundredths and scored count. */
  criteria: { criterionId: string; mean: number | null; count: number }[];
};

/**
 * Population SD of cents values in tenths of a score, half-up on the exact value:
 * `SD = √(n·Σx² − (Σx)²) / n` hundredths, so tenths = the largest k with
 * `((2k − 1)·10n)² <= 4·(n·Σx² − (Σx)²)`. BigInt keeps the squares exact.
 */
function standardDeviationTenths(values: readonly number[]): number {
  const n = BigInt(values.length);
  let sum = 0n;
  let squares = 0n;
  for (const value of values) {
    sum += BigInt(value);
    squares += BigInt(value) * BigInt(value);
  }
  const fourVariance = 4n * (n * squares - sum * sum);
  const accepts = (k: bigint) => {
    if (k <= 0n) return true;
    const side = (2n * k - 1n) * 10n * n;
    return side * side <= fourVariance;
  };
  // Float estimate, then exact correction.
  let k = BigInt(Math.max(0, Math.round(Math.sqrt(Number(fourVariance)) / (20 * values.length))));
  while (!accepts(k)) k -= 1n;
  while (accepts(k + 1n)) k += 1n;
  return Number(k);
}

/** GRD-07 analytics over one offering × period (rows = the class's active students). */
export function classStats(
  rows: readonly ClassStatsRow[],
  criteria: readonly CriterionWeight[],
): ClassStats {
  const finals = rows.flatMap((row) => (row.final === null ? [] : [row.final]));
  const passed = finals.filter((final) => final >= CENTS.PASSING_GRADE).length;
  const criterionStats = criteria.map((criterion) => {
    const scores = rows.flatMap((row) => {
      const cell = row.scores.find((entry) => entry.criterionId === criterion.id);
      return cell ? [cell.score] : [];
    });
    return { criterionId: criterion.id, mean: meanCents(scores), count: scores.length };
  });
  const evaluated = finals.length;
  return {
    total: rows.length,
    evaluated,
    notEvaluated: rows.length - evaluated,
    failed: evaluated - passed,
    mean: meanCents(finals),
    passRate: evaluated === 0 ? null : divHalfUp(passed * 1000, evaluated) / 10,
    max: evaluated === 0 ? null : Math.max(...finals),
    min: evaluated === 0 ? null : Math.min(...finals),
    standardDeviation: evaluated === 0 ? null : standardDeviationTenths(finals) / 10,
    criteria: criterionStats,
  };
}

/* ------------------------------- Display ------------------------------- */

/** Half-up text of a cents value with one or two decimals ("3.5", "3.45"). */
export function formatScore(cents: number, decimals: 1 | 2): string {
  const scaled = decimals === 2 ? cents : divHalfUp(cents, 10);
  const factor = decimals === 2 ? 100 : 10;
  const units = Math.floor(scaled / factor);
  const fraction = String(scaled % factor).padStart(decimals, "0");
  return `${units}.${fraction}`;
}

/** Sheet cells: one decimal when only one is significant ("4.0"), two otherwise ("3.75"). */
export function formatCellScore(cents: number): string {
  return formatScore(cents, cents % 10 === 0 ? 1 : 2);
}

/** Finals always show two decimals; `-` without a final. */
export function formatFinal(final: number | null): string {
  return final === null ? "-" : formatScore(final, 2);
}
