import { describe, expect, test } from "bun:test";
import { SIGE_AUDIT_ACTIONS } from "@base-template/sige-core/audit-actions";

import { ORGANIZATION_AUDIT_ACTIONS, PLATFORM_AUDIT_ACTIONS, USER_AUDIT_ACTIONS } from "./actions";

describe("audit action registry", () => {
  test("organization scope contains every SIGE action and keeps the template ones", () => {
    for (const action of SIGE_AUDIT_ACTIONS) {
      expect(ORGANIZATION_AUDIT_ACTIONS as readonly string[]).toContain(action);
    }
    expect(ORGANIZATION_AUDIT_ACTIONS as readonly string[]).toContain("member.role_changed");
    expect(ORGANIZATION_AUDIT_ACTIONS as readonly string[]).not.toContain("grade.deleted");
  });

  test("organization scope has no duplicates", () => {
    expect(new Set(ORGANIZATION_AUDIT_ACTIONS).size).toBe(ORGANIZATION_AUDIT_ACTIONS.length);
  });

  test("platform and user scopes are untouched by SIGE", () => {
    expect(PLATFORM_AUDIT_ACTIONS).toHaveLength(6);
    expect(USER_AUDIT_ACTIONS).toHaveLength(5);
  });
});
