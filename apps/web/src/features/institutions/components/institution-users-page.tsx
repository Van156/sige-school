import { Badge } from "@base-template/ui/components/badge";
import { buttonVariants } from "@base-template/ui/components/button";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ClipboardList,
  GraduationCap,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import { InstitutionBanner } from "@/features/institution";
import {
  hasActiveFilters,
  ResetPasswordDialog,
  useActivationConfirm,
  userSearchConfig,
  type UserRow,
  type UserSearch,
} from "@/features/users";
import EmptyState from "@/shared/components/feedback/empty-state";
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { StatGrid, StatTile } from "@/shared/components/layout/stat-tile";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { useManagement } from "../hooks/use-manage-institution";
import { useResetPlatformUserPassword } from "../hooks/use-reset-platform-user-password";
import {
  hasNoPlatformUsers,
  platformStatTiles,
  PLATFORM_USERS_LOAD_ERROR,
  type PlatformStatId,
  toPlatformUserListInput,
} from "../lib/platform-user-list";
import type { InstitutionDetail } from "../types";
import InstitutionLoader from "./institution-loader";
import PlatformUsersTable from "./platform-users-table";

const STAT_ICONS: Record<PlatformStatId, LucideIcon> = {
  admins: ShieldCheck,
  coordinators: ClipboardList,
  teachers: UserRound,
  students: GraduationCap,
};

/**
 * INS-04 `/admin/instituciones/$institutionId/usuarios` (container, root only): the users of one
 * institution through `platformUser.*`. The admin layout owns the superadmin guard; every
 * procedure re-checks.
 */
export default function InstitutionUsersPage({
  institutionId,
  search,
}: {
  institutionId: string;
  search: UserSearch;
}) {
  return (
    <InstitutionLoader institutionId={institutionId}>
      {(institution) => <InstitutionUsers institution={institution} search={search} />}
    </InstitutionLoader>
  );
}

function InstitutionUsers({
  institution,
  search,
}: {
  institution: InstitutionDetail;
  search: UserSearch;
}) {
  const institutionId = institution.id;
  const navigate = useNavigate({ from: "/admin/instituciones/$institutionId/usuarios/" });
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);

  const listQuery = useQuery({
    ...orpc.platformUser.list.queryOptions({
      input: toPlatformUserListInput(institutionId, search),
    }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery(orpc.platformUser.stats.queryOptions({ input: { institutionId } }));

  const setActive = useMutation(orpc.platformUser.setActive.mutationOptions());
  const activation = useActivationConfirm({
    setActive: (user, active) =>
      setActive.mutateAsync({ institutionId, personId: user.personId, active }),
    invalidate: orpc.platformUser.key(),
  });
  const resetPassword = useResetPlatformUserPassword(institutionId);
  const management = useManagement();
  const { start } = management;
  const editUser = useCallback(
    (user: UserRow) =>
      start({
        institutionId,
        destination: { to: "/usuarios/$personId/editar", params: { personId: user.personId } },
      }),
    [start, institutionId],
  );

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) => mergeTableSearch(userSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  const total = listQuery.data?.total;
  const tiles = platformStatTiles(statsQuery.data, statsQuery.isError);
  const createLink = (label: string) => (
    <Link
      to="/admin/instituciones/$institutionId/usuarios/nuevo"
      params={{ institutionId }}
      className={buttonVariants()}
    >
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title={`Usuarios de ${institution.name}`}
        description="Gestión de usuarios asignados a esta institución"
        actions={
          <>
            <Link to="/admin/instituciones" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft data-icon="inline-start" />
              Volver
            </Link>
            {createLink("Nuevo Admin")}
          </>
        }
        banner={
          <InstitutionBanner
            name={institution.name}
            logo={institution.logo}
            municipality={institution.municipality}
            department={institution.department}
            nit={institution.nit}
            badge="Root Admin"
          />
        }
        stats={
          <StatGrid>
            {tiles.map(({ id, ...tile }) => (
              <StatTile key={id} {...tile} icon={STAT_ICONS[id]} />
            ))}
          </StatGrid>
        }
        listTitle="Lista de Usuarios"
        listAction={
          total === undefined ? undefined : <Badge variant="secondary">{total} usuarios</Badge>
        }
      >
        {hasNoPlatformUsers(total, hasActiveFilters(search)) ? (
          <EmptyState
            icon={<Users />}
            title="No hay usuarios en esta institución"
            description="Comienza creando un administrador para esta institución"
            action={createLink("Crear Primer Admin")}
          />
        ) : (
          <PlatformUsersTable
            search={search}
            onSearchChange={onSearchChange}
            onEdit={editUser}
            isEditing={management.isPending}
            onChangePassword={setPasswordTarget}
            onToggleActive={activation.request}
            list={{
              rows: listQuery.data?.rows,
              total,
              isPending: listQuery.isPending,
              isFetching: listQuery.isFetching,
              isPlaceholderData: listQuery.isPlaceholderData,
              errorMessage: listQuery.isError ? PLATFORM_USERS_LOAD_ERROR : null,
              onRetry: () => void listQuery.refetch(),
            }}
          />
        )}
      </ListPageShell>
      <ResetPasswordDialog
        open={passwordTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
          }
        }}
        mode="custom"
        userLabel={passwordTarget?.username ?? ""}
        onSubmit={(request) =>
          passwordTarget ? resetPassword(passwordTarget.personId, request) : Promise.resolve()
        }
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
