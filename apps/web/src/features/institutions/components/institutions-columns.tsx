import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Building2, Eye, LogIn, Pencil, Trash2 } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { locationOrDash } from "../lib/institution-format";
import type { InstitutionRow } from "../types";

type InstitutionColumn = DataTableColumnDef<InstitutionRow, string>;

/** Columns that carry no cell of their own: `createdAt` only backs the default sort. */
export const HIDDEN_COLUMNS = { createdAt: false } as const;

export type InstitutionRowActions = {
  onView: (institution: InstitutionRow) => void;
  /** "Gestionar sedes": start working inside the institution (INS-03 flow). */
  onManage: (institution: InstitutionRow) => void;
  /** Set while an institution is being opened: every "Gestionar sedes" waits for it. */
  isManaging?: boolean;
  onDelete: (institution: InstitutionRow) => void;
};

/**
 * INS-01 columns (sige/02 §5.2). Ids are the server's list ids. The name column hosts the
 * toolbar search; NIT and municipality are column filters. "Ubicación" is the `municipality`
 * column: it sorts and filters by municipality and shows "municipio, departamento".
 */
export function getInstitutionColumns({
  onView,
  onManage,
  isManaging = false,
  onDelete,
}: InstitutionRowActions): InstitutionColumn[] {
  return [
    {
      id: "logo",
      header: () => <span className="sr-only">Logo</span>,
      cell: ({ row }) =>
        row.original.logo ? (
          <img src={row.original.logo} alt="" className="size-8 rounded-md object-contain" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground"
          >
            <Building2 className="size-4" />
          </span>
        ),
      meta: { label: "Logo" },
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre" />,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          {row.original.email ? (
            <span className="text-xs text-muted-foreground">{row.original.email}</span>
          ) : null}
        </div>
      ),
      meta: {
        label: "Nombre",
        placeholder: "Buscar por nombre...",
        variant: "text",
      },
      enableColumnFilter: true,
    },
    {
      id: "nit",
      accessorKey: "nit",
      header: ({ column }) => <DataTableColumnHeader column={column} label="NIT" />,
      cell: ({ row }) =>
        row.original.nit ? (
          <Badge variant="outline">{row.original.nit}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      meta: { label: "NIT", placeholder: "Buscar NIT...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "municipality",
      accessorKey: "municipality",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Ubicación" />,
      cell: ({ row }) => locationOrDash(row.original),
      meta: { label: "Ubicación", placeholder: "Buscar municipio...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "academicYear",
      accessorKey: "academicYear",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Año Lectivo" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.academicYear}</Badge>,
      meta: { label: "Año Lectivo" },
    },
    {
      id: "campuses",
      accessorFn: (row) => String(row.counts.campuses),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Sedes" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.counts.campuses}</span>,
      meta: { label: "Sedes" },
    },
    {
      id: "students",
      accessorFn: (row) => String(row.counts.students),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estudiantes" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.counts.students}</span>,
      meta: { label: "Estudiantes" },
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Creada" />,
      cell: () => null,
      meta: { label: "Creada" },
      enableHiding: false,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ver datos completos de ${row.original.name}`}
            onClick={() => onView(row.original)}
          >
            <Eye />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Gestionar sedes de ${row.original.name}`}
            disabled={isManaging}
            onClick={() => onManage(row.original)}
          >
            <LogIn />
          </Button>
          <Link
            to="/admin/instituciones/$institutionId/editar"
            params={{ institutionId: row.original.id }}
            aria-label={`Editar institución ${row.original.name}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Pencil />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar institución ${row.original.name}`}
            onClick={() => onDelete(row.original)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
      meta: { label: "Acciones" },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
