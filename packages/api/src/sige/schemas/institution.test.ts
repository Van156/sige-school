import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";

import {
  campusInput,
  courseInput,
  criterionInput,
  levelInput,
  periodInput,
  profileInput,
  subjectInput,
} from "./institution";

/** Messages of every issue produced by `schema` for `value`, keyed by the failing field. */
function issues(schema: ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  if (result.success) {
    return {};
  }
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    (byField[key] ??= []).push(issue.message);
  }
  return byField;
}

const campus = { name: "Sede Norte", jornada: "completa" };
const level = { campusId: "c1", name: "Primaria", orderNum: 1 };
const course = {
  campusId: "c1",
  name: "5A",
  academicYear: "2026",
  shift: "Mañana",
  maxStudents: 40,
};
const period = {
  academicYear: "2026",
  orderNum: 1,
  name: "Primer periodo",
  shortName: "P1",
  startDate: "2026-01-20",
  endDate: "2026-03-31",
};
const criterion = { name: "Tareas", weight: 20, orderNum: 1 };

describe("profileInput", () => {
  const profile = { name: "Colegio", academicYear: "2026" };
  test("accepts a minimal profile", () => {
    expect(profileInput.safeParse(profile).success).toBe(true);
  });
  test("required messages", () => {
    expect(issues(profileInput, { name: "  ", academicYear: "" })).toEqual({
      name: ["El nombre de la institución es obligatorio."],
      academicYear: ["El año lectivo es obligatorio."],
    });
  });
  test("year must be four digits", () => {
    expect(issues(profileInput, { ...profile, academicYear: "26" }).academicYear).toEqual([
      "El año lectivo es obligatorio.",
    ]);
  });
  test("nit is optional and checked as 5-20 digits, dots, hyphen", () => {
    expect(profileInput.safeParse({ ...profile, nit: "900.123.456-7" }).success).toBe(true);
    expect(profileInput.safeParse({ ...profile, nit: "1234" }).success).toBe(false);
    expect(profileInput.safeParse({ ...profile, nit: "12345abc" }).success).toBe(false);
  });
  test("empty nit and email count as absent", () => {
    for (const blank of ["", "   "]) {
      const parsed = profileInput.safeParse({ ...profile, nit: blank, email: blank });
      expect(parsed.success).toBe(true);
      expect(parsed.data?.nit).toBeUndefined();
      expect(parsed.data?.email).toBeUndefined();
    }
  });
  test("email must be valid", () => {
    expect(issues(profileInput, { ...profile, email: "nope" }).email).toEqual([
      "Ingresa un correo válido.",
    ]);
  });
});

describe("campusInput", () => {
  test("accepts defaults", () => {
    expect(campusInput.parse(campus)).toMatchObject({ isMain: false, active: true });
  });
  test("name required, jornada required", () => {
    expect(issues(campusInput, { name: "", jornada: undefined })).toEqual({
      name: ["El nombre de la sede es obligatorio."],
      jornada: ["Debes seleccionar una jornada"],
    });
  });
  test("jornada rejects unknown values with the same message", () => {
    expect(issues(campusInput, { ...campus, jornada: "noche" }).jornada).toEqual([
      "Debes seleccionar una jornada",
    ]);
  });
});

describe("levelInput", () => {
  test("name required", () => {
    expect(issues(levelInput, { ...level, name: " " }).name).toEqual([
      "El nombre del nivel es obligatorio.",
    ]);
  });
  test.each([
    [-1, false],
    [0, true],
    [1.5, false],
  ])("orderNum %p valid=%p", (orderNum, valid) => {
    const result = levelInput.safeParse({ ...level, orderNum });
    expect(result.success).toBe(valid);
    if (!valid) {
      expect(issues(levelInput, { ...level, orderNum }).orderNum).toEqual([
        "El orden debe ser un entero desde 0.",
      ]);
    }
  });
});

describe("courseInput", () => {
  test("name and year required", () => {
    expect(issues(courseInput, { ...course, name: "", academicYear: "" })).toEqual({
      name: ["El nombre del grado es obligatorio."],
      academicYear: ["El año lectivo es obligatorio."],
    });
  });
  test.each([
    [0, false],
    [1, true],
    [60, true],
    [61, false],
  ])("maxStudents %p valid=%p", (maxStudents, valid) => {
    const result = courseInput.safeParse({ ...course, maxStudents });
    expect(result.success).toBe(valid);
    if (!valid) {
      expect(issues(courseInput, { ...course, maxStudents }).maxStudents).toEqual([
        "La capacidad debe estar entre 1 y 60.",
      ]);
    }
  });
  test("capacity defaults to 40 and shift is validated", () => {
    const { maxStudents: _omit, ...withoutCapacity } = course;
    expect(courseInput.parse(withoutCapacity).maxStudents).toBe(40);
    expect(courseInput.safeParse({ ...course, shift: "Tarde" }).success).toBe(true);
    expect(courseInput.safeParse({ ...course, shift: "Noche" }).success).toBe(false);
  });
});

describe("subjectInput", () => {
  test("name required, code optional", () => {
    expect(issues(subjectInput, { name: "" }).name).toEqual([
      "El nombre de la asignatura es obligatorio.",
    ]);
    expect(subjectInput.safeParse({ name: "Matemáticas", code: "MAT" }).success).toBe(true);
  });
});

describe("periodInput", () => {
  test("accepts a valid period", () => {
    expect(periodInput.safeParse(period).success).toBe(true);
  });
  test("required messages", () => {
    expect(
      issues(periodInput, {
        ...period,
        academicYear: "",
        name: "",
        shortName: "",
        startDate: "",
        endDate: "",
      }),
    ).toEqual({
      academicYear: ["El año académico es obligatorio."],
      name: ["El nombre del periodo es obligatorio."],
      shortName: ["El nombre corto es obligatorio."],
      startDate: ["La fecha de inicio es obligatoria."],
      endDate: ["La fecha de fin es obligatoria."],
    });
  });
  test("end must be strictly after start", () => {
    expect(issues(periodInput, { ...period, endDate: period.startDate }).endDate).toEqual([
      "La fecha de fin debe ser posterior a la de inicio.",
    ]);
    expect(issues(periodInput, { ...period, endDate: "2026-01-01" }).endDate).toEqual([
      "La fecha de fin debe ser posterior a la de inicio.",
    ]);
  });
  test.each([
    [0, "El orden debe ser un entero desde 1."],
    [1, null],
    [4, null],
    [5, "El orden debe estar entre 1 y 4."],
    [2.5, "El orden debe ser un entero desde 1."],
  ])("orderNum %p", (orderNum, message) => {
    const found = issues(periodInput, { ...period, orderNum }).orderNum;
    expect(found).toEqual(message ? [message] : (undefined as never));
  });
});

describe("criterionInput", () => {
  test("name required", () => {
    expect(issues(criterionInput, { ...criterion, name: "" }).name).toEqual([
      "El nombre del criterio es obligatorio.",
    ]);
  });
  test("weight required and numeric", () => {
    expect(issues(criterionInput, { name: "x", orderNum: 1 }).weight).toEqual([
      "El peso es obligatorio.",
    ]);
    expect(issues(criterionInput, { ...criterion, weight: "abc" }).weight).toEqual([
      "El peso debe ser un número válido.",
    ]);
    expect(issues(criterionInput, { ...criterion, weight: Number.NaN }).weight).toEqual([
      "El peso debe ser un número válido.",
    ]);
  });
  test.each([
    [0, false],
    [0.01, true],
    [100, true],
    [100.01, false],
  ])("weight %p valid=%p", (weight, valid) => {
    const result = criterionInput.safeParse({ ...criterion, weight });
    expect(result.success).toBe(valid);
    if (!valid) {
      expect(issues(criterionInput, { ...criterion, weight }).weight).toEqual([
        "El peso debe ser mayor a 0 y menor o igual a 100.",
      ]);
    }
  });
  test("more than two decimals is out of range", () => {
    expect(criterionInput.safeParse({ ...criterion, weight: 12.345 }).success).toBe(false);
  });
  test("orderNum is an integer from 1", () => {
    expect(issues(criterionInput, { ...criterion, orderNum: 0 }).orderNum).toEqual([
      "El orden debe ser un entero desde 1.",
    ]);
  });
});

describe("tenant inputs never carry organizationId", () => {
  test.each([
    ["profile", profileInput],
    ["campus", campusInput],
    ["level", levelInput],
    ["course", courseInput],
    ["subject", subjectInput],
    ["period", periodInput],
    ["criterion", criterionInput],
  ] as const)("%s", (_name, schema) => {
    const shape = (schema as unknown as { shape: Record<string, unknown> }).shape;
    expect(Object.keys(shape)).not.toContain("organizationId");
  });
});

describe("calendar-valid ISO dates", () => {
  const dates = (startDate: string, endDate: string) => ({ ...period, startDate, endDate });
  test.each([
    ["2024-02-29", true],
    ["2025-02-29", false],
    ["2026-02-31", false],
    ["2026-13-01", false],
    ["2026-04-31", false],
    ["2026-00-10", false],
    ["2026-12-31", true],
  ])("startDate %p valid=%p", (value, valid) => {
    const result = periodInput.safeParse(dates(value, "2030-01-01"));
    expect(result.success).toBe(valid);
    if (!valid) {
      expect(issues(periodInput, dates(value, "2030-01-01")).startDate).toEqual([
        "La fecha de inicio es obligatoria.",
      ]);
    }
  });
  test("endDate keeps its own message", () => {
    expect(issues(periodInput, dates("2026-01-01", "2026-02-31")).endDate).toEqual([
      "La fecha de fin es obligatoria.",
    ]);
  });
});
