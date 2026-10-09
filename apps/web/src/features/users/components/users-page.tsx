import { Badge } from "@base-template/ui/components/badge";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Activity, GraduationCap, UserRound, Users } from "lucide-react";
import { useCallback, useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import { useCan } from "@/features/access-control";
import {
  ActiveInstitutionBanner,
  ActiveInstitutionGuard,
  useDeleteEntity,
} from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { StatGrid, StatTile } from "@/shared/components/layout/stat-tile";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { useUserActivation } from "../hooks/use-user-activation";
import {
  hasActiveFilters,
  hasNoUsers,
  statTileDisplay,
  toUserListInput,
  userListDescription,
  userListTitle,
  USERS_LOAD_ERROR,
  userSearchConfig,
  type UserSearch,
} from "../lib/user-list";
import type { UserRow } from "../types";
import UsersTable from "./users-table";

/**
 * The row a delete confirmation is about. `useDeleteEntity` names the row through `name`, which
 * for users is the username (the toast and dialog name the user by it).
 */
type DeleteTarget = { id: string; name: string };

/**
 * USR-01 `/usuarios`: the institution's users. Create, edit and import entry points belong to
 * USR-02…04 and are added with those routes.
 */
export default function UsersPage({ search }: { search: UserSearch }) {
  return (
    <ActiveInstitutionGuard pageName="sus usuarios">
      <UsersContent search={search} />
    </ActiveInstitutionGuard>
  );
}

function UsersContent({ search }: { search: UserSearch }) {
  const navigate = useNavigate({ from: "/usuarios/" });
  const canUpdate = useCan("user:update").can;
  const canDelete = useCan("user:delete").can;
  const permissions = useMemo(() => ({ canUpdate, canDelete }), [canUpdate, canDelete]);

  const listQuery = useQuery({
    ...orpc.user.list.queryOptions({ input: toUserListInput(search) }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery(orpc.user.stats.queryOptions());
  const institutionQuery = useQuery(orpc.institution.get.queryOptions());

  const deleteUser = useMutation(orpc.user.delete.mutationOptions());
  const deletion = useDeleteEntity<DeleteTarget>({
    remove: (target) => deleteUser.mutateAsync({ personId: target.id }),
    invalidate: orpc.user.key(),
    successMessage: () => "Usuario eliminado",
  });
  const { requestDelete } = deletion;
  const requestDeleteRow = useCallback(
    (row: UserRow) => requestDelete({ id: row.personId, name: row.username }),
    [requestDelete],
  );
  const activation = useUserActivation();

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) => mergeTableSearch(userSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  const stats = statsQuery.data;
  const total = listQuery.data?.total;
  const tile = (count: number | undefined) => statTileDisplay(count, statsQuery.isError);

  return (
    <>
      <ListPageShell
        title={userListTitle(search.role)}
        description={userListDescription(search.role, institutionQuery.data?.name)}
        banner={<ActiveInstitutionBanner />}
        stats={
          <StatGrid>
            <StatTile label="Total Usuarios" {...tile(stats?.total)} icon={Users} />
            <StatTile label="Profesores" {...tile(stats?.teachers)} icon={UserRound} />
            <StatTile label="Estudiantes" {...tile(stats?.students)} icon={GraduationCap} />
            <StatTile label="Activos" {...tile(stats?.active)} icon={Activity} />
          </StatGrid>
        }
        listTitle="Lista de Usuarios"
        listAction={
          total === undefined ? undefined : <Badge variant="secondary">{total} usuarios</Badge>
        }
      >
        {hasNoUsers(stats) && !hasActiveFilters(search) ? (
          <EmptyState
            icon={<Users />}
            title="No hay usuarios registrados"
            description="No hay usuarios en tu institución. Crea el primer usuario."
          />
        ) : (
          <UsersTable
            search={search}
            onSearchChange={onSearchChange}
            permissions={permissions}
            onToggleActive={activation.request}
            onDelete={requestDeleteRow}
            list={{
              rows: listQuery.data?.rows,
              total,
              isPending: listQuery.isPending,
              isFetching: listQuery.isFetching,
              isPlaceholderData: listQuery.isPlaceholderData,
              errorMessage: listQuery.isError ? USERS_LOAD_ERROR : null,
              onRetry: () => void listQuery.refetch(),
            }}
          />
        )}
      </ListPageShell>
      <ConfirmDialog
        {...deletion.dialog}
        title="Confirmar eliminación"
        description={`¿Estás seguro que deseas eliminar al usuario ${deletion.target?.name ?? ""}? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, Eliminar"
        cancelLabel="Cancelar"
      />
      <ConfirmDialog
        {...activation.dialog}
        title={activation.copy?.title ?? ""}
        description={activation.copy?.description}
        confirmLabel={activation.copy?.confirmLabel}
        cancelLabel="Cancelar"
        destructive={activation.copy?.active === false}
      />
    </>
  );
}
