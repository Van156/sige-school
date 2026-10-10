import {
  OBSERVATION_CATEGORIES,
  OBSERVATION_TYPE_CODES,
  SIGE_RULES,
  isCalendarDate,
  observationMessages,
} from "@base-template/sige-core";
import { z } from "zod";

/**
 * Inputs of the `observation.*` procedures (sige/08 §4.1). Every message is the verbatim OBS-R2
 * per-field string, imported from `sige-core` with its length limit. No input carries
 * `organizationId` (R3.2, 08 §8.1) and the student is never part of `update` (OBS-R5).
 *
 * `observedOn` is validated by shape only (`YYYY-MM-DD`): the default ("today" in Bogotá), the
 * future check (OBS-R3) and the 08:00 stamping need the clock and live in the services.
 */

const id = z.string().min(1);

/** `observation_type` (08 §2); the four values of §3. */
export const observationTypeSchema = z.enum(OBSERVATION_TYPE_CODES, {
  error: observationMessages.typeRequired,
});

/** OBS-R2: one of the seven categories of §3, or empty -> `null`. */
export const observationCategorySchema = z
  .string()
  .trim()
  .pipe(
    z
      .union([z.literal(""), z.enum(OBSERVATION_CATEGORIES)], {
        error: observationMessages.invalidCategory,
      })
      .transform((value) => (value === "" ? null : value)),
  )
  .nullish()
  .transform((value) => value ?? null);

/** OBS-R2: trimmed, required, ≤ 2000 characters. */
export const observationDescriptionSchema = z
  .string({ error: observationMessages.descriptionRequired })
  .trim()
  .min(1, { error: observationMessages.descriptionRequired, abort: true })
  .max(SIGE_RULES.OBSERVATION_DESCRIPTION_MAX, observationMessages.descriptionTooLong);

/** OBS-R2: trimmed, ≤ 1000 characters, blank or absent -> `null`. */
export const observationCommitmentsSchema = z
  .string()
  .trim()
  .max(SIGE_RULES.OBSERVATION_COMMITMENTS_MAX, observationMessages.commitmentsTooLong)
  .nullish()
  .transform((value) => (value === null || value === undefined || value === "" ? null : value));

/** OBS-R3: the day the observation happened (`yyyy-mm-dd`), today in Bogotá by default. */
export const observedOnSchema = z
  .string({ error: observationMessages.invalidDate })
  .refine(isCalendarDate, observationMessages.invalidDate)
  .optional();

const editableFields = {
  type: observationTypeSchema,
  category: observationCategorySchema,
  description: observationDescriptionSchema,
  commitments: observationCommitmentsSchema,
  observedOn: observedOnSchema,
};

/** `observation.create` (OBS-03 and OBS-04); the author is the caller, `notified` starts false. */
export const observationCreateInput = z.object({
  studentId: z
    .string({ error: observationMessages.studentRequired })
    .min(1, observationMessages.studentRequired),
  ...editableFields,
});

/** `observation.update` (OBS-R5): the student of an existing observation cannot change. */
export const observationUpdateInput = z.object({ id, ...editableFields });

/** `observation.get`, `observation.delete` and `observation.markNotified`. */
export const observationIdInput = z.object({ id });

/** `observation.studentHistory` (OBS-05 and PAR-04). */
export const observationStudentInput = z.object({
  studentId: z
    .string({ error: observationMessages.studentRequired })
    .min(1, observationMessages.studentRequired),
});

/** `observation.recent` for DASH-03: at most 20 rows, 10 by default (08 §4.1). */
export const observationRecentInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(SIGE_RULES.OBSERVATION_RECENT_MAX)
    .default(SIGE_RULES.OBSERVATION_RECENT_DEFAULT),
});
