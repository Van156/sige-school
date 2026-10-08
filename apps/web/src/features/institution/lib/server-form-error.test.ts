import { describe, expect, test } from "bun:test";

import { mapSubmitError } from "./server-form-error";

const options = {
  fields: ["name", "code", "jornada"],
  fieldByMessage: { "Ya existe una sede con este código.": "code" },
  fallback: "No se pudo guardar.",
};

describe("mapSubmitError", () => {
  test("puts a known conflict message under its field", () => {
    expect(
      mapSubmitError({ code: "CONFLICT", message: "Ya existe una sede con este código." }, options),
    ).toEqual({
      fieldErrors: { code: "Ya existe una sede con este código." },
      formError: null,
    });
  });

  test("shows an unmapped domain message on the form", () => {
    expect(mapSubmitError({ code: "NOT_FOUND", message: "La sede no existe." }, options)).toEqual({
      fieldErrors: {},
      formError: "La sede no existe.",
    });
  });

  test("maps input-validation issues to their fields by first path segment", () => {
    const error = {
      code: "BAD_REQUEST",
      message: "Input validation failed",
      data: {
        issues: [
          { message: "El nombre de la sede es obligatorio.", path: ["name"] },
          { message: "Otro", path: ["name"] },
          { message: "Debes seleccionar una jornada", path: [{ key: "jornada" }] },
        ],
      },
    };
    expect(mapSubmitError(error, options)).toEqual({
      fieldErrors: {
        name: "El nombre de la sede es obligatorio.",
        jornada: "Debes seleccionar una jornada",
      },
      formError: null,
    });
  });

  test("shows issues that match no rendered field on the form", () => {
    const error = {
      code: "BAD_REQUEST",
      message: "Input validation failed",
      data: { issues: [{ message: "Campo desconocido.", path: ["unknown"] }] },
    };
    expect(mapSubmitError(error, options)).toEqual({
      fieldErrors: {},
      formError: "Campo desconocido.",
    });
  });

  test("keeps matched fields and reports the first unmatched issue on the form", () => {
    const error = {
      code: "BAD_REQUEST",
      data: {
        issues: [
          { message: "Otro", path: ["unknown"] },
          { message: "Nombre obligatorio.", path: ["name"] },
        ],
      },
    };
    expect(mapSubmitError(error, options)).toEqual({
      fieldErrors: { name: "Nombre obligatorio." },
      formError: "Otro",
    });
  });

  test("falls back for unknown codes, blank messages and non-errors", () => {
    const failure = { fieldErrors: {}, formError: options.fallback };
    expect(mapSubmitError({ code: "INTERNAL_SERVER_ERROR", message: "boom" }, options)).toEqual(
      failure,
    );
    expect(mapSubmitError({ code: "CONFLICT", message: "  " }, options)).toEqual(failure);
    expect(mapSubmitError(new TypeError("Failed to fetch"), options)).toEqual(failure);
    expect(mapSubmitError(undefined, options)).toEqual(failure);
  });
});
