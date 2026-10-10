import { Badge } from "@base-template/ui/components/badge";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import ListPageShell from "@/shared/components/layout/list-page-shell";
import { useLocalTableSearch } from "@/shared/hooks/use-local-table-search";
import { mergeTableSearch } from "@/shared/lib/data-table/search";

import {
  campusFilterOptions,
  courseFilterOptions,
  incompleteSearchSchema,
  reconcileCourseFilter,
  hasPendingProfiles,
  STUDENTS_LOAD_ERROR,
  studentSearchConfig,
  toIncompleteListInput,
  toStudentListInput,
  type StudentSearch,
} from "../lib/student-list";
import { STUDENT_PERMISSIONS } from "../lib/student-permissions";
import type { StudentRow } from "../types";
import IncompleteProfilesCard from "./incomplete-profiles-card";
import StudentsTable from "./students-table";

const INCOMPLETE_LOAD_ERROR = "No se pudieron cargar los perfiles incompletos.";

/** A row awaiting delete confirmation; `name` is what the shared delete flow reports. */
type DeleteTarget = { id: string; name: string };

/**
 * STU-01 `/estudiantes` (container): the students in the caller's scope (teachers: their own
 * courses, STU-R1) and, for callers who can complete a profile, the student logins still missing
 * one. Unreachable without `student:read`.
 */
export default function StudentsPage({ search }: { search: StudentSearch }) {
  return (
    <ActiveInstitutionGuard pageName="sus estudiantes">
      <CanGate
        permission={STUDENT_PERMISSIONS.list}
        message="No tienes permiso para ver los estudiantes de esta institución."
      >
        <StudentsContent search={search} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function StudentsContent({ search }: { search: StudentSearch }) {
  const navigate = useNavigate({ from: "/estudiantes/" });
  const canDelete = useCan(STUDENT_PERMISSIONS.delete).can;
  const canCreate = useCan(STUDENT_PERMISSIONS.create).can;

  const listQuery = useQuery({
    ...orpc.student.list.queryOptions({ input: toStudentListInput(search) }),
    placeholderData: keepPreviousData,
  });
  const optionsQuery = useQuery(orpc.student.filterOptions.queryOptions());
  const filterOptions = optionsQuery.data;

  const deleteStudent = useMutation(orpc.student.delete.mutationOptions());
  const deletion = useDeleteEntity<DeleteTarget>({
    remove: (target) => deleteStudent.mutateAsync({ id: target.id }),
    invalidate: orpc.student.key(),
    successMessage: () => "Estudiante eliminado",
  });
  const { requestDelete } = deletion;
  const onDelete = useCallback(
    (row: StudentRow) => requestDelete({ id: row.id, name: row.name }),
    [requestDelete],
  );

  const onSearchChange = useCallback<DataTableSearchChange>(
    (next, { replace }) => {
      void navigate({
        search: (previous) =>
          mergeTableSearch(
            studentSearchConfig,
            previous,
            reconcileCourseFilter(next, filterOptions),
          ) as typeof previous,
        replace,
      });
    },
    [navigate, filterOptions],
  );

  const filterChoices = useMemo(
    () => ({
      campuses: campusFilterOptions(filterOptions),
      courses: courseFilterOptions(filterOptions, search.campusId),
    }),
    [filterOptions, search.campusId],
  );

  const total = listQuery.data?.total;

  return (
    <>
      <div className="flex flex-col gap-4">
        <ListPageShell
          title="Gestión de Estudiantes"
          description="Administra los estudiantes de la institución"
          banner={<ActiveInstitutionBanner />}
          listTitle="Lista de Estudiantes"
          listAction={
            total === undefined ? undefined : <Badge variant="secondary">{total} estudiantes</Badge>
          }
        >
          <StudentsTable
            search={search}
            onSearchChange={onSearchChange}
            filterChoices={filterChoices}
            canDelete={canDelete}
            onDelete={onDelete}
            list={{
              rows: listQuery.data?.rows,
              total,
              isPending: listQuery.isPending,
              isFetching: listQuery.isFetching,
              isPlaceholderData: listQuery.isPlaceholderData,
              errorMessage: listQuery.isError ? STUDENTS_LOAD_ERROR : null,
              onRetry: () => void listQuery.refetch(),
            }}
          />
        </ListPageShell>
        {canCreate ? <IncompleteProfiles /> : null}
      </div>
      <ConfirmDelete
        {...deletion.dialog}
        title="¿Eliminar este estudiante?"
        description="Esta acción no se puede deshacer."
      />
    </>
  );
}

const PENDING_INPUT = toIncompleteListInput(incompleteSearchSchema.parse({}));

/** The incomplete-profiles card's queries; mounted only for `student:create` callers. */
function IncompleteProfiles() {
  const canEditUser = useCan(STUDENT_PERMISSIONS.editUser).can;
  const { search, onSearchChange } = useLocalTableSearch(incompleteSearchSchema);
  // The unfiltered count decides whether the card shows; with no search both queries share a key.
  const pendingQuery = useQuery(orpc.student.listIncomplete.queryOptions({ input: PENDING_INPUT }));
  const listQuery = useQuery({
    ...orpc.student.listIncomplete.queryOptions({ input: toIncompleteListInput(search) }),
    placeholderData: keepPreviousData,
  });

  const pendingTotal = pendingQuery.data?.total ?? 0;
  if (!hasPendingProfiles(pendingTotal)) {
    return null;
  }
  return (
    <IncompleteProfilesCard
      pendingTotal={pendingTotal}
      search={search}
      onSearchChange={onSearchChange}
      canEditUser={canEditUser}
      list={{
        rows: listQuery.data?.rows,
        total: listQuery.data?.total,
        isPending: listQuery.isPending,
        isFetching: listQuery.isFetching,
        isPlaceholderData: listQuery.isPlaceholderData,
        errorMessage: listQuery.isError ? INCOMPLETE_LOAD_ERROR : null,
        onRetry: () => void listQuery.refetch(),
      }}
    />
  );
}
