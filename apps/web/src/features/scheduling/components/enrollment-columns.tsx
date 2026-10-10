import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { formatIsoDate } from "@/features/institution";
import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_OPTIONS,
  ENROLLMENT_STATUS_VARIANTS,
  formatFinalScore,
  STALE_BADGE_LABEL,
} from "../lib/enrollment-list";
import type { EnrollmentRow } from "../types";

type EnrollmentColumn = DataTableColumnDef<EnrollmentRow, string>;

/** Columns that only carry a toolbar filter; the table hides them. */
export const HIDDEN_FILTER_COLUMNS = { courseId: false, subjectId: false } as const;

export type EnrollmentFilterOptions = { courses: Option[]; subjects: Option[] };

/** Which row actions the caller may use (`enrollment:update` / `enrollment:delete`). */
export type EnrollmentRowActions = { canEdit: boolean; canDelete: boolean };

/**
 * SCH-01 columns (sige/04 §5.1). Ids are the server's list ids. The course and subject filters
 * are ids while their columns sort by name, so those filters live in hidden filter-only columns.
 * The `student` text filter also matches the document and the subject on the server. The actions
 * column exists only for callers who can use one of its actions.
 */
export function getEnrollmentColumns({
  actions,
  filterOptions,
  onDelete,
}: {
  actions: EnrollmentRowActions;
  filterOptions: EnrollmentFilterOptions;
  onDelete: (enrollment: EnrollmentRow) => void;
}): EnrollmentColumn[] {
  const columns: EnrollmentColumn[] = [
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
      id: "student",
      accessorKey: "studentName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estudiante" />,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.studentName}</span>
          <span className="text-xs text-muted-foreground">{row.original.document}</span>
        </div>
      ),
      meta: {
        label: "Estudiante",
        placeholder: "Buscar estudiante, documento o materia",
        variant: "text",
      },
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
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="outline">{row.original.courseName}</Badge>
          {row.original.isStale ? (
            <Badge variant="ghost" className="text-muted-foreground">
              {STALE_BADGE_LABEL}
            </Badge>
          ) : null}
        </div>
      ),
      meta: { label: "Grado" },
    },
    {
      id: "enrollmentDate",
      accessorKey: "enrollmentDate",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Fecha Matrícula" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatIsoDate(row.original.enrollmentDate)}</span>
      ),
      meta: { label: "Fecha Matrícula" },
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estado" />,
      cell: ({ row }) => (
        <Badge variant={ENROLLMENT_STATUS_VARIANTS[row.original.status]}>
          {ENROLLMENT_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
      meta: { label: "Estado", variant: "select", options: ENROLLMENT_STATUS_OPTIONS },
      enableColumnFilter: true,
    },
    {
      id: "finalScore",
      accessorFn: (row) => formatFinalScore(row.finalScore),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nota Final" />,
      cell: ({ row }) =>
        row.original.finalScore === null ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <Badge variant="secondary" className="tabular-nums">
            {formatFinalScore(row.original.finalScore)}
          </Badge>
        ),
      meta: { label: "Nota Final" },
    },
  ];

  if (actions.canEdit || actions.canDelete) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const label = `${row.original.studentName} en ${row.original.subjectName}`;
        return (
          <div className="flex justify-end gap-1 whitespace-nowrap">
            {actions.canEdit ? (
              <Link
                to="/matriculas/$id/editar"
                params={{ id: row.original.id }}
                aria-label={`Editar matrícula de ${label}`}
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                <Pencil />
              </Link>
            ) : null}
            {actions.canDelete ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar matrícula de ${label}`}
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
