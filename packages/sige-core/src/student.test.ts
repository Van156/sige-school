import { describe, expect, test } from "bun:test";

import {
  canChangeStudentStatus,
  checkCourseCampus,
  courseAfterCampusChange,
  isActiveStudent,
  STUDENT_DOCUMENT_TYPES,
  STUDENT_STATUSES,
  studentMessages,
} from "./student";
import type { StudentStatus } from "./student";

describe("student constants", () => {
  test("document types and statuses", () => {
    expect(STUDENT_DOCUMENT_TYPES).toEqual(["TI", "RC", "CC"]);
    expect(STUDENT_STATUSES).toEqual(["activo", "retirado", "graduado"]);
  });
});

describe("checkCourseCampus (STU-03 courseId)", () => {
  test("no course is always consistent", () => {
    expect(checkCourseCampus(null, "main")).toBeNull();
  });
  test("a course of the chosen campus is consistent", () => {
    expect(checkCourseCampus({ campusId: "main" }, "main")).toBeNull();
  });
  test("a course of another campus is refused with the spec message", () => {
    expect(checkCourseCampus({ campusId: "north" }, "main")).toBe(
      "El grado no pertenece a la sede seleccionada.",
    );
    expect(studentMessages.courseCampusMismatch).toBe(
      "El grado no pertenece a la sede seleccionada.",
    );
  });
});

describe("courseAfterCampusChange (STU-R4)", () => {
  test("keeps the course when it belongs to the new campus", () => {
    expect(courseAfterCampusChange({ id: "c1", campusId: "north" }, "north")).toBe("c1");
  });
  test("clears the course when it belongs to another campus", () => {
    expect(courseAfterCampusChange({ id: "c1", campusId: "main" }, "north")).toBeNull();
  });
  test("no course stays no course", () => {
    expect(courseAfterCampusChange(null, "north")).toBeNull();
  });
});

describe("student status transitions (STU-R5)", () => {
  const table: [StudentStatus, StudentStatus, boolean][] = [
    ["activo", "activo", true],
    ["activo", "retirado", true],
    ["activo", "graduado", true],
    ["retirado", "activo", true],
    ["retirado", "retirado", true],
    ["retirado", "graduado", false],
    ["graduado", "activo", true],
    ["graduado", "graduado", true],
    ["graduado", "retirado", false],
  ];
  test.each(table)("%p -> %p allowed: %p", (from, to, allowed) => {
    expect(canChangeStudentStatus(from, to)).toBe(allowed);
  });
  test("refusal message names both states", () => {
    expect(studentMessages.statusTransition("retirado", "graduado")).toBe(
      'No se puede cambiar el estado de "retirado" a "graduado".',
    );
  });
  test("only activo counts as active", () => {
    expect(STUDENT_STATUSES.filter(isActiveStudent)).toEqual(["activo"]);
  });
});
