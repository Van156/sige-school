import { describe, expect, test } from "bun:test";

import {
  COURSE_FIELD_BY_MESSAGE,
  courseFormSchema,
  directorChoices,
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

  test("offers the active teachers by name", () => {
    expect(directorChoices(teachers)).toEqual([
      { value: "t1", label: "Ada Lovelace" },
      { value: "t2", label: "Alan Turing" },
    ]);
  });

  test("does not repeat a current director who is still an active teacher", () => {
    expect(
      directorChoices(teachers, { directorPersonId: "t1", directorName: "Ada Lovelace" }),
    ).toEqual(directorChoices(teachers));
    expect(directorChoices(teachers, { directorPersonId: null, directorName: null })).toEqual(
      directorChoices(teachers),
    );
  });

  test("keeps a deactivated current director first, marked inactive", () => {
    expect(
      directorChoices(teachers, { directorPersonId: "gone", directorName: "Grace Hopper" })[0],
    ).toEqual({
      value: "gone",
      label: "Grace Hopper (inactivo)",
    });
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
