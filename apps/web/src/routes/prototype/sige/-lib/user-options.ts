import type { DocType, Role, User } from "../-mock/types";
import { ROLE_LABEL } from "./roles";

export interface Option {
  value: string;
  label: string;
}

export const DOC_TYPE_OPTIONS: readonly Option[] = [
  { value: "TI", label: "TI - Tarjeta de Identidad" },
  { value: "CC", label: "CC - Cédula de Ciudadanía" },
  { value: "RC", label: "RC - Registro Civil" },
  { value: "CE", label: "CE - Cédula de Extranjería" },
];

/** Document types offered when creating institution staff (no minors' documents). */
export const STAFF_DOC_TYPE_OPTIONS: readonly Option[] = DOC_TYPE_OPTIONS.filter((option) =>
  ["CC", "TI", "CE"].includes(option.value),
);

export const GENDER_OPTIONS: readonly Option[] = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "Otro", label: "Otro" },
];

export const COUNTRY_OPTIONS: readonly Option[] = [
  "Colombia",
  "México",
  "Venezuela",
  "Ecuador",
  "Perú",
  "Otro",
].map((country) => ({ value: country, label: country }));

export const ROLE_DESCRIPTION_LONG: Record<Role, string> = {
  root: "Super-administrador: acceso total a todas las instituciones",
  admin:
    "Administrador: gestiona toda su institución (sedes, grados, usuarios, estudiantes, notas)",
  coordinator: "Supervisión académica: ve notas, boletines, métricas y alertas",
  teacher: "Gestiona notas, asistencia y observaciones de sus grupos",
  student: "Consulta sus notas, asistencia y boletines",
  parent: "Portal de padres: ve información de sus acudidos",
  viewer: "Solo lectura: consulta general",
};

const ALL_ROLES: readonly Role[] = [
  "root",
  "admin",
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
];

export function roleOptions(roles: readonly Role[]): Option[] {
  return roles.map((role) => ({ value: role, label: ROLE_LABEL[role] }));
}

/** Roles a creator may assign: root any; admin everything except root and admin (inventory USR-02). */
export function assignableRoles(creator: Role): readonly Role[] {
  return creator === "root"
    ? ALL_ROLES
    : ALL_ROLES.filter((role) => role !== "root" && role !== "admin");
}

export function isRole(value: string): value is Role {
  return (ALL_ROLES as readonly string[]).includes(value);
}

export function isDocType(value: string): value is DocType {
  return DOC_TYPE_OPTIONS.some((option) => option.value === value);
}

export interface NewUserInput {
  username: string;
  firstName: string;
  lastName: string;
  documentType: DocType;
  documentNumber: string;
  role: Role;
  institutionId?: number;
  email?: string;
  phone?: string;
  createdAt: string;
}

/** New accounts start active with the document as password, so the first login forces a change. */
export function newUserRecord(input: NewUserInput): Omit<User, "id"> {
  return { ...input, isActive: true, mustChangePassword: true };
}

export function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function toGender(value: string): User["gender"] {
  return value === "M" || value === "F" || value === "Otro" ? value : undefined;
}
