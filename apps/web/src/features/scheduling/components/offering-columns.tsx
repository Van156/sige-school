import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Clock, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { formatHours, formatTeacher, TEACHER_FILTER_OPTIONS } from "../lib/offering-list";
import type { OfferingRow } from "../types";

type OfferingColumn = DataTableColumnDef<OfferingRow, string>;

/** Columns that only carry a toolbar filter; the table hides them (`HIDDEN_FILTER_COLUMNS`). */
export const HIDDEN_FILTER_COLUMNS = { courseId: false, subjectId: false } as const;

export type OfferingFilterOptions = { courses: Option[]; subjects: Option[] };

/**
 * SCH-05 columns (sige/04 §5.1). Ids are the server's list ids. The course and subject filters
 * are ids while their columns sort by name, so those filters live in hidden filter-only columns.
 * The actions column exists only for callers who can edit or delete.
 */
export function getOfferingColumns({
  canEdit,
  canDelete,
  filterOptions,
  onEditHours,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  filterOptions: OfferingFilterOptions;
  onEditHours: (offering: OfferingRow) => void;
  onDelete: (offering: OfferingRow) => void;
}): OfferingColumn[] {
  const columns: OfferingColumn[] = [
    {
      id: "courseId",
      accessorKey: "courseId",
      header: "Grado",
      cell: () => null,
      meta: { label: "Filtrar por grado", variant: "select", options: filterOptions.courses },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "subjectId",
      accessorKey: "subjectId",
      header: "Materia",
      cell: () => null,
      meta: { label: "Filtrar por materia", variant: "select", options: filterOptions.subjects },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "subject",
      accessorKey: "subjectName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Materia" />,
      cell: ({ row }) => <span className="font-medium">{row.original.subjectName}</span>,
      meta: { label: "Materia" },
    },
    {
      id: "course",
      accessorKey: "courseName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Grado" />,
      cell: ({ row }) => row.original.courseName,
      meta: { label: "Grado" },
    },
    {
      id: "hoursPerWeek",
      accessorKey: "hoursPerWeek",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Intensidad" />,
      cell: ({ row }) => <Badge variant="info">{formatHours(row.original.hoursPerWeek)}</Badge>,
      meta: { label: "Intensidad" },
    },
    {
      id: "teacher",
      accessorKey: "teacherName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Profesor Asignado" />,
      cell: ({ row }) =>
        row.original.teacherName === null ? (
          <span className="text-muted-foreground">{formatTeacher(row.original)}</span>
        ) : (
          <Badge variant="outline">{formatTeacher(row.original)}</Badge>
        ),
      meta: { label: "Profesor Asignado", variant: "select", options: TEACHER_FILTER_OPTIONS },
      enableColumnFilter: true,
    },
  ];

  if (canEdit || canDelete) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const label = `${row.original.subjectName} de ${row.original.courseName}`;
        return (
          <div className="flex justify-end gap-1 whitespace-nowrap">
            {canEdit ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar intensidad de ${label}`}
                onClick={() => onEditHours(row.original)}
              >
                <Clock />
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar ${label}`}
                onClick={() => onDelete(row.original)}
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
    });
  }
  return columns;
}
