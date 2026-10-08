import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Power, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { formatIsoDate } from "../lib/period-list";
import type { PeriodRow } from "../types";

type PeriodColumn = DataTableColumnDef<PeriodRow, string>;

/** INS-15 columns (sige/02 §5.2); the actions column exists only for callers who can manage. */
export function getPeriodColumns({
  canManage,
  onActivate,
  onDelete,
}: {
  canManage: boolean;
  onActivate: (period: PeriodRow) => void;
  onDelete: (period: PeriodRow) => void;
}): PeriodColumn[] {
  const columns: PeriodColumn[] = [
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
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      meta: { label: "Nombre", placeholder: "Buscar periodo...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "shortName",
      accessorKey: "shortName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre Corto" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.shortName}</Badge>,
      meta: { label: "Nombre Corto" },
    },
    {
      id: "startDate",
      accessorKey: "startDate",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Fecha Inicio" />,
      cell: ({ row }) => formatIsoDate(row.original.startDate),
      meta: { label: "Fecha Inicio" },
    },
    {
      id: "endDate",
      accessorKey: "endDate",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Fecha Fin" />,
      cell: ({ row }) => formatIsoDate(row.original.endDate),
      meta: { label: "Fecha Fin" },
    },
    {
      id: "academicYear",
      accessorKey: "academicYear",
      header: () => "Año Académico",
      cell: ({ row }) => row.original.academicYear,
      meta: { label: "Año Académico" },
      enableSorting: false,
    },
    {
      id: "isActive",
      accessorFn: (row) => String(row.isActive),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Activo" />,
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "outline"}>
          {row.original.isActive ? "Activo" : "Inactivo"}
        </Badge>
      ),
      meta: { label: "Activo" },
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          {row.original.isActive ? null : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Activar periodo ${row.original.name}`}
              onClick={() => onActivate(row.original)}
            >
              <Power />
            </Button>
          )}
          <Link
            to="/periodos/$id/editar"
            params={{ id: row.original.id }}
            aria-label={`Editar periodo ${row.original.name}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Pencil />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar periodo ${row.original.name}`}
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
