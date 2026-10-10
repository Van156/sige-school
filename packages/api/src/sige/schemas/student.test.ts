import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";

import {
  guardianLinkInput,
  studentAcademicInput,
  studentCompleteInput,
  studentCreateInput,
  studentPickInput,
  studentUpdateInput,
} from "./student";

function issues(schema: ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    (byField[issue.path.join(".")] ??= []).push(issue.message);
  }
  return byField;
}

const academic = { campusId: "main", courseId: null };
const created = { ...academic, firstName: "Ana", lastName: "Pérez", documentNumber: "1101101" };

describe("studentAcademicInput (STU-03 §4.1)", () => {
  test("accepts the minimum and normalises blanks", () => {
    expect(studentAcademicInput.parse({ campusId: "main", courseId: "", eps: " " })).toEqual({
      campusId: "main",
      courseId: null,
    });
  });
  test("verbatim messages", () => {
    expect(issues(studentAcademicInput, { campusId: "", courseId: null })).toEqual({
      campusId: ["Debes seleccionar una sede."],
    });
    for (const stratum of [0, 7, 2.5]) {
      expect(issues(studentAcademicInput, { ...academic, stratum }).stratum).toEqual([
        "El estrato debe estar entre 1 y 6.",
      ]);
    }
    expect(
      issues(studentAcademicInput, { ...academic, guardianEmail: "x@" }).guardianEmail,
    ).toEqual(["Ingresa un correo válido."]);
  });
  test("length limits of the profile columns", () => {
    expect(issues(studentAcademicInput, { ...academic, bloodType: "ABpos+" }).bloodType).toEqual([
      "No puede superar 5 caracteres.",
    ]);
    expect(
      issues(studentAcademicInput, { ...academic, guardianName: "a".repeat(151) }).guardianName,
    ).toEqual(["No puede superar 150 caracteres."]);
  });
});

describe("studentCreateInput", () => {
  test("defaults the document type to TI", () => {
    expect(studentCreateInput.parse(created).documentType).toBe("TI");
  });
  test("verbatim messages", () => {
    expect(
      issues(studentCreateInput, {
        ...created,
        firstName: " ",
        lastName: "",
        documentNumber: "12",
      }),
    ).toEqual({
      firstName: ["El nombre es obligatorio."],
      lastName: ["El apellido es obligatorio."],
      documentNumber: ["El documento debe tener al menos 5 dígitos."],
    });
    expect(issues(studentCreateInput, { ...created, documentType: "CE" }).documentType).toEqual([
      "Tipo de documento inválido.",
    ]);
    expect(issues(studentCreateInput, { ...created, birthDate: "2999-01-01" }).birthDate).toEqual([
      "La fecha de nacimiento no puede ser futura.",
    ]);
  });
});

describe("studentCompleteInput / studentUpdateInput", () => {
  test("complete carries the person and only academic fields", () => {
    const parsed = studentCompleteInput.parse({ personId: "p1", ...academic, firstName: "x" });
    expect(parsed).toEqual({ personId: "p1", ...academic });
  });
  test("update has no document fields and requires a status", () => {
    const parsed = studentUpdateInput.parse({
      id: "s1",
      ...created,
      documentType: "CC",
      status: "retirado",
    });
    expect(parsed).not.toHaveProperty("documentNumber");
    expect(parsed).not.toHaveProperty("documentType");
    expect(parsed.status).toBe("retirado");
    expect(issues(studentUpdateInput, { id: "s1", ...created, status: "x" }).status).toEqual([
      "Debes seleccionar un estado.",
    ]);
  });
});

describe("studentPickInput", () => {
  test("limit defaults to 50 and caps at 100", () => {
    expect(studentPickInput.parse({}).limit).toBe(50);
    expect(studentPickInput.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe("guardianLinkInput (STU-R6)", () => {
  test("verbatim messages", () => {
    expect(
      issues(guardianLinkInput, { studentId: "s1", guardianPersonId: "", relationship: "Padre" }),
    ).toEqual({ guardianPersonId: ["Selecciona un acudiente."] });
    expect(
      guardianLinkInput.parse({ studentId: "s1", guardianPersonId: "g1", relationship: "Tío/a" })
        .relationship,
    ).toBe("Tío/a");
  });
});
