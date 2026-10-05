import { deriveFinals } from "../-mock";
import { useGrading } from "./use-grading";
import { useSchool } from "./use-school";

/**
 * Live data every metrics, alert and dashboard view starts from: the institution-scoped school and
 * grading views plus the period finals of the active students, derived from the criterion records
 * (inventory 2.3) so each grade edit shows up everywhere.
 */
export function useMetrics(institutionId: number) {
  const school = useSchool(institutionId);
  const grading = useGrading(institutionId);
  const activeStudents = school.students.filter((student) => student.status === "activo");
  const activeIds = new Set(activeStudents.map((student) => student.id));
  const finals = deriveFinals(grading.records, grading.criteria).filter((final) =>
    activeIds.has(final.studentId),
  );
  return { school, grading, activeStudents, finals };
}

export type Metrics = ReturnType<typeof useMetrics>;
