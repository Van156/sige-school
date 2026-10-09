import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { COURSE_SHIFT_FILTER_OPTIONS, directorLabel } from "../lib/course-list";
import type { CourseRow } from "../types";

type CourseColumn = DataTableColumnDef<CourseRow, string>;

/** Columns that only carry a toolbar filter; the table hides them (`HIDDEN_FILTER_COLUMNS`). */
export const HIDDEN_FILTER_COLUMNS = { campusId: false, levelId: false } as const;

export type CourseFilterOptions = {
  campuses: Option[];
  levels: Option[];
  years: Option[];
};

/**
 * INS-11 columns (sige/02 §5.2). Ids are the server's list ids. The campus and level filters are
 * ids while the campus column sorts by name, so those two filters live in hidden filter-only
 * columns. The actions column exists only for callers who can manage.
 */
export function getCourseColumns({
  canManage,
  filterOptions,
  onDelete,
}: {
  canManage: boolean;
  filterOptions: CourseFilterOptions;
  onDelete: (course: CourseRow) => void;
}): CourseColumn[] {
  const columns: CourseColumn[] = [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      meta: { label: "Nombre", placeholder: "Buscar grado...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "campusId",
      accessorKey: "campusId",
      header: "Sede",
      cell: () => null,
      meta: { label: "Sede", variant: "select", options: filterOptions.campuses },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "levelId",
      accessorKey: "levelId",
      header: "Nivel Académico",
      cell: () => null,
      meta: { label: "Nivel Académico", variant: "select", options: filterOptions.levels },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "campus",
      accessorKey: "campusName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Sede" />,
      cell: ({ row }) => <Badge variant="outline">{row.original.campusName}</Badge>,
      meta: { label: "Sede" },
    },
    {
      id: "director",
      accessorFn: (row) => directorLabel(row),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Director de Grupo" />,
      cell: ({ row }) =>
        row.original.directorName ?? (
          <span className="text-muted-foreground">{directorLabel(row.original)}</span>
        ),
      meta: { label: "Director de Grupo" },
    },
    {
      id: "academicYear",
      accessorKey: "academicYear",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Año Lectivo" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.academicYear}</Badge>,
      meta: { label: "Año Lectivo", variant: "select", options: filterOptions.years },
      enableColumnFilter: true,
    },
    {
      id: "shift",
      accessorKey: "shift",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Jornada" />,
      cell: ({ row }) => <Badge variant="info">{row.original.shift}</Badge>,
      meta: { label: "Jornada", variant: "select", options: COURSE_SHIFT_FILTER_OPTIONS },
      enableColumnFilter: true,
    },
    {
      id: "maxStudents",
      accessorKey: "maxStudents",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Capacidad" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.maxStudents}</span>,
      meta: { label: "Capacidad" },
    },
    {
      id: "studentCount",
      accessorKey: "studentCount",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estudiantes" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.studentCount}</span>,
      meta: { label: "Estudiantes" },
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          <Link
            to="/cursos/$id/editar"
            params={{ id: row.original.id }}
            aria-label={`Editar grado ${row.original.name}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Pencil />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar grado ${row.original.name}`}
            onClick={() => onDelete(row.original)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
      meta: { label: "Acciones" },
      enableSorting: false,
      enableHiding: false,
    });
  }
  return columns;
}
