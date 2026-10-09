import { PROFILE_FIELDS, profileFormSchema, type ProfileInput } from "@/features/institution";
import z from "zod";

import type { InstitutionDetail } from "../types";

export const DOCUMENT_TYPES = ["CC", "TI", "CE"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const INSTITUTION_CREATE_FALLBACK_MESSAGE =
  "No se pudo crear la institución. Intente nuevamente.";
export const INSTITUTION_UPDATE_FALLBACK_MESSAGE =
  "No se pudo actualizar la institución. Intente nuevamente.";

/** Rector (admin) fields of the create form; prefixed so they never clash with the profile's `email`. */
export const RECTOR_FIELDS = [
  "rectorFirstName",
  "rectorLastName",
  "rectorDocumentType",
  "rectorDocumentNumber",
  "rectorEmail",
  "rectorPhone",
] as const;

/** Every field either mode of the form renders. */
export const INSTITUTION_FORM_FIELDS = [...PROFILE_FIELDS, ...RECTOR_FIELDS] as const;

const documentTypeSchema = z.enum(DOCUMENT_TYPES, { message: "Tipo de documento inválido." });

/**
 * INS-02 create rules: the profile fragment shared with INS-06 plus the mandatory rector.
 * Messages mirror the server's (`institutionAdmin.create`) so both agree.
 */
export const createInstitutionFormSchema = profileFormSchema.extend({
  rectorFirstName: z.string().trim().min(1, "Los nombres son obligatorios."),
  rectorLastName: z.string().trim().min(1, "Los apellidos son obligatorios."),
  rectorDocumentType: documentTypeSchema,
  rectorDocumentNumber: z.string().trim().min(5, "El documento debe tener al menos 5 caracteres."),
  rectorEmail: z.string().trim().pipe(z.email("Ingresa un correo válido.")),
  rectorPhone: z.string().trim(),
});

/**
 * INS-02 edit rules: the same form shape, with the rector fields unchecked (they are not
 * rendered, and the update input has no rector).
 */
export const editInstitutionFormSchema = profileFormSchema.extend({
  rectorFirstName: z.string(),
  rectorLastName: z.string(),
  rectorDocumentType: documentTypeSchema,
  rectorDocumentNumber: z.string(),
  rectorEmail: z.string(),
  rectorPhone: z.string(),
});

export type InstitutionFormValues = z.input<typeof createInstitutionFormSchema>;

const EMPTY_RECTOR = {
  rectorFirstName: "",
  rectorLastName: "",
  rectorDocumentType: "CC",
  rectorDocumentNumber: "",
  rectorEmail: "",
  rectorPhone: "",
} as const satisfies Pick<InstitutionFormValues, (typeof RECTOR_FIELDS)[number]>;

/** Blank create form; the academic year starts at the current year (sige/02 INS-02). */
export function emptyInstitutionForm(now: Date = new Date()): InstitutionFormValues {
  return {
    name: "",
    nit: "",
    phone: "",
    email: "",
    address: "",
    municipality: "",
    department: "",
    academicYear: String(now.getFullYear()),
    resolution: "",
    ...EMPTY_RECTOR,
  };
}

/** Edit form state from `institutionAdmin.get`; blank optional values become empty strings. */
export function institutionToFormValues(institution: InstitutionDetail): InstitutionFormValues {
  return {
    name: institution.name,
    nit: institution.nit ?? "",
    phone: institution.phone ?? "",
    email: institution.email ?? "",
    address: institution.address ?? "",
    municipality: institution.municipality ?? "",
    department: institution.department ?? "",
    academicYear: institution.academicYear,
    resolution: institution.resolution ?? "",
    ...EMPTY_RECTOR,
  };
}

/** Maps the validated create form to the `institutionAdmin.create` input; a blank phone is omitted. */
export function toCreateInstitutionInput(values: z.output<typeof createInstitutionFormSchema>) {
  const {
    rectorFirstName,
    rectorLastName,
    rectorDocumentType,
    rectorDocumentNumber,
    rectorEmail,
    rectorPhone,
    ...institution
  } = values;
  return {
    institution,
    admin: {
      firstName: rectorFirstName,
      lastName: rectorLastName,
      documentType: rectorDocumentType,
      documentNumber: rectorDocumentNumber,
      email: rectorEmail,
      phone: rectorPhone === "" ? undefined : rectorPhone,
    },
  };
}

/** Maps the edit form to the `institutionAdmin.update` fields (the profile; no rector). */
export function toUpdateInstitutionInput(
  values: z.output<typeof editInstitutionFormSchema>,
): ProfileInput {
  return profileFormSchema.parse(values);
}
