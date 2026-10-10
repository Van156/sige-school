import { createListInput } from "@base-template/api/lib/list-input";
import {
  OFFERING_TEACHER_FILTERS,
  offeringListConfig,
} from "@base-template/api/lib/offering-list-config";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { OfferingRow, OfferingStats } from "../types";

/** Server list input, built from the same allowlists as `offering.list` (R3.8). */
export const offeringListInput = createListInput(offeringListConfig);

/**
 * Simple mode: one URL key per filterable column. `columnIds` mirror the server's sortable ids
 * and `filterableColumnIds` its filter ids, minus `academicYear` (the list is not filtered by
 * year in the UI); a test pins both.
 */
export const offeringSearchConfig = {
  columnIds: ["subject", "course", "hoursPerWeek", "teacher"],
  filterableColumnIds: ["courseId", "subjectId", "teacher"],
  defaultSort: [
    { id: "course", desc: false },
    { id: "subject", desc: false },
  ],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "subject" | "course" | "hoursPerWeek" | "teacher",
  "courseId" | "subjectId" | "teacher"
>;

const OFFERING_FILTER_VARIANTS = {
  courseId: "select",
  subjectId: "select",
  teacher: "select",
} as const satisfies Record<string, FilterVariant>;

/** `validateSearch` of `/materias-por-grado`: always a search the server accepts. */
export const offeringSearchSchema = createDataTableSearchSchema(offeringSearchConfig).transform(
  (search) =>
    normalizeSimpleSearch(search, OFFERING_FILTER_VARIANTS, (filter) =>
      isFilterAccepted(offeringListInput, filter),
    ),
);

export const offeringSearchDefaults = offeringSearchSchema.parse({});

export type OfferingSearch = ReturnType<typeof offeringSearchSchema.parse>;

/** Route search to the `offering.list` input. */
export function toOfferingListInput(search: OfferingSearch) {
  return toListInput(offeringListInput, {
    ...search,
    filters: simpleSearchToFilters(search, OFFERING_FILTER_VARIANTS),
  });
}

const TEACHER_FILTER_LABELS: Readonly<Record<(typeof OFFERING_TEACHER_FILTERS)[number], string>> = {
  assigned: "Con profesor",
  unassigned: "Sin profesor",
};

/** The teacher filter's choices, in the server allowlist's order (sige/04 §5.1). */
export const TEACHER_FILTER_OPTIONS: Option[] = OFFERING_TEACHER_FILTERS.map((value) => ({
  value,
  label: TEACHER_FILTER_LABELS[value],
}));

/** "{n}h" badge of "Intensidad". */
export function formatHours(hours: number): string {
  return `${hours}h`;
}

/** "Profesor Asignado" cell text: the name, "(inactivo)" when the assignment is inactive. */
export function formatTeacher(
  offering: Pick<OfferingRow, "teacherName" | "assignmentStatus">,
): string {
  if (offering.teacherName === null) {
    return "Sin asignar";
  }
  return offering.assignmentStatus === "inactivo"
    ? `${offering.teacherName} (inactivo)`
    : offering.teacherName;
}

/** Delete confirmation question: "¿Eliminar {materia} de {grado}?" (sige/04 §5.1). */
export function deleteQuestion(offering: Pick<OfferingRow, "subjectName" | "courseName">): string {
  return `¿Eliminar ${offering.subjectName} de ${offering.courseName}?`;
}

/** The empty state shows only when the institution has no offerings at all (not a filter). */
export function hasNoOfferings(stats: Pick<OfferingStats, "assigned"> | undefined): boolean {
  return stats !== undefined && stats.assigned === 0;
}
