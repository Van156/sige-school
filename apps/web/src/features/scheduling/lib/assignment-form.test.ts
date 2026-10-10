import { describe, expect, test } from "bun:test";

import {
  assignFormSchema,
  assignmentEditFormSchema,
  assignmentToEditForm,
  emptyAssignForm,
  mapAssignSubmitError,
  toAssignInput,
  toAssignmentEditInput,
} from "./assignment-form";

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("assignFormSchema", () => {
  test("nothing chosen shows the three spec messages", () => {
    expect(messages(assignFormSchema.safeParse(emptyAssignForm))).toEqual([
      "Debes seleccionar un grado.",
      "Debes seleccionar una materia.",
      "Debes seleccionar un profesor.",
    ]);
  });

  test("a complete selection is the API input", () => {
    const values = { courseId: "c1", subjectId: "s1", teacherPersonId: "p1" };
    expect(toAssignInput(values)).toEqual(values);
  });
});

describe("mapAssignSubmitError", () => {
  test("the busy-teacher conflict lands under Profesor with the API text", () => {
    const message = "El profesor ya tiene clases en el mismo horario (6-01, Lunes 07:00).";
    expect(mapAssignSubmitError({ code: "CONFLICT", message })).toEqual({
      fieldErrors: { teacherPersonId: message },
      formError: null,
    });
  });

  test("an inactive teacher lands under Profesor", () => {
    expect(
      mapAssignSubmitError({ code: "BAD_REQUEST", message: "El profesor debe estar activo." }),
    ).toEqual({
      fieldErrors: { teacherPersonId: "El profesor debe estar activo." },
      formError: null,
    });
  });

  test("a missing course or subject lands under its select", () => {
    expect(
      mapAssignSubmitError({ code: "NOT_FOUND", message: "El grado no existe." }).fieldErrors,
    ).toEqual({ courseId: "El grado no existe." });
    expect(
      mapAssignSubmitError({ code: "NOT_FOUND", message: "La materia no existe." }).fieldErrors,
    ).toEqual({ subjectId: "La materia no existe." });
  });

  test("an unknown failure gets the fallback on the form", () => {
    expect(mapAssignSubmitError(new Error("offline"))).toEqual({
      fieldErrors: {},
      formError: "No se pudo asignar el profesor. Intente nuevamente.",
    });
  });
});

describe("assignmentEditFormSchema", () => {
  test("loads status and notes; no notes read as blank", () => {
    expect(assignmentToEditForm({ status: "temporal", notes: "Reemplazo" })).toEqual({
      status: "temporal",
      notes: "Reemplazo",
    });
    expect(assignmentToEditForm({ status: "activo", notes: null })).toEqual({
      status: "activo",
      notes: "",
    });
  });

  test("a blank note becomes no note", () => {
    expect(toAssignmentEditInput({ status: "inactivo", notes: "  " })).toEqual({
      status: "inactivo",
      notes: undefined,
    });
  });

  test("keeps a trimmed note", () => {
    expect(toAssignmentEditInput({ status: "activo", notes: " Incapacidad " }).notes).toBe(
      "Incapacidad",
    );
  });

  test("an unchosen status shows the spec message", () => {
    expect(messages(assignmentEditFormSchema.safeParse({ status: "", notes: "" }))).toEqual([
      "Debes seleccionar un estado.",
    ]);
  });

  test("a note over 500 characters is refused with the API message", () => {
    expect(
      messages(assignmentEditFormSchema.safeParse({ status: "activo", notes: "x".repeat(501) })),
    ).toEqual(["No puede superar 500 caracteres."]);
  });
});
