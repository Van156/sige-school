import { parsePermissionString } from "@base-template/auth/permissions";
import { describe, expect, test } from "bun:test";

import { resolveNavPermissions } from "@/app/navigation";

import { ENROLLMENT_ACTIONS } from "./enrollment-permissions";

/** The real built-in role grants, resolved the way the web resolves them for the sidebar. */
const role = (roleName: string) => resolveNavPermissions({ roleName }, undefined);

function allowed(roleName: string): string[] {
  const permissions = role(roleName);
  return Object.entries(ENROLLMENT_ACTIONS)
    .filter(([, permission]) => {
      const { feature, action } = parsePermissionString(permission);
      return permissions?.[feature]?.includes(action) ?? false;
    })
    .map(([key]) => key);
}

describe("ENROLLMENT_ACTIONS per built-in role (SCH-R1)", () => {
  test.each(["owner", "admin", "coordinator"])("a %s may use every SCH-01/02 action", (name) => {
    expect(allowed(name)).toEqual(Object.keys(ENROLLMENT_ACTIONS));
  });

  test.each(["teacher", "student", "parent", "viewer"])(
    "a %s holds no enrollment grant",
    (name) => {
      expect(allowed(name).filter((key) => key !== "viewStudents")).toEqual([]);
    },
  );
});
