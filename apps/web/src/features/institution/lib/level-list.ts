import type { ClientListAccessors, ClientListState } from "@/shared/lib/data-table/client-list";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  isBoundedStringFilter,
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { LevelRow } from "../types";

/** Client-side mode (data table spec §7, R3.9): `level.list` returns the whole bounded list. */
export const levelSearchConfig = {
  columnIds: ["orderNum", "name", "campus", "courseCount"],
  filterableColumnIds: ["name", "campus"],
  // `level.list` already orders by campus, order and name; keep that until the user sorts.
  defaultSort: [],
  defaultPerPage: 10,
} as const satisfies DataTableSearchConfig<
  "orderNum" | "name" | "campus" | "courseCount",
  "name" | "campus"
>;

const LEVEL_FILTER_VARIANTS = {
  name: "text",
  campus: "select",
} as const satisfies Record<string, FilterVariant>;

export const levelSearchSchema = createDataTableSearchSchema(levelSearchConfig).transform(
  (search) => normalizeSimpleSearch(search, LEVEL_FILTER_VARIANTS, isBoundedStringFilter),
);

export type LevelSearch = ReturnType<typeof levelSearchSchema.parse>;

export function toLevelListState(search: LevelSearch): ClientListState {
  return {
    page: search.page,
    perPage: search.perPage,
    sort: search.sort,
    filters: simpleSearchToFilters(search, LEVEL_FILTER_VARIANTS),
  };
}

export const levelAccessors: ClientListAccessors<LevelRow> = {
  sort: {
    orderNum: (row) => row.orderNum,
    name: (row) => row.name,
    campus: (row) => row.campusName,
    courseCount: (row) => row.courseCount,
  },
  filter: {
    name: (row) => row.name,
    campus: (row) => row.campusId,
  },
};

/** The "Sede" filter's choices: the distinct campuses the listed levels belong to. */
export function levelCampusFilterOptions(rows: readonly LevelRow[]): Option[] {
  const byId = new Map<string, string>();
  for (const row of rows) {
    byId.set(row.campusId, row.campusName);
  }
  return [...byId].map(([value, label]) => ({ value, label }));
}

/** "{n} curso(s)" cell of "Cursos Asociados". */
export function formatCourseCount(count: number): string {
  return `${count} curso(s)`;
}
