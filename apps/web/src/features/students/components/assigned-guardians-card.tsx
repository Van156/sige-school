import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { Trash2 } from "lucide-react";

import { guardianContactLine } from "../lib/student-guardians";
import type { GuardianLink } from "../types";

/**
 * STU-04 card "Acudientes Asignados" (sige/05 §5.4): one row per linked guardian account (name,
 * relationship badge, "{email} | {teléfono o Sin teléfono}") with a trash button that asks
 * `onUnlink` to confirm and remove the link; empty "No hay acudientes asignados a este
 * estudiante". Presentational.
 */
export default function AssignedGuardiansCard({
  guardians,
  onUnlink,
}: {
  guardians: readonly GuardianLink[];
  onUnlink: (guardian: GuardianLink) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Acudientes Asignados</CardTitle>
        <CardAction>
          <Badge variant="secondary">{guardians.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {guardians.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No hay acudientes asignados a este estudiante
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {guardians.map((guardian) => (
              <li
                key={guardian.guardianPersonId}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{guardian.name}</span>
                    <Badge variant="info">{guardian.relationship}</Badge>
                  </div>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {guardianContactLine(guardian)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar acudiente ${guardian.name}`}
                  onClick={() => onUnlink(guardian)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
