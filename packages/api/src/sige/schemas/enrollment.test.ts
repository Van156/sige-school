import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";

import {
  enrollmentCandidatesInput,
  enrollmentCreateBulkInput,
  enrollmentUpdateInput,
} from "./enrollment";

function issues(schema: ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    (byField[issue.path.join(".")] ??= []).push(issue.message);
  }
  return byField;
}

describe("enrollmentCreateBulkInput (SCH-02 create)", () => {
  test("accepts a selection and defaults the override off", () => {
    expect(enrollmentCreateBulkInput.parse({ courseId: "c1", studentIds: ["s1"] })).toEqual({
      courseId: "c1",
      studentIds: ["s1"],
      allowOverCapacity: false,
    });
  });
  test("verbatim messages", () => {
    expect(issues(enrollmentCreateBulkInput, { courseId: "", studentIds: [] })).toEqual({
      courseId: ["Debes seleccionar un grado."],
      studentIds: ["Seleccione al menos un estudiante."],
    });
    const many = Array.from({ length: 201 }, (_, index) => `s${index}`);
    expect(issues(enrollmentCreateBulkInput, { courseId: "c1", studentIds: many })).toEqual({
      studentIds: ["Seleccione como máximo 200 estudiantes."],
    });
  });
});

describe("enrollmentUpdateInput (SCH-02 edit)", () => {
  test("status, score and note only", () => {
    expect(
      enrollmentUpdateInput.parse({
        id: "e1",
        status: "retirada",
        finalScore: 4.5,
        statusNote: "",
      }),
    ).toEqual({ id: "e1", status: "retirada", finalScore: 4.5, statusNote: null });
    expect(enrollmentUpdateInput.parse({ id: "e1", status: "activa", finalScore: null })).toEqual({
      id: "e1",
      status: "activa",
      finalScore: null,
    });
  });
  test("verbatim messages", () => {
    for (const finalScore of [0.9, 5.1, 4.555]) {
      expect(issues(enrollmentUpdateInput, { id: "e1", status: "activa", finalScore })).toEqual({
        finalScore: ["La nota final debe estar entre 1.0 y 5.0."],
      });
    }
    expect(issues(enrollmentUpdateInput, { id: "e1", status: "x" }).status).toEqual([
      "Debes seleccionar un estado.",
    ]);
  });
});

describe("enrollmentCandidatesInput", () => {
  test("limit caps at 200", () => {
    expect(enrollmentCandidatesInput.safeParse({ courseId: "c1", limit: 201 }).success).toBe(false);
    expect(enrollmentCandidatesInput.parse({ courseId: "c1", search: " " })).toEqual({
      courseId: "c1",
      limit: 200,
    });
  });
});
