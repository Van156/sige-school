import { buttonVariants } from "@base-template/ui/components/button";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Plus, UserCheck } from "lucide-react";
import { useCallback, useMemo } from "react";

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

import { SCHEDULING_ACTIONS } from "../lib/action-permissions";
import {
  assignmentSearchConfig,
  DELETE_QUESTION,
  deleteEntityName,
  hasNoAssignments,
  toAssignmentListInput,
  type AssignmentSearch,
} from "../lib/assignment-list";
import { courseFilterOptions, subjectFilterOptions } from "../lib/offering-choices";
import type { AssignmentRow } from "../types";
import AssignmentsTable from "./assignments-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar las asignaciones.";

/** A row awaiting delete confirmation; `name` is what the shared delete flow reports. */
type DeleteTarget = AssignmentRow & { name: string };

/** SCH-03 `/asignaciones` (container): teacher assignments of the active institution. */
export default function AssignmentsPage({ search }: { search: AssignmentSearch }) {
  return (
    <ActiveInstitutionGuard pageName="sus asignaciones de profesores">
      <AssignmentsContent search={search} />
    </ActiveInstitutionGuard>
  );
}

function AssignmentsContent({ search }: { search: AssignmentSearch }) {
  const navigate = useNavigate({ from: "/asignaciones/" });
  const canViewOfferings = useCan(SCHEDULING_ACTIONS.assignments.viewOfferings).can;
  // Create, edit and delete share `offering:update` (sige/04 §3.2).
  const canEdit = useCan(SCHEDULING_ACTIONS.assignments.edit).can;

  const assignmentsQuery = useQuery({
    ...orpc.assignment.list.queryOptions({ input: toAssignmentListInput(search) }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery(orpc.assignment.stats.queryOptions());
  const profileQuery = useQuery(orpc.institution.get.queryOptions());
  const coursesQuery = useQuery(orpc.course.options.queryOptions());
  const subjectsQuery = useQuery(orpc.subject.list.queryOptions());

  const deleteAssignment = useMutation(orpc.assignment.delete.mutationOptions());
  const deletion = useDeleteEntity<DeleteTarget>({
    remove: (assignment) => deleteAssignment.mutateAsync({ id: assignment.id }),
    invalidate: orpc.assignment.key(),
    successMessage: () => "Asignación eliminada",
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(assignmentSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );
  const { requestDelete } = deletion;
  const onDelete = useCallback(
    (assignment: AssignmentRow) =>
      requestDelete({ ...assignment, name: deleteEntityName(assignment) }),
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
  const createLink = (label: string) => (
    <Link to="/asignaciones/nueva" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Asignación de Profesores"
        description="Asignar profesores a materias por grado"
        actions={
          <div className="flex flex-wrap gap-2">
            {canViewOfferings ? (
              <Link to="/materias-por-grado" className={buttonVariants({ variant: "outline" })}>
                Ver Materias por Grado
              </Link>
            ) : null}
            {canEdit ? createLink("Nueva Asignación") : null}
          </div>
        }
        banner={<ActiveInstitutionBanner />}
        stats={
          <StatGrid columns={3}>
            <StatTile label="Total Asignaciones" value={stats?.total ?? 0} icon={UserCheck} />
            <StatTile label="Asignaciones Activas" value={stats?.active ?? 0} icon={CheckCircle2} />
            <StatTile
              label="Año Académico"
              value={profileQuery.data?.currentAcademicYear ?? "-"}
              icon={CalendarDays}
            />
          </StatGrid>
        }
        listTitle="Listado de Asignaciones"
      >
        {hasNoAssignments(stats) ? (
          <EmptyState
            icon={<UserCheck />}
            title="No hay asignaciones registradas"
            description="Asigne profesores a las materias por grado"
            action={canEdit ? createLink("Crear Asignación") : undefined}
          />
        ) : (
          <AssignmentsTable
            search={search}
            onSearchChange={onSearchChange}
            filterOptions={filterOptions}
            canEdit={canEdit}
            onDelete={onDelete}
            list={{
              rows: assignmentsQuery.data?.rows,
              total: assignmentsQuery.data?.total,
              isPending: assignmentsQuery.isPending,
              isFetching: assignmentsQuery.isFetching,
              isPlaceholderData: assignmentsQuery.isPlaceholderData,
              errorMessage: assignmentsQuery.isError ? LOAD_ERROR_MESSAGE : null,
              onRetry: () => void assignmentsQuery.refetch(),
            }}
          />
        )}
      </ListPageShell>
      <ConfirmDelete
        {...deletion.dialog}
        title={DELETE_QUESTION}
        description="Esta acción no se puede deshacer."
      />
    </>
  );
}
