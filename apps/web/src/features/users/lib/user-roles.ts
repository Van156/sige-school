import { SIGE_KINDS } from "@base-template/sige-core";

import type { RoleKind } from "@/shared/lib/role-label";

/** Roles an institution admin can create (sige/03 USR-02 role select, "Rol *"). */
export const ASSIGNABLE_ROLES = [
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
] as const satisfies readonly RoleKind[];

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Roles of the USR-01 "Rol" filter: the assignable ones plus `admin` (owner and admin, D3). */
export const ROLE_FILTER_TOKENS = [
  "admin",
  ...ASSIGNABLE_ROLES,
] as const satisfies readonly RoleKind[];

/** Roles only the platform manages for an institution (USR-R4). */
const PROTECTED_ROLES: ReadonlySet<string> = new Set(["owner", "admin"]);

/** USR-R4: org callers cannot edit, deactivate or delete `owner`/`admin` rows. UX only. */
export function isProtectedRole(role: string): boolean {
  return PROTECTED_ROLES.has(role);
}

const KNOWN_KINDS: ReadonlySet<string> = new Set(SIGE_KINDS);

/** The display kind of a `member.role` name; anything that is not a built-in kind is `custom`. */
export function toRoleKind(role: string): RoleKind {
  return KNOWN_KINDS.has(role) ? (role as RoleKind) : "custom";
}
