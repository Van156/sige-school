import { describe, expect, test } from "bun:test";

import {
  INSTITUTION_CREATE_FALLBACK_MESSAGE,
  emptyInstitutionForm,
  institutionCreateErrorMessage,
  institutionFormSchema,
  toCreateInstitutionInput,
} from "./institution-form";

const valid = {
  institutionName: " Colegio Sol ",
  firstName: "Marta",
  lastName: "Gómez",
  documentType: "CC" as const,
  documentNumber: "52123456",
  email: "marta@colegio.example.com",
  phone: "",
};

function messages(values: Record<string, string>) {
  const result = institutionFormSchema.safeParse({ ...valid, ...values });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("institutionFormSchema", () => {
  test("accepts a complete form and trims text", () => {
    const result = institutionFormSchema.parse(valid);
    expect(result.institutionName).toBe("Colegio Sol");
  });

  test("starts with the required fields empty and CC selected", () => {
    expect(emptyInstitutionForm.documentType).toBe("CC");
    expect(institutionFormSchema.safeParse(emptyInstitutionForm).success).toBe(false);
  });

  test("reports each field with the spec message", () => {
    expect(messages({ institutionName: " " })).toContain(
      "El nombre de la institución es obligatorio.",
    );
    expect(messages({ firstName: "" })).toContain("Los nombres son obligatorios.");
    expect(messages({ lastName: "" })).toContain("Los apellidos son obligatorios.");
    expect(messages({ documentNumber: "123" })).toContain(
      "El documento debe tener al menos 5 caracteres.",
    );
    expect(messages({ email: "no-es-correo" })).toContain("Ingresa un correo válido.");
    expect(messages({ documentType: "XX" })).toContain("Tipo de documento inválido.");
  });
});

describe("toCreateInstitutionInput", () => {
  test("nests the institution and admin and omits a blank phone", () => {
    const input = toCreateInstitutionInput(institutionFormSchema.parse(valid));
    expect(input).toEqual({
      institution: { name: "Colegio Sol" },
      admin: {
        firstName: "Marta",
        lastName: "Gómez",
        documentType: "CC",
        documentNumber: "52123456",
        email: "marta@colegio.example.com",
        phone: undefined,
      },
    });
  });

  test("keeps a provided phone", () => {
    const input = toCreateInstitutionInput(
      institutionFormSchema.parse({ ...valid, phone: "3001234567" }),
    );
    expect(input.admin.phone).toBe("3001234567");
  });
});

describe("institutionCreateErrorMessage", () => {
  test("shows the server message for BAD_REQUEST and CONFLICT", () => {
    expect(
      institutionCreateErrorMessage({ code: "CONFLICT", message: "Documento duplicado." }),
    ).toBe("Documento duplicado.");
    expect(institutionCreateErrorMessage({ code: "BAD_REQUEST", message: "Dato inválido." })).toBe(
      "Dato inválido.",
    );
  });

  test("falls back for other errors", () => {
    expect(institutionCreateErrorMessage({ code: "INTERNAL_SERVER_ERROR", message: "boom" })).toBe(
      INSTITUTION_CREATE_FALLBACK_MESSAGE,
    );
    expect(institutionCreateErrorMessage(new Error("offline"))).toBe(
      INSTITUTION_CREATE_FALLBACK_MESSAGE,
    );
  });
});
