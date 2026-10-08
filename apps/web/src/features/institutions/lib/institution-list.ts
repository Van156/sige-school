import { institutionListConfig } from "@base-template/api/lib/institution-list-config";
import { createListInput } from "@base-template/api/lib/list-input";

import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant } from "@/shared/lib/data-table/types";

import { isFilterAccepted, toListInput } from "@/shared/lib/data-table/list-input";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { InstitutionStats } from "../types";

/** Server list input, built from the same allowlists as `institutionAdmin.list` (R3.8). */
export const institutionListInput = createListInput(institutionListConfig);

/**
 * Simple mode: one URL key per filterable column. `columnIds` mirror the server's sortable ids
 * and `filterableColumnIds` its filter ids; a test pins both.
 */
export const institutionSearchConfig = {
  columnIds: ["name", "nit", "municipality", "academicYear", "campuses", "students", "createdAt"],
  filterableColumnIds: ["name", "nit", "municipality"],
  defaultSort: [{ id: "createdAt", desc: true }],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "name" | "nit" | "municipality" | "academicYear" | "campuses" | "students" | "createdAt",
  "name" | "nit" | "municipality"
>;

const INSTITUTION_FILTER_VARIANTS = {
  name: "text",
  nit: "text",
  municipality: "text",
} as const satisfies Record<string, FilterVariant>;

/** `validateSearch` of `/admin/instituciones`: always a search the server accepts. */
export const institutionSearchSchema = createDataTableSearchSchema(
  institutionSearchConfig,
).transform((search) =>
  normalizeSimpleSearch(search, INSTITUTION_FILTER_VARIANTS, (filter) =>
    isFilterAccepted(institutionListInput, filter),
  ),
);

export const institutionSearchDefaults = institutionSearchSchema.parse({});

export type InstitutionSearch = ReturnType<typeof institutionSearchSchema.parse>;

/** Route search to the `institutionAdmin.list` input. */
export function toInstitutionListInput(search: InstitutionSearch) {
  return toListInput(institutionListInput, {
    ...search,
    filters: simpleSearchToFilters(search, INSTITUTION_FILTER_VARIANTS),
  });
}

/** The INS-01 empty state shows only when there are no institutions at all (not a filter). */
export function hasNoInstitutions(stats: Pick<InstitutionStats, "institutions"> | undefined) {
  return stats !== undefined && stats.institutions === 0;
}
