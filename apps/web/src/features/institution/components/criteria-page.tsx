import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ListChecks, Plus } from "lucide-react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import ListPageShell from "@/shared/components/layout/list-page-shell";

import { useCanManage } from "../hooks/use-can-manage";
import { useDeleteEntity } from "../hooks/use-delete-entity";
import type { CriterionRow } from "../types";
import ActiveInstitutionBanner from "./active-institution-banner";
import ActiveInstitutionGuard from "./active-institution-guard";
import ConfirmDelete from "./confirm-delete";
import CriteriaTable from "./criteria-table";
import CriteriaWeightFooter from "./criteria-weight-footer";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar los criterios de evaluación.";

/** INS-17 `/criterios` (container): grading criteria; teachers and coordinators read, managers edit. */
export default function CriteriaPage() {
  return (
    <ActiveInstitutionGuard pageName="sus criterios de evaluación">
      <CriteriaContent />
    </ActiveInstitutionGuard>
  );
}

function CriteriaContent() {
  const canManage = useCanManage("criterion");
  const criteriaQuery = useQuery(orpc.criterion.list.queryOptions());
  const deleteCriterion = useMutation(orpc.criterion.delete.mutationOptions());
  const deletion = useDeleteEntity<CriterionRow>({
    remove: (criterion) => deleteCriterion.mutateAsync({ id: criterion.id }),
    invalidate: orpc.criterion.key(),
    successMessage: () => "Criterio eliminado",
  });

  const criteria = criteriaQuery.data?.rows;
  const createLink = (label: string) => (
    <Link to="/criterios/nuevo" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Criterios de Evaluación"
        description="Definen cómo se calculan las notas de cada periodo"
        actions={canManage ? createLink("Nuevo Criterio") : undefined}
        banner={<ActiveInstitutionBanner />}
        listTitle="Listado de Criterios"
      >
        {criteriaQuery.isPending ? (
          <Loader />
        ) : criteriaQuery.isError ? (
          <LoadError message={LOAD_ERROR_MESSAGE} onRetry={() => void criteriaQuery.refetch()} />
        ) : criteria?.length === 0 ? (
          <EmptyState
            icon={<ListChecks />}
            title="No hay criterios de evaluación"
            description="Define los criterios con los que se calcula la nota de cada periodo."
            action={canManage ? createLink("Crear Primer Criterio") : undefined}
          />
        ) : (
          <>
            <CriteriaTable
              criteria={criteria ?? []}
              canManage={canManage}
              isPending={false}
              errorMessage={null}
              onRetry={() => void criteriaQuery.refetch()}
              onDelete={deletion.requestDelete}
            />
            <CriteriaWeightFooter
              count={criteria?.length ?? 0}
              totalWeight={criteriaQuery.data?.totalWeight ?? 0}
            />
          </>
        )}
      </ListPageShell>
      <ConfirmDelete
        {...deletion.dialog}
        title={`¿Eliminar criterio ${deletion.target?.name ?? ""}?`}
        description="Esta acción no se puede deshacer y recalcula las notas finales abiertas."
      />
    </>
  );
}
