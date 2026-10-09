import { describe, expect, test } from "bun:test";

import {
  COURSE_FIELD_BY_MESSAGE,
  courseFormSchema,
  directorItems,
  directorSelection,
  NO_DIRECTOR,
  courseToFormValues,
  emptyCourseForm,
  levelAfterCampusChange,
  levelChoices,
  toCourseInput,
} from "./course-form";
import type { CourseRow, LevelRow } from "../types";

const course: CourseRow = {
  id: "g1",
  name: "6-1",
  campusId: "c1",
  campusName: "Sede Principal",
  levelId: "l1",
  levelName: "Sexto",
  directorPersonId: "p1",
  directorName: "Ada Lovelace",
  directorActive: true,
  academicYear: "2026",
  shift: "Tarde",
  maxStudents: 35,
  studentCount: 0,
};

const levels: LevelRow[] = [
  {
    id: "l1",
    campusId: "c1",
    campusName: "Sede Principal",
    name: "Sexto",
    orderNum: 6,
    courseCount: 1,
  },
  {
    id: "l2",
    campusId: "c2",
    campusName: "Sede Norte",
    name: "Sexto",
    orderNum: 6,
    courseCount: 0,
  },
];

function messages(values: Parameters<typeof courseFormSchema.safeParse>[0]) {
  const result = courseFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("course form", () => {
  test("starts with the institution year, Mañana and capacity 40", () => {
    expect(emptyCourseForm("2026")).toEqual({
      campusId: "",
      levelId: "",
      directorPersonId: "",
      name: "",
      academicYear: "2026",
      shift: "Mañana",
      maxStudents: "40",
    });
  });

  test("parses the capacity text and turns a blank level into null", () => {
    expect(
      toCourseInput({
        ...emptyCourseForm("2026"),
        campusId: "c1",
        name: " 6-1 ",
        maxStudents: "35",
      }),
    ).toEqual({
      campusId: "c1",
      levelId: null,
      directorPersonId: null,
      name: "6-1",
      academicYear: "2026",
      shift: "Mañana",
      maxStudents: 35,
    });
  });

  test("a blank capacity reads as the default 40", () => {
    const input = toCourseInput({
      ...emptyCourseForm("2026"),
      campusId: "c1",
      name: "A",
      maxStudents: " ",
    });
    expect(input.maxStudents).toBe(40);
  });

  test("reports the spec messages", () => {
    const values = emptyCourseForm("2026");
    expect(messages(values)).toEqual([
      "Debes seleccionar una sede.",
      "El nombre del grado es obligatorio.",
    ]);
    expect(messages({ ...values, campusId: "c1", name: "A", maxStudents: "61" })).toEqual([
      "La capacidad debe estar entre 1 y 60.",
    ]);
    expect(messages({ ...values, campusId: "c1", name: "A", maxStudents: "0" })).toEqual([
      "La capacidad debe estar entre 1 y 60.",
    ]);
    expect(messages({ ...values, campusId: "c1", name: "A", academicYear: "" })).toEqual([
      "El año lectivo es obligatorio.",
    ]);
  });

  test("round-trips a course into form values", () => {
    expect(courseToFormValues(course)).toEqual({
      campusId: "c1",
      levelId: "l1",
      directorPersonId: "p1",
      name: "6-1",
      academicYear: "2026",
      shift: "Tarde",
      maxStudents: "35",
    });
    expect(courseToFormValues({ ...course, levelId: null }).levelId).toBe("");
  });

  test("the chosen director is sent as is and a blank one clears it", () => {
    expect(toCourseInput(courseToFormValues(course)).directorPersonId).toBe("p1");
    expect(toCourseInput(courseToFormValues({ ...course, directorPersonId: null }))).toMatchObject({
      directorPersonId: null,
    });
    expect(
      toCourseInput({ ...courseToFormValues(course), directorPersonId: "" }).directorPersonId,
    ).toBeNull();
  });

  test("maps the director rejection onto the director field", () => {
    expect(
      COURSE_FIELD_BY_MESSAGE["El director debe ser un profesor activo de la institución."],
    ).toBe("directorPersonId");
  });
});

describe("director select", () => {
  const teachers = [
    { personId: "t1", name: "Ada Lovelace" },
    { personId: "t2", name: "Alan Turing" },
  ];

  test("always offers the explicit no-director choice first, then the teachers", () => {
    expect(directorItems(teachers)).toEqual([
      NO_DIRECTOR,
      { value: "t1", label: "Ada Lovelace" },
      { value: "t2", label: "Alan Turing" },
    ]);
    expect(NO_DIRECTOR).toEqual({ value: "", label: "Sin director asignado" });
  });

  test("does not repeat a current director who is among the results", () => {
    const current = { directorPersonId: "t1", directorName: "Ada Lovelace", directorActive: true };
    expect(directorItems(teachers, current)).toEqual(directorItems(teachers));
    expect(
      directorItems(teachers, { directorPersonId: null, directorName: null, directorActive: null }),
    ).toEqual(directorItems(teachers));
  });

  test("keeps an active current director outside the results, unmarked", () => {
    const items = directorItems(teachers, {
      directorPersonId: "far",
      directorName: "Zoe Zeta",
      directorActive: true,
    });
    expect(items[1]).toEqual({ value: "far", label: "Zoe Zeta" });
  });

  test("marks a current director inactive only when the server says so", () => {
    const base = { directorPersonId: "gone", directorName: "Grace Hopper" };
    expect(directorItems(teachers, { ...base, directorActive: false })[1]).toEqual({
      value: "gone",
      label: "Grace Hopper (inactivo)",
    });
    expect(directorItems(teachers, { ...base, directorActive: null })[1]?.label).toBe(
      "Grace Hopper",
    );
  });

  test("keeps the teacher just picked while the results change, once", () => {
    const picked = { value: "t9", label: "Zoe Zeta" };
    expect(directorItems([], undefined, picked)).toEqual([NO_DIRECTOR, picked]);
    expect(directorItems([{ personId: "t9", name: "Zoe Zeta" }], undefined, picked)).toEqual([
      NO_DIRECTOR,
      picked,
    ]);
    expect(directorItems([], undefined, NO_DIRECTOR)).toEqual([NO_DIRECTOR]);
  });

  test("falls back to the id when the current director has no name", () => {
    expect(
      directorItems([], { directorPersonId: "x", directorName: null, directorActive: true })[1],
    ).toEqual({ value: "x", label: "x" });
  });

  test("selects the item for the form value, or no director for a blank or unknown one", () => {
    const items = directorItems(teachers);
    expect(directorSelection(items, "t2")).toEqual({ value: "t2", label: "Alan Turing" });
    expect(directorSelection(items, "")).toBe(NO_DIRECTOR);
    expect(directorSelection(items, "missing")).toBe(NO_DIRECTOR);
  });
});

describe("level select", () => {
  test("offers only the chosen campus's levels, labelled with the campus", () => {
    expect(levelChoices(levels, "c2")).toEqual([{ value: "l2", label: "Sexto (Sede Norte)" }]);
    expect(levelChoices(levels, "")).toEqual([]);
  });

  test("keeps the level only while it belongs to the campus", () => {
    expect(levelAfterCampusChange("l1", "c1", levels)).toBe("l1");
    expect(levelAfterCampusChange("l1", "c2", levels)).toBe("");
    expect(levelAfterCampusChange("", "c2", levels)).toBe("");
  });
});
