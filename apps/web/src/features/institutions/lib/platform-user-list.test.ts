import { describe, expect, test } from "bun:test";

import { userSearchDefaults } from "@/features/users";

import {
  canEditThroughImpersonation,
  hasNoPlatformUsers,
  platformStatTiles,
  toPlatformUserListInput,
} from "./platform-user-list";

describe("toPlatformUserListInput", () => {
  test("fixes the institution on the shared user list input", () => {
    const input = toPlatformUserListInput("inst-1", {
      ...userSearchDefaults,
      name: "ana",
    } as typeof userSearchDefaults);
    expect(input.institutionId).toBe("inst-1");
    expect(input.page).toBe(1);
    expect(input.perPage).toBe(20);
    expect(JSON.stringify(input.filters)).toContain("ana");
  });
});

describe("platformStatTiles", () => {
  test("lists the four tiles of the spec with their counts", () => {
    expect(
      platformStatTiles({ admins: 2, coordinators: 1, teachers: 30, students: 400 }, false),
    ).toEqual([
      { label: "Administradores", value: "2" },
      { label: "Coordinadores", value: "1" },
      { label: "Profesores", value: "30" },
      { label: "Estudiantes", value: "400" },
    ]);
  });

  test("shows a dash while pending and a hint when failed, never a 0", () => {
    expect(platformStatTiles(undefined, false)[0]).toEqual({
      label: "Administradores",
      value: "—",
    });
    expect(platformStatTiles(undefined, true)[3]).toEqual({
      label: "Estudiantes",
      value: "—",
      hint: "No disponible",
    });
  });
});

describe("hasNoPlatformUsers", () => {
  test("is empty only for an unfiltered list with no rows", () => {
    expect(hasNoPlatformUsers(0, false)).toBe(true);
    expect(hasNoPlatformUsers(0, true)).toBe(false);
    expect(hasNoPlatformUsers(3, false)).toBe(false);
    expect(hasNoPlatformUsers(undefined, false)).toBe(false);
  });
});

describe("canEditThroughImpersonation", () => {
  test("is not offered on owner and admin rows", () => {
    expect(canEditThroughImpersonation({ role: "owner" })).toBe(false);
    expect(canEditThroughImpersonation({ role: "admin" })).toBe(false);
    expect(canEditThroughImpersonation({ role: "teacher" })).toBe(true);
  });
});
