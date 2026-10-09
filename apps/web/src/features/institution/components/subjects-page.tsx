import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Plus } from "lucide-react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import ListPageShell from "@/shared/components/layout/list-page-shell";

import { useCanManage } from "../hooks/use-can-manage";
import { useDeleteEntity } from "../hooks/use-delete-entity";
import type { SubjectRow } from "../types";
import ActiveInstitutionBanner from "./active-institution-banner";
import ActiveInstitutionGuard from "./active-institution-guard";
import ConfirmDelete from "./confirm-delete";
import SubjectsTable from "./subjects-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar las asignaturas.";

/** INS-13 `/asignaturas` (container): subjects of the active institution, read-only without `subject:create`. */
export default function SubjectsPage() {
  return (
    <ActiveInstitutionGuard pageName="sus asignaturas">
      <SubjectsContent />
    </ActiveInstitutionGuard>
  );
}

function SubjectsContent() {
  const canManage = useCanManage("subject");
  const subjectsQuery = useQuery(orpc.subject.list.queryOptions());
  const deleteSubject = useMutation(orpc.subject.delete.mutationOptions());
  const deletion = useDeleteEntity<SubjectRow>({
    remove: (subject) => deleteSubject.mutateAsync({ id: subject.id }),
    invalidate: orpc.subject.key(),
    successMessage: () => "Asignatura eliminada",
  });

  const subjects = subjectsQuery.data;
  const createLink = (label: string) => (
    <Link to="/asignaturas/nueva" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Asignaturas"
        description="Materias y códigos"
        actions={canManage ? createLink("Nueva Asignatura") : undefined}
        banner={<ActiveInstitutionBanner />}
        listTitle="Listado de Asignaturas"
      >
        {subjectsQuery.isPending ? (
          <Loader />
        ) : subjectsQuery.isError ? (
          <LoadError message={LOAD_ERROR_MESSAGE} onRetry={() => void subjectsQuery.refetch()} />
        ) : subjects?.length === 0 ? (
          <EmptyState
            icon={<BookOpen />}
            title="No hay asignaturas"
            description="Crea las asignaturas que se dictan en tu institución."
            action={canManage ? createLink("Crear Primera Asignatura") : undefined}
          />
        ) : (
          <SubjectsTable
            subjects={subjects ?? []}
            canManage={canManage}
            isPending={false}
            errorMessage={null}
            onRetry={() => void subjectsQuery.refetch()}
            onDelete={deletion.requestDelete}
          />
        )}
      </ListPageShell>
      <ConfirmDelete
        {...deletion.dialog}
        title={`¿Eliminar asignatura ${deletion.target?.name ?? ""}?`}
        description="Esta acción no se puede deshacer si está asignada a uno o más grados."
      />
    </>
  );
}
