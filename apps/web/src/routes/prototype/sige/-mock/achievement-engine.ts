import { criteriaStore, periodStore } from "./admin";
import { INSTITUTION_ID } from "./base";
import { REFERENCE_DATE } from "./dates";
import { achievementStore, observationStore, studentAchievementStore } from "./engagement";
import { deriveFinals, type FinalRow } from "./finals";
import { attendanceStore, gradeRecordStore } from "./grading";
import { average } from "./helpers";
import { studentStore } from "./school";
import type { AcademicPeriod } from "./types";

/**
 * Achievement engine (inventory 2.2 / F10): scans the closed periods of the live grade,
 * attendance and observation stores and awards the seven rule-based achievements, never twice for
 * the same student, achievement and period.
 */

export type AwardResult = { ok: true } | { ok: false; reason: string };

export function awardAchievement(input: {
  studentId: number;
  achievementId: number;
  periodId?: number;
  awardedBy?: number;
}): AwardResult {
  const duplicated = studentAchievementStore
    .getSnapshot()
    .some(
      (row) =>
        row.studentId === input.studentId &&
        row.achievementId === input.achievementId &&
        row.periodId === input.periodId,
    );
  if (duplicated) {
    return { ok: false, reason: "El estudiante ya tiene este logro para el periodo seleccionado." };
  }
  const period = periodStore.getSnapshot().find((entry) => entry.id === input.periodId);
  studentAchievementStore.add({
    studentId: input.studentId,
    achievementId: input.achievementId,
    periodId: input.periodId,
    awardedBy: input.awardedBy,
    earnedAt: period?.endDate ?? REFERENCE_DATE,
  });
  return { ok: true };
}

interface StudentData {
  finals: FinalRow[];
  periodAverage: (period: AcademicPeriod) => number | null;
}

function dataOf(studentId: number, allFinals: readonly FinalRow[]): StudentData {
  const finals = allFinals.filter((final) => final.studentId === studentId);
  return {
    finals,
    periodAverage: (period) =>
      average(finals.filter((final) => final.periodId === period.id).map((final) => final.score)),
  };
}

/** Rule keys that hold for one student in one period (`index` is the period's closed position). */
function earnedKeys(input: {
  studentId: number;
  periods: readonly AcademicPeriod[];
  index: number;
  data: StudentData;
}): string[] {
  const { studentId, periods, index, data } = input;
  const period = periods[index];
  if (!period) return [];
  const keys: string[] = [];
  const now = data.periodAverage(period);
  const own = data.finals.filter((final) => final.periodId === period.id);
  if (now === null || own.length === 0) return keys;

  if (now >= 4.5) keys.push("excelencia");
  if (own.length >= 3 && own.every((final) => final.score >= 3)) keys.push("todo_terreno");

  const previousPeriod = periods[index - 1];
  const before = previousPeriod ? data.periodAverage(previousPeriod) : null;
  if (before !== null && now - before >= 1) keys.push("superador");
  if (previousPeriod) {
    const recovered = own.some((final) => {
      if (final.score < 3) return false;
      const earlier = data.finals.find(
        (row) => row.periodId === previousPeriod.id && row.subjectGradeId === final.subjectGradeId,
      );
      return earlier !== undefined && earlier.score < 3;
    });
    if (recovered) keys.push("resiliente");
  }

  const window = periods.slice(Math.max(0, index - 2), index + 1).map(data.periodAverage);
  if (window.length === 3 && window.every((value) => value !== null && value >= 4)) {
    keys.push("constancia");
  }

  const sessions = attendanceStore
    .getSnapshot()
    .filter(
      (row) =>
        row.studentId === studentId && row.date >= period.startDate && row.date <= period.endDate,
    );
  if (sessions.length >= 5 && sessions.every((row) => row.status === "presente")) {
    keys.push("asistencia_perfecta");
  }

  const praised = observationStore
    .getSnapshot()
    .some(
      (row) =>
        row.studentId === studentId &&
        row.type === "positiva" &&
        row.date.slice(0, 10) >= period.startDate &&
        row.date.slice(0, 10) <= period.endDate,
    );
  if (praised) keys.push("companero");
  return keys;
}

/** Awards every satisfied rule for one student, or for all active students; returns the count. */
export function runAchievementEngine(studentId?: number): number {
  const criteria = criteriaStore.getSnapshot().filter((c) => c.institutionId === INSTITUTION_ID);
  const finals = deriveFinals(gradeRecordStore.getSnapshot(), criteria);
  const withFinals = new Set(finals.map((final) => final.periodId));
  const periods = periodStore
    .getSnapshot()
    .filter(
      (period) =>
        period.institutionId === INSTITUTION_ID && !period.isActive && withFinals.has(period.id),
    )
    .sort((a, b) => a.order - b.order);
  const catalog = new Map(
    achievementStore
      .getSnapshot()
      .filter((item) => item.isActive)
      .map((item) => [item.criteria, item.id]),
  );

  const students = studentStore
    .getSnapshot()
    .filter(
      (student) =>
        student.status === "activo" && (studentId === undefined || student.id === studentId),
    );

  let awarded = 0;
  for (const student of students) {
    const data = dataOf(student.id, finals);
    periods.forEach((period, index) => {
      for (const key of earnedKeys({ studentId: student.id, periods, index, data })) {
        const achievementId = catalog.get(key);
        if (achievementId === undefined) continue;
        const result = awardAchievement({
          studentId: student.id,
          achievementId,
          periodId: period.id,
        });
        if (result.ok) awarded += 1;
      }
    });
  }
  return awarded;
}
