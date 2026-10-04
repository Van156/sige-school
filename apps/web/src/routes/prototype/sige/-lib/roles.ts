import type { Role } from "../-mock/types";

export const ROLES: readonly Role[] = [
  "root",
  "admin",
  "coordinator",
  "teacher",
  "parent",
  "student",
  "viewer",
];

export const DEFAULT_ROLE: Role = "admin";

/** Spanish labels (inventory 1.1). */
export const ROLE_LABEL: Record<Role, string> = {
  root: "Root",
  admin: "Administrador",
  coordinator: "Coordinador",
  teacher: "Profesor",
  student: "Estudiante",
  parent: "Acudiente",
  viewer: "Consulta",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  root: "Todas las instituciones",
  admin: "Rector de la institución",
  coordinator: "Supervisión académica",
  teacher: "Sus asignaturas y grupos",
  student: "Sus propios datos",
  parent: "Sus acudidos",
  viewer: "Solo lectura",
};

export function parseRole(value: unknown): Role {
  return ROLES.find((role) => role === value) ?? DEFAULT_ROLE;
}

export type BadgeTone =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "outline";

/** Role badge tone: semantic variants only. */
export const ROLE_TONE: Record<Role, BadgeTone> = {
  root: "default",
  admin: "success",
  coordinator: "info",
  teacher: "warning",
  student: "secondary",
  parent: "secondary",
  viewer: "outline",
};
