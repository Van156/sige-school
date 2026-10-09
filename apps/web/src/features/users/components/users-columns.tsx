import { Badge } from "@base-template/ui/components/badge";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2, UserCheck, UserX } from "lucide-react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import {
  USER_ROLE_FILTER_OPTIONS,
  USER_STATUS_FILTER_OPTIONS,
  userRowAccess,
  type UserRowPermissions,
} from "../lib/user-list";
import { toRoleKind } from "../lib/user-roles";
import type { UserRow, UserTableRow } from "../types";
import RoleBadge from "./role-badge";
import UserCell from "./user-cell";

type UserColumn = DataTableColumnDef<UserTableRow, string>;

/** Columns that carry no cell of their own: `createdAt` only backs the default sort. */
export const HIDDEN_COLUMNS = { createdAt: false } as const;

export type UserRowActions = {
  /** `user:update` and `user:delete` of the caller; UX only, the procedures re-check. */
  permissions: UserRowPermissions;
  onToggleActive: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
};

/**
 * USR-01 columns (sige/03 §5.1). Ids are the server's list ids. The "Nombre Completo" column
 * hosts the toolbar search (name, email or username); role and status are select filters. The
 * actions column exists only for callers who can update or delete, and each row shows just the
 * actions allowed on it (never on the caller's own or on `owner`/`admin` rows).
 */
export function getUserColumns({
  permissions,
  onToggleActive,
  onDelete,
}: UserRowActions): UserColumn[] {
  const columns: UserColumn[] = [
    {
      id: "username",
      accessorKey: "username",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Usuario" />,
      cell: ({ row }) => (
        <UserCell
          username={row.original.username}
          email={row.original.email}
          role={toRoleKind(row.original.role)}
        />
      ),
      meta: { label: "Usuario" },
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Nombre Completo" />,
      cell: ({ row }) => row.original.name,
      meta: {
        label: "Nombre Completo",
        placeholder: "Buscar por nombre, apellido, email o username",
        variant: "text",
      },
      enableColumnFilter: true,
    },
    {
      id: "role",
      accessorKey: "role",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Rol" />,
      cell: ({ row }) => <RoleBadge role={toRoleKind(row.original.role)} />,
      meta: { label: "Rol", variant: "select", options: USER_ROLE_FILTER_OPTIONS },
      enableColumnFilter: true,
    },
    {
      id: "status",
      accessorFn: (row) => (row.isActive ? "active" : "inactive"),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Estado" />,
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="secondary">Inactivo</Badge>
        ),
      meta: { label: "Estado", variant: "select", options: USER_STATUS_FILTER_OPTIONS },
      enableColumnFilter: true,
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Creado" />,
      cell: () => null,
      meta: { label: "Creado" },
      enableHiding: false,
    },
  ];

  if (permissions.canUpdate || permissions.canDelete) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const user = row.original;
        const access = userRowAccess(user, permissions);
        return (
          <div className="flex justify-end gap-1 whitespace-nowrap">
            {access.canEdit ? (
              <Link
                to="/usuarios/$personId/editar"
                params={{ personId: user.personId }}
                aria-label={`Editar usuario ${user.username}`}
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                <Pencil />
              </Link>
            ) : null}
            {access.canActivate ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  user.isActive
                    ? `Deshabilitar usuario ${user.username}`
                    : `Habilitar usuario ${user.username}`
                }
                onClick={() => onToggleActive(user)}
              >
                {user.isActive ? <UserX /> : <UserCheck />}
              </Button>
            ) : null}
            {access.canDelete ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar usuario ${user.username}`}
                onClick={() => onDelete(user)}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        );
      },
      meta: { label: "Acciones" },
      enableSorting: false,
      enableHiding: false,
    });
  }
  return columns;
}
