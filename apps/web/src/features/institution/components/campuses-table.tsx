import { Building2 } from "lucide-react";
import { useMemo } from "react";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { useLocalTableSearch } from "@/shared/hooks/use-local-table-search";
import { applyClientList } from "@/shared/lib/data-table/client-list";

import {
  campusAccessors,
  campusSearchConfig,
  campusSearchSchema,
  toCampusListState,
} from "../lib/campus-list";
import type { CampusRow } from "../types";
import { getCampusColumns } from "./campus-columns";

/**
 * INS-07 listing in a client-side data table (the whole bounded list is in memory). Presentational:
 * row actions are shown only when `canManage`; `onDelete` just asks the caller to confirm.
 */
export default function CampusesTable({
  campuses,
  canManage,
  isPending,
  errorMessage,
  onRetry,
  onDelete,
}: {
  campuses: CampusRow[];
  canManage: boolean;
  isPending: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onDelete: (campus: CampusRow) => void;
}) {
  const { search, onSearchChange } = useLocalTableSearch(campusSearchSchema);
  const { rows, total } = applyClientList(campuses, toCampusListState(search), campusAccessors);
  const columns = useMemo(() => getCampusColumns({ canManage, onDelete }), [canManage, onDelete]);

  return (
    <SimpleListTable
      search={search}
      searchConfig={campusSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      emptyTitle="Sin resultados"
      emptyIcon={<Building2 />}
      list={{
        rows,
        total,
        isPending,
        isFetching: false,
        isPlaceholderData: false,
        errorMessage,
        onRetry,
      }}
    />
  );
}
