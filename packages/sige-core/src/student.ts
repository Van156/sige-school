/**
 * Pure student-profile rules (sige/05 §2.1, §4.1, STU-R4, STU-R5). No framework or I/O imports:
 * the API schemas, the services, the import and the web share one definition of each rule.
 */

/** Document types a student may hold (sige/05 §4.1); a subset of `DOCUMENT_TYPES`. */
export const STUDENT_DOCUMENT_TYPES = ["TI", "RC", "CC"] as const;
export type StudentDocumentType = (typeof STUDENT_DOCUMENT_TYPES)[number];
export const DEFAULT_STUDENT_DOCUMENT_TYPE: StudentDocumentType = "TI";

/** DB enum `student_status` (sige/05 §2.1). */
export const STUDENT_STATUSES = ["activo", "retirado", "graduado"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

/** DB enum `guardian_relationship` (sige/05 §2.2). */
export const GUARDIAN_RELATIONSHIPS = [
  "Acudiente",
  "Padre",
  "Madre",
  "Tío/a",
  "Abuelo/a",
  "Hermano/a",
  "Otro",
] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

/** Column limits of `student` (sige/05 §2.1). */
export const STUDENT_FIELD_MAX = {
  neighborhood: 100,
  bloodType: 5,
  eps: 100,
  guardianName: 150,
  guardianPhone: 30,
  guardianEmail: 100,
} as const;
export const STRATUM_MIN = 1;
export const STRATUM_MAX = 6;

export const studentMessages = {
  courseCampusMismatch: "El grado no pertenece a la sede seleccionada.",
  stratumRange: "El estrato debe estar entre 1 y 6.",
  /** Authored (P4 T1): the spec defines the allowed transitions but no refusal copy. */
  statusTransition: (from: StudentStatus, to: StudentStatus) =>
    `No se puede cambiar el estado de "${from}" a "${to}".`,
} as const;

/** Stratum: empty or an integer 1..6. */
export const isValidStratum = (value: number) =>
  Number.isInteger(value) && value >= STRATUM_MIN && value <= STRATUM_MAX;

/**
 * STU-03 `courseId` rule: a chosen course must belong to the chosen campus. Returns the spec
 * message on mismatch, `null` when consistent (no course is always consistent).
 */
export function checkCourseCampus(
  course: { campusId: string } | null | undefined,
  campusId: string,
): string | null {
  return course && course.campusId !== campusId ? studentMessages.courseCampusMismatch : null;
}

/** STU-R4: changing the campus clears the course unless the course belongs to the new campus. */
export function courseAfterCampusChange(
  course: { id: string; campusId: string } | null | undefined,
  campusId: string,
): string | null {
  return course && course.campusId === campusId ? course.id : null;
}

/**
 * STU-R5: `activo` may become `retirado` or `graduado`; either may be reactivated to `activo`.
 * A direct `retirado` <-> `graduado` move is refused (reactivate first). Same state is a no-op.
 */
const NEXT_STATUSES: Record<StudentStatus, readonly StudentStatus[]> = {
  activo: ["retirado", "graduado"],
  retirado: ["activo"],
  graduado: ["activo"],
};

export function canChangeStudentStatus(from: StudentStatus, to: StudentStatus): boolean {
  return from === to || NEXT_STATUSES[from].includes(to);
}

/** Active lists, sheets, metrics and scans include only `activo` students (R2.10). */
export const isActiveStudent = (status: StudentStatus) => status === "activo";
