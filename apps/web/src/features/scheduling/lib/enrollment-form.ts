import {
  enrollmentCreateBulkInput,
  enrollmentUpdateInput,
} from "@base-template/api/sige/schemas/enrollment";
import { enrollmentMessages } from "@base-template/sige-core";
import { z } from "zod";

import type { CheckItem } from "@/shared/components/form/check-list";
import type { Option } from "@/shared/lib/data-table/types";

import { mapSubmitError, type SubmitFailure } from "@/features/institution";
import { hasOrpcErrorCode } from "@/shared/lib/orpc-error";

import type {
  BulkEnrollmentResult,
  EnrollmentCandidate,
  EnrollmentCandidateCourse,
  EnrollmentRow,
} from "../types";

/**
 * SCH-02 create rules. The controls hold a select value ("" = nothing chosen) and the checked
 * student ids; the values are piped into the API's own `enrollmentCreateBulkInput`, so each rule
 * and message (sige/04 §4.1) lives in one place. The capacity override is never a form field: the
 * page resends with `allowOverCapacity` after the confirmation (SCH-R5).
 */
export const enrollFormSchema = z
  .object({ courseId: z.string(), studentIds: z.array(z.string()) })
  .pipe(enrollmentCreateBulkInput);

/** Form state of SCH-02 create. */
export type EnrollFormValues = z.input<typeof enrollFormSchema>;

/** The validated form: the shape `enrollment.createBulk` takes. */
export type EnrollInput = z.output<typeof enrollFormSchema>;

export const emptyEnrollForm: EnrollFormValues = { courseId: "", studentIds: [] };

/** Names of the fields the create form renders. */
export const ENROLL_FIELDS = ["courseId", "studentIds"] as const;

export const ENROLL_SAVE_FALLBACK = "No se pudo matricular a los estudiantes. Intente nuevamente.";

export function toEnrollInput(values: EnrollFormValues): EnrollInput {
  return enrollFormSchema.parse(values);
}

/** Server refusals that belong under a specific create field (sige/04 §4.1, SCH-R5). */
const ENROLL_FIELD_BY_MESSAGE: Readonly<Record<string, (typeof ENROLL_FIELDS)[number]>> = {
  [enrollmentMessages.noOfferings]: "courseId",
  "El grado no existe.": "courseId",
  [enrollmentMessages.inactiveStudent]: "studentIds",
  "El estudiante no existe.": "studentIds",
};

/** `mapSubmitError` for the create form. */
export function mapEnrollSubmitError(error: unknown): SubmitFailure {
  return mapSubmitError(error, {
    fields: ENROLL_FIELDS,
    fieldByMessage: ENROLL_FIELD_BY_MESSAGE,
    fallback: ENROLL_SAVE_FALLBACK,
  });
}

/**
 * Whether `createBulk` refused only because the course would exceed its capacity (SCH-R5): the
 * one refusal the page turns into the "Matricular de todos modos" confirmation.
 */
export function isOverCapacityRefusal(
  error: unknown,
  course: Pick<EnrollmentCandidateCourse, "maxStudents">,
): boolean {
  return (
    hasOrpcErrorCode(error, "BAD_REQUEST") &&
    (error as { message?: unknown }).message === enrollmentMessages.overCapacity(course.maxStudents)
  );
}

/** The capacity warning shown in the confirmation (sige/04 §4.1). */
export function overCapacityMessage(course: Pick<EnrollmentCandidateCourse, "maxStudents">) {
  return enrollmentMessages.overCapacity(course.maxStudents);
}

/** "Grado *" choices: the courses of the institution's current academic year. */
export function enrollmentCourseOptions(
  courses: readonly { id: string; name: string; academicYear: string }[],
  currentAcademicYear: string,
): Option[] {
  return courses
    .filter((course) => course.academicYear === currentAcademicYear)
    .map((course) => ({ value: course.id, label: course.name }));
}

/** "Estudiantes *" rows: the name and the hint "Actualmente: {curso o Sin grado}". */
export function candidateCheckItems(students: readonly EnrollmentCandidate[]): CheckItem[] {
  return students.map((student) => ({
    value: student.id,
    label: student.name,
    hint: `Actualmente: ${student.currentCourseName ?? "Sin grado"}`,
  }));
}

/** The callout's tail "({n} en {curso})", empty before a course is chosen. */
export function calloutCourseDetail(
  course: Pick<EnrollmentCandidateCourse, "name" | "offeringCount"> | undefined,
): string {
  return course ? ` (${course.offeringCount} en ${course.name})` : "";
}

/** Success toast "{n} estudiante(s) matriculado(s)" + "{m} inscripciones creadas en {curso}.". */
export function enrollSuccessToast(
  result: Pick<BulkEnrollmentResult, "students" | "created">,
  courseName: string,
): { title: string; description: string } {
  return {
    title: `${result.students} estudiante(s) matriculado(s)`,
    description: `${result.created} inscripciones creadas en ${courseName}.`,
  };
}

/**
 * SCH-R5 submit: runs `enroll` without the override; a capacity refusal for `course` becomes
 * `askOverride` (the page then shows "Matricular de todos modos", which resends with
 * `allowOverCapacity: true`), any other failure rejects for the form to show.
 */
export async function enrollOrAskOverride({
  input,
  course,
  enroll,
  askOverride,
}: {
  input: EnrollInput;
  course: Pick<EnrollmentCandidateCourse, "maxStudents">;
  enroll: (input: EnrollInput) => Promise<unknown>;
  askOverride: (input: EnrollInput) => void;
}): Promise<void> {
  try {
    await enroll({ ...input, allowOverCapacity: false });
  } catch (error) {
    if (!isOverCapacityRefusal(error, course)) {
      throw error;
    }
    askOverride(input);
  }
}

type UpdateApiInput = z.input<typeof enrollmentUpdateInput>;

/** "Nota Final" text to the API value: blank clears it; a decimal comma is accepted. */
function parseFinalScore(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : Number(trimmed.replace(",", "."));
}

/**
 * SCH-02 edit rules: status, final score and note (SCH-R8; the rest is read-only). The values are
 * piped into the API's `enrollmentUpdateInput`, whose score range and note length rules and
 * messages apply; a blank score or note clears the column.
 */
export const enrollmentEditFormSchema = z
  .object({ status: z.string(), finalScore: z.string(), statusNote: z.string() })
  .transform((values): Omit<UpdateApiInput, "id"> => ({
    // Raw select text: the API's enum rule reports an unchosen status.
    status: values.status as UpdateApiInput["status"],
    finalScore: parseFinalScore(values.finalScore),
    statusNote: values.statusNote,
  }))
  .pipe(enrollmentUpdateInput.omit({ id: true }));

/** Form state of SCH-02 edit. */
export type EnrollmentEditFormValues = z.input<typeof enrollmentEditFormSchema>;

/** The validated form, without the id: the rest of `enrollment.update`'s input. */
export type EnrollmentEditInput = z.output<typeof enrollmentEditFormSchema>;

/** Names of the fields the edit form renders. */
export const ENROLLMENT_EDIT_FIELDS = ["status", "finalScore", "statusNote"] as const;

export const ENROLLMENT_EDIT_SAVE_FALLBACK =
  "No se pudo actualizar la matrícula. Intente nuevamente.";

export function enrollmentToEditForm(
  enrollment: Pick<EnrollmentRow, "status" | "finalScore" | "statusNote">,
): EnrollmentEditFormValues {
  return {
    status: enrollment.status,
    finalScore: enrollment.finalScore === null ? "" : String(enrollment.finalScore),
    statusNote: enrollment.statusNote ?? "",
  };
}

export function toEnrollmentEditInput(values: EnrollmentEditFormValues): EnrollmentEditInput {
  return enrollmentEditFormSchema.parse(values);
}
