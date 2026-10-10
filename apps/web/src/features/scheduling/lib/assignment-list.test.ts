import { assignmentListConfig } from "@base-template/api/lib/assignment-list-config";
import { describe, expect, test } from "bun:test";

import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_OPTIONS,
  assignmentSearchConfig,
  assignmentSearchDefaults,
  assignmentSearchSchema,
  deleteEntityName,
  hasNoAssignments,
  toAssignmentListInput,
} from "./assignment-list";

describe("assignment search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...assignmentSearchConfig.columnIds]).toEqual([
      ...assignmentListConfig.sortableColumns,
    ]);
    // `academicYear` is a server filter the UI does not expose.
    expect([...assignmentSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(assignmentListConfig.filterableColumns)
        .filter((id) => id !== "academicYear")
        .sort(),
    );
  });

  test("the status choices are the server's status allowlist, in order", () => {
    expect(ASSIGNMENT_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      ...assignmentListConfig.filterableColumns.status.options,
    ]);
    expect(ASSIGNMENT_STATUS_OPTIONS.map((option) => option.label)).toEqual([
      "Activo",
      "Inactivo",
      "Temporal",
    ]);
  });

  test("defaults follow the server order: course, then subject, 20 per page", () => {
    expect(assignmentSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [
        { id: "course", desc: false },
        { id: "subject", desc: false },
      ],
      filters: [],
      joinOperator: "and",
    });
  });
});

describe("assignmentSearchSchema", () => {
  test("keeps valid simple filters", () => {
    expect(
      assignmentSearchSchema.parse({
        teacher: "ana",
        courseId: "c1",
        subjectId: "s1",
        status: "temporal",
      }),
    ).toMatchObject({ teacher: "ana", courseId: "c1", subjectId: "s1", status: "temporal" });
  });

  test("drops a status the server would reject", () => {
    expect(assignmentSearchSchema.parse({ status: "todos" })).not.toHaveProperty("status");
  });
});

describe("toAssignmentListInput", () => {
  test("turns the simple filters into list-input filters", () => {
    const input = toAssignmentListInput(
      assignmentSearchSchema.parse({ courseId: "c1", status: "inactivo" }),
    );
    expect(input).toMatchObject({ page: 1, perPage: 20, joinOperator: "and" });
    expect(input.filters?.map((filter) => [filter.id, filter.value, filter.operator])).toEqual([
      ["courseId", "c1", "eq"],
      ["status", "inactivo", "eq"],
    ]);
  });
});

describe("cell formatting", () => {
  test("every status has its spec label", () => {
    expect(ASSIGNMENT_STATUS_LABELS).toEqual({
      activo: "Activo",
      inactivo: "Inactivo",
      temporal: "Temporal",
    });
  });

  test("the delete flow names the subject and course", () => {
    expect(deleteEntityName({ subjectName: "Matemáticas", courseName: "6-01" })).toBe(
      "la asignación de Matemáticas en 6-01",
    );
  });

  test("the empty state needs a settled stats total of zero", () => {
    expect(hasNoAssignments(undefined)).toBe(false);
    expect(hasNoAssignments({ total: 0 })).toBe(true);
    expect(hasNoAssignments({ total: 2 })).toBe(false);
  });
});
