import { subjectInput } from "@base-template/api/sige/schemas/institution";
import type { z } from "zod";

import type { SubjectRow } from "../types";

/** INS-14 form rules: the API's own fragment, so the client and the server messages agree. */
export const subjectFormSchema = subjectInput;

export type SubjectInput = ReturnType<typeof subjectFormSchema.parse>;

/** Form state is the schema's input: both controls hold strings (blank code = absent). */
export type SubjectFormValues = z.input<typeof subjectFormSchema>;

export const emptySubjectForm: SubjectFormValues = { name: "", code: "" };

/** Names of the fields the subject form renders. */
export const SUBJECT_FIELDS = Object.keys(emptySubjectForm);

export function subjectToFormValues(subject: SubjectRow): SubjectFormValues {
  return { name: subject.name, code: subject.code ?? "" };
}

/** Validated form to the `subject.create` / `subject.update` input; a blank code is omitted. */
export function toSubjectInput(values: SubjectFormValues): SubjectInput {
  return subjectFormSchema.parse(values);
}

export const SUBJECT_SAVE_FALLBACK = "No se pudo guardar la asignatura. Intente nuevamente.";

/** Server messages that belong under a specific subject field (sige/02 §4.1). */
export const SUBJECT_FIELD_BY_MESSAGE: Readonly<Record<string, keyof SubjectFormValues>> = {
  "Ya existe una asignatura con este código.": "code",
};
