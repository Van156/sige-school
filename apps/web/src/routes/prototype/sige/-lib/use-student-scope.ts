import { currentUserFor } from "../-mock";
import type { AcademicStudent, Role } from "../-mock/types";
import { useRole } from "./use-role";
import type { School } from "./use-school";
import { useIntParam } from "./use-search-params";

export interface StudentScope {
  role: Role;
  /** Students the active role may open: self, linked children, own classes or everyone. */
  allowed: readonly AcademicStudent[];
  /** Student shown by the screen (`?student=`, or the fixed one for student and parent roles). */
  selected: AcademicStudent | undefined;
  /** Staff pick any student; parents switch between their children; students see only themselves. */
  mode: "self" | "children" | "staff";
}

/**
 * Resolves which student a per-student screen (GRD-08, ATT-02, RPT-02/03) shows, honouring the
 * inventory's visibility rules: a student only sees themselves, a parent only their children, a
 * teacher only the courses they teach.
 */
export function useStudentScope(school: School): StudentScope {
  const role = useRole();
  const requested = useIntParam("student");

  if (role === "student") {
    const self = currentUserFor("student");
    const allowed = school.students.filter((student) => student.userId === self.id);
    return { role, allowed, selected: allowed[0], mode: "self" };
  }

  if (role === "parent") {
    const parent = currentUserFor("parent");
    const childIds = new Set(
      school.parentLinks
        .filter((link) => link.parentId === parent.id)
        .map((link) => link.studentId),
    );
    const allowed = school.students.filter((student) => childIds.has(student.id));
    const selected = allowed.find((student) => student.id === requested) ?? allowed[0];
    return { role, allowed, selected, mode: "children" };
  }

  const teacherId = currentUserFor("teacher").id;
  const taughtGrades = new Set(
    school.subjectGrades.filter((item) => item.teacherId === teacherId).map((item) => item.gradeId),
  );
  const allowed =
    role === "teacher"
      ? school.students.filter(
          (student) => student.gradeId !== undefined && taughtGrades.has(student.gradeId),
        )
      : school.students;
  return {
    role,
    allowed,
    selected: allowed.find((student) => student.id === requested),
    mode: "staff",
  };
}
