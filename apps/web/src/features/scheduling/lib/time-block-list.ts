import { timeBlockShiftSchema } from "@base-template/api/sige/schemas/scheduling";

import type { ClientListAccessors, ClientListState } from "@/shared/lib/data-table/client-list";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  isBoundedStringFilter,
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { TimeBlockRow } from "../types";

/**
 * Client-side mode (data table spec §7, R3.9): `timeBlock.list` returns the whole bounded list
 * (at most 500 rows) in campus, shift and `order_num` order.
 */
export const timeBlockSearchConfig = {
  columnIds: ["orderNum", "name", "campus", "shift", "startTime", "endTime", "type"],
  filterableColumnIds: ["campus", "shift"],
  // The server order (campus, shift, order) is the reading order; keep it until the user sorts.
  defaultSort: [],
  defaultPerPage: 20,
} as const satisfies DataTableSearchConfig<
  "orderNum" | "name" | "campus" | "shift" | "startTime" | "endTime" | "type",
  "campus" | "shift"
>;

const TIME_BLOCK_FILTER_VARIANTS = {
  campus: "select",
  shift: "select",
} as const satisfies Record<string, FilterVariant>;

export const timeBlockSearchSchema = createDataTableSearchSchema(timeBlockSearchConfig).transform(
  (search) => normalizeSimpleSearch(search, TIME_BLOCK_FILTER_VARIANTS, isBoundedStringFilter),
);

export type TimeBlockSearch = ReturnType<typeof timeBlockSearchSchema.parse>;

export function toTimeBlockListState(search: TimeBlockSearch): ClientListState {
  return {
    page: search.page,
    perPage: search.perPage,
    sort: search.sort,
    filters: simpleSearchToFilters(search, TIME_BLOCK_FILTER_VARIANTS),
  };
}

export const timeBlockAccessors: ClientListAccessors<TimeBlockRow> = {
  sort: {
    orderNum: (row) => row.orderNum,
    name: (row) => row.name,
    campus: (row) => row.campusName,
    shift: (row) => row.shift,
    startTime: (row) => row.startTime,
    endTime: (row) => row.endTime,
    type: (row) => Number(row.isBreak),
  },
  filter: {
    campus: (row) => row.campusId,
    shift: (row) => row.shift,
  },
};

/** The "Sede" filter's choices: the distinct campuses the listed blocks belong to. */
export function timeBlockCampusFilterOptions(rows: readonly TimeBlockRow[]): Option[] {
  const byId = new Map<string, string>();
  for (const row of rows) {
    byId.set(row.campusId, row.campusName);
  }
  return [...byId].map(([value, label]) => ({ value, label }));
}

/** The jornada select's / filter's choices, in the enum's declaration order. */
export const SHIFT_OPTIONS: Option[] = timeBlockShiftSchema.options.map((shift) => ({
  value: shift,
  label: shift,
}));

/** "Tipo" cell: breaks read "Recreo", class blocks "Clase". */
export function blockTypeLabel(row: Pick<TimeBlockRow, "isBreak">): string {
  return row.isBreak ? "Recreo" : "Clase";
}

/** KPI tiles over the whole list: total, class blocks and breaks. */
export function timeBlockStats(rows: readonly Pick<TimeBlockRow, "isBreak">[]) {
  const breaks = rows.filter((row) => row.isBreak).length;
  return { total: rows.length, classes: rows.length - breaks, breaks };
}
