import { courseListConfig } from "@base-template/api/lib/course-list-config";
import { describe, expect, test } from "bun:test";

import {
  courseCampusFilterOptions,
  courseLevelFilterOptions,
  courseSearchConfig,
  courseSearchDefaults,
  courseSearchSchema,
  courseYearFilterOptions,
  directorLabel,
  hasNoCourses,
  toCourseListInput,
} from "./course-list";

describe("course search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...courseSearchConfig.columnIds]).toEqual([...courseListConfig.sortableColumns]);
    expect([...courseSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(courseListConfig.filterableColumns).sort(),
    );
  });

  test("defaults: by name, 20 per page, no filters", () => {
    expect(courseSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "name", desc: false }],
      filters: [],
      joinOperator: "and",
    });
  });
});

describe("courseSearchSchema", () => {
  test("keeps valid simple filters, sort and paging", () => {
    const search = courseSearchSchema.parse({
      name: "6",
      campusId: "c1",
      shift: "Tarde",
      sort: [{ id: "maxStudents", desc: true }],
      page: 2,
    });
    expect(search).toMatchObject({
      name: "6",
      campusId: "c1",
      shift: "Tarde",
      sort: [{ id: "maxStudents", desc: true }],
      page: 2,
    });
  });

  test("drops a shift the server would reject", () => {
    expect(courseSearchSchema.parse({ shift: "Madrugada" })).not.toHaveProperty("shift");
  });
});

describe("toCourseListInput", () => {
  test("turns the simple filters into list-input filters", () => {
    const input = toCourseListInput(courseSearchSchema.parse({ name: "6", campusId: "c1" }));
    expect(input).toMatchObject({ page: 1, perPage: 20, joinOperator: "and" });
    expect(input.filters?.map((filter) => [filter.id, filter.value, filter.operator])).toEqual([
      ["name", "6", "iLike"],
      ["campusId", "c1", "eq"],
    ]);
  });
});

describe("filter options and labels", () => {
  test("lists distinct years newest first", () => {
    expect(
      courseYearFilterOptions([
        { academicYear: "2025" },
        { academicYear: "2026" },
        { academicYear: "2025" },
      ]),
    ).toEqual([
      { value: "2026", label: "2026" },
      { value: "2025", label: "2025" },
    ]);
  });

  test("labels campuses and levels", () => {
    expect(courseCampusFilterOptions([{ id: "c1", name: "Principal", isMain: true }])).toEqual([
      { value: "c1", label: "Principal" },
    ]);
    expect(
      courseLevelFilterOptions([
        {
          id: "l1",
          campusId: "c1",
          campusName: "Principal",
          name: "Sexto",
          orderNum: 6,
          courseCount: 0,
        },
      ]),
    ).toEqual([{ value: "l1", label: "Sexto (Principal)" }]);
  });

  test("reads a missing director as Sin asignar", () => {
    expect(directorLabel({ directorName: null })).toBe("Sin asignar");
    expect(directorLabel({ directorName: "Ada Lovelace" })).toBe("Ada Lovelace");
  });

  test("the empty state needs a settled stats total of zero", () => {
    expect(hasNoCourses(undefined)).toBe(false);
    expect(hasNoCourses({ total: 0 })).toBe(true);
    expect(hasNoCourses({ total: 3 })).toBe(false);
  });
});
