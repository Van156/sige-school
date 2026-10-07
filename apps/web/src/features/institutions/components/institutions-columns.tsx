import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import type { InstitutionRow } from "../types";

type InstitutionsColumn = DataTableColumnDef<InstitutionRow, string>;

/** INS-01 columns (P0 slice): name, slug, rector (name + username) and creation date. */
export function getInstitutionsColumns(): InstitutionsColumn[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      meta: { label: "Nombre", placeholder: "Buscar por nombre...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "slug",
      accessorKey: "slug",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Identificador" />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.slug}</span>,
      meta: { label: "Identificador", placeholder: "Buscar identificador...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "rector",
      accessorFn: (row) => row.rector?.name ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Rector" />,
      cell: ({ row }) =>
        row.original.rector ? (
          <div className="flex flex-col">
            <span>{row.original.rector.name}</span>
            {row.original.rector.username ? (
              <span className="text-xs text-muted-foreground">{row.original.rector.username}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      meta: { label: "Rector" },
    },
    {
      id: "createdAt",
      accessorFn: (row) => new Date(row.createdAt).toISOString(),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Creada" />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString("es-CO")}
        </span>
      ),
      meta: { label: "Creada", variant: "date" },
    },
  ];
}
