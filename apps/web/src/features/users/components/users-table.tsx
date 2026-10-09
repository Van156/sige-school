import { Users } from "lucide-react";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { userSearchConfig, type UserSearch } from "../lib/user-list";
import type { UserRow, UserTableRow } from "../types";
import { getUserColumns, HIDDEN_COLUMNS, type UserRowActions } from "./users-columns";

/**
 * USR-01 listing in a URL-driven server table. Presentational: the caller owns the `user.list`
 * query state; row actions only ask the caller to confirm and act.
 */
export default function UsersTable({
  search,
  onSearchChange,
  list,
  permissions,
  onToggleActive,
  onDelete,
}: UserRowActions & {
  search: UserSearch;
  onSearchChange: DataTableSearchChange;
  list: {
    rows: UserRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
}) {
  const columns = useMemo(
    () => getUserColumns({ permissions, onToggleActive, onDelete }),
    [permissions, onToggleActive, onDelete],
  );
  const rows = useMemo<UserTableRow[] | undefined>(
    () => list.rows?.map((row) => ({ ...row, id: row.personId })),
    [list.rows],
  );
  return (
    <SimpleListTable
      search={search}
      searchConfig={userSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      initialState={{ columnVisibility: HIDDEN_COLUMNS }}
      emptyTitle="Ningún usuario coincide con los filtros."
      emptyIcon={<Users />}
      list={{ ...list, rows }}
    />
  );
}
