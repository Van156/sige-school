import { describe, expect, test } from "bun:test";

import {
  courseCheckItems,
  courseFilterOptions,
  subjectCheckItems,
  subjectFilterOptions,
  teacherOptions,
} from "./offering-choices";

const COURSES = [
  { id: "c1", name: "6-01", campusId: "k1", shift: "Mañana" },
  { id: "c2", name: "7-01", campusId: "k9", shift: "Tarde" },
];

describe("offering choices", () => {
  test("course check items hint '{sede} · {jornada}', or just the jornada for an unknown campus", () => {
    expect(courseCheckItems(COURSES, new Map([["k1", "Sede Principal"]]))).toEqual([
      { value: "c1", label: "6-01", hint: "Sede Principal · Mañana" },
      { value: "c2", label: "7-01", hint: "Tarde" },
    ]);
  });

  test("subject check items hint the code when there is one", () => {
    expect(
      subjectCheckItems([
        { id: "s1", name: "Matemáticas", code: "MAT" },
        { id: "s2", name: "Ética", code: null },
      ]),
    ).toEqual([
      { value: "s1", label: "Matemáticas", hint: "MAT" },
      { value: "s2", label: "Ética", hint: undefined },
    ]);
  });

  test("filter and teacher options keep the server order", () => {
    expect(courseFilterOptions(COURSES).map((option) => option.label)).toEqual(["6-01", "7-01"]);
    expect(subjectFilterOptions([{ id: "s1", name: "Artes", code: null }])).toEqual([
      { value: "s1", label: "Artes" },
    ]);
    expect(teacherOptions([{ personId: "p1", name: "Ana Ruiz" }])).toEqual([
      { value: "p1", label: "Ana Ruiz" },
    ]);
  });
});
