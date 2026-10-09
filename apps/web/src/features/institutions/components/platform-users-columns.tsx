import { Button } from "@base-template/ui/components/button";
import { KeyRound, Pencil, UserCheck, UserX } from "lucide-react";

import { getUserDataColumns, type UserColumn, type UserRow } from "@/features/users";

import {
  canEditThroughImpersonation,
  PLATFORM_USERS_SEARCH_PLACEHOLDER,
} from "../lib/platform-user-list";

export type PlatformUserRowActions = {
  /** "Editar": start "Gestionar" and open USR-03 for the user. */
  onEdit: (user: UserRow) => void;
  /** "Cambiar contraseña": open the custom-password dialog. */
  onChangePassword: (user: UserRow) => void;
  /** "Desactivar" / "Reactivar": ask the caller to confirm. */
  onToggleActive: (user: UserRow) => void;
  /** An "Editar" is starting: every "Editar" waits for it. */
  isEditing?: boolean;
};

/**
 * INS-04 columns (sige/02 §5.1): the shared user columns plus "Editar", "Cambiar contraseña" and
 * "Desactivar"/"Reactivar". There is no delete: the platform does not delete users (foundation
 * §6.4). "Editar" is not offered on owner/admin rows, which USR-03 refuses to institution callers.
 */
export function getPlatformUserColumns({
  onEdit,
  onChangePassword,
  onToggleActive,
  isEditing = false,
}: PlatformUserRowActions): UserColumn[] {
  const actions: UserColumn = {
    id: "actions",
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          {canEditThroughImpersonation(user) ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Editar usuario ${user.username}`}
              disabled={isEditing}
              onClick={() => onEdit(user)}
            >
              <Pencil />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Cambiar contraseña de ${user.username}`}
            onClick={() => onChangePassword(user)}
          >
            <KeyRound />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              user.isActive
                ? `Desactivar usuario ${user.username}`
                : `Reactivar usuario ${user.username}`
            }
            onClick={() => onToggleActive(user)}
          >
            {user.isActive ? <UserX /> : <UserCheck />}
          </Button>
        </div>
      );
    },
    meta: { label: "Acciones" },
    enableSorting: false,
    enableHiding: false,
  };
  return [...getUserDataColumns(PLATFORM_USERS_SEARCH_PLACEHOLDER), actions];
}
