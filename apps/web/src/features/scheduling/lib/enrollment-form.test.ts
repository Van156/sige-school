import { describe, expect, test } from "bun:test";

import {
  calloutCourseDetail,
  candidateCheckItems,
  emptyEnrollForm,
  enrollFormSchema,
  enrollOrAskOverride,
  enrollmentCourseOptions,
  enrollmentEditFormSchema,
  enrollmentToEditForm,
  enrollSuccessToast,
  isOverCapacityRefusal,
  mapEnrollSubmitError,
  toEnrollInput,
  toEnrollmentEditInput,
} from "./enrollment-form";

const issues = (values: unknown) =>
  enrollFormSchema.safeParse(values).error?.issues.map((issue) => [issue.path[0], issue.message]);

describe("enrollFormSchema (sige/04 §4.1)", () => {
  test("requires a course and at least one student", () => {
    expect(issues(emptyEnrollForm)).toEqual([
      ["courseId", "Debes seleccionar un grado."],
      ["studentIds", "Seleccione al menos un estudiante."],
    ]);
  });

  test("a valid form never asks for the capacity override", () => {
    expect(toEnrollInput({ courseId: "c1", studentIds: ["s1", "s2"] })).toEqual({
      courseId: "c1",
      studentIds: ["s1", "s2"],
      allowOverCapacity: false,
    });
  });
});

describe("isOverCapacityRefusal", () => {
  const course = { maxStudents: 30 };

  test("matches the capacity refusal of the chosen course", () => {
    expect(
      isOverCapacityRefusal(
        {
          code: "BAD_REQUEST",
          message: "El grado superaría su capacidad máxima (30 estudiantes).",
        },
        course,
      ),
    ).toBe(true);
  });

  test("ignores other refusals and other codes", () => {
    expect(
      isOverCapacityRefusal(
        { code: "BAD_REQUEST", message: "El grado no tiene materias asignadas." },
        course,
      ),
    ).toBe(false);
    expect(
      isOverCapacityRefusal(
        { code: "CONFLICT", message: "El grado superaría su capacidad máxima (30 estudiantes)." },
        course,
      ),
    ).toBe(false);
    expect(isOverCapacityRefusal(new Error("network"), course)).toBe(false);
  });
});

describe("mapEnrollSubmitError", () => {
  test("course refusals land under Grado, student refusals under Estudiantes", () => {
    expect(
      mapEnrollSubmitError({
        code: "BAD_REQUEST",
        message: "El grado no tiene materias asignadas.",
      }),
    ).toEqual({
      fieldErrors: { courseId: "El grado no tiene materias asignadas." },
      formError: null,
    });
    expect(
      mapEnrollSubmitError({
        code: "BAD_REQUEST",
        message: "Solo se pueden matricular estudiantes activos.",
      }),
    ).toEqual({
      fieldErrors: { studentIds: "Solo se pueden matricular estudiantes activos." },
      formError: null,
    });
  });

  test("an unknown failure gets the fallback", () => {
    expect(mapEnrollSubmitError(new Error("offline"))).toEqual({
      fieldErrors: {},
      formError: "No se pudo matricular a los estudiantes. Intente nuevamente.",
    });
  });
});

describe("choices and copy", () => {
  test("only courses of the current academic year are offered", () => {
    expect(
      enrollmentCourseOptions(
        [
          { id: "c1", name: "6-01", academicYear: "2026" },
          { id: "c0", name: "5-01", academicYear: "2025" },
        ],
        "2026",
      ),
    ).toEqual([{ value: "c1", label: "6-01" }]);
  });

  test("each candidate shows its current course or Sin grado", () => {
    expect(
      candidateCheckItems([
        { id: "s1", name: "Ana Zapata", document: "1", currentCourseName: "5-01" },
        { id: "s2", name: "Beto Arias", document: "2", currentCourseName: null },
      ]),
    ).toEqual([
      { value: "s1", label: "Ana Zapata", hint: "Actualmente: 5-01" },
      { value: "s2", label: "Beto Arias", hint: "Actualmente: Sin grado" },
    ]);
  });

  test("the callout names the subject count and course once one is chosen", () => {
    expect(calloutCourseDetail(undefined)).toBe("");
    expect(calloutCourseDetail({ name: "6-01", offeringCount: 9 })).toBe(" (9 en 6-01)");
  });

  test("the success toast reports students and created enrollments", () => {
    expect(enrollSuccessToast({ students: 3, created: 27 }, "6-01")).toEqual({
      title: "3 estudiante(s) matriculado(s)",
      description: "27 inscripciones creadas en 6-01.",
    });
  });
});

describe("enrollOrAskOverride (SCH-R5 capacity confirmation)", () => {
  const input = { courseId: "c1", studentIds: ["s1"], allowOverCapacity: false };
  const course = { maxStudents: 30 };
  const refusal = (message: string) => ({ code: "BAD_REQUEST", message });

  test("a saved enrollment never asks for the override", async () => {
    const sent: unknown[] = [];
    const asked: unknown[] = [];
    await enrollOrAskOverride({
      input,
      course,
      enroll: async (value) => void sent.push(value),
      askOverride: (value) => void asked.push(value),
    });
    expect(sent).toEqual([input]);
    expect(asked).toEqual([]);
  });

  test("a capacity refusal asks for the override instead of failing", async () => {
    const asked: unknown[] = [];
    await enrollOrAskOverride({
      input,
      course,
      enroll: async () => {
        throw refusal("El grado superaría su capacidad máxima (30 estudiantes).");
      },
      askOverride: (value) => void asked.push(value),
    });
    expect(asked).toEqual([input]);
  });

  test("any other refusal reaches the form", async () => {
    const failure = refusal("El grado no tiene materias asignadas.");
    const asked: unknown[] = [];
    const run = enrollOrAskOverride({
      input,
      course,
      enroll: async () => {
        throw failure;
      },
      askOverride: (value) => void asked.push(value),
    });
    await expect(run).rejects.toBe(failure);
    expect(asked).toEqual([]);
  });
});

describe("enrollment edit form (SCH-R8, sige/04 §4.1)", () => {
  const values = { status: "activa", finalScore: "", statusNote: "" };
  const scoreIssues = (finalScore: string) =>
    enrollmentEditFormSchema
      .safeParse({ ...values, finalScore })
      .error?.issues.map((issue) => [issue.path[0], issue.message]);

  test("prefills from the row; an unset score and note are blank", () => {
    expect(
      enrollmentToEditForm({ status: "retirada", finalScore: null, statusNote: null }),
    ).toEqual({ status: "retirada", finalScore: "", statusNote: "" });
    expect(enrollmentToEditForm({ status: "activa", finalScore: 4.5, statusNote: "Ok" })).toEqual({
      status: "activa",
      finalScore: "4.5",
      statusNote: "Ok",
    });
  });

  test("blank score and note clear the columns", () => {
    expect(toEnrollmentEditInput(values)).toEqual({
      status: "activa",
      finalScore: null,
      statusNote: null,
    });
  });

  test("the score accepts 1.0–5.0, also with a decimal comma", () => {
    expect(toEnrollmentEditInput({ ...values, finalScore: "4,5" }).finalScore).toBe(4.5);
    expect(toEnrollmentEditInput({ ...values, finalScore: " 1 " }).finalScore).toBe(1);
    expect(toEnrollmentEditInput({ ...values, finalScore: "5.0" }).finalScore).toBe(5);
  });

  test("an out-of-range or non-numeric score shows the spec message", () => {
    const message = "La nota final debe estar entre 1.0 y 5.0.";
    expect(scoreIssues("0.9")).toEqual([["finalScore", message]]);
    expect(scoreIssues("5.1")).toEqual([["finalScore", message]]);
    expect(scoreIssues("abc")).toEqual([["finalScore", message]]);
  });

  test("an unchosen status is refused by the API rule", () => {
    expect(
      enrollmentEditFormSchema
        .safeParse({ ...values, status: "" })
        .error?.issues.map((issue) => issue.path[0]),
    ).toEqual(["status"]);
  });
});
