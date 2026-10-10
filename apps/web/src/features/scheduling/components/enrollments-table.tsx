import { ClipboardList } from "lucide-react";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { enrollmentSearchConfig, type EnrollmentSearch } from "../lib/enrollment-list";
import type { EnrollmentRow } from "../types";
import {
  getEnrollmentColumns,
  HIDDEN_FILTER_COLUMNS,
  type EnrollmentFilterOptions,
  type EnrollmentRowActions,
} from "./enrollment-columns";

/**
 * SCH-01 listing in a URL-driven server table. Presentational: the caller owns the
 * `enrollment.list` query state; the row actions are shown per `actions` and only ask the caller
 * to act.
 */
export default function EnrollmentsTable({
  search,
  onSearchChange,
  list,
  filterOptions,
  actions,
  onDelete,
}: {
  search: EnrollmentSearch;
  onSearchChange: DataTableSearchChange;
  list: {
    rows: EnrollmentRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
  filterOptions: EnrollmentFilterOptions;
  actions: EnrollmentRowActions;
  onDelete: (enrollment: EnrollmentRow) => void;
}) {
  const columns = useMemo(
    () => getEnrollmentColumns({ actions, filterOptions, onDelete }),
    [actions, filterOptions, onDelete],
  );
  return (
    <SimpleListTable
      search={search}
      searchConfig={enrollmentSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      initialState={{ columnVisibility: HIDDEN_FILTER_COLUMNS }}
      emptyTitle="Sin resultados"
      emptyIcon={<ClipboardList />}
      list={list}
    />
  );
}
