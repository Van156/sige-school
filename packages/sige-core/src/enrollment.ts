/**
 * Pure enrollment rules (sige/04 SCH-R5, SCH-R7; sige/05 STU-R3). The services load the rows and
 * run the plan inside one transaction; this module only decides what to insert and whether the
 * call is allowed.
 */
import type { StudentStatus } from "./student";

export const ENROLLMENT_STATUSES = ["activa", "cancelada", "retirada"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const FINAL_SCORE_MIN = 1;
export const FINAL_SCORE_MAX = 5;
export const BULK_ENROLLMENT_MAX_STUDENTS = 200;

export const enrollmentMessages = {
  selectCourse: "Debes seleccionar un grado.",
  selectStudents: "Seleccione al menos un estudiante.",
  /** Authored (P4 T1): SCH-R5 refuses non-active students without spec copy. */
  inactiveStudent: "Solo se pueden matricular estudiantes activos.",
  noOfferings: "El grado no tiene materias asignadas.",
  overCapacity: (max: number) => `El grado superaría su capacidad máxima (${max} estudiantes).`,
  /** STU-R3 admission toast: over capacity is a warning there, never a block. */
  admissionOverCapacity: (max: number) =>
    `El grado supera su capacidad máxima (${max} estudiantes).`,
  finalScoreRange: "La nota final debe estar entre 1.0 y 5.0.",
} as const;

export type EnrollmentKey = { studentId: string; offeringId: string; academicYear: string };

export type BulkEnrollmentInput = {
  course: { id: string; campusId: string; academicYear: string; maxStudents: number };
  /** Every offering of the course. */
  offeringIds: readonly string[];
  /** The selected students with their current status and course. */
  students: readonly { id: string; status: StudentStatus; courseId: string | null }[];
  /** Existing enrollments of the selected students (any year; only the course's year counts). */
  existing: readonly EnrollmentKey[];
  /** Active students whose `course_id` is the course right now (D3). */
  currentStudents: number;
  allowOverCapacity?: boolean;
};

export type BulkEnrollmentRefusal = {
  ok: false;
  reason: "no_students" | "inactive_student" | "no_offerings" | "over_capacity";
  message: string;
};

export type BulkEnrollmentPlan = {
  ok: true;
  /** Distinct selected students, in selection order: each moves into the course and campus. */
  students: string[];
  /** `activa` rows to insert (students x offerings minus the existing ones). */
  rows: EnrollmentKey[];
  created: number;
  skipped: number;
  /** Current + newcomers exceed `maxStudents` (only possible with `allowOverCapacity`). */
  overCapacity: boolean;
};

const keyOf = (key: EnrollmentKey) =>
  `${key.studentId}\u0000${key.offeringId}\u0000${key.academicYear}`;

/**
 * SCH-R5 / STU-R3 planner. Refusals, in order: empty selection, any non-active student (the whole
 * call fails), a course without offerings, capacity without override. Capacity counts the current
 * members plus the selected students not already in the course, so re-selecting a member never
 * counts twice (D3). STU-R3 admission passes `allowOverCapacity: true` and reads `overCapacity`.
 */
export function planBulkEnrollment(
  input: BulkEnrollmentInput,
): BulkEnrollmentPlan | BulkEnrollmentRefusal {
  const { course } = input;
  const students = [...new Map(input.students.map((student) => [student.id, student])).values()];
  if (students.length === 0) {
    return { ok: false, reason: "no_students", message: enrollmentMessages.selectStudents };
  }
  if (students.some((student) => student.status !== "activo")) {
    return { ok: false, reason: "inactive_student", message: enrollmentMessages.inactiveStudent };
  }
  const offeringIds = [...new Set(input.offeringIds)];
  if (offeringIds.length === 0) {
    return { ok: false, reason: "no_offerings", message: enrollmentMessages.noOfferings };
  }
  const newcomers = students.filter((student) => student.courseId !== course.id).length;
  const overCapacity = input.currentStudents + newcomers > course.maxStudents;
  if (overCapacity && !input.allowOverCapacity) {
    return {
      ok: false,
      reason: "over_capacity",
      message: enrollmentMessages.overCapacity(course.maxStudents),
    };
  }

  const existing = new Set(input.existing.map(keyOf));
  const rows: EnrollmentKey[] = [];
  let skipped = 0;
  for (const student of students) {
    for (const offeringId of offeringIds) {
      const key = { studentId: student.id, offeringId, academicYear: course.academicYear };
      if (existing.has(keyOf(key))) {
        skipped += 1;
      } else {
        rows.push(key);
      }
    }
  }
  return {
    ok: true,
    students: students.map((student) => student.id),
    rows,
    created: rows.length,
    skipped,
    overCapacity,
  };
}

/** SCH-R7: an enrollment is stale when its course is not the student's current course. */
export function isStale(enrollmentCourseId: string, studentCourseId: string | null): boolean {
  return enrollmentCourseId !== studentCourseId;
}

/** `final_score` is `numeric(3,2)` in 1..5: at most two decimals. */
export function isValidFinalScore(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= FINAL_SCORE_MIN &&
    value <= FINAL_SCORE_MAX &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
  );
}
