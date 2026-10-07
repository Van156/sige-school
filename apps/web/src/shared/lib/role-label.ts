/**
 * Display label for a member role string. better-auth stores multiple roles as one
 * comma-separated string; returns `undefined` when there is nothing to show.
 */
export function formatRoleLabel(role: string | null | undefined): string | undefined {
  const label = role
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  return label || undefined;
}

/** Who the signed-in user is for display: a SIGE `kind` from `me.get`, or `root` for a platform superadmin. */
export type RoleKind =
  | "root"
  | "owner"
  | "admin"
  | "coordinator"
  | "teacher"
  | "student"
  | "parent"
  | "viewer"
  | "custom";

/** Spanish role names (sige/01 §5.2); owner and admin share "Administrador". */
const ROLE_KIND_LABELS: Record<RoleKind, string> = {
  root: "Root",
  owner: "Administrador",
  admin: "Administrador",
  coordinator: "Coordinador",
  teacher: "Profesor",
  student: "Estudiante",
  parent: "Acudiente",
  viewer: "Consulta",
  custom: "Personalizado",
};

export function roleKindLabel(kind: RoleKind): string {
  return ROLE_KIND_LABELS[kind];
}

/** `Badge` variants the role badge uses. */
export type RoleBadgeTone = "default" | "success" | "info" | "warning" | "secondary" | "outline";

/** Role badge colours (sige/01 §5.2 `ROLE_TONE`). */
const ROLE_KIND_TONES: Record<RoleKind, RoleBadgeTone> = {
  root: "default",
  owner: "success",
  admin: "success",
  coordinator: "info",
  teacher: "warning",
  student: "secondary",
  parent: "secondary",
  viewer: "outline",
  custom: "outline",
};

export function roleKindTone(kind: RoleKind): RoleBadgeTone {
  return ROLE_KIND_TONES[kind];
}
