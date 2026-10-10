import { describe, expect, test } from "bun:test";

import { holds, resolveNavPermissions } from "@/app/navigation";

import { academicProfileAction } from "./user-academic-profile";

const full = { canViewStudent: true, canCompleteProfile: true };
const student = { role: "student", personId: "p1", studentId: "s1" };

describe("academicProfileAction", () => {
  test("a student with a profile links to STU-02", () => {
    expect(academicProfileAction(student, full)).toEqual({ kind: "view", studentId: "s1" });
  });

  test("a student without a profile links to STU-03 complete", () => {
    expect(academicProfileAction({ ...student, studentId: null }, full)).toEqual({
      kind: "complete",
      personId: "p1",
    });
  });

  test.each(["teacher", "parent", "coordinator", "viewer", "secretaria"])(
    "a %s has no academic profile link",
    (role) => {
      expect(academicProfileAction({ ...student, role }, full)).toBeNull();
    },
  );

  test("each link needs the permission of the page it opens", () => {
    expect(
      academicProfileAction(student, { canViewStudent: false, canCompleteProfile: true }),
    ).toBeNull();
    expect(
      academicProfileAction(
        { ...student, studentId: null },
        { canViewStudent: true, canCompleteProfile: false },
      ),
    ).toBeNull();
  });
});

describe("academic profile links per built-in role (sige/00 §4.2)", () => {
  const access = (roleName: string) => {
    const ctx = {
      isSuperadmin: false,
      hasOrganization: true,
      kind: null,
      permissions: resolveNavPermissions({ roleName }, undefined),
    };
    return {
      // USR-02/03 themselves need these; the links only matter to callers who reach them.
      reachesUserScreens: holds(ctx, "user:create") && holds(ctx, "user:update"),
      canViewStudent: holds(ctx, "student:read"),
      canCompleteProfile: holds(ctx, "student:create"),
    };
  };

  test.each(["owner", "admin"])("a %s reaches USR-02/03 and gets both links", (name) => {
    const { reachesUserScreens, ...links } = access(name);
    expect(reachesUserScreens).toBe(true);
    expect(academicProfileAction(student, links)).toEqual({ kind: "view", studentId: "s1" });
    expect(academicProfileAction({ ...student, studentId: null }, links)).toEqual({
      kind: "complete",
      personId: "p1",
    });
  });

  test.each(["coordinator", "teacher", "student", "parent", "viewer"])(
    "a %s never reaches USR-02/03",
    (name) => {
      expect(access(name).reachesUserScreens).toBe(false);
    },
  );
});
