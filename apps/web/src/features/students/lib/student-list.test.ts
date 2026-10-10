import {
  incompleteStudentListConfig,
  studentListConfig,
} from "@base-template/api/lib/student-list-config";
import { describe, expect, test } from "bun:test";

import type { StudentFilterOptions } from "../types";
import {
  ALL_STATUSES,
  campusFilterOptions,
  courseFilterOptions,
  documentLabel,
  incompleteSearchConfig,
  incompleteSearchSchema,
  reconcileCourseFilter,
  hasPendingProfiles,
  STUDENT_STATUS_FILTER_OPTIONS,
  studentSearchConfig,
  studentSearchDefaults,
  studentSearchSchema,
  toIncompleteListInput,
  toStudentListInput,
} from "./student-list";

const filtersOf = (input: { filters?: { id: string; value: unknown; operator: string }[] }) =>
  (input.filters ?? []).map((filter) => [filter.id, filter.value, filter.operator]);

describe("student search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...studentSearchConfig.columnIds]).toEqual([...studentListConfig.sortableColumns]);
    expect([...studentSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(studentListConfig.filterableColumns).sort(),
    );
  });

  test("defaults: name order, 20 per page, active students", () => {
    expect(studentSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "name", desc: false }],
      filters: [],
      joinOperator: "and",
      status: "activo",
    });
  });

  test("the status choices are the server statuses, then Todos", () => {
    expect(STUDENT_STATUS_FILTER_OPTIONS).toEqual([
      ...studentListConfig.filterableColumns.status.options.map((value) => ({
        value,
        label: { activo: "Activos", retirado: "Retirados", graduado: "Graduados" }[value],
      })),
      { value: ALL_STATUSES, label: "Todos" },
    ]);
  });
});

describe("studentSearchSchema", () => {
  test("keeps valid filters and an explicit status", () => {
    expect(
      studentSearchSchema.parse({
        name: "gómez",
        campusId: "campus-1",
        courseId: "course-1",
        status: "retirado",
      }),
    ).toMatchObject({
      name: "gómez",
      campusId: "campus-1",
      courseId: "course-1",
      status: "retirado",
    });
  });

  test("keeps Todos as an explicit token", () => {
    expect(studentSearchSchema.parse({ status: "todos" }).status).toBe("todos");
  });

  test("a missing or unknown status falls back to activo", () => {
    expect(studentSearchSchema.parse({}).status).toBe("activo");
    expect(studentSearchSchema.parse({ status: "expulsado" }).status).toBe("activo");
  });
});

describe("toStudentListInput", () => {
  test("sends status = activo by default (the server has no default)", () => {
    expect(filtersOf(toStudentListInput(studentSearchDefaults))).toEqual([
      ["status", "activo", "eq"],
    ]);
  });

  test("Todos sends no status filter", () => {
    const input = toStudentListInput(studentSearchSchema.parse({ status: "todos" }));
    expect(filtersOf(input)).toEqual([]);
  });

  test("turns the simple filters into list-input filters", () => {
    const input = toStudentListInput(
      studentSearchSchema.parse({
        name: "ana",
        campusId: "campus-1",
        courseId: "course-1",
        status: "graduado",
      }),
    );
    expect(input).toMatchObject({
      page: 1,
      perPage: 20,
      sort: [{ id: "name", desc: false }],
      joinOperator: "and",
    });
    expect(filtersOf(input)).toEqual([
      ["name", "ana", "iLike"],
      ["campusId", "campus-1", "eq"],
      ["courseId", "course-1", "eq"],
      ["status", "graduado", "eq"],
    ]);
  });
});

const OPTIONS: StudentFilterOptions = {
  campuses: [
    { id: "north", name: "Norte" },
    { id: "main", name: "Principal" },
  ],
  courses: [
    { id: "c6", name: "6-01", campusId: "main" },
    { id: "c7", name: "7-01", campusId: "main" },
    { id: "c3", name: "3-01", campusId: "north" },
  ],
};

describe("filter options", () => {
  test("campus choices come from student.filterOptions", () => {
    expect(campusFilterOptions(OPTIONS)).toEqual([
      { value: "north", label: "Norte" },
      { value: "main", label: "Principal" },
    ]);
    expect(campusFilterOptions(undefined)).toEqual([]);
  });

  test("course choices narrow to the chosen campus", () => {
    expect(courseFilterOptions(OPTIONS, undefined).map((option) => option.value)).toEqual([
      "c6",
      "c7",
      "c3",
    ]);
    expect(courseFilterOptions(OPTIONS, "north")).toEqual([{ value: "c3", label: "3-01" }]);
  });
});

describe("reconcileCourseFilter", () => {
  test("drops a course of another campus", () => {
    expect(reconcileCourseFilter({ page: 1, campusId: "north", courseId: "c6" }, OPTIONS)).toEqual({
      page: 1,
      campusId: "north",
    });
  });

  test("keeps a course of the chosen campus, or any course without a campus", () => {
    const sameCampus = { campusId: "main", courseId: "c6" };
    expect(reconcileCourseFilter(sameCampus, OPTIONS)).toBe(sameCampus);
    const noCampus = { courseId: "c3" };
    expect(reconcileCourseFilter(noCampus, OPTIONS)).toBe(noCampus);
  });

  test("keeps an unknown course while the options load", () => {
    const next = { campusId: "north", courseId: "c6" };
    expect(reconcileCourseFilter(next, undefined)).toBe(next);
  });
});

describe("documentLabel", () => {
  test("reads {tipo} {número}", () => {
    expect(documentLabel({ documentType: "TI", documentNumber: "1023456789" })).toBe(
      "TI 1023456789",
    );
  });
});

describe("incomplete profiles", () => {
  test("search ids are a subset of the server allowlists", () => {
    for (const id of incompleteSearchConfig.columnIds) {
      expect(incompleteStudentListConfig.sortableColumns).toContain(id);
    }
    expect([...incompleteSearchConfig.filterableColumnIds]).toEqual(
      Object.keys(incompleteStudentListConfig.filterableColumns) as "name"[],
    );
  });

  test("the name search reaches the list input", () => {
    const input = toIncompleteListInput(incompleteSearchSchema.parse({ name: "pérez" }));
    expect(input).toMatchObject({ page: 1, perPage: 10 });
    expect(filtersOf(input)).toEqual([["name", "pérez", "iLike"]]);
  });

  test("the card shows only while some login lacks a profile", () => {
    expect(hasPendingProfiles(2)).toBe(true);
    expect(hasPendingProfiles(0)).toBe(false);
    expect(hasPendingProfiles(undefined)).toBe(false);
  });
});
