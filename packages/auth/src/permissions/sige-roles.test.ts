import { describe, expect, test } from "bun:test";
import { SIGE_ROLE_GRANTS, SIGE_STATEMENTS } from "@base-template/sige-core/permissions";

import { BUILT_IN_ORG_ROLES, isBuiltInOrgRole, listCatalogPermissions } from "./helpers";
import { orgRoles, orgStatements } from "./org";
import { platformRoles, platformStatements } from "./platform";

describe("SIGE permissions wired into orgStatements", () => {
  test("every SIGE feature and action is in the org catalog", () => {
    for (const [feature, actions] of Object.entries(SIGE_STATEMENTS)) {
      expect((orgStatements as Record<string, readonly string[]>)[feature]).toEqual([...actions]);
    }
    expect(listCatalogPermissions()).toContain("grade:write");
    expect(listCatalogPermissions()).toContain("portal:read_child");
  });

  test("template statements stay", () => {
    expect(orgStatements.audit).toEqual(["read"]);
    expect(orgStatements.project).toEqual(["create", "read", "update", "delete"]);
  });
});

describe("built-in SIGE roles", () => {
  test("are registered as built-in, immutable roles", () => {
    expect([...BUILT_IN_ORG_ROLES]).toEqual([
      "owner",
      "admin",
      "member",
      "coordinator",
      "teacher",
      "student",
      "parent",
      "viewer",
    ]);
    expect(Object.keys(orgRoles)).toEqual([...BUILT_IN_ORG_ROLES]);
    expect(isBuiltInOrgRole("teacher")).toBe(true);
    expect(isBuiltInOrgRole("root")).toBe(false);
  });

  // Table-driven: one case per (role, feature, action) of the catalog, decided by the §4.2 grants.
  for (const role of Object.keys(SIGE_ROLE_GRANTS) as (keyof typeof SIGE_ROLE_GRANTS)[]) {
    test(`${role} holds exactly its §4.2 grants`, () => {
      const grants = SIGE_ROLE_GRANTS[role] as Record<string, readonly string[]>;
      for (const [feature, actions] of Object.entries(SIGE_STATEMENTS)) {
        for (const action of actions) {
          const expected = grants[feature]?.includes(action) ?? false;
          const actual = orgRoles[role].authorize({ [feature]: [action] } as never).success;
          expect({ role, feature, action, actual }).toEqual({
            role,
            feature,
            action,
            actual: expected,
          });
        }
      }
    });
  }

  test("owner keeps org lifecycle powers that admin lacks; SIGE roles have none", () => {
    expect(orgRoles.owner.authorize({ organization: ["delete"] }).success).toBe(true);
    expect(orgRoles.admin.authorize({ organization: ["delete"] }).success).toBe(false);
    for (const role of ["coordinator", "teacher", "student", "parent", "viewer"] as const) {
      expect(orgRoles[role].authorize({ organization: ["update"] }).success).toBe(false);
      expect(orgRoles[role].authorize({ member: ["create"] }).success).toBe(false);
      expect(orgRoles[role].authorize({ audit: ["read"] }).success).toBe(false);
      expect(orgRoles[role].authorize({ ac: ["read"] }).success).toBe(false);
    }
  });

  test("an unknown role is not part of the registry", () => {
    expect((orgRoles as Record<string, unknown>).janitor).toBeUndefined();
  });
});

describe("platform catalog", () => {
  test("superadmin holds institution and qr:simulate; user holds none", () => {
    expect(platformStatements.institution).toEqual([
      "read",
      "create",
      "update",
      "delete",
      "manage_users",
    ]);
    expect(
      platformRoles.superadmin.authorize({
        institution: ["read", "create", "update", "delete", "manage_users"],
        qr: ["simulate"],
      }).success,
    ).toBe(true);
    expect(platformRoles.user.authorize({ institution: ["read"] }).success).toBe(false);
    expect(platformRoles.user.authorize({ qr: ["simulate"] }).success).toBe(false);
  });
});
