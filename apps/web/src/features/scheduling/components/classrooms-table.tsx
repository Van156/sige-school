import { DoorOpen } from "lucide-react";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { classroomSearchConfig, type ClassroomSearch } from "../lib/classroom-list";
import type { ClassroomRow } from "../types";
import {
  getClassroomColumns,
  HIDDEN_FILTER_COLUMNS,
  type ClassroomFilterOptions,
} from "./classroom-columns";

/**
 * SCH-07 listing in a URL-driven server table. Presentational: the caller owns the
 * `classroom.list` query state; row actions are shown only when `canManage`, and `onDelete` just
 * asks the caller to confirm.
 */
export default function ClassroomsTable({
  search,
  onSearchChange,
  list,
  filterOptions,
  canManage,
  onDelete,
}: {
  search: ClassroomSearch;
  onSearchChange: DataTableSearchChange;
  list: {
    rows: ClassroomRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
  filterOptions: ClassroomFilterOptions;
  canManage: boolean;
  onDelete: (room: ClassroomRow) => void;
}) {
  const columns = useMemo(
    () => getClassroomColumns({ canManage, filterOptions, onDelete }),
    [canManage, filterOptions, onDelete],
  );
  return (
    <SimpleListTable
      search={search}
      searchConfig={classroomSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      initialState={{ columnVisibility: HIDDEN_FILTER_COLUMNS }}
      emptyTitle="Sin resultados"
      emptyIcon={<DoorOpen />}
      list={list}
    />
  );
}
