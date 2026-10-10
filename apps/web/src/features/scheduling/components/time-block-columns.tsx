import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { blockTypeLabel, SHIFT_OPTIONS } from "../lib/time-block-list";
import type { TimeBlockRow } from "../types";

type TimeBlockColumn = DataTableColumnDef<TimeBlockRow, string>;

/**
 * SCH-09 columns (sige/04 §5.1). Ids are the client list's ids. Breaks are highlighted in the
 * name and the type badge; the actions column exists only for callers who can edit or delete, and shows only the allowed
 * actions.
 */
export function getTimeBlockColumns({
  canEdit,
  canDelete,
  campusOptions,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  campusOptions: Option[];
  onDelete: (block: TimeBlockRow) => void;
}): TimeBlockColumn[] {
  const columns: TimeBlockColumn[] = [
    {
      id: "orderNum",
      accessorKey: "orderNum",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Orden" />,
      cell: ({ row }) => <Badge variant="outline">{row.original.orderNum}</Badge>,
      meta: { label: "Orden" },
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre" />,
      cell: ({ row }) => (
        <span className={row.original.isBreak ? "font-medium text-warning" : "font-medium"}>
          {row.original.name}
        </span>
      ),
      meta: { label: "Nombre" },
    },
    {
      id: "campus",
      accessorKey: "campusName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Sede" />,
      cell: ({ row }) => row.original.campusName,
      meta: { label: "Filtrar por sede", variant: "select", options: campusOptions },
      enableColumnFilter: true,
    },
    {
      id: "shift",
      accessorKey: "shift",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Jornada" />,
      cell: ({ row }) => <Badge variant="info">{row.original.shift}</Badge>,
      meta: { label: "Filtrar por jornada", variant: "select", options: SHIFT_OPTIONS },
      enableColumnFilter: true,
    },
    {
      id: "startTime",
      accessorKey: "startTime",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Hora Inicio" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.startTime}</span>,
      meta: { label: "Hora Inicio" },
    },
    {
      id: "endTime",
      accessorKey: "endTime",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Hora Fin" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.endTime}</span>,
      meta: { label: "Hora Fin" },
    },
    {
      id: "type",
      accessorFn: (row) => blockTypeLabel(row),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Tipo" />,
      cell: ({ row }) => (
        <Badge variant={row.original.isBreak ? "warning" : "success"}>
          {blockTypeLabel(row.original)}
        </Badge>
      ),
      meta: { label: "Tipo" },
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
              to="/bloques/$id/editar"
              params={{ id: row.original.id }}
              aria-label={`Editar bloque ${row.original.name} ${row.original.shift}`}
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <Pencil />
            </Link>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar bloque ${row.original.name} ${row.original.shift}`}
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
