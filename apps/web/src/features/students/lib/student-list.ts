import { createListInput } from "@base-template/api/lib/list-input";
import {
  incompleteStudentListConfig,
  studentListConfig,
} from "@base-template/api/lib/student-list-config";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { StudentFilterOptions, StudentStatus } from "../types";
import { isStudentStatus } from "./student-status";

/** Server list input, built from the same allowlists as `student.list` (R3.8). */
export const studentListInput = createListInput(studentListConfig);

/**
 * Simple mode: one URL key per filterable column. `columnIds` mirror the server's sortable ids
 * and `filterableColumnIds` its filter ids; a test pins both against `studentListConfig`.
 */
export const studentSearchConfig = {
  columnIds: ["name", "document", "course", "campus", "status"],
  filterableColumnIds: ["name", "campusId", "courseId", "status"],
  defaultSort: [{ id: "name", desc: false }],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "name" | "document" | "course" | "campus" | "status",
  "name" | "campusId" | "courseId" | "status"
>;

/**
 * The "Filtrar por estado" token meaning every status. It never reaches the server: `student.list`
 * without a `status` filter lists every status (sige/05 §3.1).
 */
export const ALL_STATUSES = "todos";

/** The URL value of "Filtrar por estado": one status or `ALL_STATUSES`. */
export type StudentStatusToken = StudentStatus | typeof ALL_STATUSES;

/** STU-01 opens on active students (sige/05 §5.1, "Activos [default]"). */
export const DEFAULT_STATUS: StudentStatusToken = "activo";

/** Filters sent to the server as they are; `status` is mapped from its token first. */
const STUDENT_FILTER_VARIANTS = {
  name: "text",
  campusId: "select",
  courseId: "select",
} as const satisfies Record<string, FilterVariant>;

function toStatusToken(value: unknown): StudentStatusToken {
  return value === ALL_STATUSES || isStudentStatus(value) ? value : DEFAULT_STATUS;
}

/**
 * `validateSearch` of `/estudiantes`: always a search the server accepts. `status` is always set
 * (missing or unknown → `activo`), so the default is part of `studentSearchDefaults` and stays out
 * of the URL, while "Todos" is the explicit `?status=todos`.
 */
export const studentSearchSchema = createDataTableSearchSchema(studentSearchConfig).transform(
  (search) => ({
    ...normalizeSimpleSearch(search, STUDENT_FILTER_VARIANTS, (filter) =>
      isFilterAccepted(studentListInput, filter),
    ),
    status: toStatusToken(search.status),
  }),
);

export const studentSearchDefaults = studentSearchSchema.parse({});

export type StudentSearch = ReturnType<typeof studentSearchSchema.parse>;

/** Route search to the `student.list` input; "Todos" sends no `status` filter. */
export function toStudentListInput(search: StudentSearch) {
  const status = search.status === ALL_STATUSES ? undefined : search.status;
  return toListInput(studentListInput, {
    ...search,
    filters: simpleSearchToFilters(
      { ...search, status },
      { ...STUDENT_FILTER_VARIANTS, status: "select" },
    ),
  });
}

/** "Filtrar por estado" choices (sige/05 §5.1), in the prototype's order. */
export const STUDENT_STATUS_FILTER_OPTIONS: Option[] = [
  { value: "activo", label: "Activos" },
  { value: "retirado", label: "Retirados" },
  { value: "graduado", label: "Graduados" },
  { value: ALL_STATUSES, label: "Todos" },
];

/** "Filtrar por sede" choices: the campuses of the students in the caller's scope. */
export function campusFilterOptions(options: StudentFilterOptions | undefined): Option[] {
  return (options?.campuses ?? []).map((campus) => ({ value: campus.id, label: campus.name }));
}

/** "Filtrar por grado" choices: the courses in scope, of the chosen campus when there is one. */
export function courseFilterOptions(
  options: StudentFilterOptions | undefined,
  campusId: string | undefined,
): Option[] {
  return (options?.courses ?? [])
    .filter((course) => campusId === undefined || course.campusId === campusId)
    .map((course) => ({ value: course.id, label: course.name }));
}

/**
 * The table's next search with the course filter dropped when it no longer belongs to the chosen
 * campus (the prototype resets "Filtrar por grado" on a campus change). Unknown courses (options
 * still loading) are kept.
 */
export function reconcileCourseFilter(
  next: Record<string, unknown>,
  options: StudentFilterOptions | undefined,
): Record<string, unknown> {
  const { campusId, courseId, ...rest } = next;
  if (typeof campusId !== "string" || typeof courseId !== "string") {
    return next;
  }
  const course = options?.courses.find((item) => item.id === courseId);
  return course === undefined || course.campusId === campusId ? next : { ...rest, campusId };
}

/** Shown by STU-01 when `student.list` fails. */
export const STUDENTS_LOAD_ERROR = "No se pudieron cargar los estudiantes.";

/** The "{tipo} {número}" document badge (sige/05 §5.1). */
export function documentLabel(row: { documentType: string; documentNumber: string }): string {
  return `${row.documentType} ${row.documentNumber}`;
}

/** Server list input of "Perfiles Académicos Incompletos" (`student.listIncomplete`). */
export const incompleteStudentListInput = createListInput(incompleteStudentListConfig);

/**
 * The incomplete-profiles card pages and searches locally (no URL keys: STU-01's URL belongs to
 * the main list). Only `name` is sortable in the UI; `createdAt` has no column.
 */
export const incompleteSearchConfig = {
  columnIds: ["name"],
  filterableColumnIds: ["name"],
  defaultSort: [{ id: "name", desc: false }],
  defaultPerPage: 10,
} as const satisfies DataTableSearchConfig<"name", "name">;

const INCOMPLETE_FILTER_VARIANTS = { name: "text" } as const satisfies Record<
  string,
  FilterVariant
>;

export const incompleteSearchSchema = createDataTableSearchSchema(incompleteSearchConfig).transform(
  (search) =>
    normalizeSimpleSearch(search, INCOMPLETE_FILTER_VARIANTS, (filter) =>
      isFilterAccepted(incompleteStudentListInput, filter),
    ),
);

export type IncompleteSearch = ReturnType<typeof incompleteSearchSchema.parse>;

/** Local search to the `student.listIncomplete` input. */
export function toIncompleteListInput(search: IncompleteSearch) {
  return toListInput(incompleteStudentListInput, {
    ...search,
    filters: simpleSearchToFilters(search, INCOMPLETE_FILTER_VARIANTS),
  });
}

/**
 * The incomplete-profiles card shows only while some student login lacks a profile (sige/05
 * §5.1; the caller also needs `student:create`). `pendingTotal` is the unfiltered count, so a
 * name search with no match keeps the card (and its search box) on screen.
 */
export function hasPendingProfiles(pendingTotal: number | undefined): boolean {
  return pendingTotal !== undefined && pendingTotal > 0;
}
