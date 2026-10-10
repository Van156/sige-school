/**
 * Attendance rules of sige/07 §3, the single source for the roll sheet's live counters, the
 * `attendance.*` procedures, the seed, the metrics and the alert and achievement engines
 * (R3.18, ATT-R10). Nothing here reads the clock: "today", the future check and the Bogotá
 * weekday are the caller's business (`dates.ts`, R3.13).
 *
 * Percentages are rounded with the integer helper of `rules.ts` (D12): the share is computed in
 * tenths of a percent and only divided by ten for display, so no float is ever rounded.
 */
import { SIGE_RULES, divHalfUp } from "./rules";

/** DB enum `attendance_status` (07 §2), in roll-sheet order (ATT-01). */
export const ATTENDANCE_STATUSES = ["presente", "ausente", "justificado", "excusado"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Badge and toggle text of each status (ATT-01, ATT-02 "Estado"). */
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  presente: "Presente",
  ausente: "Ausente",
  justificado: "Justificado",
  excusado: "Excusado",
};

/** Glyph of each status, so the roll toggles and the history badge read alike (07 §6.1). */
export const ATTENDANCE_GLYPH: Record<AttendanceStatus, string> = {
  presente: "✓",
  ausente: "✗",
  justificado: "⚑",
  excusado: "ℹ",
};

/** Badge tone per 07 §6.1: "✓ Presente" green, "✗ Ausente" red, "⚑ Justificado" amber, "ℹ Excusado" blue. */
export const ATTENDANCE_TONE: Record<
  AttendanceStatus,
  "success" | "destructive" | "warning" | "info"
> = {
  presente: "success",
  ausente: "destructive",
  justificado: "warning",
  excusado: "info",
};

/** Absence-rate bands (07 §3); the DB and API type is `AbsenceBand | null` (ATT-R8). */
export const ABSENCE_BANDS = ["critical", "attention", "normal"] as const;
export type AbsenceBand = (typeof ABSENCE_BANDS)[number];

/** Badge text of a band ("Estado" column of ATT-03/ATT-04). */
export const ABSENCE_BAND_LABEL: Record<AbsenceBand, string> = {
  critical: "Crítico",
  attention: "Atención",
  normal: "Normal",
};

/** Badge tone of a band: destructive, warning, success (07 §3). */
export const ABSENCE_BAND_TONE: Record<AbsenceBand, "destructive" | "warning" | "success"> = {
  critical: "destructive",
  attention: "warning",
  normal: "success",
};

/**
 * Verbatim ATT-R1…R9 messages (07 §5), shared by the zod schemas, the services and the web so a
 * string is never retyped. `duplicateStudent` and `tooManyRecords` are authored here: ATT-R2 and
 * 07 §4.1 state the rules ("duplicates in one request rejected", `[1..200]`) without a message.
 */
export const attendanceMessages = {
  /** ATT-R2; the same sentence as the grade sheet's `studentNotInCourse`. */
  studentNotInCourse: "El estudiante no pertenece a este grado.",
  /** ATT-R2 "at least one record" (no final period in the prototype copy). */
  noStudents: "No hay estudiantes para registrar",
  /** ATT-R2 status outside the four values. */
  invalidData: "Datos inválidos",
  /** ATT-R3 missing date. */
  missingData: "Faltan datos requeridos",
  /** ATT-R3 malformed date. */
  invalidDate: "Fecha inválida",
  futureDate: "No se puede registrar asistencia en una fecha futura.",
  /** ATT-R3 weekend (Saturday is a school day only for `Sabatina`). */
  notSchoolDay: "Las clases se dictan de lunes a viernes.",
  observationTooLong: `La observación no puede superar ${SIGE_RULES.ATTENDANCE_OBSERVATION_MAX} caracteres.`,
  /** ATT-R6 inverted range. */
  rangeInverted: "La fecha inicial no puede ser posterior a la final.",
  rangeTooLong: "El rango no puede superar un año.",
  /** 07 §4.1 `attendance.calendar`. */
  invalidMonth: "Mes inválido.",
  /** ATT-R1, the API error of an offering outside the caller's scope. */
  offeringForbidden: "No tienes permiso para esta asignatura.",
  duplicateStudent: "La planilla tiene estudiantes repetidos.",
  tooManyRecords: `No se pueden registrar más de ${SIGE_RULES.ATTENDANCE_MAX_RECORDS} estudiantes a la vez.`,
  /** ATT-R8 badge of a student without records (the percentages show "-"). */
  noRecordsBadge: "Sin registros",
} as const;

export type Tally = { total: number; present: number; absent: number; justified: number };
export type MonthTally = Tally & { month: string };

export type StatusRow = { status: AttendanceStatus };
export type DatedStatusRow = StatusRow & { date: string };
export type StudentStatusRow = StatusRow & { studentId: string };

/** One `byStudent` row; the name is added by the caller (`StudentTally` of 07 §4.1). */
export type StudentTally = Tally & {
  studentId: string;
  attendancePct: number | null;
  absenceRate: number | null;
  band: AbsenceBand | null;
};

/**
 * `{ total, present, absent, justified }` where `absent` counts `ausente` only and `justified`
 * merges `justificado` and `excusado` (07 §3, ATT-R4: both still count as absences for rates).
 */
export function tally(rows: readonly StatusRow[]): Tally {
  let present = 0;
  let absent = 0;
  for (const row of rows) {
    if (row.status === "presente") present += 1;
    else if (row.status === "ausente") absent += 1;
  }
  return { total: rows.length, present, absent, justified: rows.length - present - absent };
}

/** Attendance share in tenths of a percent, rounded half-up on exact integers (D12). */
function attendanceTenths(rows: readonly StatusRow[]): number {
  const present = rows.filter((row) => row.status === "presente").length;
  return divHalfUp(present * 1000, rows.length);
}

/** `present / total × 100` with one decimal, half-up; `100` for no rows (07 §3). */
export function attendancePct(rows: readonly StatusRow[]): number {
  if (rows.length === 0) return 100;
  return attendanceTenths(rows) / 10;
}

/**
 * `100 − attendancePct`: the share of rows whose status is not `presente` (OD-7, ATT-R4), one
 * decimal, half-up; `0` for no rows. It is derived from the attendance share in tenths instead of
 * being rounded on its own, so the pair always sums to 100.0 (1 present of 16 is 6.3 % / 93.7 %;
 * rounding 93.75 % apart would give 93.8 % and a total of 100.1 %).
 */
export function absenceRate(rows: readonly StatusRow[]): number {
  if (rows.length === 0) return 0;
  return (1000 - attendanceTenths(rows)) / 10;
}

/** `> 20` critical, `> 10` attention, else normal; the boundaries are exclusive (07 §3). */
export function absenceBand(rate: number): AbsenceBand {
  if (rate > SIGE_RULES.ABSENCE_CRITICAL) return "critical";
  if (rate > SIGE_RULES.ABSENCE_ATTENTION) return "attention";
  return "normal";
}

/** Counts per `YYYY-MM`, ascending (07 §3; "Desglose Mensual" reverses them). */
export function monthlyTally(rows: readonly DatedStatusRow[]): MonthTally[] {
  const months = new Map<string, StatusRow[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const bucket = months.get(month);
    if (bucket) bucket.push(row);
    else months.set(month, [row]);
  }
  return [...months.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, bucket]) => ({ month, ...tally(bucket) }));
}

/**
 * One tally per student id, in the given order (07 §3). A student without rows keeps `total: 0`
 * and `null` percentages and band, so tables print "-" and the badge "Sin registros" instead of
 * a perfect attendance (ATT-R8). Rows of other students are ignored.
 */
export function byStudent(
  studentIds: readonly string[],
  rows: readonly StudentStatusRow[],
): StudentTally[] {
  const byId = new Map<string, StudentStatusRow[]>();
  for (const row of rows) {
    const bucket = byId.get(row.studentId);
    if (bucket) bucket.push(row);
    else byId.set(row.studentId, [row]);
  }
  return studentIds.map((studentId) => {
    const own = byId.get(studentId) ?? [];
    const counts = tally(own);
    if (own.length === 0) {
      return { studentId, ...counts, attendancePct: null, absenceRate: null, band: null };
    }
    const rate = absenceRate(own);
    return {
      studentId,
      ...counts,
      attendancePct: attendancePct(own),
      absenceRate: rate,
      band: absenceBand(rate),
    };
  });
}

/**
 * Students above the critical threshold (`absenceRate > 20`), highest rate first; students
 * without records are excluded (ATT-R8). Equal rates keep a deterministic order by student id,
 * so the at-risk card and its CSV never shuffle between requests.
 */
export function atRisk(perStudent: readonly StudentTally[]): StudentTally[] {
  return perStudent
    .filter((row) => row.absenceRate !== null && row.absenceRate > SIGE_RULES.ABSENCE_CRITICAL)
    .sort(
      (a, b) =>
        (b.absenceRate ?? 0) - (a.absenceRate ?? 0) ||
        (a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0),
    );
}

/* ------------------------------- Calendar ------------------------------- */

/** ISO weekday numbers, as the DB check `extract(isodow from date) between 1 and 6` reads them. */
export const ISO_WEEKDAY = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
} as const;

/** The only course shift whose classes fall on Saturday (ATT-R3); `course_shift` is text here. */
export const COURSE_SHIFT_SATURDAY = "Sabatina";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CALENDAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MS_PER_DAY = 86_400_000;

/** UTC epoch milliseconds of a `YYYY-MM-DD` day that exists, else `null`. */
function epochOf(date: string): number | null {
  const match = CALENDAR_DATE.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const epoch = Date.UTC(year, month - 1, day);
  const utc = new Date(epoch);
  // Date.UTC rolls 2026-02-29 over to March: compare the parts back.
  const sameDay =
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
  return sameDay ? epoch : null;
}

/** Whether `value` is a `YYYY-MM-DD` calendar day that exists (ATT-R3 "Fecha inválida"). */
export function isCalendarDate(value: string): boolean {
  return epochOf(value) !== null;
}

/** Whether `value` is a `YYYY-MM` month (07 §4.1 `attendance.calendar`, "Mes inválido."). */
export function isCalendarMonth(value: string): boolean {
  return CALENDAR_MONTH.test(value);
}

/**
 * ISO weekday (1 = Monday … 7 = Sunday) of a calendar day, `null` when the day is malformed or
 * does not exist. The parts are read from the text and fed to `Date.UTC`, never to
 * `new Date("YYYY-MM-DD")` plus `getDay()`, which would answer in the server's time zone.
 */
export function isoWeekday(date: string): number | null {
  const epoch = epochOf(date);
  if (epoch === null) return null;
  const sunday0 = new Date(epoch).getUTCDay();
  return sunday0 === 0 ? ISO_WEEKDAY.sunday : sunday0;
}

/**
 * ATT-R3: classes run Monday–Friday for every shift, Saturday only for `Sabatina` and never on
 * Sunday. A malformed day is not a school day; the caller reports "Fecha inválida" first.
 */
export function isSchoolDay(date: string, shift: string): boolean {
  const weekday = isoWeekday(date);
  if (weekday === null) return false;
  if (weekday <= ISO_WEEKDAY.friday) return true;
  return weekday === ISO_WEEKDAY.saturday && shift === COURSE_SHIFT_SATURDAY;
}

/**
 * Days in the inclusive range `from..to` (ATT-R6: at most 366), `0` when `to` precedes `from` and
 * `null` when either end is not a calendar day. Both ends are UTC midnights, so no daylight-saving
 * shift can bend the count.
 */
export function inclusiveDays(from: string, to: string): number | null {
  const start = epochOf(from);
  const end = epochOf(to);
  if (start === null || end === null) return null;
  return end < start ? 0 : (end - start) / MS_PER_DAY + 1;
}
