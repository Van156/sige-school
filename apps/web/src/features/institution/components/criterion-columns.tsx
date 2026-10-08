import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { formatWeight, truncateDescription } from "../lib/criterion-list";
import type { CriterionRow } from "../types";

type CriterionColumn = DataTableColumnDef<CriterionRow, string>;

/** INS-17 columns (sige/02 §5.2); the actions column exists only for callers who can manage. */
export function getCriterionColumns({
  canManage,
  onDelete,
}: {
  canManage: boolean;
  onDelete: (criterion: CriterionRow) => void;
}): CriterionColumn[] {
  const columns: CriterionColumn[] = [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      meta: { label: "Nombre", placeholder: "Buscar criterio", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "weight",
      accessorKey: "weight",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Peso (%)" />,
      cell: ({ row }) => <Badge variant="secondary">{formatWeight(row.original.weight)}</Badge>,
      meta: { label: "Peso (%)" },
    },
    {
      id: "description",
      accessorFn: (row) => row.description ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Descripción" />,
      cell: ({ row }) => truncateDescription(row.original.description),
      meta: { label: "Descripción", placeholder: "Buscar descripción", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "orderNum",
      accessorKey: "orderNum",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Orden" />,
      cell: ({ row }) => <Badge variant="outline">{row.original.orderNum}</Badge>,
      meta: { label: "Orden" },
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          <Link
            to="/criterios/$id/editar"
            params={{ id: row.original.id }}
            aria-label={`Editar criterio ${row.original.name}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Pencil />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar criterio ${row.original.name}`}
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
