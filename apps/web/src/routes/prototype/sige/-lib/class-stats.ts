import { absenceRate, attendancePercentage, round } from "../-mock";
import type { Attendance, AttendanceStatus } from "../-mock/types";

/** Pure aggregations shared by the grade summary (GRD-07) and the attendance screens (ATT-02..04). */

/* --------------------------------- Grades --------------------------------- */

export interface ScoreBucket {
  label: string;
  value: number;
  color: string;
}

const BUCKETS: ReadonlyArray<{ label: string; min: number; max: number; color: string }> = [
  { label: "1.0-1.9", min: 1, max: 2, color: "var(--destructive)" },
  { label: "2.0-2.9", min: 2, max: 3, color: "var(--warning)" },
  { label: "3.0-3.9", min: 3, max: 4, color: "var(--info)" },
  { label: "4.0-4.9", min: 4, max: 5, color: "var(--success)" },
  { label: "5.0", min: 5, max: Number.POSITIVE_INFINITY, color: "var(--chart-1)" },
];

/** Histogram of final scores in the legacy buckets (1.0-1.9 ... 5.0). */
export function scoreDistribution(scores: readonly number[]): ScoreBucket[] {
  return BUCKETS.map((bucket) => ({
    label: bucket.label,
    color: bucket.color,
    value: scores.filter((score) => score >= bucket.min && score < bucket.max).length,
  }));
}

export function standardDeviation(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/* ------------------------------- Attendance ------------------------------- */

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "presente",
  "ausente",
  "justificado",
  "excusado",
];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  presente: "Presente",
  ausente: "Ausente",
  justificado: "Justificado",
  excusado: "Excusado",
};

export interface AttendanceTally {
  total: number;
  present: number;
  absent: number;
  /** "justificado" plus "excusado" (legacy groups both as justified in charts and KPIs). */
  justified: number;
}

export function tally(rows: readonly Pick<Attendance, "status">[]): AttendanceTally {
  const present = rows.filter((row) => row.status === "presente").length;
  const absent = rows.filter((row) => row.status === "ausente").length;
  return { total: rows.length, present, absent, justified: rows.length - present - absent };
}

export function shareOf(part: number, total: number): number {
  return total === 0 ? 0 : round((part / total) * 100, 1);
}

export interface MonthTally extends AttendanceTally {
  month: string;
}

/** Counts per `YYYY-MM`, oldest first. */
export function monthlyTally(rows: readonly Pick<Attendance, "status" | "date">[]): MonthTally[] {
  const months = new Map<string, Pick<Attendance, "status" | "date">[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), row]);
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => ({ month, ...tally(list) }));
}

export interface StudentAttendanceRow extends AttendanceTally {
  studentId: number;
  presentRate: number;
  absentRate: number;
}

/** One summary row per student id over `rows` (students without records show 100% attendance). */
export function attendanceByStudent(
  studentIds: readonly number[],
  rows: readonly Pick<Attendance, "status" | "studentId">[],
): StudentAttendanceRow[] {
  return studentIds.map((studentId) => {
    const own = rows.filter((row) => row.studentId === studentId);
    return {
      studentId,
      ...tally(own),
      presentRate: attendancePercentage(own),
      absentRate: absenceRate(own),
    };
  });
}

export const MONTH_NAMES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

/** `2026-09` -> `sep 2026`. */
export function monthLabel(month: string): string {
  const [year, number] = month.split("-");
  return `${MONTH_NAMES[Number(number) - 1] ?? number} ${year}`;
}
