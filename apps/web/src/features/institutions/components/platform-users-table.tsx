import { Users } from "lucide-react";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import {
  USER_HIDDEN_COLUMNS,
  userSearchConfig,
  type UserRow,
  type UserSearch,
  type UserTableRow,
} from "@/features/users";
import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { getPlatformUserColumns, type PlatformUserRowActions } from "./platform-users-columns";

/**
 * INS-04 listing in a URL-driven server table. Presentational: the caller owns the
 * `platformUser.list` query state; row actions only ask the caller to act.
 */
export default function PlatformUsersTable({
  search,
  onSearchChange,
  list,
  onEdit,
  onChangePassword,
  onToggleActive,
  isEditing,
}: PlatformUserRowActions & {
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
    () => getPlatformUserColumns({ onEdit, onChangePassword, onToggleActive, isEditing }),
    [onEdit, onChangePassword, onToggleActive, isEditing],
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
      initialState={{ columnVisibility: USER_HIDDEN_COLUMNS }}
      emptyTitle="Ningún usuario coincide con los filtros."
      emptyIcon={<Users />}
      list={{ ...list, rows }}
    />
  );
}
