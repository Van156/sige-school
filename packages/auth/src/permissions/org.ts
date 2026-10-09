import { SIGE_ROLE_GRANTS, SIGE_STATEMENTS } from "@base-template/sige-core/permissions";
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc as orgBuiltInAdminAc,
  defaultStatements as orgDefaultStatements,
  memberAc as orgBuiltInMemberAc,
  ownerAc as orgBuiltInOwnerAc,
} from "better-auth/plugins/organization/access";

/** Strips better-auth's `team` key: teams are out of scope (spec §2), though its built-in role statements include them. */
function withoutTeam<T extends Record<string, readonly string[]>>(statements: T): Omit<T, "team"> {
  const result: Record<string, readonly string[]> = {};
  for (const [key, value] of Object.entries(statements)) {
    if (key !== "team") {
      result[key] = value;
    }
  }
  return result as Omit<T, "team">;
}

/**
 * Org-scoped permission catalog: better-auth's organization defaults plus `audit` (R7) and
 * `project` (an example feature, not meant to be kept) and the SIGE features (spec sige/00 §4.2,
 * owned by `@base-template/sige-core`). Adding a feature means adding a key here
 * and granting it to the roles below; no migration (spec §4.2).
 */
export const orgStatements = {
  ...withoutTeam(orgDefaultStatements),
  audit: ["read"],
  project: ["create", "read", "update", "delete"],
  ...SIGE_STATEMENTS,
} as const;

export const orgAc = createAccessControl(orgStatements);

/** Built-in, immutable org role (R4.4): full control, including audit and project. */
export const owner = orgAc.newRole({
  ...withoutTeam(orgBuiltInOwnerAc.statements),
  audit: ["read"],
  project: ["create", "read", "update", "delete"],
  ...SIGE_ROLE_GRANTS.owner,
});

/** Built-in, immutable org role (R4.4): manages members/invitations; no owner-only actions. */
export const admin = orgAc.newRole({
  ...withoutTeam(orgBuiltInAdminAc.statements),
  audit: ["read"],
  project: ["create", "read", "update", "delete"],
  ...SIGE_ROLE_GRANTS.admin,
});

/** Built-in, immutable org role (R4.4): read-only project access, no audit access. */
export const member = orgAc.newRole({
  ...withoutTeam(orgBuiltInMemberAc.statements),
  project: ["read"],
});

/**
 * SIGE built-in roles (spec sige/00 R1.4). They hold SIGE feature grants only, never template
 * org-management statements (`organization`, `member`, `invitation`, `ac`, `audit`). Row-level
 * scope (own courses, own children) is enforced by `ScopePolicy`, not here (spec §4.3).
 */
export const coordinator = orgAc.newRole({ ...SIGE_ROLE_GRANTS.coordinator });
export const teacher = orgAc.newRole({ ...SIGE_ROLE_GRANTS.teacher });
export const student = orgAc.newRole({ ...SIGE_ROLE_GRANTS.student });
export const parent = orgAc.newRole({ ...SIGE_ROLE_GRANTS.parent });
export const viewer = orgAc.newRole({ ...SIGE_ROLE_GRANTS.viewer });

/** Convenience map for better-auth's `organization({ roles })` option */
export const orgRoles = {
  owner,
  admin,
  member,
  coordinator,
  teacher,
  student,
  parent,
  viewer,
} as const;
