import { buttonVariants } from "@base-template/ui/components/button";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, GraduationCap, MapPin, Plus, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import { ConfirmDelete, useDeleteEntity } from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { StatGrid, StatTile } from "@/shared/components/layout/stat-tile";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import {
  hasNoInstitutions,
  institutionSearchConfig,
  toInstitutionListInput,
  type InstitutionSearch,
} from "../lib/institution-list";
import type { InstitutionRow } from "../types";
import InstitutionDetailDialog from "./institution-detail-dialog";
import InstitutionsTable from "./institutions-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar las instituciones.";

/**
 * INS-01 `/admin/instituciones` (container, root only): KPI tiles, the URL-driven institutions
 * table (`institutionAdmin.list`), the detail dialog and the delete flow. The admin layout owns
 * the superadmin guard; every procedure re-checks.
 */
export default function InstitutionsPage({ search }: { search: InstitutionSearch }) {
  const navigate = useNavigate({ from: "/admin/instituciones/" });
  const [viewedId, setViewedId] = useState<string | null>(null);

  const listQuery = useQuery({
    ...orpc.institutionAdmin.list.queryOptions({ input: toInstitutionListInput(search) }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery(orpc.institutionAdmin.stats.queryOptions());

  const deleteInstitution = useMutation(orpc.institutionAdmin.delete.mutationOptions());
  const deletion = useDeleteEntity<InstitutionRow>({
    remove: (institution) => deleteInstitution.mutateAsync({ id: institution.id }),
    invalidate: orpc.institutionAdmin.key(),
    successMessage: () => "Institución eliminada",
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(institutionSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );
  const closeDetail = useCallback(() => setViewedId(null), []);
  const viewDetail = useCallback((institution: InstitutionRow) => setViewedId(institution.id), []);

  const stats = statsQuery.data;
  const createLink = (label: string) => (
    <Link to="/admin/instituciones/nueva" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Gestión de Instituciones"
        description="Administra todas las instituciones educativas del sistema"
        actions={createLink("Nueva Institución")}
        stats={
          <StatGrid>
            <StatTile
              label="Total Instituciones"
              value={stats?.institutions ?? 0}
              icon={Building2}
            />
            <StatTile label="Total Sedes" value={stats?.campuses ?? 0} icon={MapPin} />
            <StatTile label="Total Estudiantes" value={stats?.students ?? 0} icon={GraduationCap} />
            <StatTile label="Total Admins" value={stats?.admins ?? 0} icon={ShieldCheck} />
          </StatGrid>
        }
        listTitle="Listado de Instituciones"
      >
        {hasNoInstitutions(stats) ? (
          <EmptyState
            icon={<Building2 />}
            title="No hay instituciones creadas"
            description="Comienza creando la primera institución educativa del sistema."
            action={
              <Link to="/admin/instituciones/nueva" className={buttonVariants()}>
                Crear Primera Institución
              </Link>
            }
          />
        ) : (
          <InstitutionsTable
            search={search}
            onSearchChange={onSearchChange}
            onView={viewDetail}
            onDelete={deletion.requestDelete}
            list={{
              rows: listQuery.data?.rows,
              total: listQuery.data?.total,
              isPending: listQuery.isPending,
              isFetching: listQuery.isFetching,
              isPlaceholderData: listQuery.isPlaceholderData,
              errorMessage: listQuery.isError ? LOAD_ERROR_MESSAGE : null,
              onRetry: () => void listQuery.refetch(),
            }}
          />
        )}
      </ListPageShell>
      <InstitutionDetailDialog institutionId={viewedId} onClose={closeDetail} />
      <ConfirmDelete
        {...deletion.dialog}
        title={`¿Estás seguro de eliminar la institución ${deletion.target?.name ?? ""}?`}
        description="Esta acción no se puede deshacer."
      />
    </>
  );
}
