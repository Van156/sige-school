import { describe, expect, test } from "bun:test";

import { resolveCallerAccess } from "./caller-access";
import { buildRoleCatalog } from "./role-catalog";

const catalog = buildRoleCatalog([{ role: "viewer", permission: { project: ["read"] } }]);

describe("resolveCallerAccess", () => {
  test("fails closed while the caller's role is unresolved", () => {
    expect(resolveCallerAccess(catalog, undefined)).toEqual({
      callerPermission: null,
      assignable: [],
    });
  });

  test("fails closed when no role name resolves", () => {
    expect(resolveCallerAccess(catalog, "ghost")).toEqual({
      callerPermission: null,
      assignable: [],
    });
  });

  test("an owner may assign every role whose permissions it holds", () => {
    const { callerPermission, assignable } = resolveCallerAccess(catalog, "owner");
    expect(callerPermission).not.toBeNull();
    // SIGE spec §4.2 gives owner/admin no `portal` and no `metric:read_own`, so the UX-only
    // no-escalation check hides `teacher`, `student` and `parent`. Those users are created by
    // provisioning (sige/03), not by role assignment from this screen.
    expect(assignable.map((role) => role.name)).toEqual(
      catalog
        .map((role) => role.name)
        .filter((name) => !["teacher", "student", "parent"].includes(name)),
    );
  });

  test("a member may only assign roles within their own permissions", () => {
    const { assignable } = resolveCallerAccess(catalog, "member");
    expect(assignable.map((role) => role.name)).not.toContain("owner");
    expect(assignable.map((role) => role.name)).toContain("member");
  });

  test("a member may assign a custom role whose permissions they already hold", () => {
    const { assignable } = resolveCallerAccess(catalog, "member");
    expect(assignable.find((role) => role.name === "viewer")?.builtIn).toBe(false);
  });
});
