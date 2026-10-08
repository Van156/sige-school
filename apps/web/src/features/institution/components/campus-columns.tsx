import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { JORNADA_LABEL } from "../lib/campus-form";
import { CAMPUS_JORNADA_FILTER_OPTIONS, CAMPUS_STATUS_FILTER_OPTIONS } from "../lib/campus-list";
import type { CampusRow } from "../types";

type CampusColumn = DataTableColumnDef<CampusRow, string>;

/** INS-07 columns (sige/02 §5.2); the actions column exists only for callers who can manage. */
export function getCampusColumns({
  canManage,
  onDelete,
}: {
  canManage: boolean;
  onDelete: (campus: CampusRow) => void;
}): CampusColumn[] {
  const columns: CampusColumn[] = [
    {
      id: "code",
      accessorFn: (row) => row.code ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Código" />,
      cell: ({ row }) =>
        row.original.code ? <Badge variant="outline">{row.original.code}</Badge> : "-",
      meta: { label: "Código" },
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      meta: { label: "Nombre", placeholder: "Buscar sede...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "address",
      accessorFn: (row) => row.address ?? "",
      header: "Dirección",
      cell: ({ row }) => row.original.address ?? "-",
      meta: { label: "Dirección" },
      enableSorting: false,
    },
    {
      id: "jornada",
      accessorKey: "jornada",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Jornada" />,
      cell: ({ row }) => <Badge variant="secondary">{JORNADA_LABEL[row.original.jornada]}</Badge>,
      meta: { label: "Jornada", variant: "select", options: CAMPUS_JORNADA_FILTER_OPTIONS },
      enableColumnFilter: true,
    },
    {
      id: "type",
      accessorFn: (row) => (row.isMain ? "Principal" : "Secundaria"),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Tipo" />,
      cell: ({ row }) =>
        row.original.isMain ? (
          <Badge variant="warning">Principal</Badge>
        ) : (
          <Badge variant="outline">Secundaria</Badge>
        ),
      meta: { label: "Tipo" },
    },
    {
      id: "status",
      accessorFn: (row) => (row.active ? "active" : "inactive"),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estado" />,
      cell: ({ row }) =>
        row.original.active ? (
          <Badge variant="success">Activa</Badge>
        ) : (
          <Badge variant="secondary">Inactiva</Badge>
        ),
      meta: { label: "Estado", variant: "select", options: CAMPUS_STATUS_FILTER_OPTIONS },
      enableColumnFilter: true,
    },
    {
      id: "courseCount",
      accessorKey: "courseCount",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Grados" />,
      cell: ({ row }) => <Badge variant="info">{row.original.courseCount}</Badge>,
      meta: { label: "Grados" },
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          <Link
            to="/sedes/$id/editar"
            params={{ id: row.original.id }}
            aria-label={`Editar sede ${row.original.name}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Pencil />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar sede ${row.original.name}`}
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
