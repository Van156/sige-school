import {
  INSTITUTION_ID,
  campuses,
  classrooms,
  grades,
  institutions,
  periods,
  scheduleBlocks,
  stubInstitutionSummaries,
  subjects,
} from "./base";
import {
  gradeById,
  schedules,
  subjectById,
  subjectGradeById,
  subjectGrades,
  finalGrades,
} from "./academics";
import { average, percent, performanceLevel, round, teacherGroupState } from "./helpers";
import { alerts, observations } from "./records";
import { fullName, parentStudents, studentById, students, userById, users } from "./people";
import type {
  DayOfWeek,
  FinalGrade,
  InstitutionSummary,
  Observation,
  PerformanceLevel,
  SubjectGrade,
  User,
} from "./types";

/** Read-only derived views used by several screens. Pure functions over the static dataset. */

export const institution =
  institutions.find((entry) => entry.id === INSTITUTION_ID) ?? institutions[0]!;

export const activeStudents = students.filter((student) => student.status === "activo");

export const mainCampus = campuses.find((campus) => campus.isMainCampus) ?? campuses[0]!;

export function institutionCounts() {
  const staff = (role: User["role"]) => users.filter((user) => user.role === role).length;
  return {
    students: activeStudents.length,
    teachers: staff("teacher"),
    admins: staff("admin"),
    coordinators: staff("coordinator"),
    grades: grades.length,
    subjects: subjects.length,
    campuses: campuses.length,
    users: users.filter((user) => user.role !== "root").length,
  };
}

/** One summary per institution: San José computed from the dataset, the rest static. */
export function institutionSummaries(): InstitutionSummary[] {
  const counts = institutionCounts();
  return [
    {
      institutionId: INSTITUTION_ID,
      admins: counts.admins,
      campuses: counts.campuses,
      teachers: counts.teachers,
      students: counts.students,
      users: counts.users,
    },
    ...stubInstitutionSummaries,
  ];
}

export function globalCounts() {
  const summaries = institutionSummaries();
  const sum = (pick: (summary: InstitutionSummary) => number) =>
    summaries.reduce((total, summary) => total + pick(summary), 0);
  return {
    institutions: institutions.length,
    users: sum((summary) => summary.users),
    students: sum((summary) => summary.students),
    teachers: sum((summary) => summary.teachers),
    admins: sum((summary) => summary.admins),
  };
}

function finalsOfPeriod(order: number): FinalGrade[] {
  return finalGrades.filter((final) => final.periodId === order);
}

/** Institutional mean by period (P4 only covers the criteria graded so far). */
export function averageByPeriod() {
  return periods.map((period) => ({
    period: period.shortName,
    average: round(average(finalsOfPeriod(period.order).map((final) => final.finalScore)) ?? 0),
    partial: period.isActive,
  }));
}

export function performanceDistribution(periodOrder: number) {
  const levels: PerformanceLevel[] = ["Superior", "Alto", "Básico", "Bajo"];
  const finals = finalsOfPeriod(periodOrder);
  return levels.map((level) => ({
    level,
    count: finals.filter((final) => performanceLevel(final.finalScore) === level).length,
  }));
}

export function groupPerformance(periodOrder: number) {
  return grades.map((grade) => {
    const ids = new Set(
      subjectGrades.filter((item) => item.gradeId === grade.id).map((item) => item.id),
    );
    const finals = finalsOfPeriod(periodOrder).filter((final) => ids.has(final.subjectGradeId));
    return {
      group: grade.name,
      average: round(average(finals.map((final) => final.finalScore)) ?? 0),
      passRate: round(
        percent(finals.filter((final) => final.finalScore >= 3).length, finals.length),
        0,
      ),
    };
  });
}

export function recentObservations(limit: number): Observation[] {
  return [...observations].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export function openAlertCount(): number {
  return alerts.filter((alert) => !alert.resolved).length;
}

export function studentCountOfGrade(gradeId: number): number {
  return activeStudents.filter((student) => student.gradeId === gradeId).length;
}

/* ------------------------------- Teacher ------------------------------- */

/** Latest closed period: the reference for failing rates and risk alerts. */
const LAST_CLOSED_PERIOD = 3;

export function teacherSubjectGrades(teacherId: number): SubjectGrade[] {
  return subjectGrades.filter((item) => item.teacherId === teacherId);
}

export function teacherAnalytics(teacherId: number) {
  return teacherSubjectGrades(teacherId).map((item) => {
    const finals = finalGrades.filter(
      (final) => final.subjectGradeId === item.id && final.periodId <= LAST_CLOSED_PERIOD,
    );
    const latest = finals.filter((final) => final.periodId === LAST_CLOSED_PERIOD);
    const averageScore = round(average(finals.map((final) => final.finalScore)) ?? 0);
    const failingRate = Math.round(
      percent(latest.filter((final) => final.finalScore < 3).length, latest.length),
    );
    const grade = gradeById.get(item.gradeId);
    const subject = subjectById.get(item.subjectId);
    return {
      subjectGradeId: item.id,
      subjectName: subject?.name ?? "",
      subjectCode: subject?.code ?? "",
      gradeName: grade?.name ?? "",
      shift: grade?.shift ?? "Mañana",
      students: studentCountOfGrade(item.gradeId),
      average: averageScore,
      failingRate,
      state: teacherGroupState(averageScore, failingRate),
    };
  });
}

export interface TeacherSuggestion {
  id: string;
  tone: "warning" | "danger";
  title: string;
  message: string;
  action: string;
}

/** Rule-based "Sugerencias IA" (inventory 2.4). */
export function teacherSuggestions(teacherId: number): TeacherSuggestion[] {
  const rows = teacherAnalytics(teacherId);
  const result: TeacherSuggestion[] = [];

  const bySubject = new Map<string, typeof rows>();
  for (const row of rows) {
    bySubject.set(row.subjectCode, [...(bySubject.get(row.subjectCode) ?? []), row]);
  }
  for (const [code, group] of bySubject) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => b.average - a.average);
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
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

/* ------------------------------- Student ------------------------------- */

export function studentLatestFinals(studentId: number, periodOrder: number) {
  return finalGrades
    .filter((final) => final.studentId === studentId && final.periodId === periodOrder)
    .map((final) => ({
      subjectGradeId: final.subjectGradeId,
      subject:
        subjectById.get(subjectGradeById.get(final.subjectGradeId)?.subjectId ?? -1)?.name ?? "",
      code:
        subjectById.get(subjectGradeById.get(final.subjectGradeId)?.subjectId ?? -1)?.code ?? "",
      score: final.finalScore,
      status: final.status,
    }));
}

export interface ScheduleCell {
  subject: string;
  teacher: string;
  classroom: string;
}

export interface ScheduleRow {
  blockId: number;
  label: string;
  isBreak: boolean;
  /** One entry per weekday (Monday-Friday); `null` when the slot is empty. */
  cells: Array<ScheduleCell | null>;
}

/** Weekly grid of a group: rows are the campus/shift time blocks (breaks included). */
export function groupWeeklySchedule(gradeId: number): ScheduleRow[] {
  const grade = gradeById.get(gradeId);
  if (!grade) return [];
  const blocks = scheduleBlocks
    .filter((block) => block.campusId === grade.campusId && block.shift === grade.shift)
    .sort((a, b) => a.orderNum - b.orderNum);
  const groupSchedules = schedules.filter(
    (schedule) => subjectGradeById.get(schedule.subjectGradeId)?.gradeId === gradeId,
  );
  return blocks.map((block) => ({
    blockId: block.id,
    label: `${block.startTime} - ${block.endTime}`,
    isBreak: block.isBreak,
    cells: ([0, 1, 2, 3, 4] as DayOfWeek[]).map((day) => {
      const slot = groupSchedules.find(
        (schedule) => schedule.dayOfWeek === day && schedule.startTime === block.startTime,
      );
      if (!slot) return null;
      const item = subjectGradeById.get(slot.subjectGradeId);
      const teacher = item ? userById.get(item.teacherId) : undefined;
      return {
        subject: subjectById.get(item?.subjectId ?? -1)?.name ?? "",
        teacher: teacher?.firstName ?? "",
        classroom: classrooms.find((room) => room.id === slot.classroomId)?.name ?? "",
      };
    }),
  }));
}

/* -------------------------------- Parent ------------------------------- */

export function childrenOf(parentUserId: number) {
  return parentStudents
    .filter((link) => link.parentId === parentUserId)
    .flatMap((link) => {
      const student = studentById.get(link.studentId);
      const user = student ? userById.get(student.userId) : undefined;
      if (!student || !user) return [];
      return [
        {
          studentId: student.id,
          name: fullName(user),
          grade: gradeById.get(student.gradeId ?? -1)?.name ?? "Sin grado",
          document: `${user.documentType} ${user.documentNumber}`,
          relationship: link.relationship,
        },
      ];
    });
}
