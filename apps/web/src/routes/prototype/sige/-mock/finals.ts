import { finalScore } from "./helpers";
import type { GradeCriteria, GradeRecord } from "./types";

/** One derived period final: student x subject-grade x period (inventory 2.3). */
export interface FinalRow {
  studentId: number;
  subjectGradeId: number;
  periodId: number;
  score: number;
}

/**
 * Period finals computed from the criterion records. Final grades are never stored in the
 * prototype, so the metrics, the alert engine and the dashboards all derive them through here and
 * stay consistent with every grade edit.
 */
export function deriveFinals(
  records: readonly GradeRecord[],
  criteria: readonly GradeCriteria[],
): FinalRow[] {
  const groups = new Map<string, GradeRecord[]>();
  for (const record of records) {
    const key = `${record.studentId}:${record.subjectGradeId}:${record.periodId}`;
    const list = groups.get(key);
    if (list) list.push(record);
    else groups.set(key, [record]);
  }
  return [...groups.values()].flatMap((list) => {
    const first = list[0];
    const score = finalScore(list, criteria);
    if (!first || score === null) return [];
    return [
      {
        studentId: first.studentId,
        subjectGradeId: first.subjectGradeId,
        periodId: first.periodId,
        score,
      },
    ];
  });
}
