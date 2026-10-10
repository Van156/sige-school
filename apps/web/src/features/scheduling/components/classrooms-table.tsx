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
 * `classroom.list` query state; edit and delete are shown per `canEdit`/`canDelete`, and
 * `onDelete` just asks the caller to confirm.
 */
export default function ClassroomsTable({
  search,
  onSearchChange,
  list,
  filterOptions,
  canEdit,
  canDelete,
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
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (room: ClassroomRow) => void;
}) {
  const columns = useMemo(
    () => getClassroomColumns({ canEdit, canDelete, filterOptions, onDelete }),
    [canEdit, canDelete, filterOptions, onDelete],
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
