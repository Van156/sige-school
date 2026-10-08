import { describe, expect, test } from "bun:test";

import {
  courseFormSchema,
  courseToFormValues,
  emptyCourseForm,
  levelAfterCampusChange,
  levelChoices,
  toCourseInput,
  toCourseUpdate,
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
      name: "6-1",
      academicYear: "2026",
      shift: "Tarde",
      maxStudents: "35",
    });
    expect(courseToFormValues({ ...course, levelId: null }).levelId).toBe("");
  });

  test("an update keeps the director the form cannot edit", () => {
    const input = toCourseInput(courseToFormValues(course));
    expect(toCourseUpdate(input, course).directorPersonId).toBe("p1");
    expect(toCourseUpdate(input, { directorPersonId: null }).directorPersonId).toBeNull();
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
