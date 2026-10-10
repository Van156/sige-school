import { describe, expect, test } from "bun:test";

import type { PickedStudent } from "../types";
import { pickedCourseOptions, resolvePickedStudent, studentsOfCourse } from "./student-picker";

const student = (
  id: string,
  courseId: string | null,
  courseName: string | null,
): PickedStudent => ({
  id,
  name: `Estudiante ${id}`,
  document: `100${id}`,
  courseId,
  courseName,
  status: "activo",
});

const ANA = student("a", "c7", "7-01");
const LUIS = student("b", "c6", "6-01");
const SOFIA = student("c", "c6", "6-01");
const NO_COURSE = student("d", null, null);

describe("resolvePickedStudent", () => {
  test("a student always sees themselves", () => {
    expect(resolvePickedStudent("self", [ANA], undefined)).toBe(ANA);
    expect(resolvePickedStudent("self", [ANA], "other")).toBe(ANA);
    expect(resolvePickedStudent("self", [], undefined)).toBeUndefined();
  });

  test("a parent sees the requested child, else the first one", () => {
    expect(resolvePickedStudent("children", [ANA, LUIS], "b")).toBe(LUIS);
    expect(resolvePickedStudent("children", [ANA, LUIS], undefined)).toBe(ANA);
    // A child id that is not theirs falls back instead of leaking another student.
    expect(resolvePickedStudent("children", [ANA, LUIS], "zz")).toBe(ANA);
    expect(resolvePickedStudent("children", [], undefined)).toBeUndefined();
  });

  test("staff see nobody until they choose a student in scope", () => {
    expect(resolvePickedStudent("staff", [ANA, LUIS], undefined)).toBeUndefined();
    expect(resolvePickedStudent("staff", [ANA, LUIS], "b")).toBe(LUIS);
    expect(resolvePickedStudent("staff", [ANA, LUIS], "zz")).toBeUndefined();
  });
});

describe("pickedCourseOptions", () => {
  test("lists each course once, by name, skipping students without a course", () => {
    expect(pickedCourseOptions([ANA, LUIS, SOFIA, NO_COURSE])).toEqual([
      { value: "c6", label: "6-01" },
      { value: "c7", label: "7-01" },
    ]);
  });
});

describe("studentsOfCourse", () => {
  test("narrows to one course, or keeps everyone for no course", () => {
    expect(studentsOfCourse([ANA, LUIS, SOFIA], "c6")).toEqual([LUIS, SOFIA]);
    expect(studentsOfCourse([ANA, LUIS], "")).toEqual([ANA, LUIS]);
  });
});
