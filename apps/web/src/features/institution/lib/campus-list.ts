import type { ClientListAccessors, ClientListState } from "@/shared/lib/data-table/client-list";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant, Option } from "@/shared/lib/data-table/types";

import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  isBoundedStringFilter,
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { CampusRow } from "../types";
import { JORNADA_OPTIONS } from "./campus-form";

/**
 * Client-side mode (data table spec §7, R3.9): `campus.list` returns the whole bounded list, so
 * the table sorts, filters and pages it locally; the search lives in component state.
 */
export const campusSearchConfig = {
  columnIds: ["code", "name", "jornada", "type", "status", "courseCount"],
  filterableColumnIds: ["name", "jornada", "status"],
  // `campus.list` already puts the main campus first; keep that order until the user sorts.
  defaultSort: [],
  defaultPerPage: 10,
} as const satisfies DataTableSearchConfig<
  "code" | "name" | "jornada" | "type" | "status" | "courseCount",
  "name" | "jornada" | "status"
>;

const CAMPUS_FILTER_VARIANTS = {
  name: "text",
  jornada: "select",
  status: "select",
} as const satisfies Record<string, FilterVariant>;

export const campusSearchSchema = createDataTableSearchSchema(campusSearchConfig).transform(
  (search) => normalizeSimpleSearch(search, CAMPUS_FILTER_VARIANTS, isBoundedStringFilter),
);

export type CampusSearch = ReturnType<typeof campusSearchSchema.parse>;

export function toCampusListState(search: CampusSearch): ClientListState {
  return {
    page: search.page,
    perPage: search.perPage,
    sort: search.sort,
    filters: simpleSearchToFilters(search, CAMPUS_FILTER_VARIANTS),
  };
}

export const campusAccessors: ClientListAccessors<CampusRow> = {
  sort: {
    code: (row) => row.code ?? "",
    name: (row) => row.name,
    jornada: (row) => row.jornada,
    type: (row) => Number(row.isMain),
    status: (row) => Number(row.active),
    courseCount: (row) => row.courseCount,
  },
  filter: {
    name: (row) => row.name,
    jornada: (row) => row.jornada,
    status: (row) => (row.active ? "active" : "inactive"),
  },
};

export const CAMPUS_JORNADA_FILTER_OPTIONS: Option[] = JORNADA_OPTIONS;

export const CAMPUS_STATUS_FILTER_OPTIONS: Option[] = [
  { value: "active", label: "Activa" },
  { value: "inactive", label: "Inactiva" },
];

export type CampusSummary = {
  total: number;
  active: number;
  inactive: number;
  /** Name of the main campus, `null` when none is flagged. */
  mainName: string | null;
};

/** The four KPI tiles of INS-07. */
export function summarizeCampuses(rows: readonly CampusRow[]): CampusSummary {
  const active = rows.filter((row) => row.active).length;
  return {
    total: rows.length,
    active,
    inactive: rows.length - active,
    mainName: rows.find((row) => row.isMain)?.name ?? null,
  };
}
