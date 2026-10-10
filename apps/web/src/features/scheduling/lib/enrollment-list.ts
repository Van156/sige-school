import { enrollmentListConfig } from "@base-template/api/lib/enrollment-list-config";
import { createListInput } from "@base-template/api/lib/list-input";
import { ENROLLMENT_STATUSES } from "@base-template/sige-core";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { EnrollmentRow, EnrollmentStats, EnrollmentStatus } from "../types";

/** Server list input, built from the same allowlists as `enrollment.list` (R3.8). */
export const enrollmentListInput = createListInput(enrollmentListConfig);

/**
 * Simple mode: one URL key per filterable column. `columnIds` mirror the server's sortable ids
 * and `filterableColumnIds` its filter ids, minus `academicYear` (SCH-01 has no year filter); a
 * test pins both.
 */
export const enrollmentSearchConfig = {
  columnIds: ["student", "subject", "course", "enrollmentDate", "status", "finalScore"],
  filterableColumnIds: ["student", "courseId", "subjectId", "status"],
  defaultSort: [
    { id: "student", desc: false },
    { id: "subject", desc: false },
    { id: "course", desc: false },
  ],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "student" | "subject" | "course" | "enrollmentDate" | "status" | "finalScore",
  "student" | "courseId" | "subjectId" | "status"
>;

const ENROLLMENT_FILTER_VARIANTS = {
  student: "text",
  courseId: "select",
  subjectId: "select",
  status: "select",
} as const satisfies Record<string, FilterVariant>;

/** `validateSearch` of `/matriculas`: always a search the server accepts. */
export const enrollmentSearchSchema = createDataTableSearchSchema(enrollmentSearchConfig).transform(
  (search) =>
    normalizeSimpleSearch(search, ENROLLMENT_FILTER_VARIANTS, (filter) =>
      isFilterAccepted(enrollmentListInput, filter),
    ),
);

export const enrollmentSearchDefaults = enrollmentSearchSchema.parse({});

export type EnrollmentSearch = ReturnType<typeof enrollmentSearchSchema.parse>;

/** Route search to the `enrollment.list` input. */
export function toEnrollmentListInput(search: EnrollmentSearch) {
  return toListInput(enrollmentListInput, {
    ...search,
    filters: simpleSearchToFilters(search, ENROLLMENT_FILTER_VARIANTS),
  });
}

/** Badge text of each enrollment status (sige/04 §5.1). */
export const ENROLLMENT_STATUS_LABELS: Readonly<Record<EnrollmentStatus, string>> = {
  activa: "Activa",
  cancelada: "Cancelada",
  retirada: "Retirada",
};

/** The status filter's / select's choices, in the domain order (Activa, Cancelada, Retirada). */
export const ENROLLMENT_STATUS_OPTIONS: Option[] = ENROLLMENT_STATUSES.map((status) => ({
  value: status,
  label: ENROLLMENT_STATUS_LABELS[status],
}));

/**
 * Badge colour of each status: active is green (sige/04 §5.1); the spec leaves the others open, so
 * they follow the prototype (cancelled muted, withdrawn red).
 */
export const ENROLLMENT_STATUS_VARIANTS = {
  activa: "success",
  cancelada: "secondary",
  retirada: "destructive",
} as const satisfies Record<EnrollmentStatus, string>;

/** "Nota Final" cell: one decimal, or "-" while unset (sige/04 §5.1). */
export function formatFinalScore(score: number | null): string {
  return score === null ? "-" : score.toFixed(1);
}

/** Muted badge next to the course of a stale enrollment (SCH-R7). */
export const STALE_BADGE_LABEL = "Grado anterior";

/** Delete confirmation question (sige/04 §5.1). */
export const DELETE_QUESTION = "¿Eliminar esta matrícula?";

/** Entity name the shared delete flow uses in "No se puede eliminar {entidad}". */
export function deleteEntityName(
  enrollment: Pick<EnrollmentRow, "studentName" | "subjectName">,
): string {
  return `la matrícula de ${enrollment.studentName} en ${enrollment.subjectName}`;
}

/** The empty state shows only when the institution has no enrollments at all (not a filter). */
export function hasNoEnrollments(stats: Pick<EnrollmentStats, "total"> | undefined): boolean {
  return stats !== undefined && stats.total === 0;
}
