import { describe, expect, test } from "bun:test";

import {
  INSTITUTION_FORM_FIELDS,
  createInstitutionFormSchema,
  editInstitutionFormSchema,
  emptyInstitutionForm,
  institutionToFormValues,
  toCreateInstitutionInput,
  toUpdateInstitutionInput,
} from "./institution-form";

const valid = {
  ...emptyInstitutionForm(new Date("2026-06-01")),
  name: " Colegio Sol ",
  rectorFirstName: "Marta",
  rectorLastName: "Gómez",
  rectorDocumentNumber: "52123456",
  rectorEmail: "marta@colegio.example.com",
};

function messages(values: Record<string, string>) {
  const result = createInstitutionFormSchema.safeParse({ ...valid, ...values });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("emptyInstitutionForm", () => {
  test("defaults the academic year to the current year and the document type to CC", () => {
    const form = emptyInstitutionForm(new Date("2026-06-01"));
    expect(form.academicYear).toBe("2026");
    expect(form.rectorDocumentType).toBe("CC");
    expect(createInstitutionFormSchema.safeParse(form).success).toBe(false);
  });

  test("covers every rendered field", () => {
    expect(Object.keys(emptyInstitutionForm()).sort()).toEqual([...INSTITUTION_FORM_FIELDS].sort());
  });
});

describe("createInstitutionFormSchema", () => {
  test("accepts a complete form and trims text", () => {
    expect(createInstitutionFormSchema.parse(valid).name).toBe("Colegio Sol");
  });

  test("reports each rector field with the spec message", () => {
    expect(messages({ name: " " })).toContain("El nombre de la institución es obligatorio.");
    expect(messages({ rectorFirstName: "" })).toContain("Los nombres son obligatorios.");
    expect(messages({ rectorLastName: "" })).toContain("Los apellidos son obligatorios.");
    expect(messages({ rectorDocumentNumber: "1234" })).toContain(
      "El documento debe tener al menos 5 caracteres.",
    );
    expect(messages({ rectorEmail: "no-es-correo" })).toContain("Ingresa un correo válido.");
    expect(messages({ rectorDocumentType: "XX" })).toContain("Tipo de documento inválido.");
  });

  test("reuses the profile rules (NIT format, academic year)", () => {
    expect(messages({ nit: "12" })).toContain(
      "El NIT debe tener entre 5 y 20 caracteres (dígitos, puntos o guion).",
    );
    expect(messages({ academicYear: "26" })).toContain("El año lectivo es obligatorio.");
  });
});

describe("toCreateInstitutionInput", () => {
  test("splits the profile from the rector and omits a blank phone", () => {
    const input = toCreateInstitutionInput(createInstitutionFormSchema.parse(valid));
    expect(input.institution).toMatchObject({ name: "Colegio Sol", academicYear: "2026" });
    expect(input.institution).not.toHaveProperty("rectorEmail");
    expect(input.admin).toEqual({
      firstName: "Marta",
      lastName: "Gómez",
      documentType: "CC",
      documentNumber: "52123456",
      email: "marta@colegio.example.com",
      phone: undefined,
    });
  });

  test("keeps a filled rector phone", () => {
    const input = toCreateInstitutionInput(
      createInstitutionFormSchema.parse({ ...valid, rectorPhone: " 3001234567 " }),
    );
    expect(input.admin.phone).toBe("3001234567");
  });
});

describe("edit form", () => {
  const detail = {
    id: "i1",
    name: "Colegio Sol",
    slug: "colegio-sol",
    logo: null,
    email: null,
    nit: "900123456-7",
    municipality: "Cali",
    department: null,
    academicYear: "2026",
    createdAt: "2026-01-01T00:00:00Z",
    counts: { campuses: 1, students: 0, admins: 1 },
    rector: null,
    phone: null,
    address: "Calle 1",
    resolution: null,
  };

  test("fills blank optional values with empty strings", () => {
    expect(institutionToFormValues(detail)).toMatchObject({
      name: "Colegio Sol",
      nit: "900123456-7",
      email: "",
      department: "",
      address: "Calle 1",
      academicYear: "2026",
    });
  });

  test("does not require the rector fields", () => {
    expect(editInstitutionFormSchema.safeParse(institutionToFormValues(detail)).success).toBe(true);
  });

  test("the update input is the profile without blank optionals and without rector fields", () => {
    const input = toUpdateInstitutionInput(
      editInstitutionFormSchema.parse(institutionToFormValues(detail)),
    );
    expect(input).toEqual({
      name: "Colegio Sol",
      nit: "900123456-7",
      municipality: "Cali",
      address: "Calle 1",
      academicYear: "2026",
    });
  });
});
