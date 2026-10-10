import { BookOpen } from "lucide-react";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { offeringSearchConfig, type OfferingSearch } from "../lib/offering-list";
import type { OfferingRow } from "../types";
import {
  getOfferingColumns,
  HIDDEN_FILTER_COLUMNS,
  type OfferingFilterOptions,
} from "./offering-columns";

/**
 * SCH-05 listing in a URL-driven server table. Presentational: the caller owns the
 * `offering.list` query state; the edit and delete actions are shown per `canEdit`/`canDelete`
 * and only ask the caller to act.
 */
export default function OfferingsTable({
  search,
  onSearchChange,
  list,
  filterOptions,
  canEdit,
  canDelete,
  onEditHours,
  onDelete,
}: {
  search: OfferingSearch;
  onSearchChange: DataTableSearchChange;
  list: {
    rows: OfferingRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
  filterOptions: OfferingFilterOptions;
  canEdit: boolean;
  canDelete: boolean;
  onEditHours: (offering: OfferingRow) => void;
  onDelete: (offering: OfferingRow) => void;
}) {
  const columns = useMemo(
    () => getOfferingColumns({ canEdit, canDelete, filterOptions, onEditHours, onDelete }),
    [canEdit, canDelete, filterOptions, onEditHours, onDelete],
  );
  return (
    <SimpleListTable
      search={search}
      searchConfig={offeringSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      initialState={{ columnVisibility: HIDDEN_FILTER_COLUMNS }}
      emptyTitle="Sin resultados"
      emptyIcon={<BookOpen />}
      list={list}
    />
  );
}
