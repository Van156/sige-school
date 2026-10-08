import { Layers } from "lucide-react";
import { useMemo } from "react";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { useLocalTableSearch } from "@/shared/hooks/use-local-table-search";
import { applyClientList } from "@/shared/lib/data-table/client-list";

import {
  levelAccessors,
  levelCampusFilterOptions,
  levelSearchConfig,
  levelSearchSchema,
  toLevelListState,
} from "../lib/level-list";
import type { LevelRow } from "../types";
import { getLevelColumns } from "./level-columns";

/**
 * INS-09 listing in a client-side data table (the whole bounded list is in memory). Presentational:
 * row actions are shown only when `canManage`; `onDelete` just asks the caller to confirm.
 */
export default function LevelsTable({
  levels,
  canManage,
  isPending,
  errorMessage,
  onRetry,
  onDelete,
}: {
  levels: LevelRow[];
  canManage: boolean;
  isPending: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onDelete: (level: LevelRow) => void;
}) {
  const { search, onSearchChange } = useLocalTableSearch(levelSearchSchema);
  const { rows, total } = applyClientList(levels, toLevelListState(search), levelAccessors);
  const columns = useMemo(
    () => getLevelColumns({ canManage, campusOptions: levelCampusFilterOptions(levels), onDelete }),
    [canManage, levels, onDelete],
  );

  return (
    <SimpleListTable
      search={search}
      searchConfig={levelSearchConfig}
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
