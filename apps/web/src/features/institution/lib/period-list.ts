import type { ClientListAccessors, ClientListState } from "@/shared/lib/data-table/client-list";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";
import type { FilterVariant } from "@/shared/lib/data-table/types";

import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";
import {
  isBoundedStringFilter,
  normalizeSimpleSearch,
  simpleSearchToFilters,
} from "@/shared/lib/data-table/simple-filters";

import type { PeriodRow, PeriodYearSummary } from "../types";

/** Periods an academic year is expected to have (INS-R5, `PERIOD_ORDER_MAX` in sige-core). */
const PERIODS_PER_YEAR = 4;

/** Client-side mode (data table spec §7, R3.9): `period.list` returns the whole bounded list. */
export const periodSearchConfig = {
  columnIds: ["orderNum", "name", "shortName", "startDate", "endDate", "isActive"],
  filterableColumnIds: ["name"],
  // `period.list` already orders by year and order; keep that until the user sorts.
  defaultSort: [],
  defaultPerPage: 10,
} as const satisfies DataTableSearchConfig<
  "orderNum" | "name" | "shortName" | "startDate" | "endDate" | "isActive",
  "name"
>;

const PERIOD_FILTER_VARIANTS = { name: "text" } as const satisfies Record<string, FilterVariant>;

export const periodSearchSchema = createDataTableSearchSchema(periodSearchConfig).transform(
  (search) => normalizeSimpleSearch(search, PERIOD_FILTER_VARIANTS, isBoundedStringFilter),
);

export type PeriodSearch = ReturnType<typeof periodSearchSchema.parse>;

export function toPeriodListState(search: PeriodSearch): ClientListState {
  return {
    page: search.page,
    perPage: search.perPage,
    sort: search.sort,
    filters: simpleSearchToFilters(search, PERIOD_FILTER_VARIANTS),
  };
}

export const periodAccessors: ClientListAccessors<PeriodRow> = {
  sort: {
    orderNum: (row) => row.orderNum,
    name: (row) => row.name,
    shortName: (row) => row.shortName,
    startDate: (row) => row.startDate,
    endDate: (row) => row.endDate,
    isActive: (row) => Number(row.isActive),
  },
  filter: { name: (row) => row.name },
};

/** `YYYY-MM-DD` as `dd/mm/yyyy` (INS-15). Pure string work: no timezone can shift the day. */
export function formatIsoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/**
 * The academic year the list shows: the user's pick, else the institution's current year, else the
 * newest year that has periods.
 */
export function resolveYear(
  picked: string | null,
  currentYear: string | undefined,
  years: readonly string[],
): string | null {
  return picked ?? currentYear ?? years[0] ?? null;
}

/** The year select's choices: every year with periods plus the current year, newest first. */
export function yearChoices(
  summary: readonly PeriodYearSummary[],
  currentYear: string | undefined,
): string[] {
  const years = new Set(summary.map((row) => row.academicYear));
  if (currentYear) {
    years.add(currentYear);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

/** INS-R5 warning for `year`: the API's text, or "0 de 4" for a year without periods. */
export function periodCountWarning(
  summary: readonly PeriodYearSummary[],
  year: string,
): string | null {
  const row = summary.find((entry) => entry.academicYear === year);
  return row ? row.warning : `Este año tiene 0 de ${PERIODS_PER_YEAR} periodos.`;
}
