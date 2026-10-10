import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";

import {
  gradeClassesInput,
  gradeImportInput,
  gradeOfferingInput,
  gradeOfferingPeriodInput,
  gradeSaveSheetInput,
  gradeSetLockInput,
  gradeStudentInput,
} from "./grade";

function issues(schema: ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    (byField[issue.path.join(".")] ??= []).push(issue.message);
  }
  return byField;
}

const cell = (overrides: Record<string, unknown> = {}) => ({
  studentId: "s1",
  criterionId: "c1",
  score: 4.25,
  observation: null,
  ...overrides,
});

const sheet = (cells: unknown[], extra: Record<string, unknown> = {}) => ({
  offeringId: "o1",
  periodId: "p1",
  cells,
  ...extra,
});

describe("gradeSaveSheetInput (GRD-R2, GRD-R3)", () => {
  test("converts scores to exact hundredths and blank observations to null", () => {
    expect(
      gradeSaveSheetInput.parse(
        sheet(
          [
            cell({ observation: "  Muy bien  " }),
            cell({ criterionId: "c2", score: 3, observation: "   " }),
            cell({ criterionId: "c3", score: null }),
          ],
          { lock: true },
        ),
      ),
    ).toEqual({
      offeringId: "o1",
      periodId: "p1",
      lock: true,
      cells: [
        { studentId: "s1", criterionId: "c1", scoreCents: 425, observation: "Muy bien" },
        { studentId: "s1", criterionId: "c2", scoreCents: 300, observation: null },
        { studentId: "s1", criterionId: "c3", scoreCents: null, observation: null },
      ],
    });
  });

  test("lock is optional", () => {
    expect(gradeSaveSheetInput.parse(sheet([cell()])).lock).toBeUndefined();
  });

  test("score out of range or with more than two decimals", () => {
    for (const score of [0.99, 5.01, 0, 4.255, 2.995, Number.NaN, "4.5"]) {
      expect(issues(gradeSaveSheetInput, sheet([cell({ score })]))).toEqual({
        "cells.0.score": ["La nota debe estar entre 1.0 y 5.0."],
      });
    }
    for (const score of [1, 5, 2.99, 4.6]) {
      expect(issues(gradeSaveSheetInput, sheet([cell({ score })]))).toEqual({});
    }
  });

  test("observation without a score", () => {
    expect(
      issues(gradeSaveSheetInput, sheet([cell({ score: null, observation: "Faltó" })])),
    ).toEqual({ "cells.0.observation": ["No se puede guardar una observación sin nota."] });
  });

  test("observation over 500 characters", () => {
    expect(issues(gradeSaveSheetInput, sheet([cell({ observation: "x".repeat(501) })]))).toEqual({
      "cells.0.observation": ["La observación no puede superar 500 caracteres."],
    });
    expect(issues(gradeSaveSheetInput, sheet([cell({ observation: "x".repeat(500) })]))).toEqual(
      {},
    );
  });

  test("1..2000 cells", () => {
    expect(issues(gradeSaveSheetInput, sheet([]))).toEqual({
      cells: ["No hay notas para guardar."],
    });
    const many = Array.from({ length: 2001 }, (_, index) => cell({ studentId: `s${index}` }));
    expect(issues(gradeSaveSheetInput, sheet(many))).toEqual({
      cells: ["No se pueden guardar más de 2000 notas a la vez."],
    });
    expect(issues(gradeSaveSheetInput, sheet(many.slice(0, 2000)))).toEqual({});
  });

  test("duplicate cells in one request are rejected", () => {
    expect(issues(gradeSaveSheetInput, sheet([cell(), cell({ score: 3 })]))).toEqual({
      "cells.1": ["La planilla tiene notas repetidas para el mismo estudiante y criterio."],
    });
  });

  test("ids are required", () => {
    expect(
      Object.keys(
        issues(gradeSaveSheetInput, {
          offeringId: "",
          periodId: "",
          cells: [cell({ studentId: "", criterionId: "" })],
        }),
      ).sort(),
    ).toEqual(["cells.0.criterionId", "cells.0.studentId", "offeringId", "periodId"]);
  });
});

describe("other grade inputs", () => {
  test("setLock", () => {
    expect(gradeSetLockInput.parse({ offeringId: "o1", periodId: "p1", locked: false })).toEqual({
      offeringId: "o1",
      periodId: "p1",
      locked: false,
    });
    expect(Object.keys(issues(gradeSetLockInput, { offeringId: "o1", periodId: "p1" }))).toEqual([
      "locked",
    ]);
  });

  test("classes takes a period and an optional course", () => {
    expect(gradeClassesInput.parse({ periodId: "p1" })).toEqual({ periodId: "p1" });
    expect(gradeClassesInput.parse({ periodId: "p1", courseId: "c1" })).toEqual({
      periodId: "p1",
      courseId: "c1",
    });
    expect(Object.keys(issues(gradeClassesInput, {}))).toEqual(["periodId"]);
  });

  test("offering × period, offering and student inputs", () => {
    expect(gradeOfferingPeriodInput.parse({ offeringId: "o1", periodId: "p1" })).toEqual({
      offeringId: "o1",
      periodId: "p1",
    });
    expect(gradeOfferingInput.parse({ offeringId: "o1" })).toEqual({ offeringId: "o1" });
    expect(gradeStudentInput.parse({ studentId: "s1" })).toEqual({ studentId: "s1" });
    expect(Object.keys(issues(gradeOfferingPeriodInput, { offeringId: "o1" }))).toEqual([
      "periodId",
    ]);
  });

  test("import takes the offering × period and a file", () => {
    const file = new File(["x"], "notas.xlsx");
    expect(gradeImportInput.parse({ offeringId: "o1", periodId: "p1", file })).toEqual({
      offeringId: "o1",
      periodId: "p1",
      file,
    });
    expect(Object.keys(issues(gradeImportInput, { offeringId: "o1", periodId: "p1" }))).toEqual([
      "file",
    ]);
  });

  test("no input carries an organizationId (R3.2)", () => {
    for (const schema of [
      gradeSaveSheetInput,
      gradeSetLockInput,
      gradeClassesInput,
      gradeOfferingPeriodInput,
      gradeOfferingInput,
      gradeStudentInput,
      gradeImportInput,
    ]) {
      expect(Object.keys(schema.shape)).not.toContain("organizationId");
    }
  });
});
