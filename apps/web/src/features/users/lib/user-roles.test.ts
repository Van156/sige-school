import { describe, expect, test } from "bun:test";

import { ASSIGNABLE_ROLES, ROLE_FILTER_TOKENS, isProtectedRole, toRoleKind } from "./user-roles";

describe("toRoleKind", () => {
  test("keeps built-in kinds", () => {
    expect(toRoleKind("teacher")).toBe("teacher");
    expect(toRoleKind("owner")).toBe("owner");
  });

  test("maps any other role name to custom", () => {
    expect(toRoleKind("librarian")).toBe("custom");
    expect(toRoleKind("")).toBe("custom");
  });
});

describe("isProtectedRole", () => {
  test("owner and admin rows are protected from org callers (USR-R4)", () => {
    expect(isProtectedRole("owner")).toBe(true);
    expect(isProtectedRole("admin")).toBe(true);
    expect(isProtectedRole("teacher")).toBe(false);
  });
});

describe("role lists", () => {
  test("admins cannot assign admin or owner", () => {
    expect(ASSIGNABLE_ROLES as readonly string[]).not.toContain("admin");
    expect(ASSIGNABLE_ROLES as readonly string[]).not.toContain("owner");
  });

  test("the filter adds the admin token to the assignable roles", () => {
    expect([...ROLE_FILTER_TOKENS]).toEqual(["admin", ...ASSIGNABLE_ROLES]);
  });
});
