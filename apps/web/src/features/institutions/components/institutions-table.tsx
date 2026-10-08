import { Building2 } from "lucide-react";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { institutionSearchConfig, type InstitutionSearch } from "../lib/institution-list";
import type { InstitutionRow } from "../types";
import {
  getInstitutionColumns,
  HIDDEN_COLUMNS,
  type InstitutionRowActions,
} from "./institutions-columns";

/**
 * INS-01 listing in a URL-driven server table. Presentational: the caller owns the
 * `institutionAdmin.list` query state; the row actions only ask the caller to act.
 */
export default function InstitutionsTable({
  search,
  onSearchChange,
  list,
  ...actions
}: InstitutionRowActions & {
  search: InstitutionSearch;
  onSearchChange: DataTableSearchChange;
  list: {
    rows: InstitutionRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
}) {
  const { onView, onManage, isManaging, onDelete } = actions;
  const columns = useMemo(
    () => getInstitutionColumns({ onView, onManage, isManaging, onDelete }),
    [onView, onManage, isManaging, onDelete],
  );
  return (
    <SimpleListTable
      search={search}
      searchConfig={institutionSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      initialState={{ columnVisibility: HIDDEN_COLUMNS }}
      emptyTitle="Sin resultados"
      emptyIcon={<Building2 />}
      list={list}
    />
  );
}
