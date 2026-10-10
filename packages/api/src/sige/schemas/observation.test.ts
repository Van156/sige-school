import { OBSERVATION_CATEGORIES, OBSERVATION_TYPE_CODES } from "@base-template/sige-core";
import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";

import {
  observationCreateInput,
  observationIdInput,
  observationRecentInput,
  observationStudentInput,
  observationUpdateInput,
} from "./observation";

function issues(schema: ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    (byField[issue.path.join(".")] ??= []).push(issue.message);
  }
  return byField;
}

const create = (overrides: Record<string, unknown> = {}) => ({
  studentId: "s1",
  type: "negativa",
  description: "Interrumpió la clase varias veces.",
  ...overrides,
});

describe("observationCreateInput (OBS-R2, OBS-R3)", () => {
  test("trims the text and turns blank commitments into null", () => {
    expect(
      observationCreateInput.parse(
        create({
          description: "  Interrumpió la clase.  ",
          commitments: "   ",
          category: "  Disciplina  ",
          observedOn: "2026-10-09",
        }),
      ),
    ).toEqual({
      studentId: "s1",
      type: "negativa",
      category: "Disciplina",
      description: "Interrumpió la clase.",
      commitments: null,
      observedOn: "2026-10-09",
    });
  });

  test("category and commitments are optional, the date defaults in the service (Bogotá)", () => {
    expect(observationCreateInput.parse(create())).toEqual({
      studentId: "s1",
      type: "negativa",
      description: "Interrumpió la clase varias veces.",
      commitments: null,
      category: null,
    });
  });

  test('an empty category is accepted and stored as null ("Categoría" is optional)', () => {
    expect(observationCreateInput.parse(create({ category: "" })).category).toBeNull();
    expect(observationCreateInput.parse(create({ category: null })).category).toBeNull();
  });

  test("the per-field messages of OBS-R2", () => {
    expect(issues(observationCreateInput, create({ studentId: "" }))).toEqual({
      studentId: ["Debes seleccionar un estudiante."],
    });
    expect(issues(observationCreateInput, create({ studentId: undefined }))).toEqual({
      studentId: ["Debes seleccionar un estudiante."],
    });
    expect(issues(observationCreateInput, create({ type: "otra" }))).toEqual({
      type: ["Debes seleccionar un tipo."],
    });
    expect(issues(observationCreateInput, create({ type: undefined }))).toEqual({
      type: ["Debes seleccionar un tipo."],
    });
    expect(issues(observationCreateInput, create({ description: "   " }))).toEqual({
      description: ["La descripción es obligatoria."],
    });
    expect(issues(observationCreateInput, create({ description: undefined }))).toEqual({
      description: ["La descripción es obligatoria."],
    });
  });

  test("the length limits of OBS-R2", () => {
    expect(issues(observationCreateInput, create({ description: "x".repeat(2001) }))).toEqual({
      description: ["La descripción no puede superar 2000 caracteres."],
    });
    expect(issues(observationCreateInput, create({ description: "x".repeat(2000) }))).toEqual({});
    expect(issues(observationCreateInput, create({ commitments: "x".repeat(1001) }))).toEqual({
      commitments: ["Los compromisos no pueden superar 1000 caracteres."],
    });
    expect(issues(observationCreateInput, create({ commitments: "x".repeat(1000) }))).toEqual({});
  });

  test("the category must be one of the seven values of §3", () => {
    expect(OBSERVATION_CATEGORIES).toHaveLength(7);
    for (const category of OBSERVATION_CATEGORIES) {
      expect(observationCreateInput.parse(create({ category })).category).toBe(category);
    }
    expect(issues(observationCreateInput, create({ category: "Puntualidad" }))).toEqual({
      category: ["Categoría inválida."],
    });
  });

  test("the four types are accepted", () => {
    expect(OBSERVATION_TYPE_CODES).toEqual(["positiva", "negativa", "seguimiento", "convivencia"]);
    for (const type of OBSERVATION_TYPE_CODES) {
      expect(observationCreateInput.parse(create({ type })).type).toBe(type);
    }
  });

  test("observedOn is a YYYY-MM-DD day; the future check is service-side (OBS-R3)", () => {
    expect(observationCreateInput.parse(create({ observedOn: "2026-10-09" })).observedOn).toBe(
      "2026-10-09",
    );
    expect(issues(observationCreateInput, create({ observedOn: "09/10/2026" }))).toEqual({
      observedOn: ["Fecha inválida"],
    });
    expect(issues(observationCreateInput, create({ observedOn: "2099-01-01" }))).toEqual({});
  });
});

describe("observationUpdateInput (OBS-R5)", () => {
  test("takes the id and every editable field, never the student", () => {
    expect(Object.keys(observationUpdateInput.shape).sort()).toEqual([
      "category",
      "commitments",
      "description",
      "id",
      "observedOn",
      "type",
    ]);
    expect(
      observationUpdateInput.parse({
        id: "ob1",
        type: "positiva",
        description: "Ayudó a un compañero.",
      }),
    ).toEqual({
      id: "ob1",
      type: "positiva",
      description: "Ayudó a un compañero.",
      category: null,
      commitments: null,
    });
  });

  test("the create messages still apply", () => {
    expect(
      issues(observationUpdateInput, { id: "ob1", type: "positiva", description: "" }),
    ).toEqual({ description: ["La descripción es obligatoria."] });
    expect(
      Object.keys(issues(observationUpdateInput, { type: "positiva", description: "x" })),
    ).toEqual(["id"]);
  });
});

describe("the id, student and recent inputs (08 §4.1)", () => {
  test("get, delete and markNotified take an id", () => {
    expect(observationIdInput.parse({ id: "ob1" })).toEqual({ id: "ob1" });
    expect(Object.keys(issues(observationIdInput, { id: "" }))).toEqual(["id"]);
  });

  test("studentHistory takes a student", () => {
    expect(observationStudentInput.parse({ studentId: "s1" })).toEqual({ studentId: "s1" });
    expect(issues(observationStudentInput, {})).toEqual({
      studentId: ["Debes seleccionar un estudiante."],
    });
  });

  test("recent defaults to 10 and allows at most 20 (DASH-03)", () => {
    expect(observationRecentInput.parse({})).toEqual({ limit: 10 });
    expect(observationRecentInput.parse({ limit: 20 })).toEqual({ limit: 20 });
    expect(Object.keys(issues(observationRecentInput, { limit: 21 }))).toEqual(["limit"]);
    expect(Object.keys(issues(observationRecentInput, { limit: 0 }))).toEqual(["limit"]);
    expect(Object.keys(issues(observationRecentInput, { limit: 2.5 }))).toEqual(["limit"]);
  });

  test("no input carries an organizationId (08 §8.1)", () => {
    for (const schema of [
      observationCreateInput,
      observationUpdateInput,
      observationIdInput,
      observationStudentInput,
      observationRecentInput,
    ]) {
      expect(Object.keys(schema.shape)).not.toContain("organizationId");
    }
  });
});
