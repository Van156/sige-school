import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import type { SubjectRow } from "../types";

type SubjectColumn = DataTableColumnDef<SubjectRow, string>;

/** INS-13 columns (sige/02 §5.2); the actions column exists only for callers who can manage. */
export function getSubjectColumns({
  canManage,
  onDelete,
}: {
  canManage: boolean;
  onDelete: (subject: SubjectRow) => void;
}): SubjectColumn[] {
  const columns: SubjectColumn[] = [
    {
      id: "code",
      accessorFn: (row) => row.code ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Código" />,
      cell: ({ row }) =>
        row.original.code ? <Badge variant="outline">{row.original.code}</Badge> : "-",
      meta: { label: "Código", placeholder: "Buscar código...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      meta: { label: "Nombre", placeholder: "Buscar asignatura...", variant: "text" },
      enableColumnFilter: true,
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          <Link
            to="/asignaturas/$id/editar"
            params={{ id: row.original.id }}
            aria-label={`Editar asignatura ${row.original.name}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Pencil />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar asignatura ${row.original.name}`}
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
