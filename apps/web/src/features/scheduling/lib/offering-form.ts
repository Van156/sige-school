import {
  offeringCreateBulkInput,
  offeringUpdateInput,
} from "@base-template/api/sige/schemas/scheduling";
import { z } from "zod";

/** Blank or non-numeric text becomes `NaN`, which the API's hours rule rejects with its message. */
const hoursText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? Number.NaN : Number(value)));

const DEFAULT_HOURS = "4";

/**
 * SCH-06 form rules. Selections are id lists, the optional teacher a select value ("" = none) and
 * the hours text is parsed; the shaped values are piped into the API's own
 * `offeringCreateBulkInput`, so every rule and message (sige/04 §4.1) lives in one place.
 */
export const bulkOfferingFormSchema = z
  .object({
    courseIds: z.array(z.string()),
    subjectIds: z.array(z.string()),
    teacherPersonId: z.string(),
    hoursPerWeek: hoursText,
  })
  .transform((values): z.input<typeof offeringCreateBulkInput> => ({
    ...values,
    teacherPersonId: values.teacherPersonId === "" ? null : values.teacherPersonId,
  }))
  .pipe(offeringCreateBulkInput);

/** Form state of SCH-06. */
export type BulkOfferingFormValues = z.input<typeof bulkOfferingFormSchema>;

/** The validated form: the shape `offering.createBulk` takes. */
export type BulkOfferingInput = z.output<typeof bulkOfferingFormSchema>;

/** SCH-06 defaults (sige/04 §5.2): nothing selected, no teacher, 4 hours. */
export const emptyBulkOfferingForm: BulkOfferingFormValues = {
  courseIds: [],
  subjectIds: [],
  teacherPersonId: "",
  hoursPerWeek: DEFAULT_HOURS,
};

/** Names of the fields the bulk form renders. */
export const BULK_OFFERING_FIELDS = [
  "courseIds",
  "subjectIds",
  "teacherPersonId",
  "hoursPerWeek",
] as const;

export const BULK_OFFERING_SAVE_FALLBACK =
  "No se pudieron asignar las materias. Intente nuevamente.";

export function toBulkOfferingInput(values: BulkOfferingFormValues): BulkOfferingInput {
  return bulkOfferingFormSchema.parse(values);
}

/** The "Editar intensidad" dialog: only the weekly hours, as text. */
export const offeringHoursFormSchema = z
  .object({ hoursPerWeek: hoursText })
  .pipe(offeringUpdateInput.pick({ hoursPerWeek: true }));

export type OfferingHoursFormValues = z.input<typeof offeringHoursFormSchema>;

export function offeringToHoursForm(offering: { hoursPerWeek: number }): OfferingHoursFormValues {
  return { hoursPerWeek: String(offering.hoursPerWeek) };
}

export const OFFERING_HOURS_FIELDS = ["hoursPerWeek"] as const;

export const OFFERING_HOURS_SAVE_FALLBACK =
  "No se pudo actualizar la intensidad. Intente nuevamente.";

/** Toast copy of a finished bulk assignment (sige/04 §5.2). */
export type BulkResultMessage = {
  kind: "success" | "info";
  title: string;
  description: string | undefined;
};

export function describeBulkResult(result: {
  created: number;
  skipped: number;
}): BulkResultMessage {
  if (result.created === 0) {
    return {
      kind: "info",
      title: "Sin cambios",
      description: "Todas las combinaciones ya estaban asignadas.",
    };
  }
  return {
    kind: "success",
    title: `${result.created} materia(s) asignada(s)`,
    description:
      result.skipped > 0 ? `${result.skipped} ya estaban asignadas y se omitieron.` : undefined,
  };
}
