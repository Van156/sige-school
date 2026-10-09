import { toRoleKind } from "../lib/user-roles";
import { formatUserDate } from "../lib/user-format";
import type { UserDetail } from "../types";
import RoleBadge from "./role-badge";

/** USR-03 summary strip: username, email, role and creation date. Presentational. */
export default function UserSummaryStrip({
  user,
}: {
  user: Pick<UserDetail, "username" | "email" | "role" | "createdAt">;
}) {
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[13px] sm:grid-cols-4">
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Username</span>
        <span className="font-mono">{user.username}</span>
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">Email</span>
        <span className="truncate">{user.email ?? "Sin correo"}</span>
      </div>
      <div className="flex flex-col items-start">
        <span className="text-xs text-muted-foreground">Rol</span>
        <RoleBadge role={toRoleKind(user.role)} />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Creado</span>
        <span>{formatUserDate(user.createdAt)}</span>
      </div>
    </div>
  );
}
