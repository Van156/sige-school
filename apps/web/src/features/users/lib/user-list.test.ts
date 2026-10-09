import { userListConfig } from "@base-template/api/lib/user-list-config";
import { describe, expect, test } from "bun:test";

import {
  hasActiveFilters,
  hasNoUsers,
  toUserListInput,
  userListDescription,
  userListTitle,
  userRowAccess,
  userSearchConfig,
  userSearchDefaults,
  userSearchSchema,
} from "./user-list";

describe("user search config", () => {
  test("columns are sortable on the server and filters mirror its allowlist", () => {
    for (const id of userSearchConfig.columnIds) {
      expect([...userListConfig.sortableColumns]).toContain(id);
    }
    expect([...userSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(userListConfig.filterableColumns).sort(),
    );
  });

  test("defaults: newest first, 20 per page, no filters", () => {
    expect(userSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
    });
  });
});

describe("userSearchSchema", () => {
  test("keeps valid role and status filters", () => {
    expect(
      userSearchSchema.parse({ role: "teacher", status: "active", name: "ana" }),
    ).toMatchObject({ role: "teacher", status: "active", name: "ana" });
  });

  test("drops a role or status the server would reject", () => {
    const search = userSearchSchema.parse({ role: "root", status: "gone" });
    expect(search).not.toHaveProperty("role");
    expect(search).not.toHaveProperty("status");
  });
});

describe("toUserListInput", () => {
  test("turns the simple filters into list-input filters", () => {
    const input = toUserListInput(userSearchSchema.parse({ role: "admin", name: "ana" }));
    expect(input.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "role", value: "admin", operator: "eq" }),
        expect.objectContaining({ id: "name", value: "ana" }),
      ]),
    );
  });
});

describe("header copy", () => {
  test("title follows the role filter", () => {
    expect(userListTitle(undefined)).toBe("Gestión de Usuarios");
    expect(userListTitle("teacher")).toBe("Profesores");
    expect(userListTitle("viewer")).toBe("Usuarios de Consulta");
    expect(userListTitle("unknown")).toBe("Gestión de Usuarios");
  });

  test("description names the filter or the institution", () => {
    expect(userListDescription("parent", "Colegio")).toBe("Mostrando acudientes");
    expect(userListDescription(undefined, "Colegio")).toBe("Usuarios de Colegio");
    expect(userListDescription(undefined, undefined)).toBe("Usuarios de tu institución");
  });
});

describe("empty states", () => {
  test("hasNoUsers waits for stats and ignores filters", () => {
    expect(hasNoUsers(undefined)).toBe(false);
    expect(hasNoUsers({ total: 0 })).toBe(true);
    expect(hasNoUsers({ total: 3 })).toBe(false);
  });

  test("hasActiveFilters sees URL filters", () => {
    expect(hasActiveFilters(userSearchDefaults)).toBe(false);
    expect(hasActiveFilters(userSearchSchema.parse({ status: "inactive" }))).toBe(true);
  });
});

describe("userRowAccess", () => {
  const all = { canUpdate: true, canDelete: true };

  test("a regular row gets every permitted action", () => {
    expect(userRowAccess({ role: "teacher", isSelf: false }, all)).toEqual({
      canActivate: true,
      canDelete: true,
    });
  });

  test("owner, admin and own rows get none (USR-R4)", () => {
    for (const row of [
      { role: "owner", isSelf: false },
      { role: "admin", isSelf: false },
      { role: "teacher", isSelf: true },
    ]) {
      expect(userRowAccess(row, all)).toEqual({ canActivate: false, canDelete: false });
    }
  });

  test("missing permissions hide the matching action only", () => {
    const row = { role: "student", isSelf: false };
    expect(userRowAccess(row, { canUpdate: false, canDelete: true })).toEqual({
      canActivate: false,
      canDelete: true,
    });
    expect(userRowAccess(row, { canUpdate: true, canDelete: false })).toEqual({
      canActivate: true,
      canDelete: false,
    });
  });
});
