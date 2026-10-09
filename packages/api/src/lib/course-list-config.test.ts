import { describe, expect, test } from "bun:test";

import { courseListConfig } from "./course-list-config";
import { createListInput } from "./list-input";

const course = createListInput(courseListConfig);

describe("courseListConfig", () => {
  test("defaults to name ascending", () => {
    expect(course.parse({}).sort).toEqual([{ id: "name", desc: false }]);
  });

  test("sorts by the INS-11 columns and by nothing else", () => {
    for (const id of [
      "name",
      "campus",
      "director",
      "academicYear",
      "shift",
      "maxStudents",
      "studentCount",
    ]) {
      expect(course.safeParse({ sort: [{ id, desc: true }] }).success).toBe(true);
    }
    expect(course.safeParse({ sort: [{ id: "organizationId", desc: false }] }).success).toBe(false);
  });

  test("filters name as text and the others as selects; shift only accepts enum values", () => {
    const filter = (id: string, variant: string, operator: string, value: string) => ({
      filters: [{ id, variant, operator, value }],
    });
    expect(course.safeParse(filter("name", "text", "iLike", "6")).success).toBe(true);
    expect(course.safeParse(filter("campusId", "select", "eq", "c1")).success).toBe(true);
    expect(course.safeParse(filter("levelId", "select", "eq", "l1")).success).toBe(true);
    expect(course.safeParse(filter("academicYear", "select", "eq", "2026")).success).toBe(true);
    expect(course.safeParse(filter("shift", "select", "eq", "Tarde")).success).toBe(true);
    expect(course.safeParse(filter("shift", "select", "eq", "Madrugada")).success).toBe(false);
    expect(course.safeParse(filter("organizationId", "text", "eq", "org-b")).success).toBe(false);
    expect(course.safeParse(filter("name", "select", "eq", "6")).success).toBe(false);
  });
});
