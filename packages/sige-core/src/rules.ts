/**
 * Grading constants and exact decimal arithmetic (foundation §5.4/§5.5 R2.17, sige/06 §3).
 *
 * Scores travel as integer hundredths ("cents": 4.25 -> 425) and criterion weights as hundredths
 * of a percent (20.00 -> 2000). Values are parsed from their decimal text, never through float
 * multiplication, so the sheet, the server, the seed and the metrics agree bit for bit (G-GRD-2:
 * `2.995 * 100` is `299.4999…` in binary floating point).
 */

export const SIGE_RULES = {
  /** Grading scale (OD-9: fixed, not institution-configurable). */
  SCORE_MIN: 1,
  SCORE_MAX: 5,
  SCORE_DECIMALS: 2,
  /** `>= 3.0` ganada / aprobado. */
  PASSING_GRADE: 3,
  GOOD: 4,
  EXCELLENCE: 4.5,
  /** `scoreClass` lower bound of "risk" (below is "critical"). */
  RISK: 2,
  /** Contiguous performance levels: `>= 4.6` Superior, `>= 4.0` Alto, `>= 3.0` Básico. */
  LEVEL_SUPERIOR: 4.6,
  LEVEL_ALTO: 4,
  LEVEL_BASICO: 3,
  /** `grade_record.observation` length (GRD-R2). */
  GRADE_OBSERVATION_MAX: 500,
  /** `grade.saveSheet` cells per request and `grade.import` rows per file (06 §4.1). */
  SHEET_MAX_CELLS: 2000,
  GRADE_IMPORT_MAX_ROWS: 2000,
  /** Attendance rows or finals before an attendance, group or achievement rule fires. */
  MIN_SAMPLE_ROWS: 5,
  /** The same thresholds in integer hundredths, for comparisons on rounded finals. */
  CENTS: {
    SCORE_MIN: 100,
    SCORE_MAX: 500,
    PASSING_GRADE: 300,
    GOOD: 400,
    EXCELLENCE: 450,
    RISK: 200,
    LEVEL_SUPERIOR: 460,
    LEVEL_ALTO: 400,
    LEVEL_BASICO: 300,
  },
} as const;

/** Verbatim GRD-R2 / GRD-R3 messages shared by the schemas, the sheet and the import. */
export const gradeMessages = {
  scoreRange: "La nota debe estar entre 1.0 y 5.0.",
  observationTooLong: "La observación no puede superar 500 caracteres.",
  observationWithoutScore: "No se puede guardar una observación sin nota.",
  /** Client toast for invalid cells (title + body). */
  invalidCellsTitle: "Hay notas fuera de rango",
  invalidCellsBody: "Las notas deben estar entre 1.0 y 5.0.",
  studentNotInCourse: "El estudiante no pertenece a este grado.",
} as const;

function assertNonNegativeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer, got ${value}`);
  }
}

/**
 * `numerator / denominator` rounded half-up, for non-negative integers: the integer division of
 * `2·num + den` by `2·den`. Exact: no float division is involved.
 */
export function divHalfUp(numerator: number, denominator: number): number {
  assertNonNegativeInteger(numerator, "numerator");
  assertNonNegativeInteger(denominator, "denominator");
  if (denominator === 0) throw new RangeError("denominator must be positive");
  const dividend = 2 * numerator + denominator;
  const divisor = 2 * denominator;
  if (!Number.isSafeInteger(dividend) || !Number.isSafeInteger(divisor)) {
    throw new RangeError("operands overflow the safe integer range");
  }
  return (dividend - (dividend % divisor)) / divisor;
}

/** Half-up rounding of the exact rational `numerator / denominator` (06 §3). */
export const roundHalfUp = divHalfUp;

const DECIMAL = /^(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Exact hundredths of a non-negative decimal text with at most two decimals ("4.25" -> 425,
 * "20.00" -> 2000, "3,5" -> 350). Surrounding blanks are ignored; anything else is `null`.
 */
export function parseCents(text: string): number | null {
  const match = DECIMAL.exec(text.trim());
  if (!match) return null;
  const units = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const cents = units * 100 + Number(fraction);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Cents of a JSON number through its shortest decimal form (4.25 -> 425; 2.995 -> null). */
export function centsFromNumber(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  return parseCents(String(value));
}

/** The JS number of a cents value (425 -> 4.25), for API outputs and charts. */
export function centsToNumber(cents: number): number {
  return cents / 100;
}

export function isScoreCents(cents: number): boolean {
  return (
    Number.isInteger(cents) &&
    cents >= SIGE_RULES.CENTS.SCORE_MIN &&
    cents <= SIGE_RULES.CENTS.SCORE_MAX
  );
}

export type ParsedScore =
  | { status: "empty" }
  | { status: "valid"; cents: number }
  | { status: "invalid"; message: string };

/**
 * GRD-R2 cell parser shared by the sheet, the server and the import: `.` or `,`, up to two
 * decimals, 1.00–5.00; blank is "no grade"; anything else is invalid.
 */
export function parseScore(text: string): ParsedScore {
  if (text.trim() === "") return { status: "empty" };
  const cents = parseCents(text);
  if (cents === null || !isScoreCents(cents)) {
    return { status: "invalid", message: gradeMessages.scoreRange };
  }
  return { status: "valid", cents };
}

/** Criterion weight `numeric(5,2)` in (0, 100] as hundredths of a percent, else `null`. */
export function parseWeight(text: string): number | null {
  const cents = parseCents(text);
  return cents !== null && cents > 0 && cents <= 10000 ? cents : null;
}
