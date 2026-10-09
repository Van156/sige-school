import { buttonVariants } from "@base-template/ui/components/button";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { DoorOpen, FlaskConical, Plus, School } from "lucide-react";
import { useCallback, useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { orpc } from "@/app/orpc";
import {
  ActiveInstitutionBanner,
  ActiveInstitutionGuard,
  ConfirmDelete,
  useCanManage,
  useDeleteEntity,
} from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { StatGrid, StatTile } from "@/shared/components/layout/stat-tile";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import {
  classroomSearchConfig,
  hasNoClassrooms,
  toClassroomListInput,
  type ClassroomSearch,
} from "../lib/classroom-list";
import type { ClassroomRow } from "../types";
import ClassroomsTable from "./classrooms-table";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar los salones.";

/** SCH-07 `/salones` (container): classrooms of the active institution, read-only without `classroom:create`. */
export default function ClassroomsPage({ search }: { search: ClassroomSearch }) {
  return (
    <ActiveInstitutionGuard pageName="sus salones">
      <ClassroomsContent search={search} />
    </ActiveInstitutionGuard>
  );
}

function ClassroomsContent({ search }: { search: ClassroomSearch }) {
  const navigate = useNavigate({ from: "/salones/" });
  const canManage = useCanManage("classroom");

  const classroomsQuery = useQuery({
    ...orpc.classroom.list.queryOptions({ input: toClassroomListInput(search) }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery(orpc.classroom.stats.queryOptions());
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());

  const deleteClassroom = useMutation(orpc.classroom.delete.mutationOptions());
  const deletion = useDeleteEntity<ClassroomRow>({
    remove: (room) => deleteClassroom.mutateAsync({ id: room.id }),
    invalidate: orpc.classroom.key(),
    successMessage: () => "Salón eliminado",
  });

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(classroomSearchConfig, previous, next) as typeof previous,
        replace,
      });
    },
    [navigate],
  );

  const filterOptions = useMemo(
    () => ({
      campuses: (campusesQuery.data ?? []).map((campus) => ({
        value: campus.id,
        label: campus.name,
      })),
    }),
    [campusesQuery.data],
  );

  const stats = statsQuery.data;
  const createLink = (label: string) => (
    <Link to="/salones/nuevo" className={buttonVariants()}>
      <Plus data-icon="inline-start" />
      {label}
    </Link>
  );

  return (
    <>
      <ListPageShell
        title="Gestión de Salones"
        description="Administración de salones y aulas por sede"
        actions={canManage ? createLink("Nuevo Salón") : undefined}
        banner={<ActiveInstitutionBanner />}
        stats={
          <StatGrid columns={3}>
            <StatTile label="Total Salones" value={stats?.total ?? 0} icon={DoorOpen} />
            <StatTile label="Aulas" value={stats?.aulas ?? 0} icon={School} />
            <StatTile label="Laboratorios" value={stats?.laboratorios ?? 0} icon={FlaskConical} />
          </StatGrid>
        }
        listTitle="Listado de Salones"
      >
        {hasNoClassrooms(stats) ? (
          <EmptyState
            icon={<DoorOpen />}
            title="No hay salones registrados"
            description="Registre los salones y aulas de la institución"
            action={canManage ? createLink("Crear Salón") : undefined}
          />
        ) : (
          <ClassroomsTable
            search={search}
            onSearchChange={onSearchChange}
            filterOptions={filterOptions}
            canManage={canManage}
            onDelete={deletion.requestDelete}
            list={{
              rows: classroomsQuery.data?.rows,
              total: classroomsQuery.data?.total,
              isPending: classroomsQuery.isPending,
              isFetching: classroomsQuery.isFetching,
              isPlaceholderData: classroomsQuery.isPlaceholderData,
              errorMessage: classroomsQuery.isError ? LOAD_ERROR_MESSAGE : null,
              onRetry: () => void classroomsQuery.refetch(),
            }}
          />
        )}
      </ListPageShell>
      <ConfirmDelete
        {...deletion.dialog}
        title="¿Eliminar este salón?"
        description="Esta acción no se puede deshacer."
      />
    </>
  );
}
