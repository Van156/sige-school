import { describe, expect, test } from "bun:test";

import { createListInput } from "./list-input";
import { userListConfig, USER_ROLE_FILTERS } from "./user-list-config";

const users = createListInput(userListConfig);

const filter = (id: string, variant: string, operator: string, value: string) => ({
  filters: [{ id, variant, operator, value }],
});

describe("userListConfig (sige/03 §3.3)", () => {
  test("defaults to createdAt descending", () => {
    expect(users.parse({}).sort).toEqual([{ id: "createdAt", desc: true }]);
  });

  test("sorts by the six USR-01 columns and by nothing else", () => {
    for (const id of ["username", "name", "role", "status", "createdAt", "lastLoginAt"]) {
      expect(users.safeParse({ sort: [{ id, desc: false }] }).success).toBe(true);
    }
    expect(users.safeParse({ sort: [{ id: "organizationId", desc: false }] }).success).toBe(false);
    expect(users.safeParse({ sort: [{ id: "email", desc: false }] }).success).toBe(false);
  });

  test("filters name and username as text, role and status as selects", () => {
    expect(users.safeParse(filter("name", "text", "iLike", "ana")).success).toBe(true);
    expect(users.safeParse(filter("username", "text", "iLike", "ana")).success).toBe(true);
    expect(users.safeParse(filter("status", "select", "eq", "active")).success).toBe(true);
    expect(users.safeParse(filter("status", "select", "eq", "inactive")).success).toBe(true);
    expect(users.safeParse(filter("status", "select", "eq", "banned")).success).toBe(false);
    expect(users.safeParse(filter("email", "text", "iLike", "a")).success).toBe(false);
    expect(users.safeParse(filter("organizationId", "text", "eq", "org")).success).toBe(false);
  });

  test("role accepts the six spec tokens (admin stands for owner and admin), not owner", () => {
    expect(USER_ROLE_FILTERS).toEqual([
      "admin",
      "coordinator",
      "teacher",
      "student",
      "parent",
      "viewer",
    ]);
    for (const role of USER_ROLE_FILTERS) {
      expect(users.safeParse(filter("role", "select", "eq", role)).success).toBe(true);
    }
    expect(users.safeParse(filter("role", "select", "eq", "owner")).success).toBe(false);
    expect(users.safeParse(filter("role", "select", "eq", "teacher,parent")).success).toBe(false);
  });
});
