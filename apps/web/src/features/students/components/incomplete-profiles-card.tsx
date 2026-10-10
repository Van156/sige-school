import { Badge } from "@base-template/ui/components/badge";
import { buttonVariants } from "@base-template/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { Link } from "@tanstack/react-router";
import { Pencil, UserRoundX } from "lucide-react";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";
import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import { documentLabel, incompleteSearchConfig, type IncompleteSearch } from "../lib/student-list";
import type { IncompleteStudentRow } from "../types";

type IncompleteTableRow = IncompleteStudentRow & { id: string };

function getIncompleteColumns(
  canEditUser: boolean,
): DataTableColumnDef<IncompleteTableRow, string>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estudiante" />,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">Sin perfil académico</span>
        </div>
      ),
      meta: { label: "Estudiante", placeholder: "Buscar por nombre o documento", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "document",
      accessorFn: documentLabel,
      header: "Documento",
      cell: ({ row }) => <Badge variant="secondary">{documentLabel(row.original)}</Badge>,
      meta: { label: "Documento" },
      enableSorting: false,
    },
    {
      id: "username",
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.username}</span>,
      meta: { label: "Username" },
      enableSorting: false,
    },
    {
      id: "email",
      accessorFn: (row) => row.email ?? "",
      header: "Email",
      cell: ({ row }) => row.original.email ?? "-",
      meta: { label: "Email" },
      enableSorting: false,
    },
    ...(canEditUser
      ? [
          {
            id: "actions",
            header: () => <span className="sr-only">Acciones</span>,
            cell: ({ row }) => (
              <div className="flex justify-end gap-1 whitespace-nowrap">
                <Link
                  to="/usuarios/$personId/editar"
                  params={{ personId: row.original.personId }}
                  aria-label={`Editar usuario ${row.original.username}`}
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <Pencil />
                </Link>
              </div>
            ),
            meta: { label: "Acciones" },
            enableSorting: false,
            enableHiding: false,
          } satisfies DataTableColumnDef<IncompleteTableRow, string>,
        ]
      : []),
  ];
}

/**
 * STU-01 "Perfiles Académicos Incompletos" (sige/05 §5.1): student logins without an academic
 * profile, in a server table with local paging and search. Presentational: the caller decides
 * whether it shows (`hasPendingProfiles`) and owns the `student.listIncomplete` query state.
 * `pendingTotal` is the unfiltered count of the "{n} pendientes" chip.
 */
export default function IncompleteProfilesCard({
  pendingTotal,
  search,
  onSearchChange,
  list,
  canEditUser,
}: {
  pendingTotal: number;
  search: IncompleteSearch;
  onSearchChange: DataTableSearchChange;
  list: {
    rows: IncompleteStudentRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
  /** `user:update`: "Editar usuario" → USR-03. */
  canEditUser: boolean;
}) {
  const columns = useMemo(() => getIncompleteColumns(canEditUser), [canEditUser]);
  const rows = useMemo<IncompleteTableRow[] | undefined>(
    () => list.rows?.map((row) => ({ ...row, id: row.personId })),
    [list.rows],
  );
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Perfiles Académicos Incompletos</CardTitle>
        <CardDescription>
          Usuarios con rol estudiante que aún no tienen perfil académico.
        </CardDescription>
        <CardAction>
          <Badge variant="warning">
            <UserRoundX />
            {pendingTotal} pendientes
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <SimpleListTable
          search={search}
          searchConfig={incompleteSearchConfig}
          onSearchChange={onSearchChange}
          columns={columns}
          emptyTitle="Ningún usuario coincide con la búsqueda."
          emptyIcon={<UserRoundX />}
          list={{ ...list, rows }}
        />
      </CardContent>
    </Card>
  );
}
