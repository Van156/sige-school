import type { CheckItem } from "@/shared/components/form/check-list";
import type { Option } from "@/shared/lib/data-table/types";

/** A row of `course.options` (sige/02 §3.3), as far as the offering screens use it. */
export type CourseChoice = { id: string; name: string; campusId: string; shift: string };

/** A row of `subject.list` (sige/02 §3.3). */
export type SubjectChoice = { id: string; name: string; code: string | null };

/** A row of `user.options` with `role: "teacher"` (sige/03 §3). */
export type TeacherChoice = { personId: string; name: string };

/** The list's "Filtrar por grado" choices. */
export function courseFilterOptions(courses: readonly CourseChoice[]): Option[] {
  return courses.map((course) => ({ value: course.id, label: course.name }));
}

/** The list's "Filtrar por materia" choices. */
export function subjectFilterOptions(subjects: readonly SubjectChoice[]): Option[] {
  return subjects.map((subject) => ({ value: subject.id, label: subject.name }));
}

/**
 * SCH-06 "Grados" rows with the hint "{sede} · {jornada}". A campus missing from `campusNames`
 * (an inactive one is not offered by `campus.options`) leaves just the jornada.
 */
export function courseCheckItems(
  courses: readonly CourseChoice[],
  campusNames: ReadonlyMap<string, string>,
): CheckItem[] {
  return courses.map((course) => {
    const campus = campusNames.get(course.campusId);
    return {
      value: course.id,
      label: course.name,
      hint: campus ? `${campus} · ${course.shift}` : course.shift,
    };
  });
}

/** SCH-06 "Materias" rows with the subject code as hint. */
export function subjectCheckItems(subjects: readonly SubjectChoice[]): CheckItem[] {
  return subjects.map((subject) => ({
    value: subject.id,
    label: subject.name,
    hint: subject.code ?? undefined,
  }));
}

/** SCH-06 "Profesor (opcional)" select choices. */
export function teacherOptions(teachers: readonly TeacherChoice[]): Option[] {
  return teachers.map((teacher) => ({ value: teacher.personId, label: teacher.name }));
}
