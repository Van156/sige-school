import { SIGE_RULES, centsFromNumber, gradeMessages, isScoreCents } from "@base-template/sige-core";
import { z } from "zod";

/**
 * Inputs of the `grade.*` procedures (sige/06 §4.1). Messages are the verbatim GRD-R2/GRD-R3
 * strings. Scores arrive as JSON numbers and leave the schema as exact integer hundredths
 * (`scoreCents`, D12), so the services never multiply floats. Scope, lock state and row
 * integrity against the database are checked by the services.
 */

const id = z.string().min(1);

/** A cell score: 1.00–5.00 with at most two decimals, as integer hundredths. */
export const gradeScoreSchema = z.number({ error: gradeMessages.scoreRange }).refine((value) => {
  const cents = centsFromNumber(value);
  return cents !== null && isScoreCents(cents);
}, gradeMessages.scoreRange);

/** `grade_record.observation`: trimmed, ≤ 500 characters, blank -> `null`. */
export const gradeObservationSchema = z
  .string()
  .trim()
  .max(SIGE_RULES.GRADE_OBSERVATION_MAX, gradeMessages.observationTooLong)
  .transform((value) => (value === "" ? null : value))
  .nullable();

/** One edited cell; `score: null` deletes the record (R3.17). */
export const gradeCellInput = z
  .object({
    studentId: id,
    criterionId: id,
    score: gradeScoreSchema.nullable(),
    observation: gradeObservationSchema,
  })
  .superRefine((cell, context) => {
    if (cell.score === null && cell.observation !== null) {
      context.addIssue({
        code: "custom",
        path: ["observation"],
        message: gradeMessages.observationWithoutScore,
      });
    }
  })
  .transform(({ studentId, criterionId, score, observation }) => ({
    studentId,
    criterionId,
    scoreCents: score === null ? null : (centsFromNumber(score) as number),
    observation,
  }));

/** `grade.saveSheet`: 1..2000 changed cells, optionally "Guardar y Bloquear". */
export const gradeSaveSheetInput = z.object({
  offeringId: id,
  periodId: id,
  cells: z
    .array(gradeCellInput)
    .min(1, "No hay notas para guardar.")
    .max(
      SIGE_RULES.SHEET_MAX_CELLS,
      `No se pueden guardar más de ${SIGE_RULES.SHEET_MAX_CELLS} notas a la vez.`,
    )
    .superRefine((cells, context) => {
      const seen = new Set<string>();
      cells.forEach((cell, index) => {
        const key = `${cell.studentId}\u0000${cell.criterionId}`;
        if (seen.has(key)) {
          context.addIssue({
            code: "custom",
            path: [index],
            message: "La planilla tiene notas repetidas para el mismo estudiante y criterio.",
          });
        }
        seen.add(key);
      });
    }),
  lock: z.boolean().optional(),
});

/** `grade.setLock` (GRD-04 and the sheet's "Desbloquear"). */
export const gradeSetLockInput = z.object({ offeringId: id, periodId: id, locked: z.boolean() });

/** `grade.classes` (GRD-01). */
export const gradeClassesInput = z.object({ periodId: id, courseId: id.optional() });

/** `grade.sheet`, `grade.finals`, `grade.summary`, `grade.recalculate`. */
export const gradeOfferingPeriodInput = z.object({ offeringId: id, periodId: id });

/** `grade.annual`, `grade.importTemplate`. */
export const gradeOfferingInput = z.object({ offeringId: id });

/** `grade.studentGrades` (GRD-08). */
export const gradeStudentInput = z.object({ studentId: id });

/** `grade.importPreview` / `grade.import`: the `.xlsx` limits are enforced by the reader. */
export const gradeImportInput = z.object({
  offeringId: id,
  periodId: id,
  file: z.instanceof(File),
});
