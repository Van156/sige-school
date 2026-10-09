import type { ClientListAccessors, ClientListState } from "@/shared/lib/data-table/client-list";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant } from "@/shared/lib/data-table/types";

import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  isBoundedStringFilter,
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { SubjectRow } from "../types";

/** Client-side mode (data table spec §7, R3.9): `subject.list` returns the whole bounded list. */
export const subjectSearchConfig = {
  columnIds: ["code", "name"],
  filterableColumnIds: ["name", "code"],
  // `subject.list` already orders by name.
  defaultSort: [],
  defaultPerPage: 10,
} as const satisfies DataTableSearchConfig<"code" | "name", "name" | "code">;

const SUBJECT_FILTER_VARIANTS = {
  name: "text",
  code: "text",
} as const satisfies Record<string, FilterVariant>;

export const subjectSearchSchema = createDataTableSearchSchema(subjectSearchConfig).transform(
  (search) => normalizeSimpleSearch(search, SUBJECT_FILTER_VARIANTS, isBoundedStringFilter),
);

export type SubjectSearch = ReturnType<typeof subjectSearchSchema.parse>;

export function toSubjectListState(search: SubjectSearch): ClientListState {
  return {
    page: search.page,
    perPage: search.perPage,
    sort: search.sort,
    filters: simpleSearchToFilters(search, SUBJECT_FILTER_VARIANTS),
  };
}

export const subjectAccessors: ClientListAccessors<SubjectRow> = {
  sort: {
    code: (row) => row.code ?? "",
    name: (row) => row.name,
  },
  filter: {
    name: (row) => row.name,
    code: (row) => row.code ?? "",
  },
};
