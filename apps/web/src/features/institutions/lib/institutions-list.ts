import type { ClientListAccessors, ClientListState } from "@/shared/lib/data-table/client-list";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant } from "@/shared/lib/data-table/types";

import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  isBoundedStringFilter,
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { InstitutionRow } from "../types";

/**
 * Client-side mode (data table spec §7): `institutionAdmin.list` returns the whole (bounded) list
 * with no paging or filter input, so the table sorts, filters and pages it locally. The search
 * lives in component state, not in the URL.
 */
export const institutionsSearchConfig = {
  columnIds: ["name", "slug", "rector", "createdAt"],
  filterableColumnIds: ["name", "slug"],
  defaultSort: [{ id: "createdAt", desc: true }],
  defaultPerPage: 10,
} as const satisfies DataTableSearchConfig<
  "name" | "slug" | "rector" | "createdAt",
  "name" | "slug"
>;

const INSTITUTIONS_FILTER_VARIANTS = {
  name: "text",
  slug: "text",
} as const satisfies Record<string, FilterVariant>;

export const institutionsSearchSchema = createDataTableSearchSchema(
  institutionsSearchConfig,
).transform((search) =>
  normalizeSimpleSearch(search, INSTITUTIONS_FILTER_VARIANTS, isBoundedStringFilter),
);

export type InstitutionsSearch = ReturnType<typeof institutionsSearchSchema.parse>;

export function toInstitutionsListState(search: InstitutionsSearch): ClientListState {
  return {
    page: search.page,
    perPage: search.perPage,
    sort: search.sort,
    filters: simpleSearchToFilters(search, INSTITUTIONS_FILTER_VARIANTS),
  };
}

export const institutionsAccessors: ClientListAccessors<InstitutionRow> = {
  sort: {
    name: (row) => row.name,
    slug: (row) => row.slug,
    rector: (row) => row.rector?.name ?? "",
    createdAt: (row) => new Date(row.createdAt).getTime(),
  },
  filter: {
    name: (row) => row.name,
    slug: (row) => row.slug,
  },
};
