import { describe, expect, test } from "bun:test";

import {
  coursesOfCampus,
  generatableCourses,
  isEmptyResult,
  targetCourses,
  toGenerateInput,
} from "./schedule-generation";

const COURSES = [
  { id: "c1", name: "6-01", campusId: "k1" },
  { id: "c2", name: "7-01", campusId: "k2" },
  { id: "c3", name: "8-01", campusId: "k2" },
  { id: "c4", name: "9-01", campusId: "k-inactive" },
];

describe("generatableCourses", () => {
  test("keeps only the courses of active campuses", () => {
    expect(generatableCourses(COURSES, [{ id: "k1" }, { id: "k2" }]).map((c) => c.id)).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
  });
});

describe("coursesOfCampus", () => {
  test("filters by campus and returns all for the empty choice", () => {
    expect(coursesOfCampus(COURSES, "k2").map((c) => c.id)).toEqual(["c2", "c3"]);
    expect(coursesOfCampus(COURSES, "")).toHaveLength(4);
  });
});

describe("targetCourses", () => {
  test("the chosen course wins over the campus", () => {
    expect(targetCourses(COURSES, { campusId: "k2", courseId: "c1" }).map((c) => c.id)).toEqual([
      "c1",
    ]);
  });

  test("a campus alone targets its courses; nothing chosen targets all", () => {
    expect(targetCourses(COURSES, { campusId: "k2", courseId: "" }).map((c) => c.id)).toEqual([
      "c2",
      "c3",
    ]);
    expect(targetCourses(COURSES, { campusId: "", courseId: "" })).toHaveLength(4);
  });

  test("an unknown course targets nothing", () => {
    expect(targetCourses(COURSES, { campusId: "", courseId: "gone" })).toEqual([]);
  });
});

describe("toGenerateInput", () => {
  test("sends only the narrowest selection", () => {
    expect(toGenerateInput({ campusId: "k1", courseId: "c1" })).toEqual({ courseId: "c1" });
    expect(toGenerateInput({ campusId: "k1", courseId: "" })).toEqual({ campusId: "k1" });
    expect(toGenerateInput({ campusId: "", courseId: "" })).toEqual({});
  });
});

describe("isEmptyResult", () => {
  test("is true only when nothing was assigned", () => {
    const base = { assigned: 0, conflicts: 0, courses: 2, skipped: [] };
    expect(isEmptyResult(base)).toBe(true);
    expect(isEmptyResult({ ...base, assigned: 3 })).toBe(false);
  });
});
