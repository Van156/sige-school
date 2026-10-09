import type { ClientListAccessors, ClientListState } from "@/shared/lib/data-table/client-list";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant } from "@/shared/lib/data-table/types";

import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  isBoundedStringFilter,
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { CriterionRow } from "../types";

/** The total the weights must reach for the final grade to be well defined (INS-R7). */
export const EXPECTED_TOTAL_WEIGHT = 100;

const DESCRIPTION_LIMIT = 50;

/** Client-side mode (data table spec §7, R3.9): `criterion.list` returns the whole bounded list. */
export const criterionSearchConfig = {
  columnIds: ["name", "weight", "description", "orderNum"],
  filterableColumnIds: ["name", "description"],
  // `criterion.list` already orders by order and name; keep that until the user sorts.
  defaultSort: [],
  defaultPerPage: 10,
} as const satisfies DataTableSearchConfig<
  "name" | "weight" | "description" | "orderNum",
  "name" | "description"
>;

const CRITERION_FILTER_VARIANTS = {
  name: "text",
  description: "text",
} as const satisfies Record<string, FilterVariant>;

export const criterionSearchSchema = createDataTableSearchSchema(criterionSearchConfig).transform(
  (search) => normalizeSimpleSearch(search, CRITERION_FILTER_VARIANTS, isBoundedStringFilter),
);

export type CriterionSearch = ReturnType<typeof criterionSearchSchema.parse>;

export function toCriterionListState(search: CriterionSearch): ClientListState {
  return {
    page: search.page,
    perPage: search.perPage,
    sort: search.sort,
    filters: simpleSearchToFilters(search, CRITERION_FILTER_VARIANTS),
  };
}

export const criterionAccessors: ClientListAccessors<CriterionRow> = {
  sort: {
    name: (row) => row.name,
    weight: (row) => row.weight,
    description: (row) => row.description ?? "",
    orderNum: (row) => row.orderNum,
  },
  filter: {
    name: (row) => row.name,
    description: (row) => row.description ?? "",
  },
};

/** "{n}%" cell of "Peso (%)"; `Number` drops trailing zeros ("20.50" → "20.5"). */
export function formatWeight(weight: number): string {
  return `${Number(weight.toFixed(2))}%`;
}

/** Description cell: truncated to 50 characters plus "..." (INS-17), "-" when absent. */
export function truncateDescription(description: string | null): string {
  if (!description) {
    return "-";
  }
  return description.length > DESCRIPTION_LIMIT
    ? `${description.slice(0, DESCRIPTION_LIMIT)}...`
    : description;
}

/** Whether the footer shows the Σ ≠ 100 warning (INS-R7). An empty list has no total to warn about. */
export function weightsNeedWarning(count: number, totalWeight: number): boolean {
  return count > 0 && totalWeight !== EXPECTED_TOTAL_WEIGHT;
}
