import { describe, expect, test } from "bun:test";

import { describeDeleteFailure, isHasDependentsError } from "./delete-failure";

describe("isHasDependentsError", () => {
  test("matches the oRPC code only", () => {
    expect(isHasDependentsError({ code: "HAS_DEPENDENTS" })).toBe(true);
    expect(isHasDependentsError({ code: "CONFLICT" })).toBe(false);
    expect(isHasDependentsError(new Error("HAS_DEPENDENTS"))).toBe(false);
    expect(isHasDependentsError(null)).toBe(false);
  });
});

describe("describeDeleteFailure", () => {
  test("shows the server message under the blocked title for HAS_DEPENDENTS", () => {
    expect(
      describeDeleteFailure("Sede Norte", {
        code: "HAS_DEPENDENTS",
        message: "La sede tiene niveles o grados asociados.",
      }),
    ).toEqual({
      title: "No se puede eliminar Sede Norte",
      description: "La sede tiene niveles o grados asociados.",
      blockedByDependents: true,
    });
  });

  test("uses a generic failure for other errors", () => {
    expect(describeDeleteFailure("Sede Norte", new Error("Network down"))).toEqual({
      title: "No se pudo eliminar Sede Norte",
      description: "Network down",
      blockedByDependents: false,
    });
  });

  test("falls back when the error has no usable message", () => {
    const failure = describeDeleteFailure("Sede Norte", { code: "HAS_DEPENDENTS", message: " " });
    expect(failure.description).toBe("Intente de nuevo en unos minutos.");
    expect(describeDeleteFailure("Sede Norte", undefined).blockedByDependents).toBe(false);
  });
});
