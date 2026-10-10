import { describe, expect, test } from "bun:test";

import {
  bulkOfferingFormSchema,
  describeBulkResult,
  emptyBulkOfferingForm,
  offeringHoursFormSchema,
  offeringToHoursForm,
  toBulkOfferingInput,
} from "./offering-form";

const FILLED = { ...emptyBulkOfferingForm, courseIds: ["c1", "c2"], subjectIds: ["s1"] };

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("bulkOfferingFormSchema", () => {
  test("defaults to 4 hours and no teacher", () => {
    expect(emptyBulkOfferingForm).toEqual({
      courseIds: [],
      subjectIds: [],
      teacherPersonId: "",
      hoursPerWeek: "4",
    });
  });

  test("shapes the text into the API input; no teacher is null", () => {
    expect(toBulkOfferingInput(FILLED)).toEqual({
      courseIds: ["c1", "c2"],
      subjectIds: ["s1"],
      teacherPersonId: null,
      hoursPerWeek: 4,
    });
    expect(toBulkOfferingInput({ ...FILLED, teacherPersonId: "p1" }).teacherPersonId).toBe("p1");
  });

  test("requires at least one course and one subject", () => {
    expect(messages(bulkOfferingFormSchema.safeParse(emptyBulkOfferingForm))).toEqual([
      "Seleccione al menos un grado.",
      "Seleccione al menos una materia.",
    ]);
  });

  test.each(["0", "21", "", "2.5", "abc"])("rejects %p hours with the API message", (hours) => {
    expect(messages(bulkOfferingFormSchema.safeParse({ ...FILLED, hoursPerWeek: hours }))).toEqual([
      "La intensidad debe estar entre 1 y 20 horas.",
    ]);
  });

  test("caps the combinations at 500", () => {
    const ids = (count: number) => Array.from({ length: count }, (_, index) => `id${index}`);
    const result = bulkOfferingFormSchema.safeParse({
      ...FILLED,
      courseIds: ids(50),
      subjectIds: ids(11),
    });
    expect(messages(result)).toEqual([
      "Seleccione como máximo 500 combinaciones de grado y materia.",
    ]);
  });
});

describe("offeringHoursFormSchema", () => {
  test("starts from the current hours and parses the text", () => {
    expect(offeringToHoursForm({ hoursPerWeek: 6 })).toEqual({ hoursPerWeek: "6" });
    expect(offeringHoursFormSchema.parse({ hoursPerWeek: " 8 " })).toEqual({ hoursPerWeek: 8 });
  });

  test("rejects hours outside 1-20 with the API message", () => {
    expect(messages(offeringHoursFormSchema.safeParse({ hoursPerWeek: "25" }))).toEqual([
      "La intensidad debe estar entre 1 y 20 horas.",
    ]);
  });
});

describe("describeBulkResult", () => {
  test("reports created and skipped combinations", () => {
    expect(describeBulkResult({ created: 3, skipped: 1 })).toEqual({
      kind: "success",
      title: "3 materia(s) asignada(s)",
      description: "1 ya estaban asignadas y se omitieron.",
    });
  });

  test("omits the skipped line when nothing was skipped", () => {
    expect(describeBulkResult({ created: 2, skipped: 0 }).description).toBeUndefined();
  });

  test("created = 0 is an info toast", () => {
    expect(describeBulkResult({ created: 0, skipped: 4 })).toEqual({
      kind: "info",
      title: "Sin cambios",
      description: "Todas las combinaciones ya estaban asignadas.",
    });
  });
});
