import { Layers } from "lucide-react";
import { useMemo } from "react";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { useLocalTableSearch } from "@/shared/hooks/use-local-table-search";
import { applyClientList } from "@/shared/lib/data-table/client-list";

import {
  timeBlockAccessors,
  timeBlockCampusFilterOptions,
  timeBlockSearchConfig,
  timeBlockSearchSchema,
  toTimeBlockListState,
} from "../lib/time-block-list";
import type { TimeBlockRow } from "../types";
import { getTimeBlockColumns } from "./time-block-columns";

/**
 * SCH-09 listing in a client-side data table (the whole bounded list is in memory), filterable by
 * campus and jornada and kept in the server's campus, jornada and order. Presentational: edit
 * and delete are shown per `canEdit`/`canDelete`; `onDelete` just asks the caller to confirm.
 */
export default function TimeBlocksTable({
  blocks,
  canEdit,
  canDelete,
  isPending,
  errorMessage,
  onRetry,
  onDelete,
}: {
  blocks: TimeBlockRow[];
  canEdit: boolean;
  canDelete: boolean;
  isPending: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onDelete: (block: TimeBlockRow) => void;
}) {
  const { search, onSearchChange } = useLocalTableSearch(timeBlockSearchSchema);
  const { rows, total } = applyClientList(blocks, toTimeBlockListState(search), timeBlockAccessors);
  const columns = useMemo(
    () =>
      getTimeBlockColumns({
        canEdit,
        canDelete,
        campusOptions: timeBlockCampusFilterOptions(blocks),
        onDelete,
      }),
    [canEdit, canDelete, blocks, onDelete],
  );

  return (
    <SimpleListTable
      search={search}
      searchConfig={timeBlockSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      emptyTitle="Sin resultados"
      emptyIcon={<Layers />}
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
