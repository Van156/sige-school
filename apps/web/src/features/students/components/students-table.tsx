import { GraduationCap } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { studentSearchConfig, type StudentSearch } from "../lib/student-list";
import type { StudentRow } from "../types";
import {
  getStudentColumns,
  HIDDEN_FILTER_COLUMNS,
  type StudentFilterChoices,
  type StudentRowActions,
} from "./students-columns";

/**
 * STU-01 "Lista de Estudiantes" in a URL-driven server table. Presentational: the caller owns the
 * `student.list` query state and the filter choices; row actions only ask the caller to act.
 */
export default function StudentsTable({
  search,
  onSearchChange,
  list,
  filterChoices,
  canUpdate,
  canDelete,
  onDelete,
  emptyAction,
}: StudentRowActions & {
  search: StudentSearch;
  onSearchChange: DataTableSearchChange;
  filterChoices: StudentFilterChoices;
  /** "Crear Estudiante" of the empty state (`student:create` callers). */
  emptyAction?: ReactNode;
  list: {
    rows: StudentRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
}) {
  const columns = useMemo(
    () => getStudentColumns({ filterChoices, canUpdate, canDelete, onDelete }),
    [filterChoices, canUpdate, canDelete, onDelete],
  );
  return (
    <SimpleListTable
      search={search}
      searchConfig={studentSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      initialState={{ columnVisibility: HIDDEN_FILTER_COLUMNS }}
      emptyTitle="No se encontraron estudiantes con perfil académico completo"
      emptyDescription="Intenta cambiar los filtros o crea un nuevo estudiante."
      emptyIcon={<GraduationCap />}
      emptyAction={emptyAction}
      list={list}
    />
  );
}
