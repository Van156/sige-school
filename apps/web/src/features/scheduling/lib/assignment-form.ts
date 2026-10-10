import {
  assignmentAssignInput,
  assignmentUpdateInput,
} from "@base-template/api/sige/schemas/scheduling";
import { z } from "zod";

import { mapSubmitError, type SubmitFailure } from "@/features/institution";

import type { AssignmentRow } from "../types";

type UpdateApiInput = z.input<typeof assignmentUpdateInput>;

/**
 * SCH-04 create rules. Every control holds a select value ("" = nothing chosen); the values are
 * piped into the API's own `assignmentAssignInput`, so each rule and message (sige/04 §4.1) lives
 * in one place.
 */
export const assignFormSchema = z
  .object({ courseId: z.string(), subjectId: z.string(), teacherPersonId: z.string() })
  .pipe(assignmentAssignInput);

/** Form state of SCH-04 create. */
export type AssignFormValues = z.input<typeof assignFormSchema>;

/** The validated form: the shape `assignment.assign` takes. */
export type AssignInput = z.output<typeof assignFormSchema>;

export const emptyAssignForm: AssignFormValues = {
  courseId: "",
  subjectId: "",
  teacherPersonId: "",
};

/** Names of the fields the create form renders. */
export const ASSIGN_FIELDS = ["courseId", "subjectId", "teacherPersonId"] as const;

export const ASSIGN_SAVE_FALLBACK = "No se pudo asignar el profesor. Intente nuevamente.";

export function toAssignInput(values: AssignFormValues): AssignInput {
  return assignFormSchema.parse(values);
}

/** Server messages that belong under a specific create field (sige/04 §4.1). */
export const ASSIGN_FIELD_BY_MESSAGE: Readonly<Record<string, (typeof ASSIGN_FIELDS)[number]>> = {
  "El profesor debe estar activo.": "teacherPersonId",
  "El grado no existe.": "courseId",
  "La materia no existe.": "subjectId",
};

/**
 * SCH-R3 refusal ("El profesor ya tiene clases en el mismo horario ({curso}, {día} {hora}).");
 * the tail names the first clashing class, so it is matched by its stable start.
 */
const TEACHER_BUSY_PREFIX = "El profesor ya tiene clases en el mismo horario";

/** `mapSubmitError` for the create form: the busy-teacher conflict lands under "Profesor". */
export function mapAssignSubmitError(error: unknown): SubmitFailure {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  if (
    code === "CONFLICT" &&
    typeof message === "string" &&
    message.startsWith(TEACHER_BUSY_PREFIX)
  ) {
    return { fieldErrors: { teacherPersonId: message }, formError: null };
  }
  return mapSubmitError(error, {
    fields: ASSIGN_FIELDS,
    fieldByMessage: ASSIGN_FIELD_BY_MESSAGE,
    fallback: ASSIGN_SAVE_FALLBACK,
  });
}

/**
 * SCH-04 edit rules: status and notes (the rest is read-only). Notes are piped into the API's
 * `assignmentUpdateInput`, whose length rule and message apply; a blank note clears the column.
 */
export const assignmentEditFormSchema = z
  .object({ status: z.string(), notes: z.string() })
  .transform((values): Omit<UpdateApiInput, "id"> => ({
    // Raw select text: the API's enum rule reports an unchosen status.
    status: values.status as UpdateApiInput["status"],
    notes: values.notes,
  }))
  .pipe(assignmentUpdateInput.omit({ id: true }));

/** Form state of SCH-04 edit. */
export type AssignmentEditFormValues = z.input<typeof assignmentEditFormSchema>;

/** The validated form, without the id: the rest of `assignment.update`'s input. */
export type AssignmentEditInput = z.output<typeof assignmentEditFormSchema>;

/** Names of the fields the edit form renders. */
export const ASSIGNMENT_EDIT_FIELDS = ["status", "notes"] as const;

export const ASSIGNMENT_EDIT_SAVE_FALLBACK =
  "No se pudo actualizar la asignación. Intente nuevamente.";

export function assignmentToEditForm(
  assignment: Pick<AssignmentRow, "status" | "notes">,
): AssignmentEditFormValues {
  return { status: assignment.status, notes: assignment.notes ?? "" };
}

export function toAssignmentEditInput(values: AssignmentEditFormValues): AssignmentEditInput {
  return assignmentEditFormSchema.parse(values);
}
