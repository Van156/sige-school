import z from "zod";

export const DOCUMENT_TYPES = ["CC", "TI", "CE"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const INSTITUTION_CREATE_FALLBACK_MESSAGE =
  "No se pudo crear la institución. Intente nuevamente.";

/** INS-02 form rules; messages mirror the server's (`institutionAdmin.create`) so both agree. */
export const institutionFormSchema = z.object({
  institutionName: z.string().trim().min(1, "El nombre de la institución es obligatorio."),
  firstName: z.string().trim().min(1, "Los nombres son obligatorios."),
  lastName: z.string().trim().min(1, "Los apellidos son obligatorios."),
  documentType: z.enum(DOCUMENT_TYPES, { message: "Tipo de documento inválido." }),
  documentNumber: z.string().trim().min(5, "El documento debe tener al menos 5 caracteres."),
  email: z.string().trim().pipe(z.email("Ingresa un correo válido.")),
  phone: z.string().trim(),
});

export type InstitutionFormValues = z.input<typeof institutionFormSchema>;

export const emptyInstitutionForm: InstitutionFormValues = {
  institutionName: "",
  firstName: "",
  lastName: "",
  documentType: "CC",
  documentNumber: "",
  email: "",
  phone: "",
};

/** Maps the validated form to the `institutionAdmin.create` input; a blank phone is omitted. */
export function toCreateInstitutionInput(values: z.output<typeof institutionFormSchema>) {
  return {
    institution: { name: values.institutionName },
    admin: {
      firstName: values.firstName,
      lastName: values.lastName,
      documentType: values.documentType,
      documentNumber: values.documentNumber,
      email: values.email,
      phone: values.phone === "" ? undefined : values.phone,
    },
  };
}

/**
 * BAD_REQUEST and CONFLICT carry the server's own Spanish message (validation or a taken
 * document/email/username); anything else, including network failures, gets the fallback.
 */
export function institutionCreateErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if ((code === "BAD_REQUEST" || code === "CONFLICT") && typeof message === "string" && message) {
      return message;
    }
  }
  return INSTITUTION_CREATE_FALLBACK_MESSAGE;
}
