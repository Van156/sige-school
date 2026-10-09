import {
  userCreateInput,
  userEditInput,
  userUpdateInput,
} from "@base-template/api/sige/schemas/user";
import { DOCUMENT_TYPES, type DocumentType } from "@base-template/sige-core";
import { z } from "zod";

import type { Option } from "@/shared/lib/data-table/types";

import type { UserDetail } from "../types";
import { ASSIGNABLE_ROLES, toAssignableRole } from "./user-roles";

const ROLE_REQUIRED = "Debes seleccionar un rol.";

const profileShape = userEditInput.omit({ newPassword: true }).shape;

/**
 * USR-02 rules. The API fragments carry the messages and the blank-to-absent handling; only the
 * role gets a client-side "required" message (an empty select is not an `undefined` role).
 * `newPassword` is part of the shared form shape but unchecked here.
 */
export const createUserFormSchema = z.object({
  ...profileShape,
  role: z.string().min(1, ROLE_REQUIRED).pipe(userCreateInput.shape.role),
  newPassword: z.string(),
});

/** USR-03 rules: the same profile fields plus the optional "Nueva Contraseña"; the role is not edited. */
export const editUserFormSchema = z.object({
  ...profileShape,
  role: z.string(),
  newPassword: userEditInput.shape.newPassword.unwrap(),
});

/** Form state: every control holds a string. */
export type UserFormValues = z.input<typeof createUserFormSchema>;

/** The validated create form: the shape `user.create` takes. */
export type UserCreateInput = z.output<typeof userCreateInput>;

/** The validated edit form with its person: the shape `user.update` takes. */
export type UserUpdateInput = z.output<typeof userUpdateInput>;

const DEFAULT_COUNTRY = "Colombia";

/** Blank USR-02 form; `role` preselects a `?role=` value when it is assignable. */
export function emptyUserForm(role?: string): UserFormValues {
  return {
    firstName: "",
    lastName: "",
    documentType: "CC",
    documentNumber: "",
    birthDate: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
    country: DEFAULT_COUNTRY,
    department: "",
    municipality: "",
    role: toAssignableRole(role) ?? "",
    newPassword: "",
  };
}

/** Edit form state from `user.get`; empty optional values become empty strings. */
export function userToFormValues(user: UserDetail): UserFormValues {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    documentType: user.documentType,
    documentNumber: user.documentNumber,
    birthDate: user.birthDate ?? "",
    gender: user.gender ?? "",
    email: user.hasRealEmail ? (user.email ?? "") : "",
    phone: user.phone ?? "",
    address: user.address ?? "",
    country: user.country ?? "",
    department: user.department ?? "",
    municipality: user.municipality ?? "",
    role: user.role,
    newPassword: "",
  };
}

/** Maps the create form to the `user.create` input (blank optional fields are omitted). */
export function toUserCreateInput(values: UserFormValues): UserCreateInput {
  return userCreateInput.parse(values);
}

/**
 * Maps the edit form to the `user.update` input. The procedure replaces the whole profile, so
 * every field the form holds is sent (the prefilled `country` included) and a blank optional
 * field clears it; a blank "Nueva Contraseña" is omitted, which keeps the current password
 * (editing the document never changes it, D2).
 */
export function toUserUpdateInput(personId: string, values: UserFormValues): UserUpdateInput {
  return userUpdateInput.parse({ ...values, personId });
}

/** Fields the user form renders; server issues on other paths show on the form instead. */
export const USER_FORM_FIELDS = [
  "firstName",
  "lastName",
  "documentType",
  "documentNumber",
  "birthDate",
  "gender",
  "email",
  "phone",
  "address",
  "country",
  "department",
  "municipality",
  "role",
  "newPassword",
] as const satisfies readonly (keyof UserFormValues)[];

/** Server messages that belong under a specific field (sige/03 §4.1). */
export const USER_FIELD_BY_MESSAGE: Readonly<Record<string, keyof UserFormValues>> = {
  "Ya existe un usuario con este documento.": "documentNumber",
  "Ya existe un usuario con este correo.": "email",
  "Solo la plataforma puede crear administradores.": "role",
};

export const USER_CREATE_FALLBACK = "No se pudo crear el usuario. Intente nuevamente.";
export const USER_UPDATE_FALLBACK = "No se pudo actualizar el usuario. Intente nuevamente.";

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  TI: "TI - Tarjeta de Identidad",
  CC: "CC - Cédula de Ciudadanía",
  RC: "RC - Registro Civil",
  CE: "CE - Cédula de Extranjería",
  Pasaporte: "Pasaporte",
};

export const DOCUMENT_TYPE_OPTIONS: Option[] = DOCUMENT_TYPES.map((type) => ({
  value: type,
  label: DOCUMENT_TYPE_LABELS[type],
}));

export const GENDER_OPTIONS: Option[] = [
  { value: "", label: "No especificado" },
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "Otro", label: "Otro" },
];

const COUNTRIES = ["Colombia", "México", "Venezuela", "Ecuador", "Perú", "Otro"] as const;

/**
 * Country choices: the spec's list, a leading blank when the user has none, and the stored value
 * itself when it is not in the list (so an imported value is never silently replaced).
 */
export function countryOptions(current: string): Option[] {
  const known: Option[] = COUNTRIES.map((country) => ({ value: country, label: country }));
  const extra: Option[] =
    current !== "" && !COUNTRIES.some((country) => country === current)
      ? [{ value: current, label: current }]
      : [];
  return [{ value: "", label: "No especificado" }, ...known, ...extra];
}

/** `?role=` of `/usuarios/nuevo`: an assignable role, anything else is ignored. */
export const userCreateSearchSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES).optional().catch(undefined),
});
