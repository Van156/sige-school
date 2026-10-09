import { CalendarDays } from "lucide-react";
import { useMemo } from "react";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { useLocalTableSearch } from "@/shared/hooks/use-local-table-search";
import { applyClientList } from "@/shared/lib/data-table/client-list";

import {
  periodAccessors,
  periodSearchConfig,
  periodSearchSchema,
  toPeriodListState,
} from "../lib/period-list";
import type { PeriodRow } from "../types";
import { getPeriodColumns } from "./period-columns";

/**
 * INS-15 listing in a client-side data table (the whole bounded list is in memory). Presentational:
 * row actions are shown only when `canManage`; `onActivate` and `onDelete` just ask the caller.
 */
export default function PeriodsTable({
  periods,
  canManage,
  isPending,
  errorMessage,
  onRetry,
  onActivate,
  onDelete,
}: {
  periods: PeriodRow[];
  canManage: boolean;
  isPending: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onActivate: (period: PeriodRow) => void;
  onDelete: (period: PeriodRow) => void;
}) {
  const { search, onSearchChange } = useLocalTableSearch(periodSearchSchema);
  const { rows, total } = applyClientList(periods, toPeriodListState(search), periodAccessors);
  const columns = useMemo(
    () => getPeriodColumns({ canManage, onActivate, onDelete }),
    [canManage, onActivate, onDelete],
  );

  return (
    <SimpleListTable
      search={search}
      searchConfig={periodSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      emptyTitle="Sin resultados"
      emptyIcon={<CalendarDays />}
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
