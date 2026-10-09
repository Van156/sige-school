import { describe, expect, test } from "bun:test";

import {
  emailAvailability,
  emailAvailabilityText,
  emailCheckCandidate,
} from "./email-availability";

const settled = { pending: false, isFetching: false, isError: false, error: null } as const;

describe("emailCheckCandidate", () => {
  test("normalises a valid address like the server", () => {
    expect(emailCheckCandidate("  Ana@Colegio.edu.co ")).toBe("ana@colegio.edu.co");
  });

  test("blank or invalid addresses are not checked", () => {
    expect(emailCheckCandidate("")).toBeNull();
    expect(emailCheckCandidate("ana@")).toBeNull();
  });
});

describe("emailAvailability", () => {
  test("nothing to check is idle", () => {
    expect(emailAvailability({ ...settled, candidate: null, data: { available: false } })).toEqual({
      status: "idle",
    });
  });

  test("a pending debounce or an in-flight request reads as checking", () => {
    const base = { candidate: "a@b.co", data: undefined };
    expect(emailAvailability({ ...settled, ...base, pending: true })).toEqual({
      status: "checking",
    });
    expect(emailAvailability({ ...settled, ...base, isFetching: true })).toEqual({
      status: "checking",
    });
  });

  test("maps the server answer", () => {
    const base = { ...settled, candidate: "a@b.co" };
    expect(emailAvailability({ ...base, data: { available: true } })).toEqual({
      status: "available",
    });
    expect(emailAvailability({ ...base, data: { available: false } })).toEqual({
      status: "taken",
    });
  });

  test("a failed check carries the server message, e.g. the rate limit", () => {
    const state = emailAvailability({
      ...settled,
      candidate: "a@b.co",
      isError: true,
      error: { message: "Demasiadas verificaciones. Intenta de nuevo en un momento." },
      data: undefined,
    });
    expect(state).toEqual({
      status: "unknown",
      message: "Demasiadas verificaciones. Intenta de nuevo en un momento.",
    });
    expect(emailAvailabilityText(state)).toBe(
      "Demasiadas verificaciones. Intenta de nuevo en un momento.",
    );
  });

  test("falls back when the failure has no message", () => {
    expect(
      emailAvailability({
        ...settled,
        candidate: "a@b.co",
        isError: true,
        error: null,
        data: undefined,
      }),
    ).toEqual({ status: "unknown", message: "No se pudo verificar el correo." });
  });
});

describe("emailAvailabilityText", () => {
  test("has copy for every visible state and none for idle", () => {
    expect(emailAvailabilityText({ status: "idle" })).toBeNull();
    expect(emailAvailabilityText({ status: "checking" })).toBe("Verificando disponibilidad...");
    expect(emailAvailabilityText({ status: "available" })).toBe("Correo disponible.");
    expect(emailAvailabilityText({ status: "taken" })).toBe(
      "Ya existe un usuario con este correo.",
    );
  });
});
