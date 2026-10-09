import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, CircleCheck, CircleOff, Plus, Star } from "lucide-react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { StatGrid, StatTile } from "@/shared/components/layout/stat-tile";

import { useCanManage } from "../hooks/use-can-manage";
import { useDeleteEntity } from "../hooks/use-delete-entity";
import { summarizeCampuses } from "../lib/campus-list";
import type { CampusRow } from "../types";
import ActiveInstitutionBanner from "./active-institution-banner";
import ActiveInstitutionGuard from "./active-institution-guard";
import CampusesTable from "./campuses-table";
import ConfirmDelete from "./confirm-delete";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar las sedes.";

/** INS-07 `/sedes` (container): campuses of the active institution, read-only without `campus:create`. */
export default function CampusesPage() {
  return (
    <ActiveInstitutionGuard pageName="sus sedes">
      <CampusesContent />
    </ActiveInstitutionGuard>
  );
}

function CampusesContent() {
  const canManage = useCanManage("campus");
  const campusesQuery = useQuery(orpc.campus.list.queryOptions());
  const deleteCampus = useMutation(orpc.campus.delete.mutationOptions());
  const deletion = useDeleteEntity<CampusRow>({
    remove: (campus) => deleteCampus.mutateAsync({ id: campus.id }),
    invalidate: orpc.campus.key(),
    successMessage: () => "Sede eliminada",
  });

  const campuses = campusesQuery.data;
  const summary = summarizeCampuses(campuses ?? []);
  const createLink = (label: string) => (
    <Link to="/sedes/nueva" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Gestión de Sedes"
        description="Administra las sedes de tu institución educativa"
        actions={canManage ? createLink("Nueva Sede") : undefined}
        banner={<ActiveInstitutionBanner />}
        stats={
          <StatGrid>
            <StatTile label="Total Sedes" value={summary.total} icon={Building2} />
            <StatTile label="Sedes Activas" value={summary.active} icon={CircleCheck} />
            <StatTile label="Sede Principal" value={summary.mainName ?? "-"} icon={Star} />
            <StatTile label="Sedes Inactivas" value={summary.inactive} icon={CircleOff} />
          </StatGrid>
        }
        listTitle="Listado de Sedes"
      >
        {campusesQuery.isPending ? (
          <Loader />
        ) : campusesQuery.isError ? (
          <LoadError message={LOAD_ERROR_MESSAGE} onRetry={() => void campusesQuery.refetch()} />
        ) : campuses?.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title="No hay sedes registradas"
            description="Crea la primera sede para esta institución."
            action={canManage ? createLink("Crear Primera Sede") : undefined}
          />
        ) : (
          <CampusesTable
            campuses={campuses ?? []}
            canManage={canManage}
            isPending={false}
            errorMessage={null}
            onRetry={() => void campusesQuery.refetch()}
            onDelete={deletion.requestDelete}
          />
        )}
      </ListPageShell>
      <ConfirmDelete
        {...deletion.dialog}
        title={`¿Eliminar sede ${deletion.target?.name ?? ""}?`}
        description="Esta acción no se puede deshacer si tiene grados asociados."
      />
    </>
  );
}
