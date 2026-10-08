import { buttonVariants } from "@base-template/ui/components/button";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, GraduationCap, Plus, UserCheck } from "lucide-react";
import { useCallback, useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { StatGrid, StatTile } from "@/shared/components/layout/stat-tile";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import { useCanManage } from "../hooks/use-can-manage";
import { useDeleteEntity } from "../hooks/use-delete-entity";
import {
  courseCampusFilterOptions,
  courseLevelFilterOptions,
  courseSearchConfig,
  courseYearFilterOptions,
  hasNoCourses,
  toCourseListInput,
  type CourseSearch,
} from "../lib/course-list";
import type { CourseRow } from "../types";
import ActiveInstitutionBanner from "./active-institution-banner";
import ActiveInstitutionGuard from "./active-institution-guard";
import ConfirmDelete from "./confirm-delete";
import CoursesTable from "./courses-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar los grados.";

/** INS-11 `/cursos` (container): courses of the active institution, read-only without `course:create`. */
export default function CoursesPage({ search }: { search: CourseSearch }) {
  return (
    <ActiveInstitutionGuard pageName="sus grados">
      <CoursesContent search={search} />
    </ActiveInstitutionGuard>
  );
}

function CoursesContent({ search }: { search: CourseSearch }) {
  const navigate = useNavigate({ from: "/cursos/" });
  const canManage = useCanManage("course");

  const coursesQuery = useQuery({
    ...orpc.course.list.queryOptions({ input: toCourseListInput(search) }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery(orpc.course.stats.queryOptions());
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());
  const levelsQuery = useQuery(orpc.level.list.queryOptions({ input: {} }));
  const optionsQuery = useQuery(orpc.course.options.queryOptions({ input: {} }));

  const deleteCourse = useMutation(orpc.course.delete.mutationOptions());
  const deletion = useDeleteEntity<CourseRow>({
    remove: (course) => deleteCourse.mutateAsync({ id: course.id }),
    invalidate: orpc.course.key(),
    successMessage: () => "Grado eliminado",
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(courseSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  const filterOptions = useMemo(
    () => ({
      campuses: courseCampusFilterOptions(campusesQuery.data ?? []),
      levels: courseLevelFilterOptions(levelsQuery.data ?? []),
      years: courseYearFilterOptions(optionsQuery.data ?? []),
    }),
    [campusesQuery.data, levelsQuery.data, optionsQuery.data],
  );

  const stats = statsQuery.data;
  const createLink = (label: string) => (
    <Link to="/cursos/nuevo" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Gestión de Grados"
        description="Administra los grados de tu institución educativa"
        actions={canManage ? createLink("Nuevo Grado") : undefined}
        banner={<ActiveInstitutionBanner />}
        stats={
          <StatGrid columns={3}>
            <StatTile label="Total Grados" value={stats?.total ?? 0} icon={GraduationCap} />
            <StatTile
              label="Sedes con Grados"
              value={stats?.campusesWithCourses ?? 0}
              icon={Building2}
            />
            <StatTile label="Con Director" value={stats?.withDirector ?? 0} icon={UserCheck} />
          </StatGrid>
        }
        listTitle="Listado de Grados"
      >
        {hasNoCourses(stats) ? (
          <EmptyState
            icon={<GraduationCap />}
            title="No hay grados registrados"
            description="Crea el primer grado para esta institución."
            action={canManage ? createLink("Crear Primer Grado") : undefined}
          />
        ) : (
          <CoursesTable
            search={search}
            onSearchChange={onSearchChange}
            filterOptions={filterOptions}
            canManage={canManage}
            onDelete={deletion.requestDelete}
            list={{
              rows: coursesQuery.data?.rows,
              total: coursesQuery.data?.total,
              isPending: coursesQuery.isPending,
              isFetching: coursesQuery.isFetching,
              isPlaceholderData: coursesQuery.isPlaceholderData,
              errorMessage: coursesQuery.isError ? LOAD_ERROR_MESSAGE : null,
              onRetry: () => void coursesQuery.refetch(),
            }}
          />
        )}
      </ListPageShell>
      <ConfirmDelete
        {...deletion.dialog}
        title={`¿Eliminar grado ${deletion.target?.name ?? ""}?`}
        description="Esta acción no se puede deshacer."
      />
    </>
  );
}
