import { enrollmentListConfig } from "@base-template/api/lib/enrollment-list-config";
import { describe, expect, test } from "bun:test";

import {
  deleteEntityName,
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_OPTIONS,
  enrollmentSearchConfig,
  enrollmentSearchDefaults,
  enrollmentSearchSchema,
  formatFinalScore,
  hasNoEnrollments,
  toEnrollmentListInput,
} from "./enrollment-list";

describe("enrollment search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...enrollmentSearchConfig.columnIds]).toEqual([
      ...enrollmentListConfig.sortableColumns,
    ]);
    // `academicYear` is a server filter SCH-01 does not expose.
    expect([...enrollmentSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(enrollmentListConfig.filterableColumns)
        .filter((id) => id !== "academicYear")
        .sort(),
    );
  });

  test("the status choices are the server's status allowlist, in order", () => {
    expect(ENROLLMENT_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      ...enrollmentListConfig.filterableColumns.status.options,
    ]);
    expect(ENROLLMENT_STATUS_OPTIONS.map((option) => option.label)).toEqual([
      "Activa",
      "Cancelada",
      "Retirada",
    ]);
  });

  test("defaults follow the server order: student, subject, course, 20 per page", () => {
    expect(enrollmentSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [...enrollmentListConfig.defaultSort],
      filters: [],
      joinOperator: "and",
    });
  });
});

describe("enrollmentSearchSchema", () => {
  test("keeps valid simple filters", () => {
    expect(
      enrollmentSearchSchema.parse({
        student: "ana",
        courseId: "c1",
        subjectId: "s1",
        status: "retirada",
      }),
    ).toMatchObject({ student: "ana", courseId: "c1", subjectId: "s1", status: "retirada" });
  });

  test("drops a status the server would reject", () => {
    expect(enrollmentSearchSchema.parse({ status: "activo" })).not.toHaveProperty("status");
  });
});

describe("toEnrollmentListInput", () => {
  test("turns the simple filters into list-input filters", () => {
    const input = toEnrollmentListInput(
      enrollmentSearchSchema.parse({ student: "zapata", status: "activa" }),
    );
    expect(input).toMatchObject({ page: 1, perPage: 20, joinOperator: "and" });
    expect(input.filters?.map((filter) => [filter.id, filter.value, filter.operator])).toEqual([
      ["student", "zapata", "iLike"],
      ["status", "activa", "eq"],
    ]);
  });
});

describe("cell formatting", () => {
  test("every status has its spec label", () => {
    expect(ENROLLMENT_STATUS_LABELS).toEqual({
      activa: "Activa",
      cancelada: "Cancelada",
      retirada: "Retirada",
    });
  });

  test("the final score shows one decimal or a dash", () => {
    expect(formatFinalScore(null)).toBe("-");
    expect(formatFinalScore(4)).toBe("4.0");
    expect(formatFinalScore(3.5)).toBe("3.5");
  });

  test("the delete flow names the student and subject", () => {
    expect(deleteEntityName({ studentName: "Ana Zapata", subjectName: "Arte" })).toBe(
      "la matrícula de Ana Zapata en Arte",
    );
  });

  test("the empty state needs a settled stats total of zero", () => {
    expect(hasNoEnrollments(undefined)).toBe(false);
    expect(hasNoEnrollments({ total: 0 })).toBe(true);
    expect(hasNoEnrollments({ total: 5 })).toBe(false);
  });
});
