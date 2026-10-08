import { COURSE_SHIFTS, courseListConfig } from "@base-template/api/lib/course-list-config";
import { createListInput } from "@base-template/api/lib/list-input";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { CampusOption, CourseOption, CourseRow, LevelRow } from "../types";

/** Server list input, built from the same allowlists as `course.list` (R3.8). */
export const courseListInput = createListInput(courseListConfig);

/**
 * Simple mode: one URL key per filterable column. `columnIds` mirror the server's sortable ids
 * and `filterableColumnIds` its filter ids; a test pins both.
 */
export const courseSearchConfig = {
  columnIds: ["name", "campus", "director", "academicYear", "shift", "maxStudents", "studentCount"],
  filterableColumnIds: ["name", "campusId", "levelId", "shift", "academicYear"],
  defaultSort: [{ id: "name", desc: false }],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "name" | "campus" | "director" | "academicYear" | "shift" | "maxStudents" | "studentCount",
  "name" | "campusId" | "levelId" | "shift" | "academicYear"
>;

const COURSE_FILTER_VARIANTS = {
  name: "text",
  campusId: "select",
  levelId: "select",
  shift: "select",
  academicYear: "select",
} as const satisfies Record<string, FilterVariant>;

/** `validateSearch` of `/cursos`: always a search the server accepts. */
export const courseSearchSchema = createDataTableSearchSchema(courseSearchConfig).transform(
  (search) =>
    normalizeSimpleSearch(search, COURSE_FILTER_VARIANTS, (filter) =>
      isFilterAccepted(courseListInput, filter),
    ),
);

export const courseSearchDefaults = courseSearchSchema.parse({});

export type CourseSearch = ReturnType<typeof courseSearchSchema.parse>;

/** Route search to the `course.list` input. */
export function toCourseListInput(search: CourseSearch) {
  return toListInput(courseListInput, {
    ...search,
    filters: simpleSearchToFilters(search, COURSE_FILTER_VARIANTS),
  });
}

export const COURSE_SHIFT_FILTER_OPTIONS: Option[] = COURSE_SHIFTS.map((shift) => ({
  value: shift,
  label: shift,
}));

/** Distinct academic years of the institution's courses, newest first. */
export function courseYearFilterOptions(courses: readonly Pick<CourseOption, "academicYear">[]) {
  const years = [...new Set(courses.map((course) => course.academicYear))].sort().reverse();
  return years.map((year): Option => ({ value: year, label: year }));
}

export function courseCampusFilterOptions(campuses: readonly CampusOption[]): Option[] {
  return campuses.map((campus) => ({ value: campus.id, label: campus.name }));
}

/** "{nivel} ({sede})" so same-named levels of different campuses stay distinguishable. */
export function courseLevelFilterOptions(levels: readonly LevelRow[]): Option[] {
  return levels.map((level) => ({
    value: level.id,
    label: `${level.name} (${level.campusName})`,
  }));
}

/** "Director de Grupo" cell: the director's name or "Sin asignar". */
export function directorLabel(course: Pick<CourseRow, "directorName">): string {
  return course.directorName ?? "Sin asignar";
}

/** The INS-11 empty state shows only when the institution has no courses at all (not a filter). */
export function hasNoCourses(stats: { total: number } | undefined): boolean {
  return stats !== undefined && stats.total === 0;
}
