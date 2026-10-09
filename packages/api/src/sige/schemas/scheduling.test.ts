import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";

import {
  assignmentAssignInput,
  assignmentUpdateInput,
  classroomInput,
  offeringCreateBulkInput,
  offeringUpdateInput,
  scheduleGenerateInput,
  timeBlockInput,
} from "./scheduling";

function issues(schema: ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    (byField[issue.path.join(".")] ??= []).push(issue.message);
  }
  return byField;
}

const classroom = {
  campusId: "c1",
  name: "Aula 101",
  code: "AULA-101",
  capacity: 40,
  floor: 1,
  classroomType: "aula",
};

describe("classroomInput (SCH-08)", () => {
  test("accepts a valid classroom and applies defaults", () => {
    const parsed = classroomInput.parse({
      campusId: "c1",
      name: "A",
      code: "A1",
      classroomType: "aula",
    });
    expect(parsed.capacity).toBe(40);
    expect(parsed.floor).toBe(1);
  });
  test("verbatim messages", () => {
    expect(issues(classroomInput, { ...classroom, campusId: "", name: " ", code: "" })).toEqual({
      campusId: ["Debes seleccionar una sede."],
      name: ["El nombre es obligatorio."],
      code: ["El código es obligatorio."],
    });
    expect(issues(classroomInput, { ...classroom, capacity: 9 }).capacity).toEqual([
      "La capacidad debe estar entre 10 y 100.",
    ]);
    expect(issues(classroomInput, { ...classroom, capacity: 101 }).capacity).toEqual([
      "La capacidad debe estar entre 10 y 100.",
    ]);
    expect(issues(classroomInput, { ...classroom, floor: 0 }).floor).toEqual([
      "El piso debe ser 1 o mayor.",
    ]);
  });
  test("resources must be a JSON object", () => {
    expect(issues(classroomInput, { ...classroom, resources: { proyector: true } })).toEqual({});
    expect(issues(classroomInput, { ...classroom, resources: null })).toEqual({});
    for (const bad of [[1], "x", 3]) {
      expect(issues(classroomInput, { ...classroom, resources: bad }).resources).toEqual([
        "El formato JSON no es válido.",
      ]);
    }
  });
});

describe("timeBlockInput (SCH-10)", () => {
  const block = {
    campusId: "c1",
    name: "Bloque 1",
    shift: "Mañana",
    startTime: "07:00",
    endTime: "08:00",
    orderNum: 1,
  };
  test("accepts a valid block; isBreak defaults to false", () => {
    expect(timeBlockInput.parse(block).isBreak).toBe(false);
  });
  test("required fields", () => {
    expect(
      issues(timeBlockInput, { ...block, campusId: "", name: "", startTime: "", endTime: "" }),
    ).toEqual({
      campusId: ["Debes seleccionar una sede."],
      name: ["El nombre es obligatorio."],
      startTime: ["La hora de inicio es obligatoria."],
      endTime: ["La hora de fin es obligatoria."],
    });
  });
  test("end must be after start (adjacent and equal rejected)", () => {
    for (const endTime of ["07:00", "06:59"]) {
      expect(issues(timeBlockInput, { ...block, endTime }).endTime).toEqual([
        "La hora de fin debe ser posterior a la de inicio.",
      ]);
    }
  });
  test("order and shift", () => {
    expect(issues(timeBlockInput, { ...block, orderNum: 0 }).orderNum).toEqual([
      "El orden debe ser 1 o mayor.",
    ]);
    expect(issues(timeBlockInput, { ...block, shift: "Sabatina" }).shift).toBeDefined();
  });
});

describe("offering inputs (SCH-05/06)", () => {
  const bulk = { courseIds: ["g1"], subjectIds: ["s1"], hoursPerWeek: 4 };
  test("accepts a valid bulk input", () => {
    expect(issues(offeringCreateBulkInput, bulk)).toEqual({});
    expect(issues(offeringCreateBulkInput, { ...bulk, teacherPersonId: "p1" })).toEqual({});
  });
  test("at least one grade and subject", () => {
    expect(issues(offeringCreateBulkInput, { ...bulk, courseIds: [], subjectIds: [] })).toEqual({
      courseIds: ["Seleccione al menos un grado."],
      subjectIds: ["Seleccione al menos una materia."],
    });
  });
  test("hours 1..20, integer", () => {
    for (const hoursPerWeek of [0, 21, 2.5]) {
      expect(issues(offeringCreateBulkInput, { ...bulk, hoursPerWeek }).hoursPerWeek).toEqual([
        "La intensidad debe estar entre 1 y 20 horas.",
      ]);
      expect(issues(offeringUpdateInput, { id: "o", hoursPerWeek }).hoursPerWeek).toEqual([
        "La intensidad debe estar entre 1 y 20 horas.",
      ]);
    }
  });
  test("caps at 50 each and 500 combinations", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `i${i}`);
    expect(
      issues(offeringCreateBulkInput, { ...bulk, courseIds: ids(51) }).courseIds,
    ).toBeDefined();
    expect(
      issues(offeringCreateBulkInput, { ...bulk, courseIds: ids(50), subjectIds: ids(11) }),
    ).not.toEqual({});
    expect(
      issues(offeringCreateBulkInput, { ...bulk, courseIds: ids(50), subjectIds: ids(10) }),
    ).toEqual({});
  });
});

describe("assignment inputs (SCH-04)", () => {
  test("required selections", () => {
    expect(
      issues(assignmentAssignInput, { courseId: "", subjectId: "", teacherPersonId: "" }),
    ).toEqual({
      courseId: ["Debes seleccionar un grado."],
      subjectId: ["Debes seleccionar una materia."],
      teacherPersonId: ["Debes seleccionar un profesor."],
    });
    expect(
      issues(assignmentAssignInput, { courseId: "g", subjectId: "s", teacherPersonId: "p" }),
    ).toEqual({});
  });
  test("update: status enum and notes <= 500", () => {
    expect(issues(assignmentUpdateInput, { id: "a", status: "temporal", notes: "x" })).toEqual({});
    expect(issues(assignmentUpdateInput, { id: "a", status: "otro" }).status).toBeDefined();
    expect(
      issues(assignmentUpdateInput, { id: "a", status: "activo", notes: "x".repeat(501) }).notes,
    ).toEqual(["No puede superar 500 caracteres."]);
    expect(
      assignmentUpdateInput.parse({ id: "a", status: "activo", notes: "  " }).notes,
    ).toBeUndefined();
  });
});

describe("scheduleGenerateInput (SCH-12)", () => {
  test("campus and course are optional", () => {
    expect(scheduleGenerateInput.parse({})).toEqual({});
    expect(issues(scheduleGenerateInput, { campusId: "c", courseId: "g" })).toEqual({});
  });
});
