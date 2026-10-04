import {
  annualScore,
  attendanceStore,
  criteriaStore,
  currentUserFor,
  finalScore,
  gradeRecordStore,
  periodLockStore,
  periodStore,
  reportCardObservationStore,
  reportCardStore,
  useMockCollection,
} from "../-mock";
import type { GradeRecord } from "../-mock/types";
import { useRole } from "./use-role";
import type { School } from "./use-school";

export type LockState = "locked" | "open" | "empty";

/**
 * Live, institution-scoped view over the grade, attendance and report-card stores of T4. Final and
 * annual grades are derived here from the criterion records, so every screen stays consistent
 * after an edit.
 */
export function useGrading(institutionId: number) {
  const records = useMockCollection(gradeRecordStore);
  const locks = useMockCollection(periodLockStore);
  const attendance = useMockCollection(attendanceStore);
  const cards = useMockCollection(reportCardStore);
  const cardObservations = useMockCollection(reportCardObservationStore);
  const periodList = useMockCollection(periodStore);
  const criteriaList = useMockCollection(criteriaStore);

  const periods = periodList
    .filter((period) => period.institutionId === institutionId)
    .sort((a, b) => a.order - b.order);
  const criteria = criteriaList
    .filter((criterion) => criterion.institutionId === institutionId)
    .sort((a, b) => a.order - b.order);
  const activePeriod = periods.find((period) => period.isActive) ?? periods[periods.length - 1];

  const byCombo = new Map<string, GradeRecord[]>();
  const byClass = new Map<string, number>();
  for (const record of records) {
    const comboKey = `${record.studentId}:${record.subjectGradeId}:${record.periodId}`;
    byCombo.set(comboKey, [...(byCombo.get(comboKey) ?? []), record]);
    const classKey = `${record.subjectGradeId}:${record.periodId}`;
    byClass.set(classKey, (byClass.get(classKey) ?? 0) + 1);
  }
  const lockOf = new Map(locks.map((lock) => [`${lock.subjectGradeId}:${lock.periodId}`, lock]));

  const recordsOf = (studentId: number, subjectGradeId: number, periodId: number) =>
    byCombo.get(`${studentId}:${subjectGradeId}:${periodId}`) ?? [];

  const finalOf = (studentId: number, subjectGradeId: number, periodId: number) =>
    finalScore(recordsOf(studentId, subjectGradeId, periodId), criteria);

  return {
    periods,
    criteria,
    activePeriod,
    records,
    attendance,
    cards,
    cardObservations,
    periodById: new Map(periods.map((period) => [period.id, period])),
    recordsOf,
    finalOf,
    /** Mean of the period finals that exist (inventory 2.3), `null` without any. */
    annualOf: (studentId: number, subjectGradeId: number) => {
      const finals = periods.flatMap((period) => {
        const score = finalOf(studentId, subjectGradeId, period.id);
        return score === null ? [] : [score];
      });
      return annualScore(finals);
    },
    recordCount: (subjectGradeId: number, periodId: number) =>
      byClass.get(`${subjectGradeId}:${periodId}`) ?? 0,
    lockState: (subjectGradeId: number, periodId: number): LockState => {
      if ((byClass.get(`${subjectGradeId}:${periodId}`) ?? 0) === 0) return "empty";
      return lockOf.get(`${subjectGradeId}:${periodId}`)?.locked ? "locked" : "open";
    },
    isLocked: (subjectGradeId: number, periodId: number) =>
      lockOf.get(`${subjectGradeId}:${periodId}`)?.locked ?? false,
  };
}

export type Grading = ReturnType<typeof useGrading>;

/**
 * Subject-grades the active role may grade or take attendance for: everything for management
 * roles, only the assigned classes for a teacher (legacy "No tienes permiso para esta asignatura").
 */
export function useAccessibleSubjectGrades(school: School) {
  const role = useRole();
  const teacherId = currentUserFor("teacher").id;
  const list =
    role === "teacher"
      ? school.subjectGrades.filter((item) => item.teacherId === teacherId)
      : school.subjectGrades;
  return {
    role,
    list,
    canAccess: (subjectGradeId: number) => list.some((item) => item.id === subjectGradeId),
    /** User recorded as the author of grades and attendance. */
    userId: role === "teacher" ? teacherId : currentUserFor(role).id,
  };
}
