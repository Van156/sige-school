import { campusInput } from "@base-template/api/sige/schemas/institution";
import type { z } from "zod";

import type { CampusJornada, CampusRow } from "../types";

/** INS-08 form rules: the API's own fragment, so the client and the server messages agree. */
export const campusFormSchema = campusInput;

export type CampusInput = ReturnType<typeof campusFormSchema.parse>;

/**
 * Form state is the schema's input: text controls hold strings (blank = absent, so the optional
 * keys are always filled by the defaults), switches hold booleans.
 */
export type CampusFormValues = z.input<typeof campusFormSchema>;

export const JORNADA_LABEL: Record<CampusJornada, string> = {
  manana: "Mañana",
  tarde: "Tarde",
  completa: "Completa",
};

export const JORNADA_OPTIONS = (Object.keys(JORNADA_LABEL) as CampusJornada[]).map((value) => ({
  value,
  label: JORNADA_LABEL[value],
}));

/** INS-08 defaults: jornada "Completa", active, not main. */
export const emptyCampusForm: CampusFormValues = {
  name: "",
  code: "",
  address: "",
  jornada: "completa",
  isMain: false,
  active: true,
};

export function campusToFormValues(campus: CampusRow): CampusFormValues {
  return {
    name: campus.name,
    code: campus.code ?? "",
    address: campus.address ?? "",
    jornada: campus.jornada,
    isMain: campus.isMain,
    active: campus.active,
  };
}

/** Validated form to the `campus.create` / `campus.update` input; blank optional text is omitted. */
export function toCampusInput(values: CampusFormValues): CampusInput {
  return campusFormSchema.parse(values);
}

/** Names of the fields the campus form renders. */
export const CAMPUS_FIELDS = Object.keys(emptyCampusForm);

export const CAMPUS_SAVE_FALLBACK = "No se pudo guardar la sede. Intente nuevamente.";

/** Server messages that belong under a specific campus field (sige/02 §4.1, INS-R2). */
export const CAMPUS_FIELD_BY_MESSAGE: Readonly<Record<string, keyof CampusFormValues>> = {
  "Ya existe una sede principal en esta institución.": "isMain",
  "Ya existe una sede con este código.": "code",
};
