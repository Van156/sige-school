import {
  ASSIGNMENT_STATUSES,
  assignmentListConfig,
} from "@base-template/api/lib/assignment-list-config";
import { createListInput } from "@base-template/api/lib/list-input";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { AssignmentRow, AssignmentStats, AssignmentStatus } from "../types";

/** Server list input, built from the same allowlists as `assignment.list` (R3.8). */
export const assignmentListInput = createListInput(assignmentListConfig);

/**
 * Simple mode: one URL key per filterable column. `columnIds` mirror the server's sortable ids
 * and `filterableColumnIds` its filter ids, minus `academicYear` (the list is not filtered by
 * year in the UI); a test pins both.
 */
export const assignmentSearchConfig = {
  columnIds: ["teacher", "subject", "course", "assignmentDate", "status"],
  filterableColumnIds: ["teacher", "courseId", "subjectId", "status"],
  defaultSort: [
    { id: "course", desc: false },
    { id: "subject", desc: false },
  ],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "teacher" | "subject" | "course" | "assignmentDate" | "status",
  "teacher" | "courseId" | "subjectId" | "status"
>;

const ASSIGNMENT_FILTER_VARIANTS = {
  teacher: "text",
  courseId: "select",
  subjectId: "select",
  status: "select",
} as const satisfies Record<string, FilterVariant>;

/** `validateSearch` of `/asignaciones`: always a search the server accepts. */
export const assignmentSearchSchema = createDataTableSearchSchema(assignmentSearchConfig).transform(
  (search) =>
    normalizeSimpleSearch(search, ASSIGNMENT_FILTER_VARIANTS, (filter) =>
      isFilterAccepted(assignmentListInput, filter),
    ),
);

export const assignmentSearchDefaults = assignmentSearchSchema.parse({});

export type AssignmentSearch = ReturnType<typeof assignmentSearchSchema.parse>;

/** Route search to the `assignment.list` input. */
export function toAssignmentListInput(search: AssignmentSearch) {
  return toListInput(assignmentListInput, {
    ...search,
    filters: simpleSearchToFilters(search, ASSIGNMENT_FILTER_VARIANTS),
  });
}

/** Badge text of each assignment status (sige/04 §5.1; 00 §4.3). */
export const ASSIGNMENT_STATUS_LABELS: Readonly<Record<AssignmentStatus, string>> = {
  activo: "Activo",
  inactivo: "Inactivo",
  temporal: "Temporal",
};

/** The status select's / filter's choices, in the server allowlist's order. */
export const ASSIGNMENT_STATUS_OPTIONS: Option[] = ASSIGNMENT_STATUSES.map((status) => ({
  value: status,
  label: ASSIGNMENT_STATUS_LABELS[status],
}));

/** Badge colour of each status: active is green, temporary is highlighted, inactive is muted. */
export const ASSIGNMENT_STATUS_VARIANTS = {
  activo: "success",
  temporal: "warning",
  inactivo: "secondary",
} as const satisfies Record<AssignmentStatus, string>;

/** Delete confirmation question (sige/04 §5.1). */
export const DELETE_QUESTION = "¿Eliminar esta asignación?";

/** Entity name the shared delete flow uses in "No se puede eliminar {entidad}". */
export function deleteEntityName(
  assignment: Pick<AssignmentRow, "subjectName" | "courseName">,
): string {
  return `la asignación de ${assignment.subjectName} en ${assignment.courseName}`;
}

/** The empty state shows only when the institution has no assignments at all (not a filter). */
export function hasNoAssignments(stats: Pick<AssignmentStats, "total"> | undefined): boolean {
  return stats !== undefined && stats.total === 0;
}
