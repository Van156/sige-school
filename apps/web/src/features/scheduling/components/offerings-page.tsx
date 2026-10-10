import { buttonVariants } from "@base-template/ui/components/button";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Clock, Plus, UserX } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import { useCan } from "@/features/access-control";
import {
  ActiveInstitutionBanner,
  ActiveInstitutionGuard,
  ConfirmDelete,
  useDeleteEntity,
} from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { StatGrid, StatTile } from "@/shared/components/layout/stat-tile";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { courseFilterOptions, subjectFilterOptions } from "../lib/offering-choices";
import {
  deleteQuestion,
  hasNoOfferings,
  offeringSearchConfig,
  toOfferingListInput,
  type OfferingSearch,
} from "../lib/offering-list";
import type { OfferingRow } from "../types";
import OfferingHoursDialog from "./offering-hours-dialog";
import OfferingsTable from "./offerings-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar las materias por grado.";

/** A row awaiting delete confirmation; `name` is what the shared delete flow reports. */
type DeleteTarget = OfferingRow & { name: string };

/** SCH-05 `/materias-por-grado` (container): offerings of the active institution. */
export default function OfferingsPage({ search }: { search: OfferingSearch }) {
  return (
    <ActiveInstitutionGuard pageName="sus materias por grado">
      <OfferingsContent search={search} />
    </ActiveInstitutionGuard>
  );
}

function OfferingsContent({ search }: { search: OfferingSearch }) {
  const navigate = useNavigate({ from: "/materias-por-grado/" });
  const queryClient = useQueryClient();
  const canCreate = useCan("offering:create").can;
  const canEdit = useCan("offering:update").can;
  const canDelete = useCan("offering:delete").can;
  const [editing, setEditing] = useState<OfferingRow | null>(null);

  const offeringsQuery = useQuery({
    ...orpc.offering.list.queryOptions({ input: toOfferingListInput(search) }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery(orpc.offering.stats.queryOptions());
  const coursesQuery = useQuery(orpc.course.options.queryOptions());
  const subjectsQuery = useQuery(orpc.subject.list.queryOptions());

  const updateOffering = useMutation(orpc.offering.update.mutationOptions());
  const deleteOffering = useMutation(orpc.offering.delete.mutationOptions());
  const deletion = useDeleteEntity<DeleteTarget>({
    remove: (offering) => deleteOffering.mutateAsync({ id: offering.id }),
    invalidate: orpc.offering.key(),
    successMessage: () => "Materia eliminada del grado",
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(offeringSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );
  const { requestDelete } = deletion;
  const onDelete = useCallback(
    (offering: OfferingRow) =>
      requestDelete({ ...offering, name: `${offering.subjectName} de ${offering.courseName}` }),
    [requestDelete],
  );

  const filterOptions = useMemo(
    () => ({
      courses: courseFilterOptions(coursesQuery.data ?? []),
      subjects: subjectFilterOptions(subjectsQuery.data ?? []),
    }),
    [coursesQuery.data, subjectsQuery.data],
  );

  const stats = statsQuery.data;
  const assignLink = (label: string) => (
    <Link to="/materias-por-grado/asignar" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Materias por Grado"
        description="Asignar materias a grados"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/asignaciones" className={buttonVariants({ variant: "outline" })}>
              Ver Asignaciones
            </Link>
            {canCreate ? assignLink("Asignar Materias") : null}
          </div>
        }
        banner={<ActiveInstitutionBanner />}
        stats={
          <StatGrid columns={3}>
            <StatTile label="Materias Asignadas" value={stats?.assigned ?? 0} icon={BookOpen} />
            <StatTile label="Horas Semanales" value={stats?.weeklyHours ?? 0} icon={Clock} />
            <StatTile label="Sin Profesor" value={stats?.withoutTeacher ?? 0} icon={UserX} />
          </StatGrid>
        }
        listTitle="Listado de Materias por Grado"
      >
        {hasNoOfferings(stats) ? (
          <EmptyState
            icon={<BookOpen />}
            title="No hay materias asignadas a grados"
            description="Asigne materias a los grados del año académico"
            action={canCreate ? assignLink("Asignar Materias") : undefined}
          />
        ) : (
          <OfferingsTable
            search={search}
            onSearchChange={onSearchChange}
            filterOptions={filterOptions}
            canEdit={canEdit}
            canDelete={canDelete}
            onEditHours={setEditing}
            onDelete={onDelete}
            list={{
              rows: offeringsQuery.data?.rows,
              total: offeringsQuery.data?.total,
              isPending: offeringsQuery.isPending,
              isFetching: offeringsQuery.isFetching,
              isPlaceholderData: offeringsQuery.isPlaceholderData,
              errorMessage: offeringsQuery.isError ? LOAD_ERROR_MESSAGE : null,
              onRetry: () => void offeringsQuery.refetch(),
            }}
          />
        )}
      </ListPageShell>
      <OfferingHoursDialog
        offering={editing}
        onClose={() => setEditing(null)}
        onSubmit={async (offering, hoursPerWeek) => {
          await updateOffering.mutateAsync({ id: offering.id, hoursPerWeek });
          toast.success("Intensidad actualizada");
          await queryClient.invalidateQueries({ queryKey: orpc.offering.key() });
        }}
      />
      <ConfirmDelete
        {...deletion.dialog}
        title={deletion.target ? deleteQuestion(deletion.target) : "¿Eliminar esta materia?"}
        description="Esta acción no se puede deshacer."
      />
    </>
  );
}
