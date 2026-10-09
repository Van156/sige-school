import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { formatCourseCount } from "../lib/level-list";
import type { LevelRow } from "../types";

type LevelColumn = DataTableColumnDef<LevelRow, string>;

/** INS-09 columns (sige/02 §5.2); the actions column exists only for callers who can manage. */
export function getLevelColumns({
  canManage,
  campusOptions,
  onDelete,
}: {
  canManage: boolean;
  campusOptions: Option[];
  onDelete: (level: LevelRow) => void;
}): LevelColumn[] {
  const columns: LevelColumn[] = [
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
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre del Nivel" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      meta: { label: "Nombre del Nivel", placeholder: "Buscar nivel...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "campus",
      accessorKey: "campusName",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Sede" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.campusName}</Badge>,
      meta: { label: "Sede", variant: "select", options: campusOptions },
      enableColumnFilter: true,
    },
    {
      id: "courseCount",
      accessorKey: "courseCount",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Cursos Asociados" />,
      cell: ({ row }) => (
        <Badge variant="info">{formatCourseCount(row.original.courseCount)}</Badge>
      ),
      meta: { label: "Cursos Asociados" },
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          <Link
            to="/niveles/$id/editar"
            params={{ id: row.original.id }}
            aria-label={`Editar nivel ${row.original.name}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Pencil />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar nivel ${row.original.name}`}
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
