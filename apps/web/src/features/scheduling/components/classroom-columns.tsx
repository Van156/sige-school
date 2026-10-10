import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import {
  CLASSROOM_TYPE_LABELS,
  CLASSROOM_TYPE_OPTIONS,
  formatCapacity,
  formatLocation,
} from "../lib/classroom-list";
import type { ClassroomRow } from "../types";

type ClassroomColumn = DataTableColumnDef<ClassroomRow, string>;

/** Columns that only carry a toolbar filter; the table hides them (`HIDDEN_FILTER_COLUMNS`). */
export const HIDDEN_FILTER_COLUMNS = { campusId: false } as const;

export type ClassroomFilterOptions = { campuses: Option[] };

/**
 * SCH-07 columns (sige/04 §5.1). Ids are the server's list ids. The campus filter is an id while
 * the campus column sorts by name, so the filter lives in a hidden filter-only column. The actions
 * column exists only for callers who can edit or delete, and shows only the allowed actions.
 */
export function getClassroomColumns({
  canEdit,
  canDelete,
  filterOptions,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  filterOptions: ClassroomFilterOptions;
  onDelete: (room: ClassroomRow) => void;
}): ClassroomColumn[] {
  const columns: ClassroomColumn[] = [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      meta: { label: "Nombre", placeholder: "Buscar salón...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "campusId",
      accessorKey: "campusId",
      header: "Sede",
      cell: () => null,
      meta: { label: "Filtrar por sede", variant: "select", options: filterOptions.campuses },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "code",
      accessorKey: "code",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Código" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
      meta: { label: "Código" },
    },
    {
      id: "campus",
      accessorKey: "campusName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Sede" />,
      cell: ({ row }) => row.original.campusName,
      meta: { label: "Sede" },
    },
    {
      id: "type",
      accessorKey: "classroomType",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Tipo" />,
      cell: ({ row }) => (
        <Badge variant="info">{CLASSROOM_TYPE_LABELS[row.original.classroomType]}</Badge>
      ),
      meta: { label: "Tipo", variant: "select", options: CLASSROOM_TYPE_OPTIONS },
      enableColumnFilter: true,
    },
    {
      id: "capacity",
      accessorKey: "capacity",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Capacidad" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCapacity(row.original.capacity)}</span>
      ),
      meta: { label: "Capacidad" },
    },
    {
      id: "location",
      accessorFn: (row) => formatLocation(row),
      header: "Ubicación",
      cell: ({ row }) => formatLocation(row.original),
      meta: { label: "Ubicación" },
      enableSorting: false,
    },
  ];

  if (canEdit || canDelete) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          {canEdit ? (
            <Link
              to="/salones/$id/editar"
              params={{ id: row.original.id }}
              aria-label={`Editar salón ${row.original.name}`}
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <Pencil />
            </Link>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar salón ${row.original.name}`}
              onClick={() => onDelete(row.original)}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      ),
      meta: { label: "Acciones" },
      enableSorting: false,
      enableHiding: false,
    });
  }
  return columns;
}
