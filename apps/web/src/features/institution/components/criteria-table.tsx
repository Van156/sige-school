import { ListChecks } from "lucide-react";
import { useMemo } from "react";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { useLocalTableSearch } from "@/shared/hooks/use-local-table-search";
import { applyClientList } from "@/shared/lib/data-table/client-list";

import {
  criterionAccessors,
  criterionSearchConfig,
  criterionSearchSchema,
  toCriterionListState,
} from "../lib/criterion-list";
import type { CriterionRow } from "../types";
import { getCriterionColumns } from "./criterion-columns";

/**
 * INS-17 listing in a client-side data table (the whole bounded list is in memory). Presentational:
 * row actions are shown only when `canManage`; `onDelete` just asks the caller to confirm.
 */
export default function CriteriaTable({
  criteria,
  canManage,
  isPending,
  errorMessage,
  onRetry,
  onDelete,
}: {
  criteria: CriterionRow[];
  canManage: boolean;
  isPending: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onDelete: (criterion: CriterionRow) => void;
}) {
  const { search, onSearchChange } = useLocalTableSearch(criterionSearchSchema);
  const { rows, total } = applyClientList(
    criteria,
    toCriterionListState(search),
    criterionAccessors,
  );
  const columns = useMemo(
    () => getCriterionColumns({ canManage, onDelete }),
    [canManage, onDelete],
  );

  return (
    <SimpleListTable
      search={search}
      searchConfig={criterionSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      emptyTitle="Sin resultados"
      emptyIcon={<ListChecks />}
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
