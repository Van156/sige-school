import {
  PASSING_GRADE,
  average,
  percent,
  performanceLevel,
  round,
  teacherGroupState,
  type FinalRow,
  type TeacherGroupState,
} from "../-mock";
import type {
  AcademicPeriod,
  AcademicStudent,
  Attendance,
  Grade,
  PerformanceLevel,
  Subject,
} from "../-mock/types";
import { monthlyTally, shareOf } from "./class-stats";
import type { Metrics } from "./use-metrics";

/** Pure aggregations over the live finals for the metrics (MET), alert and dashboard screens. */

export interface Summary {
  count: number;
  average: number | null;
  /** Share of finals at or above the passing grade, in percent. */
  passRate: number;
  failed: number;
}

export function summarize(rows: readonly FinalRow[]): Summary {
  const failed = rows.filter((row) => row.score < PASSING_GRADE).length;
  return {
    count: rows.length,
    average: average(rows.map((row) => row.score)),
    passRate: round(percent(rows.length - failed, rows.length), 1),
    failed,
  };
}

/** Last closed period with grades: the reference for "this term" figures (P3 in the dataset). */
export function referencePeriod(metrics: Metrics): AcademicPeriod | undefined {
  const withFinals = new Set(metrics.finals.map((final) => final.periodId));
  const closed = metrics.grading.periods.filter(
    (period) => !period.isActive && withFinals.has(period.id),
  );
  return closed[closed.length - 1] ?? metrics.grading.activePeriod;
}

/* -------------------------------- Students -------------------------------- */

export interface StudentSummary {
  student: AcademicStudent;
  name: string;
  course: string;
  average: number | null;
  /** Subjects whose mean final is below the passing grade. */
  failedSubjects: number;
}

/** Mean final and failed-subject count of every active student over `rows`. */
export function studentSummaries(
  metrics: Metrics,
  rows: readonly FinalRow[] = metrics.finals,
): StudentSummary[] {
  const bySubject = new Map<number, Map<number, number[]>>();
  for (const row of rows) {
    const subjects = bySubject.get(row.studentId) ?? new Map<number, number[]>();
    subjects.set(row.subjectGradeId, [...(subjects.get(row.subjectGradeId) ?? []), row.score]);
    bySubject.set(row.studentId, subjects);
  }
  return metrics.activeStudents.map((student) => {
    const subjects = bySubject.get(student.id);
    const own = rows.filter((row) => row.studentId === student.id);
    const failedSubjects = subjects
      ? [...subjects.values()].filter((scores) => (average(scores) ?? 5) < PASSING_GRADE).length
      : 0;
    return {
      student,
      name: metrics.school.studentName(student.id),
      course: metrics.school.gradeName(student.gradeId) ?? "Sin grado",
      average: average(own.map((row) => row.score)),
      failedSubjects,
    };
  });
}

export function atRisk(summaries: readonly StudentSummary[], threshold = PASSING_GRADE) {
  return summaries.filter((entry) => entry.average !== null && entry.average < threshold);
}

/* ------------------------------ Institution view ----------------------------- */

export interface PerformanceRow {
  id: number;
  label: string;
  sublabel?: string;
  students: number;
  average: number | null;
  passRate: number;
  atRisk: number;
}

function performanceRow(
  metrics: Metrics,
  summaries: readonly StudentSummary[],
  input: { id: number; label: string; sublabel?: string; students: readonly AcademicStudent[] },
): PerformanceRow {
  const ids = new Set(input.students.map((student) => student.id));
  const rows = metrics.finals.filter((final) => ids.has(final.studentId));
  const summary = summarize(rows);
  return {
    id: input.id,
    label: input.label,
    sublabel: input.sublabel,
    students: input.students.length,
    average: summary.average,
    passRate: summary.passRate,
    atRisk: atRisk(summaries.filter((entry) => ids.has(entry.student.id))).length,
  };
}

export function campusPerformance(metrics: Metrics, summaries: readonly StudentSummary[]) {
  return metrics.school.campuses.map((campus) =>
    performanceRow(metrics, summaries, {
      id: campus.id,
      label: campus.name,
      students: metrics.activeStudents.filter((student) => student.campusId === campus.id),
    }),
  );
}

export function gradePerformance(metrics: Metrics, summaries: readonly StudentSummary[]) {
  return metrics.school.grades.map((grade) =>
    performanceRow(metrics, summaries, {
      id: grade.id,
      label: grade.name,
      sublabel: metrics.school.campusName(grade.campusId),
      students: metrics.activeStudents.filter((student) => student.gradeId === grade.id),
    }),
  );
}

/** Mean and pass rate of each course in one period (dashboard bar charts). */
export function groupPerformanceOf(metrics: Metrics, period: AcademicPeriod | undefined) {
  return metrics.school.grades.map((grade) => {
    const classIds = new Set(
      metrics.school.subjectGrades.filter((item) => item.gradeId === grade.id).map((i) => i.id),
    );
    const summary = summarize(
      metrics.finals.filter(
        (final) => final.periodId === period?.id && classIds.has(final.subjectGradeId),
      ),
    );
    return { group: grade.name, average: round(summary.average ?? 0), passRate: summary.passRate };
  });
}

export function absenceCount(rows: readonly Pick<Attendance, "status">[]): number {
  return rows.filter((row) => row.status !== "presente").length;
}

/* ---------------------------------- Heatmap --------------------------------- */

export interface HeatCell {
  grade: Grade;
  subject: Subject;
  total: number;
  failed: number;
  failureRate: number;
  average: number;
}

export function heatmap(metrics: Metrics) {
  const { school } = metrics;
  const subjectIds = new Set(school.subjectGrades.map((item) => item.subjectId));
  const subjects = school.subjects.filter((subject) => subjectIds.has(subject.id));
  const cells = new Map<string, HeatCell>();
  for (const grade of school.grades) {
    for (const subject of subjects) {
      const classIds = new Set(
        school.subjectGrades
          .filter((item) => item.gradeId === grade.id && item.subjectId === subject.id)
          .map((item) => item.id),
      );
      const rows = metrics.finals.filter((final) => classIds.has(final.subjectGradeId));
      if (rows.length === 0) continue;
      const summary = summarize(rows);
      cells.set(`${grade.id}:${subject.id}`, {
        grade,
        subject,
        total: rows.length,
        failed: summary.failed,
        failureRate: Math.round(percent(summary.failed, rows.length)),
        average: round(summary.average ?? 0),
      });
    }
  }
  return { subjects, cells };
}

/** Legend band of a failure rate (0-10 / 10-20 / 20-30 / 30-40 / above 40). */
export const HEAT_BANDS = [
  { max: 10, label: "0-10% (Excelente)", className: "bg-success/70 text-foreground" },
  { max: 20, label: "10-20% (Bueno)", className: "bg-success/30 text-foreground" },
  { max: 30, label: "20-30% (Atención)", className: "bg-warning/40 text-foreground" },
  { max: 40, label: "30-40% (Riesgo)", className: "bg-destructive/40 text-foreground" },
  { max: Infinity, label: "Más de 40% (Crítico)", className: "bg-destructive text-white" },
] as const;

export function heatBand(failureRate: number) {
  return HEAT_BANDS.find((band) => failureRate <= band.max) ?? HEAT_BANDS[HEAT_BANDS.length - 1]!;
}

/* ---------------------------------- Trends ---------------------------------- */

export interface PeriodTrend {
  period: AcademicPeriod;
  average: number;
  passRate: number;
  count: number;
}

export function periodTrends(metrics: Metrics, rows: readonly FinalRow[] = metrics.finals) {
  return metrics.grading.periods.flatMap((period): PeriodTrend[] => {
    const own = rows.filter((row) => row.periodId === period.id);
    if (own.length === 0) return [];
    const summary = summarize(own);
    return [
      {
        period,
        average: round(summary.average ?? 0),
        passRate: summary.passRate,
        count: own.length,
      },
    ];
  });
}

/** Second-half mean of the period averages minus the first-half mean (> 0 mejora, < 0 deterioro). */
export function trendDirection(
  trends: readonly PeriodTrend[],
): "mejora" | "deterioro" | "estabilidad" {
  if (trends.length < 2) return "estabilidad";
  const middle = Math.floor(trends.length / 2);
  const first = average(trends.slice(0, middle).map((entry) => entry.average)) ?? 0;
  const second = average(trends.slice(middle).map((entry) => entry.average)) ?? 0;
  const difference = round(second - first);
  return difference > 0 ? "mejora" : difference < 0 ? "deterioro" : "estabilidad";
}

export function monthlyAttendanceRate(metrics: Metrics) {
  const ids = new Set(metrics.activeStudents.map((student) => student.id));
  const rows = metrics.grading.attendance.filter((row) => ids.has(row.studentId));
  return monthlyTally(rows).map((entry) => ({
    month: entry.month,
    rate: shareOf(entry.present, entry.total),
  }));
}

/* ------------------------------ Teacher comparison ----------------------------- */

export interface TeacherRow {
  letter: string;
  teacherId: number;
  groups: number;
  students: number;
  average: number;
  passRate: number;
  percentile: number;
}

/** Anonymous ranking: teachers get a letter (A, B, C...) ordered by their mean final. */
export function teacherComparison(metrics: Metrics): TeacherRow[] {
  const { school } = metrics;
  const rows = school.teachers.flatMap((teacher) => {
    const classes = school.subjectGrades.filter((item) => item.teacherId === teacher.id);
    const classIds = new Set(classes.map((item) => item.id));
    const own = metrics.finals.filter((final) => classIds.has(final.subjectGradeId));
    const summary = summarize(own);
    if (own.length === 0 || summary.average === null) return [];
    return [
      {
        teacherId: teacher.id,
        groups: classes.length,
        students: new Set(own.map((final) => final.studentId)).size,
        average: round(summary.average),
        passRate: summary.passRate,
      },
    ];
  });
  const ranked = rows.toSorted((a, b) => b.average - a.average);
  return ranked.map((row, index) => ({
    ...row,
    letter: String.fromCharCode(65 + (index % 26)),
    percentile:
      ranked.length === 1
        ? 100
        : Math.round(((ranked.length - 1 - index) / (ranked.length - 1)) * 100),
  }));
}

/* ------------------------------- Teacher detail ------------------------------ */

export interface TeacherClassRow {
  subjectGradeId: number;
  course: string;
  subject: string;
  students: number;
  average: number | null;
  passRate: number | null;
  atRisk: number;
  state: TeacherGroupState;
}

export interface Suggestion {
  id: string;
  subject: string;
  course: string;
  text: string;
  chip: string;
}

export const SCORE_BINS = [
  { label: "Excelente (4.5-5.0)", min: 4.5, color: "var(--success)" },
  { label: "Muy Bien (4.0-4.4)", min: 4, color: "var(--success)" },
  { label: "Bien (3.5-3.9)", min: 3.5, color: "var(--warning)" },
  { label: "Aceptable (3.0-3.4)", min: 3, color: "var(--warning)" },
  { label: "Deficiente (2.5-2.9)", min: 2.5, color: "var(--destructive)" },
  { label: "Bajo (2.0-2.4)", min: 2, color: "var(--destructive)" },
  { label: "Muy Bajo (1.0-1.9)", min: 0, color: "var(--destructive)" },
] as const;

export function teacherOverview(metrics: Metrics, teacherId: number) {
  const { school } = metrics;
  const classes = school.subjectGrades.filter((item) => item.teacherId === teacherId);
  const classIds = new Set(classes.map((item) => item.id));
  const finals = metrics.finals.filter((final) => classIds.has(final.subjectGradeId));
  const overall = summarize(finals);

  const classRows = classes.map((item): TeacherClassRow => {
    const own = finals.filter((final) => final.subjectGradeId === item.id);
    const summary = summarize(own);
    const perStudent = new Map<number, number[]>();
    for (const final of own) {
      perStudent.set(final.studentId, [...(perStudent.get(final.studentId) ?? []), final.score]);
    }
    const risky = [...perStudent.values()].filter(
      (scores) => (average(scores) ?? 5) < PASSING_GRADE,
    );
    return {
      subjectGradeId: item.id,
      course: school.gradeName(item.gradeId) ?? "-",
      subject: school.subjectName(item.subjectId),
      students: metrics.activeStudents.filter((student) => student.gradeId === item.gradeId).length,
      average: summary.average === null ? null : round(summary.average),
      passRate: own.length === 0 ? null : summary.passRate,
      atRisk: risky.length,
      state: teacherGroupState(summary.average ?? 5, own.length === 0 ? 0 : 100 - summary.passRate),
    };
  });

  const suggestions = classRows.flatMap((row): Suggestion[] => {
    if (row.average === null || row.passRate === null) return [];
    const subjectId = classes.find((item) => item.id === row.subjectGradeId)?.subjectId;
    const others = school.subjectGrades.filter(
      (item) => item.subjectId === subjectId && item.teacherId !== teacherId,
    );
    const othersAverage = average(
      metrics.finals
        .filter((final) => others.some((item) => item.id === final.subjectGradeId))
        .map((final) => final.score),
    );
    const chip = `Avg: ${row.average.toFixed(1)} / Pass: ${row.passRate.toFixed(1)}%`;
    const base = { id: String(row.subjectGradeId), subject: row.subject, course: row.course, chip };
    if (row.passRate < 60) {
      return [
        {
          ...base,
          text: `Reforzar temas básicos de ${row.subject}. Se observa una tasa de aprobación crítica (${row.passRate.toFixed(1)}%).`,
        },
      ];
    }
    if (othersAverage !== null && row.average < othersAverage - 0.5) {
      return [
        {
          ...base,
          text: `El rendimiento en ${row.course} es notablemente inferior al promedio de otros grupos en ${row.subject}. Revisar metodología específica.`,
        },
      ];
    }
    if (row.average < 3.5) {
      return [
        {
          ...base,
          text: `Realizar actividades de nivelación preventiva para subir el promedio del grupo (${row.average.toFixed(1)}).`,
        },
      ];
    }
    return [];
  });

  const trend = periodTrends(metrics, finals);
  const distribution = SCORE_BINS.map((bin, index) => {
    const upper = SCORE_BINS[index - 1]?.min ?? Infinity;
    return {
      label: bin.label,
      color: bin.color,
      value: finals.filter((final) => final.score >= bin.min && final.score < upper).length,
    };
  });

  const attendanceRows = metrics.grading.attendance.filter((row) =>
    classIds.has(row.subjectGradeId),
  );
  const summaries = studentSummaries(metrics, finals).filter((entry) =>
    finals.some((final) => final.studentId === entry.student.id),
  );

  return {
    classRows,
    finals,
    overall,
    suggestions,
    trend,
    distribution,
    attendanceRows,
    absences: absenceCount(attendanceRows),
    absenceRate: round(percent(absenceCount(attendanceRows), attendanceRows.length), 1),
    studentsInCharge: new Set(finals.map((final) => final.studentId)).size,
    riskStudents: atRisk(summaries),
    summaries,
  };
}

/* ------------------------ Attendance versus performance ----------------------- */

export type Quadrant = "optimo" | "refuerzo" | "asistencia" | "critico";

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  optimo: "Óptimo",
  refuerzo: "Refuerzo Académico",
  asistencia: "Atención Asistencia",
  critico: "Crítico",
};

export interface ScatterPoint {
  studentId: number;
  name: string;
  course: string;
  attendance: number;
  average: number;
  quadrant: Quadrant;
}

export function quadrantOf(attendance: number, grade: number): Quadrant {
  if (attendance >= 80) return grade >= PASSING_GRADE ? "optimo" : "refuerzo";
  return grade >= PASSING_GRADE ? "asistencia" : "critico";
}

/** Pearson correlation coefficient; `null` with fewer than two points or no variance. */
export function pearson(points: readonly ScatterPoint[]): number | null {
  if (points.length < 2) return null;
  const meanX = average(points.map((point) => point.attendance)) ?? 0;
  const meanY = average(points.map((point) => point.average)) ?? 0;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (const point of points) {
    covariance += (point.attendance - meanX) * (point.average - meanY);
    varianceX += (point.attendance - meanX) ** 2;
    varianceY += (point.average - meanY) ** 2;
  }
  return varianceX === 0 || varianceY === 0 ? null : covariance / Math.sqrt(varianceX * varianceY);
}

export function correlationLabel(r: number | null): string {
  if (r === null) return "Sin datos";
  if (r > 0.7) return "Fuerte positiva";
  if (r > 0.3) return "Moderada positiva";
  if (r > 0) return "Débil positiva";
  if (r > -0.3) return "Débil negativa";
  if (r > -0.7) return "Moderada negativa";
  return "Fuerte negativa";
}

/** Least-squares line through the points, as two endpoints over the attendance range. */
export function regressionSegment(points: readonly ScatterPoint[]) {
  if (points.length < 2) return null;
  const meanX = average(points.map((point) => point.attendance)) ?? 0;
  const meanY = average(points.map((point) => point.average)) ?? 0;
  const varianceX = points.reduce((sum, point) => sum + (point.attendance - meanX) ** 2, 0);
  if (varianceX === 0) return null;
  const slope =
    points.reduce((sum, point) => sum + (point.attendance - meanX) * (point.average - meanY), 0) /
    varianceX;
  const xs = points.map((point) => point.attendance);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const line = (x: number) => Math.min(5, Math.max(1, meanY + slope * (x - meanX)));
  return [
    { x: x1, y: line(x1) },
    { x: x2, y: line(x2) },
  ] as const;
}

export function attendanceVsGrades(metrics: Metrics, teacherId: number): ScatterPoint[] {
  const overview = teacherOverview(metrics, teacherId);
  return overview.summaries.flatMap((entry): ScatterPoint[] => {
    if (entry.average === null) return [];
    const rows = overview.attendanceRows.filter((row) => row.studentId === entry.student.id);
    const attendance =
      rows.length === 0 ? 100 : round(percent(rows.length - absenceCount(rows), rows.length), 1);
    return [
      {
        studentId: entry.student.id,
        name: entry.name,
        course: entry.course,
        attendance,
        average: round(entry.average),
        quadrant: quadrantOf(attendance, entry.average),
      },
    ];
  });
}

/* ------------------------------ Dashboard figures ----------------------------- */

/** Headline counts of an institution, read from the live stores. */
export function schoolCounts(metrics: Metrics) {
  const { school } = metrics;
  return {
    students: metrics.activeStudents.length,
    teachers: school.teachers.length,
    grades: school.grades.length,
    subjects: school.subjects.length,
  };
}

/** Finals of one period grouped by performance level (Superior / Alto / Básico / Bajo). */
export function levelDistribution(metrics: Metrics, period: AcademicPeriod | undefined) {
  const levels: PerformanceLevel[] = ["Superior", "Alto", "Básico", "Bajo"];
  const rows = metrics.finals.filter((final) => final.periodId === period?.id);
  return levels.map((level) => ({
    level,
    count: rows.filter((row) => performanceLevel(row.score) === level).length,
  }));
}

export interface TeacherClassStats {
  subjectGradeId: number;
  subjectName: string;
  subjectCode: string;
  gradeName: string;
  shift: string;
  students: number;
  average: number;
  /** Failing share (percent) of the reference period. */
  failingRate: number;
  state: TeacherGroupState;
}

/** Teacher dashboard rows: mean over the closed periods, failing rate of the latest one. */
export function teacherClassStats(metrics: Metrics, teacherId: number): TeacherClassStats[] {
  const { school } = metrics;
  const reference = referencePeriod(metrics);
  return school.subjectGrades
    .filter((item) => item.teacherId === teacherId)
    .map((item) => {
      const own = metrics.finals.filter(
        (final) =>
          final.subjectGradeId === item.id &&
          (!reference ||
            (metrics.grading.periodById.get(final.periodId)?.order ?? 0) <= reference.order),
      );
      const latest = own.filter((final) => final.periodId === reference?.id);
      const averageScore = round(average(own.map((final) => final.score)) ?? 0);
      const failingRate = Math.round(
        percent(latest.filter((final) => final.score < PASSING_GRADE).length, latest.length),
      );
      const grade = school.gradeById.get(item.gradeId);
      const subject = school.subjectById.get(item.subjectId);
      return {
        subjectGradeId: item.id,
        subjectName: subject?.name ?? "",
        subjectCode: subject?.code ?? "",
        gradeName: grade?.name ?? "",
        shift: grade?.shift ?? "Mañana",
        students: metrics.activeStudents.filter((student) => student.gradeId === item.gradeId)
          .length,
        average: averageScore,
        failingRate,
        state: teacherGroupState(averageScore, failingRate),
      };
    });
}

export interface DashboardSuggestion {
  id: string;
  tone: "warning" | "danger";
  title: string;
  message: string;
  action: string;
}

/** Rule-based "Sugerencias IA" of the teacher dashboard (inventory 2.4). */
export function dashboardSuggestions(rows: readonly TeacherClassStats[]): DashboardSuggestion[] {
  const result: DashboardSuggestion[] = [];
  const bySubject = new Map<string, TeacherClassStats[]>();
  for (const row of rows) {
    bySubject.set(row.subjectCode, [...(bySubject.get(row.subjectCode) ?? []), row]);
  }
  for (const [code, group] of bySubject) {
    if (group.length < 2) continue;
    const sorted = group.toSorted((a, b) => b.average - a.average);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (!best || !worst) continue;
    const gap = round(best.average - worst.average);
    if (gap > 0.7) {
      result.push({
        id: `disparity-${code}`,
        tone: "warning",
        title: `Disparidad en ${code}`,
        message: `Existe una diferencia de ${gap.toFixed(2)} puntos entre ${best.gradeName} y ${worst.gradeName}.`,
        action: `Revisar si el factor jornada (${best.shift} frente a ${worst.shift}) influye en el rendimiento y aplicar técnicas de refuerzo usadas en ${best.gradeName}.`,
      });
    }
  }
  for (const row of rows) {
    if (row.failingRate > 25) {
      result.push({
        id: `risk-${row.subjectGradeId}`,
        tone: "danger",
        title: `Alerta Crítica: ${row.gradeName}`,
        message: `La tasa de reprobación en ${row.subjectName} es del ${row.failingRate}%.`,
        action: "Implementar plan de nivelación inmediato y revisar la carga académica del grupo.",
      });
    }
  }
  return result;
}
