import { describe, expect, test } from "bun:test";

import { enrollmentMessages, isStale, planBulkEnrollment } from "./enrollment";
import type { BulkEnrollmentInput } from "./enrollment";

const course = { id: "c1", campusId: "main", academicYear: "2026", maxStudents: 3 };

const base: BulkEnrollmentInput = {
  course,
  offeringIds: ["o1", "o2"],
  students: [
    { id: "s1", status: "activo", courseId: null },
    { id: "s2", status: "activo", courseId: "c0" },
  ],
  existing: [],
  currentStudents: 0,
};

describe("planBulkEnrollment (SCH-R5)", () => {
  test("one activa row per student x offering for the course's year", () => {
    const plan = planBulkEnrollment(base);
    expect(plan).toEqual({
      ok: true,
      students: ["s1", "s2"],
      rows: [
        { studentId: "s1", offeringId: "o1", academicYear: "2026" },
        { studentId: "s1", offeringId: "o2", academicYear: "2026" },
        { studentId: "s2", offeringId: "o1", academicYear: "2026" },
        { studentId: "s2", offeringId: "o2", academicYear: "2026" },
      ],
      created: 4,
      skipped: 0,
      overCapacity: false,
    });
  });

  test("skips existing (student, offering, year) and ignores other years", () => {
    const plan = planBulkEnrollment({
      ...base,
      existing: [
        { studentId: "s1", offeringId: "o1", academicYear: "2026" },
        { studentId: "s2", offeringId: "o2", academicYear: "2025" },
      ],
    });
    expect(plan.ok && plan.rows.map((r) => `${r.studentId}:${r.offeringId}`)).toEqual([
      "s1:o2",
      "s2:o1",
      "s2:o2",
    ]);
    expect(plan.ok && [plan.created, plan.skipped]).toEqual([3, 1]);
  });

  test("a full re-run is idempotent: nothing to create", () => {
    const existing = ["s1", "s2"].flatMap((studentId) =>
      ["o1", "o2"].map((offeringId) => ({ studentId, offeringId, academicYear: "2026" })),
    );
    const plan = planBulkEnrollment({
      ...base,
      students: base.students.map((s) => ({ ...s, courseId: "c1" })),
      existing,
      currentStudents: 2,
    });
    expect(plan.ok && [plan.created, plan.skipped, plan.overCapacity]).toEqual([0, 4, false]);
  });

  test("repeated student ids are planned once", () => {
    const plan = planBulkEnrollment({ ...base, students: [base.students[0]!, base.students[0]!] });
    expect(plan.ok && plan.students).toEqual(["s1"]);
    expect(plan.ok && plan.created).toBe(2);
  });

  test("refuses an empty selection", () => {
    expect(planBulkEnrollment({ ...base, students: [] })).toEqual({
      ok: false,
      reason: "no_students",
      message: "Seleccione al menos un estudiante.",
    });
  });

  test("refuses the whole call when any student is not active", () => {
    expect(
      planBulkEnrollment({
        ...base,
        students: [...base.students, { id: "s3", status: "retirado", courseId: null }],
      }),
    ).toEqual({
      ok: false,
      reason: "inactive_student",
      message: "Solo se pueden matricular estudiantes activos.",
    });
  });

  test("refuses a course without offerings", () => {
    expect(planBulkEnrollment({ ...base, offeringIds: [] })).toEqual({
      ok: false,
      reason: "no_offerings",
      message: "El grado no tiene materias asignadas.",
    });
  });

  describe("capacity (D3)", () => {
    test("current + selected newcomers equal to the maximum is fine", () => {
      const plan = planBulkEnrollment({ ...base, currentStudents: 1 });
      expect(plan.ok && plan.overCapacity).toBe(false);
    });
    test("exceeding the maximum fails with the capacity message", () => {
      expect(planBulkEnrollment({ ...base, currentStudents: 2 })).toEqual({
        ok: false,
        reason: "over_capacity",
        message: "El grado superaría su capacidad máxima (3 estudiantes).",
      });
    });
    test("students already in the course are not counted twice", () => {
      const plan = planBulkEnrollment({
        ...base,
        students: [
          { id: "s1", status: "activo", courseId: "c1" },
          { id: "s2", status: "activo", courseId: "c1" },
        ],
        currentStudents: 3,
      });
      expect(plan.ok && plan.overCapacity).toBe(false);
    });
    test("allowOverCapacity plans anyway and flags the warning", () => {
      const plan = planBulkEnrollment({ ...base, currentStudents: 2, allowOverCapacity: true });
      expect(plan.ok && [plan.created, plan.overCapacity]).toEqual([4, true]);
    });
  });

  test("message builders", () => {
    expect(enrollmentMessages.overCapacity(40)).toBe(
      "El grado superaría su capacidad máxima (40 estudiantes).",
    );
    expect(enrollmentMessages.admissionOverCapacity(40)).toBe(
      "El grado supera su capacidad máxima (40 estudiantes).",
    );
  });
});

describe("isStale (SCH-R7)", () => {
  test("same course is not stale", () => {
    expect(isStale("c1", "c1")).toBe(false);
  });
  test("a different or missing current course is stale", () => {
    expect(isStale("c1", "c2")).toBe(true);
    expect(isStale("c1", null)).toBe(true);
  });
});
