import {
  DOCUMENT_NUMBER_MAX,
  DOCUMENT_NUMBER_MIN,
  DOCUMENT_TYPES,
  IMPORT_ROLES,
  NAME_MAX,
} from "@base-template/sige-core";
import { z } from "zod";

/**
 * Input fragments for module 03 (sige/03 §3.3, §4.1). Messages are the verbatim Spanish strings
 * the UI shows; the server returns the same text as field issues. No fragment carries
 * `organizationId`: the tenant always comes from the session. Blank optional inputs are absent.
 */

const PASSWORD_MIN = 8;
const PASSWORD_MESSAGE = `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
const tooLong = (max: number) => `No puede superar ${max} caracteres.`;

const requiredName = (message: string) =>
  z.string({ error: message }).trim().min(1, message).max(NAME_MAX, tooLong(NAME_MAX));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, tooLong(max))
    .transform((value) => (value === "" ? undefined : value))
    .optional();

/** `YYYY-MM-DD` that exists in the calendar (rejects 2025-02-29, month 13). */
function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const blankToUndefined = (value: string) => (value === "" ? undefined : value);

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .transform(blankToUndefined)
  .pipe(z.email("Ingresa un correo válido.").max(100, tooLong(100)).optional())
  .optional();

const birthDateField = z
  .string()
  .trim()
  .transform(blankToUndefined)
  .pipe(
    z
      .string()
      .refine(isCalendarDate, { error: "Fecha de nacimiento inválida.", abort: true })
      .refine(
        (value) => value <= new Date().toISOString().slice(0, 10),
        "La fecha de nacimiento no puede ser futura.",
      )
      .optional(),
  )
  .optional();

const genderField = z
  .enum(["M", "F", "Otro", ""])
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const documentTypeSchema = z
  .enum(DOCUMENT_TYPES, { error: "Tipo de documento inválido." })
  .default("CC");

export const documentNumberSchema = z
  .string({ error: `El documento debe tener al menos ${DOCUMENT_NUMBER_MIN} caracteres.` })
  .trim()
  .min(DOCUMENT_NUMBER_MIN, {
    error: `El documento debe tener al menos ${DOCUMENT_NUMBER_MIN} caracteres.`,
    abort: true,
  })
  .max(DOCUMENT_NUMBER_MAX, `El documento no puede superar ${DOCUMENT_NUMBER_MAX} caracteres.`)
  .regex(/^[A-Za-z0-9]+$/, "El documento solo admite letras y números.");

export const passwordSchema = z
  .string({ error: PASSWORD_MESSAGE })
  .min(PASSWORD_MIN, PASSWORD_MESSAGE);

/** One of the five tenant roles; `admin`/`owner` are platform-managed (USR-R3, D11). */
export const tenantRoleSchema = z.enum(IMPORT_ROLES, {
  error: (issue) =>
    issue.input === undefined
      ? "Debes seleccionar un rol."
      : issue.input === "admin" || issue.input === "owner"
        ? "Solo la plataforma puede crear administradores."
        : "Rol inválido.",
});

const personId = z.string({ error: "Falta la persona." }).min(1, "Falta la persona.");

const profileFields = {
  firstName: requiredName("Los nombres son obligatorios."),
  lastName: requiredName("Los apellidos son obligatorios."),
  documentType: documentTypeSchema,
  documentNumber: documentNumberSchema,
  birthDate: birthDateField,
  gender: genderField,
  email: emailField,
  phone: optionalText(30),
  address: optionalText(200),
  country: optionalText(100),
  department: optionalText(100),
  municipality: optionalText(100),
};

export const userCreateInput = z.object({ ...profileFields, role: tenantRoleSchema });

/** Edit = create minus role (immutable, OQ-USR-1) plus the optional "Nueva Contraseña" (USR-R8). */
export const userEditInput = z.object({
  ...profileFields,
  newPassword: z.string().transform(blankToUndefined).pipe(passwordSchema.optional()).optional(),
});

export const userUpdateInput = userEditInput.extend({ personId });

export const userPersonInput = z.object({ personId });

export const userSetActiveInput = z.object({
  personId,
  active: z.boolean({ error: "Falta el estado." }),
});

export const userResetPasswordInput = z.discriminatedUnion("mode", [
  z.object({ personId, mode: z.literal("document") }),
  z.object({ personId, mode: z.literal("custom"), newPassword: passwordSchema }),
]);

export const USER_OPTIONS_MAX_LIMIT = 50;
export const USER_OPTIONS_DEFAULT_LIMIT = 20;

export const userOptionsInput = z.object({
  role: z.enum(["teacher", "parent"]),
  search: z.string().trim().max(100, tooLong(100)).transform(blankToUndefined).optional(),
  limit: z.number().int().min(1).max(USER_OPTIONS_MAX_LIMIT).default(USER_OPTIONS_DEFAULT_LIMIT),
});

/** Parts may be empty while the user types: the server answers `username: null` (no write). */
export const userPreviewUsernameInput = z.object({
  firstName: z.string().trim().max(NAME_MAX),
  lastName: z.string().trim().max(NAME_MAX),
  documentNumber: z.string().trim().max(DOCUMENT_NUMBER_MAX),
});

export const userCheckEmailInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Ingresa un correo válido.").max(100)),
});
