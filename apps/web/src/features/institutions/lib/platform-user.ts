import { platformUserCreateInput } from "@base-template/api/sige/schemas/user";
import { z } from "zod";

import { createdUserNotice, type CreatedUser, type ResetPasswordRequest } from "@/features/users";
import { roleKindLabel } from "@/shared/lib/role-label";

const shape = platformUserCreateInput.shape;

/** Blank "Email *" reads like an invalid one: the API's own message. */
const EMAIL_REQUIRED = "Ingresa un correo válido.";

/**
 * INS-05 rules (sige/02 §5.1). The API fragments carry the messages and the blank-to-absent
 * handling; "Email *" is mandatory here (the API accepts a missing one), so a blank address is
 * refused before it reaches the fragment.
 */
export const platformUserFormSchema = z.object({
  firstName: shape.firstName,
  lastName: shape.lastName,
  documentType: shape.documentType,
  documentNumber: shape.documentNumber,
  phone: shape.phone,
  email: z.string().trim().min(1, EMAIL_REQUIRED).pipe(shape.email.unwrap()),
  role: shape.role,
});

/** Form state: every control holds a string. */
export type PlatformUserFormValues = z.input<typeof platformUserFormSchema>;

/** The validated form: `platformUser.create` without the institution. */
export type PlatformUserInput = z.output<typeof platformUserFormSchema>;

/** One option of the INS-05 "Rol del Usuario *" select. */
export type PlatformRoleOption = {
  value: "admin" | "coordinator" | "teacher" | "student" | "parent" | "viewer";
  /** Leading colour dot of the option text. */
  dot: string;
  label: string;
  description: string;
};

/** The six roles of INS-05, in the spec's order ("Administrador" creates an `admin` member). */
export const PLATFORM_ROLE_OPTIONS: readonly PlatformRoleOption[] = [
  {
    value: "admin",
    dot: "🔵",
    label: roleKindLabel("admin"),
    description: "Gestiona toda la institución",
  },
  {
    value: "coordinator",
    dot: "🟣",
    label: roleKindLabel("coordinator"),
    description: "Supervisión académica",
  },
  {
    value: "teacher",
    dot: "🟡",
    label: roleKindLabel("teacher"),
    description: "Notas, asistencia, observaciones",
  },
  {
    value: "student",
    dot: "🟢",
    label: roleKindLabel("student"),
    description: "Consulta sus datos",
  },
  { value: "parent", dot: "🔵", label: roleKindLabel("parent"), description: "Portal de padres" },
  { value: "viewer", dot: "⚪", label: roleKindLabel("viewer"), description: "Solo lectura" },
];

/** The preselected role (spec: Profesor is the default). */
export const DEFAULT_PLATFORM_ROLE = "teacher" as const;

/** "🟡 Profesor - Notas, asistencia, observaciones". */
export function platformRoleOptionText(option: PlatformRoleOption): string {
  return `${option.dot} ${option.label} - ${option.description}`;
}

/** The three document types INS-05 offers (the full list stays an USR-02 matter). */
export const PLATFORM_DOCUMENT_TYPES = [
  { value: "CC", label: "CC - Cédula de Ciudadanía" },
  { value: "TI", label: "TI - Tarjeta de Identidad" },
  { value: "CE", label: "CE - Cédula de Extranjería" },
] as const;

export function emptyPlatformUserForm(): PlatformUserFormValues {
  return {
    firstName: "",
    lastName: "",
    documentType: "CC",
    documentNumber: "",
    phone: "",
    email: "",
    role: DEFAULT_PLATFORM_ROLE,
  };
}

/** The `platformUser.create` input for `institutionId`. */
export function toPlatformUserCreateInput(institutionId: string, values: PlatformUserFormValues) {
  return { institutionId, ...platformUserFormSchema.parse(values) };
}

/** Fields the INS-05 form renders; server issues on other paths show on the form instead. */
export const PLATFORM_USER_FIELDS = [
  "firstName",
  "lastName",
  "documentType",
  "documentNumber",
  "phone",
  "email",
  "role",
] as const satisfies readonly (keyof PlatformUserFormValues)[];

/** Server messages that belong under a specific field (sige/03 §4.1). */
export const PLATFORM_USER_FIELD_BY_MESSAGE: Readonly<Record<string, string>> = {
  "Ya existe un usuario con este documento.": "documentNumber",
  "Ya existe un usuario con este correo.": "email",
  "La institución ya tiene un propietario.": "role",
};

export const PLATFORM_USER_CREATE_FALLBACK = "No se pudo crear el usuario. Intente nuevamente.";

/**
 * The success toast of INS-05. A student account is only half a student and STU-03 needs the
 * institution's own context, so the toast asks to have the academic profile completed there.
 */
export function platformCreatedNotice(created: CreatedUser): {
  title: string;
  description: string;
} {
  const notice = createdUserNotice(created);
  return created.next === null
    ? notice
    : {
        ...notice,
        description: `${created.username} · pida al coordinador completar el perfil académico.`,
      };
}

/**
 * The `platformUser.resetPassword` input. The platform sets a custom password only (the
 * "document" reset is an institution-side action), so any other request is a programming error.
 */
export function toPlatformResetInput(
  institutionId: string,
  personId: string,
  request: ResetPasswordRequest,
) {
  if (request.mode !== "custom") {
    throw new Error("The platform only sets a custom password.");
  }
  return { institutionId, personId, newPassword: request.newPassword };
}
