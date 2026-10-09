import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";

import { HelpCard } from "@/features/institution";

import { formatLastAccess } from "../lib/user-format";
import type { UserDetail } from "../types";

/**
 * USR-03 side card "Acciones Rápidas": reset password and enable/disable. Each action is offered
 * only when the caller may run it on this row (pass `undefined` to hide it). Presentational.
 */
export function UserQuickActionsCard({
  isActive,
  onResetPassword,
  onToggleActive,
}: {
  isActive: boolean;
  onResetPassword?: () => void;
  onToggleActive?: () => void;
}) {
  if (!onResetPassword && !onToggleActive) {
    return null;
  }
  return (
    <HelpCard title="Acciones Rápidas">
      <div className="flex flex-col gap-2">
        {onResetPassword ? (
          <Button type="button" variant="outline" onClick={onResetPassword}>
            Resetear Contraseña
          </Button>
        ) : null}
        {onToggleActive ? (
          <Button type="button" variant="outline" onClick={onToggleActive}>
            {isActive ? "Deshabilitar Usuario" : "Habilitar Usuario"}
          </Button>
        ) : null}
      </div>
    </HelpCard>
  );
}

/** USR-03 side card "Información": account facts, including the pending forced change. */
export function UserInfoCard({
  user,
}: {
  user: Pick<
    UserDetail,
    | "username"
    | "email"
    | "documentType"
    | "documentNumber"
    | "isActive"
    | "lastLoginAt"
    | "mustChangePassword"
  >;
}) {
  return (
    <HelpCard title="Información">
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5">
        <dt>Username</dt>
        <dd className="font-mono text-foreground">{user.username}</dd>
        <dt>Email</dt>
        <dd className="break-all text-foreground">{user.email ?? "Sin correo"}</dd>
        <dt>Documento</dt>
        <dd className="text-foreground">
          {user.documentNumber ? `${user.documentType}: ${user.documentNumber}` : "No registrado"}
        </dd>
        <dt>Estado</dt>
        <dd>
          <Badge variant={user.isActive ? "success" : "secondary"}>
            {user.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </dd>
        <dt>Último acceso</dt>
        <dd className="text-foreground">{formatLastAccess(user.lastLoginAt)}</dd>
        <dt>Cambiado contraseña</dt>
        <dd>
          {user.mustChangePassword ? (
            <Badge variant="warning">Pendiente</Badge>
          ) : (
            <span className="text-foreground">Sí</span>
          )}
        </dd>
      </dl>
    </HelpCard>
  );
}
