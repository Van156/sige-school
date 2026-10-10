import { Badge } from "@base-template/ui/components/badge";

import type { IncompleteStudentRow } from "../types";

/**
 * STU-03 complete mode (sige/05 §5.3): the existing student login whose academic profile is being
 * completed: name, "{username} | {tipo}: {documento} | {email}" and the "Usuario Creado" badge.
 * Presentational.
 */
export default function ExistingUserBanner({ user }: { user: IncompleteStudentRow }) {
  const details = [
    user.username,
    `${user.documentType}: ${user.documentNumber}`,
    ...(user.email ? [user.email] : []),
  ].join(" | ");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[13px]">
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{user.name}</span>
        <span className="truncate text-muted-foreground">{details}</span>
      </div>
      <Badge variant="success">Usuario Creado</Badge>
    </div>
  );
}
