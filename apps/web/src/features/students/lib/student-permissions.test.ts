import { parsePermissionString } from "@base-template/auth/permissions";
import { describe, expect, test } from "bun:test";

import { resolveNavPermissions } from "@/app/navigation";

import { STUDENT_PERMISSIONS } from "./student-permissions";

/** The real built-in role grants, resolved the way the web resolves them for the sidebar. */
function allowed(roleName: string): string[] {
  const permissions = resolveNavPermissions({ roleName }, undefined);
  return Object.entries(STUDENT_PERMISSIONS)
    .filter(([, permission]) => {
      const { feature, action } = parsePermissionString(permission);
      return permissions?.[feature]?.includes(action) ?? false;
    })
    .map(([key]) => key);
}

const STUDENT_MODULE_ACTIONS = ["list", "create", "update", "delete", "guardians", "import"];

describe("STUDENT_PERMISSIONS per built-in role (sige/00 §4.2, sige/05 §2)", () => {
  test.each(["owner", "admin"])("a %s may use every STU-01…05 action", (name) => {
    expect(allowed(name)).toEqual(Object.keys(STUDENT_PERMISSIONS));
  });

  test("a coordinator manages students but not user accounts (G-STU-4)", () => {
    expect(allowed("coordinator")).toEqual([...STUDENT_MODULE_ACTIONS, "courseSchedule"]);
  });

  test("a teacher only reads students (their scope, STU-R1)", () => {
    expect(allowed("teacher")).toEqual(["list"]);
  });

  test.each(["student", "parent", "viewer"])("a %s holds no STU action", (name) => {
    expect(allowed(name)).toEqual([]);
  });
});
