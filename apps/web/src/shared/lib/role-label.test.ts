import { describe, expect, test } from "bun:test";

import { formatRoleLabel, roleKindLabel, roleKindTone } from "./role-label";

describe("formatRoleLabel", () => {
  test("returns a single role as is", () => {
    expect(formatRoleLabel("owner")).toBe("owner");
  });

  test("normalizes comma-separated roles with whitespace", () => {
    expect(formatRoleLabel("admin,  member ,owner")).toBe("admin, member, owner");
  });

  test("returns undefined when there is no role", () => {
    expect(formatRoleLabel(undefined)).toBeUndefined();
    expect(formatRoleLabel(null)).toBeUndefined();
    expect(formatRoleLabel("")).toBeUndefined();
    expect(formatRoleLabel(" , ")).toBeUndefined();
  });
});

describe("roleKindLabel and roleKindTone", () => {
  test("owner and admin both read as Administrador with the success tone", () => {
    expect(roleKindLabel("owner")).toBe("Administrador");
    expect(roleKindLabel("admin")).toBe("Administrador");
    expect(roleKindTone("owner")).toBe("success");
    expect(roleKindTone("admin")).toBe("success");
  });

  test("labels and tones follow the spec table", () => {
    expect(roleKindLabel("root")).toBe("Root");
    expect(roleKindTone("root")).toBe("default");
    expect(roleKindLabel("coordinator")).toBe("Coordinador");
    expect(roleKindTone("coordinator")).toBe("info");
    expect(roleKindLabel("teacher")).toBe("Profesor");
    expect(roleKindTone("teacher")).toBe("warning");
    expect(roleKindLabel("student")).toBe("Estudiante");
    expect(roleKindLabel("parent")).toBe("Acudiente");
    expect(roleKindTone("parent")).toBe("secondary");
    expect(roleKindLabel("viewer")).toBe("Consulta");
    expect(roleKindTone("viewer")).toBe("outline");
  });
});
