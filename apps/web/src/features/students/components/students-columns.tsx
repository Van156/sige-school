import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Eye, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { documentLabel, STUDENT_STATUS_FILTER_OPTIONS } from "../lib/student-list";
import type { StudentRow } from "../types";
import StatusBadge from "./status-badge";

type StudentColumn = DataTableColumnDef<StudentRow, string>;

/** Columns that only carry a toolbar filter; the table hides them. */
export const HIDDEN_FILTER_COLUMNS = { campusId: false, courseId: false } as const;

/** "Filtrar por sede" / "Filtrar por grado" choices (`student.filterOptions`). */
export type StudentFilterChoices = { campuses: Option[]; courses: Option[] };

export type StudentRowActions = {
  /** `student:delete` of the caller; UX only, the procedure re-checks. */
  canDelete: boolean;
  onDelete: (student: StudentRow) => void;
};

/**
 * STU-01 columns (sige/05 §5.1). Ids are the server's list ids. "Estudiante" hosts the toolbar
 * search (name, document or guardian); the campus and course filters are ids while their columns
 * sort by name, so they live in hidden filter-only columns. Every caller gets "Ver perfil"; the
 * other row actions follow the caller's permissions.
 */
export function getStudentColumns({
  filterChoices,
  canDelete,
  onDelete,
}: StudentRowActions & { filterChoices: StudentFilterChoices }): StudentColumn[] {
  return [
    {
      id: "campusId",
      accessorFn: () => "",
      header: "Sede",
      cell: () => null,
      meta: { label: "Filtrar por sede", variant: "select", options: filterChoices.campuses },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "courseId",
      accessorFn: () => "",
      header: "Grado",
      cell: () => null,
      meta: { label: "Filtrar por grado", variant: "select", options: filterChoices.courses },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estudiante" />,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{row.original.name}</span>
          {row.original.guardianName ? (
            <span className="truncate text-xs text-muted-foreground">
              Acudiente: {row.original.guardianName}
            </span>
          ) : null}
        </div>
      ),
      meta: {
        label: "Estudiante",
        placeholder: "Buscar por nombre, documento o acudiente",
        variant: "text",
      },
      enableColumnFilter: true,
    },
    {
      id: "document",
      accessorFn: documentLabel,
      header: ({ column }) => <DataTableColumnHeader column={column} label="Documento" />,
      cell: ({ row }) => <Badge variant="secondary">{documentLabel(row.original)}</Badge>,
      meta: { label: "Documento" },
    },
    {
      id: "course",
      accessorFn: (row) => row.courseName ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Grado" />,
      cell: ({ row }) =>
        row.original.courseName === null ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <Badge variant="outline">{row.original.courseName}</Badge>
        ),
      meta: { label: "Grado" },
    },
    {
      id: "campus",
      accessorKey: "campusName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Sede" />,
      cell: ({ row }) => row.original.campusName || "-",
      meta: { label: "Sede" },
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estado" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      meta: {
        label: "Filtrar por estado",
        variant: "select",
        options: STUDENT_STATUS_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const student = row.original;
        return (
          <div className="flex justify-end gap-1 whitespace-nowrap">
            <Link
              to="/estudiantes/$studentId"
              params={{ studentId: student.id }}
              aria-label={`Ver perfil de ${student.name}`}
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <Eye />
            </Link>
            {canDelete ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar a ${student.name}`}
                onClick={() => onDelete(student)}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        );
      },
      meta: { label: "Acciones" },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
