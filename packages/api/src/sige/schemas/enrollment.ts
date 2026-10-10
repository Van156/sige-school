import {
  BULK_ENROLLMENT_MAX_STUDENTS,
  ENROLLMENT_STATUSES,
  enrollmentMessages,
  isValidFinalScore,
} from "@base-template/sige-core";
import { z } from "zod";

/**
 * Input fragments for SCH-01/02 enrollments (sige/04 §3.3, §4.1). Messages are the verbatim
 * Spanish strings the UI shows. Capacity, activity and the offering list need the database and
 * are decided by `planBulkEnrollment` in the service.
 */

const id = z.string().min(1);
const blankToUndefined = (value: string) => (value === "" ? undefined : value);

export const enrollmentStatusSchema = z.enum(ENROLLMENT_STATUSES, {
  error: "Debes seleccionar un estado.",
});

/** SCH-02 create (`enrollment.createBulk`). */
export const enrollmentCreateBulkInput = z.object({
  courseId: z
    .string({ error: enrollmentMessages.selectCourse })
    .min(1, enrollmentMessages.selectCourse),
  studentIds: z
    .array(id, { error: enrollmentMessages.selectStudents })
    .min(1, enrollmentMessages.selectStudents)
    .max(
      BULK_ENROLLMENT_MAX_STUDENTS,
      `Seleccione como máximo ${BULK_ENROLLMENT_MAX_STUDENTS} estudiantes.`,
    ),
  allowOverCapacity: z.boolean().default(false),
});

/** SCH-02 edit: status, final score and note only (SCH-R8). */
export const enrollmentUpdateInput = z.object({
  id,
  status: enrollmentStatusSchema,
  finalScore: z
    .number({ error: enrollmentMessages.finalScoreRange })
    .refine(isValidFinalScore, enrollmentMessages.finalScoreRange)
    .nullish(),
  statusNote: z
    .string()
    .trim()
    .max(500, "No puede superar 500 caracteres.")
    .transform((value) => (value === "" ? null : value))
    .nullish(),
});

export const enrollmentIdInput = z.object({ id });

export const enrollmentStatsInput = z.object({ academicYear: z.string().min(1).optional() });

export const ENROLLMENT_CANDIDATES_MAX_LIMIT = 200;

export const enrollmentCandidatesInput = z.object({
  courseId: z
    .string({ error: enrollmentMessages.selectCourse })
    .min(1, enrollmentMessages.selectCourse),
  search: z
    .string()
    .trim()
    .max(100, "No puede superar 100 caracteres.")
    .transform(blankToUndefined)
    .optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(ENROLLMENT_CANDIDATES_MAX_LIMIT)
    .default(ENROLLMENT_CANDIDATES_MAX_LIMIT),
});
