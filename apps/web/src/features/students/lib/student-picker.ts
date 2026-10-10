import type { Option } from "@/shared/lib/data-table/types";

import type { PickedStudent, StudentPickerMode } from "../types";

/**
 * The student a per-student screen shows (sige/05 §3.1 "the web resolves the default"): a student
 * sees themselves, a parent the requested child or else the first one, staff only the requested
 * student (nothing until they choose). A requested id outside `students` (out of scope, stale URL)
 * is ignored.
 */
export function resolvePickedStudent(
  mode: StudentPickerMode,
  students: readonly PickedStudent[],
  requestedId: string | undefined,
): PickedStudent | undefined {
  const requested =
    requestedId === undefined ? undefined : students.find((student) => student.id === requestedId);
  switch (mode) {
    case "self":
      return students[0];
    case "children":
      return requested ?? students[0];
    case "staff":
      return requested;
  }
}

/** The staff switcher's "Filtrar estudiantes por grado" choices: the courses of `students`, by name. */
export function pickedCourseOptions(students: readonly PickedStudent[]): Option[] {
  const courses = new Map<string, string>();
  for (const student of students) {
    if (student.courseId !== null && student.courseName !== null) {
      courses.set(student.courseId, student.courseName);
    }
  }
  return [...courses]
    .map(([value, label]) => ({ value, label }))
    .toSorted((a, b) => a.label.localeCompare(b.label, "es"));
}

/** The students of one course, or all of them when no course is chosen (`""`). */
export function studentsOfCourse(
  students: readonly PickedStudent[],
  courseId: string,
): readonly PickedStudent[] {
  return courseId === "" ? students : students.filter((student) => student.courseId === courseId);
}
