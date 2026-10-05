import { currentUserFor } from "../-mock";
import type { User } from "../-mock/types";
import { useRole } from "./use-role";
import type { School } from "./use-school";
import { useIntParam } from "./use-search-params";

export interface TeacherScope {
  /** Teacher whose figures the screen shows; `undefined` when the institution has none. */
  teacherId: number | undefined;
  teachers: readonly User[];
  /** Management roles pick any teacher (`?teacher=`); a teacher only sees themselves. */
  canSwitch: boolean;
}

/** Resolves the teacher analysed by MET-05 / MET-06 and MET-07's scope. */
export function useTeacherScope(school: School): TeacherScope {
  const role = useRole();
  const requested = useIntParam("teacher");
  const own = currentUserFor("teacher");

  if (role === "teacher") return { teacherId: own.id, teachers: [own], canSwitch: false };

  const teachers = school.teachers
    .filter((teacher) => school.subjectGrades.some((item) => item.teacherId === teacher.id))
    .toSorted((a, b) => a.lastName.localeCompare(b.lastName, "es"));
  const selected = teachers.find((teacher) => teacher.id === requested) ?? teachers[0];
  return { teacherId: selected?.id, teachers, canSwitch: true };
}
