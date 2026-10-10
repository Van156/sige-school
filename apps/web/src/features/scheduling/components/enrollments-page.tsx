import { buttonVariants } from "@base-template/ui/components/button";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, ClipboardList, GraduationCap } from "lucide-react";
import { useCallback, useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import { CanGate, useCan } from "@/features/access-control";
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

import {
  DELETE_QUESTION,
  deleteEntityName,
  enrollmentSearchConfig,
  hasNoEnrollments,
  toEnrollmentListInput,
  type EnrollmentSearch,
} from "../lib/enrollment-list";
import { ENROLLMENT_ACTIONS } from "../lib/enrollment-permissions";
import { courseFilterOptions, subjectFilterOptions } from "../lib/offering-choices";
import type { EnrollmentRow } from "../types";
import EnrollmentsTable from "./enrollments-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar las matrículas.";

/** A row awaiting delete confirmation; `name` is what the shared delete flow reports. */
type DeleteTarget = EnrollmentRow & { name: string };

/** SCH-01 `/matriculas` (container): subject enrollments of the active institution. */
export default function EnrollmentsPage({ search }: { search: EnrollmentSearch }) {
  return (
    <ActiveInstitutionGuard pageName="sus matrículas">
      <CanGate
        permission={ENROLLMENT_ACTIONS.list}
        message="No tienes permiso para ver las matrículas de esta institución."
      >
        <EnrollmentsContent search={search} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function EnrollmentsContent({ search }: { search: EnrollmentSearch }) {
  const navigate = useNavigate({ from: "/matriculas/" });
  const canViewStudents = useCan(ENROLLMENT_ACTIONS.viewStudents).can;
  const canDelete = useCan(ENROLLMENT_ACTIONS.delete).can;

  const enrollmentsQuery = useQuery({
    ...orpc.enrollment.list.queryOptions({ input: toEnrollmentListInput(search) }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery(orpc.enrollment.stats.queryOptions());
  const profileQuery = useQuery(orpc.institution.get.queryOptions());
  const coursesQuery = useQuery(orpc.course.options.queryOptions());
  const subjectsQuery = useQuery(orpc.subject.list.queryOptions());

  const deleteEnrollment = useMutation(orpc.enrollment.delete.mutationOptions());
  const deletion = useDeleteEntity<DeleteTarget>({
    remove: (enrollment) => deleteEnrollment.mutateAsync({ id: enrollment.id }),
    invalidate: orpc.enrollment.key(),
    successMessage: () => "Matrícula eliminada",
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(enrollmentSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );
  const { requestDelete } = deletion;
  const onDelete = useCallback(
    (enrollment: EnrollmentRow) =>
      requestDelete({ ...enrollment, name: deleteEntityName(enrollment) }),
    [requestDelete],
  );

  const filterOptions = useMemo(
    () => ({
      courses: courseFilterOptions(coursesQuery.data ?? []),
      subjects: subjectFilterOptions(subjectsQuery.data ?? []),
    }),
    [coursesQuery.data, subjectsQuery.data],
  );
  const actions = useMemo(() => ({ canDelete }), [canDelete]);

  const stats = statsQuery.data;

  return (
    <>
      <ListPageShell
        title="Matrículas de Estudiantes"
        description="Gestión de matrículas de estudiantes por materia"
        actions={
          canViewStudents ? (
            <Link to="/estudiantes" className={buttonVariants({ variant: "outline" })}>
              <GraduationCap data-icon="inline-start" />
              Ver Estudiantes
            </Link>
          ) : null
        }
        banner={<ActiveInstitutionBanner />}
        stats={
          <StatGrid columns={3}>
            <StatTile label="Total Matrículas" value={stats?.total ?? 0} icon={ClipboardList} />
            <StatTile label="Matrículas Activas" value={stats?.active ?? 0} icon={CheckCircle2} />
            <StatTile
              label="Año Académico"
              value={profileQuery.data?.currentAcademicYear ?? "-"}
              icon={CalendarDays}
            />
          </StatGrid>
        }
        listTitle="Listado de Matrículas"
      >
        {hasNoEnrollments(stats) ? (
          <EmptyState
            icon={<ClipboardList />}
            title="No hay matrículas registradas"
            description="Matricule estudiantes en un grado. Serán inscritos automáticamente en todas las materias del grado."
          />
        ) : (
          <EnrollmentsTable
            search={search}
            onSearchChange={onSearchChange}
            filterOptions={filterOptions}
            actions={actions}
            onDelete={onDelete}
            list={{
              rows: enrollmentsQuery.data?.rows,
              total: enrollmentsQuery.data?.total,
              isPending: enrollmentsQuery.isPending,
              isFetching: enrollmentsQuery.isFetching,
              isPlaceholderData: enrollmentsQuery.isPlaceholderData,
              errorMessage: enrollmentsQuery.isError ? LOAD_ERROR_MESSAGE : null,
              onRetry: () => void enrollmentsQuery.refetch(),
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
