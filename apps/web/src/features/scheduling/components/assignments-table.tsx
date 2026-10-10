import { UserCheck } from "lucide-react";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { assignmentSearchConfig, type AssignmentSearch } from "../lib/assignment-list";
import type { AssignmentRow } from "../types";
import {
  getAssignmentColumns,
  HIDDEN_FILTER_COLUMNS,
  type AssignmentFilterOptions,
} from "./assignment-columns";

/**
 * SCH-03 listing in a URL-driven server table. Presentational: the caller owns the
 * `assignment.list` query state; the edit and delete actions are shown per `canEdit` and only ask
 * the caller to act.
 */
export default function AssignmentsTable({
  search,
  onSearchChange,
  list,
  filterOptions,
  canEdit,
  onDelete,
}: {
  search: AssignmentSearch;
  onSearchChange: DataTableSearchChange;
  list: {
    rows: AssignmentRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
  filterOptions: AssignmentFilterOptions;
  canEdit: boolean;
  onDelete: (assignment: AssignmentRow) => void;
}) {
  const columns = useMemo(
    () => getAssignmentColumns({ canEdit, filterOptions, onDelete }),
    [canEdit, filterOptions, onDelete],
  );
  return (
    <SimpleListTable
      search={search}
      searchConfig={assignmentSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      initialState={{ columnVisibility: HIDDEN_FILTER_COLUMNS }}
      emptyTitle="Sin resultados"
      emptyIcon={<UserCheck />}
      list={list}
    />
  );
}
