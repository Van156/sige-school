import { offeringListConfig } from "@base-template/api/lib/offering-list-config";
import { describe, expect, test } from "bun:test";

import {
  deleteQuestion,
  formatHours,
  formatTeacher,
  hasNoOfferings,
  offeringSearchConfig,
  offeringSearchDefaults,
  offeringSearchSchema,
  TEACHER_FILTER_OPTIONS,
  toOfferingListInput,
} from "./offering-list";

describe("offering search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...offeringSearchConfig.columnIds]).toEqual([...offeringListConfig.sortableColumns]);
    // `academicYear` is a server filter the UI does not expose.
    expect([...offeringSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(offeringListConfig.filterableColumns)
        .filter((id) => id !== "academicYear")
        .sort(),
    );
  });

  test("the teacher choices are the server's assigned/unassigned switch", () => {
    expect(TEACHER_FILTER_OPTIONS).toEqual([
      { value: "assigned", label: "Con profesor" },
      { value: "unassigned", label: "Sin profesor" },
    ]);
  });

  test("defaults follow the server order: course, then subject, 20 per page", () => {
    expect(offeringSearchDefaults).toEqual({
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

describe("offeringSearchSchema", () => {
  test("keeps valid simple filters", () => {
    expect(
      offeringSearchSchema.parse({ courseId: "c1", subjectId: "s1", teacher: "unassigned" }),
    ).toMatchObject({ courseId: "c1", subjectId: "s1", teacher: "unassigned" });
  });

  test("drops a teacher state the server would reject", () => {
    expect(offeringSearchSchema.parse({ teacher: "todos" })).not.toHaveProperty("teacher");
  });
});

describe("toOfferingListInput", () => {
  test("turns the simple filters into list-input filters", () => {
    const input = toOfferingListInput(
      offeringSearchSchema.parse({ courseId: "c1", teacher: "assigned" }),
    );
    expect(input).toMatchObject({ page: 1, perPage: 20, joinOperator: "and" });
    expect(input.filters?.map((filter) => [filter.id, filter.value, filter.operator])).toEqual([
      ["courseId", "c1", "eq"],
      ["teacher", "assigned", "eq"],
    ]);
  });
});

describe("cell formatting", () => {
  test("hours read as a badge text", () => {
    expect(formatHours(4)).toBe("4h");
  });

  test("teacher cell: name, '(inactivo)' suffix, or 'Sin asignar'", () => {
    expect(formatTeacher({ teacherName: "Ana Ruiz", assignmentStatus: "activo" })).toBe("Ana Ruiz");
    expect(formatTeacher({ teacherName: "Ana Ruiz", assignmentStatus: "temporal" })).toBe(
      "Ana Ruiz",
    );
    expect(formatTeacher({ teacherName: "Ana Ruiz", assignmentStatus: "inactivo" })).toBe(
      "Ana Ruiz (inactivo)",
    );
    expect(formatTeacher({ teacherName: null, assignmentStatus: null })).toBe("Sin asignar");
  });

  test("delete question names subject and course", () => {
    expect(deleteQuestion({ subjectName: "Matemáticas", courseName: "6-01" })).toBe(
      "¿Eliminar Matemáticas de 6-01?",
    );
  });

  test("the empty state needs a settled stats total of zero", () => {
    expect(hasNoOfferings(undefined)).toBe(false);
    expect(hasNoOfferings({ assigned: 0 })).toBe(true);
    expect(hasNoOfferings({ assigned: 2 })).toBe(false);
  });
});
