import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { formatIsoDate } from "@/features/institution";
import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_OPTIONS,
  ASSIGNMENT_STATUS_VARIANTS,
} from "../lib/assignment-list";
import type { AssignmentRow } from "../types";

type AssignmentColumn = DataTableColumnDef<AssignmentRow, string>;

/** Columns that only carry a toolbar filter; the table hides them (`HIDDEN_FILTER_COLUMNS`). */
export const HIDDEN_FILTER_COLUMNS = { courseId: false, subjectId: false } as const;

export type AssignmentFilterOptions = { courses: Option[]; subjects: Option[] };

/**
 * SCH-03 columns (sige/04 §5.1). Ids are the server's list ids. The course and subject filters
 * are ids while their columns sort by name, so those filters live in hidden filter-only columns.
 * The actions column exists only for callers who can edit.
 */
export function getAssignmentColumns({
  canEdit,
  filterOptions,
  onDelete,
}: {
  canEdit: boolean;
  filterOptions: AssignmentFilterOptions;
  onDelete: (assignment: AssignmentRow) => void;
}): AssignmentColumn[] {
  const columns: AssignmentColumn[] = [
    {
      id: "courseId",
      accessorFn: () => "",
      header: "Grado",
      cell: () => null,
      meta: { label: "Filtrar por grado", variant: "select", options: filterOptions.courses },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "subjectId",
      accessorFn: () => "",
      header: "Materia",
      cell: () => null,
      meta: { label: "Filtrar por materia", variant: "select", options: filterOptions.subjects },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "teacher",
      accessorKey: "teacherName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Profesor" />,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.teacherName}</span>
          {row.original.teacherUsername ? (
            <span className="text-xs text-muted-foreground">{row.original.teacherUsername}</span>
          ) : null}
        </div>
      ),
      meta: { label: "Profesor", placeholder: "Buscar profesor...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "subject",
      accessorKey: "subjectName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Materia" />,
      cell: ({ row }) => row.original.subjectName,
      meta: { label: "Materia" },
    },
    {
      id: "course",
      accessorKey: "courseName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Grado" />,
      cell: ({ row }) => <Badge variant="outline">{row.original.courseName}</Badge>,
      meta: { label: "Grado" },
    },
    {
      id: "assignmentDate",
      accessorKey: "assignmentDate",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Fecha Asignación" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatIsoDate(row.original.assignmentDate)}</span>
      ),
      meta: { label: "Fecha Asignación" },
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estado" />,
      cell: ({ row }) => (
        <Badge variant={ASSIGNMENT_STATUS_VARIANTS[row.original.status]}>
          {ASSIGNMENT_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
      meta: { label: "Estado", variant: "select", options: ASSIGNMENT_STATUS_OPTIONS },
      enableColumnFilter: true,
    },
  ];

  if (canEdit) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const label = `${row.original.subjectName} de ${row.original.courseName}`;
        return (
          <div className="flex justify-end gap-1 whitespace-nowrap">
            <Link
              to="/asignaciones/$id/editar"
              params={{ id: row.original.id }}
              aria-label={`Editar asignación de ${label}`}
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <Pencil />
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar asignación de ${label}`}
              onClick={() => onDelete(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        );
      },
      meta: { label: "Acciones" },
      enableSorting: false,
      enableHiding: false,
    });
  }
  return columns;
}
