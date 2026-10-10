import { describe, expect, test } from "bun:test";
import type { WeeklySchedule } from "@base-template/sige-core";

import {
  hasScheduledClasses,
  resolveCourseId,
  scheduleAudience,
  scheduleDescription,
  scheduleSearchSchema,
  slotDeleteName,
} from "./schedule-view";

const CELL = {
  slotId: "s1",
  offeringId: "o1",
  subjectName: "Inglés",
  teacherName: null,
  classroomName: "Aula 1",
  courseName: "6-01",
};

describe("scheduleAudience", () => {
  test("maps teacher and student kinds to their own view", () => {
    expect(scheduleAudience("teacher")).toBe("teacher");
    expect(scheduleAudience("student")).toBe("student");
  });

  test("parents and viewers have no schedule", () => {
    expect(scheduleAudience("parent")).toBe("none");
    expect(scheduleAudience("viewer")).toBe("none");
  });

  test("managers, custom roles and users without a person get the course view", () => {
    for (const kind of ["owner", "admin", "coordinator", "custom", null] as const) {
      expect(scheduleAudience(kind)).toBe("manager");
    }
  });

  test("describes each audience as the spec does", () => {
    expect(scheduleDescription("manager")).toBe("Horario semanal por grado");
    expect(scheduleDescription("teacher")).toBe("Tus clases de la semana");
    expect(scheduleDescription("student")).toBe("Horario semanal de tu grado");
  });
});

describe("resolveCourseId", () => {
  const courses = [{ id: "c1" }, { id: "c2" }];

  test("keeps a requested course that exists", () => {
    expect(resolveCourseId(courses, "c2")).toBe("c2");
  });

  test("falls back to the first course for a missing or unknown id", () => {
    expect(resolveCourseId(courses, undefined)).toBe("c1");
    expect(resolveCourseId(courses, "gone")).toBe("c1");
  });

  test("is undefined without courses", () => {
    expect(resolveCourseId([], "c1")).toBeUndefined();
  });
});

describe("hasScheduledClasses", () => {
  test("is false for block rows without classes", () => {
    const empty: WeeklySchedule = {
      title: "Horario",
      rows: [{ time: "07:00 - 08:00", isBreak: false, cells: [null, null, null, null, null] }],
    };
    expect(hasScheduledClasses(empty)).toBe(false);
    expect(hasScheduledClasses({ title: "Horario", rows: [] })).toBe(false);
  });

  test("is true when any day holds a class", () => {
    const filled: WeeklySchedule = {
      title: "Horario",
      rows: [{ time: "07:00 - 08:00", isBreak: false, cells: [null, null, CELL, null, null] }],
    };
    expect(hasScheduledClasses(filled)).toBe(true);
  });
});

describe("scheduleSearchSchema", () => {
  test("accepts a course id and drops anything invalid", () => {
    expect(scheduleSearchSchema.parse({ courseId: "c1" })).toEqual({ courseId: "c1" });
    expect(scheduleSearchSchema.parse({ courseId: "" }).courseId).toBeUndefined();
    expect(scheduleSearchSchema.parse({ courseId: 7 }).courseId).toBeUndefined();
    expect(scheduleSearchSchema.parse({}).courseId).toBeUndefined();
  });
});

describe("slotDeleteName", () => {
  test("names the class by its subject", () => {
    expect(slotDeleteName(CELL)).toBe("la clase de Inglés");
  });
});
