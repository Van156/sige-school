import { criteriaStore, gradeStore, periodStore, subjectStore, userStore } from "./admin";
import { INSTITUTION_ID } from "./base";
import { REFERENCE_DATE, addDays } from "./dates";
import { alertStore } from "./engagement";
import { deriveFinals, type FinalRow } from "./finals";
import { attendanceStore, gradeRecordStore } from "./grading";
import { absenceRate, average } from "./helpers";
import { fullName } from "./people";
import { studentStore, subjectGradeStore } from "./school";
import type { AcademicPeriod, AlertType, Attendance, Severity } from "./types";

/**
 * Early-alert rule engine (inventory 2.2 / 3.13). Runs over the live grade and attendance stores
 * and never duplicates an unresolved alert of the same type for a student.
 */

export interface AlertRule {
  type: AlertType;
  label: string;
  condition: string;
  severity: Severity;
}

export const ALERT_RULES: readonly AlertRule[] = [
  {
    type: "riesgo_academico",
    label: "Riesgo Académico",
    condition: "Promedio < 3.0 en cualquier materia",
    severity: "alta",
  },
  {
    type: "tendencia_negativa",
    label: "Tendencia Negativa",
    condition: "Bajó más de 0.5 puntos entre periodos",
    severity: "media",
  },
  {
    type: "inasistencia_critica",
    label: "Inasistencia Crítica",
    condition: "Más del 20% de inasistencias en el mes",
    severity: "media",
  },
  {
    type: "grupo_riesgo",
    label: "Grupo en Riesgo",
    condition: "Más del 30% del grupo pierde con el mismo profesor",
    severity: "alta",
  },
  {
    type: "riesgo_desercion",
    label: "Riesgo de Deserción",
    condition: "Ausencias y notas bajas combinadas",
    severity: "alta",
  },
  {
    type: "mejora_destacable",
    label: "Mejora Destacable",
    condition: "Subió más de 1.0 punto entre periodos",
    severity: "baja",
  },
];

export const ALERT_TYPE_LABEL = Object.fromEntries(
  ALERT_RULES.map((rule) => [rule.type, rule.label]),
) as Record<AlertType, string>;

interface Candidate {
  studentId: number;
  title: string;
  description: string;
}

interface Context {
  activeIds: ReadonlySet<number>;
  finals: FinalRow[];
  current: AcademicPeriod | undefined;
  previous: AcademicPeriod | undefined;
  nameOf: (studentId: number) => string;
  subjectOf: (subjectGradeId: number) => string;
  courseOf: (subjectGradeId: number) => string;
  teacherOf: (subjectGradeId: number) => string;
  recentAttendance: ReadonlyMap<number, ReadonlyArray<Pick<Attendance, "status">>>;
}

const WINDOW_DAYS = 30;
const MIN_SESSIONS = 5;

function buildContext(): Context {
  const students = studentStore.getSnapshot().filter((student) => student.status === "activo");
  const activeIds = new Set(students.map((student) => student.id));
  const criteria = criteriaStore.getSnapshot().filter((c) => c.institutionId === INSTITUTION_ID);
  const finals = deriveFinals(gradeRecordStore.getSnapshot(), criteria).filter((final) =>
    activeIds.has(final.studentId),
  );

  // Rules compare the last closed period with the one before it (P3 vs P2 in the dataset).
  const withFinals = new Set(finals.map((final) => final.periodId));
  const closed = periodStore
    .getSnapshot()
    .filter(
      (period) =>
        period.institutionId === INSTITUTION_ID && !period.isActive && withFinals.has(period.id),
    )
    .sort((a, b) => a.order - b.order);
  const current = closed[closed.length - 1];
  const previous = closed[closed.length - 2];

  const users = new Map(userStore.getSnapshot().map((user) => [user.id, user]));
  const studentUser = new Map(students.map((student) => [student.id, users.get(student.userId)]));
  const subjects = new Map(subjectStore.getSnapshot().map((subject) => [subject.id, subject]));
  const grades = new Map(gradeStore.getSnapshot().map((grade) => [grade.id, grade]));
  const subjectGrades = new Map(subjectGradeStore.getSnapshot().map((item) => [item.id, item]));

  const since = addDays(REFERENCE_DATE, -WINDOW_DAYS);
  const recentAttendance = new Map<number, Array<Pick<Attendance, "status">>>();
  for (const row of attendanceStore.getSnapshot()) {
    if (row.date < since || row.date > REFERENCE_DATE || !activeIds.has(row.studentId)) continue;
    const list = recentAttendance.get(row.studentId);
    if (list) list.push({ status: row.status });
    else recentAttendance.set(row.studentId, [{ status: row.status }]);
  }

  return {
    activeIds,
    finals,
    current,
    previous,
    recentAttendance,
    nameOf: (studentId) => {
      const user = studentUser.get(studentId);
      return user ? fullName(user) : "Estudiante";
    },
    subjectOf: (id) =>
      subjects.get(subjectGrades.get(id)?.subjectId ?? -1)?.name ?? "la asignatura",
    courseOf: (id) => grades.get(subjectGrades.get(id)?.gradeId ?? -1)?.name ?? "el grupo",
    teacherOf: (id) => {
      const teacher = users.get(subjectGrades.get(id)?.teacherId ?? -1);
      return teacher ? fullName(teacher) : "el profesor";
    },
  };
}

function periodAverage(context: Context, studentId: number, period: AcademicPeriod | undefined) {
  if (!period) return null;
  return average(
    context.finals
      .filter((final) => final.studentId === studentId && final.periodId === period.id)
      .map((final) => final.score),
  );
}

function studentsOf(context: Context): number[] {
  return [...context.activeIds];
}

type Rule = (context: Context) => Candidate[];

const RULES: Record<AlertType, Rule> = {
  riesgo_academico: (context) => {
    const { current } = context;
    if (!current) return [];
    return studentsOf(context).flatMap((studentId) => {
      const failing = context.finals
        .filter(
          (final) =>
            final.studentId === studentId && final.periodId === current.id && final.score < 3,
        )
        .sort((a, b) => a.score - b.score)[0];
      if (!failing) return [];
      return [
        {
          studentId,
          title: "Riesgo Académico",
          description: `El estudiante ${context.nameOf(studentId)} tiene nota final de ${failing.score.toFixed(1)} en ${context.subjectOf(failing.subjectGradeId)} durante ${current.name}. La nota está por debajo del mínimo (3.0).`,
        },
      ];
    });
  },

  tendencia_negativa: (context) =>
    studentsOf(context).flatMap((studentId) => {
      const before = periodAverage(context, studentId, context.previous);
      const now = periodAverage(context, studentId, context.current);
      if (before === null || now === null || before - now <= 0.5) return [];
      return [
        {
          studentId,
          title: "Tendencia Negativa",
          description: `El promedio de ${context.nameOf(studentId)} bajó de ${before.toFixed(1)} a ${now.toFixed(1)} entre ${context.previous?.shortName} y ${context.current?.shortName}.`,
        },
      ];
    }),

  inasistencia_critica: (context) =>
    studentsOf(context).flatMap((studentId) => {
      const rows = context.recentAttendance.get(studentId) ?? [];
      const rate = absenceRate(rows);
      if (rows.length < MIN_SESSIONS || rate <= 20) return [];
      return [
        {
          studentId,
          title: "Inasistencia Crítica",
          description: `El estudiante ${context.nameOf(studentId)} acumula ${Math.round(rate)}% de inasistencias en los últimos ${WINDOW_DAYS} días.`,
        },
      ];
    }),

  grupo_riesgo: (context) => {
    const { current } = context;
    if (!current) return [];
    const classes = new Map<number, FinalRow[]>();
    for (const final of context.finals.filter((entry) => entry.periodId === current.id)) {
      classes.set(final.subjectGradeId, [...(classes.get(final.subjectGradeId) ?? []), final]);
    }
    return [...classes.entries()].flatMap(([subjectGradeId, rows]) => {
      const failing = rows.filter((row) => row.score < 3);
      const rate = Math.round((failing.length / rows.length) * 100);
      const lowest = [...rows].sort((a, b) => a.score - b.score)[0];
      if (rows.length < MIN_SESSIONS || rate <= 30 || !lowest) return [];
      const course = context.courseOf(subjectGradeId);
      const subject = context.subjectOf(subjectGradeId);
      return [
        {
          studentId: lowest.studentId,
          title: `Grupo en Riesgo: ${course} ${subject}`,
          description: `El ${rate}% del grupo ${course} perdió ${subject} en el ${current.name} con ${context.teacherOf(subjectGradeId)}.`,
        },
      ];
    });
  },

  riesgo_desercion: (context) =>
    studentsOf(context).flatMap((studentId) => {
      const rows = context.recentAttendance.get(studentId) ?? [];
      const rate = absenceRate(rows);
      const now = periodAverage(context, studentId, context.current);
      if (rows.length < MIN_SESSIONS || rate <= 15 || now === null || now >= 3) return [];
      return [
        {
          studentId,
          title: "Riesgo de Deserción",
          description: `El estudiante ${context.nameOf(studentId)} combina promedio bajo (${now.toFixed(1)}) con ${Math.round(rate)}% de inasistencias en los últimos ${WINDOW_DAYS} días.`,
        },
      ];
    }),

  mejora_destacable: (context) =>
    studentsOf(context).flatMap((studentId) => {
      const before = periodAverage(context, studentId, context.previous);
      const now = periodAverage(context, studentId, context.current);
      if (before === null || now === null || now - before <= 1) return [];
      return [
        {
          studentId,
          title: "Mejora Destacable",
          description: `${context.nameOf(studentId)} subió su promedio de ${before.toFixed(1)} a ${now.toFixed(1)} entre ${context.previous?.shortName} y ${context.current?.shortName}.`,
        },
      ];
    }),
};

/** Runs one rule and stores the alerts it finds; returns how many were created. */
function runWithContext(type: AlertType, context: Context): number {
  const severity = ALERT_RULES.find((rule) => rule.type === type)?.severity ?? "media";
  let created = 0;
  for (const candidate of RULES[type](context)) {
    const duplicated = alertStore
      .getSnapshot()
      .some(
        (alert) =>
          !alert.resolved && alert.studentId === candidate.studentId && alert.alertType === type,
      );
    if (duplicated) continue;
    alertStore.add({
      studentId: candidate.studentId,
      alertType: type,
      severity,
      title: candidate.title,
      description: candidate.description,
      triggeredAt: `${REFERENCE_DATE}T08:00`,
      resolved: false,
    });
    created += 1;
  }
  return created;
}

export function runAlertRule(type: AlertType): number {
  return runWithContext(type, buildContext());
}

export interface AlertRunResult {
  type: AlertType;
  created: number;
}

export function runAllAlertRules(): AlertRunResult[] {
  const context = buildContext();
  return ALERT_RULES.map((rule) => ({
    type: rule.type,
    created: runWithContext(rule.type, context),
  }));
}
